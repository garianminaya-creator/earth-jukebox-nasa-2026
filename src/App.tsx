import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, ScanLine, Crosshair, Globe2, Volume2, FileSpreadsheet, Map } from 'lucide-react';
import { EARTH_DISCS } from './data/discs';
import { EarthDisc, InteractionMode, PixelTelemetry, WorkspaceView } from './types/jukebox';
import { sonificationEngine } from './audio/SonificationEngine';
import { DiscSelector } from './components/DiscSelector';
import { EarthViewport } from './components/EarthViewport';
import { TelemetryPanel } from './components/TelemetryPanel';
import { CsvSeriesSonifier } from './components/CsvSeriesSonifier';

export const App: React.FC = () => {
  const [activeDisc, setActiveDisc] = useState<EarthDisc>(EARTH_DISCS[0]);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('maps');
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<InteractionMode>('scanner');
  const [blindfoldMode, setBlindfoldMode] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [probePos, setProbePos] = useState({ x: 0.5, y: 0.5 });
  const [telemetry, setTelemetry] = useState<PixelTelemetry | null>(null);

  const telemetryRef = useRef<PixelTelemetry | null>(null);
  telemetryRef.current = telemetry;

  const handleTogglePlay = useCallback(async () => {
    if (!isPlaying) {
      await sonificationEngine.ensureStarted();
      sonificationEngine.setVolume(volume);
      sonificationEngine.setPlaying(true);
      setIsPlaying(true);
    } else {
      sonificationEngine.setPlaying(false);
      setIsPlaying(false);
    }
  }, [isPlaying, volume]);

  const handleSelectDisc = useCallback((disc: EarthDisc) => {
    setActiveDisc(disc);
    setWorkspaceView('maps');
    setProbePos({
      x: (disc.scanBounds.xMin + disc.scanBounds.xMax) / 2,
      y: (disc.scanBounds.yMin + disc.scanBounds.yMax) / 2,
    });
  }, []);

  const handleTelemetry = useCallback((next: PixelTelemetry, userTriggered: boolean) => {
    setTelemetry(next);
    sonificationEngine.processTelemetry(next, userTriggered);
  }, []);

  const handleProbeMove = useCallback(
    async (pos: { x: number; y: number }) => {
      setProbePos(pos);
      if (mode !== 'probe') setMode('probe');
      if (!isPlaying) {
        await sonificationEngine.ensureStarted();
        sonificationEngine.setVolume(volume);
        sonificationEngine.setPlaying(true);
        setIsPlaying(true);
      }
    },
    [mode, isPlaying, volume]
  );

  const handleSpeak = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const t = telemetryRef.current;
    const text = t
      ? `${activeDisc.title}. Región ${t.regionName}. Valor ${t.formattedValue}, ${t.categoryLabel}. Nota ${t.noteName}.`
      : `${activeDisc.title}. Pulsa espacio para iniciar la Jukebox.`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-ES';
    window.speechSynthesis.speak(utter);
  }, [activeDisc.title]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space' && tag !== 'BUTTON') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key >= '1' && e.key <= String(EARTH_DISCS.length)) {
        handleSelectDisc(EARTH_DISCS[Number(e.key) - 1]);
      } else if (e.key === 'm' || e.key === 'M') {
        setMode((prev) => (prev === 'scanner' ? 'probe' : 'scanner'));
      } else if (e.key === 'b' || e.key === 'B') {
        setBlindfoldMode((prev) => !prev);
      } else if (e.key === 'v' || e.key === 'V') {
        handleSpeak();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setMode('probe');
        setProbePos((p) => ({ ...p, x: Math.max(0.03, p.x - 0.04) }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setMode('probe');
        setProbePos((p) => ({ ...p, x: Math.min(0.97, p.x + 0.04) }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMode('probe');
        setProbePos((p) => ({ ...p, y: Math.max(0.05, p.y - 0.04) }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMode('probe');
        setProbePos((p) => ({ ...p, y: Math.min(0.95, p.y + 0.04) }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handleSelectDisc, handleSpeak]);

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-[#050811]/95 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-400 flex items-center justify-center">
              <Globe2 className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                Earth Jukebox — NASA Space Apps 2026
              </h1>
              <p className="text-xs text-slate-400">
                La máquina de discos de información de la Tierra •{' '}
                {workspaceView === 'csv' ? 'Tablas Públicas y CSV NASA' : activeDisc.title}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
              <button
                type="button"
                onClick={() => setWorkspaceView('maps')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  workspaceView === 'maps' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>Mapas NASA</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceView('csv')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  workspaceView === 'csv' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Tablas / CSV</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleTogglePlay}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition cursor-pointer ${
                isPlaying
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Pausar' : 'Escuchar Planeta'}</span>
            </button>

            {workspaceView === 'maps' && (
              <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setMode('scanner')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                    mode === 'scanner' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>Aguja Auto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('probe')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                    mode === 'probe' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Sonda Manual</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                aria-label="Volumen"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  sonificationEngine.setVolume(v);
                }}
                className="w-20 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-5 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-3 space-y-4">
          <DiscSelector
            discs={EARTH_DISCS}
            activeDiscId={workspaceView === 'maps' ? activeDisc.id : ''}
            isPlaying={isPlaying && workspaceView === 'maps'}
            onSelectDisc={handleSelectDisc}
          />
        </div>

        <div className="xl:col-span-6">
          {workspaceView === 'csv' ? (
            <CsvSeriesSonifier
              isPlaying={isPlaying}
              blindfoldMode={blindfoldMode}
              onTogglePlay={handleTogglePlay}
              onToggleBlindfold={() => setBlindfoldMode((b) => !b)}
              onTelemetry={handleTelemetry}
            />
          ) : (
            <EarthViewport
              disc={activeDisc}
              isPlaying={isPlaying}
              mode={mode}
              blindfoldMode={blindfoldMode}
              probePos={probePos}
              onProbeMove={handleProbeMove}
              onTelemetry={handleTelemetry}
              onTogglePlay={handleTogglePlay}
              onToggleBlindfold={() => setBlindfoldMode((b) => !b)}
            />
          )}
        </div>

        <div className="xl:col-span-3">
          <TelemetryPanel
            disc={activeDisc}
            telemetry={telemetry}
            isPlaying={isPlaying}
            workspaceView={workspaceView}
            onPreviewPreset={(norm) => sonificationEngine.previewCalibration(norm)}
            onSpeakTelemetry={handleSpeak}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
