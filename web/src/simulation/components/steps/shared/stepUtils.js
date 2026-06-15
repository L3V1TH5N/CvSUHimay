// src/simulation/components/steps/stepUtils.js
// Shared constants reused across all per-step hook files.

export const FAUCET_POS = [-0.25, 1.32, -2.38]   // faucet spout tip
export const FISH_BOARD = [ 1.00, 0.97, -2.19]   // fish centre on cutting board

export const HINT_STYLE = {
  position: 'absolute', bottom: '90px', left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(4,20,8,0.92)',
  border: '2px solid rgba(78,205,113,0.45)',
  borderRadius: '40px', padding: '10px 22px',
  color: '#4ecd71', fontSize: '14px', fontWeight: 600,
  letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '10px',
  fontFamily: "'Rajdhani', sans-serif", backdropFilter: 'blur(8px)',
  zIndex: 101, pointerEvents: 'none', whiteSpace: 'nowrap',
}

// SVG water-drop cursors — built once at module load, zero runtime cost.
const _dropCursor = (fill) => {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">` +
    `<polygon points="14,3 7,16 21,16" fill="${fill}"/>` +
    `<ellipse cx="14" cy="19" rx="7" ry="8" fill="${fill}"/>` +
    `</svg>`
  )
  return `url("data:image/svg+xml,${svg}") 14 27, crosshair`
}

export const CURSOR_IDLE    = _dropCursor('#88ccff')  // water tool equipped
export const CURSOR_WASHING = _dropCursor('#ffffff')  // actively washing

// SVG forceps cursors — two arms converging at the tip (hotspot bottom-centre).
// closed=false: tips slightly apart (idle); closed=true: tips pinched together (grabbing).
const _forcepsCursor = (fill, closed = false) => {
  const tipL = closed ? 14 : 12
  const tipR = closed ? 14 : 16
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">` +
    `<line x1="7" y1="2" x2="${tipL}" y2="26" stroke="${fill}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<line x1="21" y1="2" x2="${tipR}" y2="26" stroke="${fill}" stroke-width="2.5" stroke-linecap="round"/>` +
    `</svg>`
  )
  return `url("data:image/svg+xml,${svg}") 14 27, crosshair`
}

export const CURSOR_FORCEPS      = _forcepsCursor('#88ccaa')        // forceps equipped, idle
export const CURSOR_FORCEPS_GRAB = _forcepsCursor('#ffffff', true)  // actively gripping
