// Builds a Vercel Build Output API v3 bundle in .vercel/output:
//   static/            → the Vite SPA (served from the CDN)
//   functions/__kns.func → one Node function with the whole API, bundled by esbuild (no runtime TS resolution)
//   config.json        → routes (/api/* and /r/* → function, everything else → SPA) and the daily cron
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, '.vercel/output');
fs.rmSync(out, { recursive: true, force: true });

console.log('› vite build');
execSync('npx vite build', { cwd: root, stdio: 'inherit' });
fs.cpSync(path.join(root, 'dist'), path.join(out, 'static'), { recursive: true });

console.log('› bundling API function');
const fnDir = path.join(out, 'functions/__kns.func');
await build({
  entryPoints: [path.join(root, 'src/server/vercel-entry.ts')],
  outfile: path.join(fnDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  minify: false,
  // PGlite is only a local-development fallback; on Vercel the app talks to Neon.
  external: ['@electric-sql/pglite', 'vite', 'bufferutil', 'utf-8-validate'],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
});
fs.writeFileSync(path.join(fnDir, 'package.json'), JSON.stringify({ type: 'module' }));
fs.writeFileSync(
  path.join(fnDir, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, supportsResponseStreaming: true, maxDuration: 300 }, null, 2)
);

fs.writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/(api/.*|r/.*)$', dest: '/__kns?__p=/$1' },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
      crons: [{ path: '/api/cron/tick', schedule: '17 11 * * *' }],
    },
    null,
    2
  )
);
const size = fs.statSync(path.join(fnDir, 'index.mjs')).size;
console.log(`✓ .vercel/output ready (function ${(size / 1024 / 1024).toFixed(1)} MB)`);
