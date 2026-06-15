// src/simulation/Step06Preview.jsx
//
// Standalone Step-6 (rib bone removal) preview. Self-contained: does
// NOT mount StepManager, FSM, or any shared step component — just renders
// KitchenEnvironment + GameCamera + the butterflied bangus with the 26
// rib bones available for drag-to-discard interaction.
//
// Performance budget (low-end PC target):
//   • shadows OFF on the canvas, dpr capped to 1×, AdaptiveDpr/Events.
//   • One module-level THREE.BoxGeometry + one transparent MeshBasicMaterial
//     drives all 26 hit volumes.
//   • Per-frame scratch vectors are allocated once per mount via useMemo.
//
// ── Interaction model (no trash bin) ────────────────────────────────────────
//   The user grabs a rib bone and drags it away from the fish. Once the
//   bone travels DRAG_DISCARD_DIST_SQ (local units) from its rest position
//   it auto-discards with a micro-pop (scale → 0) and disappears. Releasing
//   before the threshold snaps the bone back to its rest position.

import {
  Suspense, useEffect, useMemo, useState, useRef, useCallback,
} from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import {
  AdaptiveDpr, AdaptiveEvents, PerformanceMonitor,
} from '@react-three/drei'
import { useGLTF } from '../utils/useGLTFLocal'
import * as THREE                     from 'three'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'
import {
  loadRibBones,
  BONE_MATERIAL,
  TOTAL_RIB_BONES,
} from '../components/steps/Step06RibBones/ribBonesLoader'

// ── Butterflied-fish placement (mirrored from FishModel.jsx) ────────────────
const FISH_POS_CB             = [0.93, 0.97, -2.19]
const FISH_ROTATION_Y         = Math.PI / 2
const CLOSED_SCALE            = 0.6
const BUTTERFLIED_SCALE       = 0.24
const BUTTERFLIED_FLAT_TILT_X = -0.05
const BUTTERFLIED_FLAT_TILT_Z = 0.0
const BUTTERFLIED_LIFT        = 0.02
const BUTTERFLIED_BACK_SHIFT  = 0.0

function ButterfliedFishOnBoard({ boneSlot }) {
  const { scene: butterfliedScene } = useGLTF('/models/DaingCuttedFins.glb')

  const butterfliedClone = useMemo(() => {
    const clone = butterfliedScene.clone()
    clone.traverse((c) => {
      if (!c.isMesh) return
      const src = Array.isArray(c.material) ? c.material : [c.material]
      const dst = src.map((m) => {
        const mat       = m.clone()
        mat.transparent = false
        mat.opacity     = 1
        mat.depthWrite  = true
        mat.visible     = true
        mat.needsUpdate = true
        return mat
      })
      c.material = dst.length === 1 ? dst[0] : dst
    })
    return clone
  }, [butterfliedScene])

  return (
    <group position={FISH_POS_CB}>
      <primitive
        object={butterfliedClone}
        scale={1.0}
        position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
        rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
      />
      {boneSlot && (
        <group
          position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
          rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
          scale={BUTTERFLIED_SCALE}
        >
          {boneSlot}
        </group>
      )}
    </group>
  )
}

useGLTF.preload('/models/DaingCuttedFins.glb')

// ═══════════════════════════════════════════════════════════════════════════
// 1) PER-BONE POSITION OVERRIDES
//    Add entries here to fine-tune individual rib bone placements.
//    Each entry can be:
//      - simple array [x, y, z] → position only
//      - object { position: [x,y,z], rotation: [rx,ry,rz], scale?: number }
// ═══════════════════════════════════════════════════════════════════════════

const RIB_BONES = Object.freeze([
  // =========================================================================
  // HOW TO EDIT BONE POSITIONS:
  //   position: [ X, Y, Z ]
  //     X = left (-) / right (+)   → negative = belly/lower side
  //     Y = down (-) / up (+)       → lower = more buried inside fish
  //     Z = tail (-) / head (+)     → follows the fish body length
  //   rotation: [ pitch (X), yaw (Y), roll (Z) ]  (in radians)
  //     pitch = tilt forward/backward
  //     yaw   = lean left/right
  //     roll  = twist
  //   scale = length multiplier
  // =========================================================================
  // Rib bones fan outward from the ventral/belly side of the spine.
  // In the butterflied-flat pose, these sit on the lower (negative X) half.
  // Positions are starting estimates — tune via browser DevTools.

  // BOTTOM
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

  // TOP
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

// ═══════════════════════════════════════════════════════════════════════════
// 2) BONE / INTERACTION TUNING
// ═══════════════════════════════════════════════════════════════════════════

const BONE_SCALE   = 0.28
const HIT_PADDING  = 2.2
const DRAG_LERP    = 0.55
const SNAP_LERP    = 0.18
const SNAP_EPS_SQ  = 1e-4
const DRAG_PLANE_Y = 1.05
const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)

// Chopping board world-space XZ footprint (position [1.0, 0.942, -2.19], size [0.9, -, 0.5])
const BOARD_MIN_X = 0.55   // 1.0 - 0.45
const BOARD_MAX_X = 1.45   // 1.0 + 0.45
const BOARD_MIN_Z = -2.44  // -2.19 - 0.25
const BOARD_MAX_Z = -1.94  // -2.19 + 0.25

const HIT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

// ═══════════════════════════════════════════════════════════════════════════
// 3) BONE CLUSTER
// ═══════════════════════════════════════════════════════════════════════════

function applyPreviewPositions(entries) {
  const out = new Array(entries.length)
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (!e) { out[i] = null; continue }
    const ovr = RIB_BONES[i]
    if (ovr == null) { out[i] = e; continue }

    let posArr = null, rotArr = null, scaleMul = null
    if (Array.isArray(ovr)) {
      posArr = ovr
    } else if (typeof ovr === 'object') {
      posArr   = ovr.position ?? null
      rotArr   = ovr.rotation ?? null
      scaleMul = ovr.scale    ?? null
    }

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

function BoneCluster({ removedRef, currentDragSrcRef, snappingRef, removedVersion, onBoneGrab, onBoneDiscarded }) {
  const clusterGroupRef = useRef()
  const boneGroupRefs   = useRef([])
  const indexBySrcRef   = useRef(new Map())
  const [bones, setBones] = useState(null)
  const { camera, gl }    = useThree()

  const onBoneDiscardedRef = useRef(onBoneDiscarded)
  useEffect(() => { onBoneDiscardedRef.current = onBoneDiscarded }, [onBoneDiscarded])

  const cursorRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e) => { cursorRef.current.x = e.clientX; cursorRef.current.y = e.clientY }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadRibBones().then((entries) => {
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

  const ndc      = useMemo(() => new THREE.Vector2(), [])
  const ray      = useMemo(() => new THREE.Raycaster(), [])
  const hitWorld = useMemo(() => new THREE.Vector3(), [])
  const hitLocal = useMemo(() => new THREE.Vector3(), [])
  const restTmp  = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!bones || !clusterGroupRef.current) return

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

          // Discard once the cursor leaves the chopping board's XZ footprint
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

// ═══════════════════════════════════════════════════════════════════════════
// 4) HUD
// ═══════════════════════════════════════════════════════════════════════════

const HINT_STYLE = {
  position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
  background: 'rgba(4,20,8,0.92)', border: '2px solid rgba(78,205,113,0.45)',
  borderRadius: 40, padding: '10px 22px', color: '#4ecd71', fontSize: 14,
  fontWeight: 600, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 10,
  fontFamily: "'Rajdhani', sans-serif", backdropFilter: 'blur(8px)',
  zIndex: 101, pointerEvents: 'none', whiteSpace: 'nowrap',
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) DRAG / DISCARD STATE
// ═══════════════════════════════════════════════════════════════════════════

function useStep6Interaction() {
  const removedRef        = useRef(new Set())
  const currentDragSrcRef = useRef(null)
  const snappingRef       = useRef(new Set())
  const doneRef           = useRef(false)

  const [count,    setCount]    = useState(0)
  const [dragging, setDragging] = useState(false)

  const onBoneDiscarded = useCallback((srcIdx) => {
    if (doneRef.current)                return
    if (removedRef.current.has(srcIdx)) return
    removedRef.current.add(srcIdx)
    currentDragSrcRef.current = null
    setDragging(false)
    const total = removedRef.current.size
    setCount(total)
    if (total >= TOTAL_RIB_BONES) doneRef.current = true
  }, [])

  useEffect(() => {
    const onUp = () => {
      const idx = currentDragSrcRef.current
      if (idx == null) return
      currentDragSrcRef.current = null
      setDragging(false)
      if (!removedRef.current.has(idx)) {
        snappingRef.current.add(idx)
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [])

  const onBoneGrab = useCallback((srcIdx) => {
    if (doneRef.current)                   return
    if (currentDragSrcRef.current != null) return
    if (removedRef.current.has(srcIdx))    return
    snappingRef.current.delete(srcIdx)
    currentDragSrcRef.current = srcIdx
    setDragging(true)
  }, [])

  return {
    removedRef, currentDragSrcRef, snappingRef,
    count, dragging,
    onBoneGrab, onBoneDiscarded,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function Step6Preview() {
  const s = useStep6Interaction()

  const allDone = s.count >= TOTAL_RIB_BONES
  const message = allDone
    ? '✅ All rib bones removed!'
    : s.dragging
      ? '🦴 Keep pulling away from the fish…'
      : '🥢 Grab a glowing bone and pull it away'

  const boneSlot = useMemo(() => (
    <BoneCluster
      removedRef={s.removedRef}
      currentDragSrcRef={s.currentDragSrcRef}
      snappingRef={s.snappingRef}
      removedVersion={s.count}
      onBoneGrab={s.onBoneGrab}
      onBoneDiscarded={s.onBoneDiscarded}
    />
  ), [s.removedRef, s.currentDragSrcRef, s.snappingRef, s.count, s.onBoneGrab, s.onBoneDiscarded])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0c1014' }}>
      <Canvas
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
        dpr={[1, 1]}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <PerformanceMonitor onDecline={() => {}} />

        <Suspense fallback={null}>
          <color attach="background" args={['#b8ccd8']} />
          <fog   attach="fog"        args={['#b8ccd8', 14, 28]} />

          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted={false} />

          <GameCamera
            cameraPreset="cuttingBoardTop"
            lerpSpeed={1}
            orbitEnabled={false}
            zoomEnabled
            minDistance={1.1}
            maxDistance={1.58}
            instant
          />

          <ButterfliedFishOnBoard boneSlot={boneSlot} />
        </Suspense>
      </Canvas>

      <div style={HINT_STYLE}>
        <span>{message}</span>
      </div>

      {!allDone && (
        <div style={{
          position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(245,200,66,0.75)', fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
          pointerEvents: 'none', zIndex: 101,
        }}>
          {s.count} / {TOTAL_RIB_BONES} removed
        </div>
      )}

      <div style={{
        position: 'absolute', top: 12, right: 12, padding: '6px 12px',
        background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.45)',
        borderRadius: 8, color: '#f5c842', fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
        pointerEvents: 'none', zIndex: 200,
      }}>
        Step 6 Preview · Dev Only
      </div>
    </div>
  )
}
