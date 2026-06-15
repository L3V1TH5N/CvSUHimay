// web/src/simulation/components/steps/Step01TrimFins/BoardToSinkTransition.jsx
//
// ── STEP 1 → STEP 2 CINEMATIC HAND-OFF (PERFORMANCE-OPTIMIZED) ──────────────
// Auto-driven fish flight: cut bangus lifts off the cutting board, arcs over
// the kitchen, and lands in the sink. Mirrors the lerp + settle-bounce profile
// used by Step 3's DraggableFish so step boundaries feel consistent.
//
// ── PERFORMANCE STRATEGY (read this before changing anything) ──────────────
//   1. PRELOAD         — GLB cache is warmed at module evaluation, so the
//                        binary is on disk-cache + parsed before Step 1 even
//                        first paints.
//   2. PRE-MOUNT       — SimulationScene mounts this component during Step 1,
//                        not at the boundary. The expensive Object3D.clone()
//                        walk happens while the user is busy cutting fins,
//                        not on the single frame that needs to be smooth.
//   3. CACHED CLONE    — clone() runs once per module load and is reused
//                        across remounts (reset, restart). Materials and
//                        geometries are reference-shared with the GLB cache,
//                        so this cache adds ~one extra Object3D tree, not
//                        extra GPU memory and not extra shader compiles.
//   4. REF-DRIVEN ARM  — the flight is started by a ref flip in the parent;
//                        zero React state, zero re-render.
//   5. dt-DRIVEN MATH  — uses the `dt` from useFrame instead of
//                        performance.now(); no Date allocation per frame.
//   6. EARLY-OUT       — useFrame returns immediately when (a) not armed,
//                        (b) settled. Step-1 frames pay the cost of a single
//                        boolean check and nothing else.
//
// ── COMMENT MAP (per the optimization brief) ────────────────────────────────
//   preload section            → useGLTF.preload below (line ~38)
//   transition optimization    → cached-clone helper + early-outs in useFrame
//   visibility switching       → group.visible toggled directly, no re-render
//   asset cleanup/disposal     → see "DISPOSAL POLICY" note further down
//   camera transition handling → none here; GameCamera glides the preset
//                                in parallel from SimulationScene's wiring

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '../../../utils/useGLTFLocal'
import { logEvent } from '../../../fsm/eventStream'
import { EVENT_TYPE } from '../../../fsm/errors'

// ── PRELOAD SECTION ────────────────────────────────────────────────────────
// Idempotent: useGLTF.preload no-ops on repeat. Listed at the top so module
// evaluation triggers the network fetch + parse before any React mount.
useGLTF.preload('/models/BangusCUTTEDFIN.opt.glb')

// ── CACHED CLONE ───────────────────────────────────────────────────────────
// Single-allocation node tree shared across all transition mounts. The first
// caller pays the Object3D.clone() walk; every subsequent caller returns the
// cached reference in O(1). React-three-fiber's <primitive> re-parents the
// same node on remount, so reset/restart cycles do not re-clone.
//
// ── DISPOSAL POLICY ────────────────────────────────────────────────────────
// We intentionally NEVER dispose the cached clone's geometries/materials —
// they are reference-shared with the GLB cache and other consumers (FishModel,
// FishTransition). Disposing here would break those. The cache holds one
// extra Object3D tree (~a few KB of JS objects); GPU memory is unaffected.
let cachedCloneRoot = null
function getCachedCloneRoot(scene) {
  if (cachedCloneRoot) return cachedCloneRoot
  cachedCloneRoot = scene.clone()
  // Disable raycast on every cloned node so the cinematic mesh never
  // intercepts a Step-2 wash gesture (FishModel handles all real hit-testing).
  cachedCloneRoot.traverse((o) => { o.raycast = () => null })
  return cachedCloneRoot
}

// ── ENDPOINTS — must mirror FishModel.FISH_WORLD/FISH_ROTATION_Y exactly ───
// START = visible pose where Step 1's FishTransition leaves the cut bangus.
// END   = FishModel.sink resting pose (FISH_WORLD.sink in FishModel.jsx).
// ROT_Y is constant across both endpoints so no rotation lerp is needed.
const START_POS   = new THREE.Vector3( 1.00, 1.09, -2.10)
const END_POS     = new THREE.Vector3(-0.29, 1.11, -2.18) // mirrors FishModel.FISH_WORLD.sink exactly
const START_SCALE = 0.9
const END_SCALE   = 0.6
const ROT_Y       = 1.6
const ARC_PEAK_DY = 0.52

// Flight duration (seconds). Slightly shorter than the camera's 1.8 s preset
// glide so the fish lands just before the camera settles — feels like it
// "arrives" rather than racing the camera.
const FLIGHT_DURATION = 1.5

// Settle bounce — same constants as DraggableFish.SETTLE_* so a Step-3 player
// feels the same "land" hit at the end of Step 1 → 2 as on board placement.
const SETTLE_INIT  = 0.022
const SETTLE_DECAY = 0.76

// Synthetic stepId on the append-only event log for this boundary.
const TRANSITION_ID = 'step_1_to_2'

// Ease-out cubic: strong initial velocity, smooth landing.
// Replaces smoothstep whose zero derivative at t=0 made the fish appear
// motionless for the first ~0.4 s — the main source of perceived lag.
const easeOutCubic = (t) => 1 - (1 - t) * (1 - t) * (1 - t)

// Mounted by SimulationScene during Step 1 (pre-warm) and Step 2 (in-flight).
// triggerRef.current = true arms the lerp; onDone fires exactly once on settle.
export function BoardToSinkTransition({ triggerRef, onDone }) {
  const { scene } = useGLTF('/models/BangusCUTTEDFIN.opt.glb')
  const cloneRoot = getCachedCloneRoot(scene)
  const { gl, camera } = useThree()

  const groupRef     = useRef()
  const elapsedRef   = useRef(0)
  const settleRef    = useRef(0)
  const startedRef   = useRef(false)
  const doneFiredRef = useRef(false)

  // ── VISIBILITY SWITCHING ─────────────────────────────────────────────────
  // Pre-mount: park the wrapping group at the START pose, hidden. group.visible
  // is the entire toggle — no React state change, no re-render, no Material
  // mutation. Three.js skips both rendering and raycasting on a hidden group.
  //
  // gl.compile pre-warms the clone's GL shader programs while the user is
  // still in step 1. The clone's materials are the GLB's originals (not the
  // transparent clones FishTransition uses), and FishModel is hidden during
  // step 1 — so without this call those exact programs are compiled for the
  // first time on the boundary frame, stalling it and making the flight start
  // look laggy.
  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    g.position.copy(START_POS)
    g.rotation.y = ROT_Y
    g.scale.setScalar(START_SCALE)
    g.visible = false
    // Reset per-instance progress refs so a re-mount (Reset/restart) gets a
    // clean cycle even though the underlying clone tree is shared.
    elapsedRef.current   = 0
    settleRef.current    = 0
    startedRef.current   = false
    doneFiredRef.current = false
    // Pre-compile shaders now, during step 1, so the first visibility flip on
    // the boundary frame costs nothing. gl and camera are stable for the
    // Canvas lifetime so [] deps is correct here.
    // NOTE: must compile cloneRoot (visible by default), NOT g — renderer.compile
    // uses traverseVisible internally and bails immediately on a hidden group.
    gl.compile(cloneRoot, camera)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return

    // ── EARLY-OUT: idle while parent has not armed us (entire Step 1) ─────
    if (!triggerRef.current) return
    // ── EARLY-OUT: post-settle, animation frozen until unmount ────────────
    if (doneFiredRef.current) return

    // First armed frame: reveal the group, emit BEGIN onto the event stream.
    if (!startedRef.current) {
      startedRef.current = true
      g.visible = true
      logEvent(TRANSITION_ID, EVENT_TYPE.STEP_TRANSITION_BEGIN, { from: 1, to: 2 })
    }

    // ── TRANSITION OPTIMIZATION LOGIC ────────────────────────────────────
    // dt-driven progress. No performance.now(), no Date allocation, no
    // intermediate Vector3 allocation — six in-place lerps and a sin-free
    // parabolic arc.
    elapsedRef.current += dt
    const t     = Math.min(1, elapsedRef.current / FLIGHT_DURATION)
    const eased = easeOutCubic(t)
    // Arc tracks raw t (not eased) so the vertical rise/fall is a symmetric
    // parabola centred at the time midpoint, independent of horizontal easing.
    const arc   = ARC_PEAK_DY * 4 * t * (1 - t)
    // Delay scale shrink to the descent half (t > 0.5) so the fish moves off
    // at full size before appearing to recede — avoids the "shrinking in place"
    // look when the horizontal travel is short.
    const scaledT = Math.max(0, (t - 0.5) / 0.5)
    const scaledE = easeOutCubic(scaledT)

    g.position.set(
      THREE.MathUtils.lerp(START_POS.x, END_POS.x, eased),
      THREE.MathUtils.lerp(START_POS.y, END_POS.y, eased) + arc,
      THREE.MathUtils.lerp(START_POS.z, END_POS.z, eased),
    )
    g.scale.setScalar(THREE.MathUtils.lerp(START_SCALE, END_SCALE, scaledE))

    if (t < 1) return

    // Settle bounce — runs only after the eased flight reaches the sink.
    if (settleRef.current === 0 && !doneFiredRef.current) {
      settleRef.current = SETTLE_INIT
    }
    settleRef.current *= SETTLE_DECAY
    if (settleRef.current < 1e-4) settleRef.current = 0

    g.position.set(END_POS.x, END_POS.y + settleRef.current, END_POS.z)
    g.scale.setScalar(END_SCALE)

    if (settleRef.current === 0) {
      doneFiredRef.current = true
      g.visible = false                // hand off to FishModel cleanly
      logEvent(TRANSITION_ID, EVENT_TYPE.STEP_TRANSITION_END, {
        from: 1, to: 2, durationMs: Math.round(elapsedRef.current * 1000),
      })
      onDone?.()
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={cloneRoot} />
    </group>
  )
}
