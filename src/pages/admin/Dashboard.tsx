// Executive dashboard: today's KPIs vs the same weekday last week, the last 30 days, BTL and stock alerts.
// Every figure comes from the SQL analytics endpoints; nothing here is hard-coded.
import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Sparkles, ArrowRight, AlertOctagon, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../lib/money';

const todayLocal = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const shift = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export const Dashboard: React.FC = () => {
  const { t, can, locale, activeBranch, currency } = useApp();
  const [today, setToday] = useState<any>(null);
  const [lastWeek, setLastWeek] = useState<any>(null);
  const [month, setMonth] = useState<any>(null);
  const [btl, setBtl] = useState<any>(null);
  const [inv, setInv] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [briefPending, setBriefPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const d = todayLocal();
    const get = (url: string, set: (x: any) => void) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject())).then(set).catch(() => setFailed(true));
    if (can('analytics:sales')) {
      get(`/api/admin/analytics/sales?from=${d}&to=${d}&sameTime=1`, setToday);
      get(`/api/admin/analytics/sales?from=${shift(d, -7)}&to=${shift(d, -7)}&sameTime=1`, setLastWeek);
      get(`/api/admin/analytics/sales?from=${shift(d, -29)}&to=${d}`, setMonth);
    }
    if (can('analytics:btl')) get(`/api/admin/analytics/btl?from=${shift(d, -29)}&to=${d}`, setBtl);
    if (can('analytics:inventory')) get('/api/admin/analytics/inventory', setInv);
  }, []);

  const money = (v: number) => formatMoney(v, { branchCurrency: activeBranch.currency, displayCurrency: currency, locale }).formatted;
  const compact = (v: number) => formatMoney(v, { branchCurrency: activeBranch.currency, displayCurrency: currency, locale, compact: true }).formatted;
  const num = (v: number) => new Intl.NumberFormat(locale).format(v);
  const vs = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);

  const runBrief = async () => {
    setBriefPending(true);
    const r = await fetch('/api/ai/admin/brief', { method: 'POST' });
    setBriefPending(false);
    if (r.ok) setBrief(await r.json());
  };

  const tile = (label: string, value: string, delta?: number | null, sub?: string) => (
    <div className="rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4 space-y-1 min-w-0">
      <p className="text-[11px] text-[rgb(var(--muted))] uppercase tracking-wider leading-tight min-h-[2.2em]">{label}</p>
      <p className="font-mono text-xl font-bold truncate" title={value}>{value}</p>
      {delta !== undefined && (
        <p className="text-[11px] text-[rgb(var(--muted))] flex items-center gap-1">
          {delta === null ? <Minus size={12} /> : delta >= 0 ? <TrendingUp size={12} className="text-[#199e70]" /> : <TrendingDown size={12} className="text-[#e66767]" />}
          <span className="font-mono text-[rgb(var(--text))]">{delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}</span> {sub}
        </p>
      )}
      {delta === undefined && sub && <p className="text-[11px] text-[rgb(var(--muted))]">{sub}</p>}
    </div>
  );

  const k = today?.kpis;
  const p = lastWeek?.kpis;
  const sameWeekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date());

  return (
    <div className="space-y-5 max-w-[1400px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('admin.dashboard')}</h1>
          <p className="text-xs text-[rgb(var(--muted))]">{activeBranch.name}</p>
        </div>
        <div className="flex gap-2">
          {can('analytics:sales') && (
            <button onClick={runBrief} disabled={briefPending} className="min-h-[40px] px-3 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
              <Sparkles size={14} /> {t('admin.generateBrief')}
            </button>
          )}
          <Link href="/admin/analytics" className="min-h-[40px] px-3 rounded-xl border border-white/10 text-xs font-semibold flex items-center gap-1.5 hover:border-[rgb(var(--primary))]">
            {t('admin.dataAnalytics')} <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {failed && <p role="alert" className="text-xs text-[rgb(var(--accent))]">{t('analytics.error')}</p>}

      {brief && (
        <section className="rounded-2xl border border-[rgb(var(--primary))]/30 bg-[rgb(var(--primary))]/5 p-4 space-y-3">
          <p className="text-sm">{brief.brief}</p>
          <ul className="grid md:grid-cols-2 gap-2">
            {brief.recommendations.map((r: any) => (
              <li key={r.title} className="rounded-xl bg-[rgb(var(--surface))] border border-white/5 p-3">
                <p className="text-xs font-bold">{r.title}</p>
                <p className="text-[11px] text-[rgb(var(--muted))]">{r.detail}</p>
                <p className="text-[11px] text-[rgb(var(--primary))] mt-1">{r.impact}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {k && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {tile(t('admin.dailyRevenue'), compact(k.revenue), p ? vs(k.revenue, p.revenue) : null, `vs ${sameWeekday} -7d`)}
          {tile(t('analytics.orders'), num(k.orders), p ? vs(k.orders, p.orders) : null, `vs ${sameWeekday} -7d`)}
          {tile(t('admin.averageTicket'), money(k.aov), p ? vs(k.aov, p.aov) : null, `vs ${sameWeekday} -7d`)}
          {tile(t('admin.prepTime'), `${k.avgPrepMinutes} min`)}
          {tile(t('admin.btlShare'), k.btlShare === null ? '—' : `${k.btlShare}%`)}
          {tile(t('admin.kitchenActive'), num(k.inKitchen))}
        </div>
      )}

      <div className="grid xl:grid-cols-3 gap-4">
        {month && (
          <section className="xl:col-span-2 rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4 space-y-2 min-w-0">
            <div className="flex justify-between items-baseline">
              <h2 className="text-sm font-bold">{t('analytics.revenue')} · {t('analytics.last30')}</h2>
              <span className="font-mono text-sm">{compact(month.kpis.revenue)}</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={month.daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={1}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} tickFormatter={(s) => s.slice(5)} minTickGap={20} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} tickFormatter={compact} width={64} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: any) => money(Number(v))} contentStyle={{ background: '#14171D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                  <Bar dataKey="revenue" name={t('analytics.revenue')} fill="#3987e5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
        {inv && (
          <section className="rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4 space-y-2">
            <h2 className="text-sm font-bold">{t('analytics.tabInventory')}</h2>
            <ul className="space-y-1.5">
              {inv.items.filter((i: any) => i.status !== 'ok').slice(0, 6).map((i: any) => (
                <li key={i.sku} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {i.status === 'critical' ? <AlertOctagon size={13} className="text-[#e66767] shrink-0" /> : <AlertTriangle size={13} className="text-[#c98500] shrink-0" />}
                    <span className="truncate">{i.name}</span>
                  </span>
                  <span className="font-mono text-[rgb(var(--muted))] shrink-0">{i.daysOfCover ?? '—'} d · {t(`analytics.${i.status}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {btl && (
        <section className="rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2 items-baseline">
            <h2 className="text-sm font-bold">{t('analytics.leaderboard')} · {t('analytics.last30')}</h2>
            <span className="text-xs text-[rgb(var(--muted))]">ROAS <span className="font-mono text-[rgb(var(--text))]">{btl.kpis.roas ?? '—'}x</span> · {t('analytics.cpo')} <span className="font-mono text-[rgb(var(--text))]">{btl.kpis.costPerOrder ? money(btl.kpis.costPerOrder) : '—'}</span></span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {btl.leaderboard.slice(0, 8).map((x: any) => (
              <div key={x.id} className="rounded-xl border border-white/5 p-3 space-y-0.5">
                <p className="text-xs font-semibold truncate">{x.label}</p>
                <p className="text-[11px] text-[rgb(var(--muted))]">{num(x.scans)} {t('analytics.scans').toLowerCase()} · {num(x.orders)} {t('analytics.orders').toLowerCase()}</p>
                <p className="text-[11px]"><span className="font-mono">{x.roas !== null ? `${x.roas}x` : '—'}</span> · {t(`analytics.${x.tag}`)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
