// src/simulation/components/environment/IntegratedFaucet.jsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '../../utils/useGLTFLocal'
import * as THREE from 'three'

/**
 * Faucet with optional running water stream.
 * Falls back to procedural geometry if no GLB provided.
 * waterOn: bool — toggles the animated water stream
 */
export function IntegratedFaucet({ position = [0, 0, 0], waterOn = false }) {
  const waterRef      = useRef()
  const splashRef     = useRef()
  // Track previous waterOn so we only write .visible when it actually changes,
  // avoiding a redundant Three.js property write on every frame while waterOn
  // is stable (which is the case for the entire duration of Step 2/10).
  const prevWaterOnRef = useRef(waterOn)

  useFrame(() => {
    if (!waterRef.current) return
    if (prevWaterOnRef.current !== waterOn) {
      prevWaterOnRef.current = waterOn
      waterRef.current.visible = waterOn
      if (splashRef.current) splashRef.current.visible = waterOn
    }
    // Per-frame material.opacity writes removed — each write flushes a GPU uniform
    // upload every frame for the entire duration of Step 2. Static opacity is
    // visually equivalent and saves ~60 material writes/s.
  })

  // Try to load faucet GLB, fall back to procedural
  let faucetMesh = null
  try {
    // Only used if file exists
    // const { scene } = useGLTF('/equipments/faucet.glb')
    // faucetMesh = <primitive object={scene.clone()} scale={0.5} />
  } catch (_) {}

  return (
    <group position={position} name="integrated_faucet">

      {/* ── Faucet body (procedural) ── */}
      {/* Base plate */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.04, 7]} />
        <meshStandardMaterial color="#c8d0d8" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* Neck riser */}
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.016, 0.018, 0.14, 6]} />
        <meshStandardMaterial color="#c8d0d8" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* Spout arm — angled forward */}
      <mesh position={[0, 0.165, 0.06]} rotation={[0.45, 0, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.13, 6]} />
        <meshStandardMaterial color="#c8d0d8" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* Spout tip */}
      <mesh position={[0, 0.14, 0.14]}>
        <cylinderGeometry args={[0.017, 0.013, 0.025, 6]} />
        <meshStandardMaterial color="#b0bcc8" roughness={0.15} metalness={0.9} />
      </mesh>

      {/* Hot/cold handles */}
      <mesh position={[-0.07, 0.03, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.04, 6]} />
        <meshStandardMaterial color="#c0c8d0" roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh position={[-0.07, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.055, 5]} />
        <meshStandardMaterial color="#c0c8d0" roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh position={[0.07, 0.03, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.04, 6]} />
        <meshStandardMaterial color="#c0c8d0" roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh position={[0.07, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.055, 5]} />
        <meshStandardMaterial color="#c0c8d0" roughness={0.25} metalness={0.8} />
      </mesh>

      {/* ── Water stream ── */}
      <mesh ref={waterRef} position={[0, 0.07, 0.14]} visible={waterOn}>
        <cylinderGeometry args={[0.008, 0.014, 0.14, 6]} />
        <meshStandardMaterial
          color="#88ccff"
          transparent
          opacity={0.55}
          roughness={0.05}
          metalness={0.1}
        />
      </mesh>

      {/* Water splash at basin level — always mounted, toggled via ref in useFrame
          to avoid geometry/material allocation on every waterOn flip. */}
      <mesh ref={splashRef} position={[0, -0.08, 0.14]} visible={waterOn}>
        <sphereGeometry args={[0.03, 5, 4]} />
        <meshStandardMaterial color="#aaddff" transparent opacity={0.4} roughness={0.1} />
      </mesh>
    </group>
  )
}
