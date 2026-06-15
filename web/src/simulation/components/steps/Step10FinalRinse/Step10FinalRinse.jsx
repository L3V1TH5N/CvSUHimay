// src/simulation/components/steps/Step10FinalRinse/Step10FinalRinse.jsx
// Step 10 — Final rinse. Hover cursor over the fish to fill a 2 s progress
// bar; cursor leaves → bar drains at 2× speed. Advance on 100 %.
//
// Optimization notes (matching Step10Preview pattern):
//   • FrameDriver runs inside the R3F Canvas via useFrame (dt-based). This
//     ties the fill/drain rate to wall-clock seconds — immune to frame-rate
//     variance — and keeps the hot loop off the React render path entirely.
//   • Progress is throttled to integer %. Without this every useFrame tick
//     (~60 Hz) would call updateWashProgress and re-render every useFSM()
//     consumer. Throttle caps re-renders at ≤ 100 per rinse cycle.
//   • Hot-path state (hold flag, progress value, last reported %, done flag)
//     lives in refs — bypasses React state inside the useFrame callback.
//   • onFishEnter / onFishLeave are useCallback([], …) so R3F does not
//     re-register pointer handlers on every render.
//   • handleProgress / handleComplete are stable (useCallback with stable
//     deps) so FrameDriver props don't change across renders — no remount.

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

import * as THREE from 'three'
import { useFSM }                    from '../../../fsm/FSMProvider'
import { useWrongToolGate }           from '../../../fsm/useWrongToolGate'
import { logEvent }                   from '../../../fsm/eventStream'
import { EVENT_TYPE, ERROR_CLASS }    from '../../../fsm/errors'
import { WaterSpray } from '../../tools/WaterSpray'
import { CURSOR_IDLE, CURSOR_WASHING } from '../shared/stepUtils'

// Fish rests in the sink basin at this position (matches Step10Preview constants).
const FISH_SINK_CENTER = { current: new THREE.Vector3(-0.32, 1.16, -2.22) }

const STEP_ID = 10
// Fill duration in seconds. Drain runs at 2× so the bar empties in ~1 s.
const HOLD_DURATION = 2.0

// FrameDriver — must render inside the R3F Canvas (returned via extra3D).
// Uses delta time from useFrame so fill/drain are frame-rate independent.
function FrameDriver({ holdingRef, progressRef, lastPctRef, doneRef, onProgress, onComplete }) {
  useFrame((_, dt) => {
    if (doneRef.current) return
    const FILL  = 100 / HOLD_DURATION       // %/s while holding
    const DRAIN = FILL * 2                  // %/s while released (2× speed)
    progressRef.current = holdingRef.current
      ? Math.min(100, progressRef.current + FILL  * dt)
      : Math.max(0,   progressRef.current - DRAIN * dt)
    const r = Math.round(progressRef.current)
    if (r !== lastPctRef.current) {
      lastPctRef.current = r
      onProgress(r)
      if (r >= 100) { doneRef.current = true; onComplete() }
    }
  })
  return null
}

// useFinalRinseStep — drives Step 10 (hover-to-rinse, 2 s hold to advance).
export function useFinalRinseStep(active, onComplete) {
  const { updateWashProgress, setActiveTool, reportError } = useFSM()
  const checkTool = useWrongToolGate()

  // DOM state — integer % throttle keeps re-renders ≤ 100 per step.
  const [progress,   setProgress]   = useState(0)
  const [holding,    setHolding]    = useState(false)
  const [flash,      setFlash]      = useState(false)
  const [drainError, setDrainError] = useState(false)

  // Hot-path refs — bypass React state inside the useFrame callback.
  const holdingRef       = useRef(false)
  const progressRef      = useRef(0)
  const lastPctRef       = useRef(-1)
  const doneRef          = useRef(false)
  const drainErrorTimerRef = useRef(null)

  // Reset refs and log entry/exit when step activates / deactivates.
  useEffect(() => {
    if (!active) return
    holdingRef.current  = false
    progressRef.current = 0
    lastPctRef.current  = -1
    doneRef.current     = false
    logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER, { phase: 'final_rinse' })
    return () => {
      holdingRef.current  = false
      progressRef.current = 0
      lastPctRef.current  = -1
      doneRef.current     = false
      clearTimeout(drainErrorTimerRef.current)
      setProgress(0)
      setHolding(false)
      setFlash(false)
      setDrainError(false)
      logEvent(STEP_ID, EVENT_TYPE.STATE_EXIT, { phase: 'final_rinse' })
    }
  }, [active])

  // Highlight water tool in the toolbox while step is active.
  useEffect(() => {
    if (!active) return
    setActiveTool('water')
    return () => setActiveTool(null)
  }, [active]) // eslint-disable-line

  // Swap cursor to water-drop icon; flip white during the hold.
  useEffect(() => {
    if (!active) return
    document.body.style.cursor = holding ? CURSOR_WASHING : CURSOR_IDLE
    return () => { document.body.style.cursor = '' }
  }, [active, holding])

  // Stable callbacks — called from FrameDriver's useFrame (not render path).
  const handleProgress = useCallback((pct) => {
    updateWashProgress(pct)
    setProgress(pct)
  }, [updateWashProgress])

  const handleComplete = useCallback(() => {
    holdingRef.current = false
    setHolding(false)
    setFlash(true)
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
      phase: 'final_rinse', complete: true, progress: 100,
    })
    setTimeout(() => { setFlash(false); onComplete() }, 600)
  }, [onComplete])

  // Stable fish-contact callbacks. onFishEnter depends only on checkTool
  // (changes on tool-switch); onFishLeave depends only on reportError — both
  // keep R3F re-registrations rare.
  const onFishEnter = useCallback(() => {
    if (doneRef.current) return
    if (!checkTool()) return
    holdingRef.current = true
    setHolding(true)
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_START, { phase: 'final_rinse' })
  }, [checkTool])

  const onFishLeave = useCallback(() => {
    holdingRef.current = false
    setHolding(false)
    // Penalise breaking contact after progress has built (mirrors Step 2 drain-error logic)
    if (progressRef.current > 5) {
      reportError({
        class:    ERROR_CLASS.WRONG_CUT_PATH,
        reason:   'contact_broken',
        progress: Math.round(progressRef.current),
      })
      clearTimeout(drainErrorTimerRef.current)
      setDrainError(true)
      drainErrorTimerRef.current = setTimeout(() => setDrainError(false), 1500)
    }
  }, [reportError])

  // Memoized 3D overlay — deps are stable callbacks and `active` flag only.
  // holdingRef is a ref (stable identity), so hover/unhover events no longer
  // cause extra3D to get a new JSX identity → SimulationScene.memo does not
  // re-render → no R3F reconciliation on every pointer-enter/leave event.
  const extra3D = useMemo(() => !active ? null : (
    <>
      <WaterSpray activeRef={holdingRef} positionRef={FISH_SINK_CENTER} />
      <FrameDriver
        holdingRef={holdingRef}
        progressRef={progressRef}
        lastPctRef={lastPctRef}
        doneRef={doneRef}
        onProgress={handleProgress}
        onComplete={handleComplete}
      />
    </>
  ), [active, handleProgress, handleComplete]) // eslint-disable-line

  if (!active) return { fishHandlers: {}, waterActive: false, extra3D: null, domUI: null }

  return {
    fishHandlers: { onPointerEnter: onFishEnter, onPointerLeave: onFishLeave },
    waterActive:  true,
    extra3D,
    domUI: <RinseHud progress={progress} holding={holding} flash={flash} drainError={drainError} />,
  }
}

// RinseHud — bottom-center progress card for the final rinse. Stateless
// function so React reuses the same fiber across the bounded re-renders.
function RinseHud({ progress, holding, flash, drainError }) {
  const borderColor = flash       ? 'rgba(78,205,113,0.9)'
                    : drainError  ? 'rgba(255,80,80,0.85)'
                    : holding     ? 'rgba(78,205,113,0.8)'
                    :               'rgba(78,205,113,0.35)'
  const bgColor     = flash       ? 'rgba(10,60,20,0.97)'
                    : drainError  ? 'rgba(40,4,4,0.95)'
                    :               'rgba(4,20,8,0.92)'
  const textColor   = flash       ? '#4ecd71'
                    : holding     ? '#4ecd71'
                    :               '#8aab90'
  const barColor    = drainError  ? '#ff4444'
                    : holding     ? 'linear-gradient(90deg,#4ecd71,#88ffaa)'
                    :               '#2a8040'

  return (
    <div style={{
      position: 'absolute', bottom: '90px', left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      background: bgColor,
      border: `2px solid ${borderColor}`,
      borderRadius: '20px', padding: '12px 28px',
      transition: 'background 0.3s, border-color 0.3s',
      fontFamily: "'Rajdhani', sans-serif",
      backdropFilter: 'blur(10px)',
      zIndex: 101, pointerEvents: 'none',
      minWidth: '260px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: '20px' }}>{flash ? '✅' : '💧'}</span>
        <span style={{
          color: textColor,
          fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em',
        }}>
          {flash
            ? 'Final rinse complete!'
            : drainError
              ? 'Keep moving! Progress is draining'
              : holding
                ? `Rinsing… ${progress}%`
                : 'Move cursor over the fish for a final rinse'}
        </span>
      </div>
      {!flash && (
        <div style={{
          width: '100%', height: '6px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '3px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: barColor,
            borderRadius: '3px',
            transition: 'width 0.08s linear, background 0.3s',
          }} />
        </div>
      )}
      {drainError && (
        <div style={{
          color: '#ff6b6b', fontSize: '12px',
          fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          ❌ Don&apos;t stop — points deducted!
        </div>
      )}
    </div>
  )
}
