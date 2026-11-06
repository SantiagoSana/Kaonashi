import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Price } from '../../components/Price';
import { Reservation, ReservationStatus } from '../../lib/types';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Filter,
  Check,
} from 'lucide-react';

export const ReservationsAdmin: React.FC = () => {
  const { t, showNotification } = useApp();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterArea, setFilterArea] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);

  // New reservation form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPartySize, setNewPartySize] = useState(2);
  const [newArea, setNewArea] = useState('omakase_counter');
  const [newTimeSlot, setNewTimeSlot] = useState('20:00');

  const fetchReservations = async () => {
    try {
      const res = await fetch('/api/reservations');
      const data = await res.json();
      if (data.reservations) {
        setReservations(data.reservations);
      }
    } catch {
      showNotification('Error cargando reservas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleUpdateStatus = async (id: string, status: ReservationStatus) => {
    try {
      const res = await fetch(`/api/reservations/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ok) {
        setReservations((prev) => prev.map((r) => (r.id === id ? data.reservation : r)));
        showNotification(`Reserva actualizada a ${status}`);
      }
    } catch {
      showNotification('Error actualizando reserva');
    }
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          timeSlot: newTimeSlot,
          partySize: newPartySize,
          area: newArea,
          guestInfo: {
            name: newName,
            email: newEmail,
            phone: newPhone || '+573000000000',
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReservations((prev) => [data.reservation, ...prev]);
        setShowNewModal(false);
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        showNotification('Reserva creada exitosamente');
      }
    } catch {
      showNotification('Error creando reserva');
    }
  };

  const filtered = reservations.filter((r) => (filterArea === 'all' ? true : r.area === filterArea));

  const statusBadge = (status: ReservationStatus) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400">Confirmada</span>;
      case 'seated':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">En Mesa</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 text-[rgb(var(--muted))]">Completada</span>;
      case 'no_show':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400">No-Show</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-500/20 text-gray-400">Cancelada</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
            {t('admin.reservations')}
          </h1>
          <p className="text-sm text-[rgb(var(--muted))] mt-1">
            Gestión de turnos de comensales, barra Omakase, retención de depósitos y control de no-shows (§6.7).
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="py-2.5 px-4 rounded-xl bg-[#D4AF37] text-black font-bold text-xs tracking-wider flex items-center gap-2 shadow hover:brightness-110 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Nueva Reserva Manual</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-[rgb(var(--muted))] uppercase">Total Reservas</span>
          <div className="text-xl font-bold text-white">{reservations.length}</div>
        </div>
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-[rgb(var(--muted))] uppercase">Comensales en Mesa</span>
          <div className="text-xl font-bold text-emerald-400">
            {reservations.filter((r) => r.status === 'seated').length}
          </div>
        </div>
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-[rgb(var(--muted))] uppercase">Barra Omakase</span>
          <div className="text-xl font-bold text-[#D4AF37]">
            {reservations.filter((r) => r.area === 'omakase_bar').length} turnos
          </div>
        </div>
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-[rgb(var(--muted))] uppercase">Depósitos Retenidos</span>
          <div className="text-xl font-bold text-white">
            <Price
              amountMinor={reservations.reduce(
                (sum, r) => sum + (r.depositStatus === 'paid' || r.depositStatus === 'forfeited' ? r.depositAmountMinor : 0),
                0
              )}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Todas las Áreas' },
          { id: 'omakase_counter', label: 'Barra Omakase' },
          { id: 'dining_room', label: 'Salón Principal' },
          { id: 'tatami_room', label: 'Tatami VIP' },
          { id: 'terrace', label: 'Terraza' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterArea(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filterArea === tab.id
                ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] shadow'
                : 'bg-[rgb(var(--surface))] border border-white/5 text-[rgb(var(--muted))] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reservations Table */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Hora / Fecha</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Comensal</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Personas</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Área Asignada</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Depósito</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))]">Estado</th>
                <th className="p-3.5 font-semibold text-[rgb(var(--text))] text-right">Acciones de Sala</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/5">
                  <td className="p-3.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Clock size={13} className="text-[#D4AF37]" />
                      <span>{r.timeSlot}</span>
                    </div>
                    <span className="text-[11px] text-[rgb(var(--muted))]">{r.date}</span>
                  </td>
                  <td className="p-3.5">
                    <div className="font-semibold text-white">{r.guestInfo.name}</div>
                    <div className="text-[11px] text-[rgb(var(--muted))]">{r.guestInfo.phone}</div>
                    {r.guestInfo.specialRequests && (
                      <div className="text-[10px] text-amber-300 italic mt-0.5 line-clamp-1">
                        Nota: {r.guestInfo.specialRequests}
                      </div>
                    )}
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1 font-semibold text-white">
                      <Users size={13} className="text-[rgb(var(--muted))]" />
                      <span>{r.partySize} personas</span>
                    </div>
                  </td>
                  <td className="p-3.5 text-[rgb(var(--muted))] capitalize">
                    {r.area.replace('_', ' ')}
                  </td>
                  <td className="p-3.5">
                    <div className="font-semibold text-white">
                      <Price amountMinor={r.depositAmountMinor} />
                    </div>
                    <span className="text-[10px] text-[rgb(var(--muted))] uppercase">
                      {r.depositStatus}
                    </span>
                  </td>
                  <td className="p-3.5">{statusBadge(r.status)}</td>
                  <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                    {r.status === 'confirmed' && (
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'seated')}
                        className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors"
                      >
                        Sentar
                      </button>
                    )}
                    {r.status === 'seated' && (
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'completed')}
                        className="py-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] transition-colors"
                      >
                        Finalizar
                      </button>
                    )}
                    {r.status === 'confirmed' && (
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'no_show')}
                        className="py-1 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-[11px] transition-colors"
                        title="Marcar No-Show y retener depósito"
                      >
                        No-Show
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Reservation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[rgb(var(--surface))] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <h3 className="font-display text-xl font-bold text-white">Nueva Reserva en Sala</h3>

            <form onSubmit={handleCreateReservation} className="space-y-4 text-xs">
              <div>
                <label className="text-[rgb(var(--muted))] block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[rgb(var(--muted))] block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="text-[rgb(var(--muted))] block mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[rgb(var(--muted))] block mb-1">Personas</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newPartySize}
                    onChange={(e) => setNewPartySize(Number(e.target.value))}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[rgb(var(--muted))] block mb-1">Hora</label>
                  <input
                    type="time"
                    value={newTimeSlot}
                    onChange={(e) => setNewTimeSlot(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[rgb(var(--muted))] block mb-1">Área</label>
                  <select
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    <option value="omakase_counter">Omakase</option>
                    <option value="dining_room">Salón</option>
                    <option value="tatami_room">Tatami</option>
                    <option value="terrace">Terraza</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-[rgb(var(--muted))] font-bold hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold hover:brightness-110"
                >
                  Crear Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
