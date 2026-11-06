import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale, DisplayCurrency, MenuItem, Coupon, Order, Branch, StaffRole } from '../lib/types';
import { getTranslation } from '../lib/i18n';
import { computePricing, PricingResult } from '../lib/pricing';

export interface CartItem {
  item: MenuItem;
  qty: number;
  selectedModifiers?: { id: string; name: string; priceMinor: number }[];
}

export interface AppContextType {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  currency: DisplayCurrency;
  setCurrency: (cur: DisplayCurrency) => void;
  theme: string;
  setTheme: (t: string) => void;
  activeBranch: Branch;
  setActiveBranch: (b: Branch) => void;
  branches: Branch[];

  // Cart & Pricing
  cart: CartItem[];
  addToCart: (item: MenuItem, qty?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQty: (itemId: string, qty: number) => void;
  clearCart: () => void;
  cartTotalCount: number;
  activeCoupon: Coupon | null;
  setActiveCoupon: (c: Coupon | null) => void;
  setWalletCoupon: (c: Coupon | null) => void;
  appliedCouponCode: string;
  setAppliedCouponCode: (code: string) => void;
  pricing: PricingResult;

  // Notification helper
  notification: string | null;
  showNotification: (msg: string) => void;

  // Session (always the server's view; never trusted for authorization)
  session: { kind: 'customer' | 'staff'; role: StaffRole; email: string; name: string; userId: string; permissions?: string[]; branchIds?: string[] } | null;
  sessionLoaded: boolean;
  setSession: (s: any) => void;
  refreshSession: () => Promise<any>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  config: { demoMode: boolean; backend: string; ephemeral: boolean; googleClientId: string | null; emailSimulated: boolean; privacyContact?: string | null } | null;

  // Translation helper
  t: (keyPath: string, params?: Record<string, string | number>) => string;
}

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_BRANCH: Branch = {
  id: 'branch_central',
  name: 'Kaonashi Central',
  slug: 'central',
  address: 'Calle 85 # 12-44, Bogotá',
  timezone: 'America/Bogota',
  country: 'Colombia',
  currency: 'COP',
  taxRate: 0.19,
  taxMode: 'inclusive',
  hours: '12:00 - 23:00',
  theme: 'kyoto',
  isPopUp: false,
  attributionConsentMode: 'implied',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('es');
  const [currency, setCurrencyState] = useState<DisplayCurrency>('COP');
  const [theme, setThemeState] = useState<string>('kyoto');
  const [activeBranch, setActiveBranch] = useState<Branch>(DEFAULT_BRANCH);
  const [branches, setBranches] = useState<Branch[]>([DEFAULT_BRANCH]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [config, setConfig] = useState<AppContextType['config']>(null);

  const refreshSession = async () => {
    try {
      const r = await fetch('/api/auth/session', { credentials: 'same-origin' });
      const data = await r.json();
      setSession(data.session || null);
      return data.session || null;
    } catch {
      return null;
    } finally {
      setSessionLoaded(true);
    }
  };

  const loadWallet = () =>
    fetch('/api/wallet')
      .then((r) => r.json())
      .then((data) => {
        const c = data.coupons?.[0];
        setActiveCoupon(c || null);
        setAppliedCouponCode(c?.code || '');
      })
      .catch(() => {});

  // Other tabs sign in/out → this tab follows within a moment (§10.1b).
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('kns-auth');
    ch.onmessage = () => {
      setCart([]);
      refreshSession();
      loadWallet();
    };
    return () => ch.close();
  }, []);

  // Initialize from cookies and check current session
  useEffect(() => {
    // Read cookies
    const cookies = document.cookie.split('; ').reduce((acc, c) => {
      const [k, v] = c.split('=');
      acc[k] = v;
      return acc;
    }, {} as Record<string, string>);

    if (cookies.kns_locale && ['es', 'en', 'ja'].includes(cookies.kns_locale)) {
      setLocaleState(cookies.kns_locale as Locale);
    }
    if (cookies.kns_currency && ['COP', 'USD', 'EUR', 'JPY'].includes(cookies.kns_currency)) {
      setCurrencyState(cookies.kns_currency as DisplayCurrency);
    }

    refreshSession();
    loadWallet();
    fetch('/api/config').then((r) => r.json()).then(setConfig).catch(() => {});
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((data) => {
        if (data.branches?.length) {
          setBranches(data.branches);
          setActiveBranch((prev) => data.branches.find((b: Branch) => b.id === prev.id) || data.branches[0]);
        }
      })
      .catch(() => {});
  }, []);

  // Update theme data-attribute on document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Update html lang attribute
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const setLocale = (newLoc: Locale) => {
    setLocaleState(newLoc);
    document.cookie = `kns_locale=${newLoc}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const setCurrency = (newCur: DisplayCurrency) => {
    setCurrencyState(newCur);
    document.cookie = `kns_currency=${newCur}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
  };

  const addToCart = (item: MenuItem, qty: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) => (ci.item.id === item.id ? { ...ci, qty: ci.qty + qty } : ci));
      }
      return [...prev, { item, qty }];
    });

    // Client track event (§5.10)
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: crypto.randomUUID(),
        type: 'add_to_cart',
        path: window.location.pathname,
        campaignId: activeCoupon?.campaignId,
      }),
    }).catch(() => {});
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  const updateCartQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) => prev.map((ci) => (ci.item.id === itemId ? { ...ci, qty } : ci)));
  };

  const clearCart = () => setCart([]);

  const cartTotalCount = cart.reduce((acc, ci) => acc + ci.qty, 0);

  // Compute pricing
  const pricing = computePricing({
    branchId: activeBranch.id,
    currency,
    lines: cart,
    coupon: activeCoupon,
    orderType: 'dine_in',
    tipPercentOrCustom: 10,
    taxRate: activeBranch.taxRate,
    taxMode: activeBranch.taxMode,
  });

  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const setWalletCoupon = (c: Coupon | null) => {
    setActiveCoupon(c);
    if (c?.code) {
      setAppliedCouponCode(c.code);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setSession(null);
    setCart([]);
    setActiveCoupon(null);
    setAppliedCouponCode('');
    try {
      new BroadcastChannel('kns-auth').postMessage('logout');
    } catch {}
    window.location.href = '/';
  };

  const can = (permission: string) => Boolean(session?.kind === 'staff' && session.permissions?.includes(permission));

  const t = (keyPath: string, params?: Record<string, string | number>) => {
    return getTranslation(locale, keyPath, params);
  };

  return (
    <AppContext.Provider
      value={{
        locale,
        setLocale,
        currency,
        setCurrency,
        theme,
        setTheme,
        activeBranch,
        setActiveBranch,
        branches,
        cart,
        addToCart,
        removeFromCart,
        updateCartQty,
        clearCart,
        cartTotalCount,
        activeCoupon,
        setActiveCoupon,
        setWalletCoupon,
        appliedCouponCode,
        setAppliedCouponCode,
        pricing,
        notification,
        showNotification,
        session,
        sessionLoaded,
        setSession,
        refreshSession,
        logout,
        can,
        config,
        t,
      }}
    >
      {children}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-[#1E1E24] text-white border border-[#D4AF37]/50 py-2.5 px-4 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
          <span>{notification}</span>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
