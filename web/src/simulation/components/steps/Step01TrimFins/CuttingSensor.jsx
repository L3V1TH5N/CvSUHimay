// src/simulation/components/steps/Step01TrimFins/CuttingSensor.jsx
// ── COPIED COLLISION HANDLING + CUT PROGRESS SYSTEM (Step01Preview.jsx) ──────
// Global pointer-event handler that mirrors DorsalCutSensor (Step04). For each
// uncut fin, computes the closest world point between the cursor's camera ray
// and the fin's indicator line segment. On pointerdown near a fin's line
// (devRatio ≤ START_PATH_RATIO), locks onto that fin; on pointermove, extends
// the [fromT..toT] coverage span. Completes the cut when the span reaches both
// endpoints (fromT ≤ END_TOL && toT ≥ 1 − END_TOL).
//
// Drift past WRONG_PATH_RATIO stalls coverage (no reset). Coverage is monotonic
// — it only grows. Single-frame pointer jumps beyond JUMP_TOL are filtered.

import { useMemo, useRef, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { logEvent }                  from '../../../fsm/eventStream'
import { EVENT_TYPE, ERROR_CLASS }   from '../../../fsm/errors'
import {
  FINS, FISH_POS,
  START_PATH_RATIO, WRONG_PATH_RATIO, JUMP_TOL, END_TOL,
} from './step01Config'

const STEP_ID = 1

export function CuttingSensor({ trimmed, coverages, activeFinIdRef, activeCutPointRef, onCut, expectedFinId, onWrongOrder, checkTool }) {
  const { camera } = useThree()

  // World-space line endpoints per fin — fixed positions, computed once.
  const finLines = useMemo(() => FINS.map((fin) => {
    const rot = fin.rotation ?? [0, 0, 0]
    const q   = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]))
    const fp  = new THREE.Vector3(
      FISH_POS[0] + fin.offset[0],
      FISH_POS[1] + fin.offset[1],
      FISH_POS[2] + fin.offset[2],
    )
    return {
      id: fin.id,
      a:  new THREE.Vector3(-fin.lineHalf, 0, 0).applyQuaternion(q).add(fp),
      b:  new THREE.Vector3( fin.lineHalf, 0, 0).applyQuaternion(q).add(fp),
    }
  }), [])

  // Pre-allocated work objects — zero heap per frame.
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndc       = useMemo(() => new THREE.Vector2(), [])
  const segDir    = useMemo(() => new THREE.Vector3(), [])
  const toA       = useMemo(() => new THREE.Vector3(), [])
  const cutPoint  = useMemo(() => new THREE.Vector3(), [])
  const onLine    = useMemo(() => new THREE.Vector3(), [])

  const sizeRef        = useRef({
    width:  typeof window !== 'undefined' ? window.innerWidth  : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  })
  const pointerDownRef = useRef(false)
  const lastTRef       = useRef(0)
  const doneFinsRef    = useRef(new Set())

  // Refs keep latest prop values accessible inside event handlers without
  // forcing the listener useEffect to re-register on every trimmed change.
  const expectedFinIdRef = useRef(expectedFinId)
  const onWrongOrderRef  = useRef(onWrongOrder)
  const checkToolRef     = useRef(checkTool)
  useEffect(() => { expectedFinIdRef.current = expectedFinId }, [expectedFinId])
  useEffect(() => { onWrongOrderRef.current  = onWrongOrder  }, [onWrongOrder])
  useEffect(() => { checkToolRef.current     = checkTool     }, [checkTool])

  useFrame(({ size }) => { sizeRef.current = size })

  // Reset doneFinsRef when `trimmed` clears (step retry).
  useEffect(() => {
    if (trimmed.size === 0) doneFinsRef.current = new Set()
  }, [trimmed])

  // ── CUTTING LINE COLLISION ───────────────────────────────────────────────
  // Closest point between camera ray through (x, y) and line A→B in world
  // space. Writes the world cut point into `cutPoint`; returns
  // { t, devRatio } where t is the parametric position on the line (0..1)
  // and devRatio is perpendicular distance normalized by line length.
  const computeRayVsLine = useCallback((x, y, lineA, lineB) => {
    const { width, height } = sizeRef.current
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const O = raycaster.ray.origin
    const D = raycaster.ray.direction

    segDir.subVectors(lineB, lineA)
    const e = segDir.dot(segDir)
    if (e < 1e-8) return null
    const segLen = Math.sqrt(e)

    toA.subVectors(O, lineA)
    const b     = D.dot(segDir)
    const c     = D.dot(toA)
    const fd    = segDir.dot(toA)
    const denom = e - b * b
    if (denom < 1e-8) return null

    let u = (fd - c * b) / denom
    if (u < 0) u = 0
    else if (u > 1) u = 1
    const s = u * b - c

    cutPoint.copy(O).addScaledVector(D, s)
    onLine.copy(lineA).addScaledVector(segDir, u)
    const devRatio = cutPoint.distanceTo(onLine) / segLen
    return { t: u, devRatio }
  }, [camera, raycaster, ndc, segDir, toA, cutPoint, onLine])

  useEffect(() => {
    // Pick the uncut fin whose line is closest to the camera ray at (x, y).
    const closestUncutFin = (x, y) => {
      let best = null
      for (const { id, a, b } of finLines) {
        if (trimmed.has(id) || doneFinsRef.current.has(id)) continue
        const res = computeRayVsLine(x, y, a, b)
        if (!res) continue
        if (!best || res.devRatio < best.devRatio) {
          best = { id, t: res.t, devRatio: res.devRatio }
        }
      }
      return best
    }

    const onDown = (e) => {
      if (pointerDownRef.current) return
      if (!checkToolRef.current()) return  // wrong tool — error dispatched, bail
      const best = closestUncutFin(e.clientX, e.clientY)
      if (!best || best.devRatio > START_PATH_RATIO) return

      // Wrong-order guard: student clicked a real fin but not the expected one.
      const expected = expectedFinIdRef.current
      if (expected !== null && best.id !== expected) {
        logEvent(STEP_ID, EVENT_TYPE.ERROR, {
          phase:         'trim_fins',
          errorClass:    ERROR_CLASS.WRONG_CUT_PATH,
          attempted:     best.id,
          expected,
          geometricTrace: { x: e.clientX, y: e.clientY },
        })
        onWrongOrderRef.current?.(best.id)
        return  // don't arm the cut
      }

      pointerDownRef.current   = true
      activeFinIdRef.current   = best.id
      lastTRef.current         = best.t
      const cov = coverages[best.id]
      cov.fromT = best.t
      cov.toT   = best.t
      activeCutPointRef.current.copy(cutPoint)

      logEvent(STEP_ID, EVENT_TYPE.GESTURE_START, {
        phase: 'trim_fins', finIndex: best.id,
        geometricTrace: { x: e.clientX, y: e.clientY, devRatio: best.devRatio },
      })
    }

    const onMove = (e) => {
      if (!pointerDownRef.current || activeFinIdRef.current == null) return
      const id   = activeFinIdRef.current
      const line = finLines[id]
      const res  = computeRayVsLine(e.clientX, e.clientY, line.a, line.b)
      if (!res) return

      // Knife visual snaps to the line during the cut.
      activeCutPointRef.current.copy(cutPoint)

      // Drift past WRONG_PATH_RATIO → stall (don't extend coverage).
      if (res.devRatio > WRONG_PATH_RATIO) return

      // Filter single-frame t jumps from pointer teleport / re-entry.
      if (Math.abs(res.t - lastTRef.current) > JUMP_TOL) {
        lastTRef.current = res.t
        return
      }
      lastTRef.current = res.t

      // Cumulative coverage grows monotonically.
      const cov = coverages[id]
      if (res.t > cov.toT)   cov.toT   = res.t
      if (res.t < cov.fromT) cov.fromT = res.t

      // ── CUT COMPLETION TRIGGER ─────────────────────────────────────────
      // Drag span touches both endpoints → cut completes for this fin.
      if (cov.fromT <= END_TOL && cov.toT >= 1 - END_TOL && !doneFinsRef.current.has(id)) {
        doneFinsRef.current.add(id)
        cov.fromT = 0
        cov.toT   = 1
        pointerDownRef.current = false
        activeFinIdRef.current = null
        logEvent(STEP_ID, EVENT_TYPE.GESTURE_END, {
          phase: 'trim_fins', finIndex: id,
          geometricTrace: { x: e.clientX, y: e.clientY },
        })
        onCut(id)
      }
    }

    const onUp = () => {
      if (!pointerDownRef.current) return
      pointerDownRef.current = false
      activeFinIdRef.current = null
      // Coverage is preserved — re-clicking re-initializes to {t,t}.
    }

    window.addEventListener('pointerdown',   onDown)
    window.addEventListener('pointermove',   onMove)
    window.addEventListener('pointerup',     onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown',   onDown)
      window.removeEventListener('pointermove',   onMove)
      window.removeEventListener('pointerup',     onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [trimmed, finLines, computeRayVsLine, activeFinIdRef, activeCutPointRef, coverages, onCut, cutPoint, checkTool])

  return null
}
