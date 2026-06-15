// src/simulation/components/environment/Sink.jsx
import { memo } from 'react'
import * as THREE from 'three'
import { IntegratedFaucet } from './IntegratedFaucet'

// Module-level materials — created once, never re-allocated across re-renders.
// Without this, each re-render (e.g. when waterOn changes at the Step 1→2
// boundary) created 7 new MeshStandardMaterial instances, triggering GPU
// material re-uploads on the same frame as the cinematic transition.
const M_BASIN = new THREE.MeshStandardMaterial({ color: '#9eaab5', roughness: 0.35, metalness: 0.6 })
const M_DRAIN = new THREE.MeshStandardMaterial({ color: '#606870', roughness: 0.5,  metalness: 0.7 })

/**
 * Standalone Sink component — stainless double basin.
 * waterOn: bool — passed down to faucet
 */
export const Sink = memo(function Sink({ position = [0, 0, 0], waterOn = false }) {
  return (
    <group position={position} name="sink">
      {/* Main sink body */}
      <mesh receiveShadow material={M_BASIN}>
        <boxGeometry args={[0.75, 0.08, 0.45]} />
      </mesh>

      {/* Left basin */}
      <mesh position={[-0.185, -0.04, 0]} material={M_BASIN}>
        <boxGeometry args={[0.3, 0.12, 0.38]} />
      </mesh>

      {/* Right basin */}
      <mesh position={[0.185, -0.04, 0]} material={M_BASIN}>
        <boxGeometry args={[0.3, 0.12, 0.38]} />
      </mesh>

      {/* Centre divider */}
      <mesh position={[0, -0.01, 0]} material={M_BASIN}>
        <boxGeometry args={[0.04, 0.08, 0.38]} />
      </mesh>

      {/* Drain circles */}
      <mesh position={[-0.185, -0.095, 0]} material={M_DRAIN}>
        <cylinderGeometry args={[0.025, 0.025, 0.005, 8]} />
      </mesh>
      <mesh position={[0.185, -0.095, 0]} material={M_DRAIN}>
        <cylinderGeometry args={[0.025, 0.025, 0.005, 8]} />
      </mesh>

      {/* Faucet mounted on back edge */}
      <IntegratedFaucet position={[0, 0.1, -0.16]} waterOn={waterOn} />
    </group>
  )
})
