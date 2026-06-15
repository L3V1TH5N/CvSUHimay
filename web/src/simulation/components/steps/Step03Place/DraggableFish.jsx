// web/src/simulation/components/steps/Step03Place/DraggableFish.jsx
import { useRef, useMemo, useState, useEffect, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '../../../utils/useGLTFLocal'
import * as THREE from 'three'

// World positions — must match FishModel FISH_WORLD exactly
const SINK  = new THREE.Vector3(-0.25, 1.10, -2.22)
// Drag geometry — Z locked to SINK.z so fish depth never changes (no size shift)
const DRAG_LIFT        = 0.15            // Y above SINK.y while carrying
const DRAG_Y           = SINK.y + DRAG_LIFT
const DRAG_Z           = SINK.z
const X_MIN            = SINK.x  - 0.3  // leftward clamp

// Drop zone
const MAGNET_THRESHOLD = 0.4   // X distance to board that activates snap preview
const DROP_RADIUS      = 0.45  // X distance to board for a valid drop on release

// Animation lerp factors
const LERP_FREE    = 0.22  // cursor follow, outside magnet zone
const LERP_MAGNET  = 0.35  // strong pull inside magnet zone
const LERP_SNAP    = 0.12  // deliberate settle onto board
const LERP_RETURN  = 0.09  // unhurried return to sink

// Fish orientation
const ROT_SINK  = 1.6          // sink Y-rotation (rad)
const ROT_BOARD = Math.PI / 2  // board Y-rotation (rad)

// Settle bounce (on snap landing)
const SETTLE_INIT    = 0.022
const SETTLE_DECAY   = 0.76

// At-rest early-out threshold (~2 cm²)
const POS_EPSILON_SQ = 4e-4

export function DraggableFish({ onPlaced, onOverBoard, boardPosition }) {
  const BOARD = boardPosition
    ? new THREE.Vector3(...boardPosition)
    : new THREE.Vector3( 1.00, 0.97, -2.19)
  const X_MAX = BOARD.x + 0.5  // rightward clamp
  const { scene: closedScene } = useGLTF('/models/BangusCUTTEDFIN.opt.glb')
  const { gl, camera } = useThree()

  // Clone scene so this instance owns its own geometry/materials
  const closedClone = useMemo(() => closedScene.clone(), [closedScene])

  // Clone materials — emissive warm-white starts at 0, animates during drag
  const mats = useMemo(() => {
    const list = []
    closedClone.traverse((c) => {
      if (!c.isMesh || !c.material) return
      c.material = c.material.clone()
      c.material.emissive          = new THREE.Color('#ffffff')
      c.material.emissiveIntensity = 0
      list.push(c.material)
    })
    return list
  }, [closedClone])

  const groupRef       = useRef()
  const phaseRef       = useRef('idle')  // 'idle' | 'dragging' | 'snapping' | 'returning'
  const targetXRef     = useRef(SINK.x)  // cursor-driven X, written on pointermove
  const settleRef      = useRef(0)       // Y bounce amplitude, decays per-frame on snap
  const overBoardRef   = useRef(false)   // guards duplicate onOverBoard(true/false) calls
  const placedFiredRef = useRef(false)   // guards duplicate onPlaced() call
  const isMountedRef   = useRef(true)    // guards setState after unmount

  // isDragging = true only while pointer is held — mounts DOM listeners (2 re-renders per drag)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => () => { isMountedRef.current = false }, [])

  useLayoutEffect(() => {
    if (!groupRef.current) return
    groupRef.current.position.copy(SINK)
    groupRef.current.rotation.y = ROT_SINK
    groupRef.current.scale.setScalar(0.6)
  }, [])

  // DOM-level pointer tracking using THREE.Plane ray intersection.
  // A mathematical horizontal plane at DRAG_Y intercepts the cursor ray — no scene mesh needed.
  useEffect(() => {
    if (!isDragging) return

    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y)
    const raycaster = new THREE.Raycaster()
    const ndc       = new THREE.Vector2()
    const hit       = new THREE.Vector3()

    const onMove = (e) => {
      if (phaseRef.current !== 'dragging') return
      const rect = gl.domElement.getBoundingClientRect()
      ndc.set(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        -((e.clientY - rect.top)  / rect.height) *  2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(dragPlane, hit)) {
        targetXRef.current = THREE.MathUtils.clamp(hit.x, X_MIN, X_MAX)
      }
    }

    const onUp = () => {
      if (phaseRef.current !== 'dragging') return
      const fish = groupRef.current
      if (!fish) { if (isMountedRef.current) setIsDragging(false); return }

      // Clear board highlight before transitioning
      if (overBoardRef.current) {
        overBoardRef.current = false
        onOverBoard(false)
      }

      if (Math.abs(fish.position.x - BOARD.x) < DROP_RADIUS) {
        settleRef.current = SETTLE_INIT
        phaseRef.current  = 'snapping'
      } else {
        phaseRef.current  = 'returning'
      }
      gl.domElement.style.cursor = ''
      if (isMountedRef.current) setIsDragging(false)
    }

    gl.domElement.addEventListener('pointermove',   onMove)
    gl.domElement.addEventListener('pointerup',     onUp)
    gl.domElement.addEventListener('pointercancel', onUp)
    return () => {
      gl.domElement.removeEventListener('pointermove',   onMove)
      gl.domElement.removeEventListener('pointerup',     onUp)
      gl.domElement.removeEventListener('pointercancel', onUp)
    }
  }, [isDragging, gl, camera, onOverBoard])

  useFrame(() => {
    if (!groupRef.current) return
    const g = groupRef.current

    // ── idle ──────────────────────────────────────────────────────────────
    if (phaseRef.current === 'idle') {
      // At-rest early-out — skip all lerps when fish is parked at sink
      if (g.position.distanceToSquared(SINK) < POS_EPSILON_SQ) return
      g.position.lerp(SINK, 0.12)
      return
    }

    // ── dragging ──────────────────────────────────────────────────────────
    if (phaseRef.current === 'dragging') {
      const tx       = targetXRef.current
      const inMagnet = Math.abs(tx - BOARD.x) < MAGNET_THRESHOLD
      const destX    = inMagnet ? BOARD.x : tx
      const factor   = inMagnet ? LERP_MAGNET : LERP_FREE

      // Only X is cursor-driven. Y and Z are fixed — no depth change, no size shift.
      g.position.x = THREE.MathUtils.lerp(g.position.x, destX,  factor)
      g.position.y = THREE.MathUtils.lerp(g.position.y, DRAG_Y, 0.20)
      g.position.z = THREE.MathUtils.lerp(g.position.z, DRAG_Z, 0.20)

      // Fire onOverBoard on threshold crossing (guarded by overBoardRef)
      if (inMagnet && !overBoardRef.current) {
        overBoardRef.current = true
        onOverBoard(true)
      } else if (!inMagnet && overBoardRef.current) {
        overBoardRef.current = false
        onOverBoard(false)
      }

      // Emissive highlight up while carrying
      for (const m of mats) {
        m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, 0.12, 0.10)
      }
      return
    }

    // ── snapping ──────────────────────────────────────────────────────────
    if (phaseRef.current === 'snapping') {
      // Emissive fades out on release
      for (const m of mats) {
        m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, 0, 0.10)
      }

      // Settle bounce: starts at SETTLE_INIT, decays per-frame — gives "land" feel
      settleRef.current *= SETTLE_DECAY
      if (settleRef.current < 1e-4) settleRef.current = 0  // clamp so lerp target reaches BOARD.y exactly
      g.position.x = THREE.MathUtils.lerp(g.position.x, BOARD.x,                    LERP_SNAP)
      g.position.y = THREE.MathUtils.lerp(g.position.y, BOARD.y + settleRef.current, LERP_SNAP)
      g.position.z = THREE.MathUtils.lerp(g.position.z, BOARD.z,                    LERP_SNAP)
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, ROT_BOARD, 0.14)

      if (!placedFiredRef.current && g.position.distanceToSquared(BOARD) < POS_EPSILON_SQ) {
        placedFiredRef.current = true
        g.position.set(BOARD.x, BOARD.y, BOARD.z)
        g.rotation.y = ROT_BOARD
        onPlaced()
      }
      return
    }

    // ── returning ─────────────────────────────────────────────────────────
    if (phaseRef.current === 'returning') {
      for (const m of mats) {
        m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, 0, 0.10)
      }
      g.position.x = THREE.MathUtils.lerp(g.position.x, SINK.x, LERP_RETURN)
      g.position.y = THREE.MathUtils.lerp(g.position.y, SINK.y, LERP_RETURN)
      g.position.z = THREE.MathUtils.lerp(g.position.z, SINK.z, LERP_RETURN)
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, ROT_SINK, 0.10)

      if (g.position.distanceToSquared(SINK) < POS_EPSILON_SQ) {
        g.position.copy(SINK)
        g.rotation.y    = ROT_SINK
        phaseRef.current = 'idle'
      }
    }
  })

  return (
    <group ref={groupRef}>
      <primitive
        object={closedClone}
        castShadow
        receiveShadow
        onPointerEnter={() => {
          if (phaseRef.current === 'idle') gl.domElement.style.cursor = 'grab'
        }}
        onPointerLeave={() => {
          if (phaseRef.current === 'idle') gl.domElement.style.cursor = ''
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          if (phaseRef.current !== 'idle') return
          phaseRef.current       = 'dragging'
          placedFiredRef.current = false
          targetXRef.current     = groupRef.current?.position.x ?? SINK.x
          gl.domElement.style.cursor = 'grabbing'
          setIsDragging(true)
        }}
      />
    </group>
  )
}

useGLTF.preload('/models/BangusCUTTEDFIN.opt.glb')
