// web/src/simulation/components/steps/Step03Place/usePlaceStep.jsx
import { useState, useCallback } from 'react'
import { DraggableFish }         from './DraggableFish'

// Must match DraggableFish default boardPosition and updated FISH_WORLD.cuttingBoard
const BOARD_POS = [1.00, 1.05, -2.19]

const INERT = {
  fishHandlers:            {},
  waterActive:             false,
  extra3D:                 null,
  domUI:                   null,
  dragProgressRef:         null,
  cuttingBoardHighlighted: false,
  // FishModel visible for all other steps
  hideFishModel:           false,
}

export function usePlaceStep(active, onComplete) {
  const [overBoard, setOverBoard] = useState(false)
  // Increments if the step is re-entered mid-session (e.g. FSM restart while
  // step 2 is somehow still active). Forces DraggableFish to remount fresh.
  // eslint-disable-next-line no-unused-vars
  const [resetKey,  setResetKey]  = useState(0)

  const handlePlaced = useCallback(() => {
    setOverBoard(false)
    onComplete()
  }, [onComplete])

  const handleOverBoard = useCallback((value) => {
    setOverBoard(value)
  }, [])

  if (!active) return INERT

  return {
    fishHandlers:            {},
    waterActive:             false,
    // DraggableFish is the only visible fish during this step — starts at sink,
    // animates to the board on successful placement. FishModel is hidden below
    // so it doesn't appear on the board before the user places the fish there.
    extra3D: (
      <DraggableFish
        key={resetKey}
        onPlaced={handlePlaced}
        onOverBoard={handleOverBoard}
        boardPosition={BOARD_POS}
      />
    ),
    domUI:                   null,
    dragProgressRef:         null,
    cuttingBoardHighlighted: overBoard,
    // Hide the persistent FishModel while this step is active. Once onPlaced()
    // fires the FSM advances to Step 4, this hook returns INERT, DraggableFish
    // unmounts, and FishModel reappears at the exact board position where
    // DraggableFish settled — a seamless swap with no visual pop.
    hideFishModel:           true,
  }
}
