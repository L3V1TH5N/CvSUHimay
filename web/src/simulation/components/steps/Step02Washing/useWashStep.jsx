// src/simulation/components/steps/Step1Washing/useWashStep.jsx
import { useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE      from 'three'
import { useFrame }    from '@react-three/fiber'
import { useFSM }      from '../../../fsm/FSMProvider'
import { useWrongToolGate } from '../../../fsm/useWrongToolGate'
import { WashingFSM }  from '../../../fsm/WashingFSM'
import { WaterSpray }  from '../../tools/WaterSpray'
import { WashCursorTracker } from './WashCursorTracker'
import { WashHintUI }  from './WashHintUI'
import { CURSOR_IDLE, CURSOR_WASHING } from '../shared/stepUtils'
import { getCachedFishMeshes } from '../../fish/fishMeshCache'

// Stable empty handlers — step 2 adds no pointer-event handlers to the fish model.
const EMPTY_FISH_HANDLERS = {}

// Pulses a warm red emissive on fish meshes when cursor is on fish but stationary.
// Identical logic to FishMaterialEffect in Step1Preview — driven entirely by refs,
// no React state or DOM involvement.
function FishMaterialEffect({ isHittingRef, washingRef }) {
  const meshesRef             = useRef(null)
  const origEmissivesRef      = useRef(null)
  const intensityRef          = useRef(0)
  const timeRef               = useRef(0)
  const lastIntensityWrittenRef = useRef(-1)

  useEffect(() => {
    return () => {
      if (!meshesRef.current) return
      origEmissivesRef.current?.forEach((orig, m) => { m.emissive.copy(orig) })
      meshesRef.current.forEach((mesh) => {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((m) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 0 })
      })
    }
  }, [])

  useFrame(({ scene }, dt) => {
    if (!meshesRef.current) {
      const list = getCachedFishMeshes(scene)
      if (!list) return
      const origEmissives = new Map()
      for (let i = 0; i < list.length; i++) {
        const mesh = list[i]
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((m) => {
          if (m.emissive) {
            origEmissives.set(m, m.emissive.clone())
            m.emissive.setRGB(0.9, 0.06, 0.06)
          }
        })
      }
      meshesRef.current        = list
      origEmissivesRef.current = origEmissives
    }

    const idleOnFish = isHittingRef.current && !washingRef.current
    if (idleOnFish) timeRef.current += dt
    const target = idleOnFish
      ? 0.12 + 0.10 * (0.5 + 0.5 * Math.sin(timeRef.current * Math.PI * 0.4))
      : 0
    intensityRef.current += (target - intensityRef.current) * Math.min(1, dt * 2)

    const intensity = intensityRef.current
    if (intensity < 0.001 && !idleOnFish) return

    if (Math.abs(intensity - lastIntensityWrittenRef.current) < 0.002) return
    lastIntensityWrittenRef.current = intensity

    meshesRef.current.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = intensity })
    })
  })

  return null
}

export function useWashStep(stepNum, active, holdDuration, onComplete) {
  const { updateWashProgress, setActiveTool } = useFSM()
  const checkTool = useWrongToolGate()

  const fsmRef          = useRef(null)
  const doneRef         = useRef(false)
  const lastPctRef      = useRef(-1)
  const hitPointRef     = useRef(new THREE.Vector3())
  const isHittingRef    = useRef(false)
  const washingRef      = useRef(false)
  const holdingRef      = useRef(false)
  const drainErrorTimerRef = useRef(null)

  // Ref to WashHintUI's patch-setter (populated by WashHintUI.useEffect on mount).
  // Calling uiNotifyRef.current(patch) re-renders ONLY WashHintUI — not
  // SimulationInner or the 11-hook StepManager chain. This eliminates the
  // ~30 Hz React cascade that was the main source of washing lag.
  const uiNotifyRef = useRef(null)

  useEffect(() => {
    if (!active) {
      doneRef.current    = false
      lastPctRef.current = -1
      return
    }
    fsmRef.current = new WashingFSM({
      holdDuration,
      onProgress: (p) => {
        const rounded = Math.round(p)
        if (rounded === lastPctRef.current) return
        lastPctRef.current = rounded
        uiNotifyRef.current?.({ progress: rounded })
      },
      onComplete: () => {
        doneRef.current    = true
        washingRef.current = false
        holdingRef.current = false
        document.body.style.cursor = CURSOR_IDLE
        uiNotifyRef.current?.({ flash: true, holding: false, washing: false })
        updateWashProgress(100)
        setTimeout(() => {
          uiNotifyRef.current?.({ flash: false })
          onComplete()
        }, 600)
      },
    })
    return () => {
      fsmRef.current?.reset()
      holdingRef.current = false
      washingRef.current = false
      uiNotifyRef.current?.({ holding: false, washing: false, progress: 0, flash: false, drainError: false })
      clearTimeout(drainErrorTimerRef.current)
      lastPctRef.current = -1
      doneRef.current    = false
    }
  }, [active]) // eslint-disable-line

  useEffect(() => {
    if (!active) return
    // Delay tool activation so the SET_TOOL FSM dispatch doesn't land on the
    // Step 1→2 boundary frame while BoardToSinkTransition is mid-flight (~1.5 s).
    const t = setTimeout(() => setActiveTool('water'), 2000)
    return () => { clearTimeout(t); setActiveTool(null) }
  }, [active]) // eslint-disable-line

  // Set initial idle cursor on activation; clean up on deactivation.
  // Dynamic cursor changes (hover on/off fish) are handled imperatively in
  // handleHoldChange — no React state dep, no re-render.
  useEffect(() => {
    if (!active) return
    document.body.style.cursor = CURSOR_IDLE
    return () => { document.body.style.cursor = '' }
  }, [active])

  const handleHoldChange = useCallback((hitting) => {
    if (doneRef.current) return
    if (hitting && !checkTool()) return
    holdingRef.current = hitting
    // Cursor updated imperatively — avoids a setState → re-render cycle.
    document.body.style.cursor = hitting ? CURSOR_WASHING : CURSOR_IDLE
    uiNotifyRef.current?.({ holding: hitting, ...((!hitting) ? { washing: false } : {}) })
    if (!hitting) washingRef.current = false
  }, [checkTool])

  const handleWashChange = useCallback((isWashing) => {
    if (doneRef.current) return
    washingRef.current = isWashing
    uiNotifyRef.current?.({ washing: isWashing })
    // Drain penalty: only if cursor leaves after crossing 50%.
    if (!isWashing && (fsmRef.current?.progress ?? 0) > 50) {
      clearTimeout(drainErrorTimerRef.current)
      uiNotifyRef.current?.({ drainError: true })
      drainErrorTimerRef.current = setTimeout(() => uiNotifyRef.current?.({ drainError: false }), 1500)
    }
  }, [])

  // Stable JSX reference for 3D washing effects.
  const extra3D = useMemo(() => !active ? null : (
    <>
      <WashCursorTracker
        fsmRef={fsmRef}
        hitPointRef={hitPointRef}
        isHittingRef={isHittingRef}
        onHoldChange={handleHoldChange}
        onWashChange={handleWashChange}
      />
      <FishMaterialEffect isHittingRef={isHittingRef} washingRef={washingRef} />
      <WaterSpray activeRef={holdingRef} positionRef={hitPointRef} />
    </>
  ), [active, handleHoldChange, handleWashChange]) // eslint-disable-line

  // Stable domUI: WashHintUI owns its own state. Memoized with [active] so the
  // JSX reference never changes during active washing — sceneResult stays stable.
  const domUI = useMemo(() => !active ? null : <WashHintUI notifyRef={uiNotifyRef} />, [active])

  if (!active) return { fishHandlers: EMPTY_FISH_HANDLERS, waterActive: false, extra3D: null, domUI: null }

  return {
    fishHandlers: EMPTY_FISH_HANDLERS,
    waterActive: true,
    extra3D,
    domUI,
  }
}
