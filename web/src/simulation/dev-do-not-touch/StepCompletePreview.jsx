// src/simulation/Step10Preview.jsx
// Standalone Step-10 (deboning complete) preview. Static scene with a
// completion summary card. "Done ✓" resets the card for replay.

import { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { useGLTF } from '../utils/useGLTFLocal'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'

const FISH_POS_CB             = [0.93, 0.97, -2.19]
const FISH_ROTATION_Y         = Math.PI / 2
const BUTTERFLIED_FLAT_TILT_X = -0.05
const BUTTERFLIED_FLAT_TILT_Z = 0.0
const BUTTERFLIED_LIFT        = 0.02
const BUTTERFLIED_BACK_SHIFT  = 0.0

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
        object={clone} scale={1.0}
        position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
        rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
      />
    </group>
  )
}

useGLTF.preload('/models/DaingCuttedFins.glb')

function Stat({ label, value }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
      <span style={{ fontSize:11, color:'#8aab90', letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</span>
      <span style={{ fontSize:20, fontWeight:800, color:'#4ecd71' }}>{value}</span>
    </div>
  )
}

function SummaryCard({ onReset }) {
  return (
    <div style={{
      position:'absolute', bottom:70, left:'50%', transform:'translateX(-50%)',
      display:'flex', flexDirection:'column', alignItems:'center', gap:14,
      background:'rgba(4,20,8,0.95)', border:'2px solid rgba(78,205,113,0.6)',
      borderRadius:20, padding:'20px 32px',
      fontFamily:"'Rajdhani', sans-serif", backdropFilter:'blur(10px)',
      zIndex:110, pointerEvents:'auto', minWidth:340,
      boxShadow:'0 0 28px rgba(78,205,113,0.25)',
    }}>
      <div style={{ fontSize:20, fontWeight:800, color:'#4ecd71', letterSpacing:'0.06em', textTransform:'uppercase', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:24 }}>🎉</span>Deboning Complete
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, width:'100%', textAlign:'center' }}>
        <Stat label="Time"  value="—" />
        <Stat label="Steps" value="10/10" />
        <Stat label="Score" value="100%" />
      </div>
      <button onClick={onReset} style={{
        background:'linear-gradient(180deg,#04510e,#03350a)',
        border:'1px solid rgba(78,205,113,0.6)', borderRadius:10,
        color:'white', padding:'8px 24px', fontWeight:700, fontSize:14,
        letterSpacing:'0.05em', textTransform:'uppercase',
        cursor:'pointer', fontFamily:'inherit',
        boxShadow:'0 0 12px rgba(78,205,113,0.35)',
      }}>Done ✓</button>
    </div>
  )
}

export default function Step10Preview() {
  const [key, setKey] = useState(0)

  return (
    <div style={{ position:'fixed', inset:0, background:'#0c1014' }}>
      <Canvas gl={{ antialias:true, powerPreference:'high-performance', alpha:false, stencil:false }} dpr={[1,1]}>
        <AdaptiveDpr pixelated /><AdaptiveEvents /><PerformanceMonitor onDecline={() => {}} />
        <Suspense fallback={null}>
          <color attach="background" args={['#b8ccd8']} />
          <fog   attach="fog"        args={['#b8ccd8', 14, 28]} />
          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted={false} />
          <GameCamera cameraPreset="cuttingBoardTop" lerpSpeed={1} orbitEnabled={false} instant />
          <ButterfliedFishOnBoard />
        </Suspense>
      </Canvas>
      <SummaryCard key={key} onReset={() => setKey((k) => k + 1)} />
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
