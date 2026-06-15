// src/simulation/Step04Preview.jsx
// Self-contained preview for Step 4 (Dorsal Cut).
// Phase A: usePositionFish — roll fish dorsal-up.
// Phase B: DorsalCutSensor + DorsalIncision + useDorsalCut — scored knife trace.
// Phase C: 'done' — fish snaps butterflied.
//
// All dependencies inlined — no imports from:
//   • components/fish/FishModel.jsx
//   • components/fish/DorsalCutGuide.jsx
//   • steps/Step04DorsalCut/dorsalSpline.js
//   • steps/Step04Positioning.jsx

import { Suspense, useRef, useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Canvas, useFrame, useThree }                                         from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor, Line }              from '@react-three/drei'
import * as THREE                                                              from 'three'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'
import { useGLTF }            from '../utils/useGLTFLocal'

// ── Shared style tokens ───────────────────────────────────────────────────────
const FONT = "'Rajdhani', sans-serif"

const HINT_STYLE = {
  position: 'absolute',
  bottom: 90,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  zIndex: 101,
  pointerEvents: 'none',
  fontFamily: FONT,
  color: '#fff',
  backdropFilter: 'blur(10px)',
}

const BADGE_STYLE = {
  position: 'absolute', top: 12, right: 12,
  padding: '6px 12px',
  background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.45)',
  borderRadius: 8, color: '#f5c842', fontFamily: FONT,
  fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
  pointerEvents: 'none', zIndex: 200,
}

const CHIP = {
  display: 'flex', alignItems: 'center', gap: 5,
  background: 'rgba(4,20,8,0.92)',
  borderRadius: 10, padding: '4px 10px',
  fontFamily: FONT, fontSize: 13,
  backdropFilter: 'blur(6px)',
}

// ── Fish placement — must match FishModel / DorsalCutGuide ───────────────────
const FISH_WORLD_CUTTING = [1.0, 0.90, -2.19]

// ── Reused unit axes — never mutated ─────────────────────────────────────────
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const UNIT_X   = new THREE.Vector3(1, 0, 0)

// ── Knife pose constants ──────────────────────────────────────────────────────
const KNIFE_HAND_LOCAL = [0.28, -0.36, -1.0]
const KNIFE_SCALE      = 1.6
const KNIFE_GRIP_Y     = 0.36
const KNIFE_PRESS_JAB  = 0.03
const BLADE_EXTRUDE    = { depth: 0.0022, bevelEnabled: false }

// ── Cutting tuning ────────────────────────────────────────────────────────────
const WARN_PATH_RATIO  = 0.20
const WRONG_PATH_RATIO = 0.32
const START_PATH_RATIO = 0.60
const JUMP_TOL         = 0.25
const END_TOL          = 0.15

// ─────────────────────────────────────────────────────────────────────────────
// buildDorsalSpline — inlined from dorsalSpline.js
//
// Builds the dorsal-cut geometry from a loaded GLB scene. Returns a straight
// head→tail line at ~80% of the fish's height (the dorsal ridge). Everything
// is computed once at GLB load — zero per-frame allocation.
//
// Returns { samples, arcLengths, totalLen } in local space of a pre-scaled +
// rotated clone that matches FishModel's transform.
// ─────────────────────────────────────────────────────────────────────────────
function buildDorsalSpline(scene, { scale = 0.6, rotationY = Math.PI / 2 } = {}) {
  const cloned = scene.clone()
  cloned.scale.setScalar(scale)
  cloned.rotation.set(0, rotationY, 0)
  cloned.updateMatrixWorld(true)

  const box    = new THREE.Box3().setFromObject(cloned)
  const size   = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const longAxis = size.x >= size.z ? 'x' : 'z'
  const half     = (longAxis === 'x' ? size.x : size.z) * 0.45
  const dorsalY  = center.y + size.y * 0.40

  const head = longAxis === 'x'
    ? new THREE.Vector3(center.x - half, dorsalY, center.z)
    : new THREE.Vector3(center.x, dorsalY, center.z - half)
  const tail = longAxis === 'x'
    ? new THREE.Vector3(center.x + half, dorsalY, center.z)
    : new THREE.Vector3(center.x, dorsalY, center.z + half)

  const samples    = [head, tail]
  const totalLen   = head.distanceTo(tail) || 1
  const arcLengths = new Float32Array([0, totalLen])

  return { samples, arcLengths, totalLen }
}

// ─────────────────────────────────────────────────────────────────────────────
// FishModel — inlined from components/fish/FishModel.jsx
// ─────────────────────────────────────────────────────────────────────────────

// Squared world-space epsilon (~1 cm²) and rotation epsilon (~0.06°) for the
// useFrame at-rest early-out.
const FM_POS_EPSILON_SQ = 1e-4
const FM_ROT_EPSILON    = 1e-3

// World placement per FSM location.
const FISH_WORLD = {
  sink:         new THREE.Vector3(-0.25, 1.1,  -2.22),
  cuttingBoard: new THREE.Vector3( 0.95, 1.07, -2.09),
  table:        new THREE.Vector3( 1.80, 0.81,  0.80),
}

const FISH_ROTATION_Y = {
  sink:         1.6,
  cuttingBoard: Math.PI / 2,
  table:        Math.PI / 2,
}

// Cut-coverage threshold at which the closed → butterflied cross-fade begins.
const FM_FADE_START_T      = 0.65
const FM_FADE_SMOOTH       = 0.18
const FM_FADE_SPEED_INSTANT = 0.04

// Shared invisible hit material — one allocation for all instances.
const HIT_MAT = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

const BOX_SCRATCH = new THREE.Vector3()

// Compensation for the butterfliedBangus.glb authoring offset.
const BUTTERFLIED_FLAT_TILT_X = -0.05
const BUTTERFLIED_FLAT_TILT_Z = 0.0
const BUTTERFLIED_LIFT        = 0.02
const BUTTERFLIED_BACK_SHIFT  = 0.0
const BUTTERFLIED_SCALE       = 0.24

export const FishModel = memo(function FishModel({
  location          = 'sink',
  hidden            = false,
  highlighted       = false,
  washProgress      = 0,
  dragProgressRef   = null,
  rotationOffsetRef = null,
  cutProgressRef    = null,
  cutComplete       = false,
  closedModelPath   = '/models/BangusCUTTEDFIN.opt.glb',
  dorsalBoneSlot    = null,
  ventralBoneSlot   = null,
  lateralBoneSlot   = null,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
}) {
  const groupRef  = useRef()
  const { scene: closedScene }      = useGLTF(closedModelPath)
  const { scene: butterfliedScene } = useGLTF('/models/DaingCuttedFins.glb')

  const closedClone      = useMemo(() => closedScene.clone(),      [closedScene])
  const butterfliedClone = useMemo(() => butterfliedScene.clone(), [butterfliedScene])

  const { closedMats, butterfliedMats } = useMemo(() => {
    const closedMats      = []
    const butterfliedMats = []
    closedClone.traverse((c) => {
      if (!c.isMesh || !c.material) return
      c.material = c.material.clone()
      c.material.transparent = false
      c.material.opacity     = 1
      closedMats.push(c.material)
    })
    butterfliedClone.traverse((c) => {
      if (!c.isMesh || !c.material) return
      c.material = c.material.clone()
      c.material.transparent = false
      c.material.opacity     = 1
      butterfliedMats.push(c.material)
    })
    return { closedMats, butterfliedMats }
  }, [closedClone, butterfliedClone])

  const rotationY = FISH_ROTATION_Y[location] ?? FISH_ROTATION_Y.sink
  const destPos   = useRef(FISH_WORLD[location]?.clone() ?? FISH_WORLD.sink.clone())
  const arcTarget = useRef(new THREE.Vector3())

  const { hitSize, hitCenter, butterfliedOffset } = useMemo(() => {
    closedClone.scale.setScalar(0.6)
    closedClone.rotation.set(0, rotationY, 0)
    closedClone.updateMatrixWorld(true)
    const closedBox  = new THREE.Box3().setFromObject(closedClone)
    const size       = closedBox.getSize(BOX_SCRATCH).clone()
    const center     = closedBox.getCenter(BOX_SCRATCH).clone()
    const closedMinY = closedBox.min.y
    closedClone.scale.setScalar(1)
    closedClone.rotation.set(0, 0, 0)

    butterfliedClone.scale.setScalar(BUTTERFLIED_SCALE)
    butterfliedClone.rotation.set(0, rotationY, 0)
    butterfliedClone.updateMatrixWorld(true)
    const bfBox  = new THREE.Box3().setFromObject(butterfliedClone)
    const bfMinY = bfBox.min.y
    butterfliedClone.scale.setScalar(1)
    butterfliedClone.rotation.set(0, 0, 0)

    const dy = closedMinY - bfMinY

    return {
      hitSize:   [size.x * 1.15, size.y * 1.15, size.z * 1.15],
      hitCenter: center.toArray(),
      butterfliedOffset: [0, dy + BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT],
    }
  }, [closedClone, butterfliedClone, rotationY, BUTTERFLIED_SCALE, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT])

  // Update destination when location changes.
  useEffect(() => {
    const target = FISH_WORLD[location] ?? FISH_WORLD.sink
    destPos.current.copy(target)
  }, [location])

  // Wash / highlight emissive tint — applied only to the closed mesh.
  useEffect(() => {
    closedClone.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const mat = child.material
      if (highlighted) {
        mat.emissive?.set('#204010')
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0.35
      } else {
        const c = washProgress / 100
        mat.emissive?.set(c * 0.05, c * 0.08, c * 0.10)
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0.1 + c * 0.15
      }
    })
  }, [highlighted, washProgress, closedClone])

  // ── Cross-fade state ──────────────────────────────────────────────────────
  const fadeRef        = useRef(0)
  const lastWrittenRef = useRef(-1)
  const fadeStartedRef = useRef(false)

  const [closedRemoved,    setClosedRemoved]    = useState(false)
  const [butterfliedReady, setButterfliedReady] = useState(false)

  const beginFade = () => {
    if (fadeStartedRef.current) return
    fadeStartedRef.current = true
    for (let i = 0; i < closedMats.length; i++) {
      closedMats[i].transparent = true
      closedMats[i].depthWrite  = false
    }
    for (let i = 0; i < butterfliedMats.length; i++) {
      butterfliedMats[i].transparent = true
      butterfliedMats[i].depthWrite  = false
    }
    setButterfliedReady(true)
  }

  const settleFade = () => {
    for (let i = 0; i < butterfliedMats.length; i++) {
      butterfliedMats[i].opacity     = 1
      butterfliedMats[i].transparent = false
      butterfliedMats[i].depthWrite  = true
    }
    setClosedRemoved(true)
  }

  useEffect(() => {
    if (!cutComplete || fadeRef.current >= 1) return
    fadeRef.current        = 1
    lastWrittenRef.current = 1
    beginFade()
    settleFade()
  }, [cutComplete, closedMats, butterfliedMats, closedClone])

  useEffect(() => {
    fadeRef.current        = 0
    lastWrittenRef.current = -1
    fadeStartedRef.current = false
    setClosedRemoved(false)
    setButterfliedReady(false)
  }, [closedModelPath])

  useFrame(() => {
    if (!groupRef.current) return
    const drag    = dragProgressRef?.current ?? 0
    const targetX = cutComplete ? 0 : (rotationOffsetRef?.current ?? 0)

    const distSq = groupRef.current.position.distanceToSquared(destPos.current)
    const dRotX  = Math.abs(groupRef.current.rotation.x - targetX)
    const dRotZ  = Math.abs(groupRef.current.rotation.z)
    const moving = drag > 0 || distSq > FM_POS_EPSILON_SQ
                || dRotX > FM_ROT_EPSILON || dRotZ > FM_ROT_EPSILON

    if (moving) {
      if (drag > 0) {
        const s    = FISH_WORLD.sink
        const b    = FISH_WORLD.cuttingBoard
        const lift = Math.sin(drag * Math.PI) * 0.32
        arcTarget.current.set(
          s.x + (b.x - s.x) * drag,
          s.y + (b.y - s.y) * drag + lift,
          s.z + (b.z - s.z) * drag,
        )
        groupRef.current.position.lerp(arcTarget.current, 0.18)
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z,
          Math.sin(drag * Math.PI) * 0.10,
          0.14,
        )
      } else {
        groupRef.current.position.lerp(destPos.current, 0.08)
        groupRef.current.rotation.x = THREE.MathUtils.lerp(
          groupRef.current.rotation.x, targetX, 0.14,
        )
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z, 0, 0.14,
        )

        if (distSq < FM_POS_EPSILON_SQ) groupRef.current.position.copy(destPos.current)
        if (dRotX  < FM_ROT_EPSILON)    groupRef.current.rotation.x = targetX
        if (dRotZ  < FM_ROT_EPSILON)    groupRef.current.rotation.z = 0
      }
    }

    // ── Cross-fade: closed ⇨ butterflied ─────────────────────────────────
    if (fadeRef.current >= 1) return
    const prog    = cutProgressRef?.current ?? 0
    const liveCut = prog > 0
    if (!liveCut && !cutComplete) return

    beginFade()

    let target
    if (cutComplete) {
      target = 1
      fadeRef.current = Math.min(1, fadeRef.current + FM_FADE_SPEED_INSTANT)
    } else {
      const remapped = (prog - FM_FADE_START_T) / (1 - FM_FADE_START_T)
      target = Math.max(0, Math.min(1, remapped))
      if (target > fadeRef.current) {
        fadeRef.current = Math.min(
          1,
          fadeRef.current + (target - fadeRef.current) * FM_FADE_SMOOTH,
        )
      }
    }

    if (Math.abs(fadeRef.current - lastWrittenRef.current) < 0.001) return
    lastWrittenRef.current = fadeRef.current

    const openOp   = fadeRef.current
    const closedOp = 1 - openOp
    for (let i = 0; i < closedMats.length; i++)      closedMats[i].opacity = closedOp
    for (let i = 0; i < butterfliedMats.length; i++) butterfliedMats[i].opacity = openOp

    if (fadeRef.current >= 1) settleFade()
  })

  return (
    <group ref={groupRef} name="bangus_fish" position={destPos.current.toArray()} visible={!hidden}>
      {!closedRemoved && (
        <primitive
          object={closedClone}
          scale={1}
          rotation={[0, rotationY, 0]}
          castShadow
          receiveShadow
        />
      )}
      <primitive
        object={butterfliedClone}
        scale={BUTTERFLIED_SCALE}
        position={butterfliedOffset}
        rotation={[BUTTERFLIED_FLAT_TILT_X, rotationY, BUTTERFLIED_FLAT_TILT_Z]}
        visible={butterfliedReady}
        castShadow
        receiveShadow
      />
      {ventralBoneSlot && (
        <group
          position={butterfliedOffset}
          rotation={[BUTTERFLIED_FLAT_TILT_X, rotationY, BUTTERFLIED_FLAT_TILT_Z]}
          scale={BUTTERFLIED_SCALE}
        >
          {ventralBoneSlot}
        </group>
      )}
      {lateralBoneSlot && (
        <group
          position={butterfliedOffset}
          rotation={[BUTTERFLIED_FLAT_TILT_X, rotationY, BUTTERFLIED_FLAT_TILT_Z]}
          scale={BUTTERFLIED_SCALE}
        >
          {lateralBoneSlot}
        </group>
      )}
      <mesh
        position={hitCenter}
        material={HIT_MAT}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <boxGeometry args={hitSize} />
      </mesh>
    </group>
  )
})

useGLTF.preload('/models/bangus3.opt.glb')
useGLTF.preload('/models/BangusCUTTEDFIN.opt.glb')
useGLTF.preload('/models/DaingCuttedFins.glb')
useGLTF.preload('/models/butterfliedBangus.opt.glb')

// ─────────────────────────────────────────────────────────────────────────────
// DorsalCutGuide — inlined from components/fish/DorsalCutGuide.jsx
//
// Three jobs, zero per-frame allocation on steady state:
//   1) Renders the yellow anatomical guide line (straight head→tail segment).
//   2) Renders a red "cut so far" overlay spanning [fromT..toT].
//   3) Projects line endpoints to screen space → screenPolylineRef each frame.
// ─────────────────────────────────────────────────────────────────────────────

// No-op raycast — stops the guide line from intercepting pointer events.
const NO_RAYCAST = () => null

// Matches FishModel's cuttingBoard placement/scale so the guide sits exactly
// on the dorsal surface of the visible mesh.
const GUIDE_WORLD_POS  = [1.03, 0.98, -2.29]
const GUIDE_BAKED_Y    = Math.PI / 2
const GUIDE_SCALE      = 0.75
const GUIDE_PULSE_HZ   = 1.0
const GUIDE_BUCKET_STEP = 0.05
const GUIDE_MIN_SPAN    = 0.015

export function DorsalCutGuide({
  visible,
  rotationOffsetRef = null,
  screenPolylineRef = null,
  cutCoverageRef    = null,
}) {
  const groupRef = useRef()
  const guideRef = useRef()
  const { scene } = useGLTF('/models/bangus3.opt.glb')
  const { camera, size } = useThree()

  // Build the straight line once.
  const { head, tail, samples, arcLengths, totalLen, samplePoints } = useMemo(() => {
    const built = buildDorsalSpline(scene, {
      scale: GUIDE_SCALE, rotationY: GUIDE_BAKED_Y,
    })
    return {
      head:         built.samples[0],
      tail:         built.samples[1],
      samples:      built.samples,
      arcLengths:   built.arcLengths,
      totalLen:     built.totalLen,
      samplePoints: built.samples.map((p) => [p.x, p.y, p.z]),
    }
  }, [scene])

  // Reused vectors/buffers — one allocation ever.
  const v         = useMemo(() => new THREE.Vector3(), [])
  const screenBuf = useMemo(() => new Float32Array(samples.length * 2), [samples.length])

  // Red "cut so far" overlay — rebuilt only when fromT or toT flips bucket.
  const [donePoints, setDonePoints] = useState(null)
  const lastFromBucketRef = useRef(-1)
  const lastToBucketRef   = useRef(-1)

  // Kill raycasting on every child whenever the subtree grows.
  useEffect(() => {
    const kill = (r) => {
      if (!r) return
      r.raycast = NO_RAYCAST
      r.traverse?.((c) => { c.raycast = NO_RAYCAST })
    }
    kill(groupRef.current)
    kill(guideRef.current)
  }, [donePoints])

  useFrame(() => {
    const g = groupRef.current
    if (!visible || !g) return

    g.rotation.x = rotationOffsetRef?.current ?? 0

    // Pulse via direct material write — no React re-render.
    if (guideRef.current?.material) {
      const t = performance.now() * 0.001 * Math.PI * 2 * GUIDE_PULSE_HZ
      guideRef.current.material.opacity = 0.55 + Math.sin(t) * 0.35
    }

    // ── Red overlay bucketing ────────────────────────────────────────────
    const cov    = cutCoverageRef?.current
    const fromT  = cov ? Math.max(0, Math.min(1, cov.fromT)) : 0
    const toT    = cov ? Math.max(0, Math.min(1, cov.toT))   : 0
    const fBucket = Math.round(fromT / GUIDE_BUCKET_STEP)
    const tBucket = Math.round(toT   / GUIDE_BUCKET_STEP)

    if (fBucket !== lastFromBucketRef.current || tBucket !== lastToBucketRef.current) {
      lastFromBucketRef.current = fBucket
      lastToBucketRef.current   = tBucket

      if (toT - fromT < GUIDE_MIN_SPAN) {
        if (donePoints !== null) setDonePoints(null)
      } else {
        const ax = head.x + (tail.x - head.x) * fromT
        const ay = head.y + (tail.y - head.y) * fromT
        const az = head.z + (tail.z - head.z) * fromT
        const bx = head.x + (tail.x - head.x) * toT
        const by = head.y + (tail.y - head.y) * toT
        const bz = head.z + (tail.z - head.z) * toT
        setDonePoints([[ax, ay, az], [bx, by, bz]])
      }
    }

    // ── Screen projection ────────────────────────────────────────────────
    if (screenPolylineRef?.current) {
      let screenLen = 0
      for (let i = 0; i < samples.length; i++) {
        v.copy(samples[i]).applyMatrix4(g.matrixWorld).project(camera)
        const x = ( v.x + 1) * 0.5 * size.width
        const y = (-v.y + 1) * 0.5 * size.height
        screenBuf[i * 2]     = x
        screenBuf[i * 2 + 1] = y
        if (i > 0) {
          const dx = x - screenBuf[(i - 1) * 2]
          const dy = y - screenBuf[(i - 1) * 2 + 1]
          screenLen += Math.hypot(dx, dy)
        }
      }
      const ref = screenPolylineRef.current
      ref.points     = screenBuf
      ref.arcLengths = arcLengths
      ref.totalLen   = totalLen
      ref.screenLen  = screenLen
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={GUIDE_WORLD_POS}>
      {/* Anatomical guide line — target path (straight head → tail) */}
      <Line
        ref={guideRef}
        points={samplePoints}
        color="#a70101"
        lineWidth={9}
        transparent
        opacity={2.0}
        depthTest={false}
        raycast={NO_RAYCAST}
      />
      {/* "Cut so far" slit — three stacked Line2s:
          1) wide dark maroon base reads as torn skin on the dorsum
          2) mid crimson band adds body to the gash
          3) bright coral/pink core is the fresh-cut highlight */}
      {donePoints && (
        <>
          <Line
            points={donePoints}
            color="#2a0202"
            lineWidth={16}
            transparent
            opacity={1}
            depthTest={false}
            raycast={NO_RAYCAST}
          />
          <Line
            points={donePoints}
            color="#9e1a1a"
            lineWidth={9}
            transparent
            opacity={1}
            depthTest={false}
            raycast={NO_RAYCAST}
          />
          <Line
            points={donePoints}
            color="#ff5a5a"
            lineWidth={3}
            transparent
            opacity={1}
            depthTest={false}
            raycast={NO_RAYCAST}
          />
        </>
      )}
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// usePositionFish — inlined from Step04Positioning.jsx
//
// Phase A hook. Rolls the fish from flat → dorsal-up before the dorsal cut.
// Exposes rotationOffsetRef and a domUI progress panel.
// Calls onAligned() once the fish enters the target band.
// ─────────────────────────────────────────────────────────────────────────────
const POSITION_START  = 0
const POSITION_TARGET = Math.PI / 2
const POS_TOLERANCE   = 0.38
const POS_OVERSHOOT   = 0.30
const POS_GESTURE_DIR = -1
const POS_DIR         = Math.sign(POSITION_TARGET - POSITION_START) || 1
const POS_SENSITIVITY = 0.016 * POS_DIR * POS_GESTURE_DIR
const POS_WHEEL_STEP  = 0.12  * POS_DIR * POS_GESTURE_DIR
const POS_CLAMP_LO    = Math.min(POSITION_START, POSITION_TARGET) - POS_OVERSHOOT
const POS_CLAMP_HI    = Math.max(POSITION_START, POSITION_TARGET) + POS_OVERSHOOT
const POS_RANGE       = POSITION_TARGET - POSITION_START

function usePositionFish(active, onAligned) {
  const rotationOffsetRef = useRef(0)
  const rotatingRef       = useRef(false)
  const startYRef         = useRef(0)
  const startValRef       = useRef(0)

  const [aligned, setAligned] = useState(false)
  const [pct,     setPct]     = useState(0)

  useEffect(() => {
    if (!active) return
    rotationOffsetRef.current = POSITION_START
    rotatingRef.current       = false
    setAligned(false)
    setPct(0)
  }, [active])

  useEffect(() => {
    if (!active) return

    const apply = (raw) => {
      const clamped = Math.max(POS_CLAMP_LO, Math.min(POS_CLAMP_HI, raw))
      rotationOffsetRef.current = clamped

      const pctVal = Math.max(0, Math.min(100, ((clamped - POSITION_START) / POS_RANGE) * 100))
      const bucket = Math.round(pctVal / 5) * 5
      setPct(prev => (prev === bucket ? prev : bucket))

      const isAligned = Math.abs(clamped - POSITION_TARGET) < POS_TOLERANCE
      setAligned(prev => (prev === isAligned ? prev : isAligned))
      return isAligned
    }

    const onDown = (e) => {
      if (!(e.target instanceof HTMLCanvasElement)) return
      rotatingRef.current = true
      startYRef.current   = e.clientY
      startValRef.current = rotationOffsetRef.current
      document.body.style.cursor = 'grabbing'
    }
    const onMove = (e) => {
      if (!rotatingRef.current) return
      const delta     = (startYRef.current - e.clientY) * POS_SENSITIVITY
      const isAligned = apply(startValRef.current + delta)
      if (isAligned) onAligned?.()
    }
    const onUp = () => {
      if (!rotatingRef.current) return
      rotatingRef.current = false
      document.body.style.cursor = 'grab'
      if (Math.abs(rotationOffsetRef.current - POSITION_TARGET) < POS_TOLERANCE) {
        onAligned?.()
      }
    }
    const onWheel = (e) => {
      apply(rotationOffsetRef.current - Math.sign(e.deltaY) * POS_WHEEL_STEP)
      if (!rotatingRef.current &&
          Math.abs(rotationOffsetRef.current - POSITION_TARGET) < POS_TOLERANCE) {
        onAligned?.()
      }
    }

    document.body.style.cursor = 'grab'
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    window.addEventListener('wheel',       onWheel, { passive: true })

    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      window.removeEventListener('wheel',       onWheel)
    }
  }, [active, onAligned])

  const domUI = active ? (
    <div style={{
      ...HINT_STYLE,
      flexDirection: 'column', gap: '8px', borderRadius: '16px',
      padding: '12px 22px', minWidth: '300px',
      background: 'rgba(4,20,8,0.92)',
      border: `2px solid ${aligned ? 'rgba(78,205,113,0.9)' : 'rgba(245,200,66,0.55)'}`,
      transition: 'border-color 0.2s',
    }}>
      <span>
        {aligned
          ? '✅ Perfect! Dorsal side up — nice work!'
          : `⬇️ Drag down (or scroll) to lay the fish flat — dorsal up  (${pct}%)`}
      </span>
      <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: aligned
            ? 'linear-gradient(90deg, #4ecd71, #a8f0b8)'
            : 'linear-gradient(90deg, #f5c842, #4ecd71)',
          borderRadius: '3px', transition: 'width 0.05s linear, background 0.2s',
        }} />
      </div>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
        Drag anywhere on the scene · mouse wheel also rotates
      </span>
    </div>
  ) : null

  return { rotationOffsetRef, domUI, aligned, pct }
}

// ── CuttingHUD — live coverage + accuracy chips (Phase B) ────────────────────
function CuttingHUD({ cutPct, accPct, offPath }) {
  const accColor = offPath ? '#ffce5c' : accPct >= 80 ? '#4ecd71' : accPct >= 50 ? '#f5c842' : '#ff7070'
  return (
    <div style={{
      position: 'absolute', bottom: 156, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, zIndex: 102, pointerEvents: 'none',
    }}>
      <style>{`@keyframes s3Pulse{from{opacity:1}to{opacity:.4}}`}</style>
      <div style={{ ...CHIP, border: '1px solid rgba(78,205,113,0.5)' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>COV</span>
        <span style={{ color: '#4ecd71', fontWeight: 700 }}>{cutPct}%</span>
      </div>
      <div style={{
        ...CHIP,
        border: offPath ? '1px solid rgba(255,200,80,0.75)' : '1px solid rgba(245,200,66,0.4)',
        animation: offPath ? 's3Pulse 0.4s ease-in-out infinite alternate' : 'none',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ACC</span>
        <span style={{ color: accColor, fontWeight: 700 }}>{accPct}%</span>
      </div>
    </div>
  )
}

// ── useDorsalCut — Phase B hook ───────────────────────────────────────────────
// Scoring / progress / completion logic. Pointer events arrive from
// DorsalCutSensor via the `handlers` callbacks. Drifting past WRONG_PATH_RATIO
// only stalls the cut — coverage holds and tracing resumes once the cursor is
// back inside the band. No restart required.
function useDorsalCut(active, onComplete) {
  const cuttingRef        = useRef(false)
  const doneRef           = useRef(false)
  const cutCoverageRef    = useRef({ fromT: 0, toT: 0 })
  const cutProgressRef    = useRef(0)
  const lastTRef          = useRef(0)
  const offPathRef        = useRef(false)
  const maxDeviationRef   = useRef(0)
  const attemptsRef       = useRef(1)
  const lastScreenPosRef  = useRef({ x: 0, y: 0 })
  const lastCovBucketRef  = useRef(0)
  const lastAccBucketRef  = useRef(100)
  const flashTimerRef     = useRef(null)
  const startWarnTimerRef = useRef(null)

  const [cutPct,       setCutPct]       = useState(0)
  const [accPct,       setAccPct]       = useState(100)
  const [isCutting,    setIsCutting]    = useState(false)
  const [offPath,      setOffPath]      = useState(false)
  const [flash,        setFlash]        = useState(false)
  const [startWarning, setStartWarning] = useState(false)

  const resetCut = useCallback(() => {
    cuttingRef.current       = false
    cutCoverageRef.current   = { fromT: 0, toT: 0 }
    cutProgressRef.current   = 0
    lastTRef.current         = 0
    offPathRef.current       = false
    maxDeviationRef.current  = 0
    lastCovBucketRef.current = 0
    lastAccBucketRef.current = 100
    setCutPct(0); setAccPct(100); setIsCutting(false); setOffPath(false)
  }, [])

  useEffect(() => {
    doneRef.current     = false
    attemptsRef.current = 1
    resetCut()
    setFlash(false); setStartWarning(false)
    clearTimeout(flashTimerRef.current)
    clearTimeout(startWarnTimerRef.current)
  }, [active, resetCut])

  useEffect(() => {
    if (!active) return
    document.body.style.cursor = 'none'
    return () => { document.body.style.cursor = '' }
  }, [active])

  useEffect(() => () => { document.body.style.cursor = '' }, [])

  const handlers = useMemo(() => ({
    onDown: (t, devRatio) => {
      if (doneRef.current || cuttingRef.current) return
      if (devRatio > START_PATH_RATIO) {
        setStartWarning(true)
        startWarnTimerRef.current = setTimeout(() => setStartWarning(false), 1000)
        return
      }
      cuttingRef.current      = true
      cutCoverageRef.current  = { fromT: t, toT: t }
      cutProgressRef.current  = 0
      lastTRef.current        = t
      offPathRef.current      = false
      maxDeviationRef.current = devRatio
      setIsCutting(true); setCutPct(0); setOffPath(false); setStartWarning(false)
    },
    onMove: (t, devRatio, screenX, screenY) => {
      lastScreenPosRef.current = { x: screenX, y: screenY }
      if (!cuttingRef.current) return

      if (devRatio > maxDeviationRef.current) maxDeviationRef.current = devRatio
      const rawAcc    = Math.max(0, 1 - maxDeviationRef.current / WRONG_PATH_RATIO)
      const accBucket = Math.round(rawAcc * 20) * 5
      if (accBucket !== lastAccBucketRef.current) {
        lastAccBucketRef.current = accBucket
        setAccPct(accBucket)
      }

      const warn = devRatio > WARN_PATH_RATIO
      if (warn !== offPathRef.current) { offPathRef.current = warn; setOffPath(warn) }

      if (devRatio > WRONG_PATH_RATIO) return

      if (Math.abs(t - lastTRef.current) > JUMP_TOL) { lastTRef.current = t; return }
      lastTRef.current = t

      const cov = cutCoverageRef.current
      if (t > cov.toT)   cov.toT   = t
      if (t < cov.fromT) cov.fromT = t
      cutProgressRef.current = Math.max(0, Math.min(1, cov.toT - cov.fromT))

      const covBucket = Math.round(cutProgressRef.current * 20) * 5
      if (covBucket !== lastCovBucketRef.current) {
        lastCovBucketRef.current = covBucket
        setCutPct(covBucket)
      }

      if (cov.fromT <= END_TOL && cov.toT >= 1 - END_TOL && !doneRef.current) {
        doneRef.current = true; cuttingRef.current = false
        cutProgressRef.current = 1
        setIsCutting(false); setOffPath(false); setFlash(true)

        const finalAcc = Math.round(rawAcc * 100)
        flashTimerRef.current = setTimeout(() => {
          setFlash(false)
          onComplete({
            accuracy: finalAcc,
            coverage: 100,
            attempts: attemptsRef.current,
            cursorX:  lastScreenPosRef.current.x,
            cursorY:  lastScreenPosRef.current.y,
          })
        }, 450)
      }
    },
    onUp: () => {
      if (!cuttingRef.current) return
      cuttingRef.current = false; setIsCutting(false); setOffPath(false)
    },
  }), [onComplete])

  return {
    handlers, cutCoverageRef, cutProgressRef,
    cutPct, accPct, isCutting, offPath, flash, startWarning,
  }
}

// ── DorsalCutSensor — R3F component (inside Canvas) ──────────────────────────
// Mirrors DorsalCutGuide's group transform so the head→tail line it scores
// against exactly matches the rendered guide. For each pointer position it finds
// the closest point between the camera ray and that 3D line segment.
function DorsalCutSensor({ active, handlers, rotationOffsetRef }) {
  const { scene }  = useGLTF('/models/BangusCUTTEDFIN.opt.glb')
  const { camera } = useThree()

  const groupRef = useRef()
  const knifeRef = useRef()

  const pointerDownRef  = useRef(false)
  const screenPosRef    = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth  * 0.5 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0,
  })
  const sizeRef         = useRef({ width: window.innerWidth, height: window.innerHeight })
  const firstFrameRef   = useRef(true)

  const raycaster  = useMemo(() => new THREE.Raycaster(), [])
  const ndc        = useMemo(() => new THREE.Vector2(), [])
  const worldHead  = useMemo(() => new THREE.Vector3(), [])
  const worldTail  = useMemo(() => new THREE.Vector3(), [])
  const segDir     = useMemo(() => new THREE.Vector3(), [])
  const toHead     = useMemo(() => new THREE.Vector3(), [])
  const cutPoint   = useMemo(() => new THREE.Vector3(), [])
  const onLine     = useMemo(() => new THREE.Vector3(), [])
  const handAnchor = useMemo(() => new THREE.Vector3(), [])
  const aimDir     = useMemo(() => new THREE.Vector3(), [])
  const negAim     = useMemo(() => new THREE.Vector3(), [])
  const targetPos  = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat    = useMemo(() => new THREE.Quaternion(), [])

  const { samples } = useMemo(
    () => buildDorsalSpline(scene, { scale: 0.6, rotationY: Math.PI / 2 }),
    [scene],
  )

  const bladeShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(0.045, -0.002)
    s.lineTo(0.14,  -0.005)
    s.lineTo(0.24,  -0.006)
    s.lineTo(0.24,   0.013)
    s.lineTo(0.15,   0.011)
    s.lineTo(0.05,   0.006)
    s.closePath()
    return s
  }, [])

  const computeCut = useCallback((x, y) => {
    const g = groupRef.current
    if (!g) return null
    const { width, height } = sizeRef.current
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const O = raycaster.ray.origin
    const D = raycaster.ray.direction

    worldHead.copy(samples[0]).applyMatrix4(g.matrixWorld)
    worldTail.copy(samples[samples.length - 1]).applyMatrix4(g.matrixWorld)
    segDir.subVectors(worldTail, worldHead)
    const e = segDir.dot(segDir)
    if (e < 1e-8) return null
    const segLen = Math.sqrt(e)

    toHead.subVectors(O, worldHead)
    const b     = D.dot(segDir)
    const c     = D.dot(toHead)
    const fd    = segDir.dot(toHead)
    const denom = e - b * b
    if (denom < 1e-8) return null

    let u = (fd - c * b) / denom
    if (u < 0) u = 0
    else if (u > 1) u = 1
    const s = u * b - c

    cutPoint.copy(O).addScaledVector(D, s)
    onLine.copy(worldHead).addScaledVector(segDir, u)
    const devRatio = cutPoint.distanceTo(onLine) / segLen
    return { t: u, devRatio }
  }, [camera, ndc, raycaster, samples, worldHead, worldTail, segDir, toHead, cutPoint, onLine])

  useFrame(({ size }) => {
    sizeRef.current = size

    const g = groupRef.current
    if (!g) return
    g.rotation.x = rotationOffsetRef?.current ?? 0
    g.updateMatrixWorld(true)

    const knife = knifeRef.current
    if (!knife) return

    const res = computeCut(screenPosRef.current.x, screenPosRef.current.y)
    if (!res) return

    handAnchor.set(KNIFE_HAND_LOCAL[0], KNIFE_HAND_LOCAL[1], KNIFE_HAND_LOCAL[2])
    camera.localToWorld(handAnchor)

    aimDir.subVectors(cutPoint, handAnchor)
    const a2 = aimDir.lengthSq()
    if (a2 < 1e-6) return
    aimDir.multiplyScalar(1 / Math.sqrt(a2))
    negAim.copy(aimDir).negate()

    const jab = pointerDownRef.current ? KNIFE_PRESS_JAB : 0
    targetPos.copy(handAnchor).addScaledVector(aimDir, KNIFE_SCALE * KNIFE_GRIP_Y + jab)
    tmpQuat.setFromUnitVectors(WORLD_UP, negAim)

    if (firstFrameRef.current) {
      knife.position.copy(targetPos)
      knife.quaternion.copy(tmpQuat)
      firstFrameRef.current = false
    } else {
      knife.position.lerp(targetPos, 0.4)
      knife.quaternion.slerp(tmpQuat, 0.3)
    }
  })

  useEffect(() => {
    if (!active) { pointerDownRef.current = false; return }

    const onDown = (e) => {
      if (pointerDownRef.current) return
      const res = computeCut(e.clientX, e.clientY)
      if (!res) return
      screenPosRef.current   = { x: e.clientX, y: e.clientY }
      pointerDownRef.current = true
      handlers.onDown(res.t, res.devRatio)
    }
    const onMove = (e) => {
      screenPosRef.current = { x: e.clientX, y: e.clientY }
      if (!pointerDownRef.current) return
      const res = computeCut(e.clientX, e.clientY)
      if (res) handlers.onMove(res.t, res.devRatio, e.clientX, e.clientY)
    }
    const onUp = () => {
      if (!pointerDownRef.current) return
      pointerDownRef.current = false
      handlers.onUp()
    }

    window.addEventListener('pointerdown',   onDown)
    window.addEventListener('pointermove',   onMove)
    window.addEventListener('pointerup',     onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown',   onDown)
      window.removeEventListener('pointermove',   onMove)
      window.removeEventListener('pointerup',     onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [active, handlers, computeCut])

  return (
    <>
      <group ref={groupRef} position={FISH_WORLD_CUTTING} />
      <group ref={knifeRef} scale={KNIFE_SCALE}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <extrudeGeometry args={[bladeShape, BLADE_EXTRUDE]} />
          <meshStandardMaterial color="#eef3f8" metalness={0.85} roughness={0.22} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.345, 0]}>
          <cylinderGeometry args={[0.0115, 0.013, 0.28, 6]} />
          <meshStandardMaterial color="#c8a06e" roughness={0.6} />
        </mesh>
      </group>
    </>
  )
}

// ── DorsalIncision — embedded "cut so far" slit on the dorsal ridge ──────────
// A thin dark slab that rides the head→tail line, grows along the [fromT..toT]
// covered span, and sits a hair above the ridge. Mirrors DorsalCutGuide's
// group transform.
function DorsalIncision({ rotationOffsetRef, coverageRef }) {
  const { scene } = useGLTF('/models/BangusCUTTEDFIN.opt.glb')
  const groupRef  = useRef()
  const slitRef   = useRef()

  const { head, dir, len, dirN } = useMemo(() => {
    const { samples } = buildDorsalSpline(scene, { scale: 0.6, rotationY: Math.PI / 2 })
    const h = samples[0]
    const d = new THREE.Vector3().subVectors(samples[samples.length - 1], h)
    const l = d.length() || 1
    return { head: h, dir: d, len: l, dirN: d.clone().divideScalar(l) }
  }, [scene])

  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const g = groupRef.current
    const s = slitRef.current
    if (!g || !s) return
    g.rotation.x = rotationOffsetRef?.current ?? 0
    g.updateMatrixWorld(true)

    const cov   = coverageRef?.current
    const fromT = cov ? Math.max(0, Math.min(1, cov.fromT)) : 0
    const toT   = cov ? Math.max(0, Math.min(1, cov.toT))   : 0
    const span  = toT - fromT
    if (span < 0.015) { s.visible = false; return }
    s.visible = true

    const mid = (fromT + toT) * 0.5
    tmp.copy(head).addScaledVector(dir, mid)
    s.position.set(tmp.x, tmp.y + 0.0025, tmp.z)
    s.quaternion.setFromUnitVectors(UNIT_X, dirN)
    s.scale.set(len * span, 1, 1)
  })

  return (
    <group ref={groupRef} position={FISH_WORLD_CUTTING}>
      <mesh ref={slitRef} visible={false}>
        <boxGeometry args={[1, 0.008, 0.024]} />
        <meshStandardMaterial color="#360707" roughness={0.85} />
        <mesh position={[0, 0.006, 0]}>
          <boxGeometry args={[1, 0.004, 0.009]} />
          <meshStandardMaterial color="#7d1414" roughness={0.65} emissive="#2a0606" emissiveIntensity={0.4} />
        </mesh>
      </mesh>
    </group>
  )
}

// ── Step04Preview — phase machine: 'position' → 'cutting' → 'done' ───────────
export default function Step04Preview() {
  const [phase, setPhase] = useState('position')
  const cutStatsRef = useRef(null)

  // Phase A
  const advanceToCut = useCallback(() => {
    setTimeout(() => setPhase('cutting'), 300)
  }, [])
  const position = usePositionFish(phase === 'position', advanceToCut)

  // Phase B → done
  const handleCutComplete = useCallback((stats) => {
    cutStatsRef.current = stats
    setPhase('done')
  }, [])
  const cut = useDorsalCut(phase === 'cutting', handleCutComplete)

  // Phase B hint panel styling
  const accent    = cut.flash        ? 'rgba(78,205,113,0.95)'
    : cut.startWarning ? 'rgba(245,108,66,0.9)'
    : cut.offPath      ? 'rgba(245,200,66,0.9)'
    : cut.isCutting    ? 'rgba(78,205,113,0.85)'
    :                    'rgba(245,200,66,0.55)'
  const textColor = cut.flash        ? '#4ecd71'
    : cut.startWarning ? '#ff9b6b'
    : cut.offPath      ? '#ffce5c'
    : cut.isCutting    ? '#4ecd71'
    :                    '#f5c842'
  const hintLabel = cut.flash        ? '✅ Perfect dorsal cut'
    : cut.startWarning ? '⚠️ Click on the glowing line to start'
    : cut.offPath      ? '⚠️ Off the line — ease back on to keep cutting'
    : cut.isCutting    ? `🔪 Cutting… ${cut.cutPct}%`
    :                    '🔪 Trace the glowing line from end to end'
  const barColor  = cut.offPath
    ? 'linear-gradient(90deg,#f5c842,#ffe9a8)'
    : 'linear-gradient(90deg,#4ecd71,#88ffaa)'

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
            cameraPreset={phase === 'done' ? 'cuttingBoardZoom' : 'cuttingBoard'}
            lerpSpeed={phase === 'done' ? 0.06 : 1}
            orbitEnabled={false}
            instant={phase !== 'done'}
          />
          <FishModel
            location="cuttingBoard"
            rotationOffsetRef={position.rotationOffsetRef}
            cutProgressRef={phase === 'cutting' ? cut.cutProgressRef : null}
            cutComplete={phase === 'done'}
          />
          {phase === 'cutting' && (
            <>
              <DorsalCutGuide
                visible
                rotationOffsetRef={position.rotationOffsetRef}
                screenPolylineRef={null}
              />
              <DorsalIncision
                rotationOffsetRef={position.rotationOffsetRef}
                coverageRef={cut.cutCoverageRef}
              />
              <DorsalCutSensor
                active
                handlers={cut.handlers}
                rotationOffsetRef={position.rotationOffsetRef}
              />
            </>
          )}
        </Suspense>
      </Canvas>

      {/* Phase A DOM */}
      {phase === 'position' && position.domUI}

      {/* Phase B DOM */}
      {phase === 'cutting' && (
        <>
          <div style={{
            position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            background: cut.flash ? 'rgba(10,60,20,0.97)' : 'rgba(4,20,8,0.92)',
            border: `2px solid ${accent}`, borderRadius: 20, padding: '12px 28px',
            transition: 'background 0.3s, border-color 0.3s',
            fontFamily: FONT, backdropFilter: 'blur(10px)',
            zIndex: 101, pointerEvents: 'none', minWidth: 290,
          }}>
            <span style={{ color: textColor, fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              {hintLabel}
            </span>
            {!cut.flash && (
              <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${cut.cutPct}%`, background: barColor,
                  borderRadius: 3, transition: 'width 0.08s linear, background 0.3s',
                }} />
              </div>
            )}
          </div>
          <CuttingHUD cutPct={cut.cutPct} accPct={cut.accPct} offPath={cut.offPath} />
          <div aria-hidden="true" style={{
            position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90,
            background: 'radial-gradient(circle at center,rgba(255,200,40,0) 48%,rgba(255,200,40,0.28) 100%)',
            opacity: cut.offPath ? 1 : 0,
            transition: 'opacity 0.18s',
          }} />
        </>
      )}

      <div style={BADGE_STYLE}>Step 4 Preview · Dev Only</div>
    </div>
  )
}