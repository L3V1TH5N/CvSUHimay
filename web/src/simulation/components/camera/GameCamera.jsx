// src/simulation/components/camera/GameCamera.jsx
// Time-based tween camera with per-preset cinematic pacing.
// Arrives exactly at destination when tween completes — no asymptotic creep.
// useFrame early-outs when settled — zero per-frame cost at rest.
//
// startPos is captured inside useFrame (not useEffect) via tweenPending so the
// snapshot always reflects the exact frame-boundary camera state, avoiding the
// timing gap between React's effects cycle and the rAF loop.
//
// Transition duration is read from CAMERA_CONFIG[preset].duration so each shot
// gets pacing proportional to its visual travel distance.

import { useRef, useEffect, memo } from 'react'
import { useThree, useFrame }       from '@react-three/fiber'
import { OrbitControls }            from '@react-three/drei'
import * as THREE                   from 'three'
import { CAMERA_CONFIG }            from '../../config/simulationConfig'

// Fallback duration when a preset omits `duration`
const DEFAULT_DURATION = 2.8

// Cubic ease — stronger acceleration/deceleration than sine for cinematic intent.
// t=0→slow→fast→slow→t=1. More deliberate than sine; less extreme than quint.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export const GameCamera = memo(function GameCamera({
  cameraPreset = 'default',
  lerpSpeed    = 0.055, // kept for API compat — unused internally
  orbitEnabled = true,
  zoomEnabled  = false, // scroll-zoom only — no rotate, no pan
  minDistance  = 0.8,
  maxDistance  = 9,
  instant      = false,
}) {
  const controlsRef   = useRef()
  const { camera }    = useThree()

  // Tween state — all refs, zero per-frame allocation
  const startPos      = useRef(new THREE.Vector3())
  const startTgt      = useRef(new THREE.Vector3())
  const startFov      = useRef(camera.fov)
  const destPos       = useRef(new THREE.Vector3())
  const destTgt       = useRef(new THREE.Vector3())
  const destFov       = useRef(camera.fov)
  // Per-preset transition length (seconds) — set from CAMERA_CONFIG.duration
  const destDuration  = useRef(DEFAULT_DURATION)
  const elapsed       = useRef(DEFAULT_DURATION) // starts complete → settled on mount
  const settled       = useRef(true)
  // Flag: useEffect arms the tween; useFrame fires it so startPos is snapshotted
  // at the actual animation-frame boundary, not mid-effects-cycle.
  const tweenPending  = useRef(false)

  // First mount — snap instantly to the initial preset, no tween
  useEffect(() => {
    const p = CAMERA_CONFIG[cameraPreset] ?? CAMERA_CONFIG.default
    destPos.current.set(...p.position)
    destTgt.current.set(...p.target)
    destFov.current = p.fov ?? 55
    destDuration.current = p.duration ?? DEFAULT_DURATION
    camera.position.copy(destPos.current)
    camera.fov = destFov.current
    camera.updateProjectionMatrix()
    camera.lookAt(...p.target)
    if (controlsRef.current) {
      controlsRef.current.target.copy(destTgt.current)
      controlsRef.current.update()
    }
    startPos.current.copy(destPos.current)
    startTgt.current.copy(destTgt.current)
    startFov.current = destFov.current
    elapsed.current = destDuration.current // mark complete — no tween on mount
    settled.current = true
    tweenPending.current = false
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Preset change — arm a tween (or snap if instant)
  useEffect(() => {
    const p = CAMERA_CONFIG[cameraPreset] ?? CAMERA_CONFIG.default
    destPos.current.set(...p.position)
    destTgt.current.set(...p.target)
    destFov.current = p.fov ?? 55
    destDuration.current = p.duration ?? DEFAULT_DURATION // per-preset pacing

    if (instant) {
      // Hard-cut — skip tween entirely (used for the deliberate 2→3 snap)
      tweenPending.current = false
      camera.position.copy(destPos.current)
      camera.fov = destFov.current
      camera.updateProjectionMatrix()
      camera.lookAt(...p.target)
      if (controlsRef.current) {
        controlsRef.current.target.copy(destTgt.current)
        controlsRef.current.update()
      }
      startPos.current.copy(destPos.current)
      startTgt.current.copy(destTgt.current)
      startFov.current = destFov.current
      elapsed.current = destDuration.current
      settled.current = true
    } else {
      // Arm the tween — startPos captured in useFrame on next tick at rAF boundary
      tweenPending.current = true
      settled.current = false
    }
  }, [cameraPreset, instant]) // eslint-disable-line react-hooks/exhaustive-deps

  // Priority -2: runs after OrbitControls (drei registers at -1) so we always win
  useFrame((_, delta) => {
    if (settled.current) return // early-out — nothing to do at rest

    // First frame after preset change: snapshot camera state at the true rAF boundary.
    // This prevents the one-frame stutter you'd get from snapshotting in useEffect.
    if (tweenPending.current) {
      startPos.current.copy(camera.position)
      startTgt.current.copy(
        controlsRef.current ? controlsRef.current.target : destTgt.current
      )
      startFov.current = camera.fov
      elapsed.current = 0
      tweenPending.current = false
    }

    // Advance tween with per-preset duration
    const duration = destDuration.current
    elapsed.current = Math.min(elapsed.current + delta, duration)
    const t     = elapsed.current / duration
    const eased = easeInOutCubic(t) // cubic for cinematic ease-in / ease-out

    // Position — linear lerp on eased t (straight-line arc between positions)
    camera.position.lerpVectors(startPos.current, destPos.current, eased)

    // FOV — smooth tween in tandem with position
    const newFov = startFov.current + (destFov.current - startFov.current) * eased
    if (Math.abs(camera.fov - newFov) > 0.01) {
      camera.fov = newFov
      camera.updateProjectionMatrix()
    }

    // Target / lookAt — drive orientation directly during tween.
    // Do NOT call controls.update() here: it recomputes camera.position from
    // its internal spherical state and would override our lerpVectors result.
    const tx = startTgt.current.x + (destTgt.current.x - startTgt.current.x) * eased
    const ty = startTgt.current.y + (destTgt.current.y - startTgt.current.y) * eased
    const tz = startTgt.current.z + (destTgt.current.z - startTgt.current.z) * eased
    if (controlsRef.current) controlsRef.current.target.set(tx, ty, tz)
    camera.lookAt(tx, ty, tz)

    // Tween complete — sync OrbitControls then re-snap to exact dest values.
    // The re-snap eliminates any float drift that controls.update() can introduce,
    // so startPos for the next tween is always pixel-accurate.
    if (t >= 1) {
      if (controlsRef.current) {
        controlsRef.current.target.copy(destTgt.current)
        controlsRef.current.update()
      }
      camera.position.copy(destPos.current)
      camera.fov = destFov.current
      camera.updateProjectionMatrix()
      camera.lookAt(destTgt.current.x, destTgt.current.y, destTgt.current.z)
      startPos.current.copy(destPos.current)
      startTgt.current.copy(destTgt.current)
      startFov.current = destFov.current
      settled.current = true
    }
  }, -2)

  const initPreset = CAMERA_CONFIG[cameraPreset] ?? CAMERA_CONFIG.default

  return (
    <OrbitControls
      ref={controlsRef}
      target={initPreset.target}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI * 0.47}
      minPolarAngle={0.05}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      enableRotate={orbitEnabled}        // zoom-only mode keeps rotate off
      rotateSpeed={0.45}
      zoomSpeed={0.65}
      enabled={orbitEnabled || zoomEnabled}
    />
  )
})
