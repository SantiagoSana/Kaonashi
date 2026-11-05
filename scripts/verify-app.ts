// KAONASHI MULTI-LOCALE & ROUTE VERIFIER (§16 criterion 14)
import assert from 'node:assert/strict';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

async function runVerifyApp() {
  console.log('🌐 Starting KAONASHI App Multi-Locale & Currency Verification against', BASE_URL);

  const locales = ['es', 'en', 'ja'];
  const currencies = ['COP', 'USD', 'EUR', 'JPY'];
  const routes = ['/', '/menu', '/checkout', '/rewards', '/reservations', '/c/coasters'];

  for (const locale of locales) {
    for (const currency of currencies) {
      for (const route of routes) {
        const url = `${BASE_URL}${route}`;
        const res = await fetch(url, {
          headers: {
            Cookie: `kns_locale=${locale}; kns_currency=${currency}`,
          },
        });

        assert.equal(res.status, 200, `Route ${route} with locale=${locale} currency=${currency} must return 200, got ${res.status}`);
        const text = await res.text();

        // Must not contain untranslated markers
        assert.ok(!text.includes('⟦'), `Found untranslated key marker ⟦ in ${route}`);
        assert.ok(!text.includes('NaN'), `Found NaN artifact in ${route}`);
        assert.ok(!text.includes('undefined'), `Found undefined artifact in ${route}`);
      }
    }
    console.log(`   ✓ Locale ${locale} verified across all routes and currencies with 0 missing keys`);
  }

  // Verify staff login in demo mode
  console.log('🔑 Verifying DEMO_MODE staff login...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'kaonashi_sysmaster',
      password: 'KaonashiMaster2026!',
    }),
  });
  assert.equal(loginRes.status, 200, 'Demo staff login must succeed');
  const loginData = await loginRes.json();
  assert.equal(loginData.session.role, 'sysmaster');
  console.log('   ✓ Sysmaster staff login verified');

  console.log('🎉 APP ROUTE, LOCALE AND CURRENCY VERIFICATION PASSED!');
}

runVerifyApp().catch((err) => {
  console.error('❌ App Verification failed:', err);
  process.exit(1);
});
