// src/simulation/components/steps/Step02Washing/WashHintUI.jsx
//
// Self-contained overlay for the wash-step progress bar and hint text.
//
// State (holding, washing, progress, flash, drainError) lives HERE instead
// of in useWashStep / SimulationInner. That means cursor hover events and
// 30 Hz progress ticks only re-render this tiny component — not the full
// 11-hook StepManager chain that lives in SimulationInner.
//
// Usage: <WashHintUI notifyRef={ref} />
// Parent calls: notifyRef.current({ holding: true }) — any partial patch.

import { useState, useEffect } from 'react'

const INITIAL_STATE = {
  holding: false, washing: false, progress: 0, flash: false, drainError: false,
}

export function WashHintUI({ notifyRef }) {
  const [s, setS] = useState(INITIAL_STATE)

  useEffect(() => {
    // Expose a patch-style setter so callers never need to read current state.
    notifyRef.current = (patch) => setS((prev) => ({ ...prev, ...patch }))
    return () => { notifyRef.current = null }
  }, [notifyRef])

  const { holding, washing, progress, flash, drainError } = s
  const idleOnFish = holding && !washing && !flash

  const borderColor = flash       ? 'rgba(78,205,113,0.9)'
                    : drainError  ? 'rgba(255,80,80,0.85)'
                    : holding     ? 'rgba(78,205,113,0.8)'
                    :               'rgba(78,205,113,0.35)'

  return (
    <div style={{
      position: 'absolute', bottom: '90px', left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      background: flash ? 'rgba(10,60,20,0.97)' : drainError ? 'rgba(40,4,4,0.95)' : 'rgba(4,20,8,0.92)',
      border: `2px solid ${borderColor}`,
      borderRadius: '20px', padding: '12px 28px',
      transition: 'background 0.3s, border-color 0.3s',
      fontFamily: "'Rajdhani', sans-serif",
      backdropFilter: 'blur(10px)',
      zIndex: 101, pointerEvents: 'none',
      minWidth: '240px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '20px' }}>{flash ? '✅' : '💧'}</span>
        <span style={{
          color: flash ? '#4ecd71' : holding ? '#4ecd71' : '#8aab90',
          fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em',
        }}>
          {flash        ? 'Fish washed clean!'
            : drainError ? 'Keep moving! Progress is draining'
            : holding    ? `Washing… ${progress}%`
            :               'Move cursor over the fish to wash'}
        </span>
      </div>

      {!flash && (
        <div style={{
          width: '100%', height: '6px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '3px', overflow: 'hidden',
          boxShadow: idleOnFish
            ? '0 0 8px 3px rgba(220,50,50,0.55), 0 0 20px 6px rgba(200,20,20,0.22)'
            : '0 0 0px 0px rgba(220,50,50,0)',
          transition: 'box-shadow 1.4s ease',
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: drainError ? '#ff4444' : holding ? 'linear-gradient(90deg,#4ecd71,#88ffaa)' : '#2a8040',
            borderRadius: '3px',
            transition: 'width 0.08s linear, background 0.3s',
          }} />
        </div>
      )}

      {drainError && (
        <div style={{
          color: '#ff6b6b', fontSize: '12px',
          fontFamily: "'Rajdhani', sans-serif", fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          ❌ Don&apos;t stop — points deducted!
        </div>
      )}
    </div>
  )
}
