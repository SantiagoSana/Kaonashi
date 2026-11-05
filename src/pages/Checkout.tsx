import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useApp } from '../context/AppContext';
import { Price } from '../components/Price';
import { OrderType } from '../lib/types';
import {
  Utensils,
  ShoppingBag,
  Truck,
  CreditCard,
  Banknote,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';

export const Checkout: React.FC = () => {
  const [, setLocation] = useLocation();
  const { cart, clearCart, pricing, activeCoupon, activeBranch, t } = useApp();

  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [tableNumber, setTableNumber] = useState('4');
  const [isTableFromQr, setIsTableFromQr] = useState(true);
  const [pickupSlot, setPickupSlot] = useState('19:30');
  const [address, setAddress] = useState('Calle 85 # 12-44, Apt 401');
  const [deliveryNotes, setDeliveryNotes] = useState('Timbrar 401');
  const [name, setName] = useState('Mia Larsson');
  const [phone, setPhone] = useState('+573001234567');
  const [email, setEmail] = useState('mia_guest@example.com');
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_venue' | 'stripe'>('pay_at_venue');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  if (cart.length === 0 && !orderSuccess) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <ShoppingBag size={48} className="mx-auto text-[rgb(var(--muted))]" />
        <h2 className="font-display text-xl font-bold">{t('cart.empty')}</h2>
        <button
          onClick={() => setLocation('/menu')}
          className="px-6 py-2.5 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl"
        >
          {t('home.exploreMenu')}
        </button>
      </div>
    );
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeBranch.id,
          type: orderType,
          tableNumber: orderType === 'dine_in' ? tableNumber : undefined,
          tableSource: isTableFromQr ? 'signed_qr' : 'manual',
          guestInfo: {
            name,
            phone,
            email,
            address: orderType === 'delivery' ? address : undefined,
            deliveryInstructions: orderType === 'delivery' ? deliveryNotes : undefined,
            pickupSlot: orderType === 'takeaway' ? pickupSlot : undefined,
          },
          items: cart.map((ci) => ({
            menuItemId: ci.item.id,
            qty: ci.qty,
          })),
          appliedCouponCode: activeCoupon?.code,
          tipPercent: 10,
        }),
      });

      const data = await res.json();
      if (res.ok && data.order) {
        clearCart();
        setOrderSuccess(data.order);
        setTimeout(() => {
          setLocation(`/order/${data.order.id}?t=${data.order.token}`);
        }, 1800);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-8">
      {/* Hanko Stamp Celebration Overlay upon order placement (§6.4) */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="text-center space-y-4 animate-[scale-in_0.3s_ease-out]">
            {/* Hanko Seal Stamp Graphic */}
            <div className="w-28 h-28 rounded-full border-4 border-[rgb(var(--accent))] mx-auto flex flex-col items-center justify-center p-2 text-[rgb(var(--accent))] shadow-[0_0_30px_rgba(230,57,70,0.5)] rotate-[-12deg]">
              <span className="font-display font-black text-2xl tracking-widest">顔無</span>
              <span className="text-[10px] uppercase font-bold tracking-widest">CONFIRMADO</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-white">¡Pedido Confirmado!</h3>
            <p className="text-sm text-[rgb(var(--muted))]">
              {t('order.orderNumber', { number: orderSuccess.orderNumber })}
            </p>
            <p className="text-xs text-[rgb(var(--primary))] animate-pulse">Abriendo seguimiento en vivo...</p>
          </div>
        </div>
      )}

      <div className="border-b border-white/5 pb-4">
        <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">{t('checkout.title')}</h1>
        <p className="text-xs text-[rgb(var(--muted))]">Verifica los detalles de tu orden antes de confirmar</p>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Form Columns */}
        <div className="md:col-span-2 space-y-6">
          {/* 1. Fulfillment Selection */}
          <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-[rgb(var(--text))] uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] flex items-center justify-center text-xs">
                1
              </span>
              {t('checkout.orderType')}
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'dine_in', label: t('checkout.dineIn'), icon: Utensils },
                { id: 'takeaway', label: t('checkout.takeaway'), icon: ShoppingBag },
                { id: 'delivery', label: t('checkout.delivery'), icon: Truck },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = orderType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOrderType(opt.id as OrderType)}
                    className={`p-3 rounded-xl border text-center flex flex-col items-center gap-2 transition-all ${
                      isSelected
                        ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))] font-bold shadow'
                        : 'border-white/5 bg-[rgb(var(--background))] text-[rgb(var(--muted))] hover:text-white'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-xs">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Contextual fields for Order Type */}
            {orderType === 'dine_in' && (
              <div className="pt-2 border-t border-white/5 space-y-2">
                <label className="text-xs text-[rgb(var(--muted))]">{t('checkout.tableNumber')}</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => {
                      setTableNumber(e.target.value);
                      setIsTableFromQr(false);
                    }}
                    className="w-24 bg-[rgb(var(--background))] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono font-bold"
                  />
                  {isTableFromQr && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={14} /> {t('checkout.tableDetected', { table: tableNumber })}
                    </span>
                  )}
                </div>
              </div>
            )}

            {orderType === 'delivery' && (
              <div className="pt-2 border-t border-white/5 space-y-3">
                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">{t('checkout.deliveryAddress')}</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">{t('checkout.deliveryInstructions')}</label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Guest Information */}
          <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-[rgb(var(--text))] uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] flex items-center justify-center text-xs">
                2
              </span>
              Datos de Contacto
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[rgb(var(--muted))]">{t('checkout.name')}</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[rgb(var(--muted))]">{t('checkout.phone')}</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-[rgb(var(--muted))]">{t('checkout.email')}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Payment Method */}
          <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-[rgb(var(--text))] uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] flex items-center justify-center text-xs">
                3
              </span>
              {t('checkout.paymentMethod')}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('pay_at_venue')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  paymentMethod === 'pay_at_venue'
                    ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]'
                    : 'border-white/5 bg-[rgb(var(--background))] text-[rgb(var(--muted))]'
                }`}
              >
                <Banknote size={20} className="mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[rgb(var(--text))]">{t('checkout.payAtVenue')}</div>
                  <div className="text-[10px] text-[rgb(var(--muted))]">Paga en mesa o al repartidor</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('stripe')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  paymentMethod === 'stripe'
                    ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]'
                    : 'border-white/5 bg-[rgb(var(--background))] text-[rgb(var(--muted))]'
                }`}
              >
                <CreditCard size={20} className="mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[rgb(var(--text))]">Tarjeta (Stripe Test)</div>
                  <div className="text-[10px] text-[rgb(var(--muted))]">Pago seguro simulado</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Summary Column */}
        <div className="space-y-6">
          <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4 sticky top-24">
            <h3 className="font-display text-sm font-bold text-[rgb(var(--text))] uppercase tracking-wider">
              Resumen de Compra
            </h3>

            <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-white/5 text-xs">
              {pricing.lines.map((l, i) => (
                <div key={i} className="pt-2 first:pt-0 flex justify-between items-start">
                  <div>
                    <span className="font-medium text-[rgb(var(--text))]">
                      {l.qty}x {l.name}
                    </span>
                    {l.totalDiscountMinor > 0 && (
                      <span className="block text-[10px] text-[rgb(var(--primary))]">
                        Ahorro: -<Price amountMinor={l.totalDiscountMinor} />
                      </span>
                    )}
                  </div>
                  <Price amountMinor={l.netSubtotalMinor} />
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
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

              {orderType === 'delivery' && (
                <div className="flex justify-between text-[rgb(var(--muted))]">
                  <span>{t('cart.deliveryFee')}</span>
                  <Price amountMinor={7000} />
                </div>
              )}

              <div className="flex justify-between text-[rgb(var(--muted))] text-[11px]">
                <span>{t('cart.tax')}</span>
                <Price amountMinor={pricing.taxMinor} />
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-between text-base font-bold text-[rgb(var(--text))]">
                <span>{t('cart.total')}</span>
                <Price amountMinor={pricing.totalMinor + (orderType === 'delivery' ? 7000 : 0)} />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[rgb(var(--primary))] hover:bg-opacity-90 text-[rgb(var(--on-primary))] font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={16} />
              <span>{isSubmitting ? t('checkout.processing') : t('checkout.placeOrder')}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
