// src/simulation/components/steps/Step11Inspect/Step11Inspect.jsx
// Quality inspection: click the fish to zoom in; click again to zoom out.
// Continue button appears after the first zoom-in to advance the step.

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useThree, useFrame }                       from '@react-three/fiber'
import * as THREE                                   from 'three'

import { logEvent }         from '../../../fsm/eventStream'
import { EVENT_TYPE }       from '../../../fsm/errors'
import { HINT_STYLE }       from '../shared/stepUtils'

const STEP_ID = 11

// ── Camera constants (cuttingBoardTop preset — top-down over the fish) ────────
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
// Replaces GameCamera while Step 11 is active. Tweens between the cuttingBoardTop
// overview and a position directly above the clicked point on the fish.
// All tween state is refs — zero per-frame allocation when settled.
export function InspectCamera({ zoomedPoint }) {
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
  const pending  = useRef(false) // arm snapshot at next rAF boundary

  // On the first tween (mount), curTgt is initialised to OVERVIEW_TGT but the
  // camera is still at GameCamera's last position (pointing at the sink for
  // step 10). If we used OVERVIEW_TGT as startTgt the camera would snap its
  // look-at to the cutting board immediately while the fish is still at the
  // sink, making the fish invisible for the entire 0.55 s tween.
  // firstTweenRef gates a one-shot quaternion-based startTgt capture so the
  // tween begins looking at wherever GameCamera left off.
  const firstTweenRef  = useRef(true)
  const pendingScratch = useRef(new THREE.Vector3())

  // Snap to overview on mount so the fish is immediately visible from frame 1.
  // GameCamera was pointing at the sink (Step 10); without this snap the camera
  // tweens from the sink view and the cutting board is outside the 28° FOV for
  // the entire 0.55 s tween duration — the fish appears invisible.
  // curTgt is also synced so the subsequent tween has a clean start/dest match.
  useEffect(() => {
    camera.position.copy(OVERVIEW_POS)
    camera.fov = OVERVIEW_FOV
    camera.updateProjectionMatrix()
    camera.lookAt(OVERVIEW_TGT)
    curTgt.current.copy(OVERVIEW_TGT)
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

  // Priority -2 matches GameCamera so it wins over OrbitControls (drei: -1)
  useFrame((_, dt) => {
    if (settled.current) return

    // Snapshot at true rAF boundary to avoid useEffect timing gap
    if (pending.current) {
      startPos.current.copy(camera.position)
      if (firstTweenRef.current) {
        // Compute the camera's actual look direction from its quaternion so the
        // outgoing GameCamera view (e.g. sink) is used as startTgt instead of
        // the pre-initialised OVERVIEW_TGT. Without this, the look-at would
        // snap to the cutting board on frame 1 while the fish is still at the
        // sink — fish invisible until it lerps into the 28° FOV (~1 s later).
        firstTweenRef.current = false
        pendingScratch.current.set(0, 0, -1).applyQuaternion(camera.quaternion)
        curTgt.current.copy(camera.position).addScaledVector(pendingScratch.current, 2.0)
      }
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

// ── Continue button style ─────────────────────────────────────────────────────
const CONTINUE_STYLE = {
  position: 'absolute', bottom: 136, left: '50%', transform: 'translateX(-50%)',
  background: 'rgba(78,205,113,0.18)', border: '2px solid rgba(78,205,113,0.7)',
  borderRadius: 40, padding: '10px 28px', color: '#4ecd71', fontSize: 15,
  fontWeight: 700, letterSpacing: '0.06em',
  fontFamily: "'Rajdhani', sans-serif", backdropFilter: 'blur(8px)',
  zIndex: 101, cursor: 'pointer', pointerEvents: 'auto',
}

// ── useInspectStep ────────────────────────────────────────────────────────────
export function useInspectStep(active, onComplete) {
  const [zoomedPoint,  setZoomedPoint]  = useState(null)
  const [hasZoomed,    setHasZoomed]    = useState(false)
  // isSubmitted drives the button's disabled state via React state (not a raw ref read)
  // so the button re-renders immediately when Continue is clicked regardless of how
  // many zoom interactions preceded it.
  const [isSubmitted,  setIsSubmitted]  = useState(false)
  const hasZoomedRef = useRef(false)    // shadow ref for stable callback reads
  const completedRef = useRef(false)    // single-fire gate — kept in sync with isSubmitted

  // Reset on (de)activation so re-entries start fresh
  useEffect(() => {
    setZoomedPoint(null)
    setHasZoomed(false)
    setIsSubmitted(false)
    hasZoomedRef.current = false
    completedRef.current = false
  }, [active])

  // Analytics: state-enter / state-exit logging
  useEffect(() => {
    if (!active) return
    logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER, { phase: 'inspection' })
    return () => logEvent(STEP_ID, EVENT_TYPE.STATE_EXIT, { phase: 'inspection' })
  }, [active])

  // Memoize the camera JSX so its reference only changes when zoom state changes,
  // not on every TICK re-render. Prevents sceneResult in BangusDeboningSim from
  // recomputing every second and keeps SimulationScene.memo bailing correctly.
  // Must be declared before the early-return to satisfy rules of hooks.
  const cameraComponent = useMemo(
    () => active ? <InspectCamera zoomedPoint={zoomedPoint} /> : null,
    [active, zoomedPoint],
  )

  // Click on the fish: zoom in to that point; second click zooms back out.
  // Reads zoomedPoint directly (listed in deps) so side effects stay outside
  // the setState updater — required for React 18 Concurrent Mode correctness.
  // Putting setHasZoomed / logEvent inside a setState updater was an anti-pattern:
  // React may invoke updaters multiple times, causing unpredictable batching.
  const handleFishClick = useCallback((e) => {
    e.stopPropagation()
    if (zoomedPoint) {
      // Zoom out
      setZoomedPoint(null)
    } else {
      // Zoom in — first occurrence unlocks the Continue button
      setZoomedPoint(e.point.clone())
      if (!hasZoomedRef.current) {
        hasZoomedRef.current = true
        setHasZoomed(true)
        logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, { phase: 'zoom_in' })
      }
    }
  }, [zoomedPoint])

  const handleContinue = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    setIsSubmitted(true)  // sync state so button disables immediately via React render
    onComplete()
  }, [onComplete])

  if (!active) return { fishHandlers: {}, waterActive: false, extra3D: null, domUI: null }

  const hint = zoomedPoint
    ? '🔍 Click to zoom out'
    : '🔍 Click anywhere on the fish to inspect'

  return {
    fishHandlers:    { onClick: handleFishClick },
    waterActive:     false,
    extra3D:         null,
    // Memoized above — SimulationScene renders this instead of GameCamera
    cameraComponent,
    domUI: (
      <>
        <div style={HINT_STYLE}><span>{hint}</span></div>
        {hasZoomed && (
          <button
            style={{
              ...CONTINUE_STYLE,
              opacity: isSubmitted ? 0.6 : 1,
              cursor:  isSubmitted ? 'not-allowed' : 'pointer',
            }}
            disabled={isSubmitted}
            onClick={handleContinue}
          >
            Continue →
          </button>
        )}
      </>
    ),
  }
}
