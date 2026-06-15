// src/simulation/config/simulationConfig.js

// `duration` = tween length in seconds when transitioning INTO this preset.
// Scaled by visual travel distance — long arcs need more time to feel weighted,
// tight refocuses should settle quickly so they read as decisive.
export const CAMERA_CONFIG = {
  // Wide cinematic overview — establishing shot during intro 'overview' phase
  wide: {
    position: [4.8, 3.0, 3.8],
    target:   [0.2, 0.9, -0.8],
    fov:      62,
    duration: 3.5, // slow sweep — dramatic establishing shot
  },
  // Default overview — used on completion screen (step 10+)
  default: {
    position: [3.5, 2.5, 3.8],
    target:   [0, 1.0, -0.5],
    fov:      55,
    duration: 2.8, // gentle pull-back to wide for the end screen
  },
  // Tight zoom on sink/washing area — Steps 2 & 8
  sink: {
    position: [-0.25, 1.72, -0.65],
    target:   [-0.25, 1.02, -2.22],
    fov:      36,
    duration: 2.6, // close approach — not too slow on a tight zoom
  },
  // Wide overhead showing BOTH sink and cutting board — Step 3 transfer view
  transfer: {
    position: [0.4, 2.8, 0.0],
    target:   [0.4, 0.95, -2.20],
    fov:      52,
    duration: 3.0, // pulls back far — needs travel time to feel natural
  },
  // Standard cutting-board framing — intro 'zooming' phase + Step 1
  cuttingBoard: {
    position: [1.0, 2.0, -0.9],
    target:   [1.0, 0.95, -2.19],
    fov:      42,
    duration: 2.4, // common step-entry — snappy but not abrupt
  },
  // Pure top-down over the butterflied bangus — Steps 5, 6, 7, 9
  cuttingBoardTop: {
    position: [1.00, 2.55, -2.19],
    target:   [1.00, 0.97, -2.19],
    fov:      28,
    duration: 2.2, // perspective drop — shorter keeps the overhead reveal decisive
  },
  // Tighter angled zoom on the cutting board — Step 4
  cuttingBoardZoom: {
    position: [1.0, 2.1, -1.45],
    target:   [1.0, 1.00, -2.19],
    fov:      32,
    duration: 2.0, // smallest visual travel — quickest settle
  },
}

// Intro timing (ms)
export const INTRO_CONFIG = {
  overviewHold:    2000,   // how long to show the full kitchen
  zoomDuration:    2400,   // how long the zoom-to-sink takes (lerp feel)
  totalIntroDur:   4400,   // overviewHold + zoomDuration (when game UI appears)
  overviewLerp:    0.001,  // near-zero → camera snaps instantly to wide on mount
  cinematicLerp:   0.028,  // slow pan during zoom-in (~2.5s feel at 60fps)
  gameplayLerp:    0.055,  // snappy but not jarring during normal gameplay
}

// Tuned for low-/mid-tier hardware (Intel UHD/Vega class iGPUs, 4–8 GB RAM).
// shadows: off by default — soft shadows + the high-poly butterflied mesh
//   are the single biggest GPU cost on integrated graphics. Re-enable per
//   user setting later if needed.
// dpr: ceiling lowered from 1.5 → 1.25 so high-DPI laptop screens don't
//   render at 2× internal resolution. AdaptiveDpr + PerformanceMonitor below
//   will pull this further down on FPS decline.
export const RENDER_CONFIG = {
  shadows: false,
  shadowMapSize: 512,
  antialias: false,
  dpr: [0.6, 1.25],
}

export const GAME_CONFIG = {
  timerEnabled: true,
  showHints: true,
  allowSkip: false,
  scorePassThreshold: 60,
  maxTimeSeconds: 1800,
}

export const TOOL_CONFIG = {
  knife:    { label: 'Kitchen Knife', icon: '🔪', modelPath: '/equipments/kitchen_knife.glb' },
  forceps:  { label: 'Forceps',       icon: '🥢', modelPath: null },
  water:    { label: 'Water',         icon: '💧', modelPath: null },
  scissors: { label: 'Scissors',      icon: '✂️', modelPath: null },
}
