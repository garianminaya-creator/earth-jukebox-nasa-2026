import { CsvDataPoint } from '../types/jukebox';

export interface ParsedSeries {
  points: CsvDataPoint[];
  sourceSummary: string;
}

const PREFERRED_VALUE_HEADERS = ['j-d', 'glob', 'global', 'mean', 'average', 'anomaly', 'co2', 'value', 'valor'];

function parseCsvLine(line: string): string[] {
  return line
    .split(',')
    .map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function isYearCandidate(num: number, raw: string): boolean {
  return /^\d{4}$/.test(raw.trim()) && num >= 1800 && num <= 2100;
}

/**
 * Parsea texto pegado (tablas públicas de la NASA, pares "año: valor" o decimales separados por comas)
 * y archivos CSV oficiales de NASA (GISTEMP, CO2 Mauna Loa, nivel del mar, etc.).
 */
export function parseNasaDataInput(rawText: string): ParsedSeries {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { points: [], sourceSummary: 'Sin datos' };
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  // Caso 1: múltiples líneas con estructura tabular o CSV
  if (lines.length >= 2) {
    const headerIndex = lines.findIndex((line) => {
      const cols = line.includes(',') ? parseCsvLine(line) : line.split(/[\t;|\s]+/);
      const hasYearCol = cols.some((c) => /^(year|año|date|fecha)$/i.test(c));
      return cols.length >= 2 && hasYearCol;
    });

    if (headerIndex !== -1) {
      const sepComma = lines[headerIndex].includes(',');
      const headers = sepComma
        ? parseCsvLine(lines[headerIndex])
        : lines[headerIndex].split(/[\t;|\s]+/);
      const yearIdx = headers.findIndex((h) => /^(year|año|date|fecha)$/i.test(h));

      let valIdx = headers.findIndex((h) =>
        PREFERRED_VALUE_HEADERS.includes(h.toLowerCase())
      );
      if (valIdx === -1) {
        valIdx = yearIdx === 0 ? 1 : 0;
      }

      const points: CsvDataPoint[] = [];
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const cols = sepComma ? parseCsvLine(lines[i]) : lines[i].split(/[\t;|\s]+/);
        const label = cols[yearIdx] || `Paso ${points.length + 1}`;
        const rawVal = cols[valIdx];
        const value = Number(rawVal);
        if (rawVal !== undefined && rawVal !== '' && Number.isFinite(value)) {
          points.push({ label, value });
        }
      }

      if (points.length > 0) {
        return {
          points,
          sourceSummary: `CSV/Tabla NASA (${headers[valIdx] || 'Valor'}, ${points.length} registros)`,
        };
      }
    }
  }

  // Caso 2: pares "2021: 0.85, 2022: 0.89, 2023: 1.12" o filas sin cabecera
  const pairMatches = [...trimmed.matchAll(/(\b(?:18|19|20)\d{2})\s*[:=\t,;\s]+\s*([+-]?\d+(?:\.\d+)?)/g)];
  if (pairMatches.length >= 2) {
    const points = pairMatches.map((m) => ({
      label: m[1],
      value: Number(m[2]),
    }));
    return {
      points,
      sourceSummary: `Tabla por años (${points.length} registros)`,
    };
  }

  // Caso 3: lista simple separada por comas, espacios o saltos de línea ("0.65, 0.74, 0.85, 0.89, 1.12")
  const tokens = trimmed
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const numericValues: number[] = [];
  for (const tok of tokens) {
    const n = Number(tok);
    if (Number.isFinite(n) && !isYearCandidate(n, tok)) {
      numericValues.push(n);
    }
  }

  if (numericValues.length > 0) {
    return {
      points: numericValues.map((value, idx) => ({
        label: `Dato ${idx + 1}`,
        value,
      })),
      sourceSummary: `Lista numérica (${numericValues.length} valores)`,
    };
  }

  return { points: [], sourceSummary: 'Formato no reconocido' };
}
