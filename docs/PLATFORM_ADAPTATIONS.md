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

## 4. Multi-backend DataStore
- Implemented `DataStore` interface with:
  1. `MemoryDataStore`: Complete transactional in-memory store with counters, compound filtering, and pub/sub for SSE.
  2. `FirestoreDataStore`: Cloud Firestore server-side repository driver.
- Configured via `DATA_BACKEND=auto|firestore|memory` (defaults to auto fallback to memory in zero-config dev).
