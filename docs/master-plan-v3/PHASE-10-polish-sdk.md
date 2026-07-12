# Phase 10: Polish, SDK & Documentation

**Status:** PROPOSED
**Units:** 8
**Depends on:** all prior phases
**Produces:** A polished, documented, SDK-rich v3 ready for daily use.

---

## Goal

Phases 1-9 produce a working agentic platform. Phase 10 turns it into a product: typed SDKs for external integrators, comprehensive ADRs for every non-trivial decision, onboarding flow for new users, performance tuning, and the v3 release tag.

---

## Units

### 10.1 Typed SDK v2 (`sdk/`)
**Source:** v3 Overview §3
**Depends on:** all
**Produces:** `sdk/` is a publishable NPM package with full TypeScript types + Zod schemas + WebSocket client.

Replaces the current thin client with: typed methods for every endpoint, Zod-validated responses, WebSocket subscription helpers, capability-invocation helpers (`client.invoke('canvas_spawn', {...})`), event stream types.

### 10.2 React workspace SDK (`web/workspace-sdk/`)
**Source:** v3 Overview §3
**Depends on:** 10.1, Phase 4
**Produces:** Embeddable React components for the workspace shell.

`<VivimWorkspace client={client} layout="dual" />` renders a full workspace in any React app. Enables embedding vivim into Electron, VS Code webviews, or other host shells.

### 10.3 Onboarding flow
**Source:** v3 Overview §4
**Depends on:** Phase 4, Phase 5
**Produces:** 5-step first-run experience.

(1) Welcome + privacy explanation. (2) Choose workspace dir. (3) Detect/install Ollama (or opt into cloud). (4) Pair a cloud provider (optional, with consent). (5) Try a sample task. Each step is a canvas-driven wizard.

### 10.4 Performance tuning + benchmarks
**Source:** v3 Overview §4
**Depends on:** all
**Produces:** Baseline benchmarks + optimizations.

Measure: server boot time, capability resolution latency, canvas spawn latency, agentic-loop iteration latency, memory recall latency. Optimize the slowest 3. Document baselines in `docs/performance/baselines.md`.

### 10.5 ADR sweep
**Source:** v3 Overview (referenced throughout)
**Depends on:** all
**Produces:** ADRs for every cross-cutting decision made in v3.

Minimum: ADR-001 (SQLite SQL dialect unification), ADR-002 (field-level vs DB-level encryption), ADR-003 (canvas iframe vs web component), ADR-004 (sandbox vm vs WASM), ADR-005 (sync conflict resolution strategy), ADR-006 (intent template vs LLM-only planning), ADR-007 (provenance graph storage model), ADR-008 (local-first default).

### 10.6 API documentation (OpenAPI)
**Source:** v3 Overview §3
**Depends:** all
**Produces:** `docs/api/openapi.yaml` generated from route definitions.

Every HTTP endpoint documented with params, request/response schemas, examples. Auto-generated from a route→schema map maintained alongside routers. Posted to `docs/api/` as both YAML and rendered HTML.

### 10.7 User manual
**Source:** v3 Overview §4
**Depends:** all
**Produces:** `docs/user-manual.md` covering daily-use scenarios.

Topics: workspace navigation, canvas authoring, agent task delegation, memory curation, provider setup, backup/restore, multi-device sync, troubleshooting. Written user-first, not developer-first.

### 10.8 v3 release
**Source:** v3 Overview §4
**Depends on:** all
**Produces:** Tagged release `v3.0.0`; migration guide from v1; changelog.

Final gate: `bun run devops gate --strict --full` passes. Truth score ≥95%. Coverage ≥80%/85%. All ADRs approved. All sample scenarios from Overview §4 verified end-to-end. Cut tag, publish SDK, post release notes.

---

## Acceptance

- A new user with no vivim experience can install, onboard, and complete a useful task within 10 minutes.
- External developer can install the SDK and invoke vivim capabilities from a Node script within 30 minutes.
- `bun run devops gate --strict --full` passes on the release commit.
- Performance baselines documented for 5 key operations.
- v3 release notes clearly explain what changed from v1 and how to migrate.
