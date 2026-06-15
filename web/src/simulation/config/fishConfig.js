// src/simulation/config/fishConfig.js
// Fish anatomy zones and interaction point definitions

export const FISH_SCALE = 1.4

// Interaction zones relative to fish center (in 3D units)
export const FISH_ZONES = {
  body: { center: [0, 0, 0], radius: 1.2 },
  head:  { center: [-1.1, 0.05, 0], radius: 0.4 },
  tail:  { center: [1.1, 0, 0], radius: 0.3 },
  belly: { center: [0, -0.25, 0], radius: 0.8 },
  dorsal: { center: [0, 0.3, 0], radius: 0.9 },
}

// Spine positions (simplified grid for simulation)
// Real bangus: ~87 dorsal, ~46 ventral, ~42 lateral = ~175 total
export const SPINE_CONFIG = {
  dorsal: {
    count: 87,
    color: '#ff6b35',
    highlightColor: '#ffaa00',
    positions: generateSpinePositions('dorsal', 87),
  },
  ventral: {
    count: 46,
    color: '#4ecdc4',
    highlightColor: '#00e5ff',
    positions: generateSpinePositions('ventral', 46),
  },
  lateral: {
    count: 42,
    color: '#a855f7',
    highlightColor: '#d946ef',
    positions: generateSpinePositions('lateral', 42),
  },
}

// Generate evenly spaced spine positions along fish body
function generateSpinePositions(type, count) {
  const positions = []
  const fishLength = 2.0   // total length in 3D units
  const startX = -0.85
  const endX = 0.85

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const x = startX + t * (endX - startX)

    // Slight natural curve (fish body taper)
    const bodyWidth = 0.2 * Math.sin(t * Math.PI)

    let y, z
    switch (type) {
      case 'dorsal':
        y = 0.18 + bodyWidth * 0.4
        z = (Math.random() - 0.5) * 0.08
        break
      case 'ventral':
        y = -0.15 - bodyWidth * 0.3
        z = (Math.random() - 0.5) * 0.06
        break
      case 'lateral':
        y = (Math.random() - 0.5) * 0.06
        z = (i % 2 === 0 ? 1 : -1) * (0.12 + bodyWidth * 0.2)
        break
      default:
        y = 0; z = 0
    }

    positions.push([x, y, z])
  }
  return positions
}

// Cutting board position in scene
export const CUTTING_BOARD_POSITION = [0, 0.92, -1.6]
export const CUTTING_BOARD_SIZE = [0.9, 0.02, 0.5]

// Sink position for washing steps
export const SINK_WASH_POSITION = [-0.25, 0.98, -2.22]

// Fish rest positions
export const FISH_POSITIONS = {
  sink: [-0.25, 1.05, -2.22],
  cuttingBoard: [0, 0.96, -1.6],
  table: [1.8, 0.8, 0.8],
}
