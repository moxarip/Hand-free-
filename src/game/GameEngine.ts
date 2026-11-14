import * as THREE from 'three';
import {
  DifficultyMode,
  EngineInputState,
  GameState,
  HudDomRefs,
  RelicSkinId,
  SettingsData,
  SurfaceType,
} from '../types/game';
import { soundEngine } from './audio';
import { buildImmortalHand, HandAnimState, ImmortalHandRig } from './handBuilder';
import {
  buildWorldVisuals,
  CourseData,
  getBiomeInfo,
  getCourseData,
  getPlatformPoseAt,
  getSurfaceType,
  WorldVisuals,
} from './worldBuilder';

export interface EngineCallbacks {
  onCheckpointReached: (idx: number, altitude: number) => void;
  onMilestoneReached: (altitude: number) => void;
  onAltitudeRecord: (altitude: number) => void;
  onVictory: (elapsedSec: number) => void;
}

const GRAVITY_BASE = -28.0;
const JUMP_VELOCITY = 15.2;
const MOVE_SPEED = 9.4;
const COYOTE_MAX = 0.15;
const JUMP_BUFFER_MAX = 0.12;
const LEDGE_GRAB_DURATION = 0.4;
const DASH_COOLDOWN = 2.2;
const DASH_DURATION = 0.24;
const GRAPPLE_RANGE = 21.5;
const GRAPPLE_DURATION = 0.44;
const HAND_RADIUS = 0.36;

const DOWN_DIR = new THREE.Vector3(0, -1, 0);
const UP_AXIS = new THREE.Vector3(0, 1, 0);

const REALM_SKY = [
  new THREE.Color('#2a1215'), // 0m Ash Abyss
  new THREE.Color('#2e1065'), // 250m Suspended Astral Ruins
  new THREE.Color('#083344'), // 500m Spectral Crystal Spires
  new THREE.Color('#090514'), // 750m+ Throne of Eternity
];

const REALM_FOG = [
  new THREE.Color('#5c1d18'),
  new THREE.Color('#5b21b6'),
  new THREE.Color('#0e7490'),
  new THREE.Color('#1e1b4b'),
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 10) % 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${cs}`;
}

function worldToLocal(
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

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private fog: THREE.Fog;
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  private course: CourseData;
  private world: WorldVisuals;
  private hand: ImmortalHandRig;

  // VFX Meshes
  private reticleGroup: THREE.Group;
  private laserGuide: THREE.Mesh;
  private tetherBeam: THREE.Mesh;
  private shockwaveRing: THREE.Mesh;
  private landingSparks: THREE.Group;
  private compassWisps: THREE.Group;

  private input: EngineInputState;
  private hudRefs: HudDomRefs;
  private callbacks: EngineCallbacks;

  private gameState: GameState = 'SPLASH';
  private difficulty: DifficultyMode = 'CHECKPOINTS';
  private settings: SettingsData;
  private activeCheckpointIdx = -1;

  // Physics & Simulation Refs
  private pos = new THREE.Vector3(0, 0.05, 0);
  private vel = new THREE.Vector3(0, 0, 0);
  private facingYaw = 0;
  private grounded = true;
  private groundedSurface: SurfaceType = 'stone';
  private groundedPlatId: number | null = null;
  private prevPlatPose = { x: 0, y: 0, z: 0, rotY: 0 };

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private dashCooldown = 0;
  private dashActiveTimer = 0;
  private dashDir = new THREE.Vector3(0, 0, 1);
  private grappleTimer = 0;
  private grappleTarget = new THREE.Vector3();
  private ledgeGrabTimer = 0;
  private ledgeGrabCooldown = 0;
  private ledgeVaultTarget = new THREE.Vector3();
  private jumpAnimTimer = 0;

  private shockwaveTimer = 0;
  private shockwaveMaxScale = 4.2;
  private sparkTimer = 0;
  private peakAltSinceGround = 0;
  private passedMilestones = new Set<number>();

  private simTime = 0;
  private runElapsed = 0;
  private maxAltThisRun = 0;
  private lastReportedRecord = 0;
  private footstepTimer = 0;
  private fpsAccumFrames = 0;
  private fpsAccumTime = 0;

  // Reunion Cinematic state
  private reunionActive = false;
  private reunionElapsed = 0;
  private reunionStartPos = new THREE.Vector3();
  private victoryFired = false;
  private victoryElapsed = 0;

  private camPos = new THREE.Vector3(0, 3.2, -5.8);
  private camLook = new THREE.Vector3(0, 1.0, 0);
  private raycaster = new THREE.Raycaster();
  private rayOrigin = new THREE.Vector3();
  private tmpVecA = new THREE.Vector3();
  private tmpVecB = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpSky = new THREE.Color();
  private tmpFog = new THREE.Color();

  private drawDist = 220;
  private rafId = 0;
  private lastFrameMs = 0;
  private contextLost = false;
  private resizeObserver: ResizeObserver;
  private onWindowResize = () => this.handleResize();
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };
  private onContextRestored = () => {
    this.contextLost = false;
    this.handleResize();
  };

  constructor(
    canvas: HTMLCanvasElement,
    initialSkin: RelicSkinId,
    initialSettings: SettingsData,
    input: EngineInputState,
    hudRefs: HudDomRefs,
    callbacks: EngineCallbacks
  ) {
    this.canvas = canvas;
    this.settings = initialSettings;
    this.input = input;
    this.hudRefs = hudRefs;
    this.callbacks = callbacks;

    canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: initialSettings.graphicsPreset !== 'low',
        powerPreference: 'high-performance',
      });
    } catch {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      });
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = initialSettings.graphicsPreset === 'ultra';
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#2a1215');
    this.fog = new THREE.Fog('#5c1d18', 50, 220);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.15, 480);
    this.camera.position.copy(this.camPos);

    this.ambientLight = new THREE.AmbientLight('#fde68a', 0.85);
    this.scene.add(this.ambientLight);
    this.scene.add(new THREE.HemisphereLight('#fffbeb', '#1e1b4b', 0.55));

    this.sunLight = new THREE.DirectionalLight('#fffbeb', 1.6);
    this.sunLight.position.set(35, 180, 45);
    this.sunLight.castShadow = this.renderer.shadowMap.enabled;
    this.sunLight.shadow.mapSize.set(512, 512);
    this.scene.add(this.sunLight);

    this.course = getCourseData();
    this.world = buildWorldVisuals(
      this.scene,
      this.course,
      this.renderer.shadowMap.enabled,
      initialSettings.graphicsPreset !== 'low'
    );

    this.hand = buildImmortalHand(initialSkin);
    this.scene.add(this.hand.root);

    // Precision Ground Target Ring + Faint Guide Ray
    this.reticleGroup = new THREE.Group();
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.45, 24),
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      })
    );
    outerRing.rotation.x = -Math.PI / 2;
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.16, 16),
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      })
    );
    innerRing.rotation.x = -Math.PI / 2;
    this.reticleGroup.add(outerRing, innerRing);
    this.reticleGroup.visible = false;
    this.scene.add(this.reticleGroup);

    this.laserGuide = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 1, 6),
      new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.25 })
    );
    this.laserGuide.visible = false;
    this.scene.add(this.laserGuide);

    // Spectral Grapple Energy Thread
    this.tetherBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1, 8),
      new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.92 })
    );
    this.tetherBeam.visible = false;
    this.scene.add(this.tetherBeam);

    // Expanding Shockwave Ring
    this.shockwaveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.visible = false;
    this.scene.add(this.shockwaveRing);

    // Landing Sparks Pool
    this.landingSparks = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.058, 0),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? '#fde047' : '#fb923c' })
      );
      this.landingSparks.add(m);
    }
    this.landingSparks.visible = false;
    this.scene.add(this.landingSparks);

    // Golden Soul-Tether Compass Wisps
    this.compassWisps = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const wisp = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.085, 0),
        new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.85 })
      );
      this.compassWisps.add(wisp);
    }
    this.scene.add(this.compassWisps);

    this.applySettings(initialSettings);
    this.handleResize();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
    if (canvas.parentElement) {
      this.resizeObserver.observe(canvas.parentElement);
    }
    window.addEventListener('resize', this.onWindowResize);

    this.lastFrameMs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  public setHudRefs(refs: HudDomRefs): void {
    this.hudRefs = refs;
  }

  public setGameState(next: GameState): void {
    this.gameState = next;
  }

  public setDifficulty(mode: DifficultyMode): void {
    this.difficulty = mode;
  }

  public setSkin(skinId: RelicSkinId): void {
    this.hand.updateSkin(skinId);
  }

  public setActiveCheckpoint(idx: number): void {
    this.activeCheckpointIdx = idx;
  }

  public applySettings(next: SettingsData): void {
    this.settings = next;
    soundEngine.applySettings(next);

    const nativeDpr = window.devicePixelRatio || 1;
    let dpr = nativeDpr;
    if (next.renderResolution === '50') dpr = 0.55;
    else if (next.renderResolution === '75') dpr = 0.8;
    else if (next.renderResolution === '100') dpr = Math.min(nativeDpr, 1.5);
    else dpr = Math.min(nativeDpr, 2.0);
    this.renderer.setPixelRatio(dpr);

    const shadows = next.graphicsPreset === 'ultra';
    this.renderer.shadowMap.enabled = shadows;
    this.sunLight.castShadow = shadows;

    this.drawDist =
      next.graphicsPreset === 'low'
        ? 105
        : next.graphicsPreset === 'medium'
          ? 155
          : next.graphicsPreset === 'high'
            ? 220
            : 300;
    this.world.ambientGroup.visible = next.graphicsPreset !== 'low';
  }

  public resetCameraBehindHand(): void {
    this.input.camYaw = this.facingYaw;
    this.input.camPitch = 0.34;
  }

  public startNewRun(): void {
    this.pos.set(0, 0.05, 0);
    this.vel.set(0, 0, 0);
    this.facingYaw = 0;
    this.input.camYaw = 0;
    this.input.camPitch = 0.34;
    this.grounded = true;
    this.groundedSurface = 'stone';
    this.groundedPlatId = null;
    this.coyoteTimer = COYOTE_MAX;
    this.jumpBufferTimer = 0;
    this.dashCooldown = 0;
    this.dashActiveTimer = 0;
    this.grappleTimer = 0;
    this.ledgeGrabTimer = 0;
    this.ledgeGrabCooldown = 0;
    this.jumpAnimTimer = 0;
    this.shockwaveTimer = 0;
    this.sparkTimer = 0;
    this.peakAltSinceGround = 0;
    this.passedMilestones.clear();
    this.runElapsed = 0;
    this.maxAltThisRun = 0;
    this.lastReportedRecord = 0;
    this.reunionActive = false;
    this.reunionElapsed = 0;
    this.victoryFired = false;
    this.victoryElapsed = 0;
    this.camPos.set(0, 3.2, -5.8);
    this.camLook.set(0, 1.0, 0);
  }

  public returnToCheckpoint(): void {
    const cp = this.course.checkpoints[this.activeCheckpointIdx];
    if (cp && this.difficulty === 'CHECKPOINTS') {
      this.respawnAt(cp.x, cp.y, cp.z);
    } else {
      this.respawnAt(0, 0.05, 0);
    }
  }

  private respawnAt(x: number, y: number, z: number): void {
    this.pos.set(x, y + 0.35, z);
    this.vel.set(0, 0, 0);
    this.grounded = false;
    this.groundedPlatId = null;
    this.ledgeGrabTimer = 0;
    this.dashActiveTimer = 0;
    this.grappleTimer = 0;
    this.coyoteTimer = 0;
    this.peakAltSinceGround = y + 0.35;
  }

  private handleResize(): void {
    const parent = this.canvas.parentElement;
    const w = this.canvas.clientWidth || parent?.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || parent?.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private loop = (nowMs: number): void => {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.contextLost) return;
    const rawDt = Math.max(0.001, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;
    const dt = Math.min(rawDt, 0.05);

    this.updateFpsHud(rawDt);
    this.step(dt, nowMs / 1000);
    this.renderer.render(this.scene, this.camera);
  };

  private updateFpsHud(rawDt: number): void {
    if (!this.settings.showFps || !this.hudRefs.fpsEl) return;
    this.fpsAccumFrames += 1;
    this.fpsAccumTime += rawDt;
    if (this.fpsAccumTime >= 0.35) {
      const fps = Math.round(this.fpsAccumFrames / this.fpsAccumTime);
      this.hudRefs.fpsEl.textContent = `${fps} FPS`;
      this.fpsAccumFrames = 0;
      this.fpsAccumTime = 0;
    }
  }

  private step(dt: number, wallClockSec: number): void {
    // 1. Menu / Splash Showcase Orbit
    if (this.gameState === 'MENU' || this.gameState === 'SPLASH') {
      this.simTime += dt;
      this.hand.root.position.set(0, 0.02, 0);
      const anim: HandAnimState = {
        speedHoriz: 0,
        vy: 0,
        grounded: true,
        isDashing: false,
        isGrappling: false,
        isLedgeGrabbing: false,
        jumpAnimTimer: 0,
        isMenuIdle: true,
        facingYaw: Math.sin(wallClockSec * 0.35) * 0.25,
        energyRatio: 1,
      };
      this.hand.animate(anim, dt, wallClockSec);
      this.world.updateDynamicWorld(this.simTime, 0, null, -1, false, 0);
      this.updateSkyAndFog(0);
      this.compassWisps.visible = false;
      this.reticleGroup.visible = false;
      this.laserGuide.visible = false;

      const orbitAngle = wallClockSec * 0.28;
      this.tmpVecA.set(
        Math.sin(orbitAngle) * 4.4,
        2.0 + Math.sin(orbitAngle * 0.7) * 0.3,
        Math.cos(orbitAngle) * 4.4
      );
      const s = 1 - Math.exp(-5 * dt);
      this.camPos.lerp(this.tmpVecA, s);
      this.camLook.lerp(this.tmpVecB.set(0, 0.7, 0), s);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      soundEngine.updateWind(0, 0, false);
      return;
    }

    if (this.gameState === 'PAUSED') {
      soundEngine.updateWind(this.pos.y, 0, false);
      return;
    }

    if (this.gameState === 'VICTORY') {
      this.simTime += dt;
      this.victoryElapsed += dt;
      this.world.updateDynamicWorld(
        this.simTime,
        1000,
        null,
        this.activeCheckpointIdx,
        true,
        this.victoryElapsed
      );
      const ang = this.victoryElapsed * 0.45;
      this.tmpVecA.set(
        this.course.masterWristWorldPos.x + Math.sin(ang) * 7.5,
        1004.5,
        this.course.masterWristWorldPos.z + Math.cos(ang) * 7.5
      );
      this.camPos.lerp(this.tmpVecA, 1 - Math.exp(-4 * dt));
      this.camLook.lerp(this.course.masterWristWorldPos, 1 - Math.exp(-6 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      soundEngine.updateWind(1000, 0, false);
      return;
    }

    // 2. Cinematic Reunion Ending Sequence (when landing on Throne at 1000m!)
    if (this.reunionActive) {
      this.simTime += dt;
      this.reunionElapsed += dt;
      const p = Math.min(1, this.reunionElapsed / 2.6);
      // Parabolic leap from Throne floor onto the Immortal Master's missing right wrist
      this.pos.lerpVectors(this.reunionStartPos, this.course.masterWristWorldPos, p);
      this.pos.y += Math.sin(p * Math.PI) * 2.8;
      this.hand.root.position.copy(this.pos);

      this.hand.animate(
        {
          speedHoriz: 0,
          vy: p < 0.5 ? 5 : -2,
          grounded: p >= 1,
          isDashing: p < 0.85,
          isGrappling: false,
          isLedgeGrabbing: false,
          jumpAnimTimer: 0,
          isMenuIdle: false,
          facingYaw: 0,
          energyRatio: 1,
        },
        dt,
        this.simTime
      );

      this.world.updateDynamicWorld(
        this.simTime,
        1000,
        null,
        this.activeCheckpointIdx,
        p > 0.85,
        Math.max(0, this.reunionElapsed - 2.2)
      );

      // Sweeping reunion camera
      const sweepAng = 0.6 + p * 1.4;
      this.tmpVecA.set(
        this.course.masterWristWorldPos.x + Math.sin(sweepAng) * 6.5,
        1003.6 + p * 1.2,
        this.course.masterWristWorldPos.z + Math.cos(sweepAng) * 6.5
      );
      this.camPos.lerp(this.tmpVecA, 1 - Math.exp(-6 * dt));
      this.camLook.lerp(this.course.masterWristWorldPos, 1 - Math.exp(-8 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);

      if (p >= 1 && !this.victoryFired) {
        this.victoryFired = true;
        this.shockwaveRing.visible = true;
        this.shockwaveRing.position.copy(this.course.masterWristWorldPos);
        this.shockwaveRing.scale.setScalar(4.5);
        this.callbacks.onVictory(this.runElapsed);
      }
      return;
    }

    // 3. Active Gameplay Physics
    this.simTime += dt;
    this.runElapsed += dt;

    // Moving / Pendulum / Orbiting platform delta-transfer
    if (this.grounded && this.groundedPlatId !== null) {
      const plat = this.course.platforms[this.groundedPlatId - 1];
      if (
        plat &&
        (plat.kind === 'elevator' ||
          plat.kind === 'pendulum' ||
          (plat.kind === 'astral_disc' && plat.orbitRadius))
      ) {
        const curPose = getPlatformPoseAt(plat, this.simTime);
        this.pos.x += curPose.x - this.prevPlatPose.x;
        this.pos.y += curPose.y - this.prevPlatPose.y;
        this.pos.z += curPose.z - this.prevPlatPose.z;

        const dRot = curPose.rotY - this.prevPlatPose.rotY;
        if (Math.abs(dRot) > 1e-6) {
          const rx = this.pos.x - curPose.x;
          const rz = this.pos.z - curPose.z;
          const c = Math.cos(dRot);
          const s = Math.sin(dRot);
          this.pos.x = curPose.x + rx * c - rz * s;
          this.pos.z = curPose.z + rx * s + rz * c;
          this.facingYaw += dRot;
        }
        this.prevPlatPose = curPose;
      }
    }

    // Input buffers & cooldowns
    if (this.input.jumpJustPressed) {
      this.input.jumpJustPressed = false;
      this.jumpBufferTimer = JUMP_BUFFER_MAX;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.ledgeGrabCooldown > 0) this.ledgeGrabCooldown = Math.max(0, this.ledgeGrabCooldown - dt);
    if (this.jumpAnimTimer > 0) this.jumpAnimTimer = Math.max(0, this.jumpAnimTimer - dt);

    // Nearest Soul-Anchor Crystal for Spectral Grapple Hook
    let bestAnchor = null;
    let bestDist = GRAPPLE_RANGE;
    for (let i = 0; i < this.course.soulAnchors.length; i++) {
      const a = this.course.soulAnchors[i];
      if (a.y < this.pos.y - 2.5) continue;
      const d = Math.hypot(a.x - this.pos.x, a.y - this.pos.y, a.z - this.pos.z);
      if (d < bestDist) {
        bestDist = d;
        bestAnchor = a;
      }
    }
    const targetAnchorId = bestAnchor ? bestAnchor.id : null;

    if (this.hudRefs.grappleBtnEl) {
      const canGrapple = bestAnchor !== null && this.grappleTimer <= 0;
      this.hudRefs.grappleBtnEl.style.opacity = canGrapple ? '1' : '0.32';
      this.hudRefs.grappleBtnEl.style.transform = canGrapple ? 'scale(1.08)' : 'scale(0.95)';
      this.hudRefs.grappleBtnEl.style.boxShadow = canGrapple
        ? '0 0 26px rgba(251, 191, 36, 0.88)'
        : 'none';
    }

    if (this.input.grappleJustPressed) {
      this.input.grappleJustPressed = false;
      if (bestAnchor && this.grappleTimer <= 0) {
        this.grappleTimer = GRAPPLE_DURATION;
        this.grappleTarget.set(bestAnchor.x, bestAnchor.y, bestAnchor.z);
        this.grounded = false;
        this.groundedPlatId = null;
        this.ledgeGrabTimer = 0;
        this.dashActiveTimer = 0;
        soundEngine.playGrappleChime();
      }
    }

    // Camera-relative movement direction
    const mag = Math.hypot(this.input.moveX, this.input.moveY);
    const nx = mag > 1 ? this.input.moveX / mag : this.input.moveX;
    const ny = mag > 1 ? this.input.moveY / mag : this.input.moveY;

    const fwdX = Math.sin(this.input.camYaw);
    const fwdZ = Math.cos(this.input.camYaw);
    const rightX = -Math.cos(this.input.camYaw);
    const rightZ = Math.sin(this.input.camYaw);

    const wishX = rightX * nx + fwdX * ny;
    const wishZ = rightZ * nx + fwdZ * ny;
    const wishLen = Math.hypot(wishX, wishZ);

    if (wishLen > 0.08) {
      const targetYaw = Math.atan2(wishX, wishZ);
      let diff = targetYaw - this.facingYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingYaw += diff * (1 - Math.exp(-15 * dt));

      if (this.settings.autoCameraFollow && Math.abs(nx) > 0.25) {
        this.input.camYaw -= nx * 0.48 * dt;
      }
    }

    // Grapple / Ledge-Grab / Standard Physics
    if (this.grappleTimer > 0) {
      this.grappleTimer -= dt;
      this.tmpVecA.subVectors(this.grappleTarget, this.pos);
      const dist = this.tmpVecA.length();
      if (dist > 0.1) {
        this.tmpVecA.normalize();
        this.vel.copy(this.tmpVecA).multiplyScalar(22.5);
        this.facingYaw = Math.atan2(this.tmpVecA.x, this.tmpVecA.z);
      }
      this.pos.addScaledVector(this.vel, dt);
      if (this.grappleTimer <= 0 || dist < 1.35) {
        this.grappleTimer = 0;
        this.vel.y = 12.0;
        this.vel.x *= 0.72;
        this.vel.z *= 0.72;
        this.peakAltSinceGround = this.pos.y;
      }
    } else if (this.ledgeGrabTimer > 0) {
      this.ledgeGrabTimer -= dt;
      this.vel.set(0, 0, 0);
      this.pos.lerp(this.ledgeVaultTarget, 1 - Math.exp(-14 * dt));
      if (this.jumpBufferTimer > 0 || this.ledgeGrabTimer <= 0) {
        this.ledgeGrabTimer = 0;
        this.ledgeGrabCooldown = 0.5;
        this.jumpBufferTimer = 0;
        this.vel.y = 11.6;
        this.vel.x = Math.sin(this.facingYaw) * 4.5;
        this.vel.z = Math.cos(this.facingYaw) * 4.5;
        this.jumpAnimTimer = 0.25;
        soundEngine.playJump();
      }
    } else {
      if (this.input.dashJustPressed) {
        this.input.dashJustPressed = false;
        if (this.dashCooldown <= 0) {
          this.dashCooldown = DASH_COOLDOWN;
          this.dashActiveTimer = DASH_DURATION;
          if (wishLen > 0.1) {
            this.dashDir.set(wishX / wishLen, 0, wishZ / wishLen);
          } else {
            this.dashDir.set(fwdX, 0, fwdZ);
          }
          this.vel.y = Math.max(this.vel.y, 9.6);
          soundEngine.playSoulDash();
        }
      }

      if (this.dashActiveTimer > 0) {
        this.dashActiveTimer -= dt;
        this.vel.x = this.dashDir.x * 16.5;
        this.vel.z = this.dashDir.z * 16.5;
        this.vel.y = Math.max(this.vel.y, 4.2);
      } else {
        // Crystal bridges are slippery (low friction)!
        const isCrystal = this.grounded && this.groundedSurface === 'crystal';
        const accel = this.grounded ? (isCrystal ? 3.2 : 18.0) : 10.0;
        const speedMult = isCrystal ? 1.16 : 1.0;
        const lerpH = 1 - Math.exp(-accel * dt);
        this.vel.x = THREE.MathUtils.lerp(this.vel.x, wishX * MOVE_SPEED * speedMult, lerpH);
        this.vel.z = THREE.MathUtils.lerp(this.vel.z, wishZ * MOVE_SPEED * speedMult, lerpH);
      }

      if (this.grounded) this.coyoteTimer = COYOTE_MAX;
      else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

      if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
        this.vel.y = JUMP_VELOCITY;
        this.grounded = false;
        this.groundedPlatId = null;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.jumpAnimTimer = 0.28;
        soundEngine.playJump();
      }

      const gravMult = this.pos.y >= 750 ? 0.68 : 1.0;
      this.vel.y += GRAVITY_BASE * gravMult * dt;
      this.vel.y = Math.max(this.vel.y, -38);

      const prevY = this.pos.y;
      const preImpactVy = this.vel.y;
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      this.pos.z += this.vel.z * dt;

      let landed = false;
      let landedId: number | null = null;
      let landedSurf: SurfaceType = 'stone';
      let landedPose = { x: 0, y: 0, z: 0, rotY: 0 };
      let bounced = false;

      const px = this.pos.x;
      const py = this.pos.y;
      const pz = this.pos.z;

      for (let i = 0; i < this.course.platforms.length; i++) {
        const plat = this.course.platforms[i];
        if (Math.abs(plat.y - py) > 13) continue;

        const pose =
          plat.kind === 'elevator' ||
          plat.kind === 'pendulum' ||
          (plat.kind === 'astral_disc' && plat.orbitRadius)
            ? getPlatformPoseAt(plat, this.simTime)
            : { x: plat.x, y: plat.y, z: plat.z, rotY: plat.rotY ?? 0 };

        const halfW = plat.w * 0.5;
        const halfH = plat.h * 0.5;
        const halfD = plat.d * 0.5;
        const topY = pose.y + halfH;
        const bottomY = pose.y - halfH;

        const [lx, lz] = worldToLocal(px, pz, pose.x, pose.z, pose.rotY);
        const inside = Math.abs(lx) <= halfW + HAND_RADIUS && Math.abs(lz) <= halfD + HAND_RADIUS;

        if (inside && this.vel.y <= 0 && prevY >= topY - 0.55 && py <= topY + 0.14) {
          this.pos.y = topY;

          if ((plat.kind === 'rune_pad' || plat.kind === 'wind_slab') && plat.bounceVel) {
            this.vel.y = plat.bounceVel;
            this.grounded = false;
            this.groundedPlatId = null;
            this.jumpAnimTimer = 0.35;
            bounced = true;
            this.shockwaveRing.position.set(px, topY + 0.06, pz);
            this.shockwaveMaxScale = 4.6;
            this.shockwaveTimer = 0.45;
            soundEngine.playRuneBounce();
            break;
          }

          landedSurf = getSurfaceType(plat.kind);

          if (!this.grounded) {
            const dropHeight = this.peakAltSinceGround - topY;
            if (dropHeight > 70) {
              this.shockwaveRing.position.set(px, topY + 0.08, pz);
              this.shockwaveMaxScale = 7.5;
              this.shockwaveTimer = 0.55;
              this.landingSparks.position.set(px, topY + 0.1, pz);
              this.sparkTimer = 0.45;
              soundEngine.playHeavyImpact();
            } else if (preImpactVy < -8.0) {
              this.landingSparks.position.set(px, topY + 0.08, pz);
              this.sparkTimer = 0.36;
              soundEngine.playSurfaceStep(landedSurf, 1.25);
            } else if (preImpactVy < -3.0) {
              soundEngine.playSurfaceStep(landedSurf, 1.0);
            }
          }

          this.vel.y = 0;
          landed = true;
          landedId = plat.id;
          landedPose = pose;
          this.peakAltSinceGround = topY;

          if (
            plat.checkpointIndex !== undefined &&
            this.difficulty === 'CHECKPOINTS' &&
            plat.checkpointIndex > this.activeCheckpointIdx
          ) {
            this.activeCheckpointIdx = plat.checkpointIndex;
            soundEngine.playCheckpoint();
            this.callbacks.onCheckpointReached(plat.checkpointIndex, Math.round(topY));
          }

          if (plat.kind === 'throne' && !this.reunionActive) {
            this.reunionActive = true;
            this.reunionElapsed = 0;
            this.reunionStartPos.copy(this.pos);
            soundEngine.playVictoryReunion();
          }
          break;
        }

        if (py > bottomY - 0.15 && py < topY - 0.25) {
          const overlapX = halfW + HAND_RADIUS - Math.abs(lx);
          const overlapZ = halfD + HAND_RADIUS - Math.abs(lz);
          if (overlapX > 0 && overlapZ > 0) {
            const distFromTop = topY - py;
            if (
              !this.grounded &&
              this.vel.y <= 3.5 &&
              this.ledgeGrabCooldown <= 0 &&
              distFromTop >= 0.08 &&
              distFromTop <= 0.92
            ) {
              this.ledgeGrabTimer = LEDGE_GRAB_DURATION;
              const dcx = pose.x - px;
              const dcz = pose.z - pz;
              const dl = Math.hypot(dcx, dcz) || 1;
              this.ledgeVaultTarget.set(px + (dcx / dl) * 0.45, topY + 0.15, pz + (dcz / dl) * 0.45);
              this.facingYaw = Math.atan2(dcx, dcz);
              this.vel.set(0, 0, 0);
              soundEngine.playLedgeGrab();
              break;
            }

            let pushLx = 0;
            let pushLz = 0;
            if (overlapX < overlapZ) pushLx = lx >= 0 ? overlapX : -overlapX;
            else pushLz = lz >= 0 ? overlapZ : -overlapZ;
            const c = Math.cos(pose.rotY);
            const s = Math.sin(pose.rotY);
            this.pos.x += pushLx * c - pushLz * s;
            this.pos.z += pushLx * s + pushLz * c;
            this.vel.x *= 0.4;
            this.vel.z *= 0.4;
          }
        }
      }

      if (!bounced) {
        this.grounded = landed;
        this.groundedPlatId = landedId;
        if (landed) {
          this.groundedSurface = landedSurf;
          this.prevPlatPose = landedPose;
        }
      }

      if (this.pos.y < -8) {
        if (this.difficulty === 'CHECKPOINTS' && this.activeCheckpointIdx >= 0) {
          const cp = this.course.checkpoints[this.activeCheckpointIdx];
          this.respawnAt(cp.x, cp.y, cp.z);
        } else {
          this.respawnAt(0, 0.05, 0);
        }
      }
    }

    // Viral Fall-Cam tracking (>70m continuous fall)
    if (this.pos.y > this.peakAltSinceGround) {
      this.peakAltSinceGround = this.pos.y;
    }
    const fallDist = Math.max(0, this.peakAltSinceGround - this.pos.y);
    const isViralFall = !this.grounded && fallDist > 70 && this.vel.y < -11;

    // Precision Ground Target Ring (downward THREE.Raycaster)
    this.rayOrigin.set(this.pos.x, this.pos.y + 0.35, this.pos.z);
    this.raycaster.set(this.rayOrigin, DOWN_DIR);
    this.raycaster.near = 0.05;
    this.raycaster.far = 48;
    const hits = this.raycaster.intersectObjects(this.world.collisionGroup.children, true);
    if (hits.length > 0 && !this.grounded) {
      const hitY = hits[0].point.y;
      const drop = this.pos.y - hitY;
      if (drop > 0.25) {
        this.reticleGroup.visible = true;
        this.reticleGroup.position.set(this.pos.x, hitY + 0.03, this.pos.z);
        this.reticleGroup.scale.setScalar(1 + Math.sin(this.simTime * 10) * 0.12);
        this.laserGuide.visible = true;
        this.laserGuide.position.set(this.pos.x, hitY + drop * 0.5, this.pos.z);
        this.laserGuide.scale.set(1, drop, 1);
      } else {
        this.reticleGroup.visible = false;
        this.laserGuide.visible = false;
      }
    } else {
      this.reticleGroup.visible = false;
      this.laserGuide.visible = false;
    }

    // Spectral Grapple Energy Thread
    if (this.grappleTimer > 0) {
      this.tetherBeam.visible = true;
      this.tmpVecA.set(this.pos.x, this.pos.y + 0.55, this.pos.z);
      this.tmpVecB.subVectors(this.grappleTarget, this.tmpVecA);
      const len = this.tmpVecB.length();
      this.tetherBeam.position.copy(this.tmpVecA).addScaledVector(this.tmpVecB, 0.5);
      this.tetherBeam.scale.set(1, len, 1);
      this.tmpVecB.normalize();
      this.tmpQuat.setFromUnitVectors(UP_AXIS, this.tmpVecB);
      this.tetherBeam.quaternion.copy(this.tmpQuat);
    } else {
      this.tetherBeam.visible = false;
    }

    // Shockwave Ring & Sparks
    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer = Math.max(0, this.shockwaveTimer - dt);
      const prog = 1 - this.shockwaveTimer / 0.5;
      this.shockwaveRing.visible = true;
      this.shockwaveRing.scale.setScalar(0.6 + prog * this.shockwaveMaxScale);
    } else {
      this.shockwaveRing.visible = false;
    }

    if (this.sparkTimer > 0) {
      this.sparkTimer = Math.max(0, this.sparkTimer - dt);
      const age = 1 - this.sparkTimer / 0.42;
      this.landingSparks.visible = true;
      for (let i = 0; i < this.landingSparks.children.length; i++) {
        const ang = (i / this.landingSparks.children.length) * Math.PI * 2;
        const r = age * 1.9;
        const child = this.landingSparks.children[i];
        child.position.set(Math.cos(ang) * r, Math.sin(age * Math.PI) * 0.9, Math.sin(ang) * r);
        child.scale.setScalar(Math.max(0.05, 1 - age));
      }
    } else {
      this.landingSparks.visible = false;
    }

    // Golden Soul-Tether Compass Wisps pointing toward the next higher platform
    let nextPlat = null;
    let minNextDist = 9999;
    for (let i = 0; i < this.course.platforms.length; i++) {
      const p = this.course.platforms[i];
      if (p.y > this.pos.y + 1.2 && p.y < this.pos.y + 22) {
        const d = Math.hypot(p.x - this.pos.x, p.y - this.pos.y, p.z - this.pos.z);
        if (d < minNextDist) {
          minNextDist = d;
          nextPlat = p;
        }
      }
    }
    if (nextPlat) {
      this.compassWisps.visible = true;
      this.tmpVecA.set(this.pos.x, this.pos.y + 0.65, this.pos.z);
      this.tmpVecB.set(nextPlat.x - this.pos.x, nextPlat.y - this.pos.y, nextPlat.z - this.pos.z).normalize();
      for (let w = 0; w < this.compassWisps.children.length; w++) {
        const wAge = (this.simTime * 1.1 + w * 0.16) % 1;
        const wisp = this.compassWisps.children[w];
        wisp.position
          .copy(this.tmpVecA)
          .addScaledVector(this.tmpVecB, 0.8 + wAge * 3.4);
        wisp.position.y += Math.sin(this.simTime * 5 + w) * 0.12;
        wisp.scale.setScalar((1 - wAge) * 0.9 + 0.15);
      }
    } else {
      this.compassWisps.visible = false;
    }

    // Sync Hand Transform & Animations
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.hand.root.position.copy(this.pos);
    this.hand.animate(
      {
        speedHoriz: horizSpeed,
        vy: this.vel.y,
        grounded: this.grounded,
        isDashing: this.dashActiveTimer > 0,
        isGrappling: this.grappleTimer > 0,
        isLedgeGrabbing: this.ledgeGrabTimer > 0,
        jumpAnimTimer: this.jumpAnimTimer,
        isMenuIdle: false,
        facingYaw: this.facingYaw,
        energyRatio: 1 - this.dashCooldown / DASH_COOLDOWN,
      },
      dt,
      this.simTime
    );

    if (this.grounded && horizSpeed > 1.2) {
      this.footstepTimer += dt * (5.2 + horizSpeed * 0.55);
      if (this.footstepTimer >= 1) {
        this.footstepTimer = 0;
        soundEngine.playSurfaceStep(this.groundedSurface, 0.72);
      }
    }

    const alt = Math.max(0, this.pos.y);
    soundEngine.updateWind(alt, this.vel.y, true);

    for (const m of [250, 500, 750]) {
      if (alt >= m && !this.passedMilestones.has(m)) {
        this.passedMilestones.add(m);
        soundEngine.playMilestone();
        this.callbacks.onMilestoneReached(m);
      }
    }

    if (alt > this.maxAltThisRun) {
      this.maxAltThisRun = alt;
      if (alt - this.lastReportedRecord >= 5) {
        this.lastReportedRecord = alt;
        this.callbacks.onAltitudeRecord(Math.round(alt));
      }
    }

    // Update World & Sky
    this.world.updateDynamicWorld(
      this.simTime,
      alt,
      targetAnchorId,
      this.activeCheckpointIdx,
      false,
      0
    );
    this.updateSkyAndFog(alt);

    // Zero-Jitter Exponential Camera + Viral Fall-Cam + Occlusion Pull-In
    const camDistTarget = isViralFall ? 10.8 : 5.9;
    const pitch = THREE.MathUtils.clamp(this.input.camPitch, -0.35, 1.15);
    const yaw = this.input.camYaw;

    const lookTarget = this.tmpVecA.set(this.pos.x, this.pos.y + 1.05, this.pos.z);
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
      for (let i = 0; i < this.course.platforms.length; i++) {
        const p = this.course.platforms[i];
        if (Math.abs(p.y - ty) > 3.5) continue;
        const pose =
          p.kind === 'elevator' ||
          p.kind === 'pendulum' ||
          (p.kind === 'astral_disc' && p.orbitRadius)
            ? getPlatformPoseAt(p, this.simTime)
            : { x: p.x, y: p.y, z: p.z, rotY: p.rotY ?? 0 };
        const [lx, lz] = worldToLocal(tx, tz, pose.x, pose.z, pose.rotY);
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

    this.tmpVecB.set(
      lookTarget.x + offX * safeDist,
      lookTarget.y + offY * safeDist,
      lookTarget.z + offZ * safeDist
    );

    this.camPos.lerp(this.tmpVecB, 1 - Math.exp(-13 * dt));
    this.camLook.lerp(lookTarget, 1 - Math.exp(-16 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Direct DOM HUD Updates (zero React setState per frame!)
    const h = this.hudRefs;
    if (h.altitudeEl) h.altitudeEl.textContent = `${Math.round(alt)}m`;
    if (h.distToMasterEl) {
      h.distToMasterEl.textContent = `المسافة إلى المالك: ${Math.max(0, Math.round(1000 - alt))}m`;
    }
    if (h.altitudeBarEl) {
      h.altitudeBarEl.style.width = `${Math.min(100, (alt / 1000) * 100).toFixed(1)}%`;
    }
    if (h.timerEl) h.timerEl.textContent = formatTime(this.runElapsed);
    if (h.biomeEl) h.biomeEl.textContent = getBiomeInfo(alt).nameAr;
    if (h.dashRingCircleEl) {
      const readyRatio = 1 - this.dashCooldown / DASH_COOLDOWN;
      h.dashRingCircleEl.style.strokeDashoffset = `${163.36 * (1 - readyRatio)}`;
    }
    if (h.dashBtnEl && h.dashLabelEl) {
      const ready = this.dashCooldown <= 0;
      h.dashBtnEl.style.opacity = ready ? '1' : '0.62';
      h.dashLabelEl.textContent = ready ? 'اندفاع' : `${this.dashCooldown.toFixed(1)}s`;
    }
    if (h.ledgeBannerEl) {
      h.ledgeBannerEl.style.opacity = this.ledgeGrabTimer > 0 ? '1' : '0';
    }
    if (h.fallCamBannerEl && h.fallCamDistEl) {
      h.fallCamBannerEl.style.opacity = isViralFall ? '1' : '0';
      if (isViralFall) {
        h.fallCamDistEl.textContent = `سقوط في الهاوية: -${Math.round(fallDist)}م!`;
      }
    }
  }

  private updateSkyAndFog(alt: number): void {
    let idx = 0;
    let frac = 0;
    if (alt < 250) {
      idx = 0;
      frac = THREE.MathUtils.clamp(alt / 250, 0, 1);
    } else if (alt < 500) {
      idx = 1;
      frac = THREE.MathUtils.clamp((alt - 250) / 250, 0, 1);
    } else {
      idx = 2;
      frac = THREE.MathUtils.clamp((alt - 500) / 280, 0, 1);
    }

    this.tmpSky.copy(REALM_SKY[idx]).lerp(REALM_SKY[idx + 1], frac);
    this.scene.background = this.tmpSky;

    this.tmpFog.copy(REALM_FOG[idx]).lerp(REALM_FOG[idx + 1], frac);
    this.fog.color.copy(this.tmpFog);
    this.fog.near = this.drawDist * 0.32;
    this.fog.far = this.drawDist;
  }

  public dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer.dispose();
  }
}
