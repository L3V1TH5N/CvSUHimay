// src/simulation/components/fish/DorsalCutGuide.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Glowing dorsal-cut guide — straight head→tail line.
//
// Three jobs, zero per-frame allocation on steady state:
//   1) Renders the yellow anatomical guide line (straight segment built in
//      dorsalSpline.js from the fish's bounding box).
//   2) Renders a red "cut so far" overlay segment spanning the fraction
//      [fromT..toT] of the yellow line — read from cutCoverageRef each frame,
//      geometry rebuilt only when either endpoint crosses a 5 %-bucket.
//   3) Projects the 2 line endpoints to screen-pixel space every frame and
//      writes them into screenPolylineRef — so Step04DorsalCut's DOM-level
//      pointermove validator can score cursor proximity without touching R3F.
//
// Optimization:
//   • Line endpoints built ONCE at GLB load (useMemo).
//   • Reused THREE.Vector3 + reused Float32Array for screen projections.
//   • Red overlay rebuilt ≤ ~40 times per run (2 endpoints × 20 buckets).
//   • Pulse uses a single material.opacity write per frame.
//   • Returns null when not visible — no useFrame work.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useGLTF } from '../../utils/useGLTFLocal'
import * as THREE from 'three'
import { buildDorsalSpline } from '../steps/Step04DorsalCut/dorsalSpline'

// No-op raycast — stops the line (which floats above the fish) from
// intercepting pointer events. Without this, cut gestures never start.
const NO_RAYCAST = () => null

// Matches FishModel's cuttingBoard placement/scale so the guide sits exactly
// on the dorsal surface of the visible mesh.
const FISH_WORLD_CUTTING = [1.03, 1.2, -1.99]
const FISH_BAKED_Y       = Math.PI / 2
const FISH_SCALE         = 0.75
const PULSE_HZ           = 1.4

// Bucket granularity for red-overlay rebuilds. 0.05 → 20 buckets per endpoint.
const BUCKET_STEP = 0.05
// Minimum span before the red overlay is drawn at all (avoids zero-length Line2).
const MIN_SPAN    = 0.015

export function DorsalCutGuide({
  visible,
  rotationOffsetRef = null,
  screenPolylineRef = null,   // { points: Float32Array, arcLengths, totalLen, screenLen }
  cutCoverageRef    = null,   // { fromT: 0..1, toT: 0..1 } — read each frame
}) {
  const groupRef = useRef()
  const guideRef = useRef()
  const { scene } = useGLTF('/models/bangus3.opt.glb')
  const { camera, size } = useThree()

  // Build the straight line once. head/tail are reused for red-overlay lerp.
  const { head, tail, samples, arcLengths, totalLen, samplePoints } = useMemo(() => {
    const built = buildDorsalSpline(scene, {
      scale: FISH_SCALE, rotationY: FISH_BAKED_Y,
    })
    return {
      head:         built.samples[0],
      tail:         built.samples[1],
      samples:      built.samples,
      arcLengths:   built.arcLengths,
      totalLen:     built.totalLen,
      samplePoints: built.samples.map((p) => [p.x, p.y, p.z]),
    }
  }, [scene])

  // Reused vectors/buffers — one allocation ever.
  const v         = useMemo(() => new THREE.Vector3(), [])
  const screenBuf = useMemo(() => new Float32Array(samples.length * 2), [samples.length])

  // ── Red "cut so far" overlay — rebuilt only when fromT or toT flips bucket ──
  // donePoints is an array of 2 [x,y,z] tuples lerped from head/tail.
  const [donePoints, setDonePoints] = useState(null)
  const lastFromBucketRef = useRef(-1)
  const lastToBucketRef   = useRef(-1)

  // Kill raycasting on every child in the guide subtree whenever the subtree
  // grows (i.e., the done-line mounts). Keeps cursor events hitting the fish.
  useEffect(() => {
    const kill = (r) => {
      if (!r) return
      r.raycast = NO_RAYCAST
      r.traverse?.((c) => { c.raycast = NO_RAYCAST })
    }
    kill(groupRef.current)
    kill(guideRef.current)
  }, [donePoints])

  useFrame(() => {
    const g = groupRef.current
    if (!visible || !g) return

    // Match the fish's current X-axis roll so the guide stays glued to dorsum.
    g.rotation.x = rotationOffsetRef?.current ?? 0

    // Pulse via direct material write — no React re-render.
    if (guideRef.current?.material) {
      const t = performance.now() * 0.001 * Math.PI * 2 * PULSE_HZ
      guideRef.current.material.opacity = 0.55 + Math.sin(t) * 0.35
    }

    // ── Red overlay bucketing ────────────────────────────────────────────────
    // Rebuild geometry only when either endpoint crosses a 5 %-bucket.
    const cov    = cutCoverageRef?.current
    const fromT  = cov ? Math.max(0, Math.min(1, cov.fromT)) : 0
    const toT    = cov ? Math.max(0, Math.min(1, cov.toT))   : 0
    const fBucket = Math.round(fromT / BUCKET_STEP)
    const tBucket = Math.round(toT   / BUCKET_STEP)

    if (fBucket !== lastFromBucketRef.current || tBucket !== lastToBucketRef.current) {
      lastFromBucketRef.current = fBucket
      lastToBucketRef.current   = tBucket

      if (toT - fromT < MIN_SPAN) {
        if (donePoints !== null) setDonePoints(null)
      } else {
        // Lerp head→tail at fromT/toT to get the red segment endpoints.
        const ax = head.x + (tail.x - head.x) * fromT
        const ay = head.y + (tail.y - head.y) * fromT
        const az = head.z + (tail.z - head.z) * fromT
        const bx = head.x + (tail.x - head.x) * toT
        const by = head.y + (tail.y - head.y) * toT
        const bz = head.z + (tail.z - head.z) * toT
        setDonePoints([[ax, ay, az], [bx, by, bz]])
      }
    }

    // ── Screen projection: feed the DOM-side cut validator ──────────────────
    if (screenPolylineRef?.current) {
      let screenLen = 0
      for (let i = 0; i < samples.length; i++) {
        v.copy(samples[i]).applyMatrix4(g.matrixWorld).project(camera)
        const x = ( v.x + 1) * 0.5 * size.width
        const y = (-v.y + 1) * 0.5 * size.height
        screenBuf[i * 2]     = x
        screenBuf[i * 2 + 1] = y
        if (i > 0) {
          const dx = x - screenBuf[(i - 1) * 2]
          const dy = y - screenBuf[(i - 1) * 2 + 1]
          screenLen += Math.hypot(dx, dy)
        }
      }
      const ref = screenPolylineRef.current
      ref.points     = screenBuf
      ref.arcLengths = arcLengths
      ref.totalLen   = totalLen
      ref.screenLen  = screenLen
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={FISH_WORLD_CUTTING}>
      {/* Anatomical guide line — target path (straight head → tail) */}
      <Line
        ref={guideRef}
        points={samplePoints}
        color="#a70101"
        lineWidth={9}
        transparent
        opacity={2.0}
        depthTest={false}
        raycast={NO_RAYCAST}
      />
      {/* "Cut so far" slit — three stacked Line2s build a readable wound:
          1) wide dark maroon base reads as torn skin on the dorsum
          2) mid crimson band adds body to the gash
          3) bright coral/pink core is the fresh-cut highlight, catches the eye */}
      {donePoints && (
        <>
          <Line
            points={donePoints}
            color="#2a0202"
            lineWidth={16}
            transparent
            opacity={1}
            depthTest={false}
            raycast={NO_RAYCAST}
          />
          <Line
            points={donePoints}
            color="#9e1a1a"
            lineWidth={9}
            transparent
            opacity={1}
            depthTest={false}
            raycast={NO_RAYCAST}
          />
          <Line
            points={donePoints}
            color="#ff5a5a"
            lineWidth={3}
            transparent
            opacity={1}
            depthTest={false}
            raycast={NO_RAYCAST}
          />
        </>
      )}
    </group>
  )
}

useGLTF.preload('/models/bangus3.opt.glb')
