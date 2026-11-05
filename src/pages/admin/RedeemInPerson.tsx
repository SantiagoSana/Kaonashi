import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Price } from '../../components/Price';
import {
  CheckSquare,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
} from 'lucide-react';

export const RedeemInPerson: React.FC = () => {
  const { t } = useApp();
  const [code, setCode] = useState('');
  const [billAmount, setBillAmount] = useState('140000');
  const [table, setTable] = useState('Barra');
  const [posRef, setPosRef] = useState('POS-9842');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !billAmount) return;

    setIsSubmitting(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/coupons/redeem-in-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          billAmountMinor: Number(billAmount),
          posRef,
          table,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'ERROR_REDEEMING');
      } else {
        setResult(data);
        setCode('');
      }
    } catch {
      setError('networkError');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-16">
      <div className="border-b border-white/5 pb-4">
        <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">{t('admin.redeem')}</h1>
        <p className="text-xs text-[rgb(var(--muted))]">
          Validación presencial en caja/barra con registro obligatorio de cuenta y atribución de venta
        </p>
      </div>

      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-6">
        <form onSubmit={handleRedeem} className="space-y-4">
          <div>
            <label className="text-xs text-[rgb(var(--muted))]">Código Promocional *</label>
            <div className="relative mt-1">
              <QrCode size={16} className="absolute left-3.5 top-3 text-[rgb(var(--muted))]" />
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej: WELCOME-GYOZA o FLYER15"
                className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm uppercase font-mono font-bold focus:border-[rgb(var(--primary))] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[rgb(var(--muted))]">Monto Total de la Cuenta (COP) *</label>
            <div className="relative mt-1">
              <Receipt size={16} className="absolute left-3.5 top-3 text-[rgb(var(--muted))]" />
              <input
                type="number"
                required
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono font-bold focus:border-[rgb(var(--primary))] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[rgb(var(--muted))]">Mesa / Ubicación</label>
              <input
                type="text"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-xs text-[rgb(var(--muted))]">Referencia POS / Caja</label>
              <input
                type="text"
                value={posRef}
                onChange={(e) => setPosRef(e.target.value)}
                className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{t(`errors.${error}`) || error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !code.trim() || !billAmount}
            className="w-full py-3.5 bg-[rgb(var(--primary))] hover:bg-opacity-90 text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckSquare size={16} />
            <span>{isSubmitting ? 'Validando...' : 'Validar y Aplicar Canje en Barra'}</span>
          </button>
        </form>

        {/* Success Result Box */}
        {result && (
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 size={18} />
              <span>¡Canje Aplicado con Éxito!</span>
            </div>

            <div className="space-y-1 text-xs text-[rgb(var(--text))] border-t border-white/5 pt-2">
              <div className="flex justify-between">
                <span>Orden generada:</span>
                <span className="font-mono font-bold">{result.order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Descuento aplicado:</span>
                <span className="text-emerald-400 font-bold">
                  -<Price amountMinor={result.discountMinor} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total a cobrar al cliente:</span>
                <span className="font-bold text-[rgb(var(--primary))]">
                  <Price amountMinor={result.order.totalMinor} />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
