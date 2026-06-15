// src/simulation/Step08Preview.jsx
//
// Standalone Step-8 (ventral spine removal) preview. Self-contained: does
// NOT mount StepManager, FSM, or any shared step component — just renders
// KitchenEnvironment + GameCamera + the production FishModel held in its
// post-cut "butterflied + flat" pose, with the 48-bone ventral cluster
// attached through FishModel's `ventralBoneSlot`.
//
// Why FishModel directly: the live sim's FishModel already owns the
// closed→butterflied fade, the bottom-alignment Y offset, the GLB material
// state, and a bone-slot whose transform mirrors the butterflied primitive.
// Re-using it keeps this preview pixel-identical to step 8 in the real
// flow and avoids any drift between the two paths.
//
// Performance budget (low-end PC target):
//   • shadows OFF on the canvas, dpr capped to 1×, AdaptiveDpr/Events.
//   • cutComplete={true} → FishModel's per-frame fade loop early-exits on
//     the first frame; the closed mesh becomes invisible so only the
//     butterflied mesh draws.
//   • One module-level THREE.BoxGeometry + one transparent MeshBasicMaterial
//     drives all 48 hit volumes — 47× fewer GPU resource allocations.
//   • Per-frame scratch vectors are allocated once per mount via useMemo.
//
// ── Inlined: ventralBonesLoader.js ──────────────────────────────────────────
// Module-level singleton asset loader for Step 8 ventral-spine removal.
// Loads all 48 ventral bones from a single Draco-compressed atlas and
// distributes them along the upward-facing contour of the butterflied fish.
//
// Two parallel fetches replace the legacy 49 individual GLB fetches:
//   1. ventral-atlas.glb — all 48 bone meshes, named ventral_001..ventral_048
//   2. butterfliedBangus.opt.glb — used only to sample the fish's contour
//
// Result is cached at module level; every call after the first returns the
// same Promise so the 48 bones only parse once regardless of how many times
// the step is entered.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Suspense, useEffect, useMemo, useState, useRef, useCallback,
} from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import {
  AdaptiveDpr, AdaptiveEvents, PerformanceMonitor,
} from '@react-three/drei'
import { useGLTF } from '../utils/useGLTFLocal'
import * as THREE                     from 'three'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'
import { makeGLTFLoader }     from '../utils/dracoGLTFLoader'
import { ForcepsTool }        from '../components/tools/ForcepsTool'

// ═══════════════════════════════════════════════════════════════════════════
// INLINED: ventralBonesLoader.js
// ═══════════════════════════════════════════════════════════════════════════

export const TOTAL_VENTRAL_BONES = 48

const ATLAS_PATH   = '/models/bones/ventral-atlas.glb'
const BONE_NAME_RE = /^ventral_(\d+)$/i
const FISH_PATH    = '/models/butterfliedBangus.opt.glb'

// ── Distribution tuning ──────────────────────────────────────────────────────
const SCATTER_MARGIN            = 0.10  // fraction of long-axis left empty at each end
const SCATTER_Y_LIFT            = 0.0   // fraction of bbox Y span to lift off surface
const SCATTER_LATERAL_AMPLITUDE = 0.020 // lateral noise around the centerline

const _loader = makeGLTFLoader()

// Shared base material — all 48 bones reference this same instance.
// Lambert (per-vertex lighting) keeps the emissive glow cheap on integrated GPUs.
export const BONE_MATERIAL = new THREE.MeshLambertMaterial({
  color:             '#fff4cf',
  emissive:          new THREE.Color('#ffce4d'),
  emissiveIntensity: 1.4,
})

// Pull all ventral bones out of the atlas in one fetch.
function loadBonesFromAtlas() {
  return new Promise((resolve) => {
    _loader.load(
      ATLAS_PATH,
      (gltf) => {
        const bones = new Array(TOTAL_VENTRAL_BONES).fill(null)
        gltf.scene.traverse((c) => {
          if (!c.isMesh) return
          const m = BONE_NAME_RE.exec(c.name)
          if (!m) return
          const slot = parseInt(m[1], 10) - 1
          if (slot < 0 || slot >= TOTAL_VENTRAL_BONES) return

          c.updateMatrixWorld(true)
          const geometry = c.geometry.clone()
          geometry.applyMatrix4(c.matrixWorld)

          const box      = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position)
          const position = box.getCenter(new THREE.Vector3())
          const size     = box.getSize(new THREE.Vector3())
          geometry.translate(-position.x, -position.y, -position.z)

          bones[slot] = { geometry, position, size }
        })
        resolve(bones)
      },
      undefined,
      () => resolve(new Array(TOTAL_VENTRAL_BONES).fill(null)),
    )
  })
}

const CONTOUR_BUCKETS = 64

// Load the butterflied fish and build a 1D upward-facing height profile along
// the head→tail axis. Each bone samples this profile so it sits on the real
// mesh surface rather than the flat top of the bounding box.
function loadFishContour() {
  return new Promise((resolve) => {
    _loader.load(
      FISH_PATH,
      (gltf) => {
        gltf.scene.updateMatrixWorld(true)
        const box  = new THREE.Box3().setFromObject(gltf.scene)
        const size = box.getSize(new THREE.Vector3())
        const { long, upY, lat } = pickLongAxis(size)

        const longMin   = box.min[long]
        const longMax   = box.max[long]
        const longRange = longMax - longMin || 1
        const heights   = new Float32Array(CONTOUR_BUCKETS).fill(-Infinity)

        const v = new THREE.Vector3()
        gltf.scene.traverse((c) => {
          if (!c.isMesh) return
          const posAttr = c.geometry.attributes.position
          const matrix  = c.matrixWorld
          for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i).applyMatrix4(matrix)
            const t   = (v[long] - longMin) / longRange
            const idx = Math.min(CONTOUR_BUCKETS - 1, Math.max(0, Math.floor(t * CONTOUR_BUCKETS)))
            if (v[upY] > heights[idx]) heights[idx] = v[upY]
          }
        })

        // Fill empty slices by interpolating from nearest populated neighbours.
        for (let i = 0; i < CONTOUR_BUCKETS; i++) {
          if (heights[i] !== -Infinity) continue
          let l = i - 1, r = i + 1
          while (l >= 0 && heights[l] === -Infinity) l--
          while (r < CONTOUR_BUCKETS && heights[r] === -Infinity) r++
          const lv = l >= 0 ? heights[l] : null
          const rv = r < CONTOUR_BUCKETS ? heights[r] : null
          heights[i] =
            lv !== null && rv !== null ? (lv + rv) * 0.5
            : lv !== null               ? lv
            : rv !== null               ? rv
            :                             box.max[upY]
        }

        resolve({ box, heights, longMin, longMax, longRange, axes: { long, upY, lat } })
      },
      undefined,
      () => resolve(null),
    )
  })
}

function sampleVentralY(contour, longCoord) {
  const { heights, longMin, longRange } = contour
  const t = (longCoord - longMin) / longRange
  const f = Math.max(0, Math.min(CONTOUR_BUCKETS - 1, t * CONTOUR_BUCKETS - 0.5))
  const i0 = Math.floor(f)
  const i1 = Math.min(CONTOUR_BUCKETS - 1, i0 + 1)
  return heights[i0] * (1 - (f - i0)) + heights[i1] * (f - i0)
}

function pickLongAxis(size) {
  if (size.x >= size.y && size.x >= size.z) return { long: 'x', upY: 'y', lat: 'z' }
  if (size.z >= size.x && size.z >= size.y) return { long: 'z', upY: 'y', lat: 'x' }
  return { long: 'y', upY: 'z', lat: 'x' }
}

const AXIS_VECTORS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}

function pickBoneLongAxis(geometry) {
  const box  = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position)
  const size = box.getSize(new THREE.Vector3())
  if (size.x >= size.y && size.x >= size.z) return 'x'
  if (size.z >= size.x && size.z >= size.y) return 'z'
  return 'y'
}

// Rotate each bone's geometry so its longest axis points up (+Y) so it
// protrudes visibly through the fish skin with the tip above the surface.
function alignBoneVertical(geometry) {
  const boneAxisName = pickBoneLongAxis(geometry)
  if (boneAxisName === 'y') return
  const from = AXIS_VECTORS[boneAxisName]
  const to   = AXIS_VECTORS.y
  const quat = new THREE.Quaternion().setFromUnitVectors(from, to)
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quat))
}

// Distribute bones evenly along the fish contour. Mutates entries in place.
function scatterAndAlignBones(bones, contour) {
  const { box, longMin, longMax, axes } = contour
  const { long, upY, lat } = axes
  const size = box.getSize(new THREE.Vector3())

  const margin    = (longMax - longMin) * SCATTER_MARGIN
  const lo        = longMin + margin
  const hi        = longMax - margin
  const yLift     = size[upY] * SCATTER_Y_LIFT
  const latCenter = (box.min[lat] + box.max[lat]) * 0.5
  const latAmp    = size[lat] * SCATTER_LATERAL_AMPLITUDE

  const tmpBox = new THREE.Box3()
  let validCount = 0
  for (let i = 0; i < bones.length; i++) if (bones[i]) validCount++
  if (validCount === 0) return

  let placed = 0
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i]
    if (!b) continue

    alignBoneVertical(b.geometry)
    tmpBox.setFromBufferAttribute(b.geometry.attributes.position)
    tmpBox.getSize(b.size)

    const t         = (placed + 0.5) / validCount
    const longCoord = THREE.MathUtils.lerp(lo, hi, t)
    const surfaceY  = sampleVentralY(contour, longCoord) + yLift
    const lateral   = Math.sin(t * Math.PI * 2 * 2) * latAmp

    const pos = new THREE.Vector3()
    pos[long] = longCoord
    pos[upY]  = surfaceY
    pos[lat]  = latCenter + lateral
    b.position = pos

    placed++
  }
}

// DevTools helper — run __dumpVentralBones() in the console to print every
// bone's final [x, y, z] as a copy-pasteable config table.
function installDumpHelper(promise) {
  if (typeof window === 'undefined') return
  window.__dumpVentralBones = async () => {
    const bones = await promise
    const lines = bones.map((b, i) => {
      if (!b) return `/* ${String(i + 1).padStart(2, ' ')} */ null,`
      const { x, y, z } = b.position
      return `/* ${String(i + 1).padStart(2, ' ')} */ [${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)}],`
    })
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))
  }
}

let _cachePromise = null

export function loadVentralBones() {
  if (_cachePromise) return _cachePromise

  const bonesP = loadBonesFromAtlas()
  const fishP  = loadFishContour()

  _cachePromise = Promise.all([bonesP, fishP]).then(([bones, contour]) => {
    if (contour) scatterAndAlignBones(bones, contour)
    return bones
  })

  installDumpHelper(_cachePromise)
  return _cachePromise
}

// Kick off the load on module import so bones are ready by the time the user
// reaches step 8 (StepManager imports this module at sim entry).
loadVentralBones()

// ═══════════════════════════════════════════════════════════════════════════
// END INLINED: ventralBonesLoader.js
// ═══════════════════════════════════════════════════════════════════════════

// ── Butterflied-fish placement (mirrored from FishModel.jsx) ────────────────
// In sync with FISH_WORLD.cuttingBoard in FishModel.jsx. Hardcoded here so
// the preview is fully standalone — no FishModel dependency, no closed→butterflied fade.
const FISH_POS_CB             = [0.93, 0.97, -2.19]
const FISH_ROTATION_Y         = Math.PI / 2
const BUTTERFLIED_SCALE       = 0.24
const BUTTERFLIED_FLAT_TILT_X = -0.05
const BUTTERFLIED_FLAT_TILT_Z = 0.0
const BUTTERFLIED_LIFT        = 0.02
const BUTTERFLIED_BACK_SHIFT  = 0.0

// Renders the butterflied bangus on the chopping board for the step-8 preview.
// No bounding-box math, no closed-model load. Just clone the GLB, force every
// material fully opaque (the shared GLB cache can be left at opacity=0 by the
// live sim's fade system), and place it at the board position.
function ButterfliedFishOnBoard({ boneSlot }) {
  const { scene: butterfliedScene } = useGLTF('/models/DaingCuttedFins.glb')

  const butterfliedClone = useMemo(() => {
    const clone = butterfliedScene.clone()
    clone.traverse((c) => {
      if (!c.isMesh) return
      const src = Array.isArray(c.material) ? c.material : [c.material]
      const dst = src.map((m) => {
        const mat       = m.clone()
        mat.transparent = false
        mat.opacity     = 1
        mat.depthWrite  = true
        mat.visible     = true
        mat.needsUpdate = true
        return mat
      })
      c.material = dst.length === 1 ? dst[0] : dst
    })
    return clone
  }, [butterfliedScene])

  return (
    <group position={FISH_POS_CB}>
      <primitive
        object={butterfliedClone}
        scale={1.0}
        position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
        rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
      />
      {boneSlot && (
        <group
          position={[0, BUTTERFLIED_LIFT, BUTTERFLIED_BACK_SHIFT]}
          rotation={[BUTTERFLIED_FLAT_TILT_X, FISH_ROTATION_Y, BUTTERFLIED_FLAT_TILT_Z]}
          scale={BUTTERFLIED_SCALE}
        >
          {boneSlot}
        </group>
      )}
    </group>
  )
}

useGLTF.preload('/models/DaingCuttedFins.glb')

// ═══════════════════════════════════════════════════════════════════════════
// 1) PER-BONE POSITION TABLE — ONE LINE PER VENTRAL BONE (1..48).
//
//    HOW TO EDIT BONE POSITIONS:
//      position: [ X, Y, Z ]
//        X = left (-) / right (+)   → lateral offset from the ventral midline
//        Y = down (-) / up (+)       → lower = more buried inside fish belly
//        Z = tail (-) / head (+)     → follows the fish backbone; bones are
//                                      spaced 0.05 apart along this axis
//      rotation: [ pitch (X), yaw (Y), roll (Z) ]  (in radians)
//        pitch = tilt forward/backward (positive tilts tip toward head)
//        yaw   = lean left/right (keep near 0 for symmetry along midline)
//        roll  = twist around the bone's long axis (usually 0)
//      scale = length multiplier (0.8 to 1.2 typical range)
//
//    FINDING A STARTING POINT
//      Run __dumpVentralBones() in DevTools — the loader prints each bone's
//      auto-scattered [x, y, z]. Copy a value from there and tweak.
//
//    Coordinates are in butterflied-LOCAL space. The parent group in
//    ButterfliedFishOnBoard applies BUTTERFLIED_SCALE + tilt + FISH_POS_CB,
//    so these numbers line up 1:1 with the Blender frame.
// ═══════════════════════════════════════════════════════════════════════════

const VENTRAL_BONES = Object.freeze([
  // ── Top ─────────────────────────
  /*  1 */ { position: [0.400, 0.007, 1.15], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /*  2 */ { position: [0.408, 0.012, 1.10], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /*  3 */ { position: [0.410, 0.020, 1.05], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /*  4 */ { position: [0.414, 0.029, 1.00], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /*  5 */ { position: [0.417, 0.040, 0.95], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /*  6 */ { position: [0.420, 0.050, 0.90], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /*  7 */ { position: [0.424, 0.060, 0.85], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /*  8 */ { position: [0.427, 0.070, 0.80], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /*  9 */ { position: [0.430, 0.080, 0.75], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 10 */ { position: [0.431, 0.090, 0.70], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 11 */ { position: [0.429, 0.100, 0.65], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 12 */ { position: [0.429, 0.110, 0.60], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 13 */ { position: [0.426, 0.120, 0.55], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 14 */ { position: [0.423, 0.130, 0.50], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 15 */ { position: [0.423, 0.140, 0.45], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 16 */ { position: [0.416, 0.140, 0.40], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 17 */ { position: [0.410, 0.140, 0.35], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 18 */ { position: [0.400, 0.143, 0.30], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 19 */ { position: [0.389, 0.145, 0.25], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 20 */ { position: [0.384, 0.150, 0.20], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 21 */ { position: [0.374, 0.150, 0.15], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 22 */ { position: [0.365, 0.150, 0.10], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 23 */ { position: [0.357, 0.155, 0.05], rotation: [2.00, 1.00, 2.00], scale: 1.0 },
  /* 24 */ { position: [0.350, 0.150, 0.00], rotation: [2.00, 1.00, 2.00], scale: 1.0 },

  // ── Bottom ─────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
// 2) BONE / INTERACTION TUNING (mirrors Step5Preview).
// ═══════════════════════════════════════════════════════════════════════════

const BONE_SCALE   = 0.28
const HIT_PADDING  = 2.2
const DRAG_LERP    = 0.55
const SNAP_LERP    = 0.18
const SNAP_EPS_SQ  = 1e-4
const DRAG_PLANE_Y = 1.05
const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y)

// Chopping board world-space XZ footprint (position [1.0, 0.942, -2.19], size [0.9, -, 0.5])
const BOARD_MIN_X = 0.55   // 1.0 - 0.45
const BOARD_MAX_X = 1.45   // 1.0 + 0.45
const BOARD_MIN_Z = -2.44  // -2.19 - 0.25
const BOARD_MAX_Z = -1.94  // -2.19 + 0.25

// One unit-cube + one transparent material drives all 48 hit volumes —
// 47× fewer GPU resource allocations than per-bone geometry/material clones.
const HIT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

// ═══════════════════════════════════════════════════════════════════════════
// 3) POSITION OVERRIDE APPLICATOR
//    Overlays VENTRAL_BONES onto the loader's auto-scattered entries.
//    Returns a new array of cloned entries — never mutates the loader cache.
//    Handles both the legacy [x,y,z] array form and the full object form.
// ═══════════════════════════════════════════════════════════════════════════

function applyPreviewPositions(entries) {
  const out = new Array(entries.length)
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (!e) { out[i] = null; continue }
    const ovr = VENTRAL_BONES[i]
    if (ovr == null) { out[i] = e; continue }

    let posArr = null, rotArr = null, scaleMul = null
    if (Array.isArray(ovr)) {
      posArr = ovr
    } else {
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

// ═══════════════════════════════════════════════════════════════════════════
// 4) BONE CLUSTER — rendered inside FishModel's ventralBoneSlot, so it
//    inherits the butterflied transform group's scale/rotation/position 1:1.
// ═══════════════════════════════════════════════════════════════════════════

function BoneCluster({ removedRef, currentDragSrcRef, snappingRef, removedVersion, onBoneGrab, onBoneDiscarded }) {
  const clusterGroupRef = useRef()
  const boneGroupRefs   = useRef([])
  const indexBySrcRef   = useRef(new Map())
  const [bones, setBones] = useState(null)
  const { camera, gl }    = useThree()

  const cursorRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e) => { cursorRef.current.x = e.clientX; cursorRef.current.y = e.clientY }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const onBoneDiscardedRef = useRef(onBoneDiscarded)
  useEffect(() => { onBoneDiscardedRef.current = onBoneDiscarded }, [onBoneDiscarded])

  // Pull bones from the production cache (geometry + size), then apply the
  // explicit VENTRAL_BONES overrides over the loader's auto-scatter.
  useEffect(() => {
    let cancelled = false
    loadVentralBones().then((entries) => {
      if (cancelled) return
      const positioned = applyPreviewPositions(entries)
      const ok  = []
      const map = new Map()
      for (let i = 0; i < positioned.length; i++) {
        const e = positioned[i]
        if (!e) continue
        map.set(i, ok.length)
        ok.push({ ...e, srcIndex: i })
      }
      indexBySrcRef.current = map
      setBones(ok)
    })
    return () => { cancelled = true }
  }, [])

  // Push the removed-set onto bone visibility — runs once per drop.
  useEffect(() => {
    if (!bones) return
    const removed = removedRef.current
    for (let i = 0; i < bones.length; i++) {
      const g = boneGroupRefs.current[i]
      if (!g) continue
      const v = !removed.has(bones[i].srcIndex)
      if (g.visible !== v) g.visible = v
    }
  }, [bones, removedVersion, removedRef])

  // Per-frame scratch vectors — allocated once per mount.
  const ndc      = useMemo(() => new THREE.Vector2(), [])
  const ray      = useMemo(() => new THREE.Raycaster(), [])
  const hitWorld = useMemo(() => new THREE.Vector3(), [])
  const hitLocal = useMemo(() => new THREE.Vector3(), [])
  const restTmp  = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!bones || !clusterGroupRef.current) return

    const dragSrc = currentDragSrcRef.current
    if (dragSrc != null) {
      const arrIdx = indexBySrcRef.current.get(dragSrc)
      const g      = arrIdx != null ? boneGroupRefs.current[arrIdx] : null
      if (g) {
        const rect = gl.domElement.getBoundingClientRect()
        ndc.x =  ((cursorRef.current.x - rect.left) / rect.width)  * 2 - 1
        ndc.y = -((cursorRef.current.y - rect.top)  / rect.height) * 2 + 1
        ray.setFromCamera(ndc, camera)
        if (ray.ray.intersectPlane(DRAG_PLANE, hitWorld)) {
          hitLocal.copy(hitWorld)
          clusterGroupRef.current.worldToLocal(hitLocal)
          g.position.lerp(hitLocal, DRAG_LERP)

          // Discard once the cursor leaves the chopping board's XZ footprint
          if (
            hitWorld.x < BOARD_MIN_X || hitWorld.x > BOARD_MAX_X ||
            hitWorld.z < BOARD_MIN_Z || hitWorld.z > BOARD_MAX_Z
          ) {
            g.scale.setScalar(0)
            onBoneDiscardedRef.current(dragSrc)
          }
        }
      }
    }

    const snapping = snappingRef.current
    if (snapping.size > 0) {
      const toRemove = []
      snapping.forEach((srcIdx) => {
        const arrIdx = indexBySrcRef.current.get(srcIdx)
        if (arrIdx == null) { toRemove.push(srcIdx); return }
        const g = boneGroupRefs.current[arrIdx]
        if (!g) { toRemove.push(srcIdx); return }
        restTmp.copy(bones[arrIdx].position)
        g.position.lerp(restTmp, SNAP_LERP)
        if (g.position.distanceToSquared(restTmp) < SNAP_EPS_SQ) {
          g.position.copy(restTmp)
          toRemove.push(srcIdx)
        }
      })
      for (let i = 0; i < toRemove.length; i++) snapping.delete(toRemove[i])
    }
  })

  if (!bones) return null

  return (
    <group ref={clusterGroupRef}>
      {bones.map((bone, i) => {
        const { geometry, position, size, srcIndex } = bone
        const rot      = bone.rotation        ?? [0, 0, 0]
        const visScale = BONE_SCALE * (bone.scaleMultiplier ?? 1)
        const hx = Math.max(size.x, 0.005) * HIT_PADDING * visScale
        const hy = Math.max(size.y, 0.005) * HIT_PADDING * visScale
        const hz = Math.max(size.z, 0.005) * HIT_PADDING * visScale
        return (
          <group
            key={srcIndex}
            ref={(el) => { boneGroupRefs.current[i] = el }}
            position={[position.x, position.y, position.z]}
            rotation={rot}
          >
            <mesh geometry={geometry} material={BONE_MATERIAL} scale={visScale} />
            <mesh
              geometry={HIT_GEOMETRY}
              material={HIT_MATERIAL}
              scale={[hx, hy, hz]}
              onPointerDown={(e) => { e.stopPropagation(); onBoneGrab(srcIndex) }}
            />
          </group>
        )
      })}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) HUD
// ═══════════════════════════════════════════════════════════════════════════

const HINT_STYLE = {
  position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
  background: 'rgba(4,20,8,0.92)', border: '2px solid rgba(78,205,113,0.45)',
  borderRadius: 40, padding: '10px 22px', color: '#4ecd71', fontSize: 14,
  fontWeight: 600, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 10,
  fontFamily: "'Rajdhani', sans-serif", backdropFilter: 'blur(8px)',
  zIndex: 101, pointerEvents: 'none', whiteSpace: 'nowrap',
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) DRAG / SNAP STATE — same role as useVentralBonesStep, FSM-stripped.
// ═══════════════════════════════════════════════════════════════════════════

function useStep6Interaction() {
  const removedRef        = useRef(new Set())
  const currentDragSrcRef = useRef(null)
  const snappingRef       = useRef(new Set())
  const doneRef           = useRef(false)

  const [count,    setCount]    = useState(0)
  const [dragging, setDragging] = useState(false)

  const onBoneDiscarded = useCallback((srcIdx) => {
    if (doneRef.current)                return
    if (removedRef.current.has(srcIdx)) return
    removedRef.current.add(srcIdx)
    currentDragSrcRef.current = null
    setDragging(false)
    const total = removedRef.current.size
    setCount(total)
    if (total >= TOTAL_VENTRAL_BONES) doneRef.current = true
  }, [])

  useEffect(() => {
    const onUp = () => {
      const idx = currentDragSrcRef.current
      if (idx == null) return
      currentDragSrcRef.current = null
      setDragging(false)
      if (!removedRef.current.has(idx)) {
        snappingRef.current.add(idx)
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [])

  const onBoneGrab = useCallback((srcIdx) => {
    if (doneRef.current)                   return
    if (currentDragSrcRef.current != null) return
    if (removedRef.current.has(srcIdx))    return
    snappingRef.current.delete(srcIdx)
    currentDragSrcRef.current = srcIdx
    setDragging(true)
  }, [])

  return {
    removedRef, currentDragSrcRef, snappingRef,
    count, dragging,
    onBoneGrab, onBoneDiscarded,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7) DEFAULT EXPORT — Canvas tuned for low-end PCs:
//    shadows OFF, dpr capped at 1×, AdaptiveDpr/Events + PerformanceMonitor.
// ═══════════════════════════════════════════════════════════════════════════

export default function Step6Preview() {
  const s = useStep6Interaction()

  const allDone = s.count >= TOTAL_VENTRAL_BONES
  const message = allDone
    ? '✅ All ventral spines removed!'
    : s.dragging
      ? '🦴 Keep pulling away from the fish…'
      : '🥢 Grab a glowing ventral bone and pull it away'

  const boneSlot = useMemo(() => (
    <BoneCluster
      removedRef={s.removedRef}
      currentDragSrcRef={s.currentDragSrcRef}
      snappingRef={s.snappingRef}
      removedVersion={s.count}
      onBoneGrab={s.onBoneGrab}
      onBoneDiscarded={s.onBoneDiscarded}
    />
  ), [s.removedRef, s.currentDragSrcRef, s.snappingRef, s.count, s.onBoneGrab, s.onBoneDiscarded])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0c1014' }}>
      <Canvas
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
        dpr={[1, 1]}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <PerformanceMonitor onDecline={() => {}} />

        <Suspense fallback={null}>
          <color attach="background" args={['#b8ccd8']} />
          <fog   attach="fog"        args={['#b8ccd8', 14, 28]} />

          <KitchenEnvironment waterOn={false} cuttingBoardHighlighted={false} />

          <GameCamera
            cameraPreset="cuttingBoardTop"
            lerpSpeed={1}
            orbitEnabled={false}
            instant
          />

          <ForcepsTool grabbing={s.dragging} />
          <ButterfliedFishOnBoard boneSlot={boneSlot} />
        </Suspense>
      </Canvas>

      <div style={HINT_STYLE}>
        <span>{message}</span>
      </div>

      {!allDone && (
        <div style={{
          position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(245,200,66,0.75)', fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
          pointerEvents: 'none', zIndex: 101,
        }}>
          {s.count} / {TOTAL_VENTRAL_BONES} removed
        </div>
      )}

      <div style={{
        position: 'absolute', top: 12, right: 12, padding: '6px 12px',
        background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.45)',
        borderRadius: 8, color: '#f5c842', fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
        pointerEvents: 'none', zIndex: 200,
      }}>
        Step 8 Preview · Dev Only
      </div>
    </div>
  )
}