// src/simulation/Step5Preview.jsx
// Standalone Step-5 (remove backbone) preview with full validation & backend scoring preparation.
// Phase 1: drag guts GLB to trash bin. Phase 2: drag gills GLB to trash bin. Phase 3: drag spine GLB to trash bin.
// Includes: glowing pieces, cursor feedback, validation (wrong drops, incomplete actions, sequence errors),
//           scoring metrics, and developer comments for position/glow/trash zone editing.

import {
  Suspense, useEffect, useRef, useState, useCallback, useMemo,
} from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { useGLTF } from '../utils/useGLTFLocal'
import * as THREE from 'three'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'
import { TrashPanel }         from '../components/steps/shared/TrashPanel'

// ------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------

const FISH_POS_CB = [0.93, 0.97, -2.19];
const FISH_ROTATION_Y = Math.PI / 2;
const BUTTERFLIED_FLAT_TILT_X = -0.05;
const BUTTERFLIED_FLAT_TILT_Z = 0.0;
const BUTTERFLIED_LIFT = 0.02;
const BUTTERFLIED_BACK_SHIFT = 0.0;

const DRAG_PLANE_Y = 1.05;
const DRAG_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y);
const PIECE_REST_Y = DRAG_PLANE_Y;

// ------------------------------------------------------------
// GUTS
// ------------------------------------------------------------
const GUTS_PATH = '/models/bones/guts.glb';
const GUTS_POS_X =  0.92;   // ← edit to move left/right
const GUTS_POS_Y =  1.0;   // ← edit to move up/down
const GUTS_POS_Z = -2.19;   // ← edit to move forward/back
const GUTS_REST_POS = new THREE.Vector3(GUTS_POS_X, GUTS_POS_Y, GUTS_POS_Z);
const GUTS_SCALE = 1.06;
const GUTS_ROTATION = [2, 1.60, -2];
const GUTS_TINT = '#fa6e6e';
const GUTS_GLOW = {
  enabled: true,
  color: '#ffaaaa',
  emissiveIntensity: 0.05,
  pulseSpeed: 3.9,
  pulseAmplitude: 0.1,
};

// ------------------------------------------------------------
// GILLS — adjust GILLS_REST_POS offsets to reposition on fish
// ------------------------------------------------------------
const GILLS_PATH = '/models/bones/Gills.glb';
const GILLS_POS_X =  0.94;   // ← edit to move left/right
const GILLS_POS_Y =  0.97;   // ← edit to move up/down
const GILLS_POS_Z = -2.191;   // ← edit to move forward/back
const GILLS_REST_POS = new THREE.Vector3(GILLS_POS_X, GILLS_POS_Y, GILLS_POS_Z);
const GILLS_SCALE = 0.93;
const GILLS_ROTATION = [1.92, 1.60, -2];
const GILLS_TINT = '#fa6e6e';
const GILLS_GLOW = {
  enabled: true,
  color: '#ffaaaa',
  emissiveIntensity: 0.05,
  pulseSpeed: 3.9,
  pulseAmplitude: 0.1,
};

// ------------------------------------------------------------
// SPINE
// ------------------------------------------------------------
const SPINE_PATH = '/models/bones/Spine/option2.glb';
const SPINE_POS_X =  0.73;   // ← edit to move left/right
const SPINE_POS_Y =  0.6835;   // ← edit to move up/down
const SPINE_POS_Z = -2.01;   // ← edit to move forward/back
const SPINE_REST_POS = new THREE.Vector3(SPINE_POS_X, SPINE_POS_Y, SPINE_POS_Z);
const SPINE_SCALE = 1;
const SPINE_ROTATION = [1.9, 1.61, -2];
const SPINE_TINT = '#fa6e6e';
const SPINE_GLOW = null;

const PIECES = {
  guts: {
    id: 'guts',
    modelPath: GUTS_PATH,
    restPos: GUTS_REST_POS,
    scale: GUTS_SCALE,
    rotation: GUTS_ROTATION,
    tintColor: GUTS_TINT,
    glow: GUTS_GLOW,
  },
  gills: {
    id: 'gills',
    modelPath: GILLS_PATH,
    restPos: GILLS_REST_POS,
    scale: GILLS_SCALE,
    rotation: GILLS_ROTATION,
    tintColor: GILLS_TINT,
    glow: GILLS_GLOW,
  },
  spine: {
    id: 'spine',
    modelPath: SPINE_PATH,
    restPos: SPINE_REST_POS,
    scale: SPINE_SCALE,
    rotation: SPINE_ROTATION,
    tintColor: SPINE_TINT,
    glow: SPINE_GLOW,
  },
};

useGLTF.preload('/models/DaingCuttedFins.glb');
useGLTF.preload(GUTS_PATH);
useGLTF.preload(GILLS_PATH);
useGLTF.preload(SPINE_PATH);

// ------------------------------------------------------------
//  VALIDATION LOGIC – Backend-ready scoring & error detection
// ------------------------------------------------------------

function useStep5Validation(onValidationChange) {
  const [phase, setPhase] = useState('guts')        // 'guts' | 'gills' | 'spine' | 'done'
  const [gutsDiscarded, setGutsDiscarded] = useState(false)
  const [gillsDiscarded, setGillsDiscarded] = useState(false)
  const [spineDiscarded, setSpineDiscarded] = useState(false)
  const [errors, setErrors] = useState([])
  const [wrongDropCount, setWrongDropCount] = useState(0)
  const startTimeRef  = useRef(Date.now())
  const phaseStartRef = useRef({ guts: Date.now(), gills: null, spine: null })

  const addError = useCallback((type, message) => {
    const newError = { type, message, timestamp: Date.now() }
    setErrors(prev => [...prev, newError])
    console.warn(`[Step5 Validation] ${type}: ${message}`)
  }, [])

  // Returns true if the discard was valid, false on sequence error.
  // Required order: guts → gills → spine
  const recordDiscard = useCallback((pieceId) => {
    if (pieceId === 'guts' && !gutsDiscarded) {
      setGutsDiscarded(true)
      phaseStartRef.current.gills = Date.now()
      setPhase('gills')
      return true
    }
    if (pieceId === 'gills' && !gillsDiscarded && gutsDiscarded) {
      setGillsDiscarded(true)
      phaseStartRef.current.spine = Date.now()
      setPhase('spine')
      return true
    }
    if (pieceId === 'spine' && !spineDiscarded && gutsDiscarded && gillsDiscarded) {
      setSpineDiscarded(true)
      setPhase('done')
      return true
    }
    // Sequence errors — piece snaps back; caller handles UI feedback
    if (pieceId === 'gills' && !gutsDiscarded) {
      addError('sequence_error', 'Cannot discard gills before removing guts')
      return false
    }
    if (pieceId === 'spine' && !gillsDiscarded) {
      addError('sequence_error', 'Cannot discard spine before removing gills')
      return false
    }
    return false
  }, [gutsDiscarded, gillsDiscarded, spineDiscarded, addError])

  const recordWrongDrop = useCallback((pieceId) => {
    setWrongDropCount(prev => prev + 1)
    addError('wrong_drop', `Dropped "${pieceId}" outside trash bin`)
  }, [addError])

  const completed = gutsDiscarded && gillsDiscarded && spineDiscarded
  const score = completed
    ? Math.max(0, 100 - (errors.length * 5) - (wrongDropCount * 2))
    : 0

  const errorsKey = errors.map(e => e.type).join(',')
  const validationResult = useMemo(() => ({
    stepId: 5,
    stepName: 'Remove Backbone',
    completed,
    score,
    phase,
    errors: errors.map(e => ({ code: e.type, message: e.message, timestamp: e.timestamp })),
    metrics: {
      totalWrongDrops: wrongDropCount,
      phaseDurations: {
        guts_ms: phaseStartRef.current.gills
          ? phaseStartRef.current.gills - phaseStartRef.current.guts
          : null,
        gills_ms: phaseStartRef.current.gills && phaseStartRef.current.spine
          ? phaseStartRef.current.spine - phaseStartRef.current.gills
          : null,
        spine_ms: phaseStartRef.current.spine && spineDiscarded
          ? Date.now() - phaseStartRef.current.spine
          : null,
      },
      totalTimeMs:     Date.now() - startTimeRef.current,
      piecesDiscarded: { guts: gutsDiscarded, gills: gillsDiscarded, spine: spineDiscarded },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [completed, score, phase, errorsKey, wrongDropCount, gutsDiscarded, gillsDiscarded, spineDiscarded])

  useEffect(() => {
    if (onValidationChange) onValidationChange(validationResult)
  }, [validationResult, onValidationChange])

  const latestError = errors.length > 0 ? errors[errors.length - 1] : null

  return {
    phase,
    gutsDiscarded,
    gillsDiscarded,
    spineDiscarded,
    completed,
    errors,
    latestError,
    wrongDropCount,
    score,
    validationResult,
    recordDiscard,
    recordWrongDrop,
  }
}

// ------------------------------------------------------------
//  BUTTERFLIED FISH MODEL (static)
// ------------------------------------------------------------

function ButterfliedFishOnBoard() {
  const { scene } = useGLTF('/models/DaingCuttedFins.glb')
  const clone = useMemo(() => {
    const c = scene.clone()
    c.traverse((obj) => {
      if (!obj.isMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      obj.material = src.length === 1
        ? (() => { const m=src[0].clone(); m.transparent=false; m.opacity=1; m.depthWrite=true; m.visible=true; m.needsUpdate=true; return m })()
        : src.map((m) => { const n=m.clone(); n.transparent=false; n.opacity=1; n.depthWrite=true; n.visible=true; n.needsUpdate=true; return n })
    })
    return c
  }, [scene])

  return (
    <group position={FISH_POS_CB}>
      <primitive
        object={clone}
        scale={1.0}
        position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
        rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
      />
    </group>
  )
}

// ------------------------------------------------------------
//  DRAGGABLE PIECE CONTROLLER (with glow & cursor styling)
// ------------------------------------------------------------

const HIT_MAT_INVISIBLE = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })

const DEFAULT_GLOW = {
  enabled: true,
  color: '#ffaaaa',
  emissiveIntensity: 0.05,
  pulseSpeed: 3.9,
  pulseAmplitude: 0.1,
}

function PieceDragController({ phaseDef, draggingRef, onDragStart, snapBack }) {
  const { scene } = useGLTF(phaseDef.modelPath)
  const groupRef = useRef()
  const cursorRef = useRef({ x: 0, y: 0 })
  const { camera, gl } = useThree()
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const isDraggingRef = useRef(false)
  const glowConfig = phaseDef.glow ?? DEFAULT_GLOW
  const materialRefs = useRef([])

  // Compute an axis-aligned hit box that exactly wraps the scaled+rotated model
  const hitData = useMemo(() => {
    const temp = new THREE.Object3D()
    temp.scale.setScalar(phaseDef.scale)
    temp.rotation.set(...phaseDef.rotation)
    const s = scene.clone()
    temp.add(s)
    temp.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(temp)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    return { geo: new THREE.BoxGeometry(size.x, size.y, size.z), center }
  }, [scene, phaseDef.scale, phaseDef.rotation])

  // Stores group-origin-to-grab-point offset so the model never jumps on pickup
  const dragOffset = useRef(null)

  const clone = useMemo(() => {
    materialRefs.current = []
    const c = scene.clone()
    c.traverse((obj) => {
      if (!obj.isMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      const newMaterials = src.map((m) => {
        const n = m.clone()
        n.color.set(phaseDef.tintColor)
        n.transparent = false
        n.opacity = 1
        n.emissive = new THREE.Color(glowConfig.color)
        n.emissiveIntensity = glowConfig.emissiveIntensity
        n.needsUpdate = true
        return n
      })
      obj.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials
      materialRefs.current.push(...newMaterials)
    })
    return c
  }, [scene, phaseDef.tintColor, glowConfig])

  useFrame(({ clock }) => {
    if (!materialRefs.current.length) return
    if (isDraggingRef.current) {
      materialRefs.current.forEach(mat => { if (mat) mat.emissiveIntensity = 0 })
      return
    }
    const t = clock.elapsedTime * glowConfig.pulseSpeed
    const intensity = glowConfig.emissiveIntensity + Math.sin(t) * glowConfig.pulseAmplitude
    const clamped = Math.max(0.1, Math.min(1.2, intensity))
    materialRefs.current.forEach(mat => { if (mat) mat.emissiveIntensity = clamped })
  })

  useEffect(() => {
    const onMove = (e) => { cursorRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(() => {
    if (!groupRef.current || !isDraggingRef.current) return
    const rect = gl.domElement.getBoundingClientRect()
    ndc.x = ((cursorRef.current.x - rect.left) / rect.width) * 2 - 1
    ndc.y = -((cursorRef.current.y - rect.top) / rect.height) * 2 + 1
    ray.setFromCamera(ndc, camera)
    if (ray.ray.intersectPlane(DRAG_PLANE, hit)) {
      hit.y = phaseDef.restPos.y
      // On the first drag frame record how far the group origin was from the grab point,
      // then keep that offset constant so the piece never jumps on pickup
      if (!dragOffset.current) {
        dragOffset.current = groupRef.current.position.clone().sub(hit)
      }
      groupRef.current.position.lerp(hit.clone().add(dragOffset.current), 0.55)
    }
  })

  useEffect(() => {
    if (snapBack && groupRef.current) {
      groupRef.current.position.copy(phaseDef.restPos)
    }
  }, [snapBack, phaseDef.restPos])

  const handleDragStart = (e) => {
    e.stopPropagation()
    if (draggingRef.current) return
    draggingRef.current = phaseDef.id
    isDraggingRef.current = true
    onDragStart()
    document.body.style.cursor = 'grabbing'
  }

  useEffect(() => {
    const onUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        dragOffset.current = null
        document.body.style.cursor = ''
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [])

  return (
    <group ref={groupRef} position={phaseDef.restPos.toArray()}>
      <primitive object={clone} scale={phaseDef.scale} rotation={phaseDef.rotation} />
      {/* Hit mesh placed and sized to exactly match the model's bounding box */}
      <mesh
        geometry={hitData.geo}
        material={HIT_MAT_INVISIBLE}
        position={hitData.center.toArray()}
        onPointerDown={handleDragStart}
        onPointerEnter={() => { if (!draggingRef.current) document.body.style.cursor = 'grab' }}
        onPointerLeave={() => { if (!draggingRef.current) document.body.style.cursor = '' }}
      />
    </group>
  )
}

// ------------------------------------------------------------
//  MAIN COMPONENT
// ------------------------------------------------------------

export default function Step5Preview({ onValidationChange }) {
  const validation = useStep5Validation(onValidationChange)
  const {
    phase,
    completed,
    gutsDiscarded,
    gillsDiscarded,
    spineDiscarded,
    latestError,
    recordDiscard,
    recordWrongDrop,
    wrongDropCount,
    errors,
  } = validation

  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [hoverPanel, setHoverPanel] = useState(false)

  const [gutsHidden,  setGutsHidden]  = useState(false)
  const [gillsHidden, setGillsHidden] = useState(false)
  const [spineHidden, setSpineHidden] = useState(false)

  const [sequenceError, setSequenceError] = useState(false)
  const [snapBackGills, setSnapBackGills] = useState(0)
  const [snapBackSpine, setSnapBackSpine] = useState(0)
  const seqTimerRef = useRef(null)

  // Accept the offending piece so the correct model snaps back
  const flashSequenceError = useCallback((piece) => {
    setSequenceError(true)
    if (piece === 'gills') setSnapBackGills(n => n + 1)
    else if (piece === 'spine') setSnapBackSpine(n => n + 1)
    clearTimeout(seqTimerRef.current)
    seqTimerRef.current = setTimeout(() => setSequenceError(false), 1500)
  }, [])
  useEffect(() => () => clearTimeout(seqTimerRef.current), [])

  useEffect(() => {
    const onUp = () => {
      if (!draggingRef.current) return
      const piece = draggingRef.current
      draggingRef.current = false
      setDragging(false)
      document.body.style.cursor = ''

      if (hoverPanel) {
        const ok = recordDiscard(piece)
        if (ok) {
          if (piece === 'guts')  setGutsHidden(true)
          if (piece === 'gills') setGillsHidden(true)
          if (piece === 'spine') setSpineHidden(true)
        } else {
          flashSequenceError(piece)
        }
      } else {
        recordWrongDrop(piece)
      }

      setHoverPanel(false)
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [hoverPanel, recordDiscard, recordWrongDrop, flashSequenceError])

  const makeDragStart = useCallback((pieceId) => () => {
    if (draggingRef.current) return
    draggingRef.current = pieceId
    setDragging(true)
  }, [])

  const onPanelEnter = useCallback(() => {
    if (draggingRef.current) setHoverPanel(true)
  }, [])

  const onPanelLeave = useCallback(() => {
    setHoverPanel(false)
  }, [])

  const trashZoneRef = useCallback((node) => {
    if (!node) return
    const onPointerUp = () => {
      if (hoverPanel && draggingRef.current) {
        const piece = draggingRef.current
        const ok = recordDiscard(piece)
        draggingRef.current = false
        setDragging(false)
        if (ok) {
          if (piece === 'guts')  setGutsHidden(true)
          if (piece === 'gills') setGillsHidden(true)
          if (piece === 'spine') setSpineHidden(true)
        } else {
          flashSequenceError(piece)
        }
        setHoverPanel(false)
        document.body.style.cursor = ''
      }
    }
    node.addEventListener('pointerup', onPointerUp)
    return () => node.removeEventListener('pointerup', onPointerUp)
  }, [hoverPanel, recordDiscard, flashSequenceError])

  const discardedCount = [gutsDiscarded, gillsDiscarded, spineDiscarded].filter(Boolean).length

  // Hint message & panel colour
  let message     = ''
  let borderColor = 'rgba(78,205,113,0.45)'
  let textColor   = '#4ecd71'
  let bgColor     = 'rgba(4,20,8,0.92)'

  if (completed) {
    message     = '✅ Backbone removed!'
    borderColor = '#4ecd71'
    textColor   = '#4ecd71'
  } else if (dragging) {
    const draggingPiece = draggingRef.current || phase
    message = `🦴 Drag the ${draggingPiece} to the trash bin…`
  } else if (sequenceError) {
    message = phase === 'guts'
      ? '⚠️ Remove the guts first!'
      : phase === 'gills'
      ? '⚠️ Remove the gills first!'
      : '⚠️ Remove in order: guts → gills → spine'
    borderColor = '#ffaa33'
    textColor   = '#ffcc66'
    bgColor     = 'rgba(28,16,0,0.95)'
  } else if (latestError?.type === 'wrong_drop') {
    message     = '❌ Dropped outside trash! Click and drag again.'
    borderColor = '#ff5555'
    textColor   = '#ff8888'
    bgColor     = 'rgba(28,4,4,0.95)'
  } else {
    message = `🦴 Grab the glowing ${phase} and drag it to the trash bin`
  }

  const showGuts  = !gutsHidden
  const showGills = !gillsHidden && !completed
  const showSpine = !spineHidden && !completed

  return (
    <div style={{ position:'fixed', inset:0, background:'#0c1014' }}>
      <Canvas gl={{ antialias:true, powerPreference:'high-performance', alpha:false, stencil:false }} dpr={[1,1]}>
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <PerformanceMonitor onDecline={() => {}} />
        <Suspense fallback={null}>
          <color attach="background" args={['#b8ccd8']} />
          <fog   attach="fog"        args={['#b8ccd8', 14, 28]} />
          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted={false} />
          <GameCamera cameraPreset="cuttingBoardZoom" lerpSpeed={1} orbitEnabled={false} instant />
          <ButterfliedFishOnBoard />

          {/* Guts — must be removed first */}
          {showGuts && (
            <PieceDragController
              key="guts"
              phaseDef={PIECES.guts}
              draggingRef={draggingRef}
              onDragStart={makeDragStart('guts')}
              snapBack={0}
            />
          )}

          {/* Gills — second; snaps back if dragged before guts */}
          {showGills && (
            <PieceDragController
              key="gills"
              phaseDef={PIECES.gills}
              draggingRef={draggingRef}
              onDragStart={makeDragStart('gills')}
              snapBack={snapBackGills}
            />
          )}

          {/* Spine — last; snaps back if dragged before gills */}
          {showSpine && (
            <PieceDragController
              key="spine"
              phaseDef={PIECES.spine}
              draggingRef={draggingRef}
              onDragStart={makeDragStart('spine')}
              snapBack={snapBackSpine}
            />
          )}
        </Suspense>
      </Canvas>

      {/* Hint panel */}
      <div style={{
        position:'absolute', bottom:90, left:'50%', transform:'translateX(-50%)',
        background: bgColor,
        border:`2px solid ${borderColor}`,
        borderRadius:40, padding:'10px 22px',
        color: textColor,
        fontSize:14, fontWeight:600, letterSpacing:'0.04em', display:'flex', alignItems:'center', gap:10,
        fontFamily:"'Rajdhani', sans-serif", backdropFilter:'blur(8px)',
        zIndex:101, pointerEvents:'none', whiteSpace:'nowrap',
        transition:'border-color 0.2s, color 0.2s, background 0.2s',
        animation: sequenceError ? 'step5shake 0.35s ease' : 'none',
      }}>
        <span>{message}</span>
        {wrongDropCount > 0 && !completed && (
          <span style={{ fontSize:12, background:'#ff555522', padding:'2px 8px', borderRadius:20 }}>
            Wrong drops: {wrongDropCount}
          </span>
        )}
      </div>

      <style>{`
        @keyframes step5shake {
          0%,100% { transform: translateX(-50%); }
          20%      { transform: translateX(calc(-50% - 7px)); }
          40%      { transform: translateX(calc(-50% + 7px)); }
          60%      { transform: translateX(calc(-50% - 4px)); }
          80%      { transform: translateX(calc(-50% + 4px)); }
        }
      `}</style>

      {/* TrashPanel with drop detection wrapper */}
      <TrashPanel
        dragging={dragging}
        hover={hoverPanel}
        count={discardedCount}
        total={3}
        hidden={completed}
        onPointerEnter={onPanelEnter}
        onPointerLeave={onPanelLeave}
      />
      <div
        ref={trashZoneRef}
        style={{
          position:'absolute', left:28, bottom:28, width:170, height:170,
          pointerEvents: dragging ? 'auto' : 'none',
          zIndex:111,
        }}
      />

      {/* Dev indicator */}
      <div style={{
        position:'absolute', top:12, right:12, padding:'6px 12px',
        background:'rgba(245,200,66,0.18)', border:'1px solid rgba(245,200,66,0.45)',
        borderRadius:8, color:'#f5c842', fontFamily:"'Rajdhani', sans-serif",
        fontWeight:700, fontSize:12, letterSpacing:'0.06em', textTransform:'uppercase',
        pointerEvents:'none', zIndex:200,
      }}>
        Step 5 Preview · Guts → Gills → Spine
      </div>
    </div>
  )
}
