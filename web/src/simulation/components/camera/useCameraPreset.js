// src/simulation/components/camera/useCameraPreset.js
//
// ── Camera preset mapping ────────────────────────────────────────────────────
// Steps 5–9 use 'cuttingBoardTopClose': a pure top-down view locked directly
// above the butterflied bangus centre so the full dorsal-spine run is visible
// as a straight line from tail to head, filling ~75 % of the viewport for
// precise bone interaction.


import { INTRO_CONFIG } from '../../config/simulationConfig'

export function useCameraPreset(introPhase, currentStep) {
  if (introPhase === 'overview') return 'wide'
  if (introPhase === 'zooming')  return 'wide'
  // Step 1 — Trim Fins is performed on the cutting board (matches Step01Preview).
  if (currentStep === 1)                      return 'cuttingBoard'
  if (currentStep === 2)                      return 'sink'
  if (currentStep === 3)                      return 'transfer'
  // Step 4 uses 'cuttingBoard' (wide) during interaction; useDorsalCutStep
  // overrides to 'cuttingBoardZoom' during the 450ms completion flash.
  if (currentStep === 4)                      return 'cuttingBoard'
  // Steps 5–9: pure top-down framing for dorsal-spine interaction.
  if (currentStep === 5)                      return 'cuttingBoardTop' //cuttingBoard
  if (currentStep === 6)                      return 'cuttingBoardTop'
  if (currentStep === 7)                      return 'cuttingBoardTop'
  if (currentStep === 8)                      return 'cuttingBoardTop'
  if (currentStep === 9)                      return 'cuttingBoardTop'
  if (currentStep === 10)                     return 'sink'
  return 'default'
}

export function useLerpSpeed(introPhase) {
  if (introPhase === 'overview') return INTRO_CONFIG.overviewLerp
  if (introPhase === 'zooming')  return INTRO_CONFIG.cinematicLerp
  return INTRO_CONFIG.gameplayLerp
}