// src/simulation/fsm/eventStream.js
// Append-only event log per the thesis FSM spec.
// Each event: { timestamp, stepId, eventType, payload, geometricTrace }.
//
// Source of truth for the analytics dashboard:
//   • avg time per FSM state           (state_enter / state_exit pairs)
//   • count of incorrect actions       (event_type === 'error', bucketed by class)
//   • count of learning-material accesses (event_type === 'hint_access')
//
// Lives in memory only for the current session — to be flushed to the
// `attempts` table on session end. NEVER mutate / pop / overwrite past events.

const events    = []
const listeners = new Set()

// One-line append. Geometric trace lives inside payload but is also surfaced
// at the top level so analytics consumers don't have to reach into the payload.
export function logEvent(stepId, eventType, payload = {}) {
  const event = {
    timestamp:      Date.now(),
    stepId,
    eventType,
    payload,
    geometricTrace: payload.geometricTrace ?? null,
  }
  events.push(event)
  listeners.forEach((fn) => fn(event))
}

// Read a snapshot — copy so callers can't accidentally mutate the log.
export function getEvents() {
  return events.slice()
}

// End-of-session reset. Call from the FSM provider on a new attempt.
export function clearEvents() {
  events.length = 0
}

// Snapshot + clear, returned in one call. Used by the session submitter to
// hand the full event stream to POST /api/sim/sessions, then wipe in-memory
// state so the next attempt starts clean.
export function flushEvents() {
  const snapshot = events.slice()
  events.length = 0
  return snapshot
}

// Subscribe for real-time UI (e.g., live error counter in the HUD).
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ── Aggregations (precomputed views over the raw stream) ─────────────────────

// Total ms spent in each state, derived from STATE_ENTER/STATE_EXIT pairs.
export function getStateTimings() {
  const timings = {}
  const enters  = {}
  for (const e of events) {
    if (e.eventType === 'state_enter') {
      enters[e.stepId] = e.timestamp
    } else if (e.eventType === 'state_exit' && enters[e.stepId] != null) {
      timings[e.stepId] = (timings[e.stepId] ?? 0) + (e.timestamp - enters[e.stepId])
      delete enters[e.stepId]
    }
  }
  return timings
}

// Error counts bucketed by class — { wrong_cut_path: n, excess_flesh_damage: n, missed_bone: n }
export function getErrorCounts() {
  const counts = {}
  for (const e of events) {
    if (e.eventType === 'error' && e.payload?.class) {
      counts[e.payload.class] = (counts[e.payload.class] ?? 0) + 1
    }
  }
  return counts
}

// Number of times the student opened a hint / reference video.
export function getHintAccessCount() {
  let n = 0
  for (const e of events) if (e.eventType === 'hint_access') n++
  return n
}
