// src/simulation/components/fish/FishInteraction.jsx
// Renders interactive spine highlight spheres on the fish

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { SPINE_CONFIG } from '../../config/fishConfig'

/**
 * A single removable spine point
 */
function SpinePoint({ position, color, highlightColor, removed, onRemove, index }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)

  useFrame(({ clock }) => {
    if (!meshRef.current || removed) return
    // Pulse animation
    const pulse = Math.sin(clock.elapsedTime * 3 + index * 0.3) * 0.002
    meshRef.current.scale.setScalar(1 + pulse)
  })

  if (removed) return null

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onRemove(index) }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <sphereGeometry args={[0.012, 5, 4]} />
      <meshStandardMaterial
        color={hovered ? '#ffffff' : (hovered ? highlightColor : color)}
        emissive={hovered ? highlightColor : color}
        emissiveIntensity={hovered ? 0.9 : 0.5}
        roughness={0.3}
      />
    </mesh>
  )
}

/**
 * Renders spine groups for a specific bone type.
 * Only visible when activeType matches.
 */
function SpineGroup({ type, config, removedSet, onRemove, active }) {
  if (!active) return null

  return (
    <group name={`spines_${type}`}>
      {config.positions.map((pos, i) => (
        <SpinePoint
          key={i}
          index={i}
          position={pos}
          color={config.color}
          highlightColor={config.highlightColor}
          removed={removedSet.has(i)}
          onRemove={(idx) => onRemove(type, idx)}
        />
      ))}
    </group>
  )
}

/**
 * FishInteraction
 * activeSpineType: 'dorsal' | 'ventral' | 'lateral' | null
 * onBoneRemove: (type, index) => void
 */
export function FishInteraction({
  fishPosition = [0, 0, 0],
  activeSpineType = null,
  removedBones = { dorsal: new Set(), ventral: new Set(), lateral: new Set() },
  onBoneRemove,
}) {
  return (
    <group position={fishPosition} name="fish_interaction">
      {Object.entries(SPINE_CONFIG).map(([type, config]) => (
        <SpineGroup
          key={type}
          type={type}
          config={config}
          removedSet={removedBones[type] ?? new Set()}
          onRemove={onBoneRemove}
          active={activeSpineType === type}
        />
      ))}
    </group>
  )
}
