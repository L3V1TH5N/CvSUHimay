// web/src/simulation/components/ui/HintPanel.jsx
//
// On-demand 2-level hint panel rendered inside the step checklist.
// Resets to idle state whenever the active step changes.
//
// Props:
//   stepId    — current simulation step (1-11)
//   hints     — { 1: string, 2: string } from stepDefinitions
//   onUseHint — FSM callback: (stepId, level) => void

import { useState, useEffect, memo } from 'react'

const FONT = "'Rajdhani', 'Segoe UI', sans-serif"

export const HintPanel = memo(function HintPanel({ stepId, hints, onUseHint }) {
  const [level, setLevel] = useState(0)  // 0 = not used, 1 = L1 shown, 2 = L2 shown

  // Reset to idle whenever the student advances to a new step.
  useEffect(() => {
    setLevel(0)
  }, [stepId])

  if (!hints?.[1]) return null

  function handleGetHint() {
    setLevel(1)
    onUseHint?.(stepId, 1)
  }

  function handleGoDeeper() {
    setLevel(2)
    onUseHint?.(stepId, 2)
  }

  // ── State 0: button only ───────────────────────────────────────────────────
  if (level === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '3px 2px 5px 2px',
      }}>
        <button
          onClick={handleGetHint}
          style={{
            flex: 1,
            background: 'rgba(78,205,113,0.1)',
            border: '1px solid rgba(78,205,113,0.35)',
            borderRadius: '6px',
            padding: '7px 10px',
            color: '#4ecd71',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONT,
            letterSpacing: '0.05em',
            pointerEvents: 'auto',
          }}
        >
          💡 Get Hint
        </button>
        <span style={{ color: '#ff8888', fontSize: '13px', whiteSpace: 'nowrap', fontFamily: FONT }}>
          −10% if used
        </span>
      </div>
    )
  }

  // ── State 1: Level 1 revealed ──────────────────────────────────────────────
  if (level === 1) {
    return (
      <div style={{ margin: '3px 2px 5px 2px' }}>
        <div style={{
          background: 'rgba(78,205,113,0.06)',
          border: '1px solid rgba(78,205,113,0.25)',
          borderLeft: '3px solid rgba(78,205,113,0.6)',
          borderRadius: '0 7px 7px 0',
          padding: '8px 10px',
          marginBottom: '4px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#4ecd71', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: FONT }}>
              💡 HINT LEVEL 1
            </span>
            <span style={{ color: '#ff8888', fontSize: '13px', fontWeight: 700, fontFamily: FONT }}>
              −10% applied
            </span>
          </div>
          <div style={{ color: '#c8e0cc', fontSize: '14px', lineHeight: 1.5, fontFamily: FONT }}>
            {hints[1]}
          </div>
        </div>
        <button
          onClick={handleGoDeeper}
          style={{
            width: '100%',
            background: 'rgba(245,200,66,0.1)',
            border: '1px solid rgba(245,200,66,0.3)',
            borderRadius: '5px',
            padding: '7px 8px',
            color: '#f5c842',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONT,
            pointerEvents: 'auto',
          }}
        >
          Go deeper → Level 2 (−20% total)
        </button>
      </div>
    )
  }

  // ── State 2: Both levels revealed ─────────────────────────────────────────
  return (
    <div style={{ margin: '3px 2px 5px 2px' }}>
      {/* Level 1 — dimmed for reference */}
      <div style={{
        background: 'rgba(78,205,113,0.04)',
        border: '1px solid rgba(78,205,113,0.15)',
        borderLeft: '3px solid rgba(78,205,113,0.3)',
        borderRadius: '0 7px 7px 0',
        padding: '7px 10px',
        marginBottom: '3px',
        opacity: 0.7,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ color: '#4ecd71', fontSize: '12px', fontWeight: 700, fontFamily: FONT }}>💡 HINT LEVEL 1</span>
          <span style={{ color: '#ff8888', fontSize: '12px', fontFamily: FONT }}>−10%</span>
        </div>
        <div style={{ color: '#7a9e80', fontSize: '13px', lineHeight: 1.4, fontFamily: FONT }}>
          {hints[1]}
        </div>
      </div>

      {/* Level 2 — amber accent */}
      <div style={{
        background: 'rgba(245,200,66,0.06)',
        border: '1px solid rgba(245,200,66,0.3)',
        borderLeft: '3px solid rgba(245,200,66,0.7)',
        borderRadius: '0 7px 7px 0',
        padding: '8px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#f5c842', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: FONT }}>
            💡 HINT LEVEL 2
          </span>
          <span style={{ color: '#ff8888', fontSize: '13px', fontWeight: 700, fontFamily: FONT }}>
            −20% total
          </span>
        </div>
        <div style={{ color: '#e0d0a0', fontSize: '14px', lineHeight: 1.5, fontFamily: FONT }}>
          {hints[2]}
        </div>
      </div>
    </div>
  )
})
