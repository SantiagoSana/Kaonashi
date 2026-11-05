import { z } from 'zod';

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  DEMO_MODE: z.preprocess((val) => {
    if (typeof val === 'string') return val === 'true' || val === '1';
    if (typeof val === 'boolean') return val;
    return process.env.APP_ENV !== 'production';
  }, z.boolean()).default(true),
  DATA_BACKEND: z.enum(['auto', 'firestore', 'memory']).default('auto'),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  SESSION_SECRET: z.string().default('kaonashi_dev_session_secret_at_least_64_bytes_long_for_hs256_security_token_signing_key_321'),
  QR_HMAC_SECRET: z.string().default('kaonashi_dev_qr_hmac_secret_key_32_bytes_random_salt_v1'),
  WEBHOOK_HMAC_SECRET: z.string().default('kaonashi_dev_webhook_hmac_secret_key_12345'),
  OTP_PEPPER: z.string().default('kaonashi_dev_otp_pepper_salt_98765'),
  CRON_SECRET: z.string().default('kaonashi_dev_cron_secret_tick_key'),
  EMBEDDED_PREVIEW: z.preprocess((val) => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return 'auto';
  }, z.union([z.boolean(), z.literal('auto')])).default('auto'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn('⚠️ Environment variable parsing issues, falling back to defaults:', parsed.error.format());
    cachedEnv = envSchema.parse({});
  } else {
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}
