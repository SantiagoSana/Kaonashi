import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { ShieldCheck, Check, Trash2, ArrowLeft } from 'lucide-react';

export const Unsubscribe: React.FC = () => {
  const [, params] = useRoute('/u/:token');
  const token = params?.token;

  const [unsubscribed, setUnsubscribed] = useState(false);
  const [erased, setErased] = useState(false);

  const handleUnsubscribe = () => {
    setUnsubscribed(true);
  };

  const handleEraseData = () => {
    setErased(true);
  };

  return (
    <div className="min-h-screen py-16 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-[rgb(var(--surface))] border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl text-center">
        <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto bg-[rgb(var(--background))] text-[rgb(var(--primary))]">
          <ShieldCheck size={24} />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-xl font-bold text-[rgb(var(--text))]">
            Gestión de Privacidad y Comunicaciones
          </h1>
          <p className="text-xs text-[rgb(var(--muted))]">
            Control de tus datos personales conforme a la política de privacidad de Kaonashi
          </p>
        </div>

        {erased ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2 text-xs text-emerald-300">
            <Check size={20} className="mx-auto" />
            <p className="font-bold">Solicitud de Supresión Ejecutada</p>
            <p className="text-[11px] opacity-80">
              Tus datos de contacto han sido anonimizados permanentemente de nuestras bases de datos de marketing.
            </p>
          </div>
        ) : unsubscribed ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2 text-xs text-emerald-300">
              <Check size={20} className="mx-auto" />
              <p className="font-bold">Suscripción Cancelada con Éxito</p>
              <p className="text-[11px] opacity-80">
                No recibirás más correos ni mensajes sobre nuestras activaciones y catas privadas.
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 space-y-2">
              <p className="text-[11px] text-[rgb(var(--muted))]">
                ¿Deseas solicitar el borrado total de tus datos personales?
              </p>
              <button
                onClick={handleEraseData}
                className="w-full py-2.5 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} />
                <span>Solicitar Supresión Total de Datos (Derecho al Olvido)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-[rgb(var(--muted))]">
              Al hacer clic en el botón a continuación, dejarás de recibir comunicaciones de marketing de Kaonashi en un solo paso.
            </p>
            <button
              onClick={handleUnsubscribe}
              className="w-full py-3 bg-[rgb(var(--secondary))] hover:bg-white/10 text-[rgb(var(--text))] font-bold text-xs rounded-xl border border-white/10 transition-colors"
            >
              Confirmar Cancelación de Suscripción (1-Click)
            </button>
          </div>
        )}

        <div className="pt-2">
          <a href="/" className="text-xs text-[rgb(var(--muted))] hover:text-white flex items-center justify-center gap-1">
            <ArrowLeft size={12} /> Volver al sitio principal
          </a>
        </div>
      </div>
    </div>
  );
};
