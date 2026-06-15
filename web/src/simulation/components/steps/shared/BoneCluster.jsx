// Shared drag-and-discard bone interaction for Steps 7, 8, 9.
// Loading and position overrides are handled by the parent hook.
// Auto-discard (onBoneDiscarded) is optional — only Step 7 uses it;
// Steps 8 and 9 use the TrashPanel model handled in their parent hooks.

import { useRef, useEffect, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const DRAG_LERP            = 0.55
const SNAP_LERP            = 0.18
const SNAP_EPS_SQ          = 1e-4
const DRAG_PLANE_Y         = 1.05
const DRAG_PLANE           = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)
const DRAG_DISCARD_DIST_SQ = 4.0  // only used when onBoneDiscarded is set

const HIT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

export function BoneCluster({
  bones,            // Array<{geometry, position (THREE.Vector3), size (THREE.Vector3),
                    //        srcIndex, rotation?, scaleMultiplier?}>
  material,         // THREE.Material for visible bone meshes (step-specific)
  boneScale  = 0.28,
  hitPadding = 2.2,
  removedRef,
  currentDragSrcRef,
  snappingRef,
  removedVersion,
  onBoneGrab,
  onBoneDiscarded = null,
}) {
  const clusterGroupRef = useRef()
  const boneGroupRefs   = useRef([])
  const indexBySrcRef   = useRef(new Map())
  const { camera, gl }  = useThree()

  const onBoneDiscardedRef = useRef(onBoneDiscarded)
  useEffect(() => { onBoneDiscardedRef.current = onBoneDiscarded }, [onBoneDiscarded])

  useEffect(() => {
    if (!bones) return
    const map = new Map()
    bones.forEach((bone, i) => map.set(bone.srcIndex, i))
    indexBySrcRef.current = map
  }, [bones])

  const cursorRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e) => { cursorRef.current.x = e.clientX; cursorRef.current.y = e.clientY }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    if (!bones) return
    const removed = removedRef.current
    bones.forEach((bone, i) => {
      const g = boneGroupRefs.current[i]
      if (!g) return
      const shouldShow = !removed.has(bone.srcIndex)
      if (g.visible !== shouldShow) {
        g.visible = shouldShow
        if (shouldShow) g.scale.setScalar(1)
      }
    })
  }, [bones, removedVersion, removedRef])

  const ndc      = useMemo(() => new THREE.Vector2(), [])
  const ray      = useMemo(() => new THREE.Raycaster(), [])
  const hitWorld = useMemo(() => new THREE.Vector3(), [])
  const hitLocal = useMemo(() => new THREE.Vector3(), [])
  const restTmp  = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!bones || !clusterGroupRef.current) return

    const dragSrc = currentDragSrcRef.current
    if (dragSrc != null) {
      const arrIdx = indexBySrcRef.current.get(dragSrc)
      const g = arrIdx != null ? boneGroupRefs.current[arrIdx] : null
      if (g) {
        const rect = gl.domElement.getBoundingClientRect()
        ndc.x =  ((cursorRef.current.x - rect.left) / rect.width)  * 2 - 1
        ndc.y = -((cursorRef.current.y - rect.top)  / rect.height) * 2 + 1
        ray.setFromCamera(ndc, camera)
        if (ray.ray.intersectPlane(DRAG_PLANE, hitWorld)) {
          hitLocal.copy(hitWorld)
          clusterGroupRef.current.worldToLocal(hitLocal)
          g.position.lerp(hitLocal, DRAG_LERP)
        }

        if (onBoneDiscardedRef.current) {
          restTmp.copy(bones[arrIdx].position)
          if (g.position.distanceToSquared(restTmp) > DRAG_DISCARD_DIST_SQ) {
            g.scale.setScalar(0)
            onBoneDiscardedRef.current(dragSrc)
          }
        }
      }
    }

    const snapping = snappingRef.current
    if (snapping.size > 0) {
      const toRemove = []
      snapping.forEach((srcIdx) => {
        const arrIdx = indexBySrcRef.current.get(srcIdx)
        if (arrIdx == null) { toRemove.push(srcIdx); return }
        const g = boneGroupRefs.current[arrIdx]
        if (!g) { toRemove.push(srcIdx); return }
        restTmp.copy(bones[arrIdx].position)
        g.position.lerp(restTmp, SNAP_LERP)
        if (g.position.distanceToSquared(restTmp) < SNAP_EPS_SQ) {
          g.position.copy(restTmp)
          toRemove.push(srcIdx)
        }
      })
      toRemove.forEach((srcIdx) => snapping.delete(srcIdx))
    }
  })

  if (!bones) return null

  return (
    <group ref={clusterGroupRef}>
      {bones.map((bone, i) => {
        const { geometry, position, size, srcIndex } = bone
        const rot      = bone.rotation        ?? [0, 0, 0]
        const scaleMul = bone.scaleMultiplier ?? 1
        const visScale = boneScale * scaleMul
        const hx = Math.max(size.x, 0.005) * hitPadding * visScale
        const hy = Math.max(size.y, 0.005) * hitPadding * visScale
        const hz = Math.max(size.z, 0.005) * hitPadding * visScale
        return (
          <group
            key={srcIndex}
            ref={(el) => { boneGroupRefs.current[i] = el }}
            position={[position.x, position.y, position.z]}
            rotation={rot}
          >
            <mesh geometry={geometry} material={material} scale={visScale} />
            <mesh
              geometry={HIT_GEOMETRY}
              material={HIT_MATERIAL}
              scale={[hx, hy, hz]}
              onPointerDown={(e) => { e.stopPropagation(); onBoneGrab(srcIndex) }}
            />
          </group>
        )
      })}
    </group>
  )
}
