import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Price } from '../../components/Price';
import { MenuItem } from '../../lib/types';
import { Layers, Edit3, Check, X, Search, Sparkles } from 'lucide-react';

export const MenuAdmin: React.FC = () => {
  const { t } = useApp();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const fetchMenu = () => {
    fetch('/api/menu')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const handleToggle86 = async (id: string) => {
    await fetch(`/api/menu/${id}/toggle-86`, { method: 'POST' });
    fetchMenu();
  };

  const handleSavePrice = async (id: string) => {
    const val = Number(editPrice);
    if (isNaN(val) || val < 0) return;

    await fetch(`/api/menu/${id}/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceMinor: val }),
    });

    setEditingId(null);
    fetchMenu();
  };

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.names.es?.toLowerCase().includes(q) || item.names.en?.toLowerCase().includes(q) || item.slug.includes(q);
  });

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">{t('admin.menu')}</h1>
          <p className="text-xs text-[rgb(var(--muted))]">
            Edición de catálogo, precios auditados y disponibilidad operativa (86)
          </p>
        </div>
      </div>

      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-[rgb(var(--muted))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por plato o slug..."
            className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/5 text-[rgb(var(--muted))] uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Plato</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-right">Precio Base (COP)</th>
                <th className="py-2.5 px-3 text-center">Estado (86)</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-3">
                    <span className="font-medium text-[rgb(var(--text))] block">
                      {item.names.es || item.names.en}
                    </span>
                    <span className="text-[10px] text-[rgb(var(--muted))] font-mono">{item.slug}</span>
                  </td>
                  <td className="py-3 px-3 uppercase text-[10px] text-[rgb(var(--muted))]">
                    {item.category}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {editingId === item.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 bg-[rgb(var(--background))] border border-[rgb(var(--primary))] px-2 py-1 rounded text-right text-xs"
                        />
                        <button
                          onClick={() => handleSavePrice(item.id)}
                          className="p-1 bg-emerald-600 text-white rounded"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 bg-white/10 text-white rounded"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <Price amountMinor={item.price} />
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleToggle86(item.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                        item.available
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-950 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {item.available ? 'Disponible' : 'Agotado (86)'}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {editingId !== item.id && (
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditPrice(String(item.price));
                        }}
                        className="px-2.5 py-1 bg-[rgb(var(--surface))] border border-white/10 hover:border-white/20 text-[rgb(var(--muted))] hover:text-white rounded text-[11px]"
                      >
                        Editar Precio
                      </button>
                    )}
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
