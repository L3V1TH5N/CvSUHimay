// web/src/simulation/components/steps/Step08VentralBones/ventralBonesConfig.js
//
// Authoritative bone position table for Step 8 ventral spine removal.
// Ported verbatim from Step08Preview.jsx — coordinates are in
// butterflied-LOCAL space (the ventralBoneSlot group in FishModel applies
// BUTTERFLIED_SCALE 0.24 + fish tilt + world offset for you).
//
// VENTRAL_BONES entry forms (any is valid per index):
//   null                              — use auto-scatter default
//   [x, y, z]                        — position override only
//   { position?, rotation?, scale? } — full override, all fields optional
//
// Run __dumpVentralBones() in DevTools to print auto-scattered positions.

import * as THREE from 'three'

// ── Per-bone position table ───────────────────────────────────────────────────
// Bones 1-24: top row (+X side), head → tail
// Bones 25-48: bottom row (-X side), head → tail
export const VENTRAL_BONES = Object.freeze([
  // ── Top ─────────────────────────────────────────────────────────────────
  /*  1 */ { position: [ 0.400, 0.007,  1.15], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /*  2 */ { position: [ 0.408, 0.012,  1.10], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /*  3 */ { position: [ 0.410, 0.020,  1.05], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /*  4 */ { position: [ 0.414, 0.029,  1.00], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /*  5 */ { position: [ 0.417, 0.040,  0.95], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /*  6 */ { position: [ 0.420, 0.050,  0.90], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /*  7 */ { position: [ 0.424, 0.060,  0.85], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /*  8 */ { position: [ 0.427, 0.070,  0.80], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /*  9 */ { position: [ 0.430, 0.080,  0.75], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 10 */ { position: [ 0.431, 0.090,  0.70], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 11 */ { position: [ 0.429, 0.100,  0.65], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 12 */ { position: [ 0.429, 0.110,  0.60], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 13 */ { position: [ 0.426, 0.120,  0.55], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 14 */ { position: [ 0.423, 0.130,  0.50], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 15 */ { position: [ 0.423, 0.140,  0.45], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 16 */ { position: [ 0.416, 0.140,  0.40], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 17 */ { position: [ 0.410, 0.140,  0.35], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 18 */ { position: [ 0.400, 0.143,  0.30], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 19 */ { position: [ 0.389, 0.145,  0.25], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 20 */ { position: [ 0.384, 0.150,  0.20], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 21 */ { position: [ 0.374, 0.150,  0.15], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 22 */ { position: [ 0.365, 0.150,  0.10], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 23 */ { position: [ 0.357, 0.155,  0.05], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  /* 24 */ { position: [ 0.350, 0.150,  0.00], rotation: [ 2.00, 1.00, 2.00], scale: 1.0 },
  // ── Bottom ──────────────────────────────────────────────────────────────
  /* 25 */ { position: [-0.500, 0.080,  1.20], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 26 */ { position: [-0.500, 0.086,  1.13], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 27 */ { position: [-0.500, 0.093,  1.07], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 28 */ { position: [-0.519, 0.105,  1.02], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 29 */ { position: [-0.525, 0.115,  0.96], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 30 */ { position: [-0.543, 0.125,  0.91], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 31 */ { position: [-0.553, 0.139,  0.85], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 32 */ { position: [-0.559, 0.149,  0.80], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 33 */ { position: [-0.566, 0.149,  0.75], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 34 */ { position: [-0.573, 0.155,  0.70], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 35 */ { position: [-0.577, 0.160,  0.65], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 36 */ { position: [-0.583, 0.170,  0.60], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 37 */ { position: [-0.587, 0.180,  0.55], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 38 */ { position: [-0.587, 0.190,  0.50], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 39 */ { position: [-0.592, 0.200,  0.45], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 40 */ { position: [-0.592, 0.205,  0.40], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 41 */ { position: [-0.592, 0.210,  0.35], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 42 */ { position: [-0.585, 0.212,  0.30], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 43 */ { position: [-0.582, 0.217,  0.25], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 44 */ { position: [-0.578, 0.217,  0.20], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 45 */ { position: [-0.575, 0.223,  0.15], rotation: [12.00, 1.10, 2.00], scale: 0.95 },
  /* 46 */ { position: [-0.540, 0.130,  0.18], rotation: [12.00, 0.90, 1.00], scale: 0.95 },
  /* 47 */ { position: [-0.520, 0.120,  0.12], rotation: [12.00, 0.90, 1.00], scale: 0.95 },
  /* 48 */ { position: [-0.500, 0.110,  0.08], rotation: [12.00, 0.90, 1.00], scale: 0.95 },
])

// Overlay VENTRAL_BONES onto the loader's auto-scattered entries.
// Returns a new array — never mutates the loader cache.
export function applyVentralPositions(entries) {
  const out = new Array(entries.length)
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (!e) { out[i] = null; continue }
    const ovr = VENTRAL_BONES[i]
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
