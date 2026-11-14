import React, { useEffect, useState } from 'react';
import {
  Anchor,
  BookOpen,
  Check,
  Crown,
  Flame,
  Gamepad2,
  Home,
  Monitor,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { RELIC_SKINS } from '../game/storage';
import { getProceduralTextures } from '../game/textures';
import { getCourseData } from '../game/worldBuilder';
import {
  DifficultyMode,
  GraphicsPreset,
  RelicSkinId,
  RenderResolution,
  SettingsData,
} from '../types/game';

function formatBestTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 10) % 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${cs}`;
}

/* ========================================================================== */
/* 1. SPLASH SCREEN (0% -> 100% + TAP TO START BUTTON)                        */
/* ========================================================================== */
export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(10);
  const [ready, setReady] = useState(false);
  const [statusText, setStatusText] = useState('إيقاظ الجوهر الخالد...');

  useEffect(() => {
    let cancelled = false;
    const t1 = window.setTimeout(() => {
      if (cancelled) return;
      getProceduralTextures();
      setProgress(52);
      setStatusText('نحت أطلال العالم الآخر...');
    }, 240);

    const t2 = window.setTimeout(() => {
      if (cancelled) return;
      getCourseData();
      setProgress(86);
      setStatusText('تجهيز عرش الخلود (1000m)...');
    }, 580);

    const t3 = window.setTimeout(() => {
      if (cancelled) return;
      setProgress(100);
      setStatusText('اكتمل الاستعداد — الطريق إلى المالك مفتوح');
      setReady(true);
    }, 950);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  const handleTapToStart = () => {
    soundEngine.init();
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      orientation?.lock?.('landscape')?.catch(() => {});
    } catch {
      // Orientation lock unsupported in browser desktop
    }
    onComplete();
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-[#090611]/95 via-[#180d22]/90 to-[#11080c]/95 p-6 text-center backdrop-blur-[2px]"
    >
      <div className="pointer-events-auto flex max-w-lg flex-col items-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-950/45 px-4 py-1 text-xs font-bold text-amber-300">
          <Sparkles className="h-3.5 w-3.5" />
          <span>مغامرة تسلق عمودية 3D</span>
        </div>

        <h1 className="bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-3xl font-black tracking-tight text-transparent drop-shadow sm:text-5xl">
          اليد الخالدة: رحلة العودة
        </h1>

        <p className="mt-2.5 text-xs leading-relaxed text-amber-100/80 sm:text-sm">
          يدٌ مقطوعة في هاوية الرماد... رحلة 1000 متر للعودة إلى مالكها الخالد
        </p>

        <div className="mt-7 w-72 sm:w-80">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-amber-200/85">
            <span>{statusText}</span>
            <span className="font-mono text-amber-300">{progress}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-amber-500/35 bg-black/60 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-l from-amber-300 via-amber-500 to-orange-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-6 h-14">
          {ready && (
            <button
              type="button"
              onClick={handleTapToStart}
              className="animate-pulse-glow flex h-13 items-center justify-center gap-2.5 rounded-2xl border border-amber-200/70 bg-gradient-to-l from-amber-400 via-amber-500 to-orange-500 px-8 text-base font-black text-slate-950 shadow-[0_0_32px_rgba(251,191,36,0.6)] transition active:scale-95"
            >
              <Play className="h-5 w-5 fill-slate-950" />
              <span>اضغط للبدء</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 2. MAIN MENU (TRANSLUCENT RTL OVER LIVE 3D IDLING SEVERED HAND)            */
/* ========================================================================== */
interface MainMenuProps {
  bestAltitude: number;
  bestReunionTimeSec: number | null;
  difficulty: DifficultyMode;
  selectedSkin: RelicSkinId;
  onChangeDifficulty: (mode: DifficultyMode) => void;
  onChangeSkin: (skinId: RelicSkinId) => void;
  onPlay: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  bestAltitude,
  bestReunionTimeSec,
  difficulty,
  selectedSkin,
  onChangeDifficulty,
  onChangeSkin,
  onPlay,
  onOpenSettings,
  onOpenHowToPlay,
}) => {
  const skinEntries = Object.values(RELIC_SKINS);

  return (
    <div
      dir="rtl"
      className="pointer-events-none fixed inset-0 z-20 flex items-center justify-between p-4 sm:p-6"
    >
      {/* Right Panel (Start in RTL): Main Controls Card */}
      <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-[420px] flex-col gap-3 overflow-y-auto rounded-3xl border border-amber-500/35 bg-[#0d0917]/75 p-4 shadow-[0_12px_48px_rgba(0,0,0,0.7)] backdrop-blur-md sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-950/50 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
              <Crown className="h-3 w-3" />
              <span>العالم الآخر</span>
            </div>
            <h1 className="mt-1 bg-gradient-to-l from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
              اليد الخالدة: رحلة العودة
            </h1>
          </div>

          {/* Top Record Badge */}
          <div className="shrink-0 rounded-2xl border border-amber-400/35 bg-black/50 px-3 py-1.5 text-center">
            <div className="text-[10px] font-semibold text-amber-200/75">أعلى ارتفاع</div>
            <div className="text-sm font-black text-amber-300">{bestAltitude}m</div>
          </div>
        </div>

        {/* Best Time Pill */}
        {bestReunionTimeSec !== null && (
          <div className="flex items-center justify-between rounded-xl border border-cyan-400/25 bg-cyan-950/30 px-3 py-1.5 text-xs">
            <span className="font-bold text-cyan-200">أسرع اتحاد بالمالك</span>
            <span className="font-mono font-black text-cyan-300">
              {formatBestTime(bestReunionTimeSec)}
            </span>
          </div>
        )}

        {/* Mode Selector Buttons */}
        <div>
          <div className="mb-1.5 text-[11px] font-bold text-amber-100/85">نمط اللعب</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.init();
                onChangeDifficulty('CHECKPOINTS');
              }}
              className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                difficulty === 'CHECKPOINTS'
                  ? 'border-emerald-400/75 bg-emerald-950/65 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                  : 'border-white/10 bg-black/35 text-slate-300 hover:border-white/25'
              }`}
            >
              <Shield className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>نقاط حفظ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.init();
                onChangeDifficulty('HARDCORE');
              }}
              className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                difficulty === 'HARDCORE'
                  ? 'border-rose-400/75 bg-rose-950/65 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.25)]'
                  : 'border-white/10 bg-black/35 text-slate-300 hover:border-white/25'
              }`}
            >
              <Skull className="h-4 w-4 shrink-0 text-rose-400" />
              <span>لعنة الخلود (بدون حفظ)</span>
            </button>
          </div>
        </div>

        {/* Relic Skin Buttons */}
        <div>
          <div className="mb-1.5 text-[11px] font-bold text-amber-100/85">هيئة اليد الخالدة</div>
          <div className="grid grid-cols-2 gap-2">
            {skinEntries.map((skin) => {
              const active = selectedSkin === skin.id;
              return (
                <button
                  key={skin.id}
                  type="button"
                  onClick={() => {
                    soundEngine.init();
                    onChangeSkin(skin.id);
                  }}
                  className={`flex min-h-[46px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-right text-xs font-bold transition ${
                    active
                      ? 'border-amber-400 bg-amber-950/60 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.3)]'
                      : 'border-white/10 bg-black/35 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded-full border border-white/40 shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${skin.veinHex}, ${skin.armorHex})`,
                    }}
                  />
                  <span className="truncate">{skin.labelAr}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary CTA + Secondary Buttons */}
        <div className="mt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.init();
              onPlay();
            }}
            className="animate-pulse-glow flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-400 via-amber-500 to-orange-600 px-5 text-base font-black text-slate-950 shadow-[0_0_28px_rgba(245,158,11,0.5)] transition active:scale-95"
          >
            <Play className="h-5 w-5 fill-slate-950" />
            <span>ابدأ الرحلة</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.init();
                onOpenSettings();
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-500/35 bg-black/45 text-xs font-bold text-amber-200 transition hover:border-amber-400 active:scale-95"
            >
              <Settings className="h-4 w-4 text-amber-400" />
              <span>الإعدادات</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.init();
                onOpenHowToPlay();
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-black/45 text-xs font-bold text-cyan-200 transition hover:border-cyan-400 active:scale-95"
            >
              <BookOpen className="h-4 w-4 text-cyan-400" />
              <span>طريقة اللعب</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom-Left Subtle Legend (leaves center-left clear for live 3D hand) */}
      <div className="hidden self-end sm:block">
        <div className="rounded-2xl border border-amber-500/25 bg-[#0d0917]/65 px-4 py-2.5 text-left backdrop-blur-md">
          <div className="flex items-center justify-end gap-1.5 text-xs font-black text-amber-300">
            <Flame className="h-4 w-4" />
            <span>الهدف: عرش الخلود (1000m)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            تسلّق السيوف العملاقة والأطلال المعلقة والبلورات الطيفية للعودة إلى المالك
          </p>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 3. HOW TO PLAY & STORY MODAL                                               */
/* ========================================================================== */
export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-3xl border border-amber-500/35 bg-[#0e0a19]/95 p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-black text-amber-300">القصة وطريقة اللعب</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-3.5 text-xs leading-relaxed text-amber-100/85">
          بُترت اليد الخالدة بسيفٍ ملعون وأُلقيت في قاع هاوية الرماد. تنبض أصابعها بالجوهر الذهبي، وتخوض رحلة 1000 متر صعوداً عبر 4 عوالم لتلتحم بمالكها الجالس على عرش الخلود.
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs">
            <div className="font-black text-amber-300">التحكم باللمس (الهاتف)</div>
            <ul className="mt-1.5 space-y-1 text-[11px] text-slate-300">
              <li>• عصا اليسار: الزحف والتحرك 360°</li>
              <li>• سحب الشاشة يميناً: تدوير الكاميرا</li>
              <li>• قفز: قفز + التمسّك التلقائي بالحواف</li>
              <li>• اندفاع: شعلة معصم متسارعة بالهواء</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs">
            <div className="font-black text-cyan-300">لوحة المفاتيح والفأرة</div>
            <ul className="mt-1.5 space-y-1 text-[11px] text-slate-300">
              <li>• WASD / الأسهم: التحرك والزحف</li>
              <li>• Space: قفز / تسلّق الحافة</li>
              <li>• Shift: اندفاع بشعلة الروح</li>
              <li>• E: إطلاق الخطاف نحو بلورة الروح</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-950/25 p-3 text-[11px] text-purple-200">
          <Anchor className="h-4 w-4 shrink-0 text-amber-300" />
          <span>
            عند الاقتراب من بلورات الروح المعلقة يضيء زر <strong>خطاف</strong> — اضغطه لتندفع عبر الفجوات الواسعة!
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-1 flex h-12 items-center justify-center rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 text-sm font-black text-slate-950 active:scale-95"
        >
          فهمت — العودة
        </button>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 4. PAUSE MODAL (5 BUTTONS)                                                 */
/* ========================================================================== */
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
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-sm flex-col gap-2.5 overflow-y-auto rounded-3xl border border-amber-500/35 bg-[#0e0a19]/95 p-5 shadow-2xl">
        <h2 className="text-center text-xl font-black text-amber-300">إيقاف مؤقت</h2>

        <button
          type="button"
          onClick={onResume}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 text-sm font-black text-slate-950 shadow-lg active:scale-95"
        >
          <Play className="h-4 w-4 fill-slate-950" />
          <span>استئناف اللعب</span>
        </button>

        <button
          type="button"
          disabled={difficulty === 'HARDCORE'}
          onClick={onReturnCheckpoint}
          className={`flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition ${
            difficulty === 'HARDCORE'
              ? 'cursor-not-allowed border-white/10 bg-white/5 text-slate-500'
              : 'border-emerald-500/45 bg-emerald-950/60 text-emerald-200 active:scale-95'
          }`}
        >
          <Flame className="h-4 w-4 text-emerald-400" />
          <span>
            {difficulty === 'HARDCORE'
              ? 'العودة لآخر نقطة حفظ (معطل في لعنة الخلود)'
              : hasCheckpoint
                ? 'العودة لآخر نقطة حفظ'
                : 'العودة لبداية الهاوية (0m)'}
          </span>
        </button>

        <button
          type="button"
          onClick={onRestartFromZero}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 text-sm font-bold text-slate-200 hover:bg-white/10 active:scale-95"
        >
          <RotateCcw className="h-4 w-4 text-amber-300" />
          <span>إعادة من الهاوية 0m</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 text-sm font-bold text-slate-200 hover:bg-white/10 active:scale-95"
        >
          <Settings className="h-4 w-4 text-amber-300" />
          <span>الإعدادات</span>
        </button>

        <button
          type="button"
          onClick={onMainMenu}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-950/40 text-sm font-bold text-rose-200 hover:bg-rose-950/60 active:scale-95"
        >
          <Home className="h-4 w-4" />
          <span>القائمة الرئيسية</span>
        </button>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 5. FULL TABBED SETTINGS MODAL (GRAPHICS, AUDIO, CONTROLS)                  */
/* ========================================================================== */
interface SettingsModalProps {
  settings: SettingsData;
  onUpdate: (next: SettingsData) => void;
  onClose: () => void;
}

type SettingsTab = 'graphics' | 'audio' | 'controls';

const PRESET_OPTIONS: { id: GraphicsPreset; label: string }[] = [
  { id: 'low', label: 'منخفض' },
  { id: 'medium', label: 'متوسط' },
  { id: 'high', label: 'عالي' },
  { id: 'ultra', label: 'فائق' },
];

const RES_OPTIONS: { id: RenderResolution; label: string }[] = [
  { id: '50', label: '50%' },
  { id: '75', label: '75%' },
  { id: '100', label: '100%' },
  { id: 'ultra', label: 'فائق' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('graphics');

  const patch = (partial: Partial<SettingsData>) => {
    onUpdate({ ...settings, ...partial });
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-3xl border border-amber-500/35 bg-[#0e0a19]/95 p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-lg font-black text-amber-300">الإعدادات</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 3 Clickable Tabs */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('graphics')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition ${
              activeTab === 'graphics'
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-white/10 bg-black/35 text-slate-300'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>الغرافيك والوضوح</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition ${
              activeTab === 'audio'
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-white/10 bg-black/35 text-slate-300'
            }`}
          >
            <Volume2 className="h-4 w-4" />
            <span>الصوت</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('controls')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition ${
              activeTab === 'controls'
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-white/10 bg-black/35 text-slate-300'
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
            <span>التحكم</span>
          </button>
        </div>

        {/* Tab 1: Graphics & Resolution */}
        {activeTab === 'graphics' && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-bold text-amber-100">جودة الغرافيك</div>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patch({ graphicsPreset: opt.id })}
                    className={`min-h-[44px] rounded-xl border text-xs font-bold transition ${
                      settings.graphicsPreset === opt.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-white/10 bg-black/35 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-bold text-amber-100">مقياس الوضوح</div>
              <div className="grid grid-cols-4 gap-2">
                {RES_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patch({ renderResolution: opt.id })}
                    className={`min-h-[44px] rounded-xl border text-xs font-bold transition ${
                      settings.renderResolution === opt.id
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-white/10 bg-black/35 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => patch({ showFps: !settings.showFps })}
              className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border px-4 text-xs font-bold ${
                settings.showFps
                  ? 'border-emerald-400/60 bg-emerald-950/50 text-emerald-200'
                  : 'border-white/10 bg-black/40 text-slate-300'
              }`}
            >
              <span>إظهار عداد FPS</span>
              <span className="flex items-center gap-1">
                {settings.showFps ? 'مفعّل' : 'متوقف'}
                {settings.showFps && <Check className="h-4 w-4" />}
              </span>
            </button>
          </div>
        )}

        {/* Tab 2: Audio */}
        {activeTab === 'audio' && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-100">إعدادات الصوت</span>
              <button
                type="button"
                onClick={() => patch({ muted: !settings.muted })}
                className={`flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold ${
                  settings.muted
                    ? 'border-rose-400/60 bg-rose-950/60 text-rose-200'
                    : 'border-emerald-400/45 bg-emerald-950/45 text-emerald-200'
                }`}
              >
                {settings.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                <span>{settings.muted ? 'كتم الصوت: مفعّل' : 'كتم الصوت'}</span>
              </button>
            </div>

            <label className="flex items-center justify-between gap-3 text-xs text-slate-200">
              <span className="w-32">الصوت العام</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) => patch({ masterVolume: parseFloat(e.target.value) })}
                className="cyber-slider flex-1"
              />
              <span className="w-10 text-left font-mono">
                {Math.round(settings.masterVolume * 100)}%
              </span>
            </label>

            <label className="flex items-center justify-between gap-3 text-xs text-slate-200">
              <span className="w-32">صوت الحركة والقفز</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => patch({ sfxVolume: parseFloat(e.target.value) })}
                className="cyber-slider flex-1"
              />
              <span className="w-10 text-left font-mono">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </label>

            <label className="flex items-center justify-between gap-3 text-xs text-slate-200">
              <span className="w-32">صوت الرياح والعالم</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.windVolume}
                onChange={(e) => patch({ windVolume: parseFloat(e.target.value) })}
                className="cyber-slider flex-1"
              />
              <span className="w-10 text-left font-mono">
                {Math.round(settings.windVolume * 100)}%
              </span>
            </label>
          </div>
        )}

        {/* Tab 3: Controls */}
        {activeTab === 'controls' && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/35 p-4">
            <label className="flex items-center justify-between gap-3 text-xs text-slate-200">
              <span className="w-32">حساسية الكاميرا</span>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={settings.cameraSensitivity}
                onChange={(e) => patch({ cameraSensitivity: parseFloat(e.target.value) })}
                className="cyber-slider flex-1"
              />
              <span className="w-11 text-left font-mono">
                {settings.cameraSensitivity.toFixed(2)}x
              </span>
            </label>

            <button
              type="button"
              onClick={() => patch({ autoCameraFollow: !settings.autoCameraFollow })}
              className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border px-4 text-xs font-bold ${
                settings.autoCameraFollow
                  ? 'border-amber-400/60 bg-amber-950/50 text-amber-200'
                  : 'border-white/10 bg-black/40 text-slate-300'
              }`}
            >
              <span>تتبع الكاميرا التلقائي</span>
              <span className="flex items-center gap-1">
                {settings.autoCameraFollow ? 'مفعّل' : 'متوقف'}
                {settings.autoCameraFollow && <Check className="h-4 w-4" />}
              </span>
            </button>
          </div>
        )}

        {/* Save & Close */}
        <button
          type="button"
          onClick={onClose}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-l from-amber-400 via-amber-500 to-orange-500 text-sm font-black text-slate-950 shadow-lg active:scale-95"
        >
          حفظ وإغلاق
        </button>
      </div>
    </div>
  );
};

/* ========================================================================== */
/* 6. VICTORY SCREEN (REUNION AT THE THRONE OF ETERNITY)                      */
/* ========================================================================== */
interface VictoryModalProps {
  elapsedSec: number;
  bestReunionTimeSec: number | null;
  difficulty: DifficultyMode;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  elapsedSec,
  bestReunionTimeSec,
  difficulty,
  onPlayAgain,
  onMainMenu,
}) => {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
    >
      <div className="pointer-events-auto flex max-h-[92vh] w-full max-w-md flex-col items-center gap-3 overflow-y-auto rounded-3xl border border-amber-400/50 bg-[#100b1d]/90 p-6 text-center shadow-[0_0_50px_rgba(251,191,36,0.35)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500/20 text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.5)]">
          <Trophy className="h-7 w-7" />
        </div>

        <h2 className="bg-gradient-to-l from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-2xl font-black text-transparent">
          اكتمل الاتحاد بالمالك!
        </h2>

        <p className="text-xs leading-relaxed text-amber-100/85">
          عادت اليد الخالدة إلى عرش الخلود على ارتفاع 1000 متر بعد اجتياز هاوية الرماد والبلورات الطيفية.
        </p>

        <div className="w-full rounded-xl border border-amber-400/25 bg-amber-950/35 px-3 py-1.5 text-xs font-bold text-amber-200">
          النمط المُنجَز: {difficulty === 'HARDCORE' ? 'لعنة الخلود (بدون حفظ)' : 'نقاط حفظ'}
        </div>

        <div className="grid w-full grid-cols-2 gap-2.5 pt-1">
          <div className="rounded-2xl border border-amber-400/30 bg-black/40 p-3">
            <div className="text-[11px] text-slate-400">زمن التسلق</div>
            <div className="mt-0.5 font-mono text-lg font-black text-amber-300">
              {formatBestTime(elapsedSec)}
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-400/30 bg-black/40 p-3">
            <div className="text-[11px] text-slate-400">أسرع رقم قياسي</div>
            <div className="mt-0.5 font-mono text-lg font-black text-cyan-300">
              {bestReunionTimeSec !== null
                ? formatBestTime(bestReunionTimeSec)
                : formatBestTime(elapsedSec)}
            </div>
          </div>
        </div>

        <div className="mt-2 flex w-full gap-2.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 text-sm font-black text-slate-950 shadow-lg active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            <span>العب مجدداً</span>
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 text-sm font-bold text-slate-100 hover:bg-white/10 active:scale-95"
          >
            <Home className="h-4 w-4" />
            <span>القائمة الرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
};
