import React, { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useApp } from '../../context/AppContext';
import { StaffRole } from '../../lib/types';
import {
  LayoutDashboard,
  Utensils,
  ClipboardList,
  Calendar,
  Layers,
  Box,
  Megaphone,
  QrCode,
  BarChart3,
  CheckSquare,
  Palette,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Home,
  Tag,
  FileSpreadsheet,
  Database,
} from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const { session, sessionLoaded, logout, activeBranch, setActiveBranch, branches, t, can } = useApp();

  // Each entry lists the permissions that unlock it; the server enforces the same rules on every API call.
  const navItems: { href: string; label: string; icon: any; perms: string[] }[] = [
    { href: '/admin/dashboard', label: t('admin.dashboard'), icon: LayoutDashboard, perms: ['analytics:sales', 'analytics:btl', 'analytics:inventory'] },
    { href: '/admin/analytics', label: t('admin.dataAnalytics'), icon: Database, perms: ['analytics:sales', 'analytics:btl', 'analytics:customers', 'analytics:inventory'] },
    { href: '/admin/kds', label: t('admin.kds'), icon: Utensils, perms: ['kds:full'] },
    { href: '/admin/orders', label: t('admin.orders'), icon: ClipboardList, perms: ['orders:read'] },
    { href: '/admin/reservations', label: t('admin.reservations'), icon: Calendar, perms: ['reservations:read'] },
    { href: '/admin/menu', label: t('admin.menu'), icon: Layers, perms: ['menu:toggle_86', 'menu:edit_price', 'menu:create'] },
    { href: '/admin/promotions', label: t('admin.promotions'), icon: Tag, perms: ['promotions:read'] },
    { href: '/admin/data-hub', label: t('admin.dataHub'), icon: FileSpreadsheet, perms: ['data_hub:export_all', 'data_hub:export_metrics', 'data_hub:import_all'] },
    { href: '/admin/marketing/campaigns', label: t('admin.marketing'), icon: Megaphone, perms: ['campaigns:read'] },
    { href: '/admin/marketing/qr', label: t('admin.qr'), icon: QrCode, perms: ['qr:generate'] },
    { href: '/admin/redeem', label: t('admin.redeem'), icon: CheckSquare, perms: ['coupons:validate_in_person'] },
    { href: '/admin/settings/branding', label: t('admin.branding'), icon: Palette, perms: ['branding:manage'] },
    { href: '/admin/audit', label: t('admin.audit'), icon: ShieldCheck, perms: ['audit:read'] },
  ];
  const visibleNav = navItems.filter((n) => n.perms.some(can));
  const current = navItems.find((n) => location === n.href || location.startsWith(`${n.href}/`));
  const allowedHere = !current || current.perms.some(can);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session || session.kind !== 'staff') setLocation(`/login?returnTo=${encodeURIComponent(location)}`);
  }, [sessionLoaded, session, location]);

  if (!sessionLoaded || !session || session.kind !== 'staff') {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[rgb(var(--muted))]">{t('auth.checking')}</div>;
  }

  const roleLabels: Record<string, string> = {
    sysmaster: 'Sysmaster', kitchen_manager: 'Kitchen Manager (Itamae)', marketing_manager: 'Marketing Manager', ops_subadmin: 'Ops Sub-admin', reception: 'Reception',
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[rgb(var(--surface))] border-r border-white/5 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display font-bold text-lg text-[rgb(var(--text))]">KAONASHI</span>
              <span className="text-[10px] bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))] px-1.5 py-0.5 rounded font-bold uppercase">
                Staff
              </span>
            </Link>
            <Link href="/" title="Ir a la web de clientes" className="text-[rgb(var(--muted))] hover:text-white p-1">
              <Home size={16} />
            </Link>
          </div>

          {/* Signed-in staff member (role comes from the server session) */}
          <div className="bg-[rgb(var(--background))] border border-white/5 p-3 rounded-xl space-y-0.5">
            <p className="text-xs font-semibold text-[rgb(var(--text))] truncate">{session.name}</p>
            <p className="text-[11px] font-mono text-[rgb(var(--primary))]">{roleLabels[session.role] || session.role}</p>
          </div>

          {/* Branch Switcher */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[rgb(var(--muted))] tracking-wider">
              Sede Activa
            </label>
            <select
              value={activeBranch.id}
              onChange={(e) => {
                const b = branches.find((br) => br.id === e.target.value);
                if (b) setActiveBranch(b);
              }}
              className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-lg text-xs py-1.5 px-2 text-[rgb(var(--text))] focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold shadow'
                      : 'text-[rgb(var(--muted))] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="text-[10px] text-[rgb(var(--muted))] font-mono">Kaonashi · Postgres</span>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--accent))]"
          >
            <LogOut size={14} />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      {/* Main Admin View Content */}
      <main className="flex-1 overflow-y-auto min-h-screen p-4 sm:p-8 min-w-0">
        {allowedHere ? (
          children
        ) : (
          <div className="max-w-md space-y-3">
            <p className="text-sm">{t('auth.forbidden')}</p>
            {visibleNav[0] && <Link href={visibleNav[0].href} className="inline-flex min-h-[40px] items-center px-4 rounded-xl bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] text-xs font-bold">{t('auth.backToPanel')}</Link>}
          </div>
        )}
      </main>
    </div>
  );
};
