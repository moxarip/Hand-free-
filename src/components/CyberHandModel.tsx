import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HAND_SKINS, THRUSTER_COLORS } from '../game/storage';
import { getProceduralTextures } from '../game/proceduralTextures';
import { HandSkinId, ThrusterColorId } from '../types/game';

export interface HandAnimState {
  speedHoriz: number;
  vy: number;
  grounded: boolean;
  isDashing: boolean;
  dashTimer: number;
  isLedgeGrabbing: boolean;
  isGrappling: boolean;
  jumpAnimTimer: number;
  isMenuIdle: boolean;
  facingYaw: number;
  energyRatio: number; // 0..1 live thruster / grapple energy for diegetic LED gauge
}

interface CyberHandModelProps {
  rootRef: React.MutableRefObject<THREE.Group | null>;
  animStateRef: React.MutableRefObject<HandAnimState>;
  skinId: HandSkinId;
  thrusterId: ThrusterColorId;
}

interface FingerConfig {
  name: string;
  basePos: [number, number, number];
  baseRotY: number;
  baseSpreadZ: number;
  lengths: [number, number, number];
  radius: number;
  phaseOffset: number;
}

const FINGERS: FingerConfig[] = [
  {
    name: 'thumb',
    basePos: [-0.32, -0.02, 0.14],
    baseRotY: -0.78,
    baseSpreadZ: 0.28,
    lengths: [0.22, 0.19, 0.16],
    radius: 0.068,
    phaseOffset: 0.0,
  },
  {
    name: 'index',
    basePos: [-0.21, 0.04, 0.38],
    baseRotY: -0.14,
    baseSpreadZ: 0.08,
    lengths: [0.28, 0.22, 0.17],
    radius: 0.06,
    phaseOffset: 1.25,
  },
  {
    name: 'middle',
    basePos: [-0.04, 0.05, 0.41],
    baseRotY: 0.0,
    baseSpreadZ: 0.0,
    lengths: [0.31, 0.24, 0.18],
    radius: 0.063,
    phaseOffset: 2.5,
  },
  {
    name: 'ring',
    basePos: [0.13, 0.04, 0.38],
    baseRotY: 0.12,
    baseSpreadZ: -0.06,
    lengths: [0.28, 0.22, 0.17],
    radius: 0.058,
    phaseOffset: 3.75,
  },
  {
    name: 'pinky',
    basePos: [0.28, 0.02, 0.32],
    baseRotY: 0.26,
    baseSpreadZ: -0.14,
    lengths: [0.23, 0.18, 0.15],
    radius: 0.05,
    phaseOffset: 5.0,
  },
];

const LED_CYAN = new THREE.Color('#00e5ff');
const LED_AMBER = new THREE.Color('#f59e0b');
const LED_RED = new THREE.Color('#ef4444');

export const CyberHandModel: React.FC<CyberHandModelProps> = ({
  rootRef,
  animStateRef,
  skinId,
  thrusterId,
}) => {
  const visualGroupRef = useRef<THREE.Group>(null);
  const palmRef = useRef<THREE.Group>(null);
  const seg0Refs = useRef<(THREE.Group | null)[]>([null, null, null, null, null]);
  const seg1Refs = useRef<(THREE.Group | null)[]>([null, null, null, null, null]);
  const seg2Refs = useRef<(THREE.Group | null)[]>([null, null, null, null, null]);
  const flameLRef = useRef<THREE.Group>(null);
  const flameRRef = useRef<THREE.Group>(null);
  const sparkGroupRef = useRef<THREE.Group>(null);
  const ledBarRef = useRef<THREE.Mesh>(null);

  const skin = HAND_SKINS[skinId];
  const thruster = THRUSTER_COLORS[thrusterId];
  const textures = useMemo(() => getProceduralTextures(), []);

  const ledMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#00e5ff',
        emissive: '#00e5ff',
        emissiveIntensity: 2.4,
        roughness: 0.15,
      }),
    []
  );

  const materials = useMemo(() => {
    const primaryMat = new THREE.MeshPhysicalMaterial({
      color: skin.primaryColor,
      metalness: skin.metalness,
      roughness: skin.roughness,
      clearcoat: skin.clearcoat,
      clearcoatRoughness: 0.18,
      map: skin.useCarbonTexture ? textures.carbonWeave : textures.brushedMetal,
    });

    const secondaryMat = new THREE.MeshPhysicalMaterial({
      color: skin.secondaryColor,
      metalness: 0.72,
      roughness: 0.38,
      clearcoat: 0.35,
    });

    const wireMat = new THREE.MeshStandardMaterial({
      color: skin.wireColor,
      metalness: 0.85,
      roughness: 0.25,
      emissive: skin.wireColor,
      emissiveIntensity: 0.18,
    });

    const conduitMat = new THREE.MeshStandardMaterial({
      color: skin.conduitGlow,
      emissive: skin.conduitGlow,
      emissiveIntensity: 2.1,
      roughness: 0.2,
      metalness: 0.1,
    });

    const thrusterCoreMat = new THREE.MeshBasicMaterial({
      color: thruster.coreHex,
      transparent: true,
      opacity: 0.95,
    });

    const thrusterOuterMat = new THREE.MeshBasicMaterial({
      color: thruster.outerHex,
      transparent: true,
      opacity: 0.68,
    });

    return {
      primaryMat,
      secondaryMat,
      wireMat,
      conduitMat,
      thrusterCoreMat,
      thrusterOuterMat,
    };
  }, [skin, thruster, textures]);

  const crawlPhaseRef = useRef(0);
  const tmpLedColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = state.clock.elapsedTime;
    const anim = animStateRef.current;

    if (!visualGroupRef.current || !palmRef.current) return;

    visualGroupRef.current.rotation.y = anim.facingYaw;

    // Diegetic Back-of-Hand LED Energy Bar (cyan -> amber -> red)
    if (ledBarRef.current) {
      const ratio = THREE.MathUtils.clamp(anim.energyRatio, 0.04, 1);
      ledBarRef.current.scale.x = ratio;
      ledBarRef.current.position.x = -(1 - ratio) * 0.21;
      if (ratio >= 0.55) {
        tmpLedColor.copy(LED_AMBER).lerp(LED_CYAN, (ratio - 0.55) / 0.45);
      } else {
        tmpLedColor.copy(LED_RED).lerp(LED_AMBER, ratio / 0.55);
      }
      ledMat.color.copy(tmpLedColor);
      ledMat.emissive.copy(tmpLedColor);
    }

    const isMoving = anim.speedHoriz > 0.4 && anim.grounded && !anim.isMenuIdle;
    if (isMoving) {
      crawlPhaseRef.current += dt * (8.5 + anim.speedHoriz * 1.15);
    } else {
      crawlPhaseRef.current += dt * 2.2;
    }

    const phase = crawlPhaseRef.current;
    const panic = !anim.grounded && !anim.isLedgeGrabbing && !anim.isGrappling && anim.vy < -13;

    let targetPalmY = 0.54;
    let targetPalmPitch = 0.08;
    let targetPalmRoll = 0;

    if (anim.isGrappling) {
      targetPalmY = 0.62;
      targetPalmPitch = -0.45;
      targetPalmRoll = 0;
    } else if (anim.isLedgeGrabbing) {
      targetPalmY = 0.42;
      targetPalmPitch = -0.68;
    } else if (panic) {
      targetPalmY = 0.62;
      targetPalmPitch = -0.35 + Math.sin(t * 20) * 0.18;
      targetPalmRoll = Math.cos(t * 23) * 0.22;
    } else if (!anim.grounded) {
      targetPalmY = 0.6;
      targetPalmPitch = THREE.MathUtils.clamp(-anim.vy * 0.032, -0.45, 0.42);
      targetPalmRoll = Math.sin(t * 6) * 0.06;
    } else if (isMoving) {
      targetPalmY = 0.5 + Math.abs(Math.sin(phase * 2)) * 0.07;
      targetPalmPitch = 0.14 + Math.sin(phase * 2) * 0.09;
      targetPalmRoll = Math.cos(phase) * 0.11;
    } else {
      targetPalmY = 0.54 + Math.sin(t * 2.4) * 0.03;
      targetPalmPitch = 0.06 + Math.sin(t * 1.6) * 0.03;
    }

    const smooth = 1 - Math.exp(-16 * dt);
    palmRef.current.position.y = THREE.MathUtils.lerp(
      palmRef.current.position.y,
      targetPalmY,
      smooth
    );
    palmRef.current.rotation.x = THREE.MathUtils.lerp(
      palmRef.current.rotation.x,
      targetPalmPitch,
      smooth
    );
    palmRef.current.rotation.z = THREE.MathUtils.lerp(
      palmRef.current.rotation.z,
      targetPalmRoll,
      smooth
    );

    for (let i = 0; i < 5; i++) {
      const s0 = seg0Refs.current[i];
      const s1 = seg1Refs.current[i];
      const s2 = seg2Refs.current[i];
      if (!s0 || !s1 || !s2) continue;

      const cfg = FINGERS[i];
      let j0 = 0.35;
      let j1 = 0.72;
      let j2 = 0.52;
      let splayZ = cfg.baseSpreadZ;

      if (anim.isGrappling) {
        j0 = -0.15;
        j1 = 0.25;
        j2 = 0.35;
        splayZ = cfg.baseSpreadZ * 1.5;
      } else if (anim.isLedgeGrabbing) {
        j0 = 0.72;
        j1 = 1.15;
        j2 = 0.92;
      } else if (panic) {
        const f = t * 24 + i * 1.37;
        j0 = -0.15 + Math.sin(f) * 0.55;
        j1 = 0.35 + Math.cos(f * 1.1) * 0.55;
        j2 = 0.25 + Math.sin(f * 1.4) * 0.45;
        splayZ = cfg.baseSpreadZ * 1.8 + Math.sin(f) * 0.12;
      } else if (!anim.grounded) {
        if (anim.jumpAnimTimer > 0.12) {
          j0 = 0.55;
          j1 = 0.9;
          j2 = 0.65;
        } else {
          j0 = -0.18 + Math.sin(t * 7 + i) * 0.08;
          j1 = 0.24 + Math.cos(t * 7 + i) * 0.08;
          j2 = 0.18;
          splayZ = cfg.baseSpreadZ * 1.65;
        }
      } else if (isMoving) {
        const wave = Math.sin(phase + cfg.phaseOffset);
        const lift = Math.max(0, wave);
        const plant = Math.max(0, -wave);
        j0 = 0.26 - lift * 0.42 + plant * 0.18;
        j1 = 0.68 + lift * 0.22 + plant * 0.16;
        j2 = 0.48 + plant * 0.26 - lift * 0.15;
      } else {
        const tapCycle = ((t * 2.1 - i * 0.22) % 1.4 + 1.4) % 1.4;
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

    const thrustPower = anim.isDashing || anim.isGrappling
      ? 1.4 + Math.sin(t * 60) * 0.25
      : !anim.grounded && anim.jumpAnimTimer > 0
        ? 0.65
        : 0.08 + (isMoving ? 0.1 : 0);

    if (flameLRef.current && flameRRef.current) {
      const fScale = Math.max(0.05, thrustPower);
      flameLRef.current.scale.set(0.7 + fScale * 0.3, fScale, 0.7 + fScale * 0.3);
      flameRRef.current.scale.set(0.7 + fScale * 0.3, fScale, 0.7 + fScale * 0.3);
      flameLRef.current.visible = fScale > 0.14;
      flameRRef.current.visible = fScale > 0.14;
    }

    if (sparkGroupRef.current) {
      sparkGroupRef.current.visible =
        anim.isDashing || anim.isGrappling || anim.jumpAnimTimer > 0.04;
      if (sparkGroupRef.current.visible) {
        sparkGroupRef.current.rotation.z = t * 14;
        const children = sparkGroupRef.current.children;
        for (let s = 0; s < children.length; s++) {
          const sp = children[s];
          const age = (t * 5 + s * 0.2) % 1;
          sp.position.z = -0.55 - age * 1.1;
          sp.scale.setScalar(Math.max(0.05, 1 - age));
        }
      }
    }
  });

  return (
    <group ref={rootRef} name="cyber-hand-root">
      <group ref={visualGroupRef}>
        <group ref={palmRef} position={[0, 0.54, 0]}>
          {/* Main Armored Palm Chassis */}
          <mesh material={materials.primaryMat} castShadow receiveShadow>
            <boxGeometry args={[0.66, 0.2, 0.68]} />
          </mesh>

          {/* Dorsal Beveled Armor Plate */}
          <mesh position={[0, 0.11, 0.02]} material={materials.secondaryMat} castShadow>
            <boxGeometry args={[0.56, 0.07, 0.54]} />
          </mesh>

          {/* Diegetic Back-of-Hand LED Energy Bar Gauge */}
          <group position={[0, 0.15, -0.08]}>
            <mesh material={materials.secondaryMat}>
              <boxGeometry args={[0.46, 0.024, 0.09]} />
            </mesh>
            <mesh ref={ledBarRef} position={[0, 0.012, 0]} material={ledMat}>
              <boxGeometry args={[0.42, 0.018, 0.056]} />
            </mesh>
          </group>

          {/* Glowing Central Energy Core on Back of Palm */}
          <mesh
            position={[0, 0.152, 0.13]}
            rotation={[0, Math.PI / 4, 0]}
            material={materials.conduitMat}
          >
            <boxGeometry args={[0.14, 0.03, 0.14]} />
          </mesh>

          {/* Knuckle Bridge Housing */}
          <mesh position={[0, 0.04, 0.34]} material={materials.secondaryMat} castShadow>
            <boxGeometry args={[0.64, 0.14, 0.12]} />
          </mesh>

          {/* Exposed Side Hydraulic Pistons */}
          {[-0.35, 0.35].map((xPos, idx) => (
            <group key={idx} position={[xPos, 0.03, -0.1]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.wireMat}>
                <cylinderGeometry args={[0.032, 0.032, 0.52, 8]} />
              </mesh>
              <mesh
                position={[0, 0.04, -0.05]}
                rotation={[Math.PI / 2, 0, 0]}
                material={materials.conduitMat}
              >
                <cylinderGeometry args={[0.015, 0.015, 0.44, 6]} />
              </mesh>
            </group>
          ))}

          {/* Mechanical Wrist / Forearm Stump */}
          <group position={[0, 0.02, -0.44]} rotation={[-0.14, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.secondaryMat} castShadow>
              <cylinderGeometry args={[0.2, 0.24, 0.36, 12]} />
            </mesh>
            <mesh
              position={[0, 0, -0.04]}
              rotation={[Math.PI / 2, 0, 0]}
              material={materials.wireMat}
            >
              <torusGeometry args={[0.21, 0.024, 8, 18]} />
            </mesh>
            <mesh
              position={[0, 0, 0.08]}
              rotation={[Math.PI / 2, 0, 0]}
              material={materials.conduitMat}
            >
              <torusGeometry args={[0.2, 0.016, 8, 18]} />
            </mesh>

            {/* Twin Wrist Micro-Thrusters */}
            {[-0.24, 0.24].map((tx, idx) => (
              <group
                key={idx}
                position={[tx, -0.02, -0.08]}
                rotation={[0.18, idx === 0 ? 0.14 : -0.14, 0]}
              >
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.primaryMat} castShadow>
                  <cylinderGeometry args={[0.075, 0.095, 0.28, 10]} />
                </mesh>
                <mesh
                  position={[0, 0, -0.15]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={materials.secondaryMat}
                >
                  <cylinderGeometry args={[0.08, 0.06, 0.06, 10]} />
                </mesh>
                <group
                  ref={idx === 0 ? flameLRef : flameRRef}
                  position={[0, 0, -0.2]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <mesh position={[0, 0.26, 0]} material={materials.thrusterOuterMat}>
                    <coneGeometry args={[0.09, 0.56, 10]} />
                  </mesh>
                  <mesh position={[0, 0.18, 0]} material={materials.thrusterCoreMat}>
                    <coneGeometry args={[0.048, 0.38, 8]} />
                  </mesh>
                </group>
              </group>
            ))}

            <group ref={sparkGroupRef}>
              {[-0.26, -0.16, 0.16, 0.26, -0.22, 0.22].map((sx, idx) => (
                <mesh
                  key={idx}
                  position={[sx, (idx % 2 === 0 ? 1 : -1) * 0.06, -0.5]}
                  material={materials.thrusterCoreMat}
                >
                  <octahedronGeometry args={[0.045, 0]} />
                </mesh>
              ))}
            </group>
          </group>

          {/* 5 Hierarchical Articulated Fingers */}
          {FINGERS.map((f, fIdx) => (
            <group key={f.name} position={f.basePos} rotation={[0, f.baseRotY, 0]}>
              <group
                ref={(el) => {
                  seg0Refs.current[fIdx] = el;
                }}
              >
                <mesh material={materials.secondaryMat}>
                  <sphereGeometry args={[f.radius * 1.05, 8, 8]} />
                </mesh>
                <mesh
                  position={[0, 0, f.lengths[0] * 0.5]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={materials.primaryMat}
                  castShadow
                >
                  <cylinderGeometry args={[f.radius * 0.9, f.radius, f.lengths[0], 8]} />
                </mesh>

                <group
                  position={[0, 0, f.lengths[0]]}
                  ref={(el) => {
                    seg1Refs.current[fIdx] = el;
                  }}
                >
                  <mesh material={materials.wireMat}>
                    <sphereGeometry args={[f.radius * 0.92, 8, 8]} />
                  </mesh>
                  <mesh
                    position={[0, 0, f.lengths[1] * 0.5]}
                    rotation={[Math.PI / 2, 0, 0]}
                    material={materials.primaryMat}
                    castShadow
                  >
                    <cylinderGeometry
                      args={[f.radius * 0.8, f.radius * 0.88, f.lengths[1], 8]}
                    />
                  </mesh>

                  <group
                    position={[0, 0, f.lengths[1]]}
                    ref={(el) => {
                      seg2Refs.current[fIdx] = el;
                    }}
                  >
                    <mesh material={materials.secondaryMat}>
                      <sphereGeometry args={[f.radius * 0.82, 8, 8]} />
                    </mesh>
                    <mesh
                      position={[0, 0, f.lengths[2] * 0.5]}
                      rotation={[Math.PI / 2, 0, 0]}
                      material={materials.primaryMat}
                      castShadow
                    >
                      <cylinderGeometry
                        args={[f.radius * 0.65, f.radius * 0.78, f.lengths[2], 8]}
                      />
                    </mesh>
                    <mesh position={[0, -0.015, f.lengths[2]]} material={materials.conduitMat}>
                      <sphereGeometry args={[f.radius * 0.76, 8, 8]} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
};
