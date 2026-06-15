// src/simulation/components/steps/Step01TrimFins/FishTransition.jsx
// ── COPIED MODEL TRANSITION LOGIC (Step01Preview.jsx → FishTransition) ───────
// Renders both fish models. When transitionRef.current flips to true, useFrame
// cross-fades bangus3.opt.glb → BangusCUTTEDFIN.opt.glb over TRANSITION_DURATION.
// All material changes are ref-driven — zero React state, zero re-renders.

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '../../../utils/useGLTFLocal'
import {
  FISH_POS, FISH_ROT_Y, FISH_SCALE, TRANSITION_DURATION,
} from './step01Config'

// Preload both fish models — fires at module load so the GLB cache is warm
// long before Step 1 activates. Identical to Step01Preview.jsx.
useGLTF.preload('/models/bangus3.opt.glb')
useGLTF.preload('/models/BangusCUTTEDFIN.opt.glb')

// Clone a scene and configure every mesh material for opacity animation.
function cloneForFade(scene) {
  const c = scene.clone()
  c.traverse((obj) => {
    if (!obj.isMesh) return
    const src = Array.isArray(obj.material) ? obj.material : [obj.material]
    const setupMat = (m) => {
      const n = m.clone()
      n.transparent = true; n.opacity = 1; n.depthWrite = false
      n.visible = true; n.needsUpdate = true
      return n
    }
    obj.material = src.length === 1 ? setupMat(src[0]) : src.map(setupMat)
  })
  return c
}

export function FishTransition({ transitionRef, transitionDoneRef }) {
  const { scene: sceneOrig } = useGLTF('/models/bangus3.opt.glb')
  const { scene: sceneCut  } = useGLTF('/models/BangusCUTTEDFIN.opt.glb')

  const origClone = useMemo(() => cloneForFade(sceneOrig), [sceneOrig])
  const cutClone  = useMemo(() => {
    const c = cloneForFade(sceneCut)
    // Start fully hidden (mesh-level) — shown when cross-fade begins.
    c.traverse((obj) => {
      if (!obj.isMesh) return
      obj.visible = false
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => { m.opacity = 0 })
    })
    return c
  }, [sceneCut])

  // ── MODEL ORIGIN AUTO-ALIGNMENT ──────────────────────────────────────────
  // Both GLBs may have been exported with different mesh origins. Shift the cut
  // fish by the bbox-center delta so its world center matches the original's.
  const cutLocalOffset = useMemo(() => {
    const origBox = new THREE.Box3().setFromObject(origClone)
    const cutBox  = new THREE.Box3().setFromObject(cutClone)
    const oc = origBox.getCenter(new THREE.Vector3())
    const cc = cutBox.getCenter(new THREE.Vector3())
    return oc.sub(cc)
  }, [origClone, cutClone])

  const progressRef   = useRef(0)
  const origMeshesRef = useRef([])
  const cutMeshesRef  = useRef([])

  useEffect(() => {
    origMeshesRef.current = []
    origClone.traverse((obj) => { if (obj.isMesh) origMeshesRef.current.push(obj) })
    cutMeshesRef.current = []
    cutClone.traverse((obj)  => { if (obj.isMesh) cutMeshesRef.current.push(obj) })
  }, [origClone, cutClone])

  useFrame((_, dt) => {
    if (!transitionRef.current) return
    if (progressRef.current >= 1) return

    progressRef.current = Math.min(1, progressRef.current + dt / TRANSITION_DURATION)
    const p = progressRef.current

    // Reveal cut meshes on the first frame of the fade.
    if (p > 0) {
      for (const m of cutMeshesRef.current) {
        if (!m.visible) m.visible = true
      }
    }

    for (const m of origMeshesRef.current) {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) mat.opacity = 1 - p
    }
    for (const m of cutMeshesRef.current) {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) mat.opacity = p
    }

    if (p >= 1) {
      for (const m of origMeshesRef.current) m.visible = false
      // BangusCUTTEDFIN fully shown — signal FinIncision to hide the slits.
      if (transitionDoneRef) transitionDoneRef.current = true
    }
  })

  return (
    <group position={FISH_POS} scale={FISH_SCALE} rotation={[0, FISH_ROT_Y, 0]}>
      <primitive object={origClone} />
      <group position={cutLocalOffset.toArray()}>
        <primitive object={cutClone} />
      </group>
    </group>
  )
}
