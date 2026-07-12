# Phase Dependency Graph: v3-fork-canon

**Date:** 2026-07-12

---

## Dependency Chain

```
Phase 1 ───→ Phase 2 ───→ Phase 3 ───→ Phase 4 ───→ Phase 5 ───→ Phase 6
(stabilize)   (kernel)     (agentic)    (canvas)     (workspace)   (providers)
                                                          │
                                                          ▼
                                                    Phase 7
                                                    (memory)
                                                      │
                                                      ▼
                                                    Phase 8
                                                    (orchestration)
                                                      │
                                                      ▼
                                                    Phase 9
                                                    (observability)
                                                      │
                                                      ▼
                                                    Phase 10
                                                    (sovereign data)
                                                      │
                                                      ▼
                                                    Phase 11
                                                    (kernel oracle)
                                                      │
                                                      ▼
                                                    Phase 12
                                                    (kernel surfaces)
                                                      │
                                                      ▼
                                                    Phase 13
                                                    (polish + release)
```

## Intra-Phase Dependency Details

### Phase 2: Kernel Foundation (9 units)

```
       ┌─────────────────────┐
       │ 2.1 (0.0) EventBus  │  (no deps — fixes prod bug)
       │ 2.2 (0.5) Schema    │  (no deps — independent migration)
       │ 2.3 (0.7) Test Infra│  (no deps — independent)
       └────────┬────────────┘
                │     (order doesn't matter, can parallel)
                │
       ┌────────▼────────────┐
       │ 2.4 (0.1) Registry  │  (no deps on other kernel units)
       └────────┬────────────┘
                │
       ┌────────▼────────────┐
       │ 2.5 (0.2) Context   │  (depends on Registry)
       └────────┬────────────┘
                │
       ┌────────▼────────────┐
       │ 2.6 (0.3) Tracer    │  (depends on Registry, Context)
       └────────┬────────────┘
                │
       ┌────────▼────────────┐
       │ 2.7 (0.4) Provenance│  (depends on Registry, Context, Tracer)
       └────────┬────────────┘
                │
       ┌────────▼────────────┐
       │ 2.8 (0.6) Bootstrap │  (depends on Registry, Context, Tracer, Provenance)
       └────────┬────────────┘
                │
       ┌────────▼────────────┐
       │ 2.9 (0.6a) Refactor │  (depends on Bootstrap)
       └─────────────────────┘
```

### Phase 3: Agentic Core (15 units)

```
IntentDecomposer (3.1→3.3) → CapabilityComposer (3.4→3.6)
  → LiveCapabilityRegistry (3.7→3.10)
  → AgenticConversationLoop (3.11, 3.12)
  → SandboxRunner (3.13)
  → ProvenanceGraph (3.14, 3.15)
```

Linear dependency within each group, but groups can partially overlap:
- 3.1, 3.2, 3.3 (IntentDecomposer: templates → LLM → clarify)
- 3.4, 3.5, 3.6 (CapabilityComposer: DAG → recursive → surfaces)
- 3.7, 3.8, 3.9, 3.10 (LiveCapabilityRegistry: store → sandbox → MCP → HTTP)
- 3.11, 3.12 (AgenticLoop: engine → integration)
- 3.13 (SandboxRunner: independent of loop)
- 3.14, 3.15 (ProvenanceGraph: storage → query)

### Phase 4: HTML Canvas (13 units)

```
Registry → Templates → Spawner → Binder → Mirror (agent→canvas, canvas→agent)
  → Discovery (read, write) → Runtime → Router → WS → Security → Agent Tools
```

### Phase 5-10: All linear

No parallelizable sub-groups within phases 5-10.

### Phase 11: Kernel Oracle (4 units)

```
Query → Diagnostic → Actuator → EventStream
```

### Phase 12: Kernel Surfaces (6 units)

```
REST API → MCP Tools → CLI → Frontend → Server Integration → CLI Commands
```

## Cross-Phase Dependencies

| Phase | Depends On | Rationale |
|-------|-----------|-----------|
| 2 (Kernel) | 1 (Stabilize) | Needs error classes, ID system from Phase 1 |
| 3 (Agentic) | 2 (Kernel) | Engines register with KernelRegistry |
| 4 (Canvas) | 3 (Agentic) | Canvas tools are registered capabilities |
| 5 (Workspace) | 4 (Canvas) | Workspace hosts canvas instances |
| 6 (Providers) | 5 (Workspace) | Provider UI surfaces in workspace |
| 7 (Memory) | 6 (Providers) | Embedding providers needed |
| 8 (Orchestration) | 7 (Memory) | Requires memory for task learning |
| 9 (Observability) | 8 (Orchestration) | Needs task execution history |
| 10 (Sovereign) | 9 (Observability) | Zero-cloud proof needs audit trail |
| 11 (Oracle) | 10 (Sovereign) | Oracle queries all system data |
| 12 (Surfaces) | 11 (Oracle) | Surfaces expose oracle data |
| 13 (Polish) | 12 (Surfaces) | SDK wraps final system |
