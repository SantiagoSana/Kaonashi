// KAONASHI SECURITY SMOKE TEST (§17, OWASP 2025)
import assert from 'node:assert/strict';
import { verifyQrSignature, computeQrSignature } from '../src/lib/qr';
import { authorize } from '../src/lib/security/authorize';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

async function runSecuritySmokeTests() {
  console.log('🛡️ Starting KAONASHI Security Smoke Tests (OWASP Top 10)');

  // 1. Default accounts rejection (admin, root, administrator)
  console.log('1️⃣ Checking rejection of default accounts (admin, root, administrator)...');
  for (const user of ['admin', 'root', 'administrator']) {
    const res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: 'password123' }),
    });
    assert.equal(res.status, 401, `Default user ${user} must be rejected with 401`);
  }
  console.log('   ✓ Default accounts rejected without enumeration');

  // 2. RBAC check via authorize() choke point
  console.log('2️⃣ Checking RBAC authorization matrix...');
  const receptionCtx = { userId: 'u_rec', role: 'reception' as const };
  const authPriceEdit = authorize(receptionCtx, 'menu:edit_price');
  assert.equal(authPriceEdit.authorized, false, 'Reception must be denied menu:edit_price');

  const sysmasterCtx = { userId: 'u_sys', role: 'sysmaster' as const };
  const authSysmaster = authorize(sysmasterCtx, 'menu:edit_price');
  assert.equal(authSysmaster.authorized, true, 'Sysmaster must be allowed menu:edit_price');
  console.log('   ✓ RBAC matrix verified: reception denied price edit, sysmaster authorized');

  // 3. QR Tampering & Signature Verification
  console.log('3️⃣ Checking QR tampering rejection...');
  const shortCode = 'CSTN8001';
  const touchpoint = 'tp_coaster_bar1';
  const validSig = computeQrSignature(shortCode, touchpoint);
  assert.equal(verifyQrSignature(shortCode, touchpoint, validSig), true);
  assert.equal(verifyQrSignature(shortCode, touchpoint, 'invalid_fake_signature'), false);

  const tamperedRes = await fetch(`${BASE_URL}/r/${shortCode}?s=tampered_sig_123`, {
    redirect: 'manual',
  });
  assert.equal(tamperedRes.status, 404, 'Tampered QR scan must return 404 with audit entry');
  console.log('   ✓ Tampered QR scan rejected with HTTP 404');

  console.log('🎉 ALL SECURITY SMOKE TESTS PASSED!');
}

runSecuritySmokeTests().catch((err) => {
  console.error('❌ Security Smoke Test failed:', err);
  process.exit(1);
});
