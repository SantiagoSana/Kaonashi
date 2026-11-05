import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Price } from '../../components/Price';
import {
  Tag,
  AlertTriangle,
  Percent,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
} from 'lucide-react';

interface PromoItem {
  dishId: string;
  name: string;
  category: string;
  priceMinor: number;
  costMinor: number;
  grossMarginPercent: number;
  isCriticalMargin: boolean;
  activePromo: string;
  bogoEnabled: boolean;
  happyHourEnabled: boolean;
  marginGuardWarning: string | null;
}

export const PromotionsAdmin: React.FC = () => {
  const { t, showNotification } = useApp();
  const [promotions, setPromotions] = useState<PromoItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPromotions = async () => {
    try {
      const res = await fetch('/api/admin/promotions');
      const data = await res.json();
      if (data.ok) {
        setPromotions(data.promotions);
      }
    } catch {
      showNotification('Error cargando promociones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleTogglePromo = async (dishId: string, field: 'bogo' | 'happyHour') => {
    const item = promotions.find((p) => p.dishId === dishId);
    if (!item) return;

    const newBogo = field === 'bogo' ? !item.bogoEnabled : item.bogoEnabled;
    const newHappyHour = field === 'happyHour' ? !item.happyHourEnabled : item.happyHourEnabled;

    // Check margin guard
    if (newBogo && item.grossMarginPercent < 50) {
      showNotification('⚠️ Alerta de Margen: Activar 2x1 en este ítem reducirá el margen por debajo del costo operativo.');
    }

    try {
      const res = await fetch('/api/admin/promotions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishId,
          bogoEnabled: newBogo,
          happyHourEnabled: newHappyHour,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setPromotions((prev) =>
          prev.map((p) =>
            p.dishId === dishId
              ? {
                  ...p,
                  bogoEnabled: newBogo,
                  happyHourEnabled: newHappyHour,
                  activePromo: newBogo ? '2x1 BOGO' : newHappyHour ? '20% Happy Hour' : 'Ninguna',
                }
              : p
          )
        );
        showNotification(data.message || 'Promoción actualizada con registro en auditoría');
      }
    } catch {
      showNotification('Error actualizando promoción');
    }
  };

  const filtered = promotions.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  const criticalCount = promotions.filter((p) => p.isCriticalMargin).length;
  const activePromoCount = promotions.filter((p) => p.bogoEnabled || p.happyHourEnabled).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
          {t('admin.promotions')}
        </h1>
        <p className="text-sm text-[rgb(var(--muted))] mt-1">
          Control de promociones a nivel de ítem (2x1 BOGO, Happy Hour) y salvaguarda de margen bruto mínimo (§10.1).
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
            <span>{t('admin.activePromotions')}</span>
            <Tag size={16} className="text-[#D4AF37]" />
          </div>
          <div className="text-2xl font-bold text-white">{activePromoCount} platos</div>
          <p className="text-[11px] text-[rgb(var(--muted))]">2x1 BOGO y Happy Hour 20% activos en carta</p>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
            <span>{t('admin.marginGuardAlert')}</span>
            <ShieldAlert size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">{criticalCount} ítems en alerta</div>
          <p className="text-[11px] text-[rgb(var(--muted))]">Margen de materia prima inferior al umbral del 35%</p>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
            <span>Ventana Happy Hour</span>
            <Clock size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">15:00 — 18:00</div>
          <p className="text-[11px] text-[rgb(var(--muted))]">Horario valle de baja concurrencia sincronizado</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-base text-[rgb(var(--text))]">
            Catálogo de Platos & Matriz de Rentabilidad
          </h3>

          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar plato..."
              className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[rgb(var(--muted))] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Plato</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Categoría</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Precio Venta</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Costo Cocina</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Margen Bruto</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))] text-center">2x1 BOGO</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))] text-center">Happy Hour (20%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((item) => (
                <tr key={item.dishId} className="hover:bg-white/5">
                  <td className="p-3.5 font-medium text-white">{item.name}</td>
                  <td className="p-3.5 text-[rgb(var(--muted))] capitalize">{item.category}</td>
                  <td className="p-3.5 font-semibold text-white">
                    <Price amountMinor={item.priceMinor} />
                  </td>
                  <td className="p-3.5 text-[rgb(var(--muted))]">
                    <Price amountMinor={item.costMinor} />
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          item.grossMarginPercent >= 50
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : item.grossMarginPercent >= 35
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {item.grossMarginPercent}%
                      </span>
                      {item.isCriticalMargin && (
                        <span title={item.marginGuardWarning || ''}>
                          <AlertTriangle size={14} className="text-rose-400" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => handleTogglePromo(item.dishId, 'bogo')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        item.bogoEnabled
                          ? 'bg-[#D4AF37] text-black shadow'
                          : 'bg-white/5 text-[rgb(var(--muted))] hover:text-white'
                      }`}
                    >
                      {item.bogoEnabled ? 'Activo' : 'Off'}
                    </button>
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => handleTogglePromo(item.dishId, 'happyHour')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        item.happyHourEnabled
                          ? 'bg-blue-500 text-white shadow'
                          : 'bg-white/5 text-[rgb(var(--muted))] hover:text-white'
                      }`}
                    >
                      {item.happyHourEnabled ? 'Activo' : 'Off'}
                    </button>
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
