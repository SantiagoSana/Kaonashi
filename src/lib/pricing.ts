// KAONASHI PRICING PIPELINE (§5.4)
import { Coupon, MenuItem, OrderType, DisplayCurrency } from './types';
import { CURRENCY_EXPONENTS } from './money';

export interface CartLineInput {
  item: MenuItem;
  qty: number;
  selectedModifiers?: { id: string; name: string; priceMinor: number }[];
  specialInstructions?: string;
}

export interface ItemPromotion {
  id: string;
  type: 'percent' | 'bogo' | 'fixed';
  value: number; // bps or minor
  applicableItemIds?: string[];
  applicableCategories?: string[];
}

export interface PricingOptions {
  branchId: string;
  currency: DisplayCurrency;
  lines: CartLineInput[];
  coupon?: Coupon | null;
  promotions?: ItemPromotion[];
  orderType: OrderType;
  tipPercentOrCustom?: number | { customMinor: number }; // e.g. 10, 15, 18, 0 or custom minor
  taxRate: number; // e.g. 0.08 or 0.19
  taxMode: 'inclusive' | 'exclusive';
  deliveryFeeMinor?: number;
  serviceChargeMinor?: number;
  loyaltyBenefitPercent?: number; // e.g. 10% for Omakase Master
  allMenuItems?: MenuItem[]; // needed for free_item or gift_with_purchase resolution
}

export interface PricedLine {
  menuItemId: string;
  name: string;
  basePriceMinor: number;
  modifierTotalMinor: number;
  unitPriceMinor: number;
  qty: number;
  grossSubtotalMinor: number;
  itemDiscountMinor: number;
  couponDiscountMinor: number;
  loyaltyDiscountMinor: number;
  totalDiscountMinor: number;
  netSubtotalMinor: number;
  isGift?: boolean;
}

export interface PricingResult {
  lines: PricedLine[];
  grossSubtotalMinor: number;
  totalItemDiscountMinor: number;
  totalCouponDiscountMinor: number;
  totalLoyaltyDiscountMinor: number;
  totalDiscountMinor: number;
  netPreTaxSubtotalMinor: number;
  taxMinor: number;
  tipMinor: number;
  deliveryFeeMinor: number;
  serviceChargeMinor: number;
  totalMinor: number;
  savingsTotalMinor: number;
  couponApplied?: {
    code: string;
    type: string;
    discountMinor: number;
  };
  giftItemAdded?: {
    id: string;
    name: string;
  };
  couponError?: string;
}

export function computePricing(options: PricingOptions): PricingResult {
  const {
    branchId,
    lines,
    coupon,
    promotions = [],
    orderType,
    tipPercentOrCustom = 0,
    taxRate,
    taxMode,
    deliveryFeeMinor = 0,
    serviceChargeMinor = 0,
    loyaltyBenefitPercent = 0,
    allMenuItems = [],
  } = options;

  // Step 1: Base prices & line totals
  const pricedLines: PricedLine[] = lines.map((l) => {
    const override = l.item.branchOverrides?.[branchId]?.price;
    const basePriceMinor = override !== undefined ? override : l.item.price;
    const modifierTotalMinor = (l.selectedModifiers || []).reduce((acc, m) => acc + m.priceMinor, 0);
    const unitPriceMinor = basePriceMinor + modifierTotalMinor;
    const grossSubtotalMinor = unitPriceMinor * l.qty;

    return {
      menuItemId: l.item.id,
      name: l.item.names.es || l.item.names.en,
      basePriceMinor,
      modifierTotalMinor,
      unitPriceMinor,
      qty: l.qty,
      grossSubtotalMinor,
      itemDiscountMinor: 0,
      couponDiscountMinor: 0,
      loyaltyDiscountMinor: 0,
      totalDiscountMinor: 0,
      netSubtotalMinor: grossSubtotalMinor,
    };
  });

  const grossSubtotalMinor = pricedLines.reduce((acc, l) => acc + l.grossSubtotalMinor, 0);

  // Step 2: Item-level promotions (best single promotion per item)
  pricedLines.forEach((pl, idx) => {
    const rawItem = lines[idx].item;
    let bestDiscount = 0;

    promotions.forEach((promo) => {
      const matchItem = !promo.applicableItemIds || promo.applicableItemIds.includes(rawItem.id);
      const matchCat = !promo.applicableCategories || promo.applicableCategories.includes(rawItem.category);
      if (!matchItem && !matchCat) return;

      let discount = 0;
      if (promo.type === 'percent') {
        discount = Math.round((pl.grossSubtotalMinor * promo.value) / 10000);
      } else if (promo.type === 'bogo' && pl.qty >= 2) {
        const freeUnits = Math.floor(pl.qty / 2);
        discount = freeUnits * pl.unitPriceMinor;
      } else if (promo.type === 'fixed') {
        discount = Math.min(promo.value * pl.qty, pl.grossSubtotalMinor);
      }

      if (discount > bestDiscount) {
        bestDiscount = discount;
      }
    });

    pl.itemDiscountMinor = Math.min(bestDiscount, pl.grossSubtotalMinor);
  });

  // Step 3: Coupon application
  let couponError: string | undefined;
  let totalCouponDiscountMinor = 0;
  let giftItemAdded: { id: string; name: string } | undefined;

  if (coupon && coupon.status === 'active') {
    // Check channel and order type
    if (!coupon.orderTypes.includes(orderType)) {
      couponError = 'COUPON_INVALID_ORDER_TYPE';
    } else if (grossSubtotalMinor < coupon.minSubtotalMinor) {
      couponError = 'COUPON_MIN_SPEND_NOT_MET';
    } else {
      // Find eligible lines
      const eligibleIndices = pricedLines
        .map((l, i) => ({ line: l, raw: lines[i].item, index: i }))
        .filter((e) => {
          if (coupon.scopeItems && coupon.scopeItems.length > 0) {
            return coupon.scopeItems.includes(e.raw.id);
          }
          if (coupon.scopeCategories && coupon.scopeCategories.length > 0) {
            return coupon.scopeCategories.includes(e.raw.category);
          }
          return true;
        });

      if (eligibleIndices.length === 0 && coupon.type !== 'gift_with_purchase') {
        couponError = 'COUPON_NO_ELIGIBLE_ITEMS';
      } else {
        const eligibleSubtotal = eligibleIndices.reduce((acc, e) => acc + e.line.grossSubtotalMinor, 0);

        if (coupon.type === 'percent') {
          // value in basis points
          eligibleIndices.forEach((e) => {
            const rawDiscount = Math.round((e.line.grossSubtotalMinor * coupon.value) / 10000);
            // Stacking rule: If coupon is not stackable, choose best for guest (coupon vs item promo)
            if (!coupon.stackable && e.line.itemDiscountMinor > 0) {
              if (rawDiscount > e.line.itemDiscountMinor) {
                e.line.couponDiscountMinor = rawDiscount;
                e.line.itemDiscountMinor = 0; // replace with better coupon
              }
            } else {
              e.line.couponDiscountMinor = Math.min(rawDiscount, e.line.grossSubtotalMinor - e.line.itemDiscountMinor);
            }
          });
        } else if (coupon.type === 'fixed') {
          // value in minor units, split with largest remainder
          const targetDiscount = Math.min(coupon.value, eligibleSubtotal);
          let remainingDiscount = targetDiscount;

          // proportional split
          eligibleIndices.forEach((e, idx) => {
            if (idx === eligibleIndices.length - 1) {
              e.line.couponDiscountMinor = Math.min(remainingDiscount, e.line.grossSubtotalMinor);
            } else {
              const share = Math.floor((e.line.grossSubtotalMinor / eligibleSubtotal) * targetDiscount);
              e.line.couponDiscountMinor = Math.min(share, e.line.grossSubtotalMinor);
              remainingDiscount -= e.line.couponDiscountMinor;
            }
          });
        } else if (coupon.type === 'free_item') {
          const targetId = coupon.freeItemId;
          const match = pricedLines.find((pl) => (targetId ? pl.menuItemId === targetId : true));
          if (match) {
            match.couponDiscountMinor = match.unitPriceMinor; // 1 unit free
          }
        } else if (coupon.type === 'bogo') {
          eligibleIndices.forEach((e) => {
            if (e.line.qty >= 2) {
              const freeCount = Math.floor(e.line.qty / 2);
              e.line.couponDiscountMinor = freeCount * e.line.unitPriceMinor;
            }
          });
        } else if (coupon.type === 'gift_with_purchase') {
          if (coupon.giftItemId) {
            const giftItem = allMenuItems.find((m) => m.id === coupon.giftItemId);
            if (giftItem) {
              giftItemAdded = { id: giftItem.id, name: giftItem.names.es || giftItem.names.en };
              pricedLines.push({
                menuItemId: giftItem.id,
                name: `[GIFT] ${giftItem.names.es || giftItem.names.en}`,
                basePriceMinor: 0,
                modifierTotalMinor: 0,
                unitPriceMinor: 0,
                qty: 1,
                grossSubtotalMinor: 0,
                itemDiscountMinor: 0,
                couponDiscountMinor: 0,
                loyaltyDiscountMinor: 0,
                totalDiscountMinor: 0,
                netSubtotalMinor: 0,
                isGift: true,
              });
            }
          }
        }
      }
    }
  }

  // Step 4: Loyalty benefits (stackable only if coupon says so or no coupon)
  const canApplyLoyalty = !coupon || coupon.stacksWithLoyalty;
  if (loyaltyBenefitPercent > 0 && canApplyLoyalty) {
    pricedLines.forEach((pl) => {
      const remainingLine = pl.grossSubtotalMinor - pl.itemDiscountMinor - pl.couponDiscountMinor;
      if (remainingLine > 0) {
        pl.loyaltyDiscountMinor = Math.round((remainingLine * loyaltyBenefitPercent) / 100);
      }
    });
  }

  // Finalize lines
  pricedLines.forEach((pl) => {
    pl.totalDiscountMinor = Math.min(
      pl.grossSubtotalMinor,
      pl.itemDiscountMinor + pl.couponDiscountMinor + pl.loyaltyDiscountMinor
    );
    pl.netSubtotalMinor = Math.max(0, pl.grossSubtotalMinor - pl.totalDiscountMinor);
  });

  const totalItemDiscountMinor = pricedLines.reduce((acc, l) => acc + l.itemDiscountMinor, 0);
  totalCouponDiscountMinor = pricedLines.reduce((acc, l) => acc + l.couponDiscountMinor, 0);
  const totalLoyaltyDiscountMinor = pricedLines.reduce((acc, l) => acc + l.loyaltyDiscountMinor, 0);
  const totalDiscountMinor = pricedLines.reduce((acc, l) => acc + l.totalDiscountMinor, 0);
  const netPreTaxSubtotalMinor = Math.max(0, grossSubtotalMinor - totalDiscountMinor);

  // Step 6: Tax
  let taxMinor = 0;
  if (taxMode === 'exclusive') {
    taxMinor = Math.round(netPreTaxSubtotalMinor * taxRate);
  } else {
    // Inclusive: already inside netPreTaxSubtotalMinor
    taxMinor = Math.round(netPreTaxSubtotalMinor - netPreTaxSubtotalMinor / (1 + taxRate));
  }

  // Step 7: Tip (computed on post-discount pre-tax subtotal)
  let tipMinor = 0;
  if (typeof tipPercentOrCustom === 'number') {
    tipMinor = Math.round((netPreTaxSubtotalMinor * tipPercentOrCustom) / 100);
  } else if (tipPercentOrCustom && typeof tipPercentOrCustom.customMinor === 'number') {
    tipMinor = Math.max(0, tipPercentOrCustom.customMinor);
  }

  // Step 8: Total
  const finalSubtotalWithTax = taxMode === 'exclusive' ? netPreTaxSubtotalMinor + taxMinor : netPreTaxSubtotalMinor;
  const totalMinor = Math.max(0, finalSubtotalWithTax + deliveryFeeMinor + serviceChargeMinor + tipMinor);

  return {
    lines: pricedLines,
    grossSubtotalMinor,
    totalItemDiscountMinor,
    totalCouponDiscountMinor,
    totalLoyaltyDiscountMinor,
    totalDiscountMinor,
    netPreTaxSubtotalMinor,
    taxMinor,
    tipMinor,
    deliveryFeeMinor,
    serviceChargeMinor,
    totalMinor,
    savingsTotalMinor: totalDiscountMinor,
    couponApplied:
      coupon && totalCouponDiscountMinor > 0
        ? { code: coupon.code, type: coupon.type, discountMinor: totalCouponDiscountMinor }
        : undefined,
    giftItemAdded,
    couponError,
  };
}
