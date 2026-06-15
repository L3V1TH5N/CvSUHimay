// src/simulation/components/ui/Crosshair.jsx

export function Crosshair({ active = false }) {
  const color = active ? '#4ecd71' : 'rgba(255,255,255,0.5)'
  const size = 16

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 50,
    }}>
      {/* Horizontal bar */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${size * 2}px`,
        height: '2px',
        background: color,
        transform: 'translate(-50%, -50%)',
        transition: 'background 0.2s',
        boxShadow: active ? `0 0 6px ${color}` : 'none',
      }} />
      {/* Vertical bar */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '2px',
        height: `${size * 2}px`,
        background: color,
        transform: 'translate(-50%, -50%)',
        transition: 'background 0.2s',
        boxShadow: active ? `0 0 6px ${color}` : 'none',
      }} />
      {/* Center dot */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '4px',
        height: '4px',
        background: color,
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
      }} />
    </div>
  )
}
