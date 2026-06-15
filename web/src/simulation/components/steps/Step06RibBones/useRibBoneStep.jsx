// src/simulation/components/steps/Step06RibBones/useRibBoneStep.jsx
//
// Step 6 — rib bone removal. Rebuilt from Step06Preview.jsx.
// Interaction model: grab a rib bone, drag it off the cutting board.
// Once the cursor leaves the board XZ footprint the bone auto-discards
// (scale → 0). Releasing while still over the board snaps it back.
// No trash panel — bones discard in place when pulled far enough.

import {
  useRef, useEffect, useState, useMemo, useCallback,
} from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { logEvent }               from '../../../fsm/eventStream'
import { EVENT_TYPE, ERROR_CLASS } from '../../../fsm/errors'
import { useFSMActions }           from '../../../fsm/FSMProvider'
import { useWrongToolGate }        from '../../../fsm/useWrongToolGate'
import { useStepToolVisible }      from '../../../fsm/useStepToolVisible'

import {
  loadRibBones,
  BONE_MATERIAL,
  TOTAL_RIB_BONES,
} from './ribBonesLoader'

import { ButterfliedFishOnBoard } from './ButterfliedFishOnBoard'
import { ForcepsTool } from '../../tools/ForcepsTool'

// ── Drag / snap tuning (mirrors Step06Preview.jsx exactly) ──────────────────
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

// Shared hit-volume geometry and invisible material (one instance for all 26 bones)
const HIT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

// ── Per-bone position / rotation / scale overrides ──────────────────────────
// Ported directly from Step06Preview.jsx. Tune via browser DevTools.
// position: [X, Y, Z] — X left(-)/right(+), Y down(-)/up(+), Z tail(-)/head(+)
// rotation: [pitch, yaw, roll] in radians
// scale: length multiplier
const RIB_BONES = Object.freeze([
  // BOTTOM (belly side)
  /*  1 */ { position: [-0.37, 0.045, 0.94], rotation: [-0.38, 2.45, -0.20], scale: 1.0 },
  /*  2 */ { position: [-0.38, 0.065, 0.89], rotation: [-0.38, 2.45, -0.20], scale: 1.0 },
  /*  3 */ { position: [-0.38, 0.068, 0.84], rotation: [-0.38, 2.45, -0.20], scale: 1.0 },
  /*  4 */ { position: [-0.38, 0.079, 0.79], rotation: [-0.38, 2.45, -0.20], scale: 1.0 },
  /*  5 */ { position: [-0.38, 0.091, 0.73], rotation: [-0.38, 2.45, -0.20], scale: 1.1 },
  /*  6 */ { position: [-0.38, 0.105, 0.68], rotation: [-0.38, 2.45, -0.20], scale: 1.1 },
  /*  7 */ { position: [-0.37, 0.108, 0.63], rotation: [-0.38, 2.45, -0.20], scale: 1.1 },
  /*  8 */ { position: [-0.37, 0.116, 0.59], rotation: [-0.38, 2.45, -0.20], scale: 1.1 },
  /*  9 */ { position: [-0.37, 0.127, 0.54], rotation: [-0.38, 2.45, -0.20], scale: 1.2 },
  /* 10 */ { position: [-0.37, 0.135, 0.49], rotation: [-0.38, 2.45, -0.20], scale: 1.2 },
  /* 11 */ { position: [-0.36, 0.139, 0.45], rotation: [-0.38, 2.45, -0.20], scale: 1.2 },
  /* 12 */ { position: [-0.35, 0.139, 0.40], rotation: [-0.38, 2.45, -0.20], scale: 1.3 },
  /* 13 */ { position: [-0.34, 0.139, 0.35], rotation: [-0.38, 2.45, -0.20], scale: 1.3 },
  // TOP (dorsal side)
  /* 14 */ { position: [0.34, 0.020, 0.94], rotation: [-0.41, 0.50, -0.20], scale: 1.0 },
  /* 15 */ { position: [0.34, 0.030, 0.90], rotation: [-0.41, 0.50, -0.20], scale: 1.0 },
  /* 16 */ { position: [0.34, 0.040, 0.86], rotation: [-0.41, 0.50, -0.20], scale: 1.0 },
  /* 17 */ { position: [0.34, 0.050, 0.82], rotation: [-0.41, 0.50, -0.20], scale: 1.0 },
  /* 18 */ { position: [0.33, 0.050, 0.78], rotation: [-0.41, 0.50, -0.20], scale: 1.1 },
  /* 19 */ { position: [0.32, 0.050, 0.74], rotation: [-0.41, 0.50, -0.20], scale: 1.1 },
  /* 20 */ { position: [0.31, 0.058, 0.70], rotation: [-0.41, 0.50, -0.20], scale: 1.1 },
  /* 21 */ { position: [0.30, 0.064, 0.66], rotation: [-0.41, 0.50, -0.20], scale: 1.1 },
  /* 22 */ { position: [0.28, 0.069, 0.61], rotation: [-0.41, 0.50, -0.20], scale: 1.2 },
  /* 23 */ { position: [0.27, 0.074, 0.57], rotation: [-0.41, 0.50, -0.20], scale: 1.2 },
  /* 24 */ { position: [0.25, 0.080, 0.53], rotation: [-0.41, 0.50, -0.20], scale: 1.2 },
  /* 25 */ { position: [0.22, 0.085, 0.48], rotation: [-0.41, 0.50, -0.20], scale: 1.3 },
  /* 26 */ { position: [0.21, 0.100, 0.45], rotation: [-0.41, 0.50, -0.20], scale: 1.3 },
])

// Applies RIB_BONES overrides to loader entries (position / rotation / scale).
function applyPositionOverrides(entries) {
  const out = new Array(entries.length)
  for (let i = 0; i < entries.length; i++) {
    const e   = entries[i]
    if (!e) { out[i] = null; continue }
    const ovr = RIB_BONES[i]
    if (ovr == null) { out[i] = e; continue }

    const posArr   = ovr.position ?? null
    const rotArr   = ovr.rotation ?? null
    const scaleMul = ovr.scale    ?? null

    const cloned = { ...e }
    if (Array.isArray(posArr) && posArr.length === 3) {
      cloned.position = new THREE.Vector3(posArr[0], posArr[1], posArr[2])
    }
    if (Array.isArray(rotArr) && rotArr.length === 3) cloned.rotation = rotArr
    if (typeof scaleMul === 'number' && Number.isFinite(scaleMul)) {
      cloned.scaleMultiplier = scaleMul
    }
    out[i] = cloned
  }
  return out
}

// ── RibBoneCluster ───────────────────────────────────────────────────────────
// R3F component — must be rendered inside a Canvas (uses useThree + useFrame).
// Manages per-frame drag lerp and snap-back lerp for all 26 rib bones.

function RibBoneCluster({
  removedRef, currentDragSrcRef, snappingRef,
  removedVersion, onBoneGrab, onBoneDiscarded,
}) {
  const clusterGroupRef = useRef()
  const boneGroupRefs   = useRef([])
  const indexBySrcRef   = useRef(new Map()) // srcIndex → array index
  const [bones, setBones] = useState(null)
  const { camera, gl }    = useThree()

  // Keep callback ref stable so useFrame closure never captures a stale version
  const onBoneDiscardedRef = useRef(onBoneDiscarded)
  useEffect(() => { onBoneDiscardedRef.current = onBoneDiscarded }, [onBoneDiscarded])

  // Track pointer position without triggering re-renders
  const cursorRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e) => { cursorRef.current.x = e.clientX; cursorRef.current.y = e.clientY }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Load all 26 rib bone geometries once; apply position overrides
  useEffect(() => {
    let cancelled = false
    loadRibBones().then((entries) => {
      if (cancelled) return
      const positioned = applyPositionOverrides(entries)
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

  // Sync visibility whenever a bone is removed (removedVersion is the trigger)
  useEffect(() => {
    if (!bones) return
    const removed = removedRef.current
    for (let i = 0; i < bones.length; i++) {
      const g = boneGroupRefs.current[i]
      if (!g) continue
      const shouldShow = !removed.has(bones[i].srcIndex)
      if (g.visible !== shouldShow) {
        g.visible = shouldShow
        if (shouldShow) g.scale.setScalar(1)
      }
    }
  }, [bones, removedVersion, removedRef])

  // Per-frame scratch vectors (allocated once per mount)
  const ndc      = useMemo(() => new THREE.Vector2(), [])
  const ray      = useMemo(() => new THREE.Raycaster(), [])
  const hitWorld = useMemo(() => new THREE.Vector3(), [])
  const hitLocal = useMemo(() => new THREE.Vector3(), [])
  const restTmp  = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!bones || !clusterGroupRef.current) return

    // ── Drag: lerp active bone toward cursor on the horizontal drag plane ──
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

          // Discard once the cursor exits the board XZ footprint
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

    // ── Snap-back: lerp released bones back to rest position ──────────────
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
        const rot      = bone.rotation         ?? [0, 0, 0]
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

// ── HUD styles (mirrors Step06Preview.jsx) ────────────────────────────────────
const HINT_STYLE = {
  position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
  background: 'rgba(4,20,8,0.92)', border: '2px solid rgba(78,205,113,0.45)',
  borderRadius: 40, padding: '10px 22px', color: '#4ecd71', fontSize: 14,
  fontWeight: 600, letterSpacing: '0.04em', display: 'flex', alignItems: 'center',
  gap: 10, fontFamily: "'Rajdhani', sans-serif", backdropFilter: 'blur(8px)',
  zIndex: 101, pointerEvents: 'none', whiteSpace: 'nowrap',
}

const COUNT_STYLE = {
  position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)',
  color: 'rgba(245,200,66,0.75)', fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
  pointerEvents: 'none', zIndex: 101,
}

const STEP_ID = 6

// ── Main hook ─────────────────────────────────────────────────────────────────

/** Manages the 26 rib-bone drag-to-discard interaction for Step 6. */
export function useRibBoneStep(active, onComplete) {
  const { reportError, removeBone } = useFSMActions()
  const toolVisible       = useStepToolVisible()
  const removedRef        = useRef(new Set())
  const currentDragSrcRef = useRef(null)
  const snappingRef       = useRef(new Set())
  const doneRef           = useRef(false)
  const snapErrorTimerRef = useRef(null)

  const [count,     setCount]     = useState(0)
  const [dragging,  setDragging]  = useState(false)
  const [snapError, setSnapError] = useState(false)

  // Reset all mutable state when the step activates
  useEffect(() => {
    if (!active) return
    removedRef.current        = new Set()
    currentDragSrcRef.current = null
    snappingRef.current       = new Set()
    doneRef.current           = false
    setCount(0)
    setDragging(false)
    setSnapError(false)
    clearTimeout(snapErrorTimerRef.current)
  }, [active])

  // FSM lifecycle events
  useEffect(() => {
    if (!active) return
    logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER, { phase: 'rib_bone_drag' })
    return () => {
      logEvent(STEP_ID, EVENT_TYPE.STATE_EXIT, { phase: 'rib_bone_drag' })
      document.body.style.cursor = ''
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    document.body.style.cursor = 'none'
    return () => { document.body.style.cursor = '' }
  }, [active])

  // Called by RibBoneCluster when a bone exits the board footprint
  const onBoneDiscarded = useCallback((srcIdx) => {
    if (doneRef.current)                return
    if (removedRef.current.has(srcIdx)) return
    removedRef.current.add(srcIdx)
    removeBone('rib')
    currentDragSrcRef.current = null
    setDragging(false)
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, { boneIndex: srcIdx, complete: true })
    const total = removedRef.current.size
    setCount(total)
    if (total >= TOTAL_RIB_BONES) {
      doneRef.current = true
      setTimeout(onComplete, 500)
    }
  }, [onComplete, removeBone])

  // Global pointerup: if bone wasn't discarded, snap it back to rest
  useEffect(() => {
    if (!active) return
    const onUp = () => {
      const idx = currentDragSrcRef.current
      if (idx == null) return
      currentDragSrcRef.current = null
      setDragging(false)
      document.body.style.cursor = ''
      if (!removedRef.current.has(idx)) {
        snappingRef.current.add(idx)
        reportError({
          class:     ERROR_CLASS.WRONG_CUT_PATH,
          reason:    'insufficient_pull',
          boneIndex: idx,
        })
        clearTimeout(snapErrorTimerRef.current)
        setSnapError(true)
        snapErrorTimerRef.current = setTimeout(() => setSnapError(false), 1500)
        logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
          boneIndex: idx, complete: false, reason: 'released_on_board',
        })
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [active, reportError])

  const checkTool = useWrongToolGate()

  // Grab handler passed to RibBoneCluster — initiates drag for a single bone
  const onBoneGrab = useCallback((srcIdx) => {
    if (!checkTool()) return   // wrong tool — error dispatched, bail
    if (doneRef.current)                   return
    if (currentDragSrcRef.current != null) return
    if (removedRef.current.has(srcIdx))    return
    snappingRef.current.delete(srcIdx)
    currentDragSrcRef.current = srcIdx
    setDragging(true)
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_START, { boneIndex: srcIdx })
  }, [checkTool])

  // Memoize the cluster JSX so RibBoneCluster re-renders (not remounts) on count change
  const ribBoneCluster = useMemo(() => (
    <RibBoneCluster
      removedRef={removedRef}
      currentDragSrcRef={currentDragSrcRef}
      snappingRef={snappingRef}
      removedVersion={count}
      onBoneGrab={onBoneGrab}
      onBoneDiscarded={onBoneDiscarded}
    />
  ), [count, onBoneGrab, onBoneDiscarded])

  // ── All hooks called above — safe to early-return below ───────────────────
  if (!active) return { fishHandlers: {}, waterActive: false, extra3D: null, domUI: null }

  const allDone = count >= TOTAL_RIB_BONES
  const message = allDone     ? '✅ All rib bones removed!'
    : snapError               ? '❌ Pull all the way off the board!'
    : dragging                ? '🦴 Keep pulling away from the fish…'
    :                           '🥢 Grab a glowing bone and pull it away'

  return {
    fishHandlers: { hidden: true },
    waterActive:  false,
    zoomEnabled:  true,

    extra3D: (
      <>
        {toolVisible && <ForcepsTool grabbing={dragging} />}
        <ButterfliedFishOnBoard boneSlot={ribBoneCluster} />
      </>
    ),

    domUI: (
      <>
        <div style={{
          ...HINT_STYLE,
          borderColor: snapError ? 'rgba(255,80,80,0.7)' : 'rgba(78,205,113,0.45)',
          color:       snapError ? '#ff8888' : '#4ecd71',
          background:  snapError ? 'rgba(28,4,4,0.95)' : 'rgba(4,20,8,0.92)',
          transition:  'border-color 0.2s, color 0.2s, background 0.2s',
        }}>
          <span>{message}</span>
        </div>

        {!allDone && (
          <div style={COUNT_STYLE}>
            {count} / {TOTAL_RIB_BONES} removed
          </div>
        )}
      </>
    ),
  }
}
