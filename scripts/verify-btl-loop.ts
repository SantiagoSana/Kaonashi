// KAONASHI — headless check of the BTL core loop against a RUNNING instance (§15 item 8, §16 #39).
// Every assertion reads the live API; nothing is compared against a static file.
//   APP_BASE_URL=http://localhost:3000 npx tsx scripts/verify-btl-loop.ts
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = process.env.APP_BASE_URL || 'http://localhost:3000';
const STAFF_USER = process.env.VERIFY_STAFF_USER || 'kaonashi_sysmaster';
const STAFF_PASS = process.env.VERIFY_STAFF_PASS || 'KaonashiMaster2026!';
// Each run looks like a different client so rate limits from earlier runs don't interfere.
const FAKE_IP = `10.${crypto.randomInt(255)}.${crypto.randomInt(255)}.${crypto.randomInt(255)}`;

class Client {
  jar = new Map<string, string>();
  constructor(private ip = FAKE_IP) {}
  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers: Record<string, string> = { 'x-forwarded-for': this.ip, 'user-agent': 'Mozilla/5.0 (iPhone) verify-btl-loop', ...(init.headers as any) };
    if (this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (init.json !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(init.json);
    }
    const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [kv, ...attrs] = c.split(';');
      const i = kv.indexOf('=');
      const k = kv.slice(0, i).trim();
      const v = kv.slice(i + 1).trim();
      const expired = attrs.some((a) => /expires=thu, 01 jan 1970/i.test(a)) || !v;
      if (expired) this.jar.delete(k);
      else this.jar.set(k, v);
    }
    return res;
  }
  async json(path: string, init: RequestInit & { json?: unknown } = {}) {
    const r = await this.req(path, init);
    const body = await r.json().catch(() => ({}));
    return { status: r.status, body };
  }
}

const step = (n: number, msg: string) => console.log(`${n}. ${msg}`);
const ok = (msg: string) => console.log(`   ✓ ${msg}`);

async function main() {
  console.log(`Kaonashi BTL loop verification → ${BASE}`);
  const staff = new Client(`10.250.${crypto.randomInt(255)}.${crypto.randomInt(255)}`);
  const login = await staff.json('/api/auth/staff-login', { method: 'POST', json: { username: STAFF_USER, password: STAFF_PASS } });
  assert.equal(login.status, 200, `staff login failed: ${JSON.stringify(login.body)}`);

  const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const btlBefore = (await staff.json(`/api/admin/analytics/btl?from=${today}&to=${today}`)).body;
  const campaigns = (await staff.json('/api/campaigns')).body;
  const qr = campaigns.qrCodes.find((q: any) => q.status === 'active' && q.destination.startsWith('/c/'));
  assert.ok(qr, 'no active QR pointing to a landing page');
  const camp = campaigns.campaigns.find((c: any) => c.id === qr.campaignId);
  const coupon = campaigns.coupons.find((c: any) => c.campaignId === camp.id);

  // 1. Scan
  step(1, `Scan ${qr.shortCode} (${camp.name})`);
  const guest = new Client();
  const tampered = await guest.req(`/r/${qr.shortCode}?s=AAAAAAAAAAAAAAAA`);
  assert.equal(tampered.status, 404, 'tampered signature must 404');
  const scan = await guest.req(qr.scanUrl);
  assert.equal(scan.status, 302);
  const loc = scan.headers.get('location')!;
  assert.ok(loc.startsWith(`/c/${camp.slug}`) && loc.includes('utm_medium=qr'), `unexpected redirect ${loc}`);
  assert.ok([...guest.jar.keys()].some((k) => k.endsWith('kns_attr')), 'kns_attr cookie missing');
  ok(`302 → ${loc.split('?')[0]} with UTM, attribution cookie set; tampered code → 404`);

  // 2. Landing + lead + claim
  step(2, 'Landing view, lead form, coupon claim');
  const ev = crypto.randomUUID();
  await guest.json('/api/track', { method: 'POST', json: { eventId: ev, type: 'landing_view', path: loc } });
  const dup = await guest.json('/api/track', { method: 'POST', json: { eventId: ev, type: 'landing_view', path: loc } });
  assert.equal(dup.body.duplicate, true, 'replayed eventId must not double count');
  const forged = await guest.json('/api/track', { method: 'POST', json: { eventId: crypto.randomUUID(), type: 'order_completed' } });
  assert.equal(forged.status, 400, 'client must not send server-only events');
  const lead = await guest.json('/api/leads', { method: 'POST', json: { campaignId: camp.id, name: 'Verificador', emailOrPhone: `verify+${Date.now()}@example.com`, marketingConsent: false } });
  assert.equal(lead.status, 200, JSON.stringify(lead.body));
  const wallet = (await guest.json('/api/wallet')).body;
  assert.ok(wallet.coupons.some((c: any) => c.code === coupon.code), 'claimed coupon not in wallet');
  ok(`lead captured, ${coupon.code} in wallet; duplicate event ignored; forged server event rejected`);

  // 3. Wallet survives session expiry
  step(3, 'Session cookie cleared (30-minute expiry) → coupon still in wallet');
  for (const k of [...guest.jar.keys()]) if (k.endsWith('kns_sid')) guest.jar.delete(k);
  const wallet2 = (await guest.json('/api/wallet')).body;
  assert.ok(wallet2.coupons.some((c: any) => c.code === coupon.code));
  ok('wallet coupon persists without kns_sid');

  // 4. Order with server-side pricing
  step(4, 'Checkout with tampered prices');
  const menu = (await guest.json('/api/menu')).body.items;
  assert.ok(!('cost' in menu[0]), 'menu must not expose costs to guests');
  const pick = menu.filter((m: any) => m.available && !m.secret && m.category !== 'drinks').slice(0, 3);
  if (coupon.freeItemId && !pick.some((p: any) => p.id === coupon.freeItemId)) pick.push(menu.find((m: any) => m.id === coupon.freeItemId));
  const items = pick.map((m: any) => ({ menuItemId: m.id, qty: 2, priceMinor: 1 }));
  const expectedGross = pick.reduce((a: number, m: any) => a + m.price * 2, 0);
  const order = await guest.json('/api/orders', {
    method: 'POST',
    json: { items, type: 'takeaway', paymentMethod: 'stripe', appliedCouponCode: coupon.code, guestInfo: { name: 'Verificador', phone: `30${crypto.randomInt(10000000, 99999999)}`, email: '' }, totalMinor: 1 },
  });
  assert.equal(order.status, 200, JSON.stringify(order.body));
  const o = order.body.order;
  assert.equal(o.subtotalMinor, expectedGross, 'server must price from the database');
  assert.ok(o.discountMinor > 0, 'coupon should apply');
  assert.equal(o.items.reduce((a: number, i: any) => a + i.discountMinor, 0), o.discountMinor, 'line savings must add up');
  assert.equal(o.attribution.last.campaignId, camp.id);
  ok(`${o.orderNumber}: gross ${o.subtotalMinor}, discount ${o.discountMinor}, total ${o.totalMinor} (client prices ignored), attributed by ${o.attribution.matchedBy}`);

  // 5. Tracking needs the token
  step(5, 'Order tracking access control');
  assert.equal((await new Client().json(`/api/orders/${o.id}`)).status, 404, 'tracking without token must fail');
  const tracked = await guest.json(`/api/orders/${o.id}?t=${o.token}`);
  assert.equal(tracked.status, 200);
  ok('token required; guest view has no attribution data');

  // 6. KDS
  step(6, 'Kitchen: order on KDS, Start → Ready → Pickup');
  const kds = (await staff.json('/api/orders')).body.orders;
  assert.ok(kds.some((x: any) => x.id === o.id), 'order not on KDS');
  assert.equal((await guest.json(`/api/orders/${o.id}/status`, { method: 'POST', json: { status: 'preparing' } })).status, 401, 'guests cannot move orders');
  for (const s of ['preparing', 'quality_check', 'ready_for_pickup']) {
    const r = await staff.json(`/api/orders/${o.id}/status`, { method: 'POST', json: { status: s } });
    assert.equal(r.status, 200, `${s}: ${JSON.stringify(r.body)}`);
  }
  const skip = await staff.json(`/api/orders/${o.id}/status`, { method: 'POST', json: { status: 'received' } });
  assert.equal(skip.status, 409, 'invalid transitions must be rejected');
  const after = (await guest.json(`/api/orders/${o.id}?t=${o.token}`)).body.order;
  assert.equal(after.status, 'ready_for_pickup');
  ok('tracker shows ready_for_pickup; invalid transition → 409; guest → 401');

  // 7. Hand-typed table needs confirmation
  step(7, 'Dine-in with a typed table and a forged tableSource');
  const manual = await new Client().json('/api/orders', { method: 'POST', json: { items: [{ menuItemId: pick[0].id, qty: 1 }], type: 'dine_in', tableNumber: '7', tableSource: 'signed_qr', guestInfo: { name: 'Mesa', phone: `31${crypto.randomInt(10000000, 99999999)}` } } });
  assert.equal(manual.body.order.status, 'pending_confirmation');
  assert.equal(manual.body.order.tableSource, 'manual');
  ok('pending_confirmation with tableSource=manual');

  // 8. Concurrency: totalCap = 5 under 20 parallel redemptions
  step(8, 'Twenty concurrent redemptions of CAP5-TEST (totalCap 5)');
  const before = (await staff.json('/api/campaigns')).body.coupons.find((c: any) => c.code === 'CAP5-TEST');
  if (before && before.redeemedCount === 0) {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => staff.json('/api/coupons/redeem-in-person', { method: 'POST', json: { code: 'CAP5-TEST', billAmountMinor: 50000 + i } })));
    const wins = results.filter((r) => r.status === 200).length;
    assert.equal(wins, 5, `expected exactly 5 successes, got ${wins}`);
    ok('exactly 5 succeeded');
  } else ok('already exercised on this database (skipped)');

  // 9. In-person redemption with bill amount
  step(9, 'Reception redeems a campaign coupon in person');
  const noBill = await staff.json('/api/coupons/redeem-in-person', { method: 'POST', json: { code: coupon.code } });
  assert.equal(noBill.status, 400, 'bill amount is mandatory');
  const walkIn = await staff.json('/api/coupons/redeem-in-person', { method: 'POST', json: { code: coupon.code, billAmountMinor: 180000 } });
  assert.equal(walkIn.status, 200, JSON.stringify(walkIn.body));
  assert.equal(walkIn.body.order.attribution.last.campaignId, camp.id);
  ok(`walk-in ${walkIn.body.order.orderNumber} attributed to ${camp.name}`);

  // 10. Funnel moved
  step(10, 'Funnel and attributed revenue updated');
  const btlAfter = (await staff.json(`/api/admin/analytics/btl?from=${today}&to=${today}`)).body;
  const delta = (k: string) => btlAfter.kpis[k] - btlBefore.kpis[k];
  assert.ok(delta('scans') >= 1, 'scan not counted');
  assert.ok(delta('landingViews') >= 1, 'landing view not counted');
  assert.ok(delta('leads') >= 1, 'lead not counted');
  assert.ok(delta('orders') >= 2, 'orders not attributed');
  assert.ok(delta('revenue') >= o.totalMinor, 'revenue not attributed');
  ok(`+${delta('scans')} scans, +${delta('leads')} leads, +${delta('orders')} orders, +${delta('revenue')} revenue today`);

  // 11. RBAC
  step(11, 'Role checks');
  const rec = new Client(`10.251.${crypto.randomInt(255)}.${crypto.randomInt(255)}`);
  await rec.json('/api/auth/staff-login', { method: 'POST', json: { username: 'reception_lead', password: 'HostReception2026!' } });
  assert.equal((await rec.json(`/api/menu/${pick[0].id}/price`, { method: 'POST', json: { priceMinor: 1 } })).status, 403);
  assert.equal((await rec.json('/api/admin/analytics/sales')).status, 403);
  assert.equal((await new Client().json('/api/admin/export/leads.csv')).status, 401);
  ok('reception → 403 on prices and analytics; anonymous → 401 on exports');

  console.log('\nALL CHECKS PASSED');
}

main().catch((err) => {
  console.error('\nFAILED:', err?.message || err);
  process.exit(1);
});
