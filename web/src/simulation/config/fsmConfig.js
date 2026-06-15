// src/simulation/config/fsmConfig.js
// Single source of truth for the Mealy FSM tuple M = (Q, Σ, Γ, δ, ω, q₀).
//
// Q  → FSM_STATES
// Σ  → FSM_INPUTS
// Γ  → FSM_OUTPUTS
// δ  → TRANSITIONS
// ω  → STATE_CONFIG (validTool + validAction + outputs)
// q₀ → INITIAL_STATE

// ──  StateQ: set ──────────────────────────────────────────────────────────────
export const FSM_STATES = {
  IDLE:                 'IDLE',
  STEP_1_TRIM_FINS:     'STEP_1_TRIM_FINS',
  STEP_2_WASHING:       'STEP_2_WASHING',
  STEP_3_PLACE:         'STEP_3_PLACE',
  STEP_4_DORSAL_SPLIT:  'STEP_4_DORSAL_SPLIT',
  STEP_5_ORGANS:        'STEP_5_ORGANS',
  STEP_6_BACKBONE:      'STEP_6_BACKBONE',
  STEP_7_DORSAL_BONES:  'STEP_7_DORSAL_BONES',
  STEP_8_VENTRAL_BONES: 'STEP_8_VENTRAL_BONES',
  STEP_9_LATERAL_BONES: 'STEP_9_LATERAL_BONES',
  STEP_10_RINSE:        'STEP_10_RINSE',
  STEP_11_INSPECT:      'STEP_11_INSPECT',
  COMPLETED:            'COMPLETED',
}

// ── Σ: Input alphabet ─────────────────────────────────────────────────────────
// All valid action type strings in one place. Step hooks and STATE_CONFIG
// reference these constants — never raw strings — so typos fail at import time.
export const FSM_INPUTS = {
  TRIM_DRAG:     'trim_drag',
  WASH_HOLD:     'wash_hold',
  DRAG_TO_BOARD: 'drag_to_board',
  DORSAL_DRAG:   'dorsal_drag',
  ORGAN_REMOVE:  'organ_remove',
  BONE_CLICK:    'bone_click',
  ZONE_CLICK:    'zone_click',
}

// ── Γ: Output alphabet ────────────────────────────────────────────────────────
// Formal output commands the FSM produces on each (state, input) pair.
// The renderer reads these to decide which visual effect to execute.
// Using constants prevents string drift between FSM config and rendering code.
export const FSM_OUTPUTS = {
  // Success outputs — ω(q, valid σ)
  REVEAL_FIN_REMOVAL:      'reveal_fin_removal',
  ADVANCE_WASH_PROGRESS:   'advance_wash_progress',
  PLACE_FISH_ON_BOARD:     'place_fish_on_board',
  REVEAL_BUTTERFLIED:      'reveal_butterflied',
  REVEAL_ORGANS_REMOVED:   'reveal_organs_removed',
  REVEAL_BACKBONE_REMOVED: 'reveal_backbone_removed',
  REVEAL_BONE_REMOVED:     'reveal_bone_removed',
  ADVANCE_RINSE_PROGRESS:  'advance_rinse_progress',
  COMPLETE_INSPECTION:     'complete_inspection',
  // Failure outputs — ω(q, invalid σ)
  SHOW_WRONG_TOOL:         'show_wrong_tool',
  SHOW_WRONG_ACTION:       'show_wrong_action',
  SHOW_WRONG_ORDER:        'show_wrong_order',
}

// ── Step index → FSM state ────────────────────────────────────────────────────
export const STEP_TO_STATE = {
  1:  FSM_STATES.STEP_1_TRIM_FINS,
  2:  FSM_STATES.STEP_2_WASHING,
  3:  FSM_STATES.STEP_3_PLACE,
  4:  FSM_STATES.STEP_4_DORSAL_SPLIT,
  5:  FSM_STATES.STEP_5_ORGANS,
  6:  FSM_STATES.STEP_6_BACKBONE,
  7:  FSM_STATES.STEP_7_DORSAL_BONES,
  8:  FSM_STATES.STEP_8_VENTRAL_BONES,
  9:  FSM_STATES.STEP_9_LATERAL_BONES,
  10: FSM_STATES.STEP_10_RINSE,
  11: FSM_STATES.STEP_11_INSPECT,
}

// ── δ: Transition function ────────────────────────────────────────────────────
// Linear forward-only pipeline: δ(q) → [q′] on valid input.
// The input alphabet σ gates whether the transition fires; it does not select
// among multiple successors (each state has exactly one allowed next state).
// ADVANCE_STEP validates against this map before committing any state change.
export const TRANSITIONS = {
  [FSM_STATES.IDLE]:                 [FSM_STATES.STEP_1_TRIM_FINS],
  [FSM_STATES.STEP_1_TRIM_FINS]:     [FSM_STATES.STEP_2_WASHING],
  [FSM_STATES.STEP_2_WASHING]:       [FSM_STATES.STEP_3_PLACE],
  [FSM_STATES.STEP_3_PLACE]:         [FSM_STATES.STEP_4_DORSAL_SPLIT],
  [FSM_STATES.STEP_4_DORSAL_SPLIT]:  [FSM_STATES.STEP_5_ORGANS],
  [FSM_STATES.STEP_5_ORGANS]:        [FSM_STATES.STEP_6_BACKBONE],
  [FSM_STATES.STEP_6_BACKBONE]:      [FSM_STATES.STEP_7_DORSAL_BONES],
  [FSM_STATES.STEP_7_DORSAL_BONES]:  [FSM_STATES.STEP_8_VENTRAL_BONES],
  [FSM_STATES.STEP_8_VENTRAL_BONES]: [FSM_STATES.STEP_9_LATERAL_BONES],
  [FSM_STATES.STEP_9_LATERAL_BONES]: [FSM_STATES.STEP_10_RINSE],
  [FSM_STATES.STEP_10_RINSE]:        [FSM_STATES.STEP_11_INSPECT],
  [FSM_STATES.STEP_11_INSPECT]:      [FSM_STATES.COMPLETED],
  [FSM_STATES.COMPLETED]:            [],
}

// ── ω: Output function config — ω: Q × Σ → Γ ─────────────────────────────────
// Each entry is the formal Mealy output specification for one state.
//
//   validTool   — required active tool key, or null if no tool restriction
//   validAction — FSM_INPUTS constant the step hook reports for a correct action
//   errorHint   — lastError string set in FSM state on a WRONG_ACTION dispatch
//   outputs     — explicit Γ declarations:
//                   onSuccess: FSM_OUTPUTS command produced by ω(q, valid σ)
//                   onFail:    FSM_OUTPUTS command produced by ω(q, invalid σ)
//
// The renderer (step hooks + 3D scene) reads outputs.onSuccess / outputs.onFail
// to decide which visual effect to execute — keeping render decisions out of
// the FSM core and the FSM config out of the renderer.
export const STATE_CONFIG = {
  [FSM_STATES.STEP_1_TRIM_FINS]: {
    validTool:   'knife',
    validAction: FSM_INPUTS.TRIM_DRAG,
    errorHint:   'Use the knife to cut around the base of each fin in order.',
    outputs: {
      onSuccess: FSM_OUTPUTS.REVEAL_FIN_REMOVAL,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  [FSM_STATES.STEP_2_WASHING]: {
    validTool:   'water',
    validAction: FSM_INPUTS.WASH_HOLD,
    errorHint:   'Hold the fish under the running faucet to wash it.',
    outputs: {
      onSuccess: FSM_OUTPUTS.ADVANCE_WASH_PROGRESS,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  [FSM_STATES.STEP_3_PLACE]: {
    validTool:   null,
    validAction: FSM_INPUTS.DRAG_TO_BOARD,
    errorHint:   'Click and drag the fish onto the cutting board.',
    outputs: {
      onSuccess: FSM_OUTPUTS.PLACE_FISH_ON_BOARD,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_ACTION,
    },
  },
  [FSM_STATES.STEP_4_DORSAL_SPLIT]: {
    validTool:   'knife',
    validAction: FSM_INPUTS.DORSAL_DRAG,
    errorHint:   'Select the knife. Drag from the tail to the head along the backbone.',
    outputs: {
      onSuccess: FSM_OUTPUTS.REVEAL_BUTTERFLIED,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  [FSM_STATES.STEP_5_ORGANS]: {
    validTool:   'forceps',
    validAction: FSM_INPUTS.ORGAN_REMOVE,
    errorHint:   'Use the forceps to pull out the gills and internal organs.',
    outputs: {
      onSuccess: FSM_OUTPUTS.REVEAL_ORGANS_REMOVED,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  // Step 6 uses forceps + bone_click (drag-to-discard rib bones).
  // The old config incorrectly listed knife + backbone_cut — fixed here to
  // match useRibBoneStep and stepDefinitions which both specify forceps.
  [FSM_STATES.STEP_6_BACKBONE]: {
    validTool:   'forceps',
    validAction: FSM_INPUTS.BONE_CLICK,
    errorHint:   'Use the forceps. Grab each glowing rib bone and pull it away from the fish.',
    outputs: {
      onSuccess: FSM_OUTPUTS.REVEAL_BACKBONE_REMOVED,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  [FSM_STATES.STEP_7_DORSAL_BONES]: {
    validTool:   'forceps',
    validAction: FSM_INPUTS.BONE_CLICK,
    errorHint:   'Use the forceps. Grab a glowing dorsal spine and pull it away.',
    outputs: {
      onSuccess: FSM_OUTPUTS.REVEAL_BONE_REMOVED,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  [FSM_STATES.STEP_8_VENTRAL_BONES]: {
    validTool:   'forceps',
    validAction: FSM_INPUTS.BONE_CLICK,
    errorHint:   'Use the forceps. Click each highlighted ventral spine to remove it.',
    outputs: {
      onSuccess: FSM_OUTPUTS.REVEAL_BONE_REMOVED,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  [FSM_STATES.STEP_9_LATERAL_BONES]: {
    validTool:   'forceps',
    validAction: FSM_INPUTS.BONE_CLICK,
    errorHint:   'Use the forceps. Click each Y-shaped lateral spine along the lateral line.',
    outputs: {
      onSuccess: FSM_OUTPUTS.REVEAL_BONE_REMOVED,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  [FSM_STATES.STEP_10_RINSE]: {
    validTool:   'water',
    validAction: FSM_INPUTS.WASH_HOLD,
    errorHint:   'Carry the fish to the sink and rinse it under running water.',
    outputs: {
      onSuccess: FSM_OUTPUTS.ADVANCE_RINSE_PROGRESS,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_TOOL,
    },
  },
  [FSM_STATES.STEP_11_INSPECT]: {
    validTool:   null,
    validAction: FSM_INPUTS.ZONE_CLICK,
    errorHint:   'Click each highlighted inspection zone on the fish.',
    outputs: {
      onSuccess: FSM_OUTPUTS.COMPLETE_INSPECTION,
      onFail:    FSM_OUTPUTS.SHOW_WRONG_ACTION,
    },
  },
}

export const INITIAL_STATE = FSM_STATES.IDLE
