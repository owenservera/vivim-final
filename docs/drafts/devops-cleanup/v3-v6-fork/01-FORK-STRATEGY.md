# v3-v6 Fork Strategy: Canonical Fork Architecture

**Date:** 2026-07-12
**Status:** DRAFT
**Goal:** Create `docs/atomic-v3-fork-canon/` as the single canonical tracker,
          absorbing v5 kernel work into v3's full architecture.

---

## 1. Design Principle

**v3 is the canonical architecture.** v4, v5, and v6 were experimental forks that
explored CDP-driven interaction and kernel instrumentation. Both valuable paradigms
are now absorbed back into v3:

| Paradigm | Origin | Where It Lands |
|----------|--------|----------------|
| Full capability system (DAG model, Composer, Registry, Canvas, Memory, Sovereign Data) | v3 Phases 2-10 | Phases 3-13 (unchanged) |
| Kernel instrumentation (EventBus, Registry, Context, Tracer, Provenance, Bootstrap) | v5 Phase 00 | Phase 2 (new) |
| Kernel Oracle (self-model, diagnostics, healing, event stream) | v5 Phase 15 | Phase 11 (new) |
| Kernel Surfaces (REST API, MCP, CLI, Frontend) | v5 Phase 16 | Phase 12 (new) |

Everything from v3 stays. Nothing gets dropped. The kernel adds observability
tissue that every v3 component registers with.

---

## 2. Fork Structure

```
docs/atomic-v3-fork-canon/
├── 01-tracker.md               # Canonical tracker (127 units, 13 phases)
├── PORT-OVER-PLAN.md            # Copy of this strategy
├── PHASE-DEPENDENCIES.md        # Cross-phase dependency graph
├── CHANGELOG.md                 # What changed vs original v3
│
├── phase-01-stabilization/      # (References v3 originals)
├── phase-02-kernel-foundation/  # (References v5 originals)
├── phase-03-agentic-core/       # (References v3 originals)
├── phase-04-html-canvas/        # (References v3 originals)
├── phase-05-workspace-ui/       # (References v3 originals)
├── phase-06-provider-expansion/ # (References v3 originals)
├── phase-07-memory-knowledge/   # (References v3 originals)
├── phase-08-autonomous-orch/    # (References v3 originals)
├── phase-09-observability/      # (References v3 originals)
├── phase-10-sovereign-data/     # (References v3 originals)
├── phase-11-kernel-oracle/      # (References v5 originals)
├── phase-12-kernel-surfaces/    # (References v5 originals)
└── phase-13-polish-sdk/         # (References v3 originals)
```

---

## 3. Phase Structure (127 units, 10 done, 117 pending)

| Phase | Name | Units | Done | Source | Description |
|-------|------|-------|------|--------|-------------|
| 1 | Stabilization & Cleanup | 12 | **10** | v3 Phase 1 | Code quality, error classes, mocks, coverage |
| 2 | Kernel Foundation | 9 | 0 | v5 Phase 00 | EventBus, Registry, Context, Tracer, Provenance, Schema, Bootstrap |
| 3 | Agentic Core | 15 | 0 | v3 Phase 2 | IntentDecomposer, CapabilityComposer, LiveRegistry, SandboxRunner, Loop, Provenance |
| 4 | HTML Canvas System | 13 | 0 | v3 Phase 3 | Registry, Templates, Spawner, Binder, Mirror, Discovery, Runtime, Router, WS, Security |
| 5 | Workspace & Agent UI | 11 | 0 | v3 Phase 4 | WorkspaceManager, Presets, Host, 7 Surfaces, Agent Actions |
| 6 | Provider & Capability Expansion | 10 | 0 | v3 Phase 5 | Ollama, llama.cpp, API, Taxonomy, Binding, MCP, Consent, UI, Harness |
| 7 | Memory & Knowledge | 10 | 0 | v3 Phase 6 | Embeddings, Indexing, Extraction, Synthesis, Graph, Queries, Curation, Consolidation |
| 8 | Autonomous Orchestration | 12 | 0 | v3 Phase 7 | Planner, Reflection, HITL, Replay, Budgets, Healing, Failover, Composites |
| 9 | Observability & Audit | 8 | 0 | v3 Phase 8 | Tracing, Provenance Vis, Telemetry, Audit, Reports, Cost, Latency, Health |
| 10 | Sovereign Data & Local-First | 9 | 0 | v3 Phase 9 | Encryption, Sync, Airgap, Offline, Export, Backup, Pairing, Zero-Cloud |
| 11 | Kernel Oracle | 4 | 0 | v5 Phase 15 | OracleQuery, Diagnostic, Actuator, EventStream |
| 12 | Kernel Surfaces | 6 | 0 | v5 Phase 16 | REST API, MCP Tools, CLI, Frontend, Server Integration |
| 13 | Polish, SDK & Documentation | 8 | 0 | v3 Phase 10 | Typed SDK, React SDK, Onboarding, Performance, ADR, OpenAPI, Manual, Release |
| | **Total** | **127** | **10** | | |

---

## 4. Execution Flow (Dependency Chain)

```
Phase 1 (Stabilize: fix bugs, establish baseline)
  → Phase 2 (Kernel: everything registers with kernel)
    → Phase 3 (Agentic Core: capabilities are the system's primitive)
      → Phase 4 (Canvas: canvases are rendered capabilities)
        → Phase 5 (Workspace: workspace hosts canvases + surfaces)
          → Phase 6 (Providers: provider UI surfaces need workspace)
            → Phase 7 (Memory: memory is cross-cutting, depends on providers)
              → Phase 8 (Orchestration: autonomous needs memory for learning)
                → Phase 9 (Observability: needs task history from orchestration)
                  → Phase 10 (Sovereignty: cross-cutting, depends on everything)
                    → Phase 11 (Kernel Oracle: depends on all kernel data)
                      → Phase 12 (Kernel Surfaces: expose oracle + kernel)
                        → Phase 13 (Polish: documentation, SDK, release)
```

---

## 5. Unit ID Strategy

**Keep all original IDs for traceability.** In the tracker, each unit shows:
- Its original ID (e.g., `1.1`, `0.1`, `15.3`)
- Its spec path (original location)

Kernel units use their v5 IDs (0.0-0.7, 15.1-15.4, 16.1-16.6).
v3 units keep their v3 IDs (1.1-10.8).

---

## 6. Spec References

Phase directories in `docs/atomic-v3-fork-canon/phase-0X-*/` will NOT duplicate specs.
Instead, each phase directory will contain:
- `00-PHASE-INDEX.md` — listing all units with original spec paths

Specs remain at their original locations:
- `docs/atomic-v3/phase-{01..10}-*/`
- `docs/atomic-v5/phase-00-{kernel-core,surgical-edit}/`
- `docs/atomic-v5/phase-15-kernel-oracle/`
- `docs/atomic-v5/phase-16-kernel-surfaces/`

---

## 7. What Changes vs Original v3

| Change | Detail |
|--------|--------|
| **Header** | Removes "SUPERSEDED BY v6" → "CANONICAL PLAN — v3-fork-canon" |
| **Phase 2 added** | 9 kernel units from v5 Phase 00 |
| **Phase 11 added** | 4 kernel oracle units from v5 Phase 15 |
| **Phase 12 added** | 6 kernel surface units from v5 Phase 16 |
| **Phase order** | Original v3 Phase 2→10 becomes Phase 3→13 |
| **Unit IDs** | All original IDs preserved |
| **Spec paths** | v3 specs point to `docs/atomic-v3/`, kernel specs point to `docs/atomic-v5/` |
| **Done count** | 10 units from Phase 1 stay marked `[x]` |
| **Total units** | 108 → 127 (+19 kernel units) |

---

## 8. Existing Files: NO TOUCH

| File | Status | Notes |
|------|--------|-------|
| `docs/atomic-v3/01-tracker.md` | UNTOUCHED | Still marked superseded, historical reference |
| `docs/atomic-v4/01-tracker.md` | UNTOUCHED | Historical reference |
| `docs/atomic-v5/01-tracker.md` | UNTOUCHED | Historical reference |
| `docs/atomic-v6/01-tracker.md` | UNTOUCHED | Historical reference |
| All `docs/atomic-v3/phase-*/` files | UNTOUCHED | Referenced by fork |
| All `docs/atomic-v5/phase-*/` files | UNTOUCHED | Referenced by fork |
