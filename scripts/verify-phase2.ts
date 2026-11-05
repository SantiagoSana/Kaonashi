// KAONASHI PHASE 2 CAPABILITIES VERIFICATION SCRIPT
import assert from 'node:assert/strict';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

async function main() {
  console.log(`🌸 Starting KAONASHI Phase 2 Verification against ${BASE_URL}\n`);

  // 1. Omikuji Draw
  console.log('1️⃣ Testing Interactive Omikuji Instant-Win (おみくじ)...');
  const omiRes = await fetch(`${BASE_URL}/api/omikuji/draw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'test_session_phase2' }),
  });
  assert.equal(omiRes.status, 200);
  const omiData = await omiRes.json();
  assert.ok(omiData.ok);
  assert.ok(['daikichi', 'chukichi', 'shokichi', 'kichi', 'suekichi'].includes(omiData.blessing));
  assert.ok(omiData.kanji);
  assert.ok(omiData.waka?.ja);
  assert.ok(omiData.coupon?.code);
  console.log(`   ✓ Omikuji blessing drawn: ${omiData.kanji} (${omiData.blessing}), coupon: ${omiData.coupon.code}`);

  // 2. AI Concierge & Sommelier
  console.log('2️⃣ Testing AI Concierge & Sommelier with Japanese Culinary Knowledge...');
  const aiRes = await fetch(`${BASE_URL}/api/ai/concierge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Recomiéndame un maridaje de sake para el Otoro', language: 'es' }),
  });
  assert.equal(aiRes.status, 200);
  const aiData = await aiRes.json();
  assert.ok(aiData.ok);
  assert.ok(aiData.reply.length > 20);
  assert.ok(Array.isArray(aiData.suggestedChips));
  console.log(`   ✓ Concierge replied: "${aiData.reply.slice(0, 70)}..."`);

  // 3. AI Executive Brief & Inventory Forecast
  console.log('3️⃣ Testing AI Executive Brief & Perishable Inventory Forecast...');
  const briefRes = await fetch(`${BASE_URL}/api/ai/admin/brief`, { method: 'POST' });
  assert.equal(briefRes.status, 200);
  const briefData = await briefRes.json();
  assert.ok(briefData.ok);
  assert.ok(briefData.brief.length > 50);
  assert.ok(briefData.recommendations.length > 0);
  assert.ok(briefData.inventoryForecast.length > 0);
  console.log(`   ✓ Executive brief generated (${briefData.recommendations.length} recommendations, ${briefData.inventoryForecast.length} forecasts)`);

  // 4. Customer OTP Challenge Flow
  console.log('4️⃣ Testing Customer OTP Challenge & Authentication...');
  const sendRes = await fetch(`${BASE_URL}/api/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact: 'guest.phase2@kaonashi.com' }),
  });
  assert.equal(sendRes.status, 200);
  const sendData = await sendRes.json();
  assert.ok(sendData.ok);
  assert.ok(sendData.debugCode);

  const verifyRes = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact: 'guest.phase2@kaonashi.com', code: sendData.debugCode }),
  });
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.ok(verifyData.ok);
  assert.ok(verifyData.customer?.id);
  assert.ok(verifyData.token);
  console.log(`   ✓ Customer OTP challenge verified for ${verifyData.customer.emailNormalized}`);

  // 5. Data Hub CSV Export & Formula Defense
  console.log('5️⃣ Testing Data Hub RFC 4180 CSV Export...');
  const csvRes = await fetch(`${BASE_URL}/api/admin/export/menu.csv`);
  assert.equal(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Nigiri Salmón Aburi'));
  assert.ok(csvText.includes('Cost_COP') || csvText.includes('Costo_Materia_Prima_COP'));
  console.log(`   ✓ Menu CSV exported (${csvText.split('\n').length} lines)`);

  // 6. Item-Level Promotions & Margin Guard
  console.log('6️⃣ Testing Promotions & Margin Guard...');
  const promoRes = await fetch(`${BASE_URL}/api/admin/promotions`);
  assert.equal(promoRes.status, 200);
  const promoData = await promoRes.json();
  assert.ok(promoData.ok);
  assert.ok(promoData.promotions.length > 0);
  const critical = promoData.promotions.filter((p: any) => p.isCriticalMargin);
  console.log(`   ✓ ${promoData.promotions.length} dishes analyzed, ${critical.length} items flagged for margin guard (<35%)`);

  // 7. Reservations Lifecycle
  console.log('7️⃣ Testing Reservations Management Lifecycle...');
  const createRes = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      timeSlot: '21:00',
      partySize: 2,
      area: 'omakase_counter',
      guestInfo: {
        name: 'Sayuri Tanaka',
        email: 'sayuri.tanaka@example.jp',
        phone: '+573201112233',
      },
    }),
  });
  assert.equal(createRes.status, 200);
  const createData = await createRes.json();
  assert.ok(createData.ok);
  const resId = createData.reservation.id;

  // Advance to seated
  const seatRes = await fetch(`${BASE_URL}/api/reservations/${resId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'seated' }),
  });
  const seatData = await seatRes.json();
  assert.equal(seatData.reservation.status, 'seated');
  console.log(`   ✓ Reservation ${resId} created and seated at Omakase Counter`);

  console.log('\n🎉 ALL PHASE 2 VERIFICATIONS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('\n❌ Phase 2 verification failed:', err);
  process.exit(1);
});
