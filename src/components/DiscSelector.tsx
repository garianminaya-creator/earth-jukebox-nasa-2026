import React from 'react';
import { Disc3 } from 'lucide-react';
import { EarthDisc } from '../types/jukebox';

interface DiscSelectorProps {
  discs: EarthDisc[];
  activeDiscId: string;
  isPlaying: boolean;
  onSelectDisc: (disc: EarthDisc) => void;
}

export const DiscSelector: React.FC<DiscSelectorProps> = ({
  discs,
  activeDiscId,
  isPlaying,
  onSelectDisc,
}) => {
  return (
    <aside className="rounded-2xl border border-slate-800 bg-[#080d1a] p-4 space-y-3 shadow-xl">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
          <Disc3 className="w-4 h-4" />
          <span>Discos de la Tierra</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Elige un disco (Teclas 1–{discs.length})
        </p>
      </div>

      <div className="space-y-2.5">
        {discs.map((d, index) => {
          const active = d.id === activeDiscId;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDisc(d)}
              className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                active
                  ? 'bg-slate-900 border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
              }`}
            >
              {/* Disco giratorio */}
              <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-tr ${d.vinylGradient} p-[2px] ${
                    active && isPlaying ? 'animate-vinyl' : 'animate-vinyl-paused'
                  }`}
                >
                  <div className="w-full h-full rounded-full bg-slate-950/85 flex items-center justify-center border border-white/10">
                    <div
                      className="w-3 h-3 rounded-full border border-white/40"
                      style={{ backgroundColor: d.accentHex }}
                    />
                  </div>
                </div>
                <span className="absolute -top-1 -left-1 px-1.5 py-0.2 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-slate-300">
                  {index + 1}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400/90 block truncate">
                  {d.themeBadge}
                </span>
                <h3 className="text-sm font-semibold text-white truncate">
                  {d.title}
                </h3>
                <p className="text-[11px] text-slate-400 truncate">{d.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
