# Kaonashi Setup in Google AI Studio

This guide explains how to run, configure, and deploy the Kaonashi Phygital Platform in Google AI Studio Build mode.

---

## 1. Zero-Config Boot
By default in `APP_ENV=development` with `DEMO_MODE=true`, **the app requires ZERO secrets to start**:
- Cryptographic salts and JWT keys are automatically initialized with secure defaults.
- Seed data runs automatically on boot with 36 authentic Japanese dishes, 4 BTL campaigns, QR codes, active orders, and inventory lots.
- Staff demo logins are pre-configured:
  - **Sysmaster**: `kaonashi_sysmaster` / `KaonashiMaster2026!`
  - **Itamae (Kitchen)**: `itamae_lead` / `ItamaeKitchen2026!`
  - **Marketing**: `marketing_lead` / `BtlMarketing2026!`
  - **Reception / Caja**: `reception_lead` / `HostReception2026!`

---

## 2. Optional Environment Variables & Secrets
Add secrets in AI Studio Environment Variables when integrating live services:
- `GEMINI_API_KEY`: Enables live AI Concierge and Admin Executive Briefs.
- `STRIPE_SECRET_KEY` & `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Enables live Stripe checkout.
- `NEXT_PUBLIC_FIREBASE_*`: Enables live Google OAuth sign-in.
- `APP_BASE_URL`: Public domain where printed QR codes point.
- `CRON_SECRET`: Bearer token protecting `/api/cron/tick`.

---

## 3. Handling Preview Cookies (iFrame)
When previewing inside an iframe on a different origin:
- Cookies are served with `SameSite=None; Secure; Partitioned`.
- If your browser blocks third-party cookies, the top alert banner will appear with an **"Abrir en nueva pestaña"** link to run in a standalone browser window.

---

## 4. Deploying to Cloud Run or Production
1. Set `APP_ENV=production` and `DEMO_MODE=false`.
2. Provide a persistent `SESSION_SECRET` (at least 64 bytes) and `QR_HMAC_SECRET`.
3. Build the container with `npm run build` and run `npm start` on port 3000.
4. Schedule `/api/cron/tick` every minute using Google Cloud Scheduler with `Authorization: Bearer <CRON_SECRET>`.
