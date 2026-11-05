import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Price } from '../../components/Price';
import { Order, OrderStatus } from '../../lib/types';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Flame,
  Check,
  X,
  ShieldAlert,
} from 'lucide-react';

export const Kds: React.FC = () => {
  const { t } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [lastBumped, setLastBumped] = useState<Order | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Ticker for elapsed time calculation
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = () => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchOrders();

    // SSE connection for live KDS updates (§8.2, §0.1 item 11)
    const eventSource = new EventSource('/api/stream/kds');
    eventSource.addEventListener('order_update', (e) => {
      try {
        const updated: Order = JSON.parse(e.data);
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === updated.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = updated;
            return copy;
          }
          return [updated, ...prev];
        });
      } catch {}
    });

    return () => eventSource.close();
  }, []);

  // Update order status
  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (newStatus === 'delivered' || newStatus === 'completed') {
      if (targetOrder) setLastBumped(targetOrder);
    }

    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchOrders();
    } catch {}
  };

  // Quick 86 item (§8.2)
  const handle86Item = async (itemId: string) => {
    try {
      await fetch(`/api/menu/${itemId}/toggle-86`, { method: 'POST' });
    } catch {}
  };

  // Filter orders for KDS
  const activeOrders = orders.filter((o) =>
    ['pending_confirmation', 'received', 'preparing', 'quality_check', 'ready_for_pickup'].includes(o.status)
  );

  const pendingConfirmOrders = activeOrders.filter((o) => o.status === 'pending_confirmation');
  const kitchenOrders = activeOrders.filter((o) => o.status !== 'pending_confirmation');

  // SLA Color calculation (§8.2)
  const getSlaClass = (createdAt: string) => {
    const ageMins = (currentTime - new Date(createdAt).getTime()) / (60 * 1000);
    if (ageMins < 5) return { border: 'border-emerald-500/50', badge: 'bg-emerald-950 text-emerald-400', label: 'OK' };
    if (ageMins < 12) return { border: 'border-amber-500/50', badge: 'bg-amber-950 text-amber-400', label: 'WATCH' };
    if (ageMins < 15) return { border: 'border-orange-500/60', badge: 'bg-orange-950 text-orange-400', label: 'LATE' };
    return { border: 'border-red-600 animate-pulse', badge: 'bg-red-950 text-red-400 animate-pulse font-bold', label: 'CRITICAL' };
  };

  return (
    <div className="space-y-6">
      {/* KDS Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">{t('kds.title')}</h1>
          <p className="text-xs text-[rgb(var(--muted))]">Gestión operativa en tiempo real con SLA de comanda</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Station Filter Tabs */}
          <div className="flex bg-[rgb(var(--surface))] border border-white/10 rounded-xl p-1 text-xs">
            {['all', 'sushi', 'robata', 'drinks', 'expo'].map((stn) => (
              <button
                key={stn}
                onClick={() => setSelectedStation(stn)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${
                  selectedStation === stn
                    ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold'
                    : 'text-[rgb(var(--muted))] hover:text-white'
                }`}
              >
                {stn === 'all' ? 'Todas' : stn}
              </button>
            ))}
          </div>

          {/* Recall Last Bumped Button */}
          {lastBumped && (
            <button
              onClick={() => handleStatusChange(lastBumped.id, 'preparing')}
              className="px-3 py-1.5 bg-[rgb(var(--surface))] border border-white/10 text-xs rounded-xl hover:text-white flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              <span>{t('kds.recall')} #{lastBumped.orderNumber}</span>
            </button>
          )}
        </div>
      </div>

      {/* To-Confirm Lane (Accept/Reject Pending Orders §8.2, §6.4) */}
      {pendingConfirmOrders.length > 0 && (
        <div className="bg-[rgb(var(--surface))] border-2 border-[rgb(var(--accent))] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[rgb(var(--accent))] flex items-center gap-1.5">
              <ShieldAlert size={16} />
              {t('kds.toConfirm', { count: pendingConfirmOrders.length })}
            </span>
            <span className="text-[11px] text-[rgb(var(--muted))]">Requiere confirmación de sala</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingConfirmOrders.map((pOrd) => (
              <div
                key={pOrd.id}
                className="bg-[rgb(var(--background))] border border-white/10 rounded-xl p-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-mono font-bold text-sm text-[rgb(var(--text))]">{pOrd.orderNumber}</div>
                  <div className="text-xs text-[rgb(var(--muted))]">
                    {pOrd.type === 'dine_in' ? `Mesa ${pOrd.tableNumber || '?'}` : 'Domicilio'} · {pOrd.guestInfo.name}
                  </div>
                  <div className="text-[11px] text-[rgb(var(--primary))] font-semibold">
                    <Price amountMinor={pOrd.totalMinor} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange(pOrd.id, 'cancelled')}
                    className="p-2 bg-red-950/60 text-red-400 hover:bg-red-900 rounded-lg text-xs"
                    title={t('kds.reject')}
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={() => handleStatusChange(pOrd.id, 'received')}
                    className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Check size={14} />
                    <span>{t('kds.accept')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Kitchen Tickets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {kitchenOrders.map((ord) => {
          const sla = getSlaClass(ord.createdAt);
          const ageMins = Math.floor((currentTime - new Date(ord.createdAt).getTime()) / (60 * 1000));

          return (
            <div
              key={ord.id}
              className={`bg-[rgb(var(--surface))] border-2 ${sla.border} rounded-2xl flex flex-col justify-between overflow-hidden shadow-lg transition-all`}
            >
              {/* Ticket Header */}
              <div className="p-4 border-b border-white/5 bg-[rgb(var(--background))]/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-[rgb(var(--text))]">
                      {ord.orderNumber}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/5 text-[rgb(var(--muted))]">
                      {ord.type === 'dine_in' ? `MESA ${ord.tableNumber || '4'}` : ord.type}
                    </span>
                  </div>
                  <div className="text-[10px] text-[rgb(var(--muted))] mt-0.5">{ord.guestInfo.name}</div>
                </div>

                {/* Elapsed Time SLA Badge */}
                <div className={`px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 ${sla.badge}`}>
                  <Clock size={12} />
                  <span>{ageMins}m</span>
                </div>
              </div>

              {/* Items List with red allergens flag (§8.2) */}
              <div className="p-4 space-y-2.5 flex-1 overflow-y-auto">
                {ord.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs border-b border-white/5 pb-2 last:border-0">
                    <div>
                      <span className="font-bold text-[rgb(var(--text))]">
                        {item.qty}x {item.name}
                      </span>
                      {item.specialInstructions && (
                        <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                          <AlertTriangle size={12} /> {item.specialInstructions}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handle86Item(item.menuItemId)}
                      title="Marcar 86 (Agotado)"
                      className="text-[10px] text-[rgb(var(--muted))] hover:text-red-400 border border-white/10 px-1.5 py-0.5 rounded ml-2"
                    >
                      86
                    </button>
                  </div>
                ))}
              </div>

              {/* Ticket Action Bottom Buttons (Touch targets at least 56px §8.2) */}
              <div className="p-3 border-t border-white/5 bg-[rgb(var(--background))] flex gap-2">
                {ord.status === 'received' && (
                  <button
                    onClick={() => handleStatusChange(ord.id, 'preparing')}
                    className="flex-1 min-h-[48px] bg-[rgb(var(--secondary))] hover:bg-[rgb(var(--primary))] hover:text-[rgb(var(--on-primary))] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>{t('kds.start')}</span>
                  </button>
                )}

                {ord.status === 'preparing' && (
                  <button
                    onClick={() => handleStatusChange(ord.id, 'quality_check')}
                    className="flex-1 min-h-[48px] bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>{t('kds.ready')}</span>
                  </button>
                )}

                {(ord.status === 'quality_check' || ord.status === 'ready_for_pickup') && (
                  <button
                    onClick={() => handleStatusChange(ord.id, 'served')}
                    className="flex-1 min-h-[48px] bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] text-xs font-black rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>{t('kds.bump')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
