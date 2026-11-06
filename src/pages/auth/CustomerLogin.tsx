import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Mail, ArrowLeft, Inbox } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LanguageSwitcherInline } from '../../components/LanguageSwitcherInline';

declare global {
  interface Window {
    google?: any;
  }
}

function safeReturnTo(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** /account/login (step 1) and /account/verify (step 2). Step 2 only renders with a live challenge. */
export const CustomerLogin: React.FC<{ step: 'login' | 'verify' }> = ({ step }) => {
  const [, setLocation] = useLocation();
  const { t, config, session, sessionLoaded, refreshSession, showNotification, logout } = useApp();
  const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'), '/account');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorParams, setErrorParams] = useState<Record<string, number | string>>({});
  const [pending, setPending] = useState(false);
  const [challenge, setChallenge] = useState<any>(null);
  const [checking, setChecking] = useState(step === 'verify');
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const [chooser, setChooser] = useState(false);
  const googleDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Step 2 requires a pending challenge; otherwise go back to step 1.
  useEffect(() => {
    if (step !== 'verify') return;
    fetch('/api/auth/otp/challenge')
      .then((r) => r.json())
      .then((d) => {
        if (!d.challenge) setLocation(`/account/login?returnTo=${encodeURIComponent(returnTo)}`);
        else setChallenge(d.challenge);
      })
      .catch(() => setLocation('/account/login'))
      .finally(() => setChecking(false));
  }, [step]);

  const finish = async (data: any) => {
    try {
      new BroadcastChannel('kns-auth').postMessage('login');
    } catch {}
    await refreshSession();
    showNotification(t('auth.signedInAs', { name: data.customer?.name || '' }));
    setLocation(data.returnTo || returnTo);
  };

  // Real Google Identity Services button when a client id is configured.
  useEffect(() => {
    if (step !== 'login' || !config?.googleClientId || !googleDiv.current) return;
    const render = () => {
      window.google?.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async (resp: any) => {
          setPending(true);
          const r = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: resp.credential, returnTo }) });
          const d = await r.json().catch(() => ({}));
          setPending(false);
          if (r.ok) finish(d);
          else setError('networkError');
        },
        ux_mode: 'popup',
        cancel_on_tap_outside: true,
      });
      window.google?.accounts.id.renderButton(googleDiv.current, { theme: 'filled_black', size: 'large', shape: 'pill', width: 320, text: 'continue_with' });
    };
    if (window.google?.accounts?.id) return render();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [step, config?.googleClientId]);

  const simulatedGoogle = async (who: 'a' | 'b') => {
    setPending(true);
    const r = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ simulatedIdentity: who, returnTo }) });
    const d = await r.json().catch(() => ({}));
    setPending(false);
    if (r.ok) finish(d);
    else setError('networkError');
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pending) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) return setError('emailInvalid');
    setPending(true);
    try {
      const r = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error === 'EMAIL_INVALID' ? 'emailInvalid' : 'networkError');
      else setLocation(`/account/verify?returnTo=${encodeURIComponent(returnTo)}`);
    } catch {
      setError('networkError');
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setPending(true);
    setError(null);
    const r = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setPending(false);
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) setError(d.error === 'RESEND_LIMIT' ? 'resendLimit' : 'networkError');
    const c = await (await fetch('/api/auth/otp/challenge')).json();
    if (c.challenge) setChallenge(c.challenge);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || code.length !== 6) return;
    setPending(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, returnTo }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return finish(d);
      if (d.error === 'INVALID_CODE') {
        setError('wrongCode');
        setErrorParams({ n: d.attemptsLeft });
        setChallenge((c: any) => ({ ...c, attemptsLeft: d.attemptsLeft }));
      } else if (d.error === 'CODE_EXPIRED' || d.error === 'TOO_MANY_ATTEMPTS' || d.error === 'CHALLENGE_NOT_FOUND') {
        showNotification(t(d.error === 'TOO_MANY_ATTEMPTS' ? 'auth.tooManyAttempts' : 'auth.codeExpired'));
        setLocation(`/account/login?returnTo=${encodeURIComponent(returnTo)}`);
      } else setError('networkError');
    } catch {
      setError('networkError');
    } finally {
      setPending(false);
      setCode('');
    }
  };

  const card = 'bg-[rgb(var(--surface))] border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl';
  const input = 'w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-3 text-sm text-[rgb(var(--text))] focus:outline-none focus:border-[rgb(var(--primary))]';
  const cooldown = challenge ? Math.max(0, 30 - Math.floor((now - new Date(challenge.lastSentAt).getTime()) / 1000)) : 0;
  const expiresIn = challenge ? Math.max(0, Math.floor((new Date(challenge.expiresAt).getTime() - now) / 1000)) : 0;

  let body: React.ReactNode;
  if (sessionLoaded && session?.kind === 'staff') {
    body = (
      <div className={card}>
        <p className="text-sm text-[rgb(var(--text))]">{t('auth.staffSessionOnCustomer')}</p>
        <button onClick={logout} className="w-full min-h-[44px] rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-sm">{t('auth.signOut')}</button>
      </div>
    );
  } else if (step === 'verify') {
    body = checking || !challenge ? (
      <div className={card}><p className="text-sm text-[rgb(var(--muted))]">{t('auth.checking')}</p></div>
    ) : (
      <div className={card}>
        <div className="space-y-1">
          <h1 className="font-display text-lg font-bold text-[rgb(var(--text))]">{t('auth.verifyTitle')}</h1>
          <p className="text-xs text-[rgb(var(--muted))]">{t('auth.verifySubtitle', { email: challenge.maskedEmail })}</p>
        </div>
        {challenge.simulatedCode && (
          <div className="rounded-xl border border-dashed border-[rgb(var(--primary))]/60 bg-[rgb(var(--primary))]/10 p-3 space-y-1" aria-live="polite">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-[rgb(var(--primary))]"><Inbox size={13} />{t('auth.simulatedMailbox')}</div>
            <p className="text-[11px] text-[rgb(var(--muted))]">{t('auth.simulatedMailboxHint')}</p>
            <p className="font-mono text-2xl tracking-[0.4em] text-[rgb(var(--text))]" data-testid="simulated-code">{challenge.simulatedCode}</p>
          </div>
        )}
        <form onSubmit={verify} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[rgb(var(--muted))]">{t('auth.code')}</span>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
              className={`${input} font-mono text-xl tracking-[0.5em] text-center`} aria-describedby="code-help" />
          </label>
          <p id="code-help" className="text-[11px] text-[rgb(var(--muted))] flex justify-between">
            <span>{t('auth.attemptsLeft', { n: challenge.attemptsLeft })}</span>
            <span className="font-mono">{Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, '0')}</span>
          </p>
          {error && <p role="alert" className="text-xs text-[rgb(var(--accent))]">{t(`auth.${error}`, errorParams)}</p>}
          <button disabled={pending || code.length !== 6} className="w-full min-h-[44px] rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-sm disabled:opacity-50">{t('auth.verify')}</button>
        </form>
        <div className="flex justify-between text-xs">
          <Link href={`/account/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] flex items-center gap-1"><ArrowLeft size={12} />{t('auth.useOtherEmail')}</Link>
          <button type="button" onClick={resend} disabled={pending || cooldown > 0 || challenge.resendsLeft <= 0} className="text-[rgb(var(--primary))] disabled:text-[rgb(var(--muted))]">
            {cooldown > 0 ? t('auth.resendIn', { s: cooldown }) : t('auth.resend')}
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className={card}>
        <div className="space-y-1">
          <h1 className="font-display text-lg font-bold text-[rgb(var(--text))]">{t('auth.customerTitle')}</h1>
          <p className="text-xs text-[rgb(var(--muted))]">{t('auth.customerSubtitle')}</p>
        </div>

        {config?.googleClientId ? (
          <div ref={googleDiv} className="flex justify-center min-h-[44px]" />
        ) : config?.demoMode ? (
          chooser ? (
            <div className="space-y-2 rounded-xl border border-white/10 p-3">
              <p className="text-[11px] font-semibold text-[rgb(var(--muted))]">{t('auth.chooseAccount')}</p>
              {[{ id: 'a' as const, name: 'Mia Larsson', email: 'mia_guest@example.com' }, { id: 'b' as const, name: 'Kenji Tanaka', email: 'kenji.tanaka@example.com' }].map((p) => (
                <button key={p.id} onClick={() => simulatedGoogle(p.id)} disabled={pending} className="w-full text-left min-h-[44px] px-3 rounded-lg hover:bg-white/5 border border-white/5">
                  <span className="block text-sm text-[rgb(var(--text))]">{p.name}</span>
                  <span className="block text-[11px] text-[rgb(var(--muted))]">{p.email}</span>
                </button>
              ))}
            </div>
          ) : (
            <button onClick={() => setChooser(true)} className="w-full min-h-[44px] rounded-full bg-white text-[#1f1f1f] font-semibold text-sm flex items-center justify-center gap-2">
              <GoogleG /> {t('auth.googleSimulated')}
            </button>
          )
        ) : (
          <button disabled className="w-full min-h-[44px] rounded-full bg-white/40 text-[#1f1f1f] font-semibold text-sm flex items-center justify-center gap-2" title={t('auth.googleUnavailable')}>
            <GoogleG /> {t('auth.continueGoogle')}
          </button>
        )}
        {!config?.googleClientId && !config?.demoMode && <p className="text-[11px] text-[rgb(var(--muted))]">{t('auth.googleUnavailable')}</p>}

        <div className="flex items-center gap-3 text-[11px] text-[rgb(var(--muted))]"><span className="h-px flex-1 bg-white/10" />{t('auth.or')}<span className="h-px flex-1 bg-white/10" /></div>

        <form onSubmit={sendCode} className="space-y-3" noValidate>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[rgb(var(--muted))]">{t('auth.email')}</span>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]" />
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} pl-9`} />
            </div>
          </label>
          {error && <p role="alert" className="text-xs text-[rgb(var(--accent))]">{t(`auth.${error}`)}</p>}
          <button disabled={pending} className="w-full min-h-[44px] rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-sm disabled:opacity-50">
            {pending ? t('auth.sending') : t('auth.sendCode')}
          </button>
        </form>
        <p className="text-[11px] text-[rgb(var(--muted))]">{t('auth.termsNotice')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[rgb(var(--background))]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-[rgb(var(--text))]">KAONASHI <span className="text-[rgb(var(--primary))]">顔</span></Link>
          <LanguageSwitcherInline />
        </div>
        {body}
        <p className="text-center text-xs"><Link href="/login" className="text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]">{t('auth.staffLink')}</Link></p>
      </div>
    </div>
  );
};
