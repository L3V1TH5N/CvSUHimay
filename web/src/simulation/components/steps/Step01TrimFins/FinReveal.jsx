// src/simulation/components/steps/Step01TrimFins/FinReveal.jsx
// ── COPIED FIN REVEAL ANIMATION (Step01Preview.jsx) ──────────────────────────
// Lazy-mounted only after all five cuts register. Each fin GLB follows a
// sin(p × π) bell-curve so they peak (fully opaque) exactly when bangus3 and
// BangusCUTTEDFIN are equally blended, then fade back to 0 as BangusCUTTEDFIN
// completes its reveal. Produces a single cinematic beat.

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '../../../utils/useGLTFLocal'
import {
  FINS, FISH_POS, FISH_SCALE, FISH_ROT_Y, TRANSITION_DURATION,
} from './step01Config'

// Preload all five fin GLBs at module load (no-op if already cached).
FINS.forEach((fin) => useGLTF.preload(fin.glb))

// Clone scene + prep mats for opacity animation (starts invisible).
function cloneInvisible(scene) {
  const c = scene.clone()
  c.traverse((obj) => {
    if (!obj.isMesh) return
    const src = Array.isArray(obj.material) ? obj.material : [obj.material]
    const prep = (m) => {
      const n = m.clone()
      n.transparent = true; n.opacity = 0; n.depthWrite = false
      n.visible = true;     n.needsUpdate = true
      return n
    }
    obj.material = src.length === 1 ? prep(src[0]) : src.map(prep)
  })
  return c
}

// ── FinRevealItem ────────────────────────────────────────────────────────────
// Loads one fin GLB and registers its meshes into the shared meshesRef owned
// by FinReveal. Suspends via useGLTF until the asset resolves — the parent
// Suspense boundary keeps the rest of the scene rendering normally.
function FinRevealItem({ fin, meshesRef }) {
  const { scene } = useGLTF(fin.glb)
  const clone = useMemo(() => cloneInvisible(scene), [scene])

  const worldPos = useMemo(() => [
    FISH_POS[0] + fin.offset[0],
    FISH_POS[1] + fin.offset[1],
    FISH_POS[2] + fin.offset[2],
  ], [fin])

  useEffect(() => {
    const registered = []
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((mat) => { mat.opacity = 0 })
      meshesRef.current.push(obj)
      registered.push(obj)
    })
    // Cleanup: remove this item's meshes on unmount (prevents unbounded growth
    // across HMR remounts / React Strict Mode double-invoke).
    return () => {
      meshesRef.current = meshesRef.current.filter((m) => !registered.includes(m))
    }
  }, [clone, meshesRef])

  return (
    <group position={worldPos} rotation={fin.rotation ?? [0, 0, 0]}>
      <primitive object={clone} scale={FISH_SCALE} rotation={[0, FISH_ROT_Y, 0]} />
    </group>
  )
}

// ── FinReveal (parent) ───────────────────────────────────────────────────────
// Drives the bell-curve opacity for every registered fin mesh.
export function FinReveal({ transitionRef }) {
  const meshesRef   = useRef([])
  const progressRef = useRef(0)

  useFrame((_, dt) => {
    if (!transitionRef.current) return
    if (progressRef.current >= 1) return
    progressRef.current = Math.min(1, progressRef.current + dt / TRANSITION_DURATION)
    const opacity = Math.sin(progressRef.current * Math.PI)
    meshesRef.current.forEach((m) => {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach((mat) => { mat.opacity = opacity })
    })
  })

  return (
    <>
      {FINS.map((fin) => (
        <FinRevealItem key={fin.id} fin={fin} meshesRef={meshesRef} />
      ))}
    </>
  )
}
