// src/simulation/components/ui/InstructionPanel.jsx
import { memo, useState } from 'react'
import { useFSM, useFSMActions } from '../../fsm/FSMProvider'
import { STEP_DEFINITIONS } from '../../config/stepDefinitions'
import { HintPanel } from './HintPanel'

function StepRow({ step, status, earnedScore }) {
  const colors = {
    done:    { bg: 'rgba(46,125,50,0.15)', border: 'rgba(78,205,113,0.3)', text: '#4ecd71' },
    active:  { bg: 'rgba(78,205,113,0.12)', border: 'rgba(78,205,113,0.6)', text: '#ffffff' },
    pending: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', text: '#4a6452' },
  }
  const c = colors[status]

  let scoreText  = null
  let scoreColor = '#3a5240'
  if (status === 'done' && earnedScore != null) {
    scoreText  = `${earnedScore} / ${step.scoreWeight}`
    const pct  = step.scoreWeight > 0 ? earnedScore / step.scoreWeight : 1
    scoreColor = pct >= 1 ? '#4ecd71' : pct >= 0.5 ? '#f5c842' : '#ff6b6b'
  } else if (status === 'active') {
    scoreText  = `? / ${step.scoreWeight}`
    scoreColor = '#6b9e78'
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: '8px',
      marginBottom: '6px',
      transition: 'all 0.3s',
    }}>
      <span style={{ fontSize: status === 'active' ? '20px' : '15px', minWidth: '22px', textAlign: 'center' }}>
        {status === 'done' ? '✓' : step.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: c.text,
          fontSize: status === 'active' ? '16px' : '14px',
          fontWeight: status === 'active' ? 700 : 500,
          letterSpacing: '0.03em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {step.shortTitle}
        </div>
      </div>
      {scoreText && (
        <div style={{
          fontSize: '13px',
          color: scoreColor,
          fontWeight: 700,
          minWidth: '40px',
          textAlign: 'right',
          transition: 'color 0.3s',
        }}>
          {scoreText}
        </div>
      )}
    </div>
  )
}

// Inline chevron button shared by both panels
const chevronBtnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#4a6452',
  fontSize: '14px',
  padding: '0 2px',
  lineHeight: 1,
  flexShrink: 0,
}

export const InstructionPanel = memo(function InstructionPanel() {
  const { currentStep, completedSteps, currentStepDef, stepScores } = useFSM()
  const { useHint } = useFSMActions()

  const [instructionOpen, setInstructionOpen] = useState(true)
  const [stepsOpen, setStepsOpen]             = useState(true)

  return (
    <>
      {/* ── Instruction Steps — top left ───────────────────────────── */}

      {/* Collapsed tab: visible only when instructionOpen === false */}
      {currentStepDef && (
        <div style={{
          position: 'absolute',
          top: '88px',
          left: '16px',
          zIndex: 100,
          opacity: instructionOpen ? 0 : 1,
          pointerEvents: instructionOpen ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}>
          <button
            onClick={() => setInstructionOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: 'rgba(4,20,8,0.94)',
              border: '2px solid rgba(78,205,113,0.4)',
              borderRadius: '10px',
              backdropFilter: 'blur(10px)',
              cursor: 'pointer',
              color: '#4a6452',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
            }}
          >
            <span>{currentStepDef?.icon ?? '📋'}</span>
            <span>▶ Instruction</span>
          </button>
        </div>
      )}

      {/* Full panel: visible only when instructionOpen === true */}
      {currentStepDef && (
        <div style={{
          position: 'absolute',
          top: '88px',
          left: '16px',
          width: '320px',
          fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
          zIndex: 100,
          opacity: instructionOpen ? 1 : 0,
          pointerEvents: instructionOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}>
          <div style={{
            background: 'rgba(4,20,8,0.94)',
            border: '2px solid rgba(78,205,113,0.5)',
            borderRadius: '14px',
            padding: '18px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(78,205,113,0.1)',
          }}>
            {/* Header row — icon + title + collapse chevron */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '30px' }}>{currentStepDef.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#4ecd71', fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Step {currentStepDef.id} of {STEP_DEFINITIONS.length}
                </div>
                <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, lineHeight: 1.2 }}>
                  {currentStepDef.title}
                </div>
              </div>
              <button
                onClick={() => setInstructionOpen(false)}
                style={chevronBtnStyle}
                title="Hide panel"
              >▼</button>
            </div>

            <p style={{
              color: '#a8c8b0',
              fontSize: '15px',
              lineHeight: '1.5',
              margin: '0 0 12px 0',
            }}>
              {currentStepDef.description}
            </p>

            <div style={{
              background: 'rgba(255,200,0,0.08)',
              border: '1px solid rgba(255,200,0,0.2)',
              borderRadius: '6px',
              padding: '8px',
            }}>
              <div style={{ color: '#f5c842', fontSize: '13px', fontWeight: 700, marginBottom: '5px', letterSpacing: '0.1em' }}>
                💡 INSTRUCTION
              </div>
              <div style={{ color: '#d4bc80', fontSize: '15px', lineHeight: 1.5 }}>
                {currentStepDef.instruction}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── All Steps — top right ───────────────────────────────────── */}

      {/* Collapsed tab: visible only when stepsOpen === false */}
      <div style={{
        position: 'absolute',
        top: '88px',
        right: '16px',
        zIndex: 100,
        opacity: stepsOpen ? 0 : 1,
        pointerEvents: stepsOpen ? 'none' : 'auto',
        transition: 'opacity 0.2s ease',
      }}>
        <button
          onClick={() => setStepsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            background: 'rgba(4,20,8,0.94)',
            border: '1px solid rgba(78,205,113,0.2)',
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            color: '#4a6452',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
          }}
        >
          ≡ Steps ◀
        </button>
      </div>

      {/* Full panel: visible only when stepsOpen === true */}
      <div style={{
        position: 'absolute',
        top: '88px',
        right: '16px',
        width: '260px',
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
        zIndex: 100,
        opacity: stepsOpen ? 1 : 0,
        pointerEvents: stepsOpen ? 'auto' : 'none',
        transition: 'opacity 0.2s ease',
      }}>
        <div style={{
          background: 'rgba(4,20,8,0.88)',
          border: '1px solid rgba(78,205,113,0.2)',
          borderRadius: '12px',
          padding: '12px',
          backdropFilter: 'blur(10px)',
        }}>
          {/* Header row — label + collapse chevron */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <div style={{
              color: '#4a6452',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              All Steps
            </div>
            <button
              onClick={() => setStepsOpen(false)}
              style={chevronBtnStyle}
              title="Hide panel"
            >▼</button>
          </div>

          {STEP_DEFINITIONS.map((step) => {
            const isDone   = completedSteps.includes(step.id)
            const isActive = step.id === currentStep && !isDone
            const status   = isDone ? 'done' : isActive ? 'active' : 'pending'
            return (
              <div key={step.id}>
                <StepRow step={step} status={status} earnedScore={stepScores[step.id] ?? null} />
                {isActive && step.hints && step.scoreWeight > 0 && (
                  <HintPanel
                    stepId={step.id}
                    hints={step.hints}
                    onUseHint={useHint}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
})
