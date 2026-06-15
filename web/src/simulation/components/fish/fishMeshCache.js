// src/simulation/components/fish/fishMeshCache.js
//
// Module-level cache of mesh references under the `bangus_fish` group.
//
// Three consumers, one traversal:
//   • _meshList  — visual fish meshes for FishMaterialEffect (emissive pulses).
//                  BoxGeometry excluded: HIT_MAT has no emissive, no point writing it.
//   • _hitMesh   — the single BoxGeometry bounding-box sentinel from FishModel.
//                  12 triangles vs. thousands in the real geometry. Used by
//                  WashCursorTracker so the per-frame wash raycast is O(12) not O(n).
//   • _fishGroup — the bangus_fish group, for quick visibility checks.
//
// Reset semantics: invalidateFishMeshCache() on step boundary / sim restart.

let _meshList  = null
let _fishGroup = null
let _hitMesh   = null   // BoxGeometry bounding-box collider from FishModel

// Walk the bangus_fish group, populate all three caches in one pass.
// Returns the visual mesh list; also stores _hitMesh and _fishGroup.
// Returns null when the group is absent or hidden (mid-flight cinematic).
export function getCachedFishMeshes(scene) {
  if (_meshList) return _meshList
  const g = scene.getObjectByName('bangus_fish')
  if (!g) return null
  // Don't cache during the Step 1→2 flight cinematic: group is visible=false
  // and the closedClone is mid-swap (stale mesh refs would cause wrong raycasts).
  if (!g.visible) return null
  const list = []
  g.traverse((o) => {
    if (!o.isMesh) return
    if (o.geometry?.type === 'BoxGeometry') {
      _hitMesh = o   // bounding-box collider — fast raycast target for washing
    } else {
      list.push(o)   // visual meshes — used for emissive material effects
    }
  })
  _fishGroup = g
  _meshList  = list
  return list
}

// The BoxGeometry bounding-box sentinel (12 triangles). Use this for raycasting
// during washing instead of the full visual geometry (thousands of triangles).
// Populated as a side-effect of getCachedFishMeshes(); returns null until then.
export function getCachedHitMesh() {
  return _hitMesh
}

// Returns the cached bangus_fish Object3D once getCachedFishMeshes has succeeded.
export function getCachedFishGroup() {
  return _fishGroup
}

// Drop all cached refs. Call on sim restart so the next mount repopulates cleanly.
export function invalidateFishMeshCache() {
  _meshList  = null
  _fishGroup = null
  _hitMesh   = null
}
