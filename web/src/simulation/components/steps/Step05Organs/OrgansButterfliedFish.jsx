// web/src/simulation/components/steps/Step05Organs/OrgansButterfliedFish.jsx
// Static butterflied fish on the cutting board — mirrors Step05Preview.jsx exactly.
// Uses DaingCuttedFins.opt.glb (same model as preview, NOT butterfliedBangus.opt.glb from Step06).

import { useMemo } from 'react'
import { useGLTF } from '../../../utils/useGLTFLocal'

import {
  FISH_POS_CB,
  FISH_ROTATION_Y,
  BUTTERFLIED_FLAT_TILT_X,
  BUTTERFLIED_FLAT_TILT_Z,
  BUTTERFLIED_LIFT,
  BUTTERFLIED_BACK_SHIFT,
} from './organsConfig'

const MODEL_PATH = '/models/DaingCuttedFins.opt.glb'

useGLTF.preload(MODEL_PATH)

export function OrgansButterfliedFish() {
  const { scene } = useGLTF(MODEL_PATH)

  const clone = useMemo(() => {
    const c = scene.clone()
    c.traverse((obj) => {
      if (!obj.isMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      obj.material = src.length === 1
        ? (() => {
            const m = src[0].clone()
            m.transparent = false
            m.opacity     = 1
            m.depthWrite  = true
            m.visible     = true
            m.needsUpdate = true
            return m
          })()
        : src.map((m) => {
            const n = m.clone()
            n.transparent = false
            n.opacity     = 1
            n.depthWrite  = true
            n.visible     = true
            n.needsUpdate = true
            return n
          })
    })
    return c
  }, [scene])

  return (
    <group position={FISH_POS_CB}>
      <primitive
        object={clone}
        scale={1.0}
        position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
        rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
      />
    </group>
  )
}
