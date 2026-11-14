import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Anchor,
  ArrowUp,
  Camera,
  Flag,
  Flame,
  Pause,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import { DifficultyMode, EngineInputState, HudDomRefs } from '../types/game';

interface HudProps {
  hudRefs: React.MutableRefObject<HudDomRefs>;
  inputRef: React.MutableRefObject<EngineInputState>;
  active: boolean;
  showFps: boolean;
  difficulty: DifficultyMode;
  cameraSensitivity: number;
  checkpointBanner: string | null;
  milestoneBanner: string | null;
  onPause: () => void;
  onReturnCheckpoint: () => void;
  onResetCamera: () => void;
}

const JOY_RADIUS = 52;

export const HUD: React.FC<HudProps> = ({
  hudRefs,
  inputRef,
  active,
  showFps,
  difficulty,
  cameraSensitivity,
  checkpointBanner,
  milestoneBanner,
  onPause,
  onReturnCheckpoint,
  onResetCamera,
}) => {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0, active: false });

  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const joyCenterRef = useRef({ x: 0, y: 0 });
  const camPointerIdRef = useRef<number | null>(null);
  const camLastPosRef = useRef({ x: 0, y: 0 });
  const keysDownRef = useRef(new Set<string>());

  useEffect(() => {
    if (!active) {
      joyPointerIdRef.current = null;
      camPointerIdRef.current = null;
      keysDownRef.current.clear();
      inputRef.current.moveX = 0;
      inputRef.current.moveY = 0;
      inputRef.current.jumpPressed = false;
      setKnobOffset({ x: 0, y: 0, active: false });
    }
  }, [active, inputRef]);

  // Desktop Keyboard Controls (WASD / Arrows, Space, Shift, E, Esc)
  useEffect(() => {
    if (!active) return;

    const syncKeyboardAxes = () => {
      const keys = keysDownRef.current;
      let kx = 0;
      let ky = 0;
      if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) ky += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) ky -= 1;
      const len = Math.hypot(kx, ky);
      if (len > 1) {
        kx /= len;
        ky /= len;
      }
      if (joyPointerIdRef.current === null) {
        inputRef.current.moveX = kx;
        inputRef.current.moveY = ky;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.init();
      if (e.code === 'Escape') {
        e.preventDefault();
        onPause();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) inputRef.current.jumpJustPressed = true;
        inputRef.current.jumpPressed = true;
        return;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!e.repeat) inputRef.current.dashJustPressed = true;
        return;
      }
      if (e.code === 'KeyE') {
        if (!e.repeat) inputRef.current.grappleJustPressed = true;
        return;
      }
      keysDownRef.current.add(e.code);
      syncKeyboardAxes();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        inputRef.current.jumpPressed = false;
        return;
      }
      keysDownRef.current.delete(e.code);
      syncKeyboardAxes();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [active, inputRef, onPause]);

  // Visible 360° Virtual Analog Joystick (Touch + Mouse Pointer Events)
  const updateJoystickFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const dx = clientX - joyCenterRef.current.x;
      const dy = clientY - joyCenterRef.current.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, JOY_RADIUS);
      const angle = Math.atan2(dy, dx);
      const kx = dist > 0.01 ? Math.cos(angle) * clamped : 0;
      const ky = dist > 0.01 ? Math.sin(angle) * clamped : 0;

      inputRef.current.moveX = kx / JOY_RADIUS;
      inputRef.current.moveY = -ky / JOY_RADIUS;
      setKnobOffset({ x: kx, y: ky, active: true });
    },
    [inputRef]
  );

  const handleJoyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || joyPointerIdRef.current !== null) return;
    e.stopPropagation();
    soundEngine.init();
    const rect = joyBaseRef.current?.getBoundingClientRect();
    if (rect) {
      joyCenterRef.current = {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
      };
    } else {
      joyCenterRef.current = { x: e.clientX, y: e.clientY };
    }
    joyPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleJoyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleJoyPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerIdRef.current = null;
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
    setKnobOffset({ x: 0, y: 0, active: false });
  };

  // Right-Half Screen Drag Camera Orbit (Touch + Mouse)
  const handleCamPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || camPointerIdRef.current !== null) return;
    soundEngine.init();
    camPointerIdRef.current = e.pointerId;
    camLastPosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCamPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (camPointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - camLastPosRef.current.x;
    const dy = e.clientY - camLastPosRef.current.y;
    camLastPosRef.current = { x: e.clientX, y: e.clientY };
    inputRef.current.camYaw -= dx * 0.006 * cameraSensitivity;
    inputRef.current.camPitch = Math.max(
      -0.35,
      Math.min(1.15, inputRef.current.camPitch + dy * 0.0048 * cameraSensitivity)
    );
  };

  const handleCamPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (camPointerIdRef.current !== e.pointerId) return;
    camPointerIdRef.current = null;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
      {/* Open Right-Half Drag Zone for Camera Orbit (behind buttons/HUD) */}
      <div
        onPointerDown={handleCamPointerDown}
        onPointerMove={handleCamPointerMove}
        onPointerUp={handleCamPointerEnd}
        onPointerCancel={handleCamPointerEnd}
        className="pointer-events-auto fixed bottom-0 right-0 top-0 left-[42%] z-0 touch-none"
      />

      {/* Top HUD Bar */}
      <div dir="rtl" className="relative z-10 flex items-start justify-between gap-2 sm:gap-3">
        {/* Right Cluster (Start in RTL): Altitude Telemetry + Distance to Master */}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-amber-500/35 bg-[#0d0a18]/80 px-3.5 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <div className="flex items-baseline gap-2">
            <span
              ref={(el) => {
                hudRefs.current.altitudeEl = el;
              }}
              className="text-xl font-black tracking-tight text-amber-300 drop-shadow sm:text-2xl"
            >
              0m
            </span>
            <span className="text-[11px] font-bold text-amber-100/70">/ 1000m</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                difficulty === 'HARDCORE'
                  ? 'border border-rose-500/40 bg-rose-950/60 text-rose-300'
                  : 'border border-emerald-500/35 bg-emerald-950/50 text-emerald-300'
              }`}
            >
              {difficulty === 'HARDCORE' ? 'لعنة الخلود' : 'نقاط حفظ'}
            </span>
          </div>

          <div className="h-2 w-44 overflow-hidden rounded-full bg-white/10 sm:w-56">
            <div
              ref={(el) => {
                hudRefs.current.altitudeBarEl = el;
              }}
              className="h-full rounded-full bg-gradient-to-l from-amber-300 via-amber-500 to-rose-500 transition-[width] duration-75"
              style={{ width: '0%' }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span
              ref={(el) => {
                hudRefs.current.biomeEl = el;
              }}
              className="font-bold text-amber-200/90"
            >
              هاوية الرماد والسيوف العملاقة
            </span>
            <span
              ref={(el) => {
                hudRefs.current.distToMasterEl = el;
              }}
              className="font-semibold text-cyan-300"
            >
              المسافة إلى المالك: 1000m
            </span>
          </div>
        </div>

        {/* Center Cluster: Timer, FPS, Ledge Grab, Fall-Cam, Milestones */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#0d0a18]/80 px-3.5 py-1.5 shadow-lg backdrop-blur-md">
            <span
              ref={(el) => {
                hudRefs.current.timerEl = el;
              }}
              className="font-mono text-sm font-black text-white sm:text-base"
            >
              00:00.0
            </span>
            {showFps && (
              <span
                ref={(el) => {
                  hudRefs.current.fpsEl = el;
                }}
                className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300"
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
            className="rounded-full border border-amber-400/50 bg-amber-950/90 px-3.5 py-1 text-xs font-black text-amber-200 shadow-lg transition-opacity duration-150"
          >
            تمسّك بالحافة! اضغط قفز للتسلّق
          </div>

          <div
            ref={(el) => {
              hudRefs.current.fallCamBannerEl = el;
            }}
            style={{ opacity: 0 }}
            className="flex items-center gap-1.5 rounded-full border border-rose-500/60 bg-rose-950/90 px-4 py-1 text-xs font-black text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.45)] transition-opacity duration-150"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            <span
              ref={(el) => {
                hudRefs.current.fallCamDistEl = el;
              }}
            >
              سقوط في الهاوية: -0م!
            </span>
          </div>

          {checkpointBanner && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-950/90 px-4 py-1.5 text-xs font-black text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.45)]">
              <Flame className="h-3.5 w-3.5 text-emerald-300" />
              <span>{checkpointBanner}</span>
            </div>
          )}

          {milestoneBanner && (
            <div className="flex items-center gap-2 rounded-full border border-amber-300/70 bg-gradient-to-r from-amber-900/95 via-amber-800/95 to-amber-900/95 px-5 py-1.5 text-sm font-black text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.55)]">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>{milestoneBanner}</span>
            </div>
          )}
        </div>

        {/* Left Cluster (End in RTL): Camera Align, Respawn Checkpoint, Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.init();
              onResetCamera();
            }}
            title="ضبط الكاميرا"
            aria-label="ضبط الكاميرا"
            className="flex h-12 min-w-[48px] items-center justify-center gap-1.5 rounded-2xl border border-cyan-500/35 bg-[#0d0a18]/80 px-3 text-xs font-bold text-cyan-200 shadow-lg backdrop-blur-md transition hover:border-cyan-400 active:scale-95"
          >
            <Camera className="h-4 w-4 text-cyan-400" />
            <span className="hidden md:inline">ضبط الكاميرا</span>
          </button>

          {difficulty === 'CHECKPOINTS' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.init();
                onReturnCheckpoint();
              }}
              title="آخر نقطة حفظ"
              aria-label="آخر نقطة حفظ"
              className="flex h-12 min-w-[48px] items-center justify-center gap-1.5 rounded-2xl border border-emerald-500/35 bg-[#0d0a18]/80 px-3 text-xs font-bold text-emerald-200 shadow-lg backdrop-blur-md transition hover:border-emerald-400 active:scale-95"
            >
              <Flag className="h-4 w-4 text-emerald-400" />
              <span className="hidden md:inline">نقطة الحفظ</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundEngine.init();
              onPause();
            }}
            title="إيقاف مؤقت"
            aria-label="إيقاف مؤقت"
            className="flex h-12 min-w-[48px] items-center justify-center gap-1.5 rounded-2xl border border-amber-500/35 bg-[#0d0a18]/80 px-3 text-xs font-bold text-amber-100 shadow-lg backdrop-blur-md transition hover:border-amber-400 active:scale-95"
          >
            <Pause className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline">إيقاف مؤقت</span>
          </button>
        </div>
      </div>

      {/* Bottom Dual-Thumb Controls Row */}
      <div className="relative z-10 flex items-end justify-between pb-1">
        {/* Bottom-Left: Visible, Responsive 360° Virtual Analog Joystick */}
        <div className="flex flex-col items-center gap-1.5 pl-1 sm:pl-2">
          <div
            ref={joyBaseRef}
            onPointerDown={handleJoyPointerDown}
            onPointerMove={handleJoyPointerMove}
            onPointerUp={handleJoyPointerEnd}
            onPointerCancel={handleJoyPointerEnd}
            className={`pointer-events-auto relative flex h-[126px] w-[126px] touch-none items-center justify-center rounded-full border-2 backdrop-blur-md transition-colors sm:h-[138px] sm:w-[138px] ${
              knobOffset.active
                ? 'border-amber-400/80 bg-amber-950/35 shadow-[0_0_26px_rgba(251,191,36,0.28)]'
                : 'border-amber-500/40 bg-[#0d0a18]/55'
            }`}
          >
            {/* Crosshair guides */}
            <div className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-amber-400/20" />
            <div
              className="pointer-events-none h-13 w-13 rounded-full border-2 border-amber-200 bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 shadow-[0_0_20px_rgba(251,191,36,0.65)] transition-transform duration-75"
              style={{
                transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
              }}
            />
          </div>
          <span className="rounded-full bg-[#0d0a18]/65 px-2.5 py-0.5 text-[10px] font-bold text-amber-200/75">
            عصا الزحف 360°
          </span>
        </div>

        {/* Bottom-Right: Jump, Cyan Dash, Amethyst/Gold Grapple */}
        <div className="pointer-events-auto flex items-end gap-3 pr-1 sm:gap-4 sm:pr-2">
          {/* GRAPPLE (خطاف) */}
          <button
            type="button"
            ref={(el) => {
              hudRefs.current.grappleBtnEl = el;
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              soundEngine.init();
              inputRef.current.grappleJustPressed = true;
            }}
            style={{ opacity: 0.35 }}
            className="flex h-15 w-15 flex-col items-center justify-center rounded-full border-2 border-purple-400/80 bg-gradient-to-br from-purple-900/90 via-indigo-950/90 to-amber-900/85 text-amber-200 shadow-lg backdrop-blur-md transition-transform active:scale-90 sm:h-17 sm:w-17"
          >
            <Anchor className="h-5 w-5 text-amber-300" />
            <span className="mt-0.5 text-[10px] font-black">خطاف</span>
          </button>

          {/* DASH (اندفاع) — Glowing Cyan Soul-Flame with Cooldown Ring */}
          <button
            type="button"
            ref={(el) => {
              hudRefs.current.dashBtnEl = el;
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              soundEngine.init();
              inputRef.current.dashJustPressed = true;
            }}
            className="relative flex h-17 w-17 flex-col items-center justify-center rounded-full bg-gradient-to-br from-cyan-950/90 to-slate-950/90 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.35)] backdrop-blur-md transition active:scale-90 sm:h-[74px] sm:w-[74px]"
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
              viewBox="0 0 60 60"
            >
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="rgba(34,211,238,0.18)"
                strokeWidth="3.5"
              />
              <circle
                ref={(el) => {
                  hudRefs.current.dashRingCircleEl = el;
                }}
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="163.36"
                strokeDashoffset="0"
              />
            </svg>
            <Flame className="h-5 w-5 text-cyan-300" />
            <span
              ref={(el) => {
                hudRefs.current.dashLabelEl = el;
              }}
              className="mt-0.5 text-[10px] font-black text-cyan-200"
            >
              اندفاع
            </span>
          </button>

          {/* JUMP (قفز) — Large Golden Circular Button */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              soundEngine.init();
              inputRef.current.jumpJustPressed = true;
              inputRef.current.jumpPressed = true;
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              inputRef.current.jumpPressed = false;
            }}
            onPointerCancel={() => {
              inputRef.current.jumpPressed = false;
            }}
            onPointerLeave={() => {
              inputRef.current.jumpPressed = false;
            }}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 text-slate-950 shadow-[0_0_32px_rgba(245,158,11,0.6)] transition active:scale-90 sm:h-24 sm:w-24"
          >
            <ArrowUp className="h-7 w-7 stroke-[3]" />
            <span className="text-xs font-black tracking-wide">قفز</span>
          </button>
        </div>
      </div>
    </div>
  );
};
