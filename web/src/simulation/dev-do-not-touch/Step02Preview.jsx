// src/simulation/Step1Preview.jsx
// Standalone Step-1 (wash bangus) preview. Closed fish at sink.
// Hold cursor over fish to fill 3 s wash progress bar.

import { Suspense, useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { useGLTF } from '../utils/useGLTFLocal'
import * as THREE from 'three'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'
import { WaterSpray }         from '../components/tools/WaterSpray'

const FISH_POS_SINK   = [-0.25, 1.1, -2.22]
const FISH_ROTATION_Y = 1.6
const CLOSED_SCALE    = 0.6
const HOLD_DURATION   = 3.0

function ClosedFishAtSink({ groupRef }) {
  const { scene } = useGLTF('/models/bangus3.opt.glb')
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
    <group ref={groupRef} position={FISH_POS_SINK}>
      <primitive object={clone} scale={CLOSED_SCALE} rotation={[0, FISH_ROTATION_Y, 0]} />
    </group>
  )
}

// Per-frame raycaster with movement gate.
// onFishChange(bool) — cursor is on a valid fish mesh surface (drives spray).
// onWashChange(bool) — on fish AND cursor is moving (drives progress accumulation).
const MOVE_THRESHOLD_SQ = 1e-8 // ~0.0001 NDC/frame ≈ 6 px/s on 1080p

function FishRaycastWatcher({ groupRef, hitPointRef, onFishChange, onWashChange }) {
  const raycaster      = useMemo(() => new THREE.Raycaster(), [])
  const prevPointer    = useMemo(() => new THREE.Vector2(), [])
  const wasHittingRef  = useRef(false)
  const wasWashingRef  = useRef(false)

  useFrame(({ camera, pointer }) => {
    const group = groupRef.current
    if (!group) return

    const dx = pointer.x - prevPointer.x
    const dy = pointer.y - prevPointer.y
    const moving = (dx * dx + dy * dy) > MOVE_THRESHOLD_SQ
    prevPointer.set(pointer.x, pointer.y)

    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObject(group, true)

    let hit = null
    for (let i = 0; i < hits.length; i++) {
      const o = hits[i].object
      if (!o.isMesh) continue
      if (o.geometry?.type === 'BoxGeometry') continue
      let visible = true
      for (let p = o; p; p = p.parent) {
        if (p.visible === false) { visible = false; break }
      }
      if (!visible) continue
      hit = hits[i]
      break
    }

    const hitting = !!hit
    if (hit) hitPointRef.current.copy(hit.point)

    const washing = hitting && moving

    if (hitting !== wasHittingRef.current) {
      wasHittingRef.current = hitting
      onFishChange(hitting)
    }
    if (washing !== wasWashingRef.current) {
      wasWashingRef.current = washing
      onWashChange(washing)
    }
  })

  return null
}

useGLTF.preload('/models/bangus3.opt.glb')

// Pulses a warm red emissive tint on the fish meshes when the cursor is on the fish but idle.
// Driven entirely by refs + useFrame — no React state, no DOM involvement.
function FishMaterialEffect({ groupRef, holdingRef, washingRef }) {
  const meshesRef    = useRef(null)
  const intensityRef = useRef(0)
  const timeRef      = useRef(0)

  useFrame((_, dt) => {
    const group = groupRef.current
    if (!group) return

    // lazy-collect visible fish meshes and prime their emissive color once
    if (!meshesRef.current) {
      meshesRef.current = []
      group.traverse((o) => {
        if (!o.isMesh || o.geometry?.type === 'BoxGeometry') return
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => { if (m.emissive) m.emissive.setRGB(0.9, 0.06, 0.06) })
        meshesRef.current.push(o)
      })
    }

    timeRef.current += dt
    const idleOnFish = holdingRef.current && !washingRef.current
    // very slow breath: ~5 s period, intensity 0.12–0.22 — calm "inactive" state, not an alert
    const target = idleOnFish
      ? 0.12 + 0.10 * (0.5 + 0.5 * Math.sin(timeRef.current * Math.PI * 0.4))
      : 0
    // slow lerp (~1.5 s to 95%) for smooth, gradual fade-in and fade-out
    intensityRef.current += (target - intensityRef.current) * Math.min(1, dt * 2)

    const intensity = intensityRef.current
    if (intensity < 0.001 && !idleOnFish) return

    meshesRef.current.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = intensity })
    })
  })

  return null
}

// washingRef gates accumulation; holdingRef is unused for progress but kept for spray consistency
function FrameDriver({ washingRef, progressRef, lastPctRef, doneRef, onProgress, onComplete }) {
  useFrame((_, dt) => {
    if (doneRef.current) return
    const FILL  = 100 / HOLD_DURATION
    const DRAIN = FILL * 2
    progressRef.current = washingRef.current
      ? Math.min(100, progressRef.current + FILL * dt)
      : Math.max(0, progressRef.current - DRAIN * dt)
    const r = Math.round(progressRef.current)
    if (r !== lastPctRef.current) {
      lastPctRef.current = r
      onProgress(r)
      if (r >= 100) { doneRef.current = true; onComplete() }
    }
  })
  return null
}

const HINT_BASE = {
  position:'absolute', bottom:90, left:'50%', transform:'translateX(-50%)',
  borderRadius:16, padding:'12px 28px', minWidth:240,
  display:'flex', flexDirection:'column', alignItems:'center', gap:8,
  fontFamily:"'Rajdhani', sans-serif", backdropFilter:'blur(8px)',
  zIndex:101, pointerEvents:'none',
}

export default function Step1Preview() {
  const holdingRef   = useRef(false) // true when cursor is on fish (drives spray)
  const washingRef   = useRef(false) // true when on fish AND moving (drives progress)
  const progressRef  = useRef(0)
  const lastPctRef   = useRef(-1)
  const doneRef      = useRef(false)
  const fishGroupRef = useRef(null)
  const hitPointRef  = useRef(new THREE.Vector3(FISH_POS_SINK[0], FISH_POS_SINK[1] + 0.1, FISH_POS_SINK[2]))

  const [progress, setProgress] = useState(0)
  const [holding,  setHolding]  = useState(false)
  const [washing,  setWashing]  = useState(false)
  const [flash,    setFlash]    = useState(false)
  const [done,     setDone]     = useState(false)

  // idle state: cursor is on fish but not moving — washing paused
  const idleOnFish = holding && !washing && !done && !flash

  const onFishChange = useCallback((onFish) => {
    if (doneRef.current) return
    holdingRef.current = onFish
    setHolding(onFish)
    if (!onFish) { washingRef.current = false; setWashing(false) }
  }, [])

  const onWashChange = useCallback((isWashing) => {
    if (doneRef.current) return
    washingRef.current = isWashing
    setWashing(isWashing)
  }, [])

  const onComplete = useCallback(() => {
    holdingRef.current = false
    washingRef.current = false
    setHolding(false); setWashing(false); setFlash(true)
    setTimeout(() => { setFlash(false); setDone(true) }, 600)
  }, [])

  const message = flash || done ? '✅ Fish washed clean!'
    : holding ? `💧 Washing… ${progress}%`
              : '💧 Move cursor over the fish to wash'

  return (
    <div style={{ position:'fixed', inset:0, background:'#0c1014' }}>
      <Canvas gl={{ antialias:true, powerPreference:'high-performance', alpha:false, stencil:false }} dpr={[1,1]}>
        <AdaptiveDpr pixelated /><AdaptiveEvents /><PerformanceMonitor onDecline={() => {}} />
        <Suspense fallback={null}>
          <color attach="background" args={['#b8ccd8']} />
          <fog   attach="fog"        args={['#b8ccd8', 14, 28]} />
          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted={false} />
          <GameCamera cameraPreset="sink" lerpSpeed={1} orbitEnabled={false} instant />
          <ClosedFishAtSink groupRef={fishGroupRef} />
          <FishRaycastWatcher groupRef={fishGroupRef} hitPointRef={hitPointRef} onFishChange={onFishChange} onWashChange={onWashChange} />
          <FishMaterialEffect groupRef={fishGroupRef} holdingRef={holdingRef} washingRef={washingRef} />
          <WaterSpray active={holding} positionRef={hitPointRef} />
          <FrameDriver
            washingRef={washingRef} progressRef={progressRef}
            lastPctRef={lastPctRef} doneRef={doneRef}
            onProgress={setProgress} onComplete={onComplete}
          />
        </Suspense>
      </Canvas>
      <div style={{
        ...HINT_BASE,
        background: flash ? 'rgba(10,60,20,0.97)' : 'rgba(4,20,8,0.92)',
        border:`2px solid ${flash ? 'rgba(78,205,113,0.9)' : holding ? 'rgba(78,205,113,0.8)' : 'rgba(78,205,113,0.35)'}`,
        transition:'background 0.3s, border-color 0.3s',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
          <span style={{ color: flash||done ? '#4ecd71' : holding ? '#4ecd71' : '#8aab90', fontWeight:700, fontSize:14, letterSpacing:'0.05em' }}>
            {message}
          </span>
        </div>
        {!flash && !done && (
          <div style={{
            width:'100%', height:6, background:'rgba(255,255,255,0.08)', borderRadius:3, overflow:'hidden',
            boxShadow: idleOnFish
              ? '0 0 8px 3px rgba(220,50,50,0.55), 0 0 20px 6px rgba(200,20,20,0.22)'
              : '0 0 0px 0px rgba(220,50,50,0)',
            transition:'box-shadow 1.4s ease',
          }}>
            <div style={{ height:'100%', width:`${progress}%`, background: holding ? 'linear-gradient(90deg,#4ecd71,#88ffaa)' : '#2a8040', borderRadius:3, transition:'width 0.08s linear, background 0.3s' }} />
          </div>
        )}
      </div>
      <div style={{
        position:'absolute', top:12, right:12, padding:'6px 12px',
        background:'rgba(245,200,66,0.18)', border:'1px solid rgba(245,200,66,0.45)',
        borderRadius:8, color:'#f5c842', fontFamily:"'Rajdhani', sans-serif",
        fontWeight:700, fontSize:12, letterSpacing:'0.06em', textTransform:'uppercase',
        pointerEvents:'none', zIndex:200,
      }}>Step 1 Preview · Dev Only</div>
    </div>
  )
}
