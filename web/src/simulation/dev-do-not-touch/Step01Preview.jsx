// src/simulation/Step01Preview.jsx
// Step-01 (trim fins) preview. Drag-trace cut gesture per fin — mirrors the
// DorsalCutSensor mechanic in Step04Preview: click near a glowing line, drag
// from end to end. Uses camera-ray-to-segment math for precise tip alignment.
// Fin GLBs stay hidden during gameplay; on all-cuts-complete they pulse-reveal
// in sync with the fish cross-fade to BangusCUTTEDFIN (single-beat transition).
// Logs FSM-compatible events (STATE_ENTER, GESTURE_START, GESTURE_END, ERROR) via logEvent.

import { Suspense, useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor, Line } from '@react-three/drei'
import { useGLTF }   from '../utils/useGLTFLocal'
import * as THREE    from 'three'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'
import { logEvent }           from '../fsm/eventStream'
import { EVENT_TYPE, ERROR_CLASS } from '../fsm/errors'

// ── FISH PLACEMENT ───────────────────────────────────────────────────────────
// EDIT: Move the fish on the cutting board.
//   FISH_POS  [x, y, z]  x = left/right  y = up/down  z = forward/back
//   FISH_ROT_Y            rotation around Y axis in radians (1.6 ≈ 90°)
//   FISH_SCALE            uniform scale applied to the fish and all fins
const FISH_POS    = [1.0, 1.09, -2.1]
const FISH_ROT_Y  = 1.6
const FISH_SCALE  = 0.9

// ── CUTTING TUNING (mirrors Step04Preview's DorsalCutSensor feel) ────────────
// Drag-trace cutting: click near a fin's line, drag along it from end to end.
// Drift past WRONG_PATH_RATIO stalls the cut without resetting; drift past
// WARN_PATH_RATIO surfaces a pulsing amber warning. Cut completes when the
// dragged span covers both endpoints (fromT≤END_TOL && toT≥1−END_TOL).
const WARN_PATH_RATIO  = 0.35   // wider warning band before drift feels off
const WRONG_PATH_RATIO = 0.65   // generous drift before coverage stalls
const START_PATH_RATIO = 1.20   // click almost anywhere near the line to arm
const JUMP_TOL         = 0.50   // tolerate larger single-frame pointer jumps
const END_TOL          = 0.30   // only need to cover the middle 40% to complete

// ── FIN POSITIONS ─────────────────────────────────────────────────────────────
// Each entry defines one fin's cut-indicator position AND its individual length.
//
//   lineHalf: number  — half-length of THIS fin's indicator in world units.
//                       Full visible length = lineHalf × 2.
//                       Overrides the global LINE_HALF for this fin only.
//                       Also controls the collision segment in CuttingSensor —
//                       changing it here updates visual AND hit-detection together.
//
//   offset: [x, y, z]  — offset relative to FISH_POS (see top of file).
//     offset[0]  + = toward tail       - = toward head
//     offset[1]  + = higher / dorsal   - = lower / belly side
//     offset[2]  + = toward camera     - = away from camera
//
//   rotation: [rx, ry, rz]  — Euler angles (radians) for the indicator group.
//     Omit (or set [0,0,0]) for a line running left↔right along world X.
//     [0, 0, θ]  — tilts the line in the XY plane (use for angled fins).
//
// Tuning workflow: run `vite` → open /dev/step01 → edit a value → hot-reload
// shows the change instantly. No restart needed.
const FINS = [
  // ── Dorsal Fin (runs along the top ridge of the fish) ────────────────────
  // Long fin — spans most of the back ridge.
  { id: 0, label: 'Dorsal Fin',
    glb: '/models/fins/DorsalFin.glb',
    lineHalf: 0.05,                          // ← EDIT: half-length (full = 0.36 wu)
    offset:   [ 0.05,  0.09,  0.00],         // ← EDIT: [x tail+/head-, y up+/down-, z cam+/away-]
  },

  // ── Pectoral Fins (side fins near the head/gill area) ────────────────────
  { id: 1, label: 'Pectoral Fins',
    glb: '/models/fins/PectoralFins.glb',
    lineHalf: 0.05,                          // ← EDIT: half-length (full = 0.20 wu)
    offset:   [ 0.21,  -0.07,  0.06],        // ← EDIT
  },

  // ── Anal Fin (underside fin near the tail) ───────────────────────────────
  { id: 2, label: 'Anal Fin',
    glb: '/models/fins/AnalFins.glb',
    lineHalf: 0.04,                          // ← EDIT: half-length (full = 0.16 wu)
    offset:   [ -0.17,  -0.04, 0.06],        // ← EDIT
  },

  // ── Caudal Fin (tail fin) ─────────────────────────────────────────────────
  // Tilted ~77° to match the diagonal tail attachment angle.
  { id: 3, label: 'Caudal Fin',
    glb: '/models/fins/ClaudalFins.glb',
    lineHalf: 0.09,                          // ← EDIT: half-length (full = 0.24 wu)
    offset:   [ -0.32,  -0.0,  0.06],        // ← EDIT: position
    rotation: [  0,     0,     1.35 ],       // ← EDIT: [rx, ry, rz] — 1.35 rad ≈ 77° tilt
  },

  // ── Pelvic Fins (paired fins on the belly) ───────────────────────────────
  { id: 4, label: 'Pelvic Fins',
    glb: '/models/fins/PelvicFins.glb',
    lineHalf: 0.05,                          // ← EDIT: half-length (full = 0.18 wu)
    offset:   [ 0.01,  -0.08,  0.07],        // ← EDIT
  },
]

// ── Knife tool constants ──────────────────────────────────────────────────────
// Fillet knife held in the user's right hand — grip fixed in camera space,
// blade tip aims toward the cursor's world position each frame.
//
// Identical constants to DorsalCutSensor in Step04Preview — same knife feel.
// EDIT: KNIFE_HAND_LOCAL — grip anchor in camera space [x right, y down, z forward]
// EDIT: KNIFE_SCALE      — uniform scale
// EDIT: KNIFE_GRIP_Y     — local Y the hand holds at; controls tip reach from grip
// EDIT: KNIFE_PRESS_JAB  — extra forward nudge on pointerdown
// EDIT: KNIFE_DEPTH      — world-units depth for cursor ray unprojection
const KNIFE_HAND_LOCAL = [0.28, -0.36, -1.0] // EDIT
const KNIFE_SCALE      = 1.6                  // EDIT
const KNIFE_GRIP_Y     = 0.36                 // EDIT
const KNIFE_PRESS_JAB  = 0.03                 // EDIT
const KNIFE_DEPTH      = 2.5                  // EDIT
const BLADE_EXTRUDE    = { depth: 0.0022, bevelEnabled: false }

// Reused unit axis — never mutated.
const WORLD_UP = new THREE.Vector3(0, 1, 0)

// ── Preloads (fires before component mounts) ─────────────────────────────────
useGLTF.preload('/models/bangus3.opt.glb')
useGLTF.preload('/models/BangusCUTTEDFIN.opt.glb')

// ── Helper ────────────────────────────────────────────────────────────────────
// Clone a scene and configure every mesh material for opacity animation.
function cloneForFade(scene) {
  const c = scene.clone()
  c.traverse((obj) => {
    if (!obj.isMesh) return
    const src = Array.isArray(obj.material) ? obj.material : [obj.material]
    obj.material = src.length === 1
      ? (() => {
          const m = src[0].clone()
          m.transparent = true; m.opacity = 1; m.depthWrite = false
          m.visible = true; m.needsUpdate = true
          return m
        })()
      : src.map((m) => {
          const n = m.clone()
          n.transparent = true; n.opacity = 1; n.depthWrite = false
          n.visible = true; n.needsUpdate = true
          return n
        })
  })
  return c
}

// ── FrameLogger ───────────────────────────────────────────────────────────────
// Emits STATE_ENTER on mount and STATE_EXIT on unmount. No render output.
function FrameLogger({ trimmedCountRef }) {
  useEffect(() => {
    logEvent(1, EVENT_TYPE.STATE_ENTER, { phase: 'trim_fins' })
    // Snapshot the ref so the cleanup reads the value at unmount time, not stale closure.
    const countRef = trimmedCountRef
    return () => {
      logEvent(1, EVENT_TYPE.STATE_EXIT, { phase: 'trim_fins', totalCut: countRef.current })
    }
  }, [trimmedCountRef])
  return null
}

// ── FishTransition ────────────────────────────────────────────────────────────
// Renders both fish models. When transitionRef.current flips to true, useFrame
// cross-fades original → cut over TRANSITION_DURATION s. All material changes are ref-driven.
//
// EDIT: swap model paths below if you rename or replace either fish GLB.
function FishTransition({ transitionRef, transitionDoneRef }) {
  // EDIT: original (uncut) fish model
  const { scene: sceneOrig } = useGLTF('/models/bangus3.opt.glb')
  // EDIT: post-cut fish model (fins removed)
  const { scene: sceneCut  } = useGLTF('/models/BangusCUTTEDFIN.opt.glb')

  const origClone = useMemo(() => cloneForFade(sceneOrig), [sceneOrig])
  const cutClone  = useMemo(() => {
    const c = cloneForFade(sceneCut)
    // Start fully hidden (mesh-level) — shown when cross-fade begins.
    c.traverse((obj) => {
      if (!obj.isMesh) return
      obj.visible = false
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => { m.opacity = 0 })
    })
    return c
  }, [sceneCut])

  // ── MODEL ORIGIN AUTO-ALIGNMENT ───────────────────────────────────────────
  // bangus3 and BangusCUTTEDFIN may have been exported with different mesh
  // origins / scene anchors. Compute each model's bounding-box center in local
  // space and shift the cut fish so its center matches the original's center —
  // this guarantees the cross-fade lands the cut model exactly where the
  // original was, regardless of how each GLB was exported.
  const cutLocalOffset = useMemo(() => {
    const origBox = new THREE.Box3().setFromObject(origClone)
    const cutBox  = new THREE.Box3().setFromObject(cutClone)
    const oc = origBox.getCenter(new THREE.Vector3())
    const cc = cutBox.getCenter(new THREE.Vector3())
    return oc.sub(cc)
  }, [origClone, cutClone])

  const progressRef   = useRef(0)
  const origMeshesRef = useRef([])
  const cutMeshesRef  = useRef([])

  useEffect(() => {
    origMeshesRef.current = []
    origClone.traverse((obj) => { if (obj.isMesh) origMeshesRef.current.push(obj) })
    cutMeshesRef.current = []
    cutClone.traverse((obj)  => { if (obj.isMesh) cutMeshesRef.current.push(obj) })
  }, [origClone, cutClone])

  useFrame((_, dt) => {
    if (!transitionRef.current) return
    if (progressRef.current >= 1) return

    progressRef.current = Math.min(1, progressRef.current + dt / TRANSITION_DURATION)
    const p = progressRef.current

    // ── MODEL TRANSITION TO BangusCUTTEDFIN ──────────────────────────────────
    // Linear cross-fade: bangus3 (opacity 1-p) → BangusCUTTEDFIN (opacity p).
    // Runs simultaneously with FinReveal's bell-curve fin pulse — single beat.
    // Reveal cut meshes on the first frame of the fade.
    if (p > 0) {
      for (const m of cutMeshesRef.current) {
        if (!m.visible) m.visible = true
      }
    }

    for (const m of origMeshesRef.current) {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) mat.opacity = 1 - p
    }
    for (const m of cutMeshesRef.current) {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) mat.opacity = p
    }

    if (p >= 1) {
      for (const m of origMeshesRef.current) m.visible = false
      // BangusCUTTEDFIN is now fully shown — signal FinIncision to hide its slits.
      if (transitionDoneRef) transitionDoneRef.current = true
    }
  })

  // Outer group carries FISH_POS / FISH_SCALE / FISH_ROT_Y; inner group around
  // the cut fish applies the bbox-center offset BEFORE scale & rotation, so
  // both models render at the same final world center.
  return (
    <group position={FISH_POS} scale={FISH_SCALE} rotation={[0, FISH_ROT_Y, 0]}>
      <primitive object={origClone} />
      <group position={cutLocalOffset.toArray()}>
        <primitive object={cutClone} />
      </group>
    </group>
  )
}

// ── KnifeTool ─────────────────────────────────────────────────────────────────
// Fillet knife identical in behaviour to the dorsal-cut knife in Step04Preview.
// Grip stays fixed at KNIFE_HAND_LOCAL in camera space; the blade pivots from
// there so the tip aims toward the cursor's world position as the cursor moves.
// Identical to DorsalCutSensor's knife — hand-anchor + setFromUnitVectors pattern.
function KnifeTool({ activeFinIdRef, activeCutPointRef }) {
  const { camera } = useThree()
  const knifeRef      = useRef()
  const firstFrameRef = useRef(true)
  const screenPosRef  = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth  * 0.5 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0,
  })
  const pressRef = useRef(false)

  // Pre-allocated — zero heap per frame
  const raycaster  = useMemo(() => new THREE.Raycaster(), [])
  const ndc        = useMemo(() => new THREE.Vector2(), [])
  const cursorPos  = useMemo(() => new THREE.Vector3(), [])
  const handAnchor = useMemo(() => new THREE.Vector3(), [])
  const aimDir     = useMemo(() => new THREE.Vector3(), [])
  const negAim     = useMemo(() => new THREE.Vector3(), [])
  const targetPos  = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat    = useMemo(() => new THREE.Quaternion(), [])

  // Flat fillet-knife blade profile — tip at X=0, heel at X≈0.24.
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

  useEffect(() => {
    const onMove = (e) => { screenPosRef.current = { x: e.clientX, y: e.clientY } }
    const onDown = () => { pressRef.current = true  }
    const onUp   = () => { pressRef.current = false }
    window.addEventListener('pointermove',   onMove)
    window.addEventListener('pointerdown',   onDown)
    window.addEventListener('pointerup',     onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove',   onMove)
      window.removeEventListener('pointerdown',   onDown)
      window.removeEventListener('pointerup',     onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  useFrame(({ size }) => {
    const knife = knifeRef.current
    if (!knife) return

    const { x, y }          = screenPosRef.current
    const { width, height } = size

    // Cursor world position at KNIFE_DEPTH — the default aim target.
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    cursorPos.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, KNIFE_DEPTH)

    // ── KNIFE TIP DETECTION ──────────────────────────────────────────────────
    // When the CuttingSensor has locked onto a fin, aim the blade at the
    // ray↔line cut point so the tip visually rides the indicator line as the
    // user drags. Otherwise aim at the cursor's unprojected world position.
    const target = (activeFinIdRef?.current != null) ? activeCutPointRef.current : cursorPos

    // Grip fixed in camera space → world.
    handAnchor.set(KNIFE_HAND_LOCAL[0], KNIFE_HAND_LOCAL[1], KNIFE_HAND_LOCAL[2])
    camera.localToWorld(handAnchor)

    // Aim direction: hand → target.
    aimDir.subVectors(target, handAnchor)
    const a2 = aimDir.lengthSq()
    if (a2 < 1e-6) return
    aimDir.multiplyScalar(1 / Math.sqrt(a2))
    negAim.copy(aimDir).negate()

    // Grip at handAnchor; tip sweeps toward target — identical to DorsalCutSensor.
    const jab = pressRef.current ? KNIFE_PRESS_JAB : 0
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

  return (
    <group ref={knifeRef} scale={KNIFE_SCALE}>
      {/* Blade — flat extruded fillet-knife profile */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <extrudeGeometry args={[bladeShape, BLADE_EXTRUDE]} />
        <meshStandardMaterial color="#eef3f8" metalness={0.85} roughness={0.22} side={THREE.DoubleSide} />
      </mesh>
      {/* Handle — wooden cylinder */}
      <mesh position={[0, 0.345, 0]}>
        <cylinderGeometry args={[0.0115, 0.013, 0.28, 6]} />
        <meshStandardMaterial color="#c8a06e" roughness={0.6} />
      </mesh>
    </group>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// ── CUTTING INDICATOR POSITIONING SYSTEM ────────────────────────────────────
//
// This block is the single source of truth for every aspect of the cut-guide
// line that appears over each fin. Edit values here; all downstream components
// (FinGlow, FinIncision, CuttingSensor) read from these constants automatically.
//
// HOW THE INDICATOR IS BUILT
// ──────────────────────────
//  • The line runs along the LOCAL X axis:  A=(-LINE_HALF, 0, 0)  B=(+LINE_HALF, 0, 0)
//  • Its center is placed at the fin's WORLD position:
//        worldCenter = FISH_POS + fin.offset    (see FINS array further up)
//  • The group owning the line is then rotated by fin.rotation (default [0,0,0]).
//
//  Diagram (top-down, local space of the indicator group):
//
//        A ──────────── center ──────────── B
//   x = -LINE_HALF        (0,0,0)       x = +LINE_HALF
//
// ── LENGTH ───────────────────────────────────────────────────────────────────
// LINE_HALF  — half-length of the cut-guide line in world units.
//              Full visible length = LINE_HALF × 2.
//              Also drives the FinIncision slit geometry and the collision
//              segment in CuttingSensor (all three read this constant directly).
//
//   0.12  → full line = 0.24 wu  (current default, suits dorsal/pectoral fins)
//   0.18  → full line = 0.36 wu  (wider — suits caudal fin if needed)
//   0.08  → full line = 0.16 wu  (tighter — suits small anal / pelvic fins)
//
// IMPORTANT: changing LINE_HALF automatically rescales the FinIncision slit
// AND the CuttingSensor collision segment — no other values need updating.
// ─────────────────────────────────────────────────────────────────────────────
const LINE_HALF = 0.12   // ← EDIT: half-length in world units (full = LINE_HALF × 2)

// ── X / Y / Z POSITION (per fin) ─────────────────────────────────────────────
// The center of each indicator in WORLD space is:
//
//   worldX = FISH_POS[0] + fin.offset[0]   (left/right along board)
//   worldY = FISH_POS[1] + fin.offset[1]   (up/down from board surface)
//   worldZ = FISH_POS[2] + fin.offset[2]   (forward/back)
//
// To move a specific indicator, edit its `offset` in the FINS array above.
// To shift ALL indicators together (e.g. re-centering the fish), edit FISH_POS.
//
// Quick reference:
//   offset[0]  +value → toward tail      -value → toward head
//   offset[1]  +value → higher (dorsal)  -value → lower (belly side)
//   offset[2]  +value → toward camera    -value → away from camera

// ── ROTATION & ALIGNMENT ──────────────────────────────────────────────────────
// By default the line runs along local X (left↔right in the group's local frame).
// Adding a rotation on fin.rotation rotates the whole group (line + incision slit)
// so it aligns with the fin's actual cut angle.
//
//   fin.rotation = [rx, ry, rz]  — Euler angles in radians, applied to the group.
//   Default [0, 0, 0] → line runs along world X.
//   [0, 0, 1.35]      → line tilts ~77° (used for caudal fin — see FINS array).
//
// CuttingSensor reads the same fin.rotation and applies it to the collision
// segment endpoints so visual + collision stay in exact sync.

// ── SPACING & OFFSET FINE-TUNING ─────────────────────────────────────────────
// LINE_Y_LIFT  — additional upward nudge applied INSIDE FinIncision so the dark
//                slit hovers just above the fish surface (world units).
//                The FinGlow lines already use depthTest={false} so they always
//                draw on top; this nudge only matters for the 3-D slit mesh.
const LINE_Y_LIFT = 0.0025  // ← EDIT: raise (+) or lower (-) the incision slit

// ── SCALING BEHAVIOUR ─────────────────────────────────────────────────────────
// The indicator group (FinGlow + FinIncision) does NOT inherit FISH_SCALE.
// It is placed at an absolute world position, so LINE_HALF is already in final
// world units. If you resize the fish (FISH_SCALE), you must update fin.offset
// values and LINE_HALF manually to match the new visual footprint.
//
// The FinRevealItem GLB *does* apply FISH_SCALE (for the fin meshes shown after
// all cuts), but that is separate from the indicator geometry here.

// ── PULSE & ANIMATION ─────────────────────────────────────────────────────────
// PULSE_SPEED      — glow pulse rate in Hz (cycles per second).
//                    1.4 matches DorsalCutGuide in Step04Preview.
//                    Increase for a more urgent feel; decrease for calmer look.
// COLOR_LERP_SPEED — frames-independent lerp rate for the default→active color
//                    transition. Higher = snappier yellow flash on pointer-down.
const PULSE_SPEED      = 1.4  // ← EDIT: pulse frequency in Hz
const COLOR_LERP_SPEED = 8    // ← EDIT: color transition speed (higher = snappier)

// ── LINE COLORS ───────────────────────────────────────────────────────────────
// Three layered lines are stacked: OUTER (widest / darkest), MID, CORE (thinnest
// / brightest). The eye follows the CORE highlight.
//
//   DEFAULT  — resting state (red)   ACTIVE — pointerdown on this fin (yellow)
const LINE_COLOR_DEFAULT_OUTER = '#ff2222'  // ← EDIT: resting outer layer color
const LINE_COLOR_DEFAULT_MID   = '#ff4444'  // ← EDIT: resting mid layer color
const LINE_COLOR_DEFAULT_CORE  = '#ff9999'  // ← EDIT: resting core highlight color
const LINE_COLOR_ACTIVE_OUTER  = '#ffaa00'  // ← EDIT: active outer layer color
const LINE_COLOR_ACTIVE_MID    = '#ffdd00'  // ← EDIT: active mid layer color
const LINE_COLOR_ACTIVE_CORE   = '#ffff88'  // ← EDIT: active core highlight color

// ── TRANSITION DURATION ───────────────────────────────────────────────────────
// Seconds for the single-beat fin-reveal + model cross-fade after all cuts done.
// EDIT: TRANSITION_DURATION — seconds for the single-beat fin-reveal + model cross-fade
const TRANSITION_DURATION = 0.8  // ← EDIT: post-cut cross-fade duration in seconds
// ════════════════════════════════════════════════════════════════════════════════

// ── FinGlow ───────────────────────────────────────────────────────────────────
// Pulsing straight cut-guide line at each uncut fin — same layered style as
// DorsalCutGuide. Three stacked Line2s float above the fish via depthTest={false}.
// Driven entirely by refs + useFrame — zero React state, zero re-renders.
// Hides immediately when cutRef.current flips to true.
// All sizing/color/pulse constants live in the CUTTING INDICATOR POSITIONING
// SYSTEM block above — edit there, not here.

// Prevents decorative lines from intercepting cut gestures (same pattern as DorsalCutGuide).
const NO_RAYCAST = () => null

function FinGlow({ finId, lineHalf, cutRef, activeFinIdRef, transitionRef }) {
  const outerRef = useRef()
  const midRef   = useRef()
  const coreRef  = useRef()
  const groupRef = useRef()

  // Current per-layer colors — mutated by lerp each frame, never React state
  const colOuter = useRef(new THREE.Color(LINE_COLOR_DEFAULT_OUTER))
  const colMid   = useRef(new THREE.Color(LINE_COLOR_DEFAULT_MID))
  const colCore  = useRef(new THREE.Color(LINE_COLOR_DEFAULT_CORE))

  // Target color sets — allocated once, read-only
  const tgtDefault = useMemo(() => ({
    outer: new THREE.Color(LINE_COLOR_DEFAULT_OUTER),
    mid:   new THREE.Color(LINE_COLOR_DEFAULT_MID),
    core:  new THREE.Color(LINE_COLOR_DEFAULT_CORE),
  }), [])
  const tgtActive = useMemo(() => ({
    outer: new THREE.Color(LINE_COLOR_ACTIVE_OUTER),
    mid:   new THREE.Color(LINE_COLOR_ACTIVE_MID),
    core:  new THREE.Color(LINE_COLOR_ACTIVE_CORE),
  }), [])

  // ── VISUAL LINE ENDPOINTS ────────────────────────────────────────────────────
  // A = left tip  (-lineHalf, 0, 0)  →  B = right tip  (+lineHalf, 0, 0)
  // Local space of the FinIndicator group: already at FISH_POS + fin.offset,
  // rotated by fin.rotation.
  // ↳ LENGTH   → change fin.lineHalf in the FINS array
  // ↳ POSITION → change fin.offset  in the FINS array
  // ↳ ROTATION → change fin.rotation in the FINS array
  const linePts = useMemo(() => [[-lineHalf, 0, 0], [lineHalf, 0, 0]], [lineHalf])

  useFrame((_, dt) => {
    if (!groupRef.current) return
    // Hide when this fin is cut OR when the global transition has started
    if (cutRef.current || transitionRef?.current) {
      groupRef.current.visible = false
      return
    }

    // Yellow only when the CuttingSensor has locked onto THIS fin's line
    const isActive = activeFinIdRef?.current === finId
    const tgt    = isActive ? tgtActive : tgtDefault
    const factor = Math.min(1, COLOR_LERP_SPEED * dt)

    colOuter.current.lerp(tgt.outer, factor)
    colMid.current.lerp(tgt.mid,     factor)
    colCore.current.lerp(tgt.core,   factor)

    const t = performance.now() * 0.001 * Math.PI * 2 * PULSE_SPEED
    if (outerRef.current?.material) {
      outerRef.current.material.color.copy(colOuter.current)
      outerRef.current.material.opacity = 0.20 + Math.sin(t) * 0.20
    }
    if (midRef.current?.material) {
      midRef.current.material.color.copy(colMid.current)
      midRef.current.material.opacity = 0.55 + Math.sin(t) * 0.30
    }
    if (coreRef.current?.material) {
      coreRef.current.material.color.copy(colCore.current)
      coreRef.current.material.opacity = 0.55 + Math.sin(t) * 0.35
    }
  })

  return (
    <group ref={groupRef}>
      {/* Wide dark-red base — depth/shadow layer */}
      <Line ref={outerRef} points={linePts} color={LINE_COLOR_DEFAULT_OUTER} lineWidth={11} transparent opacity={0.25} depthTest={false} raycast={NO_RAYCAST} />
      {/* Medium red mid-band */}
      <Line ref={midRef}   points={linePts} color={LINE_COLOR_DEFAULT_MID}   lineWidth={9}  transparent opacity={0.55} depthTest={false} raycast={NO_RAYCAST} />
      {/* Bright pink-red core — the sharp highlight the eye follows */}
      <Line ref={coreRef}  points={linePts} color={LINE_COLOR_DEFAULT_CORE}  lineWidth={3}  transparent opacity={0.70} depthTest={false} raycast={NO_RAYCAST} />
    </group>
  )
}

// ── FinIncision ───────────────────────────────────────────────────────────────
// Growing dark cut-slit that rides this fin's indicator line over the covered
// [fromT..toT] span. Mirrors DorsalIncision from Step04Preview — a dark outer
// slab with a brighter emissive inner strip — so the cut visually grows along
// the line as the user drags. All-ref driven: zero React state, zero re-renders.
// Stays visible AFTER the fin is cut and THROUGH the cross-fade — it disappears
// only once BangusCUTTEDFIN.opt.glb is fully resolved (transitionDoneRef flips).
function FinIncision({ lineHalf, coverageRef, transitionDoneRef }) {
  const slitRef = useRef()

  useFrame(() => {
    const s = slitRef.current
    if (!s) return
    // Hide only after the cross-fade completes and the cut fish is fully shown.
    if (transitionDoneRef?.current) { s.visible = false; return }
    const cov   = coverageRef
    const fromT = Math.max(0, Math.min(1, cov.fromT))
    const toT   = Math.max(0, Math.min(1, cov.toT))
    const span  = toT - fromT
    if (span < 0.015) { s.visible = false; return }
    s.visible = true

    // ── INCISION SLIT POSITIONING ────────────────────────────────────────────
    // Maps the [fromT..toT] coverage (0..1 along the line) back into local X,
    // then scales the slit mesh to cover only the dragged span.
    //
    // LOCAL X MAPPING:  t=0 → x=-lineHalf (tip A)   t=1 → x=+lineHalf (tip B)
    //   midX = (mid - 0.5) × (lineHalf × 2)
    //
    // Y LIFT: LINE_Y_LIFT raises the slit just above the fish surface.
    //   ↳ Adjust LINE_Y_LIFT in the CUTTING INDICATOR POSITIONING SYSTEM block.
    //
    // SCALE: s.scale.set(span, 1, 1) stretches the unit-X slit to match the
    //   covered portion. The base width of the box is lineHalf × 2 (full length),
    //   so the scale factor `span` gives the correct partial coverage.
    const mid  = (fromT + toT) * 0.5
    const midX = (mid - 0.5) * (lineHalf * 2)
    s.position.set(midX, LINE_Y_LIFT, 0)   // ← Y offset from LINE_Y_LIFT constant
    s.scale.set(span, 0.60, 0.30)
  })

  return (
    <mesh ref={slitRef} visible={false}>
      {/* ── INCISION SLIT GEOMETRY ─────────────────────────────────────────────
          Width  (X) = lineHalf × 2  → full line length (scaled at runtime by `span`)
          Height (Y) = 0.008          → thin slab depth above surface  ← EDIT thickness
          Depth  (Z) = 0.024          → narrow slit cross-section      ← EDIT slit width
          To make the slit wider/narrower: edit the Z value.
          To make it thicker/thinner:      edit the Y value.
          X must stay lineHalf × 2 so the runtime scale maps correctly. */}
      <boxGeometry args={[lineHalf * 2, 0.008, 0.014]} />
      <meshStandardMaterial color="#360707" roughness={0.35} />
      {/* Fresh-cut inner strip — slightly raised, mild emissive.
          Position Y=0.006 keeps it just above the outer slab.   ← EDIT inner Y offset
          Box Z=0.009 is narrower than outer (0.024) for the layered look. */}
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[lineHalf * 2, 0.002, 0.009]} />
        <meshStandardMaterial color="#7d1414" roughness={0.65} emissive="#2a0606" emissiveIntensity={0.4} />
      </mesh>
    </mesh>
  )
}

// ── FinIndicator ─────────────────────────────────────────────────────────────
// Replaces FinMesh during gameplay. Renders only the pulsing FinGlow cut-guide
// line at each fin's world position — no GLB is loaded here. The fin geometry
// is intentionally hidden during the entire cutting phase; it only appears via
// FinReveal after all cuts are registered.
function FinIndicator({ fin, cutRef, activeFinIdRef, transitionRef, transitionDoneRef, coverageRef }) {
  // ── INDICATOR CENTER POSITION (world space) ─────────────────────────────────
  // worldPos is the center point of the cut-guide line in world space.
  // It is computed ONCE (useMemo) from two additive sources:
  //
  //   FISH_POS  — global fish placement on the cutting board (see top of file)
  //   fin.offset — per-fin offset relative to the fish center (see FINS array)
  //
  //   worldX = FISH_POS[0] + fin.offset[0]  ← left/right  (+tail / -head)
  //   worldY = FISH_POS[1] + fin.offset[1]  ← up/down     (+up   / -down)
  //   worldZ = FISH_POS[2] + fin.offset[2]  ← depth       (+cam  / -away)
  //
  // To move a single indicator:  edit fin.offset in the FINS array above.
  // To shift ALL indicators:     edit FISH_POS at the top of this file.
  // ─────────────────────────────────────────────────────────────────────────────
  const worldPos = useMemo(() => [
    FISH_POS[0] + fin.offset[0],   // ← X: controlled by FISH_POS[0] + fin.offset[0]
    FISH_POS[1] + fin.offset[1],   // ← Y: controlled by FISH_POS[1] + fin.offset[1]
    FISH_POS[2] + fin.offset[2],   // ← Z: controlled by FISH_POS[2] + fin.offset[2]
  ], [fin])

  // ── PER-FIN LINE HALF-LENGTH ──────────────────────────────────────────────────
  // fin.lineHalf overrides the global LINE_HALF for this specific fin.
  // Falls back to LINE_HALF if a fin entry has no lineHalf defined.
  // Edit fin.lineHalf in the FINS array to change the length of a single indicator.
  const lineHalf = fin.lineHalf ?? LINE_HALF   // ← sourced from FINS[i].lineHalf

  // ── INDICATOR ROTATION ───────────────────────────────────────────────────────
  // fin.rotation = [rx, ry, rz] Euler angles in radians.
  // Default [0,0,0] → line runs along world X axis.
  // Example: [0, 0, 1.35] tilts the line ~77° (caudal fin).
  // Rotation is applied to the group so both FinGlow AND FinIncision rotate together.
  // CuttingSensor reads the same fin.rotation for collision — they stay in sync.
  return (
    <group position={worldPos} rotation={fin.rotation ?? [0, 0, 0]}>
      <FinGlow     finId={fin.id} lineHalf={lineHalf} cutRef={cutRef} activeFinIdRef={activeFinIdRef} transitionRef={transitionRef} />
      <FinIncision lineHalf={lineHalf} coverageRef={coverageRef} transitionDoneRef={transitionDoneRef} />
    </group>
  )
}

// ── FinRevealItem ─────────────────────────────────────────────────────────────
// Loads one fin GLB and registers its meshes into the shared meshesRef owned by
// FinReveal. Only ever mounted inside FinReveal, which itself only mounts after
// all cuts are registered. Suspends via useGLTF until the asset resolves —
// the Suspense boundary in the root keeps the rest of the scene rendering
// normally during the brief load.
function FinRevealItem({ fin, meshesRef }) {
  const { scene } = useGLTF(fin.glb)
  const clone = useMemo(() => {
    const c = cloneForFade(scene)
    // Start invisible synchronously — prevents a one-frame flash of fully-opaque
    // fins before the useEffect below runs (cloneForFade defaults opacity to 1)
    c.traverse((obj) => {
      if (!obj.isMesh) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((mat) => { mat.opacity = 0 })
    })
    return c
  }, [scene])

  const worldPos = useMemo(() => [
    FISH_POS[0] + fin.offset[0],
    FISH_POS[1] + fin.offset[1],
    FISH_POS[2] + fin.offset[2],
  ], [fin])

  useEffect(() => {
    // Register meshes into the shared array so FinReveal's useFrame can drive opacity
    const registered = []
    clone.traverse((obj) => {
      if (!obj.isMesh) return
      // Redundant with useMemo init but kept for self-containment — always start at 0
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((mat) => { mat.opacity = 0 })
      meshesRef.current.push(obj)
      registered.push(obj)
    })
    // Cleanup: remove this item's meshes on unmount (prevents unbounded growth on
    // HMR remounts or React Strict Mode double-invoke in dev)
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

// ── FinReveal ─────────────────────────────────────────────────────────────────
// Lazy-mounted after all five cuts are registered. Orchestrates the single-beat
// cinematic transition: all five fin meshes follow a sin(p × π) bell-curve so
// they peak (fully opaque) exactly when bangus3 and BangusCUTTEDFIN are equally
// blended, then fade back to 0 as BangusCUTTEDFIN completes its reveal.
//
// Timing note: transitionRef flips to true before this component mounts (GLB
// loading may take 1–2 frames). FishTransition starts its cross-fade immediately
// on that flip. Any desync is sub-frame on a local dev server or campus LAN and
// is imperceptible in practice.
function FinReveal({ transitionRef }) {
  // meshesRef is populated by each FinRevealItem on mount
  const meshesRef   = useRef([])
  const progressRef = useRef(0)

  // ── FIN REVEAL ANIMATION ──────────────────────────────────────────────────
  // sin(p × π) produces a bell curve: 0 at start, peak 1 at midpoint (p=0.5),
  // back to 0 at end. This peaks exactly when bangus3 and BangusCUTTEDFIN are
  // equally blended, giving the most visually prominent reveal moment.
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

// ── CuttingSensor ─────────────────────────────────────────────────────────────
// Global pointer-event handler that mirrors DorsalCutSensor from Step04Preview.
// Uses camera-ray-to-segment math to find the closest world point between the
// cursor's ray and each uncut fin's indicator line. On pointerdown near a fin's
// line (devRatio ≤ START_PATH_RATIO), locks onto that fin; on pointermove,
// extends the [fromT..toT] coverage span. Completes the cut when the span
// reaches both endpoints (fromT ≤ END_TOL && toT ≥ 1 − END_TOL).
//
// Drift past WRONG_PATH_RATIO stalls the cut without resetting — coverage holds,
// and tracing resumes when the cursor returns within the band.
function CuttingSensor({ trimmed, coverages, activeFinIdRef, activeCutPointRef, onCut }) {
  const { camera } = useThree()

  // ── COLLISION SEGMENT ENDPOINTS (world space, fixed) ─────────────────────
  // For each fin, compute the world-space A and B endpoints of the invisible
  // collision segment. These MUST mirror the visual FinGlow linePts exactly —
  // they use the same fin.lineHalf, the same fin.offset→worldPos math, and the
  // same fin.rotation so visual and collision are always in sync.
  //
  // Endpoint construction:
  //   lh  = fin.lineHalf ?? LINE_HALF       (per-fin length, same as FinGlow)
  //   fp  = FISH_POS + fin.offset           (center of the indicator, world space)
  //   q   = Quaternion from fin.rotation    (same rotation as FinIndicator group)
  //   A   = rotate(-lh, 0, 0) by q, then add fp
  //   B   = rotate(+lh, 0, 0) by q, then add fp
  //
  // These are computed ONCE at mount (useMemo with empty deps) — no per-frame cost.
  //
  // To adjust collision segment length:   change fin.lineHalf in the FINS array
  // To adjust collision segment position: change fin.offset in the FINS array
  // To adjust collision segment angle:    change fin.rotation in the FINS array
  // ─────────────────────────────────────────────────────────────────────────────
  const finLines = useMemo(() => FINS.map((fin) => {
    const lh  = fin.lineHalf ?? LINE_HALF    // ← per-fin length (falls back to global)
    const rot = fin.rotation ?? [0, 0, 0]
    const q   = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]))
    // Center of indicator in world space (matches FinIndicator's worldPos)
    const fp  = new THREE.Vector3(
      FISH_POS[0] + fin.offset[0],   // ← X center: FISH_POS[0] + fin.offset[0]
      FISH_POS[1] + fin.offset[1],   // ← Y center: FISH_POS[1] + fin.offset[1]
      FISH_POS[2] + fin.offset[2],   // ← Z center: FISH_POS[2] + fin.offset[2]
    )
    return {
      id: fin.id,
      // A = left endpoint  (-lh along local X, rotated to world space)
      a:  new THREE.Vector3(-lh, 0, 0).applyQuaternion(q).add(fp),
      // B = right endpoint (+lh along local X, rotated to world space)
      b:  new THREE.Vector3( lh, 0, 0).applyQuaternion(q).add(fp),
    }
  }), [])

  // Pre-allocated work objects — zero heap per frame.
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndc       = useMemo(() => new THREE.Vector2(), [])
  const segDir    = useMemo(() => new THREE.Vector3(), [])
  const toA       = useMemo(() => new THREE.Vector3(), [])
  const cutPoint  = useMemo(() => new THREE.Vector3(), [])
  const onLine    = useMemo(() => new THREE.Vector3(), [])

  const sizeRef        = useRef({
    width:  typeof window !== 'undefined' ? window.innerWidth  : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  })
  const pointerDownRef = useRef(false)
  const lastTRef       = useRef(0)
  const doneFinsRef    = useRef(new Set())

  useFrame(({ size }) => { sizeRef.current = size })

  // ── CUTTING LINE COLLISION ────────────────────────────────────────────────
  // Closest point between camera ray through (x, y) and line A→B in world space.
  // Identical math to computeCut() in Step04Preview.jsx. Writes the world cut
  // point into `cutPoint`; returns { t, devRatio } or null on degenerate input.
  const computeRayVsLine = useCallback((x, y, lineA, lineB) => {
    const { width, height } = sizeRef.current
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const O = raycaster.ray.origin
    const D = raycaster.ray.direction

    segDir.subVectors(lineB, lineA)
    const e = segDir.dot(segDir)
    if (e < 1e-8) return null
    const segLen = Math.sqrt(e)

    toA.subVectors(O, lineA)
    const b     = D.dot(segDir)
    const c     = D.dot(toA)
    const fd    = segDir.dot(toA)
    const denom = e - b * b
    if (denom < 1e-8) return null

    let u = (fd - c * b) / denom
    if (u < 0) u = 0
    else if (u > 1) u = 1
    const s = u * b - c

    cutPoint.copy(O).addScaledVector(D, s)
    onLine.copy(lineA).addScaledVector(segDir, u)
    const devRatio = cutPoint.distanceTo(onLine) / segLen
    return { t: u, devRatio }
  }, [camera, raycaster, ndc, segDir, toA, cutPoint, onLine])

  useEffect(() => {
    // Pick the uncut fin whose line is closest to the camera ray at (x, y).
    const closestUncutFin = (x, y) => {
      let best = null
      for (const { id, a, b } of finLines) {
        if (trimmed.has(id) || doneFinsRef.current.has(id)) continue
        const res = computeRayVsLine(x, y, a, b)
        if (!res) continue
        if (!best || res.devRatio < best.devRatio) {
          best = { id, t: res.t, devRatio: res.devRatio }
        }
      }
      return best
    }

    const onDown = (e) => {
      if (pointerDownRef.current) return
      const best = closestUncutFin(e.clientX, e.clientY)
      if (!best || best.devRatio > START_PATH_RATIO) return

      pointerDownRef.current   = true
      activeFinIdRef.current   = best.id
      lastTRef.current         = best.t
      const cov = coverages[best.id]
      cov.fromT = best.t
      cov.toT   = best.t
      activeCutPointRef.current.copy(cutPoint)

      logEvent(1, EVENT_TYPE.GESTURE_START, {
        phase: 'trim_fins', finIndex: best.id,
        geometricTrace: { x: e.clientX, y: e.clientY, devRatio: best.devRatio },
      })
    }

    const onMove = (e) => {
      if (!pointerDownRef.current || activeFinIdRef.current == null) return
      const id   = activeFinIdRef.current
      const line = finLines[id]
      const res  = computeRayVsLine(e.clientX, e.clientY, line.a, line.b)
      if (!res) return

      // Knife visual snaps to the line during the cut.
      activeCutPointRef.current.copy(cutPoint)

      // Drift past WRONG_PATH_RATIO → stall (don't extend coverage).
      if (res.devRatio > WRONG_PATH_RATIO) return

      // Filter single-frame t jumps from pointer teleport / re-entry.
      if (Math.abs(res.t - lastTRef.current) > JUMP_TOL) {
        lastTRef.current = res.t
        return
      }
      lastTRef.current = res.t

      // Cumulative coverage grows monotonically.
      const cov = coverages[id]
      if (res.t > cov.toT)   cov.toT   = res.t
      if (res.t < cov.fromT) cov.fromT = res.t

      // ── CUT COMPLETION TRIGGER ────────────────────────────────────────────
      // Drag span touches both endpoints → cut completes for this fin.
      if (cov.fromT <= END_TOL && cov.toT >= 1 - END_TOL && !doneFinsRef.current.has(id)) {
        doneFinsRef.current.add(id)
        cov.fromT = 0
        cov.toT   = 1
        pointerDownRef.current = false
        activeFinIdRef.current = null
        logEvent(1, EVENT_TYPE.GESTURE_END, {
          phase: 'trim_fins', finIndex: id,
          geometricTrace: { x: e.clientX, y: e.clientY },
        })
        onCut(id)
      }
    }

    const onUp = () => {
      if (!pointerDownRef.current) return
      pointerDownRef.current = false
      activeFinIdRef.current = null
      // Coverage is preserved — onDown will re-initialize to {t,t} on next click.
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
  }, [trimmed, finLines, computeRayVsLine, activeFinIdRef, activeCutPointRef, coverages, onCut, cutPoint])

  return null
}

// ── ErrorToast ────────────────────────────────────────────────────────────────
// Brief banner shown at top-center when a cut gesture is too short or invalid.
// Auto-dismisses after 2 s. The `key` prop in the parent re-mounts this on each
// new error, which resets the setTimeout cleanly.
const TOAST_STYLE = {
  position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
  borderRadius: 10, padding: '10px 22px',
  background: 'rgba(60,4,4,0.92)', border: '2px solid rgba(255,60,60,0.8)',
  color: '#ff9090', fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700, fontSize: 13, letterSpacing: '0.05em',
  backdropFilter: 'blur(8px)', zIndex: 102, pointerEvents: 'none', whiteSpace: 'nowrap',
}

function ErrorToast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return <div style={TOAST_STYLE}>⚠️ {message}</div>
}

// ── Styles ────────────────────────────────────────────────────────────────────
const PANEL_BASE = {
  position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
  borderRadius: 16, padding: '12px 28px', minWidth: 240,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  transition: 'background 0.3s, border-color 0.3s',
  backdropFilter: 'blur(8px)', zIndex: 101, pointerEvents: 'none',
}

const DEV_BADGE = {
  position: 'absolute', top: 12, right: 12, padding: '6px 12px',
  background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.45)',
  borderRadius: 8, color: '#f5c842', fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
  pointerEvents: 'none', zIndex: 200,
}

// ── Step01Preview (root) ──────────────────────────────────────────────────────
export default function Step01Preview() {
  const [trimmed, setTrimmed] = useState(new Set())
  const [flash,   setFlash]   = useState(false)
  const [done,    setDone]    = useState(false)
  const [allCutsComplete, setAllCutsComplete] = useState(false)  // mounts <FinReveal> on completion

  const doneRef         = useRef(false)
  const trimmedCountRef = useRef(0)
  const transitionRef     = useRef(false)  // shared by FishTransition + FinReveal — flips on completion
  const transitionDoneRef = useRef(false)  // flips when FishTransition cross-fade finishes (p >= 1)
  // cutRefs: per-fin "is cut" — FinIndicator→FinGlow reads these to hide each indicator on cut.
  const cutRefs           = useRef(Object.fromEntries(FINS.map((f) => [f.id, { current: false }])))
  // coverages: per-fin [fromT..toT] dragged span — written by CuttingSensor, read by FinIncision.
  const coverages         = useRef(Object.fromEntries(FINS.map((f) => [f.id, { fromT: 0, toT: 0 }])))
  // activeFinIdRef: which fin's line is currently locked under the cursor's drag (or null).
  const activeFinIdRef    = useRef(null)
  // activeCutPointRef: world point the knife tip aims at while a cut is active.
  const activeCutPointRef = useRef(new THREE.Vector3())

  const [errorToast, setErrorToast] = useState(null)
  const dismissToast = useCallback(() => setErrorToast(null), [])
  const handleError  = useCallback((msg) => setErrorToast({ message: msg, key: Date.now() }), [])

  // Stable cut handler — called by CuttingSensor with finIndex on completion
  const handleCut = useCallback((id) => {
    if (doneRef.current) return
    setTrimmed((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Side effects that run after trimmed state updates
  useEffect(() => {
    // Flip per-fin cutRefs so FinGlow hides its indicator when that fin is cut
    for (const id of trimmed) cutRefs.current[id].current = true
    trimmedCountRef.current = trimmed.size

    let t1, t2
    if (trimmed.size >= FINS.length && !doneRef.current) {
      doneRef.current = true

      // ── CUT COMPLETION TRIGGER ──────────────────────────────────────────────
      // Set transitionRef synchronously so FishTransition and FinReveal both
      // start on the same frame. Then mount FinReveal via React state.
      transitionRef.current = true
      setAllCutsComplete(true)

      t1 = setTimeout(() => {
        setFlash(true)
        t2 = setTimeout(() => { setFlash(false); setDone(true) }, 600)
      }, 300)
    }
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [trimmed])

  const count   = trimmed.size
  const allDone = done || flash

  const borderColor = allDone   ? 'rgba(78,205,113,0.9)'
                    : count > 0 ? 'rgba(78,205,113,0.8)'
                    :             'rgba(78,205,113,0.35)'

  const message = allDone   ? '✅ All fins trimmed!'
                : count > 0 ? `🔪 Trimming… (${count}/${FINS.length})`
                :             '🔪 Click and drag along each glowing line from end to end'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0c1014', cursor: 'none' }}>
      <Canvas
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
        dpr={[1, 1]}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <PerformanceMonitor onDecline={() => {}} />
        <Suspense fallback={null}>
          <color attach="background" args={['#c8d8c0']} />
          <fog   attach="fog"        args={['#c8d8c0', 14, 28]} />
          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted />
          <GameCamera cameraPreset="cuttingBoard" lerpSpeed={1} orbitEnabled={false} instant />
          <FishTransition transitionRef={transitionRef} transitionDoneRef={transitionDoneRef} />
          {/* GAMEPLAY PHASE: fins hidden — only FinGlow indicators + growing FinIncision slits visible */}
          {FINS.map((f) => (
            <FinIndicator
              key={f.id}
              fin={f}
              cutRef={cutRefs.current[f.id]}
              activeFinIdRef={activeFinIdRef}
              transitionRef={transitionRef}
              transitionDoneRef={transitionDoneRef}
              coverageRef={coverages.current[f.id]}
            />
          ))}
          {/* CUT COMPLETION: lazy-mount fin GLBs inside their own Suspense so loading
              never suspends the rest of the scene */}
          {allCutsComplete && (
            <Suspense fallback={null}>
              <FinReveal transitionRef={transitionRef} />
            </Suspense>
          )}
          <CuttingSensor
            trimmed={trimmed}
            coverages={coverages.current}
            activeFinIdRef={activeFinIdRef}
            activeCutPointRef={activeCutPointRef}
            onCut={handleCut}
          />
          <KnifeTool activeFinIdRef={activeFinIdRef} activeCutPointRef={activeCutPointRef} />
          <FrameLogger trimmedCountRef={trimmedCountRef} />
        </Suspense>
      </Canvas>

      {/* Progress panel */}
      <div style={{
        ...PANEL_BASE,
        background:   flash ? 'rgba(10,60,20,0.97)' : 'rgba(4,20,8,0.92)',
        border:       `2px solid ${borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          <span style={{
            color: allDone ? '#4ecd71' : count > 0 ? '#4ecd71' : '#8aab90',
            fontWeight: 700, fontSize: 14,
            fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em',
          }}>
            {message}
          </span>
        </div>

        {/* Per-fin status pills */}
        {!allDone && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {FINS.map((f) => {
              const cut = trimmed.has(f.id)
              return (
                <div key={f.id} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11,
                  fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
                  background:  cut ? 'rgba(78,205,113,0.25)' : 'rgba(255,255,255,0.06)',
                  border:     `1px solid ${cut ? 'rgba(78,205,113,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  color:       cut ? '#4ecd71' : '#8aab90',
                  transition:  'all 0.25s',
                }}>
                  {cut ? '✅' : '🔪'} {f.label}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {errorToast && (
        <ErrorToast key={errorToast.key} message={errorToast.message} onDismiss={dismissToast} />
      )}
      <div style={DEV_BADGE}>Step 01 Preview · Dev Only</div>
    </div>
  )
}