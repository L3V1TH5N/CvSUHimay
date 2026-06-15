// src/simulation/components/tools/WaterSpray.jsx
// Water-spray particle system for the washing steps.
//
// Optimization: the <points> mesh stays mounted for the entire lifetime of the
// component.  When active=false we set visible=false so Three.js skips the
// draw call entirely, but the BufferGeometry and PointsMaterial are never
// reallocated across hold/release cycles.
//
// activeRef (optional): pass a React.MutableRefObject<boolean> from the parent
// instead of a boolean `active` prop. When provided, visibility is managed
// entirely inside useFrame — no JSX prop change, no R3F reconciliation,
// no SimulationScene re-render on every cursor hover/unhover.

import { useRef, useMemo } from 'react'
import { useFrame }        from '@react-three/fiber'
import * as THREE          from 'three'

const PARTICLE_COUNT = 40

// `positionRef`, when provided, is a THREE.Vector3 ref whose value is copied
// into the points-mesh world position every frame. Used by Step 2/10 so the
// spray emits from the cursor's raycast hit point on the fish surface
// instead of a fixed faucet location. When omitted, the static `position`
// prop is used as before.
export function WaterSpray({ active = false, activeRef = null, position = [0, 0, 0], positionRef = null }) {
  const pointsRef = useRef()

  // Allocated once per mount — stable across hold/release cycles
  const { positions, velocities } = useMemo(() => {
    const positions  = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Stagger initial life so particles don't all reset at the same moment
      const life = Math.random()
      positions[i * 3]     = (Math.random() - 0.5) * 0.04
      positions[i * 3 + 1] = life * -0.15          // spread down from origin
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.04

      velocities.push({
        x:    (Math.random() - 0.5) * 0.005,
        y:    -(0.012 + Math.random() * 0.016),     // faster, more realistic fall
        z:    (Math.random() - 0.5) * 0.005,
        life,
        maxLife: 0.7 + Math.random() * 0.5,
      })
    }

    return { positions, velocities }
  }, [])

  useFrame(() => {
    if (!pointsRef.current) return

    // Follow the live cursor hit point if provided. Done outside the active
    // guard so the mesh is in the correct location the moment it becomes
    // visible — no jump from FAUCET_POS to the cursor on first hit.
    if (positionRef?.current) {
      pointsRef.current.position.copy(positionRef.current)
    }

    // When activeRef is provided, read liveness from the ref every frame and
    // manage the mesh's visible flag imperatively. This avoids a JSX prop
    // change + React reconciliation cascade on every hover/unhover event.
    const isActive = activeRef !== null ? activeRef.current : active
    if (pointsRef.current.visible !== isActive) {
      pointsRef.current.visible = isActive
    }

    if (!isActive) return
    const pos = pointsRef.current.geometry.attributes.position.array

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const v = velocities[i]
      v.life -= 0.022

      if (v.life <= 0) {
        // Reset to faucet origin with fresh random velocity
        pos[i * 3]     = (Math.random() - 0.5) * 0.04
        pos[i * 3 + 1] = 0
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.04
        v.x    = (Math.random() - 0.5) * 0.005
        v.y    = -(0.012 + Math.random() * 0.016)
        v.z    = (Math.random() - 0.5) * 0.005
        v.life = v.maxLife
      } else {
        pos[i * 3]     += v.x
        pos[i * 3 + 1] += v.y
        pos[i * 3 + 2] += v.z
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  // Keep mesh mounted; Three.js skips the draw call when visible=false.
  // When activeRef is provided, visible starts false and useFrame owns it.
  // When using the legacy boolean `active` prop, JSX sets the initial state.
  return (
    <points ref={pointsRef} position={position} visible={activeRef !== null ? false : active}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#88ccff"
        size={0.02}
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
