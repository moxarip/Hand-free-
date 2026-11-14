import * as THREE from 'three';
import {
  BiomeId,
  CheckpointDef,
  PlatformDef,
  PlatformKind,
  SoulAnchorDef,
  SurfaceType,
} from '../types/game';
import { getProceduralTextures } from './textures';

export interface CourseData {
  platforms: PlatformDef[];
  checkpoints: CheckpointDef[];
  soulAnchors: SoulAnchorDef[];
  masterWristWorldPos: THREE.Vector3;
}

export interface PlatformPose {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface WorldVisuals {
  collisionGroup: THREE.Group;
  ambientGroup: THREE.Group;
  dynamicMeshes: Map<number, THREE.Group>;
  anchorMeshes: Map<number, THREE.Group>;
  checkpointFlames: Map<number, THREE.Mesh>;
  orbitRingsGroup: THREE.Group;
  confettiMesh: THREE.InstancedMesh;
  updateDynamicWorld: (
    simTime: number,
    playerAlt: number,
    targetAnchorId: number | null,
    activeCheckpointIdx: number,
    isVictory: boolean,
    victoryElapsed: number
  ) => void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getBiomeInfo(y: number): { id: BiomeId; nameAr: string } {
  if (y < 250) return { id: 1, nameAr: 'هاوية الرماد والسيوف العملاقة' };
  if (y < 500) return { id: 2, nameAr: 'أطلال المعبد المعلق' };
  if (y < 750) return { id: 3, nameAr: 'قمم البلورات الطيفية' };
  return { id: 4, nameAr: 'عرش الخلود ولقاء المالك' };
}

export function getSurfaceType(kind: PlatformKind): SurfaceType {
  if (kind === 'crystal') return 'crystal';
  if (kind === 'obsidian' || kind === 'sword') return 'obsidian';
  if (kind === 'astral_disc' || kind === 'throne' || kind === 'rune_pad') return 'gold';
  return 'stone';
}

export function getPlatformPoseAt(p: PlatformDef, timeSec: number): PlatformPose {
  let x = p.x;
  let y = p.y;
  let z = p.z;
  let rotY = p.rotY ?? 0;

  if (p.kind === 'elevator' && p.moveAmp && p.moveSpeed) {
    const offset = Math.sin(timeSec * p.moveSpeed + (p.movePhase ?? 0)) * p.moveAmp;
    if (p.moveAxis === 'x') x += offset;
    else if (p.moveAxis === 'y') y += offset;
    else if (p.moveAxis === 'z') z += offset;
  } else if (
    p.kind === 'pendulum' &&
    p.pendulumPivotX !== undefined &&
    p.pendulumPivotY !== undefined &&
    p.pendulumPivotZ !== undefined &&
    p.pendulumLen !== undefined &&
    p.pendulumSpeed !== undefined &&
    p.pendulumMaxAngle !== undefined
  ) {
    const theta =
      Math.sin(timeSec * p.pendulumSpeed + (p.pendulumPhase ?? 0)) * p.pendulumMaxAngle;
    x = p.pendulumPivotX + Math.sin(theta) * p.pendulumLen;
    y = p.pendulumPivotY - Math.cos(theta) * p.pendulumLen;
    z = p.pendulumPivotZ;
  } else if (
    p.kind === 'astral_disc' &&
    p.orbitCenterX !== undefined &&
    p.orbitCenterZ !== undefined &&
    p.orbitRadius !== undefined &&
    p.orbitSpeed !== undefined
  ) {
    const ang = timeSec * p.orbitSpeed + (p.orbitPhase ?? 0);
    x = p.orbitCenterX + Math.cos(ang) * p.orbitRadius;
    z = p.orbitCenterZ + Math.sin(ang) * p.orbitRadius;
    rotY = -ang;
  }

  return { x, y, z, rotY };
}

let cachedCourse: CourseData | null = null;

export function getCourseData(): CourseData {
  if (cachedCourse) return cachedCourse;

  const rand = mulberry32(991144);
  const platforms: PlatformDef[] = [];
  const checkpoints: CheckpointDef[] = [];
  const soulAnchors: SoulAnchorDef[] = [];

  let nextId = 1;
  let nextAnchorId = 1;
  const addPlatform = (p: Omit<PlatformDef, 'id'>): PlatformDef => {
    const item: PlatformDef = { ...p, id: nextId++ };
    platforms.push(item);
    return item;
  };

  // Starting Ash Abyss Shrine Pedestal at 0m
  addPlatform({
    x: 0,
    y: -0.6,
    z: 0,
    w: 11.5,
    h: 1.2,
    d: 11.5,
    kind: 'shrine',
    biome: 1,
    colorHex: '#1c1917',
  });

  const cpAltitudes = [150, 300, 450, 600, 750, 900];
  let nextCpIdx = 0;

  let curX = 0;
  let curY = 0;
  let curZ = 0;
  let spiralAngle = 0;
  let stepCount = 0;

  while (curY < 992) {
    stepCount++;
    const biome: BiomeId = curY < 250 ? 1 : curY < 500 ? 2 : curY < 750 ? 3 : 4;

    // 150m Soul Brazier Checkpoints
    const targetCpAlt = nextCpIdx < cpAltitudes.length ? cpAltitudes[nextCpIdx] : null;
    if (targetCpAlt !== null && curY >= targetCpAlt - 3.2) {
      spiralAngle += 0.42;
      const prev = platforms[platforms.length - 1];
      curX = Math.cos(spiralAngle) * 7.5;
      curZ = Math.sin(spiralAngle) * 7.5;
      const dx = curX - prev.x;
      const dz = curZ - prev.z;
      const hd = Math.hypot(dx, dz) || 1;
      if (hd > 4.6) {
        curX = prev.x + (dx / hd) * 4.6;
        curZ = prev.z + (dz / hd) * 4.6;
      }
      curY = targetCpAlt;

      addPlatform({
        x: curX,
        y: curY - 0.5,
        z: curZ,
        w: 7.0,
        h: 1.0,
        d: 7.0,
        kind: 'shrine',
        biome,
        colorHex: '#1e1b2e',
        checkpointIndex: nextCpIdx,
      });

      checkpoints.push({
        index: nextCpIdx,
        altitude: targetCpAlt,
        x: curX,
        y: curY,
        z: curZ,
      });
      nextCpIdx++;
      continue;
    }

    const isRunePad = stepCount % 9 === 0 && curY < 965;
    const isPendulum = biome === 2 && stepCount % 7 === 0 && curY < 485;
    const isGrappleChasm =
      biome >= 2 && stepCount % 8 === 0 && curY < 965 && !isRunePad && !isPendulum;

    if (isGrappleChasm) {
      spiralAngle += 0.52;
      const prev = platforms[platforms.length - 1];
      const gapHoriz = 10.6;
      const nextX = prev.x + Math.cos(spiralAngle) * gapHoriz;
      const nextZ = prev.z + Math.sin(spiralAngle) * gapHoriz;
      const nextY = curY + 5.2;

      soulAnchors.push({
        id: nextAnchorId++,
        x: (prev.x + nextX) * 0.5,
        y: curY + 7.4,
        z: (prev.z + nextZ) * 0.5,
        biome,
      });

      curX = nextX;
      curY = nextY;
      curZ = nextZ;

      addPlatform({
        x: curX,
        y: curY - 0.5,
        z: curZ,
        w: 6.2,
        h: 1.0,
        d: 6.2,
        kind: biome === 2 ? 'pillar' : biome === 3 ? 'crystal' : 'astral_disc',
        biome,
        colorHex: biome === 2 ? '#64748b' : biome === 3 ? '#22d3ee' : '#f59e0b',
      });
      continue;
    }

    if (isPendulum) {
      spiralAngle += 0.45;
      const prev = platforms[platforms.length - 1];
      const px = prev.x + Math.cos(spiralAngle) * 4.5;
      const pz = prev.z + Math.sin(spiralAngle) * 4.5;
      const py = curY + 2.4;

      addPlatform({
        x: px,
        y: py,
        z: pz,
        w: 4.4,
        h: 0.85,
        d: 4.4,
        kind: 'pendulum',
        biome: 2,
        colorHex: '#f59e0b',
        pendulumPivotX: px,
        pendulumPivotY: py + 6.5,
        pendulumPivotZ: pz,
        pendulumLen: 6.5,
        pendulumSpeed: 1.35,
        pendulumMaxAngle: 0.45,
        pendulumPhase: rand() * Math.PI * 2,
      });

      spiralAngle += 0.45;
      curX = px + Math.cos(spiralAngle) * 4.4;
      curZ = pz + Math.sin(spiralAngle) * 4.4;
      curY = py + 2.6;

      addPlatform({
        x: curX,
        y: curY - 0.5,
        z: curZ,
        w: 5.2,
        h: 1.0,
        d: 5.2,
        kind: 'pillar',
        biome: 2,
        colorHex: '#475569',
      });
      continue;
    }

    spiralAngle += 0.34 + rand() * 0.16;
    const radiusPull = 8.5 + Math.sin(stepCount * 0.35) * 3.5;
    const targetX = Math.cos(spiralAngle) * radiusPull;
    const targetZ = Math.sin(spiralAngle) * radiusPull;

    const horizStep = isRunePad ? 3.8 : 3.85 + rand() * 1.35;
    const dx = targetX - curX;
    const dz = targetZ - curZ;
    const dist = Math.hypot(dx, dz) || 1;
    curX += (dx / dist) * horizStep;
    curZ += (dz / dist) * horizStep;

    const dy = biome === 4 ? 2.75 + rand() * 1.0 : 2.35 + rand() * 0.8;
    curY += dy;

    if (isRunePad) {
      addPlatform({
        x: curX,
        y: curY - 0.35,
        z: curZ,
        w: 4.4,
        h: 0.7,
        d: 4.4,
        kind: 'rune_pad',
        biome,
        colorHex: '#f59e0b',
        bounceVel: biome === 4 ? 26.5 : 31.0,
      });

      spiralAngle += 0.32;
      curX += Math.cos(spiralAngle) * 3.2;
      curZ += Math.sin(spiralAngle) * 3.2;
      curY += 11.5;

      addPlatform({
        x: curX,
        y: curY - 0.5,
        z: curZ,
        w: 6.0,
        h: 1.0,
        d: 6.0,
        kind:
          biome === 1
            ? 'obsidian'
            : biome === 2
              ? 'pillar'
              : biome === 3
                ? 'crystal'
                : 'astral_disc',
        biome,
        colorHex:
          biome === 1
            ? '#1e1b2e'
            : biome === 2
              ? '#475569'
              : biome === 3
                ? '#22d3ee'
                : '#fbbf24',
        rotY: rand() * Math.PI,
      });
      continue;
    }

    let kind: PlatformKind = 'obsidian';
    let w = 4.2;
    let h = 1.1;
    let d = 4.2;
    let colorHex = '#1c1917';
    let moveAxis: 'x' | 'y' | 'z' | undefined;
    let moveAmp: number | undefined;
    let moveSpeed: number | undefined;
    let movePhase: number | undefined;
    let orbitCenterX: number | undefined;
    let orbitCenterZ: number | undefined;
    let orbitRadius: number | undefined;
    let orbitSpeed: number | undefined;
    let orbitPhase: number | undefined;
    let bounceVel: number | undefined;

    if (biome === 1) {
      const r = rand();
      if (r < 0.58) {
        kind = 'obsidian';
        w = 3.8 + rand() * 1.3;
        h = 1.4;
        d = 4.2 + rand() * 1.4;
        colorHex = '#1c1917';
      } else {
        // Colossal ancient cursed sword bridge!
        kind = 'sword';
        w = 2.1;
        h = 0.55;
        d = 7.0;
        colorHex = '#64748b';
      }
    } else if (biome === 2) {
      const r = rand();
      if (r < 0.65) {
        kind = 'pillar';
        w = 3.6 + rand() * 1.3;
        h = 1.6;
        d = 3.6 + rand() * 1.3;
        colorHex = '#64748b';
      } else {
        kind = 'elevator';
        w = 3.6;
        h = 0.75;
        d = 3.6;
        colorHex = '#a855f7';
        moveAxis = rand() > 0.35 ? 'y' : 'x';
        moveAmp = 2.1;
        moveSpeed = 1.2;
        movePhase = rand() * Math.PI * 2;
      }
    } else if (biome === 3) {
      const r = rand();
      if (r < 0.55) {
        kind = 'crystal';
        w = 3.6;
        h = 0.5;
        d = 5.4;
        colorHex = rand() > 0.5 ? '#22d3ee' : '#a855f7';
      } else if (r < 0.8) {
        kind = 'wind_slab';
        w = 3.8;
        h = 0.7;
        d = 3.8;
        colorHex = '#67e8f9';
        bounceVel = 22.0; // Ascending spirit wind current!
      } else {
        kind = 'elevator';
        w = 3.4;
        h = 0.65;
        d = 3.4;
        colorHex = '#38bdf8';
        moveAxis = 'x';
        moveAmp = 2.4;
        moveSpeed = 1.3;
        movePhase = rand() * Math.PI * 2;
      }
    } else {
      const r = rand();
      if (r < 0.68) {
        kind = 'astral_disc';
        w = 4.2;
        h = 0.8;
        d = 4.2;
        colorHex = '#f59e0b';
      } else {
        kind = 'astral_disc';
        w = 3.8;
        h = 0.75;
        d = 3.8;
        colorHex = '#fde047';
        orbitCenterX = curX;
        orbitCenterZ = curZ;
        orbitRadius = 2.6;
        orbitSpeed = 0.75;
        orbitPhase = rand() * Math.PI * 2;
      }
    }

    addPlatform({
      x: curX,
      y: curY - h * 0.5,
      z: curZ,
      w,
      h,
      d,
      kind,
      biome,
      colorHex,
      rotY: kind === 'sword' || kind === 'crystal' ? spiralAngle + Math.PI * 0.5 : 0,
      moveAxis,
      moveAmp,
      moveSpeed,
      movePhase,
      orbitCenterX,
      orbitCenterZ,
      orbitRadius,
      orbitSpeed,
      orbitPhase,
      bounceVel,
    });
  }

  // Final Platform at 1000m: Throne of Eternity!
  const last = platforms[platforms.length - 1];
  const throneX = last.x * 0.35;
  const throneZ = last.z * 0.35;
  addPlatform({
    x: throneX,
    y: 999.2,
    z: throneZ,
    w: 14,
    h: 1.6,
    d: 14,
    kind: 'throne',
    biome: 4,
    colorHex: '#fbbf24',
  });

  // Exact world position of the Immortal Master's missing right wrist
  const masterWristWorldPos = new THREE.Vector3(throneX - 1.35, 1002.8, throneZ - 2.1);

  cachedCourse = { platforms, checkpoints, soulAnchors, masterWristWorldPos };
  return cachedCourse;
}

export function buildWorldVisuals(
  scene: THREE.Scene,
  course: CourseData,
  enableShadows: boolean,
  highParticles: boolean
): WorldVisuals {
  const textures = getProceduralTextures();
  const collisionGroup = new THREE.Group();
  const ambientGroup = new THREE.Group();
  scene.add(collisionGroup);
  scene.add(ambientGroup);

  const dynamicMeshes = new Map<number, THREE.Group>();
  const anchorMeshes = new Map<number, THREE.Group>();
  const checkpointFlames = new Map<number, THREE.Mesh>();

  // Partition static platforms by visual batch
  const obsidianList: PlatformDef[] = [];
  const swordList: PlatformDef[] = [];
  const runePadList: PlatformDef[] = [];
  const pillarList: PlatformDef[] = [];
  const crystalList: PlatformDef[] = [];
  const windSlabList: PlatformDef[] = [];
  const shrineList: PlatformDef[] = [];
  const staticDiscList: PlatformDef[] = [];
  const dynamicList: PlatformDef[] = [];
  let thronePlat: PlatformDef | null = null;

  for (const p of course.platforms) {
    if (p.kind === 'elevator' || p.kind === 'pendulum' || (p.kind === 'astral_disc' && p.orbitRadius)) {
      dynamicList.push(p);
    } else if (p.kind === 'throne') thronePlat = p;
    else if (p.kind === 'obsidian') obsidianList.push(p);
    else if (p.kind === 'sword') swordList.push(p);
    else if (p.kind === 'rune_pad') runePadList.push(p);
    else if (p.kind === 'pillar') pillarList.push(p);
    else if (p.kind === 'crystal') crystalList.push(p);
    else if (p.kind === 'wind_slab') windSlabList.push(p);
    else if (p.kind === 'shrine') shrineList.push(p);
    else if (p.kind === 'astral_disc') staticDiscList.push(p);
  }

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  const buildBatch = (
    list: PlatformDef[],
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    useColor = true
  ) => {
    if (list.length === 0) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.frustumCulled = false;
    im.receiveShadow = true;
    im.castShadow = enableShadows;
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rotY ?? 0, 0);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (useColor) {
        col.set(p.colorHex);
        im.setColorAt(i, col);
      }
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    collisionGroup.add(im);
  };

  buildBatch(
    obsidianList,
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ map: textures.carvedObsidian, roughness: 0.45, metalness: 0.4 })
  );
  buildBatch(
    swordList,
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      map: textures.cursedSwordSteel,
      roughness: 0.28,
      metalness: 0.85,
      emissive: '#f59e0b',
      emissiveIntensity: 0.14,
    }),
    false
  );
  // Sword hilts/crossguards on colossal blade bridges
  if (swordList.length > 0) {
    const hiltIm = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ map: textures.ancientGoldRune, metalness: 0.85, roughness: 0.25 }),
      swordList.length
    );
    hiltIm.frustumCulled = false;
    swordList.forEach((p, i) => {
      const ang = p.rotY ?? 0;
      dummy.position.set(
        p.x - Math.sin(ang) * (p.d * 0.46),
        p.y + 0.35,
        p.z - Math.cos(ang) * (p.d * 0.46)
      );
      dummy.rotation.set(0, ang, 0);
      dummy.scale.set(p.w * 1.9, 0.55, 0.45);
      dummy.updateMatrix();
      hiltIm.setMatrixAt(i, dummy.matrix);
    });
    hiltIm.instanceMatrix.needsUpdate = true;
    ambientGroup.add(hiltIm);
  }

  buildBatch(
    runePadList,
    new THREE.CylinderGeometry(0.5, 0.54, 1, 18),
    new THREE.MeshStandardMaterial({
      map: textures.runeJumpPad,
      emissive: '#f59e0b',
      emissiveIntensity: 0.38,
      roughness: 0.3,
    }),
    false
  );
  buildBatch(
    pillarList,
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ map: textures.crackedStone, roughness: 0.88, metalness: 0.08 })
  );
  buildBatch(
    crystalList,
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      map: textures.astralCrystal,
      transparent: true,
      opacity: 0.76,
      roughness: 0.1,
      metalness: 0.2,
      emissive: '#06b6d4',
      emissiveIntensity: 0.28,
    })
  );
  buildBatch(
    windSlabList,
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      map: textures.astralCrystal,
      emissive: '#22d3ee',
      emissiveIntensity: 0.55,
      roughness: 0.25,
    }),
    false
  );
  buildBatch(
    shrineList,
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ map: textures.ancientGoldRune, roughness: 0.38, metalness: 0.65 }),
    false
  );
  buildBatch(
    staticDiscList,
    new THREE.CylinderGeometry(0.5, 0.52, 1, 18),
    new THREE.MeshStandardMaterial({ map: textures.ancientGoldRune, roughness: 0.25, metalness: 0.85 }),
    false
  );

  // Dynamic Platforms (Elevators, Swinging Pendulums, Orbiting Astral Discs)
  for (const p of dynamicList) {
    const grp = new THREE.Group();
    grp.position.set(p.x, p.y, p.z);
    const mat = new THREE.MeshStandardMaterial({
      map: p.kind === 'pendulum' ? textures.ancientGoldRune : textures.crackedStone,
      color: p.colorHex,
      emissive: p.kind === 'pendulum' ? '#f59e0b' : '#6366f1',
      emissiveIntensity: 0.25,
      metalness: 0.6,
      roughness: 0.32,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
    mesh.receiveShadow = true;
    grp.add(mesh);

    if (p.kind === 'pendulum' && p.pendulumLen) {
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, p.pendulumLen, 6),
        new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.85, roughness: 0.25 })
      );
      chain.position.y = p.pendulumLen * 0.5;
      grp.add(chain);
    }

    collisionGroup.add(grp);
    dynamicMeshes.set(p.id, grp);
  }

  // Soul-Anchor Crystals for Grappling
  for (const anchor of course.soulAnchors) {
    const grp = new THREE.Group();
    grp.position.set(anchor.x, anchor.y, anchor.z);
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.6, 0),
      new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#f59e0b',
        emissiveIntensity: 1.7,
        metalness: 0.5,
        roughness: 0.15,
      })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.08, 8, 22),
      new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = Math.PI / 2;
    grp.add(crystal);
    grp.add(ring);
    ambientGroup.add(grp);
    anchorMeshes.set(anchor.id, grp);
  }

  // Soul Brazier Checkpoints every 150m
  for (const cp of course.checkpoints) {
    const grp = new THREE.Group();
    grp.position.set(cp.x + 2.3, cp.y, cp.z - 2.3);
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.28, 1.1, 10),
      new THREE.MeshStandardMaterial({ map: textures.ancientGoldRune, metalness: 0.8, roughness: 0.3 })
    );
    bowl.position.y = 0.55;
    grp.add(bowl);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 1.15, 8),
      new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.9 })
    );
    flame.position.y = 1.55;
    grp.add(flame);

    ambientGroup.add(grp);
    checkpointFlames.set(cp.index, flame);
  }

  // Throne of Eternity & Seated Immortal Master (Missing Right Hand!) at 1000m
  if (thronePlat) {
    const tx = thronePlat.x;
    const ty = thronePlat.y;
    const tz = thronePlat.z;

    const throneFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(7.0, 7.6, thronePlat.h, 24),
      new THREE.MeshStandardMaterial({
        map: textures.throneMarble,
        color: '#fef3c7',
        metalness: 0.35,
        roughness: 0.22,
      })
    );
    throneFloor.position.set(tx, ty, tz);
    throneFloor.receiveShadow = true;
    collisionGroup.add(throneFloor);

    // Monumental Throne & Immortal Master Figure
    const masterGroup = new THREE.Group();
    masterGroup.position.set(tx, ty + 0.8, tz - 2.8);
    ambientGroup.add(masterGroup);

    const throneGoldMat = new THREE.MeshStandardMaterial({
      map: textures.ancientGoldRune,
      color: '#fbbf24',
      metalness: 0.88,
      roughness: 0.2,
    });
    const robeMat = new THREE.MeshStandardMaterial({
      color: '#1e1b4b',
      roughness: 0.65,
      metalness: 0.25,
    });
    const masterAuraMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0.85,
    });

    // Throne Seat & High Backrest
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 2.6), throneGoldMat);
    seat.position.set(0, 0.7, 0);
    masterGroup.add(seat);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(3.8, 5.8, 0.7), throneGoldMat);
    backrest.position.set(0, 3.2, -1.05);
    masterGroup.add(backrest);

    // Seated Immortal Master Torso, Head & Crown
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.35, 2.7, 10), robeMat);
    torso.position.set(0, 2.55, 0.15);
    masterGroup.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.65, 14, 14), throneGoldMat);
    head.position.set(0, 4.35, 0.25);
    masterGroup.add(head);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 10, 28), masterAuraMat);
    halo.position.set(0, 4.35, -0.35);
    masterGroup.add(halo);

    // Left Arm (Intact)
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 1.75, 8), robeMat);
    leftArm.position.set(1.25, 2.35, 0.5);
    leftArm.rotation.z = 0.25;
    leftArm.rotation.x = -0.35;
    masterGroup.add(leftArm);

    // Right Forearm reaching forward — MISSING ITS RIGHT HAND, glowing golden socket waiting!
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 1.55, 8), robeMat);
    rightArm.position.set(-1.35, 2.3, 0.45);
    rightArm.rotation.x = 0.95;
    rightArm.rotation.z = -0.15;
    masterGroup.add(rightArm);

    const socketBeacon = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.055, 8, 20),
      masterAuraMat
    );
    socketBeacon.position.set(-1.35, 2.0, 0.7);
    masterGroup.add(socketBeacon);
  }

  // Orbiting Giant Golden Rings in Realm 4
  const orbitRingsGroup = new THREE.Group();
  orbitRingsGroup.position.set(0, 880, 0);
  ambientGroup.add(orbitRingsGroup);
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(42 + r * 14, 0.45, 8, 48),
      new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.4 })
    );
    ring.rotation.set(0.4 + r * 0.5, r * 0.6, 0.2);
    orbitRingsGroup.add(ring);
  }

  // Starry Astral Cosmos + Floating Ash Embers
  const starCount = highParticles ? 300 : 140;
  const starIm = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({ color: '#fef9c3' }),
    starCount
  );
  starIm.frustumCulled = false;
  for (let i = 0; i < starCount; i++) {
    const ang = i * 2.39996;
    const rad = 32 + (i % 9) * 13;
    const sy = 560 + (i / starCount) * 580;
    dummy.position.set(Math.cos(ang) * rad, sy, Math.sin(ang) * rad);
    dummy.rotation.set(i, i * 0.5, 0);
    dummy.scale.setScalar(0.16 + (i % 4) * 0.14);
    dummy.updateMatrix();
    starIm.setMatrixAt(i, dummy.matrix);
  }
  starIm.instanceMatrix.needsUpdate = true;
  ambientGroup.add(starIm);

  // Victory Confetti / Golden Essence Burst Pool
  const confettiCount = 90;
  const confettiMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
    confettiCount
  );
  confettiMesh.frustumCulled = false;
  confettiMesh.visible = false;
  ambientGroup.add(confettiMesh);

  const confettiSeeds = Array.from({ length: confettiCount }, (_, i) => ({
    angle: (i / confettiCount) * Math.PI * 2,
    speed: 2.2 + (i % 5) * 1.2,
    ySpeed: 5 + (i % 4) * 2.4,
    color: ['#fbbf24', '#fde047', '#22d3ee', '#f97316', '#ffffff'][i % 5],
  }));

  const tmpColor = new THREE.Color();

  const updateDynamicWorld = (
    simTime: number,
    _playerAlt: number,
    targetAnchorId: number | null,
    activeCheckpointIdx: number,
    isVictory: boolean,
    victoryElapsed: number
  ) => {
    for (const p of dynamicList) {
      const grp = dynamicMeshes.get(p.id);
      if (!grp) continue;
      const pose = getPlatformPoseAt(p, simTime);
      grp.position.set(pose.x, pose.y, pose.z);
      grp.rotation.y = pose.rotY;
    }

    for (const anchor of course.soulAnchors) {
      const grp = anchorMeshes.get(anchor.id);
      if (!grp) continue;
      grp.position.y = anchor.y + Math.sin(simTime * 2.5 + anchor.id) * 0.28;
      grp.rotation.y = simTime * 1.7;
      const targeted = anchor.id === targetAnchorId;
      grp.scale.setScalar(targeted ? 1.35 + Math.sin(simTime * 11) * 0.12 : 1.0);
    }

    for (const cp of course.checkpoints) {
      const flame = checkpointFlames.get(cp.index);
      if (!flame) continue;
      const unlocked = cp.index <= activeCheckpointIdx;
      (flame.material as THREE.MeshBasicMaterial).color.set(unlocked ? '#10b981' : '#f59e0b');
      flame.scale.setScalar(unlocked ? 1.3 + Math.sin(simTime * 12) * 0.15 : 0.95);
    }

    orbitRingsGroup.rotation.y = simTime * 0.08;

    confettiMesh.visible = isVictory;
    if (isVictory && thronePlat) {
      for (let i = 0; i < confettiSeeds.length; i++) {
        const seed = confettiSeeds[i];
        const loopT = (victoryElapsed * 0.9 + i * 0.03) % 2.4;
        const r = seed.speed * loopT;
        const cy = thronePlat.y + 1.8 + seed.ySpeed * loopT - 4.5 * loopT * loopT;
        dummy.position.set(
          thronePlat.x + Math.cos(seed.angle) * r,
          Math.max(thronePlat.y + 1.0, cy),
          thronePlat.z + Math.sin(seed.angle) * r
        );
        dummy.rotation.set(loopT * 6, loopT * 4, i);
        dummy.scale.set(0.24, 0.14, 0.04);
        dummy.updateMatrix();
        confettiMesh.setMatrixAt(i, dummy.matrix);
        tmpColor.set(seed.color);
        confettiMesh.setColorAt(i, tmpColor);
      }
      confettiMesh.instanceMatrix.needsUpdate = true;
      if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
    }
  };

  return {
    collisionGroup,
    ambientGroup,
    dynamicMeshes,
    anchorMeshes,
    checkpointFlames,
    orbitRingsGroup,
    confettiMesh,
    updateDynamicWorld,
  };
}
