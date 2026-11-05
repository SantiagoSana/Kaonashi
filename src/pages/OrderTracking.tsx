import React, { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { useApp } from '../context/AppContext';
import { Price } from '../components/Price';
import { Order, OrderStatus } from '../lib/types';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  ChefHat,
  Search,
  Truck,
  PackageCheck,
  MapPin,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const OrderTracking: React.FC = () => {
  const [, params] = useRoute('/order/:id');
  const orderId = params?.id;
  const { t } = useApp();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial order
  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.order) setOrder(d.order);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Connect to real-time SSE stream (§0.1 item 11, §8)
    const eventSource = new EventSource('/api/stream/orders');
    eventSource.addEventListener('order_update', (e) => {
      try {
        const updated: Order = JSON.parse(e.data);
        if (updated.id === orderId) {
          setOrder(updated);
        }
      } catch {}
    });

    return () => {
      eventSource.close();
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-[rgb(var(--primary))] border-t-transparent animate-spin mx-auto" />
        <p className="text-sm text-[rgb(var(--muted))]">Cargando seguimiento de comanda...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <h2 className="font-display text-xl font-bold text-[rgb(var(--text))]">Pedido no encontrado</h2>
        <Link href="/menu" className="text-xs text-[rgb(var(--primary))] underline">
          Volver al menú
        </Link>
      </div>
    );
  }

  // 5-Stage Stepper calculation (§6.7)
  const stages: { key: string; label: string; icon: any; done: boolean; active: boolean }[] = [
    {
      key: 'received',
      label: t('order.stageReceived'),
      icon: Clock,
      done: ['preparing', 'quality_check', 'out_for_delivery', 'ready_for_pickup', 'served', 'delivered', 'completed'].includes(order.status),
      active: order.status === 'received' || order.status === 'pending_confirmation',
    },
    {
      key: 'preparing',
      label: t('order.stagePrep'),
      icon: ChefHat,
      done: ['quality_check', 'out_for_delivery', 'ready_for_pickup', 'served', 'delivered', 'completed'].includes(order.status),
      active: order.status === 'preparing',
    },
    {
      key: 'quality_check',
      label: t('order.stageBar'),
      icon: Search,
      done: ['out_for_delivery', 'ready_for_pickup', 'served', 'delivered', 'completed'].includes(order.status),
      active: order.status === 'quality_check',
    },
    {
      key: 'out_for_delivery',
      label: order.type === 'delivery' ? t('order.stageTransit') : 'Listo en Barra',
      icon: Truck,
      done: ['served', 'delivered', 'completed'].includes(order.status),
      active: order.status === 'out_for_delivery' || order.status === 'ready_for_pickup',
    },
    {
      key: 'delivered',
      label: t('order.stageDelivered'),
      icon: PackageCheck,
      done: ['served', 'delivered', 'completed'].includes(order.status),
      active: order.status === 'served' || order.status === 'delivered' || order.status === 'completed',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-8">
      {/* Header Banner */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 text-center space-y-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-seigaiha opacity-20 pointer-events-none" />
        <span className="text-xs font-mono font-bold text-[rgb(var(--primary))] tracking-wider uppercase">
          {order.orderNumber}
        </span>
        <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
          {t('order.title')}
        </h1>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[rgb(var(--primary))]/15 text-[rgb(var(--primary))]">
          <span className="w-2 h-2 rounded-full bg-[rgb(var(--primary))] animate-pulse" />
          <span className="capitalize">{order.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* 5-Stage Stepper Stepper Component (§6.7) */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-6" aria-live="polite">
        <div className="relative">
          {stages.map((stg, idx) => {
            const Icon = stg.icon;
            return (
              <div key={stg.key} className="flex items-start gap-4 pb-6 last:pb-0 relative">
                {idx < stages.length - 1 && (
                  <div
                    className={`absolute left-4 top-8 bottom-0 w-0.5 ${
                      stg.done ? 'bg-[rgb(var(--primary))]' : 'bg-white/10'
                    }`}
                  />
                )}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-colors ${
                    stg.done
                      ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))]'
                      : stg.active
                      ? 'bg-[rgb(var(--primary))]/20 border-2 border-[rgb(var(--primary))] text-[rgb(var(--primary))] animate-pulse'
                      : 'bg-[rgb(var(--background))] border border-white/10 text-[rgb(var(--muted))]'
                  }`}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 pt-1">
                  <h4
                    className={`text-sm font-bold ${
                      stg.done || stg.active ? 'text-[rgb(var(--text))]' : 'text-[rgb(var(--muted))]'
                    }`}
                  >
                    {stg.label}
                  </h4>
                  {stg.active && (
                    <p className="text-xs text-[rgb(var(--primary))] mt-0.5">En progreso...</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simulated Courier Map & Delivery PIN for delivery orders (§6.7) */}
      {order.type === 'delivery' && (
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[rgb(var(--text))] flex items-center gap-2">
              <Truck size={16} className="text-[rgb(var(--primary))]" />
              {t('order.courierLocation')}
            </span>
            {order.deliveryPin && (
              <span className="text-xs font-mono bg-[rgb(var(--secondary))] border border-white/10 px-2.5 py-1 rounded-md text-[rgb(var(--primary))] font-bold">
                {t('order.courierPin', { pin: order.deliveryPin })}
              </span>
            )}
          </div>

          {/* Stylized SVG Map (no external tile dependencies) */}
          <div className="h-44 rounded-xl bg-[rgb(var(--background))] border border-white/5 relative overflow-hidden flex items-center justify-center">
            {/* Stylized grid street lines */}
            <svg className="w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {/* Route Polyline */}
              <path
                d="M 50 140 Q 150 60 280 90 T 450 40"
                fill="none"
                stroke="rgb(212, 175, 55)"
                strokeWidth="3"
                strokeDasharray="6"
              />
            </svg>

            {/* Restaurant Marker */}
            <div className="absolute left-10 bottom-8 flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-[rgb(var(--secondary))] border border-[rgb(var(--primary))] flex items-center justify-center text-[10px] font-bold text-[rgb(var(--primary))]">
                K
              </div>
              <span className="text-[9px] text-[rgb(var(--muted))] mt-1">Kaonashi</span>
            </div>

            {/* Animated Courier Marker */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-bounce">
              <div className="w-8 h-8 rounded-full bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] flex items-center justify-center shadow-lg">
                <Truck size={16} />
              </div>
              <span className="text-[10px] bg-black/80 px-1.5 py-0.5 rounded text-white mt-1">
                En camino
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Order Item Details */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-bold text-[rgb(var(--text))] uppercase tracking-wider">
          Detalle de la Comanda
        </h4>
        <div className="divide-y divide-white/5 text-xs">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-medium text-[rgb(var(--text))]">
                  {item.qty}x {item.name}
                </span>
                {item.discountMinor > 0 && (
                  <span className="block text-[10px] text-[rgb(var(--primary))]">
                    Descuento aplicado
                  </span>
                )}
              </div>
              <Price amountMinor={item.priceMinor * item.qty - item.discountMinor} />
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/10 flex justify-between text-sm font-bold text-[rgb(var(--text))]">
          <span>{t('cart.total')}</span>
          <Price amountMinor={order.totalMinor} />
        </div>
      </div>
    </div>
  );
};
