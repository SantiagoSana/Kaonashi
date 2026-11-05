import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useApp } from '../context/AppContext';
import { Lock, User, AlertTriangle, ShieldCheck, ArrowRight, Smartphone, Mail, Sparkles, Check } from 'lucide-react';
import { StaffRole } from '../lib/types';

export const Login: React.FC = () => {
  const [, setLocation] = useLocation();
  const { setSession, showNotification, t } = useApp();

  const [activeTab, setActiveTab] = useState<'staff' | 'customer'>('staff');

  // Staff Login State
  const [username, setUsername] = useState('kaonashi_sysmaster');
  const [password, setPassword] = useState('KaonashiMaster2026!');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // Customer Login State
  const [customerContact, setCustomerContact] = useState('guest@kaonashi.com');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.status === 429) {
        setRetryAfter(data.retryAfterSeconds || 900);
        setError('rateLimitExceeded');
      } else if (!res.ok) {
        setError('unauthorized');
      } else if (data.session) {
        setSession(data.session);
        setLocation('/admin/dashboard');
      }
    } catch {
      setError('networkError');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerContact.trim()) return;
    setCustomerLoading(true);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: customerContact }),
      });
      const data = await res.json();
      if (data.ok) {
        setOtpSent(true);
        if (data.debugCode) {
          setDebugOtp(data.debugCode);
          setOtpCode(data.debugCode); // Auto-fill for convenience in demo
        }
        showNotification('Código de verificación enviado');
      } else {
        showNotification(data.error || 'Error enviando código');
      }
    } catch {
      showNotification('Error de conexión');
    } finally {
      setCustomerLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setCustomerLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: customerContact, code: otpCode }),
      });
      const data = await res.json();
      if (data.ok) {
        setSession({
          kind: 'customer',
          role: 'customer',
          userId: data.customer.id,
          name: data.customer.name,
          email: data.customer.emailNormalized || customerContact,
          branchIds: ['branch_central'],
        });
        showNotification(`¡Bienvenido, ${data.customer.name}!`);
        setLocation('/rewards');
      } else {
        showNotification(data.error || 'Código incorrecto o expirado');
      }
    } catch {
      showNotification('Error de conexión');
    } finally {
      setCustomerLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setCustomerLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'guest.google@example.com', name: 'Comensal VIP' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSession({
          kind: 'customer',
          role: 'customer',
          userId: data.customer.id,
          name: data.customer.name,
          email: data.customer.emailNormalized,
          branchIds: ['branch_central'],
        });
        showNotification(`¡Sesión iniciada con Google!`);
        setLocation('/rewards');
      }
    } catch {
      showNotification('Error en autenticación Google');
    } finally {
      setCustomerLoading(false);
    }
  };

  const setDemoCredentials = (role: StaffRole, u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[rgb(var(--surface))] via-[rgb(var(--background))] to-[rgb(var(--background))]">
      <div className="max-w-md w-full bg-[rgb(var(--surface))] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-seigaiha opacity-20 pointer-events-none" />

        {/* Tab Switcher */}
        <div className="flex bg-[rgb(var(--background))] p-1 rounded-2xl border border-white/10 text-xs">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex-1 py-2 rounded-xl font-bold transition-all ${
              activeTab === 'staff'
                ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] shadow'
                : 'text-[rgb(var(--muted))] hover:text-white'
            }`}
          >
            Portal Staff
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex-1 py-2 rounded-xl font-bold transition-all ${
              activeTab === 'customer'
                ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] shadow'
                : 'text-[rgb(var(--muted))] hover:text-white'
            }`}
          >
            Acceso Clientes
          </button>
        </div>

        {activeTab === 'staff' ? (
          /* STAFF LOGIN */
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full border border-[rgb(var(--primary))]/40 flex items-center justify-center mx-auto bg-[rgb(var(--background))]">
                <Lock size={20} className="text-[rgb(var(--primary))]" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[rgb(var(--text))]">Portal de Staff</h2>
              <p className="text-xs text-[rgb(var(--muted))]">
                Autenticación segura para personal operativo y gerencial de Kaonashi
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>
                  {retryAfter
                    ? t('errors.rateLimitExceeded', { seconds: retryAfter })
                    : 'Credenciales inválidas. Verifica tu usuario y contraseña.'}
                </span>
              </div>
            )}

            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label className="text-xs text-[rgb(var(--muted))]">Usuario de Personal</label>
                <div className="relative mt-1">
                  <User size={16} className="absolute left-3.5 top-3 text-[rgb(var(--muted))]" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-xs text-[rgb(var(--text))] focus:border-[rgb(var(--primary))] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[rgb(var(--muted))]">Contraseña</label>
                <div className="relative mt-1">
                  <Lock size={16} className="absolute left-3.5 top-3 text-[rgb(var(--muted))]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-xs text-[rgb(var(--text))] focus:border-[rgb(var(--primary))] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[rgb(var(--primary))] hover:bg-opacity-90 text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Verificando...' : 'Iniciar Sesión'}</span>
                <ArrowRight size={14} />
              </button>
            </form>

            {/* Demo Fast Login Switcher */}
            <div className="pt-4 border-t border-white/5 space-y-2">
              <span className="text-[10px] uppercase font-bold text-[rgb(var(--muted))] tracking-wider block text-center">
                Credenciales de Evaluación Demo
              </span>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <button
                  onClick={() => setDemoCredentials('sysmaster', 'kaonashi_sysmaster', 'KaonashiMaster2026!')}
                  className="p-2 rounded-lg bg-[rgb(var(--background))] border border-white/5 text-left hover:border-white/20"
                >
                  <span className="font-bold text-[rgb(var(--primary))] block">Sysmaster</span>
                  <span className="text-[rgb(var(--muted))]">kaonashi_sysmaster</span>
                </button>

                <button
                  onClick={() => setDemoCredentials('kitchen_manager', 'itamae_lead', 'ItamaeKitchen2026!')}
                  className="p-2 rounded-lg bg-[rgb(var(--background))] border border-white/5 text-left hover:border-white/20"
                >
                  <span className="font-bold text-emerald-400 block">Itamae (Cocina)</span>
                  <span className="text-[rgb(var(--muted))]">itamae_lead</span>
                </button>

                <button
                  onClick={() => setDemoCredentials('marketing_manager', 'marketing_lead', 'BtlMarketing2026!')}
                  className="p-2 rounded-lg bg-[rgb(var(--background))] border border-white/5 text-left hover:border-white/20"
                >
                  <span className="font-bold text-amber-400 block">Marketing BTL</span>
                  <span className="text-[rgb(var(--muted))]">marketing_lead</span>
                </button>

                <button
                  onClick={() => setDemoCredentials('reception', 'reception_lead', 'HostReception2026!')}
                  className="p-2 rounded-lg bg-[rgb(var(--background))] border border-white/5 text-left hover:border-white/20"
                >
                  <span className="font-bold text-blue-400 block">Recepción / Caja</span>
                  <span className="text-[rgb(var(--muted))]">reception_lead</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CUSTOMER OTP / GOOGLE LOGIN */
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full border border-[#D4AF37]/40 flex items-center justify-center mx-auto bg-[rgb(var(--background))] text-[#D4AF37]">
                <Sparkles size={20} />
              </div>
              <h2 className="font-display text-2xl font-bold text-[rgb(var(--text))]">Mi Cuenta Kaonashi</h2>
              <p className="text-xs text-[rgb(var(--muted))]">
                Accede a tu billetera de cupones BTL, puntos y menú secreto
              </p>
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">Correo o WhatsApp</label>
                  <div className="relative mt-1">
                    <Mail size={16} className="absolute left-3.5 top-3 text-[rgb(var(--muted))]" />
                    <input
                      type="text"
                      required
                      value={customerContact}
                      onChange={(e) => setCustomerContact(e.target.value)}
                      placeholder="tu@email.com o +57300..."
                      className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={customerLoading}
                  className="w-full py-3 bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{customerLoading ? 'Enviando...' : 'Enviar Código de 6 Dígitos'}</span>
                  <ArrowRight size={14} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-300">
                  Código enviado a <span className="font-bold">{customerContact}</span>
                  {debugOtp && (
                    <div className="text-[11px] text-[rgb(var(--muted))] mt-1">
                      (Modo Demo código de prueba: <span className="font-mono text-white font-bold">{debugOtp}</span>)
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">Ingresa el Código de 6 Dígitos</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full mt-1 bg-[rgb(var(--background))] border border-white/10 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={customerLoading || otpCode.length < 6}
                  className="w-full py-3 bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{customerLoading ? 'Verificando...' : 'Confirmar e Ingresar'}</span>
                  <Check size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="w-full text-center text-xs text-[rgb(var(--muted))] hover:text-white"
                >
                  Cambiar correo o teléfono
                </button>
              </form>
            )}

            <div className="relative py-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <span className="relative bg-[rgb(var(--surface))] px-3 text-[10px] text-[rgb(var(--muted))] uppercase tracking-wider font-bold">
                O continúa con
              </span>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={customerLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
