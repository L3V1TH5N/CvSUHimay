// src/simulation/components/steps/Step04DorsalCut/useDorsalCutStep.jsx
// Phase A: usePositionFish (drag/scroll to roll fish dorsal-up).
// Phase B: DorsalCutSensor + DorsalIncision + useDorsalCut (scoring/progress).
// Exports only: useDorsalCutStep — consumed by StepManager.

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useFrame, useThree }                                 from '@react-three/fiber'
import * as THREE                                             from 'three'
import { useWrongToolGate }            from '../../../fsm/useWrongToolGate'
import { useStepToolVisible }          from '../../../fsm/useStepToolVisible'
import { usePositionFish }             from './Step04Positioning'
import { buildDorsalSpline }           from './dorsalSpline'
import { DorsalCutGuide }              from '../../fish/DorsalCutGuide'
import { useGLTF }                     from '../../../utils/useGLTFLocal'
import { logEvent }                    from '../../../fsm/eventStream'
import { ERROR_CLASS, EVENT_TYPE }     from '../../../fsm/errors'
import { useFSMActions }               from '../../../fsm/FSMProvider'

const STEP_ID = 4
const FONT    = "'Rajdhani', sans-serif"

// ── Cutting tuning (matches Step04Preview.jsx exactly) ────────────────────────
const WARN_PATH_RATIO  = 0.35   // amber warning band starts here
const WRONG_PATH_RATIO = 0.65   // cut stalls + error logged past here
const START_PATH_RATIO = 1.20   // click-to-start rejection threshold
const JUMP_TOL         = 0.50   // ignore pointer teleport jumps > this t-delta
const END_TOL          = 0.30   // how close to each end counts as complete

// ── Fish placement — must match FishModel / DorsalCutGuide cuttingBoard ───────
const FISH_WORLD_CUTTING = [1.03, 0.95, -2.27]

// ── Knife constants ───────────────────────────────────────────────────────────
const KNIFE_HAND_LOCAL = [0.28, -0.36, -1.0]   // camera-space hand anchor
const KNIFE_SCALE      = 1.6
const KNIFE_GRIP_Y     = 0.36                   // local Y the hand grips at
const KNIFE_PRESS_JAB  = 0.03                   // tiny forward jab on pointer down
const KNIFE_DEPTH      = 2.5                    // world-units depth for free-hover cursor aim
const BLADE_EXTRUDE    = { depth: 0.0022, bevelEnabled: false }
const POS_LERP         = 0.40
const ROT_SLERP        = 0.30

// ── Reused unit axes (never mutated) ─────────────────────────────────────────
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const UNIT_X   = new THREE.Vector3(1, 0, 0)

// ── Keyframe animation — module-level for referential stability ───────────────
const S3_PULSE = `@keyframes s3Pulse{from{opacity:1}to{opacity:.4}}`

// ── Shared chip style ─────────────────────────────────────────────────────────
const CHIP = {
  display: 'flex', alignItems: 'center', gap: 5,
  background: 'rgba(4,20,8,0.92)',
  borderRadius: 10, padding: '4px 10px',
  fontFamily: FONT, fontSize: 13, backdropFilter: 'blur(6px)',
}

// ── CuttingHUD — live coverage + accuracy chips shown during Phase B ──────────
function CuttingHUD({ cutPct, accPct, offPath }) {
  const accColor = offPath ? '#ffce5c'
    : accPct >= 80 ? '#4ecd71'
    : accPct >= 50 ? '#f5c842'
    : '#ff7070'
  return (
    <div style={{
      position: 'absolute', bottom: 156, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, zIndex: 102, pointerEvents: 'none',
    }}>
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

// ── CutHintPanel — Phase B instruction / progress panel ──────────────────────
function CutHintPanel({ cutPct, isCutting, offPath, flash, startWarning }) {
  const accent =
    flash         ? 'rgba(78,205,113,0.95)'
    : startWarning ? 'rgba(245,108,66,0.9)'
    : offPath      ? 'rgba(245,200,66,0.9)'
    : isCutting    ? 'rgba(78,205,113,0.85)'
    :                'rgba(245,200,66,0.55)'

  const textColor =
    flash         ? '#4ecd71'
    : startWarning ? '#ff9b6b'
    : offPath      ? '#ffce5c'
    : isCutting    ? '#4ecd71'
    :                '#f5c842'

  const label =
    flash         ? '✅ Perfect dorsal cut'
    : startWarning ? '⚠️ Click on the glowing line to start'
    : offPath      ? '⚠️ Off the line — ease back on to keep cutting'
    : isCutting    ? `🔪 Cutting… ${cutPct}%`
    :                '🔪 Trace the glowing line from end to end'

  const barColor = offPath
    ? 'linear-gradient(90deg,#f5c842,#ffe9a8)'
    : 'linear-gradient(90deg,#4ecd71,#88ffaa)'
 
  return (
    <div style={{
      position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: flash ? 'rgba(10,60,20,0.97)' : 'rgba(4,20,8,0.92)',
      border: `2px solid ${accent}`, borderRadius: 20, padding: '12px 28px',
      transition: 'background 0.3s, border-color 0.3s',
      fontFamily: FONT, backdropFilter: 'blur(10px)',
      zIndex: 101, pointerEvents: 'none', minWidth: 290,
    }}>
      <span style={{ color: textColor, fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {!flash && (
        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${cutPct}%`, background: barColor,
            borderRadius: 3, transition: 'width 0.08s linear, background 0.3s',
          }} />
        </div>
      )}
    </div>
  )
}

// ── DorsalIncision — embedded "cut so far" slit on the dorsal ridge ───────────
// Thin dark slab that grows along [fromT..toT]; depth testing on so the fish
// body occludes the far side on roll — reads as a real incision, not a decal.
function DorsalIncision({ rotationOffsetRef, coverageRef }) {
  const { scene } = useGLTF('/models/BangusCUTTEDFIN.opt.glb')
  const groupRef  = useRef()
  const slitRef   = useRef()

  const { head, dir, len, dirN } = useMemo(() => {
    const { samples } = buildDorsalSpline(scene, { scale: 0.75, rotationY: Math.PI / 2 })
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

    const cov   = coverageRef?.current
    const fromT = cov ? Math.max(0, Math.min(1, cov.fromT)) : 0
    const toT   = cov ? Math.max(0, Math.min(1, cov.toT))   : 0
    const span  = toT - fromT
    if (span < 0.015) { s.visible = false; return }
    s.visible = true

    const mid = (fromT + toT) * 0.5
    tmp.copy(head).addScaledVector(dir, mid)
    s.position.set(tmp.x, tmp.y + 0.0025, tmp.z)  // a hair above the ridge
    s.quaternion.setFromUnitVectors(UNIT_X, dirN)  // box X-axis → line direction
    s.scale.set(len * span, 1, 1)
  })

  return (
    <group ref={groupRef} position={FISH_WORLD_CUTTING}>
      <mesh ref={slitRef} visible={false}>
        {/* unit length in X (scaled to the cut span); thin in Y/Z */}
        <boxGeometry args={[1, 0.008, 0.024]} />
        <meshStandardMaterial color="#360707" roughness={0.85} />
        {/* fresh-cut inner strip */}
        <mesh position={[0, 0.006, 0]}>
          <boxGeometry args={[1, 0.004, 0.009]} />
          <meshStandardMaterial color="#7d1414" roughness={0.65} emissive="#2a0606" emissiveIntensity={0.4} />
        </mesh>
      </mesh>
    </group>
  )
}

// ── DorsalCutSensor — 3D ray↔line sensor + first-person fillet knife ──────────
// computeCut finds the closest point between the camera ray and the head→tail
// segment (no horizontal-plane assumption), tracking the dorsal ridge at any
// roll angle. The knife is always visible during Phase B: it follows the cursor
// along the dorsal line, hovers above the ridge when the button is up, and jabs
// slightly into it when pressed.
function DorsalCutSensor({ active, handlers, rotationOffsetRef }) {
  const { scene }  = useGLTF('/models/BangusCUTTEDFIN.opt.glb')
  const { camera } = useThree()

  const toolVisible = useStepToolVisible()

  // groupRef mirrors DorsalCutGuide's group transform to get the same matrixWorld.
  const groupRef       = useRef()
  const knifeRef       = useRef()
  const pointerDownRef = useRef(false)
  // Default to screen centre so the knife appears over the fish on first render.
  const screenPosRef   = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth  * 0.5 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0,
  })
  // Updated every frame so event handlers always read the latest canvas size.
  const sizeRef = useRef({
    width:  typeof window !== 'undefined' ? window.innerWidth  : 1,
    height: typeof window !== 'undefined' ? window.innerHeight : 1,
  })
  // Snap knife into the held pose on the first frame, then lerp/slerp each frame.
  const firstFrameRef = useRef(true)

  // Pre-allocated THREE objects — zero heap allocation per frame.
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
  const tmpQuat     = useMemo(() => new THREE.Quaternion(), [])
  const cursorWorld = useMemo(() => new THREE.Vector3(), [])

  const { samples } = useMemo(
    () => buildDorsalSpline(scene, { scale: 0.75, rotationY: Math.PI / 2 }),
    [scene],
  )

  // Flat fillet-knife blade profile: X = blade axis (tip → heel), Y = blade height.
  const bladeShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)           // tip — fine point
    s.lineTo(0.045, -0.002)  // cutting edge sweeping back from the point…
    s.lineTo(0.14,  -0.005)
    s.lineTo(0.24,  -0.006)  // heel, edge side
    s.lineTo(0.24,   0.013)  // up the heel face into the handle
    s.lineTo(0.15,   0.011)  // back along the spine…
    s.lineTo(0.05,   0.006)
    s.closePath()
    return s
  }, [])

  // Closest point between the camera ray through (x, y) and the head→tail segment.
  // Writes the world cut point into `cutPoint`; returns { t, devRatio } or null.
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
    if (u < 0) u = 0; else if (u > 1) u = 1
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
    // Mirror DorsalCutGuide exactly: only rotation.x moves (the fish roll).
    g.rotation.x = rotationOffsetRef?.current ?? 0
    g.updateMatrixWorld(true)

    const knife = knifeRef.current
    if (!knife) return

    const res = computeCut(screenPosRef.current.x, screenPosRef.current.y)

    handAnchor.set(KNIFE_HAND_LOCAL[0], KNIFE_HAND_LOCAL[1], KNIFE_HAND_LOCAL[2])
    camera.localToWorld(handAnchor)

    // When cutting (pointer held): snap blade tip to the dorsal line — mirrors Step01 KnifeTool.
    // When hovering: aim at cursor's unprojected world position so the knife roams freely.
    let aimTarget
    if (pointerDownRef.current && res) {
      aimTarget = cutPoint
    } else {
      const { width, height } = sizeRef.current
      ndc.set((screenPosRef.current.x / width) * 2 - 1, -(screenPosRef.current.y / height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      cursorWorld.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, KNIFE_DEPTH)
      aimTarget = cursorWorld
    }

    aimDir.subVectors(aimTarget, handAnchor)
    const a2 = aimDir.lengthSq()
    if (a2 < 1e-6) return
    aimDir.multiplyScalar(1 / Math.sqrt(a2))
    negAim.copy(aimDir).negate()

    // Position grip at the hand anchor; tiny forward jab when the button is held.
    const jab = pointerDownRef.current ? KNIFE_PRESS_JAB : 0
    targetPos.copy(handAnchor).addScaledVector(aimDir, KNIFE_SCALE * KNIFE_GRIP_Y + jab)
    // Knife local +Y (handle/pommel) points back along -aimDir → blade faces cut.
    tmpQuat.setFromUnitVectors(WORLD_UP, negAim)

    if (firstFrameRef.current) {
      knife.position.copy(targetPos)
      knife.quaternion.copy(tmpQuat)
      firstFrameRef.current = false
    } else {
      knife.position.lerp(targetPos, POS_LERP)
      knife.quaternion.slerp(tmpQuat, ROT_SLERP)
    }
  })

  // Window-level pointer events give drag continuity even outside the canvas.
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
      {/* Invisible group that mirrors DorsalCutGuide's transform for matrixWorld. */}
      <group ref={groupRef} position={FISH_WORLD_CUTTING} />

      {/* Fillet knife — two meshes / two materials / ~45 triangles, no textures.
          Blade tip near local Y=0; handle at KNIFE_GRIP_Y. */}
      {toolVisible && (
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
      )}
    </>
  )
}

// ── useDorsalCut — Phase B scoring / progress / completion hook ───────────────
// Pointer events arrive from DorsalCutSensor via `handlers`. Drifting past
// WRONG_PATH_RATIO stalls the cut — coverage holds, tracing resumes when the
// cursor eases back inside the band. No restart. Errors logged per excursion.
function useDorsalCut(active, onComplete) {
  const checkTool         = useWrongToolGate()
  const { reportError }   = useFSMActions()
  const cuttingRef        = useRef(false)
  const doneRef           = useRef(false)
  const cutCoverageRef    = useRef({ fromT: 0, toT: 0 })
  const cutProgressRef    = useRef(0)
  const lastTRef          = useRef(0)
  const offPathRef        = useRef(false)
  const wrongPathRef      = useRef(false)   // re-armed on re-entry for per-excursion logging
  const maxDeviationRef   = useRef(0)
  const attemptsRef       = useRef(1)       // shape-kept from preview; stats go via logEvent, not onComplete
  const lastCursorRef     = useRef({ x: 0, y: 0 })
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
    wrongPathRef.current     = false
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

  useEffect(() => () => { document.body.style.cursor = '' }, [])

  // Stable handler object — DorsalCutSensor calls these from pointer events.
  const handlers = useMemo(() => ({
    onDown: (t, devRatio) => {
      if (!checkTool()) return   // wrong tool — error dispatched, bail
      if (doneRef.current || cuttingRef.current) return
      if (devRatio > START_PATH_RATIO) {
        setStartWarning(true)
        startWarnTimerRef.current = setTimeout(() => setStartWarning(false), 1000)
        logEvent(STEP_ID, EVENT_TYPE.ERROR, {
          class: ERROR_CLASS.WRONG_CUT_PATH, reason: 'start_off_line', t, deviation: devRatio,
        })
        reportError()
        return
      }
      cuttingRef.current       = true
      cutCoverageRef.current   = { fromT: t, toT: t }
      cutProgressRef.current   = 0
      lastTRef.current         = t
      offPathRef.current       = false
      wrongPathRef.current     = false
      maxDeviationRef.current  = devRatio
      lastCovBucketRef.current = 0
      lastAccBucketRef.current = 100
      setIsCutting(true); setCutPct(0); setAccPct(100); setOffPath(false); setStartWarning(false)
      logEvent(STEP_ID, EVENT_TYPE.GESTURE_START, { phase: 'cut', startT: t })
    },

    onMove: (t, devRatio, screenX, screenY) => {
      lastCursorRef.current = { x: screenX, y: screenY }
      if (!cuttingRef.current) return

      // Worst deviation so far drives accuracy score (100 = dead on the line).
      if (devRatio > maxDeviationRef.current) maxDeviationRef.current = devRatio
      const rawAcc    = Math.max(0, 1 - maxDeviationRef.current / WRONG_PATH_RATIO)
      const accBucket = Math.round(rawAcc * 20) * 5
      if (accBucket !== lastAccBucketRef.current) {
        lastAccBucketRef.current = accBucket
        setAccPct(accBucket)
      }

      // Warning band — amber heads-up before the cut stalls.
      const warn = devRatio > WARN_PATH_RATIO
      if (warn !== offPathRef.current) { offPathRef.current = warn; setOffPath(warn) }

      // Wrong band — log one error per excursion, re-arm on re-entry.
      const wrong = devRatio > WRONG_PATH_RATIO
      if (wrong && !wrongPathRef.current) {
        wrongPathRef.current = true
        logEvent(STEP_ID, EVENT_TYPE.ERROR, {
          class: ERROR_CLASS.WRONG_CUT_PATH, deviation: devRatio,
          geometricTrace: { cursor: [screenX, screenY], t },
        })
        reportError()
      } else if (!wrong && wrongPathRef.current) {
        wrongPathRef.current = false
      }

      // Stall: past the wrong band, coverage stops until cursor re-enters.
      if (devRatio > WRONG_PATH_RATIO) return

      // Skip teleport jumps (pointer re-entry, return from a stall).
      if (Math.abs(t - lastTRef.current) > JUMP_TOL) { lastTRef.current = t; return }
      lastTRef.current = t

      // Expand cumulative coverage — only grows, never shrinks.
      const cov = cutCoverageRef.current
      if (t > cov.toT)   cov.toT   = t
      if (t < cov.fromT) cov.fromT = t
      cutProgressRef.current = Math.max(0, Math.min(1, cov.toT - cov.fromT))

      const covBucket = Math.round(cutProgressRef.current * 20) * 5
      if (covBucket !== lastCovBucketRef.current) {
        lastCovBucketRef.current = covBucket
        setCutPct(covBucket)
      }

      // Completion: coverage spans both ends of the line.
      if (cov.fromT <= END_TOL && cov.toT >= 1 - END_TOL && !doneRef.current) {
        doneRef.current = true; cuttingRef.current = false
        cutProgressRef.current = 1  // drives FishModel closed→butterflied cross-fade
        cutCoverageRef.current = { fromT: 0, toT: 1 }  // snap incision to full dorsal length
        setIsCutting(false); setOffPath(false); setFlash(true)
        offPathRef.current = false; wrongPathRef.current = false

        const finalAcc = Math.round(rawAcc * 100)
        logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
          phase: 'cut', complete: true,
          maxDeviation: maxDeviationRef.current, accuracy: finalAcc,
        })
        // 450ms flash then advance FSM — matches Step04Preview.jsx timing exactly.
        flashTimerRef.current = setTimeout(() => { setFlash(false); onComplete() }, 450)
      }
    },

    onUp: () => {
      if (!cuttingRef.current) return
      cuttingRef.current = false
      offPathRef.current = false; wrongPathRef.current = false
      setIsCutting(false); setOffPath(false)
      logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
        phase: 'cut', complete: false,
        maxDeviation: maxDeviationRef.current, progress: cutProgressRef.current,
      })
    },
  }), [checkTool, onComplete, reportError])

  return {
    handlers, cutCoverageRef, cutProgressRef,
    cutPct, accPct, isCutting, offPath, flash, startWarning,
  }
}

// ── useDorsalCutStep — exported step orchestrator ─────────────────────────────
// Phase A 'position' → Phase B 'cutting' state machine.
// Returns the standard step shape consumed by StepManager / BangusDeboningSim.
export function useDorsalCutStep(active, onComplete) {
  const [phase, setPhase] = useState('position')

  const advanceToCut = useCallback(() => {
    setTimeout(() => setPhase('cutting'), 300)
  }, [])

  const position = usePositionFish(active && phase === 'position', advanceToCut)
  const cut      = useDorsalCut(active && phase === 'cutting', onComplete)

  // Reset to Phase A whenever the step is (de)activated.
  useEffect(() => { setPhase('position') }, [active])

  // Event-stream logging per phase enter/exit.
  useEffect(() => {
    if (!active) return
    logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER, { phase })
    return () => logEvent(STEP_ID, EVENT_TYPE.STATE_EXIT, { phase })
  }, [active, phase])


  if (!active) {
    return {
      fishHandlers: {}, waterActive: false, extra3D: null, domUI: null,
      rotationOffsetRef: null, cutProgressRef: null, cutComplete: false,
      cameraPreset: null,
    }
  }

  // Zoom to 'cuttingBoardZoom' during the 450ms completion flash so the
  // butterflied reveal feels cinematic before onComplete advances the FSM.
  const cameraPreset = (phase === 'cutting' && cut.flash)
    ? 'cuttingBoardZoom'
    : 'cuttingBoard'

  return {
    fishHandlers: {},
    waterActive:  false,
    rotationOffsetRef: position.rotationOffsetRef,
    cutProgressRef:    phase === 'cutting' ? cut.cutProgressRef : null,
    cutComplete:       phase === 'cutting' && cut.flash,
    cameraPreset,

    extra3D: phase === 'cutting' ? (
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
    ) : null,

    domUI: (
      <>
        {phase === 'position' && position.domUI}
        {phase === 'cutting' && (
          <>
            <style>{S3_PULSE}</style>
            <CutHintPanel
              cutPct={cut.cutPct}
              isCutting={cut.isCutting}
              offPath={cut.offPath}
              flash={cut.flash}
              startWarning={cut.startWarning}
            />
            <CuttingHUD
              cutPct={cut.cutPct}
              accPct={cut.accPct}
              offPath={cut.offPath}
            />
            {/* Fullscreen vignette — amber while drifting off the line */}
            <div aria-hidden="true" style={{
              position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90,
              background: 'radial-gradient(circle at center,rgba(255,200,40,0) 48%,rgba(255,200,40,0.28) 100%)',
              opacity: cut.offPath ? 1 : 0,
              transition: 'opacity 0.18s',
            }} />
          </>
        )}
      </>
    ),
  }
}
