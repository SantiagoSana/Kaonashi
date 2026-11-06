// KAONASHI POSTGRES DOCUMENT STORE
// Every entity is a JSONB document in the `docs` table, keyed by (collection, id).
// Hot paths use `find`/`findOne`, which push filters down to SQL; analytics use raw SQL (analytics.ts).
import { Db, getDb, SCHEMA_SQL } from './db';
import type {
  Branch, StaffUser, Customer, MenuItem, InventoryItem, Campaign, Touchpoint, QrCode, Coupon,
  CouponClaim, CouponRedemption, Lead, ScanEvent, FunnelEvent, Order, StatsDaily, DistributionLog,
  CostEntry, Reservation, LoyaltyAccount, LoyaltyLedgerEntry,
} from '../lib/types';

type Primitive = string | number | boolean | null;
/** Equality on top-level fields, or { in: [...] } / { gte } / { lte } / { ne }. Dotted paths are allowed ("guestInfo.email"). */
export type Where = Record<string, Primitive | { in?: Primitive[]; gte?: Primitive; lte?: Primitive; ne?: Primitive }>;
type Q = Db['query'];

export interface FindOptions {
  orderBy?: string; // field name, dotted allowed
  desc?: boolean;
  limit?: number;
  offset?: number;
}

const SAFE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

function jsonPath(field: string): string {
  if (!SAFE_PATH.test(field)) throw new Error(`Unsafe field path: ${field}`);
  const parts = field.split('.');
  const last = parts.pop()!;
  const prefix = parts.map((p) => `->'${p}'`).join('');
  return `(data${prefix}->>'${last}')`;
}

function buildWhere(where: Where | undefined, params: unknown[]): string {
  if (!where) return '';
  const clauses: string[] = [];
  for (const [field, cond] of Object.entries(where)) {
    const col = jsonPath(field);
    const push = (v: unknown) => {
      params.push(v === null ? null : String(v));
      return `$${params.length}`;
    };
    if (cond === null) {
      clauses.push(`${col} IS NULL`);
    } else if (typeof cond === 'object') {
      if (cond.in) {
        params.push(cond.in.map((v) => String(v)));
        clauses.push(`${col} = ANY($${params.length}::text[])`);
      }
      if (cond.gte !== undefined) clauses.push(`${col} >= ${push(cond.gte)}`);
      if (cond.lte !== undefined) clauses.push(`${col} <= ${push(cond.lte)}`);
      if (cond.ne !== undefined) clauses.push(`(${col} IS DISTINCT FROM ${push(cond.ne)})`);
    } else {
      clauses.push(`${col} = ${push(cond)}`);
    }
  }
  return clauses.length ? ' AND ' + clauses.join(' AND ') : '';
}

export class PgCollection<T extends { id: string }> {
  constructor(private name: string, private db: () => Promise<Db>) {}

  private async q(): Promise<Q> {
    return (await this.db()).query;
  }

  async get(id: string, q?: Q): Promise<T | null> {
    const run = q || (await this.q());
    const r = await run(`SELECT data FROM docs WHERE collection = $1 AND id = $2`, [this.name, id]);
    return (r.rows[0]?.data as T) || null;
  }

  /** Row-locking read for use inside a transaction. */
  async getForUpdate(id: string, q: Q): Promise<T | null> {
    const r = await q(`SELECT data FROM docs WHERE collection = $1 AND id = $2 FOR UPDATE`, [this.name, id]);
    return (r.rows[0]?.data as T) || null;
  }

  async find(where?: Where, opts: FindOptions = {}, q?: Q): Promise<T[]> {
    const run = q || (await this.q());
    const params: unknown[] = [this.name];
    let sql = `SELECT data FROM docs WHERE collection = $1${buildWhere(where, params)}`;
    if (opts.orderBy) sql += ` ORDER BY ${jsonPath(opts.orderBy)} ${opts.desc ? 'DESC' : 'ASC'} NULLS LAST`;
    if (opts.limit) sql += ` LIMIT ${Math.max(1, Math.min(5000, Math.floor(opts.limit)))}`;
    if (opts.offset) sql += ` OFFSET ${Math.max(0, Math.floor(opts.offset))}`;
    const r = await run(sql, params);
    return r.rows.map((row: any) => row.data as T);
  }

  async findOne(where: Where, q?: Q): Promise<T | null> {
    return (await this.find(where, { limit: 1 }, q))[0] || null;
  }

  async count(where?: Where, q?: Q): Promise<number> {
    const run = q || (await this.q());
    const params: unknown[] = [this.name];
    const r = await run(`SELECT count(*)::int AS n FROM docs WHERE collection = $1${buildWhere(where, params)}`, params);
    return r.rows[0]?.n ?? 0;
  }

  /** Small collections only: loads everything, then filters in JS. */
  async list(filter?: (item: T) => boolean): Promise<T[]> {
    const all = await this.find();
    return filter ? all.filter(filter) : all;
  }

  async create(item: T, q?: Q): Promise<T> {
    const run = q || (await this.q());
    await run(`INSERT INTO docs (collection, id, data) VALUES ($1, $2, $3::jsonb)`, [this.name, item.id, JSON.stringify(item)]);
    return item;
  }

  async upsert(item: T, q?: Q): Promise<T> {
    const run = q || (await this.q());
    await run(
      `INSERT INTO docs (collection, id, data) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [this.name, item.id, JSON.stringify(item)]
    );
    return item;
  }

  /** Shallow merge, done atomically in SQL. */
  async update(id: string, updates: Partial<T>, q?: Q): Promise<T> {
    const run = q || (await this.q());
    const r = await run(
      `UPDATE docs SET data = data || $3::jsonb, updated_at = now() WHERE collection = $1 AND id = $2 RETURNING data`,
      [this.name, id, JSON.stringify(updates)]
    );
    if (!r.rows[0]) throw new Error(`${this.name}/${id} not found`);
    return r.rows[0].data as T;
  }

  /** Atomic numeric increment of top-level fields. */
  async increment(id: string, deltas: Record<string, number>, q?: Q): Promise<T | null> {
    const run = q || (await this.q());
    let expr = 'data';
    const params: unknown[] = [this.name, id];
    for (const [field, delta] of Object.entries(deltas)) {
      if (!SAFE_PATH.test(field) || field.includes('.')) throw new Error(`Unsafe field ${field}`);
      params.push(delta);
      expr = `jsonb_set(${expr}, '{${field}}', to_jsonb(COALESCE((data->>'${field}')::numeric, 0) + $${params.length}))`;
    }
    const r = await run(
      `UPDATE docs SET data = ${expr}, updated_at = now() WHERE collection = $1 AND id = $2 RETURNING data`,
      params
    );
    return (r.rows[0]?.data as T) || null;
  }

  async delete(id: string, q?: Q): Promise<boolean> {
    const run = q || (await this.q());
    const r = await run(`DELETE FROM docs WHERE collection = $1 AND id = $2 RETURNING id`, [this.name, id]);
    return r.rows.length > 0;
  }

  /** Bulk insert, chunked, used by the seed. */
  async insertMany(items: T[], q?: Q, chunk = 500): Promise<void> {
    const run = q || (await this.q());
    for (let i = 0; i < items.length; i += chunk) {
      const slice = items.slice(i, i + chunk);
      await run(
        `INSERT INTO docs (collection, id, data)
         SELECT $1, x->>'id', x FROM jsonb_array_elements($2::jsonb) AS x
         ON CONFLICT (collection, id) DO NOTHING`,
        [this.name, JSON.stringify(slice)]
      );
    }
  }
}

export interface IssuedCodeDoc { id: string; code: string; couponId: string; qrId?: string; leadId?: string; status: 'unused' | 'claimed' | 'redeemed' | 'void'; redeemedAt?: string }

export class Store {
  constructor(public db: () => Promise<Db>) {}
  private c<T extends { id: string }>(name: string) {
    return new PgCollection<T>(name, this.db);
  }
  branches = this.c<Branch>('branches');
  staffUsers = this.c<StaffUser>('staffUsers');
  customers = this.c<Customer>('customers');
  menuItems = this.c<MenuItem>('menuItems');
  inventoryItems = this.c<InventoryItem>('inventoryItems');
  campaigns = this.c<Campaign>('campaigns');
  touchpoints = this.c<Touchpoint>('touchpoints');
  qrCodes = this.c<QrCode>('qrCodes');
  coupons = this.c<Coupon>('coupons');
  issuedCodes = this.c<IssuedCodeDoc>('issuedCodes');
  couponClaims = this.c<CouponClaim>('couponClaims');
  couponRedemptions = this.c<CouponRedemption>('couponRedemptions');
  leads = this.c<Lead>('leads');
  scanEvents = this.c<ScanEvent>('scanEvents');
  funnelEvents = this.c<FunnelEvent>('funnelEvents');
  orders = this.c<Order>('orders');
  statsDaily = this.c<StatsDaily>('statsDaily');
  distributionLogs = this.c<DistributionLog>('distributionLogs');
  costEntries = this.c<CostEntry>('costEntries');
  reservations = this.c<Reservation>('reservations');
  loyaltyAccounts = this.c<LoyaltyAccount>('loyaltyAccounts');
  loyaltyLedgers = this.c<LoyaltyLedgerEntry>('loyaltyLedgers');

  async tx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
    return (await this.db()).tx(fn);
  }
  async sql<R = any>(text: string, params?: unknown[]): Promise<R[]> {
    return (await (await this.db()).query<R>(text, params)).rows;
  }
}

let storePromise: Promise<Store> | null = null;

/** Opens the database, applies the schema and seeds demo data on first boot. */
export function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = (async () => {
      const db = await getDb();
      for (const stmt of SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean)) {
        await db.query(stmt);
      }
      await ensureDevSecrets(db);
      const store = new Store(getDb);
      const { ensureSeeded } = await import('./seed');
      await ensureSeeded(store);
      return store;
    })().catch((err) => {
      storePromise = null;
      throw err;
    });
  }
  return storePromise;
}

const GENERATED_SECRETS = ['SESSION_SECRET', 'QR_HMAC_SECRET', 'WEBHOOK_HMAC_SECRET', 'OTP_PEPPER'] as const;

/**
 * Zero-config boot (§0.1 item 1): any secret not provided as an environment variable is generated once,
 * stored server-side in system_meta and reused, so sessions and printed QR codes survive restarts and
 * serverless cold starts. Production refuses to boot without real secrets (see lib/env.ts).
 */
async function ensureDevSecrets(db: Db) {
  const missing = GENERATED_SECRETS.filter((k) => !process.env[k]);
  if (!missing.length) return;
  const crypto = await import('crypto');
  const fresh = Object.fromEntries(GENERATED_SECRETS.map((k) => [k, crypto.randomBytes(48).toString('base64url')]));
  await db.query(`INSERT INTO system_meta (key, value) VALUES ('dev_secrets', $1::jsonb) ON CONFLICT (key) DO NOTHING`, [JSON.stringify(fresh)]);
  const stored = (await db.query(`SELECT value FROM system_meta WHERE key = 'dev_secrets'`)).rows[0].value;
  for (const k of missing) process.env[k] = stored[k];
  const { resetEnvCache } = await import('../lib/env');
  resetEnvCache();
}
