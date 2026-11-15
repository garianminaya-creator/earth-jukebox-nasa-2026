import React, { useEffect, useRef } from 'react';
import { Activity, Ear, MapPin, Music2, Volume2, ExternalLink } from 'lucide-react';
import { sonificationEngine } from '../audio/SonificationEngine';
import { EarthDisc, PixelTelemetry, WorkspaceView } from '../types/jukebox';
import { getToneBehaviorLabel } from '../utils/colorScience';

interface TelemetryPanelProps {
  disc: EarthDisc;
  telemetry: PixelTelemetry | null;
  isPlaying: boolean;
  workspaceView: WorkspaceView;
  onPreviewPreset: (normalized: number) => void;
  onSpeakTelemetry: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  disc,
  telemetry,
  isPlaying,
  workspaceView,
  onPreviewPreset,
  onSpeakTelemetry,
}) => {
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = waveRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { width: w, height: h } = canvas;
          ctx.clearRect(0, 0, w, h);

          ctx.strokeStyle = 'rgba(148,163,184,0.2)';
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          const vals = sonificationEngine.getWaveform();
          ctx.strokeStyle = playingRef.current ? '#22d3ee' : '#475569';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < vals.length; i++) {
            const x = (i / (vals.length - 1)) * w;
            const y = h / 2 + (playingRef.current ? vals[i] : 0) * (h * 0.42);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const latText = telemetry ? `${Math.abs(telemetry.lat)}°${telemetry.lat >= 0 ? 'N' : 'S'}` : '--';
  const lonText = telemetry ? `${Math.abs(telemetry.lon)}°${telemetry.lon >= 0 ? 'E' : 'O'}` : '--';

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-[#080d1a] p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            Lectura en Tiempo Real
          </h2>
          <button
            type="button"
            onClick={onSpeakTelemetry}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Narrar (V)</span>
          </button>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
          <div
            className="w-11 h-11 rounded-lg border border-white/15 shrink-0"
            style={{ backgroundColor: telemetry?.hex || '#0f172a' }}
          />
          <div className="min-w-0">
            <div className="text-2xl font-bold font-display text-white truncate">
              {telemetry?.formattedValue || '--'}
            </div>
            <div className="text-xs text-cyan-300 truncate">
              {telemetry?.categoryLabel || 'Pulsa Escuchar Planeta'}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="inline-flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{telemetry?.regionName || 'Globo Terrestre'}</span>
            </span>
            <span className="font-mono text-slate-400 shrink-0">
              {latText}, {lonText}
            </span>
          </div>

          <div className="flex items-center justify-between text-amber-300 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <Music2 className="w-3.5 h-3.5" />
              {telemetry ? `${telemetry.frequencyHz.toFixed(0)} Hz · ${telemetry.noteName}` : '-- Hz'}
            </span>
            <span className="text-slate-400 text-[11px]">
              Paneo: {telemetry ? (telemetry.stereoPan < -0.15 ? 'Oeste (L)' : telemetry.stereoPan > 0.15 ? 'Este (R)' : 'Centro') : '--'}
            </span>
          </div>

          {telemetry && (
            <div className="text-[11px] font-medium text-cyan-200/90 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1">
              {getToneBehaviorLabel(telemetry.normalizedValue)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          <canvas
            ref={waveRef}
            width={260}
            height={44}
            className="w-full h-11 rounded-lg bg-slate-950 border border-slate-800"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#080d1a] p-4 space-y-2.5 shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
          <Ear className="w-4 h-4" />
          <span>Calibración Sonora</span>
        </h2>

        {disc.presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onPreviewPreset(preset.normalized)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-400/40 text-xs transition cursor-pointer"
          >
            <span className="flex items-center gap-2 text-slate-200 font-medium">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.color }} />
              {preset.label}
            </span>
            <span className="font-mono text-cyan-300">{preset.valueLabel}</span>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#080d1a] p-4 space-y-2.5 text-xs text-slate-300 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white">Cómo funciona (Hz y Accesibilidad)</span>
          <a
            href={workspaceView === 'csv' ? 'https://data.giss.nasa.gov/gistemp/' : disc.svsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
          >
            Fuente NASA <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="leading-relaxed text-slate-400">
          {workspaceView === 'csv'
            ? 'Cada dato numérico de la NASA se convierte en frecuencia en Hertz (Hz) vía Web Audio API: anomalías mínimas o negativas suenan en tonos graves y lentos, mientras los picos recientes suben a tonos agudos e intensos.'
            : disc.explanation}
        </p>
        <div className="pt-1 border-t border-slate-800/80 text-[11px] leading-relaxed text-slate-400">
          <strong className="text-cyan-300 font-semibold">Accesibilidad:</strong> permite escuchar cronológicamente la historia climática para detectar alertas y cambios sin depender de gráficas ni tablas visuales.
        </div>
      </section>
    </aside>
  );
};
