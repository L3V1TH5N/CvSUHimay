// src/simulation/components/tools/ForcepsTool.jsx
// 3D forceps model that follows the mouse cursor.
// The model's tip is positioned exactly at the cursor world-space location on
// the horizontal interaction plane (DRAG_PLANE_Y), which is the same plane
// used by all bone-drag steps (6-9). The group origin = tip = cursor.
//
// grabbing=true: slightly pinches scale.x to simulate arm closure.
//
// Optimization notes:
//   - GLTF scene is cloned once; mutations never touch the shared cache.
//   - All THREE scratch objects pre-allocated in useMemo (zero heap per frame).
//   - Mesh raycasting disabled so the forceps body never intercepts bone events.
//   - Module-level preload fires on first import — model is ready before step activates.

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree }        from '@react-three/fiber'
import * as THREE                    from 'three'
import { useGLTF }                   from '../../utils/useGLTFLocal'

const FORCEPS_PATH = '/equipments/forceps.glb'

// Horizontal plane the cursor ray intersects — identical to all bone-drag steps.
const DRAG_PLANE_Y = 1.05
const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)

// ── Tuning ────────────────────────────────────────────────────────────────────
const SCALE        = 0.2     // world-unit scale; increase if forceps look small
const GRAB_SCALE_X = 0.82    // arm-pinch fraction when grabbing
const TILT_X       = 0.40    // radians (~23°) — handle leans toward camera (+Z)
const LERP_POS     = 0.45    // cursor-tracking smoothness (0=no lerp, 1=instant)
const LERP_SCALE   = 0.22    // grab-pinch smoothness
// If the GLB has its tip at the TOP of the bounding box instead of the bottom,
// set this to true to auto-detect the correct tip direction.
const TIP_IS_MAX_Y = false
const Y_OFFSET     = 0.015   // positive = up, negative = down (world units)

// Module-level preload — fires once when any forceps step first imports this file.
useGLTF.preload(FORCEPS_PATH)

export function ForcepsTool({ grabbing = false }) {
  const { camera } = useThree()
  const { scene }  = useGLTF(FORCEPS_PATH)
  const groupRef   = useRef()
  const firstFrame = useRef(true)

  // Hide the native cursor — the 3D model replaces it entirely.
  useEffect(() => {
    document.body.style.cursor = 'none'
    return () => { document.body.style.cursor = '' }
  }, [])

  // Raw screen position — updated via window listener, zero re-renders.
  const screenPos = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth  / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  })
  useEffect(() => {
    const onMove = (e) => {
      screenPos.current.x = e.clientX
      screenPos.current.y = e.clientY
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Pre-allocated scratch — zero GC per frame.
  const ndc       = useMemo(() => new THREE.Vector2(), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const hitWorld  = useMemo(() => new THREE.Vector3(), [])

  // Clone once so we never mutate the cached GLTF scene.
  // Auto-shift the model so its tip (min or max Y of bounding box) sits at the
  // group origin. The group is then placed at the cursor world position, so
  // tip === cursor exactly.
  const { clonedScene, tipOffset } = useMemo(() => {
    const c = scene.clone(true)

    // Disable raycasting on every mesh — forceps must not intercept bone events.
    c.traverse((n) => {
      if (n.isMesh) n.raycast = () => null
    })

    // Bounding box in model local space (detached clone → world matrix = local matrix).
    const box = new THREE.Box3().setFromObject(c)
    const tipY = box.isEmpty() ? 0 : (TIP_IS_MAX_Y ? box.max.y : box.min.y)

    return { clonedScene: c, tipOffset: -tipY }
  }, [scene])

  useFrame(({ size }) => {
    const g = groupRef.current
    if (!g) return

    const { x, y }          = screenPos.current
    const { width, height } = size

    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    if (!raycaster.ray.intersectPlane(DRAG_PLANE, hitWorld)) return

    hitWorld.y += Y_OFFSET

    if (firstFrame.current) {
      g.position.copy(hitWorld)
      firstFrame.current = false
    } else {
      g.position.lerp(hitWorld, LERP_POS)
    }

    // Pinch scale.x when grabbing; Y/Z stay at SCALE (set by JSX scale prop once).
    const targetX = grabbing ? SCALE * GRAB_SCALE_X : SCALE
    g.scale.x += (targetX - g.scale.x) * LERP_SCALE
  })

  return (
    <group
      ref={groupRef}
      scale={SCALE}
      rotation={[TILT_X, -2.6, 0.1]}
    >
      <primitive
        object={clonedScene}
        position={[0, tipOffset, -0.5]}
      />
    </group>
  )
}
