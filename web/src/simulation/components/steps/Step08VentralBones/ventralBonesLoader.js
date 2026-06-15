// web/src/simulation/components/steps/Step08VentralBones/ventralBonesLoader.js
//
// Singleton asset loader for Step 8 ventral-spine removal.
// Loads 48 ventral bones from ventral-atlas.glb and distributes them along
// the upward-facing contour of the butterflied fish.
//
// Two parallel fetches:
//   1. ventral-atlas.glb  — all 48 bone meshes, named ventral_001..ventral_048
//   2. butterfliedBangus.opt.glb — contour sampling only
//
// Result is cached at module level; every call after the first returns the
// same Promise so bones parse only once regardless of step re-entries.

import * as THREE from 'three'
import { makeGLTFLoader } from '../../../utils/dracoGLTFLoader'

export const TOTAL_VENTRAL_BONES = 48

const ATLAS_PATH = '/models/bones/ventral-atlas.glb'
const BONE_NAME_RE = /^ventral_(\d+)$/i
const FISH_PATH = '/models/butterfliedBangus.opt.glb'

const SCATTER_MARGIN = 0.10
const SCATTER_Y_LIFT = 0.0
const SCATTER_LATERAL_AMPLITUDE = 0.020
const CONTOUR_BUCKETS = 64

const _loader = makeGLTFLoader()

// Shared base material — all 48 bones use this same instance.
export const BONE_MATERIAL = new THREE.MeshLambertMaterial({
  color: '#fff4cf',
  emissive: new THREE.Color('#ffce4d'),
  emissiveIntensity: 1.4,
})

// ── Internal loaders ─────────────────────────────────────────────────────────

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

          const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position)
          const position = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
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

function loadFishContour() {
  return new Promise((resolve) => {
    _loader.load(
      FISH_PATH,
      (gltf) => {
        gltf.scene.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const size = box.getSize(new THREE.Vector3())
        const { long, upY, lat } = pickLongAxis(size)

        const longMin = box.min[long]
        const longMax = box.max[long]
        const longRange = longMax - longMin || 1
        const heights = new Float32Array(CONTOUR_BUCKETS).fill(-Infinity)

        const v = new THREE.Vector3()
        gltf.scene.traverse((c) => {
          if (!c.isMesh) return
          const posAttr = c.geometry.attributes.position
          const matrix = c.matrixWorld
          for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i).applyMatrix4(matrix)
            const t = (v[long] - longMin) / longRange
            const idx = Math.min(CONTOUR_BUCKETS - 1, Math.max(0, Math.floor(t * CONTOUR_BUCKETS)))
            if (v[upY] > heights[idx]) heights[idx] = v[upY]
          }
        })

        // Fill empty slices by interpolating from nearest populated neighbours.
        for (let i = 0; i < CONTOUR_BUCKETS; i++) {
          if (heights[i] !== -Infinity) continue
          let l = i - 1
          let r = i + 1
          while (l >= 0 && heights[l] === -Infinity) l--
          while (r < CONTOUR_BUCKETS && heights[r] === -Infinity) r++
          const lv = l >= 0 ? heights[l] : null
          const rv = r < CONTOUR_BUCKETS ? heights[r] : null
          heights[i] =
            lv !== null && rv !== null ? (lv + rv) * 0.5
            : lv !== null ? lv
            : rv !== null ? rv
            : box.max[upY]
        }

        resolve({ box, heights, longMin, longMax, longRange, axes: { long, upY, lat } })
      },
      undefined,
      () => resolve(null),
    )
  })
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

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
  const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position)
  const size = box.getSize(new THREE.Vector3())
  if (size.x >= size.y && size.x >= size.z) return 'x'
  if (size.z >= size.x && size.z >= size.y) return 'z'
  return 'y'
}

function alignBoneVertical(geometry) {
  const boneAxisName = pickBoneLongAxis(geometry)
  if (boneAxisName === 'y') return
  const from = AXIS_VECTORS[boneAxisName]
  const to = AXIS_VECTORS.y
  const quat = new THREE.Quaternion().setFromUnitVectors(from, to)
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quat))
}

function sampleVentralY(contour, longCoord) {
  const { heights, longMin, longRange } = contour
  const t = (longCoord - longMin) / longRange
  const f = Math.max(0, Math.min(CONTOUR_BUCKETS - 1, t * CONTOUR_BUCKETS - 0.5))
  const i0 = Math.floor(f)
  const i1 = Math.min(CONTOUR_BUCKETS - 1, i0 + 1)
  return heights[i0] * (1 - (f - i0)) + heights[i1] * (f - i0)
}

function scatterAndAlignBones(bones, contour) {
  const { box, longMin, longMax, axes } = contour
  const { long, upY, lat } = axes
  const size = box.getSize(new THREE.Vector3())

  const margin = (longMax - longMin) * SCATTER_MARGIN
  const lo = longMin + margin
  const hi = longMax - margin
  const yLift = size[upY] * SCATTER_Y_LIFT
  const latCenter = (box.min[lat] + box.max[lat]) * 0.5
  const latAmp = size[lat] * SCATTER_LATERAL_AMPLITUDE

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

    const t = (placed + 0.5) / validCount
    const longCoord = THREE.MathUtils.lerp(lo, hi, t)
    const surfaceY = sampleVentralY(contour, longCoord) + yLift
    const lateral = Math.sin((t * Math.PI * 2 * 2)) * latAmp

    const pos = new THREE.Vector3()
    pos[long] = longCoord
    pos[upY] = surfaceY
    pos[lat] = latCenter + lateral
    b.position = pos

    placed++
  }
}

// ── Dev helper ───────────────────────────────────────────────────────────────

function installDumpHelper(promise) {
  if (typeof window === 'undefined') return
  window.__dumpVentralBones = async () => {
    const bones = await promise
    const lines = bones.map((b, i) => {
      if (!b) return `/* ${String(i + 1).padStart(2, ' ')} */ null,`
      const { x, y, z } = b.position
      return `/* ${String(i + 1).padStart(2, ' ')} */ [${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)}],`
    })
    console.log(lines.join('\n'))
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

let _cachePromise = null

// Lazy: cache primes on first call. Step08BoneCluster.jsx calls this from
// useEffect, so the atlas + butterfliedBangus parsing cost is paid at step
// entry rather than at sim mount. Earlier steps may opportunistically call
// this from their own useEffect to pre-warm one step ahead.
export function loadVentralBones() {
  if (_cachePromise) return _cachePromise

  const bonesP = loadBonesFromAtlas()
  const fishP = loadFishContour()

  _cachePromise = Promise.all([bonesP, fishP]).then(([bones, contour]) => {
    if (contour) scatterAndAlignBones(bones, contour)
    return bones
  })

  installDumpHelper(_cachePromise)
  return _cachePromise
}
