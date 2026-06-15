// src/simulation/components/ui/StatsPanel.jsx
import { useState, useMemo, memo } from 'react'
import { useFSM } from '../../fsm/FSMProvider'
import { STEP_DEFINITIONS, TOTAL_SCORE } from '../../config/stepDefinitions'

// Lookup table: step id → scoreWeight. Built once at module load so the
// progress reducer in StatsPanel is O(n) on completedSteps, not O(n²).
const SCORE_WEIGHT_BY_ID = STEP_DEFINITIONS.reduce((acc, s) => {
  acc[s.id] = s.scoreWeight
  return acc
}, {})

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Exit confirmation modal ───────────────────────────────────────────────────
function ExitConfirmModal({ currentStep, totalStep, elapsedSeconds, totalScore, onConfirm, onCancel }) {
  return (
    // Full-viewport backdrop — needs its own pointer-events since parent overlay is 'none'
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
        pointerEvents: 'auto',
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'linear-gradient(160deg, #061208 0%, #0b1e0f 100%)',
          border: '2px solid rgba(200,80,80,0.55)',
          borderRadius: '20px',
          padding: '36px 40px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,80,80,0.15)',
          pointerEvents: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + heading */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '12px' }}>⚠️</div>
          <h2 style={{
            margin: 0, fontSize: '26px', fontWeight: 800,
            color: '#ff8080', letterSpacing: '0.06em',
          }}>
            Exit Simulation?
          </h2>
        </div>

        {/* Warning body */}
        <div style={{
          background: 'rgba(200,50,50,0.08)',
          border: '1px solid rgba(200,80,80,0.3)',
          borderRadius: '12px',
          padding: '16px 18px',
          marginBottom: '20px',
        }}>
          <p style={{ margin: '0 0 10px', color: '#ffaaaa', fontSize: '16px', lineHeight: 1.6 }}>
            If you exit now, <strong>your current progress will not be saved</strong> and
            you will <strong>receive no score</strong> for this attempt.
          </p>
          <p style={{ margin: 0, color: '#cc7070', fontSize: '14px', lineHeight: 1.5 }}>
            Only completed simulations are recorded in the database.
          </p>
        </div>

        {/* Progress snapshot */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '10px', marginBottom: '28px',
        }}>
          {[
            { label: 'Step Reached', value: `${currentStep} / ${totalStep}` },
            { label: 'Time Spent',   value: formatTime(elapsedSeconds) },
            { label: 'Score',        value: `${totalScore} pts` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '10px 8px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#6b9e78', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                {label}
              </div>
              <div style={{ color: '#e0e8e2', fontWeight: 700, fontSize: '18px' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}  /* = closeConfirm */
            style={{
              flex: 1,
              background: 'rgba(78,205,113,0.12)',
              border: '2px solid rgba(78,205,113,0.5)',
              borderRadius: '10px',
              color: '#4ecd71',
              padding: '12px 0',
              fontSize: '17px', fontWeight: 800,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(78,205,113,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(78,205,113,0.12)' }}
          >
            ← Keep Playing
          </button>

          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              background: 'rgba(200,50,50,0.18)',
              border: '2px solid rgba(200,80,80,0.55)',
              borderRadius: '10px',
              color: '#ff8080',
              padding: '12px 0',
              fontSize: '17px', fontWeight: 800,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,50,50,0.38)'; e.currentTarget.style.color = '#ffbbbb' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,50,50,0.18)'; e.currentTarget.style.color = '#ff8080' }}
          >
            Exit Anyway ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ── StatsPanel ────────────────────────────────────────────────────────────────
// memo: prevents re-renders when SimulationInner re-renders from local wash
// progress state. StatsPanel still re-renders when its FSMStateContext values
// change (TICK every second, ADVANCE_STEP, etc.) — memo only stops unnecessary
// cascades from parent renders that don't affect this panel's output.
export const StatsPanel = memo(function StatsPanel({ onExit }) {
  const { currentStep, totalScore, totalPossibleScore, elapsedSeconds, completedSteps, setPaused } = useFSM()
  const [showConfirm, setShowConfirm] = useState(false)

  const openConfirm  = () => { setPaused(true);  setShowConfirm(true)  }
  const closeConfirm = () => { setPaused(false); setShowConfirm(false) }

  // Point-weighted progress — each completed step contributes its scoreWeight
  // to the bar, so heavy steps (e.g. Dorsal Bones at 20 pts) move the bar
  // more than light ones (e.g. Place Fish at 2 pts). Memoised on
  // completedSteps so the reduce only runs when the set changes.
  const progress = useMemo(() => {
    if (TOTAL_SCORE <= 0) return 0
    let earned = 0
    for (let i = 0; i < completedSteps.length; i++) {
      earned += SCORE_WEIGHT_BY_ID[completedSteps[i]] ?? 0
    }
    return Math.min(100, Math.round((earned / TOTAL_SCORE) * 100))
  }, [completedSteps])

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '70px',
        background: 'linear-gradient(180deg, rgba(4,30,8,0.97) 0%, rgba(4,30,8,0.88) 100%)',
        borderBottom: '2px solid rgba(78,205,113,0.3)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        zIndex: 100,
        backdropFilter: 'blur(8px)',
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
        pointerEvents: 'auto',
      }}>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '24px', minWidth: '200px' }}>
          <img src="/img/fish_logo.png" alt="fish logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <div>
            <div style={{ color: '#4ecd71', fontWeight: 800, fontSize: '18px', letterSpacing: '0.08em', lineHeight: 1 }}>
              BANGUS DEBONING
            </div>
            <div style={{ color: '#6b9e78', fontSize: '13px', letterSpacing: '0.12em' }}>SIMULATION</div>
          </div>
        </div>

        <div style={{ width: '1px', height: '32px', background: 'rgba(78,205,113,0.2)', marginRight: '24px' }} />

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '24px' }}>
          <div style={{ color: '#8aab90', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Step</div>
          <div style={{
            background: 'rgba(78,205,113,0.15)',
            border: '1px solid rgba(78,205,113,0.4)',
            borderRadius: '6px',
            padding: '3px 12px',
            color: '#4ecd71', fontWeight: 700, fontSize: '20px', letterSpacing: '0.05em',
          }}>
            {Math.min(currentStep, STEP_DEFINITIONS.length)} / {STEP_DEFINITIONS.length}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, marginRight: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#6b9e78', fontSize: '13px', letterSpacing: '0.1em' }}>PROGRESS</span>
            <span style={{ color: '#4ecd71', fontSize: '13px', fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ height: '5px', background: 'rgba(78,205,113,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'linear-gradient(90deg, #2e7d32, #4ecd71)',
              borderRadius: '3px', transition: 'width 0.5s ease',
              boxShadow: '0 0 8px rgba(78,205,113,0.5)',
            }} />
          </div>
        </div>

        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '24px' }}>
          <span style={{ fontSize: '16px' }}>🏆</span>
          <div>
            <div style={{ color: '#8aab90', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Score</div>
            <div style={{ color: '#f5c842', fontWeight: 800, fontSize: '20px', lineHeight: 1 }}>
              {totalScore}
              <span style={{ color: '#6b8a5a', fontSize: '13px', fontWeight: 400 }}>/{totalPossibleScore}</span>
            </div>
          </div>
        </div>

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '24px' }}>
          <span style={{ fontSize: '18px' }}>⏱️</span>
          <div>
            <div style={{ color: '#8aab90', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Time</div>
            <div style={{ color: '#e8d8c0', fontWeight: 700, fontSize: '20px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(elapsedSeconds)}
            </div>
          </div>
        </div>

        {/* Exit — opens confirm modal */}
        <button
          onClick={openConfirm}
          style={{
            background: 'rgba(200,50,50,0.15)',
            border: '1px solid rgba(200,80,80,0.4)',
            borderRadius: '8px',
            color: '#ff8080',
            padding: '8px 18px',
            fontSize: '15px', fontWeight: 700, letterSpacing: '0.08em',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,50,50,0.35)'; e.currentTarget.style.color = '#ffaaaa' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,50,50,0.15)'; e.currentTarget.style.color = '#ff8080' }}
        >
          ✕ EXIT
        </button>
      </div>

      {showConfirm && (
        <ExitConfirmModal
          currentStep={Math.min(currentStep, STEP_DEFINITIONS.length)}
          totalStep={STEP_DEFINITIONS.length}
          elapsedSeconds={elapsedSeconds}
          totalScore={totalScore}
          onConfirm={onExit}
          onCancel={closeConfirm}
        />
      )}
    </>
  )
})
