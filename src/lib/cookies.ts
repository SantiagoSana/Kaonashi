// KAONASHI COOKIE SECURITY HELPER (§10.2)
import { getEnv } from './env';

export type CookieKind =
  | 'session'
  | 'attr'
  | 'sid'
  | 'wallet'
  | 'locale'
  | 'currency'
  | 'romaji'
  | 'challenge'
  | 'pre_mfa';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge?: number; // in milliseconds
  partitioned?: boolean;
}

export function getCookieName(kind: CookieKind): string {
  const env = getEnv();
  const isProd = env.APP_ENV === 'production' || Boolean(process.env.VERCEL);
  const prefix = isProd ? '__Host-' : '';

  switch (kind) {
    case 'session':
      return `${prefix}kns_session`;
    case 'challenge':
      return `${prefix}kns_challenge`;
    case 'pre_mfa':
      return `${prefix}kns_pre_mfa`;
    case 'attr':
      return 'kns_attr';
    case 'sid':
      return 'kns_sid';
    case 'wallet':
      return 'kns_wallet';
    case 'locale':
      return 'kns_locale';
    case 'currency':
      return 'kns_currency';
    case 'romaji':
      return 'kns_romaji';
  }
}

export function cookieOptions(kind: CookieKind): CookieOptions {
  const env = getEnv();
  const isProd = env.APP_ENV === 'production';
  const onVercel = Boolean(process.env.VERCEL);
  const isEmbedded = env.EMBEDDED_PREVIEW === true || (env.EMBEDDED_PREVIEW === 'auto' && !isProd && !onVercel);

  // Default max ages
  let maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (kind === 'sid') {
    maxAgeMs = 30 * 60 * 1000; // 30 mins
  } else if (kind === 'challenge' || kind === 'pre_mfa') {
    maxAgeMs = 10 * 60 * 1000; // 10 mins
  } else if (kind === 'locale' || kind === 'currency' || kind === 'romaji') {
    maxAgeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
  }

  const isHttpOnly = ['session', 'challenge', 'pre_mfa'].includes(kind);

  if (isEmbedded) {
    // Inside AI Studio Preview iframe across origins: SameSite=None, Secure, Partitioned
    return {
      httpOnly: isHttpOnly,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: maxAgeMs,
      partitioned: true,
    };
  }

  if (isProd || onVercel) {
    return {
      httpOnly: isHttpOnly,
      secure: true,
      // Lax keeps the session when guests arrive from a camera app or an e-mail link.
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  // Local development without SSL
  return {
    httpOnly: isHttpOnly,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}
