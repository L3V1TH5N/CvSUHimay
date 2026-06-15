// src/simulation/components/steps/Step01TrimFins/KnifeTool.jsx
// ── COPIED KNIFE-TIP DETECTION (Step01Preview.jsx → KnifeTool) ───────────────
// Fillet knife held in the user's right hand. Grip anchored at KNIFE_HAND_LOCAL
// in camera space; tip aims at the cursor's world position each frame. When
// the CuttingSensor locks onto a fin, the tip snaps to the ray↔line cut point
// so the blade visually rides the indicator line as the user drags.

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  KNIFE_HAND_LOCAL, KNIFE_SCALE, KNIFE_GRIP_Y,
  KNIFE_PRESS_JAB, KNIFE_DEPTH, BLADE_EXTRUDE, WORLD_UP,
} from './step01Config'

export function KnifeTool({ activeFinIdRef, activeCutPointRef }) {
  const { camera } = useThree()
  const knifeRef      = useRef()
  const firstFrameRef = useRef(true)
  const screenPosRef  = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth  * 0.5 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0,
  })
  const pressRef = useRef(false)

  // Pre-allocated work objects — zero heap per frame.
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

    // Cursor world position at KNIFE_DEPTH — default aim target.
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    cursorPos.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, KNIFE_DEPTH)

    // ── KNIFE TIP DETECTION ──────────────────────────────────────────────
    // While locked on a fin's line, aim the blade at the live ray↔line cut
    // point so the tip rides the indicator. Otherwise track cursor.
    const target = (activeFinIdRef?.current != null) ? activeCutPointRef.current : cursorPos

    // Grip fixed in camera space → world.
    handAnchor.set(KNIFE_HAND_LOCAL[0], KNIFE_HAND_LOCAL[1], KNIFE_HAND_LOCAL[2])
    camera.localToWorld(handAnchor)

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
