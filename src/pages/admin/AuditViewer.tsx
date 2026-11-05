import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AuditEntry } from '../../lib/types';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
} from 'lucide-react';

export const AuditViewer: React.FC = () => {
  const { t } = useApp();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [integrity, setIntegrity] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [filterAction, setFilterAction] = useState('all');

  const fetchAudit = () => {
    fetch('/api/audit')
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries || []);
        setIntegrity(d.integrity);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/audit/verify', { method: 'POST' });
      const data = await res.json();
      setIntegrity(data.integrity);
    } catch {
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTamperDemo = async () => {
    await fetch('/api/audit/tamper-demo', { method: 'POST' });
    fetchAudit();
  };

  const filteredEntries = entries.filter((e) => {
    if (filterAction !== 'all' && !e.action.includes(filterAction)) return false;
    return true;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
            {t('admin.audit')}
          </h1>
          <p className="text-xs text-[rgb(var(--muted))]">
            Registro append-only inmutable encadenado por SHA-256 (SIEM)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="px-4 py-2 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] text-xs font-bold rounded-xl flex items-center gap-1.5 shadow"
          >
            <ShieldCheck size={16} />
            <span>{isVerifying ? 'Verificando...' : 'Verificar Integridad de Cadena'}</span>
          </button>

          <button
            onClick={handleTamperDemo}
            className="px-3 py-2 bg-[rgb(var(--surface))] border border-white/10 text-xs text-red-400 hover:border-red-500/40 rounded-xl"
            title="Modifica deliberadamente una entrada para demostrar la detección de alteración"
          >
            Simular Alteración (Demo)
          </button>
        </div>
      </div>

      {/* Integrity Status Card (§10.7) */}
      {integrity && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            integrity.isValid
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/30 border-red-500/50 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {integrity.isValid ? (
              <CheckCircle2 size={24} className="text-emerald-400" />
            ) : (
              <ShieldAlert size={24} className="text-red-400" />
            )}
            <div>
              <div className="font-bold text-sm">
                {integrity.isValid
                  ? 'Cadena Criptográfica Verificada (Integridad 100%)'
                  : `¡ALTERACIÓN DETECTADA EN ENTRADA #${integrity.brokenSeq}!`}
              </div>
              <div className="text-xs opacity-80 font-mono mt-0.5">
                {integrity.isValid
                  ? 'Todas las entradas coinciden exactamente con sus firmas previas SHA-256.'
                  : `Hash esperado: ${integrity.expectedHash?.slice(0, 16)}... ≠ Hash actual: ${integrity.actualHash?.slice(0, 16)}...`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entries Table */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-[rgb(var(--text))]">
            Entradas Registradas ({entries.length})
          </h3>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-[rgb(var(--background))] border border-white/10 text-xs px-2.5 py-1.5 rounded-lg text-[rgb(var(--text))] focus:outline-none"
          >
            <option value="all">Todas las acciones</option>
            <option value="login">Inicios de sesión</option>
            <option value="menu">Modificaciones de menú</option>
            <option value="coupon">Canjes de cupones</option>
            <option value="qr">Acciones de QR</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/5 text-[rgb(var(--muted))] uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Seq</th>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Actor / Rol</th>
                <th className="py-2.5 px-3">Acción</th>
                <th className="py-2.5 px-3">Recurso</th>
                <th className="py-2.5 px-3">Resultado</th>
                <th className="py-2.5 px-3">Firma Hash SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEntries.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[rgb(var(--primary))]">
                    #{e.seq}
                  </td>
                  <td className="py-2.5 px-3 text-[rgb(var(--muted))] font-mono">
                    {e.timestamp.slice(11, 19)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-[rgb(var(--text))]">{e.actor}</span>
                    <span className="block text-[10px] text-[rgb(var(--muted))]">{e.role}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-[rgb(var(--text))]">
                    {e.action}
                  </td>
                  <td className="py-2.5 px-3 text-[rgb(var(--muted))]">{e.resource}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        e.outcome === 'success'
                          ? 'bg-emerald-950 text-emerald-400'
                          : e.outcome === 'denied'
                          ? 'bg-amber-950 text-amber-400'
                          : 'bg-red-950 text-red-400'
                      }`}
                    >
                      {e.outcome}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-[rgb(var(--muted))] truncate max-w-[120px]">
                    {e.hash.slice(0, 16)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
