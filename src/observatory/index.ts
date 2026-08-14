/**
 * Observatory — API Traffic Observation & Schema Compatibility
 * ============================================================
 *
 * Barrel module that re-exports all public types and functions from
 * the observatory sub-modules:
 *
 * - **schema-inference** — Structural shape inference, hashing, diffing,
 *   and compatibility assessment.
 * - **traffic-recorder** — HTTP request/response recording with automatic
 *   secret redaction.
 * - **replay-engine** — Protocol replay (mock & authenticated) with
 *   baseline comparison.
 */

// ─── Schema Inference ──────────────────────────────────────────────────

export type {
  ChangeSeverity,
  CompatibilityReport,
  DiffOp,
  SchemaSnapshot,
} from './schema-inference.js'

export {
  assessCompatibility,
  computeHash,
  diffShapes,
  inferShape,
} from './schema-inference.js'

// ─── Traffic Recorder ──────────────────────────────────────────────────

export type {
  TrafficEnvelope,
  TrafficRecorder,
  TrafficStore,
} from './traffic-recorder.js'

export {
  createTrafficRecorder,
  redactSecrets,
} from './traffic-recorder.js'

// ─── Replay Engine ─────────────────────────────────────────────────────

export type {
  ReplayEngine,
  ReplayEngineDeps,
  ReplayMode,
  ReplayResult,
} from './replay-engine.js'

export { createReplayEngine } from './replay-engine.js'
