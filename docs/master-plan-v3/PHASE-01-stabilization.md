# Phase 1: Stabilization & Cleanup

**Status:** PROPOSED
**Units:** 12
**Depends on:** (nothing — this is the foundation)
**Produces:** A codebase with zero invariant violations, zero stubs, zero `as never` escape hatches, and 80%+ test coverage.

---

## Goal

Before adding any new capability, the existing v1 codebase must be brought to a known-good state. v3 is built on top of v1's engines; if those engines have stubs, forbidden imports, or unwired bootstrap paths, every v3 feature that depends on them inherits that debt.

Phase 1 closes every "Missing / Asymmetric" item from the v3 overview, achieves full invariant compliance, and removes the legacy `provider-logic/` directory that violates invariant B3.

---

## Units

### 1.1 Remove provider-logic/ legacy directory
**Source:** v3 Overview §1.10; invariant B3 (Seeds Not Code)
**Depends on:** —
**Produces:** Clean engine boundary; engines cannot accidentally import the forbidden TS provider configs.

Delete `provider-logic/` entirely. Any reference in tests or scripts must be re-pointed to `seeds/providers/*.json` (loaded via `ProviderRegistrar`). Confirm `bun run devops invariants check --category B` passes B3.

### 1.2 Wire AutonomousExecutionEngine into server bootstrap
**Source:** v3 Overview §1.4 (foundation for agentic loop); observed gap in `createServerWithEngines` (passes `{} as never` for registry)
**Depends on:** —
**Produces:** Autonomous endpoints fully functional.

Replace `{} as never` with the real `UnifiedCapabilityRegistry` instance in `createServerWithEngines`. Register the autonomous engine's HTTP routes (`/api/autonomous/*`) in the bootstrap, not just in the conditional.

### 1.3 Complete UnifiedCapabilityRegistry bootstrap with default capabilities
**Source:** v3 Overview §1.2, §1.3
**Depends on:** 1.2
**Produces:** A registry populated at startup with built-in capabilities (`send_message`, `select_model`, `create_conversation`, etc.) exported to all five surfaces.

Create `src/engines/capability-bootstrap.ts` that registers ~20 default capabilities covering core conversation, fleet, and admin actions. Each registration includes `cliCommand`, `uiAction`, `mcpToolName`, and `apiEndpoint` so they auto-export.

### 1.4 Eliminate all `// stub` and `// v1 stub` markers in engines
**Source:** v3 Overview §1.7; truth scanner classification MIXED/STUB
**Depends on:** —
**Produces:** Every engine file classified REAL by `bun run devops truth scan`.

Run `devops truth scan --verbose`, list every STUB/MIXED file, complete the implementation per the engine's own interface contract. Specific known stubs: `harness-runtime.ts:evaluateCondition`, `provider-discovery.ts:screenshot`, `agentic-loop.ts` (parallel-universe, never wired).

### 1.5 Replace every `as never` and `as any` in engines with proper types
**Source:** invariant D2
**Depends on:** —
**Produces:** Zero `any` in `src/engines/`.

`devops invariants check --category D` reports zero D2 warnings. Use `unknown` + type narrowing or proper generic constraints. The `biome-ignore lint/suspicious/noExplicitAny` pragmas in `capability-store-impl.ts`, `semantic-memory-store-impl.ts`, `procedural-memory-store-impl.ts`, `episodic-memory-store-impl.ts` get replaced with a typed Prisma client access pattern.

### 1.6 Replace raw `new Error()` in engines with CapStoreError subclasses
**Source:** invariant B7
**Depends on:** —
**Produces:** Zero B7 violations.

`devops invariants check --category B` reports zero B7. Add new error classes as needed: `CapabilityResolutionError`, `IntentDecompositionError`, `CanvasSpawnError`, etc.

### 1.7 Fix TelemetryAggregator SQL dialect (Postgres → SQLite)
**Source:** v3 Overview observed issue: `$queryRawUnsafe` with `$1` params + `ON CONFLICT` is Postgres syntax, but Prisma datasource is SQLite.
**Depends on:** —
**Produces:** `TelemetryAggregator.runAllCycles()` actually executes without error on SQLite.

Two options (decide via ADR-001 in Phase 1): (a) rewrite to SQLite-compatible `?` params + `ON CONFLICT DO UPDATE` (SQLite supports this), (b) make the dialect configurable. Option (a) is simpler and matches the actual DB.

### 1.8 Wire KnowledgeIngestionEngine to actually extract entities
**Source:** observed: `extractor.batchExtract([])` always called with empty array
**Depends on:** —
**Produces:** Imported conversations have entities/decisions/patterns extracted.

Pass the actual imported messages to `KnowledgeExtractor.extractFromConversation`. Track per-message extraction state in `import_job.resultJson`.

### 1.9 Replace MuxDispatcher stub with real provider dispatch
**Source:** observed: `muxDispatcher` returns `{ ok: true, response: "routed to X" }` without calling any provider
**Depends on:** 1.3
**Produces:** Provider mux routes actually invoke `ConversationManager.send` against target providers.

Wire `MuxDispatcher.dispatchToProvider` to spin up (or reuse) a `ConversationManager` per target provider and dispatch the message. Track cost via `CostOptimizer.recordCost`.

### 1.10 Remove duplicate test fixtures and consolidate mock helpers
**Source:** `tests/helpers/prisma-mock.ts`, `tests/integration/helpers/*` have overlapping mocks
**Depends on:** —
**Produces:** Single canonical mock store per engine; tests run 2x faster.

Consolidate to one mock per store contract. Provide a `createMockEngineContext()` helper that wires all mocks together.

### 1.11 Achieve 80% coverage on src/engines, 85% on src/server
**Source:** AGENTS.md testing protocol
**Depends on:** 1.4, 1.5, 1.6
**Produces:** `bun run devops gate --strict` passes the coverage step.

Write the missing tests identified by the coverage gate. Focus on engine happy-path + one error path each; full edge-case coverage is Phase 10.

### 1.12 Establish v3 baseline: `bun run devops gate` passes with zero violations
**Source:** v3 Overview §4 Scenario E
**Depends on:** all of Phase 1
**Produces:** Green gate; v3 work can begin.

Run gate, fix any remaining issues, commit baseline. Tag commit `v3-baseline`.

---

## Risks & Mitigations

- **Risk:** Removing `provider-logic/` breaks something unexpected. **Mitigation:** `rg "provider-logic"` first to find all importers; they should all be tests.
- **Risk:** SQLite vs Postgres SQL rewrite causes subtle aggregation bugs. **Mitigation:** Add integration test that runs each TelemetryAggregator schedule against a seeded SQLite DB and asserts row counts.
- **Risk:** 80% coverage target forces low-value tests. **Mitigation:** Prioritize engine tests; CLI/server can stay at lower coverage in Phase 1 and reach target in Phase 10.
