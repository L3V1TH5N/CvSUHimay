// src/simulation/fsm/errors.js
// Vocabulary for the FSM output function ω. All scoring and feedback code
// MUST use these constants so analytics bucket correctly.
//
// Taxonomy from the thesis (Chapter on FSM error classes):
//   • WRONG_CUT_PATH      — gesture outside the step's spatial/orientational tolerance
//   • EXCESS_FLESH_DAMAGE — removed/affected region exceeds the allowed extent
//   • MISSED_BONE         — detected at end-of-session; required extraction skipped

export const ERROR_CLASS = Object.freeze({
  WRONG_CUT_PATH:       'wrong_cut_path',
  EXCESS_FLESH_DAMAGE:  'excess_flesh_damage',
  MISSED_BONE:          'missed_bone',
})

// Event types on the append-only stream. Kept deliberately small — add new
// entries only when a genuinely new signal needs its own aggregation bucket.
export const EVENT_TYPE = Object.freeze({
  STATE_ENTER:    'state_enter',
  STATE_EXIT:     'state_exit',
  GESTURE_START:  'gesture_start',
  GESTURE_END:    'gesture_end',
  PROGRESS:       'progress',
  ERROR:          'error',
  HINT_ACCESS:    'hint_access',
  // Step-boundary cinematic hand-off. Begin fires when the inter-step animation
  // starts; End fires when the fish settles at the destination. Captured so
  // the analytics dashboard can flag transitions that ran long (perceived-
  // smoothness defect) and measure each boundary independently.
  STEP_TRANSITION_BEGIN: 'step_transition_begin',
  STEP_TRANSITION_END:   'step_transition_end',
})
