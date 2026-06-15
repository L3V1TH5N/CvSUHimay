// src/simulation/components/ui/CompletionScreen.jsx
import { useFSM } from '../../fsm/FSMProvider'
import { STEP_DEFINITIONS } from '../../config/stepDefinitions'

function ScoreBar({ label, earned, max }) {
  const pct = max > 0 ? Math.round((earned / max) * 100) : 0
  const barColor = pct >= 80 ? '#4ecd71' : pct >= 50 ? '#f5c842' : '#ff6b6b'
  return (
    <div style={{ marginBottom: '7px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ color: '#a8c8b0', fontSize: '14px', fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#f5c842', fontSize: '14px', fontWeight: 700 }}>{earned}/{max}</span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor,
          borderRadius: '3px',
          transition: 'width 1s ease 0.3s',
        }} />
      </div>
    </div>
  )
}

function StatusBanner({ submitState, onRetry }) {
  if (submitState === 'idle') return null

  const config = {
    saving: {
      bg:    'rgba(80,120,180,0.10)',
      border:'rgba(120,180,255,0.35)',
      color: '#8fc1ff',
      icon:  '⏳',
      text:  'Saving your run…',
    },
    saved: {
      bg:    'rgba(78,205,113,0.10)',
      border:'rgba(78,205,113,0.35)',
      color: '#4ecd71',
      icon:  '✓',
      text:  'Run saved successfully',
    },
    partial: {
      bg:    'rgba(245,200,66,0.10)',
      border:'rgba(245,200,66,0.40)',
      color: '#f5c842',
      icon:  '⚠',
      text:  'Attempt recorded — analytics save failed.',
    },
    failed: {
      bg:    'rgba(255,107,107,0.10)',
      border:'rgba(255,107,107,0.40)',
      color: '#ff9a9a',
      icon:  '✕',
      text:  "Couldn't save your run. Try again or close.",
    },
  }[submitState] ?? null
  if (!config) return null

  const canRetry = (submitState === 'failed' || submitState === 'partial') && typeof onRetry === 'function'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 12px',
      marginBottom: '14px',
      background: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 600,
      color: config.color,
    }}>
      <span style={{ fontSize: '16px', lineHeight: 1 }}>{config.icon}</span>
      <span style={{ flex: 1 }}>{config.text}</span>
      {canRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${config.border}`,
            borderRadius: '6px',
            color: config.color,
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function CompletionScreen({
  onExit,
  onRestart,
  submitState = 'idle',
  onRetry,
  serverScore,
}) {
  const {
    scorePercent,
    completedSteps,
    stepScores,
    elapsedSeconds,
    bonesRemoved,
    hintsUsed,
    stepErrors,
  } = useFSM()

  const totalErrors = Object.values(stepErrors).reduce((sum, e) => sum + e, 0)

  // Use server-verified score when available; fall back to client estimate.
  const displayScore = serverScore ?? scorePercent
  const passed       = displayScore >= 60
  const grade        = displayScore >= 90 ? 'A' : displayScore >= 80 ? 'B' : displayScore >= 70 ? 'C' : displayScore >= 60 ? 'D' : 'F'
  const totalBones = (bonesRemoved.rib ?? 0) + bonesRemoved.dorsal + bonesRemoved.ventral + bonesRemoved.lateral
  const mins       = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const secs       = (elapsedSeconds % 60).toString().padStart(2, '0')
  const timeStr    = `${mins}:${secs}`

  return (
    // Outer overlay — subtle vignette so the 3D kitchen environment shows through.
    // pointerEvents:'auto' overrides the inherited 'none' from BangusDeboningSim's
    // UI wrapper div (same pattern used by ExitConfirmModal in StatsPanel).
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(160deg, rgba(0,6,2,0.30) 0%, rgba(0,10,4,0.55) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '16px',
      zIndex: 200,
      pointerEvents: 'auto',
      fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
    }}>

      {/* Frosted-glass card — blurs the kitchen behind it for readability */}
      <div style={{
        background: 'rgba(3,12,5,0.84)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: `1.5px solid ${passed ? 'rgba(78,205,113,0.40)' : 'rgba(255,107,107,0.35)'}`,
        borderRadius: '20px',
        padding: '28px 32px',
        width: '500px',
        maxWidth: '95vw',
        maxHeight: '88vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>

        {/* ── Save status banner (hidden when submitState === 'idle') ── */}
        <StatusBanner submitState={submitState} onRetry={onRetry} />

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '8px' }}>
            {passed ? '🏆' : '📋'}
          </div>
          <h2 style={{
            margin: 0,
            fontSize: '30px',
            fontWeight: 800,
            color: passed ? '#4ecd71' : '#ff9a9a',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {passed ? 'Simulation Complete!' : 'Practice Complete'}
          </h2>
          <p style={{ color: 'rgba(107,158,120,0.8)', fontSize: '15px', margin: '5px 0 0', letterSpacing: '0.04em' }}>
            Bangus Deboning · {completedSteps.length}/{STEP_DEFINITIONS.length} steps finished
          </p>
        </div>

        {/* ── Score block ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          marginBottom: '20px',
          padding: '16px 20px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: '72px', height: '72px',
            borderRadius: '50%',
            border: `2.5px solid ${passed ? '#4ecd71' : '#ff6b6b'}`,
            background: passed ? 'rgba(78,205,113,0.08)' : 'rgba(255,107,107,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '34px',
            fontWeight: 800,
            color: passed ? '#4ecd71' : '#ff6b6b',
            flexShrink: 0,
          }}>
            {grade}
          </div>

          <div>
            <div style={{ color: 'rgba(107,158,120,0.7)', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
              Total Score
            </div>
            <div style={{ fontSize: '44px', fontWeight: 800, lineHeight: 1, color: '#f5c842' }}>
              {displayScore}
              <span style={{ fontSize: '20px', color: 'rgba(90,122,98,0.75)', fontWeight: 500 }}>/100</span>
            </div>
            <div style={{ color: passed ? '#4ecd71' : '#ff9a9a', fontSize: '16px', fontWeight: 700, marginTop: '3px' }}>
              {displayScore}% · {passed ? 'PASSED ✓' : 'NEEDS IMPROVEMENT'}
            </div>
          </div>
        </div>

        {/* ── Step score breakdown ── */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: 'rgba(58,82,64,0.85)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Score Breakdown
          </div>
          {STEP_DEFINITIONS.map(step => (
            <ScoreBar
              key={step.id}
              label={step.shortTitle}
              earned={stepScores[step.id] ?? 0}
              max={step.scoreWeight}
            />
          ))}
        </div>

        {/* ── Stats grid (2×2) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          marginBottom: '20px',
        }}>
          {[
            { icon: '⏱️', label: 'Total Time',     value: timeStr    },
            { icon: '❌', label: 'Total Errors',   value: totalErrors },
            { icon: '🦴', label: 'Bones Removed',  value: totalBones },
            { icon: '💡', label: 'Hints Used',     value: hintsUsed  },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px',
              padding: '11px 8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '22px', marginBottom: '3px' }}>{icon}</div>
              <div style={{ color: '#e8dcc0', fontWeight: 700, fontSize: '20px', lineHeight: 1 }}>{value}</div>
              <div style={{ color: 'rgba(74,100,82,0.85)', fontSize: '13px', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onRestart}
            style={{
              flex: 1,
              padding: '13px',
              background: 'rgba(78,205,113,0.10)',
              border: '1.5px solid rgba(78,205,113,0.40)',
              borderRadius: '10px',
              color: '#4ecd71',
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(78,205,113,0.22)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(78,205,113,0.10)' }}
          >
            🔄 Try Again
          </button>
          <button
            onClick={onExit}
            style={{
              flex: 1,
              padding: '13px',
              background: '#04510e',
              border: '1.5px solid rgba(4,81,14,0.7)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
              boxShadow: '0 4px 14px rgba(4,81,14,0.35)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#066b12' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#04510e' }}
          >
            ← Go Back to Dashboard
          </button>
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700;800&display=swap');
      `}</style>
    </div>
  )
}
