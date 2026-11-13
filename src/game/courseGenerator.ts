import {
  BiomeId,
  CheckpointDef,
  GrappleAnchorDef,
  PlatformDef,
  PlatformKind,
  SurfaceMaterialType,
} from '../types/game';

export interface CourseData {
  platforms: PlatformDef[];
  checkpoints: CheckpointDef[];
  grappleAnchors: GrappleAnchorDef[];
}

export interface PlatformPose {
  x: number;
  y: number;
  z: number;
  rotY: number;
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

export function getBiomeAtAltitude(y: number): { id: BiomeId; nameAr: string } {
  if (y < 250) return { id: 1, nameAr: 'ساحة الحاويات والرافعات' };
  if (y < 500) return { id: 2, nameAr: 'الجزر السماوية والتوربينات' };
  if (y < 750) return { id: 3, nameAr: 'جسر السيارات المعلقة والزجاج' };
  return { id: 4, nameAr: 'حدود الفضاء والقمة الذهبية' };
}

export function getSurfaceMaterialType(kind: PlatformKind): SurfaceMaterialType {
  if (kind === 'glass' || kind === 'neon_rail') return 'glass';
  if (kind === 'island' || kind === 'asteroid') return 'stone';
  if (kind === 'plank') return 'wood';
  return 'metal';
}

export function getPlatformPoseAt(p: PlatformDef, timeSec: number): PlatformPose {
  let x = p.x;
  let y = p.y;
  let z = p.z;
  let rotY = p.rotY ?? 0;

  if (p.kind === 'moving' && p.moveAmp && p.moveSpeed) {
    const offset = Math.sin(timeSec * p.moveSpeed + (p.movePhase ?? 0)) * p.moveAmp;
    if (p.moveAxis === 'x') x += offset;
    else if (p.moveAxis === 'y') y += offset;
    else if (p.moveAxis === 'z') z += offset;
  } else if (
    p.kind === 'turbine_blade' &&
    p.rotCenterX !== undefined &&
    p.rotCenterZ !== undefined &&
    p.rotRadius !== undefined &&
    p.rotSpeed !== undefined
  ) {
    const angle = timeSec * p.rotSpeed + (p.rotAngleOffset ?? 0);
    x = p.rotCenterX + Math.cos(angle) * p.rotRadius;
    z = p.rotCenterZ + Math.sin(angle) * p.rotRadius;
    rotY = -angle;
  }

  return { x, y, z, rotY };
}

let cachedCourse: CourseData | null = null;

export function getCourseData(): CourseData {
  if (cachedCourse) return cachedCourse;

  const rand = mulberry32(20261113);
  const platforms: PlatformDef[] = [];
  const checkpoints: CheckpointDef[] = [];
  const grappleAnchors: GrappleAnchorDef[] = [];

  let nextId = 1;
  let nextAnchorId = 1;
  const addPlatform = (p: Omit<PlatformDef, 'id'>): PlatformDef => {
    const item: PlatformDef = { ...p, id: nextId++ };
    platforms.push(item);
    return item;
  };

  // Starting Launchpad at 0m
  addPlatform({
    x: 0,
    y: -0.6,
    z: 0,
    w: 11.5,
    h: 1.2,
    d: 11.5,
    kind: 'launchpad',
    biome: 1,
    colorHex: '#1e293b',
    accentHex: '#f59e0b',
  });

  const checkpointAltitudes = [150, 300, 450, 600, 750, 900];
  let nextCheckpointIdx = 0;

  let curX = 0;
  let curY = 0;
  let curZ = 0;
  let spiralAngle = 0;

  const containerColors = ['#dc2626', '#2563eb', '#d97706', '#0d9488', '#475569'];
  const hypercarColors = ['#ef4444', '#f59e0b', '#06b6d4', '#e2e8f0', '#8b5cf6'];

  let stepCount = 0;
  while (curY < 992) {
    stepCount++;
    const biome: BiomeId =
      curY < 250 ? 1 : curY < 500 ? 2 : curY < 750 ? 3 : 4;

    // Checkpoint every 150m
    const targetCpAlt =
      nextCheckpointIdx < checkpointAltitudes.length
        ? checkpointAltitudes[nextCheckpointIdx]
        : null;

    if (targetCpAlt !== null && curY >= targetCpAlt - 3.2) {
      spiralAngle += 0.42;
      const dist = 4.6;
      curX = Math.cos(spiralAngle) * 7.5;
      curZ = Math.sin(spiralAngle) * 7.5;
      const prev = platforms[platforms.length - 1];
      const dx = curX - prev.x;
      const dz = curZ - prev.z;
      const hd = Math.hypot(dx, dz);
      if (hd > dist) {
        curX = prev.x + (dx / hd) * dist;
        curZ = prev.z + (dz / hd) * dist;
      }
      curY = targetCpAlt;

      addPlatform({
        x: curX,
        y: curY - 0.5,
        z: curZ,
        w: 7.0,
        h: 1.0,
        d: 7.0,
        kind: 'launchpad',
        biome,
        colorHex: '#0f172a',
        accentHex: '#10b981',
        checkpointIndex: nextCheckpointIdx,
      });

      checkpoints.push({
        index: nextCheckpointIdx,
        altitude: targetCpAlt,
        x: curX,
        y: curY,
        z: curZ,
      });

      nextCheckpointIdx++;
      continue;
    }

    const isTrampoline = stepCount % 9 === 0 && curY < 965;
    const isTurbine = biome === 2 && stepCount % 7 === 0 && curY < 485;
    const isGrappleGap = biome >= 2 && stepCount % 8 === 0 && curY < 965 && !isTrampoline && !isTurbine;

    if (isGrappleGap) {
      // Wide aerial gap with Magnetic Drone Anchor!
      spiralAngle += 0.55;
      const prev = platforms[platforms.length - 1];
      const gapHoriz = 10.5;
      const dirX = Math.cos(spiralAngle);
      const dirZ = Math.sin(spiralAngle);
      const nextX = prev.x + dirX * gapHoriz;
      const nextZ = prev.z + dirZ * gapHoriz;
      const nextY = curY + 5.2;

      // Floating Magnetic Drone Anchor above midpoint
      grappleAnchors.push({
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
        kind: biome === 2 ? 'island' : biome === 3 ? 'glass' : 'asteroid',
        biome,
        colorHex: biome === 2 ? '#64748b' : biome === 3 ? '#38bdf8' : '#475569',
      });
      continue;
    }

    if (isTurbine) {
      const hubAngle = spiralAngle + 0.48;
      const prev = platforms[platforms.length - 1];
      const cx = prev.x + Math.cos(hubAngle) * 5.0;
      const cz = prev.z + Math.sin(hubAngle) * 5.0;
      const ty = curY + 2.5;
      const rotSpeed = (rand() > 0.5 ? 1 : -1) * 0.52;

      addPlatform({
        x: cx,
        y: ty - 0.5,
        z: cz,
        w: 4.5,
        h: 1.0,
        d: 4.5,
        kind: 'island',
        biome: 2,
        colorHex: '#334155',
        accentHex: '#38bdf8',
      });

      for (let b = 0; b < 3; b++) {
        addPlatform({
          x: cx,
          y: ty + 1.8,
          z: cz,
          w: 5.2,
          h: 0.55,
          d: 2.3,
          kind: 'turbine_blade',
          biome: 2,
          colorHex: '#f1f5f9',
          accentHex: '#0ea5e9',
          rotCenterX: cx,
          rotCenterZ: cz,
          rotRadius: 4.2,
          rotSpeed,
          rotAngleOffset: (b * Math.PI * 2) / 3,
        });
      }

      spiralAngle += 0.55;
      curX = cx + Math.cos(spiralAngle) * 4.4;
      curZ = cz + Math.sin(spiralAngle) * 4.4;
      curY = ty + 4.3;

      addPlatform({
        x: curX,
        y: curY - 0.45,
        z: curZ,
        w: 5.0,
        h: 0.9,
        d: 5.0,
        kind: 'island',
        biome: 2,
        colorHex: '#64748b',
        accentHex: '#22c55e',
      });
      continue;
    }

    spiralAngle += 0.34 + rand() * 0.16;
    const radiusPull = 8.5 + Math.sin(stepCount * 0.35) * 3.5;
    const targetX = Math.cos(spiralAngle) * radiusPull;
    const targetZ = Math.sin(spiralAngle) * radiusPull;

    const horizStep = isTrampoline ? 3.9 : 3.85 + rand() * 1.4;
    const dx = targetX - curX;
    const dz = targetZ - curZ;
    const dist = Math.hypot(dx, dz) || 1;
    curX += (dx / dist) * horizStep;
    curZ += (dz / dist) * horizStep;

    const dy = biome === 4 ? 2.75 + rand() * 1.05 : 2.35 + rand() * 0.8;
    curY += dy;

    if (isTrampoline) {
      addPlatform({
        x: curX,
        y: curY - 0.35,
        z: curZ,
        w: 4.3,
        h: 0.7,
        d: 4.3,
        kind: 'trampoline',
        biome,
        colorHex: '#f97316',
        accentHex: '#22d3ee',
        bounceVel: biome === 4 ? 26.5 : 31.0,
      });

      spiralAngle += 0.32;
      curX += Math.cos(spiralAngle) * 3.3;
      curZ += Math.sin(spiralAngle) * 3.3;
      curY += 11.5;

      addPlatform({
        x: curX,
        y: curY - 0.5,
        z: curZ,
        w: 5.9,
        h: 1.0,
        d: 5.9,
        kind:
          biome === 1
            ? 'container'
            : biome === 2
              ? 'island'
              : biome === 3
                ? 'glass'
                : 'asteroid',
        biome,
        colorHex:
          biome === 1
            ? containerColors[stepCount % containerColors.length]
            : biome === 2
              ? '#64748b'
              : biome === 3
                ? '#38bdf8'
                : '#475569',
        rotY: rand() * Math.PI,
      });
      continue;
    }

    let kind: PlatformKind = 'container';
    let w = 4.2;
    let h = 1.1;
    let d = 4.2;
    let colorHex = '#3b82f6';
    let accentHex: string | undefined;
    let moveAxis: 'x' | 'y' | 'z' | undefined;
    let moveAmp: number | undefined;
    let moveSpeed: number | undefined;
    let movePhase: number | undefined;

    if (biome === 1) {
      const r = rand();
      if (r < 0.42) {
        kind = 'container';
        w = 3.2 + rand() * 0.8;
        h = 2.4;
        d = 5.6 + rand() * 1.2;
        colorHex = containerColors[stepCount % containerColors.length];
      } else if (r < 0.68) {
        kind = 'ibeam';
        w = 2.1;
        h = 0.75;
        d = 5.8;
        colorHex = '#b45309';
      } else if (r < 0.82 && curY > 35) {
        // Swinging crane girder
        kind = 'moving';
        w = 2.4;
        h = 0.75;
        d = 5.2;
        colorHex = '#eab308';
        accentHex = '#18181b';
        moveAxis = rand() > 0.5 ? 'x' : 'z';
        moveAmp = 2.2;
        moveSpeed = 1.1;
        movePhase = rand() * Math.PI * 2;
      } else {
        kind = 'plank';
        w = 2.5;
        h = 0.45;
        d = 4.9;
        colorHex = '#9a6638';
      }
    } else if (biome === 2) {
      const r = rand();
      if (r < 0.6) {
        kind = 'island';
        w = 3.6 + rand() * 1.5;
        h = 1.4;
        d = 3.6 + rand() * 1.5;
        colorHex = '#64748b';
        accentHex = '#22c55e';
      } else {
        kind = 'moving';
        w = 3.5;
        h = 0.7;
        d = 3.5;
        colorHex = '#0284c7';
        accentHex = '#bae6fd';
        moveAxis = rand() > 0.35 ? 'x' : 'y';
        moveAmp = 2.2;
        moveSpeed = 1.15 + rand() * 0.5;
        movePhase = rand() * Math.PI * 2;
      }
    } else if (biome === 3) {
      const r = rand();
      if (r < 0.35) {
        kind = 'hypercar';
        w = 2.75;
        h = 1.25;
        d = 5.6;
        colorHex = hypercarColors[stepCount % hypercarColors.length];
        accentHex = '#fde047';
      } else if (r < 0.68) {
        kind = 'glass';
        w = 3.7;
        h = 0.45;
        d = 4.4;
        colorHex = '#38bdf8';
        accentHex = '#e0f2fe';
      } else if (r < 0.86) {
        kind = 'neon_rail';
        w = 1.75;
        h = 0.5;
        d = 6.0;
        colorHex = '#ec4899';
        accentHex = '#06b6d4';
      } else {
        kind = 'moving';
        w = 3.3;
        h = 0.55;
        d = 3.3;
        colorHex = '#a855f7';
        accentHex = '#f0abfc';
        moveAxis = 'x';
        moveAmp = 2.5;
        moveSpeed = 1.3;
        movePhase = rand() * Math.PI * 2;
      }
    } else {
      const r = rand();
      if (r < 0.48) {
        kind = 'asteroid';
        w = 3.7 + rand() * 1.4;
        h = 1.6;
        d = 3.7 + rand() * 1.4;
        colorHex = '#475569';
        accentHex = '#94a3b8';
      } else if (r < 0.82) {
        kind = 'satellite';
        w = 5.4;
        h = 0.75;
        d = 2.7;
        colorHex = '#eab308';
        accentHex = '#1d4ed8';
      } else {
        kind = 'moving';
        w = 3.3;
        h = 0.65;
        d = 3.3;
        colorHex = '#f59e0b';
        accentHex = '#fef08a';
        moveAxis = rand() > 0.5 ? 'y' : 'z';
        moveAmp = 1.9;
        moveSpeed = 1.35;
        movePhase = rand() * Math.PI * 2;
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
      accentHex,
      rotY:
        kind === 'container' ||
        kind === 'ibeam' ||
        kind === 'plank' ||
        kind === 'hypercar' ||
        kind === 'neon_rail' ||
        kind === 'satellite'
          ? spiralAngle + Math.PI * 0.5
          : 0,
      moveAxis,
      moveAmp,
      moveSpeed,
      movePhase,
    });
  }

  // Final Summit Golden Crown Platform at 1000m
  const last = platforms[platforms.length - 1];
  addPlatform({
    x: last.x * 0.4,
    y: 999.2,
    z: last.z * 0.4,
    w: 12.5,
    h: 1.6,
    d: 12.5,
    kind: 'summit',
    biome: 4,
    colorHex: '#f59e0b',
    accentHex: '#fef08a',
  });

  cachedCourse = { platforms, checkpoints, grappleAnchors };
  return cachedCourse;
}
