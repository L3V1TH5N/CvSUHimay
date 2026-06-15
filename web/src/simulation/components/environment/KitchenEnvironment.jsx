// src/simulation/components/environment/KitchenEnvironment.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Optimizations applied:
//  • All MeshStandardMaterial objects created ONCE at module level (not per render)
//  • Sub-components wrapped with React.memo → only re-render when their props change
//  • Static room/cabinet geometry never re-renders (no props)
//  • Only Sink and CuttingBoard receive changing props (waterOn / highlighted)
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from 'react'
import * as THREE from 'three'
import { ContactShadows } from '@react-three/drei'
import { Sink } from './Sink'
import { Lighting } from './Lighting'

// ── Module-level materials (created once, shared across all instances) ────────
const M = {
  wood:      new THREE.MeshStandardMaterial({ color: '#8B6914', roughness: 0.85 }),
  counter:   new THREE.MeshStandardMaterial({ color: '#c8c4bc', roughness: 0.50, metalness: 0.05 }),
  metal:     new THREE.MeshStandardMaterial({ color: '#9eaab5', roughness: 0.35, metalness: 0.60 }),
  wall:      new THREE.MeshStandardMaterial({ color: '#e0dbd3', roughness: 0.95, side: THREE.FrontSide }),
  floor:     new THREE.MeshStandardMaterial({ color: '#b8b0a0', roughness: 0.80 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.50, metalness: 0.70 }),
  ceramic:   new THREE.MeshStandardMaterial({ color: '#f0eeec', roughness: 0.30 }),
  chrome:    new THREE.MeshStandardMaterial({ color: '#d0d8e0', roughness: 0.15, metalness: 0.90 }),
  white:     new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.60 }),
  woodDark:  new THREE.MeshStandardMaterial({ color: '#5a3d10', roughness: 0.90 }),
  glass:     new THREE.MeshStandardMaterial({ color: '#88ccee', roughness: 0.05, metalness: 0.10, transparent: true, opacity: 0.35 }),
  rug:       new THREE.MeshStandardMaterial({ color: '#6b4c2a', roughness: 1.00 }),
  rugDining: new THREE.MeshStandardMaterial({ color: '#8b3a2a', roughness: 1.00 }),
}

// ── Geometry helpers — BoxGeometry & CylinderGeometry are cheap, but
//    for repeated identical geometry we reuse the same instance. ────────────
const GEOM = {
  baseboard: new THREE.BoxGeometry(1, 0.11, 0.06), // will be scaled per-instance
}

// ─────────────────────────────────────────────────────────────────────────────
// Room shell (walls, floor, ceiling, window, trim) — never changes
// ─────────────────────────────────────────────────────────────────────────────
const Room = memo(function Room() {
  const W = 6, H = 3, D = 5
  return (
    <group name="room">
      {/* Floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} material={M.floor}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]} material={M.wall}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* Back wall */}
      <mesh receiveShadow position={[0, H / 2, -D / 2]} material={M.wall}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* Left wall */}
      <mesh receiveShadow position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={M.wall}>
        <planeGeometry args={[D, H]} />
      </mesh>
      {/* Right wall */}
      <mesh receiveShadow position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={M.wall}>
        <planeGeometry args={[D, H]} />
      </mesh>
      {/* Front wall (with door gap) */}
      <mesh receiveShadow position={[-1.8, H / 2, D / 2]} rotation={[0, Math.PI, 0]} material={M.wall}>
        <planeGeometry args={[2.4, H]} />
      </mesh>
      <mesh receiveShadow position={[2.3, H / 2, D / 2]} rotation={[0, Math.PI, 0]} material={M.wall}>
        <planeGeometry args={[1.4, H]} />
      </mesh>
      <mesh receiveShadow position={[1.3, 2.55, D / 2]} rotation={[0, Math.PI, 0]} material={M.wall}>
        <planeGeometry args={[0.9, 0.9]} />
      </mesh>

      {/* Baseboards */}
      <mesh position={[0, 0.055, -D / 2 + 0.06]} material={M.white}><boxGeometry args={[W, 0.11, 0.06]} /></mesh>
      <mesh position={[-W / 2 + 0.06, 0.055, 0]} material={M.white}><boxGeometry args={[0.06, 0.11, D]} /></mesh>
      <mesh position={[W / 2 - 0.06, 0.055, 0]} material={M.white}><boxGeometry args={[0.06, 0.11, D]} /></mesh>

      {/* Ceiling light panels */}
      {[[0, -1.8], [0, 0.5]].map(([x, z], i) => (
        <group key={i} position={[x, H - 0.022, z]}>
          <mesh material={M.white}><boxGeometry args={[0.6, 0.04, 0.3]} /></mesh>
          <mesh position={[0, -0.025, 0]} material={M.glass}><boxGeometry args={[0.55, 0.005, 0.25]} /></mesh>
        </group>
      ))}
    </group>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Cabinet helpers — memoized so they never re-render
// ─────────────────────────────────────────────────────────────────────────────
const BaseCabinet = memo(function BaseCabinet({ position, width = 0.58 }) {
  const h = 0.88, d = 0.58
  return (
    <group position={position}>
      <mesh castShadow receiveShadow material={M.wood}><boxGeometry args={[width, h, d]} /></mesh>
      <mesh position={[width * 0.5 + 0.003, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={M.wood}>
        <boxGeometry args={[d - 0.04, h - 0.04, 0.018]} />
      </mesh>
      <mesh position={[width * 0.5 + 0.02, 0, d * 0.3]} material={M.chrome}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 5]} />
      </mesh>
      <mesh position={[0, -(h / 2) + 0.06, 0]} material={M.darkMetal}>
        <boxGeometry args={[width, 0.1, d + 0.01]} />
      </mesh>
    </group>
  )
})

const OverheadCabinet = memo(function OverheadCabinet({ position, width = 0.58 }) {
  const h = 0.72, d = 0.32
  return (
    <group position={position}>
      <mesh castShadow receiveShadow material={M.wood}><boxGeometry args={[width, h, d]} /></mesh>
      <mesh position={[width * 0.5 + 0.003, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={M.wood}>
        <boxGeometry args={[d - 0.02, h - 0.03, 0.016]} />
      </mesh>
      <mesh position={[width * 0.5 + 0.018, -(h * 0.3), 0]} material={M.chrome}>
        <boxGeometry args={[0.014, 0.1, 0.014]} />
      </mesh>
    </group>
  )
})

const Countertop = memo(function Countertop({ position, width = 1.0, depth = 0.62 }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow material={M.counter}><boxGeometry args={[width, 0.04, depth]} /></mesh>
      <mesh position={[0, 0.12, -(depth / 2) + 0.01]} material={M.counter}><boxGeometry args={[width, 0.28, 0.015]} /></mesh>
    </group>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Appliances — static, memoized
// ─────────────────────────────────────────────────────────────────────────────
const Refrigerator = memo(function Refrigerator({ position }) {
  return (
    <group position={position} rotation={[0, -Math.PI / 2, 0]} name="refrigerator">
      <mesh castShadow receiveShadow material={M.metal}><boxGeometry args={[0.7, 1.85, 0.65]} /></mesh>
      <mesh position={[0.351, 0.42, 0]} material={M.chrome}><boxGeometry args={[0.004, 0.9, 0.62]} /></mesh>
      <mesh position={[0.351, -0.62, 0]} material={M.chrome}><boxGeometry args={[0.004, 0.55, 0.62]} /></mesh>
      <mesh position={[0.375, 0.5, 0]} material={M.chrome}><boxGeometry args={[0.025, 0.35, 0.025]} /></mesh>
      <mesh position={[0.375, -0.48, 0]} material={M.chrome}><boxGeometry args={[0.025, 0.2, 0.025]} /></mesh>
    </group>
  )
})

const Stove = memo(function Stove({ position }) {
  return (
    <group position={position} name="stove">
      {/* Main body */}
      <mesh castShadow receiveShadow material={M.darkMetal}>
        <boxGeometry args={[0.6, 0.85, 0.59]} />
      </mesh>

      {/* Optional front (keep or delete depending on your design) */}
      <mesh position={[0.302, -0.08, 0]} material={M.darkMetal}>
        <boxGeometry args={[0.004, 0.28, 0.3]} />
      </mesh>

      <mesh position={[0.322, 0.08, 0]} material={M.darkMetal}>
        <boxGeometry args={[0.022, 0.025, 0.42]} />
      </mesh>
    </group>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Cutting board — receives highlighted prop → only this re-renders on step 2
// ─────────────────────────────────────────────────────────────────────────────
const CuttingBoard = memo(function CuttingBoard({ position, highlighted = false }) {
  // Create per-instance material only when highlight changes
  return (
    <group position={position} name="cutting_board">
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.022, 0.5]} />
        <meshStandardMaterial
          color={highlighted ? '#ffd966' : '#f3e5ab'}
          roughness={0.85}
          emissive={highlighted ? '#b8860b' : '#000000'}
          emissiveIntensity={highlighted ? 0.3 : 0}
        />
      </mesh>
      <mesh position={[0.42, 0, 0]}>
        <boxGeometry args={[0.06, 0.029, 0.12]} />
        <meshStandardMaterial color="#5a3d10" roughness={0.9} />
      </mesh>
    </group>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Dining furniture — static, memoized
// ─────────────────────────────────────────────────────────────────────────────
const DiningTable = memo(function DiningTable({ position }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.76, 0]} material={M.wood}><boxGeometry args={[1.1, 0.045, 0.7]} /></mesh>
      {[[-0.48, -0.29], [-0.48, 0.29], [0.48, -0.29], [0.48, 0.29]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.33, z]} material={M.woodDark}><boxGeometry args={[0.055, 0.66, 0.055]} /></mesh>
      ))}
    </group>
  )
})

const Chair = memo(function Chair({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow position={[0, 0.45, 0]} material={M.wood}><boxGeometry args={[0.42, 0.04, 0.42]} /></mesh>
      <mesh castShadow position={[-0.16, 0.72, -0.19]} material={M.woodDark}><boxGeometry args={[0.04, 0.55, 0.04]} /></mesh>
      <mesh castShadow position={[0.16, 0.72, -0.19]} material={M.woodDark}><boxGeometry args={[0.04, 0.55, 0.04]} /></mesh>
      <mesh castShadow position={[0, 0.88, -0.19]} material={M.woodDark}><boxGeometry args={[0.36, 0.05, 0.035]} /></mesh>
      <mesh castShadow position={[0, 0.96, -0.19]} material={M.woodDark}><boxGeometry args={[0.38, 0.04, 0.04]} /></mesh>
      {[[-0.17, -0.17], [-0.17, 0.17], [0.17, -0.17], [0.17, 0.17]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.22, z]} material={M.woodDark}><boxGeometry args={[0.04, 0.44, 0.04]} /></mesh>
      ))}
    </group>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// StaticKitchen — everything that never changes, isolated in one memo node
// so it's guaranteed not to re-render on waterOn / highlighted changes
// ─────────────────────────────────────────────────────────────────────────────
const StaticKitchen = memo(function StaticKitchen() {
  return (
    <group name="static_kitchen">
      <Room />

      {/* Counter system */}
      <group position={[0.2, 0, -2.19]} name="counter_system">
        <BaseCabinet position={[-1.3, 0.44, 0]} />
        <BaseCabinet position={[-0.7, 0.44, 0]} />
        <BaseCabinet position={[ 0.5, 0.44, 0]} />
        <BaseCabinet position={[ 1.1, 0.44, 0]} />
        <BaseCabinet position={[ 1.7, 0.44, 0]} />
        <Countertop position={[0.2, 0.92, 0]} width={3.2} depth={0.62} />
        <OverheadCabinet position={[-1.3, 2.11, 0]} />
        <OverheadCabinet position={[-0.7, 2.11, 0]} />
        <OverheadCabinet position={[ 0.9, 2.11, 0]} />
        <OverheadCabinet position={[ 1.5, 2.11, 0]} />
        <Stove position={[-0.04, 0.425, -0.01]} />
      </group>

      <Refrigerator position={[-2.5, 0.925, -2.1]} />

      {/* Dining area */}
      <DiningTable position={[1.8, 0, 0.8]} />
      <Chair position={[1.8, 0, 1.6]} rotation={[0, Math.PI, 0]} />
      <Chair position={[1.8, 0, 0.0]} />

      {/* Floor runner */}
      <mesh receiveShadow position={[0.2, 0.003, -1.2]} rotation={[-Math.PI / 2, 0, 0]} material={M.rug}>
        <planeGeometry args={[3.0, 0.7]} />
      </mesh>
      {/* Dining rug */}
      <mesh receiveShadow position={[1.8, 0.003, 0.8]} rotation={[-Math.PI / 2, 0, 0]} material={M.rugDining}>
        <planeGeometry args={[1.6, 1.4]} />
      </mesh>
    </group>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// KitchenEnvironment — public export
// Only Sink (waterOn) and CuttingBoard (highlighted) vary between renders
// ─────────────────────────────────────────────────────────────────────────────
export const KitchenEnvironment = memo(function KitchenEnvironment({
  waterOn = false,
  cuttingBoardHighlighted = false,
}) {
  return (
    <group name="kitchen_environment">
      <Lighting />
      <StaticKitchen />

      {/* Sink — re-renders only when waterOn changes */}
      <group position={[-0.45 + 0.2, 0.98, -2.19 - 0.03]} name="sink_mount">
        <Sink waterOn={waterOn} />
      </group>

      {/* Cutting board — re-renders only when highlighted changes.
          Centred on the counter at (1.0, -2.19); previously the +0.17 Z offset
          pushed its front edge past the countertop's front edge. */}
      <CuttingBoard
        position={[1.0, 0.942, -2.19]}
        highlighted={cuttingBoardHighlighted}
      />

      {/* Contact shadows — static, low quality for perf */}
      <ContactShadows
        position={[0, 0.001, 0]}
        width={7} height={5}
        far={1.2} blur={1.8}
        opacity={0.28}
        frames={1}
      />
    </group>
  )
})
