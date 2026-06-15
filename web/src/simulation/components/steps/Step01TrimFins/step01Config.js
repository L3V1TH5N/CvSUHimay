// src/simulation/components/steps/Step01TrimFins/step01Config.js
// Shared constants for the Step-01 trim-fins cutting mechanic.
// Mirrors the tuning surface of Step01Preview.jsx so the actual step plays
// identically to the developer preview. Edit values here to retune the feel.

import * as THREE from 'three'

// ── FISH PLACEMENT (cutting board) ───────────────────────────────────────────
// Matches the world transform used by FishModel.cuttingBoard, with a custom
// Y rotation chosen so the fin lines lay along the lateral profile from this
// camera angle.
export const FISH_POS   = [1.0, 1.09, -2.1]
export const FISH_ROT_Y = 1.6
export const FISH_SCALE = 0.9

// ── CUTTING TUNING (mirrors Step04 DorsalCutSensor feel) ─────────────────────
// Drag-trace cutting: click near a fin's line, drag along it from end to end.
export const WARN_PATH_RATIO  = 0.35   // amber warning band before drift feels off
export const WRONG_PATH_RATIO = 0.65   // generous drift before coverage stalls
export const START_PATH_RATIO = 1.20   // click almost anywhere near the line to arm
export const JUMP_TOL         = 0.50   // tolerate larger single-frame pointer jumps
export const END_TOL          = 0.30   // only need to cover the middle 40 % to complete

// ── FIN POSITIONS ────────────────────────────────────────────────────────────
// Each fin's `offset` is relative to FISH_POS in world space.
//   x → +tail / -head        y → +up / -down        z → +belly / -back
export const FINS = [
  // ── Dorsal Fin (runs along the top ridge of the fish) ────────────────────
  { id: 0, label: 'Dorsal Fin',
    glb: '/models/fins/DorsalFin.glb',
    lineHalf: 0.05,                          // ← EDIT: half-length (full = 0.36 wu)
    offset:   [ 0.05,  0.09,  0.00],         // ← EDIT: [x tail+/head-, y up+/down-, z cam+/away-]
  },

  // ── Pectoral Fins (side fins near the head/gill area) ────────────────────
  { id: 1, label: 'Pectoral Fins',
    glb: '/models/fins/PectoralFins.glb',
    lineHalf: 0.05,                          // ← EDIT: half-length (full = 0.20 wu)
    offset:   [ 0.21,  -0.07,  0.06],        // ← EDIT
  },

  // ── Anal Fin (underside fin near the tail) ───────────────────────────────
  { id: 2, label: 'Anal Fin',
    glb: '/models/fins/AnalFins.glb',
    lineHalf: 0.04,                          // ← EDIT: half-length (full = 0.16 wu)
    offset:   [ -0.17,  -0.04, 0.06],        // ← EDIT
  },

  // ── Caudal Fin (tail fin) ─────────────────────────────────────────────────
  { id: 3, label: 'Caudal Fin',
    glb: '/models/fins/ClaudalFins.glb',
    lineHalf: 0.09,                          // ← EDIT: half-length (full = 0.24 wu)
    offset:   [ -0.32,  -0.0,  0.06],        // ← EDIT: position
    rotation: [  0,     0,     1.35 ],       // ← EDIT: [rx, ry, rz] — 1.35 rad ≈ 77° tilt
  },

  // ── Pelvic Fins (paired fins on the belly) ───────────────────────────────
  { id: 4, label: 'Pelvic Fins',
    glb: '/models/fins/PelvicFins.glb',
    lineHalf: 0.05,                          // ← EDIT: half-length (full = 0.18 wu)
    offset:   [ 0.01,  -0.08,  0.07],        // ← EDIT
  },
]

// ── KNIFE (fillet knife — same constants as DorsalCutSensor) ─────────────────
export const KNIFE_HAND_LOCAL = [0.28, -0.36, -1.0] // grip anchor in camera space
export const KNIFE_SCALE      = 1.6
export const KNIFE_GRIP_Y     = 0.36
export const KNIFE_PRESS_JAB  = 0.03
export const KNIFE_DEPTH      = 2.5
export const BLADE_EXTRUDE    = { depth: 0.0022, bevelEnabled: false }

// ── LINE INDICATOR COLORS ────────────────────────────────────────────────────
//   *_OUTER — widest, darkest layer    *_MID — medium band    *_CORE — highlight
//   Default = red (no interaction).    Active = yellow (cursor locked on fin).
export const LINE_COLOR_DEFAULT_OUTER = '#ff2222'
export const LINE_COLOR_DEFAULT_MID   = '#ff4444'
export const LINE_COLOR_DEFAULT_CORE  = '#ff9999'
export const LINE_COLOR_ACTIVE_OUTER  = '#ffaa00'
export const LINE_COLOR_ACTIVE_MID    = '#ffdd00'
export const LINE_COLOR_ACTIVE_CORE   = '#ffff88'

export const LINE_HALF           = 0.12   // half-length of cut guide in world units
export const PULSE_SPEED         = 1.4    // pulse frequency in Hz
export const COLOR_LERP_SPEED    = 8      // red↔yellow transition snappiness
export const TRANSITION_DURATION = 0.8    // single-beat fin reveal + cross-fade seconds

// ── CUT ORDER ────────────────────────────────────────────────────────────────
// Canonical sequence the student must follow. Indices correspond to FINS[].id.
// Order: Dorsal (0) → Pectoral (1) → Anal (2) → Caudal (3) → Pelvic (4)
export const CUT_ORDER = [0, 1, 2, 3, 4]

// ── Shared singletons (never mutated) ────────────────────────────────────────
export const WORLD_UP   = new THREE.Vector3(0, 1, 0)
// Decorative lines must not steal cut gestures — same pattern as DorsalCutGuide.
export const NO_RAYCAST = () => null
