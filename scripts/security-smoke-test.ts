// KAONASHI security smoke test against a RUNNING instance (pentest checklist items 1, 2, 4, 5, 6).
//   APP_BASE_URL=http://localhost:3000 npx tsx scripts/security-smoke-test.ts
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = process.env.APP_BASE_URL || 'http://localhost:3000';
const ip = () => `10.77.${crypto.randomInt(255)}.${crypto.randomInt(255)}`;

async function call(path: string, init: RequestInit & { json?: unknown; cookie?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': init.ip || ip() };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(init.json);
  }
  const r = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
  const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return { r, cookie, text: await r.text() };
}

async function main() {
  console.log(`Security smoke test → ${BASE}`);

  // 2. Default credentials
  for (const u of ['admin', 'root', 'administrator']) {
    const { r } = await call('/api/auth/staff-login', { method: 'POST', json: { username: u, password: 'admin' } });
    assert.equal(r.status, 401, `${u} must be rejected`);
  }
  console.log('✓ default accounts rejected');

  // 1. Brute force: sixth attempt → 429 + Retry-After; identical message for unknown vs known users
  const attacker = ip();
  const user = `nobody_${crypto.randomInt(1e6)}`;
  const bodies: string[] = [];
  for (let i = 0; i < 5; i++) bodies.push((await call('/api/auth/staff-login', { method: 'POST', ip: attacker, json: { username: user, password: 'x' } })).text);
  const sixth = await call('/api/auth/staff-login', { method: 'POST', ip: attacker, json: { username: user, password: 'x' } });
  assert.equal(sixth.r.status, 429);
  assert.ok(Number(sixth.r.headers.get('retry-after')) > 0);
  const known = await call('/api/auth/staff-login', { method: 'POST', json: { username: 'itamae_lead', password: 'wrong-password' } });
  assert.equal(JSON.parse(known.text).error, JSON.parse(bodies[0]).error, 'unknown and known users must get the same error');
  console.log('✓ brute force → 429 with Retry-After; no account enumeration');

  // 5. RBAC / BOLA / BFLA
  const anon = ['/api/orders', '/api/audit', '/api/admin/analytics/sales', '/api/admin/export/leads.csv', '/api/reservations'];
  for (const p of anon) assert.equal((await call(p)).r.status, 401, `${p} must require a session`);
  for (const p of ['/api/seed/reset', '/api/audit/tamper-demo', '/api/menu/dish_salm_aburi/price', '/api/orders/x/status']) {
    assert.equal((await call(p, { method: 'POST', json: {} })).r.status, 401, `${p} must require a session`);
  }
  const kitchen = await call('/api/auth/staff-login', { method: 'POST', json: { username: 'itamae_lead', password: 'ItamaeKitchen2026!' } });
  assert.equal(kitchen.r.status, 200, 'kitchen demo login failed');
  for (const [m, p] of [['GET', '/api/admin/export/leads.csv'], ['GET', '/api/admin/analytics/btl'], ['POST', '/api/menu/dish_salm_aburi/price'], ['GET', '/api/audit']]) {
    assert.equal((await call(p, { method: m, cookie: kitchen.cookie, json: m === 'POST' ? { priceMinor: 1 } : undefined })).r.status, 403, `kitchen must be denied ${p}`);
  }
  const fakeOrder = await call('/api/orders/ord_does_not_exist');
  assert.equal(fakeOrder.r.status, 404);
  console.log('✓ anonymous → 401, kitchen role → 403 on marketing/admin resources, orders need their token');

  // 4. Formula injection is neutralized in exports
  const { exportToCsv } = await import('../src/lib/csv');
  const csv = exportToCsv([{ name: "=CMD|' /C calc'!A1" }], [{ key: 'name', header: 'Name' }] as any);
  assert.ok(csv.includes("'=CMD"), 'formula must be prefixed with a quote');
  console.log('✓ CSV formula injection neutralized');

  // 6. QR tampering and open redirects
  assert.equal((await call('/r/CSTN8001?s=AAAAAAAAAAAAAAAA')).r.status, 404);
  assert.equal((await call('/r/NOPE0000?s=x')).r.status, 404);
  const ret = await call('/api/auth/otp/verify', { method: 'POST', json: { code: '000000', returnTo: '//evil.example' } });
  assert.ok(!ret.text.includes('evil.example'));
  console.log('✓ tampered/unknown QR → 404; external returnTo ignored');

  console.log('\nALL SECURITY CHECKS PASSED');
}

main().catch((e) => {
  console.error('FAILED:', e?.message || e);
  process.exit(1);
});
