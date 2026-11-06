// KAONASHI DEMO SEED + BIG-DATA HISTORY GENERATOR (§13)
// Deterministic (seeded PRNG) so charts are reproducible. Every generated record has isDemo: true.
// The BTL funnel is simulated session by session: a scan either drops off at some stage or becomes
// an attributed order, so funnel counts, revenue and ROAS are internally consistent.
import crypto from 'crypto';
import { getEnv } from '../lib/env';
import { getSeedData } from '../lib/data/seed-data';
import { hashPassword } from '../lib/security/password';
import { computeQrSignature } from '../lib/qr';
import type { Store } from './store';
import type {
  Campaign, Touchpoint, QrCode, Coupon, Order, OrderItem, ScanEvent, FunnelEvent, Lead, CouponClaim,
  CouponRedemption, Customer, InventoryItem, MenuItem, StatsDaily, CostEntry, DistributionLog,
  LoyaltyAccount, StaffUser,
} from '../lib/types';

export const SEED_VERSION = 'v2-bigdata';
const TZ_OFFSET_HOURS = 5; // America/Bogota is UTC-5 all year

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function ensureSeeded(store: Store): Promise<void> {
  const env = getEnv();
  const db = await store.db();
  const meta = await db.query(`SELECT value FROM system_meta WHERE key = 'seed_version'`);
  if (meta.rows[0]) return;

  await db.tx(async (q) => {
    // Serialize concurrent cold starts: only one instance seeds.
    await q(`SELECT pg_advisory_xact_lock(4242)`);
    const again = await q(`SELECT value FROM system_meta WHERE key = 'seed_version'`);
    if (again.rows[0]) return;
    const started = Date.now();
    console.log(`[seed] generating ${env.DEMO_MODE ? `${env.SEED_DAYS}-day demo history` : 'production base data'}...`);
    await writeSeed(store, q, env.DEMO_MODE, env.SEED_DAYS);
    await q(`INSERT INTO system_meta (key, value) VALUES ('seed_version', $1::jsonb)`, [
      JSON.stringify({ version: SEED_VERSION, at: new Date().toISOString(), demo: env.DEMO_MODE }),
    ]);
    console.log(`[seed] done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  });
}

export async function resetDemoData(store: Store): Promise<void> {
  const db = await store.db();
  await db.tx(async (q) => {
    await q(`DELETE FROM docs`);
    await q(`DELETE FROM system_meta WHERE key = 'seed_version'`);
    await q(`DELETE FROM sessions WHERE kind = 'customer'`);
  });
  await ensureSeeded(store);
}

const FIRST = ['Valentina', 'Santiago', 'Mariana', 'Sebastián', 'Isabella', 'Mateo', 'Camila', 'Nicolás', 'Sofía', 'Samuel', 'Daniela', 'Alejandro', 'Gabriela', 'Juan', 'Laura', 'Andrés', 'Paula', 'Felipe', 'Natalia', 'Tomás', 'Carolina', 'David', 'Ana', 'Kenji', 'Yuki', 'Hana', 'Diego', 'Lucía', 'Martín', 'Sara'];
const LAST = ['Gómez', 'Rodríguez', 'Martínez', 'López', 'García', 'Hernández', 'Ramírez', 'Torres', 'Moreno', 'Vargas', 'Rojas', 'Castro', 'Ortiz', 'Suárez', 'Restrepo', 'Ospina', 'Cárdenas', 'Mejía', 'Tanaka', 'Sato', 'Jaramillo', 'Salazar', 'Pardo', 'Duarte'];

function ascii(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

async function writeSeed(store: Store, q: any, demo: boolean, days: number) {
  const base = getSeedData();
  const env = getEnv();
  const rand = mulberry32(20261105);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const weighted = <T,>(items: [T, number][]) => {
    const total = items.reduce((a, [, w]) => a + w, 0);
    let r = rand() * total;
    for (const [v, w] of items) {
      if ((r -= w) <= 0) return v;
    }
    return items[items.length - 1][0];
  };
  const now = new Date();
  const dayMs = 86400000;
  const iso = (d: Date | number) => new Date(d).toISOString();
  const localDayStartUtc = (offsetDays: number) => {
    const d = new Date(now.getTime() - TZ_OFFSET_HOURS * 3600000);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime() + TZ_OFFSET_HOURS * 3600000 - offsetDays * dayMs;
  };

  // ---------------- Staff ----------------
  let staff: StaffUser[] = base.staffUsers.map((u: any) => ({
    mfaRequired: false, googleLoginEnabled: false, createdAt: iso(now), updatedAt: iso(now), ...u,
  }));
  // Public deployments: replace the README demo passwords before the first boot.
  if (demo && (process.env.ENV_MASTER_SEED || process.env.DEMO_STAFF_PASSWORD)) {
    staff = staff.map((u) => {
      const pw = u.role === 'sysmaster' ? process.env.ENV_MASTER_SEED : process.env.DEMO_STAFF_PASSWORD;
      if (!pw) return u;
      const h = hashPassword(pw);
      return { ...u, passwordHash: h.hash, salt: h.salt };
    });
  }
  if (!demo) {
    const pw = process.env.ENV_MASTER_SEED;
    if (!pw) throw new Error('ENV_MASTER_SEED is required when DEMO_MODE=false');
    const h = hashPassword(pw);
    staff = staff
      .filter((u) => u.role === 'sysmaster')
      .map((u) => ({ ...u, passwordHash: h.hash, salt: h.salt, mustChangePassword: true }));
  }
  await store.staffUsers.insertMany(staff, q);
  await store.branches.insertMany(base.branches as any, q);
  await store.menuItems.insertMany(base.menuItems as MenuItem[], q);

  if (!demo) return;

  const menu = base.menuItems as MenuItem[];

  // ---------------- Campaigns (dates relative to today) ----------------
  const campaignWindows: Record<string, [number, number]> = {
    camp_coasters: [days - 5, -60],
    camp_flyers: [Math.round(days * 0.6), -25],
    camp_matsuri: [45, 31], // ended a month ago: demonstrates the expired fallback
    camp_table_tent: [days - 5, -90],
  };
  const campaigns: Campaign[] = (base.campaigns as Campaign[]).map((c) => {
    const [startAgo, endAgo] = campaignWindows[c.id] || [days, -30];
    return {
      ...c,
      startDate: iso(localDayStartUtc(startAgo)),
      endDate: iso(localDayStartUtc(endAgo) + dayMs - 1000),
      status: endAgo > 0 ? 'ended' : 'active',
      targetCostPerOrder: c.targetCostPerOrder || 25000,
      floorCostPerOrder: c.floorCostPerOrder || 60000,
    };
  });
  const campById = Object.fromEntries(campaigns.map((c) => [c.id, c]));

  // Touchpoints: quality = landing→order multiplier; volume = scans/day when active.
  const tpSpecs: { id: string; campaignId: string; type: any; label: string; location: string; units: number; unitCost: number; volume: number; quality: number; table?: string; impressions?: number }[] = [
    { id: 'tp_coaster_bar1', campaignId: 'camp_coasters', type: 'coaster', label: 'Sake Bar Zona T', location: 'Calle 83 # 12, Bogotá', units: 4000, unitCost: 450, volume: 40, quality: 1.35 },
    { id: 'tp_coaster_bar2', campaignId: 'camp_coasters', type: 'coaster', label: 'Bar Usaquén', location: 'Cra 6 # 119, Bogotá', units: 3000, unitCost: 450, volume: 22, quality: 1.0 },
    { id: 'tp_coaster_bar3', campaignId: 'camp_coasters', type: 'coaster', label: 'Rooftop Chapinero', location: 'Calle 65 # 4, Bogotá', units: 3000, unitCost: 450, volume: 45, quality: 0.35 },
    { id: 'tp_flyer_cbd', campaignId: 'camp_flyers', type: 'flyer', label: 'Oficinas Calle 93', location: 'Parque 93, Bogotá', units: 8000, unitCost: 280, volume: 34, quality: 0.9 },
    { id: 'tp_flyer_ac', campaignId: 'camp_flyers', type: 'flyer', label: 'Torres Avenida Chile', location: 'Calle 72 # 10, Bogotá', units: 6000, unitCost: 280, volume: 24, quality: 1.1 },
    { id: 'tp_takeaway_box', campaignId: 'camp_flyers', type: 'takeaway_box', label: 'Cajas para llevar', location: 'Kaonashi Central', units: 5000, unitCost: 600, volume: 16, quality: 1.6 },
    { id: 'tp_matsuri_street', campaignId: 'camp_matsuri', type: 'street_team', label: 'Street team Matsuri', location: 'Parque de la 93', units: 5000, unitCost: 350, volume: 120, quality: 0.8 },
    { id: 'tp_matsuri_stand', campaignId: 'camp_matsuri', type: 'popup_event', label: 'Stand Pop-Up', location: 'Parque de la 93', units: 2000, unitCost: 900, volume: 70, quality: 1.25 },
    { id: 'tp_table_tent_t1', campaignId: 'camp_table_tent', type: 'table_tent', label: 'Mesas salón principal', location: 'Kaonashi Central', units: 60, unitCost: 65000, volume: 18, quality: 1.5, table: '4', impressions: 9000 },
    { id: 'tp_partner_hotel', campaignId: 'camp_table_tent', type: 'partner_venue', label: 'Hotel aliado Calle 93', location: 'Calle 93 # 11', units: 40, unitCost: 65000, volume: 9, quality: 0.6, impressions: 5000 },
  ];
  const touchpoints: Touchpoint[] = [];
  const qrCodes: QrCode[] = [];
  const baseQr = Object.fromEntries((base.qrCodes as QrCode[]).map((qq) => [qq.touchpointId, qq]));
  tpSpecs.forEach((t, i) => {
    const camp = campById[t.campaignId];
    touchpoints.push({
      id: t.id, campaignId: t.campaignId, type: t.type, label: t.label, location: t.location,
      unitsPrinted: t.units, unitCostMinor: t.unitCost, branchId: t.campaignId === 'camp_matsuri' ? 'branch_popup' : 'branch_central',
      unitsDistributed: 0, qrMode: 'shared', impressionsEstimate: t.impressions,
      createdAt: camp.startDate, updatedAt: camp.startDate,
    } as any);
    const existing = baseQr[t.id];
    const shortCode = existing?.shortCode || `${t.type.slice(0, 2).toUpperCase()}${String(1000 + i * 7).padStart(4, '0')}KN`.slice(0, 8).toUpperCase();
    qrCodes.push({
      id: existing?.id || `qr_${t.id.slice(3)}`,
      shortCode,
      touchpointId: t.id,
      campaignId: t.campaignId,
      destination: t.type === 'table_tent' ? '/menu' : `/c/${camp.slug}`,
      fallbackDestination: camp.fallbackDestination || '/menu?from=expired',
      signature: computeQrSignature(shortCode, t.id),
      utm: { source: t.type, medium: 'qr', campaign: camp.slug, content: ascii(t.label).replace(/\s+/g, '_') },
      validFrom: camp.startDate,
      validTo: camp.endDate,
      maxScans: 100000,
      scansCount: 0,
      status: t.id === 'tp_partner_hotel' ? 'revoked' : 'active',
      tableNumber: t.table,
      design: { fgColor: '#0B0C10', bgColor: '#FFFFFF', hasLogo: true, dots: true },
      createdAt: camp.startDate,
      updatedAt: camp.startDate,
    } as any);
  });
  const qrByTp = Object.fromEntries(qrCodes.map((qq) => [qq.touchpointId, qq]));

  const coupons: Coupon[] = (base.coupons as Coupon[]).map((c) => {
    const camp = c.campaignId ? campById[c.campaignId] : undefined;
    return { ...c, redeemedCount: 0, totalCap: Math.max(c.totalCap, 20000), validFrom: camp?.startDate || c.validFrom, validTo: camp?.endDate || c.validTo };
  });
  const couponByCamp = Object.fromEntries(coupons.filter((c) => c.campaignId).map((c) => [c.campaignId!, c]));
  const welcomeTea: Coupon = {
    id: 'coup_test_cap', code: 'CAP5-TEST', type: 'fixed', value: 10000, minSubtotalMinor: 0, perCustomerLimit: 99, totalCap: 5,
    redeemedCount: 0, validFrom: iso(localDayStartUtc(days)), validTo: iso(now.getTime() + 365 * dayMs), channels: ['online', 'in_person'],
    orderTypes: ['dine_in', 'takeaway', 'delivery'], stackable: false, stacksWithLoyalty: false, firstOrderOnly: false, requiresLead: false, status: 'active',
  } as any;
  coupons.push(welcomeTea);

  // ---------------- Customers ----------------
  const customers: (Customer & { _w: number })[] = [];
  const nCustomers = Math.round(days * 22);
  for (let i = 0; i < nCustomers; i++) {
    const f = pick(FIRST), l = pick(LAST);
    const w = Math.exp((rand() + rand() + rand() - 1.5) * 2.2); // log-normal-ish purchase intensity
    customers.push({
      id: `cust_${i.toString(36).padStart(4, '0')}`,
      emailNormalized: `${ascii(f)}.${ascii(l)}${i}@example.com`,
      phoneNormalized: `+57300${String(1000000 + i).slice(-7)}`,
      name: `${f} ${l}`,
      authProviders: ['email_code'],
      locale: rand() < 0.88 ? 'es' : rand() < 0.6 ? 'en' : 'ja',
      displayCurrency: 'COP',
      createdAt: '', updatedAt: '',
      isDemo: true,
      _w: w,
    } as any);
  }
  // Keep the base demo customer (Mia)
  for (const c of base.customers as Customer[]) customers.push({ ...c, _w: 6, isDemo: true } as any);
  const custCum: number[] = [];
  customers.reduce((acc, c, i) => (custCum[i] = acc + c._w), 0);
  const totalW = custCum[custCum.length - 1];
  const pickCustomer = () => {
    const r = rand() * totalW;
    let lo = 0, hi = custCum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (custCum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return customers[lo];
  };

  // ---------------- Order generator ----------------
  const catWeight: Record<string, number> = { nigiri: 30, rolls: 26, sashimi: 14, robata: 18, omakase: 5, drinks: 22 };
  const visible = menu.filter((m) => !m.secret);
  const itemWeights: [MenuItem, number][] = visible.map((m) => {
    const sameCat = visible.filter((x) => x.category === m.category).length;
    // Mild per-dish skew so the BCG matrix has stars and dogs.
    const skew = 0.4 + ((m.id.charCodeAt(5) * 7 + m.id.length * 13) % 17) / 10;
    const luxury = m.price > 200000 && m.category === 'drinks' ? 0.12 : 1;
    return [m, (catWeight[m.category] / sameCat) * skew * luxury];
  });
  const stationOf = (m: MenuItem): OrderItem['station'] =>
    m.category === 'drinks' ? 'drinks' : m.category === 'robata' ? 'robata' : 'sushi';

  const orders: Order[] = [];
  let orderSeq = 1000;
  const firstOrderAt: Record<string, string> = {};

  function makeOrder(at: number, opts: { coupon?: Coupon; attribution?: any; customer?: (Customer & { _w: number }) | null; status?: any; omakaseBias?: boolean }): Order {
    const isWeekend = [0, 5, 6].includes(new Date(at - TZ_OFFSET_HOURS * 3600000).getUTCDay());
    const nItems = weighted<number>([[1, 18], [2, 34], [3, 26], [4, 14], [5, 8]]);
    const lines = new Map<string, { m: MenuItem; qty: number }>();
    for (let k = 0; k < nItems; k++) {
      let m = weighted(itemWeights);
      if (opts.omakaseBias && k === 0 && rand() < 0.5) m = pick(visible.filter((x) => x.category === 'omakase'));
      if (m.category === 'omakase' && !isWeekend && rand() < 0.6) m = pick(visible.filter((x) => x.category === 'nigiri'));
      const ex = lines.get(m.id);
      if (ex) ex.qty += 1;
      else lines.set(m.id, { m, qty: rand() < 0.2 ? 2 : 1 });
    }
    const items: OrderItem[] = [...lines.values()].map(({ m, qty }) => ({
      menuItemId: m.id, name: m.names.es, priceMinor: m.price, qty, discountMinor: 0, station: stationOf(m),
    }));
    const subtotal = items.reduce((a, it) => a + it.priceMinor * it.qty, 0);
    let discount = 0;
    const c = opts.coupon;
    if (c && subtotal >= (c.minSubtotalMinor || 0)) {
      if (c.type === 'percent') discount = Math.round((subtotal * c.value) / 10000);
      else if (c.type === 'fixed') discount = Math.min(c.value, subtotal);
      else if (c.type === 'free_item' && c.freeItemId) {
        const fm = menu.find((x) => x.id === c.freeItemId)!;
        items.push({ menuItemId: fm.id, name: fm.names.es, priceMinor: fm.price, qty: 1, discountMinor: fm.price, station: stationOf(fm) });
        discount = fm.price;
      }
      if (discount && c.type !== 'free_item') {
        let left = discount;
        items.forEach((it, idx) => {
          const share = idx === items.length - 1 ? left : Math.round((discount * it.priceMinor * it.qty) / subtotal);
          it.discountMinor = Math.min(share, it.priceMinor * it.qty);
          left -= it.discountMinor;
        });
      }
    }
    const gross = items.reduce((a, it) => a + it.priceMinor * it.qty, 0);
    const net = gross - discount;
    const type = weighted<Order['type']>([['dine_in', 58], ['takeaway', 22], ['delivery', 20]]);
    const tip = type === 'dine_in' ? Math.round(net * weighted([[0, 2], [0.1, 6], [0.15, 2]])) : 0;
    const delivery = type === 'delivery' ? 7000 : 0;
    const tax = Math.round(net - net / 1.19);
    const cust = opts.customer === undefined ? (rand() < 0.72 ? pickCustomer() : null) : opts.customer;
    const createdAt = iso(at);
    if (cust && (!firstOrderAt[cust.id] || firstOrderAt[cust.id] > createdAt)) firstOrderAt[cust.id] = createdAt;
    const status = opts.status || (rand() < 0.03 ? 'cancelled' : type === 'delivery' ? 'delivered' : 'completed');
    const prep = 9 + Math.round(rand() * 16 + items.length * 1.5);
    orderSeq += 1;
    return {
      id: `ord_${orderSeq.toString(36)}_${Math.floor(rand() * 1e6).toString(36)}`,
      orderNumber: `KNS-${orderSeq}`,
      token: `tok_${crypto.randomBytes(12).toString('hex')}`,
      branchId: opts.attribution?.last?.campaignId === 'camp_matsuri' ? 'branch_popup' : 'branch_central',
      customerId: cust?.id,
      source: 'online',
      type,
      tableNumber: type === 'dine_in' ? String(1 + Math.floor(rand() * 18)) : undefined,
      tableSource: type === 'dine_in' ? (rand() < 0.6 ? 'signed_qr' : 'manual') : 'none',
      guestInfo: cust
        ? { name: cust.name, phone: cust.phoneNormalized || '', email: cust.emailNormalized }
        : { name: pick(FIRST), phone: `+57310${String(Math.floor(rand() * 1e7)).padStart(7, '0')}`, email: '' },
      items,
      subtotalMinor: gross,
      discountMinor: discount,
      appliedCouponCode: discount ? c?.code : undefined,
      deliveryFeeMinor: delivery,
      serviceChargeMinor: 0,
      taxMinor: tax,
      tipMinor: tip,
      totalMinor: net + delivery + tip,
      currencyCharged: 'COP',
      pointsEarned: Math.floor(net / 1000) * 10,
      status,
      paymentStatus: status === 'cancelled' ? 'refunded' : 'paid',
      paymentMethod: rand() < 0.55 ? 'stripe' : 'pay_at_venue',
      attribution: opts.attribution || { first: null, last: null, model: 'last_touch', windowDays: 7, matchedBy: 'none', touchAgeHours: 0 },
      statusHistory: [
        { status: 'received', timestamp: createdAt },
        { status: status === 'cancelled' ? 'cancelled' : 'completed', timestamp: iso(at + prep * 60000) },
      ],
      stationTickets: [],
      prepMinutes: prep,
      createdAt,
      updatedAt: iso(at + prep * 60000),
      isDemo: true,
    } as any;
  }

  // Organic demand: lunch 12–14h, dinner 19–22h, weekend uplift, slow trend upward.
  const hourWeights: [number, number][] = [[12, 9], [13, 12], [14, 7], [15, 2], [16, 2], [17, 3], [18, 6], [19, 11], [20, 14], [21, 12], [22, 6], [23, 2]];
  for (let d = days; d >= 0; d--) {
    const dayStart = localDayStartUtc(d);
    const dow = new Date(dayStart - TZ_OFFSET_HOURS * 3600000).getUTCDay();
    const dowFactor = [0.95, 0.7, 0.8, 0.85, 1.05, 1.35, 1.45][dow];
    const trend = 1 + ((days - d) / days) * 0.25;
    const n = Math.round(95 * dowFactor * trend * (0.85 + rand() * 0.3));
    for (let k = 0; k < n; k++) {
      const h = weighted(hourWeights);
      const at = dayStart + h * 3600000 + Math.floor(rand() * 3600000);
      if (at > now.getTime() - 20 * 60000) continue; // today: only orders already finished
      orders.push(makeOrder(at, { omakaseBias: dow >= 4 }));
    }
  }

  // ---------------- BTL scan sessions → funnel → attributed orders ----------------
  const scans: ScanEvent[] = [];
  const funnel: FunnelEvent[] = [];
  const leads: Lead[] = [];
  const claims: CouponClaim[] = [];
  const redemptions: CouponRedemption[] = [];
  const stats = new Map<string, StatsDaily>();
  const devices: [ScanEvent['deviceClass'], number][] = [['mobile', 92], ['tablet', 5], ['desktop', 3]];
  const statKey = (branchId: string, campaignId: string, tpId: string, date: string) => `${branchId}_${campaignId}_${tpId}_${date}`;
  const bump = (branchId: string, campaignId: string, tpId: string, atIso: string, field: keyof StatsDaily, by = 1) => {
    const local = new Date(new Date(atIso).getTime() - TZ_OFFSET_HOURS * 3600000).toISOString().slice(0, 10);
    const id = statKey(branchId, campaignId, tpId, local);
    let s = stats.get(id);
    if (!s) {
      s = { id, branchId, campaignId, touchpointId: tpId, date: local, scans: 0, uniqueScans: 0, landingViews: 0, engaged: 0, leads: 0, claims: 0, addToCart: 0, checkoutStarted: 0, orders: 0, revenueMinor: 0, discountCostMinor: 0 } as StatsDaily;
      stats.set(id, s);
    }
    (s as any)[field] += by;
  };
  let evtN = 0;
  const ev = (sessionId: string, type: FunnelEvent['type'], at: number, campaignId: string, touchpointId: string, extra: Partial<FunnelEvent> = {}) => {
    funnel.push({
      id: `fe_${(evtN++).toString(36)}`, eventId: crypto.randomUUID(), sessionId, type, campaignId, touchpointId,
      timestamp: iso(at), source: ['scan', 'lead_captured', 'coupon_claimed', 'order_completed'].includes(type) ? 'server' : 'client', isDemo: true, ...extra,
    });
  };
  const scanHours: [number, number][] = [[11, 3], [12, 7], [13, 8], [14, 4], [17, 3], [18, 6], [19, 10], [20, 12], [21, 12], [22, 9], [23, 5]];
  const distByTp: Record<string, number> = {};

  for (const t of tpSpecs) {
    const camp = campById[t.campaignId];
    const qr = qrByTp[t.id];
    const coupon = couponByCamp[t.campaignId];
    const branchId = t.campaignId === 'camp_matsuri' ? 'branch_popup' : 'branch_central';
    const start = new Date(camp.startDate).getTime();
    const end = Math.min(new Date(camp.endDate).getTime(), now.getTime() - 3600000);
    for (let dayStart = localDayStartUtc(Math.ceil((now.getTime() - start) / dayMs)); dayStart < end; dayStart += dayMs) {
      if (dayStart + dayMs < start) continue;
      const dow = new Date(dayStart - TZ_OFFSET_HOURS * 3600000).getUTCDay();
      let f = 1;
      if (t.type === 'coaster') f = [0.6, 0.2, 0.3, 0.5, 1.4, 1.9, 1.8][dow];
      if (t.type === 'flyer') f = [0.1, 1.3, 1.3, 1.2, 1.2, 1.0, 0.2][dow];
      const n = Math.round(t.volume * f * (0.7 + rand() * 0.6));
      for (let k = 0; k < n; k++) {
        const at = dayStart + weighted(scanHours) * 3600000 + Math.floor(rand() * 3600000);
        if (at > end) continue;
        const sessionId = `s_${t.id.slice(3, 9)}_${scans.length.toString(36)}`;
        const isUnique = rand() < 0.86;
        const device = weighted(devices);
        scans.push({
          id: `sc_${scans.length.toString(36)}`, qrId: qr.id, campaignId: t.campaignId, touchpointId: t.id, timestamp: iso(at), sessionId,
          ipHash: crypto.createHash('sha1').update(sessionId).digest('hex').slice(0, 16), deviceClass: device,
          os: device === 'desktop' ? 'Windows' : rand() < 0.55 ? 'iOS' : 'Android', language: rand() < 0.9 ? 'es' : 'en', isUnique, outcome: 'ok', isDemo: true,
        });
        qr.scansCount += 1;
        bump(branchId, t.campaignId, t.id, iso(at), 'scans');
        ev(sessionId, 'scan', at, t.campaignId, t.id);
        if (!isUnique) continue;
        bump(branchId, t.campaignId, t.id, iso(at), 'uniqueScans');
        const qf = t.quality;
        let tt = at + 4000;
        if (t.type === 'table_tent') {
          ev(sessionId, 'menu_view', (tt += 3000), t.campaignId, t.id);
        } else {
          if (rand() > 0.9) continue;
          ev(sessionId, 'landing_view', (tt += 2000), t.campaignId, t.id);
          bump(branchId, t.campaignId, t.id, iso(tt), 'landingViews');
          if (rand() > Math.min(0.95, 0.55 * Math.sqrt(qf))) continue;
          ev(sessionId, 'engaged', (tt += 15000), t.campaignId, t.id);
          bump(branchId, t.campaignId, t.id, iso(tt), 'engaged');
        }
        // Lead + claim
        let claimed = false;
        let customer: (Customer & { _w: number }) | null = null;
        if (rand() < 0.42 * Math.min(1.4, qf)) {
          customer = rand() < 0.6 ? pickCustomer() : null;
          const leadId = `lead_${leads.length.toString(36)}`;
          const contact = customer?.emailNormalized || `lead${leads.length}@example.com`;
          const snapshot = { first: { campaignId: t.campaignId, touchpointId: t.id, qrId: qr.id, at: iso(at) }, last: { campaignId: t.campaignId, touchpointId: t.id, qrId: qr.id, at: iso(at) }, model: 'last_touch', windowDays: 7, matchedBy: 'cookie', touchAgeHours: 0 };
          leads.push({
            id: leadId, campaignId: t.campaignId, qrId: qr.id, name: customer?.name, emailNormalized: contact, language: 'es',
            consent: { marketing: rand() < 0.55, privacyVersion: 'v1.0', timestamp: iso(tt), ipHash: 'demo' }, attribution: snapshot as any,
            status: 'coupon_issued', createdAt: iso((tt += 30000)), isDemo: true,
          } as any);
          ev(sessionId, 'lead_captured', tt, t.campaignId, t.id);
          bump(branchId, t.campaignId, t.id, iso(tt), 'leads');
          if (coupon) {
            claims.push({ id: `cl_${claims.length.toString(36)}`, couponId: coupon.id, walletId: `w_${sessionId}`, sessionId, leadId, emailNormalized: contact, attribution: snapshot as any, status: 'claimed', claimedAt: iso(tt), expiresAt: coupon.validTo, isDemo: true } as any);
            ev(sessionId, 'coupon_claimed', (tt += 5000), t.campaignId, t.id);
            bump(branchId, t.campaignId, t.id, iso(tt), 'claims');
            claimed = true;
          }
        }
        const pCart = Math.min(0.85, 0.33 * qf * (claimed ? 1.5 : 1));
        if (rand() > pCart) continue;
        ev(sessionId, 'add_to_cart', (tt += 60000 + rand() * 300000), t.campaignId, t.id);
        bump(branchId, t.campaignId, t.id, iso(tt), 'addToCart');
        if (rand() > 0.72) continue;
        ev(sessionId, 'checkout_started', (tt += 60000), t.campaignId, t.id);
        bump(branchId, t.campaignId, t.id, iso(tt), 'checkoutStarted');
        if (rand() > 0.8) continue;
        // Most convert within the hour; some come back days later (cookie / coupon attribution).
        const later = rand() < 0.2 ? Math.floor(rand() * 4 * dayMs) : 0;
        const orderAt = Math.min(tt + 120000 + later, now.getTime() - 600000);
        const touch = { campaignId: t.campaignId, touchpointId: t.id, qrId: qr.id, at: iso(at), couponId: claimed ? coupon?.id : undefined };
        const o = makeOrder(orderAt, {
          coupon: claimed ? coupon : undefined,
          customer: customer ?? (rand() < 0.5 ? pickCustomer() : null),
          omakaseBias: t.campaignId === 'camp_table_tent',
          attribution: { first: touch, last: touch, model: 'last_touch', windowDays: 7, matchedBy: claimed ? 'coupon' : 'cookie', touchAgeHours: Math.round((orderAt - at) / 360000) / 10 },
        });
        o.branchId = branchId;
        if (o.status === 'cancelled') o.status = 'completed';
        o.paymentStatus = 'paid';
        orders.push(o);
        ev(sessionId, 'order_completed', orderAt, t.campaignId, t.id, { orderId: o.id, valueMinor: o.totalMinor });
        bump(branchId, t.campaignId, t.id, o.createdAt, 'orders');
        bump(branchId, t.campaignId, t.id, o.createdAt, 'revenueMinor', o.totalMinor);
        bump(branchId, t.campaignId, t.id, o.createdAt, 'discountCostMinor', o.discountMinor);
        if (claimed && coupon && o.discountMinor > 0) {
          const cl = claims[claims.length - 1];
          cl.status = 'redeemed';
          coupon.redeemedCount += 1;
          redemptions.push({ id: `rd_${redemptions.length.toString(36)}`, couponId: coupon.id, claimId: cl.id, orderId: o.id, channel: 'online', discountMinor: o.discountMinor, redeemedAt: o.createdAt } as any);
        }
      }
    }
    distByTp[t.id] = Math.min(t.units, Math.round(qr.scansCount / (0.2 + t.quality * 0.1)));
  }

  // In-person walk-in redemptions (reception) — part of attributed revenue.
  for (let i = 0; i < 60; i++) {
    const t = pick(tpSpecs.filter((x) => x.type === 'coaster' || x.type === 'flyer'));
    const coupon = couponByCamp[t.campaignId];
    const camp = campById[t.campaignId];
    const at = Math.max(new Date(camp.startDate).getTime(), now.getTime() - Math.floor(rand() * days * dayMs));
    if (at > Math.min(new Date(camp.endDate).getTime(), now.getTime())) continue;
    const bill = 80000 + Math.round(rand() * 220000 / 1000) * 1000;
    const disc = coupon.type === 'percent' ? Math.round((bill * coupon.value) / 10000) : 36000;
    const touch = { campaignId: t.campaignId, touchpointId: t.id, qrId: qrByTp[t.id].id, at: iso(at), couponId: coupon.id };
    const o: Order = {
      ...makeOrder(at, { customer: null, attribution: { first: touch, last: touch, model: 'last_touch', windowDays: 7, matchedBy: 'coupon', touchAgeHours: 1 } }),
      source: 'in_person', type: 'dine_in', tableSource: 'manual', status: 'completed', paymentStatus: 'paid', paymentMethod: 'pay_at_venue',
      items: [{ menuItemId: 'walkin', name: 'Consumo en salón', priceMinor: bill, qty: 1, discountMinor: disc, station: 'expo' }],
      subtotalMinor: bill, discountMinor: disc, totalMinor: bill - disc, tipMinor: 0, deliveryFeeMinor: 0, appliedCouponCode: coupon.code,
    };
    orders.push(o);
    coupon.redeemedCount += 1;
    redemptions.push({ id: `rd_${redemptions.length.toString(36)}`, couponId: coupon.id, claimId: '', orderId: o.id, channel: 'in_person', discountMinor: disc, billAmountMinor: bill, staffId: 'user_reception', redeemedAt: o.createdAt } as any);
    bump(o.branchId, t.campaignId, t.id, o.createdAt, 'orders');
    bump(o.branchId, t.campaignId, t.id, o.createdAt, 'revenueMinor', o.totalMinor);
    bump(o.branchId, t.campaignId, t.id, o.createdAt, 'discountCostMinor', disc);
  }

  // Today's open orders for the KDS, spread across SLA colors.
  const kdsAges = [2, 4, 7, 9, 13, 14, 17, 3, 6, 1];
  kdsAges.forEach((age, i) => {
    const at = now.getTime() - age * 60000;
    const status = i % 3 === 0 ? 'received' : i % 3 === 1 ? 'preparing' : 'quality_check';
    const o = makeOrder(at, { status });
    o.paymentStatus = o.paymentMethod === 'stripe' ? 'paid' : 'unpaid';
    o.statusHistory = [{ status: 'received', timestamp: o.createdAt }];
    o.stationTickets = [...new Set(o.items.map((it) => it.station))].map((st) => ({
      id: `tkt_${o.id}_${st}`, orderId: o.id, station: st, status: status === 'received' ? 'pending' : status === 'preparing' ? 'started' : 'ready',
    }));
    orders.push(o);
  });
  const pending = makeOrder(now.getTime() - 3 * 60000, { status: 'pending_confirmation' });
  pending.type = 'dine_in';
  pending.tableSource = 'manual';
  pending.tableNumber = '12';
  pending.paymentStatus = 'unpaid';
  pending.paymentMethod = 'pay_at_venue';
  pending.statusHistory = [{ status: 'pending_confirmation', timestamp: pending.createdAt }];
  orders.push(pending);

  // ---------------- Customers' dates, loyalty ----------------
  const spend: Record<string, number> = {};
  for (const o of orders) if (o.customerId && o.status !== 'cancelled') spend[o.customerId] = (spend[o.customerId] || 0) + o.pointsEarned;
  const activeCustomers = customers.filter((c) => firstOrderAt[c.id] || c.id === 'cust_mia');
  const loyalty: LoyaltyAccount[] = [];
  for (const c of activeCustomers) {
    const created = firstOrderAt[c.id] ? iso(new Date(firstOrderAt[c.id]).getTime() - 3600000) : c.createdAt || iso(now);
    (c as any).createdAt = created;
    (c as any).updatedAt = created;
    delete (c as any)._w;
    const pts = (spend[c.id] || 0) + 100;
    loyalty.push({
      id: `loy_${c.id}`, customerId: c.id, pointsBalance: pts, rolling12mPoints: pts,
      tier: pts >= 6000 ? 'omakase_master' : pts >= 2000 ? 'itamae_vip' : 'nigiri_explorer',
      referralCode: `KNS-${c.id.slice(5).toUpperCase()}`, joinedAt: created, updatedAt: iso(now),
    });
  }

  // ---------------- Costs & distribution ----------------
  const costs: CostEntry[] = [];
  const dist: DistributionLog[] = [];
  for (const t of tpSpecs) {
    const camp = campById[t.campaignId];
    costs.push({ id: `cost_print_${t.id}`, campaignId: t.campaignId, touchpointId: t.id, kind: 'print', amountMinor: t.units * t.unitCost, date: camp.startDate.slice(0, 10), note: `Impresión ${t.units} uds`, createdAt: camp.startDate } as any);
    if (t.type === 'street_team') costs.push({ id: `cost_prom_${t.id}`, campaignId: t.campaignId, touchpointId: t.id, kind: 'promoter_fee', amountMinor: 14500000, date: camp.startDate.slice(0, 10), note: 'Equipo de 6 promotores, 2 fines de semana', createdAt: camp.startDate } as any);
    if (t.type === 'coaster' || t.type === 'partner_venue') costs.push({ id: `cost_venue_${t.id}`, campaignId: t.campaignId, touchpointId: t.id, kind: 'venue_fee', amountMinor: t.quality < 0.5 ? 9000000 : 3500000, date: camp.startDate.slice(0, 10), note: 'Acuerdo con el aliado', createdAt: camp.startDate } as any);
    // Distribution logged weekly across the whole active window (so any date range has its share).
    const total = t.impressions ? 0 : distByTp[t.id];
    const startMs = new Date(camp.startDate).getTime();
    const endMs = Math.min(new Date(camp.endDate).getTime(), now.getTime());
    const weeks = Math.max(1, Math.ceil((endMs - startMs) / (7 * dayMs)));
    let left = total;
    for (let k = 0; k < weeks && left > 0; k++) {
      const qty = k === weeks - 1 ? left : Math.round(total / weeks);
      const d = startMs + k * 7 * dayMs;
      dist.push({ id: `dist_${t.id}_${k}`, touchpointId: t.id, date: iso(d).slice(0, 10), quantity: qty, enteredBy: 'Elena Rostova', createdAt: iso(d) } as any);
      left -= qty;
    }
    const tp = touchpoints.find((x) => x.id === t.id)!;
    tp.unitsDistributed = dist.filter((x) => x.touchpointId === t.id).reduce((a, x) => a + x.quantity, 0);
  }
  costs.push({ id: 'cost_media_flyers', campaignId: 'camp_flyers', kind: 'media', amountMinor: 9500000, date: campById.camp_flyers.startDate.slice(0, 10), note: 'Pauta en Instagram local', createdAt: campById.camp_flyers.startDate } as any);

  // ---------------- Inventory with lots ----------------
  const inv: InventoryItem[] = [
    ...(base.inventoryItems as InventoryItem[]),
    { id: 'inv_tuna', sku: 'SKU-TUNA-BLUEFIN', name: 'Atún aleta azul (Otoro/Akami)', unit: 'kg', onHand: 9, parLevel: 8, unitCost: 280000, perishable: true, shelfLifeDays: 4, supplier: 'Pesquera del Pacífico', lots: [] },
    { id: 'inv_uni', sku: 'SKU-UNI-HOKKAIDO', name: 'Erizo de mar Hokkaido (uni)', unit: 'bandeja', onHand: 6, parLevel: 10, unitCost: 190000, perishable: true, shelfLifeDays: 3, supplier: 'Importadora Tsukiji', lots: [] },
    { id: 'inv_hamachi', sku: 'SKU-HAMACHI', name: 'Hamachi (pez limón)', unit: 'kg', onHand: 7, parLevel: 6, unitCost: 120000, perishable: true, shelfLifeDays: 4, supplier: 'Pesquera del Pacífico', lots: [] },
    { id: 'inv_eel', sku: 'SKU-UNAGI', name: 'Anguila unagi glaseada', unit: 'kg', onHand: 5, parLevel: 3, unitCost: 160000, perishable: true, shelfLifeDays: 20, supplier: 'Importadora Tsukiji', lots: [] },
    { id: 'inv_scallop', sku: 'SKU-HOTATE', name: 'Vieiras Hokkaido', unit: 'kg', onHand: 3, parLevel: 4, unitCost: 140000, perishable: true, shelfLifeDays: 5, supplier: 'Importadora Tsukiji', lots: [] },
    { id: 'inv_duck', sku: 'SKU-DUCK-CONFIT', name: 'Pato confitado', unit: 'kg', onHand: 8, parLevel: 5, unitCost: 70000, perishable: true, shelfLifeDays: 10, supplier: 'Granja La Sabana', lots: [] },
    { id: 'inv_sake', sku: 'SKU-SAKE-DASSAI', name: 'Sake Dassai 23 (botella)', unit: 'botella', onHand: 14, parLevel: 10, unitCost: 190000, perishable: false, shelfLifeDays: 365, supplier: 'Asahi Shuzo', lots: [] },
  ];
  // Stock levels derived from the simulated consumption of the last 28 days, so cover/forecast are realistic.
  const coverDays: Record<string, number> = { 'SKU-UNI-HOKKAIDO': 1.1, 'SKU-TUNA-BLUEFIN': 2.2, 'SKU-HOTATE': 2.6, 'SKU-SALMON-NOR': 3.5, 'SKU-WAGYU-A5': 6, 'SKU-TRUFFLE-BLK': 9, 'SKU-HAMACHI': 4, 'SKU-UNAGI': 12, 'SKU-DUCK-CONFIT': 5, 'SKU-SAKE-DASSAI': 14, 'SKU-RICE-KOSHI': 20 };
  const recipeBySku: Record<string, Record<string, number>> = {};
  const recipesPre = buildRecipes(menu);
  for (const r of recipesPre) (recipeBySku[r.sku] ||= {})[r.menuItemId] = r.qty;
  const since28 = now.getTime() - 28 * dayMs;
  const sold: Record<string, number> = {};
  for (const o of orders) if (new Date(o.createdAt).getTime() >= since28 && o.status !== 'cancelled') for (const it of o.items) sold[it.menuItemId] = (sold[it.menuItemId] || 0) + it.qty;
  for (const it of inv) {
    const perDay = Object.entries(recipeBySku[it.sku] || {}).reduce((a, [mid, qty]) => a + (sold[mid] || 0) * qty, 0) / 28;
    if (perDay > 0) {
      it.onHand = Math.round(perDay * (coverDays[it.sku] ?? 5) * 10) / 10;
      it.parLevel = Math.round(perDay * 3 * 10) / 10;
    }
  }
  inv.forEach((it) => {
    const nLots = it.perishable ? 2 : 1;
    it.lots = Array.from({ length: nLots }, (_, k) => {
      const received = now.getTime() - (k + 1) * Math.max(1, Math.round(it.shelfLifeDays / 3)) * dayMs;
      return { lotId: `${it.sku}-L${k + 1}`, receivedAt: iso(received), qty: Math.round((it.onHand / nLots) * 10) / 10, expiry: iso(received + it.shelfLifeDays * dayMs) };
    });
    (it as any).branchId = 'branch_central';
  });
  const recipes = recipesPre;

  // ---------------- Write ----------------
  const tag = <T,>(arr: T[]) => arr.map((x: any) => ({ ...x, isDemo: true }));
  await store.campaigns.insertMany(tag(campaigns), q);
  await store.touchpoints.insertMany(tag(touchpoints), q);
  await store.qrCodes.insertMany(tag(qrCodes), q);
  await store.coupons.insertMany(tag(coupons), q);
  await store.customers.insertMany(activeCustomers as any, q);
  await store.loyaltyAccounts.insertMany(tag(loyalty), q);
  await store.inventoryItems.insertMany(tag(inv), q);
  await q(
    `INSERT INTO docs (collection, id, data) SELECT 'recipeLines', x->>'id', x FROM jsonb_array_elements($1::jsonb) x ON CONFLICT DO NOTHING`,
    [JSON.stringify(recipes)]
  );
  await store.costEntries.insertMany(tag(costs), q);
  await store.distributionLogs.insertMany(tag(dist), q);
  await store.reservations.insertMany(tag(base.reservations as any[]), q);
  await store.orders.insertMany(orders, q);
  await store.scanEvents.insertMany(scans, q, 1000);
  await store.funnelEvents.insertMany(funnel, q, 1000);
  await store.leads.insertMany(leads, q);
  await store.couponClaims.insertMany(claims, q);
  await store.couponRedemptions.insertMany(redemptions, q);
  await store.statsDaily.insertMany([...stats.values()].map((s) => ({ ...s, isDemo: true })), q);

  console.log(`[seed] orders=${orders.length} scans=${scans.length} funnel=${funnel.length} customers=${activeCustomers.length} leads=${leads.length} claims=${claims.length}`);
  void env;
}


function buildRecipes(menu: MenuItem[]) {
  const recipes: { id: string; menuItemId: string; sku: string; qty: number }[] = [];
  const addR = (menuItemId: string, sku: string, qty: number) => recipes.push({ id: `rcp_${menuItemId}_${sku}`, menuItemId, sku, qty });
  addR('dish_salm_aburi', 'SKU-SALMON-NOR', 0.05); addR('dish_salmon_ikura', 'SKU-SALMON-NOR', 0.12); addR('dish_sashimi_moriawase', 'SKU-SALMON-NOR', 0.08);
  addR('dish_maguro_akami', 'SKU-TUNA-BLUEFIN', 0.05); addR('dish_otoro_sashimi', 'SKU-TUNA-BLUEFIN', 0.12); addR('dish_sashimi_moriawase', 'SKU-TUNA-BLUEFIN', 0.08); addR('dish_roll_spicy_tuna', 'SKU-TUNA-BLUEFIN', 0.06);
  addR('dish_omakase_7', 'SKU-TUNA-BLUEFIN', 0.1); addR('dish_omakase_11', 'SKU-TUNA-BLUEFIN', 0.16); addR('dish_omakase_7', 'SKU-UNI-HOKKAIDO', 0.08); addR('dish_omakase_11', 'SKU-UNI-HOKKAIDO', 0.12);
  addR('dish_wagyu_nigiri', 'SKU-WAGYU-A5', 0.04); addR('dish_wagyu_skewers', 'SKU-WAGYU-A5', 0.12); addR('dish_omakase_11', 'SKU-WAGYU-A5', 0.06);
  addR('dish_hamachi_truffle', 'SKU-HAMACHI', 0.05); addR('dish_hamachi_jalapeno', 'SKU-HAMACHI', 0.12); addR('dish_hamachi_truffle', 'SKU-TRUFFLE-BLK', 3); addR('dish_edamame_truffle', 'SKU-TRUFFLE-BLK', 2); addR('dish_gyoza_pato', 'SKU-TRUFFLE-BLK', 1.5);
  addR('dish_unagi_kaba', 'SKU-UNAGI', 0.05); addR('dish_roll_dragon', 'SKU-UNAGI', 0.06); addR('dish_hotate_yuzu', 'SKU-HOTATE', 0.05); addR('dish_gyoza_pato', 'SKU-DUCK-CONFIT', 0.1); addR('dish_sake_dassai', 'SKU-SAKE-DASSAI', 1);
  for (const m of menu) if (['nigiri', 'rolls', 'omakase'].includes(m.category)) addR(m.id, 'SKU-RICE-KOSHI', m.category === 'omakase' ? 0.25 : 0.06);

  return recipes;
}
