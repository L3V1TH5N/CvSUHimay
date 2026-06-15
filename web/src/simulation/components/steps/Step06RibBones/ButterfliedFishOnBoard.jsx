// src/simulation/components/steps/Step06RibBones/ButterfliedFishOnBoard.jsx

import { useMemo } from 'react'
import { useGLTF } from '../../../utils/useGLTFLocal'

export const FISH_POS_CB             = [0.93, 0.97, -2.19]
const FISH_ROTATION_Y                = Math.PI / 2
const BUTTERFLIED_SCALE              = 1.0
const BUTTERFLIED_FLAT_TILT_X        = -0.05
const BUTTERFLIED_FLAT_TILT_Z        = 0.0
export const BUTTERFLIED_LIFT        = 0.02
export const BUTTERFLIED_BACK_SHIFT  = 0.0

// Scale applied to the bone-slot group so rib bone local positions match world space.
// Mirrors Step06Preview.jsx BUTTERFLIED_SCALE = 0.24 (bone group only — fish stays at 1.0).
const BONE_SLOT_SCALE = 0.24

/**
 * Renders the butterflied bangus flat on the cutting board.
 * Accepts an optional `boneSlot` — a R3F subtree rendered in the same
 * coordinate frame as the fish (position/rotation) at BONE_SLOT_SCALE so
 * rib bone positions from Step06Preview.jsx translate directly.
 */
export function ButterfliedFishOnBoard({ boneSlot }) {
  const { scene } = useGLTF('/models/DaingCuttedFins.opt.glb')

  const clone = useMemo(() => {
    const c = scene.clone()
    c.traverse((obj) => {
      if (!obj.isMesh) return
      obj.castShadow    = true
      obj.receiveShadow = false
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      const mats = src.map((m) => {
        const n = m.clone()
        n.transparent = false
        n.opacity     = 1
        n.depthWrite  = true
        n.visible     = true
        n.needsUpdate = true
        return n
      })
      obj.material = mats.length === 1 ? mats[0] : mats
    })
    return c
  }, [scene])

  return (
    <group position={FISH_POS_CB}>
      <primitive
        object={clone}
        scale={BUTTERFLIED_SCALE}
        position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
        rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
      />
      {boneSlot && (
        <group
          position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
          rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
          scale={BONE_SLOT_SCALE}
        >
          {boneSlot}
        </group>
      )}
    </group>
  )
}

useGLTF.preload('/models/DaingCuttedFins.opt.glb')