import React from 'react';
import { Crown, Home, RotateCcw, Timer } from 'lucide-react';

interface VictoryModalProps {
  elapsedSec: number;
  bestSummitTimeSec: number | null;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 10) % 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${cs}`;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  elapsedSec,
  bestSummitTimeSec,
  onPlayAgain,
  onMainMenu,
}) => {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-400/50 bg-slate-900/95 p-6 text-center shadow-[0_0_50px_rgba(245,158,11,0.35)]">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 ring-2 ring-amber-400">
          <Crown className="h-8 w-8 text-amber-300" />
        </div>
        <h2 className="bg-gradient-to-l from-amber-200 via-yellow-400 to-amber-400 bg-clip-text text-2xl font-black text-transparent">
          مبروك! وصلت إلى القمة الذهبية 1000m
        </h2>
        <p className="mt-1 text-xs text-slate-300">
          أكملت اليد السايبرانية الصعود المستحيل بنجاح!
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <div>
            <div className="text-[11px] text-slate-400">زمن الصعود</div>
            <div className="mt-0.5 flex items-center justify-center gap-1 font-mono text-base font-black text-cyan-300">
              <Timer className="h-4 w-4" />
              {formatDuration(elapsedSec)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">أفضل زمن مسجّل</div>
            <div className="mt-0.5 font-mono text-base font-black text-amber-300">
              {bestSummitTimeSec !== null ? formatDuration(bestSummitTimeSec) : formatDuration(elapsedSec)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-500 to-yellow-400 px-4 py-2.5 text-sm font-black text-slate-950 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            <span>صعود جديد</span>
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-bold text-white active:scale-95"
          >
            <Home className="h-4 w-4" />
            <span>القائمة الرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
};
