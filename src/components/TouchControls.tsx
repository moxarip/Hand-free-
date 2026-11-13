import React, { useEffect, useRef } from 'react';
import { Anchor, ArrowUp, Flame } from 'lucide-react';
import { inputState } from '../game/inputRef';
import { soundEngine } from '../game/soundEngine';
import { HudDomRefs } from '../types/game';

interface TouchControlsProps {
  active: boolean;
  cameraSensitivity: number;
  hudRefs: React.MutableRefObject<HudDomRefs>;
  onPausePress: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  active,
  cameraSensitivity,
  hudRefs,
  onPausePress,
}) => {
  const sensRef = useRef(cameraSensitivity);
  sensRef.current = cameraSensitivity;

  const activeRef = useRef(active);
  activeRef.current = active;

  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);

  const joyTouchIdRef = useRef<number | null>(null);
  const joyOriginRef = useRef({ x: 0, y: 0 });
  const orbitTouchIdRef = useRef<number | null>(null);
  const orbitLastRef = useRef({ x: 0, y: 0 });
  const mouseDraggingRef = useRef(false);
  const mouseLastRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const syncKeyboardAxis = () => {
      const k = keysRef.current;
      let mx = 0;
      let my = 0;
      if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) my += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) my -= 1;
      if (joyTouchIdRef.current === null) {
        inputState.moveX = mx;
        inputState.moveY = my;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      soundEngine.init();
      if (e.code === 'Escape') {
        onPausePress();
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        inputState.jumpJustPressed = true;
        inputState.jumpPressed = true;
      }
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
        inputState.dashJustPressed = true;
      }
      if (e.code === 'KeyE' && !e.repeat) {
        inputState.grappleJustPressed = true;
      }
      keysRef.current.add(e.code);
      syncKeyboardAxis();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        inputState.jumpPressed = false;
      }
      keysRef.current.delete(e.code);
      syncKeyboardAxis();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keysRef.current.clear();
      inputState.moveX = 0;
      inputState.moveY = 0;
    };
  }, [onPausePress]);

  useEffect(() => {
    if (!active) {
      joyTouchIdRef.current = null;
      orbitTouchIdRef.current = null;
      inputState.moveX = 0;
      inputState.moveY = 0;
      inputState.jumpPressed = false;
      if (joyBaseRef.current) {
        joyBaseRef.current.style.opacity = '0.45';
      }
      if (joyKnobRef.current) {
        joyKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
    }
  }, [active]);

  if (!active) return null;

  const MAX_JOY_RADIUS = 46;

  const handleZoneTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    soundEngine.init();
    const w = window.innerWidth;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const target = t.target as HTMLElement | null;
      if (target && target.closest('[data-action-btn="true"]')) {
        continue;
      }

      if (t.clientX < w * 0.45 && joyTouchIdRef.current === null) {
        joyTouchIdRef.current = t.identifier;
        joyOriginRef.current = { x: t.clientX, y: t.clientY };
        if (joyBaseRef.current) {
          joyBaseRef.current.style.opacity = '1';
          joyBaseRef.current.style.left = `${t.clientX - 56}px`;
          joyBaseRef.current.style.top = `${t.clientY - 56}px`;
          joyBaseRef.current.style.bottom = 'auto';
        }
        if (joyKnobRef.current) {
          joyKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
      } else if (t.clientX >= w * 0.45 && orbitTouchIdRef.current === null) {
        orbitTouchIdRef.current = t.identifier;
        orbitLastRef.current = { x: t.clientX, y: t.clientY };
      }
    }
  };

  const handleZoneTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchIdRef.current) {
        const dx = t.clientX - joyOriginRef.current.x;
        const dy = t.clientY - joyOriginRef.current.y;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, MAX_JOY_RADIUS);
        const nx = dist > 0.5 ? (dx / dist) * (clamped / MAX_JOY_RADIUS) : 0;
        const ny = dist > 0.5 ? (-dy / dist) * (clamped / MAX_JOY_RADIUS) : 0;

        inputState.moveX = nx;
        inputState.moveY = ny;

        if (joyKnobRef.current) {
          const kx = dist > 0.5 ? (dx / dist) * clamped : 0;
          const ky = dist > 0.5 ? (dy / dist) * clamped : 0;
          joyKnobRef.current.style.transform = `translate3d(${kx}px, ${ky}px, 0)`;
        }
      } else if (t.identifier === orbitTouchIdRef.current) {
        const dx = t.clientX - orbitLastRef.current.x;
        const dy = t.clientY - orbitLastRef.current.y;
        orbitLastRef.current = { x: t.clientX, y: t.clientY };
        const s = 0.0052 * sensRef.current;
        inputState.camYaw -= dx * s;
        inputState.camPitch = Math.max(-0.32, Math.min(1.12, inputState.camPitch + dy * s));
      }
    }
  };

  const handleZoneTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchIdRef.current) {
        joyTouchIdRef.current = null;
        inputState.moveX = 0;
        inputState.moveY = 0;
        if (joyBaseRef.current) {
          joyBaseRef.current.style.opacity = '0.45';
          joyBaseRef.current.style.left = '28px';
          joyBaseRef.current.style.top = 'auto';
          joyBaseRef.current.style.bottom = '26px';
        }
        if (joyKnobRef.current) {
          joyKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
      } else if (t.identifier === orbitTouchIdRef.current) {
        orbitTouchIdRef.current = null;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-action-btn="true"]')) return;
    soundEngine.init();
    mouseDraggingRef.current = true;
    mouseLastRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mouseDraggingRef.current) return;
    const dx = e.clientX - mouseLastRef.current.x;
    const dy = e.clientY - mouseLastRef.current.y;
    mouseLastRef.current = { x: e.clientX, y: e.clientY };
    const s = 0.0048 * sensRef.current;
    inputState.camYaw -= dx * s;
    inputState.camPitch = Math.max(-0.32, Math.min(1.12, inputState.camPitch + dy * s));
  };

  const handleMouseUp = () => {
    mouseDraggingRef.current = false;
  };

  return (
    <div
      dir="ltr"
      className="fixed inset-0 z-20 touch-none select-none"
      onTouchStart={handleZoneTouchStart}
      onTouchMove={handleZoneTouchMove}
      onTouchEnd={handleZoneTouchEnd}
      onTouchCancel={handleZoneTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Left Floating Virtual Joystick */}
      <div
        ref={joyBaseRef}
        style={{ left: '28px', bottom: '26px', opacity: 0.45 }}
        className="pointer-events-none fixed flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/30 bg-slate-950/35 backdrop-blur-sm transition-opacity duration-150"
      >
        <div
          ref={joyKnobRef}
          className="h-12 w-12 rounded-full border border-cyan-300/80 bg-gradient-to-br from-cyan-400/80 to-blue-600/80 shadow-[0_0_16px_rgba(34,211,238,0.65)]"
        />
      </div>

      {/* Right Thumb Action Buttons: Contextual Grapple, Thruster Dash (cooldown ring), Jump */}
      <div className="fixed bottom-6 right-6 flex items-end gap-3.5">
        {/* Contextual Magnetic Grapple Button */}
        <button
          ref={(el) => {
            hudRefs.current.grappleBtnEl = el;
          }}
          data-action-btn="true"
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            soundEngine.init();
            inputState.grappleJustPressed = true;
          }}
          style={{ opacity: 0.32 }}
          aria-label="خطاف"
          className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 border-cyan-300/80 bg-slate-950/75 text-cyan-200 backdrop-blur-md transition-transform duration-150 active:scale-90"
        >
          <Anchor className="h-5 w-5" />
          <span className="text-[10px] font-bold">خطاف</span>
        </button>

        {/* Dash Button with SVG Cooldown Ring */}
        <button
          ref={(el) => {
            hudRefs.current.dashBtnEl = el;
          }}
          data-action-btn="true"
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            soundEngine.init();
            inputState.dashJustPressed = true;
          }}
          aria-label="توربين"
          className="relative flex h-16 w-16 flex-col items-center justify-center rounded-full border border-amber-400/50 bg-slate-950/60 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)] backdrop-blur-md active:scale-90"
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 64 64"
          >
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="4"
            />
            <circle
              ref={(el) => {
                hudRefs.current.dashRingCircleEl = el;
              }}
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="163.36"
              strokeDashoffset="0"
            />
          </svg>
          <Flame className="h-5 w-5" />
          <span
            ref={(el) => {
              hudRefs.current.dashLabelEl = el;
            }}
            className="text-[10px] font-bold"
          >
            توربين
          </span>
        </button>

        {/* Jump Button */}
        <button
          data-action-btn="true"
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            soundEngine.init();
            inputState.jumpJustPressed = true;
            inputState.jumpPressed = true;
          }}
          onPointerUp={() => {
            inputState.jumpPressed = false;
          }}
          onPointerCancel={() => {
            inputState.jumpPressed = false;
          }}
          aria-label="قفز"
          className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-cyan-300/70 bg-gradient-to-br from-cyan-500/75 to-blue-700/80 text-white shadow-[0_0_24px_rgba(6,182,212,0.5)] backdrop-blur-md active:scale-90"
        >
          <ArrowUp className="h-7 w-7 stroke-[2.6]" />
          <span className="text-xs font-extrabold tracking-wide">قفز</span>
        </button>
      </div>
    </div>
  );
};
