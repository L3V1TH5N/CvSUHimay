// src/simulation/utils/useGLTFLocal.js
// Wrapper around drei's useGLTF that forces the locally-bundled Draco
// decoder path. The dev server's Content Security Policy blocks the gstatic
// CDN that drei defaults to, so every useGLTF call site in the simulation
// must route through this wrapper to pick up /draco/ instead. Forgetting
// the path would silently fall back to the CDN and 404 under CSP.
//
// API mirrors useGLTF: hook + .preload() + .clear(). Pass any URL through
// as you would the original.

import { useGLTF as useGLTFRaw } from '@react-three/drei'
import { DRACO_DECODER_PATH }   from './dracoGLTFLoader'

export function useGLTF(url) {
  return useGLTFRaw(url, DRACO_DECODER_PATH)
}

useGLTF.preload = (url) => useGLTFRaw.preload(url, DRACO_DECODER_PATH)
useGLTF.clear   = useGLTFRaw.clear
