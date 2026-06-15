// src/simulation/components/steps/Step07DorsalBones/Step07BoneCluster.jsx
//
// Self-loading dorsal bone cluster for Step 7.
// Board-boundary auto-discard: bone pops (scale → 0) when the cursor exits
// the cutting board XZ footprint. Releasing over the board snaps the bone back.
// No trash panel — same interaction model as Step 6 rib bones.
//
// Optimization notes:
//   • One BoxGeometry + one transparent MeshBasicMaterial drives all 88 hit
//     volumes — 87× fewer GPU resource allocations than per-bone clones.
//   • Per-frame scratch vectors are allocated once via useMemo.
//   • Bones load from the atlas cache; second+ mounts return instantly.

import { useRef, useEffect, useMemo, useState } from 'react'
import { useThree, useFrame }                   from '@react-three/fiber'
import * as THREE                               from 'three'

import { loadDorsalBones, BONE_MATERIAL } from './dorsalBonesLoader'
import { applyDorsalPositions }           from './dorsalBonesConfig'

// ── Interaction constants (mirrors Step07Preview.jsx) ────────────────────────
const BONE_SCALE   = 0.28
const HIT_PADDING  = 2.2
const DRAG_LERP    = 0.55
const SNAP_LERP    = 0.18
const SNAP_EPS_SQ  = 1e-4
const DRAG_PLANE_Y = 1.05
const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)

// Chopping board world-space XZ footprint — leaving this area discards the bone.
const BOARD_MIN_X = 0.55   // 1.0 - 0.45
const BOARD_MAX_X = 1.45   // 1.0 + 0.45
const BOARD_MIN_Z = -2.44  // -2.19 - 0.25
const BOARD_MAX_Z = -1.94  // -2.19 + 0.25

// Module-level shared geometry + material — created once, reused across all
// instances and remounts (stable references prevent GPU re-upload).
const HIT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

export function Step07BoneCluster({
  removedRef,         // Set of removed srcIndex values
  currentDragSrcRef,  // srcIndex of the active drag bone, or null
  snappingRef,        // Set of srcIndex values currently snapping back
  removedVersion,     // count from parent — triggers visibility sync
  onBoneGrab,         // (srcIdx) → void
  onBoneDiscarded,    // (srcIdx) → void — called when bone exits board footprint
}) {
  const clusterGroupRef = useRef()
  const boneGroupRefs   = useRef([])
  const indexBySrcRef   = useRef(new Map())
  const [bones, setBones] = useState(null)
  const { camera, gl }    = useThree()

  // Keep callback ref stable so useFrame closure never captures a stale version.
  const onBoneDiscardedRef = useRef(onBoneDiscarded)
  useEffect(() => { onBoneDiscardedRef.current = onBoneDiscarded }, [onBoneDiscarded])

  // Window-level cursor tracking — drag continues even when cursor leaves canvas.
  const cursorRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e) => { cursorRef.current.x = e.clientX; cursorRef.current.y = e.clientY }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Load all 88 dorsal bone geometries once; apply config position overrides.
  // The loader self-starts on module import so this resolves instantly on re-entries.
  useEffect(() => {
    let cancelled = false
    loadDorsalBones().then((entries) => {
      if (cancelled) return
      const positioned = applyDorsalPositions(entries)
      const ok  = []
      const map = new Map()
      for (let i = 0; i < positioned.length; i++) {
        const e = positioned[i]
        if (!e) continue
        map.set(i, ok.length)
        ok.push({ ...e, srcIndex: i })
      }
      indexBySrcRef.current = map
      setBones(ok)
    })
    return () => { cancelled = true }
  }, [])

  // Sync bone visibility whenever a bone is removed (removedVersion is the trigger).
  useEffect(() => {
    if (!bones) return
    const removed = removedRef.current
    for (let i = 0; i < bones.length; i++) {
      const g = boneGroupRefs.current[i]
      if (!g) continue
      const shouldShow = !removed.has(bones[i].srcIndex)
      if (g.visible !== shouldShow) {
        g.visible = shouldShow
        if (shouldShow) g.scale.setScalar(1) // restore scale if bone is re-shown
      }
    }
  }, [bones, removedVersion, removedRef])

  // Per-frame scratch vectors — allocated once per mount, never re-created.
  const ndc      = useMemo(() => new THREE.Vector2(), [])
  const ray      = useMemo(() => new THREE.Raycaster(), [])
  const hitWorld = useMemo(() => new THREE.Vector3(), [])
  const hitLocal = useMemo(() => new THREE.Vector3(), [])
  const restTmp  = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!bones || !clusterGroupRef.current) return

    // ── Cursor-follow for the active drag bone ──────────────────────────────
    const dragSrc = currentDragSrcRef.current
    if (dragSrc != null) {
      const arrIdx = indexBySrcRef.current.get(dragSrc)
      const g      = arrIdx != null ? boneGroupRefs.current[arrIdx] : null
      if (g) {
        const rect = gl.domElement.getBoundingClientRect()
        ndc.x =  ((cursorRef.current.x - rect.left) / rect.width)  * 2 - 1
        ndc.y = -((cursorRef.current.y - rect.top)  / rect.height) * 2 + 1
        ray.setFromCamera(ndc, camera)
        if (ray.ray.intersectPlane(DRAG_PLANE, hitWorld)) {
          hitLocal.copy(hitWorld)
          clusterGroupRef.current.worldToLocal(hitLocal)
          g.position.lerp(hitLocal, DRAG_LERP)

          // Auto-discard once cursor exits the cutting board XZ footprint.
          if (
            hitWorld.x < BOARD_MIN_X || hitWorld.x > BOARD_MAX_X ||
            hitWorld.z < BOARD_MIN_Z || hitWorld.z > BOARD_MAX_Z
          ) {
            g.scale.setScalar(0)
            onBoneDiscardedRef.current(dragSrc)
          }
        }
      }
    }

    // ── Snap-back for released-but-not-discarded bones ──────────────────────
    const snapping = snappingRef.current
    if (snapping.size > 0) {
      const toRemove = []
      snapping.forEach((srcIdx) => {
        const arrIdx = indexBySrcRef.current.get(srcIdx)
        if (arrIdx == null) { toRemove.push(srcIdx); return }
        const g = boneGroupRefs.current[arrIdx]
        if (!g) { toRemove.push(srcIdx); return }
        restTmp.copy(bones[arrIdx].position)
        g.position.lerp(restTmp, SNAP_LERP)
        if (g.position.distanceToSquared(restTmp) < SNAP_EPS_SQ) {
          g.position.copy(restTmp)
          toRemove.push(srcIdx)
        }
      })
      for (let i = 0; i < toRemove.length; i++) snapping.delete(toRemove[i])
    }
  })

  if (!bones) return null

  return (
    <group ref={clusterGroupRef}>
      {bones.map((bone, i) => {
        const { geometry, position, size, srcIndex } = bone
        const rot      = bone.rotation        ?? [0, 0, 0]
        const visScale = BONE_SCALE * (bone.scaleMultiplier ?? 1)
        const hx = Math.max(size.x, 0.005) * HIT_PADDING * visScale
        const hy = Math.max(size.y, 0.005) * HIT_PADDING * visScale
        const hz = Math.max(size.z, 0.005) * HIT_PADDING * visScale
        return (
          <group
            key={srcIndex}
            ref={(el) => { boneGroupRefs.current[i] = el }}
            position={[position.x, position.y, position.z]}
            rotation={rot}
          >
            <mesh geometry={geometry} material={BONE_MATERIAL} scale={visScale} />
            <mesh
              geometry={HIT_GEOMETRY}
              material={HIT_MATERIAL}
              scale={[hx, hy, hz]}
              onPointerDown={(e) => { e.stopPropagation(); onBoneGrab(srcIndex) }}
            />
          </group>
        )
      })}
    </group>
  )
}
