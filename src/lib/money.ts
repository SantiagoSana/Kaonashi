// KAONASHI MONEY UTILITIES (§6.10)
import { DisplayCurrency, Locale } from './types';

export const CURRENCY_EXPONENTS: Record<DisplayCurrency, number> = {
  COP: 0,
  JPY: 0,
  USD: 2,
  EUR: 2,
};

// Default indicative FX rates (base = COP, Kaonashi Central branch currency)
export const DEFAULT_FX_RATES: Record<DisplayCurrency, number> = {
  COP: 1,
  USD: 0.00025, // 1 USD ≈ 4,000 COP
  EUR: 0.00023, // 1 EUR ≈ 4,350 COP
  JPY: 0.038,   // 1 JPY ≈ 26.3 COP
};

export interface FormatMoneyOptions {
  branchCurrency: DisplayCurrency;
  displayCurrency: DisplayCurrency;
  locale: Locale;
  fxRates?: Record<DisplayCurrency, number>;
  showIndicativeNotice?: boolean;
  /** Short form for chart axes and KPI tiles, e.g. "$4,1 mil M". */
  compact?: boolean;
}

export interface MoneyValue {
  formatted: string;
  isConverted: boolean;
  convertedMinor: number;
  originalMinor: number;
  displayCurrency: DisplayCurrency;
  branchCurrency: DisplayCurrency;
}

/**
 * Format money safely using minor units (integers). Never uses floats for calculations.
 */
export function formatMoney(
  amountMinor: number,
  options: FormatMoneyOptions
): MoneyValue {
  const { branchCurrency, displayCurrency, locale, fxRates = DEFAULT_FX_RATES } = options;
  const compact = options.compact === true;
  const isConverted = branchCurrency !== displayCurrency;

  let displayMinor = amountMinor;

  if (isConverted) {
    const branchRate = fxRates[branchCurrency] || 1;
    const targetRate = fxRates[displayCurrency] || 1;
    // Base is COP: amountMinor * (targetRate / branchRate) adjusted for exponents
    const branchExp = CURRENCY_EXPONENTS[branchCurrency];
    const targetExp = CURRENCY_EXPONENTS[displayCurrency];

    const major = amountMinor / Math.pow(10, branchExp);
    const convertedMajor = major * (targetRate / branchRate);
    displayMinor = Math.round(convertedMajor * Math.pow(10, targetExp));
  }

  const exp = CURRENCY_EXPONENTS[displayCurrency];
  const valueForFormatter = exp === 0 ? displayMinor : displayMinor / Math.pow(10, exp);

  const formatter = new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : locale === 'en' ? 'en-US' : 'es-CO', {
    style: 'currency',
    currency: displayCurrency,
    ...(compact
      ? { notation: 'compact' as const, maximumFractionDigits: 1 }
      : { minimumFractionDigits: exp, maximumFractionDigits: exp }),
  });

  const formattedBase = formatter.format(valueForFormatter);
  const formatted = isConverted ? `≈ ${formattedBase}` : formattedBase;

  return {
    formatted,
    isConverted,
    convertedMinor: displayMinor,
    originalMinor: amountMinor,
    displayCurrency,
    branchCurrency,
  };
}

/**
 * Simple helper to format an amount directly in its native currency
 */
export function formatNativePrice(amountMinor: number, currency: DisplayCurrency, locale: Locale): string {
  const exp = CURRENCY_EXPONENTS[currency];
  const val = exp === 0 ? amountMinor : amountMinor / Math.pow(10, exp);
  const formatter = new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : locale === 'en' ? 'en-US' : 'es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  });
  return formatter.format(val);
}
