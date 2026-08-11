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
  DiffOp,
  SchemaSnapshot,
  CompatibilityReport,
} from './schema-inference.js';

export {
  inferShape,
  computeHash,
  diffShapes,
  assessCompatibility,
} from './schema-inference.js';

// ─── Traffic Recorder ──────────────────────────────────────────────────

export type {
  TrafficEnvelope,
  TrafficStore,
  TrafficRecorder,
} from './traffic-recorder.js';

export {
  redactSecrets,
  createTrafficRecorder,
} from './traffic-recorder.js';

// ─── Replay Engine ─────────────────────────────────────────────────────

export type {
  ReplayMode,
  ReplayResult,
  ReplayEngineDeps,
  ReplayEngine,
} from './replay-engine.js';

export {
  createReplayEngine,
} from './replay-engine.js';
