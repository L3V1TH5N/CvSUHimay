// web/src/simulation/fsm/useStepToolVisible.js
import { useFSMState } from './FSMProvider'

// Returns true when the step should render its own tool visual.
// Returns false when the user has overridden with a different toolbox selection,
// so FreeToolOverlay can take over as the sole renderer.
export function useStepToolVisible() {
  const { activeTool, currentStepDef } = useFSMState()
  const requiredTool = currentStepDef?.tool ?? null
  return activeTool === null || activeTool === requiredTool
}
