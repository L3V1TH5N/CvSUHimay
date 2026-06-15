// src/simulation/components/fish/CutCompletionBurst.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders an 8-particle radial burst at (x, y) screen coords for 700 ms.
// Pure DOM — no R3F, no per-frame JS. CSS keyframes run on the compositor.
// Mounts/unmounts with the `show` flag; particle count fixed so React can key
// once and never reconcile.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

const PARTICLE_COUNT = 8
const LIFETIME_MS    = 700
const DISTANCE_PX    = 52

// Precompute 8 evenly-spaced angles — one allocation, module scope.
const ANGLES = Array.from({ length: PARTICLE_COUNT }, (_, i) =>
  (i / PARTICLE_COUNT) * Math.PI * 2,
)

// Inline keyframes — keeps the burst self-contained, no global CSS dependency.
const KEYFRAMES = `
@keyframes cutBurstParticle {
  0%   { transform: translate(-50%, -50%) translate(0, 0) scale(1);   opacity: 1; }
  100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
}
@keyframes cutBurstRing {
  0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
}
`

// Unmounts itself LIFETIME_MS after `show` flips true.
export function CutCompletionBurst({ show, x, y }) {
  const [alive, setAlive] = useState(false)

  useEffect(() => {
    if (!show) return
    setAlive(true)
    const t = setTimeout(() => setAlive(false), LIFETIME_MS)
    return () => clearTimeout(t)
  }, [show])

  if (!alive) return null

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: x, top: y,
          width: 0, height: 0,
          pointerEvents: 'none',
          zIndex: 96,
        }}
      >
        {/* Expanding ring */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0,
          width: 60, height: 60,
          borderRadius: '50%',
          border: '2px solid rgba(120,255,150,0.9)',
          transform: 'translate(-50%, -50%) scale(0.4)',
          animation: `cutBurstRing ${LIFETIME_MS}ms ease-out forwards`,
        }} />
        {/* Radial particles */}
        {ANGLES.map((a, i) => {
          const dx = Math.cos(a) * DISTANCE_PX
          const dy = Math.sin(a) * DISTANCE_PX
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0, top: 0,
                width: 6, height: 6,
                borderRadius: '50%',
                background: i % 2 === 0 ? '#ffd166' : '#78ff96',
                boxShadow: '0 0 8px rgba(255,220,120,0.9)',
                // CSS custom props feed the keyframe — one shared animation.
                '--dx': `${dx}px`,
                '--dy': `${dy}px`,
                transform: 'translate(-50%, -50%)',
                animation: `cutBurstParticle ${LIFETIME_MS}ms ease-out forwards`,
              }}
            />
          )
        })}
      </div>
    </>
  )
}
