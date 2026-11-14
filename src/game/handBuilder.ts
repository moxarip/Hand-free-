import * as THREE from 'three';
import { RelicSkinId } from '../types/game';
import { RELIC_SKINS } from './storage';
import { getProceduralTextures } from './textures';

export interface HandAnimState {
  speedHoriz: number;
  vy: number;
  grounded: boolean;
  isDashing: boolean;
  isGrappling: boolean;
  isLedgeGrabbing: boolean;
  jumpAnimTimer: number;
  isMenuIdle: boolean;
  facingYaw: number;
  energyRatio: number; // 0..1
}

export interface ImmortalHandRig {
  root: THREE.Group;
  visualGroup: THREE.Group;
  palmGroup: THREE.Group;
  updateSkin: (skinId: RelicSkinId) => void;
  animate: (state: HandAnimState, dt: number, elapsed: number) => void;
}

interface FingerSpec {
  pos: [number, number, number];
  rotY: number;
  spreadZ: number;
  lengths: [number, number, number];
  radius: number;
  phaseOffset: number;
}

const FINGER_SPECS: FingerSpec[] = [
  {
    pos: [-0.33, -0.02, 0.14],
    rotY: -0.78,
    spreadZ: 0.28,
    lengths: [0.22, 0.19, 0.16],
    radius: 0.068,
    phaseOffset: 0.0,
  },
  {
    pos: [-0.21, 0.04, 0.38],
    rotY: -0.14,
    spreadZ: 0.08,
    lengths: [0.28, 0.22, 0.17],
    radius: 0.06,
    phaseOffset: 1.25,
  },
  {
    pos: [-0.04, 0.05, 0.41],
    rotY: 0.0,
    spreadZ: 0.0,
    lengths: [0.31, 0.24, 0.18],
    radius: 0.063,
    phaseOffset: 2.5,
  },
  {
    pos: [0.13, 0.04, 0.38],
    rotY: 0.12,
    spreadZ: -0.06,
    lengths: [0.28, 0.22, 0.17],
    radius: 0.058,
    phaseOffset: 3.75,
  },
  {
    pos: [0.28, 0.02, 0.32],
    rotY: 0.26,
    spreadZ: -0.14,
    lengths: [0.23, 0.18, 0.15],
    radius: 0.05,
    phaseOffset: 5.0,
  },
];

const GAUGE_FULL = new THREE.Color('#22d3ee');
const GAUGE_MID = new THREE.Color('#f59e0b');
const GAUGE_LOW = new THREE.Color('#ef4444');

export function buildImmortalHand(initialSkin: RelicSkinId): ImmortalHandRig {
  const textures = getProceduralTextures();
  const root = new THREE.Group();
  const visualGroup = new THREE.Group();
  const palmGroup = new THREE.Group();
  palmGroup.position.set(0, 0.54, 0);
  visualGroup.add(palmGroup);
  root.add(visualGroup);

  const skin = RELIC_SKINS[initialSkin];

  const armorMat = new THREE.MeshStandardMaterial({
    color: skin.armorHex,
    metalness: skin.metalness,
    roughness: skin.roughness,
    map: textures.carvedObsidian,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: skin.trimHex,
    metalness: 0.9,
    roughness: 0.2,
  });

  const veinMat = new THREE.MeshStandardMaterial({
    color: skin.veinHex,
    emissive: skin.veinHex,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const gaugeMat = new THREE.MeshStandardMaterial({
    color: '#22d3ee',
    emissive: '#22d3ee',
    emissiveIntensity: 2.5,
    roughness: 0.15,
  });

  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: skin.flameCoreHex,
    transparent: true,
    opacity: 0.94,
  });

  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: skin.flameOuterHex,
    transparent: true,
    opacity: 0.68,
  });

  // Main Gauntlet Palm
  const palmCore = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.68), armorMat);
  palmCore.castShadow = true;
  palmCore.receiveShadow = true;
  palmGroup.add(palmCore);

  // Dorsal beveled armor plate
  const dorsalPlate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.52), trimMat);
  dorsalPlate.position.set(0, 0.11, 0.02);
  dorsalPlate.castShadow = true;
  palmGroup.add(dorsalPlate);

  // Glowing golden immortal vein channels on palm
  const veinLeft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.48), veinMat);
  veinLeft.position.set(-0.16, 0.145, 0.05);
  palmGroup.add(veinLeft);

  const veinRight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.48), veinMat);
  veinRight.position.set(0.16, 0.145, 0.05);
  palmGroup.add(veinRight);

  // Back-of-Hand Soul Energy Gauge
  const gaugeSlot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.028, 0.09), armorMat);
  gaugeSlot.position.set(0, 0.15, -0.1);
  palmGroup.add(gaugeSlot);

  const ledBarMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.022, 0.056), gaugeMat);
  ledBarMesh.position.set(0, 0.16, -0.1);
  palmGroup.add(ledBarMesh);

  // Knuckle Crest Bridge
  const knuckleBridge = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.14, 0.12), trimMat);
  knuckleBridge.position.set(0, 0.04, 0.34);
  knuckleBridge.castShadow = true;
  palmGroup.add(knuckleBridge);

  // Severed Enchanted Wrist Stump + Soul-Flame Emitter
  const wristGroup = new THREE.Group();
  wristGroup.position.set(0, 0.02, -0.45);
  wristGroup.rotation.x = -0.15;
  palmGroup.add(wristGroup);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.34, 12), armorMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.castShadow = true;
  wristGroup.add(cuff);

  const cuffRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.026, 8, 18), trimMat);
  cuffRing.position.z = 0.08;
  wristGroup.add(cuffRing);

  const severedGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.06, 0.16, 10), veinMat);
  severedGlow.rotation.x = Math.PI / 2;
  severedGlow.position.z = -0.18;
  wristGroup.add(severedGlow);

  // Jagged bone/obsidian severed shards around stump
  for (let s = 0; s < 5; s++) {
    const ang = (s / 5) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 5), armorMat);
    shard.rotation.x = -Math.PI / 2;
    shard.position.set(Math.cos(ang) * 0.17, Math.sin(ang) * 0.17, -0.2);
    wristGroup.add(shard);
  }

  // Soul-Flame Propulsion Cones at Severed Wrist
  const wristFlameGroup = new THREE.Group();
  wristFlameGroup.position.set(0, 0, -0.22);
  wristFlameGroup.rotation.x = -Math.PI / 2;
  wristGroup.add(wristFlameGroup);

  const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.72, 12), flameOuterMat);
  outerFlame.position.y = 0.34;
  wristFlameGroup.add(outerFlame);

  const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 10), flameCoreMat);
  innerFlame.position.y = 0.24;
  wristFlameGroup.add(innerFlame);

  // Soul-spark particles trailing from wrist during dash
  const sparkGroup = new THREE.Group();
  wristGroup.add(sparkGroup);
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), flameCoreMat);
    sp.position.set(((i % 2 === 0 ? 1 : -1) * (0.1 + i * 0.03)), (i % 3 - 1) * 0.08, -0.4);
    sparkGroup.add(sp);
  }

  // Build 5 Hierarchical Articulated Fingers (3 joints each)
  const seg0List: THREE.Group[] = [];
  const seg1List: THREE.Group[] = [];
  const seg2List: THREE.Group[] = [];

  for (let i = 0; i < FINGER_SPECS.length; i++) {
    const cfg = FINGER_SPECS[i];
    const base = new THREE.Group();
    base.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    base.rotation.y = cfg.rotY;
    palmGroup.add(base);

    const s0 = new THREE.Group();
    base.add(s0);
    s0.add(new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 1.06, 8, 8), trimMat));
    const bone0 = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.radius * 0.9, cfg.radius, cfg.lengths[0], 8),
      armorMat
    );
    bone0.rotation.x = Math.PI / 2;
    bone0.position.z = cfg.lengths[0] * 0.5;
    bone0.castShadow = true;
    s0.add(bone0);

    const s1 = new THREE.Group();
    s1.position.z = cfg.lengths[0];
    s0.add(s1);
    s1.add(new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 0.92, 8, 8), trimMat));
    const bone1 = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.radius * 0.8, cfg.radius * 0.88, cfg.lengths[1], 8),
      armorMat
    );
    bone1.rotation.x = Math.PI / 2;
    bone1.position.z = cfg.lengths[1] * 0.5;
    bone1.castShadow = true;
    s1.add(bone1);

    const s2 = new THREE.Group();
    s2.position.z = cfg.lengths[1];
    s1.add(s2);
    s2.add(new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 0.82, 8, 8), trimMat));
    const bone2 = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.radius * 0.64, cfg.radius * 0.78, cfg.lengths[2], 8),
      armorMat
    );
    bone2.rotation.x = Math.PI / 2;
    bone2.position.z = cfg.lengths[2] * 0.5;
    bone2.castShadow = true;
    s2.add(bone2);

    const tipEssence = new THREE.Mesh(new THREE.SphereGeometry(cfg.radius * 0.76, 8, 8), veinMat);
    tipEssence.position.set(0, -0.015, cfg.lengths[2]);
    s2.add(tipEssence);

    seg0List.push(s0);
    seg1List.push(s1);
    seg2List.push(s2);
  }

  let crawlPhase = 0;
  const tmpColor = new THREE.Color();

  const updateSkin = (skinId: RelicSkinId) => {
    const next = RELIC_SKINS[skinId];
    armorMat.color.set(next.armorHex);
    armorMat.metalness = next.metalness;
    armorMat.roughness = next.roughness;
    trimMat.color.set(next.trimHex);
    veinMat.color.set(next.veinHex);
    veinMat.emissive.set(next.veinHex);
    flameCoreMat.color.set(next.flameCoreHex);
    flameOuterMat.color.set(next.flameOuterHex);
  };

  const animate = (state: HandAnimState, dt: number, t: number) => {
    visualGroup.rotation.y = state.facingYaw;

    // Update Back-of-Hand Soul Energy Gauge
    const ratio = THREE.MathUtils.clamp(state.energyRatio, 0.05, 1);
    ledBarMesh.scale.x = ratio;
    ledBarMesh.position.x = -(1 - ratio) * 0.19;
    if (ratio >= 0.55) {
      tmpColor.copy(GAUGE_MID).lerp(GAUGE_FULL, (ratio - 0.55) / 0.45);
    } else {
      tmpColor.copy(GAUGE_LOW).lerp(GAUGE_MID, ratio / 0.55);
    }
    gaugeMat.color.copy(tmpColor);
    gaugeMat.emissive.copy(tmpColor);

    const isMoving = state.speedHoriz > 0.4 && state.grounded && !state.isMenuIdle;
    if (isMoving) {
      crawlPhase += dt * (8.5 + state.speedHoriz * 1.15);
    } else {
      crawlPhase += dt * 2.2;
    }

    const panic =
      !state.grounded && !state.isLedgeGrabbing && !state.isGrappling && state.vy < -13;

    let targetPalmY = 0.54;
    let targetPalmPitch = 0.08;
    let targetPalmRoll = 0;

    if (state.isGrappling) {
      targetPalmY = 0.62;
      targetPalmPitch = -0.45;
    } else if (state.isLedgeGrabbing) {
      targetPalmY = 0.42;
      targetPalmPitch = -0.68;
    } else if (panic) {
      targetPalmY = 0.62;
      targetPalmPitch = -0.35 + Math.sin(t * 20) * 0.18;
      targetPalmRoll = Math.cos(t * 23) * 0.22;
    } else if (!state.grounded) {
      targetPalmY = 0.6;
      targetPalmPitch = THREE.MathUtils.clamp(-state.vy * 0.032, -0.45, 0.42);
      targetPalmRoll = Math.sin(t * 6) * 0.06;
    } else if (isMoving) {
      targetPalmY = 0.5 + Math.abs(Math.sin(crawlPhase * 2)) * 0.07;
      targetPalmPitch = 0.14 + Math.sin(crawlPhase * 2) * 0.09;
      targetPalmRoll = Math.cos(crawlPhase) * 0.11;
    } else {
      targetPalmY = 0.54 + Math.sin(t * 2.4) * 0.03;
      targetPalmPitch = 0.06 + Math.sin(t * 1.6) * 0.03;
    }

    const smooth = 1 - Math.exp(-16 * dt);
    palmGroup.position.y = THREE.MathUtils.lerp(palmGroup.position.y, targetPalmY, smooth);
    palmGroup.rotation.x = THREE.MathUtils.lerp(palmGroup.rotation.x, targetPalmPitch, smooth);
    palmGroup.rotation.z = THREE.MathUtils.lerp(palmGroup.rotation.z, targetPalmRoll, smooth);

    for (let i = 0; i < 5; i++) {
      const cfg = FINGER_SPECS[i];
      const s0 = seg0List[i];
      const s1 = seg1List[i];
      const s2 = seg2List[i];

      let j0 = 0.35;
      let j1 = 0.72;
      let j2 = 0.52;
      let splayZ = cfg.spreadZ;

      if (state.isGrappling) {
        j0 = -0.15;
        j1 = 0.25;
        j2 = 0.35;
        splayZ = cfg.spreadZ * 1.5;
      } else if (state.isLedgeGrabbing) {
        j0 = 0.72;
        j1 = 1.15;
        j2 = 0.92;
      } else if (panic) {
        const f = t * 24 + i * 1.37;
        j0 = -0.15 + Math.sin(f) * 0.55;
        j1 = 0.35 + Math.cos(f * 1.1) * 0.55;
        j2 = 0.25 + Math.sin(f * 1.4) * 0.45;
        splayZ = cfg.spreadZ * 1.8 + Math.sin(f) * 0.12;
      } else if (!state.grounded) {
        if (state.jumpAnimTimer > 0.12) {
          j0 = 0.55;
          j1 = 0.9;
          j2 = 0.65;
        } else {
          j0 = -0.18 + Math.sin(t * 7 + i) * 0.08;
          j1 = 0.24 + Math.cos(t * 7 + i) * 0.08;
          j2 = 0.18;
          splayZ = cfg.spreadZ * 1.65;
        }
      } else if (isMoving) {
        const wave = Math.sin(crawlPhase + cfg.phaseOffset);
        const lift = Math.max(0, wave);
        const plant = Math.max(0, -wave);
        j0 = 0.26 - lift * 0.42 + plant * 0.18;
        j1 = 0.68 + lift * 0.22 + plant * 0.16;
        j2 = 0.48 + plant * 0.26 - lift * 0.15;
      } else {
        const tapCycle = (((t * 2.1 - i * 0.22) % 1.4) + 1.4) % 1.4;
        const tapLift = tapCycle < 0.35 ? Math.sin((tapCycle / 0.35) * Math.PI) : 0;
        j0 = 0.28 - tapLift * 0.38;
        j1 = 0.68 + tapLift * 0.18;
        j2 = 0.46 - tapLift * 0.12;
      }

      s0.rotation.x = THREE.MathUtils.lerp(s0.rotation.x, j0, smooth);
      s0.rotation.z = THREE.MathUtils.lerp(s0.rotation.z, splayZ, smooth);
      s1.rotation.x = THREE.MathUtils.lerp(s1.rotation.x, j1, smooth);
      s2.rotation.x = THREE.MathUtils.lerp(s2.rotation.x, j2, smooth);
    }

    const thrust =
      state.isDashing || state.isGrappling
        ? 1.4 + Math.sin(t * 58) * 0.25
        : !state.grounded && state.jumpAnimTimer > 0
          ? 0.65
          : 0.18;
    wristFlameGroup.scale.set(0.75 + thrust * 0.25, thrust, 0.75 + thrust * 0.25);

    const showSparks = state.isDashing || state.isGrappling || state.jumpAnimTimer > 0.04;
    sparkGroup.visible = showSparks;
    if (showSparks) {
      sparkGroup.rotation.z = t * 14;
      for (let s = 0; s < sparkGroup.children.length; s++) {
        const sp = sparkGroup.children[s];
        const age = (t * 5 + s * 0.2) % 1;
        sp.position.z = -0.35 - age * 1.1;
        sp.scale.setScalar(Math.max(0.05, 1 - age));
      }
    }
  };

  return {
    root,
    visualGroup,
    palmGroup,
    updateSkin,
    animate,
  };
}
