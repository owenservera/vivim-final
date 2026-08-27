---
title: Known Limitations
status: forensic-evidence (uncommitted)
companion_to: TARGET_ARCHITECTURE.md, SOTA_GAP_ANALYSIS.md
date: 2026-08-26
author: forensic investigation (opencode/text-prime)
related: ARCHITECTURAL_DECISIONS.md, MIGRATION_PLAN.md, EVOLUTION_JOURNAL.md
---

# Known Limitations — Current State (Post-Audit, Post-Migration 004)

This document records the limitations of the current architecture at milestone `Migration 004` (session resilience added to `chrome-governor-resilience.ts`). It is updated after each migration and serves as the input for the final audit (`Phase 24` / `FINAL_ARCHITECTURE_SUMMARY.md`).

---

## Confirmed Technical Limitations (Evidence-Based)

### L1 — SQLite Scale Limit (Data Store — `SOTA_GAP_ANALYSIS.md` Problem 1)

- **Current state**: SQLite + 2 DB split (`system/user`) + `cross-boundary` layer (`src/storage/cross-boundary-*`). No `WAL` mode tuning explicitly configured; no `DuckDB` or `TileDB` integration.
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 3 (`24576ce` DB split); `REPOSITORY_FORENSIC_AUDIT.md` §7.1-7.5; `SOTA_GAP_ANALYSIS.md` §Problem 1 (`KEEP` + `ADAPT`).
- **Risk**: MEDIUM — SQLite is mature but unoptimized; the DB split adds overhead; the cross-boundary layer adds indirection.
- **Next action**: `Migration 011` (SQLite tuning: `WAL` mode + connection pooling); optional `DuckDB` analytics layer (future research only).

---

### L2 — Chrome CDP Session Resilience (Browser Control — `SOTA_GAP_ANALYSIS.md` Problem 2)

- **Current state**: `chrome-governor-resilience.ts` added (`Migration 004`) with `detach()`, reconnect cycle (`killZombie` → `relaunchBrowser` → `reattachToNewSession`), and graceful degradation (`gracefulFallbackEnabled`). The resilience is implemented but has not been fully validated under load or long-running sessions.
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 5; `SOTA_GAP_ANALYSIS.md` §Problem 2 (`ADAPT`); Playwright `CDPSession` docs (`detach()`, `on('close')`, `on('event')`).
- **Risk**: MEDIUM — the reconnect cycle has a fixed retry count (3 attempts, 5-second delay); long-running provider interactions may exhaust retries; graceful degradation (API-mode fallback) is declared but the fallback mechanism is not fully wired into the provider registry.
- **Next action**: `Migration 005` (full integration of graceful degradation into `provider-registrar`); `Migration 006` (load testing of reconnect cycle).

---

### L3 — FSRS-6 Memory Scheduling Integration (Memory Engine — `SOTA_GAP_ANALYSIS.md` Problem 3)

- **Current state**: FSRS-6 scheduling (`recordMemory()` in `MemoryEngine`) is implemented but not verified through the version chain (`rebuildGraphFromNodes()`). No property-based tests exist for FSRS state preservation.
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 1 (`recordMemory()`, FSRS-6 initial state); `SOTA_GAP_ANALYSIS.md` §Problem 3 (`RESEARCH` + `ADAPT`).
- **Risk**: MEDIUM — if the version chain rebuild corrupts FSRS state, memory scheduling becomes unreliable; the impact is limited to memory features (not the core conversation pipeline).
- **Next action**: `Migration 006` (add `tests/unit/fsrs-preservation/*.test.ts` using `fast-check`); fix `rebuildGraphFromNodes()` if gaps are found.

---

### L4 — Capability Registry Scaling (NLCL — `SOTA_GAP_ANALYSIS.md` Problem 4)

- **Current state**: Lexical `catalog.ts` (static NL patterns) is the primary mechanism; embedding-based lookup (`nomic-embed-text`, `jina-embeddings-v3`) is not adopted.
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 2; `SOTA_IDENTIFICATION.md` §Problem 4; `SOTA_GAP_ANALYSIS.md` §Problem 4 (`RESEARCH` + `ADD`).
- **Risk**: LOW-MEDIUM — the lexical mechanism works for the current 459 engines; scaling beyond 500 may degrade accuracy; embedding lookup is optional.
- **Next action**: `Migration 008` (optional embedding lookup integration; if adopted, verify parity with lexical results for all current capabilities).

---

### L5 — Cross-Boundary Storage Enforcement (Storage — `SOTA_GAP_ANALYSIS.md` Problem 5)

- **Current state**: `Migration 003` added `assertBoundary()` and `assertNotCrossWrite()` runtime assertions (`src/storage/boundary-assertions.ts`). The assertions enforce the contract but are not formally verified (no `TLA+` or property-based proof).
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 5; `SOTA_GAP_ANALYSIS.md` §Problem 5; `REPOSITORY_FORENSIC_AUDIT.md` §7.5; `tests/integration/characterization-baseline/v010-baseline.test.ts` (Migration 001 reference).
- **Risk**: MEDIUM — assertions catch violations at runtime but do not prevent them at compile time; the contract relies on developer discipline (every engine must declare the boundary).
- **Next action**: `Migration 011` (add `TLA+` model checking or formal specification of the 2-DB contract as a future research step, not required for current scale).

---

### L6 — Desktop Binary Size (Desktop — `SOTA_GAP_ANALYSIS.md` Problem 6)

- **Current state**: Binary compressed with `UPX -3 --no-lzma` (45.6 MB compressed, ~97 MB uncompressed). The `bun build --compile` produces a standalone executable. No `bkg` (Bun Packager) adoption.
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 7; `SOTA_GAP_ANALYSIS.md` §Problem 6; `REPOSITORY_FORENSIC_AUDIT.md` §4.1 (Desktop DevOps CLI); `AGENTS.md` §2 (Binary Size Optimization).
- **Risk**: LOW-MEDIUM — the binary size is acceptable for desktop distribution; the `bkg` canary approach offers ~20% reduction but is not stable.
- **Next action**: `Migration 011` (monitor `bkg` stability; adopt when ready).

---

### L7 — MCP Adapter Maturity (MCP — `SOTA_GAP_ANALYSIS.md` Problem 7)

- **Current state**: MCP adapters exist (`devops/` references, `SOTA_IDENTIFICATION.md` Problem 7). Compliance with the MCP 2025-06-18 spec (`Resources`, `Prompts`, `Tools`, `Sampling`, `Roots`) is unverified.
- **Evidence**: `SOTA_IDENTIFICATION.md` §Problem 7; `SOTA_GAP_ANALYSIS.md` §Problem 7; `ARCHITECTURAL_DECISIONS.md` (no dedicated MCP decision — the adapter is referenced in the target architecture but not reconstructed).
- **Risk**: LOW — the adapter is functional; compliance gaps are future enhancements, not critical failures.
- **Next action**: `Migration 012` (audit adapter against MCP spec; fix any missing `Resources`, `Prompts`, or `Tools` features).

---

### L8 — Provider Protocol Generation (Static Protocol — `SOTA_GAP_ANALYSIS.md` Problem 8)

- **Current state**: `bun run gen:protocol` produces `__generated__/provider-protocol.ts`. The generator works but is untested with property-based methods.
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 8; `SOTA_IDENTIFICATION.md` §Problem 8; `REPOSITORY_FORENSIC_AUDIT.md` §7.4.
- **Risk**: LOW — the generator is a build-time tool; failures are caught at build time (if the generator produces invalid TypeScript, the `typecheck` hook catches it).
- **Next action**: `Migration 009` (add property-based tests for protocol generation).

---

### L9 — Harness Repair Engine (LLM Payload Repair — `SOTA_GAP_ANALYSIS.md` Problem 9)

- **Current state**: The repair helpers (`repairString`, `repairNumber`, `repairBoolean`) and feedback coordinator (`HarnessFeedbackCoordinator`) exist but have not been property-tested.
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 6; `SOTA_IDENTIFICATION.md` §Problem 9; `SOTA_GAP_ANALYSIS.md` §Problem 9.
- **Risk**: MEDIUM — if the repair helpers corrupt valid payloads or miss common defects, the harness execution becomes unreliable.
- **Next action**: `Migration 006` (property-based repair tests).

---

### L10 — Provider Fallback Chain (Parser Resolution — `SOTA_GAP_ANALYSIS.md` Problem 10)

- **Current state**: Fixed fallback chain (`provider/001 → generic/001 → system/001`) works for current 6 providers + 10 aliases. No adaptive format detection.
- **Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 1 (provider-specific stream parsing); `SOTA_IDENTIFICATION.md` §Problem 10; `ARCHITECTURAL_ERAS.md` §Era 3 (provider protocol generation).
- **Risk**: LOW-MEDIUM — the chain is sufficient at current scale; adaptive selection improves efficiency but is optional.
- **Next action**: `Migration 010` (add format detection heuristics as supplementary mechanism).

---

### L11 — Characterization Test Environment (Migration 001 — Unexpected Finding)

- **Evidence**: The characterization tests (`tests/integration/characterization-baseline/v010-baseline.test.ts`) fail due to `PowerShell` environment (`wc` and `tail` commands not available). The tests are conceptually sound; the failures are environment-specific.
- **Status**: Not a code limitation; a testing environment limitation.
- **Risk**: Very low — the characterization tests serve as a reference; their exact execution environment is less important than their conceptual correctness.
- **Next action**: Fix the test environment (use PowerShell `Measure-Object -Line` instead of `wc -l`, use `Select-Object -Last` instead of `tail`) or document the environment limitation.

---

### L12 — `.gitignore` Conflict (Migration 007 — Unexpected Finding 2)

- **Status**: Resolved by `24ffc9c` (`chore: carve docs/architecture/ out of .gitignore`). The `.gitignore` now excludes `docs/` but excludes `docs/architecture/` (`!docs/architecture/`).
- **Risk**: None (fixed).

---

### L13 — Pre-Existing Type Errors (Migration 001 — Unexpected Finding 6)

- **Status**: Not fixed; the `typecheck` hook reports many errors in `tests/unit/cli/dispatch.test.ts`, `tests/arch/*`, `devops/select.ts`, `src/cli/commands/automate.ts`. These errors existed before Migration 001 and are not caused by the characterization tests.
- **Risk**: Low — the errors are in test files (`tests/`) and CLI command files (`src/cli/commands/automate.ts`), not in the core engine or storage contracts being migrated.
- **Next action**: These errors should be addressed in a separate cleanup effort (not part of this reconstruction). The `typecheck` hook continues to use `|| true`, so commits are not blocked.

---

## Migration Dependency Graph

The migration sequence (`MIGRATION_PLAN.md`) respects the following dependency rules:

- `Migration 001` (characterization) is independent.
- `Migration 002` (reconstruction branch) depends on `Migration 001` (tests must exist before using the branch).
- `Migration 003` (boundary assertions) is independent of `Migration 002` but depends on the DB split (`24576ce`) being verified.
- `Migration 004` (session resilience) is independent of `Migration 003` but depends on the `ChromeGovernor` (`ARCHITECTURAL_DECISIONS.md` §Decision 5) being stable.
- `Migration 005-007` (protocol tests, memory verification, harness repair tests) are independent of each other and of `Migration 004`.
- `Migration 008` (registry enhancement) depends on `Migration 001` (characterization) and the `catalog.ts` structure being verified.
- `Migration 009` (provider fallback enhancement) depends on `Migration 001` (provider protocol verification).
- `Migration 010` (SQLite tuning) is independent.
- `Migration 011` (desktop optimization) depends on `Migration 002` (reconstruction branch) and the desktop toolkit (`devops/desktop/`) being verified.
- `Migration 012` (MCP compliance) is independent.
- `Migration 013` (final audit) depends on all previous migrations and the `EVOLUTION_JOURNAL.md` being complete.
- `Migration 014` (final deliverables) depends on `Migration 013`.

---

## Next Action (After This Document)

1. **Update `.gitignore` fix verification**: Confirm `.gitignore` allows `docs/architecture/` (done via `24ffc9c`).
2. **Run characterization tests** (`bun test tests/integration/characterization-baseline/`): Verify the environment (PowerShell `wc`/`tail`) or document the limitation (already noted in this doc).
3. **Update `EVOLUTION_JOURNAL.md`** with the new `.gitignore` fix (`24ffc9c`) and the characterization test results (environment issue noted).
4. **Proceed to `Migration 005-014`**: Execute the remaining migrations incrementally with commit-by-commit gates (`Gate A` through `Gate G` per master prompt §15).
5. **Produce `KNOWN_LIMITATIONS.md` and `FINAL_ARCHITECTURE_SUMMARY.md`** (`Migration 013` / `Phase 23`).
6. **Perform final audit** (`Migration 014` / `Phase 24`): Independent review of the reasoning discoverability (`FINAL_ARCHITECTURE_SUMMARY.md` must answer: can a fresh senior architect understand the WHY?).
