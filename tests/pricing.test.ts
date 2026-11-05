import test from 'node:test';
import assert from 'node:assert/strict';
import { computePricing } from '../src/lib/pricing';
import { MenuItem, Coupon } from '../src/lib/types';

const mockDishA: MenuItem = {
  id: 'dish_a',
  slug: 'dish-a',
  category: 'nigiri',
  names: { es: 'Nigiri A', en: 'Nigiri A', ja: '握りA' },
  descriptions: { es: '', en: '', ja: '' },
  ingredients: [],
  allergens: [],
  dietary: [],
  spiceLevel: 0,
  isRaw: false,
  isAlcohol: false,
  price: 20000,
  cost: 6000,
  art: { hue: 0, motif: 'enso' },
  available: true,
};

const mockDishB: MenuItem = {
  id: 'dish_b',
  slug: 'dish-b',
  category: 'rolls',
  names: { es: 'Roll B', en: 'Roll B', ja: '巻きB' },
  descriptions: { es: '', en: '', ja: '' },
  ingredients: [],
  allergens: [],
  dietary: [],
  spiceLevel: 0,
  isRaw: false,
  isAlcohol: false,
  price: 40000,
  cost: 12000,
  art: { hue: 0, motif: 'enso' },
  available: true,
};

test('Pricing: percent coupon discount 15%', () => {
  const coupon: Coupon = {
    id: 'c1',
    code: 'SAVE15',
    type: 'percent',
    value: 1500, // 15%
    minSubtotalMinor: 30000,
    perCustomerLimit: 1,
    totalCap: 100,
    redeemedCount: 0,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    channels: ['online'],
    orderTypes: ['dine_in', 'delivery'],
    stackable: false,
    stacksWithLoyalty: false,
    firstOrderOnly: false,
    requiresLead: false,
    status: 'active',
  };

  const result = computePricing({
    branchId: 'branch_central',
    currency: 'COP',
    lines: [
      { item: mockDishA, qty: 1 }, // 20,000
      { item: mockDishB, qty: 1 }, // 40,000
    ],
    coupon,
    orderType: 'dine_in',
    taxRate: 0.19,
    taxMode: 'inclusive',
  });

  assert.equal(result.grossSubtotalMinor, 60000);
  assert.equal(result.totalCouponDiscountMinor, 9000); // 15% of 60,000
  assert.equal(result.netPreTaxSubtotalMinor, 51000);
  assert.equal(result.savingsTotalMinor, 9000);
});

test('Pricing: fixed amount coupon split across lines', () => {
  const coupon: Coupon = {
    id: 'c2',
    code: 'FIXED10',
    type: 'fixed',
    value: 10000, // 10,000 minor units
    minSubtotalMinor: 50000,
    perCustomerLimit: 1,
    totalCap: 100,
    redeemedCount: 0,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    channels: ['online'],
    orderTypes: ['dine_in'],
    stackable: false,
    stacksWithLoyalty: false,
    firstOrderOnly: false,
    requiresLead: false,
    status: 'active',
  };

  const result = computePricing({
    branchId: 'branch_central',
    currency: 'COP',
    lines: [
      { item: mockDishA, qty: 1 }, // 20,000
      { item: mockDishB, qty: 1 }, // 40,000
    ],
    coupon,
    orderType: 'dine_in',
    taxRate: 0,
    taxMode: 'exclusive',
  });

  assert.equal(result.grossSubtotalMinor, 60000);
  assert.equal(result.totalCouponDiscountMinor, 10000);
  assert.equal(result.netPreTaxSubtotalMinor, 50000);
  // Sum of line savings must equal total savings
  const sumLines = result.lines.reduce((acc, l) => acc + l.totalDiscountMinor, 0);
  assert.equal(sumLines, result.savingsTotalMinor);
});

test('Pricing: bogo coupon gives cheaper unit free for every pair', () => {
  const coupon: Coupon = {
    id: 'c3',
    code: 'BOGO2X1',
    type: 'bogo',
    value: 0,
    minSubtotalMinor: 0,
    perCustomerLimit: 1,
    totalCap: 100,
    redeemedCount: 0,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    channels: ['online'],
    orderTypes: ['dine_in'],
    stackable: false,
    stacksWithLoyalty: false,
    firstOrderOnly: false,
    requiresLead: false,
    status: 'active',
  };

  const result = computePricing({
    branchId: 'branch_central',
    currency: 'COP',
    lines: [{ item: mockDishA, qty: 3 }], // 3 units @ 20,000 -> 1 free (pair of 2)
    coupon,
    orderType: 'dine_in',
    taxRate: 0,
    taxMode: 'exclusive',
  });

  assert.equal(result.grossSubtotalMinor, 60000);
  assert.equal(result.totalCouponDiscountMinor, 20000); // 1 free unit
  assert.equal(result.totalMinor, 40000);
});
