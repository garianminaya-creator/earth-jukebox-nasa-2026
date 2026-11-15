import { EarthDisc, PixelTelemetry } from '../types/jukebox';

const PENTATONIC_NOTES = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
  'C6', 'D6', 'E6',
];

const NOTE_FREQS: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.0, A3: 220.0,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  C6: 1046.5, D6: 1174.66, E6: 1318.51,
};

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }

  return [h, s, l];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function quantizeToNote(normalized: number): { note: string; freq: number } {
  const clamped = Math.max(0, Math.min(0.999, normalized));
  const idx = Math.floor(clamped * PENTATONIC_NOTES.length);
  const note = PENTATONIC_NOTES[idx] || 'C4';
  return { note, freq: NOTE_FREQS[note] || 261.63 };
}

export function getToneBehaviorLabel(normalized: number): string {
  if (normalized < 0.35) return 'Tono grave y lento (valor bajo)';
  if (normalized < 0.72) return 'Tono medio estable';
  return 'Tono agudo e intenso (alerta)';
}

export function resolveGeoRegion(lat: number, lon: number): string {
  if (lat > 66) return 'Ártico';
  if (lat < -60) return 'Antártida';
  if (lon >= -82 && lon <= -34 && lat >= -55 && lat <= 12) return 'Sudamérica';
  if (lon >= -130 && lon <= -60 && lat > 12 && lat <= 66) return 'América del Norte';
  if (lon > -60 && lon < -12 && lat >= -55 && lat <= 62) return 'Océano Atlántico';
  if (lon >= -18 && lon <= 52 && lat >= -36 && lat <= 36) return 'África';
  if (lon >= -10 && lon <= 45 && lat > 36 && lat <= 66) return 'Europa';
  if (lon > 45 && lon <= 145 && lat >= 10 && lat <= 66) return 'Asia';
  if (lon > 110 && lon <= 155 && lat >= -44 && lat < -10) return 'Oceanía';
  return 'Océano Pacífico / Índico';
}

export function decodePixelScience(
  r: number,
  g: number,
  b: number,
  disc: EarthDisc
): { normalized: number; formattedValue: string; category: string } {
  const [h, s, l] = rgbToHsl(r, g, b);
  let norm = 0.5;
  let category = 'Estable';

  if (disc.mappingMode === 'gistemp_records') {
    if (l < 0.07 || (s < 0.15 && l > 0.58)) {
      norm = 0.5;
      category = 'Promedio Base (0 °C)';
    } else if (h >= 175 && h <= 265) {
      const cool = Math.min(1, s * 1.15 * (1.15 - l * 0.5));
      norm = Math.max(0.04, 0.5 - cool * 0.45);
      category = norm < 0.25 ? 'Enfriamiento Intenso' : 'Más Frío que la Base';
    } else if (h < 72 || h > 330) {
      const warm = h > 330 ? 1 : Math.max(0, (72 - h) / 72);
      norm = Math.min(0.98, 0.52 + warm * 0.36 + s * 0.1);
      category = norm > 0.8 ? 'Calentamiento Extremo' : 'Anomalía Cálida';
    }
    const val = disc.minVal + norm * (disc.maxVal - disc.minVal);
    const sign = val > 0.05 ? '+' : '';
    return { normalized: norm, formattedValue: `${sign}${val.toFixed(1)} °C`, category };
  }

  if (disc.mappingMode === 'co2_airs') {
    if (l < 0.08 || (s < 0.12 && l > 0.85)) {
      norm = 0.25;
      category = 'Referencia';
    } else if (h >= 205 && h <= 265) {
      norm = 0.06 + ((265 - h) / 60) * 0.22;
      category = 'Concentración Base';
    } else if (h >= 120 && h < 205) {
      norm = 0.28 + ((205 - h) / 85) * 0.22;
      category = 'Transición Estacional';
    } else if (h >= 46 && h < 120) {
      norm = 0.5 + ((120 - h) / 74) * 0.22;
      category = 'Acumulación Moderada';
    } else if (h >= 18 && h < 46) {
      norm = 0.72 + ((46 - h) / 28) * 0.16;
      category = 'Concentración Elevada';
    } else {
      norm = 0.88 + Math.min(0.11, s * 0.11);
      category = 'Pico Crítico de CO₂';
    }
    const val = disc.minVal + norm * (disc.maxVal - disc.minVal);
    return { normalized: norm, formattedValue: `${val.toFixed(1)} ppm`, category };
  }

  if (disc.mappingMode === 'geos_aerosols') {
    if (l < 0.13 || (h >= 210 && h <= 245 && l < 0.25)) {
      norm = Math.max(0.05, l);
      category = 'Atmósfera Despejada';
    } else if (h >= 165 && h < 232) {
      norm = 0.28 + Math.min(0.26, l * 0.42);
      category = 'Sal Marina (Ciclones)';
    } else if (h >= 33 && h < 80) {
      norm = 0.52 + Math.min(0.24, l * 0.35);
      category = 'Polvo Mineral (Sahara)';
    } else if (h >= 232 && h <= 330) {
      norm = 0.65 + Math.min(0.2, l * 0.3);
      category = 'Sulfatos';
    } else {
      norm = 0.78 + Math.min(0.21, s * 0.14 + l * 0.15);
      category = 'Humo de Incendios';
    }
    const idx = Math.round(norm * 100);
    return { normalized: norm, formattedValue: `Índice ${idx}/100`, category };
  }

  if (disc.mappingMode === 'water_cycle') {
    if (l < 0.12 && s < 0.25) {
      norm = 0.08;
      category = 'Océano / Fondo';
    } else if (s < 0.16 && l >= 0.8) {
      norm = 0.62;
      category = 'Nieve (Snow)';
    } else if (h >= 170 && h <= 202 && s > 0.35 && l > 0.45) {
      const snowM = Math.min(1.5, 0.25 + l * 1.25);
      norm = Math.min(0.82, 0.45 + snowM * 0.24);
      return {
        normalized: norm,
        formattedValue: `${snowM.toFixed(2)} m nieve`,
        category: 'Profundidad de Nieve',
      };
    } else if (h >= 200 && h <= 245 && s > 0.4 && l < 0.42) {
      norm = 0.16;
      category = 'Océano';
    } else if ((h >= 38 && h <= 72 && s > 0.55 && l > 0.45) || (h < 38 && s > 0.55) || (h > 265 && h <= 345 && s > 0.35)) {
      const precipRatio = h >= 38 && h <= 72 ? 0.88 : h < 38 ? 0.68 : 0.44;
      const rate = precipRatio * 0.001;
      norm = Math.min(0.98, 0.55 + precipRatio * 0.42);
      return {
        normalized: norm,
        formattedValue: `${rate.toFixed(5)} kg/m²/s`,
        category: 'Precipitación Líquida',
      };
    } else {
      let wetness = 0.2;
      if (h >= 72 && h < 170) {
        wetness = Math.min(0.88, 0.45 + ((h - 72) / 98) * 0.4);
      } else if (h >= 170 && h <= 245) {
        wetness = 0.92;
      } else {
        wetness = Math.max(0.05, Math.min(0.45, 0.45 - l * 0.35));
      }
      norm = 0.2 + wetness * 0.6;
      return {
        normalized: norm,
        formattedValue: `${wetness.toFixed(2)} humedad`,
        category: 'Humedad del Suelo',
      };
    }
    return { normalized: norm, formattedValue: category === 'Nieve (Snow)' ? 'Nieve' : 'Océano', category };
  }

  // sea_level
  if (l < 0.13 && s < 0.25) {
    norm = 0.5;
    category = 'Masa Continental';
  } else if (s < 0.15 && l > 0.55) {
    norm = 0.5;
    category = 'Nivel Medio (0 mm)';
  } else if (h >= 175 && h <= 285) {
    norm = Math.max(0.05, 0.48 - s * 0.42);
    category = 'Nivel Inferior';
  } else if (h < 70 || h > 330) {
    const warm = h > 330 ? 1 : Math.max(0, (70 - h) / 70);
    norm = Math.min(0.98, 0.54 + warm * 0.34 + s * 0.1);
    category = norm > 0.78 ? 'Ascenso Intenso' : 'Elevación Oceánica';
  }
  const mm = Math.round(disc.minVal + norm * (disc.maxVal - disc.minVal));
  return { normalized: norm, formattedValue: `${mm > 0 ? '+' : ''}${mm} mm`, category };
}

export function samplePixelTelemetry(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  xNorm: number,
  yNorm: number,
  disc: EarthDisc
): PixelTelemetry {
  const clampX = Math.max(0, Math.min(0.999, xNorm));
  const clampY = Math.max(0, Math.min(0.999, yNorm));
  const cx = Math.floor(clampX * width);
  const cy = Math.floor(clampY * height);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = Math.max(0, Math.min(width - 1, cx + dx));
      const sy = Math.max(0, Math.min(height - 1, cy + dy));
      const idx = (sy * width + sx) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }

  const r = Math.round(rSum / count);
  const g = Math.round(gSum / count);
  const b = Math.round(bSum / count);

  const decoded = decodePixelScience(r, g, b, disc);
  const { note, freq } = quantizeToNote(decoded.normalized);

  const { xMin, xMax, yMin, yMax } = disc.scanBounds;
  const relX = Math.max(0, Math.min(1, (clampX - xMin) / Math.max(0.01, xMax - xMin)));
  const relY = Math.max(0, Math.min(1, (clampY - yMin) / Math.max(0.01, yMax - yMin)));
  const lon = Math.round(relX * 360 - 180);
  const lat = Math.round(90 - relY * 180);

  return {
    xNorm: clampX,
    yNorm: clampY,
    lat,
    lon,
    regionName: resolveGeoRegion(lat, lon),
    hex: rgbToHex(r, g, b),
    normalizedValue: decoded.normalized,
    formattedValue: decoded.formattedValue,
    categoryLabel: decoded.category,
    noteName: note,
    frequencyHz: freq,
    stereoPan: Math.max(-0.95, Math.min(0.95, relX * 2 - 1)),
  };
}
