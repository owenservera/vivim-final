// src/engines/kernel/index.ts
// Kernel barrel — the self-understanding layer.

export { bootstrapKernel, type KernelBootstrapDeps } from './kernel-bootstrap.js'
export {
  ConsoleKernelLogger,
  createKernel,
  type Kernel,
  type KernelContext,
  KernelImpl,
  type KernelLogger,
} from './kernel-context.js'
export { KernelProvenance, type ProvenanceChain } from './kernel-provenance.js'
export { KernelRegistry } from './kernel-registry.js'
export { KernelTracer } from './kernel-tracer.js'
export {
  type AutoHealPolicy,
  type HealAction,
  type HealKind,
  OracleActuator,
} from './oracle-actuator.js'
export {
  type DiagnosticCategory,
  type DiagnosticIssue,
  type DiagnosticSeverity,
  OracleDiagnosticEngine,
} from './oracle-diagnostic.js'
export {
  type OracleEvent,
  type OracleEventKind,
  OracleEventStream,
} from './oracle-event-stream.js'
// ── Kernel Oracle (Phase 15) ───────────────────────────────────────────────
export {
  type CapabilitySummary,
  type Explanation,
  type HealthSnapshot,
  OracleQueryEngine,
  type QueryResult,
  type SystemQuery,
  type SystemQueryType,
  type TopologyDescription,
} from './oracle-query.js'
