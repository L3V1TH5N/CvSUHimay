// src/simulation/fsm/FSMProvider.jsx
import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef, useEffect } from 'react'
import { FSM_STATES, TRANSITIONS, INITIAL_STATE, STEP_TO_STATE, STATE_CONFIG } from '../config/fsmConfig'
import { STEP_DEFINITIONS, TOTAL_SCORE } from '../config/stepDefinitions'
import { logEvent } from './eventStream'
import { ERROR_CLASS, EVENT_TYPE } from './errors'
import { validateFSMIntegrity } from './validateFSM'

// ── Contexts ─────────────────────────────────────────────────────────────────
// Split into two providers so action-only consumers (e.g. components that
// just need to call setActiveTool) don't re-render every time some unrelated
// piece of state ticks (washProgress at ~10Hz, tick at 1Hz, etc.).
//   - FSMStateContext: mutable state slice — re-renders consumers on change
//   - FSMActionsContext: stable bundle of dispatch callbacks — never changes
// `useFSM()` reads both for backward compatibility.
const FSMStateContext   = createContext(null)
const FSMActionsContext = createContext(null)

// ── Proportional v2 scoring (mirrors backend/src/utils/simScoring.js) ────────
// Replaces the old threshold-based formula which was punitive for high-volume
// bone steps: a single mistake on step 7's 88 dorsal spines used to drop the
// score 25%. The new formula scales accuracy against the actual action count
// so the deduction matches the real error rate.
//
//   earned = weight × accuracy × efficiency × quality
//     accuracy   = 1 - errors / (correctActions + errors)
//     efficiency = clamp(expected / actual, 0.70, 1.0)
//     quality    = bonesRemoved / target  (steps 6/7/8/9 only; 1.0 otherwise)
//
// Keeping client and server formulas identical means the in-sim score shown
// to the student matches sim_attempts.score_percent in analytics — no
// perceived "the dashboard lied to me" gap.

// Server-authoritative expected duration per step (seconds). Must mirror the
// EXPECTED_SECONDS table in backend/src/utils/simScoring.js.
const EXPECTED_SECONDS_PER_STEP = {
  1: 60, 2: 15, 3: 10, 4: 45, 5: 40,
  6: 50, 7: 120, 8: 90, 9: 90, 10: 15, 11: 30,
}

// Bone step → target count for quality_factor. Values mirror BONE_MAX.
// Outside these steps quality_factor stays 1.0 and only accuracy/efficiency
// influence the score.
const BONE_TARGETS = { 6: 26, 7: 87, 8: 48, 9: 42 }

// Effective action volume per step for non-bone steps. Drives the denominator
// of accuracy so a fixed number of errors scales reasonably with procedure
// complexity:
//   step 1 (trim_fins, 3 fins) → 1 error = 75% accuracy
//   step 5 (single action)      → 1 error = 50% accuracy
// Steps 6/7/8/9 read their volume from state.bonesRemoved at scoring time.
const STEP_ACTION_VOLUME = {
  1: 3, 2: 1, 3: 1, 4: 1, 5: 1, 10: 1, 11: 1,
}

const EFFICIENCY_FLOOR = 0.70
const HINT_MULTIPLIER = { 0: 1.0, 1: 0.90, 2: 0.80 }

const clamp01 = (v) => Math.max(0, Math.min(1, v))

// Per-step (correctActions, qualityFactor) pair. Bone steps source both from
// the student's bonesRemoved counts; other steps fall back to the constant
// volume table with quality fixed at 1.
function deriveStepActions(stepId, bonesRemoved) {
  const boneKey = { 6: 'rib', 7: 'dorsal', 8: 'ventral', 9: 'lateral' }[stepId]
  if (boneKey) {
    const removed = bonesRemoved[boneKey] ?? 0
    return { correctActions: removed, quality: clamp01(removed / BONE_TARGETS[stepId]) }
  }
  return { correctActions: STEP_ACTION_VOLUME[stepId] ?? 1, quality: 1 }
}

function computeEarned(stepId, weight, errors, bonesRemoved, timeSpentSeconds, hintLevel = 0) {
  if (!weight) return 0

  const { correctActions, quality } = deriveStepActions(stepId, bonesRemoved)
  const totalActions = correctActions + errors
  const accuracy = clamp01(1 - errors / Math.max(totalActions, 1))

  const expected = EXPECTED_SECONDS_PER_STEP[stepId] ?? 60
  const actual = Math.max(timeSpentSeconds || 0, 1)
  const efficiency = Math.max(EFFICIENCY_FLOOR, Math.min(1.0, expected / actual))

  const base = Math.round(weight * accuracy * efficiency * quality)
  const penalty = HINT_MULTIPLIER[hintLevel] ?? 1.0
  return Math.max(0, Math.round(base * penalty))
}

// ── Bone removal upper bounds ─────────────────────────────────────────────────
// Anatomical maxima derived from stepDefinitions targetCount values.
// REMOVE_BONE uses these to cap counts and prevent corruption from double-fire bugs.
const BONE_MAX = { rib: 26, dorsal: 87, ventral: 48, lateral: 42 }

// ── Initial State ─────────────────────────────────────────────────────────────
const initialSimState = {
  fsmState: INITIAL_STATE,
  currentStep: 1,
  completedSteps: [],
  stepScores: {},         // { stepId: earnedPoints } — per-step scoring
  totalScore: 0,
  startTime: null,
  elapsedSeconds: 0,
  activeTool: null,
  fishPosition: 'sink',  // 'sink' | 'cuttingBoard'
  washProgress: 0,       // 0-100
  washHolding: false,    // true while the user holds the water button
  bonesRemoved: { rib: 0, dorsal: 0, ventral: 0, lateral: 0 },
  isCompleted: false,
  stepCompletionTime: {},
  paused: false,         // true while exit-confirm modal is open
  hintsUsed: 0,          // count of hint accesses during the session — included in POST payload
  stepHintsUsed: {},       // { [stepId]: 1 | 2 } — deepest hint level per step
  stepErrors: {},   // { stepId: errorCount } — wrong actions per step
  lastError: null,  // errorHint string from STATE_CONFIG; cleared on ADVANCE_STEP
  // Per-step start timestamps. Populated on START_SIMULATION (step 1) and on
  // every ADVANCE_STEP for the incoming step. Paired with stepCompletionTime
  // to derive time_spent_seconds in the POST /api/sim/sessions payload.
  stepStartTime: {},
  // Snapshot of washProgress captured when the wash steps complete. Step 2
  // writes first; step 10 (final_rinse) overwrites — step 10 is authoritative.
  washQualityPercent: 0,
  // Append-only log of tool switches, one entry per SET_TOOL dispatch:
  //   { stepId, tool, selectedAt }. Aggregated into sim_tool_usage rows.
  toolEvents: [],
  // sessionKey increments on every RESET. TimerTicker watches it so startSimulation
  // re-fires after an in-memory restart without a page reload.
  sessionKey: 0,
}

// ── Reducer ───────────────────────────────────────────────────────────────────
function fsmReducer(state, action) {
  switch (action.type) {

    case 'START_SIMULATION': {
      // Idempotency guard: only start if currently IDLE.
      // Prevents double-fire from React StrictMode effect re-invocation and
      // from sessionKey-triggered re-runs when the FSM is already running.
      if (state.fsmState !== INITIAL_STATE) return state
      const now = Date.now()
      return {
        ...state,
        fsmState: FSM_STATES.STEP_1_TRIM_FINS,
        currentStep: 1,
        startTime: now,
        stepStartTime: { 1: now },
      }
    }

    case 'ADVANCE_STEP': {
      const nextStep     = state.currentStep + 1
      const nextFsmState = STEP_TO_STATE[nextStep] ?? FSM_STATES.COMPLETED

      // Enforce the TRANSITIONS map before committing the state change.
      // Blocks a step hook double-fire or a race condition from corrupting currentStep.
      const allowedNext = TRANSITIONS[state.fsmState] ?? []
      if (!allowedNext.includes(nextFsmState)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[FSM] Blocked invalid transition: ${state.fsmState} → ${nextFsmState}. ` +
            `Step hook called advanceStep() while FSM was not in the expected state.`
          )
        }
        return state
      }

      const stepDef     = STEP_DEFINITIONS[state.currentStep - 1]
      const errors      = state.stepErrors[state.currentStep] ?? 0

      const now = Date.now()
      // Elapsed seconds for the step that's finishing. Drives efficiency_factor.
      // Falls back to 0 (then floored to 1 inside computeEarned) if the start
      // timestamp is somehow missing — defensive against stale state.
      const stepStartedAt   = state.stepStartTime[state.currentStep]
      const stepElapsedSecs = stepStartedAt
        ? Math.max(0, Math.round((now - stepStartedAt) / 1000))
        : 0

      const hintLevel = state.stepHintsUsed[state.currentStep] ?? 0
      const rawScore = action.score ?? computeEarned(
        state.currentStep,
        stepDef?.scoreWeight ?? 0,
        errors,
        state.bonesRemoved,
        stepElapsedSecs,
        hintLevel,
      )
      // Apply hint penalty to action.score overrides (bone steps).
      // computeEarned already applies the penalty when action.score is absent.
      const earnedScore = action.score != null
        ? Math.max(0, Math.round(rawScore * (HINT_MULTIPLIER[hintLevel] ?? 1.0)))
        : rawScore
      // Capture wash quality at the moment the wash steps finish. Step 2
      // (initial washing) writes first and step 10 (final_rinse) overwrites,
      // so the value submitted to the backend reflects the authoritative
      // final-rinse reading.
      const isWashStep = state.currentStep === 2 || state.currentStep === 10
      const nextWashQualityPercent = isWashStep
        ? Math.round(state.washProgress)
        : state.washQualityPercent

      return {
        ...state,
        fsmState: nextFsmState,
        currentStep: nextStep,
        completedSteps: [...state.completedSteps, state.currentStep],
        stepScores: { ...state.stepScores, [state.currentStep]: earnedScore },
        totalScore: state.totalScore + earnedScore,
        stepCompletionTime: { ...state.stepCompletionTime, [state.currentStep]: now },
        stepStartTime: { ...state.stepStartTime, [nextStep]: now },
        washQualityPercent: nextWashQualityPercent,
        isCompleted: nextStep > STEP_DEFINITIONS.length,
        lastError: null,
      }
    }

    case 'SET_COMPLETED': {
      // Idempotency: if the simulation has already been marked completed,
      // return the same state reference. React skips re-render; effects
      // depending on isCompleted do not re-fire.
      if (state.isCompleted) return state

      const stepId  = state.currentStep
      const stepDef = STEP_DEFINITIONS[stepId - 1]
      const errors  = state.stepErrors[stepId] ?? 0
      const now     = Date.now()

      const stepStartedAt   = state.stepStartTime[stepId]
      const stepElapsedSecs = stepStartedAt
        ? Math.max(0, Math.round((now - stepStartedAt) / 1000))
        : 0

      const hintLevel = state.stepHintsUsed[stepId] ?? 0
      const earned = computeEarned(
        stepId,
        stepDef?.scoreWeight ?? 0,
        errors,
        state.bonesRemoved,
        stepElapsedSecs,
        hintLevel,
      )

      return {
        ...state,
        fsmState:           FSM_STATES.COMPLETED,
        completedSteps:     state.completedSteps.includes(stepId)
                              ? state.completedSteps
                              : [...state.completedSteps, stepId],
        stepScores:         { ...state.stepScores, [stepId]: earned },
        totalScore:         state.totalScore + earned,
        stepCompletionTime: { ...state.stepCompletionTime, [stepId]: now },
        isCompleted:        true,
        lastError:          null,
      }
    }

    case 'SET_TOOL':
      return {
        ...state,
        activeTool: action.tool,
        toolEvents: [
          ...state.toolEvents,
          { stepId: state.currentStep, tool: action.tool, selectedAt: Date.now() },
        ],
      }

    case 'SET_WASH_HOLDING':
      return { ...state, washHolding: action.holding }

    case 'SET_FISH_POSITION':
      return { ...state, fishPosition: action.position }

    case 'UPDATE_WASH_PROGRESS':
      return { ...state, washProgress: Math.min(100, action.progress) }

    case 'REMOVE_BONE': {
      const type    = action.boneType  // 'dorsal' | 'ventral' | 'lateral'
      const current = state.bonesRemoved[type]
      const max     = BONE_MAX[type] ?? Infinity
      // Cap at anatomical maximum — ignores duplicate dispatches from click-handler bugs.
      if (current >= max) return state
      return {
        ...state,
        bonesRemoved: {
          ...state.bonesRemoved,
          [type]: current + 1,
        },
      }
    }

    case 'WRONG_ACTION': {
      const step = state.currentStep
      const cfg  = STATE_CONFIG[state.fsmState]
      return {
        ...state,
        stepErrors: {
          ...state.stepErrors,
          [step]: (state.stepErrors[step] ?? 0) + 1,
        },
        lastError: cfg?.errorHint ?? 'Incorrect action. Check the instructions.',
      }
    }

    case 'INCREMENT_HINT':
      // For legacy learning-material accesses (tip panels, info slides, videos).
      // The structured 2-level hint system uses USE_HINT instead — do not call
      // both for the same hint access or hintsUsed will be double-counted.
      return { ...state, hintsUsed: state.hintsUsed + 1 }

    case 'USE_HINT': {
      const { stepId, level } = action
      const current = state.stepHintsUsed[stepId] ?? 0
      if (level <= current) return state   // idempotent — no double-count
      return {
        ...state,
        stepHintsUsed: { ...state.stepHintsUsed, [stepId]: level },
        hintsUsed: state.hintsUsed + 1,
      }
    }

    case 'SET_PAUSED':
      return { ...state, paused: action.paused }

    case 'TICK':
      if (state.paused || state.isCompleted) return state
      return {
        ...state,
        elapsedSeconds: state.startTime
          ? Math.floor((Date.now() - state.startTime) / 1000)
          : 0,
      }

    case 'RESET':
      // Increment sessionKey so TimerTicker's useEffect([sessionKey]) re-fires
      // startSimulation() without a page reload. All other fields return to
      // initialSimState defaults.
      return { ...initialSimState, sessionKey: state.sessionKey + 1 }

    default:
      return state
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function FSMProvider({ children }) {
  const [state, dispatch] = useReducer(fsmReducer, initialSimState)

  // Ref kept in sync with state.fsmState so validateAction stays stable.
  const fsmStateRef = useRef(state.fsmState)
  useEffect(() => { fsmStateRef.current = state.fsmState }, [state.fsmState])

  // Full-state ref — used by advanceStep (MISSED_BONE check) and reportError
  // (logEvent needs currentStep) without creating closure dependencies that
  // would cause useCallback to re-create on every state tick.
  const simStateRef = useRef(state)
  useEffect(() => { simStateRef.current = state }, [state])

  // Dev-only FSM integrity check: runs once after first mount.
  useEffect(() => { validateFSMIntegrity() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startSimulation = useCallback(() => {
    dispatch({ type: 'START_SIMULATION' })
  }, [])

  // Bone step index → bone key (matches bonesRemoved shape in initialSimState).
  const BONE_STEP_KEY    = { 6: 'rib', 7: 'dorsal', 8: 'ventral', 9: 'lateral' }
  // Expected count per bone step — must match BONE_TARGETS and stepDefinitions.targetCount.
  const BONE_STEP_TARGET = { 6: 26, 7: 87, 8: 48, 9: 42 }

  const advanceStep = useCallback((score) => {
    const { currentStep, bonesRemoved } = simStateRef.current
    const boneKey    = BONE_STEP_KEY[currentStep]
    const boneTarget = BONE_STEP_TARGET[currentStep]

    // Detect MISSED_BONE before the step closes. Fires when the student advances
    // a bone removal step without reaching the anatomical target count.
    if (boneKey && boneTarget != null) {
      const removed = bonesRemoved[boneKey] ?? 0
      if (removed < boneTarget) {
        logEvent(currentStep, EVENT_TYPE.ERROR, {
          class:     ERROR_CLASS.MISSED_BONE,
          boneType:  boneKey,
          removed,
          target:    boneTarget,
          shortfall: boneTarget - removed,
        })
      }
    }

    dispatch({ type: 'ADVANCE_STEP', score })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveTool = useCallback((tool) => {
    dispatch({ type: 'SET_TOOL', tool })
  }, [])

  const setWashHolding = useCallback((holding) => {
    dispatch({ type: 'SET_WASH_HOLDING', holding })
  }, [])

  const setFishPosition = useCallback((position) => {
    dispatch({ type: 'SET_FISH_POSITION', position })
  }, [])

  const updateWashProgress = useCallback((progress) => {
    dispatch({ type: 'UPDATE_WASH_PROGRESS', progress })
  }, [])

  const removeBone = useCallback((boneType) => {
    dispatch({ type: 'REMOVE_BONE', boneType })
  }, [])

  const incrementHint = useCallback(() => {
    dispatch({ type: 'INCREMENT_HINT' })
  }, [])

  const useHint = useCallback((stepId, level) => {
    dispatch({ type: 'USE_HINT', stepId, level })
  }, [])

  const tick = useCallback(() => {
    dispatch({ type: 'TICK' })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const setCompleted = useCallback(() => {
    dispatch({ type: 'SET_COMPLETED' })
  }, [])

  const setPaused = useCallback((paused) => {
    dispatch({ type: 'SET_PAUSED', paused })
  }, [])

  // ω output function: returns true when (tool, actionType) satisfies the
  // current state's Mealy config. On mismatch, logs a structured ERROR event
  // and dispatches WRONG_ACTION (increments counter, sets lastError).
  // This is the single authoritative validation gate — step hooks should prefer
  // this over independent checks whenever both tool and action are known.
  const validateAction = useCallback((tool, actionType) => {
    const cfg = STATE_CONFIG[fsmStateRef.current]
    if (!cfg) return true

    const toolOk   = cfg.validTool === null || cfg.validTool === tool
    const actionOk = cfg.validAction === actionType
    const ok       = toolOk && actionOk

    if (!ok) {
      logEvent(simStateRef.current.currentStep, EVENT_TYPE.ERROR, {
        class:          ERROR_CLASS.WRONG_CUT_PATH,
        reason:         !toolOk ? 'wrong_tool' : 'wrong_action',
        activeTool:     tool,
        expectedTool:   cfg.validTool,
        activeAction:   actionType,
        expectedAction: cfg.validAction,
        fsmState:       fsmStateRef.current,
        output:         cfg.outputs?.onFail,
      })
      dispatch({ type: 'WRONG_ACTION' })
    }

    return ok
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Direct error report — call when the step hook detects a wrong action that
  // is not caught by validateAction (e.g. wrong sequence, insufficient drag).
  // Pass an errorPayload with { class: ERROR_CLASS.*, reason, ...context } to
  // emit a structured analytics event before the WRONG_ACTION dispatch.
  // Calling with no argument is still valid (backward-compatible bare call).
  const reportError = useCallback((errorPayload) => {
    if (errorPayload && typeof errorPayload === 'object') {
      logEvent(simStateRef.current.currentStep, EVENT_TYPE.ERROR, errorPayload)
    }
    dispatch({ type: 'WRONG_ACTION' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const currentStepDef = STEP_DEFINITIONS[state.currentStep - 1] ?? null

  // Actions bundle — every callback is useCallback([], …) so identities are
  // stable across renders. useMemo([]) seals the bundle's identity so any
  // component reading FSMActionsContext via useFSMActions() never re-renders
  // due to an FSM state change.
  const actionsValue = useMemo(() => ({
    startSimulation,
    advanceStep,
    setCompleted,
    setActiveTool,
    setWashHolding,
    setFishPosition,
    updateWashProgress,
    removeBone,
    incrementHint,
    useHint,
    tick,
    reset,
    setPaused,
    validateAction,
    reportError,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // State value — identity changes whenever the reducer state changes, which
  // is the desired re-render trigger for state consumers.
  const stateValue = useMemo(() => ({
    ...state,
    currentStepDef,
    totalPossibleScore: TOTAL_SCORE,
    // scorePercent is always a 0-100 integer percentage — this is the canonical
    // "score" value that must be submitted to the backend (not raw totalScore).
    // The mastery threshold (>= 90) in Simulations.jsx applies to this value.
    scorePercent: Math.round((state.totalScore / TOTAL_SCORE) * 100),
  }), [state, currentStepDef])

  return (
    <FSMActionsContext.Provider value={actionsValue}>
      <FSMStateContext.Provider value={stateValue}>
        {children}
      </FSMStateContext.Provider>
    </FSMActionsContext.Provider>
  )
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

// Backward-compatible hook — merges state + actions. Consumers re-render on
// every FSM state change. Use this when you need both.
export function useFSM() {
  const stateCtx   = useContext(FSMStateContext)
  const actionsCtx = useContext(FSMActionsContext)
  if (!stateCtx || !actionsCtx) {
    throw new Error('useFSM must be used inside <FSMProvider>')
  }
  return { ...stateCtx, ...actionsCtx }
}

// Actions-only hook. Identity of the returned object is stable for the
// provider's lifetime, so subscribing components never re-render due to FSM
// state changes. Use this in components that only dispatch (no state read).
// Example: a button that calls setActiveTool('water') on click.
export function useFSMActions() {
  const ctx = useContext(FSMActionsContext)
  if (!ctx) throw new Error('useFSMActions must be used inside <FSMProvider>')
  return ctx
}

// State-only hook. Re-renders on FSM state changes but skips the per-render
// merge cost of useFSM(). Use this in components that only read state.
export function useFSMState() {
  const ctx = useContext(FSMStateContext)
  if (!ctx) throw new Error('useFSMState must be used inside <FSMProvider>')
  return ctx
}
