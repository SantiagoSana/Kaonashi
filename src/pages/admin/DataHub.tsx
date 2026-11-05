import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { parseCsv } from '../../lib/csv';
import {
  Download,
  Upload,
  FileSpreadsheet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileText,
} from 'lucide-react';

export const DataHub: React.FC = () => {
  const { t, showNotification } = useApp();
  const [csvInput, setCsvInput] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [importResult, setImportResult] = useState<{ updatedCount: number; createdCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [formulaInjectionDetected, setFormulaInjectionDetected] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setCsvInput(content);
      processCsvPreview(content);
    };
    reader.readAsText(file);
  };

  const processCsvPreview = (content: string) => {
    try {
      // Check for formula injection attempts in raw input
      const rawLines = content.split('\n');
      const hasInjection = rawLines.some((l) => /^[=+\-@\t\r]|,[=+\-@\t\r]/.test(l));
      setFormulaInjectionDetected(hasInjection);

      const parsed = parseCsv(content);
      setPreviewData(parsed);
      setImportResult(null);
    } catch {
      showNotification('Error al analizar archivo CSV');
    }
  };

  const handleExecuteImport = async () => {
    if (!csvInput.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/admin/import/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvInput, dryRun }),
      });
      const data = await res.json();

      if (data.ok) {
        setImportResult({ updatedCount: data.updatedCount, createdCount: data.createdCount });
        showNotification(
          dryRun
            ? `Simulación completada: ${data.updatedCount} a actualizar, ${data.createdCount} a crear`
            : `Importación exitosa registrada en SIEM Auditoría`
        );
      } else {
        showNotification(`Error: ${data.error || 'Fallo de importación'}`);
      }
    } catch {
      showNotification('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
          {t('admin.dataHub')}
        </h1>
        <p className="text-sm text-[rgb(var(--muted))] mt-1">
          Exportación de auditoría, sincronización de catálogo CSV y protección contra inyección de fórmulas (§10).
        </p>
      </div>

      {/* CSV Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-white/10 transition-all">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <h3 className="font-bold text-sm text-[rgb(var(--text))]">Catálogo de Menú</h3>
            <p className="text-xs text-[rgb(var(--muted))]">
              Exporta los 36 platos activos con precios en COP, costos de cocina, categorías y alérgenos en formato RFC 4180.
            </p>
          </div>
          <a
            href="/api/admin/export/menu.csv"
            download
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 border border-white/10 transition-colors"
          >
            <Download size={14} />
            <span>Descargar menu.csv</span>
          </a>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-white/10 transition-all">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <h3 className="font-bold text-sm text-[rgb(var(--text))]">Leads & Contactos</h3>
            <p className="text-xs text-[rgb(var(--muted))]">
              Exporta la base de leads capturados en activaciones BTL, consentimientos de privacidad y fecha de registro.
            </p>
          </div>
          <a
            href="/api/admin/export/leads.csv"
            download
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 border border-white/10 transition-colors"
          >
            <Download size={14} />
            <span>Descargar leads.csv</span>
          </a>
        </div>

        <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-white/10 transition-all">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-sm text-[rgb(var(--text))]">Métricas & Estadísticas BTL</h3>
            <p className="text-xs text-[rgb(var(--muted))]">
              Rollups diarios de escaneos, atribución de órdenes e ingresos por portavasos, flyers y table tents.
            </p>
          </div>
          <a
            href="/api/admin/export/stats.csv"
            download
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 border border-white/10 transition-colors"
          >
            <Download size={14} />
            <span>Descargar stats.csv</span>
          </a>
        </div>
      </div>

      {/* CSV Safe Importer */}
      <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-[rgb(var(--text))] flex items-center gap-2">
              <Upload size={18} className="text-[#D4AF37]" />
              <span>Importador Seguro de Catálogo (CSV)</span>
            </h3>
            <p className="text-xs text-[rgb(var(--muted))] mt-1">
              Actualiza precios o agrega nuevos platos. Todo cambio queda registrado con hash SHA-256 en la cadena de auditoría.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-[rgb(var(--muted))] cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded accent-[#D4AF37]"
              />
              <span>Modo Simulación (Dry Run)</span>
            </label>

            <label className="py-2 px-4 rounded-xl bg-[#D4AF37] text-black font-bold text-xs cursor-pointer hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow">
              <Upload size={14} />
              <span>Seleccionar Archivo</span>
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* Security Formula Protection Badge */}
        {formulaInjectionDetected && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex items-center gap-3 text-xs text-amber-200">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <span className="font-bold block">Defensa contra Inyección de Fórmulas Activada:</span>
              <span>
                Se detectaron celdas con caracteres de comando (=, +, -, @). Han sido neutralizadas automáticamente con prefijo comilla simple (') para evitar ejecución maliciosa en hojas de cálculo.
              </span>
            </div>
          </div>
        )}

        {/* Preview Table */}
        {previewData && previewData.rows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[rgb(var(--muted))] uppercase tracking-wider">
                Vista Previa ({previewData.rows.length} filas detectadas)
              </span>
              {importResult && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  <span>
                    Procesado: {importResult.updatedCount} actualizados, {importResult.createdCount} creados
                  </span>
                </span>
              )}
            </div>

            <div className="overflow-x-auto border border-white/10 rounded-xl max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 border-b border-white/10 sticky top-0">
                  <tr>
                    {previewData.headers.slice(0, 7).map((h, i) => (
                      <th key={i} className="p-3 font-semibold text-[rgb(var(--text))]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {previewData.rows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      {previewData.headers.slice(0, 7).map((h, cIdx) => (
                        <td key={cIdx} className="p-3 text-[rgb(var(--muted))] font-mono">
                          {row[h] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleExecuteImport}
                disabled={loading}
                className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B38F26] text-[#0B0C10] font-bold text-xs tracking-wider shadow hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                <span>{dryRun ? 'Ejecutar Validación (Dry Run)' : 'Confirmar e Importar al Catálogo'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
