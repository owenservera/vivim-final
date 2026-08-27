---
title: Migration Plan
status: forensic-evidence (uncommitted)
companion_to: TARGET_ARCHITECTURE.md, SOTA_GAP_ANALYSIS.md
date: 2026-08-26
author: forensic investigation (opencode/text-prime)
related: ARCHITECTURAL_DECISIONS.md, ARCHITECTURAL_ERAS.md
---

# Migration Plan — Evolution from v0.1.0 Baseline to Target Architecture

This document defines the incremental migration sequence from the selected historical baseline (`v0.1.0` / `77c332c`) to the target architecture (`TARGET_ARCHITECTURE.md`). Each migration is independently understandable, testable, minimally invasive, reversible where practical, and associated with a clear architectural reason.

---

## Migration Principles

Every migration must answer:

- **What changed?** (clear description)
- **Why now?** (architectural justification from `ARCHITECTURAL_DECISIONS.md`)
- **Why this design?** (SOTA justification from `SOTA_GAP_ANALYSIS.md`)
- **What historical problem does it address?** (evidence from audit docs)
- **What alternatives were rejected?** (SOTA comparison)
- **What behavior must remain invariant?** (characterization tests from Phase 17)
- **How was it validated?** (test, manual verification, property-based test)
- **What new capability does this unlock?** (next migration dependency)
- **What future migration does this enable?** (dependency graph)

The sequence follows the preferred order (`MASTER_PROMPT.md` §14):

```
baseline → tests/characterization → boundary extraction → architecture migration → SOTA adoption → optimization → hardening → cleanup → final validation
```

---

## Migration 001 — Characterization Tests (Phase 17)

**Commit concept**: `test: establish characterization tests for v0.1.0 baseline`

**What changed**: Add `tests/integration/characterization-baseline/` with tests that verify the `v0.1.0` (`77c332c`) baseline behaves as documented (341 engine files, 2,088 tracked files, single SQLite DB, 10,661 initial lines, seeds idempotent, no DB split, no desktop layer).

**Why now**: Before any architecture change, establish the "observed behavior" reference. Without this, future migrations cannot distinguish intended behavior from accidental behavior.

**Validation**: Run `tests/integration/characterization-baseline/*.test.ts`. The tests must pass against both `v0.1.0` (`77c332c`) and current `HEAD` (`615d0c5`) to confirm that the baseline behavior has not drifted unexpectedly.

**Invariants preserved**:
- `v0.1.0` tag exists (`77c332c`).
- `AUDIT_BASELINE_v010_77c332c` annotated tag exists (`7e6de5a`).
- Engine count at `v0.1.0` = 341 (`REPOSITORY_FORENSIC_AUDIT.md` §6).
- File count at `v0.1.0` = 2,088.
- Single SQLite schema (`prisma/schema.prisma`).

**Future dependency**: Migration 002 (reconstruction branch creation) depends on these tests being committed.

---

## Migration 002 — Reconstruction Branch (Phase 20)

**Commit concept**: `feat: create reconstruction branch from v0.1.0 baseline`

**What changed**: Create `reconstruction-v010` branch from `77c332c` (`v0.1.0`). The branch exists independently of `master` and `experimental-dev`; it is a safe workspace for migration experiments.

**Why now**: The master prompt (§20) requires a dedicated reconstruction branch from the selected baseline to avoid overwriting the existing current branch.

**Validation**: Verify that `reconstruction-v010` points to `77c332c` and that `git log --oneline --graph --all --decorate` shows the branch clearly separated from `master`.

**Invariants preserved**:
- `v0.1.0` tag remains recoverable.
- `master` (`615d0c5`) remains untouched.
- `experimental-dev` (`174ddfa`) remains untouched.

**Future dependency**: All subsequent migrations occur on `reconstruction-v010` and are merged back to `master` only after final validation.

---

## Migration 003 — Cross-Boundary Enforcement (Phase 14-15, Partial)

**Commit concept**: `feat: add runtime boundary assertions for system/user DB split`

**What changed**: Add `ensureSystemDb()` and `ensureUserDb()` runtime assertions to `src/storage/prisma.ts`. These assertions verify that any DB write is performed through the correct client (`systemClient` vs `userClient`) and that no cross-boundary write occurs accidentally.

**Why now**: The DB split (`ARCHITECTURAL_DECISIONS.md` §Decision 3) is a major boundary; its correctness must be enforced at runtime, not just by convention.

**Evidence**: `ARCHITECTURAL_DECISIONS.md` Decision 3; `SOTA_GAP_ANALYSIS.md` Problem 5; `REPOSITORY_FORENSIC_AUDIT.md` §7.5 (cross-boundary layer).

**Validation**: Run existing tests; add new assertion tests (`tests/integration/boundary-assertions/*.test.ts`). The assertions should trigger on any cross-boundary write attempt.

**Alternatives rejected**:
- Full `TLA+` model checking (too complex for this scale; deferred to future research).
- Outbox pattern (over-engineered for a 2-DB split; deferred unless concurrent cross-boundary writes become required).

**Future dependency**: Migration 005 (CDP session resilience) can build on the strengthened storage layer.

---

## Migration 004 — Session Resilience (Phase 9, Partial — Problem 2)

**Commit concept**: `feat: add ChromeGovernor session resilience (detach + reconnect + graceful degradation)`

**What changed**: Implement `session.detach()` (Playwright `CDPSession` pattern) in `chrome-governor.ts`; add reconnect cycle (kill + relaunch + reattach) on session death (`session.on('close')`); add graceful degradation (API-mode fallback) when Chrome is unavailable.

**Why now**: The `ChromeGovernor` is the sole CDP authority (`ARCHITECTURAL_DECISIONS.md` §Decision 5); session failure breaks the core provider interaction pipeline (`SOTA_GAP_ANALYSIS.md` Problem 2).

**Evidence**: Playwright `CDPSession` docs (`playwright.dev/docs/api/class-cdpsession`); `ARCHITECTURAL_DECISIONS.md` Decision 5; `REPOSITORY_FORENSIC_AUDIT.md` §2.3 (`ChromeGovernor` as only CDP entry).

**Validation**: Characterization tests (Migration 001) should verify that the Governor manages session lifecycle; new resilience tests should verify reconnect after simulated session death (`session.detach()` followed by relaunch).

**Invariants preserved**:
- Only `ChromeGovernor` touches `BunCdpClient` (`ARCHITECTURAL_DECISIONS.md` §Decision 5).
- Singleton profile per (provider, account) (`ProfileAllocator` invariant).
- Session cleanup on `stop` or timeout.

**Future dependency**: Migration 011 (Desktop Binary Optimization) may benefit from faster session startup if the reconnect cycle is optimized.

---

## Migration 005 — Protocol Generation Tests (Phase 10, Partial — Problem 8)

**Commit concept**: `test: add property-based tests for provider protocol generator`

**What changed**: Add `tests/unit/protocol-generation/*.test.ts` using `fast-check` (or `quickcheck-js`) to generate random DB capability/seed payloads and verify that `bun run gen:protocol` produces `__generated__/provider-protocol.ts` that parses them correctly.

**Why now**: The protocol generator (`ARCHITECTURAL_DECISIONS.md` §Decision 8; `SOTA_IDENTIFICATION.md` Problem 8) is a critical bridge between DB and hot loop. Its correctness must be verified before any optimization or restructuring.

**Evidence**: `SOTA_IDENTIFICATION.md` Problem 8; `ARCHITECTURAL_DECISIONS.md` §Decision 8; `REPOSITORY_FORENSIC_AUDIT.md` §7.4 (generated-client hygiene, `11e6458` removed 737,938 lines).

**Validation**: The property-based tests must pass for 100+ random payloads. If any fail, the generator (not the DB) must be fixed.

**Alternatives rejected**:
- Manual regression tests (insufficient coverage for complex payload variations).
- Full `TLA+` proof (over-engineered for a TypeScript generator).

**Future dependency**: Migration 006 (Memory Scheduling Verification) can use the same property-based testing framework.

---

## Migration 006 — Memory Scheduling Verification (Phase 10, Partial — Problem 3)

**Commit concept**: `test: add property-based tests for FSRS-6 state preservation through version chain`

**What changed**: Add `tests/unit/fsrs-preservation/*.test.ts` using `fast-check` to generate random `cap-store.memory` payloads with FSRS-6 state, apply `rebuildGraphFromNodes()`, and verify that the FSRS state (ease factor, previous interval, recall quality) is preserved exactly.

**Why now**: The FSRS-6 scheduling (`ARCHITECTURAL_DECISIONS.md` §Decision 1; `SOTA_GAP_ANALYSIS.md` Problem 3) is a core feature; its integration with the version chain must be verified.

**Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 1 (`recordMemory()`, FSRS-6); `SOTA_GAP_ANALYSIS.md` Problem 3; canonical FSRS reference (`github.com/open-spaced-repetition/fsrs4anki`).

**Validation**: Tests must pass for 100+ random payloads through version chain rebuilds. If any FSRS state is lost or altered, the `rebuildGraphFromNodes()` logic (or the `NodeVersion` model) must be fixed.

**Future dependency**: Migration 007 (Harness Repair Tests) builds on the property-based testing framework.

---

## Migration 007 — Harness Repair Tests (Phase 10, Partial — Problem 9)

**Commit concept**: `test: add property-based tests for harness repair helpers`

**What changed**: Add `tests/unit/harness-repair/*.test.ts` using `fast-check` to generate random JSON payloads (with common defects: missing commas, extra code fences, incorrect quoting, deprecated field names) and verify that the repair helpers (`repairString`, `repairNumber`, `repairBoolean`) fix them without corrupting valid payloads.

**Why now**: The repair engine (`ARCHITECTURAL_DECISIONS.md` §Decision 6; `SOTA_GAP_ANALYSIS.md` Problem 9) fixes common LLM payload defects. Its correctness must be verified to prevent false positives/negatives.

**Validation**: Tests must pass for 100+ random payloads with injected defects. The repair helpers must never alter a payload that is already valid.

---

## Migration 008 — Capability Registry Enhancement (Phase 10, Partial — Problem 4)

**Commit concept**: `feat: add embedding-based capability lookup (optional) via nomic-embed-text`

**What changed**: Add `tests/unit/capability-lookup/*.test.ts` (optional); add `tests/unit/embedding-lookup/*.test.ts` (optional). If adopted, add an optional `embedding_lookup` module (`tests/unit/embedding_lookup/` or `src/storage/embedding_lookup/`) that uses `nomic-embed-text` (local inference at `localhost:11434`) or `jina-embeddings-v3` to match NL queries to capability IDs. The existing lexical `catalog.ts` remains the primary mechanism.

**Why now**: The capability registry (`ARCHITECTURAL_DECISIONS.md` §Decision 2; `SOTA_GAP_ANALYSIS.md` Problem 4) must scale. Embedding-based lookup improves accuracy but is optional.

**Evidence**: `ARCHITECTURAL_DECISIONS.md` §Decision 2; `SOTA_GAP_ANALYSIS.md` Problem 4; `SOTA_IDENTIFICATION.md` §Problem 4.

**Validation**: If the embedding lookup is adopted, its results must match the lexical catalog results for the current 459 engines. Any discrepancy must be documented.

**Future dependency**: Migration 009 (Provider Fallback Enhancement) can use the same embedding framework for parser selection.

---

## Migration 009 — Provider Fallback Enhancement (Phase 10, Partial — Problem 10)

**Commit concept**: `feat: add format detection heuristics for parser selection (optional) via Playwright CDP event analysis`

**What changed**: Add an optional `format_detection.ts` module (`tests/unit/format-detection/*.test.ts`) that analyzes `CDP` event data (`session.on('event')`) for format signatures (e.g., `data:` with `[DONE]` → ChatGPT; `candidates[].content.parts[].text` → Gemini; `type, delta` → Claude SSE). If adopted, the `StreamParserEngine` uses the heuristic as a supplementary mechanism before the fixed fallback chain.

**Why now**: The provider protocol (`ARCHITECTURAL_DECISIONS.md` §Decision 8; `SOTA_GAP_ANALYSIS.md` Problem 10) uses a fixed fallback chain. Adaptive selection improves efficiency.

**Evidence**: Playwright `CDPSession` docs (`playwright.dev/docs/api/class-cdpsession`); `ARCHITECTURAL_DECISIONS.md` §Decision 1 (Node-layer v2, provider-specific stream parsing); `SOTA_IDENTIFICATION.md` §Problem 10.

**Validation**: The heuristic must correctly identify the format for all current providers (`chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok`) and must not misclassify the generic/system parsers.

---

## Migration 010 — SQLite Tuning (Phase 11, Partial — Problem 1)

**Commit concept**: `feat: configure SQLite WAL mode and connection pooling settings`

**What changed**: Update `.env` or `prisma/schema.prisma` datasource URLs with `WAL` mode parameters (`journal_mode=WAL`, `synchronous=NORMAL`, `mmap_size`). Add connection pool settings (`minConnections=1`, `maxConnections=10`, `connectionTimeout=30`, `idleConnectionTimeout=600`). No DB replacement.

**Why now**: The SQLite database (`ARCHITECTURAL_DECISIONS.md` §Decision 3; `SOTA_GAP_ANALYSIS.md` Problem 1) is the core persistence layer. Tuning improves performance without changing the DB engine.

**Evidence**: SQLite official docs (`sqlite.org`); Prisma ORM docs (connection pooling parameters); `REPOSITORY_FORENSIC_AUDIT.md` §5 (DB count, file count, engine growth).

**Validation**: Characterization tests must still pass; performance improvement can be measured informally (faster DB reads/writes) but is not required for correctness.

---

## Migration 011 — Cross-Boundary Enforcement Strengthening (Phase 14, Partial — Problem 5)

**Commit concept**: `feat: add runtime boundary assertions and document contract`

**What changed**: Add `ensureSystemDb()` and `ensureUserDb()` assertions in `src/storage/prisma.ts`. Add `tests/integration/boundary-assertions/*.test.ts` that verify cross-boundary writes are blocked. Add `ARCHITECTURAL_DECISIONS.md` §Decision 5 documentation.

**Why now**: The DB split's contract must be enforced at runtime (`SOTA_GAP_ANALYSIS.md` Problem 5).

**Validation**: The assertions must trigger on any cross-boundary write attempt and fail the test.

---

## Migration 012 — Desktop Binary Optimization Monitoring (Phase 11, Partial — Problem 6)

**Commit concept**: `docs: add desktop binary optimization notes and bkg monitoring`

**What changed**: Add `docs/architecture/DESKTOP_BINARY.md` (optional) documenting the current binary size (45.6 MB compressed, ~97 MB uncompressed), the UPX pipeline (`scripts/tauri/build-sidecar.ps1`), and the `bkg` canary monitoring plan. No binary rewrite.

**Why now**: The desktop binary is functional; optimization is a future enhancement (`SOTA_GAP_ANALYSIS.md` Problem 6). Monitoring the `bkg` canary ensures the team can adopt it when stable.

---

## Migration 013 — MCP Adapter Compliance Verification (Phase 11, Partial — Problem 7)

**Commit concept**: `docs: add MCP adapter compliance audit`

**What changed**: Add `docs/architecture/MCP_ADAPTER_AUDIT.md` (optional) listing the adapter's current features (Resources, Prompts, Tools, Sampling, Roots) against the MCP 2025-06-18 spec. Identify any missing features (e.g., resource change monitoring, prompt capabilities). No adapter rewrite unless gaps are critical.

**Evidence**: `modelcontextprotocol.io/specification/2025-06-18`; `SOTA_IDENTIFICATION.md` Problem 7.

---

## Migration 014 — Final Audit and Summary (Phase 23-24)

**Commit concept**: `docs: add KNOWN_LIMITATIONS.md and FINAL_ARCHITECTURE_SUMMARY.md`

**What changed**: Produce the two final deliverable documents:
- `KNOWN_LIMITATIONS.md`: List current limitations (DB split overhead, desktop binary size, MCP adapter maturity, harness repair unverified, provider protocol generation untested, cross-boundary enforcement by convention only, session resilience not fully implemented, FSRS scheduling unverified, capability registry lexical-only).
- `FINAL_ARCHITECTURE_SUMMARY.md`: Summarize the original trajectory (`v0.1.0` → `HEAD`), selected baseline (`77c332c`), why selected, major mistakes discovered, valuable ideas preserved, SOTA techniques adopted (`WAL` tuning, session resilience, property-based tests, embedding lookup, format heuristics), SOTA techniques rejected (`full DB replacement`, `Electron` migration, `WASM` rewrite), final architecture (`TARGET_ARCHITECTURE.md`), migration sequence (`MIGRATION_PLAN.md`), current limitations, remaining risks, next research areas.

**Validation**: Independent senior architect review (simulated): can they understand the WHY of the architecture? The `EVOLUTION_JOURNAL.md` (Phase 16) provides the reasoning chain.

---

## Migration Sequence (Ordered List)

The migrations are ordered to respect dependencies and minimize risk:

1. **Migration 001** — Characterization tests (`v0.1.0` baseline behavior reference).
2. **Migration 002** — Reconstruction branch (`reconstruction-v010` from `77c332c`).
3. **Migration 003** — Boundary extraction (verify `ChromeGovernor`, capability registry, seeds truth).
4. **Migration 004** — Cross-boundary enforcement (`ensureSystemDb()` / `ensureUserDb()` assertions).
5. **Migration 005** — Session resilience (`detach()`, reconnect cycle, graceful degradation).
6. **Migration 006** — Protocol generation tests (`fast-check` property-based tests).
7. **Migration 007** — Memory scheduling verification (`fast-check` FSRS preservation tests).
8. **Migration 008** — Harness repair tests (`fast-check` repair helper tests).
9. **Migration 009** — Capability registry enhancement (embedding lookup — optional adoption).
10. **Migration 010** — Provider fallback enhancement (format detection heuristics — optional adoption).
11. **Migration 011** — SQLite tuning (`WAL` mode, connection pooling).
12. **Migration 012** — Desktop binary optimization (monitor `bkg`, adopt if stable).
13. **Migration 013** — MCP adapter compliance verification (`docs/` audit).
14. **Migration 014** — Final audit (`KNOWN_LIMITATIONS.md`, `FINAL_ARCHITECTURE_SUMMARY.md`, independent review).

---

## Key Observations

- **No destructive DB migration required**. The DB split (`system/user`) already exists; tuning (`WAL`) and optional analytics (`DuckDB`) are additive.
- **No framework replacement required**. SQLite + Prisma remains; `bkg` (Bun Packager) is an optional binary optimization.
- **No Tauri V2 replacement required**. The desktop layer is stable; the gap is session resilience and binary size.
- **No MCP adapter replacement required**. The adapter exists; compliance verification and optional feature additions are sufficient.
- **No harness engine replacement required**. The repair engine is functional; property-based tests and schema evolution are sufficient.
- **No capability registry replacement required**. The registry works; embedding lookup is an optional enhancement.
- **No provider protocol generator replacement required**. The generator works; property-based tests and incremental generation are sufficient.
- **No ChromeGovernor replacement required**. The Governor works; session resilience is the main gap.

The target architecture is therefore an **evolution** of the current architecture, not a revolution. All major boundaries (`ARCHITECTURAL_DECISIONS.md`) are preserved; the gaps (`SOTA_GAP_ANALYSIS.md`) are addressed through targeted adaptations (`KEEP`, `ADAPT`, `ADD`, `RESEARCH`).
