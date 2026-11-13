import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  CheckpointDef,
  GraphicsPreset,
  GrappleAnchorDef,
  PlatformDef,
} from '../types/game';
import { getPlatformPoseAt } from '../game/courseGenerator';
import { getProceduralTextures } from '../game/proceduralTextures';

interface BiomeWorldProps {
  platforms: PlatformDef[];
  checkpoints: CheckpointDef[];
  grappleAnchors: GrappleAnchorDef[];
  activeCheckpointIdx: number;
  targetAnchorIdRef: React.MutableRefObject<number | null>;
  collisionGroupRef: React.MutableRefObject<THREE.Group | null>;
  playerAltRef: React.MutableRefObject<number>;
  graphicsPreset: GraphicsPreset;
  isVictory: boolean;
  simTimeRef: React.MutableRefObject<number>;
}

const SKY_COLORS = [
  new THREE.Color('#ff8a4c'), // 0m sunset orange
  new THREE.Color('#38bdf8'), // 250m sky cerulean
  new THREE.Color('#312e81'), // 550m twilight violet
  new THREE.Color('#020617'), // 800m+ deep space
];

const FOG_COLORS = [
  new THREE.Color('#fdba74'),
  new THREE.Color('#7dd3fc'),
  new THREE.Color('#4c1d95'),
  new THREE.Color('#090d1f'),
];

export const BiomeWorld: React.FC<BiomeWorldProps> = ({
  platforms,
  checkpoints,
  grappleAnchors,
  activeCheckpointIdx,
  targetAnchorIdRef,
  collisionGroupRef,
  playerAltRef,
  graphicsPreset,
  isVictory,
  simTimeRef,
}) => {
  const textures = useMemo(() => getProceduralTextures(), []);

  const {
    containers,
    ibeams,
    planks,
    trampolines,
    islands,
    hypercars,
    neonRails,
    glassSlabs,
    asteroids,
    satellites,
    launchpads,
    dynamicPlatforms,
    summitPlatform,
  } = useMemo(() => {
    const groups = {
      containers: [] as PlatformDef[],
      ibeams: [] as PlatformDef[],
      planks: [] as PlatformDef[],
      trampolines: [] as PlatformDef[],
      islands: [] as PlatformDef[],
      hypercars: [] as PlatformDef[],
      neonRails: [] as PlatformDef[],
      glassSlabs: [] as PlatformDef[],
      asteroids: [] as PlatformDef[],
      satellites: [] as PlatformDef[],
      launchpads: [] as PlatformDef[],
      dynamicPlatforms: [] as PlatformDef[],
      summitPlatform: null as PlatformDef | null,
    };

    for (const p of platforms) {
      if (p.kind === 'moving' || p.kind === 'turbine_blade') {
        groups.dynamicPlatforms.push(p);
      } else if (p.kind === 'summit') {
        groups.summitPlatform = p;
      } else if (p.kind === 'container') groups.containers.push(p);
      else if (p.kind === 'ibeam') groups.ibeams.push(p);
      else if (p.kind === 'plank') groups.planks.push(p);
      else if (p.kind === 'trampoline') groups.trampolines.push(p);
      else if (p.kind === 'island') groups.islands.push(p);
      else if (p.kind === 'hypercar') groups.hypercars.push(p);
      else if (p.kind === 'neon_rail') groups.neonRails.push(p);
      else if (p.kind === 'glass') groups.glassSlabs.push(p);
      else if (p.kind === 'asteroid') groups.asteroids.push(p);
      else if (p.kind === 'satellite') groups.satellites.push(p);
      else if (p.kind === 'launchpad') groups.launchpads.push(p);
    }

    return groups;
  }, [platforms]);

  // Platform InstancedMeshes
  const containerMeshRef = useRef<THREE.InstancedMesh>(null);
  const ibeamMeshRef = useRef<THREE.InstancedMesh>(null);
  const plankMeshRef = useRef<THREE.InstancedMesh>(null);
  const trampolineMeshRef = useRef<THREE.InstancedMesh>(null);
  const islandMeshRef = useRef<THREE.InstancedMesh>(null);
  const islandTurfMeshRef = useRef<THREE.InstancedMesh>(null);
  const carMeshRef = useRef<THREE.InstancedMesh>(null);
  const carCabinMeshRef = useRef<THREE.InstancedMesh>(null);
  const railMeshRef = useRef<THREE.InstancedMesh>(null);
  const glassMeshRef = useRef<THREE.InstancedMesh>(null);
  const asteroidMeshRef = useRef<THREE.InstancedMesh>(null);
  const satelliteMeshRef = useRef<THREE.InstancedMesh>(null);
  const solarWingMeshRef = useRef<THREE.InstancedMesh>(null);
  const launchpadMeshRef = useRef<THREE.InstancedMesh>(null);

  // Ambient living world meshes
  const starFieldRef = useRef<THREE.InstancedMesh>(null);
  const cloudMeshRef = useRef<THREE.InstancedMesh>(null);
  const birdMeshRef = useRef<THREE.InstancedMesh>(null);
  const cargoDroneMeshRef = useRef<THREE.InstancedMesh>(null);
  const confettiRef = useRef<THREE.InstancedMesh>(null);

  // Dynamic platforms & Grapple anchors
  const dynamicRefs = useRef<(THREE.Group | null)[]>([]);
  const anchorRefs = useRef<(THREE.Group | null)[]>([]);
  const crownRef = useRef<THREE.Group>(null);
  const ringedPlanetRef = useRef<THREE.Group>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const bgColorRef = useRef<THREE.Color>(new THREE.Color('#ff8a4c'));
  const ambientLightRef = useRef<THREE.AmbientLight>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    const populate = (
      mesh: THREE.InstancedMesh | null,
      list: PlatformDef[],
      scaleOverride?: (p: PlatformDef) => [number, number, number],
      yOffsetFn?: (p: PlatformDef) => number,
      useColor = true
    ) => {
      if (!mesh || list.length === 0) return;
      list.forEach((p, idx) => {
        dummy.position.set(p.x, p.y + (yOffsetFn ? yOffsetFn(p) : 0), p.z);
        dummy.rotation.set(0, p.rotY ?? 0, 0);
        const [sx, sy, sz] = scaleOverride ? scaleOverride(p) : [p.w, p.h, p.d];
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        if (useColor) {
          color.set(p.colorHex);
          mesh.setColorAt(idx, color);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    populate(containerMeshRef.current, containers);
    populate(ibeamMeshRef.current, ibeams);
    populate(plankMeshRef.current, planks);
    populate(trampolineMeshRef.current, trampolines, undefined, undefined, false);
    populate(
      islandMeshRef.current,
      islands,
      (p) => [p.w, p.h * 0.78, p.d],
      (p) => -p.h * 0.11
    );
    populate(
      islandTurfMeshRef.current,
      islands,
      (p) => [p.w * 1.02, p.h * 0.25, p.d * 1.02],
      (p) => p.h * 0.37,
      false
    );
    populate(
      carMeshRef.current,
      hypercars,
      (p) => [p.w, p.h * 0.6, p.d],
      (p) => -p.h * 0.15
    );
    populate(
      carCabinMeshRef.current,
      hypercars,
      (p) => [p.w * 0.78, p.h * 0.48, p.d * 0.52],
      (p) => p.h * 0.26,
      false
    );
    populate(railMeshRef.current, neonRails);
    populate(glassMeshRef.current, glassSlabs);
    populate(asteroidMeshRef.current, asteroids);
    populate(satelliteMeshRef.current, satellites, (p) => [p.w * 0.34, p.h, p.d * 0.85]);
    populate(
      solarWingMeshRef.current,
      satellites,
      (p) => [p.w * 1.05, p.h * 0.18, p.d * 0.72],
      () => 0,
      false
    );
    populate(launchpadMeshRef.current, launchpads);

    // Stars (650m - 1150m)
    if (starFieldRef.current) {
      for (let i = 0; i < 280; i++) {
        const angle = (i * 137.5 * Math.PI) / 180;
        const rad = 38 + (i % 8) * 14;
        const sy = 620 + (i / 280) * 530;
        dummy.position.set(Math.cos(angle) * rad, sy, Math.sin(angle) * rad);
        dummy.rotation.set(i, i * 0.5, 0);
        dummy.scale.setScalar(0.18 + (i % 4) * 0.14);
        dummy.updateMatrix();
        starFieldRef.current.setMatrixAt(i, dummy.matrix);
      }
      starFieldRef.current.instanceMatrix.needsUpdate = true;
    }

    // Volumetric cloud ring concentrated around 250m + sky puffs
    if (cloudMeshRef.current) {
      for (let i = 0; i < 56; i++) {
        const angle = i * 0.72;
        const isDeck = i < 24;
        const rad = isDeck ? 16 + (i % 4) * 11 : 22 + (i % 5) * 10;
        const cy = isDeck ? 235 + (i % 5) * 10 : 90 + (i - 24) * 13;
        dummy.position.set(Math.cos(angle) * rad, cy, Math.sin(angle) * rad);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(
          isDeck ? 11 + (i % 3) * 4 : 7 + (i % 3) * 3,
          isDeck ? 2.6 : 2.0,
          isDeck ? 7 + (i % 2) * 3 : 4.5 + (i % 2) * 2.5
        );
        dummy.updateMatrix();
        cloudMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      cloudMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [
    containers,
    ibeams,
    planks,
    trampolines,
    islands,
    hypercars,
    neonRails,
    glassSlabs,
    asteroids,
    satellites,
    launchpads,
  ]);

  const confettiSeeds = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      angle: (i / 80) * Math.PI * 2,
      speed: 2 + (i % 5) * 1.1,
      ySpeed: 4 + (i % 4) * 2.2,
      color: ['#fbbf24', '#22d3ee', '#f43f5e', '#10b981', '#a855f7'][i % 5],
    }));
  }, []);

  const dummyDyn = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const drawDist =
    graphicsPreset === 'low'
      ? 100
      : graphicsPreset === 'medium'
        ? 150
        : graphicsPreset === 'high'
          ? 215
          : 290;

  const showAmbientLife = graphicsPreset !== 'low';

  useFrame((state) => {
    const t = simTimeRef.current;
    const alt = playerAltRef.current;

    // 1. Sky & fog transitions across 4 biomes
    let skyIdx = 0;
    let frac = 0;
    if (alt < 250) {
      skyIdx = 0;
      frac = THREE.MathUtils.clamp(alt / 250, 0, 1);
    } else if (alt < 550) {
      skyIdx = 1;
      frac = THREE.MathUtils.clamp((alt - 250) / 300, 0, 1);
    } else {
      skyIdx = 2;
      frac = THREE.MathUtils.clamp((alt - 550) / 260, 0, 1);
    }

    bgColorRef.current.copy(SKY_COLORS[skyIdx]).lerp(SKY_COLORS[skyIdx + 1], frac);
    state.scene.background = bgColorRef.current;

    if (fogRef.current) {
      tmpColor.copy(FOG_COLORS[skyIdx]).lerp(FOG_COLORS[skyIdx + 1], frac);
      fogRef.current.color.copy(tmpColor);
      fogRef.current.near = drawDist * 0.35;
      fogRef.current.far = drawDist;
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = THREE.MathUtils.lerp(0.88, 0.58, Math.min(1, alt / 900));
    }

    // 2. Dynamic moving platforms & rotating turbine blades
    for (let i = 0; i < dynamicPlatforms.length; i++) {
      const grp = dynamicRefs.current[i];
      if (!grp) continue;
      const pose = getPlatformPoseAt(dynamicPlatforms[i], t);
      grp.position.set(pose.x, pose.y, pose.z);
      grp.rotation.y = pose.rotY;
    }

    // 3. Magnetic Grapple Drone Anchors animation + target highlight
    const targetId = targetAnchorIdRef.current;
    for (let i = 0; i < grappleAnchors.length; i++) {
      const grp = anchorRefs.current[i];
      if (!grp) continue;
      const anchor = grappleAnchors[i];
      grp.position.y = anchor.y + Math.sin(t * 2.5 + i) * 0.25;
      grp.rotation.y = t * 1.8;
      const isTargeted = anchor.id === targetId;
      const s = isTargeted ? 1.32 + Math.sin(t * 10) * 0.1 : 1.0;
      grp.scale.setScalar(s);
    }

    // 4. Ambient Soaring Birds (Zones 1-2) & Circling Cargo Drones (Zones 1-3)
    if (showAmbientLife && birdMeshRef.current) {
      for (let i = 0; i < 14; i++) {
        const angle = t * (0.28 + (i % 3) * 0.08) + i * 0.9;
        const rad = 18 + (i % 4) * 7;
        const by = 32 + i * 15 + Math.sin(t * 2 + i) * 1.4;
        dummyDyn.position.set(Math.cos(angle) * rad, by, Math.sin(angle) * rad);
        dummyDyn.rotation.set(0, -angle, Math.sin(t * 9 + i) * 0.25);
        dummyDyn.scale.set(0.95, 0.14, 0.35);
        dummyDyn.updateMatrix();
        birdMeshRef.current.setMatrixAt(i, dummyDyn.matrix);
      }
      birdMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (showAmbientLife && cargoDroneMeshRef.current) {
      for (let i = 0; i < 10; i++) {
        const angle = -t * (0.2 + (i % 2) * 0.1) + i * 1.1;
        const rad = 22 + (i % 3) * 8;
        const dy = 70 + i * 68;
        dummyDyn.position.set(Math.cos(angle) * rad, dy, Math.sin(angle) * rad);
        dummyDyn.rotation.set(0, -angle, 0);
        dummyDyn.scale.set(1.5, 0.55, 1.1);
        dummyDyn.updateMatrix();
        cargoDroneMeshRef.current.setMatrixAt(i, dummyDyn.matrix);
      }
      cargoDroneMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 5. Giant Ringed Space Planet subtle rotation
    if (ringedPlanetRef.current) {
      ringedPlanetRef.current.rotation.y = t * 0.04;
    }

    // 6. Spin summit crown emblem
    if (crownRef.current) {
      crownRef.current.rotation.y = t * 0.9;
      crownRef.current.position.y = 1003.2 + Math.sin(t * 2.2) * 0.35;
    }

    // 7. Victory confetti
    if (isVictory && confettiRef.current && summitPlatform) {
      const cColor = new THREE.Color();
      confettiSeeds.forEach((seed, i) => {
        const loopT = (state.clock.elapsedTime * 0.8 + i * 0.04) % 2.5;
        const r = seed.speed * loopT;
        const cy = summitPlatform.y + 1.5 + seed.ySpeed * loopT - 4.5 * loopT * loopT;
        dummyDyn.position.set(
          summitPlatform.x + Math.cos(seed.angle) * r,
          Math.max(summitPlatform.y + 0.9, cy),
          summitPlatform.z + Math.sin(seed.angle) * r
        );
        dummyDyn.rotation.set(loopT * 6, loopT * 4, i);
        dummyDyn.scale.set(0.24, 0.14, 0.04);
        dummyDyn.updateMatrix();
        confettiRef.current!.setMatrixAt(i, dummyDyn.matrix);
        cColor.set(seed.color);
        confettiRef.current!.setColorAt(i, cColor);
      });
      confettiRef.current.instanceMatrix.needsUpdate = true;
      if (confettiRef.current.instanceColor) confettiRef.current.instanceColor.needsUpdate = true;
    }
  });

  const enableShadows = graphicsPreset === 'high' || graphicsPreset === 'ultra';

  return (
    <>
      <fog ref={fogRef} attach="fog" args={['#fdba74', 50, drawDist]} />
      <ambientLight ref={ambientLightRef} intensity={0.88} />
      <hemisphereLight args={['#fff7ed', '#1e293b', 0.55]} />
      <directionalLight
        position={[35, 180, 45]}
        intensity={1.55}
        color="#fffbeb"
        castShadow={enableShadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Collidable Platforms Group (Raycaster target for Laser Landing Reticle) */}
      <group ref={collisionGroupRef}>
        {containers.length > 0 && (
          <instancedMesh
            ref={containerMeshRef}
            args={[undefined, undefined, containers.length]}
            receiveShadow
            castShadow={enableShadows}
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              map={textures.rustedContainer}
              roughnessMap={textures.rustedRoughness}
              roughness={0.78}
              metalness={0.42}
            />
          </instancedMesh>
        )}

        {ibeams.length > 0 && (
          <instancedMesh
            ref={ibeamMeshRef}
            args={[undefined, undefined, ibeams.length]}
            receiveShadow
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              map={textures.rivetedSteel}
              roughness={0.38}
              metalness={0.82}
            />
          </instancedMesh>
        )}

        {planks.length > 0 && (
          <instancedMesh
            ref={plankMeshRef}
            args={[undefined, undefined, planks.length]}
            receiveShadow
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial map={textures.woodPlank} roughness={0.82} metalness={0.05} />
          </instancedMesh>
        )}

        {trampolines.length > 0 && (
          <instancedMesh
            ref={trampolineMeshRef}
            args={[undefined, undefined, trampolines.length]}
            receiveShadow
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.5, 0.54, 1, 16]} />
            <meshStandardMaterial
              map={textures.trampolinePad}
              roughness={0.4}
              metalness={0.2}
              emissive="#f97316"
              emissiveIntensity={0.28}
            />
          </instancedMesh>
        )}

        {islands.length > 0 && (
          <>
            <instancedMesh
              ref={islandMeshRef}
              args={[undefined, undefined, islands.length]}
              receiveShadow
              frustumCulled={false}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial map={textures.stoneIsland} roughness={0.88} metalness={0.08} />
            </instancedMesh>
            <instancedMesh
              ref={islandTurfMeshRef}
              args={[undefined, undefined, islands.length]}
              receiveShadow
              frustumCulled={false}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#16a34a" roughness={0.85} metalness={0.05} />
            </instancedMesh>
          </>
        )}

        {hypercars.length > 0 && (
          <>
            <instancedMesh
              ref={carMeshRef}
              args={[undefined, undefined, hypercars.length]}
              receiveShadow
              frustumCulled={false}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshPhysicalMaterial
                metalness={0.84}
                roughness={0.16}
                clearcoat={0.95}
                clearcoatRoughness={0.1}
              />
            </instancedMesh>
            <instancedMesh
              ref={carCabinMeshRef}
              args={[undefined, undefined, hypercars.length]}
              receiveShadow
              frustumCulled={false}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshPhysicalMaterial
                color="#0f172a"
                metalness={0.9}
                roughness={0.1}
                clearcoat={1}
              />
            </instancedMesh>
          </>
        )}

        {neonRails.length > 0 && (
          <instancedMesh
            ref={railMeshRef}
            args={[undefined, undefined, neonRails.length]}
            receiveShadow
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              emissive="#ec4899"
              emissiveIntensity={0.85}
              roughness={0.25}
              metalness={0.6}
            />
          </instancedMesh>
        )}

        {glassSlabs.length > 0 && (
          <instancedMesh
            ref={glassMeshRef}
            args={[undefined, undefined, glassSlabs.length]}
            receiveShadow
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshPhysicalMaterial
              map={textures.circuitGlass}
              color="#bae6fd"
              transparent
              opacity={0.64}
              roughness={0.06}
              metalness={0.18}
              clearcoat={1}
              emissive="#0ea5e9"
              emissiveIntensity={0.18}
            />
          </instancedMesh>
        )}

        {asteroids.length > 0 && (
          <instancedMesh
            ref={asteroidMeshRef}
            args={[undefined, undefined, asteroids.length]}
            receiveShadow
            frustumCulled={false}
          >
            <dodecahedronGeometry args={[0.62, 0]} />
            <meshStandardMaterial
              map={textures.crateredAsteroid}
              roughness={0.92}
              metalness={0.14}
            />
          </instancedMesh>
        )}

        {satellites.length > 0 && (
          <>
            <instancedMesh
              ref={satelliteMeshRef}
              args={[undefined, undefined, satellites.length]}
              receiveShadow
              frustumCulled={false}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#eab308" metalness={0.88} roughness={0.25} />
            </instancedMesh>
            <instancedMesh
              ref={solarWingMeshRef}
              args={[undefined, undefined, satellites.length]}
              receiveShadow
              frustumCulled={false}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                map={textures.solarGrid}
                color="#93c5fd"
                metalness={0.65}
                roughness={0.22}
              />
            </instancedMesh>
          </>
        )}

        {launchpads.length > 0 && (
          <instancedMesh
            ref={launchpadMeshRef}
            args={[undefined, undefined, launchpads.length]}
            receiveShadow
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              map={textures.hazardStripes}
              roughness={0.38}
              metalness={0.62}
            />
          </instancedMesh>
        )}

        {dynamicPlatforms.map((p, idx) => (
          <group
            key={p.id}
            ref={(el) => {
              dynamicRefs.current[idx] = el;
            }}
            position={[p.x, p.y, p.z]}
          >
            <mesh receiveShadow castShadow={enableShadows}>
              <boxGeometry args={[p.w, p.h, p.d]} />
              <meshStandardMaterial
                map={p.biome === 1 ? textures.hazardStripes : textures.rivetedSteel}
                color={p.colorHex}
                emissive={p.kind === 'moving' ? p.accentHex ?? '#38bdf8' : '#0ea5e9'}
                emissiveIntensity={p.kind === 'moving' ? 0.28 : 0.16}
                metalness={0.55}
                roughness={0.32}
              />
            </mesh>
          </group>
        ))}

        {/* Golden Crown Summit Platform at 1000m */}
        {summitPlatform && (
          <mesh
            position={[summitPlatform.x, summitPlatform.y, summitPlatform.z]}
            receiveShadow
          >
            <cylinderGeometry args={[6.4, 7.0, summitPlatform.h, 24]} />
            <meshPhysicalMaterial
              map={textures.summitGold}
              color="#fbbf24"
              metalness={0.85}
              roughness={0.18}
              clearcoat={0.9}
              emissive="#f59e0b"
              emissiveIntensity={0.28}
            />
          </mesh>
        )}
      </group>

      {/* Magnetic Grapple Drone Anchors */}
      {grappleAnchors.map((anchor, idx) => (
        <group
          key={anchor.id}
          ref={(el) => {
            anchorRefs.current[idx] = el;
          }}
          position={[anchor.x, anchor.y, anchor.z]}
        >
          <mesh>
            <octahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial
              color="#22d3ee"
              emissive="#06b6d4"
              emissiveIntensity={1.6}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.05, 0.08, 8, 22]} />
            <meshBasicMaterial color="#67e8f9" transparent opacity={0.85} />
          </mesh>
        </group>
      ))}

      {/* Checkpoint Flags every 150m */}
      {checkpoints.map((cp) => {
        const unlocked = cp.index <= activeCheckpointIdx;
        const flagColor = unlocked ? '#10b981' : '#f59e0b';
        return (
          <group key={cp.index} position={[cp.x + 2.2, cp.y, cp.z - 2.2]}>
            <mesh position={[0, 1.8, 0]}>
              <cylinderGeometry args={[0.08, 0.1, 3.6, 8]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0.65, 3.0, 0]}>
              <boxGeometry args={[1.25, 0.75, 0.08]} />
              <meshStandardMaterial
                color={flagColor}
                emissive={flagColor}
                emissiveIntensity={unlocked ? 1.5 : 0.7}
              />
            </mesh>
            <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.55, 0.08, 8, 18]} />
              <meshStandardMaterial
                color={flagColor}
                emissive={flagColor}
                emissiveIntensity={1.2}
              />
            </mesh>
          </group>
        );
      })}

      {/* Summit Pillars & Floating Golden Crown */}
      {summitPlatform && (
        <group>
          {[0, 1, 2, 3].map((pIdx) => {
            const ang = (pIdx * Math.PI) / 2 + Math.PI / 4;
            return (
              <mesh
                key={pIdx}
                position={[
                  summitPlatform.x + Math.cos(ang) * 5.0,
                  summitPlatform.y + 2.6,
                  summitPlatform.z + Math.sin(ang) * 5.0,
                ]}
              >
                <cylinderGeometry args={[0.25, 0.35, 3.8, 8]} />
                <meshStandardMaterial
                  color="#fef08a"
                  emissive="#f59e0b"
                  emissiveIntensity={0.6}
                  metalness={0.9}
                  roughness={0.2}
                />
              </mesh>
            );
          })}
          <group ref={crownRef} position={[summitPlatform.x, 1003.2, summitPlatform.z]}>
            <mesh>
              <torusGeometry args={[1.6, 0.24, 12, 24]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#fbbf24"
                emissiveIntensity={1.4}
                metalness={0.95}
                roughness={0.12}
              />
            </mesh>
            <mesh position={[0, 0.6, 0]}>
              <octahedronGeometry args={[0.85, 0]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#fde047"
                emissiveIntensity={1.8}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* Giant Ringed Space Planet visible in Zone 4 (750m - 1000m) */}
      <group ref={ringedPlanetRef} position={[-68, 920, 75]}>
        <mesh>
          <sphereGeometry args={[22, 24, 24]} />
          <meshStandardMaterial
            color="#6366f1"
            emissive="#312e81"
            emissiveIntensity={0.45}
            roughness={0.7}
          />
        </mesh>
        <mesh rotation={[Math.PI * 0.38, 0.2, 0]}>
          <ringGeometry args={[27, 42, 36]} />
          <meshBasicMaterial
            color="#c084fc"
            side={THREE.DoubleSide}
            transparent
            opacity={0.55}
          />
        </mesh>
      </group>

      {/* Volumetric-style Clouds & 250m Cloud Deck */}
      <instancedMesh ref={cloudMeshRef} args={[undefined, undefined, 56]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={graphicsPreset === 'low' ? 0.32 : 0.64}
          roughness={0.95}
        />
      </instancedMesh>

      {/* Ambient Living Birds (Zones 1-2) */}
      {showAmbientLife && (
        <instancedMesh ref={birdMeshRef} args={[undefined, undefined, 14]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#1e293b" />
        </instancedMesh>
      )}

      {/* Ambient Circling Cargo Drones (Zones 1-3) */}
      {showAmbientLife && (
        <instancedMesh
          ref={cargoDroneMeshRef}
          args={[undefined, undefined, 10]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#334155"
            emissive="#f59e0b"
            emissiveIntensity={0.55}
            metalness={0.7}
          />
        </instancedMesh>
      )}

      {/* Deep Space Starfield */}
      <instancedMesh ref={starFieldRef} args={[undefined, undefined, 280]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#f8fafc" />
      </instancedMesh>

      {/* Victory Confetti */}
      {isVictory && (
        <instancedMesh
          ref={confettiRef}
          args={[undefined, undefined, confettiSeeds.length]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial />
        </instancedMesh>
      )}
    </>
  );
};
