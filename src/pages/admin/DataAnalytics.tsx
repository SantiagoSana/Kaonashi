// KAONASHI DATA ANALYTICS — four views over the full history, every number computed in SQL on the server.
import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ScatterChart, Scatter,
  ZAxis, ReferenceLine, Cell,
} from 'recharts';
import { Download, RefreshCw, AlertTriangle, CheckCircle2, AlertOctagon, TrendingUp, TrendingDown, Minus, Database } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../lib/money';

// Validated categorical palette (dark steps), assigned in fixed order. Sequential = single blue hue.
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const SEQ = '57, 135, 229';
const GRID = 'rgba(255,255,255,0.06)';
const AXIS = { fontSize: 11, fill: 'rgb(var(--muted))' } as const;
const DOW_ES = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DOW: Record<string, string[]> = { es: DOW_ES, en: ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ja: ['', '月', '火', '水', '木', '金', '土', '日'] };

type Tab = 'sales' | 'btl' | 'customers' | 'inventory';
const TAB_PERM: Record<Tab, string> = { sales: 'analytics:sales', btl: 'analytics:btl', customers: 'analytics:customers', inventory: 'analytics:inventory' };

const todayLocal = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const shift = (d: string, days: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};

export const DataAnalytics: React.FC = () => {
  const { t, can, locale, activeBranch, currency } = useApp();
  const tabs = (['sales', 'btl', 'customers', 'inventory'] as Tab[]).filter((x) => can(TAB_PERM[x]));
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem('kns_analytics_tab') as Tab | null;
      if (saved) return saved;
    } catch {}
    return 'sales';
  });
  const activeTab = tabs.includes(tab) ? tab : tabs[0];
  const [to, setTo] = useState(todayLocal());
  const [from, setFrom] = useState(shift(todayLocal(), -29));
  const [model, setModel] = useState<'last_touch' | 'first_touch'>('last_touch');
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [health, setHealth] = useState<any>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('kns_analytics_tab', activeTab);
    } catch {}
  }, [activeTab]);

  const query = `from=${from}&to=${to}${activeTab === 'btl' ? `&model=${model}` : ''}`;
  useEffect(() => {
    if (!activeTab) return;
    let cancelled = false;
    setState('loading');
    fetch(`/api/admin/analytics/${activeTab}?${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!cancelled) {
          setData({ ...d, _tab: activeTab });
          setState('ready');
        }
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [activeTab, query, reload]);

  const money = (v: number) => formatMoney(v, { branchCurrency: activeBranch.currency, displayCurrency: currency, locale }).formatted;
  const compactMoney = (v: number) => formatMoney(v, { branchCurrency: activeBranch.currency, displayCurrency: currency, locale, compact: true }).formatted;
  const num = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v));
  const count = (key: string) => health?.counts?.find((c: any) => c.collection === key)?.n || 0;

  const presets: [string, number | null][] = [['last7', 7], ['last30', 30], ['last90', 90], ['all', null]];
  const setPreset = (days: number | null) => {
    const end = todayLocal();
    setTo(end);
    setFrom(days ? shift(end, -(days - 1)) : '2026-01-01');
  };

  if (!tabs.length) return <p className="text-sm text-[rgb(var(--muted))]">{t('auth.forbidden')}</p>;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Database size={20} className="text-[rgb(var(--primary))]" />{t('analytics.title')}</h1>
          {health && (
            <p className="text-xs text-[rgb(var(--muted))]">
              {t('analytics.subtitle', { orders: num(count('orders')), scans: num(count('scanEvents')), events: num(count('funnelEvents')) })} · Postgres ({health.backend === 'neon' ? 'Neon' : 'PGlite'})
            </p>
          )}
        </div>
        {activeTab !== 'inventory' && (
          <a href={`/api/admin/analytics/${activeTab}?${query}&format=csv`} className="min-h-[40px] px-3 rounded-xl border border-white/10 text-xs font-semibold flex items-center gap-1.5 hover:border-[rgb(var(--primary))]">
            <Download size={14} /> {t('analytics.exportCsv')}
          </a>
        )}
        {activeTab === 'inventory' && (
          <a href={`/api/admin/analytics/inventory?format=csv`} className="min-h-[40px] px-3 rounded-xl border border-white/10 text-xs font-semibold flex items-center gap-1.5 hover:border-[rgb(var(--primary))]">
            <Download size={14} /> {t('analytics.exportCsv')}
          </a>
        )}
      </header>

      {health?.ephemeral && (
        <div role="status" className="flex items-center gap-2 text-xs rounded-xl border border-[rgb(var(--accent))]/40 bg-[rgb(var(--accent))]/10 p-3">
          <AlertTriangle size={14} className="text-[rgb(var(--accent))]" /> {t('analytics.ephemeralBanner')}
        </div>
      )}

      {/* Tabs + filters in one row */}
      <div className="flex flex-wrap items-center gap-3 justify-between border-b border-white/5 pb-3">
        <div role="tablist" className="flex flex-wrap gap-1">
          {tabs.map((x) => (
            <button key={x} role="tab" aria-selected={activeTab === x} onClick={() => setTab(x)}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold ${activeTab === x ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] hover:bg-white/5'}`}>
              {t(`analytics.tab${x === 'btl' ? 'Btl' : x[0].toUpperCase() + x.slice(1)}`)}
            </button>
          ))}
        </div>
        {activeTab !== 'inventory' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {presets.map(([k, d]) => (
              <button key={k} onClick={() => setPreset(d)} className="min-h-[36px] px-2.5 rounded-lg border border-white/10 hover:border-[rgb(var(--primary))] text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]">{t(`analytics.${k}`)}</button>
            ))}
            <label className="flex items-center gap-1 text-[rgb(var(--muted))]">{t('analytics.from')}
              <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="bg-[rgb(var(--surface))] border border-white/10 rounded-lg px-2 py-1.5 text-[rgb(var(--text))]" />
            </label>
            <label className="flex items-center gap-1 text-[rgb(var(--muted))]">{t('analytics.to')}
              <input type="date" value={to} min={from} max={todayLocal()} onChange={(e) => e.target.value && setTo(e.target.value)} className="bg-[rgb(var(--surface))] border border-white/10 rounded-lg px-2 py-1.5 text-[rgb(var(--text))]" />
            </label>
            {activeTab === 'btl' && (
              <select value={model} onChange={(e) => setModel(e.target.value as any)} aria-label={t('analytics.model')} className="bg-[rgb(var(--surface))] border border-white/10 rounded-lg px-2 py-2 text-[rgb(var(--text))]">
                <option value="last_touch">{t('analytics.lastTouch')}</option>
                <option value="first_touch">{t('analytics.firstTouch')}</option>
              </select>
            )}
          </div>
        )}
      </div>

      {state === 'loading' && <Skeleton />}
      {state === 'error' && (
        <div className="rounded-2xl border border-white/10 p-6 text-center space-y-3">
          <p className="text-sm">{t('analytics.error')}</p>
          <button onClick={() => setReload((x) => x + 1)} className="min-h-[40px] px-4 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] text-xs font-bold inline-flex items-center gap-1.5"><RefreshCw size={13} />{t('analytics.retry')}</button>
        </div>
      )}
      {state === 'ready' && data && data._tab === activeTab && (
        <>
          {activeTab === 'sales' && <SalesView d={data} t={t} money={money} compact={compactMoney} num={num} locale={locale} />}
          {activeTab === 'btl' && <BtlView d={data} t={t} money={money} compact={compactMoney} num={num} locale={locale} />}
          {activeTab === 'customers' && <CustomersView d={data} t={t} money={money} compact={compactMoney} num={num} locale={locale} />}
          {activeTab === 'inventory' && <InventoryView d={data} t={t} money={money} compact={compactMoney} num={num} locale={locale} />}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- shared pieces
type ViewProps = { d: any; t: (k: string, p?: any) => string; money: (v: number) => string; compact: (v: number) => string; num: (v: any, digits?: number) => string; locale: string };

const Skeleton = () => (
  <div className="space-y-4" aria-busy="true">
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />)}</div>
    <div className="h-72 rounded-2xl bg-white/5 animate-pulse" />
  </div>
);

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode; className?: string }> = ({ title, hint, children, className = '' }) => (
  <section className={`rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4 space-y-3 min-w-0 ${className}`}>
    <div>
      <h2 className="text-sm font-bold text-[rgb(var(--text))]">{title}</h2>
      {hint && <p className="text-[11px] text-[rgb(var(--muted))]">{hint}</p>}
    </div>
    {children}
  </section>
);

const Stat: React.FC<{ label: string; value: string; delta?: number | null; t: ViewProps['t'] }> = ({ label, value, delta, t }) => (
  <div className="rounded-2xl bg-[rgb(var(--surface))] border border-white/5 p-4 space-y-1 min-w-0">
    <p className="text-[11px] text-[rgb(var(--muted))] uppercase tracking-wider leading-tight">{label}</p>
    <p className="font-mono text-xl font-bold text-[rgb(var(--text))] truncate">{value}</p>
    {delta !== undefined && (
      <p className="text-[11px] text-[rgb(var(--muted))] flex items-center gap-1">
        {delta === null ? <Minus size={12} /> : delta >= 0 ? <TrendingUp size={12} className="text-[#199e70]" /> : <TrendingDown size={12} className="text-[#e66767]" />}
        <span className="text-[rgb(var(--text))] font-mono">{delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}</span> {t('analytics.vsPrev')}
      </p>
    )}
  </div>
);

const TooltipBox: React.FC<{ active?: boolean; payload?: any[]; label?: any; fmt?: (v: number, name: string) => string; labelFmt?: (l: any) => string }> = ({ active, payload, label, fmt, labelFmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#14171D] px-3 py-2 text-[11px] shadow-xl space-y-1">
      <p className="font-semibold text-[rgb(var(--text))]">{labelFmt ? labelFmt(label) : label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-[rgb(var(--muted))]">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-mono text-[rgb(var(--text))]">{fmt ? fmt(p.value, p.dataKey) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const Heatmap: React.FC<{ cells: { dow: number; hour: number; value: number; tip: string }[]; locale: string }> = ({ cells, locale }) => {
  const max = Math.max(1, ...cells.map((c) => c.value));
  // Only hours with meaningful activity (≥3% of the peak) so the grid fits the card.
  const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => cells.some((c) => c.hour === h && c.value >= max * 0.03));
  const dows = DOW[locale] || DOW_ES;
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr><th />{hours.map((h) => <th key={h} className="font-mono font-normal text-[rgb(var(--muted))] px-0.5">{h}</th>)}</tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
            <tr key={dow}>
              <th className="pr-2 text-left font-normal text-[rgb(var(--muted))]">{dows[dow]}</th>
              {hours.map((h) => {
                const c = cells.find((x) => x.dow === dow && x.hour === h);
                const a = c ? 0.08 + 0.92 * (c.value / max) : 0.03;
                return <td key={h} title={c?.tip} className="h-6 min-w-[20px] w-[min(2.2vw,30px)] rounded-[4px] hover:ring-2 hover:ring-[rgb(var(--text))]" style={{ background: `rgba(${SEQ}, ${a})` }} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Table: React.FC<{ cols: { key: string; label: string; align?: 'right'; render?: (r: any) => React.ReactNode }[]; rows: any[]; max?: number }> = ({ cols, rows, max = 50 }) => (
  <div className="overflow-x-auto -mx-1">
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[rgb(var(--muted))] text-[10px] uppercase tracking-wider">
          {cols.map((c) => <th key={c.key} className={`px-2 py-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, max).map((r, i) => (
          <tr key={r.id || r.key || r.code || r.sku || i} className="border-t border-white/5 hover:bg-white/[0.03]">
            {cols.map((c) => <td key={c.key} className={`px-2 py-2 whitespace-nowrap ${c.align === 'right' ? 'text-right font-mono' : ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TAG_STYLE: Record<string, string> = {
  scale: 'bg-[#199e70]/15 text-[#5fd0a6] border-[#199e70]/40',
  fix_landing: 'bg-[#c98500]/15 text-[#f0bb4d] border-[#c98500]/40',
  stop: 'bg-[#e66767]/15 text-[#f29b9b] border-[#e66767]/40',
  watch: 'bg-white/5 text-[rgb(var(--muted))] border-white/10',
  insufficient: 'bg-white/5 text-[rgb(var(--muted))] border-white/10',
};
const Tag: React.FC<{ tag: string; t: ViewProps['t'] }> = ({ tag, t }) => <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${TAG_STYLE[tag] || TAG_STYLE.watch}`}>{t(`analytics.${tag}`)}</span>;

// ---------------------------------------------------------------- SALES
const SalesView: React.FC<ViewProps> = ({ d, t, money, compact, num, locale }) => {
  const k = d.kpis;
  if (!k.orders) return <p className="text-sm text-[rgb(var(--muted))]">{t('analytics.empty')}</p>;
  const daily = d.daily.map((x: any) => ({ ...x, organic: x.revenue - x.btlRevenue }));
  const quadColor: Record<string, string> = { star: SERIES[0], plowhorse: SERIES[1], puzzle: SERIES[2], dog: SERIES[3] };
  const dows = DOW[locale] || DOW_ES;
  const dayFmt = (s: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${s}T12:00:00Z`));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat t={t} label={t('analytics.revenue')} value={compact(k.revenue)} delta={k.deltas.revenue} />
        <Stat t={t} label={t('analytics.orders')} value={num(k.orders)} delta={k.deltas.orders} />
        <Stat t={t} label={t('analytics.aov')} value={money(k.aov)} delta={k.deltas.aov} />
        <Stat t={t} label={t('analytics.customers')} value={num(k.uniqueCustomers)} delta={k.deltas.uniqueCustomers} />
        <Stat t={t} label={t('analytics.prep')} value={num(k.avgPrepMinutes, 1)} />
        <Stat t={t} label={t('analytics.btlShare')} value={k.btlShare === null ? '—' : `${num(k.btlShare, 1)}%`} />
      </div>

      <Card title={t('analytics.dailyRevenue')}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="day" tick={AXIS} tickFormatter={dayFmt} minTickGap={24} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} tickFormatter={compact} width={70} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipBox fmt={(v) => money(v)} labelFmt={dayFmt} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="organic" name={t('analytics.organic')} stackId="r" fill={SERIES[0]} />
              <Bar dataKey="btlRevenue" name={t('analytics.attributed')} stackId="r" fill={SERIES[1]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title={t('analytics.heatmap')} hint={t('analytics.heatmapHint')}>
          <Heatmap locale={locale} cells={d.heatmap.map((c: any) => ({ dow: c.dow, hour: c.hour, value: c.avgPerWeek, tip: `${dows[c.dow]} ${c.hour}:00 · ${num(c.avgPerWeek, 1)} ${t('analytics.orders').toLowerCase()} · ${c.cooks} ${t('analytics.cooks')}` }))} />
        </Card>
        <Card title={t('analytics.byCategory')}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.byCategory} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} tickFormatter={compact} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="key" tick={AXIS} width={70} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipBox fmt={(v) => money(v)} />} />
                <Bar dataKey="revenue" name={t('analytics.revenue')} fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title={t('analytics.bcg')}>
        <div className="h-80">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="units" name={t('analytics.units')} tick={AXIS} axisLine={false} tickLine={false} label={{ value: t('analytics.units'), position: 'insideBottom', offset: -4, fontSize: 11, fill: 'rgb(var(--muted))' }} />
              <YAxis type="number" dataKey="unitMargin" name={t('analytics.unitMargin')} tick={AXIS} tickFormatter={compact} width={70} axisLine={false} tickLine={false} />
              <ZAxis range={[90, 90]} />
              <ReferenceLine x={d.bcgThresholds.units} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
              <ReferenceLine y={d.bcgThresholds.unitMargin} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
              <Tooltip cursor={false} content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="rounded-xl border border-white/10 bg-[#14171D] px-3 py-2 text-[11px] shadow-xl max-w-[240px] space-y-0.5">
                    <p className="font-semibold text-[rgb(var(--text))]">{p.name}</p>
                    <p className="text-[rgb(var(--muted))]">{t(`analytics.${p.quadrant}`)} · {num(p.units)} u · {money(p.unitMargin)} ({p.marginPct}%)</p>
                    <p className="text-[rgb(var(--text))]">{p.action}</p>
                  </div>
                );
              }} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
              {(['star', 'plowhorse', 'puzzle', 'dog'] as const).map((q) => (
                <Scatter key={q} name={t(`analytics.${q}`)} data={d.bcg.filter((x: any) => x.quadrant === q)} fill={quadColor[q]} stroke="#14171D" strokeWidth={2} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <Table rows={d.bcg} max={30} cols={[
          { key: 'name', label: t('analytics.dish') },
          { key: 'units', label: t('analytics.units'), align: 'right', render: (r) => num(r.units) },
          { key: 'revenue', label: t('analytics.revenue'), align: 'right', render: (r) => money(r.revenue) },
          { key: 'unitMargin', label: t('analytics.unitMargin'), align: 'right', render: (r) => `${money(r.unitMargin)} · ${r.marginPct}%` },
          { key: 'quadrant', label: 'BCG', render: (r) => <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: quadColor[r.quadrant] }} />{t(`analytics.${r.quadrant}`)}</span> },
          { key: 'action', label: t('analytics.action'), render: (r) => <span className="text-[rgb(var(--muted))] whitespace-normal">{r.action}</span> },
        ]} />
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- BTL
const BtlView: React.FC<ViewProps> = ({ d, t, money, compact, num, locale }) => {
  const k = d.kpis;
  // "Add costs" only when nothing was ever logged; otherwise the range simply has no spend → em dash.
  const spendOr = (v: number | null, f: (x: number) => string, hasCosts = false) => (v === null ? (hasCosts ? '—' : t('analytics.addCosts')) : f(v));
  const funnelMax = Math.max(1, ...d.funnel.map((f: any) => f.value));
  // Fold piece types beyond the top 4 into "Other" (fixed palette order, never cycled).
  const types = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of d.scansDaily) for (const [kk, v] of Object.entries(row)) if (kk !== 'day') totals[kk] = (totals[kk] || 0) + (v as number);
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([kk]) => kk);
  }, [d]);
  const top = types.slice(0, 4);
  const scansDaily = d.scansDaily.map((row: any) => {
    const out: any = { day: row.day, other: 0 };
    for (const ty of types) if (top.includes(ty)) out[ty] = row[ty] || 0;
      else out.other += row[ty] || 0;
    return out;
  });
  const dows = DOW[locale] || DOW_ES;
  const dayFmt = (s: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${s}T12:00:00Z`));
  if (!k.scans && !k.orders) return <p className="text-sm text-[rgb(var(--muted))]">{t('analytics.empty')}</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat t={t} label={t('analytics.scans')} value={num(k.scans)} />
        <Stat t={t} label={t('analytics.attributed')} value={compact(k.revenue)} />
        <Stat t={t} label={t('analytics.spend')} value={k.spend ? compact(k.spend) : t('analytics.addCosts')} />
        <Stat t={t} label={t('analytics.roas')} value={spendOr(k.roas, (v) => `${num(v, 2)}x`)} />
        <Stat t={t} label={t('analytics.netRoas')} value={spendOr(k.netRoas, (v) => `${num(v, 2)}x`)} />
        <Stat t={t} label={t('analytics.cpo')} value={spendOr(k.costPerOrder, money)} />
      </div>

      <div className="grid xl:grid-cols-5 gap-4">
        <Card title={t('analytics.funnel')} className="xl:col-span-2" hint={`${t('analytics.scanRate')}: ${k.scanRate ?? '—'}% · ${t('analytics.scanToOrder')}: ${k.scanToOrder ?? '—'}% · ${t('analytics.ttc')}: ${num(k.medianHoursToConvert, 1)}`}>
          <ol className="space-y-1.5">
            {d.funnel.map((f: any, i: number) => {
              const prev = i > 1 ? d.funnel[i - 1].value : null;
              const drop = prev ? Math.round((1 - f.value / prev) * 100) : null;
              return (
                <li key={f.stage} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[rgb(var(--muted))]">{t(`analytics.${f.stage}`)}</span>
                    <span className="font-mono text-[rgb(var(--text))]">{num(f.value)}{drop !== null && <span className="text-[rgb(var(--muted))]"> · −{drop}%</span>}</span>
                  </div>
                  <div className="h-3 rounded bg-white/5 overflow-hidden" title={`${t(`analytics.${f.stage}`)}: ${num(f.value)}`}>
                    <div className="h-full rounded-r" style={{ width: `${Math.max(1, (f.value / funnelMax) * 100)}%`, background: i === 0 ? 'rgba(255,255,255,0.25)' : SERIES[0] }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card title={t('analytics.scansByType')} className="xl:col-span-3">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={scansDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="day" tick={AXIS} tickFormatter={dayFmt} minTickGap={24} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} width={40} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipBox labelFmt={dayFmt} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {top.map((ty, i) => <Bar key={ty} dataKey={ty} name={ty} stackId="s" fill={SERIES[i]} />)}
                {types.length > 4 && <Bar dataKey="other" name="other" stackId="s" fill="rgba(255,255,255,0.3)" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title={t('analytics.leaderboard')}>
        <Table rows={d.leaderboard} cols={[
          { key: 'label', label: t('analytics.touchpoint'), render: (r) => <span><span className="text-[rgb(var(--text))]">{r.label}</span> <span className="text-[rgb(var(--muted))]">· {r.type}</span></span> },
          { key: 'campaign', label: t('analytics.campaign'), render: (r) => <span className="text-[rgb(var(--muted))]">{r.campaign}</span> },
          { key: 'distributed', label: t('analytics.distributed'), align: 'right', render: (r) => `${num(r.distributed)}${r.estimated ? '*' : ''}` },
          { key: 'scans', label: t('analytics.scans'), align: 'right', render: (r) => num(r.scans) },
          { key: 'leads', label: t('analytics.leads'), align: 'right', render: (r) => num(r.leads) },
          { key: 'orders', label: t('analytics.orders'), align: 'right', render: (r) => num(r.orders) },
          { key: 'scanToOrder', label: t('analytics.scanToOrder'), align: 'right', render: (r) => (r.scanToOrder === null ? '—' : `${r.scanToOrder}%`) },
          { key: 'revenue', label: t('analytics.revenue'), align: 'right', render: (r) => money(r.revenue) },
          { key: 'costPerOrder', label: t('analytics.cpo'), align: 'right', render: (r) => spendOr(r.costPerOrder, money, r.hasCosts) },
          { key: 'roas', label: 'ROAS', align: 'right', render: (r) => spendOr(r.roas, (v) => `${num(v, 1)}x`, r.hasCosts) },
          { key: 'tag', label: t('analytics.tag'), render: (r) => <Tag tag={r.tag} t={t} /> },
        ]} />
      </Card>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title={t('analytics.scanHeatmap')}>
          <Heatmap locale={locale} cells={d.scanHeatmap.map((c: any) => ({ dow: c.dow, hour: c.hour, value: c.scans, tip: `${dows[c.dow]} ${c.hour}:00 · ${num(c.scans)} ${t('analytics.scans').toLowerCase()}` }))} />
        </Card>
        <Card title={t('analytics.campaigns')}>
          <Table rows={d.campaigns} cols={[
            { key: 'name', label: t('analytics.campaign') },
            { key: 'orders', label: t('analytics.orders'), align: 'right', render: (r) => num(r.orders) },
            { key: 'revenue', label: t('analytics.revenue'), align: 'right', render: (r) => compact(r.revenue) },
            { key: 'spend', label: t('analytics.spend'), align: 'right', render: (r) => (r.spend ? compact(r.spend) : r.hasCosts ? '—' : t('analytics.addCosts')) },
            { key: 'roas', label: 'ROAS', align: 'right', render: (r) => spendOr(r.roas, (v) => `${num(v, 1)}x`, r.hasCosts) },
          ]} />
        </Card>
      </div>

      <Card title={t('analytics.coupons')}>
        <Table rows={d.coupons} cols={[
          { key: 'code', label: 'Código', render: (r) => <span className="font-mono">{r.code}</span> },
          { key: 'claimed', label: t('analytics.claims'), align: 'right', render: (r) => num(r.claimed) },
          { key: 'redeemed', label: t('analytics.redeemed'), align: 'right', render: (r) => `${num(r.redeemed)}${r.redemptionRate !== null ? ` · ${r.redemptionRate}%` : ''}` },
          { key: 'revenue', label: t('analytics.revenue'), align: 'right', render: (r) => money(r.revenue) },
          { key: 'discountCost', label: t('analytics.discountCost'), align: 'right', render: (r) => money(r.discountCost) },
        ]} />
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- CUSTOMERS
const CustomersView: React.FC<ViewProps> = ({ d, t, money, compact, num }) => {
  const k = d.kpis;
  if (!k.customers) return <p className="text-sm text-[rgb(var(--muted))]">{t('analytics.empty')}</p>;
  const maxAge = Math.max(0, ...d.cohortMatrix.map((c: any) => c.retention.length - 1));
  const weekFmt = (s: string) => s.slice(5);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat t={t} label={t('analytics.customers')} value={num(k.customers)} />
        <Stat t={t} label={t('analytics.avgClv')} value={compact(k.avgClv)} />
        <Stat t={t} label={t('analytics.repeatRate')} value={k.repeatRate === null ? '—' : `${k.repeatRate}%`} />
        <Stat t={t} label={t('analytics.guestShare')} value={k.guestOrderShare === null ? '—' : `${k.guestOrderShare}%`} />
      </div>

      <div className="grid xl:grid-cols-5 gap-4">
        <Card title={t('analytics.rfmSegments')} className="xl:col-span-3">
          <Table rows={d.segments} cols={[
            { key: 'key', label: t('analytics.segment'), render: (r) => t(`analytics.${r.key}`) },
            { key: 'customers', label: t('analytics.customers'), align: 'right', render: (r) => num(r.customers) },
            { key: 'revenue', label: t('analytics.revenue'), align: 'right', render: (r) => compact(r.revenue) },
            { key: 'ordersPerCustomer', label: t('analytics.frequency'), align: 'right', render: (r) => num(r.ordersPerCustomer, 1) },
            { key: 'medianRecencyDays', label: t('analytics.recency'), align: 'right', render: (r) => num(r.medianRecencyDays) },
            { key: 'btlResponse', label: t('analytics.btlResponse'), align: 'right', render: (r) => `${num(r.btlResponse, 1)}%` },
            { key: 'clv', label: 'CLV', align: 'right', render: (r) => compact(r.clv) },
          ]} />
        </Card>
        <Card title={t('analytics.tiers')} className="xl:col-span-2">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={d.tiers.map((x: any) => ({ ...x, label: t(`account.${x.tier}`) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} width={40} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipBox fmt={(v) => num(v)} />} />
                <Bar dataKey="members" name={t('analytics.customers')} fill={SERIES[0]} radius={[4, 4, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card title={t('analytics.cohorts')}>
          <div className="overflow-x-auto">
            <table className="text-[11px] border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr className="text-[rgb(var(--muted))]">
                  <th className="text-left pr-2 font-semibold">{t('analytics.cohort')}</th>
                  <th className="text-right pr-2 font-semibold">n</th>
                  {Array.from({ length: maxAge + 1 }, (_, i) => <th key={i} className="font-normal px-1">{t('analytics.month', { n: i })}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.cohortMatrix.map((c: any) => (
                  <tr key={c.cohort}>
                    <td className="pr-2 font-mono">{c.cohort}</td>
                    <td className="pr-2 text-right font-mono text-[rgb(var(--muted))]">{num(c.size)}</td>
                    {Array.from({ length: maxAge + 1 }, (_, i) => {
                      const cell = c.retention.find((r: any) => r.age === i);
                      return (
                        <td key={i} className="w-14 h-7 text-center font-mono rounded" style={{ background: cell ? `rgba(${SEQ}, ${0.08 + 0.85 * (cell.pct / 100)})` : 'transparent', color: cell && cell.pct > 55 ? '#fff' : 'rgb(var(--text))' }}>
                          {cell ? `${Math.round(cell.pct)}%` : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={t('analytics.newVsReturning')}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.newVsReturning} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="week" tick={AXIS} tickFormatter={weekFmt} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={AXIS} width={40} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TooltipBox fmt={(v) => num(v)} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="returningCustomers" name={t('analytics.returning')} stackId="c" fill={SERIES[0]} />
                <Bar dataKey="newCustomers" name={t('analytics.new')} stackId="c" fill={SERIES[1]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title={t('analytics.topCustomers')}>
        <Table rows={d.topCustomers} max={25} cols={[
          { key: 'name', label: t('account.name') },
          { key: 'email', label: 'E-mail', render: (r) => <span className="text-[rgb(var(--muted))]">{r.email}</span> },
          { key: 'segment', label: t('analytics.segment'), render: (r) => t(`analytics.${r.segment}`) },
          { key: 'frequency', label: t('analytics.frequency'), align: 'right', render: (r) => num(r.frequency) },
          { key: 'recencyDays', label: t('analytics.recency'), align: 'right', render: (r) => num(r.recencyDays) },
          { key: 'monetary', label: t('analytics.revenue'), align: 'right', render: (r) => money(r.monetary) },
          { key: 'clv', label: 'CLV', align: 'right', render: (r) => compact(r.clv) },
        ]} />
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------- INVENTORY
const STATUS_ICON: Record<string, React.ReactNode> = {
  critical: <AlertOctagon size={13} className="text-[#e66767]" />,
  low: <AlertTriangle size={13} className="text-[#c98500]" />,
  waste_risk: <AlertTriangle size={13} className="text-[#d55181]" />,
  ok: <CheckCircle2 size={13} className="text-[#199e70]" />,
};

const InventoryView: React.FC<ViewProps> = ({ d, t, money, compact, num, locale }) => {
  const k = d.kpis;
  const skus = useMemo(() => {
    const set = new Set<string>();
    d.usageDaily.forEach((r: any) => Object.keys(r).forEach((kk) => kk !== 'day' && set.add(kk)));
    return [...set];
  }, [d]);
  const nameOf = (sku: string) => d.items.find((i: any) => i.sku === sku)?.name || sku;
  const dateFmt = (s: string | null) => (s ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${s}T12:00:00Z`)) : '—');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat t={t} label={t('analytics.skus')} value={num(k.skus)} />
        <Stat t={t} label={t('analytics.stockValue')} value={compact(k.stockValue)} />
        <Stat t={t} label={t('analytics.critical')} value={num(k.critical)} />
        <Stat t={t} label={t('analytics.low')} value={num(k.low)} />
        <Stat t={t} label={t('analytics.wasteRisk')} value={num(k.wasteRisk)} />
      </div>
      <Card title={t('analytics.tabInventory')} hint={t('analytics.forecastNote')}>
        <Table rows={d.items} cols={[
          { key: 'status', label: t('analytics.status'), render: (r) => <span className="flex items-center gap-1.5">{STATUS_ICON[r.status]}{t(`analytics.${r.status}`)}</span> },
          { key: 'name', label: t('analytics.item') },
          { key: 'onHand', label: t('analytics.onHand'), align: 'right', render: (r) => `${num(r.onHand, 1)} ${r.unit}` },
          { key: 'avgDailyUse', label: t('analytics.dailyUse'), align: 'right', render: (r) => num(r.avgDailyUse, 2) },
          { key: 'daysOfCover', label: t('analytics.cover'), align: 'right', render: (r) => num(r.daysOfCover, 1) },
          { key: 'demand7', label: t('analytics.demand7'), align: 'right', render: (r) => num(r.demand7, 1) },
          { key: 'reorderQty', label: t('analytics.reorder'), align: 'right', render: (r) => (r.reorderQty ? `${num(r.reorderQty, 1)} ${r.unit}` : '—') },
          { key: 'reorderDate', label: t('analytics.reorderDate'), align: 'right', render: (r) => dateFmt(r.reorderDate) },
          { key: 'expiringQty', label: t('analytics.expiring'), align: 'right', render: (r) => (r.expiringQty ? num(r.expiringQty, 1) : '—') },
          { key: 'valueAtCost', label: t('analytics.stockValue'), align: 'right', render: (r) => money(r.valueAtCost) },
        ]} />
      </Card>
      <Card title={t('analytics.usageTrend')}>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={d.usageDaily} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="day" tick={AXIS} tickFormatter={(s) => dateFmt(s)} minTickGap={24} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} width={40} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipBox fmt={(v) => num(v, 2)} labelFmt={(s) => dateFmt(s)} />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {skus.map((sku, i) => <Line key={sku} type="monotone" dataKey={sku} name={nameOf(sku)} stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
