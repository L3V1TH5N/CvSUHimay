// src/simulation/components/ui/IntroOverlay.jsx
import { memo } from 'react'

export const IntroOverlay = memo(function IntroOverlay({ phase }) {
  const visible = phase === 'overview' || phase === 'zooming'
  const fading  = phase === 'zooming'

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 80,
      opacity: fading ? 0 : 1,
      transition: fading ? 'opacity 1.6s ease' : 'opacity 0.4s ease',
      visibility: visible ? 'visible' : 'hidden',
    }}>
      {/* Opaque cover that fades out to reveal the wide kitchen — hides
          the one-frame camera-snap before GameCamera's useEffect fires */}
      {phase === 'overview' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#080c09',
          animation: 'darkCoverLift 0.7s ease 1.3s forwards',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.55) 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', animation: 'introFadeUp 0.8s ease forwards' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          background: 'rgba(4,81,14,0.85)',
          border: '1px solid rgba(78,205,113,0.4)',
          borderRadius: '30px', padding: '8px 22px', marginBottom: '16px',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: '18px' }}>🎓</span>
          <span style={{
            color: '#a8f0b8', fontSize: '15px', fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            fontFamily: "'Rajdhani', sans-serif",
          }}>
            Interactive Simulation
          </span>
        </div>

        <h1 style={{
          margin: '0 0 8px',
          fontSize: 'clamp(32px, 5vw, 56px)',
          fontWeight: 800, color: '#ffffff',
          letterSpacing: '0.04em',
          textShadow: '0 2px 24px rgba(0,0,0,0.6)',
          fontFamily: "'Rajdhani', sans-serif", lineHeight: 1.1,
        }}>
          Bangus Deboning
        </h1>

        <p style={{
          margin: '0 0 28px',
          fontSize: 'clamp(14px, 2vw, 18px)',
          color: 'rgba(255,255,255,0.7)',
          fontFamily: "'Rajdhani', sans-serif",
          letterSpacing: '0.06em', fontWeight: 500,
        }}>
          Step-by-step kitchen simulation
        </p>

        <div style={{
          width: '160px', height: '2px',
          background: 'linear-gradient(90deg, transparent, #4ecd71, transparent)',
          margin: '0 auto', animation: 'scanLine 1.4s ease-in-out infinite',
        }} />
      </div>

      <div style={{
        position: 'absolute', bottom: '36px',
        color: 'rgba(255,255,255,0.5)', fontSize: '15px',
        fontFamily: "'Rajdhani', sans-serif",
        letterSpacing: '0.12em', textTransform: 'uppercase',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        Entering kitchen…
      </div>

      <style>{`
        @keyframes darkCoverLift {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes introFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanLine {
          0%,100% { opacity: 0.3; transform: scaleX(0.6); }
          50%     { opacity: 1;   transform: scaleX(1.0); }
        }
        @keyframes pulse {
          0%,100% { opacity: 0.4; }
          50%     { opacity: 0.9; }
        }
      `}</style>
    </div>
  )
})
