// KAONASHI SECURE CSV UTILITIES
// RFC 4180 compliant with formula injection defense (§10 security)

export interface CsvColumn<T> {
  key: keyof T | string;
  header: string;
  format?: (value: any, row: T) => string;
}

/**
 * Escapes strings to neutralize Spreadsheet Formula Injection (CSV Injection).
 * Any cell value starting with '=', '+', '-', '@', '\t', or '\r' is prefixed with an apostrophe `'`.
 */
export function sanitizeForCsvFormulaInjection(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);

  // Check dangerous leading characters
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Serializes an array of objects into RFC 4180 CSV with formula injection defense.
 */
export function exportToCsv<T>(data: T[], columns: CsvColumn<T>[]): string {
  const headerRow = columns.map((col) => escapeCsvCell(col.header)).join(',');

  const rows = data.map((row) => {
    return columns
      .map((col) => {
        let rawVal: any;
        if (typeof col.key === 'string' && col.key in (row as any)) {
          rawVal = (row as any)[col.key];
        } else {
          rawVal = '';
        }

        const formatted = col.format ? col.format(rawVal, row) : sanitizeForCsvFormulaInjection(rawVal);
        return escapeCsvCell(formatted);
      })
      .join(',');
  });

  return [headerRow, ...rows].join('\r\n');
}

/**
 * Escapes a single cell per RFC 4180 (wraps in quotes if contains comma, quote, or newline).
 */
function escapeCsvCell(val: string): string {
  const needsQuotes = /[",\r\n]/.test(val);
  const escaped = val.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * Parses RFC 4180 CSV text safely, stripping formula injection escape prefixes on read.
 */
export function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++;
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        // Handle CRLF
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Push final cell/row if remaining
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].map((h) => h.replace(/^'/, ''));
  const rows = lines.slice(1).map((cells) => {
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      let cellVal = cells[idx] || '';
      // Strip CSV injection prefix if present
      if (cellVal.startsWith("'") && /^[=+\-@\t\r]/.test(cellVal.slice(1))) {
        cellVal = cellVal.slice(1);
      }
      rowObj[h] = cellVal;
    });
    return rowObj;
  });

  return { headers, rows };
}
