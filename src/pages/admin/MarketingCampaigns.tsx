import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Price } from '../../components/Price';
import { Campaign, Touchpoint, DistributionLog, CostEntry } from '../../lib/types';
import { Megaphone, Plus, Calendar, DollarSign, QrCode } from 'lucide-react';

export const MarketingCampaigns: React.FC = () => {
  const { t } = useApp();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [distLogs, setDistLogs] = useState<DistributionLog[]>([]);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => {
        setCampaigns(d.campaigns || []);
        setTouchpoints(d.touchpoints || []);
        setDistLogs(d.distributionLogs || []);
        setCostEntries(d.costEntries || []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
            {t('admin.marketing')}
          </h1>
          <p className="text-xs text-[rgb(var(--muted))]">
            Campañas BTL físicas, puntos de contacto y control de inversión publicitaria
          </p>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {campaigns.map((camp) => {
          const tps = touchpoints.filter((tp) => tp.campaignId === camp.id);
          const costs = costEntries.filter((ce) => ce.campaignId === camp.id);
          const totalCostMinor = costs.reduce((acc, c) => acc + c.amountMinor, 0);

          return (
            <div
              key={camp.id}
              className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] font-mono">
                    {camp.objective}
                  </span>
                  <h3 className="font-display text-lg font-bold text-[rgb(var(--text))] mt-1.5">
                    {camp.name}
                  </h3>
                  <span className="text-xs text-[rgb(var(--muted))]">Slug: /c/{camp.slug}</span>
                </div>

                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    camp.status === 'active'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/10 text-[rgb(var(--muted))]'
                  }`}
                >
                  {camp.status}
                </span>
              </div>

              {/* KPIs & Budget Breakdown */}
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-xs">
                <div>
                  <span className="text-[10px] text-[rgb(var(--muted))] block">Presupuesto</span>
                  <span className="font-bold text-[rgb(var(--text))]">
                    <Price amountMinor={camp.budgetMinor} />
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[rgb(var(--muted))] block">Inversión Registrada</span>
                  <span className="font-bold text-[rgb(var(--primary))]">
                    <Price amountMinor={totalCostMinor} />
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[rgb(var(--muted))] block">Touchpoints</span>
                  <span className="font-bold text-[rgb(var(--text))]">{tps.length} activos</span>
                </div>
              </div>

              {/* Linked Touchpoints */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-[rgb(var(--muted))] tracking-wider">
                  Puntos de Contacto Físicos
                </span>
                <div className="space-y-1">
                  {tps.map((tp) => (
                    <div
                      key={tp.id}
                      className="bg-[rgb(var(--background))] border border-white/5 px-3 py-2 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-medium text-[rgb(var(--text))] block">{tp.label}</span>
                        <span className="text-[10px] text-[rgb(var(--muted))] capitalize">{tp.type} · {tp.location}</span>
                      </div>
                      <span className="text-[11px] font-mono text-[rgb(var(--primary))]">
                        {tp.unitsDistributed || 0} / {tp.unitsPrinted} dist.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
