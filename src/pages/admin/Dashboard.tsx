import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Price } from '../../components/Price';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  QrCode,
  Flame,
  Award,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { t, activeBranch } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [briefData, setBriefData] = useState<any>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const handleGenerateBrief = async () => {
    setBriefModalOpen(true);
    setBriefLoading(true);
    try {
      const res = await fetch('/api/ai/admin/brief', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setBriefData(data);
      }
    } catch {
    } finally {
      setBriefLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => {
        setStats(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">{t('admin.dashboard')}</h1>
          <p className="text-xs text-[rgb(var(--muted))]">Visión ejecutiva de negocio y rendimiento BTL en {activeBranch.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateBrief}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B38F26] text-black font-bold text-xs flex items-center gap-1.5 shadow hover:brightness-110 active:scale-95 transition-all"
          >
            <Sparkles size={14} />
            <span>{t('admin.generateBrief')}</span>
          </button>
          <div className="text-xs bg-[rgb(var(--surface))] border border-white/10 px-3 py-1.5 rounded-xl font-mono text-[rgb(var(--primary))]">
            Modo Demo Activo
          </div>
        </div>
      </div>

      {/* AI Executive Brief Modal */}
      {briefModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[rgb(var(--surface))] border border-[#D4AF37]/30 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 text-[#D4AF37]">
                <Sparkles size={20} />
                <h3 className="font-display text-lg font-bold text-white">
                  {t('admin.executiveBrief')}
                </h3>
              </div>
              <button
                onClick={() => setBriefModalOpen(false)}
                className="text-xs text-[rgb(var(--muted))] hover:text-white px-2 py-1 rounded-lg bg-white/5"
              >
                Cerrar
              </button>
            </div>

            {briefLoading ? (
              <div className="py-12 text-center space-y-3">
                <Sparkles size={24} className="animate-spin text-[#D4AF37] mx-auto" />
                <p className="text-xs text-[rgb(var(--muted))]">
                  Gemini 3.8 Flash analizando métricas de ventas, BTL ROI y frescura de perecederos...
                </p>
              </div>
            ) : briefData ? (
              <div className="space-y-6 text-xs leading-relaxed text-[rgb(var(--text))]">
                {/* Executive Narrative */}
                <div className="bg-[rgb(var(--background))] border border-white/10 rounded-2xl p-5 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider block">
                    Diagnóstico Estratégico AI
                  </span>
                  <div className="whitespace-pre-wrap text-xs text-neutral-200">
                    {briefData.brief}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-bold text-[rgb(var(--muted))] tracking-wider block">
                    Recomendaciones Prioritarias
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {briefData.recommendations?.map((rec: any, i: number) => (
                      <div key={i} className="bg-[rgb(var(--background))] border border-white/10 rounded-xl p-3.5 space-y-1">
                        <span className="font-bold text-white block text-[11px]">{rec.title}</span>
                        <p className="text-[10px] text-[rgb(var(--muted))]">{rec.detail}</p>
                        <span className="text-[10px] font-bold text-emerald-400 block pt-1">{rec.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Perishable Inventory Alert */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-bold text-[rgb(var(--muted))] tracking-wider block">
                    Pronóstico de Inventario Perecedero (Lonja Fresca)
                  </span>
                  <div className="space-y-2">
                    {briefData.inventoryForecast?.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                        <span className="font-semibold text-white">{item.item}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[rgb(var(--muted))]">{item.stockUnits} uds restantes</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            Agotamiento en ~{item.hoursRemaining}h
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* KPI Row (§9.1) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[rgb(var(--muted))] uppercase tracking-wider font-bold block">
            {t('admin.dailyRevenue')}
          </span>
          <div className="text-lg font-bold text-[rgb(var(--text))]">
            <Price amountMinor={31630000} />
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
            <TrendingUp size={10} /> +18.4% vs semana ant.
          </span>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[rgb(var(--muted))] uppercase tracking-wider font-bold block">
            Comandas Totales
          </span>
          <div className="text-lg font-bold text-[rgb(var(--text))]">255</div>
          <span className="text-[10px] text-emerald-400 font-semibold">+12 pedidos hoy</span>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[rgb(var(--muted))] uppercase tracking-wider font-bold block">
            {t('admin.averageTicket')}
          </span>
          <div className="text-lg font-bold text-[rgb(var(--text))]">
            <Price amountMinor={124000} />
          </div>
          <span className="text-[10px] text-[rgb(var(--primary))] font-semibold">BTL AOV: +14%</span>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[rgb(var(--muted))] uppercase tracking-wider font-bold block">
            {t('admin.prepTime')}
          </span>
          <div className="text-lg font-bold text-[rgb(var(--text))]">11.4 min</div>
          <span className="text-[10px] text-emerald-400 font-semibold">Dentro del SLA</span>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[rgb(var(--muted))] uppercase tracking-wider font-bold block">
            {t('admin.btlShare')}
          </span>
          <div className="text-lg font-bold text-[rgb(var(--primary))]">42.8%</div>
          <span className="text-[10px] text-[rgb(var(--muted))] font-medium">Activaciones QR</span>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[rgb(var(--muted))] uppercase tracking-wider font-bold block">
            {t('admin.kitchenActive')}
          </span>
          <div className="text-lg font-bold text-amber-400">3 activas</div>
          <span className="text-[10px] text-[rgb(var(--muted))] font-medium">1 en verificación</span>
        </div>
      </div>

      {/* BCG Matrix & CLV Row (§9.1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BCG Menu Matrix */}
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[rgb(var(--text))] flex items-center gap-2">
              <Flame size={16} className="text-[rgb(var(--primary))]" />
              {t('admin.bcgTitle')}
            </h3>
            <span className="text-[10px] text-[rgb(var(--muted))]">Volumen vs Margen Unitario</span>
          </div>

          <div className="grid grid-cols-2 gap-3 h-64">
            {/* Stars (Estrellas) */}
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                ⭐ Estrellas (Alto margen / Alto volumen)
              </span>
              <div className="space-y-1 text-[11px] text-[rgb(var(--muted))]">
                <p>· Nigiri Salmón Aburi (65% margen)</p>
                <p>· Kaonashi Imperial Roll</p>
              </div>
              <span className="text-[10px] text-emerald-400/80">Acción: Mantener calidad e imagen</span>
            </div>

            {/* Question Marks (Enigmas) */}
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                ❓ Enigmas (Alto margen / Bajo volumen)
              </span>
              <div className="space-y-1 text-[11px] text-[rgb(var(--muted))]">
                <p>· Gran Omakase (11 Tiempos)</p>
                <p>· Sashimi Bluefin Otoro</p>
              </div>
              <span className="text-[10px] text-amber-400/80">Acción: Promocionar en mesa QR</span>
            </div>

            {/* Cash Cows (Vacas Lecheras) */}
            <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
                🐄 Vacas Lecheras (Bajo margen / Alto vol)
              </span>
              <div className="space-y-1 text-[11px] text-[rgb(var(--muted))]">
                <p>· Edamame Trufado</p>
                <p>· Gyozas de Pato</p>
              </div>
              <span className="text-[10px] text-blue-400/80">Acción: Monitorear costos de materia prima</span>
            </div>

            {/* Dogs (Perros) */}
            <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                ⚠️ Perros (Bajo margen / Bajo volumen)
              </span>
              <div className="space-y-1 text-[11px] text-[rgb(var(--muted))]">
                <p>· Rollo Dragón Ahumado</p>
              </div>
              <span className="text-[10px] text-red-400/80">Acción: Rediseñar o sustituir</span>
            </div>
          </div>
        </div>

        {/* Customer Lifetime Value (RFM Segments §9.1) */}
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[rgb(var(--text))] flex items-center gap-2">
              <Award size={16} className="text-[rgb(var(--primary))]" />
              {t('admin.clvTitle')}
            </h3>
            <span className="text-[10px] text-[rgb(var(--muted))]">Base de Clientes Frecuentes</span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Champions (CLV > $1.5M)', count: 48, pct: '18%', color: 'bg-[rgb(var(--primary))]' },
              { label: 'Leales Recurrentes', count: 96, pct: '35%', color: 'bg-emerald-500' },
              { label: 'Prometedores (BTL Reciente)', count: 72, pct: '26%', color: 'bg-blue-500' },
              { label: 'En Riesgo de Abandono', count: 34, pct: '13%', color: 'bg-amber-500' },
              { label: 'Inactivos (> 60 días)', count: 21, pct: '8%', color: 'bg-red-500' },
            ].map((seg, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[rgb(var(--text))] font-medium">{seg.label}</span>
                  <span className="text-[rgb(var(--muted))] font-mono">{seg.count} clientes ({seg.pct})</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[rgb(var(--background))] overflow-hidden">
                  <div className={`h-full rounded-full ${seg.color}`} style={{ width: seg.pct }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Demand Heatmap 7x24 (§9.1) */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
            {t('admin.demandHeatmap')}
          </h3>
          <span className="text-[10px] text-[rgb(var(--muted))]">Picos de demanda: Jue-Sáb 19:00 - 22:00</span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[600px] grid grid-cols-12 gap-1 text-[10px] text-center">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <React.Fragment key={day}>
                <div className="text-left font-bold text-[rgb(var(--muted))] py-1">{day}</div>
                {[12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24].map((hr) => {
                  const isPeak = ['Jue', 'Vie', 'Sáb'].includes(day) && hr >= 19 && hr <= 22;
                  const isLunch = hr >= 12 && hr <= 14;
                  const intensity = isPeak ? 'bg-[rgb(var(--accent))] text-white' : isLunch ? 'bg-[rgb(var(--primary))]/60 text-[rgb(var(--on-primary))]' : 'bg-white/5 text-[rgb(var(--muted))]';
                  return (
                    <div
                      key={hr}
                      className={`h-8 rounded flex items-center justify-center font-mono ${intensity}`}
                      title={`${day} ${hr}:00`}
                    >
                      {hr}h
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
