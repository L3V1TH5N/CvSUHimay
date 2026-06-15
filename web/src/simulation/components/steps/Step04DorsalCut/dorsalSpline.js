// src/simulation/components/steps/Step04DorsalCut/dorsalSpline.js
// ─────────────────────────────────────────────────────────────────────────────
// Dorsal-cut geometry + validator.
//
// Geometry is a STRAIGHT line from head to tail along the longest horizontal
// axis of the fish's bounding box, at ~80 % of the fish height (the dorsal
// ridge). No curve fitting — the canonical milkfish deboning procedure cuts
// a straight line, and a straight line is trivial for students to trace.
//
// Everything is computed ONCE at GLB load — zero per-frame allocation.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three'

// Build the dorsal line from a loaded GLB scene.
// Returns { samples, arcLengths, totalLen } — in local space of a cloned
// scene that has been pre-scaled + rotated to match FishModel.
//
// samples    — 2 THREE.Vector3 endpoints (head, tail). Straight line.
// arcLengths — cumulative distance [0, totalLen].
// totalLen   — end-to-end distance in world units.
export function buildDorsalSpline(scene, { scale = 0.6, rotationY = Math.PI / 2 } = {}) {
  // Clone so we never mutate useGLTF's cached scene.
  const cloned = scene.clone()
  cloned.scale.setScalar(scale)
  cloned.rotation.set(0, rotationY, 0)
  cloned.updateMatrixWorld(true)

  const box    = new THREE.Box3().setFromObject(cloned)
  const size   = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  // Longest horizontal axis is the fish's length axis (head ↔ tail).
  const longAxis = size.x >= size.z ? 'x' : 'z'

  // Endpoints: 90 % span along the long axis, 80 % up the Y height.
  // The 10 % inset from each end keeps the visible line inside the fish
  // body; the 80 %-height lift places it on top of the dorsal ridge.
  const half    = (longAxis === 'x' ? size.x : size.z) * 0.45
  const dorsalY = center.y + size.y * 0.40

  const head = longAxis === 'x'
    ? new THREE.Vector3(center.x - half, dorsalY, center.z)
    : new THREE.Vector3(center.x, dorsalY, center.z - half)
  const tail = longAxis === 'x'
    ? new THREE.Vector3(center.x + half, dorsalY, center.z)
    : new THREE.Vector3(center.x, dorsalY, center.z + half)

  const samples    = [head, tail]
  const totalLen   = head.distanceTo(tail) || 1
  const arcLengths = new Float32Array([0, totalLen])

  return { samples, arcLengths, totalLen }
}
