// src/simulation/components/steps/Step01TrimFins/FinIndicators.jsx
// ── COPIED LINE INDICATOR + INCISION LOGIC (Step01Preview.jsx) ───────────────
// Three components per fin:
//   FinGlow       — three stacked pulsing lines (red default, yellow when active)
//   FinIncision   — growing dark slit that rides the covered drag span
//   FinIndicator  — composes both at the fin's world position
//
// All visuals are ref-driven via useFrame — zero React state, zero re-renders.

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import {
  FISH_POS, PULSE_SPEED, COLOR_LERP_SPEED, NO_RAYCAST,
  LINE_COLOR_DEFAULT_OUTER, LINE_COLOR_DEFAULT_MID, LINE_COLOR_DEFAULT_CORE,
  LINE_COLOR_ACTIVE_OUTER,  LINE_COLOR_ACTIVE_MID,  LINE_COLOR_ACTIVE_CORE,
} from './step01Config'

// ── FinGlow ──────────────────────────────────────────────────────────────────
// Three stacked Line2s float above the fish via depthTest={false}. Hides when
// this fin's cut completes OR when the global transition has started.
function FinGlow({ finId, lineHalf, cutRef, activeFinIdRef, transitionRef }) {
  const outerRef = useRef()
  const midRef   = useRef()
  const coreRef  = useRef()
  const groupRef = useRef()

  // Current per-layer colors — mutated by lerp each frame, never React state.
  const colOuter = useRef(new THREE.Color(LINE_COLOR_DEFAULT_OUTER))
  const colMid   = useRef(new THREE.Color(LINE_COLOR_DEFAULT_MID))
  const colCore  = useRef(new THREE.Color(LINE_COLOR_DEFAULT_CORE))

  // Target color sets — allocated once, read-only.
  const tgtDefault = useMemo(() => ({
    outer: new THREE.Color(LINE_COLOR_DEFAULT_OUTER),
    mid:   new THREE.Color(LINE_COLOR_DEFAULT_MID),
    core:  new THREE.Color(LINE_COLOR_DEFAULT_CORE),
  }), [])
  const tgtActive = useMemo(() => ({
    outer: new THREE.Color(LINE_COLOR_ACTIVE_OUTER),
    mid:   new THREE.Color(LINE_COLOR_ACTIVE_MID),
    core:  new THREE.Color(LINE_COLOR_ACTIVE_CORE),
  }), [])

  const linePts = useMemo(() => [[-lineHalf, 0, 0], [lineHalf, 0, 0]], [lineHalf])

  useFrame((_, dt) => {
    if (!groupRef.current) return
    if (cutRef.current || transitionRef?.current) {
      groupRef.current.visible = false
      return
    }
    groupRef.current.visible = true

    // Yellow only when the CuttingSensor has locked onto THIS fin's line.
    const isActive = activeFinIdRef?.current === finId
    const tgt    = isActive ? tgtActive : tgtDefault
    const factor = Math.min(1, COLOR_LERP_SPEED * dt)

    colOuter.current.lerp(tgt.outer, factor)
    colMid.current.lerp(tgt.mid,     factor)
    colCore.current.lerp(tgt.core,   factor)

    const t = performance.now() * 0.0005 * Math.PI * 2 * PULSE_SPEED
    if (outerRef.current?.material) {
      outerRef.current.material.color.copy(colOuter.current)
      outerRef.current.material.opacity = 0.20 + Math.sin(t) * 0.20
    }
    if (midRef.current?.material) {
      midRef.current.material.color.copy(colMid.current)
      midRef.current.material.opacity = 0.55 + Math.sin(t) * 0.30
    }
    if (coreRef.current?.material) {
      coreRef.current.material.color.copy(colCore.current)
      coreRef.current.material.opacity = 0.55 + Math.sin(t) * 0.35
    }
  })

  return (
    <group ref={groupRef}>
      {/* Wide dark base — depth/shadow layer */}
      <Line ref={outerRef} points={linePts} color={LINE_COLOR_DEFAULT_OUTER} lineWidth={11} transparent opacity={0.25} depthTest={false} raycast={NO_RAYCAST} />
      {/* Medium mid-band */}
      <Line ref={midRef}   points={linePts} color={LINE_COLOR_DEFAULT_MID}   lineWidth={7}  transparent opacity={0.55} depthTest={false} raycast={NO_RAYCAST} />
      {/* Bright core — the sharp highlight the eye follows */}
      <Line ref={coreRef}  points={linePts} color={LINE_COLOR_DEFAULT_CORE}  lineWidth={2}  transparent opacity={0.70} depthTest={false} raycast={NO_RAYCAST} />
    </group>
  )
}

// ── FinIncision ──────────────────────────────────────────────────────────────
// Growing dark cut-slit that rides the indicator line over the covered span
// [fromT..toT]. Stays visible AFTER the fin is cut and THROUGH the cross-fade;
// disappears only once BangusCUTTEDFIN.opt.glb is fully resolved.
function FinIncision({ lineHalf, coverageRef, transitionDoneRef }) {
  const slitRef = useRef()

  useFrame(() => {
    const s = slitRef.current
    if (!s) return
    if (transitionDoneRef?.current) { s.visible = false; return }
    const cov   = coverageRef
    const fromT = Math.max(0, Math.min(1, cov.fromT))
    const toT   = Math.max(0, Math.min(1, cov.toT))
    const span  = toT - fromT
    if (span < 0.015) { s.visible = false; return }
    s.visible = true

    // Map local X across the indicator line: [0..1] → [-LINE_HALF..+LINE_HALF].
    const mid  = (fromT + toT) * 0.5
    const midX = (mid - 0.5) * (lineHalf * 2)
    s.position.set(midX, 0.0025, 0)
    s.scale.set(span, 0.60, 0.30)
  })

  return (
    <mesh ref={slitRef} visible={false}>
      <boxGeometry args={[lineHalf * 2, 0.008, 0.014]} />
      <meshStandardMaterial color="#360707" roughness={0.35} />
      {/* Fresh-cut inner strip — slightly raised, mild emissive. */}
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[lineHalf * 2, 0.002, 0.009]} />
        <meshStandardMaterial color="#7d1414" roughness={0.65} emissive="#2a0606" emissiveIntensity={0.4} />
      </mesh>
    </mesh>
  )
}

// ── FinIndicator ─────────────────────────────────────────────────────────────
// Composes FinGlow + FinIncision at the fin's world position. Replaces the fin
// GLB during gameplay — the actual fin mesh only appears in FinReveal on
// completion.
export function FinIndicator({ fin, cutRef, activeFinIdRef, transitionRef, transitionDoneRef, coverageRef }) {
  const worldPos = useMemo(() => [
    FISH_POS[0] + fin.offset[0],
    FISH_POS[1] + fin.offset[1],
    FISH_POS[2] + fin.offset[2],
  ], [fin])

  return (
    <group position={worldPos} rotation={fin.rotation ?? [0, 0, 0]}>
      <FinGlow     finId={fin.id} lineHalf={fin.lineHalf} cutRef={cutRef} activeFinIdRef={activeFinIdRef} transitionRef={transitionRef} />
      <FinIncision lineHalf={fin.lineHalf} coverageRef={coverageRef} transitionDoneRef={transitionDoneRef} />
    </group>
  )
}
