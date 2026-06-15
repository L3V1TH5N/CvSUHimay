// web/src/simulation/components/tools/FreeToolOverlay.jsx
// Renders the toolbox-selected tool's 3D visual when it differs from the
// current step's required tool. Lives inside the R3F Canvas (not DOM).
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree }         from '@react-three/fiber'
import * as THREE                     from 'three'
import { useFSM }       from '../../fsm/FSMProvider'
import { WaterSpray }   from './WaterSpray'
import { ForcepsTool }  from './ForcepsTool'
import { KnifeTool }    from './KnifeTool'

// Horizontal drag plane shared by bone steps — use for cursor world tracking.
const DRAG_PLANE_Y = 1.05
const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)

// Tracks cursor world position on DRAG_PLANE and writes it into positionRef.
// Mounted only when WaterSpray is active so the raycaster has zero cost otherwise.
function CursorPlaneTracker({ positionRef }) {
  const { camera, size } = useThree()
  const ndc       = useMemo(() => new THREE.Vector2(), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const screenPos = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth  / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  })

  useEffect(() => {
    const onMove = (e) => { screenPos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(() => {
    const { x, y } = screenPos.current
    ndc.set((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    // intersectPlane writes result into positionRef.current; returns null when ray is parallel
    raycaster.ray.intersectPlane(DRAG_PLANE, positionRef.current)
  })

  return null
}

export function FreeToolOverlay() {
  const { activeTool, currentStepDef } = useFSM()
  const cursorWorldRef = useRef(new THREE.Vector3())

  const requiredTool    = currentStepDef?.tool ?? null
  const showFreeOverlay = activeTool !== null && activeTool !== requiredTool

  return (
    <>
      {showFreeOverlay && activeTool === 'water' && (
        <>
          <CursorPlaneTracker positionRef={cursorWorldRef} />
          <WaterSpray active positionRef={cursorWorldRef} />
        </>
      )}
      {showFreeOverlay && activeTool === 'forceps' && <ForcepsTool />}
      {showFreeOverlay && activeTool === 'knife'   && <KnifeTool />}
    </>
  )
}
