// src/server/bootstrap-engines.ts
// Thin public facade over the boot phase pipeline. The actual engine wiring now
// lives in `src/server/bootstrap/` — see bootstrap/orchestrator.ts for the
// phase list (the dependency order), bootstrap/context.ts for the mutable
// BootstrapContext threaded through stages, and bootstrap/phases/*.ts for each
// named stage.
//
// `bootstrapEngines` and `BootstrapEnginesResult` are kept here so the existing
// `src/server/index.ts` consumer (and any external importer) stays unchanged.

export type { BootstrapEnginesResult } from './bootstrap/context.js'
export { orchestrateBootstrap as bootstrapEngines } from './bootstrap/orchestrator.js'
