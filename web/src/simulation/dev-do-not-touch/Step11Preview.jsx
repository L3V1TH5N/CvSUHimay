// src/simulation/Step11Preview.jsx
// Quality inspection: click the fish to zoom in; click again to zoom out.
// No scoring, points, or error mechanics.

import { Suspense, useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { useGLTF } from '../utils/useGLTFLocal'
import * as THREE from 'three'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'

// ── Fish placement ────────────────────────────────────────────────────────────
const FISH_POS_CB             = [0.93, 0.97, -2.19]
const FISH_ROTATION_Y         = Math.PI / 2
const BUTTERFLIED_SCALE       = 1.0    // must match FishModel.jsx / all other previews
const BUTTERFLIED_FLAT_TILT_X = -0.05
const BUTTERFLIED_FLAT_TILT_Z = 0.0
const BUTTERFLIED_LIFT        = 0.02
const BUTTERFLIED_BACK_SHIFT  = 0.0

// ── Camera constants (home = cuttingBoardTop preset) ─────────────────────────
const OVERVIEW_POS = new THREE.Vector3(1.00, 2.55, -2.19)
const OVERVIEW_TGT = new THREE.Vector3(1.00, 0.97, -2.19)
const OVERVIEW_FOV = 28

const ZOOM_HEIGHT = 0.55  // camera height above clicked point at full zoom
const ZOOM_FOV    = 14    // FOV at full zoom
const TWEEN_DUR   = 0.55  // seconds per transition

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ── InspectCamera ─────────────────────────────────────────────────────────────
// Tweens between overview and a position directly above zoomedPoint.
// All state is refs — zero per-frame allocation when settled.
function InspectCamera({ zoomedPoint }) {
  const { camera } = useThree()

  const curTgt   = useRef(new THREE.Vector3().copy(OVERVIEW_TGT))
  const startPos = useRef(new THREE.Vector3().copy(OVERVIEW_POS))
  const startTgt = useRef(new THREE.Vector3().copy(OVERVIEW_TGT))
  const startFov = useRef(OVERVIEW_FOV)
  const destPos  = useRef(new THREE.Vector3().copy(OVERVIEW_POS))
  const destTgt  = useRef(new THREE.Vector3().copy(OVERVIEW_TGT))
  const destFov  = useRef(OVERVIEW_FOV)
  const elapsed  = useRef(TWEEN_DUR) // start settled — no tween on mount
  const settled  = useRef(true)
  const pending  = useRef(false)    // arm snapshot at next rAF boundary

  // Snap to overview on mount
  useEffect(() => {
    camera.position.copy(OVERVIEW_POS)
    camera.fov = OVERVIEW_FOV
    camera.updateProjectionMatrix()
    camera.lookAt(OVERVIEW_TGT)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Arm tween whenever zoomedPoint changes
  useEffect(() => {
    if (zoomedPoint) {
      destPos.current.set(zoomedPoint.x, zoomedPoint.y + ZOOM_HEIGHT, zoomedPoint.z)
      destTgt.current.copy(zoomedPoint)
      destFov.current = ZOOM_FOV
    } else {
      destPos.current.copy(OVERVIEW_POS)
      destTgt.current.copy(OVERVIEW_TGT)
      destFov.current = OVERVIEW_FOV
    }
    pending.current = true
    settled.current = false
  }, [zoomedPoint])

  useFrame((_, dt) => {
    if (settled.current) return

    // Snapshot at true rAF boundary to avoid useEffect timing gap
    if (pending.current) {
      startPos.current.copy(camera.position)
      startTgt.current.copy(curTgt.current)
      startFov.current = camera.fov
      elapsed.current = 0
      pending.current = false
    }

    elapsed.current = Math.min(elapsed.current + dt, TWEEN_DUR)
    const t = easeInOutCubic(elapsed.current / TWEEN_DUR)

    camera.position.lerpVectors(startPos.current, destPos.current, t)

    const newFov = startFov.current + (destFov.current - startFov.current) * t
    if (Math.abs(camera.fov - newFov) > 0.05) {
      camera.fov = newFov
      camera.updateProjectionMatrix()
    }

    curTgt.current.lerpVectors(startTgt.current, destTgt.current, t)
    camera.lookAt(curTgt.current)

    if (t >= 1) {
      camera.position.copy(destPos.current)
      camera.fov = destFov.current
      camera.updateProjectionMatrix()
      curTgt.current.copy(destTgt.current)
      camera.lookAt(destTgt.current)
      settled.current = true
    }
  }, -2)

  return null
}

// ── Fish mesh ─────────────────────────────────────────────────────────────────
function ButterfliedFish({ onClick }) {
  const { scene } = useGLTF('/models/DaingCuttedFins.glb')
  const clone = useMemo(() => {
    const c = scene.clone()
    c.traverse((obj) => {
      if (!obj.isMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      obj.material = src.length === 1
        ? (() => { const m = src[0].clone(); m.transparent = false; m.opacity = 1; m.depthWrite = true; m.visible = true; m.needsUpdate = true; return m })()
        : src.map((m) => { const n = m.clone(); n.transparent = false; n.opacity = 1; n.depthWrite = true; n.visible = true; n.needsUpdate = true; return n })
    })
    return c
  }, [scene])

  return (
    <group position={FISH_POS_CB} onClick={onClick}>
      <primitive
        object={clone} scale={BUTTERFLIED_SCALE}
        position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
        rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
      />
    </group>
  )
}

useGLTF.preload('/models/DaingCuttedFins.glb')

// ── UI styles ─────────────────────────────────────────────────────────────────
const HINT_STYLE = {
  position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
  background: 'rgba(4,20,8,0.92)', border: '2px solid rgba(78,205,113,0.45)',
  borderRadius: 40, padding: '10px 22px', color: '#4ecd71', fontSize: 14,
  fontWeight: 600, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 10,
  fontFamily: "'Rajdhani', sans-serif", backdropFilter: 'blur(8px)',
  zIndex: 101, pointerEvents: 'none', whiteSpace: 'nowrap',
}

// ── Root component ────────────────────────────────────────────────────────────
export default function Step11Preview() {
  const [zoomedPoint, setZoomedPoint] = useState(null)

  const handleClick = (e) => {
    e.stopPropagation()
    // Zoom into clicked spot; second click zooms back out to GameCamera home
    setZoomedPoint((prev) => prev ? null : e.point.clone())
  }

  const hint = zoomedPoint
    ? '🔍 Click to zoom out'
    : '🔍 Click anywhere on the fish to inspect'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0c1014' }}>
      <Canvas
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
        dpr={[1, 1]}
      >
        <AdaptiveDpr pixelated /><AdaptiveEvents /><PerformanceMonitor onDecline={() => {}} />
        <Suspense fallback={null}>
          <color attach="background" args={['#b8ccd8']} />
          <fog   attach="fog"        args={['#b8ccd8', 14, 28]} />
          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted={false} />
          <InspectCamera zoomedPoint={zoomedPoint} />
          <ButterfliedFish onClick={handleClick} />
        </Suspense>
      </Canvas>
      <div style={HINT_STYLE}><span>{hint}</span></div>
      <div style={{
        position: 'absolute', top: 12, right: 12, padding: '6px 12px',
        background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.45)',
        borderRadius: 8, color: '#f5c842', fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
        pointerEvents: 'none', zIndex: 200,
      }}>Step 11 Preview · Dev Only</div>
    </div>
  )
}
