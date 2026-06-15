// web/src/simulation/components/tools/KnifeTool.jsx
// Fillet-knife 3D cursor that follows the mouse — visual only, no cutting logic.
// Extracted from DorsalCutSensor (useDorsalCutStep.jsx).
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree }         from '@react-three/fiber'
import * as THREE                     from 'three'

const KNIFE_HAND_LOCAL = [0.28, -0.36, -1.0]  // camera-space hand anchor (matches DorsalCutSensor)
const KNIFE_SCALE      = 1.6
const KNIFE_GRIP_Y     = 0.36
const KNIFE_DEPTH      = 2.5   // world-units depth for free-hover cursor aim
const BLADE_EXTRUDE    = { depth: 0.0022, bevelEnabled: false }
const POS_LERP         = 0.40
const ROT_SLERP        = 0.30
const WORLD_UP         = new THREE.Vector3(0, 1, 0)

export function KnifeTool() {
  const { camera } = useThree()
  const knifeRef     = useRef()
  const firstFrame   = useRef(true)
  const screenPos    = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth  * 0.5 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0,
  })

  // Hide native cursor — the 3D knife replaces it.
  useEffect(() => {
    document.body.style.cursor = 'none'
    return () => { document.body.style.cursor = '' }
  }, [])

  // Track raw screen position without state (zero re-renders).
  useEffect(() => {
    const onMove = (e) => { screenPos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Pre-allocated scratch — zero GC per frame.
  const ndc        = useMemo(() => new THREE.Vector2(), [])
  const raycaster  = useMemo(() => new THREE.Raycaster(), [])
  const handAnchor = useMemo(() => new THREE.Vector3(), [])
  const aimDir     = useMemo(() => new THREE.Vector3(), [])
  const negAim     = useMemo(() => new THREE.Vector3(), [])
  const cursorWorld = useMemo(() => new THREE.Vector3(), [])
  const targetPos  = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat    = useMemo(() => new THREE.Quaternion(), [])

  // Blade shape — identical to DorsalCutSensor (useDorsalCutStep.jsx line 237).
  const bladeShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0,     0)
    s.lineTo(0.045, -0.002)
    s.lineTo(0.14,  -0.005)
    s.lineTo(0.24,  -0.006)
    s.lineTo(0.24,   0.013)
    s.lineTo(0.15,   0.011)
    s.lineTo(0.05,   0.006)
    s.closePath()
    return s
  }, [])

  useFrame(({ size }) => {
    const knife = knifeRef.current
    if (!knife) return

    // Camera-space hand anchor → world space.
    handAnchor.set(KNIFE_HAND_LOCAL[0], KNIFE_HAND_LOCAL[1], KNIFE_HAND_LOCAL[2])
    camera.localToWorld(handAnchor)

    // Unproject cursor to world at fixed depth — always hover mode.
    ndc.set(
      (screenPos.current.x / size.width)  *  2 - 1,
      (screenPos.current.y / size.height) * -2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    cursorWorld.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, KNIFE_DEPTH)

    aimDir.subVectors(cursorWorld, handAnchor)
    const len = aimDir.length()
    if (len < 1e-6) return
    aimDir.multiplyScalar(1 / len)
    negAim.copy(aimDir).negate()

    targetPos.copy(handAnchor).addScaledVector(aimDir, KNIFE_SCALE * KNIFE_GRIP_Y)
    tmpQuat.setFromUnitVectors(WORLD_UP, negAim)

    if (firstFrame.current) {
      knife.position.copy(targetPos)
      knife.quaternion.copy(tmpQuat)
      firstFrame.current = false
    } else {
      knife.position.lerp(targetPos, POS_LERP)
      knife.quaternion.slerp(tmpQuat, ROT_SLERP)
    }
  })

  return (
    <group ref={knifeRef} scale={KNIFE_SCALE}>
      {/* Blade — extruded profile, rotated so blade faces +Z */}
      <mesh rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
        <extrudeGeometry args={[bladeShape, BLADE_EXTRUDE]} />
        <meshStandardMaterial color="#b0b8c0" roughness={0.15} metalness={0.85} />
        {/* Blood-groove ridge */}
        <mesh position={[0.065, 0, 0.003]} raycast={() => null}>
          <boxGeometry args={[0.09, 0.001, 0.0025]} />
          <meshStandardMaterial color="#8090a0" roughness={0.2} metalness={0.9} />
        </mesh>
      </mesh>
      {/* Handle */}
      <mesh position={[0, KNIFE_GRIP_Y, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.0115, 0.013, 0.28, 6]} />
        <meshStandardMaterial color="#c8a06e" roughness={0.6} />
      </mesh>
    </group>
  )
}
