// src/simulation/fsm/WashingFSM.js
// Hold-to-wash progress controller for Step 2 & Step 10.
//
// Tick-driven: the caller must call tick(dt) from useFrame every frame.
// startHold() / stopHold() toggle fill vs drain mode.
// No internal requestAnimationFrame — integrates with R3F's render loop so
// there is exactly one animation loop, progress updates stay inside R3F's
// batching, and fill/drain rates are frame-rate independent (dt-based).

export class WashingFSM {
  constructor({ holdDuration = 3000, onProgress, onComplete } = {}) {
    this.holdDuration = holdDuration   // milliseconds
    this.onProgress   = onProgress ?? (() => {})
    this.onComplete   = onComplete ?? (() => {})

    this._holding   = false
    this._progress  = 0      // 0–100
    this._completed = false
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  startHold() {
    if (this._completed) return
    this._holding = true
  }

  stopHold() {
    this._holding = false
  }

  // Called from useFrame with dt in seconds. Advances fill when holding, drains
  // when not. Must be called every frame while the step is active.
  tick(dt) {
    if (this._completed) return
    const dtMs = dt * 1000
    if (this._holding) {
      this._progress = Math.min(100, this._progress + (100 / this.holdDuration) * dtMs)
      this.onProgress(this._progress)
      if (this._progress >= 100) {
        this._completed = true
        this._holding   = false
        this.onComplete()
      }
    } else if (this._progress > 0) {
      // Drain at 2× fill rate — full bar drains in holdDuration/2 ms.
      // Matches the original ~72%/s drain rate for the default 3 s hold.
      this._progress = Math.max(0, this._progress - (200 / this.holdDuration) * dtMs)
      this.onProgress(this._progress)
    }
  }

  reset() {
    this._holding   = false
    this._progress  = 0
    this._completed = false
    this.onProgress(0)
  }

  get progress()  { return this._progress }
  get completed() { return this._completed }
}
