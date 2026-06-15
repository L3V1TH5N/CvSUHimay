// src/simulation/components/fish/FishModel.jsx

import { useRef, useState, useEffect, useMemo, memo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '../../utils/useGLTFLocal'
import * as THREE from 'three'

// Squared world-space epsilon (~1 cm²) and rotation epsilon (~0.06°) for the
// useFrame at-rest early-out. When the fish is parked at its destination and
// no fade is in flight, we skip the per-frame lerps entirely.
const POS_EPSILON_SQ = 1e-4
const ROT_EPSILON    = 1e-3

// World placement per FSM location.
const FISH_WORLD = {
  sink:         new THREE.Vector3(-0.29, 1.11, -2.18),
  cuttingBoard: new THREE.Vector3( 0.93, 0.97, -2.19),
  table:        new THREE.Vector3( 1.80, 0.81,  0.80),
}

const FISH_ROTATION_Y = {
  sink:         1.6,
  cuttingBoard: Math.PI / 2,
  table:        Math.PI / 2,
}

// Cut-coverage threshold at which the closed → butterflied cross-fade begins.
// Lower = fade starts earlier in the cut → broader, more gradual transition.
const FADE_START_T = 0.65

// Per-frame catch-up factor (0..1). Lower = gentler easing toward the target.
// 0.18 produces a ~0.5 s settle from 0 → ~0.99 at 60fps.
const FADE_SMOOTH = 0.18

// Shared invisible hit material — one allocation for all instances.
const HIT_MAT = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

const BOX_SCRATCH = new THREE.Vector3()

// Cutting-board butterflied positioning (steps 5–9).
const BUTTERFLIED_FLAT_TILT_X = -0.05
const BUTTERFLIED_FLAT_TILT_Z = 0.0
const BUTTERFLIED_LIFT        = 0.02
const BUTTERFLIED_BACK_SHIFT  = 0.0

// Sink butterflied positioning (step 10 final rinse — values from Step10Preview).
const BF_SINK_TILT_X = 0.11
const BF_SINK_TILT_Z = 0.1
const BF_SINK_LIFT   = -0.05
const BF_SINK_SHIFT  = 0.05
const BF_SINK_SCALE  = 0.85

export const FishModel = memo(function FishModel({
  location          = 'sink',
  hidden            = false,
  highlighted       = false,
  washProgress      = 0,
  dragProgressRef   = null,
  rotationOffsetRef = null,
  cutProgressRef    = null,
  cutComplete       = false,
  // Which GLB to use as the "closed" (pre-cut) fish. Defaults to bangus3 for
  // Steps 0–1; caller passes BangusCUTTEDFIN for Steps 2–4 so the model
  // reflects that fins have already been trimmed.
  closedModelPath   = '/models/BangusCUTTEDFIN.opt.glb',
  // JSX rendered as a child of the butterflied-fish transform group, so its
  // contents inherit the fish's scale/rotation/position. Used by Step 5 to
  // attach the 88-bone dorsal cluster directly onto the butterflied bangus.
  dorsalBoneSlot    = null,
  // Same contract as dorsalBoneSlot, but populated by Step 6 with the 48
  // ventral-bone cluster. Both slots share the same butterflied transform
  // group so authored bone positions are in identical local space.
  ventralBoneSlot   = null,
  // Same contract as dorsal/ventral slots — populated by Step 9 with the
  // 42 lateral-spine GLBs loaded by lateralBonesLoader.js.
  lateralBoneSlot   = null,
  // When true, teleports the group to the current location's world position
  // instead of lerping. Used at the Step 10→11 boundary so the fish is
  // immediately on the cutting board when the InspectCamera mounts overhead.
  locationSnap     = false,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
}) {
  const groupRef  = useRef()
  const { scene: closedScene }      = useGLTF(closedModelPath)
  const { scene: butterfliedScene } = useGLTF('/models/DaingCuttedFins.opt.glb')

  const closedClone      = useMemo(() => closedScene.clone(),      [closedScene])
  const butterfliedClone = useMemo(() => butterfliedScene.clone(), [butterfliedScene])

  // Material setup — clone so this FishModel instance owns its own materials
  // (the underlying useGLTF cache is shared with the Practice preview), but
  // leave `transparent` FALSE by default. Forcing transparency permanently
  // pushes every fish mesh into the alpha-blend bucket, kills batching, and
  // hurts overdraw on iGPUs even when opacity is 1. We flip transparent on
  // only during the fade window (see useFrame below) and back off when the
  // butterflied mesh settles to opaque.
  //
  // NOTE: visibility of the butterflied mesh is React-managed via
  // `butterfliedReady` state + `<primitive visible={...}>` below. We
  // intentionally do NOT mutate `butterfliedClone.visible` here — that was a
  // useMemo side-effect, and any re-run of this memo (Strict Mode in dev,
  // HMR, deps re-evaluation) would reset the butterflied mesh to hidden
  // *after* the cross-fade had already revealed it, breaking steps 8–10
  // where there's no compensating geometry on top of the fish.
  const { closedMats, butterfliedMats } = useMemo(() => {
    const closedMats      = []
    const butterfliedMats = []
    closedClone.traverse((c) => {
      if (!c.isMesh || !c.material) return
      c.material = c.material.clone()
      // Opaque by default; toggled on only during cross-fade.
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

  const destPos   = useRef(FISH_WORLD[location]?.clone() ?? FISH_WORLD.sink.clone())
  const rotationY = FISH_ROTATION_Y[location] ?? FISH_ROTATION_Y.sink
  const arcTarget = useRef(new THREE.Vector3())

  const { hitSize, hitCenter, butterfliedOffset } = useMemo(() => {
    // ── Closed mesh box (for hit volume only) ───────────────────────────
    closedClone.scale.setScalar(0.6)
    closedClone.rotation.set(0, rotationY, 0)
    closedClone.updateMatrixWorld(true)
    const closedBox = new THREE.Box3().setFromObject(closedClone)
    const size      = closedBox.getSize(BOX_SCRATCH).clone()
    const center    = closedBox.getCenter(BOX_SCRATCH).clone()
    closedClone.scale.setScalar(1)
    closedClone.rotation.set(0, 0, 0)

    // Butterflied offset matches Step11Preview exactly: fixed lift, no
    // dynamic dy from bounding boxes (which shifted the fish below the board).
    return {
      hitSize:   [size.x * 1.15, size.y * 1.15, size.z * 1.15],
      hitCenter: center.toArray(),
      butterfliedOffset: [0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT],
    }
  }, [closedClone, rotationY, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT])

  // Update cuttingBoard/sink/table destination when location changes.
  useEffect(() => {
    const target = FISH_WORLD[location] ?? FISH_WORLD.sink
    destPos.current.copy(target)
  }, [location])

  // Teleport the group to the destination when locationSnap becomes true.
  // Runs after the [location] effect so destPos.current is already updated.
  // This fires exactly once per true→false→true cycle (Step 10→11 boundary).
  useEffect(() => {
    if (!locationSnap || !groupRef.current) return
    groupRef.current.position.copy(destPos.current)
  }, [locationSnap])

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
  // Tracks the last fade value we actually wrote into the material opacities.
  // When the per-frame target hasn't moved (cursor idle, or live cut paused),
  // fadeRef === lastWrittenRef and we skip the material write loop entirely.
  const lastWrittenRef = useRef(-1)
  // One-shot ref: have we flipped materials into transparent mode? Used to
  // dedupe the per-frame initialisation of the fade pipeline.
  const fadeStartedRef = useRef(false)
  // Latches true the first time cutComplete is ever seen, then stays true so
  // the smooth fade-to-completion continues even after the FSM advances past
  // this step and cutComplete reverts to false.
  const completingRef = useRef(false)

  // React state — when this flips true, the closed `<primitive>` is unmounted
  // from the scene tree (frees GPU draw calls + traversal cost). State (not a
  // ref) is required because we need React to re-render and drop the JSX node.
  const [closedRemoved, setClosedRemoved] = useState(false)

  // React state — drives the butterflied <primitive>'s `visible` prop. Flips
  // true the moment the cross-fade begins (live cut OR cutComplete on mount).
  // Must be state (not an imperative `.visible = true` mutation) because R3F
  // re-applies JSX props on each render — that re-application is what keeps
  // the mesh visible across useMemo re-runs / Strict Mode double-mounts.
  const [butterfliedReady, setButterfliedReady] = useState(false)

  // Begins the alpha-blend phase: closed mesh becomes transparent and the
  // butterflied mesh becomes visible+transparent so its opacity can rise.
  // Idempotent — guarded by fadeStartedRef so it runs at most once per mount.
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
    // Flip the React-managed visibility flag instead of mutating
    // butterfliedClone.visible directly. The JSX `visible={butterfliedReady}`
    // prop is the durable source of truth — survives useMemo re-runs.
    setButterfliedReady(true)
  }

  // Settles the butterflied mesh back to opaque rendering once the fade is
  // complete and triggers React unmount of the closed primitive.
  const settleFade = () => {
    for (let i = 0; i < butterfliedMats.length; i++) {
      butterfliedMats[i].opacity     = 1
      butterfliedMats[i].transparent = false
      butterfliedMats[i].depthWrite  = true
    }
    setClosedRemoved(true)
  }

  // Reset cross-fade state when the caller swaps the closed model (e.g. bangus3
  // → BangusCUTTEDFIN at the Step 1→2 boundary). Without this, stale
  // fadeStartedRef / closedRemoved state from a prior model could suppress the
  // new model's rendering or skip the closed-mesh entirely.
  useEffect(() => {
    // Skip reset if the fade is already complete — the butterflied fish is
    // visible and should stay visible (e.g. step 4→5+ transitions). Only
    // reset when actually swapping closed models before the fade finishes.
    if (fadeRef.current >= 1) return
    completingRef.current  = false
    fadeRef.current        = 0
    lastWrittenRef.current = -1
    fadeStartedRef.current = false
    setClosedRemoved(false)
    setButterfliedReady(false)
  }, [closedModelPath])

  useFrame(() => {
    if (!groupRef.current) return
    const drag = dragProgressRef?.current ?? 0

    // Latch once cutComplete is first seen.
    if (cutComplete && !completingRef.current) completingRef.current = true

    // As soon as the cut is done, target flat (0). A faster lerp (0.22 vs
    // 0.14) makes the fish drop quickly at first and decelerate naturally
    // as it approaches the board — physically believable without extra code.
    const targetX = completingRef.current ? 0 : (rotationOffsetRef?.current ?? 0)

    // ── Position/rotation: at-rest early-out ───────────────────────────────
    const distSq = groupRef.current.position.distanceToSquared(destPos.current)
    const dRotX  = Math.abs(groupRef.current.rotation.x - targetX)
    const dRotZ  = Math.abs(groupRef.current.rotation.z)
    const moving = drag > 0 || distSq > POS_EPSILON_SQ
                || dRotX > ROT_EPSILON || dRotZ > ROT_EPSILON

    if (moving) {
      if (drag > 0) {
        // Sink → cuttingBoard transfer arc
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
          groupRef.current.rotation.x, targetX,
          completingRef.current ? 0.22 : 0.14,
        )
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z, 0, 0.14,
        )

        if (distSq < POS_EPSILON_SQ) groupRef.current.position.copy(destPos.current)
        if (dRotX  < ROT_EPSILON)    groupRef.current.rotation.x = targetX
        if (dRotZ  < ROT_EPSILON)    groupRef.current.rotation.z = 0
      }
    }

    // ── Model swap: closed ⇨ butterflied ───────────────────────────────────
    // No opacity crossfade — the closed model stays fully visible during the
    // cut and throughout the drop. The swap fires when the fish is nearly flat
    // (< ~17°). At that angle the rotation motion masks the geometry change;
    // the eye follows the movement, not the mesh boundary.
    if (fadeRef.current >= 1) return
    if (!completingRef.current) return

    // Snap instantly if the step was skipped via UI (no live cut performed).
    if ((cutProgressRef?.current ?? 0) < 0.01) {
      fadeRef.current = 1; lastWrittenRef.current = 1
      beginFade(); settleFade(); return
    }

    // Gate: fish is still rotating — hold the closed model visible.
    const rotX = Math.abs(groupRef.current.rotation.x)
    if (rotX >= 0.30) return

    // Fish is nearly flat: instant model replacement.
    // Zero the closed opacity before beginFade so there is no single-frame
    // flash of the transparent closed mesh before React unmounts it.
    for (let i = 0; i < closedMats.length; i++) {
      closedMats[i].transparent = true
      closedMats[i].opacity     = 0
      closedMats[i].depthWrite  = false
    }
    fadeRef.current = 1; lastWrittenRef.current = 1
    beginFade()   // butterflied → transparent mode + setButterfliedReady(true)
    settleFade()  // butterflied → opaque + setClosedRemoved(true)
  })

  return (
    <group ref={groupRef} name="bangus_fish" position={destPos.current.toArray()} visible={!hidden}>
      {/* Closed fish — mounted only until the cross-fade completes. Once the
          butterflied mesh has fully faded in, `closedRemoved` flips true and
          React drops this primitive from the scene tree entirely. That frees
          its draw calls, geometry traversal cost, and shadow pass. */}
      {!closedRemoved && (
        <primitive
          object={closedClone}
          scale={0.6}
          rotation={[0, rotationY, 0]}
          castShadow
          receiveShadow
        />
      )}
      {/* Butterflied fish — fades in once the dorsal cut completes.
          position = computed bottom-alignment offset so this mesh's floor
          matches the closed mesh's floor (both sit on the same board plane).
          rotation = flat-lay pose: rotationY for heading, X/Z compensation for
          the GLB's authored tilt so the mesh sits exactly parallel to the board. */}
      <primitive
        object={butterfliedClone}
        scale={location === 'sink' ? BF_SINK_SCALE : 1.0}
        position={location === 'sink' ? [0, BF_SINK_LIFT, BF_SINK_SHIFT] : butterfliedOffset}
        rotation={[
          location === 'sink' ? BF_SINK_TILT_X : BUTTERFLIED_FLAT_TILT_X,
          rotationY,
          location === 'sink' ? BF_SINK_TILT_Z : BUTTERFLIED_FLAT_TILT_Z,
        ]}
        visible={butterfliedReady}
        castShadow
        receiveShadow
      />
      {/* Bone slot — sibling group with the SAME transform as the butterflied
          primitive above. Decoupling means the primitive's R3F state is
          unchanged (no double-scale on HMR), and bones still inherit the
          fish's scale/rotation/translation 1:1. Used by Step 5 to attach the
          88 dorsal bones directly onto the butterflied bangus. */}
      
      {/* Ventral bone slot — same transform contract as dorsalBoneSlot, used
          by Step 6 to attach the 48 ventral bones onto the butterflied bangus.
          Sibling group so neither slot's render churn invalidates the other. */}
      {ventralBoneSlot && (
        <group
          position={butterfliedOffset}
          rotation={[BUTTERFLIED_FLAT_TILT_X, rotationY, BUTTERFLIED_FLAT_TILT_Z]}
          scale={1.0}
        >
          {ventralBoneSlot}
        </group>
      )}
      {/* Lateral bone slot — same transform contract as dorsal/ventral, used
          by Step 7 to attach the 42 procedural lateral spines along the
          lateral line. Sibling group keeps render isolation between steps. */}
      {lateralBoneSlot && (
        <group
          position={butterfliedOffset}
          rotation={[BUTTERFLIED_FLAT_TILT_X, rotationY, BUTTERFLIED_FLAT_TILT_Z]}
          scale={1.0}
        >
          {lateralBoneSlot}
        </group>
      )}
      {/* Invisible hit mesh — direct R3F fiber node so pointer events always
          fire, regardless of which visible mesh is on top during the fade. */}
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
useGLTF.preload('/models/DaingCuttedFins.opt.glb')
useGLTF.preload('/models/butterfliedBangus.opt.glb')
