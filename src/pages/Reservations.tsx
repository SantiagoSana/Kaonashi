import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Price } from '../components/Price';
import { Calendar, Users, Clock, CheckCircle2, MapPin } from 'lucide-react';

export const Reservations: React.FC = () => {
  const { t, activeBranch } = useApp();
  const [date, setDate] = useState('2026-11-06');
  const [partySize, setPartySize] = useState(2);
  const [area, setArea] = useState<'main_room' | 'omakase_bar' | 'terrace'>('omakase_bar');
  const [selectedTable, setSelectedTable] = useState('Table 4');
  const [timeSlot, setTimeSlot] = useState('20:00');
  const [name, setName] = useState('Mia Larsson');
  const [phone, setPhone] = useState('+573001234567');
  const [email, setEmail] = useState('mia_guest@example.com');
  const [isBooked, setIsBooked] = useState(false);

  const depositPerPerson = area === 'omakase_bar' ? 50000 : 0;
  const totalDepositMinor = depositPerPerson * partySize;

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBooked(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-8">
      <div className="border-b border-white/5 pb-4">
        <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">{t('nav.reserve')}</h1>
        <p className="text-xs text-[rgb(var(--muted))]">
          Selecciona tu mesa o ubicación en la barra de Omakase en {activeBranch.name}
        </p>
      </div>

      {isBooked ? (
        <div className="bg-[rgb(var(--surface))] border border-white/10 rounded-2xl p-8 text-center space-y-4 max-w-md mx-auto">
          <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
          <h2 className="font-display text-xl font-bold text-white">¡Reserva Confirmada!</h2>
          <p className="text-xs text-[rgb(var(--muted))]">
            Hemos reservado {selectedTable} ({area.replace('_', ' ')}) para {partySize} personas el {date} a las {timeSlot}.
          </p>
          <div className="pt-2 text-xs text-[rgb(var(--primary))] font-mono">
            Código de Reserva: #RES-{Date.now().toString().slice(-6)}
          </div>
        </div>
      ) : (
        <form onSubmit={handleBook} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            {/* Date & Party */}
            <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="font-display text-sm font-bold text-[rgb(var(--text))]">1. Fecha y Personas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">Fecha</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">Personas</label>
                  <select
                    value={partySize}
                    onChange={(e) => setPartySize(Number(e.target.value))}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'persona' : 'personas'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Area */}
              <div>
                <label className="text-xs text-[rgb(var(--muted))]">Zona del Restaurante</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { id: 'omakase_bar', label: 'Barra Omakase' },
                    { id: 'main_room', label: 'Salón Principal' },
                    { id: 'terrace', label: 'Terraza Zen' },
                  ].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setArea(a.id as any)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        area === a.id
                          ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]'
                          : 'border-white/5 bg-[rgb(var(--background))] text-[rgb(var(--muted))]'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="text-xs text-[rgb(var(--muted))]">Horario Disponible</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {['13:00', '14:30', '19:00', '20:00', '20:30', '21:30', '22:00'].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTimeSlot(slot)}
                      className={`py-2 rounded-lg text-xs font-mono font-medium border ${
                        timeSlot === slot
                          ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold'
                          : 'border-white/5 bg-[rgb(var(--background))] text-[rgb(var(--muted))]'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive SVG Floor Plan (§6.5) */}
            <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="font-display text-sm font-bold text-[rgb(var(--text))]">2. Plano de Distribución</h3>
              <div className="h-56 rounded-xl bg-[rgb(var(--background))] border border-white/5 relative p-4 flex flex-col justify-between overflow-hidden">
                {/* Omakase Counter representation */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[rgb(var(--primary))] font-bold uppercase tracking-wider">
                    Barra de Omakase (Puestos 1 al 8)
                  </span>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((seat) => (
                      <button
                        key={seat}
                        type="button"
                        onClick={() => setSelectedTable(`Puesto de Barra #${seat}`)}
                        className={`w-8 h-8 rounded-full border text-xs font-mono font-bold transition-all ${
                          selectedTable === `Puesto de Barra #${seat}`
                            ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] border-[rgb(var(--primary))]'
                            : 'bg-[rgb(var(--surface))] text-[rgb(var(--muted))] border-white/10 hover:border-white/30'
                        }`}
                      >
                        {seat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Tables */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[rgb(var(--muted))] font-bold uppercase tracking-wider">
                    Mesas Salón Central
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((tNum) => (
                      <button
                        key={tNum}
                        type="button"
                        onClick={() => setSelectedTable(`Mesa ${tNum}`)}
                        className={`p-2 rounded-xl border text-xs font-medium text-center transition-all ${
                          selectedTable === `Mesa ${tNum}`
                            ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] border-[rgb(var(--primary))] font-bold'
                            : 'bg-[rgb(var(--surface))] text-[rgb(var(--muted))] border-white/10'
                        }`}
                      >
                        Mesa {tNum} (4p)
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Summary Column */}
          <div className="space-y-4">
            <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="font-display text-sm font-bold text-[rgb(var(--text))]">Resumen de Reserva</h3>
              <div className="space-y-2 text-xs divide-y divide-white/5">
                <div className="flex justify-between pt-1">
                  <span className="text-[rgb(var(--muted))]">Fecha y hora:</span>
                  <span className="font-bold text-[rgb(var(--text))]">{date} {timeSlot}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[rgb(var(--muted))]">Ubicación seleccionada:</span>
                  <span className="font-bold text-[rgb(var(--primary))]">{selectedTable}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-[rgb(var(--muted))]">Comensales:</span>
                  <span className="font-bold text-[rgb(var(--text))]">{partySize}</span>
                </div>
                {totalDepositMinor > 0 && (
                  <div className="flex justify-between pt-2 text-amber-400 font-bold">
                    <span>Depósito de garantía:</span>
                    <Price amountMinor={totalDepositMinor} />
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5">
                <input
                  type="text"
                  required
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
                />
                <input
                  type="tel"
                  required
                  placeholder="WhatsApp / Teléfono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl shadow-lg"
              >
                Confirmar Reserva
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
