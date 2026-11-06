import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LogOut, Award, Receipt } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Price } from '../components/Price';

export const Account: React.FC = () => {
  const [, setLocation] = useLocation();
  const { t, session, sessionLoaded, logout, showNotification, locale } = useApp();
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session) {
      setLocation('/account/login?returnTo=/account');
      return;
    }
    if (session.kind !== 'customer') return;
    fetch('/api/account')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setName(d?.customer?.name || '');
        setPhone(d?.customer?.phone || '');
      });
  }, [sessionLoaded, session]);

  if (sessionLoaded && session?.kind === 'staff') {
    return (
      <div className="max-w-md mx-auto px-4 py-12 space-y-4">
        <p className="text-sm">{t('auth.staffSessionOnCustomer')}</p>
        <div className="flex gap-2">
          <button onClick={logout} className="min-h-[44px] px-4 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-sm">{t('auth.signOut')}</button>
          <Link href="/admin/dashboard" className="min-h-[44px] px-4 rounded-xl border border-white/10 text-sm flex items-center">{t('auth.backToPanel')}</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
      </div>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone }) });
    setSaving(false);
    if (r.ok) showNotification(t('account.saved'));
  };

  const del = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    await fetch('/api/account/delete', { method: 'POST' });
    window.location.href = '/';
  };

  const loyalty = data.loyalty;
  const fmtDate = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(iso));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 pb-28">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('account.title')}</h1>
          <p className="text-xs text-[rgb(var(--muted))]">{data.customer?.email}</p>
        </div>
        <button onClick={logout} className="min-h-[44px] px-3 rounded-xl border border-white/10 text-xs flex items-center gap-1.5 hover:border-[rgb(var(--accent))]">
          <LogOut size={14} /> {t('auth.signOut')}
        </button>
      </div>

      {loyalty && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4">
            <p className="text-[11px] text-[rgb(var(--muted))] uppercase tracking-wider">{t('account.points')}</p>
            <p className="font-mono text-2xl font-bold text-[rgb(var(--primary))]">{new Intl.NumberFormat(locale).format(loyalty.pointsBalance)}</p>
          </div>
          <div className="rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4">
            <p className="text-[11px] text-[rgb(var(--muted))] uppercase tracking-wider">{t('account.tier')}</p>
            <p className="font-display text-lg font-bold flex items-center gap-1.5"><Award size={16} className="text-[rgb(var(--primary))]" />{t(`account.${loyalty.tier}`)}</p>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold flex items-center gap-2"><Receipt size={16} />{t('account.orders')}</h2>
        {data.orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center space-y-3">
            <p className="text-sm text-[rgb(var(--muted))]">{t('account.noOrders')}</p>
            <Link href="/menu" className="inline-flex min-h-[44px] items-center px-4 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] text-sm font-bold">{t('account.goToMenu')}</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.orders.map((o: any) => (
              <li key={o.id} className="rounded-xl bg-[rgb(var(--surface))] border border-white/5 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{o.orderNumber} <span className="text-[11px] font-normal text-[rgb(var(--muted))]">· {fmtDate(o.createdAt)}</span></p>
                  <p className="text-xs text-[rgb(var(--muted))] truncate">{o.items.map((i: any) => `${i.qty}× ${i.name}`).join(', ')}</p>
                </div>
                <div className="text-right shrink-0">
                  <Price amountMinor={o.totalMinor} className="text-sm font-bold" />
                  <Link href={`/order/${o.id}?t=${o.token}`} className="block text-[11px] text-[rgb(var(--primary))]">{t('account.track')}</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4 space-y-3">
        <h2 className="font-display text-lg font-bold">{t('account.profile')}</h2>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-[rgb(var(--muted))]">{t('account.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[rgb(var(--muted))]">{t('account.phone')}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2 justify-between">
            <button disabled={saving} className="min-h-[44px] px-4 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] text-sm font-bold disabled:opacity-50">{t('auth.save')}</button>
            <button type="button" onClick={del} className="min-h-[44px] px-3 text-xs text-[rgb(var(--accent))]">{confirmDelete ? t('account.deleteConfirm') : t('account.deleteAccount')}</button>
          </div>
        </form>
      </section>
    </div>
  );
};
