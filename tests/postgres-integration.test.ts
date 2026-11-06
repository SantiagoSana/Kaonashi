// Boots the real store on an in-memory Postgres (PGlite), seeds a short history and checks the SQL analytics.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PGLITE_DIR = 'memory';
process.env.SEED_DAYS = '14';
delete process.env.DATABASE_URL;

test('seed + analytics + atomic counters on Postgres', { timeout: 120000 }, async () => {
  const { getStore } = await import('../src/server/store');
  const { salesAnalytics, btlAnalytics, customerAnalytics, inventoryAnalytics, parseRange } = await import('../src/server/analytics');
  const store = await getStore();
  const orders = await store.orders.count();
  assert.ok(orders > 1000, `expected a sizeable history, got ${orders}`);

  const r = parseRange({});
  const sales = await salesAnalytics(store, r);
  assert.ok(sales.kpis.orders > 0 && sales.kpis.revenue > 0);
  assert.equal(sales.kpis.aov, Math.round(sales.kpis.revenue / sales.kpis.orders));
  // Daily series adds up to the KPI.
  assert.equal(sales.daily.reduce((a, d) => a + d.revenue, 0), sales.kpis.revenue);
  assert.ok(sales.bcg.every((b) => ['star', 'plowhorse', 'puzzle', 'dog'].includes(b.quadrant)));

  const btl = await btlAnalytics(store, r);
  const stageValues = btl.funnel.slice(1).map((f) => f.value);
  assert.ok(stageValues[0] >= stageValues[stageValues.length - 1], 'funnel narrows from scans to orders');
  assert.ok(btl.leaderboard.some((x: any) => x.tag !== 'insufficient'));

  const customers = await customerAnalytics(store, r);
  assert.equal(customers.segments.reduce((a, s) => a + s.customers, 0), customers.kpis.customers);

  const inv = await inventoryAnalytics(store);
  assert.ok(inv.items.length >= 10 && inv.items.every((i: any) => i.forecast7.length === 7));

  // Atomic increment under concurrency.
  const c = (await store.coupons.findOne({ code: 'CAP5-TEST' }))!;
  await Promise.all(Array.from({ length: 25 }, () => store.coupons.increment(c.id, { redeemedCount: 1 })));
  assert.equal((await store.coupons.get(c.id))!.redeemedCount, 25);
});
