// web/src/simulation/components/steps/Step05Organs/organsConfig.js
// All constants and piece definitions for Step 5.
// Positions and config values mirror Step05Preview.jsx exactly.

import * as THREE from 'three'

// ── Fish / board constants (mirror Step05Preview.jsx) ─────────────────────────
export const FISH_POS_CB             = [0.93, 0.97, -2.19]
export const FISH_ROTATION_Y         = Math.PI / 2
export const BUTTERFLIED_FLAT_TILT_X = -0.05
export const BUTTERFLIED_FLAT_TILT_Z = 0.0
export const BUTTERFLIED_LIFT        = 0.02
export const BUTTERFLIED_BACK_SHIFT  = 0.0

export const DRAG_PLANE_Y = 1.05
export const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)

// ── Piece definitions — exact values from Step05Preview.jsx ──────────────────
// No hitSize: OrgansDragController auto-computes the hit box from the model's bbox.
export const PIECES = {
  guts: {
    id:        'guts',
    modelPath: '/models/bones/guts.glb',
    restPos:   new THREE.Vector3(0.92, 1.0, -2.19),
    scale:     1.06,
    rotation:  [2, 1.60, -2],
    tintColor: '#fa6e6e',
    glow: {
      color:             '#ffaaaa',
      emissiveIntensity: 0.05,
      pulseSpeed:        3.9,
      pulseAmplitude:    0.1,
    },
  },
  gills: {
    id:        'gills',
    modelPath: '/models/bones/Gills.glb',
    restPos:   new THREE.Vector3(0.94, 0.97, -2.191),
    scale:     0.93,
    rotation:  [1.92, 1.60, -2],
    tintColor: '#fa6e6e',
    glow: {
      color:             '#ffaaaa',
      emissiveIntensity: 0.05,
      pulseSpeed:        3.9,
      pulseAmplitude:    0.1,
    },
  },
  spine: {
    id:        'spine',
    modelPath: '/models/bones/Spine/option2.glb',
    restPos:   new THREE.Vector3(0.73, 0.6835, -2.01),
    scale:     1.0,
    rotation:  [1.9, 1.61, -2],
    tintColor: '#fa6e6e',
    glow:      null, // OrgansDragController falls back to DEFAULT_GLOW
  },
}
