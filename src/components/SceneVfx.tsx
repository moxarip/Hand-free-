import React from 'react';
import * as THREE from 'three';

export interface VfxRefs {
  reticleGroup: THREE.Group | null;
  laserBeam: THREE.Mesh | null;
  tetherBeam: THREE.Mesh | null;
  shockwaveRing: THREE.Mesh | null;
  sparkPool: THREE.Group | null;
  frostPool: THREE.Group | null;
}

interface SceneVfxProps {
  vfxRefs: React.MutableRefObject<VfxRefs>;
}

export const SceneVfx: React.FC<SceneVfxProps> = ({ vfxRefs }) => {
  return (
    <>
      {/* Precision Laser Landing Reticle (Target Ring + Vertical Guide Beam) */}
      <group
        ref={(el) => {
          vfxRefs.current.reticleGroup = el;
        }}
        visible={false}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.44, 24]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.1, 0.16, 16]} />
          <meshBasicMaterial color="#fde047" transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <mesh
        ref={(el) => {
          vfxRefs.current.laserBeam = el;
        }}
        visible={false}
      >
        <cylinderGeometry args={[0.018, 0.018, 1, 6]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.28} />
      </mesh>

      {/* Magnetic Grapple Energy Tether Beam */}
      <mesh
        ref={(el) => {
          vfxRefs.current.tetherBeam = el;
        }}
        visible={false}
      >
        <cylinderGeometry args={[0.045, 0.045, 1, 8]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.92} />
      </mesh>

      {/* Expanding Shockwave Ring (Bounce Pads & Heavy Fall Landing) */}
      <mesh
        ref={(el) => {
          vfxRefs.current.shockwaveRing = el;
        }}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.45, 0.72, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Metallic Landing Sparks Pool */}
      <group
        ref={(el) => {
          vfxRefs.current.sparkPool = el;
        }}
        visible={false}
      >
        {Array.from({ length: 10 }).map((_, idx) => (
          <mesh key={idx}>
            <octahedronGeometry args={[0.055, 0]} />
            <meshBasicMaterial color={idx % 2 === 0 ? '#fde047' : '#fb923c'} />
          </mesh>
        ))}
      </group>

      {/* Slippery Cyber-Glass Frost Particles Pool */}
      <group
        ref={(el) => {
          vfxRefs.current.frostPool = el;
        }}
        visible={false}
      >
        {Array.from({ length: 8 }).map((_, idx) => (
          <mesh key={idx}>
            <boxGeometry args={[0.07, 0.07, 0.07]} />
            <meshBasicMaterial color="#bae6fd" transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    </>
  );
};
