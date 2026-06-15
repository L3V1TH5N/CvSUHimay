// src/simulation/components/steps/Step01TrimFins/useTrimFinsStep.jsx
// ── STEP 1: TRIM FINS — orchestrator hook ────────────────────────────────────
// Mirrors Step01Preview.jsx interaction-for-interaction, but composed into the
// shared simulation Canvas via the {extra3D, domUI} return shape used by every
// other step hook. The actual fish + fins + knife + cutting sensor render
// inside extra3D; the parent SimulationScene hides the default FishModel for
// step 1 so this Step-1 fish is the only one visible.
//
// Pipeline ── identical interaction flow to the preview:
//   1. Pointer near a fin's line  ─→ CuttingSensor locks on, line turns yellow
//   2. Drag end-to-end             ─→ FinIncision slit grows along the line
//   3. Coverage hits both ends     ─→ that fin marked cut, indicator hides
//   4. All five cuts complete      ─→ transitionRef flips:
//        - FishTransition cross-fades bangus3 → BangusCUTTEDFIN over 0.8 s
//        - FinReveal pulses fin GLBs in a sin bell-curve (lazy-mounted)
//   5. Flash panel (300 ms) → done state (600 ms more) → advanceStep()

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

import { useFSMActions } from '../../../fsm/FSMProvider'
import { useStepToolVisible } from '../../../fsm/useStepToolVisible'
import { useWrongToolGate }   from '../../../fsm/useWrongToolGate'
import { logEvent }      from '../../../fsm/eventStream'
import { EVENT_TYPE, ERROR_CLASS } from '../../../fsm/errors'

import { FINS, CUT_ORDER } from './step01Config'
import { FishTransition } from './FishTransition'
import { KnifeTool }      from './KnifeTool'
import { FinIndicator }   from './FinIndicators'
import { FinReveal }      from './FinReveal'
import { CuttingSensor }  from './CuttingSensor'
import { FishMeshPrewarmer } from '../../fish/FishMeshPrewarmer'

const STEP_ID = 1

// Build per-fin ref maps that survive across renders but reset on activation.
function makeCutRefs()   { return Object.fromEntries(FINS.map((f) => [f.id, { current: false }])) }
function makeCoverages() { return Object.fromEntries(FINS.map((f) => [f.id, { fromT: 0, toT: 0 }])) }

export function useTrimFinsStep(active, onComplete) {
  const { setActiveTool, reportError } = useFSMActions()
  const toolVisible = useStepToolVisible()
  const checkTool   = useWrongToolGate()

  // ── Cut state (UI + completion tracking) ─────────────────────────────────
  const [trimmed,         setTrimmed]         = useState(() => new Set())
  const [flash,           setFlash]           = useState(false)
  const [done,            setDone]            = useState(false)
  const [allCutsComplete, setAllCutsComplete] = useState(false)
  const [wrongOrder,      setWrongOrder]      = useState(null) // { attemptedLabel, expectedLabel }
  const wrongOrderTimerRef = useRef(null)

  // ── Refs shared between extra3D children ─────────────────────────────────
  const doneRef           = useRef(false)
  const trimmedCountRef   = useRef(0)
  const transitionRef     = useRef(false)               // flips on completion
  const transitionDoneRef = useRef(false)               // flips when cross-fade ends
  const cutRefs           = useRef(makeCutRefs())       // per-fin "is cut"
  const coverages         = useRef(makeCoverages())     // per-fin drag span
  const activeFinIdRef    = useRef(null)                // currently-locked fin
  const activeCutPointRef = useRef(new THREE.Vector3())// knife tip world target

  // ── Reset everything on (re)activation ───────────────────────────────────
  // Wipes state + refs so a fresh attempt after restart begins clean.
  useEffect(() => {
    if (!active) return
    setTrimmed(new Set())
    setFlash(false)
    setDone(false)
    setAllCutsComplete(false)
    setWrongOrder(null)
    clearTimeout(wrongOrderTimerRef.current)
    doneRef.current           = false
    trimmedCountRef.current   = 0
    transitionRef.current     = false
    transitionDoneRef.current = false
    activeFinIdRef.current    = null
    activeCutPointRef.current.set(0, 0, 0)
    for (const fin of FINS) {
      cutRefs.current[fin.id].current = false
      coverages.current[fin.id].fromT = 0
      coverages.current[fin.id].toT   = 0
    }
  }, [active])

  // ── FSM tool + state-enter / state-exit logging ──────────────────────────
  useEffect(() => {
    if (!active) return
    setActiveTool('knife')
    logEvent(STEP_ID, EVENT_TYPE.STATE_ENTER, { phase: 'trim_fins' })
    return () => {
      setActiveTool(null)
      logEvent(STEP_ID, EVENT_TYPE.STATE_EXIT, {
        phase: 'trim_fins', totalCut: trimmedCountRef.current,
      })
    }
  }, [active, setActiveTool])

  // ── Stable cut handler ──────────────────────────────────────────────────
  // Called by CuttingSensor with finIndex when a fin's drag-span completes.
  const handleCut = useCallback((id) => {
    if (doneRef.current) return
    setTrimmed((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // ── Wrong-order error handler ────────────────────────────────────────────
  // Called by CuttingSensor when the student tries to cut a fin out of sequence.
  // Auto-clears the error message after 2 s so it doesn't linger.
  const handleWrongOrder = useCallback((attemptedId) => {
    const attemptedLabel = FINS.find((f) => f.id === attemptedId)?.label ?? 'Unknown'
    const nextId         = CUT_ORDER[trimmedCountRef.current]
    const expectedLabel  = FINS.find((f) => f.id === nextId)?.label ?? 'Unknown'
    // Structured error — logged to analytics stream and counted in FSM error state.
    reportError({
      class:         ERROR_CLASS.WRONG_CUT_PATH,
      reason:        'wrong_sequence',
      attemptedFin:  attemptedId,
      expectedFin:   nextId,
      attemptedLabel,
      expectedLabel,
    })
    clearTimeout(wrongOrderTimerRef.current)
    setWrongOrder({ attemptedLabel, expectedLabel })
    wrongOrderTimerRef.current = setTimeout(() => setWrongOrder(null), 2000)
  }, [reportError])

  // ── Side effects after `trimmed` updates ────────────────────────────────
  // (1) flips per-fin cutRefs so FinGlow hides each indicator on cut.
  // (2) on the final cut: arms transitionRef → FishTransition + FinReveal
  //     run their single-beat animation, then we advance the FSM.
  useEffect(() => {
    // Sync per-fin cutRefs so FinGlow hides each indicator on cut.
    for (const id of trimmed) cutRefs.current[id].current = true
    trimmedCountRef.current = trimmed.size

    let t1, t2, t3
    if (trimmed.size >= FINS.length && !doneRef.current) {
      doneRef.current = true
      transitionRef.current = true                // synchronous flip
      setAllCutsComplete(true)                    // mounts <FinReveal>

      t1 = setTimeout(() => {
        setFlash(true)
        t2 = setTimeout(() => {
          setFlash(false); setDone(true)
          // ── CUT COMPLETION TRIGGER → advance FSM ─────────────────────
          // 850 ms after the green flash so the FSM dispatch lands AFTER
          // FishTransition's 800 ms cross-fade has settled (TRANSITION_DURATION
          // in fishConfig.js). Without this stagger, advanceStep fired while
          // both bangus3 and BangusCUTTEDFIN were still being drawn — the
          // re-render storm overlapped a 2-3-fish-mesh window and dropped
          // frames on the hand-off.
          t3 = setTimeout(() => onComplete?.(), 850)
        }, 600)
      }, 300)
    }
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [trimmed, onComplete])

  if (!active) {
    return { fishHandlers: {}, waterActive: false, extra3D: null, domUI: null, hideFishModel: false }
  }

  const count         = trimmed.size
  const allDone       = done || flash
  // Next fin the student must cut — null when all done.
  const expectedFinId = allDone ? null : (CUT_ORDER.find((id) => !trimmed.has(id)) ?? null)

  const borderColor = wrongOrder    ? 'rgba(255,80,80,0.85)'
                    : allDone       ? 'rgba(78,205,113,0.9)'
                    : count > 0     ? 'rgba(78,205,113,0.8)'
                    :                 'rgba(78,205,113,0.35)'

  const message = allDone   ? '✅ All fins trimmed!'
                : count > 0 ? `🔪 Trimming… (${count}/${FINS.length})`
                :             '🔪 Cut fins in order — follow the sequence below'

  return {
    fishHandlers: {},
    waterActive:  false,
    // Signals SimulationScene to hide the default FishModel so the Step-1
    // bangus3 model rendered inside FishTransition is the only one visible.
    hideFishModel: true,

    // ── 3D content — copied scene composition from Step01Preview ─────────
    extra3D: (
      <>
        {/* Pre-warm the bangus_fish mesh-list cache while the user is busy
            cutting fins, so Step 2's WashCursorTracker + FishMaterialEffect
            skip a per-component first-frame DFS at the hand-off boundary. */}
        <FishMeshPrewarmer />
        <FishTransition
          transitionRef={transitionRef}
          transitionDoneRef={transitionDoneRef}
        />
        {/* GAMEPLAY PHASE: fin GLBs hidden — only FinGlow indicators + FinIncision slits visible */}
        {FINS.map((f) => (
          <FinIndicator
            key={f.id}
            fin={f}
            cutRef={cutRefs.current[f.id]}
            activeFinIdRef={activeFinIdRef}
            transitionRef={transitionRef}
            transitionDoneRef={transitionDoneRef}
            coverageRef={coverages.current[f.id]}
          />
        ))}
        {/* COMPLETION: lazy-mount fin GLBs inside their own Suspense so loading
            never suspends the rest of the scene. */}
        {allCutsComplete && (
          <Suspense fallback={null}>
            <FinReveal transitionRef={transitionRef} />
          </Suspense>
        )}
        <CuttingSensor
          trimmed={trimmed}
          coverages={coverages.current}
          activeFinIdRef={activeFinIdRef}
          activeCutPointRef={activeCutPointRef}
          onCut={handleCut}
          expectedFinId={expectedFinId}
          onWrongOrder={handleWrongOrder}
          checkTool={checkTool}
        />
        {toolVisible && (
          <KnifeTool
            activeFinIdRef={activeFinIdRef}
            activeCutPointRef={activeCutPointRef}
          />
        )}
      </>
    ),

    // ── DOM HUD — progress panel mirroring the preview's layout ──────────
    domUI: (
      <div style={{
        position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
        borderRadius: 16, padding: '12px 28px', minWidth: 240,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        transition: 'background 0.3s, border-color 0.3s',
        backdropFilter: 'blur(8px)', zIndex: 101, pointerEvents: 'none',
        background:   flash ? 'rgba(10,60,20,0.97)' : 'rgba(4,20,8,0.92)',
        border:       `2px solid ${borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
          <span style={{
            color: allDone ? '#4ecd71' : count > 0 ? '#4ecd71' : '#8aab90',
            fontWeight: 700, fontSize: 14,
            fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.05em',
          }}>
            {message}
          </span>
        </div>

        {!allDone && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {CUT_ORDER.map((id, idx) => {
              const f          = FINS.find((fin) => fin.id === id)
              const cut        = trimmed.has(id)
              const isNext     = id === expectedFinId
              const stepNum    = idx + 1

              const bg     = cut     ? 'rgba(78,205,113,0.25)'
                           : isNext  ? 'rgba(255,210,60,0.18)'
                           :           'rgba(255,255,255,0.04)'
              const border = cut     ? '1px solid rgba(78,205,113,0.6)'
                           : isNext  ? '1px solid rgba(255,210,60,0.75)'
                           :           '1px solid rgba(255,255,255,0.08)'
              const color  = cut     ? '#4ecd71'
                           : isNext  ? '#ffd23c'
                           :           '#555e58'
              const icon   = cut     ? '✅' : isNext ? '🔪' : `${stepNum}.`

              return (
                <div key={id} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11,
                  fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
                  background: bg, border, color, transition: 'all 0.25s',
                }}>
                  {icon} {f.label}
                </div>
              )
            })}
          </div>
        )}

        {/* Wrong-order error — fades out automatically after 2 s */}
        {wrongOrder && (
          <div style={{
            color: '#ff6b6b', fontSize: 11,
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
            letterSpacing: '0.04em', textAlign: 'center',
            animation: 'none',
          }}>
            ❌ Cut {wrongOrder.expectedLabel} first!
          </div>
        )}
      </div>
    ),
  }
}
