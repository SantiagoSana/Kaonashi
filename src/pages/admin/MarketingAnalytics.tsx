import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Price } from '../../components/Price';
import {
  TrendingUp,
  Flame,
  ArrowRight,
  Filter,
  Download,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

export const MarketingAnalytics: React.FC = () => {
  const { t } = useApp();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  // Funnel Stages Definition (§5.8)
  const funnelStages = [
    { num: 1, name: '1. Distribuidos', count: 5100, isPhysical: true },
    { num: 2, name: '2. Escaneos Totales', count: 1510, rate: '29.6% tasa escaneo' },
    { num: 3, name: '3. Escaneos Únicos', count: 1320, rate: '87.4% unicidad' },
    { num: 4, name: '4. Landing Views', count: 1240, drop: '93.9%' },
    { num: 5, name: '5. Interacción (Engaged)', count: 990, drop: '79.8%' },
    { num: 6, name: '6. Leads Capturados', count: 370, drop: '37.3%' },
    { num: 7, name: '7. Cupones Reclamados', count: 610, drop: '61.6%' },
    { num: 8, name: '8. Agregado al Carrito', count: 455, drop: '74.5%' },
    { num: 9, name: '9. Checkout Iniciado', count: 325, drop: '71.4%' },
    { num: 10, name: '10. Órdenes Convertidas', count: 255, drop: '78.4%' },
  ];

  // Touchpoint Leaderboard with Rule-based Tags (§5.8)
  const touchpointLeaderboard = [
    {
      label: 'Sake Bar Zona T - Coasters',
      type: 'coaster',
      campaign: 'Coaster Nights – Sake Bars',
      distributed: 1100,
      scans: 420,
      uniqueScans: 360,
      orders: 68,
      revenueMinor: 8160000,
      spendMinor: 1875000,
      costPerOrderMinor: 27573,
      roas: 4.35,
      tag: 'Scale',
      tagColor: 'bg-emerald-950 text-emerald-400 border-emerald-500/30',
    },
    {
      label: 'Parque de la 93 Street Team',
      type: 'street_team',
      campaign: 'Matsuri Pop-Up Weekend',
      distributed: 2200,
      scans: 780,
      uniqueScans: 690,
      orders: 145,
      revenueMinor: 18850000,
      spendMinor: 1050000,
      costPerOrderMinor: 7241,
      roas: 17.95,
      tag: 'Scale',
      tagColor: 'bg-emerald-950 text-emerald-400 border-emerald-500/30',
    },
    {
      label: 'Torres Atrio & Centro Financiero',
      type: 'flyer',
      campaign: 'Flyer Drop – Office Lunch',
      distributed: 1800,
      scans: 310,
      uniqueScans: 270,
      orders: 42,
      revenueMinor: 4620000,
      spendMinor: 1500000,
      costPerOrderMinor: 35714,
      roas: 3.08,
      tag: 'Fix landing',
      tagColor: 'bg-amber-950 text-amber-400 border-amber-500/30',
    },
    {
      label: 'Mesa 4 - Kaonashi Central',
      type: 'table_tent',
      campaign: 'Table Tent – Omakase Upsell',
      distributed: 50,
      scans: 165,
      uniqueScans: 140,
      orders: 38,
      revenueMinor: 6840000,
      spendMinor: 225000,
      costPerOrderMinor: 5921,
      roas: 30.4,
      tag: 'Scale',
      tagColor: 'bg-emerald-950 text-emerald-400 border-emerald-500/30',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
            {t('admin.analytics')}
          </h1>
          <p className="text-xs text-[rgb(var(--muted))]">
            Rendimiento del embudo físico-a-digital y retorno sobre inversión publicitaria (ROAS)
          </p>
        </div>
      </div>

      {/* Funnel Overview (§5.8) */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
            Embudo de Conversión BTL (10 Etapas)
          </h3>
          <span className="text-xs text-[rgb(var(--primary))] font-mono font-bold">
            Tasa de Conversión Scan → Order: 19.3%
          </span>
        </div>

        <div className="space-y-3">
          {funnelStages.map((stage) => {
            const pct = Math.max(8, Math.min(100, (stage.count / 5100) * 100));
            return (
              <div key={stage.num} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-[rgb(var(--text))]">{stage.name}</span>
                  <div className="flex items-center gap-3">
                    {stage.rate && <span className="text-[11px] text-[rgb(var(--primary))] font-mono">{stage.rate}</span>}
                    {stage.drop && <span className="text-[11px] text-[rgb(var(--muted))] font-mono">{stage.drop} retención</span>}
                    <span className="font-mono font-bold text-[rgb(var(--text))]">{stage.count.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full h-3 rounded-full bg-[rgb(var(--background))] overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[rgb(var(--secondary))] to-[rgb(var(--primary))]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Touchpoint Leaderboard with Scale/Fix/Stop tags (§5.8) */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
              Tabla de Clasificación de Puntos de Contacto (Touchpoints)
            </h3>
            <p className="text-xs text-[rgb(var(--muted))]">
              Etiquetas automáticas: Scale (Escalar), Fix landing (Optimizar landing), Stop (Detener)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-white/5 text-[rgb(var(--muted))] uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">Punto de Contacto</th>
                <th className="py-3 px-3">Campaña</th>
                <th className="py-3 px-3 text-right">Distribuidos</th>
                <th className="py-3 px-3 text-right">Escaneos Únicos</th>
                <th className="py-3 px-3 text-right">Órdenes</th>
                <th className="py-3 px-3 text-right">Ingresos Atribuidos</th>
                <th className="py-3 px-3 text-right">Inversión</th>
                <th className="py-3 px-3 text-right">Costo / Orden</th>
                <th className="py-3 px-3 text-right">ROAS</th>
                <th className="py-3 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {touchpointLeaderboard.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-medium text-[rgb(var(--text))]">{row.label}</td>
                  <td className="py-3 px-3 text-[rgb(var(--muted))]">{row.campaign}</td>
                  <td className="py-3 px-3 text-right font-mono">{row.distributed}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-[rgb(var(--text))]">{row.uniqueScans}</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold">{row.orders}</td>
                  <td className="py-3 px-3 text-right font-mono text-[rgb(var(--text))]">
                    <Price amountMinor={row.revenueMinor} />
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[rgb(var(--muted))]">
                    <Price amountMinor={row.spendMinor} />
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[rgb(var(--muted))]">
                    <Price amountMinor={row.costPerOrderMinor} />
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-[rgb(var(--primary))]">
                    {row.roas}x
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.tagColor}`}>
                      {row.tag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
