// src/simulation/Step8Preview.jsx
// Standalone Step-8 (final rinse) preview. Butterflied fish at sink.
// Hold cursor over fish to fill 2 s rinse progress bar.

import { Suspense, useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { useGLTF } from '../utils/useGLTFLocal'
import * as THREE from 'three'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'
import { WaterSpray }         from '../components/tools/WaterSpray'

const FISH_POS_SINK           = [-0.32, 1.11, -2.22]
const FISH_ROTATION_Y         = 1.6
const BUTTERFLIED_FLAT_TILT_X = 0.11
const BUTTERFLIED_FLAT_TILT_Z = 0.1
const BUTTERFLIED_LIFT        = -0.05
const BUTTERFLIED_BACK_SHIFT  = 0.05

const HOLD_DURATION = 2.0

const HIT_GEO = new THREE.BoxGeometry(2.6, 0.3, 0.5)
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })

function ButterfliedFishAtSink({ onHoldStart, onHoldStop }) {
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
    <group position={FISH_POS_SINK}>
      <primitive
        object={clone} scale={0.85}
        position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
        rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
      />
      <mesh
        geometry={HIT_GEO} material={HIT_MAT}
        position={[0, BUTTERFLIED_LIFT + 0.05, 0]}
        rotation={[0, FISH_ROTATION_Y, 0]}
        onPointerEnter={onHoldStart}
        onPointerLeave={onHoldStop}
      />
    </group>
  )
}

useGLTF.preload('/models/DaingCuttedFins.glb')

function FrameDriver({ holdingRef, progressRef, lastPctRef, doneRef, onProgress, onComplete }) {
  useFrame((_, dt) => {
    if (doneRef.current) return
    const FILL  = 100 / HOLD_DURATION
    const DRAIN = FILL * 2
    progressRef.current = holdingRef.current
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

const HINT_STYLE = {
  position:'absolute', bottom:90, left:'50%', transform:'translateX(-50%)',
  background:'rgba(4,20,8,0.92)', border:'2px solid rgba(78,205,113,0.45)',
  borderRadius:40, padding:'10px 22px', color:'#4ecd71', fontSize:14,
  fontWeight:600, letterSpacing:'0.04em', display:'flex', alignItems:'center', gap:10,
  fontFamily:"'Rajdhani', sans-serif", backdropFilter:'blur(8px)',
  zIndex:101, pointerEvents:'none', whiteSpace:'nowrap',
}

export default function Step8Preview() {
  const holdingRef    = useRef(false)
  const progressRef   = useRef(0)
  const lastPctRef    = useRef(-1)
  const doneRef       = useRef(false)
  const fishCenterRef = useRef(new THREE.Vector3(FISH_POS_SINK[0], FISH_POS_SINK[1] + 0.05, FISH_POS_SINK[2]))

  const [progress, setProgress] = useState(0)
  const [holding,  setHolding]  = useState(false)
  const [flash,    setFlash]    = useState(false)
  const [done,     setDone]     = useState(false)

  const onHoldStart = useCallback(() => {
    if (doneRef.current) return
    holdingRef.current = true; setHolding(true)
  }, [])

  const onHoldStop = useCallback(() => {
    holdingRef.current = false; setHolding(false)
  }, [])

  const onComplete = useCallback(() => {
    setHolding(false); setFlash(true)
    setTimeout(() => { setFlash(false); setDone(true) }, 600)
  }, [])

  const message = flash || done
    ? '✅ Fish rinsed clean!'
    : holding ? `💧 Rinsing… ${progress}%`
              : '💧 Move cursor over the fish to rinse'

  return (
    <div style={{ position:'fixed', inset:0, background:'#0c1014' }}>
      <Canvas gl={{ antialias:true, powerPreference:'high-performance', alpha:false, stencil:false }} dpr={[1,1]}>
        <AdaptiveDpr pixelated /><AdaptiveEvents /><PerformanceMonitor onDecline={() => {}} />
        <Suspense fallback={null}>
          <color attach="background" args={['#b8ccd8']} />
          <fog   attach="fog"        args={['#b8ccd8', 14, 28]} />
          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted={false} />
          <GameCamera cameraPreset="sink" lerpSpeed={1} orbitEnabled={false} instant />
          <ButterfliedFishAtSink onHoldStart={onHoldStart} onHoldStop={onHoldStop} />
          <WaterSpray active={holding} positionRef={fishCenterRef} />
          <FrameDriver
            holdingRef={holdingRef} progressRef={progressRef}
            lastPctRef={lastPctRef} doneRef={doneRef}
            onProgress={setProgress} onComplete={onComplete}
          />
        </Suspense>
      </Canvas>
      <div style={{
        ...HINT_STYLE, flexDirection:'column', gap:8,
        borderRadius:16, padding:'12px 28px', minWidth:240,
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
          <div style={{ width:'100%', height:6, background:'rgba(255,255,255,0.08)', borderRadius:3, overflow:'hidden' }}>
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
      }}>Step 10 Preview · Dev Only</div>
    </div>
  )
}
