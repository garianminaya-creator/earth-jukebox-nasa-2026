import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Compass } from 'lucide-react';
import { EarthDisc, InteractionMode, PixelTelemetry } from '../types/jukebox';
import { samplePixelTelemetry } from '../utils/colorScience';

interface EarthViewportProps {
  disc: EarthDisc;
  isPlaying: boolean;
  mode: InteractionMode;
  blindfoldMode: boolean;
  probePos: { x: number; y: number };
  onProbeMove: (pos: { x: number; y: number }) => void;
  onTelemetry: (telemetry: PixelTelemetry, userTriggered: boolean) => void;
  onTogglePlay: () => void;
  onToggleBlindfold: () => void;
}

const DISPLAY_W = 960;
const DISPLAY_H = 540;
const SAMPLE_W = 240;
const SAMPLE_H = 135;

export const EarthViewport: React.FC<EarthViewportProps> = ({
  disc,
  isPlaying,
  mode,
  blindfoldMode,
  probePos,
  onProbeMove,
  onTelemetry,
  onTogglePlay,
  onToggleBlindfold,
}) => {
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [mediaReady, setMediaReady] = useState(false);
  const [timeInfo, setTimeInfo] = useState({ current: 0, duration: 0 });

  const scanXRef = useRef(disc.scanBounds.xMin);
  const scanWaveRef = useRef(0);
  const panOffsetRef = useRef(0);
  const probePosRef = useRef(probePos);
  probePosRef.current = probePos;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const blindfoldRef = useRef(blindfoldMode);
  blindfoldRef.current = blindfoldMode;
  const discRef = useRef(disc);
  discRef.current = disc;

  useEffect(() => {
    setMediaReady(false);
    scanXRef.current = disc.scanBounds.xMin + 0.04;

    if (disc.mediaType === 'video') {
      const vid = document.createElement('video');
      vid.src = disc.src;
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.preload = 'auto';

      const onReady = () => {
        setMediaReady(true);
        setTimeInfo({ current: vid.currentTime, duration: vid.duration || 1 });
        if (isPlayingRef.current) vid.play().catch(() => {});
      };

      vid.addEventListener('loadeddata', onReady);
      vid.load();
      videoRef.current = vid;
      imageRef.current = null;

      return () => {
        vid.pause();
        vid.removeEventListener('loadeddata', onReady);
        vid.src = '';
      };
    } else {
      const img = new Image();
      img.onload = () => setMediaReady(true);
      img.src = disc.src;
      imageRef.current = img;
      videoRef.current = null;
    }
  }, [disc]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || disc.mediaType !== 'video') return;
    if (isPlaying) vid.play().catch(() => {});
    else vid.pause();
  }, [isPlaying, disc]);

  useEffect(() => {
    if (!sampleCanvasRef.current) {
      const off = document.createElement('canvas');
      off.width = SAMPLE_W;
      off.height = SAMPLE_H;
      sampleCanvasRef.current = off;
    }

    let rafId = 0;
    let lastSampleMs = 0;
    let lastFrameMs = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameMs) / 1000);
      lastFrameMs = now;

      const dCanvas = displayCanvasRef.current;
      const sCanvas = sampleCanvasRef.current;
      const activeDisc = discRef.current;

      if (dCanvas && sCanvas) {
        const dCtx = dCanvas.getContext('2d');
        const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });

        if (dCtx && sCtx) {
          dCtx.fillStyle = '#050811';
          dCtx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);

          let hasFrame = false;

          if (activeDisc.mediaType === 'video' && videoRef.current && videoRef.current.readyState >= 2) {
            const vid = videoRef.current;
            const vw = vid.videoWidth || DISPLAY_W;
            const vh = vid.videoHeight || DISPLAY_H;
            const scale = Math.min(DISPLAY_W / vw, DISPLAY_H / vh);
            const dw = vw * scale;
            const dh = vh * scale;
            const dx = (DISPLAY_W - dw) / 2;
            const dy = (DISPLAY_H - dh) / 2;

            dCtx.drawImage(vid, dx, dy, dw, dh);
            sCtx.fillStyle = '#050811';
            sCtx.fillRect(0, 0, SAMPLE_W, SAMPLE_H);
            sCtx.drawImage(
              vid,
              (dx / DISPLAY_W) * SAMPLE_W,
              (dy / DISPLAY_H) * SAMPLE_H,
              (dw / DISPLAY_W) * SAMPLE_W,
              (dh / DISPLAY_H) * SAMPLE_H
            );
            hasFrame = true;
          } else if (
            activeDisc.mediaType === 'equirect-pan' &&
            imageRef.current &&
            imageRef.current.complete &&
            imageRef.current.naturalWidth > 0
          ) {
            const img = imageRef.current;
            if (isPlayingRef.current) {
              panOffsetRef.current = (panOffsetRef.current + dt * 18) % DISPLAY_W;
            }
            const shift = Math.floor(panOffsetRef.current);
            dCtx.drawImage(img, -shift, 0, DISPLAY_W, DISPLAY_H);
            dCtx.drawImage(img, DISPLAY_W - shift, 0, DISPLAY_W, DISPLAY_H);
            sCtx.drawImage(dCanvas, 0, 0, SAMPLE_W, SAMPLE_H);
            hasFrame = true;
          }

          const { xMin, xMax, yMin, yMax } = activeDisc.scanBounds;
          let activeX = probePosRef.current.x;
          let activeY = probePosRef.current.y;

          if (modeRef.current === 'scanner') {
            if (isPlayingRef.current) {
              scanXRef.current += dt * 0.08;
              if (scanXRef.current > xMax) scanXRef.current = xMin;
              scanWaveRef.current += dt * 1.3;
            }
            activeX = scanXRef.current;
            activeY = (yMin + yMax) / 2 + Math.sin(scanWaveRef.current) * ((yMax - yMin) * 0.28);
          }

          if (hasFrame && now - lastSampleMs >= 50) {
            lastSampleMs = now;
            const imgData = sCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
            onTelemetry(
              samplePixelTelemetry(imgData.data, SAMPLE_W, SAMPLE_H, activeX, activeY, activeDisc),
              false
            );
            if (activeDisc.mediaType === 'video' && videoRef.current) {
              setTimeInfo({
                current: videoRef.current.currentTime,
                duration: videoRef.current.duration || 1,
              });
            }
          }

          if (blindfoldRef.current) {
            dCtx.fillStyle = 'rgba(5, 8, 17, 0.94)';
            dCtx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
          }

          const px = activeX * DISPLAY_W;
          const py = activeY * DISPLAY_H;

          if (modeRef.current === 'scanner') {
            dCtx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
            dCtx.lineWidth = 2;
            dCtx.beginPath();
            dCtx.moveTo(px, yMin * DISPLAY_H);
            dCtx.lineTo(px, yMax * DISPLAY_H);
            dCtx.stroke();
          }

          dCtx.strokeStyle = activeDisc.accentHex;
          dCtx.lineWidth = 2;
          dCtx.beginPath();
          dCtx.arc(px, py, 14, 0, Math.PI * 2);
          dCtx.stroke();

          dCtx.fillStyle = '#ffffff';
          dCtx.beginPath();
          dCtx.arc(px, py, 3.5, 0, Math.PI * 2);
          dCtx.fill();
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onTelemetry]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>, isClick = false) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0.03, Math.min(0.97, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / rect.height));

    if (mode === 'probe' || e.buttons === 1 || isClick) {
      onProbeMove({ x, y });
      const sCanvas = sampleCanvasRef.current;
      if (sCanvas) {
        const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });
        if (sCtx) {
          const imgData = sCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
          onTelemetry(samplePixelTelemetry(imgData.data, SAMPLE_W, SAMPLE_H, x, y, disc), true);
        }
      }
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#080d1a] overflow-hidden shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950/70">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-cyan-300 font-semibold">{disc.svsId}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300 truncate max-w-[260px] sm:max-w-none">{disc.mission}</span>
        </div>

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
          <span>{blindfoldMode ? 'Mostrar Mapa (B)' : 'Ocultar Mapa (B)'}</span>
        </button>
      </div>

      <div className="relative aspect-video bg-[#050811]">
        <canvas
          ref={displayCanvasRef}
          width={DISPLAY_W}
          height={DISPLAY_H}
          tabIndex={0}
          aria-label={`Mapa interactivo: ${disc.title}`}
          onPointerDown={(e) => handlePointer(e, true)}
          onPointerMove={(e) => handlePointer(e, false)}
          className={`w-full h-full block ${mode === 'probe' ? 'cursor-crosshair' : 'cursor-pointer'}`}
        />

        {!mediaReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-slate-300">
            Cargando visualización de la NASA...
          </div>
        )}

        {!isPlaying && mediaReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35">
            <button
              type="button"
              onClick={onTogglePlay}
              className="px-6 py-3 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold shadow-lg transition cursor-pointer"
            >
              Escuchar Planeta
            </button>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {mode === 'scanner'
              ? 'Barrido automático Oeste → Este (clic en el mapa para modo manual)'
              : 'Sonda Manual: arrastra el cursor o usa ↑ ↓ ← →'}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/90 space-y-2.5">
        {disc.mediaType === 'video' && timeInfo.duration > 0 && disc.yearRange && (() => {
          const { start, end } = disc.yearRange;
          const progress = timeInfo.duration > 0 ? timeInfo.current / timeInfo.duration : 0;
          const currentYear = start + progress * (end - start);
          const displayYear = Math.round(currentYear);

          return (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                Año {start}
              </span>
              <input
                type="range"
                min={start}
                max={end}
                step={0.1}
                value={currentYear}
                aria-label="Selector de año"
                onChange={(e) => {
                  if (videoRef.current && videoRef.current.duration) {
                    const targetYear = Number(e.target.value);
                    const nextProgress = Math.max(0, Math.min(1, (targetYear - start) / (end - start)));
                    const t = nextProgress * videoRef.current.duration;
                    videoRef.current.currentTime = t;
                    setTimeInfo({ current: t, duration: videoRef.current.duration });
                  }
                }}
                className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono font-semibold text-cyan-300 shrink-0 min-w-[82px] text-right">
                {displayYear} / {end}
              </span>
            </div>
          );
        })()}

        {disc.legendLayers ? (
          <div className="space-y-2 pt-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-white border border-slate-600" />
                Nieve (Snow)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-slate-500 border border-slate-600" />
                Océano
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {disc.legendLayers.map((layer) => (
                <div key={layer.title} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-1 text-[10px]">
                    <span className="font-semibold text-slate-200 truncate">{layer.title}</span>
                    {layer.unit && <span className="font-mono text-slate-400 shrink-0">{layer.unit}</span>}
                  </div>
                  <div
                    className="h-2 w-full rounded-full border border-slate-700"
                    style={{ background: layer.gradient }}
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    {layer.labels.map((lbl) => (
                      <span key={lbl}>{lbl}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div
              className="h-2.5 w-full rounded-full border border-slate-700"
              style={{ background: disc.colorbarGradient }}
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              {disc.colorbarLabels.map((lbl) => (
                <span key={lbl}>{lbl}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
