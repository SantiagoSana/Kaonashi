import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Lock, User, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LanguageSwitcherInline } from '../../components/LanguageSwitcherInline';

function safeReturnTo(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export const StaffLogin: React.FC = () => {
  const [, setLocation] = useLocation();
  const { t, refreshSession, session, sessionLoaded, config } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'), '/admin/dashboard');

  useEffect(() => {
    if (sessionLoaded && session?.kind === 'staff' && !mustChange) setLocation(returnTo);
  }, [sessionLoaded, session]);

  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const secondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const isLocked = secondsLeft > 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || isLocked) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setLockedUntil(Date.now() + (data.retryAfterSeconds || 900) * 1000);
        setError('locked');
      } else if (!res.ok) {
        setError('invalidCredentials');
        setAttemptsLeft(typeof data.attemptsLeft === 'number' ? data.attemptsLeft : null);
      } else {
        try {
          new BroadcastChannel('kns-auth').postMessage('login');
        } catch {}
        if (data.nextStep === 'change_password') {
          setMustChange(true);
          await refreshSession();
        } else {
          await refreshSession();
          setLocation(returnTo);
        }
      }
    } catch {
      setError('networkError');
    } finally {
      setPending(false);
      setPassword('');
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword }) });
    setPending(false);
    if (!res.ok) return setError('weakPassword');
    setLocation(returnTo);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[rgb(var(--background))]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-[rgb(var(--text))]">
            KAONASHI <span className="text-[rgb(var(--primary))]">顔</span>
          </Link>
          <LanguageSwitcherInline />
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[rgb(var(--primary))]">
              <ShieldCheck size={18} />
              <h1 className="font-display text-lg font-bold text-[rgb(var(--text))]">{mustChange ? t('auth.changePassword') : t('auth.staffTitle')}</h1>
            </div>
            {!mustChange && <p className="text-xs text-[rgb(var(--muted))]">{t('auth.staffSubtitle')}</p>}
          </div>

          {mustChange ? (
            <form onSubmit={changePassword} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[rgb(var(--muted))]">{t('auth.newPassword')}</span>
                <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={12}
                  className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-3 text-sm text-[rgb(var(--text))] focus:outline-none focus:border-[rgb(var(--primary))]" />
              </label>
              {error && <p role="alert" className="text-xs text-[rgb(var(--accent))]">{t(`auth.${error}`)}</p>}
              <button disabled={pending} className="w-full min-h-[44px] rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-sm disabled:opacity-50">{t('auth.save')}</button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[rgb(var(--muted))]">{t('auth.username')}</span>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]" />
                  <input name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm text-[rgb(var(--text))] focus:outline-none focus:border-[rgb(var(--primary))]" />
                </div>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[rgb(var(--muted))]">{t('auth.password')}</span>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]" />
                  <input name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm text-[rgb(var(--text))] focus:outline-none focus:border-[rgb(var(--primary))]" />
                </div>
              </label>

              {error && (
                <div role="alert" className="flex gap-2 items-start text-xs bg-[rgb(var(--accent))]/10 border border-[rgb(var(--accent))]/30 text-[rgb(var(--text))] rounded-xl p-3">
                  <AlertTriangle size={14} className="text-[rgb(var(--accent))] shrink-0 mt-0.5" />
                  <span>
                    {error === 'locked' ? t('auth.locked', { time: fmt(secondsLeft) }) : t(`auth.${error}`)}
                    {error === 'invalidCredentials' && attemptsLeft !== null && <span className="block text-[rgb(var(--muted))] mt-0.5">{t('auth.attemptsLeft', { n: attemptsLeft })}</span>}
                  </span>
                </div>
              )}

              <button type="submit" disabled={pending || isLocked || !username || !password}
                className="w-full min-h-[44px] rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-sm transition-opacity disabled:opacity-50">
                {pending ? t('auth.signingIn') : isLocked ? fmt(secondsLeft) : t('auth.signIn')}
              </button>
              {config?.demoMode && <p className="text-[11px] text-center text-[rgb(var(--muted))]">{t('auth.demoAccounts')}</p>}
            </form>
          )}
        </div>

        <p className="text-center text-xs">
          <Link href="/account/login" className="text-[rgb(var(--primary))] hover:underline">{t('auth.customerLink')}</Link>
        </p>
      </div>
    </div>
  );
};
