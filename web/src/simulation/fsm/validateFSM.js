// src/simulation/fsm/validateFSM.js
// Dev-only FSM integrity checker. Call once at startup (inside FSMProvider's
// useEffect) to catch config mismatches before they silently corrupt gameplay.
//
// Checks:
//   1. Every TRANSITIONS target is a known FSM_STATE.
//   2. Every STATE_CONFIG key is a known FSM_STATE.
//   3. Every STATE_CONFIG.validAction is a known FSM_INPUTS value.
//   4. Every STATE_CONFIG.outputs.onSuccess/onFail is a known FSM_OUTPUTS value.
//   5. No FSM_STATE (except IDLE and COMPLETED) is orphaned from STATE_CONFIG.
//   6. All TRANSITIONS values are arrays (not accidentally undefined).
//
// All failures are console.error'd with actionable messages so the developer
// knows exactly which constant is wrong and in which state it appears.

import { FSM_STATES, FSM_INPUTS, FSM_OUTPUTS, TRANSITIONS, STATE_CONFIG } from '../config/fsmConfig'

const KNOWN_STATES  = new Set(Object.values(FSM_STATES))
const KNOWN_INPUTS  = new Set(Object.values(FSM_INPUTS))
const KNOWN_OUTPUTS = new Set(Object.values(FSM_OUTPUTS))

// States that intentionally have no STATE_CONFIG entry (they are control states,
// not procedural steps that require tool/action validation).
const CONTROL_STATES = new Set([FSM_STATES.IDLE, FSM_STATES.COMPLETED])

export function validateFSMIntegrity() {
  if (process.env.NODE_ENV === 'production') return

  const errors = []

  // ── Rule 1: Every TRANSITIONS target must be a known FSM_STATE ──────────────
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    if (!KNOWN_STATES.has(from)) {
      errors.push(`TRANSITIONS key "${from}" is not in FSM_STATES.`)
    }
    if (!Array.isArray(targets)) {
      errors.push(`TRANSITIONS["${from}"] must be an array, got ${typeof targets}.`)
      continue
    }
    for (const to of targets) {
      if (!KNOWN_STATES.has(to)) {
        errors.push(`TRANSITIONS["${from}"] references unknown state "${to}".`)
      }
    }
  }

  // ── Rule 2: Every STATE_CONFIG key must be a known FSM_STATE ────────────────
  for (const key of Object.keys(STATE_CONFIG)) {
    if (!KNOWN_STATES.has(key)) {
      errors.push(`STATE_CONFIG key "${key}" is not in FSM_STATES.`)
    }
  }

  // ── Rule 3 & 4: Per-state config integrity ───────────────────────────────────
  for (const [state, cfg] of Object.entries(STATE_CONFIG)) {
    // validAction must reference an FSM_INPUTS constant
    if (!KNOWN_INPUTS.has(cfg.validAction)) {
      errors.push(
        `STATE_CONFIG["${state}"].validAction "${cfg.validAction}" is not in FSM_INPUTS. ` +
        `Use FSM_INPUTS.* constants, never raw strings.`
      )
    }

    // outputs block must exist
    if (!cfg.outputs || typeof cfg.outputs !== 'object') {
      errors.push(`STATE_CONFIG["${state}"] is missing an "outputs" object.`)
      continue
    }

    if (!KNOWN_OUTPUTS.has(cfg.outputs.onSuccess)) {
      errors.push(
        `STATE_CONFIG["${state}"].outputs.onSuccess "${cfg.outputs.onSuccess}" is not in FSM_OUTPUTS.`
      )
    }
    if (!KNOWN_OUTPUTS.has(cfg.outputs.onFail)) {
      errors.push(
        `STATE_CONFIG["${state}"].outputs.onFail "${cfg.outputs.onFail}" is not in FSM_OUTPUTS.`
      )
    }

    // errorHint must be a non-empty string
    if (typeof cfg.errorHint !== 'string' || cfg.errorHint.trim() === '') {
      errors.push(`STATE_CONFIG["${state}"].errorHint must be a non-empty string.`)
    }
  }

  // ── Rule 5: No procedural state should be missing from STATE_CONFIG ──────────
  for (const state of Object.values(FSM_STATES)) {
    if (CONTROL_STATES.has(state)) continue
    if (!STATE_CONFIG[state]) {
      errors.push(
        `FSM_STATE "${state}" has no STATE_CONFIG entry. ` +
        `Add it or move it to CONTROL_STATES if it needs no validation.`
      )
    }
  }

  // ── Rule 6: Every procedural state must have a TRANSITIONS entry ─────────────
  for (const state of Object.values(FSM_STATES)) {
    if (!(state in TRANSITIONS)) {
      errors.push(`FSM_STATE "${state}" has no entry in TRANSITIONS.`)
    }
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  if (errors.length === 0) {
    console.log('[FSM] Integrity check passed — all states, inputs, and outputs are consistent.')
    return
  }

  console.group(`[FSM] ⚠️ Integrity check found ${errors.length} error(s):`)
  for (const msg of errors) console.error('[FSM]', msg)
  console.groupEnd()
}
