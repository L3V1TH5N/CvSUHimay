// web/src/simulation/components/steps/Step05Organs/OrgansDragController.jsx
// Draggable GLB piece for Step 5 — mirrors Step05Preview.jsx PieceDragController exactly.
//
// Three behaviours that differ from the shared PieceDragController:
//   1. Hit box is auto-computed from the model's bounding box (no hitSize in phaseDef needed).
//   2. dragOffset records the group-origin → grab-point offset on the first drag frame so
//      the piece never jumps on pickup (critical for spine whose restPos.y is off the drag plane).
//   3. Y-axis is locked to phaseDef.restPos.y during the drag, not to DRAG_PLANE_Y.

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '../../../utils/useGLTFLocal'
import * as THREE from 'three'

import { DRAG_PLANE } from './organsConfig'

// Invisible hit mesh material — shared across all instances
const HIT_MAT_INVISIBLE = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })

const DEFAULT_GLOW = {
  color:             '#ffaaaa',
  emissiveIntensity: 0.05,
  pulseSpeed:        3.9,
  pulseAmplitude:    0.1,
}

/**
 * Renders a single draggable GLB organ piece.
 * phaseDef: { id, modelPath, restPos, scale, rotation, tintColor, glow? }
 * draggingRef: shared ref holding the active piece id (or false)
 * onDragStart: called when a drag begins
 * snapBack: increment to trigger an immediate snap back to restPos (sequence error)
 */
export function OrgansDragController({ phaseDef, draggingRef, onDragStart, snapBack }) {
  const { scene }      = useGLTF(phaseDef.modelPath)
  const groupRef       = useRef()
  const cursorRef      = useRef({ x: 0, y: 0 })
  const { camera, gl } = useThree()
  const ndc            = useMemo(() => new THREE.Vector2(), [])
  const ray            = useMemo(() => new THREE.Raycaster(), [])
  const hit            = useMemo(() => new THREE.Vector3(), [])
  const isDraggingRef  = useRef(false)
  const dragOffset     = useRef(null) // group-origin to grab-point offset; prevents jump on pickup
  const glowConfig     = phaseDef.glow ?? DEFAULT_GLOW
  const materialRefs   = useRef([])

  // Compute an axis-aligned hit box that exactly wraps the scaled + rotated model.
  // useMemo runs once on mount because phaseDef is a stable module-level constant.
  const hitData = useMemo(() => {
    const temp = new THREE.Object3D()
    temp.scale.setScalar(phaseDef.scale)
    temp.rotation.set(...phaseDef.rotation)
    const s = scene.clone()
    temp.add(s)
    temp.updateMatrixWorld(true)
    const box    = new THREE.Box3().setFromObject(temp)
    const size   = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    return { geo: new THREE.BoxGeometry(size.x, size.y, size.z), center }
  }, [scene, phaseDef.scale, phaseDef.rotation])

  // Clone model; apply tint colour and emissive glow to all materials
  const clone = useMemo(() => {
    materialRefs.current = []
    const c = scene.clone()
    c.traverse((obj) => {
      if (!obj.isMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      const newMaterials = src.map((m) => {
        const n = m.clone()
        n.color.set(phaseDef.tintColor)
        n.transparent       = false
        n.opacity           = 1
        n.emissive          = new THREE.Color(glowConfig.color)
        n.emissiveIntensity = glowConfig.emissiveIntensity
        n.needsUpdate       = true
        return n
      })
      obj.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials
      materialRefs.current.push(...newMaterials)
    })
    return c
  }, [scene, phaseDef.tintColor, glowConfig])

  // Glow pulse — emissive drops to 0 while the piece is held
  useFrame(({ clock }) => {
    if (!materialRefs.current.length) return
    if (isDraggingRef.current) {
      materialRefs.current.forEach(mat => { if (mat) mat.emissiveIntensity = 0 })
      return
    }
    const t         = clock.elapsedTime * glowConfig.pulseSpeed
    const intensity = glowConfig.emissiveIntensity + Math.sin(t) * glowConfig.pulseAmplitude
    const clamped   = Math.max(0.1, Math.min(1.2, intensity))
    materialRefs.current.forEach(mat => { if (mat) mat.emissiveIntensity = clamped })
  })

  // Track cursor position globally for use inside the drag useFrame
  useEffect(() => {
    const onMove = (e) => { cursorRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Drag movement: project cursor onto drag plane, lock Y to restPos.y, apply dragOffset
  useFrame(() => {
    if (!groupRef.current || !isDraggingRef.current) return
    const rect = gl.domElement.getBoundingClientRect()
    ndc.x =  ((cursorRef.current.x - rect.left) / rect.width)  * 2 - 1
    ndc.y = -((cursorRef.current.y - rect.top)  / rect.height) * 2 + 1
    ray.setFromCamera(ndc, camera)
    if (ray.ray.intersectPlane(DRAG_PLANE, hit)) {
      // Lock Y so pieces at varying rest heights don't fly to DRAG_PLANE_Y
      hit.y = phaseDef.restPos.y
      // On the first drag frame, record how far the group origin was from the grab point
      // so the piece never jumps on pickup
      if (!dragOffset.current) {
        dragOffset.current = groupRef.current.position.clone().sub(hit)
      }
      groupRef.current.position.lerp(hit.clone().add(dragOffset.current), 0.55)
    }
  })

  // Snap back to rest position when a sequence error occurs (snapBack counter increments)
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

  // Reset local drag state and dragOffset on pointer-up
  useEffect(() => {
    const onUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        dragOffset.current    = null
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
