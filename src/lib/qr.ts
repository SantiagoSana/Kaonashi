// KAONASHI QR SECURITY & SIGNATURE ENGINE (§5.2)
import crypto from 'crypto';
import { getEnv } from './env';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generate 8-character Crockford base32 shortCode
 */
export function generateShortCode(): string {
  const bytes = crypto.randomBytes(5);
  let n = 0;
  for (let i = 0; i < 5; i++) {
    n = (n << 8) | bytes[i];
  }
  let res = '';
  for (let i = 0; i < 8; i++) {
    res = CROCKFORD_ALPHABET[n & 31] + res;
    n = n >> 5;
  }
  return res;
}

/**
 * Compute 12-byte base64url HMAC signature over "v1|shortCode|touchpointId"
 */
export function computeQrSignature(shortCode: string, touchpointId: string, version: 'v1' | 'v2' = 'v1'): string {
  const secret = getEnv().QR_HMAC_SECRET;
  const payload = `${version}|${shortCode}|${touchpointId}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest();
  // Take first 12 bytes and encode as base64url
  return digest.subarray(0, 12).toString('base64url');
}

/**
 * Verify QR signature with timing-safe comparison.
 */
export function verifyQrSignature(shortCode: string, touchpointId: string, signature: string): boolean {
  if (!signature || typeof signature !== 'string') return false;

  const expectedV1 = computeQrSignature(shortCode, touchpointId, 'v1');
  const expectedV2 = computeQrSignature(shortCode, touchpointId, 'v2');

  const sigBuf = Buffer.from(signature);
  const v1Buf = Buffer.from(expectedV1);
  const v2Buf = Buffer.from(expectedV2);

  if (sigBuf.length === v1Buf.length && crypto.timingSafeEqual(sigBuf, v1Buf)) {
    return true;
  }
  if (sigBuf.length === v2Buf.length && crypto.timingSafeEqual(sigBuf, v2Buf)) {
    return true;
  }

  return false;
}
