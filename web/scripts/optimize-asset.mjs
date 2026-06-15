// web/scripts/optimize-asset.mjs
//
// Single-file Draco optimizer. Reads one GLB, writes a Draco-compressed
// `.opt.glb` sibling next to it. Used to satisfy the convention referenced
// in src/simulation/utils/dracoGLTFLoader.js (`.opt.glb` files are the
// runtime variant; raw originals stay in version control as the source).
//
// Usage:
//   node scripts/optimize-asset.mjs public/models/DaingCuttedFins.glb
//   node scripts/optimize-asset.mjs public/models/foo.glb public/models/foo.draco.glb

import { NodeIO }            from '@gltf-transform/core'
import { ALL_EXTENSIONS }    from '@gltf-transform/extensions'
import { draco }             from '@gltf-transform/functions'
import draco3d               from 'draco3dgltf'
import path                  from 'node:path'

const [, , inPath, outPathArg] = process.argv
if (!inPath) {
  console.error('Usage: node scripts/optimize-asset.mjs <input.glb> [output.glb]')
  process.exit(1)
}

const outPath = outPathArg ?? inPath.replace(/\.glb$/i, '.opt.glb')

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  })

const t0  = Date.now()
const doc = await io.read(inPath)

await doc.transform(
  draco({
    method: 'edgebreaker',
    encodeSpeed: 5,
    decodeSpeed: 5,
    quantizePosition: 14,
    quantizeNormal: 10,
    quantizeColor: 8,
    quantizeTexcoord: 12,
    quantizeGeneric: 12,
  }),
)

await io.write(outPath, doc)
const dt = Date.now() - t0
console.log(`✓ ${path.basename(outPath)} written (${dt} ms)`)
