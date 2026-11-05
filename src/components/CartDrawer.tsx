import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useApp } from '../context/AppContext';
import { Price } from './Price';
import { X, Plus, Minus, Trash2, Tag, Sparkles, ArrowRight } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const [, setLocation] = useLocation();
  const {
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    activeCoupon,
    setActiveCoupon,
    pricing,
    t,
  } = useApp();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setIsApplying(true);
    setCouponError('');

    try {
      const res = await fetch('/api/coupons/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: couponInput.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || 'COUPON_NOT_FOUND');
      } else {
        setActiveCoupon(data.coupon);
        setCouponInput('');
      }
    } catch {
      setCouponError('networkError');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCheckoutClick = () => {
    onClose();
    setLocation('/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-[rgb(var(--surface))] border-l border-white/10 h-full flex flex-col z-10 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-[rgb(var(--text))]">{t('cart.title')}</h2>
            <span className="text-xs bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] font-mono px-2 py-0.5 rounded-full font-bold">
              {cart.reduce((acc, i) => acc + i.qty, 0)}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-[rgb(var(--muted))] hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <p className="text-[rgb(var(--muted))] text-sm">{t('cart.empty')}</p>
              <button
                onClick={onClose}
                className="text-xs text-[rgb(var(--primary))] underline underline-offset-4"
              >
                {t('cart.emptyCta')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pricing.lines.map((line, idx) => (
                <div
                  key={`${line.menuItemId}_${idx}`}
                  className="bg-[rgb(var(--background))] border border-white/5 p-3 rounded-lg flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-[rgb(var(--text))] truncate">{line.name}</h4>
                    <div className="text-xs text-[rgb(var(--muted))] flex items-center gap-2 mt-0.5">
                      <Price amountMinor={line.unitPriceMinor} />
                      {line.totalDiscountMinor > 0 && (
                        <span className="text-[rgb(var(--primary))] font-semibold">
                          (-<Price amountMinor={line.totalDiscountMinor} />)
                        </span>
                      )}
                    </div>
                  </div>

                  {line.isGift ? (
                    <span className="text-xs bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] px-2 py-1 rounded font-semibold">
                      {t('cart.giftItem')}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-white/10 rounded-md overflow-hidden bg-[rgb(var(--surface))]">
                        <button
                          onClick={() => updateCartQty(line.menuItemId, line.qty - 1)}
                          className="p-1 text-[rgb(var(--muted))] hover:text-white"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="px-2 text-xs font-mono font-bold">{line.qty}</span>
                        <button
                          onClick={() => updateCartQty(line.menuItemId, line.qty + 1)}
                          className="p-1 text-[rgb(var(--muted))] hover:text-white"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(line.menuItemId)}
                        className="text-[rgb(var(--muted))] hover:text-[rgb(var(--accent))] p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Coupon Form */}
          {cart.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag size={14} className="absolute left-3 top-3 text-[rgb(var(--muted))]" />
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder={t('cart.couponPlaceholder')}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs uppercase tracking-wider font-mono focus:border-[rgb(var(--primary))] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isApplying || !couponInput.trim()}
                  className="px-4 py-2 bg-[rgb(var(--secondary))] hover:bg-[rgb(var(--primary))] hover:text-[rgb(var(--on-primary))] text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isApplying ? '...' : t('cart.apply')}
                </button>
              </form>

              {couponError && (
                <p className="text-[11px] text-[rgb(var(--accent))] font-medium">
                  {t(`errors.${couponError}`) || couponError}
                </p>
              )}

              {activeCoupon && (
                <div className="flex items-center justify-between text-xs bg-[rgb(var(--primary))]/10 border border-[rgb(var(--primary))]/30 px-3 py-2 rounded-lg text-[rgb(var(--primary))]">
                  <span className="flex items-center gap-1 font-mono font-bold">
                    <Sparkles size={14} /> {activeCoupon.code}
                  </span>
                  <button
                    onClick={() => setActiveCoupon(null)}
                    className="text-[rgb(var(--muted))] hover:text-white text-xs underline"
                  >
                    {t('cart.remove')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-white/10 bg-[rgb(var(--background))] space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[rgb(var(--muted))]">
                <span>{t('cart.subtotal')}</span>
                <Price amountMinor={pricing.grossSubtotalMinor} />
              </div>

              {pricing.totalDiscountMinor > 0 && (
                <div className="flex justify-between text-[rgb(var(--primary))] font-semibold">
                  <span>{t('cart.discount')}</span>
                  <span>-<Price amountMinor={pricing.totalDiscountMinor} /></span>
                </div>
              )}

              <div className="flex justify-between text-[rgb(var(--muted))] text-[11px]">
                <span>{t('cart.tax')}</span>
                <Price amountMinor={pricing.taxMinor} />
              </div>

              <div className="border-t border-white/10 pt-2 flex justify-between text-base font-bold text-[rgb(var(--text))]">
                <span>{t('cart.total')}</span>
                <Price amountMinor={pricing.totalMinor} />
              </div>
            </div>

            <button
              onClick={handleCheckoutClick}
              className="w-full py-3 bg-[rgb(var(--primary))] hover:bg-opacity-90 text-[rgb(var(--on-primary))] font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span>{t('cart.checkout')}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
