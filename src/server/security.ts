// KAONASHI SERVER SECURITY: sessions, rate limiting, audit chain, OTP, Google ID tokens, e-mail.
// Everything is persisted in Postgres so it works across serverless instances.
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { getEnv } from '../lib/env';
import { cookieOptions, getCookieName, CookieKind } from '../lib/cookies';
import { ROLE_PERMISSIONS, Permission } from '../lib/security/authorize';
import type { StaffRole } from '../lib/types';
import type { Store } from './store';

const enc = (s: string) => new TextEncoder().encode(s);

export function ipHashOf(req: Request): string {
  // On Vercel the platform sets x-vercel-forwarded-for / x-real-ip and clients cannot spoof them.
  const fwd = ((req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for']) as string | undefined)?.split(',')[0]?.trim();
  const ip = fwd || req.ip || req.socket.remoteAddress || '0.0.0.0';
  const day = new Date().toISOString().slice(0, 10); // salt rotates daily
  return crypto.createHmac('sha256', getEnv().SESSION_SECRET).update(`${day}|${ip}`).digest('hex').slice(0, 16);
}

export function setCookie(res: Response, kind: CookieKind, value: string, maxAgeMs?: number) {
  const o = cookieOptions(kind);
  res.cookie(getCookieName(kind), value, {
    httpOnly: o.httpOnly, secure: o.secure, sameSite: o.sameSite, path: o.path,
    maxAge: maxAgeMs ?? o.maxAge, ...(o.partitioned ? { partitioned: true } : {}),
  } as any);
}

export function clearCookie(res: Response, kind: CookieKind) {
  const o = cookieOptions(kind);
  res.clearCookie(getCookieName(kind), { path: '/', secure: o.secure, sameSite: o.sameSite, httpOnly: o.httpOnly, ...(o.partitioned ? { partitioned: true } : {}) } as any);
}

// ------------------------------------------------------------------ Sessions
export interface AuthCtx {
  sessionId: string;
  kind: 'staff' | 'customer';
  userId: string;
  role: StaffRole;
  branchIds: string[];
  name: string;
  email?: string;
  permissions: Permission[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthCtx | null;
    }
  }
}

const STAFF_IDLE_MIN = 30;
const STAFF_ABS_HOURS = 8;
const CUSTOMER_DAYS = 30;

/** Signs in: revokes whatever session this browser had and issues a new one (§10.1b). */
export async function startSession(store: Store, req: Request, res: Response, kind: 'staff' | 'customer', userId: string, role: StaffRole) {
  const env = getEnv();
  const old = await readSessionToken(req);
  if (old) await store.sql(`UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [old]);
  const id = crypto.randomBytes(24).toString('base64url');
  const ttlMs = kind === 'staff' ? STAFF_ABS_HOURS * 3600000 : CUSTOMER_DAYS * 86400000;
  await store.sql(`INSERT INTO sessions (id, kind, user_id, role, expires_at) VALUES ($1, $2, $3, $4, $5)`, [id, kind, userId, role, new Date(Date.now() + ttlMs).toISOString()]);
  const jwt = await new SignJWT({ sid: id, k: kind }).setProtectedHeader({ alg: 'HS256', kid: 'k1' }).setIssuedAt().setExpirationTime(Math.floor((Date.now() + ttlMs) / 1000)).sign(enc(env.SESSION_SECRET));
  setCookie(res, 'session', jwt, ttlMs);
  return id;
}

async function readSessionToken(req: Request): Promise<string | null> {
  const token = req.cookies?.[getCookieName('session')];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, enc(getEnv().SESSION_SECRET));
    return typeof payload.sid === 'string' ? payload.sid : null;
  } catch {
    return null;
  }
}

export async function endSession(store: Store, req: Request, res: Response) {
  const sid = await readSessionToken(req);
  if (sid) await store.sql(`UPDATE sessions SET revoked_at = now() WHERE id = $1`, [sid]);
  clearCookie(res, 'session');
  clearCookie(res, 'challenge');
  clearCookie(res, 'pre_mfa');
}

export async function revokeAllSessions(store: Store, userId: string) {
  await store.sql(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}

/** Middleware: attaches req.auth (or null). Never throws. */
export function loadSession(getStore: () => Promise<Store>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.auth = null;
    try {
      const sid = await readSessionToken(req);
      if (!sid) return next();
      const store = await getStore();
      const rows = await store.sql(
        `SELECT id, kind, user_id, role, last_seen_at, expires_at, revoked_at FROM sessions WHERE id = $1`,
        [sid]
      );
      const s = rows[0];
      if (!s || s.revoked_at || new Date(s.expires_at) < new Date()) return next();
      if (s.kind === 'staff' && Date.now() - new Date(s.last_seen_at).getTime() > STAFF_IDLE_MIN * 60000) {
        await store.sql(`UPDATE sessions SET revoked_at = now() WHERE id = $1`, [sid]);
        return next();
      }
      if (Date.now() - new Date(s.last_seen_at).getTime() > 60000) {
        await store.sql(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [sid]);
      }
      if (s.kind === 'staff') {
        const u = await store.staffUsers.get(s.user_id);
        if (!u || (u as any).disabled) return next();
        req.auth = { sessionId: sid, kind: 'staff', userId: u.id, role: u.role, branchIds: u.branchIds || [], name: u.name, email: u.email, permissions: ROLE_PERMISSIONS[u.role] || [] };
      } else {
        const c = await store.customers.get(s.user_id);
        if (!c) return next();
        req.auth = { sessionId: sid, kind: 'customer', userId: c.id, role: 'customer', branchIds: [], name: c.name, email: c.emailNormalized, permissions: [] };
      }
    } catch (err) {
      console.error('[session]', err);
    }
    next();
  };
}

/** Route guard. The single server-side choke point for staff permissions (§9.6). */
export function requirePerm(getStore: () => Promise<Store>, ...perms: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const a = req.auth;
    if (!a || a.kind !== 'staff') {
      return res.status(401).json({ error: 'SESSION_REQUIRED' });
    }
    if (perms.length && !perms.some((p) => a.permissions.includes(p))) {
      const store = await getStore();
      await audit(store, { actor: a.userId, role: a.role, action: 'access.denied', resource: `${req.method} ${req.path}`, outcome: 'denied', ipHash: ipHashOf(req), details: { required: perms } });
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.kind !== 'customer') return res.status(401).json({ error: 'SESSION_REQUIRED' });
  next();
}

// ------------------------------------------------------------------ Rate limiting (fixed window + exponential lockout)
export interface RateResult { allowed: boolean; retryAfterSeconds: number; remaining: number }

export async function rateLimit(store: Store, key: string, max: number, windowMs: number, opts: { lockout?: boolean; consume?: boolean } = {}): Promise<RateResult> {
  const consume = opts.consume !== false;
  const rows = await store.sql(`SELECT window_start, count, locked_until, lockouts FROM rate_limits WHERE key = $1`, [key]);
  const r = rows[0];
  const now = Date.now();
  if (r?.locked_until && new Date(r.locked_until).getTime() > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((new Date(r.locked_until).getTime() - now) / 1000), remaining: 0 };
  }
  const inWindow = r && now - new Date(r.window_start).getTime() < windowMs;
  const current = inWindow ? r.count : 0;
  if (current >= max) {
    if (opts.lockout) {
      const lockouts = (r?.lockouts || 0) + 1;
      const lockMs = [15 * 60000, 3600000, 86400000][Math.min(lockouts - 1, 2)];
      await store.sql(`UPDATE rate_limits SET locked_until = $2, lockouts = $3, count = 0, window_start = now() WHERE key = $1`, [key, new Date(now + lockMs).toISOString(), lockouts]);
      return { allowed: false, retryAfterSeconds: Math.ceil(lockMs / 1000), remaining: 0 };
    }
    const retry = Math.ceil((new Date(r.window_start).getTime() + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retry), remaining: 0 };
  }
  if (consume) {
    await store.sql(
      `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < now() - ($2 || ' milliseconds')::interval THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < now() - ($2 || ' milliseconds')::interval THEN now() ELSE rate_limits.window_start END`,
      [key, String(windowMs)]
    );
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: max - current - (consume ? 1 : 0) };
}

export async function clearRate(store: Store, key: string) {
  await store.sql(`DELETE FROM rate_limits WHERE key = $1`, [key]);
}

export function tooMany(res: Response, r: RateResult) {
  res.setHeader('Retry-After', String(r.retryAfterSeconds));
  return res.status(429).json({ error: 'RATE_LIMITED', retryAfterSeconds: r.retryAfterSeconds });
}

// ------------------------------------------------------------------ Audit log (append-only, hash-chained)
function canonical(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  return '{' + Object.keys(obj as any).sort().map((k) => JSON.stringify(k) + ':' + canonical((obj as any)[k])).join(',') + '}';
}

export interface AuditInput { actor: string; role: string; action: string; resource: string; outcome: 'success' | 'failure' | 'denied'; ipHash?: string; details?: unknown; before?: unknown; after?: unknown }

function hashEntry(prevHash: string, e: { seq: number; ts: string; actor: string; role: string; action: string; resource: string; outcome: string; ipHash: string; details: unknown; before: unknown; after: unknown }) {
  return crypto.createHash('sha256').update(prevHash + canonical(e)).digest('hex');
}

const NEVER_LOG = /pass(word)?|token|otp|code$|secret/i;
function scrub(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v ?? null;
  if (Array.isArray(v)) return v.map(scrub);
  return Object.fromEntries(Object.entries(v as any).map(([k, x]) => [k, NEVER_LOG.test(k) ? '[redacted]' : scrub(x)]));
}

export async function audit(store: Store, input: AuditInput) {
  try {
    await store.tx(async (q) => {
      await q(`SELECT pg_advisory_xact_lock(7777)`);
      const last = (await q(`SELECT seq, hash FROM audit_log ORDER BY seq DESC LIMIT 1`)).rows[0];
      const seq = Number(last?.seq || 0) + 1;
      const prevHash = last?.hash || '0'.repeat(64);
      const e = {
        seq, ts: new Date().toISOString(), actor: input.actor, role: input.role, action: input.action, resource: input.resource,
        outcome: input.outcome, ipHash: input.ipHash || '00000000', details: scrub(input.details), before: scrub(input.before), after: scrub(input.after),
      };
      const hash = hashEntry(prevHash, e);
      await q(
        `INSERT INTO audit_log (seq, ts, actor, role, action, resource, outcome, ip_hash, details, before, after, prev_hash, hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13)`,
        [seq, e.ts, e.actor, e.role, e.action, e.resource, e.outcome, e.ipHash, JSON.stringify(e.details), JSON.stringify(e.before), JSON.stringify(e.after), prevHash, hash]
      );
    });
  } catch (err) {
    console.error('[audit] failed to write entry', err);
  }
}

export async function verifyAuditChain(store: Store): Promise<{ ok: boolean; total: number; brokenAtSeq?: number }> {
  const rows = await store.sql(`SELECT * FROM audit_log ORDER BY seq ASC`);
  let prev = '0'.repeat(64);
  for (const r of rows) {
    const e = {
      seq: Number(r.seq), ts: new Date(r.ts).toISOString(), actor: r.actor, role: r.role, action: r.action, resource: r.resource,
      outcome: r.outcome, ipHash: r.ip_hash, details: r.details, before: r.before, after: r.after,
    };
    if (r.prev_hash !== prev || hashEntry(prev, e) !== r.hash) return { ok: false, total: rows.length, brokenAtSeq: e.seq };
    prev = r.hash;
  }
  return { ok: true, total: rows.length };
}

// ------------------------------------------------------------------ E-mail one-time codes
export function hashOtp(code: string) {
  return crypto.createHmac('sha256', getEnv().OTP_PEPPER).update(code).digest('hex');
}

export function emailIsSimulated() {
  return !getEnv().RESEND_API_KEY;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
      signal: ctrl.signal,
    });
    if (!r.ok) console.error('[email] resend responded', r.status, await r.text().catch(() => ''));
    return r.ok;
  } catch (err) {
    console.error('[email] send failed', err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------ Google ID tokens (Google Identity Services)
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleIdToken(idToken: string): Promise<{ sub: string; email: string; name?: string; picture?: string; locale?: string }> {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_NOT_CONFIGURED');
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.GOOGLE_CLIENT_ID,
  });
  if (payload.email_verified !== true || typeof payload.email !== 'string') throw new Error('EMAIL_NOT_VERIFIED');
  return { sub: String(payload.sub), email: payload.email.toLowerCase(), name: payload.name as string, picture: payload.picture as string, locale: payload.locale as string };
}

// ------------------------------------------------------------------ Small helpers
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.normalize('NFKC').trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/.test(e) ? e : null;
}

export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let d = raw.replace(/[^\d+]/g, '');
  if (!d.startsWith('+')) d = d.length === 10 ? `+57${d}` : `+${d}`;
  return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
}

/** Only internal paths, single leading slash, no scheme. */
export function safeReturnTo(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /^\/[a-z]+:/i.test(raw)) return fallback;
  return raw.slice(0, 200);
}
