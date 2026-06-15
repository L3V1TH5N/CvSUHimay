// web/scripts/build-bone-atlas.mjs
//
// Merges N per-piece bone GLBs into a single atlas GLB with named nodes
// (`<prefix>_001`, `<prefix>_002`, ...) and Draco-compresses the result.
//
// Output mirrors the schema produced by the existing dorsal/ventral atlases
// so the loader can iterate `prefix_NNN` nodes and clone their geometries.
// Each piece's local transform is baked into its mesh geometry to keep the
// atlas a flat list of meshes (loader stays simple).
//
// Usage:
//   node scripts/build-bone-atlas.mjs <inputDir> <prefix> <outFile> [count]
// Example:
//   node scripts/build-bone-atlas.mjs public/models/bones/rib       rib     public/models/bones/rib-atlas.glb     26
//   node scripts/build-bone-atlas.mjs public/models/bones/Laterals  lateral public/models/bones/lateral-atlas.glb 42

import { NodeIO, Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS }   from '@gltf-transform/extensions'
import { draco, weld, prune, dedup } from '@gltf-transform/functions'
import draco3d              from 'draco3dgltf'
import fs                   from 'node:fs'
import path                 from 'node:path'

const [, , inputDir, prefix, outFile, countArg] = process.argv
if (!inputDir || !prefix || !outFile) {
  console.error('Usage: node scripts/build-bone-atlas.mjs <inputDir> <prefix> <outFile> [count]')
  process.exit(1)
}

const explicitCount = countArg ? parseInt(countArg, 10) : null

// Discover source files. Two naming conventions in the project:
//   - "Rib (1).glb" .. "Rib (N).glb"     (numbered with parens)
//   - "Lateral (1).glb" .. "Lateral (N).glb"
// We sort by the numeric suffix so atlas index N matches source file N.
function discover() {
  const all = fs.readdirSync(inputDir)
    .filter(n => /\.glb$/i.test(n))
    .map((n) => {
      const m = n.match(/\((\d+)\)\.glb$/i)
      return { name: n, num: m ? parseInt(m[1], 10) : null }
    })
    .filter(e => e.num != null)
    .sort((a, b) => a.num - b.num)

  if (explicitCount) {
    const found = all.filter(e => e.num <= explicitCount)
    if (found.length !== explicitCount) {
      throw new Error(`Expected ${explicitCount} pieces, found ${found.length} matching "${prefix}*"`)
    }
    return found
  }
  return all
}

const pieces = discover()
console.log(`Found ${pieces.length} source pieces in ${inputDir}`)

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  })

const t0 = Date.now()

// Build the atlas as a fresh document. We copy each piece's primary mesh
// (first mesh found via traversal) into the atlas as a single new node named
// `<prefix>_NNN`. World transform of the source mesh is baked into the
// vertex positions so the atlas node sits at origin with identity rotation —
// the runtime loader already centers + measures each piece independently.
const atlas      = new Document()
const atlasScene = atlas.createScene('atlas')

for (let i = 0; i < pieces.length; i++) {
  const idx     = i + 1
  const srcPath = path.join(inputDir, pieces[i].name)
  const src     = await io.read(srcPath)

  // Find the first mesh + its world transform via the source scene graph.
  let srcMesh        = null
  let srcWorldMatrix = null
  for (const scene of src.getRoot().listScenes()) {
    scene.traverse((node) => {
      if (srcMesh) return
      const mesh = node.getMesh()
      if (mesh && mesh.listPrimitives().length > 0) {
        srcMesh        = mesh
        srcWorldMatrix = node.getWorldMatrix()
      }
    })
    if (srcMesh) break
  }

  if (!srcMesh) {
    console.warn(`  skip: ${pieces[i].name} (no mesh found)`)
    continue
  }

  // Clone the source's primary mesh into the atlas. Bake source world matrix
  // into vertex positions so the atlas node is at identity.
  const newMesh = atlas.createMesh(`${prefix}_${String(idx).padStart(3, '0')}`)
  for (const srcPrim of srcMesh.listPrimitives()) {
    const newPrim = atlas.createPrimitive()
      .setMode(srcPrim.getMode())
      .setMaterial(null) // shared material applied at runtime by the loader

    // Copy & transform vertex positions. Other attributes (NORMAL, UV) carry
    // through unchanged; positions are baked through the world matrix so the
    // mesh sits in its source position when atlas node is at identity.
    for (const semantic of srcPrim.listSemantics()) {
      const srcAttr = srcPrim.getAttribute(semantic)
      const buf     = srcAttr.getArray().slice() // copy
      if (semantic === 'POSITION' && srcWorldMatrix) {
        applyMatrix4(buf, srcWorldMatrix)
      } else if (semantic === 'NORMAL' && srcWorldMatrix) {
        applyMatrix4Direction(buf, srcWorldMatrix)
      }
      const newAttr = atlas.createAccessor()
        .setArray(buf)
        .setType(srcAttr.getType())
        .setBuffer(atlas.getRoot().listBuffers()[0] ?? atlas.createBuffer())
      newPrim.setAttribute(semantic, newAttr)
    }
    if (srcPrim.getIndices()) {
      const srcIdx = srcPrim.getIndices()
      const newIdx = atlas.createAccessor()
        .setArray(srcIdx.getArray().slice())
        .setType(srcIdx.getType())
        .setBuffer(atlas.getRoot().listBuffers()[0])
      newPrim.setIndices(newIdx)
    }
    newMesh.addPrimitive(newPrim)
  }

  const node = atlas.createNode(`${prefix}_${String(idx).padStart(3, '0')}`).setMesh(newMesh)
  atlasScene.addChild(node)
}

console.log(`Merged ${pieces.length} meshes — running prune + dedup + Draco …`)

await atlas.transform(
  prune(),
  dedup(),
  weld({ tolerance: 0.0001 }),
  draco({
    method: 'edgebreaker',
    encodeSpeed: 5,
    decodeSpeed: 5,
    quantizePosition: 14,
    quantizeNormal: 10,
    quantizeColor: 8,
    quantizeTexcoord: 12,
  }),
)

await io.write(outFile, atlas)
const dt    = Date.now() - t0
const bytes = fs.statSync(outFile).size
console.log(`✓ ${outFile} written — ${(bytes / 1024).toFixed(1)} KB (${dt} ms)`)

// ── helpers ────────────────────────────────────────────────────────────────

// Apply a 4x4 column-major matrix to a flat Float32Array of vec3 positions.
function applyMatrix4(arr, m) {
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i], y = arr[i + 1], z = arr[i + 2]
    arr[i]     = m[0] * x + m[4] * y + m[8]  * z + m[12]
    arr[i + 1] = m[1] * x + m[5] * y + m[9]  * z + m[13]
    arr[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
  }
}

// Apply only the rotational part of a 4x4 matrix to vec3 normals (no
// translation, no rescale beyond what the source matrix encodes).
function applyMatrix4Direction(arr, m) {
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i], y = arr[i + 1], z = arr[i + 2]
    let nx = m[0] * x + m[4] * y + m[8]  * z
    let ny = m[1] * x + m[5] * y + m[9]  * z
    let nz = m[2] * x + m[6] * y + m[10] * z
    const len = Math.hypot(nx, ny, nz) || 1
    arr[i]     = nx / len
    arr[i + 1] = ny / len
    arr[i + 2] = nz / len
  }
}
