import React, { useState } from 'react';
import { Award, Flame, Play, Settings, Shield, Sparkles, Trophy } from 'lucide-react';
import { HAND_SKINS, THRUSTER_COLORS } from '../game/storage';
import {
  DifficultyMode,
  HandSkinId,
  ThrusterColorId,
} from '../types/game';

interface MainMenuProps {
  bestAltitude: number;
  bestSummitTimeSec: number | null;
  difficulty: DifficultyMode;
  selectedSkin: HandSkinId;
  selectedThruster: ThrusterColorId;
  onChangeDifficulty: (mode: DifficultyMode) => void;
  onChangeSkin: (skin: HandSkinId) => void;
  onChangeThruster: (thruster: ThrusterColorId) => void;
  onPlay: () => void;
  onOpenSettings: () => void;
}

function formatSummitTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  bestAltitude,
  bestSummitTimeSec,
  difficulty,
  selectedSkin,
  selectedThruster,
  onChangeDifficulty,
  onChangeSkin,
  onChangeThruster,
  onPlay,
  onOpenSettings,
}) => {
  const [showCustomize, setShowCustomize] = useState(false);

  return (
    <div
      dir="rtl"
      className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-5"
    >
      {/* Top Bar: Title & Record Badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="pointer-events-auto rounded-2xl border border-amber-400/30 bg-slate-950/60 px-4 py-2 backdrop-blur-md">
          <h1 className="bg-gradient-to-l from-amber-200 via-amber-400 to-yellow-400 bg-clip-text text-xl font-black text-transparent sm:text-2xl">
            الصعود المستحيل 3D
          </h1>
          <p className="text-[11px] font-medium text-cyan-200/85">
            تحدي القمة السماوية — 1000 متر
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-slate-950/65 px-3.5 py-2 backdrop-blur-md">
            <Trophy className="h-4 w-4 text-amber-400" />
            <div className="text-xs">
              <span className="font-bold text-amber-300">أعلى ارتفاع: </span>
              <span className="font-mono font-black text-white">{bestAltitude}m</span>
            </div>
            {bestSummitTimeSec !== null && (
              <div className="hidden border-r border-white/20 pr-2 text-xs text-emerald-300 sm:block">
                <Award className="ml-1 inline h-3.5 w-3.5" />
                أفضل وقت: {formatSummitTime(bestSummitTimeSec)}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="الإعدادات"
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-white/20 bg-slate-950/65 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-slate-900 active:scale-95"
          >
            <Settings className="h-4 w-4 text-cyan-300" />
            <span>الإعدادات</span>
          </button>
        </div>
      </div>

      {/* Bottom/Right Side Glassmorphic Action Panel (keeps left/center open for orbiting 3D Cyber-Hand) */}
      <div className="flex items-end justify-between gap-4">
        <div className="pointer-events-auto w-full max-w-[360px] space-y-2.5 rounded-3xl border border-white/15 bg-slate-950/65 p-3.5 shadow-2xl backdrop-blur-lg">
          {/* Play Button */}
          <button
            type="button"
            onClick={onPlay}
            className="animate-pulse-glow flex w-full min-h-[48px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-l from-amber-500 via-yellow-500 to-amber-400 px-5 py-3 text-base font-black text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.45)] transition active:scale-95"
          >
            <Play className="h-5 w-5 fill-slate-950" />
            <span>ابدأ الصعود</span>
          </button>

          {/* Difficulty Mode Selector */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
              <Shield className="h-3.5 w-3.5 text-cyan-300" />
              <span>نمط اللعب</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeDifficulty('CHECKPOINTS')}
                className={`min-h-[38px] rounded-xl px-2 py-1.5 text-xs font-bold transition ${
                  difficulty === 'CHECKPOINTS'
                    ? 'border border-emerald-400/70 bg-emerald-500/25 text-emerald-200'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                نقاط حفظ
              </button>
              <button
                type="button"
                onClick={() => onChangeDifficulty('CHALLENGE')}
                className={`min-h-[38px] rounded-xl px-2 py-1.5 text-xs font-bold transition ${
                  difficulty === 'CHALLENGE'
                    ? 'border border-rose-400/70 bg-rose-500/25 text-rose-200'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                تحدي حقيقي - بدون حفظ
              </button>
            </div>
          </div>

          {/* Toggle Customize Cyber-Hand Drawer */}
          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            className="flex w-full min-h-[40px] items-center justify-between rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              تخصيص اليد السايبرانية
            </span>
            <span className="text-[11px] text-amber-300">
              {HAND_SKINS[selectedSkin].labelAr}
            </span>
          </button>

          {showCustomize && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2.5">
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(HAND_SKINS) as HandSkinId[]).map((id) => {
                  const s = HAND_SKINS[id];
                  const active = selectedSkin === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onChangeSkin(id)}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/40"
                        style={{ backgroundColor: s.primaryColor }}
                      />
                      <span className="truncate">{s.labelAr}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  لهب التوربين:
                </span>
                <div className="flex items-center gap-1.5">
                  {(Object.keys(THRUSTER_COLORS) as ThrusterColorId[]).map((tid) => {
                    const t = THRUSTER_COLORS[tid];
                    const active = selectedThruster === tid;
                    return (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => onChangeThruster(tid)}
                        title={t.labelAr}
                        aria-label={t.labelAr}
                        className={`h-6 w-6 rounded-full border-2 transition ${
                          active ? 'scale-110 border-white shadow-lg' : 'border-white/25 opacity-75'
                        }`}
                        style={{ backgroundColor: t.outerHex }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subtle Control Hint on Landscape Side */}
        <div className="hidden rounded-2xl border border-white/10 bg-slate-950/50 px-3.5 py-2 text-[11px] text-slate-300 backdrop-blur-md md:block">
          <div className="font-bold text-cyan-300">التحكم السريع</div>
          <div>اليسار: عصا الحركة • اليمين: كاميرا + قفز / توربين / خطاف (E)</div>
        </div>
      </div>
    </div>
  );
};
