// src/simulation/Step5Preview.jsx
//
// Standalone Step-5 (dorsal spine removal) preview. Self-contained: does
// NOT mount StepManager, FSM, or any shared step component — just renders
// KitchenEnvironment + GameCamera + the production FishModel held in its
// post-cut "butterflied + flat" pose, with the 88-bone dorsal cluster
// attached through FishModel's `dorsalBoneSlot`.
//
// Why FishModel directly: the live sim's FishModel already owns the
// closed→butterflied fade, the bottom-alignment Y offset, the GLB material
// state, and a bone-slot whose transform mirrors the butterflied primitive.
// Re-using it keeps this preview pixel-identical to step 5 in the real
// flow and avoids any drift between the two paths.
//
// Performance budget (low-end PC target):
//   • shadows OFF on the canvas, dpr capped to 1×, AdaptiveDpr/Events.
//   • cutComplete={true} → FishModel's per-frame fade loop early-exits on
//     the first frame; the closed mesh becomes invisible so only the
//     butterflied mesh draws.
//   • One module-level THREE.BoxGeometry + one transparent MeshBasicMaterial
//     drives all 88 hit volumes — 87× fewer GPU resource allocations.
//   • Per-frame scratch vectors are allocated once per mount via useMemo.
//
// ── Interaction model (no trash bin) ────────────────────────────────────────
//   The user grabs a dorsal bone and drags it away from the fish. Once the
//   bone travels DRAG_DISCARD_DIST_SQ (local units) from its rest position
//   it auto-discards with a micro-pop (scale → 0) and disappears. Releasing
//   before the threshold snaps the bone back to its rest position.
//   This removes the need for a separate trash-bin drop target entirely.

import {
  Suspense, useEffect, useMemo, useState, useRef, useCallback, forwardRef,
} from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import {
  AdaptiveDpr, AdaptiveEvents, PerformanceMonitor,
} from '@react-three/drei'
import { useGLTF }            from '../utils/useGLTFLocal'
import * as THREE             from 'three'
import { makeGLTFLoader }     from '../utils/dracoGLTFLoader'

import { KitchenEnvironment } from '../components/environment/KitchenEnvironment'
import { GameCamera }         from '../components/camera/GameCamera'

// ═══════════════════════════════════════════════════════════════════════════
// INLINED: src/simulation/components/steps/dorsalBonesLoader.js
//
// 88 dorsal intermuscular spines, packed into a single Draco-compressed atlas
// at build time by `npm run optimize-assets`. Each bone is a named Mesh
// (`dorsal_001` … `dorsal_088`) inside the atlas scene.
// ═══════════════════════════════════════════════════════════════════════════

export const TOTAL_DORSAL_BONES = 88

// Single-file atlas. Replaces the legacy per-file fetch of 88 individual
// GLBs (~71 MB → ~20 KB) — see web/scripts/optimize-assets.mjs for the
// build-time pipeline that produced it.
const ATLAS_PATH    = '/models/bones/dorsal-atlas.glb'
const BONE_NAME_RE  = /^dorsal_(\d+)$/i

// Reference mesh used to size the dorsal-line distribution range. Now points
// at the Draco-compressed copy emitted by Phase B optimization.
const FISH_PATH = '/models/DaingCuttedFins.glb'

// ── Distribution tuning ──────────────────────────────────────────────────────
// Fraction of the long-axis range to leave empty at each end (head + tail).
// 0.08 = bones span 84 % of the fish length, leaving 8 % padding on each side.
const SCATTER_MARGIN = 0.08
// Vertical placement relative to the fish bbox top, expressed as a fraction
// of the bbox Y span. 0 = bone center sits exactly on the dorsal surface so
// roughly half the (already tiny) bone protrudes; negative buries the bone
// further; positive lifts it off the flesh.
const SCATTER_Y_LIFT = 0.0
// Lateral noise around the dorsal centerline, as a fraction of the fish
// bbox's lateral span. Small value keeps the row tight along the dorsal cut
// line where intermuscular spines actually live; 0 = perfectly straight line.
const SCATTER_LATERAL_AMPLITUDE = 0.015

// Single GLTFLoader instance — every fetch reuses its parser/cache. Draco-
// aware so the compressed atlas decodes correctly.
const _loader = makeGLTFLoader()

export const BONE_MATERIAL = new THREE.MeshLambertMaterial({
  color:             '#fff4cf',
  emissive:          new THREE.Color('#ffce4d'),
  emissiveIntensity: 1.4,
})

// Pull all dorsal bones out of the atlas in one fetch. Each named mesh in
// the atlas (dorsal_001 … dorsal_088) becomes one slot in the returned
// array; missing slots stay null so the consumer can render a sparse set
// without crashing if the atlas was rebuilt with fewer bones.
function loadBonesFromAtlas() {
  return new Promise((resolve) => {
    _loader.load(
      ATLAS_PATH,
      (gltf) => {
        const bones = new Array(TOTAL_DORSAL_BONES).fill(null)

        gltf.scene.traverse((c) => {
          if (!c.isMesh) return
          const m = BONE_NAME_RE.exec(c.name)
          if (!m) return
          const slot = parseInt(m[1], 10) - 1
          if (slot < 0 || slot >= TOTAL_DORSAL_BONES) return

          // Per-mesh world matrix is identity in the atlas (the optimize
          // script baked each bone's authoring transform into the vertex
          // positions before atlasing), but updateMatrixWorld + apply is
          // cheap and keeps this code path symmetric for any future
          // atlases that DO carry node transforms.
          c.updateMatrixWorld(true)
          // Atlas dedup may collapse identical bone primitives behind the
          // scenes — clone the geometry per slot so subsequent in-place
          // mutations (alignBoneVertical, manual rotation overrides) don't
          // leak across slots.
          const geometry = c.geometry.clone()
          geometry.applyMatrix4(c.matrixWorld)

          // Center on bbox center; store center + size separately so the
          // consumer can position + scale each bone around its own center.
          const box      = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position)
          const position = box.getCenter(new THREE.Vector3())
          const size     = box.getSize(new THREE.Vector3())
          geometry.translate(-position.x, -position.y, -position.z)

          bones[slot] = { geometry, position, size }
        })

        resolve(bones)
      },
      undefined,
      // Atlas failure should not crash sim entry — return empty slots so
      // step 5 renders without bones (the user gets the kitchen + fish
      // and can still progress past via UI).
      () => resolve(new Array(TOTAL_DORSAL_BONES).fill(null)),
    )
  })
}

// Number of slices used to sample the fish's dorsal contour along the
// head→tail axis. 64 is plenty for ~88 bones — adjacent bones land in the
// same slice (smooth curve) instead of jumping between sparse samples.
const CONTOUR_BUCKETS = 64

// Load butterfliedBangus.glb and build:
//   • the local-space bounding box (used for length range + lateral center)
//   • a 1D height profile: for each slice along the head→tail axis, the
//     maximum Y of the actual mesh vertices in that slice. Each bone looks
//     up its Y from this profile, so bones follow the real dorsal contour
//     of the butterflied fish — not the flat top of the bbox.
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
        const longRange = longMax - longMin || 1  // guard /0
        const heights   = new Float32Array(CONTOUR_BUCKETS).fill(-Infinity)

        // Sample every vertex of every mesh in the GLB. One-time cost at
        // load — bone positions are baked from the result and never recomputed.
        const v = new THREE.Vector3()
        gltf.scene.traverse((c) => {
          if (!c.isMesh) return
          const posAttr = c.geometry.attributes.position
          const matrix  = c.matrixWorld
          for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i).applyMatrix4(matrix)
            const t   = (v[long] - longMin) / longRange
            const idx = Math.min(CONTOUR_BUCKETS - 1,
                                 Math.max(0, Math.floor(t * CONTOUR_BUCKETS)))
            if (v[upY] > heights[idx]) heights[idx] = v[upY]
          }
        })

        // Fill any empty slices (shouldn't normally happen, but a safety net)
        // by interpolating from the nearest populated neighbours.
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

// Sample the dorsal height profile at a given long-axis coordinate. Linear
// interpolation between the two nearest slices for a smooth contour.
function sampleDorsalY(contour, longCoord) {
  const { heights, longMin, longRange } = contour
  const t = (longCoord - longMin) / longRange
  const f = Math.max(0, Math.min(CONTOUR_BUCKETS - 1, t * CONTOUR_BUCKETS - 0.5))
  const i0 = Math.floor(f)
  const i1 = Math.min(CONTOUR_BUCKETS - 1, i0 + 1)
  const frac = f - i0
  return heights[i0] * (1 - frac) + heights[i1] * frac
}

// Pick the longest of the three bbox axes — that's the head-to-tail axis.
// Returns the axis name + the two perpendicular axes for lateral noise.
function pickLongAxis(size) {
  if (size.x >= size.y && size.x >= size.z) return { long: 'x', upY: 'y', lat: 'z' }
  if (size.z >= size.x && size.z >= size.y) return { long: 'z', upY: 'y', lat: 'x' }
  return { long: 'y', upY: 'z', lat: 'x' }  // unusual — fish modelled along Y
}

const AXIS_VECTORS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}

// Pick the longest axis of an already-centered bone bbox. Returns 'x'/'y'/'z'.
function pickBoneLongAxis(geometry) {
  const box  = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position)
  const size = box.getSize(new THREE.Vector3())
  if (size.x >= size.y && size.x >= size.z) return 'x'
  if (size.z >= size.x && size.z >= size.y) return 'z'
  return 'y'
}

// Rotate the (already-centered) bone geometry so its longest axis points
// straight UP (world +Y) — every bone ends up standing vertically with its
// tip at the top, regardless of how it was authored in Blender.
//
// With bones vertical and centered on the fish surface, the top half of
// each bone protrudes through the dorsal skin (the visible glowing tip)
// and the bottom half is naturally occluded by the opaque flesh below.
function alignBoneVertical(geometry) {
  const boneAxisName = pickBoneLongAxis(geometry)
  if (boneAxisName === 'y') return  // already vertical

  const from = AXIS_VECTORS[boneAxisName]
  const to   = AXIS_VECTORS.y
  const quat = new THREE.Quaternion().setFromUnitVectors(from, to)
  const m    = new THREE.Matrix4().makeRotationFromQuaternion(quat)
  geometry.applyMatrix4(m)
}

// Distribute bone positions along the dorsal contour of the butterflied
// fish AND re-orient each bone so its long axis points up. Each bone's Y
// is sampled from the actual mesh-vertex height profile, so bones sit on
// the real dorsal surface (not the flat bbox top). Also recomputes each
// bone's `size` after rotation so the hit volumes stay accurate.
// Mutates entries in place; skips null entries.
function scatterAndAlignBones(bones, contour) {
  const { box, longMin, longMax, axes } = contour
  const { long, upY, lat } = axes
  const size = box.getSize(new THREE.Vector3())

  const margin = (longMax - longMin) * SCATTER_MARGIN
  const lo     = longMin + margin
  const hi     = longMax - margin
  const yLift     = size[upY] * SCATTER_Y_LIFT  // additive lift over the contour
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

    // Rotate the bone's geometry so its long axis points up (+Y).
    alignBoneVertical(b.geometry)

    // Refresh size after rotation — the hit-volume scale uses this.
    tmpBox.setFromBufferAttribute(b.geometry.attributes.position)
    tmpBox.getSize(b.size)

    // Distribute along the dorsal length, then sample the actual mesh
    // height at that long-axis coordinate so the bone lands on the dorsal
    // surface curve instead of a flat ceiling.
    const t        = (placed + 0.5) / validCount
    const longCoord = THREE.MathUtils.lerp(lo, hi, t)
    const surfaceY  = sampleDorsalY(contour, longCoord) + yLift
    const lateral   = Math.sin(t * Math.PI * 2 * 2) * latAmp

    const pos = new THREE.Vector3()
    pos[long] = longCoord
    pos[upY]  = surfaceY
    pos[lat]  = latCenter + lateral
    b.position = pos

    placed++
  }
}

// DevTools helper — paste `__dumpDorsalBones()` into the browser console
// to print every bone's final position. Copy values into dorsalBonesConfig
// as starting points for manual tuning.
function installDumpHelper(promise) {
  if (typeof window === 'undefined') return
  window.__dumpDorsalBones = async () => {
    const bones = await promise
    const lines = bones.map((b, i) => {
      if (!b) return `/* ${String(i + 1).padStart(2, ' ')} */ null,  // <missing>`
      const p = b.position
      const px = p.x.toFixed(4)
      const py = p.y.toFixed(4)
      const pz = p.z.toFixed(4)
      return `/* ${String(i + 1).padStart(2, ' ')} */ [${px}, ${py}, ${pz}],`
    })
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))
  }
}

// Promise<Array<{ geometry, position, size, rotation?, scaleMultiplier? } | null>>
// — one slot per BONE_PATHS index.
let _cachePromise = null

// Returns the cached promise; initiates fetches on first call.
export function loadDorsalBones() {
  if (_cachePromise) return _cachePromise

  // Two parallel fetches: the atlas (all 88 bones) + the fish contour.
  // Down from 89 fetches in the per-file era.
  const bonesP = loadBonesFromAtlas()
  const fishP  = loadFishContour()

  _cachePromise = Promise.all([bonesP, fishP]).then(([bones, contour]) => {
    // If the fish contour failed to load, fall back to authored bone
    // positions (they'll cluster, but at least the step still renders).
    if (contour) scatterAndAlignBones(bones, contour)
    // Per-bone position overrides are applied by the consumer (Step07BoneCluster)
    // via applyDorsalPositions() from dorsalBonesConfig.js — not here.
    return bones
  })

  installDumpHelper(_cachePromise)
  return _cachePromise
}

// Kick off the load on module import. StepManager imports Step07DorsalBones
// at sim entry, which imports this module — fetches start during steps 1–4.
loadDorsalBones()

// ═══════════════════════════════════════════════════════════════════════════
// END INLINED: dorsalBonesLoader.js
// ═══════════════════════════════════════════════════════════════════════════

// ── Butterflied-fish placement (mirrored from FishModel.jsx) ────────────────
// Keep these in sync with FishModel.jsx. Hardcoded here so the preview is
// fully standalone — no FishModel dependency, no closed→butterflied fade.
const FISH_POS_CB             = [0.93, 0.97, -2.19]
const FISH_ROTATION_Y         = Math.PI / 2
const CLOSED_SCALE            = 0.6   // used only for bottom-alignment math
const BUTTERFLIED_SCALE       = 0.24
const BUTTERFLIED_FLAT_TILT_X = -0.05
const BUTTERFLIED_FLAT_TILT_Z = 0.0
const BUTTERFLIED_LIFT        = 0.02
const BUTTERFLIED_BACK_SHIFT  = 0.0

// Renders the butterflied bangus on the chopping board for the step-5 preview.
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
// 1) PER-BONE DEFINITIONS — POSITION, ROTATION (radians), SCALE MULTIPLIER
//    Coordinates are in butterflied-LOCAL space (FishModel's dorsalBoneSlot
//    sits inside a group that applies BUTTERFLIED_SCALE + rotationY + tilt
//    for you), so values line up 1:1 with what __dumpDorsalBones() prints
//    in DevTools during the live sim.
//
//    Each entry can be:
//      - simple array [x, y, z] → position only, rotation = [0,0,0], scale = 1
//      - object { position: [x,y,z], rotation: [rx,ry,rz], scale?: number }
//    Rotation is applied in XYZ order.
// ═══════════════════════════════════════════════════════════════════════════

const DORSAL_BONES = Object.freeze([
  // =========================================================================
  // HOW TO EDIT BONE POSITIONS:
  //   position: [ X, Y, Z ]
  //     X = left (-) / right (+)   → tiny adjustments (keep near 0 for spine)
  //     Y = down (-) / up (+)       → lower = more buried inside fish
  //     Z = tail (-) / head (+)     → follows the fish backbone
  //   rotation: [ pitch (X), yaw (Y), roll (Z) ]  (in radians)
  //     pitch = tilt forward/backward (0.7-0.9 rad = ~40-50°)
  //     yaw   = lean left/right (-0.03 to 0.03)
  //     roll  = twist (usually 0)
  //   scale = length multiplier (0.7 to 1.1)
  // =========================================================================
  // Upper Left
  /*  1 */ { position: [0.12, 0.05, -0.6], rotation: [-0.45, 0.5, -1.00], scale: 1.0},
  /*  2 */ { position: [0.13, 0.05, -0.55], rotation: [-0.45, 0.5, -1.00], scale: 1.0},
  /*  3 */ { position: [0.14, 0.05, -0.5], rotation: [-0.45, 0.5, -1.00], scale: 1.05},
  /*  4 */ { position: [0.185, 0.07, -0.47], rotation: [-0.45, 0.5, -1.00], scale: 1.05},
  /*  5 */ { position: [0.185, 0.07, -0.4], rotation: [-0.45, 0.5, -1.00], scale: 1.05},
  /*  6 */ { position: [0.21, 0.09, -0.36], rotation: [-0.45, 0.5, -1.00], scale: 1.05},
  /*  7 */ { position: [0.24, 0.10, -0.34], rotation: [-0.45, 0.5, -0.903], scale: 1.05},
  /*  8 */ { position: [0.24, 0.10, -0.28], rotation: [-0.45, 0.5, -0.903], scale: 1.05},
  /*  9 */ { position: [0.27, 0.114, -0.27], rotation: [-0.45, 0.5, -0.903], scale: 1.1},
  /* 10 */ { position: [0.27, 0.114, -0.21], rotation: [-0.45, 0.5, -0.903], scale: 1.1},
  /* 11 */ { position: [0.29, 0.13, -0.18], rotation: [-0.45, 0.5, -0.903], scale: 1.1},
  /* 12 */ { position: [0.31, 0.13, -0.11], rotation: [-0.45, 0.5, -0.903], scale: 1.1},
  /* 13 */ { position: [0.33, 0.13, -0.07], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 14 */ { position: [0.34, 0.13, -0.02], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 15 */ { position: [0.34, 0.13, 0.03], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 16 */ { position: [0.36, 0.13, 0.08], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 17 */ { position: [0.38, 0.14, 0.1], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 18 */ { position: [0.38, 0.14, 0.15], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 19 */ { position: [0.40, 0.15, 0.18], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 20 */ { position: [0.41, 0.15, 0.24], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 21 */ { position: [0.41, 0.15, 0.28], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 22 */ { position: [0.42, 0.15, 0.32], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 23 */ { position: [0.425, 0.15, 0.35], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 24 */ { position: [0.435, 0.15, 0.37], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 25 */ { position: [0.445, 0.15, 0.4], rotation: [-0.45, 0.5, -0.903], scale: 1.2},
  /* 26 */ { position: [0.45, 0.02, 0.24], rotation: [1.0, 0.8, -1.00], scale: 1.40},
  /* 27 */ { position: [0.457, 0.02, 0.27], rotation: [1.0, 0.8, -1.00], scale: 1.40},
  /* 28 */ { position: [0.468, 0.02, 0.31], rotation: [1.0, 0.8, -1.00], scale: 1.40},
  /* 29 */ { position: [0.475, 0.02, 0.35], rotation: [1.0, 0.8, -1.00], scale: 1.40},
  /* 30 */ { position: [0.48, 0.02, 0.39], rotation: [1.0, 0.8, -1.00], scale: 1.40},
  /* 31 */ { position: [0.49, 0.02, 0.45], rotation: [1.0, 0.8, -1.00], scale: 1.40},
  /* 32 */ { position: [0.49, 0.06, 0.38], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 33 */ { position: [0.49, 0.06, 0.45], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 34 */ { position: [0.49, 0.06, 0.52], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 35 */ { position: [0.50, 0.06, 0.6], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 36 */ { position: [0.495, 0.03, 0.68], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 37 */ { position: [0.49, 0.01, 0.75], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 38 */ { position: [0.48, -0.01, 0.82], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 39 */ { position: [0.47, -0.02, 0.89], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 40 */ { position: [0.46, -0.02, 0.95], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 41 */ { position: [0.445, -0.02, 1.02], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 42 */ { position: [0.44, -0.02, 1.08], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 43 */ { position: [0.42, -0.02, 1.14], rotation: [1.6, 0.8, -1.00], scale: 1.40},
  /* 44 */ { position: [0.4, -0.03, 1.2], rotation: [1.6, 0.8, -1.00], scale: 1.40},

  // Lower
  /* 45 */ { position: [-0.317, -0.08, -0.65], rotation: [-0.55, -2.5, -0.30], scale: 1.5 },
  /* 46 */ { position: [-0.335, -0.08, -0.623], rotation: [-0.55, -2.5, -0.30], scale: 1.5 },
  /* 47 */ { position: [-0.352, -0.08, -0.59], rotation: [-0.55, -2.5, -0.30], scale: 1.5 },
  /* 48 */ { position: [-0.361, -0.08, -0.55], rotation: [-0.55, -2.5, -0.30], scale: 1.5 },
  /* 49 */ { position: [-0.385, -0.08, -0.52], rotation: [-0.55, -2.5, -0.30], scale: 1.5 },
  /* 50 */ { position: [-0.41, -0.08, -0.48], rotation: [-0.55, -2.5, -0.30], scale: 1.5 },
  /* 51 */ { position: [-0.43, -0.08, -0.437], rotation: [-0.55, -2.5, -0.30], scale: 1.5 },
  /* 52 */ { position: [-0.45, -0.05, -0.4], rotation: [-0.55, -2.5, -0.30], scale: 1.5 },
  /* 53 */ { position: [-0.468, -0.05, -0.36], rotation: [-0.55, -2.5, -0.30], scale: 1.5  },
  /* 54 */ { position: [-0.475, -0.05, -0.31], rotation: [-0.55, -2.5, -0.30], scale: 1.7 },
  /* 55 */ { position: [-0.495, -0.05, -0.27], rotation: [-0.55, -2.5, -0.30], scale: 1.7 },
  /* 56 */ { position: [-0.53, -0.05, -0.2], rotation: [-0.55, -2.5, -0.30], scale: 1.7 },
  /* 57 */ { position: [-0.555, -0.05, -0.13], rotation: [-0.55, -2.5, -0.30], scale: 1.7 },
  /* 58 */ { position: [-0.58, -0.05, -0.06], rotation: [-0.55, -2.5, -0.30], scale: 1.7 },
  /* 59 */ { position: [-0.605, -0.05, 0.01], rotation: [-0.55, -2.5, -0.30], scale: 1.7 },
  /* 60 */ { position: [-0.61, -0.05, 0.08], rotation: [-0.55, -2.5, -0.30], scale: 1.9 },
  /* 61 */ { position: [-0.63, -0.05, 0.15], rotation: [-0.55, -2.5, -0.30], scale: 1.9 },
  /* 62 */ { position: [-0.654, -0.05, 0.21], rotation: [-0.55, -2.5, -0.30], scale: 1.9 },
  /* 63 */ { position: [-0.67, -0.05, 0.25], rotation: [-0.5, -2.5, -0.30], scale: 1.9 },
  /* 64 */ { position: [-0.679, -0.05, 0.316], rotation: [-0.5, -2.5, -0.30], scale: 1.9 },
  /* 65 */ { position: [-0.69, -0.05, 0.37], rotation: [-0.5, -2.5, -0.30], scale: 1.9 },
  /* 66 */ { position: [-0.71, -0.05, 0.42], rotation: [-0.45, -2.5, -0.30], scale: 1.9 },
  /* 67 */ { position: [-0.714, -0.05, 0.47], rotation: [-0.45, -2.5, -0.30], scale: 1.9 },
  /* 68 */ { position: [-0.719, -0.05, 0.53], rotation: [-0.45, -2.5, -0.30], scale: 1.9 },
  /* 69 */ { position: [-0.725, -0.05, 0.59], rotation: [-0.45, -2.5, -0.30], scale: 1.9 },
  /* 70 */ { position: [-0.735, -0.05, 0.65], rotation: [-0.45, -2.5, -0.30], scale: 1.9 },
  /* 71 */ { position: [-0.83, -0.1, 0.53], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 72 */ { position: [-0.829, -0.1, 0.58], rotation: [0.15,  -0.5, 0.00], scale: 1.9 },
  /* 73 */ { position: [-0.828, -0.1, 0.62], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 74 */ { position: [-0.825, -0.1, 0.66], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 75 */ { position: [-0.823, -0.1, 0.7], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 76 */ { position: [-0.82, -0.1, 0.725], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 77 */ { position: [-0.817, -0.1, 0.75], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 78 */ { position: [-0.814, -0.1, 0.775], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 79 */ { position: [-0.81, -0.1, 0.801], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 80 */ { position: [-0.806, -0.11, 0.83], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 81 */ { position: [-0.797, -0.12, 0.88], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 82 */ { position: [-0.785, -0.13, 0.93], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 83 */ { position: [-0.769, -0.15, 0.99], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 84 */ { position: [-0.756, -0.13, 1.03], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 85 */ { position: [-0.734, -0.15, 1.08], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 86 */ { position: [-0.715, -0.15, 1.125], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 87 */ { position: [-0.699, -0.15, 1.16], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
  /* 88 */ { position: [-0.68, -0.15, 1.2], rotation: [0.15, -0.5, 0.00], scale: 1.9 },
])

// ═══════════════════════════════════════════════════════════════════════════
// 2) BONE / INTERACTION TUNING (mirrors Step07DorsalBones.jsx).
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

// One unit-cube + one transparent material drives all 88 hit volumes —
// 87× fewer GPU resource allocations than per-bone geometry/material clones.
const HIT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)
const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false,
})

// ═══════════════════════════════════════════════════════════════════════════
// 3) BONE CLUSTER — rendered inside FishModel's dorsalBoneSlot, so it
//    inherits the butterflied transform group's scale/rotation/position 1:1.
// ═══════════════════════════════════════════════════════════════════════════

// Apply DORSAL_BONES overrides over the loader's auto-scattered positions.
// Returns a new array of cloned entries — never mutates the loader cache.
function applyPreviewPositions(entries) {
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

// BoneCluster renders the 88 dorsal bones inside the butterflied-fish slot.
//
// Auto-discard logic (replaces trash-bin drag target):
//   Each frame during a drag, the bone's current position is compared to its
//   rest position. When distanceToSquared > DRAG_DISCARD_DIST_SQ the bone
//   immediately scales to 0 (micro-pop) and onBoneDiscarded fires. The state
//   update triggered by onBoneDiscarded hides the bone on the next render.
//   If the pointer is released before the threshold, the bone snaps back.
function BoneCluster({ removedRef, currentDragSrcRef, snappingRef, removedVersion, onBoneGrab, onBoneDiscarded }) {
  const clusterGroupRef = useRef()
  const boneGroupRefs   = useRef([])
  const indexBySrcRef   = useRef(new Map())
  const [bones, setBones] = useState(null)
  const { camera, gl }    = useThree()

  // Stable ref to onBoneDiscarded so useFrame never captures a stale closure.
  const onBoneDiscardedRef = useRef(onBoneDiscarded)
  useEffect(() => { onBoneDiscardedRef.current = onBoneDiscarded }, [onBoneDiscarded])

  // Window-level cursor tracking — drag continues even when the cursor leaves
  // the canvas bounds.
  const cursorRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e) => { cursorRef.current.x = e.clientX; cursorRef.current.y = e.clientY }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Pull bones from the production cache (geometry + size), then apply the
  // explicit DORSAL_BONES overrides over the loader's auto-scatter.
  useEffect(() => {
    let cancelled = false
    loadDorsalBones().then((entries) => {
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
  // Also resets scale to 1 for any bone that becomes visible (defensive).
  useEffect(() => {
    if (!bones) return
    const removed = removedRef.current
    for (let i = 0; i < bones.length; i++) {
      const g = boneGroupRefs.current[i]
      if (!g) continue
      const shouldShow = !removed.has(bones[i].srcIndex)
      if (g.visible !== shouldShow) {
        g.visible = shouldShow
        if (shouldShow) g.scale.setScalar(1) // defensive: restore if re-shown
      }
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

    // ── Cursor-follow for the active drag bone ──────────────────────────────
    const dragSrc = currentDragSrcRef.current
    if (dragSrc != null) {
      const arrIdx = indexBySrcRef.current.get(dragSrc)
      const g      = arrIdx != null ? boneGroupRefs.current[arrIdx] : null
      if (g) {
        // Project cursor onto the horizontal drag plane.
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

    // ── Snap-back for released-but-not-discarded bones ──────────────────────
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
// 4) HUD — hint banner + compact progress counter.
//    TrashPanel has been intentionally removed; removal is now driven by
//    distance threshold in BoneCluster's useFrame loop.
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
// 5) DRAG / DISCARD STATE
//    Stripped of all trash-panel logic. The interaction lifecycle is now:
//      pointerDown → onBoneGrab  → drag starts
//      useFrame    → threshold?  → onBoneDiscarded (auto, mid-drag)
//      pointerUp   → not yet discarded? → snap back via snappingRef
// ═══════════════════════════════════════════════════════════════════════════

function useStep5Interaction() {
  const removedRef        = useRef(new Set())
  const currentDragSrcRef = useRef(null)
  const snappingRef       = useRef(new Set())
  const doneRef           = useRef(false)

  const [count,    setCount]    = useState(0)
  const [dragging, setDragging] = useState(false)

  // Called by BoneCluster's useFrame when the drag-distance threshold is crossed.
  // Kept as a stable useCallback so onBoneDiscardedRef stays current cheaply.
  // NOTE: This is the single authoritative removal gate — safe to wire into
  // a scoring/validation system in the future without changing call sites.
  const onBoneDiscarded = useCallback((srcIdx) => {
    if (doneRef.current)                return
    if (removedRef.current.has(srcIdx)) return
    removedRef.current.add(srcIdx)
    currentDragSrcRef.current = null    // clear drag — next frame sees no active bone
    setDragging(false)
    const total = removedRef.current.size
    setCount(total)
    if (total >= TOTAL_DORSAL_BONES) doneRef.current = true
  }, [])

  // Pointer-up handler: if the bone was already discarded mid-drag,
  // currentDragSrcRef is null and we return early. Otherwise snap it back.
  useEffect(() => {
    const onUp = () => {
      const idx = currentDragSrcRef.current
      if (idx == null) return             // already auto-discarded
      currentDragSrcRef.current = null
      setDragging(false)
      if (!removedRef.current.has(idx)) { // not yet discarded → snap back
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
// 6) DEFAULT EXPORT — Canvas tuned for low-end PCs:
//    shadows OFF, dpr capped at 1×, AdaptiveDpr/Events + PerformanceMonitor.
//
// ── Camera: 'cuttingBoardTopClose' ─────────────────────────────────────────
//    Pure top-down view locked directly above the butterflied bangus so the
//    full dorsal-spine run appears as a straight line and individual bones
//    are easy to grab without parallax error from an angled view.
//
//    Add (or replace) this entry in CAMERA_CONFIG in simulationConfig.js:
//
//      cuttingBoardTopClose: {
//        position: [1.00, 2.55, -2.19],   // directly above fish centre
//        target:   [1.00, 0.97, -2.19],   // fish surface (= FISH_POS_CB)
//        fov: 28,                          // tight zoom — spine fills ~75 % width
//      },
//
// ── Why these values (do not drift from them) ───────────────────────────────
//    Fish centre (world):  [1.00, 0.97, -2.19]  (= FISH_POS_CB above)
//    FISH_ROTATION_Y = π/2  →  local-Z maps to world-X
//    Spine local-Z span:   –1.246 (tail) → +1.190 (head) = 2.44 local units
//    × BUTTERFLIED_SCALE 0.24  →  world-X span ≈ 0.586 u
//
//    At FOV 28 (half-angle 14°), camera height d above fish for spine to
//    fill 75 % of viewport:  d = 0.586 / (0.75 × 2 × tan14°) ≈ 1.565 u
//    → camera Y = 0.97 + 1.565 ≈ 2.535  →  rounded up to 2.55 for padding.
//
//    position.x and position.z are IDENTICAL to target — look direction is
//    perfectly vertical (polar angle ≈ 0).  Camera-to-target distance 1.58 u
//    sits safely inside OrbitControls minDistance 0.8 / maxDistance 9.
//
// ── Tuning knobs ─────────────────────────────────────────────────────────────
//    position.y ↑  →  camera higher (fish smaller, more context visible)
//    fov        ↓  →  tighter zoom   (below 22 risks noticeable distortion)
//    fov        ↑  →  wider view     (above 35 starts to feel angled/distant)
//    Never offset position.x/z from target — doing so re-introduces the
//    angular lean that was the issue with the previous preset.
// ═══════════════════════════════════════════════════════════════════════════

export default function Step5Preview() {
  const s = useStep5Interaction()

  const allDone = s.count >= TOTAL_DORSAL_BONES
  const message = allDone
    ? '✅ All dorsal spines removed!'
    : s.dragging
      ? '🦴 Keep pulling away from the fish…'
      : '🥢 Grab a glowing bone and pull it away'

  // Build the bone slot once per state-change; FishModel re-mounts the slot
  // only when this JSX reference changes.
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

          {/*
            Pure top-down view centred on the butterflied bangus.
            position X/Z = target X/Z → look direction is perfectly vertical.
            FOV 28 → dorsal spine fills ~75 % of screen width at this height.
            lerpSpeed=1 + instant=true → snaps immediately, no cinematic lerp.
            orbitEnabled=false → pointer events go to bone interaction only.
            See the CAMERA_CONFIG note in section 6 above for exact values.
          */}
          <GameCamera
            cameraPreset="cuttingBoardTop"
            lerpSpeed={1}
            orbitEnabled={false}
            instant
          />

          <ButterfliedFishOnBoard boneSlot={boneSlot} />
        </Suspense>
      </Canvas>

      {/* Hint banner */}
      <div style={HINT_STYLE}>
        <span>{message}</span>
      </div>

      {/* Compact progress counter — replaces the removed TrashPanel count display */}
      {!allDone && (
        <div style={{
          position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(245,200,66,0.75)', fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
          pointerEvents: 'none', zIndex: 101,
        }}>
          {s.count} / {TOTAL_DORSAL_BONES} removed
        </div>
      )}

      {/* Dev label */}
      <div style={{
        position: 'absolute', top: 12, right: 12, padding: '6px 12px',
        background: 'rgba(245,200,66,0.18)', border: '1px solid rgba(245,200,66,0.45)',
        borderRadius: 8, color: '#f5c842', fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
        pointerEvents: 'none', zIndex: 200,
      }}>
        Step 7 Preview · Dev Only
      </div>
    </div>
  )
}