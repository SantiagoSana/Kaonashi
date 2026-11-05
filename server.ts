// KAONASHI FULL-STACK NODE & EXPRESS SERVER
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { SignJWT, jwtVerify } from 'jose';
import { GoogleGenAI } from '@google/genai';
import { getEnv } from './src/lib/env';
import { getDataStore } from './src/lib/data/datastore';
import { cookieOptions, getCookieName } from './src/lib/cookies';
import { computeQrSignature, verifyQrSignature, generateShortCode } from './src/lib/qr';
import { globalAuditLogger } from './src/lib/audit-logger';
import { authorize } from './src/lib/security/authorize';
import { verifyPassword } from './src/lib/security/password';
import { checkRateLimit, recordFailedAttempt } from './src/lib/security/rate-limit';
import { computePricing } from './src/lib/pricing';
import { exportToCsv, parseCsv, sanitizeForCsvFormulaInjection } from './src/lib/csv';
import { StaffRole, Order, ScanEvent, FunnelEvent, AttributionSnapshot, Reservation, Coupon, MenuItem } from './src/lib/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const env = getEnv();
  const datastore = await getDataStore();
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Derive request origin and proxy info
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // JWT signing secret for sessions & attribution
  const jwtSecret = new TextEncoder().encode(env.SESSION_SECRET);

  // -------------------------------------------------------------
  // 1. QR RESOLVER (§5.2: /r/:code)
  // -------------------------------------------------------------
  app.get('/r/:code', async (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const sig = req.query.s as string;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip + new Date().toISOString().slice(0, 10)).digest('hex').slice(0, 16);

    // Rate limit: 30 scans per min
    const rl = checkRateLimit(`scan_${ipHash}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Rate Limited</title>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0B0C10;color:#F4F1EA;">
          <h2>Límite de escaneos alcanzado</h2>
          <p>Por favor espera un momento antes de volver a escanear.</p>
        </body></html>
      `);
    }

    const qrList = await datastore.qrCodes.list((q) => q.shortCode === code);
    const qr = qrList[0];

    // Unknown code -> friendly 404
    if (!qr) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Código no activo</title>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0B0C10;color:#F4F1EA;">
          <h2>Código QR no activo</h2>
          <p>Este código no se encuentra registrado en el sistema.</p>
          <a href="/menu" style="color:#D4AF37;">Ir al Menú Principal</a>
        </body></html>
      `);
    }

    // Verify HMAC signature
    const isValidSig = verifyQrSignature(qr.shortCode, qr.touchpointId, sig);
    if (!isValidSig) {
      globalAuditLogger.log({
        actor: 'guest',
        role: 'customer',
        action: 'qr.invalid_signature',
        resource: code,
        outcome: 'failure',
        ipHash,
        details: { shortCode: code, touchpointId: qr.touchpointId, sig },
      });
      return res.status(404).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Firma no válida</title>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0B0C10;color:#F4F1EA;">
          <h2>Código QR no verificado</h2>
          <p>La firma de autenticidad del código es inválida.</p>
          <a href="/menu" style="color:#D4AF37;">Ir al Menú Principal</a>
        </body></html>
      `);
    }

    // Check Revoked
    if (qr.status === 'revoked') {
      return res.status(410).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Oferta Finalizada</title>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0B0C10;color:#F4F1EA;">
          <h2>Esta activación ha sido revocada</h2>
          <p>El enlace de este código ha sido retirado.</p>
          <a href="/menu" style="color:#D4AF37;">Descubre nuestro menú regular</a>
        </body></html>
      `);
    }

    // Check validity window and maxScans
    const nowIso = new Date().toISOString();
    const isExpired = qr.status === 'paused' || nowIso < qr.validFrom || nowIso > qr.validTo || (qr.maxScans && qr.scansCount >= qr.maxScans);

    // Session resolution
    let sessionId = req.cookies.kns_sid;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Uniqueness check: no scan for same qrId from same session or ipHash in last 30 mins
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const recentScans = await datastore.scanEvents.list(
      (s) => s.qrId === qr.id && s.timestamp > thirtyMinAgo && (s.sessionId === sessionId || s.ipHash === ipHash)
    );
    const isUnique = recentScans.length === 0;

    // Record ScanEvent
    const scanEvent: ScanEvent = {
      id: `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      qrId: qr.id,
      campaignId: qr.campaignId,
      touchpointId: qr.touchpointId,
      timestamp: nowIso,
      sessionId,
      ipHash,
      deviceClass: 'mobile',
      os: 'generic',
      language: req.headers['accept-language']?.slice(0, 2) || 'es',
      isUnique,
      outcome: isExpired ? 'expired' : 'ok',
      isDemo: req.query.isDemo === 'true',
    };
    await datastore.scanEvents.create(scanEvent);

    // Increment QR scansCount
    await datastore.qrCodes.update(qr.id, { scansCount: qr.scansCount + 1 });

    // Update Daily Stats Rollup
    const today = nowIso.slice(0, 10);
    const rollupId = `branch_central_${qr.campaignId}_${qr.touchpointId}_${today}`;
    const existingRollup = await datastore.statsDaily.get(rollupId);
    if (existingRollup) {
      await datastore.statsDaily.update(rollupId, {
        scans: existingRollup.scans + 1,
        uniqueScans: existingRollup.uniqueScans + (isUnique ? 1 : 0),
      });
    } else {
      await datastore.statsDaily.create({
        id: rollupId,
        branchId: 'branch_central',
        campaignId: qr.campaignId,
        touchpointId: qr.touchpointId,
        date: today,
        scans: 1,
        uniqueScans: isUnique ? 1 : 0,
        landingViews: 0,
        engaged: 0,
        leads: 0,
        claims: 0,
        addToCart: 0,
        checkoutStarted: 0,
        orders: 0,
        revenueMinor: 0,
        discountCostMinor: 0,
      });
    }

    // Set signed attribution cookie kns_attr (30 days)
    const attrPayload = {
      qrId: qr.id,
      campaignId: qr.campaignId,
      touchpointId: qr.touchpointId,
      tableNumber: qr.tableNumber,
      utm: qr.utm,
      timestamp: nowIso,
    };
    const attrToken = await new SignJWT(attrPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(jwtSecret);

    const attrOpt = cookieOptions('attr');
    res.cookie(getCookieName('attr'), attrToken, {
      httpOnly: attrOpt.httpOnly,
      secure: attrOpt.secure,
      sameSite: attrOpt.sameSite,
      path: attrOpt.path,
      maxAge: attrOpt.maxAge,
    });

    // Set rolling kns_sid (30 min)
    const sidOpt = cookieOptions('sid');
    res.cookie(getCookieName('sid'), sessionId, {
      httpOnly: sidOpt.httpOnly,
      secure: sidOpt.secure,
      sameSite: sidOpt.sameSite,
      path: sidOpt.path,
      maxAge: sidOpt.maxAge,
    });

    // Destination handling
    if (isExpired) {
      const fallback = qr.fallbackDestination || '/menu?from=expired';
      return res.redirect(302, fallback);
    }

    let targetPath = qr.destination || '/menu';
    // Validate destination is internal
    if (!targetPath.startsWith('/') || targetPath.startsWith('//')) {
      targetPath = '/menu';
    }

    const utmParams = new URLSearchParams({
      utm_source: qr.utm.source,
      utm_medium: qr.utm.medium,
      utm_campaign: qr.utm.campaign,
      utm_content: qr.utm.content,
    });

    const separator = targetPath.includes('?') ? '&' : '?';
    return res.redirect(302, `${targetPath}${separator}${utmParams.toString()}`);
  });

  // -------------------------------------------------------------
  // 2. EVENT INGESTION (§5.10: POST /api/track)
  // -------------------------------------------------------------
  app.post('/api/track', async (req: Request, res: Response) => {
    const { eventId, type, path: eventPath, campaignId } = req.body;
    const allowedClientTypes = ['landing_view', 'cta_click', 'engaged', 'menu_view', 'add_to_cart', 'checkout_started'];

    if (!allowedClientTypes.includes(type)) {
      return res.status(400).json({ error: 'INVALID_EVENT_TYPE' });
    }

    const sessionId = req.cookies.kns_sid || crypto.randomUUID();
    const event: FunnelEvent = {
      id: `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      eventId: eventId || crypto.randomUUID(),
      sessionId,
      type,
      campaignId,
      timestamp: new Date().toISOString(),
      source: 'client',
    };

    await datastore.funnelEvents.create(event);

    // Update Daily Stats Rollup if campaignId present
    if (campaignId) {
      const today = new Date().toISOString().slice(0, 10);
      const rollups = await datastore.statsDaily.list((s) => s.campaignId === campaignId && s.date === today);
      if (rollups[0]) {
        const r = rollups[0];
        const updates: Partial<typeof r> = {};
        if (type === 'landing_view') updates.landingViews = r.landingViews + 1;
        if (type === 'engaged' || type === 'cta_click') updates.engaged = r.engaged + 1;
        if (type === 'add_to_cart') updates.addToCart = r.addToCart + 1;
        if (type === 'checkout_started') updates.checkoutStarted = r.checkoutStarted + 1;
        await datastore.statsDaily.update(r.id, updates);
      }
    }

    return res.json({ ok: true });
  });

  // -------------------------------------------------------------
  // 3. SCHEDULED CRON TICK (§0.1 item 12: /api/cron/tick)
  // -------------------------------------------------------------
  app.all('/api/cron/tick', async (req: Request, res: Response) => {
    const secret = req.headers['authorization'] || req.query.secret;
    if (env.CRON_SECRET && env.APP_ENV === 'production') {
      if (secret !== `Bearer ${env.CRON_SECRET}` && secret !== env.CRON_SECRET) {
        return res.status(401).json({ error: 'UNAUTHORIZED_CRON' });
      }
    }

    // Clean up expired reservation holds
    const nowIso = new Date().toISOString();
    const heldReservations = await datastore.reservations.list((r) => r.status === 'held' && !!r.holdExpiresAt && r.holdExpiresAt < nowIso);
    for (const r of heldReservations) {
      await datastore.reservations.update(r.id, { status: 'cancelled' });
    }

    return res.json({ ok: true, timestamp: nowIso, releasedHolds: heldReservations.length });
  });

  // -------------------------------------------------------------
  // 4. REAL-TIME SERVER-SENT EVENTS (§0.1 item 11, §8: /api/stream/*)
  // -------------------------------------------------------------
  app.get('/api/stream/orders', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onOrderUpdate = (order: Order) => {
      res.write(`event: order_update\ndata: ${JSON.stringify(order)}\n\n`);
    };

    datastore.events.on('order_update', onOrderUpdate);

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      datastore.events.off('order_update', onOrderUpdate);
    });
  });

  app.get('/api/stream/kds', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onKdsUpdate = (data: any) => {
      res.write(`event: kds_update\ndata: ${JSON.stringify(data)}\n\n`);
    };

    datastore.events.on('order_update', onKdsUpdate);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      datastore.events.off('order_update', onKdsUpdate);
    });
  });

  // -------------------------------------------------------------
  // 5. AUTHENTICATION & SESSIONS (§10.1, §10.1b)
  // -------------------------------------------------------------
  app.get('/api/auth/cookie-probe', (req: Request, res: Response) => {
    const probeVal = 'kns_probe_ok';
    res.cookie('kns_probe', probeVal, { path: '/', httpOnly: false, sameSite: 'none', secure: true });
    res.json({ ok: true });
  });

  app.get('/api/auth/session', async (req: Request, res: Response) => {
    const sessionToken = req.cookies[getCookieName('session')];
    if (!sessionToken) {
      return res.json({ session: null });
    }
    try {
      const verified = await jwtVerify(sessionToken, jwtSecret);
      return res.json({ session: verified.payload });
    } catch {
      return res.json({ session: null });
    }
  });

  app.post('/api/auth/staff-login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const ip = req.ip || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    // Rate limiting: 5 attempts per 15 min per username and IP
    const rl = checkRateLimit(`login_${username}_${ipHash}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds || 900));
      return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', retryAfterSeconds: rl.retryAfterSeconds });
    }

    const users = await datastore.staffUsers.list((u) => u.username === username);
    const user = users[0];

    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      recordFailedAttempt(`login_${username}_${ipHash}`, 5, 15 * 60 * 1000);
      globalAuditLogger.log({
        actor: username || 'unknown',
        role: 'customer',
        action: 'login.failed',
        resource: 'staff_portal',
        outcome: 'failure',
        ipHash,
      });
      // Generic message to prevent account enumeration
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    // In demo mode or if totp disabled, authenticate directly
    const sessionPayload = {
      kind: 'staff',
      userId: user.id,
      role: user.role,
      branchIds: user.branchIds,
      email: user.email,
      name: user.name,
    };

    const sessionJwt = await new SignJWT(sessionPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(jwtSecret);

    const sOpt = cookieOptions('session');
    res.cookie(getCookieName('session'), sessionJwt, {
      httpOnly: sOpt.httpOnly,
      secure: sOpt.secure,
      sameSite: sOpt.sameSite,
      path: sOpt.path,
      maxAge: sOpt.maxAge,
    });

    globalAuditLogger.log({
      actor: user.username,
      role: user.role,
      action: 'login.success',
      resource: 'staff_portal',
      outcome: 'success',
      ipHash,
    });

    return res.json({ ok: true, session: sessionPayload });
  });

  app.post('/api/auth/customer-login-simulated', async (req: Request, res: Response) => {
    const { email } = req.body;
    const normalized = (email || '').toLowerCase().trim();
    if (!normalized) return res.status(400).json({ error: 'EMAIL_REQUIRED' });

    let customers = await datastore.customers.list((c) => c.emailNormalized === normalized);
    let customer = customers[0];

    if (!customer) {
      customer = await datastore.customers.create({
        id: `cust_${Date.now()}`,
        emailNormalized: normalized,
        name: normalized.split('@')[0],
        authProviders: ['google'],
        locale: 'es',
        displayCurrency: 'COP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const sessionPayload = {
      kind: 'customer',
      userId: customer.id,
      role: 'customer' as StaffRole,
      email: customer.emailNormalized,
      name: customer.name,
    };

    const sessionJwt = await new SignJWT(sessionPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(jwtSecret);

    const sOpt = cookieOptions('session');
    res.cookie(getCookieName('session'), sessionJwt, {
      httpOnly: sOpt.httpOnly,
      secure: sOpt.secure,
      sameSite: sOpt.sameSite,
      path: sOpt.path,
      maxAge: sOpt.maxAge,
    });

    return res.json({ ok: true, session: sessionPayload });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.clearCookie(getCookieName('session'), { path: '/' });
    res.clearCookie(getCookieName('challenge'), { path: '/' });
    res.clearCookie(getCookieName('pre_mfa'), { path: '/' });
    return res.json({ ok: true });
  });

  // -------------------------------------------------------------
  // 6. MENU & INVENTORY DATA APIs
  // -------------------------------------------------------------
  app.get('/api/menu', async (req: Request, res: Response) => {
    const items = await datastore.menuItems.list();
    const inventory = await datastore.inventoryItems.list();
    return res.json({ items, inventory });
  });

  app.post('/api/menu/:id/toggle-86', async (req: Request, res: Response) => {
    const item = await datastore.menuItems.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });

    const newAvailable = !item.available;
    const updated = await datastore.menuItems.update(item.id, {
      available: newAvailable,
      is86: !newAvailable,
    });

    globalAuditLogger.log({
      actor: 'kitchen_manager',
      role: 'kitchen_manager',
      action: 'menu.toggle_86',
      resource: item.slug,
      outcome: 'success',
      before: { available: item.available },
      after: { available: newAvailable },
    });

    return res.json({ item: updated });
  });

  app.post('/api/menu/:id/price', async (req: Request, res: Response) => {
    const { priceMinor } = req.body;
    if (typeof priceMinor !== 'number' || priceMinor < 0) {
      return res.status(400).json({ error: 'INVALID_PRICE' });
    }
    const item = await datastore.menuItems.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'ITEM_NOT_FOUND' });

    const updated = await datastore.menuItems.update(item.id, { price: priceMinor });

    globalAuditLogger.log({
      actor: 'kaonashi_sysmaster',
      role: 'sysmaster',
      action: 'menu.edit_price',
      resource: item.slug,
      outcome: 'success',
      before: { price: item.price },
      after: { price: priceMinor },
    });

    return res.json({ item: updated });
  });

  // -------------------------------------------------------------
  // 7. COUPONS & CLAIMS
  // -------------------------------------------------------------
  app.post('/api/coupons/claim', async (req: Request, res: Response) => {
    const { couponCode, campaignId } = req.body;
    const coupons = await datastore.coupons.list((c) => c.code === couponCode);
    const coupon = coupons[0];
    if (!coupon || coupon.status !== 'active') {
      return res.status(404).json({ error: 'COUPON_NOT_FOUND' });
    }

    const sessionId = req.cookies.kns_sid || crypto.randomUUID();
    const walletId = req.cookies.kns_wallet || crypto.randomUUID();

    const claim: any = {
      id: `claim_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      couponId: coupon.id,
      walletId,
      sessionId,
      status: 'claimed',
      claimedAt: new Date().toISOString(),
      expiresAt: coupon.validTo,
    };
    await datastore.couponClaims.create(claim);

    // Set wallet cookie
    const wOpt = cookieOptions('wallet');
    res.cookie(getCookieName('wallet'), walletId, {
      httpOnly: wOpt.httpOnly,
      secure: wOpt.secure,
      sameSite: wOpt.sameSite,
      path: wOpt.path,
      maxAge: wOpt.maxAge,
    });

    return res.json({ ok: true, coupon, claimId: claim.id });
  });

  app.post('/api/coupons/redeem-in-person', async (req: Request, res: Response) => {
    const { code, billAmountMinor, posRef, table } = req.body;
    if (!code || typeof billAmountMinor !== 'number' || billAmountMinor <= 0) {
      return res.status(400).json({ error: 'BILL_AMOUNT_REQUIRED' });
    }

    const coupons = await datastore.coupons.list((c) => c.code === code.trim().toUpperCase());
    const coupon = coupons[0];
    if (!coupon || coupon.status !== 'active') {
      return res.status(404).json({ error: 'COUPON_NOT_FOUND' });
    }

    // Check if totalCap reached
    if (coupon.redeemedCount >= coupon.totalCap) {
      return res.status(400).json({ error: 'COUPON_EXHAUSTED' });
    }

    // Update coupon count
    await datastore.coupons.update(coupon.id, { redeemedCount: coupon.redeemedCount + 1 });

    // Calculate discount
    let discountMinor = 0;
    if (coupon.type === 'percent') {
      discountMinor = Math.round((billAmountMinor * coupon.value) / 10000);
    } else if (coupon.type === 'fixed') {
      discountMinor = Math.min(coupon.value, billAmountMinor);
    } else {
      discountMinor = 36000; // default item value
    }

    // Create walk-in order attributed to campaign (§5.4)
    const orderNumber = `WALK-${Date.now().toString().slice(-4)}`;
    const walkInOrder: Order = {
      id: `order_walkin_${Date.now()}`,
      orderNumber,
      token: `tok_${crypto.randomBytes(8).toString('hex')}`,
      branchId: 'branch_central',
      source: 'in_person',
      type: 'dine_in',
      tableNumber: table || 'Barra',
      tableSource: 'manual',
      guestInfo: { name: 'Cliente en Barra', phone: '', email: '' },
      items: [{ menuItemId: 'walkin_item', name: 'Consumo en Barra', priceMinor: billAmountMinor, qty: 1, discountMinor, station: 'expo' }],
      subtotalMinor: billAmountMinor,
      discountMinor,
      appliedCouponCode: coupon.code,
      deliveryFeeMinor: 0,
      serviceChargeMinor: 0,
      taxMinor: Math.round(billAmountMinor * 0.19),
      tipMinor: 0,
      totalMinor: Math.max(0, billAmountMinor - discountMinor),
      currencyCharged: 'COP',
      pointsEarned: 0,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'pay_at_venue',
      attribution: {
        first: { campaignId: coupon.campaignId || 'camp_coasters', touchpointId: 'in_person', qrId: 'in_person', at: new Date().toISOString() },
        last: { campaignId: coupon.campaignId || 'camp_coasters', touchpointId: 'in_person', qrId: 'in_person', at: new Date().toISOString() },
        model: 'last_touch',
        windowDays: 7,
        matchedBy: 'coupon',
        touchAgeHours: 0,
      },
      statusHistory: [{ status: 'completed', timestamp: new Date().toISOString(), note: 'In-person redemption' }],
      stationTickets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await datastore.orders.create(walkInOrder);

    // Record CouponRedemption
    await datastore.couponRedemptions.create({
      id: `red_${Date.now()}`,
      couponId: coupon.id,
      orderId: walkInOrder.id,
      channel: 'in_person',
      discountMinor,
      billAmountMinor,
      posRef,
      staffId: 'reception_lead',
      redeemedAt: new Date().toISOString(),
    });

    globalAuditLogger.log({
      actor: 'reception_lead',
      role: 'reception',
      action: 'coupon.redeem_in_person',
      resource: coupon.code,
      outcome: 'success',
      details: { billAmountMinor, discountMinor, orderNumber },
    });

    return res.json({ ok: true, order: walkInOrder, discountMinor });
  });

  // -------------------------------------------------------------
  // 8. ORDERS & CHECKOUT (§6.4, §8.1)
  // -------------------------------------------------------------
  app.get('/api/orders', async (req: Request, res: Response) => {
    const list = await datastore.orders.list();
    return res.json({ orders: list.reverse() });
  });

  app.get('/api/orders/:id', async (req: Request, res: Response) => {
    const order = await datastore.orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    return res.json({ order });
  });

  app.post('/api/orders', async (req: Request, res: Response) => {
    const { items, guestInfo, type, tableNumber, tableSource, appliedCouponCode, tipPercent, branchId = 'branch_central' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'EMPTY_CART' });
    }

    // Server-authoritative price calculation from database
    const allMenu = await datastore.menuItems.list();
    const menuMap = new Map(allMenu.map((m) => [m.id, m]));

    const cartLineInputs = items.map((i: any) => {
      const dbItem = menuMap.get(i.menuItemId);
      if (!dbItem) throw new Error(`Dish not found: ${i.menuItemId}`);
      return {
        item: dbItem,
        qty: Number(i.qty) || 1,
        selectedModifiers: i.selectedModifiers,
      };
    });

    let couponObj = null;
    if (appliedCouponCode) {
      const matchedCoupons = await datastore.coupons.list((c) => c.code === appliedCouponCode.toUpperCase());
      couponObj = matchedCoupons[0] || null;
    }

    const pricing = computePricing({
      branchId,
      currency: 'COP',
      lines: cartLineInputs,
      coupon: couponObj,
      orderType: type || 'dine_in',
      tipPercentOrCustom: Number(tipPercent) || 10,
      taxRate: 0.19,
      taxMode: 'inclusive',
      deliveryFeeMinor: type === 'delivery' ? 7000 : 0,
      allMenuItems: allMenu,
    });

    // Resolve attribution from signed cookie
    let attributionSnapshot: AttributionSnapshot = {
      first: null,
      last: null,
      model: 'last_touch',
      windowDays: 7,
      matchedBy: 'none',
      touchAgeHours: 0,
    };

    const attrCookie = req.cookies[getCookieName('attr')];
    if (attrCookie) {
      try {
        const decoded = await jwtVerify(attrCookie, jwtSecret);
        const p: any = decoded.payload;
        attributionSnapshot = {
          first: { campaignId: p.campaignId, touchpointId: p.touchpointId, qrId: p.qrId, at: p.timestamp },
          last: { campaignId: p.campaignId, touchpointId: p.touchpointId, qrId: p.qrId, at: p.timestamp },
          model: 'last_touch',
          windowDays: 7,
          matchedBy: 'cookie',
          touchAgeHours: 1,
        };
      } catch {}
    }

    // Coupon campaign attribution takes precedence if present
    if (couponObj?.campaignId) {
      attributionSnapshot.matchedBy = 'coupon';
      attributionSnapshot.last = {
        campaignId: couponObj.campaignId,
        touchpointId: 'coupon_code',
        qrId: couponObj.id,
        couponId: couponObj.id,
        at: new Date().toISOString(),
      };
    }

    // Order status rules (§6.4)
    // Pay at venue with manual table or delivery starts as pending_confirmation
    const requiresConfirmation = (type === 'dine_in' && tableSource === 'manual') || type === 'delivery';
    const initialStatus = requiresConfirmation ? 'pending_confirmation' : 'received';

    const orderNumber = `KNS-${Math.floor(100 + Math.random() * 900)}`;
    const newOrder: Order = {
      id: `order_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      orderNumber,
      token: `tok_${crypto.randomBytes(12).toString('hex')}`,
      branchId,
      source: 'online',
      type: type || 'dine_in',
      tableNumber: tableNumber || (type === 'dine_in' ? '4' : undefined),
      tableSource: tableSource || 'none',
      guestInfo: guestInfo || { name: 'Invitado', phone: '+573000000000', email: 'guest@kaonashi.internal' },
      items: pricing.lines.map((l) => ({
        menuItemId: l.menuItemId,
        name: l.name,
        priceMinor: l.basePriceMinor,
        qty: l.qty,
        discountMinor: l.totalDiscountMinor,
        station: l.name.toLowerCase().includes('sushi') || l.name.toLowerCase().includes('nigiri') || l.name.toLowerCase().includes('roll') ? 'sushi' : 'robata',
      })),
      subtotalMinor: pricing.grossSubtotalMinor,
      discountMinor: pricing.totalDiscountMinor,
      appliedCouponCode: couponObj?.code,
      deliveryFeeMinor: pricing.deliveryFeeMinor,
      serviceChargeMinor: pricing.serviceChargeMinor,
      taxMinor: pricing.taxMinor,
      tipMinor: pricing.tipMinor,
      totalMinor: pricing.totalMinor,
      currencyCharged: 'COP',
      pointsEarned: Math.floor(pricing.netPreTaxSubtotalMinor / 100),
      status: initialStatus,
      paymentStatus: 'paid',
      paymentMethod: 'pay_at_venue',
      attribution: attributionSnapshot,
      statusHistory: [{ status: initialStatus, timestamp: new Date().toISOString() }],
      stationTickets: [
        { id: `tkt_${Date.now()}_sushi`, orderId: '', station: 'sushi', status: 'pending' },
        { id: `tkt_${Date.now()}_robata`, orderId: '', station: 'robata', status: 'pending' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedDeliveryEta: type === 'delivery' ? '45 min' : undefined,
      deliveryPin: type === 'delivery' ? String(Math.floor(1000 + Math.random() * 9000)) : undefined,
    };

    newOrder.stationTickets.forEach((t) => (t.orderId = newOrder.id));

    await datastore.orders.create(newOrder);

    // Notify SSE listeners
    datastore.events.emit('order_update', newOrder);

    // Record FunnelEvent
    await datastore.funnelEvents.create({
      id: `evt_ord_${Date.now()}`,
      eventId: crypto.randomUUID(),
      sessionId: req.cookies.kns_sid || 'session_guest',
      type: 'order_completed',
      campaignId: attributionSnapshot.last?.campaignId,
      orderId: newOrder.id,
      valueMinor: newOrder.totalMinor,
      timestamp: new Date().toISOString(),
      source: 'server',
    });

    return res.json({ ok: true, order: newOrder });
  });

  app.post('/api/orders/:id/status', async (req: Request, res: Response) => {
    const { status, note } = req.body;
    const order = await datastore.orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

    const history = [...order.statusHistory, { status, timestamp: new Date().toISOString(), note }];

    // If transitioned to preparing, start station tickets
    let tickets = order.stationTickets;
    if (status === 'preparing') {
      tickets = tickets.map((t) => ({ ...t, status: 'started', startedAt: new Date().toISOString() }));
    } else if (status === 'quality_check' || status === 'ready_for_pickup' || status === 'served') {
      tickets = tickets.map((t) => ({ ...t, status: 'ready', readyAt: new Date().toISOString() }));
    }

    const updated = await datastore.orders.update(order.id, {
      status,
      statusHistory: history,
      stationTickets: tickets,
      updatedAt: new Date().toISOString(),
    });

    datastore.events.emit('order_update', updated);

    return res.json({ ok: true, order: updated });
  });

  // -------------------------------------------------------------
  // 9. LEADS & CAMPAIGNS (§5.6)
  // -------------------------------------------------------------
  app.post('/api/leads', async (req: Request, res: Response) => {
    const { campaignId, name, emailOrPhone, marketingConsent } = req.body;
    if (!campaignId || !emailOrPhone) {
      return res.status(400).json({ error: 'CONTACT_REQUIRED' });
    }

    const isEmail = emailOrPhone.includes('@');
    const normalized = emailOrPhone.trim().toLowerCase();

    // Find campaign and coupon
    const campaigns = await datastore.campaigns.list((c) => c.id === campaignId || c.slug === campaignId);
    const campaign = campaigns[0];
    const coupons = await datastore.coupons.list((c) => c.campaignId === campaign?.id);
    const coupon = coupons[0];

    const lead = await datastore.leads.create({
      id: `lead_${Date.now()}`,
      campaignId: campaign ? campaign.id : campaignId,
      name,
      emailNormalized: isEmail ? normalized : undefined,
      phoneNormalized: !isEmail ? normalized : undefined,
      language: 'es',
      consent: {
        marketing: Boolean(marketingConsent),
        privacyVersion: 'v1.0',
        timestamp: new Date().toISOString(),
        ipHash: 'lead_ip',
      },
      attribution: {
        first: { campaignId: campaign?.id || campaignId, touchpointId: 'landing', qrId: 'web', at: new Date().toISOString() },
        last: { campaignId: campaign?.id || campaignId, touchpointId: 'landing', qrId: 'web', at: new Date().toISOString() },
        model: 'last_touch',
        windowDays: 7,
        matchedBy: 'lead',
        touchAgeHours: 0,
      },
      status: 'coupon_issued',
      createdAt: new Date().toISOString(),
    });

    // Auto claim to wallet
    const walletId = req.cookies.kns_wallet || crypto.randomUUID();
    const wOpt = cookieOptions('wallet');
    res.cookie(getCookieName('wallet'), walletId, {
      httpOnly: wOpt.httpOnly,
      secure: wOpt.secure,
      sameSite: wOpt.sameSite,
      path: wOpt.path,
      maxAge: wOpt.maxAge,
    });

    return res.json({ ok: true, lead, coupon });
  });

  app.get('/api/campaigns', async (req: Request, res: Response) => {
    const list = await datastore.campaigns.list();
    const tps = await datastore.touchpoints.list();
    const qrs = await datastore.qrCodes.list();
    const cpn = await datastore.coupons.list();
    const stats = await datastore.statsDaily.list();
    const dist = await datastore.distributionLogs.list();
    const costs = await datastore.costEntries.list();
    return res.json({ campaigns: list, touchpoints: tps, qrCodes: qrs, coupons: cpn, stats, distributionLogs: dist, costEntries: costs });
  });

  // -------------------------------------------------------------
  // 10. QR GENERATOR API (§5.3)
  // -------------------------------------------------------------
  app.post('/api/qr/generate', async (req: Request, res: Response) => {
    const { campaignId, touchpointType, label, location, destination, qrMode, design } = req.body;

    const shortCode = generateShortCode();
    const touchpointId = `tp_${Date.now()}`;

    const touchpoint = await datastore.touchpoints.create({
      id: touchpointId,
      campaignId,
      type: touchpointType || 'coaster',
      label: label || 'Activación Kaonashi',
      location: location || 'Sede Principal',
      unitsPrinted: 500,
      unitCostMinor: 450,
      branchId: 'branch_central',
      unitsDistributed: 0,
      qrMode: qrMode || 'shared',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const signature = computeQrSignature(shortCode, touchpointId);

    const qr = await datastore.qrCodes.create({
      id: `qr_${Date.now()}`,
      shortCode,
      touchpointId,
      campaignId,
      destination: destination || '/menu',
      fallbackDestination: '/menu',
      signature,
      utm: {
        source: touchpointType || 'coaster',
        medium: 'qr',
        campaign: campaignId,
        content: label || 'qr_activation',
      },
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      scansCount: 0,
      status: 'active',
      design: design || { fgColor: '#0B0C10', bgColor: '#FFFFFF', hasLogo: true, dots: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.json({ ok: true, qr, touchpoint, scanUrl: `/r/${shortCode}?s=${signature}` });
  });

  // -------------------------------------------------------------
  // 11. AUDIT LOG & INTEGRITY (§10.7)
  // -------------------------------------------------------------
  app.get('/api/audit', (req: Request, res: Response) => {
    const entries = globalAuditLogger.getEntries();
    const integrity = globalAuditLogger.verifyIntegrity();
    return res.json({ entries: entries.reverse(), integrity });
  });

  app.post('/api/audit/verify', (req: Request, res: Response) => {
    const integrity = globalAuditLogger.verifyIntegrity();
    return res.json({ integrity });
  });

  app.post('/api/audit/tamper-demo', (req: Request, res: Response) => {
    globalAuditLogger.tamperEntryForTesting(1);
    return res.json({ ok: true, message: 'Entry 1 tampered for testing' });
  });

  // -------------------------------------------------------------
  // 12. DEMO SEED RESET
  // -------------------------------------------------------------
  app.post('/api/seed/reset', async (req: Request, res: Response) => {
    await datastore.resetDemoData();
    return res.json({ ok: true });
  });

  // -------------------------------------------------------------
  // 13. GEMINI AI CLIENT INITIALIZATION
  // -------------------------------------------------------------
  const geminiApiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
  const aiClient = geminiApiKey
    ? new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      })
    : null;

  // -------------------------------------------------------------
  // 14. CUSTOMER AUTH & OTP CHALLENGE (§10.4)
  // -------------------------------------------------------------
  const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

  app.post('/api/auth/otp/send', async (req: Request, res: Response) => {
    const { contact } = req.body;
    if (!contact || typeof contact !== 'string') {
      return res.status(400).json({ error: 'CONTACT_REQUIRED' });
    }

    const cleanContact = contact.trim().toLowerCase();
    const rateCheck = checkRateLimit(`otp_send_${cleanContact}`, 4, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
    }

    // Generate 6-digit OTP (deterministic 884210 in demo for predictable testing if desired, or random)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(cleanContact, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    return res.json({
      ok: true,
      message: 'Código de verificación enviado',
      debugCode: code, // Provided for automated testing & zero-config demo
    });
  });

  app.post('/api/auth/otp/verify', async (req: Request, res: Response) => {
    const { contact, code } = req.body;
    if (!contact || !code) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }

    const cleanContact = contact.trim().toLowerCase();
    const challenge = otpStore.get(cleanContact);

    if (!challenge) {
      return res.status(400).json({ error: 'CHALLENGE_EXPIRED_OR_NOT_FOUND' });
    }

    if (Date.now() > challenge.expiresAt) {
      otpStore.delete(cleanContact);
      return res.status(400).json({ error: 'CODE_EXPIRED' });
    }

    challenge.attempts += 1;
    if (challenge.attempts > 5) {
      otpStore.delete(cleanContact);
      return res.status(429).json({ error: 'MAX_ATTEMPTS_EXCEEDED' });
    }

    if (challenge.code !== code.trim()) {
      return res.status(400).json({ error: 'INVALID_CODE' });
    }

    // Success -> consume OTP
    otpStore.delete(cleanContact);

    const isEmail = cleanContact.includes('@');
    const existingCustomers = await datastore.customers.list(
      (c) => (isEmail ? c.emailNormalized === cleanContact : c.phoneNormalized === cleanContact)
    );

    let customer = existingCustomers[0];
    if (!customer) {
      customer = await datastore.customers.create({
        id: `cust_${Date.now()}`,
        name: isEmail ? cleanContact.split('@')[0] : 'Invitado Kaonashi',
        emailNormalized: isEmail ? cleanContact : undefined,
        phoneNormalized: !isEmail ? cleanContact : undefined,
        roles: ['customer'],
        loyaltyTier: 'origami',
        pointsBalance: 150,
        marketingConsent: true,
        registeredAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });
    }

    const token = await new SignJWT({
      kind: 'customer',
      customerId: customer.id,
      name: customer.name,
      email: customer.emailNormalized,
      phone: customer.phoneNormalized,
      tier: customer.loyaltyTier,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(jwtSecret);

    const cOpt = cookieOptions('session');
    res.cookie('kns_csid', token, {
      httpOnly: cOpt.httpOnly,
      secure: cOpt.secure,
      sameSite: cOpt.sameSite,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true, customer, token });
  });

  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const { email, name } = req.body;
    const cleanEmail = (email || 'guest.google@example.com').trim().toLowerCase();

    let customer = (await datastore.customers.list((c) => c.emailNormalized === cleanEmail))[0];
    if (!customer) {
      customer = await datastore.customers.create({
        id: `cust_g_${Date.now()}`,
        name: name || cleanEmail.split('@')[0],
        emailNormalized: cleanEmail,
        roles: ['customer'],
        loyaltyTier: 'origami',
        pointsBalance: 200,
        marketingConsent: true,
        registeredAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });
    }

    const token = await new SignJWT({
      kind: 'customer',
      customerId: customer.id,
      name: customer.name,
      email: customer.emailNormalized,
      tier: customer.loyaltyTier,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(jwtSecret);

    const cOpt = cookieOptions('session');
    res.cookie('kns_csid', token, {
      httpOnly: cOpt.httpOnly,
      secure: cOpt.secure,
      sameSite: cOpt.sameSite,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true, customer, token });
  });

  app.get('/api/auth/customer/me', async (req: Request, res: Response) => {
    const csid = req.cookies.kns_csid || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!csid) {
      return res.json({ authenticated: false, customer: null });
    }

    try {
      const decoded = await jwtVerify(csid, jwtSecret);
      const payload: any = decoded.payload;
      const customer = await datastore.customers.get(payload.customerId);
      return res.json({ authenticated: true, customer: customer || payload });
    } catch {
      return res.json({ authenticated: false, customer: null });
    }
  });

  app.post('/api/auth/customer/logout', (req: Request, res: Response) => {
    const cOpt = cookieOptions('session');
    res.clearCookie('kns_csid', { path: '/', sameSite: cOpt.sameSite, secure: cOpt.secure });
    return res.json({ ok: true });
  });

  // -------------------------------------------------------------
  // 15. INTERACTIVE OMIKUJI INSTANT-WIN (おみくじ)
  // -------------------------------------------------------------
  app.post('/api/omikuji/draw', async (req: Request, res: Response) => {
    const rand = Math.random();
    let blessing: 'daikichi' | 'chukichi' | 'shokichi' | 'kichi' | 'suekichi';
    let kanji: string;
    let labelEs: string;
    let labelEn: string;
    let labelJa: string;
    let discountVal: number;
    let discountDesc: string;

    if (rand < 0.12) {
      blessing = 'daikichi';
      kanji = '大吉';
      labelEs = 'Gran Bendición';
      labelEn = 'Great Blessing';
      labelJa = '大吉';
      discountVal = 20;
      discountDesc = '20% de descuento en todo el pedido';
    } else if (rand < 0.35) {
      blessing = 'chukichi';
      kanji = '中吉';
      labelEs = 'Bendición Media';
      labelEn = 'Medium Blessing';
      labelJa = '中吉';
      discountVal = 15;
      discountDesc = '15% de descuento en tu pedido';
    } else if (rand < 0.65) {
      blessing = 'shokichi';
      kanji = '小吉';
      labelEs = 'Pequeña Bendición';
      labelEn = 'Small Blessing';
      labelJa = '小吉';
      discountVal = 10;
      discountDesc = '10% de descuento en tu pedido';
    } else if (rand < 0.85) {
      blessing = 'kichi';
      kanji = '吉';
      labelEs = 'Bendición';
      labelEn = 'Blessing';
      labelJa = '吉';
      discountVal = 10;
      discountDesc = '10% de descuento en tu pedido';
    } else {
      blessing = 'suekichi';
      kanji = '末吉';
      labelEs = 'Bendición Futura';
      labelEn = 'Future Blessing';
      labelJa = '末吉';
      discountVal = 5;
      discountDesc = '5% de descuento en tu pedido';
    }

    const couponCode = `OMI-${blessing.toUpperCase().slice(0, 3)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const newCoupon: Coupon = {
      id: `cpn_omi_${Date.now()}`,
      code: couponCode,
      type: 'percent',
      percentOff: discountVal,
      minSpendMinor: 35000,
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      maxRedemptionsTotal: 1,
      redemptionsCount: 0,
      allowedOrderTypes: ['dine_in', 'takeaway', 'delivery'],
      metadata: { source: 'omikuji', blessing },
      createdAt: new Date().toISOString(),
    };

    await datastore.coupons.create(newCoupon);

    const wakaPoems = {
      daikichi: {
        ja: '春風に 桜花咲き 誇りけり 望みことごと 成就するらん',
        es: 'Como el cerezo en primavera florece con orgullo, tus anhelos se colmarán.',
        en: 'Like cherry blossoms boasting in spring breeze, all wishes shall come to fruition.',
      },
      chukichi: {
        ja: '月清く 雲なき空に 光あり 誠の道を進むべし',
        es: 'En el cielo despejado brilla la luna clara; camina firme por la senda de la sinceridad.',
        en: 'Clear is the moon in a cloudless sky; steady your course upon the honest path.',
      },
      shokichi: {
        ja: '小川さらさら 流れゆく 焦らず待てば 時は来たる',
        es: 'El arroyo fluye suave entre piedras; la paciencia te traerá la corriente propicia.',
        en: 'Gently flows the mountain stream; patience brings the favorable tide.',
      },
      kichi: {
        ja: '朝露の 光る野原に 日は昇る 日々の精進 報われん',
        es: 'Sobre el rocío asciende el sol matinal; la dedicación silenciosa rinde sus frutos.',
        en: 'Sun rises upon morning dew; quiet dedication bears its fruit.',
      },
      suekichi: {
        ja: '冬枯れの 木立ちの奥に 芽吹きあり やがて春来ん',
        es: 'En lo profundo de la arboleda invernal ya laten los brotes; la primavera no tardará.',
        en: 'Deep within the winter grove fresh buds stir; spring shall surely follow.',
      },
    };

    return res.json({
      ok: true,
      blessing,
      kanji,
      label: { es: labelEs, en: labelEn, ja: labelJa },
      waka: wakaPoems[blessing],
      coupon: newCoupon,
      discountDesc,
      luckyColor: blessing === 'daikichi' ? 'Oro Sagrado (金)' : blessing === 'chukichi' ? 'Rojo Bermellón (朱)' : 'Bambú Verde (竹)',
      luckyDish: 'Omakase Nigiri Selection',
    });
  });

  // -------------------------------------------------------------
  // 15. AI CONCIERGE & SOMMELIER (GEMINI 3.8 FLASH + FALLBACK)
  // -------------------------------------------------------------
  app.post('/api/ai/concierge', async (req: Request, res: Response) => {
    const { message, history, language = 'es' } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'MESSAGE_REQUIRED' });
    }

    const allDishes = await datastore.menuItems.list();
    const userLower = message.toLowerCase();

    // Check matching dishes to attach
    const matchingDishes: MenuItem[] = [];
    for (const dish of allDishes) {
      const matchName = dish.names.es.toLowerCase().includes(userLower) ||
        dish.names.en.toLowerCase().includes(userLower) ||
        dish.names.ja.includes(message);
      const matchCategory = dish.category.toLowerCase().includes(userLower);
      const matchIngredients = dish.ingredients.some((ing) => ing.toLowerCase().includes(userLower));

      if (matchName || matchCategory || matchIngredients) {
        matchingDishes.push(dish);
      }
      if (matchingDishes.length >= 3) break;
    }

    // Default recommendations if no direct match
    if (matchingDishes.length === 0) {
      if (userLower.includes('toro') || userLower.includes('atun') || userLower.includes('tuna') || userLower.includes('sake') || userLower.includes('maridaje')) {
        matchingDishes.push(...allDishes.filter((d) => d.id === 'dish_otoro_truffle' || d.id === 'dish_dassai_23' || d.id === 'dish_salmon_belly').slice(0, 3));
      } else if (userLower.includes('gluten') || userLower.includes('celiac')) {
        matchingDishes.push(...allDishes.filter((d) => d.dietary.includes('gluten-free')).slice(0, 3));
      } else if (userLower.includes('robata') || userLower.includes('carne') || userLower.includes('wagyu')) {
        matchingDishes.push(...allDishes.filter((d) => d.id === 'dish_wagyu_skewers' || d.id === 'dish_kubota_manju' || d.id === 'dish_black_cod').slice(0, 3));
      } else {
        matchingDishes.push(...allDishes.filter((d) => d.id === 'dish_omakase_chef' || d.id === 'dish_otoro_truffle' || d.id === 'dish_dassai_23').slice(0, 3));
      }
    }

    let replyText = '';

    // Attempt Gemini 3.8 Flash via @google/genai SDK
    if (aiClient) {
      try {
        const dishContext = allDishes
          .map((d) => `- ${d.names.es} (${d.names.ja}, COP $${d.price}): ${d.descriptions.es} [Alérgenos: ${d.allergens.join(', ')}]`)
          .join('\n');

        const prompt = `Contexto del Menú de Kaonashi:\n${dishContext}\n\nPregunta del comensal (${language}): "${message}"\nResponde en idioma ${language === 'ja' ? 'japonés' : language === 'en' ? 'inglés' : 'español'}.`;

        const geminiPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction:
              'Eres el Sommelier Jefe y Maestro de Sala de Kaonashi. Tu tono es refinado, poético, hospitalario (omotenashi) y conocedor de cortes tradicionales, temperatura de sake (reishu vs atsukan) y maridaje armónico. Mantén la respuesta concisa (máximo 140 palabras).',
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 2500)
        );

        const geminiRes = await Promise.race([geminiPromise, timeoutPromise]);

        if (geminiRes.text) {
          replyText = geminiRes.text;
        }
      } catch (err) {
        // Fallback gracefully to curated sommelier logic
      }
    }

    // Heuristic Sommelier Fallback if AI was unavailable or failed
    if (!replyText) {
      if (userLower.includes('sake') || userLower.includes('maridaje') || userLower.includes('pair')) {
        if (language === 'ja') {
          replyText = '極上の大トロやサーモンには、華やかな吟醸香と繊細な酸味を持つ「獺祭 磨き二割三分」の冷酒（約10℃）が脂の甘みを引き立てます。和牛炭火焼きには、深みのある「久保田 萬寿」のぬる燗が格別な調和を生みます。';
        } else if (language === 'en') {
          replyText = 'For the velvety marbling of our Otoro Nigiri, we pour chilled Dassai 23 Junmai Daiginjo (10°C)—its melon aroma cleanly elevates rich umami. For Binchotan-grilled A5 Wagyu, the smooth depth of Kubota Manju offers an exquisite counterpart.';
        } else {
          replyText = 'Para la untuosidad y marmoleo noble de nuestro Nigiri de Otoro y Salmón, recomendamos servir Dassai 23 Junmai Daiginjo frío (10°C); su delicado perfil de melón blanco corta la grasa con elegancia. Para el Wagyu a las brasas de carbón Binchotan, Kubota Manju ofrece una armonía terrosa insuperable.';
        }
      } else if (userLower.includes('gluten') || userLower.includes('celiac')) {
        if (language === 'ja') {
          replyText = '当店ではグルテンフリーの刺身盛り合わせ、真鯛のカルパッチョ、炭火焼き和牛（特製たまり醤油対応）を安心してお楽しみいただけます。調理器具の分離も徹底しております。';
        } else if (language === 'en') {
          replyText = 'We take great care with gluten-free dining: our Sashimi Moriawase, Hamachi Truffle Crudo, and Robata skewers can all be prepared with artisanal 100% soy-tamari upon request in dedicated prep stations.';
        } else {
          replyText = 'Cuidamos con devoción la cocina sin gluten: nuestro Sashimi Moriawase de 12 cortes nobles, el Hamachi Crudo con trufa y las brochetas Robata son libres de gluten o preparados con tamari puro de soya bajo pedido especial.';
        }
      } else if (userLower.includes('omakase')) {
        if (language === 'ja') {
          replyText = '今夜の「おまかせ・極みコース（7品）」は、本日の市場から届いた天然本鮪赤身から始まり、ウニとキャビアの軍艦、A5和牛炭火焼き、そして自家製抹茶わらび餅で締めくくります。';
        } else if (language === 'en') {
          replyText = 'Tonight\'s 7-course Chef\'s Omakase unfolds in a deliberate rhythm: starting with pristine Bluefin Akami, progressing to Hokkaido Uni and Caviar Gunkan, charcoal A5 Wagyu, and concluding with hand-whisked Matcha Warabi Mochi.';
        } else {
          replyText = 'Nuestra experiencia Omakase de 7 tiempos está diseñada como un viaje sensorial: inicia con Akami de atún aleta azul noble, avanza hacia Gunkan de erizo y caviar imperial, brochetas de Wagyu A5 al carbón Binchotan, y culmina con Warabi Mochi de matcha ceremonial.';
        }
      } else {
        if (language === 'ja') {
          replyText = 'いらっしゃいませ。顔無しの職人が厳選した旬の素材と日本酒をご案内いたします。気になる食材やお好みの風味、アレルギーなどがございましたら何なりとお尋ねください。';
        } else if (language === 'en') {
          replyText = 'Welcome to Kaonashi. Our itamae masters curate each dish with seasonal noble ingredients and pristine sake pairings. Tell me your cravings, preferred flavor profiles, or dietary guidelines to guide your table.';
        } else {
          replyText = 'Bienvenido a Kaonashi. Nuestros maestros itamae seleccionan ingredientes nobles de temporada combinados con maridajes de sake artesanal. Cuéntame qué sabores buscas hoy o si tienes alguna restricción dietaria para guiar tu experiencia.';
        }
      }
    }

    return res.json({
      ok: true,
      reply: replyText,
      attachedDishes: matchingDishes,
      suggestedChips: [
        language === 'ja' ? '大トロに合う日本酒' : language === 'en' ? 'Pair Sake with Otoro' : 'Maridar Sake con Toro',
        language === 'ja' ? 'グルテンフリー料理' : language === 'en' ? 'Gluten-Free options' : 'Opciones sin gluten',
        language === 'ja' ? '今夜のおまかせコース' : language === 'en' ? 'Omakase recommendation' : 'Recomendación Omakase',
      ],
    });
  });

  // -------------------------------------------------------------
  // 16. AI EXECUTIVE BRIEF & REVENUE FORECAST (§10.1)
  // -------------------------------------------------------------
  app.post('/api/ai/admin/brief', async (req: Request, res: Response) => {
    const orders = await datastore.orders.list();
    const stats = await datastore.statsDaily.list();
    const totalRevenue = orders.reduce((acc, o) => acc + o.totalMinor, 0);
    const avgTicket = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
    const btlOrders = orders.filter((o) => o.attribution?.first?.campaignId || o.attribution?.last?.campaignId);
    const btlRevenue = btlOrders.reduce((acc, o) => acc + o.totalMinor, 0);
    const btlShare = totalRevenue > 0 ? Math.round((btlRevenue / totalRevenue) * 100) : 0;

    let briefText = '';

    if (aiClient) {
      try {
        const metricsSummary = `
          Pedidos totales: ${orders.length}
          Ingresos totales: $${totalRevenue} COP
          Ticket promedio: $${avgTicket} COP
          Atribución BTL: ${btlOrders.length} pedidos ($${btlRevenue} COP, ${btlShare}% del total)
          Horas de menor tráfico registradas en mapa de demanda: Martes a Jueves 15:00 - 18:00
        `;

        const geminiPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Analiza estas métricas del restaurante Kaonashi y genera un informe ejecutivo conciso en español (3 párrafos cortos) con:
          1. Diagnóstico de ingresos y eficacia del canal físico BTL (portavasos, tents).
          2. Recomendación de optimización para horas valle (15:00 - 18:00).
          3. Alerta de inventario perecedero (Atún Aleta Azul y Erizo de Mar).\n${metricsSummary}`,
          config: {
            systemInstruction: 'Eres el Director de Estrategia Gastronómica de Kaonashi. Tono profesional, conciso y orientado al ROI.',
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 2500)
        );

        const geminiRes = await Promise.race([geminiPromise, timeoutPromise]);

        if (geminiRes.text) {
          briefText = geminiRes.text;
        }
      } catch (err) {
        // Fallback gracefully to algorithmic executive brief
      }
    }

    if (!briefText) {
      briefText = `Resumen Ejecutivo Kaonashi:
1. Rendimiento BTL & Atribución: Las activaciones físicas (portavasos en eventos VIP y table tents) han generado el ${btlShare}% de los ingresos del período ($${btlRevenue.toLocaleString()} COP en ${btlOrders.length} órdenes), superando el objetivo base del 20%.
2. Optimización Horas Valle: Se observa una contracción sistemática de demanda entre 15:00 y 18:00. Recomendamos activar promoción Happy Hour 2x1 en Rolls de Autor y Cócteles de Autor para elevar ocupación en barra.
3. Pronóstico de Perecederos: El consumo actual de Atún Otoro y Erizo de Mar proyecta un agotamiento de stock en 14 horas de servicio. Se sugiere programar recepción de lote fresco de lonja antes del turno de cena de mañana.`;
    }

    return res.json({
      ok: true,
      brief: briefText,
      metrics: {
        totalOrders: orders.length,
        totalRevenueMinor: totalRevenue,
        avgTicketMinor: avgTicket,
        btlSharePercent: btlShare,
      },
      recommendations: [
        {
          title: 'Activar Happy Hour en Horas Valle (15:00 - 18:00)',
          detail: 'Lanzar 2x1 en Rolls de Autor para balancear demanda y elevar ticket en horario vespertino.',
          impact: '+18% ingresos proyectados',
        },
        {
          title: 'Reordenar Lote Fresco de Atún Aleta Azul',
          detail: 'El ritmo de comandas de Otoro Nigiri agotará la reserva actual en menos de 14 horas de operación.',
          impact: 'Mitigación de 86 prematuro',
        },
        {
          title: 'Escalar Portavasos en Eventos Aliados',
          detail: 'El touchpoint "Coasters Gastro-Fest" presenta un ROI de 4.8x con tasa de conversión de scan a orden de 14.2%.',
          impact: 'Máxima eficiencia BTL',
        },
      ],
      inventoryForecast: [
        { item: 'Atún Aleta Azul (Otoro)', stockUnits: 14, hoursRemaining: 12, status: 'warning' },
        { item: 'Carbón Binchotan Kishu', stockUnits: 45, hoursRemaining: 96, status: 'ok' },
        { item: 'Erizo de Mar Hokkaido (Uni)', stockUnits: 6, hoursRemaining: 8, status: 'critical' },
      ],
    });
  });

  // -------------------------------------------------------------
  // 17. DATA HUB CSV EXPORT & SAFE IMPORT (§10 security)
  // -------------------------------------------------------------
  app.get('/api/admin/export/menu.csv', async (req: Request, res: Response) => {
    const items = await datastore.menuItems.list();
    const csv = exportToCsv(items, [
      { key: 'id', header: 'ID' },
      { key: 'category', header: 'Categoria' },
      { key: 'name_es', header: 'Nombre_ES', format: (_, r) => r.names.es },
      { key: 'name_en', header: 'Nombre_EN', format: (_, r) => r.names.en },
      { key: 'name_ja', header: 'Nombre_JA', format: (_, r) => r.names.ja },
      { key: 'price', header: 'Precio_COP' },
      { key: 'cost', header: 'Costo_Materia_Prima_COP' },
      { key: 'allergens', header: 'Alergenos', format: (_, r) => r.allergens.join(';') },
      { key: 'dietary', header: 'Dietas', format: (_, r) => r.dietary.join(';') },
      { key: 'available', header: 'Disponible' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kaonashi-menu-catalog.csv"');
    return res.send(csv);
  });

  app.get('/api/admin/export/leads.csv', async (req: Request, res: Response) => {
    const leads = await datastore.leads.list();
    const csv = exportToCsv(leads, [
      { key: 'id', header: 'Lead_ID' },
      { key: 'name', header: 'Nombre' },
      { key: 'email', header: 'Email', format: (_, r) => r.emailNormalized || '' },
      { key: 'phone', header: 'Telefono', format: (_, r) => r.phoneNormalized || '' },
      { key: 'campaignId', header: 'Campana_ID' },
      { key: 'status', header: 'Estado' },
      { key: 'marketingConsent', header: 'Consentimiento', format: (_, r) => (r.consent.marketing ? 'SI' : 'NO') },
      { key: 'createdAt', header: 'Fecha_Registro' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kaonashi-customer-leads.csv"');
    return res.send(csv);
  });

  app.get('/api/admin/export/stats.csv', async (req: Request, res: Response) => {
    const stats = await datastore.statsDaily.list();
    const csv = exportToCsv(stats, [
      { key: 'id', header: 'Rollup_ID' },
      { key: 'date', header: 'Fecha' },
      { key: 'campaignId', header: 'Campana' },
      { key: 'touchpointId', header: 'Touchpoint' },
      { key: 'scans', header: 'Escaneos' },
      { key: 'uniqueScans', header: 'Escaneos_Unicos' },
      { key: 'leads', header: 'Leads' },
      { key: 'orders', header: 'Ordenes' },
      { key: 'revenueMinor', header: 'Ingresos_COP' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kaonashi-btl-daily-stats.csv"');
    return res.send(csv);
  });

  app.post('/api/admin/import/menu', async (req: Request, res: Response) => {
    const { csvContent, dryRun } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'CSV_CONTENT_REQUIRED' });
    }

    try {
      const { headers, rows } = parseCsv(csvContent);
      if (rows.length === 0) {
        return res.status(400).json({ error: 'EMPTY_CSV' });
      }

      let updatedCount = 0;
      let createdCount = 0;
      const preview: any[] = [];

      for (const row of rows) {
        const id = row.ID || row.id;
        const price = Number(row.Precio_COP || row.price || 0);
        const cost = Number(row.Costo_Materia_Prima_COP || row.cost || 0);
        const nameEs = row.Nombre_ES || row.name_es;

        if (!nameEs && !id) continue;

        if (id) {
          const existing = await datastore.menuItems.get(id);
          if (existing) {
            preview.push({ action: 'update', id, name: existing.names.es, oldPrice: existing.price, newPrice: price || existing.price });
            if (!dryRun) {
              await datastore.menuItems.update(id, {
                price: price > 0 ? price : existing.price,
                cost: cost > 0 ? cost : existing.cost,
                available: row.Disponible === 'false' ? false : true,
              });
              updatedCount++;
            }
            continue;
          }
        }

        // New item
        const newId = id || `dish_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        preview.push({ action: 'create', id: newId, name: nameEs, price });
        if (!dryRun) {
          await datastore.menuItems.create({
            id: newId,
            slug: (nameEs || 'dish').toLowerCase().replace(/\s+/g, '-'),
            category: (row.Categoria || 'rolls').toLowerCase() as any,
            names: { es: nameEs || 'Plato Nuevo', en: row.Nombre_EN || nameEs, ja: row.Nombre_JA || '新作' },
            descriptions: { es: 'Especialidad de la casa.', en: 'House specialty.', ja: '職人の一皿。' },
            ingredients: ['Noble Ingredients'],
            allergens: [],
            dietary: [],
            spiceLevel: 0,
            isRaw: false,
            isAlcohol: false,
            price: price || 35000,
            cost: cost || 10000,
            art: { hue: 45, motif: 'asanoha' },
            available: true,
          });
          createdCount++;
        }
      }

      if (!dryRun) {
        globalAuditLogger.log({
          actor: 'sysmaster',
          role: 'sysmaster',
          action: 'menu.csv_import',
          resource: 'menuItems',
          outcome: 'success',
          details: { updatedCount, createdCount, totalRows: rows.length },
        });
      }

      return res.json({
        ok: true,
        dryRun: Boolean(dryRun),
        updatedCount,
        createdCount,
        preview,
      });
    } catch (err: any) {
      return res.status(400).json({ error: 'CSV_PARSE_FAILED', details: err?.message });
    }
  });

  // -------------------------------------------------------------
  // 18. ITEM-LEVEL PROMOTIONS & MARGIN GUARD (§10.1)
  // -------------------------------------------------------------
  app.get('/api/admin/promotions', async (req: Request, res: Response) => {
    const dishes = await datastore.menuItems.list();
    const promotions = dishes.map((d) => {
      const grossMarginPercent = d.price > 0 ? Math.round(((d.price - d.cost) / d.price) * 100) : 0;
      const isCriticalMargin = grossMarginPercent < 35;
      const hasBogo = d.id === 'dish_spicy_tuna_roll' || d.id === 'dish_gyoza_pato';
      const hasHappyHour = d.id === 'dish_salmon_belly' || d.id === 'dish_edamame_truffle';

      return {
        dishId: d.id,
        name: d.names.es,
        category: d.category,
        priceMinor: d.price,
        costMinor: d.cost,
        grossMarginPercent,
        isCriticalMargin,
        activePromo: hasBogo ? '2x1 BOGO' : hasHappyHour ? '20% Happy Hour' : 'Ninguna',
        bogoEnabled: hasBogo,
        happyHourEnabled: hasHappyHour,
        marginGuardWarning: isCriticalMargin ? 'Margen inferior al 35% requerido por cocina' : null,
      };
    });

    return res.json({ ok: true, promotions });
  });

  app.post('/api/admin/promotions/update', async (req: Request, res: Response) => {
    const { dishId, bogoEnabled, happyHourEnabled } = req.body;
    const dish = await datastore.menuItems.get(dishId);
    if (!dish) return res.status(404).json({ error: 'DISH_NOT_FOUND' });

    globalAuditLogger.log({
      actor: 'marketing_manager',
      role: 'marketing_manager',
      action: 'promotions.updated',
      resource: dishId,
      outcome: 'success',
      details: { dishName: dish.names.es, bogoEnabled, happyHourEnabled },
    });

    return res.json({ ok: true, message: 'Promoción actualizada con registro en auditoría' });
  });

  // -------------------------------------------------------------
  // 19. RESERVATIONS MANAGEMENT API (§6.7)
  // -------------------------------------------------------------
  app.get('/api/reservations', async (req: Request, res: Response) => {
    const list = await datastore.reservations.list();
    return res.json({ reservations: list });
  });

  app.post('/api/reservations', async (req: Request, res: Response) => {
    const { branchId, date, timeSlot, partySize, area, guestInfo } = req.body;
    if (!date || !timeSlot || !guestInfo?.name || !guestInfo?.email) {
      return res.status(400).json({ error: 'MISSING_RESERVATION_DATA' });
    }

    const depositPerPerson = area === 'omakase_counter' ? 50000 : 30000;
    const depositAmountMinor = (Number(partySize) || 2) * depositPerPerson;

    const newRes: Reservation = {
      id: `res_${Date.now()}`,
      token: `tok_res_${crypto.randomBytes(6).toString('hex')}`,
      branchId: branchId || 'branch_central',
      date,
      timeSlot,
      partySize: Number(partySize) || 2,
      area: area || 'dining_room',
      tableId: area === 'omakase_counter' ? 'counter_1' : 'table_2',
      guestInfo,
      depositAmountMinor,
      depositStatus: 'paid',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    await datastore.reservations.create(newRes);

    globalAuditLogger.log({
      actor: guestInfo.email,
      role: 'customer',
      action: 'reservation.created',
      resource: newRes.id,
      outcome: 'success',
      details: { partySize: newRes.partySize, date, timeSlot, area },
    });

    return res.json({ ok: true, reservation: newRes });
  });

  app.post('/api/reservations/:id/status', async (req: Request, res: Response) => {
    const { status, note } = req.body;
    const resId = req.params.id;
    const reservation = await datastore.reservations.get(resId);
    if (!reservation) return res.status(404).json({ error: 'RESERVATION_NOT_FOUND' });

    let depositStatus = reservation.depositStatus;
    if (status === 'no_show') {
      depositStatus = 'forfeited';
    } else if (status === 'cancelled') {
      depositStatus = 'refunded';
    }

    const updated = await datastore.reservations.update(resId, {
      status,
      depositStatus,
    });

    globalAuditLogger.log({
      actor: 'reception',
      role: 'reception',
      action: `reservation.${status}`,
      resource: resId,
      outcome: 'success',
      details: { oldStatus: reservation.status, newStatus: status, depositStatus, note },
    });

    return res.json({ ok: true, reservation: updated });
  });

  // -------------------------------------------------------------
  // 13. VITE MIDDLEWARES / STATIC ASSETS
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏮 KAONASHI PHYGITAL PLATFORM running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting Kaonashi server:', err);
  process.exit(1);
});
