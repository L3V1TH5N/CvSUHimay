// src/simulation/components/steps/shared/StepManager.jsx
// Fans out to every per-step hook. ALL hooks are called every render (rules of hooks)
// but each hook early-returns the empty shape when its `active` flag is false.
// Step folders use zero-padded canonical numbers matching the 11-step procedure.

import { useFSM }              from '../../../fsm/FSMProvider'
import { useTrimFinsStep }     from '../Step01TrimFins/useTrimFinsStep.jsx'
import { useWashStep }         from '../Step02Washing/useWashStep.jsx'
import { usePlaceStep }        from '../Step03Place/usePlaceStep.jsx'
import { useDorsalCutStep }    from '../Step04DorsalCut/useDorsalCutStep.jsx'
import { useOrgansStep }       from '../Step05Organs/useOrgansStep.jsx'
import { useRibBoneStep }     from '../Step06RibBones/useRibBoneStep.jsx'
import { useDorsalBonesStep }  from '../Step07DorsalBones/useDorsalBonesStep.jsx'
import { useVentralBonesStep } from '../Step08VentralBones/useVentralBonesStep.jsx'
import { useLateralBonesStep } from '../Step09LateralBones/useLateralBonesStep.jsx'
import { useInspectStep }      from '../Step11Inspect/Step11Inspect'

export function useStepManager(simReady = true) {
  const { currentStep, advanceStep, setCompleted } = useFSM()

  const s1  = useTrimFinsStep(     simReady && currentStep === 1,         advanceStep)
  const s2  = useWashStep(2,       simReady && currentStep === 2,  3000,  advanceStep)
  const s3  = usePlaceStep(        simReady && currentStep === 3,         advanceStep)
  const s4  = useDorsalCutStep(    simReady && currentStep === 4,         advanceStep)
  const s5  = useOrgansStep(       simReady && currentStep === 5,         advanceStep)
  const s6  = useRibBoneStep(     simReady && currentStep === 6,         advanceStep)
  const s7  = useDorsalBonesStep(  simReady && currentStep === 7,         advanceStep)
  const s8  = useVentralBonesStep( simReady && currentStep === 8,         advanceStep)
  const s9  = useLateralBonesStep( simReady && currentStep === 9,         advanceStep)
  const s10 = useWashStep(10,      simReady && currentStep === 10,  3000,  advanceStep)
  const s11 = useInspectStep(      simReady && currentStep === 11,        setCompleted)

  const map = { 1: s1, 2: s2, 3: s3, 4: s4, 5: s5, 6: s6, 7: s7, 8: s8, 9: s9, 10: s10, 11: s11 }
  return map[currentStep] ?? { fishHandlers: {}, waterActive: false, extra3D: null, domUI: null }
}
