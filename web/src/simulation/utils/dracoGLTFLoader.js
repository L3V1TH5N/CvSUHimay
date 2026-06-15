// src/simulation/utils/dracoGLTFLoader.js
// Shared GLTFLoader factory configured for Draco-compressed assets. The bone
// atlases produced by `npm run optimize-assets` use Draco mesh compression,
// so any code path that loads them via raw GLTFLoader (i.e. not drei's
// useGLTF, which already auto-installs DRACOLoader) must inject one too.
//
// Decoder is bundled locally at /draco/ instead of fetched from the gstatic
// CDN — the dev server's Content Security Policy restricts connect-src to
// localhost + a small allowlist, and a CDN fetch would be blocked. The
// trailing slash is required by DRACOLoader.setDecoderPath. The same path
// must be passed to every drei useGLTF() call (see useGLTF docs) so its
// internal DRACOLoader resolves to the same files. Decoder files live at:
//   web/public/draco/  (copied from node_modules/three/examples/jsm/libs/draco/)

import { GLTFLoader }  from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export const DRACO_DECODER_PATH = '/draco/'

let _draco = null

// Lazy: only instantiate the decoder if a caller actually requests it.
function getDracoLoader() {
  if (_draco) return _draco
  _draco = new DRACOLoader()
  _draco.setDecoderPath(DRACO_DECODER_PATH)
  return _draco
}

// Returns a fresh GLTFLoader with Draco support attached. Each caller gets
// its own GLTFLoader instance (cheap) but they all share the single
// DRACOLoader (and therefore the single decoder WASM module).
export function makeGLTFLoader() {
  const loader = new GLTFLoader()
  loader.setDRACOLoader(getDracoLoader())
  return loader
}
