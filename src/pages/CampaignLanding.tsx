import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useApp } from '../context/AppContext';
import { Price } from '../components/Price';
import { Campaign, Coupon, MenuItem } from '../lib/types';
import {
  Sparkles,
  Check,
  Copy,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Flame,
  Award,
  Gift,
} from 'lucide-react';
import { OmikujiModal } from '../components/OmikujiModal';

export const CampaignLanding: React.FC = () => {
  const [, params] = useRoute('/c/:slug');
  const slug = params?.slug || 'coasters';
  const [, setLocation] = useLocation();
  const { t, setActiveCoupon, addToCart } = useApp();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [omikujiOpen, setOmikujiOpen] = useState(false);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => {
        const found = d.campaigns.find((c: Campaign) => c.slug === slug);
        if (found) {
          setCampaign(found);
          const cp = d.coupons.find((c: Coupon) => c.campaignId === found.id);
          if (cp) setCoupon(cp);
        }
      })
      .catch(() => {});

    fetch('/api/menu')
      .then((r) => r.json())
      .then((d) => setDishes((d.items || []).slice(0, 3)))
      .catch(() => {});

    // Ingestion funnel event: landing_view (§5.10)
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: crypto.randomUUID(),
        type: 'landing_view',
        path: `/c/${slug}`,
        campaignId: slug,
      }),
    }).catch(() => {});
  }, [slug]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim() || !privacyAgreed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign?.id || slug,
          name,
          emailOrPhone: contact,
          marketingConsent: marketingAgreed,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.coupon) {
          setActiveCoupon(data.coupon);
          setCoupon(data.coupon);
        }
        setClaimed(true);
      }
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!coupon) return;
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-[rgb(var(--surface))] via-[rgb(var(--background))] to-[rgb(var(--background))]">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 px-4 text-center border-b border-white/5">
        <div className="absolute inset-0 bg-seigaiha opacity-30 pointer-events-none" />
        <div className="max-w-2xl mx-auto space-y-4 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-[rgb(var(--primary))]/15 text-[rgb(var(--primary))] font-mono font-bold tracking-wider uppercase">
            <Sparkles size={14} /> Activación Exclusiva
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[rgb(var(--text))] leading-tight">
            {campaign?.name || t('landing.welcomeTitle')}
          </h1>
          <p className="text-sm sm:text-base text-[rgb(var(--muted))] max-w-xl mx-auto">
            Disfruta la alta cocina de Kaonashi con una cortesía especial en tu primera visita o pedido online.
          </p>
        </div>
      </section>

      {/* Perforated Offer Coupon Ticket (§5.6) */}
      <section className="max-w-lg mx-auto px-4 -mt-6">
        <div className="bg-gradient-to-r from-[rgb(var(--secondary))] to-[rgb(var(--surface))] border-2 border-[rgb(var(--primary))]/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          {/* Perforated edge notches */}
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[rgb(var(--background))] border border-white/10" />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[rgb(var(--background))] border border-white/10" />

          <div className="text-center space-y-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[rgb(var(--primary))]">
              {t('landing.claimOffer')}
            </span>

            <div className="py-2">
              <div className="text-3xl font-display font-black text-white tracking-wider">
                {coupon ? coupon.code : 'WELCOME-GYOZA'}
              </div>
              <p className="text-xs text-[rgb(var(--muted))] mt-1">
                {coupon?.type === 'percent'
                  ? `${coupon.value / 100}% OFF en tu orden`
                  : 'Gyozas de Pato y Trufa de Cortesía'}
              </p>
            </div>

            {claimed ? (
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-medium flex items-center justify-center gap-2">
                  <Check size={16} /> ¡Cupón vinculado a tu billetera!
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex-1 py-2.5 bg-[rgb(var(--surface))] border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? t('landing.codeCopied') : t('landing.copyCode')}</span>
                  </button>
                  <button
                    onClick={() => setLocation('/menu')}
                    className="flex-1 py-2.5 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <span>{t('landing.orderNowCta')}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-3 pt-2 text-left">
                <div>
                  <label className="text-[11px] text-[rgb(var(--muted))]">{t('landing.nameLabel')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs focus:border-[rgb(var(--primary))] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[rgb(var(--muted))]">{t('landing.emailPhoneLabel')} *</label>
                  <input
                    type="text"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="ejemplo@correo.com o +57 300 123 4567"
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs focus:border-[rgb(var(--primary))] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="flex items-start gap-2 text-[10px] text-[rgb(var(--muted))] cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={privacyAgreed}
                      onChange={(e) => setPrivacyAgreed(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{t('landing.privacyNotice')}</span>
                  </label>

                  <label className="flex items-start gap-2 text-[10px] text-[rgb(var(--muted))] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingAgreed}
                      onChange={(e) => setMarketingAgreed(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{t('landing.marketingConsent')}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !privacyAgreed || !contact.trim()}
                  className="w-full py-3 bg-[rgb(var(--primary))] hover:bg-opacity-90 text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  <span>{isSubmitting ? 'Procesando...' : t('landing.claimCta')}</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Secondary Omikuji Instant-Win Trigger */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setOmikujiOpen(true)}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold hover:bg-[#D4AF37]/20 active:scale-95 transition-all shadow"
          >
            <Gift size={14} />
            <span>¿Prefieres tentar a la fortuna? Tirar Omikuji Sagrado (おみくじ)</span>
          </button>
        </div>

        <OmikujiModal isOpen={omikujiOpen} onClose={() => setOmikujiOpen(false)} />
      </section>

      {/* How it Works (§5.6) */}
      <section className="max-w-3xl mx-auto px-4 py-16 space-y-8">
        <h3 className="font-display text-xl font-bold text-center text-[rgb(var(--text))]">
          {t('landing.howItWorks')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-xl p-5 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] mx-auto flex items-center justify-center font-bold">
              1
            </div>
            <h4 className="font-display text-sm font-bold">{t('landing.step1')}</h4>
            <p className="text-xs text-[rgb(var(--muted))]">{t('landing.step1Desc')}</p>
          </div>

          <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-xl p-5 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] mx-auto flex items-center justify-center font-bold">
              2
            </div>
            <h4 className="font-display text-sm font-bold">{t('landing.step2')}</h4>
            <p className="text-xs text-[rgb(var(--muted))]">{t('landing.step2Desc')}</p>
          </div>

          <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-xl p-5 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] mx-auto flex items-center justify-center font-bold">
              3
            </div>
            <h4 className="font-display text-sm font-bold">{t('landing.step3')}</h4>
            <p className="text-xs text-[rgb(var(--muted))]">{t('landing.step3Desc')}</p>
          </div>
        </div>
      </section>
    </div>
  );
};
