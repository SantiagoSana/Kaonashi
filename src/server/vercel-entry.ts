// Vercel function entry (bundled by scripts/build-vercel.mjs into .vercel/output/functions/__kns.func).
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app';
import { getStore } from './store';

let appPromise: Promise<any> | null = null;
const getApp = () =>
  (appPromise ||= (async () => {
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      console.warn('[kaonashi] DATABASE_URL is not set: connect Neon (Vercel → Storage) so data is persisted.');
    }
    await getStore(); // schema, secrets and seed before the first request is handled
    return createApp();
  })().catch((err) => {
    appPromise = null;
    throw err;
  }));

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Routes rewrite /api/* and /r/* to this function as /__kns?__p=<original path>; restore the original URL.
  const url = new URL(req.url || '/', 'http://local');
  const original = url.searchParams.get('__p');
  if (url.pathname === '/__kns' && original) {
    url.searchParams.delete('__p');
    const qs = url.searchParams.toString();
    req.url = original + (qs ? `?${qs}` : '');
  }
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('[kaonashi] boot failed', err);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'SERVICE_STARTING', detail: 'Database unavailable. Check DATABASE_URL.' }));
  }
}
