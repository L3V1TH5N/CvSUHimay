// web/src/simulation/components/steps/shared/PieceDragController.jsx
// Shared draggable GLB piece — used by Step 5 (organs) and Step 6 (backbone).
// Handles: model clone + tint, glow pulse, drag-plane projection, snap-back.

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '../../../utils/useGLTFLocal'
import * as THREE from 'three'

export const DRAG_PLANE_Y = 1.05
export const PIECE_REST_Y = DRAG_PLANE_Y
export const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)

const HIT_MAT_INVISIBLE = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })

const DEFAULT_GLOW = {
  color:             '#ffaaaa',
  emissiveIntensity: 0.05,
  pulseSpeed:        3.9,
  pulseAmplitude:    0.1,
}

/**
 * Renders a single draggable GLB piece on the cutting-board drag plane.
 * phaseDef: { id, modelPath, restPos, scale, rotation, hitSize, tintColor, glow? }
 * draggingRef: shared ref that holds the active piece id (or false)
 * onDragStart: called when pointerdown begins a drag
 * snapBack: increment to trigger immediate snap back to restPos (sequence error)
 */
export function PieceDragController({ phaseDef, draggingRef, onDragStart, snapBack }) {
  const { scene }      = useGLTF(phaseDef.modelPath)
  const groupRef       = useRef()
  const cursorRef      = useRef({ x: 0, y: 0 })
  const { camera, gl } = useThree()
  const ndc            = useMemo(() => new THREE.Vector2(), [])
  const ray            = useMemo(() => new THREE.Raycaster(), [])
  const hit            = useMemo(() => new THREE.Vector3(), [])
  const isDraggingRef  = useRef(false)
  const glowConfig     = phaseDef.glow ?? DEFAULT_GLOW
  const materialRefs   = useRef([])

  // One BoxGeometry per instance — phaseDef is a stable module-level constant
  // so this runs exactly once per mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hitGeo = useMemo(() => new THREE.BoxGeometry(...phaseDef.hitSize), [])

  const clone = useMemo(() => {
    materialRefs.current = []
    const c = scene.clone()
    c.traverse((obj) => {
      if (!obj.isMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      const newMats = src.map((m) => {
        const n = m.clone()
        n.color.set(phaseDef.tintColor)
        n.transparent = false
        n.opacity     = 1
        n.emissive          = new THREE.Color(glowConfig.color)
        n.emissiveIntensity = glowConfig.emissiveIntensity
        n.needsUpdate = true
        return n
      })
      obj.material = newMats.length === 1 ? newMats[0] : newMats
      materialRefs.current.push(...newMats)
    })
    return c
  }, [scene, phaseDef.tintColor, glowConfig])

  // Glow pulse — drops to 0 while this piece is held
  useFrame(({ clock }) => {
    if (!materialRefs.current.length) return
    if (isDraggingRef.current) {
      materialRefs.current.forEach(m => { if (m) m.emissiveIntensity = 0 })
      return
    }
    const t = clock.elapsedTime * glowConfig.pulseSpeed
    const v = glowConfig.emissiveIntensity + Math.sin(t) * glowConfig.pulseAmplitude
    materialRefs.current.forEach(m => { if (m) m.emissiveIntensity = Math.max(0.1, Math.min(1.2, v)) })
  })

  useEffect(() => {
    const onMove = (e) => { cursorRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Drag lerp — only runs while isDraggingRef is true
  useFrame(() => {
    if (!groupRef.current || !isDraggingRef.current) return
    const rect = gl.domElement.getBoundingClientRect()
    ndc.x = ((cursorRef.current.x - rect.left) / rect.width)  *  2 - 1
    ndc.y = -((cursorRef.current.y - rect.top)  / rect.height) *  2 + 1
    ray.setFromCamera(ndc, camera)
    if (ray.ray.intersectPlane(DRAG_PLANE, hit)) {
      groupRef.current.position.lerp(hit, 0.55)
    }
  })

  // Snap back to rest on sequence error (snapBack counter increments)
  useEffect(() => {
    if (snapBack && groupRef.current) {
      groupRef.current.position.copy(phaseDef.restPos)
    }
  }, [snapBack, phaseDef.restPos])

  const handleDragStart = (e) => {
    e.stopPropagation()
    if (draggingRef.current) return
    draggingRef.current   = phaseDef.id
    isDraggingRef.current = true
    onDragStart()
    document.body.style.cursor = 'grabbing'
  }

  useEffect(() => {
    const onUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        document.body.style.cursor = ''
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [])

  return (
    <group ref={groupRef} position={phaseDef.restPos.toArray()}>
      <primitive object={clone} scale={phaseDef.scale} rotation={phaseDef.rotation} />
      <mesh
        geometry={hitGeo}
        material={HIT_MAT_INVISIBLE}
        onPointerDown={handleDragStart}
        onPointerEnter={() => { if (!draggingRef.current) document.body.style.cursor = 'grab' }}
        onPointerLeave={() => { if (!draggingRef.current) document.body.style.cursor = '' }}
      />
    </group>
  )
}
