// src/simulation/components/environment/Lighting.jsx
// Optimized kitchen lighting — 1 directional + 3 fill point lights.
// Shadows are disabled at the Canvas level (RENDER_CONFIG.shadows=false), so
// shadow-related props are intentionally omitted: they would be inert and
// only add cognitive noise.

export function Lighting() {
  return (
    <>
      {/* Warm ambient fill */}
      <ambientLight intensity={0.5} color="#ffe8cc" />

      {/* Main window sunlight (directional, no shadows — see file header) */}
      <directionalLight
        position={[4.5, 3.5, 1]}
        intensity={1.1}
        color="#fff5e8"
      />

      {/* Ceiling panel light (single — replaces two near-identical points at y≈2.85
          which were visually mergeable; intensity bumped to compensate) */}
      <pointLight position={[-0.6, 2.85, 0.5]} intensity={0.85} color="#f0f4ff" distance={6} decay={2} />

      {/* Under-cabinet task light over counter */}
      <pointLight position={[0.2, 1.55, -1.6]} intensity={0.35} color="#fff8f0" distance={3} decay={2} />

      {/* Sink area fill */}
      <pointLight position={[-0.5, 1.8, -1.9]} intensity={0.25} color="#e8f4ff" distance={2} decay={2} />
    </>
  )
}
