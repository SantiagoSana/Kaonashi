import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useApp } from '../context/AppContext';
import { Tag, Sparkles, Check, ArrowRight, AlertTriangle } from 'lucide-react';

export const Redeem: React.FC = () => {
  const [, setLocation] = useLocation();
  const { setActiveCoupon, t } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [successCoupon, setSuccessCoupon] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/coupons/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'COUPON_NOT_FOUND');
      } else {
        setActiveCoupon(data.coupon);
        setSuccessCoupon(data.coupon);
      }
    } catch {
      setError('networkError');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-16 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-[rgb(var(--surface))] border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl relative">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full border border-[rgb(var(--primary))]/40 flex items-center justify-center mx-auto bg-[rgb(var(--background))]">
            <Tag size={20} className="text-[rgb(var(--primary))]" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">Canjear Beneficio</h1>
          <p className="text-xs text-[rgb(var(--muted))]">
            Ingresa el código impreso en tu portavasos, volante o tarjeta de invitación
          </p>
        </div>

        {successCoupon ? (
          <div className="p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-4 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center mx-auto">
              <Check size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">¡Código Activado!</h3>
              <p className="text-xs text-emerald-300 font-mono font-bold mt-1">{successCoupon.code}</p>
              <p className="text-xs text-[rgb(var(--muted))] mt-2">
                Tu beneficio se ha vinculado a tu carrito y se aplicará automáticamente al ordenar.
              </p>
            </div>
            <button
              onClick={() => setLocation('/menu')}
              className="w-full py-3 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow"
            >
              <span>Ir al Menú y Usar Descuento</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleClaim} className="space-y-4">
            <div>
              <label className="text-xs text-[rgb(var(--muted))]">Código Promocional</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej: WELCOME-GYOZA o FLYER15"
                className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-4 py-3 text-sm uppercase font-mono font-bold text-center tracking-widest focus:border-[rgb(var(--primary))] focus:outline-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{t(`errors.${error}`) || error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full py-3.5 bg-[rgb(var(--primary))] hover:bg-opacity-90 text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={16} />
              <span>{isLoading ? 'Verificando...' : 'Reclamar y Activar Beneficio'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
