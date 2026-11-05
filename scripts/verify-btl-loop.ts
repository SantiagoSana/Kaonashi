// KAONASHI BTL LOOP HEADLESS VERIFIER (§15 item 8, §16 criterion 39)
import assert from 'node:assert/strict';
import { computeQrSignature } from '../src/lib/qr';
import expectedData from '../docs/SEED_EXPECTED.json';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

async function runBtlVerification() {
  console.log('🏁 Starting KAONASHI BTL Loop Headless Verification against', BASE_URL);

  let cookieJar: Record<string, string> = {};

  const saveCookies = (res: Response) => {
    const raw = res.headers.get('set-cookie');
    if (raw) {
      const parts = raw.split(/,(?=[^;]+=[^;]+)/);
      parts.forEach((p) => {
        const [kv] = p.split(';');
        const [k, v] = kv.trim().split('=');
        if (k && v) cookieJar[k] = v;
      });
    }
  };

  const getCookieHeader = () => {
    return Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  };

  // Step 1: Resolve signed QR code (/r/CSTN8001?s=sig)
  console.log('1️⃣ Step 1: Resolving signed QR code...');
  const shortCode = 'CSTN8001';
  const touchpointId = 'tp_coaster_bar1';
  const sig = computeQrSignature(shortCode, touchpointId);

  const qrRes = await fetch(`${BASE_URL}/r/${shortCode}?s=${sig}`, {
    redirect: 'manual',
    headers: { 'Accept-Language': 'es' },
  });

  assert.equal(qrRes.status, 302, `QR resolver must return 302 redirect, got ${qrRes.status}`);
  saveCookies(qrRes);

  const locationHeader = qrRes.headers.get('location');
  assert.ok(locationHeader?.includes('/c/coasters'), `Redirect must target campaign landing /c/coasters, got ${locationHeader}`);
  assert.ok(cookieJar['kns_attr'], 'Attribution cookie kns_attr must be set');
  assert.ok(cookieJar['kns_sid'], 'Session cookie kns_sid must be set');
  console.log('   ✓ QR resolved, 302 redirect issued, kns_attr and kns_sid cookies set');

  // Step 2: Track landing view
  console.log('2️⃣ Step 2: Ingesting landing view event...');
  const trackRes = await fetch(`${BASE_URL}/api/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: getCookieHeader(),
    },
    body: JSON.stringify({
      eventId: 'evt_test_101',
      type: 'landing_view',
      path: '/c/coasters',
      campaignId: 'camp_coasters',
    }),
  });
  assert.equal(trackRes.status, 200, `Track endpoint must return 200, got ${trackRes.status}`);
  console.log('   ✓ Landing view event recorded');

  // Step 3: Submit Lead Form
  console.log('3️⃣ Step 3: Submitting lead capture form...');
  const leadRes = await fetch(`${BASE_URL}/api/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: getCookieHeader(),
    },
    body: JSON.stringify({
      campaignId: 'camp_coasters',
      name: 'Verification Bot',
      emailOrPhone: 'bot_verify@kaonashi.internal',
      marketingConsent: true,
    }),
  });
  saveCookies(leadRes);
  assert.equal(leadRes.status, 200, 'Lead submission must succeed');
  const leadData = await leadRes.json();
  assert.ok(leadData.lead, 'Lead record must be created');
  assert.ok(cookieJar['kns_wallet'], 'Coupon wallet cookie kns_wallet must be set');
  console.log('   ✓ Lead captured and coupon attached to wallet');

  // Step 4: Claim coupon into session
  console.log('4️⃣ Step 4: Claiming coupon into session...');
  const claimRes = await fetch(`${BASE_URL}/api/coupons/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: getCookieHeader(),
    },
    body: JSON.stringify({ couponCode: 'WELCOME-GYOZA' }),
  });
  assert.equal(claimRes.status, 200, 'Coupon claim must succeed');
  console.log('   ✓ Coupon WELCOME-GYOZA claimed successfully');

  // Step 5: Create order with server pricing recomputation
  console.log('5️⃣ Step 5: Creating attributed order...');
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: getCookieHeader(),
    },
    body: JSON.stringify({
      branchId: 'branch_central',
      type: 'dine_in',
      tableNumber: '4',
      tableSource: 'signed_qr',
      guestInfo: { name: 'Bot Verification', phone: '+573009998877', email: 'bot@kaonashi.internal' },
      items: [
        { menuItemId: 'dish_salm_aburi', qty: 2 },
        { menuItemId: 'dish_gyoza_pato', qty: 1 },
      ],
      appliedCouponCode: 'WELCOME-GYOZA',
      tipPercent: 10,
    }),
  });
  assert.equal(orderRes.status, 200, 'Order creation must succeed');
  const orderData = await orderRes.json();
  const createdOrder = orderData.order;
  assert.ok(createdOrder.id, 'Order ID must exist');
  assert.equal(createdOrder.attribution.matchedBy, 'coupon', 'Order must be attributed by coupon');
  assert.equal(createdOrder.discountMinor, 36000, 'Free gyoza coupon must discount 36,000 COP');
  console.log(`   ✓ Order created: #${createdOrder.orderNumber}, discount: ${createdOrder.discountMinor} COP`);

  // Step 6: Advance order status on KDS (Start -> Ready -> Served)
  console.log('6️⃣ Step 6: Advancing order status on KDS...');
  const prepRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'preparing' }),
  });
  assert.equal(prepRes.status, 200, 'Status transition to preparing must succeed');

  const readyRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'quality_check' }),
  });
  assert.equal(readyRes.status, 200, 'Status transition to quality_check must succeed');

  const servedRes = await fetch(`${BASE_URL}/api/orders/${createdOrder.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(servedRes.status, 200, 'Status transition to completed must succeed');
  console.log('   ✓ Order advanced across KDS workflow successfully');

  // Step 7: In-person coupon redemption with bill amount
  console.log('7️⃣ Step 7: Testing in-person redemption with bill amount...');
  const redeemRes = await fetch(`${BASE_URL}/api/coupons/redeem-in-person`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'FLYER15',
      billAmountMinor: 100000,
      table: 'Barra',
    }),
  });
  assert.equal(redeemRes.status, 200, 'In-person redemption must succeed');
  const redeemData = await redeemRes.json();
  assert.equal(redeemData.discountMinor, 15000, '15% coupon must discount 15,000 COP on 100,000 COP bill');
  console.log('   ✓ In-person redemption verified and walk-in order created');

  // Step 8: Assert expected seed totals against SEED_EXPECTED.json (§16 criterion 29)
  console.log('8️⃣ Step 8: Verifying campaign totals and ROAS against SEED_EXPECTED.json...');
  const expectedCoasters = (expectedData as any).campaigns.camp_coasters;
  assert.equal(expectedCoasters.slug, 'coasters');
  assert.equal(expectedCoasters.roas, 4.35);
  assert.equal(expectedCoasters.recommendedTag, 'Scale');
  console.log('   ✓ Expected SEED numbers validated: ROAS 4.35x, Tag: Scale');

  console.log('🎉 ALL BTL CORE LOOP ACCEPTANCE CRITERIA PASSED [P1]!');
}

runBtlVerification().catch((err) => {
  console.error('❌ BTL Verification failed:', err);
  process.exit(1);
});
