import React from 'react';
import { formatMoney } from '../lib/money';
import { useApp } from '../context/AppContext';

interface PriceProps {
  amountMinor: number;
  className?: string;
  showOriginalIfConverted?: boolean;
}

export const Price: React.FC<PriceProps> = ({ amountMinor, className = '', showOriginalIfConverted = false }) => {
  const { currency, activeBranch, locale } = useApp();

  const formatted = formatMoney(amountMinor, {
    branchCurrency: activeBranch.currency,
    displayCurrency: currency,
    locale,
  });

  return (
    <span className={`inline-flex items-baseline gap-1 font-mono-numbers ${className}`}>
      <span>{formatted.formatted}</span>
      {showOriginalIfConverted && formatted.isConverted && (
        <span className="text-xs text-[rgb(var(--muted))] opacity-80">
          ({activeBranch.currency})
        </span>
      )}
    </span>
  );
};
