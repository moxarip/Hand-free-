import React from 'react';
import { Flag, Home, Play, RotateCcw, Settings } from 'lucide-react';
import { DifficultyMode } from '../types/game';

interface PauseModalProps {
  difficulty: DifficultyMode;
  hasCheckpoint: boolean;
  onResume: () => void;
  onReturnCheckpoint: () => void;
  onRestartFromZero: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  difficulty,
  hasCheckpoint,
  onResume,
  onReturnCheckpoint,
  onRestartFromZero,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
    >
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/15 bg-slate-900/95 p-5 shadow-2xl">
        <h2 className="mb-4 text-center text-xl font-black text-amber-300">إيقاف مؤقت</h2>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-500 to-yellow-400 px-4 py-2.5 text-sm font-black text-slate-950 active:scale-95"
          >
            <Play className="h-4 w-4 fill-slate-950" />
            <span>استئناف اللعب</span>
          </button>

          {difficulty === 'CHECKPOINTS' && hasCheckpoint && (
            <button
              type="button"
              onClick={onReturnCheckpoint}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-200 active:scale-95"
            >
              <Flag className="h-4 w-4" />
              <span>العودة لآخر نقطة حفظ</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestartFromZero}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 active:scale-95"
          >
            <RotateCcw className="h-4 w-4 text-cyan-300" />
            <span>إعادة من البداية (0m)</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 active:scale-95"
          >
            <Settings className="h-4 w-4 text-amber-300" />
            <span>الإعدادات</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-200 hover:bg-rose-500/20 active:scale-95"
          >
            <Home className="h-4 w-4" />
            <span>القائمة الرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
};
