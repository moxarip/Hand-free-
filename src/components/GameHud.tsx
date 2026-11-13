import React from 'react';
import { AlertTriangle, Flag, Pause, Sparkles, Timer } from 'lucide-react';
import { DifficultyMode, HudDomRefs } from '../types/game';

interface GameHudProps {
  hudRefs: React.MutableRefObject<HudDomRefs>;
  showFps: boolean;
  difficulty: DifficultyMode;
  checkpointBanner: string | null;
  milestoneBanner: string | null;
  onPause: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hudRefs,
  showFps,
  difficulty,
  checkpointBanner,
  milestoneBanner,
  onPause,
}) => {
  return (
    <div dir="rtl" className="pointer-events-none fixed inset-x-0 top-0 z-30 p-3 sm:px-5 sm:py-3">
      <div className="flex items-start justify-between gap-3">
        {/* Altitude + Progress + Biome */}
        <div className="min-w-[195px] rounded-2xl border border-white/15 bg-slate-950/60 px-3.5 py-2 backdrop-blur-md">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-bold text-amber-300">الارتفاع</span>
            <span
              ref={(el) => {
                hudRefs.current.altitudeEl = el;
              }}
              className="font-mono text-lg font-black text-white"
            >
              0m
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              ref={(el) => {
                hudRefs.current.altitudeBarEl = el;
              }}
              style={{ width: '0%' }}
              className="h-full rounded-full bg-gradient-to-l from-amber-400 to-cyan-400"
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-300">
            <span
              ref={(el) => {
                hudRefs.current.biomeEl = el;
              }}
              className="truncate font-semibold text-cyan-200"
            >
              ساحة الحاويات والرافعات
            </span>
            <span className="shrink-0 opacity-75">
              {difficulty === 'CHECKPOINTS' ? 'نقاط حفظ' : 'تحدي حقيقي'}
            </span>
          </div>
        </div>

        {/* Center Timer + FPS + Ledge / Milestone / Fall-Cam Banners */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/60 px-3.5 py-1.5 backdrop-blur-md">
            <Timer className="h-3.5 w-3.5 text-cyan-300" />
            <span
              ref={(el) => {
                hudRefs.current.timerEl = el;
              }}
              className="font-mono text-sm font-bold text-white"
            >
              00:00.0
            </span>
            {showFps && (
              <span
                ref={(el) => {
                  hudRefs.current.fpsEl = el;
                }}
                className="border-r border-white/20 pr-2 font-mono text-xs font-bold text-emerald-400"
              >
                60 FPS
              </span>
            )}
          </div>

          <div
            ref={(el) => {
              hudRefs.current.ledgeBannerEl = el;
            }}
            style={{ opacity: 0 }}
            className="rounded-full border border-cyan-400/50 bg-cyan-500/20 px-3 py-0.5 text-[11px] font-bold text-cyan-200 transition-opacity duration-100"
          >
            تمسّك بالحافة!
          </div>

          {/* Viral Fall-Cam Counter Banner */}
          <div
            ref={(el) => {
              hudRefs.current.fallCamBannerEl = el;
            }}
            style={{ opacity: 0 }}
            className="flex items-center gap-1.5 rounded-full border border-rose-400/70 bg-rose-600/35 px-4 py-1 text-xs font-black text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.45)] backdrop-blur-md transition-opacity duration-150"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
            <span
              ref={(el) => {
                hudRefs.current.fallCamDistEl = el;
              }}
            >
              سقوط حر: -80 متر!
            </span>
          </div>

          {milestoneBanner && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-400/70 bg-amber-500/25 px-4 py-1 text-xs font-black text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.4)] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{milestoneBanner}</span>
            </div>
          )}

          {checkpointBanner && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/60 bg-emerald-500/25 px-3.5 py-1 text-xs font-bold text-emerald-200 shadow-lg backdrop-blur-md">
              <Flag className="h-3.5 w-3.5" />
              <span>{checkpointBanner}</span>
            </div>
          )}
        </div>

        {/* Pause Button */}
        <button
          data-action-btn="true"
          type="button"
          onClick={onPause}
          className="pointer-events-auto flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/20 bg-slate-950/65 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-slate-900/80 active:scale-95"
        >
          <Pause className="h-4 w-4 text-amber-300" />
          <span>إيقاف مؤقت</span>
        </button>
      </div>
    </div>
  );
};
