import React from 'react';
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
} from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const { session, setSession, logout, activeBranch, setActiveBranch, branches, t } = useApp();

  const navItems = [
    { href: '/admin/dashboard', label: t('admin.dashboard'), icon: LayoutDashboard },
    { href: '/admin/kds', label: t('admin.kds'), icon: Utensils },
    { href: '/admin/orders', label: t('admin.orders'), icon: ClipboardList },
    { href: '/admin/reservations', label: t('admin.reservations'), icon: Calendar },
    { href: '/admin/menu', label: t('admin.menu'), icon: Layers },
    { href: '/admin/promotions', label: t('admin.promotions'), icon: Tag },
    { href: '/admin/data-hub', label: t('admin.dataHub'), icon: FileSpreadsheet },
    { href: '/admin/marketing/campaigns', label: t('admin.marketing'), icon: Megaphone },
    { href: '/admin/marketing/qr', label: t('admin.qr'), icon: QrCode },
    { href: '/admin/marketing/analytics', label: t('admin.analytics'), icon: BarChart3 },
    { href: '/admin/redeem', label: t('admin.redeem'), icon: CheckSquare },
    { href: '/admin/settings/branding', label: t('admin.branding'), icon: Palette },
    { href: '/admin/audit', label: t('admin.audit'), icon: ShieldCheck },
  ];

  // Quick switch role in Demo Mode (§10.1, §9.6)
  const handleQuickRoleSwitch = async (role: StaffRole) => {
    const roleNames: Record<StaffRole, { name: string; email: string }> = {
      sysmaster: { name: 'Sysmaster Admin', email: 'master@kaonashi.internal' },
      kitchen_manager: { name: 'Kenji (Itamae)', email: 'kitchen@kaonashi.internal' },
      marketing_manager: { name: 'Elena (BTL Lead)', email: 'marketing@kaonashi.internal' },
      ops_subadmin: { name: 'Carlos (Ops)', email: 'ops@kaonashi.internal' },
      reception: { name: 'Sayuri (Host)', email: 'reception@kaonashi.internal' },
      customer: { name: 'Mia (Cliente)', email: 'mia_guest@example.com' },
    };

    const newSession = {
      kind: 'staff' as const,
      role,
      userId: `user_${role}`,
      name: roleNames[role].name,
      email: roleNames[role].email,
      branchIds: ['branch_central'],
    };

    setSession(newSession);
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

          {/* Active Role & Quick Switcher (§9.6) */}
          <div className="bg-[rgb(var(--background))] border border-white/5 p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[rgb(var(--muted))] text-[10px] uppercase font-bold tracking-wider">
                Rol Activo
              </span>
              <span className="text-[11px] font-mono font-bold text-[rgb(var(--primary))]">
                {session?.role || 'sysmaster'}
              </span>
            </div>
            <select
              value={session?.role || 'sysmaster'}
              onChange={(e) => handleQuickRoleSwitch(e.target.value as StaffRole)}
              className="w-full bg-[rgb(var(--surface))] border border-white/10 rounded-lg text-xs py-1.5 px-2 text-[rgb(var(--text))] focus:outline-none focus:border-[rgb(var(--primary))]"
            >
              <option value="sysmaster">Sysmaster (Acceso Total)</option>
              <option value="kitchen_manager">Kitchen Manager (Itamae)</option>
              <option value="marketing_manager">Marketing Manager</option>
              <option value="ops_subadmin">Ops Sub-admin</option>
              <option value="reception">Reception / Host</option>
            </select>
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
            {navItems.map((item) => {
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
          <span className="text-[10px] text-[rgb(var(--muted))] font-mono">v7.0 AI-Build</span>
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
      <main className="flex-1 overflow-y-auto min-h-screen p-4 sm:p-8">{children}</main>
    </div>
  );
};
