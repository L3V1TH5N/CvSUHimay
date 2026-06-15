// web/src/simulation/components/steps/Step05Organs/useOrgansStep.jsx
// Step 5: Remove gills and internal organs — three-phase drag-to-trash.
// Required removal order: guts → gills → spine (mirrors Step05Preview.jsx).
// Uses OrgansDragController (local) for exact preview drag behaviour.

import { useRef, useEffect, useState, useCallback } from 'react'

import { logEvent }               from '../../../fsm/eventStream'
import { EVENT_TYPE, ERROR_CLASS } from '../../../fsm/errors'
import { useFSMActions }           from '../../../fsm/FSMProvider'
import { TrashPanel } from '../shared/TrashPanel'
import { OrgansButterfliedFish } from './OrgansButterfliedFish'
import { useGLTF } from '../../../utils/useGLTFLocal'

import { PIECES } from './organsConfig'
import { OrgansDragController } from './OrgansDragController'
import { ForcepsTool } from '../../tools/ForcepsTool'
import { useWrongToolGate } from '../../../fsm/useWrongToolGate'

// Preload all three organ models so they are ready when the step activates
useGLTF.preload(PIECES.guts.modelPath)
useGLTF.preload(PIECES.gills.modelPath)
useGLTF.preload(PIECES.spine.modelPath)

// ── Hint panel style (mirrors Step05Preview.jsx) ──────────────────────────────
const HINT_BASE = {
  position:       'absolute',
  bottom:         90,
  left:           '50%',
  transform:      'translateX(-50%)',
  borderRadius:   40,
  padding:        '10px 22px',
  fontSize:       14,
  fontWeight:     600,
  letterSpacing:  '0.04em',
  display:        'flex',
  alignItems:     'center',
  gap:            10,
  fontFamily:     "'Rajdhani', sans-serif",
  backdropFilter: 'blur(8px)',
  zIndex:         101,
  pointerEvents:  'none',
  whiteSpace:     'nowrap',
  transition:     'border-color 0.2s, color 0.2s, background 0.2s',
}

// Shake animation keyframes — mirrors Step05Preview.jsx exactly
const SHAKE_CSS = `
  @keyframes step5shake {
    0%,100% { transform: translateX(-50%); }
    20%      { transform: translateX(calc(-50% - 7px)); }
    40%      { transform: translateX(calc(-50% + 7px)); }
    60%      { transform: translateX(calc(-50% - 4px)); }
    80%      { transform: translateX(calc(-50% + 4px)); }
  }
`

const STEP_ID = 5

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useOrgansStep(active, onComplete) {
  const { reportError } = useFSMActions()
  const draggingRef = useRef(false)  // holds active piece id ('guts'|'gills'|'spine') or false
  const doneRef     = useRef(false)  // gate: prevents onComplete from firing twice
  const phaseRef    = useRef('guts') // tracks current phase for logEvent calls
  const seqTimerRef = useRef(null)

  const [dragging,       setDragging]       = useState(false)
  const [hoverPanel,     setHoverPanel]     = useState(false)
  const [gutsDiscarded,  setGutsDiscarded]  = useState(false)
  const [gillsDiscarded, setGillsDiscarded] = useState(false)
  const [spineDiscarded, setSpineDiscarded] = useState(false)
  const [sequenceError,  setSequenceError]  = useState(false)
  const [snapBackGills,  setSnapBackGills]  = useState(0)
  const [snapBackSpine,  setSnapBackSpine]  = useState(0)
  const [wrongDropCount, setWrongDropCount] = useState(0)
  const [latestError,    setLatestError]    = useState(null) // { type: 'wrong_drop' | 'sequence_error' }

  // Reset all state when the step becomes active
  useEffect(() => {
    if (active) {
      draggingRef.current = false
      doneRef.current     = false
      phaseRef.current    = 'guts'
      clearTimeout(seqTimerRef.current)
      setDragging(false)
      setHoverPanel(false)
      setGutsDiscarded(false)
      setGillsDiscarded(false)
      setSpineDiscarded(false)
      setSequenceError(false)
      setSnapBackGills(0)
      setSnapBackSpine(0)
      setWrongDropCount(0)
      setLatestError(null)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER, { phase: 'guts_drag' })
    return () => {
      logEvent(STEP_ID, EVENT_TYPE.STATE_EXIT, { phase: phaseRef.current + '_drag' })
      clearTimeout(seqTimerRef.current)
      document.body.style.cursor = ''
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    document.body.style.cursor = 'none'
    return () => { document.body.style.cursor = '' }
  }, [active])

  const checkTool = useWrongToolGate()

  // Triggers the 1.5 s shake animation and snaps the offending piece back to its rest position
  const flashSequenceError = useCallback((piece) => {
    setSequenceError(true)
    if (piece === 'gills')      setSnapBackGills(n => n + 1)
    else if (piece === 'spine') setSnapBackSpine(n => n + 1)
    clearTimeout(seqTimerRef.current)
    seqTimerRef.current = setTimeout(() => setSequenceError(false), 1500)
  }, [])

  useEffect(() => () => clearTimeout(seqTimerRef.current), [])

  // Validates and records a discard. Returns true only when the piece is removed in correct order.
  // Required order: guts → gills → spine (mirrors useStep5Validation from Step05Preview.jsx)
  const recordDiscard = useCallback((pieceId) => {
    if (pieceId === 'guts' && !gutsDiscarded) {
      setGutsDiscarded(true)
      phaseRef.current = 'gills'
      logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, { phase: 'guts_drag',  complete: true })
      logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER,  { phase: 'gills_drag' })
      return true
    }
    if (pieceId === 'gills' && !gillsDiscarded && gutsDiscarded) {
      setGillsDiscarded(true)
      phaseRef.current = 'spine'
      logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, { phase: 'gills_drag', complete: true })
      logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER,  { phase: 'spine_drag' })
      return true
    }
    if (pieceId === 'spine' && !spineDiscarded && gutsDiscarded && gillsDiscarded) {
      setSpineDiscarded(true)
      logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, { phase: 'spine_drag', complete: true })
      return true
    }
    // Out-of-order drop — piece snaps back; caller triggers the shake
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
      phase: pieceId + '_drag', complete: false, reason: 'sequence_error',
    })
    return false
  }, [gutsDiscarded, gillsDiscarded, spineDiscarded])

  // Returns a stable drag-start callback bound to a specific piece id
  const makeDragStart = useCallback((pieceId) => () => {
    if (!checkTool()) return   // wrong tool — error dispatched, bail
    if (draggingRef.current || doneRef.current) return
    draggingRef.current = pieceId
    setDragging(true)
    setLatestError(null)
    logEvent(STEP_ID, EVENT_TYPE.GESTURE_START, { phase: phaseRef.current + '_drag' })
  }, [checkTool])

  const onPanelEnter = useCallback(() => {
    if (draggingRef.current) setHoverPanel(true)
  }, [])
  const onPanelLeave = useCallback(() => setHoverPanel(false), [])

  // Global pointerup: resolves whether the dropped piece lands on the trash bin or misses
  useEffect(() => {
    if (!active) return
    const onUp = () => {
      if (!draggingRef.current) return
      const piece = draggingRef.current
      draggingRef.current = false
      setDragging(false)
      document.body.style.cursor = ''

      if (hoverPanel) {
        const ok = recordDiscard(piece)
        if (ok) {
          setLatestError(null)
          if (piece === 'spine') {
            doneRef.current = true
            setTimeout(onComplete, 500)
          }
        } else {
          flashSequenceError(piece)
          setLatestError({ type: 'sequence_error' })
          reportError({
            class:         ERROR_CLASS.WRONG_CUT_PATH,
            reason:        'wrong_sequence',
            attemptedPiece: piece,
            expectedPhase:  phaseRef.current,
          })
        }
      } else {
        setWrongDropCount(n => n + 1)
        setLatestError({ type: 'wrong_drop' })
        reportError({
          class:  ERROR_CLASS.WRONG_CUT_PATH,
          reason: 'missed_target',
          piece,
        })
        logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
          phase: phaseRef.current + '_drag', complete: false, reason: 'dropped_outside_panel',
        })
      }
      setHoverPanel(false)
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [active, hoverPanel, onComplete, recordDiscard, flashSequenceError, reportError])

  // DOM-level safety net: catches pointerup on the trash zone div in browsers
  // where the Canvas element can swallow the bubbled event (mirrors Step05Preview.jsx trashZoneRef)
  const trashZoneRef = useCallback((node) => {
    if (!node) return
    const onPointerUp = () => {
      if (!hoverPanel || !draggingRef.current) return
      const piece = draggingRef.current
      const ok    = recordDiscard(piece)
      draggingRef.current = false
      setDragging(false)
      if (ok) {
        setLatestError(null)
        if (piece === 'spine') {
          doneRef.current = true
          setTimeout(onComplete, 500)
        }
      } else {
        flashSequenceError(piece)
        setLatestError({ type: 'sequence_error' })
        reportError({
          class:          ERROR_CLASS.WRONG_CUT_PATH,
          reason:         'wrong_sequence',
          attemptedPiece: piece,
          expectedPhase:  phaseRef.current,
        })
      }
      setHoverPanel(false)
      document.body.style.cursor = ''
    }
    node.addEventListener('pointerup', onPointerUp)
    return () => node.removeEventListener('pointerup', onPointerUp)
  }, [hoverPanel, recordDiscard, onComplete, flashSequenceError, reportError])

  // ── Early return when inactive ────────────────────────────────────────────
  if (!active) return { fishHandlers: {}, waterActive: false, extra3D: null, domUI: null }

  // ── Derived display state (mirrors Step05Preview.jsx) ────────────────────
  const completed      = gutsDiscarded && gillsDiscarded && spineDiscarded
  const discardedCount = [gutsDiscarded, gillsDiscarded, spineDiscarded].filter(Boolean).length
  const phase          = phaseRef.current

  // Mirrors preview: gills/spine remain visible until their turn; all hidden when done
  const showGuts  = !gutsDiscarded
  const showGills = !gillsDiscarded && !completed
  const showSpine = !spineDiscarded && !completed

  // Hint message and panel colour — mirrors Step05Preview.jsx message logic exactly
  let message     = ''
  let borderColor = 'rgba(78,205,113,0.45)'
  let textColor   = '#4ecd71'
  let bgColor     = 'rgba(4,20,8,0.92)'

  if (completed) {
    message     = '✅ Backbone removed!'
    borderColor = '#4ecd71'
    textColor   = '#4ecd71'
  } else if (dragging) {
    const draggingPiece = draggingRef.current || phase
    message = `🦴 Drag the ${draggingPiece} to the trash bin…`
  } else if (sequenceError) {
    message = phase === 'guts'
      ? '⚠️ Remove the guts first!'
      : phase === 'gills'
      ? '⚠️ Remove the gills first!'
      : '⚠️ Remove in order: guts → gills → spine'
    borderColor = '#ffaa33'
    textColor   = '#ffcc66'
    bgColor     = 'rgba(28,16,0,0.95)'
  } else if (latestError?.type === 'wrong_drop') {
    message     = '❌ Dropped outside trash! Click and drag again.'
    borderColor = '#ff5555'
    textColor   = '#ff8888'
    bgColor     = 'rgba(28,4,4,0.95)'
  } else {
    message = `🦴 Grab the glowing ${phase} and drag it to the trash bin`
  }

  return {
    fishHandlers: { hidden: true },
    waterActive:  false,

    extra3D: (
      <>
        <ForcepsTool grabbing={dragging} />
        <OrgansButterfliedFish />

        {/* Guts — must be removed first */}
        {showGuts && (
          <OrgansDragController
            key="guts"
            phaseDef={PIECES.guts}
            draggingRef={draggingRef}
            onDragStart={makeDragStart('guts')}
            snapBack={0}
          />
        )}

        {/* Gills — second; snaps back if dragged before guts */}
        {showGills && (
          <OrgansDragController
            key="gills"
            phaseDef={PIECES.gills}
            draggingRef={draggingRef}
            onDragStart={makeDragStart('gills')}
            snapBack={snapBackGills}
          />
        )}

        {/* Spine — last; snaps back if dragged before gills */}
        {showSpine && (
          <OrgansDragController
            key="spine"
            phaseDef={PIECES.spine}
            draggingRef={draggingRef}
            onDragStart={makeDragStart('spine')}
            snapBack={snapBackSpine}
          />
        )}
      </>
    ),

    domUI: (
      <>
        <style>{SHAKE_CSS}</style>

        {/* Hint panel — mirrors Step05Preview.jsx exactly */}
        <div style={{
          ...HINT_BASE,
          background: bgColor,
          border:     `2px solid ${borderColor}`,
          color:      textColor,
          animation:  sequenceError ? 'step5shake 0.35s ease' : 'none',
        }}>
          <span>{message}</span>
          {wrongDropCount > 0 && !completed && (
            <span style={{ fontSize: 12, background: '#ff555522', padding: '2px 8px', borderRadius: 20 }}>
              Wrong drops: {wrongDropCount}
            </span>
          )}
        </div>

        <TrashPanel
          dragging={dragging}
          hover={hoverPanel}
          count={discardedCount}
          total={3}
          hidden={completed}
          onPointerEnter={onPanelEnter}
          onPointerLeave={onPanelLeave}
        />

        {/* DOM drop zone — safety net for Canvas event swallowing */}
        <div
          ref={trashZoneRef}
          style={{
            position:      'absolute',
            left:          28,
            bottom:        28,
            width:         170,
            height:        170,
            pointerEvents: dragging ? 'auto' : 'none',
            zIndex:        111,
          }}
        />
      </>
    ),
  }
}
