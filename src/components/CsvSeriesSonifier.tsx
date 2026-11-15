import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, Play, Pause, RotateCcw, ExternalLink, Sparkles, Eye, EyeOff } from 'lucide-react';
import { CsvDataPoint, PixelTelemetry } from '../types/jukebox';
import { parseNasaDataInput } from '../utils/nasaTableParser';
import { getToneBehaviorLabel, quantizeToNote } from '../utils/colorScience';

interface CsvSeriesSonifierProps {
  isPlaying: boolean;
  blindfoldMode: boolean;
  onTogglePlay: () => void;
  onToggleBlindfold: () => void;
  onTelemetry: (telemetry: PixelTelemetry, userTriggered: boolean) => void;
}

const SAMPLE_GISTEMP_RECENT = `2010: 0.72, 2011: 0.61, 2012: 0.65, 2013: 0.68, 2014: 0.75, 2015: 0.90, 2016: 1.01, 2017: 0.92, 2018: 0.85, 2019: 0.98, 2020: 1.01, 2021: 0.85, 2022: 0.89, 2023: 1.17`;

const SAMPLE_HISTORICAL_STRIDE = `1880: -0.17, 1900: -0.08, 1920: -0.27, 1940: 0.13, 1960: -0.03, 1980: 0.26, 2000: 0.39, 2010: 0.72, 2016: 1.01, 2020: 1.01, 2022: 0.89, 2023: 1.17`;

const SAMPLE_CO2_RECENT = `2014: 398.6, 2015: 400.8, 2016: 404.2, 2017: 406.5, 2018: 408.5, 2019: 411.4, 2020: 414.2, 2021: 416.4, 2022: 418.5, 2023: 421.1`;

function valueToColorHex(norm: number): string {
  if (norm < 0.35) return '#0284c7';
  if (norm < 0.65) return '#e2e8f0';
  if (norm < 0.82) return '#f59e0b';
  return '#ef4444';
}

export const CsvSeriesSonifier: React.FC<CsvSeriesSonifierProps> = ({
  isPlaying,
  blindfoldMode,
  onTogglePlay,
  onToggleBlindfold,
  onTelemetry,
}) => {
  const [rawInput, setRawInput] = useState(SAMPLE_GISTEMP_RECENT);
  const [unitLabel, setUnitLabel] = useState('°C');
  const [onlyRecentDemo, setOnlyRecentDemo] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseNasaDataInput(rawInput), [rawInput]);

  const displayPoints: CsvDataPoint[] = useMemo(() => {
    if (onlyRecentDemo && parsed.points.length > 15) {
      return parsed.points.slice(-15);
    }
    return parsed.points;
  }, [parsed.points, onlyRecentDemo]);

  const { minVal, maxVal } = useMemo(() => {
    if (displayPoints.length === 0) return { minVal: 0, maxVal: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const p of displayPoints) {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
    if (min === max) return { minVal: min - 1, maxVal: max + 1 };
    return { minVal: min, maxVal: max };
  }, [displayPoints]);

  useEffect(() => {
    setActiveIndex(0);
  }, [displayPoints.length, rawInput]);

  const emitPoint = (idx: number, userTriggered: boolean) => {
    const pt = displayPoints[idx];
    if (!pt) return;
    const norm = Math.max(0.02, Math.min(0.98, (pt.value - minVal) / (maxVal - minVal)));
    const { note, freq } = quantizeToNote(norm);
    const total = Math.max(1, displayPoints.length - 1);
    const pan = total > 0 ? (idx / total) * 1.7 - 0.85 : 0;

    onTelemetry(
      {
        xNorm: total > 0 ? idx / total : 0.5,
        yNorm: 1 - norm,
        lat: 0,
        lon: 0,
        regionName: `Serie NASA · ${pt.label}`,
        hex: valueToColorHex(norm),
        normalizedValue: norm,
        formattedValue: `${pt.value > 0 && unitLabel === '°C' ? '+' : ''}${pt.value} ${unitLabel}`.trim(),
        categoryLabel: getToneBehaviorLabel(norm),
        noteName: note,
        frequencyHz: freq,
        stereoPan: pan,
      },
      userTriggered
    );
  };

  useEffect(() => {
    if (displayPoints.length > 0) {
      emitPoint(Math.min(activeIndex, displayPoints.length - 1), false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, displayPoints]);

  useEffect(() => {
    if (!isPlaying || displayPoints.length === 0) return;

    const pt = displayPoints[activeIndex] || displayPoints[0];
    const norm = Math.max(0.02, Math.min(0.98, (pt.value - minVal) / (maxVal - minVal)));
    // Graves y lentos para anomalías mínimas (~580 ms), más agudos y urgentes para valores altos (~280 ms)
    const stepDelayMs = Math.round(580 - norm * 300);

    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1 >= displayPoints.length ? 0 : prev + 1));
    }, stepDelayMs);

    return () => window.clearTimeout(timer);
  }, [isPlaying, activeIndex, displayPoints, minVal, maxVal]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setRawInput(text);
    setOnlyRecentDemo(true);
    if (/co2|ppm/i.test(text + file.name)) setUnitLabel('ppm');
    else if (/sea|mm/i.test(text + file.name)) setUnitLabel('mm');
    else setUnitLabel('°C');
  };

  const currentPoint = displayPoints[activeIndex];
  const currentNorm = currentPoint
    ? Math.max(0.02, Math.min(0.98, (currentPoint.value - minVal) / (maxVal - minVal)))
    : 0.5;
  const currentAudio = quantizeToNote(currentNorm);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#080d1a] overflow-hidden shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950/70">
        <div className="flex items-center gap-2 text-xs">
          <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-white">Tablas Públicas y CSV Oficiales de la NASA</span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://data.giss.nasa.gov/gistemp/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-cyan-300 border border-slate-700"
          >
            <span>Abrir NASA GISTEMP</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={onToggleBlindfold}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
              blindfoldMode
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {blindfoldMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{blindfoldMode ? 'Mostrar Gráfica (B)' : 'Ocultar Gráfica (B)'}</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="nasa-table-input" className="text-xs font-semibold text-slate-200">
                1. Pega datos o números separados por comas
              </label>
              <select
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                aria-label="Unidad de los datos"
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] text-cyan-300"
              >
                <option value="°C">°C (Temperatura)</option>
                <option value="ppm">ppm (CO₂)</option>
                <option value="mm">mm (Nivel del mar)</option>
                <option value="">Sin unidad</option>
              </select>
            </div>
            <textarea
              id="nasa-table-input"
              rows={4}
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setFileName(null);
              }}
              placeholder="Ejemplo: 2021: 0.85, 2022: 0.89, 2023: 1.17 — o pega filas de una tabla o CSV"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400/60 focus:outline-none p-2.5 text-xs font-mono text-slate-200 leading-relaxed"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRawInput(SAMPLE_GISTEMP_RECENT);
                  setUnitLabel('°C');
                  setFileName(null);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-cyan-200 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                GISTEMP 2010–2023
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawInput(SAMPLE_HISTORICAL_STRIDE);
                  setUnitLabel('°C');
                  setFileName(null);
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 cursor-pointer"
              >
                Historia 1880–2023
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawInput(SAMPLE_CO2_RECENT);
                  setUnitLabel('ppm');
                  setFileName(null);
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-amber-200 cursor-pointer"
              >
                CO₂ 2014–2023
              </button>
            </div>
          </div>

          <div className="space-y-2 flex flex-col justify-between rounded-xl bg-slate-950/80 border border-slate-800 p-3">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-200">
                2. O carga un archivo .CSV oficial de la NASA
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Lee automáticamente columnas de años y promedios globales (ej. <span className="font-mono text-slate-300">Year, J-D</span> de GISTEMP) para reproducirlos uno tras otro durante tu demo.
              </p>
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-xs font-medium text-cyan-200 transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>{fileName ? `Archivo: ${fileName}` : 'Subir CSV oficial de la NASA'}</span>
              </button>

              <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer select-none px-1">
                <span>Extraer últimos 15 registros clave (ideal demo)</span>
                <input
                  type="checkbox"
                  checked={onlyRecentDemo}
                  onChange={(e) => setOnlyRecentDemo(e.target.checked)}
                  className="accent-cyan-400 cursor-pointer"
                />
              </label>

              <div className="text-[11px] font-mono text-cyan-300 px-1">
                {parsed.sourceSummary}
              </div>
            </div>
          </div>
        </div>

        {/* Gráfica cronológica interactiva / Modo Accesible */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTogglePlay}
                disabled={displayPoints.length === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'Pausar Secuencia' : 'Reproducir Secuencia (Hz)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveIndex(0);
                  emitPoint(0, true);
                }}
                aria-label="Reiniciar secuencia"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {currentPoint && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200">
                  {currentPoint.label}
                </span>
                <span className="text-cyan-300 font-bold">
                  {currentPoint.value} {unitLabel}
                </span>
                <span className="text-amber-300">
                  → {currentAudio.freq.toFixed(0)} Hz ({currentAudio.note})
                </span>
              </div>
            )}
          </div>

          {blindfoldMode ? (
            <div className="h-36 flex flex-col items-center justify-center rounded-lg border border-dashed border-amber-400/40 bg-slate-950/90 text-center px-4">
              <p className="text-xs font-semibold text-amber-200">
                Modo Accesible (Sin Gráfica Visual)
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-md">
                Escucha cómo los tonos graves y lentos en años fríos aceleran hacia frecuencias agudas e intensas en los picos recientes. Pulsa V para narrar el año actual.
              </p>
            </div>
          ) : displayPoints.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-slate-400">
              Pega números separados por comas o sube un CSV para generar la secuencia sonora.
            </div>
          ) : (
            <div className="h-36 flex items-end gap-1 pt-4 pb-1 px-1 overflow-x-auto">
              {displayPoints.map((pt, idx) => {
                const norm = Math.max(0.06, Math.min(1, (pt.value - minVal) / (maxVal - minVal)));
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={`${pt.label}-${idx}`}
                    type="button"
                    onClick={() => {
                      setActiveIndex(idx);
                      emitPoint(idx, true);
                    }}
                    title={`${pt.label}: ${pt.value} ${unitLabel}`}
                    className="flex-1 min-w-[14px] h-full flex flex-col justify-end items-center gap-1 group cursor-pointer"
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isActive ? 'ring-2 ring-white scale-x-105' : 'opacity-75 group-hover:opacity-100'
                      }`}
                      style={{
                        height: `${Math.round(14 + norm * 86)}%`,
                        backgroundColor: valueToColorHex(norm),
                      }}
                    />
                    <span
                      className={`text-[9px] font-mono truncate max-w-full ${
                        isActive ? 'text-cyan-300 font-bold' : 'text-slate-500'
                      }`}
                    >
                      {pt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
