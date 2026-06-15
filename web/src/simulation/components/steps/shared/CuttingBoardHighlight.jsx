// src/simulation/components/steps/CuttingBoardHighlight.jsx
// dragProgressRef (0-1) intensifies the glow as the fish approaches.
// All animation runs in useFrame with zero per-frame allocation.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CuttingBoardHighlight({
  position = [0, 0, 0],
  visible  = false,
  dragProgressRef = null,   // optional ref to 0-1 approach progress
}) {
  const ringRef  = useRef()
  const ring2Ref = useRef()
  const glowRef  = useRef()
  const arrowRef = useRef()

  useFrame(({ clock }) => {
    if (!visible) return
    const t    = clock.elapsedTime
    const drag = dragProgressRef?.current ?? 0

    // boost: 1× at rest → 2.8× when fish is directly above the board
    const boost = 1 + drag * 1.8
    const pulse = Math.sin(t * (2.5 + drag * 3)) * 0.5 + 0.5   // 0-1

    if (ringRef.current) {
      const s = 1 + pulse * 0.06 * boost
      ringRef.current.scale.set(s, 1, s)
      ringRef.current.material.opacity        = THREE.MathUtils.clamp(0.4 + pulse * 0.4 * boost, 0, 1)
      ringRef.current.material.emissiveIntensity = 1.2 * boost
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.y               = t * (-0.8 - drag * 1.2)
      ring2Ref.current.material.opacity         = THREE.MathUtils.clamp(0.25 + pulse * 0.35 * boost, 0, 1)
      ring2Ref.current.material.emissiveIntensity = 1.0 * boost
    }

    if (glowRef.current) {
      glowRef.current.material.opacity = THREE.MathUtils.clamp(0.08 + drag * 0.22, 0, 0.55)
      glowRef.current.material.emissiveIntensity = 0.3 + drag * 0.8
    }

    if (arrowRef.current) {
      arrowRef.current.position.y = 0.18 + Math.sin(t * (3 + drag * 2)) * (0.025 + drag * 0.04)
      // Arrow fades away once fish is nearly there
      arrowRef.current.children.forEach(c => {
        if (c.material) c.material.opacity = THREE.MathUtils.clamp(1 - drag * 1.2, 0, 1)
      })
    }
  })

  if (!visible) return null

  return (
    <group position={position} name="cutting_board_highlight">
      {/* Outer glow ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.56, 0.018, 4, 32]} />
        <meshStandardMaterial
          color="#f5c842" emissive="#f5c842"
          emissiveIntensity={1.2} transparent opacity={0.6}
        />
      </mesh>

      {/* Counter-rotating inner ring */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.010, 4, 16]} />
        <meshStandardMaterial
          color="#4ecd71" emissive="#4ecd71"
          emissiveIntensity={1.0} transparent opacity={0.4}
        />
      </mesh>

      {/* Ground glow patch — brightens as fish descends */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.52, 20]} />
        <meshStandardMaterial
          color="#f5c842" emissive="#f5c842"
          emissiveIntensity={0.3} transparent opacity={0.12}
        />
      </mesh>

      {/* Down arrow — fades as fish approaches */}
      <group ref={arrowRef}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.08, 6]} />
          <meshStandardMaterial color="#f5c842" emissive="#f5c842" emissiveIntensity={1.0} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.04, 0.07, 6]} />
          <meshStandardMaterial color="#f5c842" emissive="#f5c842" emissiveIntensity={1.0} transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  )
}
