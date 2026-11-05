import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { renderQrSvg, getContrastRatio, verifyQrDecodes } from '../../lib/qr-render';
import {
  QrCode as QrIcon,
  Check,
  AlertTriangle,
  Download,
  Copy,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const QrWizard: React.FC = () => {
  const { t } = useApp();
  const [step, setStep] = useState(1);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Wizard fields
  const [selectedCampaignId, setSelectedCampaignId] = useState('camp_coasters');
  const [touchpointType, setTouchpointType] = useState('coaster');
  const [touchpointLabel, setTouchpointLabel] = useState('Portavasos VIP - Barra Principal');
  const [location, setLocation] = useState('Calle 85 # 12-44, Bogotá');
  const [destination, setDestination] = useState('/c/coasters');
  const [tableNumber, setTableNumber] = useState('');
  const [fgColor, setFgColor] = useState('#0B0C10');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [dots, setDots] = useState(true);
  const [hasLogo, setHasLogo] = useState(true);

  // Result state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQr, setGeneratedQr] = useState<any>(null);
  const [scanUrl, setScanUrl] = useState('');
  const [decodeVerified, setDecodeVerified] = useState(true);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns || []))
      .catch(() => {});
  }, []);

  const contrastRatio = getContrastRatio(fgColor, bgColor);
  const isContrastOk = contrastRatio >= 4.0;

  // Live SVG Preview
  const previewPayload = scanUrl || `${window.location.origin}/r/DEMO8001?s=demo_sig`;
  const liveSvg = renderQrSvg({
    payload: previewPayload,
    fgColor,
    bgColor,
    hasLogo,
    dots,
    size: 260,
    label: 'Escanea · Scan · スキャン',
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          touchpointType,
          label: touchpointLabel,
          location,
          destination: tableNumber ? `${destination}?table=${tableNumber}` : destination,
          design: { fgColor, bgColor, hasLogo, dots },
        }),
      });
      const data = await res.json();
      if (res.ok && data.qr) {
        setGeneratedQr(data.qr);
        const fullUrl = `${window.location.origin}${data.scanUrl}`;
        setScanUrl(fullUrl);

        // Verification gate with decode check (§5.3)
        const verified = await verifyQrDecodes(fullUrl);
        setDecodeVerified(verified);
        setStep(5);
      }
    } catch {
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([liveSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kaonashi_qr_${generatedQr?.shortCode || 'code'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="border-b border-white/5 pb-4">
        <h1 className="font-display text-2xl font-bold text-[rgb(var(--text))]">
          {t('admin.qr')}
        </h1>
        <p className="text-xs text-[rgb(var(--muted))]">
          Asistente de 5 pasos para crear códigos QR físicos con firma HMAC criptográfica
        </p>
      </div>

      {/* Stepper Header */}
      <div className="flex items-center justify-between border border-white/5 rounded-2xl bg-[rgb(var(--surface))] p-4">
        {[
          { num: 1, title: 'Campaña' },
          { num: 2, title: 'Touchpoint' },
          { num: 3, title: 'Destino' },
          { num: 4, title: 'Diseño' },
          { num: 5, title: 'Exportar' },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.num
                  ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))]'
                  : step > s.num
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[rgb(var(--background))] border border-white/10 text-[rgb(var(--muted))]'
              }`}
            >
              {step > s.num ? <Check size={14} /> : s.num}
            </div>
            <span
              className={`hidden sm:inline text-xs font-medium ${
                step === s.num ? 'text-[rgb(var(--text))] font-bold' : 'text-[rgb(var(--muted))]'
              }`}
            >
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Form (2 cols) */}
        <div className="md:col-span-2 space-y-6">
          {step === 1 && (
            <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
                Paso 1: Seleccionar Campaña BTL
              </h3>
              <p className="text-xs text-[rgb(var(--muted))]">
                El código QR quedará atribuido a esta campaña en los reportes de retorno de inversión.
              </p>
              <div className="space-y-3 pt-2">
                {campaigns.map((c) => (
                  <label
                    key={c.id}
                    className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedCampaignId === c.id
                        ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]'
                        : 'border-white/5 bg-[rgb(var(--background))] text-[rgb(var(--muted))] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[rgb(var(--text))]">{c.name}</span>
                      <input
                        type="radio"
                        name="campaign"
                        checked={selectedCampaignId === c.id}
                        onChange={() => setSelectedCampaignId(c.id)}
                      />
                    </div>
                    <span className="text-xs text-[rgb(var(--muted))] mt-1 block">
                      Objetivo: {c.objective} · Presupuesto: ${(c.budgetMinor || 0).toLocaleString()} COP
                    </span>
                  </label>
                ))}
              </div>
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl"
                >
                  Siguiente: Touchpoint →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
                Paso 2: Tipo de Punto de Contacto Físico
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {[
                  { id: 'coaster', label: 'Portavasos (Coaster)' },
                  { id: 'table_tent', label: 'Hablador de Mesa' },
                  { id: 'flyer', label: 'Volante (Flyer)' },
                  { id: 'takeaway_box', label: 'Caja Takeaway' },
                  { id: 'street_team', label: 'Street Team' },
                  { id: 'window_sticker', label: 'Sticker Vitrina' },
                ].map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => setTouchpointType(tp.id)}
                    className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                      touchpointType === tp.id
                        ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]'
                        : 'border-white/5 bg-[rgb(var(--background))] text-[rgb(var(--muted))]'
                    }`}
                  >
                    {tp.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5">
                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">Etiqueta Identificadora</label>
                  <input
                    type="text"
                    value={touchpointLabel}
                    onChange={(e) => setTouchpointLabel(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">Ubicación / Zona</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button onClick={() => setStep(1)} className="px-4 py-2 border border-white/10 text-xs rounded-xl">
                  ← Anterior
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl"
                >
                  Siguiente: Destino →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
                Paso 3: Destino Interno del Escaneo
              </h3>
              <p className="text-xs text-[rgb(var(--muted))]">
                Ruta segura dentro de la app (se validan contra redirecciones abiertas).
              </p>
              <div className="space-y-2 pt-2">
                {[
                  { path: '/c/coasters', label: 'Landing Page de Campaña (/c/coasters)' },
                  { path: '/menu', label: 'Menú Digital Interactivo (/menu)' },
                  { path: '/reservations', label: 'Plano de Reservas (/reservations)' },
                  { path: '/redeem', label: 'Pantalla de Canje Rápido (/redeem)' },
                ].map((dst) => (
                  <label
                    key={dst.path}
                    className={`block p-3 rounded-xl border cursor-pointer text-xs ${
                      destination === dst.path
                        ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))] font-semibold'
                        : 'border-white/5 bg-[rgb(var(--background))] text-[rgb(var(--muted))]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="destination"
                      checked={destination === dst.path}
                      onChange={() => setDestination(dst.path)}
                      className="mr-2"
                    />
                    {dst.label}
                  </label>
                ))}
              </div>

              <div className="pt-2">
                <label className="text-xs text-[rgb(var(--muted))]">Vincular a Mesa Específica (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Mesa 4"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-white/10 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-4 flex justify-between">
                <button onClick={() => setStep(2)} className="px-4 py-2 border border-white/10 text-xs rounded-xl">
                  ← Anterior
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-2.5 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl"
                >
                  Siguiente: Diseño →
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
                Paso 4: Personalización Estética y Contraste
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">Color de Módulos (Foreground)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="w-24 bg-[rgb(var(--background))] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[rgb(var(--muted))]">Fondo (Background)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-24 bg-[rgb(var(--background))] border border-white/10 rounded-lg px-2 py-1 text-xs font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Contrast Guard (§5.3) */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  isContrastOk
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-950/20 border-red-500/30 text-red-300'
                }`}
              >
                <span>Ratio de Contraste: {contrastRatio.toFixed(2)} : 1</span>
                <span>{isContrastOk ? '✓ Aprobado (>= 4:1)' : '⚠️ Bajo contraste (riesgo de lectura)'}</span>
              </div>

              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-[rgb(var(--text))] cursor-pointer">
                  <input type="checkbox" checked={dots} onChange={(e) => setDots(e.target.checked)} />
                  <span>Módulos redondeados (Dots)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-[rgb(var(--text))] cursor-pointer">
                  <input type="checkbox" checked={hasLogo} onChange={(e) => setHasLogo(e.target.checked)} />
                  <span>Sello Ensō Central</span>
                </label>
              </div>

              <div className="pt-4 flex justify-between">
                <button onClick={() => setStep(3)} className="px-4 py-2 border border-white/10 text-xs rounded-xl">
                  ← Anterior
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !isContrastOk}
                  className="px-6 py-2.5 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  {isGenerating ? 'Generando...' : 'Generar QR con Firma Criptográfica →'}
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 text-emerald-400">
                <Check size={20} />
                <h3 className="font-display text-base font-bold text-[rgb(var(--text))]">
                  ¡Código QR Creado y Firmado Exitosamente!
                </h3>
              </div>

              {decodeVerified && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <Check size={16} /> Verificación jsqr superada: el diseño decodifica el payload exacto.
                </div>
              )}

              <div className="p-3 bg-[rgb(var(--background))] border border-white/10 rounded-xl space-y-1">
                <span className="text-[10px] text-[rgb(var(--muted))] uppercase font-bold tracking-wider">
                  Enlace Resuelto con HMAC
                </span>
                <p className="text-xs font-mono text-[rgb(var(--primary))] break-all select-all">
                  {scanUrl}
                </p>
              </div>

              {/* Export actions (§5.3) */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleDownloadSvg}
                  className="py-3 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                >
                  <Download size={14} /> Descargar SVG Vectorial
                </button>
                <a
                  href={scanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3 bg-[rgb(var(--surface))] border border-white/10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 hover:text-white"
                >
                  <ExternalLink size={14} /> Probar Escaneo en Vivo
                </a>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setStep(1);
                    setGeneratedQr(null);
                    setScanUrl('');
                  }}
                  className="text-xs text-[rgb(var(--muted))] hover:underline"
                >
                  Crear otro código QR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Live Preview Column (§5.3) */}
        <div className="space-y-4">
          <div className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-6 text-center space-y-4 sticky top-24">
            <h4 className="font-display text-xs font-bold text-[rgb(var(--muted))] uppercase tracking-wider">
              Vista Previa en Vivo
            </h4>

            {/* Rendered SVG Display */}
            <div
              className="p-4 rounded-xl inline-block border border-white/5 bg-[rgb(var(--background))] shadow-xl"
              dangerouslySetInnerHTML={{ __html: liveSvg }}
            />

            <div className="text-[11px] text-[rgb(var(--muted))] space-y-1">
              <p>Tamaño mínimo de impresión recomendado:</p>
              <p className="font-mono text-[rgb(var(--text))]">2.5 cm (Portavasos) · 4.0 cm (Volantes)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
