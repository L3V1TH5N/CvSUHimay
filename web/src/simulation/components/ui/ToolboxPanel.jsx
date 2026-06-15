// src/simulation/components/ui/ToolboxPanel.jsx
import { memo, useState } from 'react'
import { useFSM } from '../../fsm/FSMProvider'

const TOOLS = [
  { id: 'water',   label: 'Water',   icon: '💧', desc: 'Wash fish' },
  { id: 'knife',   label: 'Knife',   icon: '🔪', desc: 'Make cuts' },
  { id: 'forceps', label: 'Forceps', icon: '🥢', desc: 'Remove bones' },
]

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

export const ToolboxPanel = memo(function ToolboxPanel() {
  const { activeTool, setActiveTool, currentStepDef, washHolding } = useFSM()
  const requiredTool = currentStepDef?.tool ?? null
  const [toolboxOpen, setToolboxOpen] = useState(true)

  return (
    <>
      {/* Collapsed tab: visible only when toolboxOpen === false */}
      <div style={{
        position: 'absolute',
        top: '420px',
        left: '16px',
        zIndex: 100,
        opacity: toolboxOpen ? 0 : 1,
        pointerEvents: toolboxOpen ? 'none' : 'auto',
        transition: 'opacity 0.2s ease',
      }}>
        <button
          onClick={() => setToolboxOpen(true)}
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
            letterSpacing: '0.15em',
            fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
          }}
        >
          🧰 ▶
        </button>
      </div>

      {/* Full panel: visible only when toolboxOpen === true */}
      <div style={{
        position: 'absolute',
        top: '420px',
        left: '16px',
        width: '240px',
        background: 'rgba(4,20,8,0.94)',
        border: '2px solid rgba(78,205,113,0.4)',
        borderRadius: '12px',
        padding: '10px 12px',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
        boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(78,205,113,0.08)',
        userSelect: 'none',
        opacity: toolboxOpen ? 1 : 0,
        pointerEvents: toolboxOpen ? 'auto' : 'none',
        transition: 'opacity 0.2s ease',
      }}>

        {/* Header row — label + collapse chevron */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}>
          <div style={{
            color: '#4a6452',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            🧰 Toolbox
          </div>
          <button
            onClick={() => setToolboxOpen(false)}
            style={chevronBtnStyle}
            title="Hide panel"
          >▼</button>
        </div>

        {/* Tool rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {TOOLS.map((tool) => {
            const isSelected = activeTool === tool.id
            const isRequired = requiredTool === tool.id

            const colors = {
              bg:     isSelected ? 'rgba(78,205,113,0.22)' : isRequired ? 'rgba(78,205,113,0.10)' : 'rgba(255,255,255,0.05)',
              border: isSelected ? '#4ecd71'               : isRequired ? 'rgba(78,205,113,0.6)'  : 'rgba(255,255,255,0.15)',
              label:  isSelected ? '#4ecd71'               : isRequired ? '#ffffff'               : '#9ab8a2',
              desc:   isSelected ? '#6bb87e'               : isRequired ? '#a8c8b0'               : '#6a8870',
              icon:   isSelected ? 'rgba(78,205,113,0.25)' : isRequired ? 'rgba(78,205,113,0.12)' : 'rgba(255,255,255,0.07)',
            }

            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(isSelected ? null : tool.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 10px',
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  textAlign: 'left',
                  width: '100%',
                  boxShadow: isSelected
                    ? '0 0 0 1px rgba(78,205,113,0.3), 0 0 14px rgba(78,205,113,0.3), inset 0 1px 0 rgba(78,205,113,0.15)'
                    : 'none',
                  animation: isSelected ? 'activeGlow 2s ease-in-out infinite' : 'none',
                }}
              >
                {/* Required pulse badge */}
                {isRequired && !isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '-5px', right: '-5px',
                    width: '11px', height: '11px',
                    background: '#4ecd71',
                    borderRadius: '50%',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                )}

                {/* Icon tile */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: colors.icon,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  flexShrink: 0,
                  boxShadow: isSelected ? '0 0 8px rgba(78,205,113,0.4)' : 'none',
                }}>
                  {tool.icon}
                </div>

                {/* Label + desc */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: colors.label,
                    fontSize: '15px',
                    fontWeight: isSelected ? 700 : 600,
                    letterSpacing: '0.03em',
                  }}>
                    {tool.label}
                  </div>
                  <div style={{ color: colors.desc, fontSize: '13px', marginTop: '1px' }}>
                    {tool.id === 'water' && isRequired && !washHolding ? 'Hover over fish' : tool.desc}
                  </div>
                </div>

                {/* Selected badge */}
                {isSelected && (
                  <div style={{
                    background: 'rgba(78,205,113,0.2)',
                    border: '1px solid rgba(78,205,113,0.5)',
                    borderRadius: '5px',
                    padding: '2px 7px',
                    color: '#4ecd71',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>
                    ✓ ON
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.3); }
          }
          @keyframes washPulse {
            0%, 100% { box-shadow: 0 0 8px rgba(78,205,113,0.4); }
            50% { box-shadow: 0 0 18px rgba(78,205,113,0.8); }
          }
          @keyframes activeGlow {
            0%, 100% { box-shadow: 0 0 0 1px rgba(78,205,113,0.4), 0 0 16px rgba(78,205,113,0.35), inset 0 1px 0 rgba(78,205,113,0.2); }
            50% { box-shadow: 0 0 0 1px rgba(78,205,113,0.6), 0 0 24px rgba(78,205,113,0.5), inset 0 1px 0 rgba(78,205,113,0.3); }
          }
        `}</style>
      </div>
    </>
  )
})
