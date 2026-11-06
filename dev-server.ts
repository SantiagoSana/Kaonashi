// KAONASHI LOCAL SERVER (npm run dev / npm start): the same API as the Vercel function, plus Vite (dev) or the built SPA (prod).
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createApp } from './src/server/app';
import { getStore } from './src/server/store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Open the database, load secrets and seed before building the app and accepting traffic.
  await getStore();
  const app = await createApp();
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log(`🏮 Kaonashi running on http://localhost:${port}`));

  // Development stand-in for the scheduled job (Vercel Cron calls /api/cron/tick in production).
  setInterval(() => {
    fetch(`http://localhost:${port}/api/cron/tick`, { method: 'POST', headers: process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {} }).catch(() => {});
  }, 60_000).unref();
}

main().catch((err) => {
  console.error('Fatal error starting Kaonashi:', err);
  process.exit(1);
});
