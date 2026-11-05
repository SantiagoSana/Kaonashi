import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Award, Sparkles, Lock, Unlock, Gift, Check, ArrowRight } from 'lucide-react';
import { OmikujiModal } from '../components/OmikujiModal';

export const Rewards: React.FC = () => {
  const { t } = useApp();
  const [omikujiOpen, setOmikujiOpen] = useState(false);
  const currentPoints = 2450;
  const nextTierPoints = 6000;
  const progressPercent = Math.min(100, Math.round((currentPoints / nextTierPoints) * 100));

  const secretDishes = [
    {
      name: 'Tartar de Wagyu A5 & Caviar Oscietra',
      tierNeeded: 'Itamae VIP (Nivel 1)',
      unlocked: true,
      desc: 'Corte fino de Wagyu ahumado en madera de manzano, yema curada en mirin y caviar de esturión.',
    },
    {
      name: 'Nigiri Fusión Toro & Trufa Negra con Oro',
      tierNeeded: 'Omakase Master (Nivel 2)',
      unlocked: false,
      desc: 'Ventresca flameada con emulsión de trufa blanca de Umbría y lámina de oro de 24k.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-8">
      {/* Header Ensō Ring Card (§6.6) */}
      <div className="bg-gradient-to-r from-[rgb(var(--surface))] via-[rgb(var(--secondary))] to-[rgb(var(--surface))] border border-[rgb(var(--primary))]/30 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
        <div className="space-y-3 text-center md:text-left z-10">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[rgb(var(--primary))] font-mono">
            Kaonashi Rewards Club
          </span>
          <h1 className="font-display text-3xl font-bold text-[rgb(var(--text))]">
            Nivel: Itamae VIP
          </h1>
          <p className="text-xs text-[rgb(var(--muted))] max-w-sm">
            Disfrutas de reserva preferente con 7 días de anticipación y acceso a los platos secretos del chef.
          </p>
          <div className="pt-2 text-xs font-mono text-[rgb(var(--primary))] font-bold">
            {currentPoints.toLocaleString()} puntos acumulados (Faltan {(nextTierPoints - currentPoints).toLocaleString()} pts para Omakase Master)
          </div>
        </div>

        {/* Animated Ensō Ring Progress Graphic (§6.6) */}
        <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgb(212, 175, 55)"
              strokeWidth="8"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (251.2 * progressPercent) / 100}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-black text-white">{progressPercent}%</span>
            <span className="text-[9px] uppercase tracking-wider text-[rgb(var(--muted))]">Progreso</span>
          </div>
        </div>
      </div>

      {/* Omikuji Fortune Slip Card */}
      <div className="bg-gradient-to-r from-[#221814] via-[#1a120e] to-[#221814] border border-[#D4AF37]/40 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-semibold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>{t('omikuji.title')}</span>
          </div>
          <h3 className="font-display text-xl font-bold text-white">
            Tirar Omikuji Sagrado (1 vez al día)
          </h3>
          <p className="text-xs text-[rgb(var(--muted))] max-w-md">
            {t('omikuji.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setOmikujiOpen(true)}
          className="py-3 px-6 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B38F26] text-black font-bold text-xs tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all whitespace-nowrap shrink-0"
        >
          {t('omikuji.shakeCta')}
        </button>
      </div>

      <OmikujiModal isOpen={omikujiOpen} onClose={() => setOmikujiOpen(false)} />

      {/* Tiers Comparison Table */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
          Niveles y Beneficios Exclusivos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-[rgb(var(--background))] border border-white/5 p-4 rounded-xl space-y-2">
            <span className="font-bold text-[rgb(var(--muted))] block">Nigiri Explorer</span>
            <span className="text-[10px] text-[rgb(var(--muted))]">0 - 1,999 puntos</span>
            <ul className="space-y-1 text-[11px] text-[rgb(var(--muted))] pt-2 border-t border-white/5">
              <li>· Cupón de bienvenida</li>
              <li>· Postre en mes de cumpleaños</li>
            </ul>
          </div>

          <div className="bg-[rgb(var(--primary))]/10 border border-[rgb(var(--primary))]/40 p-4 rounded-xl space-y-2">
            <span className="font-bold text-[rgb(var(--primary))] block">Itamae VIP (Tu nivel)</span>
            <span className="text-[10px] text-[rgb(var(--muted))]">2,000 - 5,999 puntos</span>
            <ul className="space-y-1 text-[11px] text-[rgb(var(--text))] pt-2 border-t border-white/10">
              <li>· Acceso a Menú Secreto Nivel 1</li>
              <li>· Reserva preferente 7 días antes</li>
              <li>· Degustación mensual de sake</li>
            </ul>
          </div>

          <div className="bg-[rgb(var(--background))] border border-white/5 p-4 rounded-xl space-y-2">
            <span className="font-bold text-[rgb(var(--text))] block">Omakase Master</span>
            <span className="text-[10px] text-[rgb(var(--muted))]">6,000+ puntos</span>
            <ul className="space-y-1 text-[11px] text-[rgb(var(--muted))] pt-2 border-t border-white/5">
              <li>· Menú Secreto Nivel 2</li>
              <li>· 10% de descuento en consumo</li>
              <li>· Invitación a Chef's Table</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Secret Menu Section (§6.6) */}
      <div className="space-y-4">
        <h3 className="font-display text-lg font-bold text-[rgb(var(--text))] flex items-center gap-2">
          <Sparkles size={18} className="text-[rgb(var(--primary))]" />
          Platos Secretos del Itamae
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {secretDishes.map((dish, i) => (
            <div
              key={i}
              className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                dish.unlocked
                  ? 'bg-[rgb(var(--surface))] border-[rgb(var(--primary))]/30 shadow'
                  : 'bg-[rgb(var(--background))] border-white/5 opacity-60'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-[rgb(var(--primary))]">
                    {dish.tierNeeded}
                  </span>
                  {dish.unlocked ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-bold">
                      <Unlock size={14} /> Desbloqueado
                    </span>
                  ) : (
                    <span className="text-xs text-[rgb(var(--muted))] flex items-center gap-1">
                      <Lock size={14} /> Bloqueado
                    </span>
                  )}
                </div>
                <h4 className="font-display text-base font-bold text-[rgb(var(--text))]">{dish.name}</h4>
                <p className="text-xs text-[rgb(var(--muted))] leading-relaxed">{dish.desc}</p>
              </div>

              {dish.unlocked && (
                <div className="pt-2">
                  <span className="text-xs text-[rgb(var(--primary))] font-semibold">
                    Disponible al ordenar en mesa o barra
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
