// src/simulation/components/steps/shared/TrashPanel.jsx
import { forwardRef } from 'react'

export const TrashPanel = forwardRef(function TrashPanel(
  { dragging, hover, count, total, hidden, onPointerEnter, onPointerLeave },
  ref,
) {
  const borderColor =
    hover    ? '#4ecd71'
    : dragging ? '#f5c842'
    :            'rgba(255,255,255,0.3)'

  const bgColor =
    hover    ? 'rgba(78,205,113,0.18)'
    : dragging ? 'rgba(245,200,66,0.10)'
    :            'rgba(4,20,8,0.65)'

  const textColor = hover ? '#4ecd71' : '#f5c842'

  return (
    <div
      ref={ref}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: 'absolute',
        left: '28px',
        bottom: '28px',
        width: '170px',
        height: '170px',
        borderRadius: '20px',
        border: `3px ${dragging ? 'solid' : 'dashed'} ${borderColor}`,
        background: bgColor,
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        color: textColor,
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        fontSize: '12px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transition: 'background 0.18s ease, border-color 0.18s ease, opacity 0.3s ease',
        pointerEvents: hidden ? 'none' : 'auto',
        opacity: hidden ? 0 : 1,
        zIndex: 110,
        boxShadow: hover ? '0 0 24px rgba(78,205,113,0.4)' : 'none',
      }}
    >
      <div style={{
        fontSize: '46px',
        lineHeight: 1,
        filter: hover ? 'drop-shadow(0 0 10px #4ecd71)' : 'none',
        transition: 'filter 0.18s ease',
      }}>
        🗑️
      </div>
      <div style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
        {hover ? 'Release to discard' : dragging ? 'Drop here' : 'Trash bin'}
      </div>
      <div style={{
        fontSize: '14px',
        fontWeight: 800,
        color: '#4ecd71',
        letterSpacing: '0.04em',
      }}>
        {count} / {total}
      </div>
    </div>
  )
})
