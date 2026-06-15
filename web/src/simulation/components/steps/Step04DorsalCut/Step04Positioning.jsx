// src/simulation/components/steps/Step04DorsalCut/Step04Positioning.jsx
// Hook: usePositionFish — Phase A of Step 4.
// The student rolls the fish from flat → dorsal-up before the dorsal cut.

import { useRef, useState, useEffect } from 'react'
import { HINT_STYLE } from '../shared/stepUtils'

// ── Tuning ────────────────────────────────────────────────────────────────────
export const POSITION_START  = 0
export const POSITION_TARGET = Math.PI / 2
const TOLERANCE   = 0.38
const OVERSHOOT   = 0.30
const GESTURE_DIR = -1
const DIR         = Math.sign(POSITION_TARGET - POSITION_START) || 1
const SENSITIVITY = 0.016 * DIR * GESTURE_DIR
const WHEEL_STEP  = 0.12  * DIR * GESTURE_DIR
const CLAMP_LO    = Math.min(POSITION_START, POSITION_TARGET) - OVERSHOOT
const CLAMP_HI    = Math.max(POSITION_START, POSITION_TARGET) + OVERSHOOT
const RANGE       = POSITION_TARGET - POSITION_START

export function usePositionFish(active, onAligned) {
  const rotationOffsetRef = useRef(0)
  const rotatingRef       = useRef(false)
  const startYRef         = useRef(0)
  const startValRef       = useRef(0)

  const [aligned, setAligned] = useState(false)
  const [pct,     setPct]     = useState(0)

  useEffect(() => {
    if (!active) return
    rotationOffsetRef.current = POSITION_START
    rotatingRef.current       = false
    setAligned(false)
    setPct(0)
  }, [active])

  useEffect(() => {
    if (!active) return

    const apply = (raw) => {
      const clamped = Math.max(CLAMP_LO, Math.min(CLAMP_HI, raw))
      rotationOffsetRef.current = clamped

      const pctVal = Math.max(0, Math.min(100, ((clamped - POSITION_START) / RANGE) * 100))
      const bucket = Math.round(pctVal / 5) * 5
      setPct(prev => (prev === bucket ? prev : bucket))

      const isAligned = Math.abs(clamped - POSITION_TARGET) < TOLERANCE
      setAligned(prev => (prev === isAligned ? prev : isAligned))
      return isAligned
    }

    const onDown = (e) => {
      if (!(e.target instanceof HTMLCanvasElement)) return
      rotatingRef.current = true
      startYRef.current   = e.clientY
      startValRef.current = rotationOffsetRef.current
      document.body.style.cursor = 'grabbing'
    }
    const onMove = (e) => {
      if (!rotatingRef.current) return
      const delta = (startYRef.current - e.clientY) * SENSITIVITY
      const isAligned = apply(startValRef.current + delta)
      // Advance immediately when dragging into the aligned band — no release needed.
      if (isAligned) onAligned?.()
    }
    const onUp = () => {
      if (!rotatingRef.current) return
      rotatingRef.current = false
      document.body.style.cursor = 'grab'
      if (Math.abs(rotationOffsetRef.current - POSITION_TARGET) < TOLERANCE) {
        onAligned?.()
      }
    }
    const onWheel = (e) => {
      apply(rotationOffsetRef.current - Math.sign(e.deltaY) * WHEEL_STEP)
      if (!rotatingRef.current &&
          Math.abs(rotationOffsetRef.current - POSITION_TARGET) < TOLERANCE) {
        onAligned?.()
      }
    }

    document.body.style.cursor = 'grab'
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    window.addEventListener('wheel',       onWheel, { passive: true })

    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      window.removeEventListener('wheel',       onWheel)
    }
  }, [active, onAligned])

  const domUI = active ? (
    <div style={{
      ...HINT_STYLE,
      flexDirection: 'column', gap: '8px', borderRadius: '16px',
      padding: '12px 22px', minWidth: '300px',
      background: 'rgba(4,20,8,0.92)',
      border: `2px solid ${aligned ? 'rgba(78,205,113,0.9)' : 'rgba(245,200,66,0.55)'}`,
      transition: 'border-color 0.2s',
    }}>
      <span>
        {aligned
          ? '✅ Perfect! Dorsal side up — nice work!'
          : `⬇️ Drag down (or scroll) to lay the fish flat — dorsal up  (${pct}%)`}
      </span>
      <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: aligned
            ? 'linear-gradient(90deg, #4ecd71, #a8f0b8)'
            : 'linear-gradient(90deg, #f5c842, #4ecd71)',
          borderRadius: '3px', transition: 'width 0.05s linear, background 0.2s',
        }} />
      </div>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
        Drag anywhere on the scene · mouse wheel also rotates
      </span>
    </div>
  ) : null

  return { rotationOffsetRef, domUI, aligned, pct }
}
