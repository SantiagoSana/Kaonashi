import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnTo, normalizeEmail, normalizePhone } from '../src/server/security';
import { parseRange } from '../src/server/analytics';
import { ROLE_PERMISSIONS } from '../src/lib/security/authorize';

test('returnTo only accepts internal paths', () => {
  assert.equal(safeReturnTo('/checkout'), '/checkout');
  for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', 42]) assert.equal(safeReturnTo(bad, '/'), '/');
});

test('contact normalization', () => {
  assert.equal(normalizeEmail('  Mia@Example.COM '), 'mia@example.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(normalizePhone('300 123 4567'), '+573001234567');
  assert.equal(normalizePhone('12'), null);
});

test('analytics date range defaults to 30 local days and rejects huge ranges', () => {
  const r = parseRange({});
  assert.equal(r.days, 30);
  assert.ok(r.fromIso.endsWith('T05:00:00.000Z'), 'Bogotá midnight is 05:00 UTC');
  const swapped = parseRange({ from: '2026-10-10', to: '2026-10-01' });
  assert.equal(swapped.fromDate, '2026-10-01');
  assert.throws(() => parseRange({ from: '2020-01-01', to: '2026-01-01' }), /RANGE_TOO_LARGE/);
});

test('RBAC: no role is named admin/root and reception cannot see analytics or prices', () => {
  assert.ok(!('admin' in ROLE_PERMISSIONS) && !('root' in ROLE_PERMISSIONS));
  for (const p of ['analytics:sales', 'analytics:btl', 'menu:edit_price', 'leads:read'] as const) assert.ok(!ROLE_PERMISSIONS.reception.includes(p));
  assert.ok(ROLE_PERMISSIONS.marketing_manager.includes('analytics:btl'));
  assert.ok(!ROLE_PERMISSIONS.marketing_manager.includes('menu:edit_price'));
});
