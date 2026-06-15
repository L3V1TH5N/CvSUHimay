// src/simulation/components/steps/Step07DorsalBones/dorsalBonesConfig.js
// Authoritative bone position table for Step 7 dorsal spine removal.
//
// HOW THIS FILE WORKS
//   The loader auto-scatters all 88 bones along the dorsal contour of
//   DaingCuttedFins.glb. Step07BoneCluster then calls applyDorsalPositions()
//   which overlays the DORSAL_BONES entries on top of the auto-scatter result.
//   Positions were manually tuned in Step07Preview.jsx.
//
// ENTRY FORMS (any of these is valid per bone)
//   null
//     Use the auto-scatter default.
//
//   [x, y, z]
//     Override position only. Coordinates are in butterflied-LOCAL space.
//
//   { position?: [x, y, z], rotation?: [rx, ry, rz], scale?: number }
//     Full override. Any field can be omitted.
//       position — same as the array form
//       rotation — Euler XYZ in radians
//       scale    — per-bone scale multiplier (× BONE_SCALE in Step07BoneCluster)
//
// FINDING A STARTING POINT
//   Open DevTools and run __dumpDorsalBones() — the loader prints each bone's
//   auto-scattered [x, y, z]. Copy values and tweak from there.

import * as THREE from 'three'

// BONE_POSITIONS is consumed by the loader's applyManualOverrides() at load-time.
// All null — DORSAL_BONES below does the tuning at mount time instead.
export const BONE_POSITIONS = [
  /*  1 */ null, /*  2 */ null, /*  3 */ null, /*  4 */ null, /*  5 */ null,
  /*  6 */ null, /*  7 */ null, /*  8 */ null, /*  9 */ null, /* 10 */ null,
  /* 11 */ null, /* 12 */ null, /* 13 */ null, /* 14 */ null, /* 15 */ null,
  /* 16 */ null, /* 17 */ null, /* 18 */ null, /* 19 */ null, /* 20 */ null,
  /* 21 */ null, /* 22 */ null, /* 23 */ null, /* 24 */ null, /* 25 */ null,
  /* 26 */ null, /* 27 */ null, /* 28 */ null, /* 29 */ null, /* 30 */ null,
  /* 31 */ null, /* 32 */ null, /* 33 */ null, /* 34 */ null, /* 35 */ null,
  /* 36 */ null, /* 37 */ null, /* 38 */ null, /* 39 */ null, /* 40 */ null,
  /* 41 */ null, /* 42 */ null, /* 43 */ null, /* 44 */ null, /* 45 */ null,
  /* 46 */ null, /* 47 */ null, /* 48 */ null, /* 49 */ null, /* 50 */ null,
  /* 51 */ null, /* 52 */ null, /* 53 */ null, /* 54 */ null, /* 55 */ null,
  /* 56 */ null, /* 57 */ null, /* 58 */ null, /* 59 */ null, /* 60 */ null,
  /* 61 */ null, /* 62 */ null, /* 63 */ null, /* 64 */ null, /* 65 */ null,
  /* 66 */ null, /* 67 */ null, /* 68 */ null, /* 69 */ null, /* 70 */ null,
  /* 71 */ null, /* 72 */ null, /* 73 */ null, /* 74 */ null, /* 75 */ null,
  /* 76 */ null, /* 77 */ null, /* 78 */ null, /* 79 */ null, /* 80 */ null,
  /* 81 */ null, /* 82 */ null, /* 83 */ null, /* 84 */ null, /* 85 */ null,
  /* 86 */ null, /* 87 */ null, /* 88 */ null,
]

// ═══════════════════════════════════════════════════════════════════════════
// DORSAL_BONES — manually tuned positions ported verbatim from Step07Preview.jsx.
//
//   position: [ X, Y, Z ]
//     X = left (-) / right (+)   → lateral offset from dorsal midline
//     Y = down (-) / up (+)      → lower = more buried inside fish
//     Z = tail (-) / head (+)    → along the backbone
//   rotation: [ pitch (X), yaw (Y), roll (Z) ]  (radians, XYZ order)
//   scale = multiplier on BONE_SCALE (0.28)
//
// Coordinates are in butterflied-LOCAL space (the dorsalBoneSlot group
// applies BUTTERFLIED_SCALE 0.24 + fish tilt + world offset for you).
// ═══════════════════════════════════════════════════════════════════════════
export const DORSAL_BONES = Object.freeze([
  // Upper Left
  /*  1 */ { position: [0.12, 0.05, -0.6],     rotation: [-0.45, 0.5, -1.00],  scale: 1.0  },
  /*  2 */ { position: [0.13, 0.05, -0.55],    rotation: [-0.45, 0.5, -1.00],  scale: 1.0  },
  /*  3 */ { position: [0.14, 0.05, -0.5],     rotation: [-0.45, 0.5, -1.00],  scale: 1.05 },
  /*  4 */ { position: [0.185, 0.07, -0.47],   rotation: [-0.45, 0.5, -1.00],  scale: 1.05 },
  /*  5 */ { position: [0.185, 0.07, -0.4],    rotation: [-0.45, 0.5, -1.00],  scale: 1.05 },
  /*  6 */ { position: [0.21, 0.09, -0.36],    rotation: [-0.45, 0.5, -1.00],  scale: 1.05 },
  /*  7 */ { position: [0.24, 0.10, -0.34],    rotation: [-0.45, 0.5, -0.903], scale: 1.05 },
  /*  8 */ { position: [0.24, 0.10, -0.28],    rotation: [-0.45, 0.5, -0.903], scale: 1.05 },
  /*  9 */ { position: [0.27, 0.114, -0.27],   rotation: [-0.45, 0.5, -0.903], scale: 1.1  },
  /* 10 */ { position: [0.27, 0.114, -0.21],   rotation: [-0.45, 0.5, -0.903], scale: 1.1  },
  /* 11 */ { position: [0.29, 0.13, -0.18],    rotation: [-0.45, 0.5, -0.903], scale: 1.1  },
  /* 12 */ { position: [0.31, 0.13, -0.11],    rotation: [-0.45, 0.5, -0.903], scale: 1.1  },
  /* 13 */ { position: [0.33, 0.13, -0.07],    rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 14 */ { position: [0.34, 0.13, -0.02],    rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 15 */ { position: [0.34, 0.13, 0.03],     rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 16 */ { position: [0.36, 0.13, 0.08],     rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 17 */ { position: [0.38, 0.14, 0.1],      rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 18 */ { position: [0.38, 0.14, 0.15],     rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 19 */ { position: [0.40, 0.15, 0.18],     rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 20 */ { position: [0.41, 0.15, 0.24],     rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 21 */ { position: [0.41, 0.15, 0.28],     rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 22 */ { position: [0.42, 0.15, 0.32],     rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 23 */ { position: [0.425, 0.15, 0.35],    rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 24 */ { position: [0.435, 0.15, 0.37],    rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 25 */ { position: [0.445, 0.15, 0.4],     rotation: [-0.45, 0.5, -0.903], scale: 1.2  },
  /* 26 */ { position: [0.45, 0.02, 0.24],     rotation: [1.0, 0.8, -1.00],    scale: 1.40 },
  /* 27 */ { position: [0.457, 0.02, 0.27],    rotation: [1.0, 0.8, -1.00],    scale: 1.40 },
  /* 28 */ { position: [0.468, 0.02, 0.31],    rotation: [1.0, 0.8, -1.00],    scale: 1.40 },
  /* 29 */ { position: [0.475, 0.02, 0.35],    rotation: [1.0, 0.8, -1.00],    scale: 1.40 },
  /* 30 */ { position: [0.48, 0.02, 0.39],     rotation: [1.0, 0.8, -1.00],    scale: 1.40 },
  /* 31 */ { position: [0.49, 0.02, 0.45],     rotation: [1.0, 0.8, -1.00],    scale: 1.40 },
  /* 32 */ { position: [0.49, 0.06, 0.38],     rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 33 */ { position: [0.49, 0.06, 0.45],     rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 34 */ { position: [0.49, 0.06, 0.52],     rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 35 */ { position: [0.50, 0.06, 0.6],      rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 36 */ { position: [0.495, 0.03, 0.68],    rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 37 */ { position: [0.49, 0.01, 0.75],     rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 38 */ { position: [0.48, -0.01, 0.82],    rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 39 */ { position: [0.47, -0.02, 0.89],    rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 40 */ { position: [0.46, -0.02, 0.95],    rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 41 */ { position: [0.445, -0.02, 1.02],   rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 42 */ { position: [0.44, -0.02, 1.08],    rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 43 */ { position: [0.42, -0.02, 1.14],    rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  /* 44 */ { position: [0.4, -0.03, 1.2],      rotation: [1.6, 0.8, -1.00],    scale: 1.40 },
  // Lower
  /* 45 */ { position: [-0.317, -0.08, -0.65],  rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 46 */ { position: [-0.335, -0.08, -0.623], rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 47 */ { position: [-0.352, -0.08, -0.59],  rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 48 */ { position: [-0.361, -0.08, -0.55],  rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 49 */ { position: [-0.385, -0.08, -0.52],  rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 50 */ { position: [-0.41, -0.08, -0.48],   rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 51 */ { position: [-0.43, -0.08, -0.437],  rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 52 */ { position: [-0.45, -0.05, -0.4],    rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 53 */ { position: [-0.468, -0.05, -0.36],  rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 54 */ { position: [-0.475, -0.05, -0.31],  rotation: [-0.55, -2.5, -0.30], scale: 1.7  },
  /* 55 */ { position: [-0.495, -0.05, -0.27],  rotation: [-0.55, -2.5, -0.30], scale: 1.7  },
  /* 56 */ { position: [-0.53, -0.05, -0.2],    rotation: [-0.55, -2.5, -0.30], scale: 1.7  },
  /* 57 */ { position: [-0.555, -0.05, -0.13],  rotation: [-0.55, -2.5, -0.30], scale: 1.7  },
  /* 58 */ { position: [-0.58, -0.05, -0.06],   rotation: [-0.55, -2.5, -0.30], scale: 1.7  },
  /* 59 */ { position: [-0.605, -0.05, 0.01],   rotation: [-0.55, -2.5, -0.30], scale: 1.7  },
  /* 60 */ { position: [-0.61, -0.05, 0.08],    rotation: [-0.55, -2.5, -0.30], scale: 1.9  },
  /* 61 */ { position: [-0.63, -0.05, 0.15],    rotation: [-0.55, -2.5, -0.30], scale: 1.9  },
  /* 62 */ { position: [-0.654, -0.05, 0.21],   rotation: [-0.55, -2.5, -0.30], scale: 1.9  },
  /* 63 */ { position: [-0.67, -0.05, 0.25],    rotation: [-0.5, -2.5, -0.30],  scale: 1.9  },
  /* 64 */ { position: [-0.679, -0.05, 0.316],  rotation: [-0.5, -2.5, -0.30],  scale: 1.9  },
  /* 65 */ { position: [-0.69, -0.05, 0.37],    rotation: [-0.5, -2.5, -0.30],  scale: 1.9  },
  /* 66 */ { position: [-0.71, -0.05, 0.42],    rotation: [-0.45, -2.5, -0.30], scale: 1.9  },
  /* 67 */ { position: [-0.714, -0.05, 0.47],   rotation: [-0.45, -2.5, -0.30], scale: 1.9  },
  /* 68 */ { position: [-0.719, -0.05, 0.53],   rotation: [-0.45, -2.5, -0.30], scale: 1.9  },
  /* 69 */ { position: [-0.725, -0.05, 0.59],   rotation: [-0.45, -2.5, -0.30], scale: 1.9  },
  /* 70 */ { position: [-0.735, -0.05, 0.65],   rotation: [-0.45, -2.5, -0.30], scale: 1.9  },
  /* 71 */ { position: [-0.83, -0.1, 0.53],     rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 72 */ { position: [-0.829, -0.1, 0.58],    rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 73 */ { position: [-0.828, -0.1, 0.62],    rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 74 */ { position: [-0.825, -0.1, 0.66],    rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 75 */ { position: [-0.823, -0.1, 0.7],     rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 76 */ { position: [-0.82, -0.1, 0.725],    rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 77 */ { position: [-0.817, -0.1, 0.75],    rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 78 */ { position: [-0.814, -0.1, 0.775],   rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 79 */ { position: [-0.81, -0.1, 0.801],    rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 80 */ { position: [-0.806, -0.11, 0.83],   rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 81 */ { position: [-0.797, -0.12, 0.88],   rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 82 */ { position: [-0.785, -0.13, 0.93],   rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 83 */ { position: [-0.769, -0.15, 0.99],   rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 84 */ { position: [-0.756, -0.13, 1.03],   rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 85 */ { position: [-0.734, -0.15, 1.08],   rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 86 */ { position: [-0.715, -0.15, 1.125],  rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 87 */ { position: [-0.699, -0.15, 1.16],   rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
  /* 88 */ { position: [-0.68, -0.15, 1.2],     rotation: [0.15, -0.5, 0.00],   scale: 1.9  },
])

// Overlay DORSAL_BONES onto the loader's auto-scattered entries.
// Returns a new array of cloned entries — never mutates the loader cache.
export function applyDorsalPositions(entries) {
  const out = new Array(entries.length)
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (!e) { out[i] = null; continue }
    const ovr = DORSAL_BONES[i]
    if (ovr == null) { out[i] = e; continue }

    let posArr = null, rotArr = null, scaleMul = null
    if (Array.isArray(ovr)) {
      posArr = ovr
    } else if (typeof ovr === 'object') {
      posArr   = ovr.position ?? null
      rotArr   = ovr.rotation ?? null
      scaleMul = ovr.scale    ?? null
    }

    const cloned = { ...e }
    if (Array.isArray(posArr) && posArr.length === 3) {
      cloned.position = new THREE.Vector3(posArr[0], posArr[1], posArr[2])
    }
    if (Array.isArray(rotArr) && rotArr.length === 3) cloned.rotation = rotArr
    if (typeof scaleMul === 'number' && Number.isFinite(scaleMul)) {
      cloned.scaleMultiplier = scaleMul
    }
    out[i] = cloned
  }
  return out
}
