// KAONASHI ANALYTICS ENGINE — every number is computed in SQL over the raw records (§9.4: code computes, never the model).
import type { Store } from './store';

const TZ = 'America/Bogota';

export interface Range {
  fromIso: string; // inclusive, UTC ISO
  toIso: string; // exclusive, UTC ISO
  fromDate: string; // local YYYY-MM-DD
  toDate: string; // local YYYY-MM-DD (inclusive)
  days: number;
  branchId?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const localMidnightUtc = (d: string) => new Date(`${d}T05:00:00.000Z`); // Bogotá = UTC-5

export function parseRange(query: any): Range {
  const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  let toDate = typeof query.to === 'string' && DATE_RE.test(query.to) ? query.to : today;
  let fromDate = typeof query.from === 'string' && DATE_RE.test(query.from) ? query.from : '';
  if (!fromDate) {
    const d = localMidnightUtc(toDate);
    d.setUTCDate(d.getUTCDate() - 29);
    fromDate = d.toISOString().slice(0, 10);
  }
  if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];
  const from = localMidnightUtc(fromDate);
  const to = localMidnightUtc(toDate);
  to.setUTCDate(to.getUTCDate() + 1);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
  if (days > 730) throw new Error('RANGE_TOO_LARGE');
  // sameTime=1 cuts every day of the range at the current local time of day (fair "today vs same weekday last week").
  if (query.sameTime === '1' && fromDate === toDate) {
    const nowLocalMs = Date.now() - 5 * 3600000;
    const sinceMidnight = nowLocalMs - new Date(new Date(nowLocalMs).toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
    to.setTime(from.getTime() + sinceMidnight);
  }
  const branchId = typeof query.branchId === 'string' && /^[a-z0-9_]{1,40}$/.test(query.branchId) ? query.branchId : undefined;
  return { fromIso: from.toISOString(), toIso: to.toISOString(), fromDate, toDate, days, branchId };
}

function previous(r: Range): Range {
  const span = new Date(r.toIso).getTime() - new Date(r.fromIso).getTime();
  const from = new Date(new Date(r.fromIso).getTime() - span);
  const to = new Date(r.fromIso);
  return { ...r, fromIso: from.toISOString(), toIso: to.toISOString() };
}

/** Valid orders (not cancelled) in range: shared filter SQL. Params $1 from, $2 to, $3 branch|null. */
const ORDERS_IN_RANGE = `
  SELECT data AS d, (data->>'createdAt')::timestamptz AS ts
  FROM docs
  WHERE collection = 'orders'
    AND data->>'createdAt' >= $1 AND data->>'createdAt' < $2
    AND data->>'status' NOT IN ('cancelled', 'refunded')
    AND ($3::text IS NULL OR data->>'branchId' = $3)`;

const n = (v: any) => (v === null || v === undefined ? 0 : Number(v));
const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const delta = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);

// ============================================================================ SALES & DEMAND
export async function salesAnalytics(store: Store, r: Range) {
  const p = [r.fromIso, r.toIso, r.branchId ?? null];
  const pp = previous(r);
  const kpiSql = `
    WITH o AS (${ORDERS_IN_RANGE})
    SELECT count(*)::int AS orders,
      COALESCE(sum((d->>'totalMinor')::bigint), 0) AS revenue,
      COALESCE(sum((d->>'discountMinor')::bigint), 0) AS discounts,
      COALESCE(sum((d->>'tipMinor')::bigint), 0) AS tips,
      COALESCE(avg((d->>'prepMinutes')::numeric), 0) AS avg_prep,
      COALESCE(sum((d->>'totalMinor')::bigint) FILTER (WHERE d->'attribution'->>'matchedBy' <> 'none'), 0) AS btl_revenue,
      count(DISTINCT d->>'customerId') FILTER (WHERE d->>'customerId' IS NOT NULL) AS customers
    FROM o`;
  const [cur, prev, daily, heat, dishes, byType, byCategory, byPayment, kitchen] = await Promise.all([
    store.sql(kpiSql, p),
    store.sql(kpiSql, [pp.fromIso, pp.toIso, r.branchId ?? null]),
    store.sql(
      `WITH o AS (${ORDERS_IN_RANGE})
       SELECT to_char(ts AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS day, count(*)::int AS orders,
              sum((d->>'totalMinor')::bigint) AS revenue,
              sum((d->>'totalMinor')::bigint) FILTER (WHERE d->'attribution'->>'matchedBy' <> 'none') AS btl_revenue
       FROM o GROUP BY 1 ORDER BY 1`,
      p
    ),
    store.sql(
      `WITH o AS (${ORDERS_IN_RANGE})
       SELECT extract(isodow FROM ts AT TIME ZONE '${TZ}')::int AS dow, extract(hour FROM ts AT TIME ZONE '${TZ}')::int AS hour,
              count(*)::int AS orders, sum((d->>'totalMinor')::bigint) AS revenue
       FROM o GROUP BY 1, 2`,
      p
    ),
    store.sql(
      `WITH o AS (${ORDERS_IN_RANGE}),
       li AS (SELECT i->>'menuItemId' AS id, (i->>'qty')::int AS qty, (i->>'priceMinor')::bigint AS price, (i->>'discountMinor')::bigint AS disc
              FROM o, jsonb_array_elements(d->'items') i)
       SELECT li.id, m.data->'names'->>'es' AS name, m.data->>'category' AS category,
              (m.data->>'price')::bigint AS price, (m.data->>'cost')::bigint AS cost,
              sum(li.qty)::int AS units, sum(li.qty * li.price - li.disc) AS revenue
       FROM li JOIN docs m ON m.collection = 'menuItems' AND m.id = li.id
       GROUP BY 1, 2, 3, 4, 5 ORDER BY units DESC`,
      p
    ),
    store.sql(`WITH o AS (${ORDERS_IN_RANGE}) SELECT d->>'type' AS key, count(*)::int AS orders, sum((d->>'totalMinor')::bigint) AS revenue FROM o GROUP BY 1 ORDER BY 3 DESC`, p),
    store.sql(
      `WITH o AS (${ORDERS_IN_RANGE})
       SELECT m.data->>'category' AS key, sum((i->>'qty')::int)::int AS units, sum((i->>'qty')::int * (i->>'priceMinor')::bigint - (i->>'discountMinor')::bigint) AS revenue
       FROM o, jsonb_array_elements(d->'items') i JOIN docs m ON m.collection = 'menuItems' AND m.id = i->>'menuItemId'
       GROUP BY 1 ORDER BY 3 DESC`,
      p
    ),
    store.sql(`WITH o AS (${ORDERS_IN_RANGE}) SELECT d->>'paymentMethod' AS key, count(*)::int AS orders, sum((d->>'totalMinor')::bigint) AS revenue FROM o GROUP BY 1`, p),
    store.sql(
      `SELECT data->>'status' AS status, count(*)::int AS n FROM docs WHERE collection = 'orders'
       AND data->>'status' IN ('pending_confirmation', 'received', 'preparing', 'quality_check') GROUP BY 1`
    ),
  ]);

  const c = cur[0], pv = prev[0];
  const kpis = {
    revenue: n(c.revenue), orders: n(c.orders), aov: c.orders ? Math.round(n(c.revenue) / n(c.orders)) : 0,
    discounts: n(c.discounts), tips: n(c.tips), avgPrepMinutes: Math.round(n(c.avg_prep) * 10) / 10,
    btlShare: pct(n(c.btl_revenue), n(c.revenue)), uniqueCustomers: n(c.customers),
    inKitchen: kitchen.reduce((a: number, k: any) => a + n(k.n), 0),
    deltas: {
      revenue: delta(n(c.revenue), n(pv.revenue)), orders: delta(n(c.orders), n(pv.orders)),
      aov: delta(c.orders ? n(c.revenue) / n(c.orders) : 0, pv.orders ? n(pv.revenue) / n(pv.orders) : 0),
      uniqueCustomers: delta(n(c.customers), n(pv.customers)),
    },
  };

  // Demand heatmap with a staffing suggestion: 1 cook per 6 orders/hour on average days, min 2.
  const weeks = Math.max(1, r.days / 7);
  const heatmap = heat.map((h: any) => {
    const perHour = n(h.orders) / weeks;
    return { dow: n(h.dow), hour: n(h.hour), orders: n(h.orders), revenue: n(h.revenue), avgPerWeek: Math.round(perHour * 10) / 10, cooks: Math.max(2, Math.ceil(perHour / 6)) };
  });

  // BCG menu engineering: popularity vs unit margin, thresholds at the medians.
  const rows = dishes.map((d: any) => ({ id: d.id, name: d.name, category: d.category, units: n(d.units), revenue: n(d.revenue), unitMargin: n(d.price) - n(d.cost), marginPct: d.price ? Math.round(((n(d.price) - n(d.cost)) / n(d.price)) * 100) : 0 }));
  const mu = median(rows.map((x) => x.units));
  const mm = median(rows.map((x) => x.unitMargin));
  const action: Record<string, string> = {
    star: 'Mantener visibilidad y precio; destacarlo en BTL.',
    plowhorse: 'Popular pero de bajo margen: subir precio levemente o reducir costo de receta.',
    puzzle: 'Buen margen y poca venta: reubicarlo en la carta o recomendarlo en Concierge.',
    dog: 'Bajo margen y poca venta: evaluar retirarlo o rediseñarlo.',
  };
  const bcg = rows.map((x) => {
    const q = x.units >= mu ? (x.unitMargin >= mm ? 'star' : 'plowhorse') : x.unitMargin >= mm ? 'puzzle' : 'dog';
    return { ...x, quadrant: q, action: action[q] };
  });

  return {
    range: r, kpis,
    daily: daily.map((d: any) => ({ day: d.day, orders: n(d.orders), revenue: n(d.revenue), btlRevenue: n(d.btl_revenue) })),
    heatmap,
    bcg, bcgThresholds: { units: mu, unitMargin: mm },
    byType: byType.map((x: any) => ({ key: x.key, orders: n(x.orders), revenue: n(x.revenue) })),
    byCategory: byCategory.map((x: any) => ({ key: x.key, units: n(x.units), revenue: n(x.revenue) })),
    byPayment: byPayment.map((x: any) => ({ key: x.key, orders: n(x.orders), revenue: n(x.revenue) })),
  };
}

// ============================================================================ CUSTOMERS (RFM, CLV, cohorts)
export async function customerAnalytics(store: Store, r: Range) {
  const asOf = r.toIso;
  const [rfmRows, cohorts, newVsReturning, tiers, totals] = await Promise.all([
    store.sql(
      `WITH o AS (
         SELECT data->>'customerId' AS cid, (data->>'createdAt')::timestamptz AS ts, (data->>'totalMinor')::bigint AS total,
                (data->'attribution'->>'matchedBy') <> 'none' AS btl
         FROM docs WHERE collection = 'orders' AND data->>'customerId' IS NOT NULL
           AND data->>'createdAt' < $1 AND data->>'status' NOT IN ('cancelled', 'refunded')
           AND ($2::text IS NULL OR data->>'branchId' = $2)),
       c AS (
         SELECT cid, max(ts) AS last_ts, min(ts) AS first_ts, count(*)::int AS freq, sum(total) AS monetary,
                avg(CASE WHEN btl THEN 1 ELSE 0 END) AS btl_share
         FROM o GROUP BY cid),
       s AS (
         SELECT *, extract(epoch FROM ($1::timestamptz - last_ts)) / 86400 AS recency_days,
                ntile(5) OVER (ORDER BY last_ts) AS r, ntile(5) OVER (ORDER BY freq) AS f, ntile(5) OVER (ORDER BY monetary) AS m
         FROM c)
       SELECT s.*, cu.data->>'name' AS name, cu.data->>'emailNormalized' AS email FROM s
       LEFT JOIN docs cu ON cu.collection = 'customers' AND cu.id = s.cid`,
      [asOf, r.branchId ?? null]
    ),
    store.sql(
      `WITH o AS (
         SELECT data->>'customerId' AS cid, date_trunc('month', (data->>'createdAt')::timestamptz AT TIME ZONE '${TZ}') AS mon
         FROM docs WHERE collection = 'orders' AND data->>'customerId' IS NOT NULL AND data->>'createdAt' < $1
           AND data->>'status' NOT IN ('cancelled', 'refunded')),
       f AS (SELECT cid, min(mon) AS cohort FROM o GROUP BY cid),
       a AS (SELECT DISTINCT o.cid, f.cohort, o.mon FROM o JOIN f USING (cid))
       SELECT to_char(cohort, 'YYYY-MM') AS cohort,
              ((extract(year FROM mon) - extract(year FROM cohort)) * 12 + extract(month FROM mon) - extract(month FROM cohort))::int AS age,
              count(DISTINCT cid)::int AS customers
       FROM a GROUP BY 1, 2 ORDER BY 1, 2`,
      [asOf]
    ),
    store.sql(
      `WITH o AS (
         SELECT data->>'customerId' AS cid, (data->>'createdAt')::timestamptz AS ts FROM docs
         WHERE collection = 'orders' AND data->>'customerId' IS NOT NULL AND data->>'status' NOT IN ('cancelled', 'refunded')),
       f AS (SELECT cid, min(ts) AS first_ts FROM o GROUP BY cid)
       SELECT to_char(date_trunc('week', o.ts AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS week,
              count(DISTINCT o.cid) FILTER (WHERE date_trunc('week', o.ts) = date_trunc('week', f.first_ts))::int AS new_customers,
              count(DISTINCT o.cid) FILTER (WHERE date_trunc('week', o.ts) > date_trunc('week', f.first_ts))::int AS returning_customers
       FROM o JOIN f USING (cid) WHERE o.ts >= $1::timestamptz AND o.ts < $2::timestamptz GROUP BY 1 ORDER BY 1`,
      [r.fromIso, r.toIso]
    ),
    store.sql(`SELECT data->>'tier' AS tier, count(*)::int AS n, sum((data->>'pointsBalance')::bigint) AS points FROM docs WHERE collection = 'loyaltyAccounts' GROUP BY 1`),
    store.sql(
      `SELECT count(*) FILTER (WHERE data->>'customerId' IS NULL)::int AS guest_orders, count(*)::int AS all_orders
       FROM docs WHERE collection = 'orders' AND data->>'createdAt' >= $1 AND data->>'createdAt' < $2 AND data->>'status' NOT IN ('cancelled', 'refunded')`,
      [r.fromIso, r.toIso]
    ),
  ]);

  const segOf = (x: any) => {
    const R = n(x.r), F = n(x.f);
    if (R >= 4 && F >= 4) return 'champions';
    if (F >= 4) return 'loyal';
    if (R >= 4 && F <= 2) return 'promising';
    if (R <= 2 && F >= 3) return 'at_risk';
    if (R <= 2) return 'dormant';
    return 'needs_attention';
  };
  const LIFESPAN_YEARS = 2;
  const segs: Record<string, { customers: number; revenue: number; orders: number; recency: number[]; btl: number; tenureDays: number }> = {};
  const customers = rfmRows.map((x: any) => {
    const segment = segOf(x);
    const s = (segs[segment] ||= { customers: 0, revenue: 0, orders: 0, recency: [], btl: 0, tenureDays: 0 });
    s.customers += 1;
    s.revenue += n(x.monetary);
    s.orders += n(x.freq);
    s.recency.push(n(x.recency_days));
    s.btl += n(x.btl_share);
    const tenure = Math.max(30, (new Date(asOf).getTime() - new Date(x.first_ts).getTime()) / 86400000);
    s.tenureDays += tenure;
    const aov = n(x.monetary) / n(x.freq);
    const perYear = (n(x.freq) / tenure) * 365;
    return {
      id: x.cid, name: x.name || '—', email: maskEmail(x.email), segment, recencyDays: Math.round(n(x.recency_days)), frequency: n(x.freq),
      monetary: n(x.monetary), r: n(x.r), f: n(x.f), m: n(x.m), clv: Math.round(aov * perYear * LIFESPAN_YEARS),
    };
  });
  const segments = Object.entries(segs).map(([key, s]) => {
    const aov = s.orders ? s.revenue / s.orders : 0;
    const perYear = s.tenureDays ? (s.orders / s.tenureDays) * 365 : 0;
    return {
      key, customers: s.customers, revenue: s.revenue, aov: Math.round(aov), ordersPerCustomer: Math.round((s.orders / s.customers) * 10) / 10,
      medianRecencyDays: Math.round(median(s.recency)), btlResponse: Math.round((s.btl / s.customers) * 1000) / 10,
      clv: Math.round(aov * perYear * LIFESPAN_YEARS),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Cohort retention matrix (share of cohort active N months later).
  const cohortSize: Record<string, number> = {};
  for (const c of cohorts) if (n(c.age) === 0) cohortSize[c.cohort] = n(c.customers);
  const cohortMatrix = Object.keys(cohortSize).sort().map((cohort) => ({
    cohort, size: cohortSize[cohort],
    retention: cohorts.filter((c: any) => c.cohort === cohort).sort((a: any, b: any) => a.age - b.age).map((c: any) => ({ age: n(c.age), pct: pct(n(c.customers), cohortSize[cohort]) })),
  }));

  const t = totals[0] || {};
  return {
    range: r,
    kpis: {
      customers: customers.length,
      avgClv: customers.length ? Math.round(customers.reduce((a, c) => a + c.clv, 0) / customers.length) : 0,
      repeatRate: pct(customers.filter((c) => c.frequency > 1).length, customers.length),
      guestOrderShare: pct(n(t.guest_orders), n(t.all_orders)),
    },
    segments,
    topCustomers: [...customers].sort((a, b) => b.monetary - a.monetary).slice(0, 25),
    rfmScatter: customers.slice(0, 4000).map((c) => ({ recencyDays: c.recencyDays, frequency: c.frequency, monetary: c.monetary, segment: c.segment })),
    cohortMatrix,
    newVsReturning: newVsReturning.map((w: any) => ({ week: w.week, newCustomers: n(w.new_customers), returningCustomers: n(w.returning_customers) })),
    tiers: tiers.map((x: any) => ({ tier: x.tier, members: n(x.n), points: n(x.points) })),
  };
}

function maskEmail(e?: string | null) {
  if (!e) return '—';
  const [u, d] = e.split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, u.length - 2))}@${d}`;
}

// ============================================================================ BTL MARKETING
export async function btlAnalytics(store: Store, r: Range, model: 'last_touch' | 'first_touch' = 'last_touch') {
  const touchKey = model === 'first_touch' ? 'first' : 'last';
  const p = [r.fromDate, r.toDate];
  const [stats, dist, costs, tps, camps, attributed, scansDaily, scanHeat, devices, ttc, coupons] = await Promise.all([
    store.sql(
      `SELECT data->>'campaignId' AS campaign_id, data->>'touchpointId' AS tp,
              sum((data->>'scans')::int)::int AS scans, sum((data->>'uniqueScans')::int)::int AS unique_scans,
              sum((data->>'landingViews')::int)::int AS landing_views, sum((data->>'engaged')::int)::int AS engaged,
              sum((data->>'leads')::int)::int AS leads, sum((data->>'claims')::int)::int AS claims,
              sum((data->>'addToCart')::int)::int AS add_to_cart, sum((data->>'checkoutStarted')::int)::int AS checkout_started
       FROM docs WHERE collection = 'statsDaily' AND data->>'date' >= $1 AND data->>'date' <= $2 GROUP BY 1, 2`,
      p
    ),
    store.sql(`SELECT data->>'touchpointId' AS tp, sum((data->>'quantity')::int)::int AS qty FROM docs WHERE collection = 'distributionLogs' AND data->>'date' >= $1 AND data->>'date' <= $2 GROUP BY 1`, p),
    // Costs are amortized over the days the campaign runs, so any date range gets its fair share of spend.
    store.sql(
      `SELECT c.data->>'campaignId' AS campaign_id, c.data->>'touchpointId' AS tp, c.data->>'kind' AS kind, (c.data->>'amountMinor')::numeric AS amount,
              greatest(c.data->>'date', left(k.data->>'startDate', 10))::date AS s, left(k.data->>'endDate', 10)::date AS e
       FROM docs c JOIN docs k ON k.collection = 'campaigns' AND k.id = c.data->>'campaignId' WHERE c.collection = 'costEntries'`
    ),
    store.sql(`SELECT data FROM docs WHERE collection = 'touchpoints'`),
    store.sql(`SELECT data FROM docs WHERE collection = 'campaigns'`),
    // Orders/revenue come from the attribution snapshot on each order, so the model toggle re-reads without rewriting.
    store.sql(
      `SELECT data->'attribution'->'${touchKey}'->>'campaignId' AS campaign_id, data->'attribution'->'${touchKey}'->>'touchpointId' AS tp,
              count(*)::int AS orders, sum((data->>'totalMinor')::bigint) AS revenue, sum((data->>'discountMinor')::bigint) AS discount,
              sum((SELECT sum((i->>'qty')::int * COALESCE((m.data->>'cost')::bigint, (i->>'priceMinor')::bigint * 0.33))
                   FROM jsonb_array_elements(data->'items') i LEFT JOIN docs m ON m.collection = 'menuItems' AND m.id = i->>'menuItemId')) AS cogs,
              count(*) FILTER (WHERE data->>'source' = 'in_person')::int AS walk_ins
       FROM docs WHERE collection = 'orders' AND data->>'createdAt' >= $1 AND data->>'createdAt' < $2
         AND data->>'status' NOT IN ('cancelled', 'refunded') AND data->'attribution'->>'matchedBy' <> 'none'
       GROUP BY 1, 2`,
      [r.fromIso, r.toIso]
    ),
    store.sql(
      `SELECT to_char((s.data->>'timestamp')::timestamptz AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS day, t.data->>'type' AS type, count(*)::int AS scans
       FROM docs s JOIN docs t ON t.collection = 'touchpoints' AND t.id = s.data->>'touchpointId'
       WHERE s.collection = 'scanEvents' AND s.data->>'timestamp' >= $1 AND s.data->>'timestamp' < $2 GROUP BY 1, 2 ORDER BY 1`,
      [r.fromIso, r.toIso]
    ),
    store.sql(
      `SELECT extract(isodow FROM (data->>'timestamp')::timestamptz AT TIME ZONE '${TZ}')::int AS dow,
              extract(hour FROM (data->>'timestamp')::timestamptz AT TIME ZONE '${TZ}')::int AS hour, count(*)::int AS scans
       FROM docs WHERE collection = 'scanEvents' AND data->>'timestamp' >= $1 AND data->>'timestamp' < $2 GROUP BY 1, 2`,
      [r.fromIso, r.toIso]
    ),
    store.sql(
      `SELECT data->>'deviceClass' AS device, data->>'os' AS os, count(*)::int AS scans FROM docs
       WHERE collection = 'scanEvents' AND data->>'timestamp' >= $1 AND data->>'timestamp' < $2 GROUP BY 1, 2 ORDER BY 3 DESC`,
      [r.fromIso, r.toIso]
    ),
    store.sql(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (data->'attribution'->>'touchAgeHours')::numeric) FILTER (WHERE data->'attribution'->>'matchedBy' <> 'none' AND data->>'source' = 'online') AS median_hours,
              sum((data->>'totalMinor')::bigint) FILTER (WHERE data->'attribution'->>'matchedBy' = 'none') AS organic_revenue,
              count(*) FILTER (WHERE data->'attribution'->>'matchedBy' = 'none')::int AS organic_orders,
              count(*) FILTER (WHERE data->'attribution'->>'matchedBy' = 'coupon')::int AS by_coupon,
              count(*) FILTER (WHERE data->'attribution'->>'matchedBy' = 'cookie')::int AS by_cookie,
              count(*) FILTER (WHERE data->'attribution'->>'matchedBy' = 'lead')::int AS by_lead
       FROM docs WHERE collection = 'orders' AND data->>'createdAt' >= $1 AND data->>'createdAt' < $2 AND data->>'status' NOT IN ('cancelled', 'refunded')`,
      [r.fromIso, r.toIso]
    ),
    store.sql(
      `SELECT c.data->>'code' AS code, c.data->>'campaignId' AS campaign_id,
              (SELECT count(*) FROM docs x WHERE x.collection = 'couponClaims' AND x.data->>'couponId' = c.id AND x.data->>'claimedAt' >= $1 AND x.data->>'claimedAt' < $2)::int AS claimed,
              (SELECT count(*) FROM docs x WHERE x.collection = 'couponRedemptions' AND x.data->>'couponId' = c.id AND x.data->>'redeemedAt' >= $1 AND x.data->>'redeemedAt' < $2)::int AS redeemed,
              (SELECT COALESCE(sum((x.data->>'discountMinor')::bigint), 0) FROM docs x WHERE x.collection = 'couponRedemptions' AND x.data->>'couponId' = c.id AND x.data->>'redeemedAt' >= $1 AND x.data->>'redeemedAt' < $2) AS discount_cost,
              (SELECT COALESCE(sum((o.data->>'totalMinor')::bigint), 0) FROM docs o WHERE o.collection = 'orders' AND o.data->>'appliedCouponCode' = c.data->>'code' AND o.data->>'createdAt' >= $1 AND o.data->>'createdAt' < $2) AS revenue
       FROM docs c WHERE c.collection = 'coupons' AND c.data->>'campaignId' IS NOT NULL`,
      [r.fromIso, r.toIso]
    ),
  ]);

  const tpById = Object.fromEntries(tps.map((x: any) => [x.data.id, x.data]));
  const campById = Object.fromEntries(camps.map((x: any) => [x.data.id, x.data]));
  const withCosts = new Set<string>();
  for (const c of costs) {
    withCosts.add(c.campaign_id);
    if (c.tp) withCosts.add(c.tp);
  }
  type Row = { scans: number; uniqueScans: number; landingViews: number; engaged: number; leads: number; claims: number; addToCart: number; checkoutStarted: number; orders: number; revenue: number; discount: number; cogs: number; walkIns: number; spend: number; distributed: number; estimated: boolean };
  const empty = (): Row => ({ scans: 0, uniqueScans: 0, landingViews: 0, engaged: 0, leads: 0, claims: 0, addToCart: 0, checkoutStarted: 0, orders: 0, revenue: 0, discount: 0, cogs: 0, walkIns: 0, spend: 0, distributed: 0, estimated: false });
  const byTp: Record<string, Row> = {};
  const byCamp: Record<string, Row> = {};
  const add = (map: Record<string, Row>, key: string, patch: Partial<Row>) => {
    const row = (map[key] ||= empty());
    for (const [k, v] of Object.entries(patch)) if (typeof v === 'number') (row as any)[k] += v;
      else if (typeof v === 'boolean') (row as any)[k] = (row as any)[k] || v;
  };
  for (const s of stats) {
    const patch = { scans: n(s.scans), uniqueScans: n(s.unique_scans), landingViews: n(s.landing_views), engaged: n(s.engaged), leads: n(s.leads), claims: n(s.claims), addToCart: n(s.add_to_cart), checkoutStarted: n(s.checkout_started) };
    add(byTp, s.tp, patch);
    add(byCamp, s.campaign_id, patch);
  }
  for (const a of attributed) {
    if (!a.campaign_id) continue;
    const patch = { orders: n(a.orders), revenue: n(a.revenue), discount: n(a.discount), cogs: Math.round(n(a.cogs)), walkIns: n(a.walk_ins) };
    if (a.tp && tpById[a.tp]) add(byTp, a.tp, patch);
    add(byCamp, a.campaign_id, patch);
  }
  const rs = new Date(`${r.fromDate}T00:00:00Z`).getTime();
  const re = new Date(`${r.toDate}T00:00:00Z`).getTime();
  for (const c of costs) {
    const s0 = new Date(c.s).getTime();
    const e0 = Math.max(s0, new Date(c.e).getTime());
    const total = (e0 - s0) / 86400000 + 1;
    const overlap = Math.max(0, (Math.min(e0, re) - Math.max(s0, rs)) / 86400000 + 1);
    const share = Math.round(n(c.amount) * Math.min(1, overlap / total));
    if (!share) continue;
    if (c.tp) add(byTp, c.tp, { spend: share });
    add(byCamp, c.campaign_id, { spend: share });
  }
  for (const t of Object.values(tpById) as any[]) {
    const qty = t.impressionsEstimate ? Math.round((t.impressionsEstimate * r.days) / 120) : n(dist.find((d: any) => d.tp === t.id)?.qty);
    add(byTp, t.id, { distributed: qty, estimated: Boolean(t.impressionsEstimate) });
    add(byCamp, t.campaignId, { distributed: qty, estimated: Boolean(t.impressionsEstimate) });
  }

  const derive = (row: Row) => ({
    ...row,
    scanRate: pct(row.uniqueScans, row.distributed),
    landingToLead: pct(row.leads, row.landingViews),
    scanToOrder: pct(row.orders, row.uniqueScans),
    costPerScan: row.spend && row.scans ? Math.round(row.spend / row.scans) : null,
    costPerLead: row.spend && row.leads ? Math.round(row.spend / row.leads) : null,
    costPerOrder: row.spend && row.orders ? Math.round(row.spend / row.orders) : null,
    roas: row.spend ? Math.round((row.revenue / row.spend) * 100) / 100 : null,
    netRoas: row.spend ? Math.round(((row.revenue - row.discount - row.cogs) / row.spend) * 100) / 100 : null,
    aov: row.orders ? Math.round(row.revenue / row.orders) : 0,
  });

  // Leaderboard tags (§5.8)
  const tpRows = Object.entries(byTp).filter(([id]) => tpById[id]).map(([id, row]) => {
    const t = tpById[id];
    const camp = campById[t.campaignId] || {};
    return { id, label: t.label, type: t.type, campaignId: t.campaignId, campaign: camp.name, hasCosts: withCosts.has(id) || withCosts.has(t.campaignId), ...derive(row) };
  });
  const medScans = median(tpRows.map((x) => x.scans));
  const medConv = median(tpRows.filter((x) => x.scanToOrder !== null).map((x) => x.scanToOrder as number));
  const leaderboard = tpRows.map((x) => {
    const camp = campById[x.campaignId] || {};
    let tag: 'scale' | 'fix_landing' | 'stop' | 'insufficient' | 'watch' = 'watch';
    if (x.scans < 30) tag = 'insufficient';
    else if (x.costPerOrder !== null && camp.floorCostPerOrder && x.scans >= 100 && x.costPerOrder > camp.floorCostPerOrder) tag = 'stop';
    else if (x.scans >= medScans && (x.scanToOrder ?? 0) < medConv * 0.5) tag = 'fix_landing';
    else if (x.costPerOrder !== null && camp.targetCostPerOrder && x.costPerOrder <= camp.targetCostPerOrder) tag = 'scale';
    return { ...x, tag };
  }).sort((a, b) => b.revenue - a.revenue);

  const campaigns = Object.entries(byCamp).filter(([id]) => campById[id]).map(([id, row]) => ({ id, name: campById[id].name, status: effectiveStatus(campById[id]), hasCosts: withCosts.has(id), ...derive(row) })).sort((a, b) => b.revenue - a.revenue);
  const total = campaigns.reduce((acc, c) => {
    for (const k of Object.keys(acc) as (keyof Row)[]) if (typeof acc[k] === 'number') (acc as any)[k] += (c as any)[k];
    return acc;
  }, empty());
  const t0 = ttc[0] || {};
  const totalBtl = derive(total);

  return {
    range: r, model,
    kpis: {
      ...totalBtl,
      medianHoursToConvert: Math.round(n(t0.median_hours) * 10) / 10,
      organicAov: n(t0.organic_orders) ? Math.round(n(t0.organic_revenue) / n(t0.organic_orders)) : 0,
      matchedBy: { coupon: n(t0.by_coupon), cookie: n(t0.by_cookie), lead: n(t0.by_lead), none: n(t0.organic_orders) },
    },
    funnel: [
      { stage: 'distributed', value: total.distributed },
      { stage: 'unique_scans', value: total.uniqueScans },
      { stage: 'landing_views', value: total.landingViews },
      { stage: 'engaged', value: total.engaged },
      { stage: 'leads', value: total.leads },
      { stage: 'claims', value: total.claims },
      { stage: 'add_to_cart', value: total.addToCart },
      { stage: 'checkout_started', value: total.checkoutStarted },
      { stage: 'orders', value: total.orders },
    ],
    campaigns,
    leaderboard,
    scansDaily: pivot(scansDaily, 'day', 'type', 'scans'),
    scanHeatmap: scanHeat.map((h: any) => ({ dow: n(h.dow), hour: n(h.hour), scans: n(h.scans) })),
    devices: devices.map((d: any) => ({ device: d.device, os: d.os, scans: n(d.scans) })),
    coupons: coupons.map((c: any) => ({ code: c.code, campaignId: c.campaign_id, claimed: n(c.claimed), redeemed: n(c.redeemed), redemptionRate: pct(n(c.redeemed), n(c.claimed)), revenue: n(c.revenue), discountCost: n(c.discount_cost), net: n(c.revenue) - n(c.discount_cost) })),
  };
}

export function effectiveStatus(c: any, now = new Date()) {
  if (c.status === 'paused' || c.status === 'draft') return c.status;
  if (now < new Date(c.startDate)) return 'scheduled';
  if (now > new Date(c.endDate)) return 'ended';
  return 'active';
}

function pivot(rows: any[], rowKey: string, colKey: string, val: string) {
  const out: Record<string, any> = {};
  for (const r of rows) {
    const k = r[rowKey];
    (out[k] ||= { [rowKey]: k })[r[colKey]] = n(r[val]);
  }
  return Object.values(out);
}

// ============================================================================ INVENTORY
export async function inventoryAnalytics(store: Store) {
  const now = new Date();
  const from28 = new Date(now.getTime() - 28 * 86400000).toISOString();
  const [items, usage, dailyUsage] = await Promise.all([
    store.sql(`SELECT data FROM docs WHERE collection = 'inventoryItems'`),
    store.sql(
      `WITH li AS (
         SELECT i->>'menuItemId' AS mid, (i->>'qty')::numeric AS qty
         FROM docs o, jsonb_array_elements(o.data->'items') i
         WHERE o.collection = 'orders' AND o.data->>'createdAt' >= $1 AND o.data->>'status' NOT IN ('cancelled', 'refunded'))
       SELECT r.data->>'sku' AS sku, sum(li.qty * (r.data->>'qty')::numeric) AS used
       FROM li JOIN docs r ON r.collection = 'recipeLines' AND r.data->>'menuItemId' = li.mid GROUP BY 1`,
      [from28]
    ),
    store.sql(
      `WITH li AS (
         SELECT to_char((o.data->>'createdAt')::timestamptz AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS day,
                extract(isodow FROM (o.data->>'createdAt')::timestamptz AT TIME ZONE '${TZ}')::int AS dow,
                i->>'menuItemId' AS mid, (i->>'qty')::numeric AS qty
         FROM docs o, jsonb_array_elements(o.data->'items') i
         WHERE o.collection = 'orders' AND o.data->>'createdAt' >= $1 AND o.data->>'status' NOT IN ('cancelled', 'refunded'))
       SELECT li.day, li.dow, r.data->>'sku' AS sku, sum(li.qty * (r.data->>'qty')::numeric) AS used
       FROM li JOIN docs r ON r.collection = 'recipeLines' AND r.data->>'menuItemId' = li.mid GROUP BY 1, 2, 3 ORDER BY 1`,
      [from28]
    ),
  ]);
  const usedBySku = Object.fromEntries(usage.map((u: any) => [u.sku, n(u.used)]));
  const rows = items.map(({ data: it }: any) => {
    const avgDaily = (usedBySku[it.sku] || 0) / 28;
    const daysOfCover = avgDaily > 0 ? Math.round((it.onHand / avgDaily) * 10) / 10 : null;
    // Forecast: weighted moving average of the last 4 same weekdays, for each of the next 7 days.
    const forecast7 = Array.from({ length: 7 }, (_, k) => {
      const dow = ((new Date(now.getTime() - 5 * 3600000 + (k + 1) * 86400000).getUTCDay() + 6) % 7) + 1;
      const same = dailyUsage.filter((d: any) => d.sku === it.sku && n(d.dow) === dow).map((d: any) => n(d.used)).slice(-4);
      const weights = [1, 2, 3, 4].slice(-same.length);
      const wsum = weights.reduce((a, b) => a + b, 0);
      return same.length ? same.reduce((a: number, v: number, i: number) => a + v * weights[i], 0) / wsum : avgDaily;
    });
    const demand7 = forecast7.reduce((a, b) => a + b, 0);
    const reorderQty = Math.max(0, Math.ceil((demand7 + it.parLevel - it.onHand) * 10) / 10);
    const lots = (it.lots || []).map((l: any) => ({ ...l, hoursToExpiry: Math.round((new Date(l.expiry).getTime() - now.getTime()) / 3600000) }));
    const expiringQty = lots.filter((l: any) => l.hoursToExpiry <= 48).reduce((a: number, l: any) => a + l.qty, 0);
    const wasteRisk = it.perishable ? Math.max(0, Math.round((expiringQty - avgDaily * 2) * 10) / 10) : 0;
    const status = daysOfCover !== null && daysOfCover < 1.5 ? 'critical' : it.onHand < it.parLevel || (daysOfCover !== null && daysOfCover < 3) ? 'low' : wasteRisk > 0 ? 'waste_risk' : 'ok';
    let reorderDate: string | null = null;
    if (avgDaily > 0) {
      const leadDays = it.perishable ? 1 : 3;
      const daysUntil = Math.max(0, (it.onHand - it.parLevel * 0.5) / avgDaily - leadDays);
      reorderDate = new Date(now.getTime() + daysUntil * 86400000).toISOString().slice(0, 10);
    }
    return {
      id: it.id, sku: it.sku, name: it.name, unit: it.unit, onHand: it.onHand, parLevel: it.parLevel, perishable: it.perishable,
      valueAtCost: Math.round(it.onHand * it.unitCost), avgDailyUse: Math.round(avgDaily * 100) / 100, daysOfCover,
      forecast7: forecast7.map((v) => Math.round(v * 100) / 100), demand7: Math.round(demand7 * 10) / 10, reorderQty, reorderDate,
      lots, expiringQty, wasteRisk, status,
    };
  }).sort((a: any, b: any) => (a.daysOfCover ?? 999) - (b.daysOfCover ?? 999));
  return {
    kpis: {
      skus: rows.length,
      stockValue: rows.reduce((a: number, r: any) => a + r.valueAtCost, 0),
      critical: rows.filter((r: any) => r.status === 'critical').length,
      low: rows.filter((r: any) => r.status === 'low').length,
      wasteRisk: rows.filter((r: any) => r.wasteRisk > 0).length,
    },
    items: rows,
    usageDaily: pivot(dailyUsage.filter((d: any) => rows.slice(0, 5).some((r: any) => r.sku === d.sku)), 'day', 'sku', 'used'),
  };
}
