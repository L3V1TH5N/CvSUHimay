// src/simulation/components/steps/Step09LateralBones/useLateralBonesStep.jsx
//
// Step 9: lateral-spine extraction — drag-off-board discard mechanic.
// Ported from Step09Preview.jsx: real GLB bones, 42-entry LATERAL_BONES
// position table, world-space cursor drag, off-board = discard.
// FSM integration: logEvent, reportError, onComplete are preserved.

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { logEvent }               from '../../../fsm/eventStream'
import { EVENT_TYPE, ERROR_CLASS } from '../../../fsm/errors'
import { useFSMActions }           from '../../../fsm/FSMProvider'
import { useWrongToolGate }        from '../../../fsm/useWrongToolGate'
import { useStepToolVisible }      from '../../../fsm/useStepToolVisible'
import { HINT_STYLE } from '../shared/stepUtils'
import { ForcepsTool } from '../../tools/ForcepsTool'
import { ButterfliedFishOnBoard } from '../Step06RibBones/ButterfliedFishOnBoard'
import {
  loadLateralBones,
  BONE_MATERIAL,
  TOTAL_LATERAL_BONES,
} from './lateralBonesLoader'

const STEP_ID = 9

// ── Per-bone position/rotation/scale overrides (index 0 = bone 1) ───────────
// Tuned visually in Step09Preview.jsx; ported here verbatim so the production
// step renders identically to the preview. Bones 0–20 = left side (−X),
// bones 21–41 = right side (+X). Coordinates are butterflied-LOCAL space.
const LATERAL_BONES = Object.freeze([
  // Left side (−X), tail → head
  /*  1 */ { position: [-0.11, 0.02, -0.73], rotation: [-0.95, -1.90, 5], scale: 0.50 },
  /*  2 */ { position: [-0.09, 0.02, -0.69], rotation: [-0.95, -1.90, 5], scale: 0.50 },
  /*  3 */ { position: [-0.08, 0.02, -0.65], rotation: [-0.95, -1.90, 5], scale: 0.50 },
  /*  4 */ { position: [-0.07, 0.02, -0.61], rotation: [-0.95, -1.90, 5], scale: 0.50 },
  /*  5 */ { position: [-0.06, 0.03, -0.57], rotation: [-0.95, -1.90, 5], scale: 0.51 },
  /*  6 */ { position: [-0.03, 0.05, -0.52], rotation: [-0.95, -1.90, 5], scale: 0.51 },
  /*  7 */ { position: [ 0.00, 0.07, -0.47], rotation: [-0.95, -1.90, 5], scale: 0.51 },
  /*  8 */ { position: [ 0.02, 0.07, -0.42], rotation: [-0.95, -1.90, 5], scale: 0.51 },
  /*  9 */ { position: [ 0.04, 0.06, -0.37], rotation: [-0.95, -1.90, 5], scale: 0.51 },
  /* 10 */ { position: [ 0.06, 0.07, -0.33], rotation: [-0.95, -1.90, 5], scale: 0.51 },
  /* 11 */ { position: [ 0.07, 0.08, -0.29], rotation: [-0.95, -1.90, 5], scale: 0.51 },
  /* 12 */ { position: [ 0.10, 0.10, -0.25], rotation: [-0.95, -1.90, 5], scale: 0.51 },
  /* 13 */ { position: [ 0.12, 0.11, -0.21], rotation: [-0.95, -1.95, 5], scale: 0.51 },
  /* 14 */ { position: [ 0.15, 0.09, -0.19], rotation: [-0.95, -2.10, 5], scale: 0.51 },
  /* 15 */ { position: [ 0.15, 0.09, -0.15], rotation: [-0.95, -2.10, 5], scale: 0.51 },
  /* 16 */ { position: [ 0.16, 0.09, -0.11], rotation: [-0.95, -2.10, 5], scale: 0.51 },
  /* 17 */ { position: [ 0.17, 0.10, -0.07], rotation: [-0.95, -2.10, 5], scale: 0.51 },
  /* 18 */ { position: [ 0.18, 0.10, -0.03], rotation: [-0.95, -2.10, 5], scale: 0.51 },
  /* 19 */ { position: [ 0.19, 0.10,  0.01], rotation: [-0.95, -2.10, 5], scale: 0.51 },
  /* 20 */ { position: [ 0.20, 0.11,  0.05], rotation: [-0.95, -2.10, 5], scale: 0.51 },
  /* 21 */ { position: [ 0.21, 0.12,  0.09], rotation: [-0.95, -2.10, 5], scale: 0.51 },

  // Right side (+X), tail → head
  /* 22 */ { position: [-0.15, 0.02, -0.55], rotation: [0.35, 6.9, 0.0], scale: 0.50 },
  /* 23 */ { position: [-0.16, 0.02, -0.52], rotation: [0.35, 6.9, 0.0], scale: 0.50 },
  /* 24 */ { position: [-0.17, 0.02, -0.49], rotation: [0.35, 6.9, 0.0], scale: 0.50 },
  /* 25 */ { position: [-0.18, 0.02, -0.45], rotation: [0.35, 6.9, 0.0], scale: 0.50 },
  /* 26 */ { position: [-0.20, 0.03, -0.41], rotation: [0.35, 6.9, 0.0], scale: 0.51 },
  /* 27 */ { position: [-0.21, 0.04, -0.37], rotation: [0.35, 6.9, 0.0], scale: 0.51 },
  /* 28 */ { position: [-0.22, 0.05, -0.33], rotation: [0.35, 6.9, 0.0], scale: 0.51 },
  /* 29 */ { position: [-0.23, 0.06, -0.29], rotation: [0.35, 6.9, 0.0], scale: 0.51 },
  /* 30 */ { position: [-0.24, 0.06, -0.26], rotation: [0.35, 6.9, 0.0], scale: 0.51 },
  /* 31 */ { position: [-0.26, 0.07, -0.23], rotation: [0.35, 6.9, 0.0], scale: 0.51 },
  /* 32 */ { position: [-0.27, 0.07, -0.19], rotation: [0.35, 6.9, 0.0], scale: 0.51 },
  /* 33 */ { position: [-0.29, 0.08, -0.16], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 34 */ { position: [-0.29, 0.09, -0.12], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 35 */ { position: [-0.31, 0.10, -0.09], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 36 */ { position: [-0.31, 0.10, -0.05], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 37 */ { position: [-0.33, 0.11, -0.02], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 38 */ { position: [-0.34, 0.12,  0.02], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 39 */ { position: [-0.35, 0.12,  0.06], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 40 */ { position: [-0.35, 0.12,  0.10], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 41 */ { position: [-0.37, 0.13,  0.13], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
  /* 42 */ { position: [-0.38, 0.13,  0.17], rotation: [0.40, 6.9, 0.0], scale: 0.51 },
])

// Overlay LATERAL_BONES onto loader-generated entries. Returns a new array.
function applyPreviewPositions(entries) {
  const out = new Array(entries.length)
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (!e) { out[i] = null; continue }
    const ovr = LATERAL_BONES[i]
    if (ovr == null) { out[i] = e; continue }

    let posArr = null, rotArr = null, scaleMul = null
    if (Array.isArray(ovr)) {
      posArr = ovr
    } else {
      posArr   = ovr.position ?? null
      rotArr   = ovr.rotation ?? null
      scaleMul = ovr.scale    ?? null
    }

    const cloned = { ...e }
    if (Array.isArray(posArr) && posArr.length === 3)
      cloned.position = new THREE.Vector3(posArr[0], posArr[1], posArr[2])
    if (Array.isArray(rotArr) && rotArr.length === 3) cloned.rotation = rotArr
    if (typeof scaleMul === 'number' && Number.isFinite(scaleMul))
      cloned.scaleMultiplier = scaleMul
    out[i] = cloned
  }
  return out
}

// ── Drag / snap constants ────────────────────────────────────────────────────
const BONE_SCALE   = 0.28
const HIT_PADDING  = 2.2
const DRAG_LERP    = 0.55
const SNAP_LERP    = 0.18
const SNAP_EPS_SQ  = 1e-4
const DRAG_PLANE_Y = 1.05
const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)

// Chopping board world-space XZ footprint (pos [1.0, 0.942, -2.19], size [0.9, -, 0.5]).
const BOARD_MIN_X = 0.55
const BOARD_MAX_X = 1.45
const BOARD_MIN_Z = -2.44
const BOARD_MAX_Z = -1.94

// One shared geometry + material drives all 42 hit volumes.
const HIT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

// ── BoneCluster ──────────────────────────────────────────────────────────────
// Rendered inside FishModel's lateralBoneSlot — inherits the butterflied
// transform group's scale/rotation/position, identical to the preview's setup.
function BoneCluster({
  removedRef, currentDragSrcRef, snappingRef,
  removedVersion, onBoneGrab, onBoneDiscarded,
}) {
  const clusterGroupRef = useRef()
  const boneGroupRefs   = useRef([])
  const indexBySrcRef   = useRef(new Map())
  const [bones, setBones] = useState(null)
  const { camera, gl }    = useThree()

  // Track raw cursor position outside React's synthetic event system.
  const cursorRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e) => { cursorRef.current.x = e.clientX; cursorRef.current.y = e.clientY }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Stable ref so useFrame closure never captures a stale callback.
  const onBoneDiscardedRef = useRef(onBoneDiscarded)
  useEffect(() => { onBoneDiscardedRef.current = onBoneDiscarded }, [onBoneDiscarded])

  // Load GLBs (cache hit after first load) and apply position table.
  useEffect(() => {
    let cancelled = false
    loadLateralBones().then((entries) => {
      if (cancelled) return
      const positioned = applyPreviewPositions(entries)
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

  // Sync bone visibility to the removed set after every discard.
  useEffect(() => {
    if (!bones) return
    const removed = removedRef.current
    for (let i = 0; i < bones.length; i++) {
      const g = boneGroupRefs.current[i]
      if (!g) continue
      const v = !removed.has(bones[i].srcIndex)
      if (g.visible !== v) g.visible = v
    }
  }, [bones, removedVersion, removedRef])

  // Per-frame scratch — allocated once on mount.
  const ndc      = useMemo(() => new THREE.Vector2(), [])
  const ray      = useMemo(() => new THREE.Raycaster(), [])
  const hitWorld = useMemo(() => new THREE.Vector3(), [])
  const hitLocal = useMemo(() => new THREE.Vector3(), [])
  const restTmp  = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!bones || !clusterGroupRef.current) return

    // Drag: move active bone to cursor projected onto the horizontal drag plane.
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

          // Discard when cursor exits the chopping board XZ footprint.
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

    // Snap-back: lerp released bones back to their rest positions.
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

// ── useLateralBonesStep ──────────────────────────────────────────────────────
// Drives Step 9 for StepManager. Returns the standard step payload shape.
export function useLateralBonesStep(active, onComplete) {
  const { reportError, removeBone } = useFSMActions()
  const removedRef        = useRef(new Set())
  const currentDragSrcRef = useRef(null)
  const snappingRef       = useRef(new Set())
  const doneRef           = useRef(false)

  const [count,    setCount]    = useState(0)
  const [dragging, setDragging] = useState(false)

  const toolVisible = useStepToolVisible()

  // Reset all interaction state on each activation.
  useEffect(() => {
    removedRef.current        = new Set()
    currentDragSrcRef.current = null
    snappingRef.current       = new Set()
    doneRef.current           = false
    setCount(0)
    setDragging(false)
  }, [active])

  // FSM analytics: log state entry / exit.
  useEffect(() => {
    if (!active) return
    logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER, { phase: 'lateral_drag' })
    return () => logEvent(STEP_ID, EVENT_TYPE.STATE_EXIT, { phase: 'lateral_drag' })
  }, [active])

  useEffect(() => {
    if (!active) return
    document.body.style.cursor = 'none'
    return () => { document.body.style.cursor = '' }
  }, [active])

  // Discard callback: cursor left the board while dragging — bone is removed.
  const onBoneDiscarded = useCallback((srcIdx) => {
    if (doneRef.current)                return
    if (removedRef.current.has(srcIdx)) return
    removedRef.current.add(srcIdx)
    removeBone('lateral')
    currentDragSrcRef.current = null
    setDragging(false)
    const total = removedRef.current.size
    setCount(total)
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
      phase: 'lateral_drag', boneIndex: srcIdx, complete: true, removed: total,
    })
    if (total >= TOTAL_LATERAL_BONES) {
      doneRef.current = true
      setTimeout(onComplete, 700)
    }
  }, [onComplete, removeBone])

  // Pointer-up: if bone wasn't already discarded, snap it back (error).
  useEffect(() => {
    if (!active) return
    const onUp = () => {
      const idx = currentDragSrcRef.current
      if (idx == null) return
      currentDragSrcRef.current = null
      setDragging(false)
      if (!removedRef.current.has(idx)) {
        snappingRef.current.add(idx)
        reportError({
          class:     ERROR_CLASS.WRONG_CUT_PATH,
          reason:    'insufficient_pull',
          boneIndex: idx,
        })
        logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
          phase: 'lateral_drag', boneIndex: idx, complete: false, reason: 'dropped_on_board',
        })
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [active, reportError])

  const checkTool = useWrongToolGate()

  // Bone grab — starts a drag if no other drag is in progress.
  const onBoneGrab = useCallback((srcIdx) => {
    if (!checkTool()) return   // wrong tool — error dispatched, bail
    if (doneRef.current)                   return
    if (currentDragSrcRef.current != null) return
    if (removedRef.current.has(srcIdx))    return
    snappingRef.current.delete(srcIdx)
    currentDragSrcRef.current = srcIdx
    setDragging(true)
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_START, {
      phase: 'lateral_drag', boneIndex: srcIdx,
    })
  }, [checkTool])

  if (!active) {
    return { fishHandlers: {}, waterActive: false, extra3D: null, zoomEnabled: false, lateralBoneSlot: null, domUI: null }
  }

  const allDone = count >= TOTAL_LATERAL_BONES
  const message = allDone
    ? '✅ All lateral spines removed!'
    : dragging
      ? '🦴 Keep pulling away from the fish…'
      : '🥢 Grab a glowing lateral bone and pull it away'

  return {
    fishHandlers: { hidden: true },
    waterActive:  false,
    zoomEnabled:  true,
    extra3D: (
      <>
        {toolVisible && <ForcepsTool grabbing={dragging} />}
        <ButterfliedFishOnBoard boneSlot={(
          <BoneCluster
            removedRef={removedRef}
            currentDragSrcRef={currentDragSrcRef}
            snappingRef={snappingRef}
            removedVersion={count}
            onBoneGrab={onBoneGrab}
            onBoneDiscarded={onBoneDiscarded}
          />
        )} />
      </>
    ),
    domUI: (
      <>
        <div style={HINT_STYLE}><span>{message}</span></div>
        {!allDone && (
          <div style={{
            position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(245,200,66,0.75)', fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
            pointerEvents: 'none', zIndex: 101,
          }}>
            {count} / {TOTAL_LATERAL_BONES} removed
          </div>
        )}
      </>
    ),
  }
}
