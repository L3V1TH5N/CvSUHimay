// src/simulation/Step2Preview.jsx
import { Suspense, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'
import { DraggableFish }      from '../components/steps/Step03Place/DraggableFish'

const SUCCESS_STYLE = {
  position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
  background: 'rgba(4,20,8,0.92)', border: '2px solid rgba(78,205,113,0.45)',
  borderRadius: 40, padding: '10px 22px', color: '#4ecd71', fontSize: 14,
  fontWeight: 600, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 10,
  fontFamily: "'Rajdhani', sans-serif", backdropFilter: 'blur(8px)',
  zIndex: 101, pointerEvents: 'none', whiteSpace: 'nowrap',
}

export default function Step2Preview() {
  const [placed,    setPlaced]    = useState(false)
  const [overBoard, setOverBoard] = useState(false)
  // resetKey forces DraggableFish to remount fresh on each reset
  const [resetKey,  setResetKey]  = useState(0)

  const onComplete  = useCallback(() => { setOverBoard(false); setPlaced(true) }, [])
  const handleReset = useCallback(() => {
    setPlaced(false)
    setOverBoard(false)
    setResetKey(k => k + 1)
  }, [])

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
          {/* cuttingBoardHighlighted driven by fish hover state — board is never scaled or moved */}
          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted={overBoard} />
          <GameCamera cameraPreset="transfer" lerpSpeed={1} orbitEnabled={false} instant />
          <DraggableFish
            key={resetKey}
            onPlaced={onComplete}
            onOverBoard={setOverBoard}
            boardPosition={[1.00, 1.05, -2.19]}
          />
        </Suspense>
      </Canvas>

      {placed && (
        <div style={SUCCESS_STYLE}>
          <span>✅ Fish placed on cutting board!</span>
        </div>
      )}

      {placed && (
        <button
          onClick={handleReset}
          style={{
            position: 'absolute', bottom: 150, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(4,20,8,0.9)', border: '1px solid rgba(78,205,113,0.5)',
            borderRadius: 8, color: '#4ecd71', padding: '6px 18px',
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 12,
            letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', zIndex: 120,
          }}
        >↺ Reset</button>
      )}

      <div style={{
        position: 'absolute', top: 12, right: 12, padding: '6px 12px',
        background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.45)',
        borderRadius: 8, color: '#f5c842', fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
        pointerEvents: 'none', zIndex: 200,
      }}>Step 2 Preview · Dev Only</div>
    </div>
  )
}
