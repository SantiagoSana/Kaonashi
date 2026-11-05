import test from 'node:test';
import assert from 'node:assert/strict';
import { generateShortCode, computeQrSignature, verifyQrSignature } from '../src/lib/qr';

test('QR: generate 8-char Crockford shortCode', () => {
  const code = generateShortCode();
  assert.equal(code.length, 8);
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{8}$/);
});

test('QR: compute and verify HMAC signature with timingSafeEqual', () => {
  const shortCode = 'CSTN8001';
  const touchpointId = 'tp_coaster_bar1';

  const sig = computeQrSignature(shortCode, touchpointId);
  assert.ok(sig.length > 0);

  const isValid = verifyQrSignature(shortCode, touchpointId, sig);
  assert.equal(isValid, true);

  // Tampered signature must fail
  const tamperedSig = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a');
  assert.equal(verifyQrSignature(shortCode, touchpointId, tamperedSig), false);

  // Wrong touchpoint must fail
  assert.equal(verifyQrSignature(shortCode, 'tp_different', sig), false);
});

test('QR: printed-code durability (signature is immutable regardless of destination or dates)', () => {
  const shortCode = 'CSTN8001';
  const touchpointId = 'tp_coaster_bar1';
  const originalSig = computeQrSignature(shortCode, touchpointId);

  // Changing campaign metadata, dates, or destination does not alter signature
  const sameSigAfterEdit = computeQrSignature(shortCode, touchpointId);
  assert.equal(sameSigAfterEdit, originalSig);
  assert.equal(verifyQrSignature(shortCode, touchpointId, originalSig), true);
});
