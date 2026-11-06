import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useApp } from '../context/AppContext';
import { Price } from './Price';
import {
  ShoppingBag,
  Globe,
  Coins,
  MapPin,
  User,
  Sparkles,
  UtensilsCrossed,
  Calendar,
  Award,
  Clock,
  ShieldAlert,
  X,
  ExternalLink,
} from 'lucide-react';
import { Locale, DisplayCurrency } from '../lib/types';

export const Navigation: React.FC<{ onOpenCart: () => void }> = ({ onOpenCart }) => {
  const [location] = useLocation();
  const {
    locale,
    setLocale,
    currency,
    setCurrency,
    activeBranch,
    cartTotalCount,
    pricing,
    activeCoupon,
    session,
    logout,
    t,
  } = useApp();

  const [cookieBlocked, setCookieBlocked] = useState(false);

  // Check if inside iframe and cookies blocked
  React.useEffect(() => {
    if (window.self !== window.top) {
      if (!document.cookie.includes('kns_')) {
        setCookieBlocked(true);
      }
    }
  }, []);

  const isAdminRoute = location.startsWith('/admin');

  return (
    <>
      {/* Cookie Probe Banner for iFrame Preview (§10.2) */}
      {cookieBlocked && (
        <div className="bg-[rgb(var(--accent))] text-white text-xs px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>El navegador en el iframe bloquea cookies de sesión. Abre la app en una nueva pestaña para guardar sesiones.</span>
          </div>
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold flex items-center gap-1"
          >
            Abrir en nueva pestaña <ExternalLink size={12} />
          </a>
        </div>
      )}

      {/* Sticky Active Coupon Pill (§6.1) */}
      {activeCoupon && !isAdminRoute && (
        <div className="bg-gradient-to-r from-[rgb(var(--secondary))] to-[rgb(var(--surface))] border-b border-[rgb(var(--primary))]/30 px-4 py-1.5 text-xs text-[rgb(var(--text))] flex items-center justify-between z-40">
          <div className="flex items-center gap-2 max-w-xl mx-auto w-full justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles size={14} className="text-[rgb(var(--primary))]" />
              <span className="font-mono font-bold text-[rgb(var(--primary))] tracking-wider">
                {activeCoupon.code}
              </span>
              <span className="hidden sm:inline">· {t('cart.applied')}</span>
            </span>
            {pricing.savingsTotalMinor > 0 && (
              <span className="bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] px-2 py-0.5 rounded-full font-semibold">
                {t('cart.savings')}: <Price amountMinor={pricing.savingsTotalMinor} />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Global Header */}
      <header className="sticky top-0 z-30 bg-[rgb(var(--surface))]/90 backdrop-blur-md border-b border-white/5 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-3 group min-w-0 shrink">
            <div className="hidden sm:flex w-10 h-10 rounded-full border border-[rgb(var(--primary))]/40 items-center justify-center relative overflow-hidden bg-[rgb(var(--background))] group-hover:border-[rgb(var(--primary))] transition-colors">
              <div className="w-7 h-7 rounded-full border border-[rgb(var(--primary))] border-t-transparent animate-[spin_12s_linear_infinite]" />
              <div className="absolute w-2 h-2 rounded-full bg-[rgb(var(--accent))]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-bold text-base sm:text-xl tracking-wider text-[rgb(var(--text))]">
                  KAONASHI
                </span>
                <span className="hidden sm:inline text-xs text-[rgb(var(--primary))] font-display">顔無</span>
              </div>
              <span className="hidden sm:block text-[10px] text-[rgb(var(--muted))] uppercase tracking-widest -mt-1">
                Phygital Izakaya
              </span>
            </div>
          </Link>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[rgb(var(--text))]">
            <Link
              href="/menu"
              className={`hover:text-[rgb(var(--primary))] transition-colors ${
                location === '/menu' ? 'text-[rgb(var(--primary))] font-semibold' : ''
              }`}
            >
              {t('nav.menu')}
            </Link>
            <Link
              href="/reservations"
              className={`hover:text-[rgb(var(--primary))] transition-colors ${
                location === '/reservations' ? 'text-[rgb(var(--primary))] font-semibold' : ''
              }`}
            >
              {t('nav.reserve')}
            </Link>
            <Link
              href="/rewards"
              className={`hover:text-[rgb(var(--primary))] transition-colors ${
                location === '/rewards' ? 'text-[rgb(var(--primary))] font-semibold' : ''
              }`}
            >
              {t('nav.rewards')}
            </Link>
            <Link
              href="/admin/dashboard"
              className={`text-xs border border-[rgb(var(--primary))]/40 px-2.5 py-1 rounded-full text-[rgb(var(--primary))] hover:bg-[rgb(var(--primary))]/10 transition-colors flex items-center gap-1.5`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--primary))]" />
              {t('nav.admin')}
            </Link>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Branch Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-[rgb(var(--muted))] bg-[rgb(var(--background))] border border-white/5 px-2.5 py-1 rounded-md">
              <MapPin size={12} className="text-[rgb(var(--primary))]" />
              <span>{activeBranch.name}</span>
            </div>

            {/* Language Switcher (§6.9) */}
            <div className="flex items-center border border-white/10 rounded-md overflow-hidden bg-[rgb(var(--background))] text-xs font-medium">
              {(['es', 'en', 'ja'] as Locale[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocale(loc)}
                  aria-current={locale === loc ? 'true' : undefined}
                  className={`px-1.5 sm:px-2 py-1 uppercase transition-colors ${
                    locale === loc
                      ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold'
                      : 'text-[rgb(var(--muted))] hover:text-white'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>

            {/* Display Currency Switcher (§6.10) */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
              className="bg-[rgb(var(--background))] border border-white/10 text-xs text-[rgb(var(--text))] px-1 sm:px-2 py-1 rounded-md font-mono focus:outline-none focus:border-[rgb(var(--primary))]"
              aria-label="Select display currency"
            >
              <option value="COP">COP ($)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="JPY">JPY (¥)</option>
            </select>

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative p-2 rounded-full bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] hover:opacity-90 transition-opacity flex items-center justify-center"
              aria-label="Open Cart"
            >
              <ShoppingBag size={18} />
              {cartTotalCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[rgb(var(--accent))] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartTotalCount}
                </span>
              )}
            </button>

            {/* User Session Profile / Login */}
            {session ? (
              <div className="flex items-center gap-2">
                <Link
                  href={session.kind === 'staff' ? '/admin/dashboard' : '/account'}
                  className="flex items-center gap-1.5 text-xs bg-[rgb(var(--background))] border border-white/10 px-2.5 py-1.5 rounded-md hover:border-white/20"
                >
                  <User size={13} className="text-[rgb(var(--primary))]" />
                  <span className="hidden sm:inline max-w-[80px] truncate">{session.name}</span>
                </Link>
                <button
                  onClick={logout}
                  className="text-xs text-[rgb(var(--muted))] hover:text-white"
                  title={t('auth.signOut')} aria-label={t('auth.signOut')}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <Link
                href="/account/login"
                className="text-xs text-[rgb(var(--muted))] hover:text-white flex items-center gap-1 border border-white/10 px-2 py-1 rounded-md"
              >
                <User size={13} />
                <span className="hidden sm:inline">{t('nav.signIn')}</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (§6.1) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[rgb(var(--surface))]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1 flex items-center justify-around">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] ${
            location === '/' ? 'text-[rgb(var(--primary))] font-semibold' : 'text-[rgb(var(--muted))]'
          }`}
        >
          <UtensilsCrossed size={18} />
          <span>{t('nav.home')}</span>
        </Link>
        <Link
          href="/menu"
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] ${
            location.startsWith('/menu') ? 'text-[rgb(var(--primary))] font-semibold' : 'text-[rgb(var(--muted))]'
          }`}
        >
          <Sparkles size={18} />
          <span>{t('nav.menu')}</span>
        </Link>
        <Link
          href="/reservations"
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] ${
            location === '/reservations' ? 'text-[rgb(var(--primary))] font-semibold' : 'text-[rgb(var(--muted))]'
          }`}
        >
          <Calendar size={18} />
          <span>{t('nav.reserve')}</span>
        </Link>
        <Link
          href="/rewards"
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] ${
            location === '/rewards' ? 'text-[rgb(var(--primary))] font-semibold' : 'text-[rgb(var(--muted))]'
          }`}
        >
          <Award size={18} />
          <span>{t('nav.rewards')}</span>
        </Link>
        <Link
          href={session?.kind === 'staff' ? '/admin/dashboard' : '/account'}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[10px] ${
            location.startsWith('/account') || location.startsWith('/admin') ? 'text-[rgb(var(--primary))] font-semibold' : 'text-[rgb(var(--muted))]'
          }`}
        >
          <Clock size={18} />
          <span>{t('account.orders')}</span>
        </Link>
      </nav>
    </>
  );
};
