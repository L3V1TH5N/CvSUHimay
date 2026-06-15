// web/src/simulation/components/ui/ErrorToast.jsx
import { memo } from 'react'
import { useFSM } from '../../fsm/FSMProvider'

export const ErrorToast = memo(function ErrorToast() {
  const { lastError, stepErrors, currentStep } = useFSM()
  const errorCount = stepErrors[currentStep] ?? 0

  if (!lastError || errorCount === 0) return null

  return (
    // key remounts the div on each new error, restarting the fade-out animation.
    <div
      key={errorCount}
      style={{
        position:       'absolute',
        top:            '50%',
        left:           '50%',
        transform:      'translateX(-50%) translateY(-80px)',
        background:     'rgba(28,4,4,0.96)',
        border:         '2px solid rgba(255,80,80,0.7)',
        borderRadius:   '12px',
        padding:        '12px 22px',
        display:        'flex',
        alignItems:     'center',
        gap:            '10px',
        fontFamily:     "'Rajdhani', 'Segoe UI', sans-serif",
        pointerEvents:  'none',
        zIndex:         150,
        backdropFilter: 'blur(10px)',
        boxShadow:      '0 4px 20px rgba(0,0,0,0.5)',
        animation:      'errorFadeOut 2.5s ease forwards',
        whiteSpace:     'nowrap',
      }}
    >
      <span style={{ fontSize: '22px' }}>❌</span>
      <span style={{
        color:         '#ff8888',
        fontWeight:    700,
        fontSize:      '15px',
        letterSpacing: '0.04em',
      }}>
        {lastError}
      </span>
      <style>{`
        @keyframes errorFadeOut {
          0%   { opacity: 1; transform: translateX(-50%) translateY(-80px) scale(1); }
          65%  { opacity: 1; transform: translateX(-50%) translateY(-80px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-96px) scale(0.95); }
        }
      `}</style>
    </div>
  )
})
