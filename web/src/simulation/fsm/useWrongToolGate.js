// src/simulation/fsm/useWrongToolGate.js
// Returns checkTool() — call at the START of any fish-interaction handler.
//
// Returns true  → activeTool satisfies the current FSM state's validTool
//                 requirement (or no tool is required). Caller may proceed.
// Returns false → wrong tool is active; a structured ERROR event is logged,
//                 WRONG_ACTION is dispatched, and the caller must bail out.
//
// The required tool is sourced from STATE_CONFIG[currentFsmState].validTool
// (single source of truth — never a hardcoded string at the call site).
// Only fire checkTool() on the INITIAL interaction start, not on every
// pointermove, to avoid error-spamming at 60 Hz.

import { useRef, useCallback } from 'react'
import { STATE_CONFIG } from '../config/fsmConfig'
import { ERROR_CLASS } from './errors'
import { useFSMActions, useFSMState } from './FSMProvider'

export function useWrongToolGate() {
  const { reportError }           = useFSMActions()
  const { activeTool, fsmState }  = useFSMState()

  // Refs keep checkTool's identity stable across FSM state changes that are
  // unrelated to the active tool or the current step. Both are updated
  // synchronously during render so the ref is always current when checkTool fires.
  const activeToolRef = useRef(activeTool)
  const fsmStateRef   = useRef(fsmState)
  activeToolRef.current = activeTool
  fsmStateRef.current   = fsmState

  return useCallback(() => {
    const cfg      = STATE_CONFIG[fsmStateRef.current]
    const required = cfg?.validTool ?? null

    // No tool restriction for this state, or the user has no active tool → pass.
    if (required === null || activeToolRef.current === null) return true

    // Correct tool → pass.
    if (activeToolRef.current === required) return true

    // Wrong tool — log a structured event then dispatch WRONG_ACTION.
    reportError({
      class:        ERROR_CLASS.WRONG_CUT_PATH,
      reason:       'wrong_tool',
      activeTool:   activeToolRef.current,
      expectedTool: required,
      fsmState:     fsmStateRef.current,
    })
    return false
  }, [reportError])
}
