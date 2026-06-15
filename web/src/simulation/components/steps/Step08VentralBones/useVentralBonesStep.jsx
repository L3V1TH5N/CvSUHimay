// src/simulation/components/steps/Step08VentralBones/useVentralBonesStep.jsx
//
// FSM-integrated hook for Step 8 (ventral intermuscular spine removal).
// Ported from Step08Preview.jsx — board-boundary auto-discard (same model as Step 7).
//
// Interaction lifecycle:
//   pointerDown → onBoneGrab  → drag starts
//   useFrame    → cursor exits board footprint → onBoneDiscarded (auto, mid-drag)
//   pointerUp   → not yet discarded → snap back + reportError + logEvent(failed)
//
// Returns { fishHandlers, waterActive, extra3D, zoomEnabled, ventralBoneSlot, domUI }.
// ventralBoneSlot is rendered by FishModel inside the butterflied transform group.
// zoomEnabled: true — scroll zoom is active.

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'

import { logEvent }               from '../../../fsm/eventStream'
import { EVENT_TYPE, ERROR_CLASS } from '../../../fsm/errors'
import { useFSMActions }           from '../../../fsm/FSMProvider'
import { useWrongToolGate }        from '../../../fsm/useWrongToolGate'
import { useStepToolVisible }      from '../../../fsm/useStepToolVisible'
import { HINT_STYLE }        from '../shared/stepUtils'
import { ForcepsTool }       from '../../tools/ForcepsTool'
import { TOTAL_VENTRAL_BONES } from './ventralBonesLoader'
import { Step08BoneCluster } from './Step08BoneCluster'
import { ButterfliedFishOnBoard } from '../Step06RibBones/ButterfliedFishOnBoard'

const STEP_ID = 8
const PHASE   = 'ventral_bone_drag'

const COUNT_STYLE = {
  position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)',
  color: 'rgba(245,200,66,0.75)', fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
  pointerEvents: 'none', zIndex: 101,
}

export function useVentralBonesStep(active, onComplete) {
  const { reportError, removeBone } = useFSMActions()
  const removedRef        = useRef(new Set())
  const currentDragSrcRef = useRef(null)
  const snappingRef       = useRef(new Set())
  const doneRef           = useRef(false)

  const [count,    setCount]    = useState(0)
  const [dragging, setDragging] = useState(false)

  const toolVisible = useStepToolVisible()

  // Reset all mutable state when the step activates so re-entries start fresh.
  useEffect(() => {
    if (!active) return
    removedRef.current        = new Set()
    currentDragSrcRef.current = null
    snappingRef.current       = new Set()
    doneRef.current           = false
    setCount(0)
    setDragging(false)
  }, [active])

  // FSM lifecycle events.
  useEffect(() => {
    if (!active) return
    logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER, { phase: PHASE })
    return () => {
      logEvent(STEP_ID, EVENT_TYPE.STATE_EXIT, { phase: PHASE })
    }
  }, [active])

  // Hide system cursor while step is active; restore on cleanup.
  useEffect(() => {
    if (!active) return
    document.body.style.cursor = 'none'
    return () => { document.body.style.cursor = '' }
  }, [active])

  // Called by Step08BoneCluster when a bone exits the board footprint mid-drag.
  const onBoneDiscarded = useCallback((srcIdx) => {
    if (doneRef.current)                return
    if (removedRef.current.has(srcIdx)) return
    removedRef.current.add(srcIdx)
    removeBone('ventral')
    currentDragSrcRef.current = null
    setDragging(false)
    const total = removedRef.current.size
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
      phase: PHASE, boneIndex: srcIdx, complete: true, removed: total,
    })
    setCount(total)
    if (total >= TOTAL_VENTRAL_BONES) {
      doneRef.current = true
      setTimeout(onComplete, 500)
    }
  }, [onComplete, removeBone])

  // Global pointerup: if bone was not auto-discarded, snap it back + report error.
  useEffect(() => {
    if (!active) return
    const onUp = () => {
      const idx = currentDragSrcRef.current
      if (idx == null) return   // already auto-discarded mid-drag
      currentDragSrcRef.current = null
      setDragging(false)
      document.body.style.cursor = ''
      if (!removedRef.current.has(idx)) {
        snappingRef.current.add(idx)
        reportError({
          class:     ERROR_CLASS.WRONG_CUT_PATH,
          reason:    'insufficient_pull',
          boneIndex: idx,
        })
        logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
          phase: PHASE, boneIndex: idx, complete: false, reason: 'dropped_on_board',
        })
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [active, reportError])

  const checkTool = useWrongToolGate()

  const onBoneGrab = useCallback((srcIdx) => {
    if (!checkTool()) return   // wrong tool — error dispatched, bail
    if (doneRef.current)                   return
    if (currentDragSrcRef.current != null) return
    if (removedRef.current.has(srcIdx))    return
    snappingRef.current.delete(srcIdx)  // cancel any in-progress snap-back
    currentDragSrcRef.current = srcIdx
    setDragging(true)
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_START, { phase: PHASE, boneIndex: srcIdx })
  }, [checkTool])

  // Memoize the 3D slot — remounts only when count or callbacks change,
  // not on every dragging state tick.
  const ventralBoneSlot = useMemo(() => (
    <Step08BoneCluster
      removedRef={removedRef}
      currentDragSrcRef={currentDragSrcRef}
      snappingRef={snappingRef}
      removedVersion={count}
      onBoneGrab={onBoneGrab}
      onBoneDiscarded={onBoneDiscarded}
    />
  ), [count, onBoneGrab, onBoneDiscarded])

  // ── All hooks called above — safe to early-return below ──────────────────
  if (!active) return {
    fishHandlers: {}, waterActive: false, extra3D: null,
    zoomEnabled: false, ventralBoneSlot: null, domUI: null,
  }

  const allDone = count >= TOTAL_VENTRAL_BONES
  const message = allDone
    ? '✅ All ventral spines removed!'
    : dragging
      ? '🦴 Keep pulling away from the fish…'
      : '🥢 Grab a glowing bone and pull it away'

  return {
    fishHandlers: { hidden: true },
    waterActive:  false,
    zoomEnabled:  true,
    extra3D: (
      <>
        {toolVisible && <ForcepsTool grabbing={dragging} />}
        <ButterfliedFishOnBoard boneSlot={ventralBoneSlot} />
      </>
    ),
    domUI: (
      <>
        <div style={HINT_STYLE}>
          <span>{message}</span>
        </div>
        {!allDone && (
          <div style={COUNT_STYLE}>
            {count} / {TOTAL_VENTRAL_BONES} removed
          </div>
        )}
      </>
    ),
  }
}
