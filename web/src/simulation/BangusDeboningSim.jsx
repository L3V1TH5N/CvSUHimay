// src/simulation/BangusDeboningSim.jsx

import { Suspense, useEffect, useState, useRef, memo, useCallback, useMemo } from 'react'
import { Canvas }                               from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'

// Adaptive-quality DPR floor + ceiling. PerformanceMonitor narrows the live
// dpr inside this range based on rolling FPS; AdaptiveDpr then pixelates
// during user interaction. We keep the floor reachable on Intel UHD-class
// GPUs (≈0.6 of native = ~half-resolution) so the sim stays interactive.
const DPR_RANGE = [0.6, 1.25]

import { FSMProvider, useFSM }              from './fsm/FSMProvider'
import { flushEvents, clearEvents }           from './fsm/eventStream'
import { STEP_DEFINITIONS }                  from './config/stepDefinitions'
import { KitchenEnvironment }               from './components/environment/KitchenEnvironment'
import { GameCamera }                       from './components/camera/GameCamera'
import { FishModel }                        from './components/fish/FishModel'
import { useStepManager }                   from './components/steps/shared/StepManager'
import { StatsPanel }                       from './components/ui/StatsPanel'
import { InstructionPanel }                 from './components/ui/InstructionPanel'
import { ToolboxPanel }                     from './components/ui/ToolboxPanel'
import { CompletionScreen }                 from './components/ui/CompletionScreen'
import { RENDER_CONFIG, INTRO_CONFIG, CAMERA_CONFIG } from './config/simulationConfig'
import { FSM_STATES }                       from './config/fsmConfig'
import { IntroOverlay }                     from './components/ui/IntroOverlay'
import { useCameraPreset, useLerpSpeed }    from './components/camera/useCameraPreset'
import { BoardToSinkTransition }            from './components/steps/Step01TrimFins/BoardToSinkTransition'
import { FreeToolOverlay }                 from './components/tools/FreeToolOverlay'
import { ErrorToast }                      from './components/ui/ErrorToast'

// ── Timer (only mounted after intro is done) ──────────────────────────────────
const TimerTicker = memo(function TimerTicker() {
  const { tick, startSimulation, paused, sessionKey } = useFSM()

  // sessionKey increments on every RESET (see FSMProvider reducer).
  // Listing it as a dependency causes this effect to re-run after a restart,
  // which re-fires startSimulation() and transitions the FSM from IDLE →
  // STEP_1_WASHING. startSimulation() is idempotent — it no-ops if already running.
  useEffect(() => {
    startSimulation()
  }, [sessionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (paused) return        // interval not created while paused
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [tick, paused])          // restarts cleanly when paused toggles
  return null
})

// ── 3D Scene — receives stepResult as prop, no hook duplication ───────────────
// currentStep + washProgress are passed as props (not read via useFSM) so
// this memo can bail on 1-Hz TICK dispatches that change only elapsedSeconds.
// Every TICK caused a full R3F fiber reconciliation — this eliminates that.
const SimulationScene = memo(function SimulationScene({ introPhase, stepResult, simReady, currentStep, washProgress }) {
  const baseCameraPreset = useCameraPreset(introPhase, currentStep)
  const lerpSpeed        = useLerpSpeed(introPhase)
  // Step hooks can return a cameraPreset override (e.g. Step 4 uses a wider
  // view during interaction and zooms in on completion). Fall back to the
  // global preset map when the active step doesn't supply one.
  // During intro phases the FSM is not yet active — ignore any step hook
  // camera override so the cinematic wide→cuttingBoard sequence is preserved.
  const cameraPreset = introPhase !== 'ready'
    ? baseCameraPreset
    : (stepResult.cameraPreset ?? baseCameraPreset)

  // ── transition trigger point: detect step-boundary flips during render ─────
  // prevStepRef is mutated synchronously during render so the 2→3 instant snap
  // and the 1→2 cinematic hand-off can both inspect the prior step without a
  // useEffect-induced one-frame lag.
  const prevStepRef  = useRef(currentStep)
  const isBoundary12 = prevStepRef.current === 1 && currentStep === 2
  prevStepRef.current = currentStep

  // ── transition optimization: ref-driven arm, no setState during render ─────
  // BoardToSinkTransition is pre-mounted during Step 1 so the expensive
  // Object3D.clone() walk is paid while the user is busy cutting fins. On the
  // boundary frame we only flip a ref — no React re-render, no reconciliation
  // cascade, no clone work. The component reads trigger12Ref each useFrame
  // tick and starts its lerp on the very next animation tick.
  const trigger12Ref = useRef(false)
  if (isBoundary12) trigger12Ref.current = true

  // ── visibility switching: when to hide FishModel during the hand-off ───────
  // `transition12Done` flips when BoardToSinkTransition signals completion.
  // Until then, FishModel is hidden so the cinematic clone owns the visuals
  // and the wash hook cannot raycast against an invisible fish.
  const [transition12Done, setTransition12Done] = useState(false)
  const inFlight        = currentStep === 2 && !transition12Done
  // Pre-mount the transition during Step 1 (warm the clone) AND while in
  // flight. Unmounts after `done`, releasing only the wrapping group; the
  // cached clone tree stays in the module cache for fast re-entry on reset.
  const mountTransition = currentStep === 1 || inFlight

  // ── asset cleanup / disposal on reset cycle ────────────────────────────────
  // On re-entry to Step 1 (RESET / restart), wipe the trigger and re-arm the
  // status flag. Cached clone tree is intentionally not disposed — see
  // BoardToSinkTransition's "DISPOSAL POLICY" note.
  useEffect(() => {
    if (currentStep === 1) {
      trigger12Ref.current = false
      setTransition12Done(false)
    }
  }, [currentStep])

  // ── completion callback for Step 2 initialization ──────────────────────────
  // Fires once when BoardToSinkTransition's lerp + settle finishes. Unmounts
  // the cinematic clone (frees the wrapping group) and unhides FishModel at
  // the sink, where useWashStep can begin accepting interactions.
  const handleStep12Done = useCallback(() => setTransition12Done(true), [])

  const {
    fishHandlers, waterActive, extra3D,
    dragProgressRef, rotationOffsetRef, cutProgressRef,
    dorsalBoneSlot, ventralBoneSlot, lateralBoneSlot,
    hideFishModel, zoomEnabled, cameraComponent,
  } = stepResult
  // Step 1 renders its own bangus3 inside <FishTransition> at the cutting board
  // (mirrors Step01Preview); only step 2 (washing) stages the fish at the sink.
  const fishLocation = (currentStep === 2 || currentStep === 10) ? 'sink' : 'cuttingBoard'
  // cutComplete = step 4 (dorsal cut) already finished → keep the butterflied
  // mesh visible across steps 5..11. Must be > 4, not > 3, because step 4 IS
  // the cut step — the cross-fade must happen live during step 4, not before it.
  const cutComplete = currentStep > 4
  // Steps 2–4: fins already trimmed → show the cut model instead of bangus3.
  const closedModelPath = (currentStep >= 2 && currentStep <= 4)
    ? '/models/BangusCUTTEDFIN.opt.glb'
    : '/models/bangus3.opt.glb'

  return (
    <>
      <color attach="background" args={['#b8ccd8']} />
      <fog   attach="fog"        args={['#b8ccd8', 14, 28]} />

      {/* ── camera transition logic ───────────────────────────────────────
          Every step change tweens smoothly via GameCamera's easeInOutCubic
          system. Duration is read per-preset from CAMERA_CONFIG.duration so
          each shot paces itself to its visual travel distance.
          1→2: camera glides cuttingBoard→sink in parallel with the fish-flight
               cinematic (BoardToSinkTransition).
          2→3: camera tweens sink→transfer as the butterflied fish settles. */}
      {cameraComponent ?? (
        <GameCamera
          cameraPreset={cameraPreset}
          lerpSpeed={lerpSpeed}
          orbitEnabled={false}
          zoomEnabled={!!zoomEnabled}
          minDistance={1.1}
          maxDistance={1.58}
        />
      )}

      <KitchenEnvironment
        waterOn={waterActive}
        cuttingBoardHighlighted={false}
      />

      {/* ── loading/visibility handling ───────────────────────────────────
          FishModel stays hidden for the full duration of the cinematic
          hand-off. With `visible=false` on its group three.js skips both
          rendering and raycasting, so the Step-2 wash hook cannot fire
          gestures on an invisible mesh. FishModel re-appears at the sink
          the moment BoardToSinkTransition signals completion. */}
      <FishModel
        location={fishLocation}
        locationSnap={currentStep === 11}
        hidden={!!hideFishModel || inFlight || !simReady}
        highlighted={simReady && currentStep === 9}
        washProgress={washProgress}
        closedModelPath={closedModelPath}
        dragProgressRef={dragProgressRef ?? null}
        rotationOffsetRef={rotationOffsetRef ?? null}
        cutProgressRef={cutProgressRef ?? null}
        cutComplete={cutComplete}
        dorsalBoneSlot={simReady ? dorsalBoneSlot : null}
        ventralBoneSlot={simReady ? ventralBoneSlot : null}
        lateralBoneSlot={simReady ? lateralBoneSlot : null}
        {...(simReady ? fishHandlers : {})}
      />

      {/* ── Step 1 → Step 2 cinematic fish flight (pre-mounted) ───────────
          Mounted during Step 1 so the cached Object3D.clone() walk runs
          while the user is busy cutting fins. The component stays parked
          (invisible, useFrame early-outs) until trigger12Ref flips on the
          boundary frame — then its lerp begins on the very next animation
          tick with no clone work, no parse stall, no React reconciliation
          cascade. Unmounts after onDone fires; cached clone tree persists
          in module scope for fast restart cycles. */}
      {mountTransition && (
        <BoardToSinkTransition
          triggerRef={trigger12Ref}
          onDone={handleStep12Done}
        />
      )}

      {simReady && extra3D}

      {/* FreeToolOverlay must live inside the Canvas — it uses useFrame/useThree */}
      <FreeToolOverlay />
    </>
  )
})

// ── Inner (has FSM context) ───────────────────────────────────────────────────
function SimulationInner({ onSubmit, onExit }) {
  const [introPhase, setIntroPhase] = useState('overview')
  const {
    fsmState,
    isCompleted,
    sessionKey,
    reset,
    scorePercent,
    hintsUsed,
    elapsedSeconds,
    stepScores,
    currentStep,
    washProgress,
    completedSteps,
    stepErrors,
    stepStartTime,
    stepCompletionTime,
    toolEvents,
    bonesRemoved,
    washQualityPercent,
    stepHintsUsed,
  } = useFSM()

  // Submission state machine driven by completeSimulation().
  // idle → saving → saved | partial | failed
  const [submitState,  setSubmitState]  = useState('idle')
  const [serverScore,  setServerScore]  = useState(null)
  // Single-fire gate for completeSimulation. Reset only by the
  // sessionKey effect below (i.e. on RESET / "Try Again").
  const submittedRef = useRef(false)

  useEffect(() => {
    const t1 = setTimeout(() => setIntroPhase('zooming'), INTRO_CONFIG.overviewHold)
    const t2 = setTimeout(() => setIntroPhase('ready'),   INTRO_CONFIG.totalIntroDur)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Pure payload builder. Reads current FSM state and assembles the dual-POST
  // contract documented in docs/superpowers/specs/2026-05-16-simulation-
  // analytics-design.md § Section 3. No side effects.
  const buildSessionPayload = useCallback(() => {
    const eventSnapshot = flushEvents()

    const events = eventSnapshot.map((e) => ({
      step_id:          e.stepId,
      event_type:       e.eventType,
      payload:          e.payload ?? null,
      geometric_trace:  e.geometricTrace ?? null,
      client_timestamp: e.timestamp,
    }))

    const lastTouched   = Math.max(currentStep, ...completedSteps, 0)
    const stepIdsToEmit = []
    for (let id = 1; id <= lastTouched; id++) stepIdsToEmit.push(id)

    const nowMs = Date.now()
    const step_results = stepIdsToEmit.map((stepId) => {
      const def         = STEP_DEFINITIONS[stepId - 1] ?? {}
      const startedAt   = stepStartTime[stepId] ?? null
      const finishedAt  = stepCompletionTime[stepId] ?? (stepId === currentStep ? nowMs : null)
      const elapsedMs   = (startedAt && finishedAt) ? Math.max(0, finishedAt - startedAt) : 0

      const errors = eventSnapshot
        .filter((e) => e.eventType === 'error' && e.stepId === stepId)
        .map((e) => ({
          class:            e.payload?.class ?? 'wrong_cut_path',
          tool_active:      e.payload?.tool_active ?? null,
          client_timestamp: e.timestamp,
        }))

      const stepToolEvents = toolEvents
        .filter((t) => t.stepId === stepId)
        .sort((a, b) => a.selectedAt - b.selectedAt)
      const stepEndsAt = finishedAt ?? nowMs
      const toolAgg = {}
      for (let i = 0; i < stepToolEvents.length; i++) {
        const cur     = stepToolEvents[i]
        const nextAt  = stepToolEvents[i + 1]?.selectedAt ?? stepEndsAt
        const seconds = Math.max(0, Math.round((nextAt - cur.selectedAt) / 1000))
        const name    = cur.tool ?? 'none'
        if (!toolAgg[name]) toolAgg[name] = { tool_name: name, selection_count: 0, active_seconds: 0, wrong_tool_triggers: 0 }
        toolAgg[name].selection_count += 1
        toolAgg[name].active_seconds  += seconds
      }
      const tool_usage = Object.values(toolAgg)

      return {
        step_id:            stepId,
        step_key:           def.key ?? '',
        hint_level:         stepHintsUsed[stepId] ?? 0,
        error_count:        stepErrors[stepId] ?? 0,
        time_spent_seconds: Math.round(elapsedMs / 1000),
        completed:          completedSteps.includes(stepId),
        errors,
        tool_usage,
      }
    })

    return {
      score:            scorePercent,
      hints_used:       hintsUsed,
      duration_seconds: elapsedSeconds,
      completed:        isCompleted,
      step_scores:      stepScores,
      sim_session: {
        step_results,
        events,
        bone_counts: {
          rib:     bonesRemoved.rib,
          dorsal:  bonesRemoved.dorsal,
          ventral: bonesRemoved.ventral,
          lateral: bonesRemoved.lateral,
        },
        wash_quality_percent: Math.round(washQualityPercent),
        duration_seconds:     elapsedSeconds,
        hints_used:           hintsUsed,
        completed:            isCompleted,
      },
    }
  }, [
    scorePercent, hintsUsed, elapsedSeconds, isCompleted, stepScores,
    currentStep, completedSteps, stepErrors, stepStartTime, stepCompletionTime,
    toolEvents, bonesRemoved, washQualityPercent, stepHintsUsed,
  ])

  // Single source of truth for run completion. Gated by submittedRef so
  // it fires exactly once per session. The ONLY callers are the
  // useEffect([isCompleted]) below, the retry handler, and the mid-
  // session exit handler.
  const completeSimulation = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true

    setSubmitState('saving')
    const payload = buildSessionPayload()

    try {
      const result = await onSubmit?.(payload)
      if (!result?.ok)         setSubmitState('failed')
      else if (result.partial) setSubmitState('partial')
      else                     setSubmitState('saved')
      if (result?.serverScore != null) setServerScore(result.serverScore)
    } catch {
      setSubmitState('failed')
    }
  }, [onSubmit, buildSessionPayload])

  // Idempotency layer 3: value-edge guard — effect only re-runs when
  // isCompleted CHANGES, not on re-renders where it stays true. Layer 4
  // (submittedRef inside completeSimulation) also catches StrictMode's
  // mount→unmount→mount cycle, where this effect would re-fire on remount.
  useEffect(() => {
    if (isCompleted) completeSimulation()
  }, [isCompleted, completeSimulation])

  // RESET ("Try Again") increments sessionKey. Clear submit gate and flush any
  // leftover events from a previous session that failed before buildSessionPayload
  // could call flushEvents(). Without this, events from failed/abandoned sessions
  // accumulate across retries and can push the payload past MAX_EVENTS (2000).
  useEffect(() => {
    submittedRef.current = false
    setSubmitState('idle')
    setServerScore(null)
    clearEvents()
  }, [sessionKey])

  const retrySubmission = useCallback(() => {
    submittedRef.current = false
    completeSimulation()
  }, [completeSimulation])

  // Dispatches RESET → increments sessionKey → TimerTicker re-fires startSimulation().
  // All FSM state resets to initialSimState. The cinematic intro is intentionally
  // skipped on retry (introPhase stays 'ready') so the student drops straight to step 1.
  // NOTE: This resets FSM state only. If any step hook holds persistent local state
  // (e.g. bone counts via useState), verify that it resets when active=false→true.
  const handleRestart = useCallback(() => reset(), [reset])

  // Mid-session exit (StatsPanel button). Awaits a single submit then navigates.
  const handleMidSessionExit = useCallback(async () => {
    if (!submittedRef.current) await completeSimulation()
    onExit?.()
  }, [completeSimulation, onExit])

  const isReady  = introPhase === 'ready'
  const simReady = isReady && fsmState !== FSM_STATES.IDLE

  // ── Single useStepManager call — no duplicates across the Canvas boundary ──
  // None of the step hooks use R3F hooks (useFrame etc.) so this is safe to
  // call outside the Canvas. Results flow down as props.
  const stepResult = useStepManager(simReady)

  // Memoize the 3D-relevant subset of stepResult so SimulationScene's memo can
  // bail correctly during active washing. `domUI` is intentionally excluded —
  // it updates at ~33 Hz (wash progress bar) and is rendered in the HTML overlay
  // below, not inside the Canvas. Without this, the `stepResult` object reference
  // changes every setProgress tick → SimulationScene.memo always fails → full
  // R3F fiber reconciliation runs every frame even though nothing 3D changed.
  const sceneResult = useMemo(() => ({
    fishHandlers:      stepResult.fishHandlers,
    waterActive:       stepResult.waterActive,
    extra3D:           stepResult.extra3D,
    dragProgressRef:   stepResult.dragProgressRef,
    rotationOffsetRef: stepResult.rotationOffsetRef,
    cutProgressRef:    stepResult.cutProgressRef,
    dorsalBoneSlot:    stepResult.dorsalBoneSlot,
    ventralBoneSlot:   stepResult.ventralBoneSlot,
    lateralBoneSlot:   stepResult.lateralBoneSlot,
    hideFishModel:     stepResult.hideFishModel,
    zoomEnabled:       stepResult.zoomEnabled,
    cameraComponent:   stepResult.cameraComponent,
  }), [
    stepResult.fishHandlers,
    stepResult.waterActive,
    stepResult.extra3D,
    stepResult.dragProgressRef,
    stepResult.rotationOffsetRef,
    stepResult.cutProgressRef,
    stepResult.dorsalBoneSlot,
    stepResult.ventralBoneSlot,
    stepResult.lateralBoneSlot,
    stepResult.hideFishModel,
    stepResult.zoomEnabled,
    stepResult.cameraComponent,
  ])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#080c09' }}>

      {/* ── 3D Canvas ── */}
      <Canvas
        style={{ position: 'absolute', inset: 0 }}
        shadows={RENDER_CONFIG.shadows}
        dpr={DPR_RANGE}
        frameloop={isCompleted ? 'never' : 'always'}
        gl={{
          antialias: RENDER_CONFIG.antialias,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          // depth: true is implicit; keeping stencil:false avoids an extra
          // attachment we never use.
        }}
        // frameloop="demand" would be ideal but the sim relies on continuous
        // useFrame for fish lerp + cross-fade animations, so we stay on
        // "always" and let AdaptiveDpr/PerformanceMonitor handle scaling.
        camera={{ position: [4.8, 3.0, 3.8], fov: 62, near: 0.1, far: 50 }}
        onCreated={({ camera }) => {
          // Set the correct lookAt from frame zero so the canvas never shows
          // the default Three.js -Z direction before GameCamera's useEffect fires.
          const [tx, ty, tz] = CAMERA_CONFIG.wide.target
          camera.lookAt(tx, ty, tz)
        }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        {/* Live FPS-based quality scaler. onDecline fires when sustained
            framerate dips below ~0.75 of monitor refresh; we react by
            collapsing DPR to the floor so the GPU has less to push.
            onIncline restores the ceiling once headroom returns. */}
        <PerformanceMonitor
          bounds={(refreshrate) => (refreshrate > 90 ? [60, 90] : [45, 60])}
          onDecline={({ fps }) => {
            // No-op container — AdaptiveDpr already lowers internal DPR;
            // this hook is reserved for future shadow/effect toggles. We
            // intentionally do not throw here on dev to avoid noise.
            if (typeof window !== 'undefined') {
              window.__simLowFps = fps
            }
          }}
          onIncline={() => {
            if (typeof window !== 'undefined') {
              window.__simLowFps = null
            }
          }}
        />

        <Suspense fallback={null}>
          {isReady && <TimerTicker />}
          <SimulationScene
            introPhase={introPhase}
            stepResult={sceneResult}
            simReady={simReady}
            currentStep={currentStep}
            washProgress={washProgress}
          />
        </Suspense>
      </Canvas>

      {/* ── Cinematic intro overlay ── */}
      <IntroOverlay phase={introPhase} />

      {/* ── Game UI — fades in after intro ── */}
      {/* pointerEvents:'none' lets mouse events pass through to the Canvas.
          Child UI components (buttons, panels) still receive clicks because
          pointer-events is not inherited for HTML elements. */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity:    isReady ? 1 : 0,
        transition: isReady ? 'opacity 0.6s ease' : 'none',
        pointerEvents: 'none',
        zIndex: 90,
      }}>
        {isReady && (
          isCompleted
            ? <CompletionScreen
                onExit={onExit}
                onRestart={handleRestart}
                submitState={submitState}
                onRetry={retrySubmission}
                serverScore={serverScore}
              />
            : <>
                <StatsPanel onExit={handleMidSessionExit} />
                <InstructionPanel />
                <ToolboxPanel />
                <ErrorToast />
                {stepResult.domUI}
              </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────
export default function BangusDeboningSim({ onSubmit, onExit }) {
  return (
    <FSMProvider>
      <SimulationInner onSubmit={onSubmit} onExit={onExit} />
    </FSMProvider>
  )
}
