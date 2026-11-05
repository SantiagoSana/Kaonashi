import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useApp } from '../context/AppContext';
import { Price } from '../components/Price';
import { MenuItem } from '../lib/types';
import { Sparkles, Utensils, Calendar, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

export const Home: React.FC = () => {
  const { t, activeBranch, activeCoupon, addToCart } = useApp();
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/menu')
      .then((r) => r.json())
      .then((d) => {
        setDishes(d.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Funnel event: landing_view
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: crypto.randomUUID(),
        type: 'landing_view',
        path: '/',
        campaignId: activeCoupon?.campaignId,
      }),
    }).catch(() => {});
  }, [activeCoupon]);

  const featuredOmakase = dishes.filter((d) => d.category === 'omakase');
  const signatureDishes = dishes.slice(0, 4);

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24 px-4 border-b border-white/5 bg-gradient-to-b from-[rgb(var(--surface))] to-[rgb(var(--background))]">
        <div className="absolute inset-0 bg-seigaiha opacity-40 pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          {/* Branch status chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-[rgb(var(--secondary))] border border-white/10 text-[rgb(var(--text))]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">{activeBranch.name}</span>
            <span>·</span>
            <span>{t('home.branchOpen')} ({activeBranch.hours})</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[rgb(var(--text))] leading-tight max-w-4xl mx-auto">
            {t('home.heroTitle')}
          </h1>

          <p className="text-[rgb(var(--muted))] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {t('home.heroSubhead')}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/menu"
              className="w-full sm:w-auto px-8 py-3.5 bg-[rgb(var(--primary))] hover:bg-opacity-90 text-[rgb(var(--on-primary))] font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Utensils size={18} />
              <span>{t('home.exploreMenu')}</span>
            </Link>

            <Link
              href="/reservations"
              className="w-full sm:w-auto px-8 py-3.5 bg-[rgb(var(--surface))] border border-white/10 hover:border-white/20 text-[rgb(var(--text))] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Calendar size={18} />
              <span>{t('home.bookTable')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Omakase Banner */}
      {featuredOmakase.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="relative rounded-2xl overflow-hidden border border-[rgb(var(--primary))]/30 bg-gradient-to-r from-[rgb(var(--surface))] to-[rgb(var(--background))] p-8 md:p-12">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-asanoha opacity-20 pointer-events-none" />
            <div className="max-w-xl space-y-4 relative z-10">
              <span className="text-xs uppercase tracking-widest text-[rgb(var(--primary))] font-bold flex items-center gap-1.5">
                <Sparkles size={14} /> {t('home.omakaseExperience')}
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-[rgb(var(--text))]">
                {featuredOmakase[0].names.es || featuredOmakase[0].names.en}
              </h2>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed">
                {featuredOmakase[0].descriptions.es || featuredOmakase[0].descriptions.en}
              </p>
              <div className="flex items-center gap-4 pt-2">
                <Price amountMinor={featuredOmakase[0].price} className="text-xl font-bold text-[rgb(var(--primary))]" />
                <button
                  onClick={() => addToCart(featuredOmakase[0])}
                  className="px-5 py-2.5 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
                >
                  {t('menu.addToCart')}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Signature Dishes Grid */}
      <section className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-end justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="font-display text-xl font-bold text-[rgb(var(--text))]">{t('home.todaySpecials')}</h3>
            <p className="text-xs text-[rgb(var(--muted))] mt-1">Selección fresca de nuestra barra de sushi y robata</p>
          </div>
          <Link href="/menu" className="text-xs text-[rgb(var(--primary))] hover:underline flex items-center gap-1">
            <span>{t('home.viewDishes')}</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-56 bg-[rgb(var(--surface))] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {signatureDishes.map((dish) => (
              <div
                key={dish.id}
                className="bg-[rgb(var(--surface))] border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-white/10 transition-colors group"
              >
                <div className="space-y-2">
                  <div className="h-28 rounded-lg bg-[rgb(var(--background))] border border-white/5 flex items-center justify-center relative overflow-hidden">
                    {/* Art plate representation (§3) */}
                    <div
                      className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center font-display text-sm font-bold text-white/40"
                      style={{
                        background: `radial-gradient(circle, hsl(${dish.art.hue}, 40%, 25%) 0%, hsl(${dish.art.hue}, 60%, 10%) 100%)`,
                      }}
                    >
                      {dish.names.ja?.slice(0, 2) || '鮮'}
                    </div>
                  </div>
                  <h4 className="font-display text-sm font-bold text-[rgb(var(--text))] group-hover:text-[rgb(var(--primary))] transition-colors line-clamp-1">
                    {dish.names.es || dish.names.en}
                  </h4>
                  <p className="text-[11px] text-[rgb(var(--muted))] line-clamp-2">
                    {dish.descriptions.es || dish.descriptions.en}
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-white/5 mt-3">
                  <Price amountMinor={dish.price} className="text-sm font-semibold text-[rgb(var(--text))]" />
                  <button
                    onClick={() => addToCart(dish)}
                    className="px-3 py-1.5 bg-[rgb(var(--secondary))] hover:bg-[rgb(var(--primary))] hover:text-[rgb(var(--on-primary))] text-xs font-semibold rounded-md transition-colors"
                  >
                    + {t('menu.addToCart')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
