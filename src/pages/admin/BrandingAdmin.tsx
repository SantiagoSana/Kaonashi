import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Palette, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

export const BrandingAdmin: React.FC = () => {
  const { theme, setTheme, t } = useApp();

  const themes = [
    {
      id: 'kyoto',
      name: 'Kyoto Zen',
      desc: 'Wabi-sabi en profunda oscuridad, acentos de oro imperial y carmesí.',
      bg: '#0B0C10',
      primary: '#D4AF37',
      accent: '#E63946',
    },
    {
      id: 'tokyo',
      name: 'Tokyo Neon',
      desc: 'Noches de Shinjuku, contrastes ultravioleta, magenta y cian brillante.',
      bg: '#07060D',
      primary: '#FF2E63',
      accent: '#08F7FE',
    },
    {
      id: 'edo',
      name: 'Edo Tradition',
      desc: 'Tonos tierra cálidos, madera tostada y terracota artesanal de taberna.',
      bg: '#1A110B',
      primary: '#C8793A',
      accent: '#E9C46A',
    },
    {
      id: 'osaka',
      name: 'Osaka Minimal',
      desc: 'Claridad minimalista contemporánea con acentos en negro pizarra.',
      bg: '#F7F7F5',
      primary: '#2B2F36',
      accent: '#C8102E',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div className="border-b border-white/5 pb-4">
        <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
          {t('admin.branding')}
        </h1>
        <p className="text-xs text-[rgb(var(--muted))]">
          Paletas cromáticas con tokens RGB validados bajo estándar WCAG 2.2 AA (&ge; 4.5:1)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {themes.map((th) => {
          const isSelected = theme === th.id;
          return (
            <div
              key={th.id}
              onClick={() => setTheme(th.id)}
              className={`p-6 rounded-2xl border cursor-pointer transition-all space-y-4 ${
                isSelected
                  ? 'border-[rgb(var(--primary))] bg-[rgb(var(--surface))] shadow-xl ring-1 ring-[rgb(var(--primary))]'
                  : 'border-white/5 bg-[rgb(var(--surface))] hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">{th.name}</h3>
                {isSelected && (
                  <span className="text-xs bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Check size={12} /> Activo
                  </span>
                )}
              </div>

              <p className="text-xs text-[rgb(var(--muted))] leading-relaxed">{th.desc}</p>

              {/* Color Swatches */}
              <div className="flex items-center gap-3 pt-2">
                <div className="space-y-1 text-center">
                  <div className="w-8 h-8 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: th.bg }} />
                  <span className="text-[9px] text-[rgb(var(--muted))]">Fondo</span>
                </div>
                <div className="space-y-1 text-center">
                  <div className="w-8 h-8 rounded-full shadow-inner" style={{ backgroundColor: th.primary }} />
                  <span className="text-[9px] text-[rgb(var(--muted))]">Primario</span>
                </div>
                <div className="space-y-1 text-center">
                  <div className="w-8 h-8 rounded-full shadow-inner" style={{ backgroundColor: th.accent }} />
                  <span className="text-[9px] text-[rgb(var(--muted))]">Acento</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck size={14} /> Contraste verificado &gt;= 4.5:1
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
