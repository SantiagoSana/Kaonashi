// KAONASHI DATABASE DRIVER
// Production / Vercel: Neon serverless Postgres (DATABASE_URL).
// Local development and tests: PGlite, a real Postgres compiled to WASM that runs in-process,
// so the exact same SQL runs everywhere with zero configuration.
import { getEnv } from '../lib/env';

export interface QueryResult<R = any> {
  rows: R[];
}

export interface Db {
  kind: 'neon' | 'pglite';
  query<R = any>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
  /** Runs fn inside a single transaction. Throwing rolls back. */
  tx<T>(fn: (q: Db['query']) => Promise<T>): Promise<T>;
  /** True when data is not persisted (PGlite in memory on a serverless host). */
  ephemeral: boolean;
}

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = createDb().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function createDb(): Promise<Db> {
  const env = getEnv();
  const url = env.DATABASE_URL;

  if (url) {
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    // Node < 22 has no global WebSocket; the ws package fills the gap.
    if (typeof (globalThis as any).WebSocket === 'undefined') {
      const ws = (await import('ws')).default;
      neonConfig.webSocketConstructor = ws as any;
    }
    const pool = new Pool({ connectionString: url, max: 5 });
    const db: Db = {
      kind: 'neon',
      ephemeral: false,
      async query(text, params = []) {
        const r = await pool.query(text, params as any[]);
        return { rows: r.rows };
      },
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(async (text, params = []) => {
            const r = await client.query(text, params as any[]);
            return { rows: r.rows };
          });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
    };
    return db;
  }

  // PGlite fallback. Persist to disk locally; in-memory on serverless hosts.
  const { PGlite } = await import('@electric-sql/pglite');
  const onServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dataDir = env.PGLITE_DIR === 'memory' || onServerless ? undefined : env.PGLITE_DIR;
  if (dataDir) (await import('fs')).mkdirSync(dataDir, { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;

  // PGlite is single-connection: serialize transactions so they never interleave.
  let chain: Promise<unknown> = Promise.resolve();
  const runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => {});
    return next;
  };

  const rawQuery = async (text: string, params: unknown[] = []) => {
    const r = await pg.query(text, params as any[]);
    return { rows: r.rows as any[] };
  };

  return {
    kind: 'pglite',
    ephemeral: !dataDir,
    query: (text, params) => runExclusive(() => rawQuery(text, params)),
    tx: (fn) =>
      runExclusive(async () => {
        await pg.query('BEGIN');
        try {
          const result = await fn(rawQuery);
          await pg.query('COMMIT');
          return result;
        } catch (err) {
          await pg.query('ROLLBACK').catch(() => {});
          throw err;
        }
      }),
  };
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS docs (
  collection text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS docs_orders_created ON docs (((data->>'createdAt'))) WHERE collection = 'orders';
CREATE INDEX IF NOT EXISTS docs_orders_status ON docs (((data->>'status'))) WHERE collection = 'orders';
CREATE INDEX IF NOT EXISTS docs_orders_email ON docs (((data->'guestInfo'->>'email'))) WHERE collection = 'orders';
CREATE INDEX IF NOT EXISTS docs_orders_customer ON docs (((data->>'customerId'))) WHERE collection = 'orders';
CREATE INDEX IF NOT EXISTS docs_scans_ts ON docs (((data->>'timestamp'))) WHERE collection = 'scanEvents';
CREATE INDEX IF NOT EXISTS docs_scans_qr ON docs (((data->>'qrId'))) WHERE collection = 'scanEvents';
CREATE INDEX IF NOT EXISTS docs_funnel_ts ON docs (((data->>'timestamp'))) WHERE collection = 'funnelEvents';
CREATE UNIQUE INDEX IF NOT EXISTS docs_funnel_event_id ON docs (((data->>'eventId'))) WHERE collection = 'funnelEvents';
CREATE UNIQUE INDEX IF NOT EXISTS docs_customer_email ON docs (((data->>'emailNormalized'))) WHERE collection = 'customers';
CREATE UNIQUE INDEX IF NOT EXISTS docs_coupon_code ON docs (((data->>'code'))) WHERE collection = 'coupons';
CREATE UNIQUE INDEX IF NOT EXISTS docs_qr_code ON docs (((data->>'shortCode'))) WHERE collection = 'qrCodes';
CREATE UNIQUE INDEX IF NOT EXISTS docs_staff_username ON docs (((data->>'username'))) WHERE collection = 'staffUsers';

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  kind text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL,
  locked_until timestamptz,
  lockouts integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS login_challenges (
  id text PRIMARY KEY,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts_left integer NOT NULL,
  resends_left integer NOT NULL,
  last_sent_at timestamptz NOT NULL,
  simulated_code text
);

CREATE TABLE IF NOT EXISTS audit_log (
  seq bigint PRIMARY KEY,
  ts timestamptz NOT NULL,
  actor text NOT NULL,
  role text NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  outcome text NOT NULL,
  ip_hash text NOT NULL,
  details jsonb,
  before jsonb,
  after jsonb,
  prev_hash text NOT NULL,
  hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS system_meta (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
`;
