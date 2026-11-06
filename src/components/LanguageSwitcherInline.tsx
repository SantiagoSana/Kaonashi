import React from 'react';
import { useApp } from '../context/AppContext';
import { Locale } from '../lib/types';

const LABELS: Record<Locale, string> = { es: 'ES', en: 'EN', ja: '日本語' };

export const LanguageSwitcherInline: React.FC = () => {
  const { locale, setLocale } = useApp();
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {(Object.keys(LABELS) as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-current={locale === l ? 'true' : undefined}
          className={`min-h-[32px] px-2 rounded-lg text-[11px] font-bold ${locale === l ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'}`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
};
