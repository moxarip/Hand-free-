import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  DifficultyMode,
  GameState,
  HandSkinId,
  HudDomRefs,
  SettingsData,
  SurfaceMaterialType,
  ThrusterColorId,
} from '../types/game';
import {
  getBiomeAtAltitude,
  getCourseData,
  getPlatformPoseAt,
  getSurfaceMaterialType,
} from '../game/courseGenerator';
import { inputState } from '../game/inputRef';
import { soundEngine } from '../game/soundEngine';
import { BiomeWorld } from './BiomeWorld';
import { CyberHandModel, HandAnimState } from './CyberHandModel';
import { SceneVfx, VfxRefs } from './SceneVfx';

interface GameSceneProps {
  gameState: GameState;
  difficulty: DifficultyMode;
  skinId: HandSkinId;
  thrusterId: ThrusterColorId;
  settings: SettingsData;
  hudRefs: React.MutableRefObject<HudDomRefs>;
  activeCheckpointIdx: number;
  onCheckpointReached: (idx: number, altitude: number) => void;
  onMilestoneReached: (altitude: number) => void;
  onAltitudeRecord: (altitude: number) => void;
  onVictory: (elapsedSec: number) => void;
  runSessionId: number;
}

const GRAVITY_BASE = -28.0;
const JUMP_VELOCITY = 15.2;
const MOVE_SPEED = 9.4;
const COYOTE_MAX = 0.15;
const JUMP_BUFFER_MAX = 0.12;
const LEDGE_GRAB_DURATION = 0.4;
const DASH_COOLDOWN = 2.2;
const DASH_DURATION = 0.24;
const GRAPPLE_RANGE = 21.0;
const GRAPPLE_DURATION = 0.44;
const HAND_RADIUS = 0.36;

const DOWN_DIR = new THREE.Vector3(0, -1, 0);
const UP_AXIS = new THREE.Vector3(0, 1, 0);

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 10) % 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${cs}`;
}

function worldToPlatformLocal(
  wx: number,
  wz: number,
  px: number,
  pz: number,
  rotY: number
): [number, number] {
  const dx = wx - px;
  const dz = wz - pz;
  if (!rotY) return [dx, dz];
  const c = Math.cos(-rotY);
  const s = Math.sin(-rotY);
  return [dx * c - dz * s, dx * s + dz * c];
}

export const GameScene: React.FC<GameSceneProps> = ({
  gameState,
  difficulty,
  skinId,
  thrusterId,
  settings,
  hudRefs,
  activeCheckpointIdx,
  onCheckpointReached,
  onMilestoneReached,
  onAltitudeRecord,
  onVictory,
  runSessionId,
}) => {
  const { camera } = useThree();
  const { platforms, checkpoints, grappleAnchors } = useMemo(() => getCourseData(), []);

  const handRootRef = useRef<THREE.Group | null>(null);
  const collisionGroupRef = useRef<THREE.Group | null>(null);
  const targetAnchorIdRef = useRef<number | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const rayOriginRef = useRef(new THREE.Vector3());

  const vfxRefs = useRef<VfxRefs>({
    reticleGroup: null,
    laserBeam: null,
    tetherBeam: null,
    shockwaveRing: null,
    sparkPool: null,
    frostPool: null,
  });

  const handAnimRef = useRef<HandAnimState>({
    speedHoriz: 0,
    vy: 0,
    grounded: true,
    isDashing: false,
    dashTimer: 0,
    isLedgeGrabbing: false,
    isGrappling: false,
    jumpAnimTimer: 0,
    isMenuIdle: true,
    facingYaw: 0,
    energyRatio: 1,
  });

  const posRef = useRef(new THREE.Vector3(0, 0.05, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const facingYawRef = useRef(0);
  const groundedRef = useRef(true);
  const groundedSurfaceRef = useRef<SurfaceMaterialType>('metal');
  const groundedPlatIdRef = useRef<number | null>(null);
  const prevPlatPoseRef = useRef({ x: 0, y: 0, z: 0, rotY: 0 });
  const coyoteTimerRef = useRef(0);
  const jumpBufferTimerRef = useRef(0);
  const dashCooldownRef = useRef(0);
  const dashActiveTimerRef = useRef(0);
  const dashDirRef = useRef(new THREE.Vector3(0, 0, 1));
  const grappleTimerRef = useRef(0);
  const grappleTargetRef = useRef(new THREE.Vector3());
  const ledgeGrabTimerRef = useRef(0);
  const ledgeGrabCooldownRef = useRef(0);
  const ledgeVaultTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const jumpAnimTimerRef = useRef(0);

  // VFX timers
  const shockwaveTimerRef = useRef(0);
  const shockwavePosRef = useRef(new THREE.Vector3());
  const shockwaveScaleMaxRef = useRef(4.2);
  const sparkTimerRef = useRef(0);
  const sparkPosRef = useRef(new THREE.Vector3());

  // Milestones & Viral Fall-Cam
  const peakAltSinceGroundRef = useRef(0);
  const passedMilestonesRef = useRef<Set<number>>(new Set());

  const simTimeRef = useRef(0);
  const runElapsedRef = useRef(0);
  const playerAltRef = useRef(0);
  const maxAltThisRunRef = useRef(0);
  const lastReportedRecordRef = useRef(0);
  const victoryTriggeredRef = useRef(false);
  const activeCpRef = useRef(activeCheckpointIdx);
  activeCpRef.current = activeCheckpointIdx;

  const camPosRef = useRef(new THREE.Vector3(0, 3.2, -5.8));
  const camLookRef = useRef(new THREE.Vector3(0, 1.0, 0));
  const footstepTimerRef = useRef(0);
  const fpsAccumRef = useRef({ frames: 0, time: 0 });
  const tmpVecA = useMemo(() => new THREE.Vector3(), []);
  const tmpVecB = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);

  useEffect(() => {
    posRef.current.set(0, 0.05, 0);
    velRef.current.set(0, 0, 0);
    facingYawRef.current = 0;
    inputState.camYaw = 0;
    inputState.camPitch = 0.34;
    groundedRef.current = true;
    groundedSurfaceRef.current = 'metal';
    groundedPlatIdRef.current = null;
    coyoteTimerRef.current = COYOTE_MAX;
    jumpBufferTimerRef.current = 0;
    dashCooldownRef.current = 0;
    dashActiveTimerRef.current = 0;
    grappleTimerRef.current = 0;
    ledgeGrabTimerRef.current = 0;
    ledgeGrabCooldownRef.current = 0;
    jumpAnimTimerRef.current = 0;
    shockwaveTimerRef.current = 0;
    sparkTimerRef.current = 0;
    peakAltSinceGroundRef.current = 0;
    passedMilestonesRef.current.clear();
    runElapsedRef.current = 0;
    maxAltThisRunRef.current = 0;
    lastReportedRecordRef.current = 0;
    victoryTriggeredRef.current = false;
    camPosRef.current.set(0, 3.2, -5.8);
    camLookRef.current.set(0, 1.0, 0);
  }, [runSessionId]);

  const respawnAt = (x: number, y: number, z: number) => {
    posRef.current.set(x, y + 0.3, z);
    velRef.current.set(0, 0, 0);
    groundedRef.current = false;
    groundedPlatIdRef.current = null;
    ledgeGrabTimerRef.current = 0;
    dashActiveTimerRef.current = 0;
    grappleTimerRef.current = 0;
    coyoteTimerRef.current = 0;
    peakAltSinceGroundRef.current = y + 0.3;
  };

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);

    if (settings.showFps && hudRefs.current.fpsEl) {
      fpsAccumRef.current.frames += 1;
      fpsAccumRef.current.time += rawDelta;
      if (fpsAccumRef.current.time >= 0.35) {
        const fps = Math.round(fpsAccumRef.current.frames / fpsAccumRef.current.time);
        hudRefs.current.fpsEl.textContent = `${fps} FPS`;
        fpsAccumRef.current.frames = 0;
        fpsAccumRef.current.time = 0;
      }
    }

    if (gameState === 'MENU' || gameState === 'SPLASH') {
      simTimeRef.current += dt;
      playerAltRef.current = 0;
      if (handRootRef.current) {
        handRootRef.current.position.set(0, 0.02, 0);
      }
      handAnimRef.current.isMenuIdle = true;
      handAnimRef.current.grounded = true;
      handAnimRef.current.speedHoriz = 0;
      handAnimRef.current.vy = 0;
      handAnimRef.current.isDashing = false;
      handAnimRef.current.isGrappling = false;
      handAnimRef.current.isLedgeGrabbing = false;
      handAnimRef.current.energyRatio = 1;
      handAnimRef.current.facingYaw = Math.sin(state.clock.elapsedTime * 0.35) * 0.25;

      const orbitAngle = state.clock.elapsedTime * 0.26;
      const targetCam = new THREE.Vector3(
        Math.sin(orbitAngle) * 4.4,
        1.95 + Math.sin(orbitAngle * 0.7) * 0.3,
        Math.cos(orbitAngle) * 4.4
      );
      const smooth = 1 - Math.exp(-5 * dt);
      camPosRef.current.lerp(targetCam, smooth);
      camLookRef.current.lerp(new THREE.Vector3(0, 0.7, 0), smooth);
      camera.position.copy(camPosRef.current);
      camera.lookAt(camLookRef.current);
      soundEngine.updateWind(0, 0, false);
      if (vfxRefs.current.reticleGroup) vfxRefs.current.reticleGroup.visible = false;
      if (vfxRefs.current.laserBeam) vfxRefs.current.laserBeam.visible = false;
      return;
    }

    if (gameState !== 'PLAYING') {
      soundEngine.updateWind(playerAltRef.current, 0, false);
      return;
    }

    if (inputState.restartFromZeroRequested) {
      inputState.restartFromZeroRequested = false;
      runElapsedRef.current = 0;
      passedMilestonesRef.current.clear();
      respawnAt(0, 0.05, 0);
    }
    if (inputState.resetToCheckpointRequested) {
      inputState.resetToCheckpointRequested = false;
      const cp = checkpoints[activeCpRef.current];
      if (cp && difficulty === 'CHECKPOINTS') {
        respawnAt(cp.x, cp.y, cp.z);
      } else {
        respawnAt(0, 0.05, 0);
      }
    }

    simTimeRef.current += dt;
    runElapsedRef.current += dt;
    const simTime = simTimeRef.current;

    // 1. Moving / rotating platform delta-transfer
    if (groundedRef.current && groundedPlatIdRef.current !== null) {
      const plat = platforms[groundedPlatIdRef.current - 1];
      if (plat && (plat.kind === 'moving' || plat.kind === 'turbine_blade')) {
        const curPose = getPlatformPoseAt(plat, simTime);
        const prev = prevPlatPoseRef.current;
        posRef.current.x += curPose.x - prev.x;
        posRef.current.y += curPose.y - prev.y;
        posRef.current.z += curPose.z - prev.z;

        const dRot = curPose.rotY - prev.rotY;
        if (Math.abs(dRot) > 1e-6) {
          const rx = posRef.current.x - curPose.x;
          const rz = posRef.current.z - curPose.z;
          const c = Math.cos(dRot);
          const s = Math.sin(dRot);
          posRef.current.x = curPose.x + rx * c - rz * s;
          posRef.current.z = curPose.z + rx * s + rz * c;
          facingYawRef.current += dRot;
        }
        prevPlatPoseRef.current = curPose;
      }
    }

    // 2. Poll input & timers
    if (inputState.jumpJustPressed) {
      inputState.jumpJustPressed = false;
      jumpBufferTimerRef.current = JUMP_BUFFER_MAX;
    } else if (jumpBufferTimerRef.current > 0) {
      jumpBufferTimerRef.current = Math.max(0, jumpBufferTimerRef.current - dt);
    }

    if (dashCooldownRef.current > 0) {
      dashCooldownRef.current = Math.max(0, dashCooldownRef.current - dt);
    }
    if (ledgeGrabCooldownRef.current > 0) {
      ledgeGrabCooldownRef.current = Math.max(0, ledgeGrabCooldownRef.current - dt);
    }
    if (jumpAnimTimerRef.current > 0) {
      jumpAnimTimerRef.current = Math.max(0, jumpAnimTimerRef.current - dt);
    }

    // Find closest Magnetic Grapple Drone Anchor in range
    let bestAnchor = null;
    let bestDist = GRAPPLE_RANGE;
    for (let i = 0; i < grappleAnchors.length; i++) {
      const a = grappleAnchors[i];
      if (a.y < posRef.current.y - 2.5) continue;
      const d = Math.hypot(
        a.x - posRef.current.x,
        a.y - posRef.current.y,
        a.z - posRef.current.z
      );
      if (d < bestDist) {
        bestDist = d;
        bestAnchor = a;
      }
    }
    targetAnchorIdRef.current = bestAnchor ? bestAnchor.id : null;

    if (hudRefs.current.grappleBtnEl) {
      const canGrapple = bestAnchor !== null && grappleTimerRef.current <= 0;
      hudRefs.current.grappleBtnEl.style.opacity = canGrapple ? '1' : '0.32';
      hudRefs.current.grappleBtnEl.style.transform = canGrapple ? 'scale(1.08)' : 'scale(0.95)';
      hudRefs.current.grappleBtnEl.style.boxShadow = canGrapple
        ? '0 0 26px rgba(34, 211, 238, 0.85)'
        : 'none';
    }

    // Trigger Magnetic Grapple Hook
    if (inputState.grappleJustPressed) {
      inputState.grappleJustPressed = false;
      if (bestAnchor && grappleTimerRef.current <= 0) {
        grappleTimerRef.current = GRAPPLE_DURATION;
        grappleTargetRef.current.set(bestAnchor.x, bestAnchor.y, bestAnchor.z);
        groundedRef.current = false;
        groundedPlatIdRef.current = null;
        ledgeGrabTimerRef.current = 0;
        dashActiveTimerRef.current = 0;
        soundEngine.playGrappleZip();
      }
    }

    const rawMx = inputState.moveX;
    const rawMy = inputState.moveY;
    const mag = Math.hypot(rawMx, rawMy);
    const normMx = mag > 1 ? rawMx / mag : rawMx;
    const normMy = mag > 1 ? rawMy / mag : rawMy;

    const fwdX = Math.sin(inputState.camYaw);
    const fwdZ = Math.cos(inputState.camYaw);
    const rightX = -Math.cos(inputState.camYaw);
    const rightZ = Math.sin(inputState.camYaw);

    const wishX = rightX * normMx + fwdX * normMy;
    const wishZ = rightZ * normMx + fwdZ * normMy;
    const wishLen = Math.hypot(wishX, wishZ);

    if (wishLen > 0.08) {
      const targetYaw = Math.atan2(wishX, wishZ);
      let diff = targetYaw - facingYawRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facingYawRef.current += diff * (1 - Math.exp(-15 * dt));

      if (settings.autoCameraFollow && Math.abs(normMx) > 0.25) {
        inputState.camYaw -= normMx * 0.48 * dt;
      }
    }

    // 3. Active Grapple Zip OR Ledge-Grab OR Normal Physics
    if (grappleTimerRef.current > 0) {
      grappleTimerRef.current -= dt;
      tmpVecA.subVectors(grappleTargetRef.current, posRef.current);
      const distToAnchor = tmpVecA.length();
      if (distToAnchor > 0.1) {
        tmpVecA.normalize();
        velRef.current.copy(tmpVecA).multiplyScalar(22.0);
        facingYawRef.current = Math.atan2(tmpVecA.x, tmpVecA.z);
      }
      posRef.current.addScaledVector(velRef.current, dt);

      if (grappleTimerRef.current <= 0 || distToAnchor < 1.35) {
        grappleTimerRef.current = 0;
        // Launch smoothly upward and forward across the gap!
        velRef.current.y = 11.8;
        velRef.current.x *= 0.72;
        velRef.current.z *= 0.72;
        peakAltSinceGroundRef.current = posRef.current.y;
      }
    } else if (ledgeGrabTimerRef.current > 0) {
      ledgeGrabTimerRef.current -= dt;
      velRef.current.set(0, 0, 0);
      posRef.current.lerp(ledgeVaultTargetRef.current, 1 - Math.exp(-14 * dt));

      if (jumpBufferTimerRef.current > 0 || ledgeGrabTimerRef.current <= 0) {
        ledgeGrabTimerRef.current = 0;
        ledgeGrabCooldownRef.current = 0.5;
        jumpBufferTimerRef.current = 0;
        velRef.current.y = 11.6;
        velRef.current.x = Math.sin(facingYawRef.current) * 4.5;
        velRef.current.z = Math.cos(facingYawRef.current) * 4.5;
        jumpAnimTimerRef.current = 0.25;
        soundEngine.playJump();
      }
    } else {
      if (inputState.dashJustPressed) {
        inputState.dashJustPressed = false;
        if (dashCooldownRef.current <= 0) {
          dashCooldownRef.current = DASH_COOLDOWN;
          dashActiveTimerRef.current = DASH_DURATION;
          if (wishLen > 0.1) {
            dashDirRef.current.set(wishX / wishLen, 0, wishZ / wishLen);
          } else {
            dashDirRef.current.set(fwdX, 0, fwdZ);
          }
          velRef.current.y = Math.max(velRef.current.y, 9.6);
          soundEngine.playDash();
        }
      }

      if (dashActiveTimerRef.current > 0) {
        dashActiveTimerRef.current -= dt;
        velRef.current.x = dashDirRef.current.x * 16.5;
        velRef.current.z = dashDirRef.current.z * 16.5;
        velRef.current.y = Math.max(velRef.current.y, 4.2);
      } else {
        // Surface-specific horizontal friction (slippery Cyber-Glass vs crisp Steel!)
        const isGlass = groundedRef.current && groundedSurfaceRef.current === 'glass';
        const accel = groundedRef.current ? (isGlass ? 3.1 : 18.0) : 10.0;
        const speedMult = isGlass ? 1.15 : 1.0;
        const targetVx = wishX * MOVE_SPEED * speedMult;
        const targetVz = wishZ * MOVE_SPEED * speedMult;
        const lerpH = 1 - Math.exp(-accel * dt);
        velRef.current.x = THREE.MathUtils.lerp(velRef.current.x, targetVx, lerpH);
        velRef.current.z = THREE.MathUtils.lerp(velRef.current.z, targetVz, lerpH);
      }

      if (groundedRef.current) {
        coyoteTimerRef.current = COYOTE_MAX;
      } else {
        coyoteTimerRef.current = Math.max(0, coyoteTimerRef.current - dt);
      }

      if (jumpBufferTimerRef.current > 0 && coyoteTimerRef.current > 0) {
        velRef.current.y = JUMP_VELOCITY;
        groundedRef.current = false;
        groundedPlatIdRef.current = null;
        coyoteTimerRef.current = 0;
        jumpBufferTimerRef.current = 0;
        jumpAnimTimerRef.current = 0.28;
        soundEngine.playJump();
      }

      const gravityMult = posRef.current.y >= 750 ? 0.68 : 1.0;
      velRef.current.y += GRAVITY_BASE * gravityMult * dt;
      velRef.current.y = Math.max(velRef.current.y, -38);

      const prevY = posRef.current.y;
      const preImpactVy = velRef.current.y;
      posRef.current.x += velRef.current.x * dt;
      posRef.current.y += velRef.current.y * dt;
      posRef.current.z += velRef.current.z * dt;

      let landed = false;
      let landedPlatId: number | null = null;
      let landedSurface: SurfaceMaterialType = 'metal';
      let landedPose = { x: 0, y: 0, z: 0, rotY: 0 };
      let bounced = false;

      const py = posRef.current.y;
      const px = posRef.current.x;
      const pz = posRef.current.z;

      for (let i = 0; i < platforms.length; i++) {
        const plat = platforms[i];
        if (Math.abs(plat.y - py) > 12) continue;

        const pose =
          plat.kind === 'moving' || plat.kind === 'turbine_blade'
            ? getPlatformPoseAt(plat, simTime)
            : { x: plat.x, y: plat.y, z: plat.z, rotY: plat.rotY ?? 0 };

        const halfW = plat.w * 0.5;
        const halfH = plat.h * 0.5;
        const halfD = plat.d * 0.5;
        const topY = pose.y + halfH;
        const bottomY = pose.y - halfH;

        const [lx, lz] = worldToPlatformLocal(px, pz, pose.x, pose.z, pose.rotY);

        const insideFootprint =
          Math.abs(lx) <= halfW + HAND_RADIUS && Math.abs(lz) <= halfD + HAND_RADIUS;

        if (
          insideFootprint &&
          velRef.current.y <= 0 &&
          prevY >= topY - 0.55 &&
          py <= topY + 0.14
        ) {
          posRef.current.y = topY;
          if (plat.kind === 'trampoline' && plat.bounceVel) {
            velRef.current.y = plat.bounceVel;
            groundedRef.current = false;
            groundedPlatIdRef.current = null;
            jumpAnimTimerRef.current = 0.35;
            bounced = true;
            shockwavePosRef.current.set(px, topY + 0.06, pz);
            shockwaveScaleMaxRef.current = 4.6;
            shockwaveTimerRef.current = 0.45;
            soundEngine.playBounce();
            break;
          }

          landedSurface = getSurfaceMaterialType(plat.kind);

          if (!groundedRef.current) {
            const dropHeight = peakAltSinceGroundRef.current - topY;
            if (dropHeight > 80) {
              // Viral Fall-Cam heavy landing shockwave!
              shockwavePosRef.current.set(px, topY + 0.08, pz);
              shockwaveScaleMaxRef.current = 7.5;
              shockwaveTimerRef.current = 0.55;
              sparkPosRef.current.set(px, topY + 0.1, pz);
              sparkTimerRef.current = 0.45;
              soundEngine.playHeavyImpact();
            } else if (preImpactVy < -8.5 && landedSurface === 'metal') {
              sparkPosRef.current.set(px, topY + 0.08, pz);
              sparkTimerRef.current = 0.36;
              soundEngine.playSurfaceStep(landedSurface, 1.3);
            } else if (preImpactVy < -3) {
              soundEngine.playSurfaceStep(landedSurface, 1.0);
            }
          }

          velRef.current.y = 0;
          landed = true;
          landedPlatId = plat.id;
          landedPose = pose;
          peakAltSinceGroundRef.current = topY;

          if (
            plat.checkpointIndex !== undefined &&
            difficulty === 'CHECKPOINTS' &&
            plat.checkpointIndex > activeCpRef.current
          ) {
            soundEngine.playCheckpoint();
            onCheckpointReached(plat.checkpointIndex, Math.round(topY));
          }

          if (plat.kind === 'summit' && !victoryTriggeredRef.current) {
            victoryTriggeredRef.current = true;
            soundEngine.playVictory();
            onVictory(runElapsedRef.current);
          }
          break;
        }

        if (py > bottomY - 0.15 && py < topY - 0.25) {
          const overlapX = halfW + HAND_RADIUS - Math.abs(lx);
          const overlapZ = halfD + HAND_RADIUS - Math.abs(lz);
          if (overlapX > 0 && overlapZ > 0) {
            const distFromTop = topY - py;
            if (
              !groundedRef.current &&
              velRef.current.y <= 3.5 &&
              ledgeGrabCooldownRef.current <= 0 &&
              distFromTop >= 0.08 &&
              distFromTop <= 0.92
            ) {
              ledgeGrabTimerRef.current = LEDGE_GRAB_DURATION;
              const dirToCenterX = pose.x - px;
              const dirToCenterZ = pose.z - pz;
              const dLen = Math.hypot(dirToCenterX, dirToCenterZ) || 1;
              ledgeVaultTargetRef.current.set(
                px + (dirToCenterX / dLen) * 0.45,
                topY + 0.15,
                pz + (dirToCenterZ / dLen) * 0.45
              );
              facingYawRef.current = Math.atan2(dirToCenterX, dirToCenterZ);
              velRef.current.set(0, 0, 0);
              soundEngine.playLedgeGrab();
              break;
            }

            let pushLx = 0;
            let pushLz = 0;
            if (overlapX < overlapZ) {
              pushLx = lx >= 0 ? overlapX : -overlapX;
            } else {
              pushLz = lz >= 0 ? overlapZ : -overlapZ;
            }
            const c = Math.cos(pose.rotY);
            const s = Math.sin(pose.rotY);
            posRef.current.x += pushLx * c - pushLz * s;
            posRef.current.z += pushLx * s + pushLz * c;
            velRef.current.x *= 0.4;
            velRef.current.z *= 0.4;
          }
        }
      }

      if (!bounced) {
        groundedRef.current = landed;
        groundedPlatIdRef.current = landedPlatId;
        if (landed) {
          groundedSurfaceRef.current = landedSurface;
          prevPlatPoseRef.current = landedPose;
        }
      }

      if (posRef.current.y < -8) {
        if (difficulty === 'CHECKPOINTS' && activeCpRef.current >= 0) {
          const cp = checkpoints[activeCpRef.current];
          respawnAt(cp.x, cp.y, cp.z);
        } else {
          respawnAt(0, 0.05, 0);
        }
      }
    }

    // Peak height tracking for Viral Fall-Cam
    if (posRef.current.y > peakAltSinceGroundRef.current) {
      peakAltSinceGroundRef.current = posRef.current.y;
    }
    const continuousFallDist = Math.max(0, peakAltSinceGroundRef.current - posRef.current.y);
    const isViralFalling =
      !groundedRef.current && continuousFallDist > 80 && velRef.current.y < -11;

    // 4. Precision Laser Landing Reticle via THREE.Raycaster
    if (collisionGroupRef.current && vfxRefs.current.reticleGroup && vfxRefs.current.laserBeam) {
      rayOriginRef.current.set(posRef.current.x, posRef.current.y + 0.35, posRef.current.z);
      raycasterRef.current.set(rayOriginRef.current, DOWN_DIR);
      raycasterRef.current.near = 0.05;
      raycasterRef.current.far = 48;
      const hits = raycasterRef.current.intersectObjects(collisionGroupRef.current.children, true);

      if (hits.length > 0 && !groundedRef.current) {
        const hitY = hits[0].point.y;
        const drop = posRef.current.y - hitY;
        if (drop > 0.25) {
          vfxRefs.current.reticleGroup.visible = true;
          vfxRefs.current.reticleGroup.position.set(posRef.current.x, hitY + 0.03, posRef.current.z);
          const pulse = 1 + Math.sin(simTime * 10) * 0.12;
          vfxRefs.current.reticleGroup.scale.setScalar(pulse);

          vfxRefs.current.laserBeam.visible = true;
          vfxRefs.current.laserBeam.position.set(
            posRef.current.x,
            hitY + drop * 0.5,
            posRef.current.z
          );
          vfxRefs.current.laserBeam.scale.set(1, drop, 1);
        } else {
          vfxRefs.current.reticleGroup.visible = false;
          vfxRefs.current.laserBeam.visible = false;
        }
      } else {
        vfxRefs.current.reticleGroup.visible = false;
        vfxRefs.current.laserBeam.visible = false;
      }
    }

    // 5. Update 3D VFX (Grapple Tether, Shockwave Ring, Sparks, Glass Frost)
    if (vfxRefs.current.tetherBeam) {
      if (grappleTimerRef.current > 0) {
        vfxRefs.current.tetherBeam.visible = true;
        tmpVecA.set(posRef.current.x, posRef.current.y + 0.55, posRef.current.z);
        tmpVecB.subVectors(grappleTargetRef.current, tmpVecA);
        const len = tmpVecB.length();
        vfxRefs.current.tetherBeam.position.copy(tmpVecA).addScaledVector(tmpVecB, 0.5);
        vfxRefs.current.tetherBeam.scale.set(1, len, 1);
        tmpVecB.normalize();
        tmpQuat.setFromUnitVectors(UP_AXIS, tmpVecB);
        vfxRefs.current.tetherBeam.quaternion.copy(tmpQuat);
      } else {
        vfxRefs.current.tetherBeam.visible = false;
      }
    }

    if (vfxRefs.current.shockwaveRing) {
      if (shockwaveTimerRef.current > 0) {
        shockwaveTimerRef.current = Math.max(0, shockwaveTimerRef.current - dt);
        const prog = 1 - shockwaveTimerRef.current / 0.5;
        vfxRefs.current.shockwaveRing.visible = true;
        vfxRefs.current.shockwaveRing.position.copy(shockwavePosRef.current);
        vfxRefs.current.shockwaveRing.scale.setScalar(
          0.6 + prog * shockwaveScaleMaxRef.current
        );
      } else {
        vfxRefs.current.shockwaveRing.visible = false;
      }
    }

    if (vfxRefs.current.sparkPool) {
      if (sparkTimerRef.current > 0) {
        sparkTimerRef.current = Math.max(0, sparkTimerRef.current - dt);
        const age = 1 - sparkTimerRef.current / 0.42;
        vfxRefs.current.sparkPool.visible = true;
        vfxRefs.current.sparkPool.position.copy(sparkPosRef.current);
        const kids = vfxRefs.current.sparkPool.children;
        for (let i = 0; i < kids.length; i++) {
          const ang = (i / kids.length) * Math.PI * 2;
          const r = age * 1.9;
          kids[i].position.set(
            Math.cos(ang) * r,
            Math.sin(age * Math.PI) * 0.9,
            Math.sin(ang) * r
          );
          kids[i].scale.setScalar(Math.max(0.05, 1 - age));
        }
      } else {
        vfxRefs.current.sparkPool.visible = false;
      }
    }

    const horizSpeed = Math.hypot(velRef.current.x, velRef.current.z);
    if (vfxRefs.current.frostPool) {
      const showFrost =
        groundedRef.current &&
        groundedSurfaceRef.current === 'glass' &&
        horizSpeed > 1.8 &&
        settings.graphicsPreset !== 'low';
      vfxRefs.current.frostPool.visible = showFrost;
      if (showFrost) {
        vfxRefs.current.frostPool.position.copy(posRef.current);
        const kids = vfxRefs.current.frostPool.children;
        for (let i = 0; i < kids.length; i++) {
          const fAge = (simTime * 3.5 + i * 0.14) % 1;
          const ang = facingYawRef.current + Math.PI + (i - 3.5) * 0.25;
          kids[i].position.set(
            Math.sin(ang) * fAge * 1.2,
            0.08 + fAge * 0.3,
            Math.cos(ang) * fAge * 1.2
          );
          kids[i].scale.setScalar(1 - fAge * 0.8);
        }
      }
    }

    // 6. Sync Hand Transform & Diegetic LED Energy Gauge
    if (handRootRef.current) {
      handRootRef.current.position.copy(posRef.current);
    }

    handAnimRef.current.isMenuIdle = false;
    handAnimRef.current.grounded = groundedRef.current;
    handAnimRef.current.speedHoriz = horizSpeed;
    handAnimRef.current.vy = velRef.current.y;
    handAnimRef.current.isDashing = dashActiveTimerRef.current > 0;
    handAnimRef.current.dashTimer = dashActiveTimerRef.current;
    handAnimRef.current.isGrappling = grappleTimerRef.current > 0;
    handAnimRef.current.isLedgeGrabbing = ledgeGrabTimerRef.current > 0;
    handAnimRef.current.jumpAnimTimer = jumpAnimTimerRef.current;
    handAnimRef.current.facingYaw = facingYawRef.current;
    handAnimRef.current.energyRatio = 1 - dashCooldownRef.current / DASH_COOLDOWN;

    // Surface-specific footsteps audio
    if (groundedRef.current && horizSpeed > 1.2) {
      footstepTimerRef.current += dt * (5.2 + horizSpeed * 0.55);
      if (footstepTimerRef.current >= 1) {
        footstepTimerRef.current = 0;
        soundEngine.playSurfaceStep(groundedSurfaceRef.current, 0.72);
      }
    }

    const alt = Math.max(0, posRef.current.y);
    playerAltRef.current = alt;
    soundEngine.updateWind(alt, velRef.current.y, true);

    // Milestones: 250m, 500m, 750m
    for (const m of [250, 500, 750]) {
      if (alt >= m && !passedMilestonesRef.current.has(m)) {
        passedMilestonesRef.current.add(m);
        soundEngine.playMilestone();
        onMilestoneReached(m);
      }
    }

    if (alt > maxAltThisRunRef.current) {
      maxAltThisRunRef.current = alt;
      if (alt - lastReportedRecordRef.current >= 5) {
        lastReportedRecordRef.current = alt;
        onAltitudeRecord(Math.round(alt));
      }
    }

    // 7. Zero-Jitter Exponential Camera + Viral Fall-Cam Zoom-Out + Occlusion Check
    const camDistTarget = isViralFalling ? 10.6 : 5.9;
    const pitch = THREE.MathUtils.clamp(inputState.camPitch, -0.35, 1.15);
    const yaw = inputState.camYaw;

    const lookTarget = new THREE.Vector3(
      posRef.current.x,
      posRef.current.y + 1.05,
      posRef.current.z
    );

    const cosP = Math.cos(pitch);
    const offX = -Math.sin(yaw) * cosP;
    const offY = Math.sin(pitch);
    const offZ = -Math.cos(yaw) * cosP;

    let safeDist = camDistTarget;
    for (let step = 1; step <= 4; step++) {
      const testD = (camDistTarget * step) / 4;
      const tx = lookTarget.x + offX * testD;
      const ty = lookTarget.y + offY * testD;
      const tz = lookTarget.z + offZ * testD;

      let occluded = false;
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (Math.abs(p.y - ty) > 3.5) continue;
        const pose =
          p.kind === 'moving' || p.kind === 'turbine_blade'
            ? getPlatformPoseAt(p, simTime)
            : { x: p.x, y: p.y, z: p.z, rotY: p.rotY ?? 0 };
        const [lx, lz] = worldToPlatformLocal(tx, tz, pose.x, pose.z, pose.rotY);
        if (
          Math.abs(lx) < p.w * 0.5 + 0.25 &&
          Math.abs(lz) < p.d * 0.5 + 0.25 &&
          Math.abs(ty - pose.y) < p.h * 0.5 + 0.25
        ) {
          occluded = true;
          break;
        }
      }
      if (occluded) {
        safeDist = Math.max(2.1, testD - 0.5);
        break;
      }
    }

    const desiredCamPos = new THREE.Vector3(
      lookTarget.x + offX * safeDist,
      lookTarget.y + offY * safeDist,
      lookTarget.z + offZ * safeDist
    );

    const camSmooth = 1 - Math.exp(-13 * dt);
    const lookSmooth = 1 - Math.exp(-16 * dt);
    camPosRef.current.lerp(desiredCamPos, camSmooth);
    camLookRef.current.lerp(lookTarget, lookSmooth);
    camera.position.copy(camPosRef.current);
    camera.lookAt(camLookRef.current);

    // 8. Direct DOM HUD Updates (ZERO React setState!)
    const hud = hudRefs.current;
    if (hud.altitudeEl) hud.altitudeEl.textContent = `${Math.round(alt)}m`;
    if (hud.altitudeBarEl) {
      hud.altitudeBarEl.style.width = `${Math.min(100, (alt / 1000) * 100).toFixed(1)}%`;
    }
    if (hud.timerEl) hud.timerEl.textContent = formatTime(runElapsedRef.current);
    if (hud.biomeEl) hud.biomeEl.textContent = getBiomeAtAltitude(alt).nameAr;
    if (hud.dashRingCircleEl) {
      const readyRatio = 1 - dashCooldownRef.current / DASH_COOLDOWN;
      hud.dashRingCircleEl.style.strokeDashoffset = `${163.36 * (1 - readyRatio)}`;
    }
    if (hud.dashBtnEl && hud.dashLabelEl) {
      const ready = dashCooldownRef.current <= 0;
      hud.dashBtnEl.style.opacity = ready ? '1' : '0.62';
      hud.dashLabelEl.textContent = ready ? 'توربين' : `${dashCooldownRef.current.toFixed(1)}s`;
    }
    if (hud.ledgeBannerEl) {
      hud.ledgeBannerEl.style.opacity = ledgeGrabTimerRef.current > 0 ? '1' : '0';
    }
    if (hud.fallCamBannerEl && hud.fallCamDistEl) {
      hud.fallCamBannerEl.style.opacity = isViralFalling ? '1' : '0';
      if (isViralFalling) {
        hud.fallCamDistEl.textContent = `سقوط حر: -${Math.round(continuousFallDist)} متر!`;
      }
    }
  });

  return (
    <>
      <BiomeWorld
        platforms={platforms}
        checkpoints={checkpoints}
        grappleAnchors={grappleAnchors}
        activeCheckpointIdx={activeCheckpointIdx}
        targetAnchorIdRef={targetAnchorIdRef}
        collisionGroupRef={collisionGroupRef}
        playerAltRef={playerAltRef}
        graphicsPreset={settings.graphicsPreset}
        isVictory={gameState === 'VICTORY'}
        simTimeRef={simTimeRef}
      />
      <CyberHandModel
        rootRef={handRootRef}
        animStateRef={handAnimRef}
        skinId={skinId}
        thrusterId={thrusterId}
      />
      <SceneVfx vfxRefs={vfxRefs} />
    </>
  );
};
