# Platform Adaptations (Kaonashi Phygital Platform)

As required by Master Build Prompt v7 (§0 Platform Adaptation Clause), this document records architectural adaptations made to run smoothly in Google AI Studio while strictly preserving all security, reliability, and functional guarantees.

## 1. Runtime Framework: Express + Vite + React 19 SPA
- **Original Prompt Target**: Next.js App Router with Node runtime.
- **AI Studio Environment**: Node.js container with Vite and Express (`server.ts`).
- **Adaptation**:
  - Full-stack Node architecture using Express (`server.ts`) mounting Vite middlewares during development, and serving the compiled app in production.
  - Server endpoints handle `/r/:code` (BTL QR resolver with HMAC verification & cookie issuance), `/api/stream/*` (real-time SSE for orders & KDS), `/api/track` (funnel event ingestion), `/api/cron/tick` (scheduled jobs), `/api/auth/*` (auth & cookie probe), and complete REST operations for data.
  - Client-side routing with `wouter` mirrors all §4 routes precisely (`/c/:slug`, `/r/:code`, `/menu`, `/checkout`, `/order/:id`, `/rewards`, `/account`, `/admin/*`, etc.).
  - Security invariant preserved: All pricing, coupon validation, inventory adjustments, QR signatures, role authorizations, and audit chains execute strictly server-side.

## 2. Password Hashing & Staff Authentication
- **Original Prompt Target**: Argon2id via `@node-rs/argon2` or Node `crypto.scrypt`.
- **Adaptation**: Implemented using Node's standard `crypto.scryptSync` with cryptographic salt and constant-time `crypto.timingSafeEqual` comparison, avoiding native binary compilation incompatibilities while guaranteeing OWASP A07 & A04 compliance.

## 3. Cookie Hardening in Preview Environment
- **Preview Constraints**: AI Studio preview runs inside an iframe on a different origin.
- **Adaptation**:
  - `lib/cookies.ts` evaluates `EMBEDDED_PREVIEW` and `APP_ENV`.
  - In non-production preview mode, session and tracking cookies use `SameSite=None; Secure; Partitioned`.
  - In production (`APP_ENV=production`), cookies use `SameSite=Strict` for sessions, `Lax` for attribution, and `__Host-` prefix.
  - `/api/auth/cookie-probe` detects third-party cookie blocking and renders a prominent "Open in a new tab" banner if needed.

## 4. Data backend: Postgres instead of Firestore
- **Prompt target:** Firestore + in-memory DataStore.
- **Adaptation (Nov 2026):** the app is deployed on Vercel, where an in-memory store loses data between invocations. All data now lives in **Postgres**: Neon (`DATABASE_URL`) in production, PGlite (Postgres compiled to WASM, in-process) for local development and tests, so the same SQL runs everywhere.
- Entities are JSONB documents in `docs(collection, id, data)` with expression indexes on queried fields; sessions, rate limits, one-time-code challenges and the audit chain have their own tables (`src/server/db.ts`).
- Analytics are SQL aggregations over raw records (`src/server/analytics.ts`), not client-side arrays.
- Transactions with `SELECT … FOR UPDATE` protect coupon caps, stock and order numbering.

## 5. Hosting: Vercel Build Output API
- `scripts/build-vercel.mjs` builds the Vite SPA into `.vercel/output/static` and bundles the Express API with esbuild into one Node 22 function (`.vercel/output/functions/__kns.func`). `/api/*` and `/r/*` route to it; everything else falls back to the SPA.
- Realtime: SSE endpoints poll Postgres every 1.5 s and close after ~50 s; browsers reconnect with `Last-Event-ID`. This works across serverless instances.
- Vercel Cron calls `/api/cron/tick` daily with `Authorization: Bearer $CRON_SECRET`.

## 6. Customer Google sign-in
- **Prompt target:** Firebase Authentication.
- **Adaptation:** Google Identity Services directly (`GOOGLE_CLIENT_ID`); the ID token is verified server-side against Google's JWKS (issuer, audience, `email_verified`). No Firebase project is needed. Without a client id, demo mode offers a clearly labelled simulated chooser.

## 7. One-time-code e-mail
- Resend (`RESEND_API_KEY`) as the `EmailProvider`; without it the code is shown in a "SIMULATED MAILBOX" panel on `/account/verify`.
