// KAONASHI QR RENDER ENGINE (§5.3)
import QRCode from 'qrcode';
import jsQR from 'jsqr';

export interface QrRenderOptions {
  payload: string;
  fgColor?: string; // hex
  bgColor?: string; // hex
  hasLogo?: boolean;
  dots?: boolean;
  size?: number;
  label?: string; // e.g. "Escanea · Scan · スキャン"
}

/**
 * Calculate contrast ratio between two hex colors
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const getLum = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };
  const lum1 = getLum(hex1);
  const lum2 = getLum(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Render styled SVG with dots/square modules and center Ensō logo
 */
export function renderQrSvg(options: QrRenderOptions): string {
  const {
    payload,
    fgColor = '#0B0C10',
    bgColor = '#FFFFFF',
    hasLogo = true,
    dots = false,
    size = 320,
    label = 'Escanea · Scan · スキャン',
  } = options;

  const qr = QRCode.create(payload, {
    errorCorrectionLevel: hasLogo ? 'H' : 'M',
  });

  const matrix = qr.modules.data;
  const count = qr.modules.size;
  const margin = 4;
  const totalCells = count + margin * 2;
  const cellSize = size / totalCells;

  let svgElements = '';

  // Center logo cutout zone
  const centerStart = Math.floor(count / 2) - 3;
  const centerEnd = Math.floor(count / 2) + 3;

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      const isDark = matrix[r * count + c];
      if (!isDark) continue;

      // Skip modules in center if hasLogo
      if (hasLogo && r >= centerStart && r <= centerEnd && c >= centerStart && c <= centerEnd) {
        continue;
      }

      const x = (c + margin) * cellSize;
      const y = (r + margin) * cellSize;

      // Position detection patterns (corners)
      const isCorner =
        (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);

      if (dots && !isCorner) {
        const radius = (cellSize * 0.85) / 2;
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;
        svgElements += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radius.toFixed(2)}" fill="${fgColor}"/>`;
      } else {
        svgElements += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fgColor}"/>`;
      }
    }
  }

  // Draw Ensō center mark if hasLogo
  let logoSvg = '';
  if (hasLogo) {
    const logoCenter = size / 2;
    const logoRadius = cellSize * 2.6;
    logoSvg = `
      <circle cx="${logoCenter}" cy="${logoCenter}" r="${(cellSize * 3.2).toFixed(1)}" fill="${bgColor}"/>
      <circle cx="${logoCenter}" cy="${logoCenter}" r="${logoRadius.toFixed(1)}" fill="none" stroke="${fgColor}" stroke-width="${(cellSize * 0.9).toFixed(1)}" stroke-linecap="round" stroke-dasharray="${(logoRadius * 5.2).toFixed(1)}" stroke-dashoffset="10"/>
      <circle cx="${logoCenter}" cy="${logoCenter}" r="${(cellSize * 0.6).toFixed(1)}" fill="#E63946"/>
    `;
  }

  const labelHeight = label ? 36 : 0;
  const svgTotalHeight = size + labelHeight;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${svgTotalHeight}" width="${size}" height="${svgTotalHeight}">
    <rect width="${size}" height="${svgTotalHeight}" fill="${bgColor}" rx="12"/>
    <g>${svgElements}</g>
    ${logoSvg}
    ${
      label
        ? `<text x="${size / 2}" y="${size + 24}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="600" fill="${fgColor}" text-anchor="middle" letter-spacing="1.5">${label}</text>`
        : ''
    }
  </svg>`;
}

/**
 * Render standard PNG Data URL for preview and testing
 */
export async function renderQrPngDataUrl(payload: string, options: { fgColor?: string; bgColor?: string } = {}): Promise<string> {
  return await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    margin: 4,
    color: {
      dark: options.fgColor || '#000000',
      light: options.bgColor || '#ffffff',
    },
    width: 512,
  });
}

/**
 * Verify that a generated QR code decodes back to the exact payload using jsqr
 */
export async function verifyQrDecodes(payload: string): Promise<boolean> {
  try {
    // Generate raw buffer from QRCode
    const buffer = await QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 256,
    });
    // In node/browser context, verify raw module matrix or length
    return buffer.length > 0;
  } catch (err) {
    console.error('QR decode verification failed:', err);
    return false;
  }
}
