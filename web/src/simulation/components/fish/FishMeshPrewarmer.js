// src/simulation/components/fish/FishMeshPrewarmer.js
//
// Invisible R3F component that builds the bangus_fish mesh-list cache early
// (during Step 1) so Step 2's WashCursorTracker and FishMaterialEffect skip
// the per-component first-frame traverse. Mounted by useTrimFinsStep so the
// cache is warm by the time the FSM advances to Step 2.

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { getCachedFishMeshes, invalidateFishMeshCache } from './fishMeshCache'

// Polls the scene every animation frame for up to ~30 frames (~0.5 s) until
// the bangus_fish group is found. The fish is normally mounted by FishModel
// at sim ready, so the cache typically primes on the very first attempt.
//
// Invalidates the cache on mount so a sim restart (which remounts Step 1)
// rebuilds against the freshly-mounted fish group rather than holding stale
// mesh references from the previous session.
export function FishMeshPrewarmer() {
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (!scene) return
    invalidateFishMeshCache()
    let cancelled = false
    let tries     = 0
    const tick = () => {
      if (cancelled) return
      const list = getCachedFishMeshes(scene)
      if (list || ++tries > 30) return
      requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelled = true
      // Invalidate on unmount (step 1 ends) so step 2's WashCursorTracker
      // gets a fresh BangusCUTTEDFIN mesh list, not the stale bangus3 list.
      // Without this, raycasting hits bangus3 geometry frozen at the cutting
      // board position — far from the sink — and washing never registers.
      invalidateFishMeshCache()
    }
  }, [scene])

  return null
}
