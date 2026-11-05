import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Sparkles, Gift, Check, RefreshCw } from 'lucide-react';

interface OmikujiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OmikujiResult {
  blessing: 'daikichi' | 'chukichi' | 'shokichi' | 'kichi' | 'suekichi';
  kanji: string;
  label: { es: string; en: string; ja: string };
  waka: { es: string; en: string; ja: string };
  coupon: any;
  discountDesc: string;
  luckyColor: string;
  luckyDish: string;
}

export const OmikujiModal: React.FC<OmikujiModalProps> = ({ isOpen, onClose }) => {
  const { locale, t, setWalletCoupon, showNotification } = useApp();
  const [isShaking, setIsShaking] = useState(false);
  const [result, setResult] = useState<OmikujiResult | null>(null);
  const [isClaimed, setIsClaimed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDraw = async () => {
    setIsShaking(true);
    setLoading(true);

    try {
      const res = await fetch('/api/omikuji/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'guest_session' }),
      });
      const data = await res.json();

      setTimeout(() => {
        setIsShaking(false);
        setLoading(false);
        if (data.ok) {
          setResult(data);
          setIsClaimed(false);
        }
      }, 1200);
    } catch {
      setIsShaking(false);
      setLoading(false);
    }
  };

  const handleClaim = () => {
    if (!result?.coupon) return;
    setWalletCoupon(result.coupon);
    setIsClaimed(true);
    showNotification(t('omikuji.claimed') || '¡Beneficio añadido a tu billetera!');
  };

  const blessingColor = {
    daikichi: 'text-[#D4AF37] border-[#D4AF37]',
    chukichi: 'text-[#E05A47] border-[#E05A47]',
    shokichi: 'text-[#64B5F6] border-[#64B5F6]',
    kichi: 'text-[#81C784] border-[#81C784]',
    suekichi: 'text-[#FFB74D] border-[#FFB74D]',
  }[result?.blessing || 'kichi'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[rgb(var(--surface))] border border-[#D4AF37]/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden">
        {/* Ensō Seal Background Watermark */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full border-[12px] border-[#D4AF37]/5 pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[rgb(var(--muted))] hover:text-white rounded-full bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>

        {!result ? (
          /* IDLE / SHAKING STATE */
          <div className="space-y-6 py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-semibold uppercase tracking-widest">
              <Sparkles size={14} />
              <span>{t('omikuji.title')}</span>
            </div>

            <h3 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
              {t('omikuji.title')}
            </h3>

            <p className="text-sm text-[rgb(var(--muted))] max-w-xs mx-auto">
              {t('omikuji.subtitle')}
            </p>

            {/* Cylinder Box (Omikuji-bako) */}
            <div className="py-6 flex justify-center">
              <div
                className={`relative w-28 h-44 rounded-2xl bg-gradient-to-b from-[#8C5E35] via-[#5C3B1E] to-[#3B2411] border-2 border-[#D4AF37]/40 shadow-2xl flex flex-col items-center justify-between p-3 transition-transform ${
                  isShaking ? 'animate-bounce rotate-12 scale-105' : 'hover:scale-105'
                }`}
              >
                {/* Bamboo Lid */}
                <div className="w-20 h-4 bg-[#A67443] rounded-md border border-[#D4AF37]/50 shadow" />

                {/* Vertical Kanji Banner */}
                <div className="bg-[#1a1410] border border-[#D4AF37]/30 px-2 py-4 rounded text-[#D4AF37] font-display text-lg font-bold tracking-widest writing-vertical">
                  おみくじ
                </div>

                {/* Bamboo Stick popping out during shake */}
                {isShaking && (
                  <div className="absolute -top-10 w-3 h-14 bg-[#DDB180] border border-[#3B2411] rounded-t-sm animate-pulse" />
                )}

                {/* Base Rim */}
                <div className="w-24 h-3 bg-[#A67443] rounded-sm" />
              </div>
            </div>

            <button
              onClick={handleDraw}
              disabled={loading || isShaking}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B38F26] text-[#0B0C10] font-bold text-sm tracking-wide shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {isShaking ? t('omikuji.drawing') : t('omikuji.shakeCta')}
            </button>
          </div>
        ) : (
          /* RESULT / FORTUNE SLIP STATE */
          <div className="space-y-5 animate-fadeIn">
            {/* Washi Paper Slip */}
            <div className="bg-[#FAF7EE] text-[#1E1E1E] p-6 rounded-2xl border-2 border-[#D4AF37]/40 shadow-inner relative text-center space-y-4">
              {/* Hanko Stamp Overlay */}
              <div className="absolute top-3 right-3 w-10 h-10 border-2 border-[#C53D2A] rounded-full flex items-center justify-center text-[#C53D2A] font-bold text-[10px] transform rotate-12 select-none">
                吉兆
              </div>

              {/* Kanji Grade Banner */}
              <div className="inline-block border-y-2 border-[#1E1E1E] py-1 px-6">
                <span className="font-display text-4xl font-black tracking-widest text-[#C53D2A]">
                  {result.kanji}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-base text-[#1E1E1E]">
                  {result.label[locale] || result.label.es}
                </h4>
                <p className="text-xs text-[#555] font-serif italic mt-1 leading-relaxed px-2">
                  "{result.waka[locale] || result.waka.es}"
                </p>
              </div>

              {/* Coupon Reward Box */}
              <div className="bg-[#EDE6D4] p-3 rounded-xl border border-[#D4AF37]/60 space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#8C5E35]">
                  <Gift size={14} />
                  <span>{result.discountDesc}</span>
                </div>
                <div className="font-mono text-sm font-black tracking-wider text-[#1E1E1E] bg-white py-1 px-3 rounded-lg border border-dashed border-[#8C5E35]">
                  {result.coupon.code}
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-[#666] pt-1 border-t border-black/10">
                <span>Color: {result.luckyColor}</span>
                <span>Plato recomendado: {result.luckyDish}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleClaim}
                disabled={isClaimed}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 ${
                  isClaimed
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-gradient-to-r from-[#D4AF37] to-[#B38F26] text-[#0B0C10] hover:brightness-110 active:scale-95'
                }`}
              >
                {isClaimed ? (
                  <>
                    <Check size={18} />
                    <span>{t('omikuji.claimed')}</span>
                  </>
                ) : (
                  <>
                    <Gift size={18} />
                    <span>{t('omikuji.claimPrize')}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setResult(null)}
                className="w-full py-2 text-xs text-[rgb(var(--muted))] hover:text-white flex items-center justify-center gap-1"
              >
                <RefreshCw size={12} />
                <span>Volver a agitar (Modo Demo)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
