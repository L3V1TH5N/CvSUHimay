// src/simulation/components/steps/Step02Washing/WashCursorTracker.jsx
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE   from 'three'
import { getCachedFishMeshes, getCachedHitMesh, getCachedFishGroup } from '../../fish/fishMeshCache'

// ~0.0001 NDC/frame ≈ 6 px/s on 1080p — mirrors Step02Preview threshold
const MOVE_THRESHOLD_SQ = 1e-8

export function WashCursorTracker({ fsmRef, hitPointRef, isHittingRef, onHoldChange, onWashChange }) {
  const wasHittingRef = useMemo(() => ({ current: false }), [])
  const wasWashingRef = useMemo(() => ({ current: false }), [])
  const prevPointer   = useMemo(() => new THREE.Vector2(), [])
  const raycaster     = useMemo(() => new THREE.Raycaster(), [])
  // Pre-allocated hit result array — reused every frame to avoid GC pressure.
  // intersectObject() accepts an optional target array it pushes into rather
  // than allocating a new one each call.
  const hitsBuffer    = useMemo(() => [], [])

  useFrame(({ scene, camera, pointer }, dt) => {
    // ── Ensure caches are warm ───────────────────────────────────────────────
    // getCachedFishMeshes is the trigger that also populates _hitMesh and
    // _fishGroup as side-effects. Returns null when the group is invisible
    // (in-flight cinematic) — both cases are correct early-outs.
    const meshList = getCachedFishMeshes(scene)
    if (!meshList) return

    // ── Group-visibility guard ───────────────────────────────────────────────
    const fishGroup = getCachedFishGroup()
    if (fishGroup && !fishGroup.visible) return

    // ── Bounding-box hit mesh ────────────────────────────────────────────────
    // FishModel renders an invisible BoxGeometry collider sized to 1.15× the
    // fish bounding box. 12 triangles vs. potentially thousands in the full
    // visual geometry. For washing, hit-box accuracy is more than sufficient —
    // the fish is large relative to the cursor precision needed.
    const hitMesh = getCachedHitMesh()
    if (!hitMesh) return

    // ── Movement gate ────────────────────────────────────────────────────────
    const dx = pointer.x - prevPointer.x
    const dy = pointer.y - prevPointer.y
    const moving = (dx * dx + dy * dy) > MOVE_THRESHOLD_SQ
    prevPointer.set(pointer.x, pointer.y)

    // ── Raycast: O(12 triangles) vs O(n_full_geometry) ──────────────────────
    raycaster.setFromCamera(pointer, camera)
    hitsBuffer.length = 0
    raycaster.intersectObject(hitMesh, false, hitsBuffer)

    const hitting = hitsBuffer.length > 0
    if (hitting) hitPointRef.current.copy(hitsBuffer[0].point)
    isHittingRef.current = hitting

    const washing = hitting && moving

    // hitting → drives spray visibility + idle emissive state
    if (hitting !== wasHittingRef.current) {
      wasHittingRef.current = hitting
      onHoldChange(hitting)
    }

    // washing → drives FSM fill/drain
    if (washing !== wasWashingRef.current) {
      wasWashingRef.current = washing
      if (washing) fsmRef.current?.startHold()
      else         fsmRef.current?.stopHold()
      onWashChange?.(washing)
    }

    // Tick FSM after startHold/stopHold so the current frame's hold state is
    // applied immediately — no one-frame lag on state transitions.
    fsmRef.current?.tick(dt)
  })

  return null
}
