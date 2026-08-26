---
title: SOTA Identification — Architectural Problems
status: forensic-evidence (uncommitted)
companion_to: REPOSITORY_FORENSIC_AUDIT.md
date: 2026-08-26
author: forensic investigation (opencode/text-prime)
related: AUDIT_BASELINE_v010_77c332c (annotated tag at `7e6de5a → 77c332c`)
---

# SOTA Identification — Architectural Problems

This document identifies the major architectural problems in vivim-final that are worth researching against current state of the art. Each problem is classified by domain, severity, and research readiness.

## Problem 1: SQLite at Scale (Data Store)

**Domain**: Storage engine, persistence, local-first
**Severity**: HIGH — repo grew from 2088 to 2648 files (27% increase) and from 341 to 459 engines (34% increase); commit `edd8fa5` reclaimed 8.5 GB; commit `11e6458` removed 737,938 lines of generated bloat.

**Current state**: Single SQLite database (`prisma/schema.prisma` + `prisma/migrations/`). The DB-only parser logic and seeds-as-truth pattern stores all capability/parser configuration in this DB. The DB split (Era 4) introduced `prisma/system/` and `prisma/user/` to separate framework-managed from user-owned data. The node graph (contentHash, version, state, securityLevel, quality, validFrom/validUntil, parentVersion, NodeVersion, NodeAlias, NodeEdge) is entirely in this SQLite.

**SOTA research directions**:
- **WAL mode tuning + connection pooling** for high-concurrency local-first scenarios (e.g., Prisma connection pooling, raw SQLite WAL autotuning).
- **Embedded DB alternatives**: `TileDB` (multidimensional), `Lance` (columnar embedded), `DuckDB` (analytical SQL on embedded), `ClickHouse Embedded` for write-heavy workloads.
- **Data partitioning strategies**: horizontal partitioning of the Node graph across multiple SQLite files, with a metadata router.
- **Change-tracking at scale**: `sqlite-changeset` or `PocketBase` patterns for efficient diffing without full-scans.
- **Mmap and memory-mapped I/O** optimization for the 2.6k-file / 459-engine workload.

**Leading approaches**:
- Prisma with connection pooling (`minConnections`, `maxConnections`), `relationMode: "prisma"` vs `"lean"`.
- `DuckDB` for analytical queries on top of SQLite for read-heavy workloads.
- `TileDB` for sparse multidimensional arrays if the Node graph needs spatial queries.

**Maturity**: HIGH — SQLite is battle-tested; the research is about *configuration* and *complementary* technologies, not replacing SQLite.

**Decision**: **KEEP SQLite + Prisma + split**; research WAL tuning + optional DuckDB for read analytics. No DB replacement needed at this scale.

---

## Problem 2: Chrome CDP Session Resilience (Browser Control)

**Domain**: CDP, browser automation, ChromeGovernor
**Severity**: HIGH — the ChromeGovernor canon (Invariant 1) centralizes CDP access, but underlying `BunCdpClient` must handle disconnections, page crashes, zombie sessions, and reattachment. The provider system (6 UI-facing providers + 10 framework/API aliases) each have different CDP surfaces (composer selectors, send methods, capture patterns). The system must survive browser crashes without data loss or leaked state.

**Current state**: Chrome slaves auto-launch on first needed, keep alive until `stop`. The `ChromeGovernor` mediates all CDP traffic. The `provider-registrar.ts` wires `fallbackParserId` chains. Streaming formats differ per provider: Gemini uses custom batchexecute RPC (not SSE), ChatGPT uses `data:` format with `[DONE]` terminator, Claude uses Anthropic SSE.

**SOTA research directions**:
- **Automated session recovery patterns**: detecting CDP session death, cleaning up zombies, reattaching to a fresh CDP endpoint.
- **Provider-specific CDP error handling**: each provider has different DOM structures and streaming formats; research into resilient capture/parse pipelines that tolerate DOM drift.
- **CDP protocol versioning**: different Chrome versions support different CDP domains/methods; research into feature-detection and graceful degradation.
- **Cross-browser vs Chrome-only**: the Governor currently assumes Chrome; research into Firefox CDP parity or fallback to API-mode when Chrome is unavailable.
- **Memory leak prevention**: CDP sessions can leak browser processes; research into automated cleanup cycles.

**Leading approaches**:
- Playwright's auto-healing and session management patterns (they solve exactly this problem for E2E testing).
- `cdp-session` lifecycle management patterns from the `puppeteer` ecosystem.
- Custom watchdog timers that kill and restart CDP sessions after X minutes of inactivity.

**Maturity**: MEDIUM — Playwright patterns are well-established; applying them to a Bun-based Governor is a moderate research effort.

**Decision**: **ADAPT Playwright session-resilience patterns** into the ChromeGovernor. The Governor already auto-launches/re-launches; add automated session expiry + restart after N minutes, plus DOM drift tolerance in the parser fallback chain.

---

## Problem 3: FSRS-6 Memory Scheduling Algorithm (Memory Engine)

**Domain**: Memory engine, FSRS-6, spaced-repetition, knowledge graph
**Severity**: MEDIUM — Era 1 introduced the ACU Node with FSRS-6 initial state via `recordMemory()`. The system emits `cap-store.memory` Nodes with FSRS-6 schedules. No later era has re-examined the scheduling algorithm or its integration with the version chain.

**Current state**: `recordMemory()` in the MemoryEngine emits Nodes with FSRS-6 initial state. The FSRS-6 algorithm determines the next review interval based on ease factor, previous interval, and recall quality. No research has been done on whether FSRS-6 is the optimal schedule for this use case, or whether the Node version chain correctly preserves FSRS state across mutations.

**SOTA research directions**:
- **FSRS-6 vs alternative schedules** (SM-2, Priority Queue, Half-Yearly, Expanding Spacing).
- **Integration with Node version chains**: does FSRS state survive `rebuildGraphFromNodes()`? Are there edge cases where FSRS state is lost or corrupted?
- **Personalization beyond ease factors**: incorporating user activity patterns, session depth, or conversation importance into the schedule.
- **Batch FSRS recomputation**: computing intervals for many memories at once (relevant as engine count grows to 459+).

**Leading approaches**:
- FSRS-6 (Anki's current standard) is documented and has reference implementations.
- SM-2 (original SuperMemo) is simpler but less granular.
- Priority Queue-based scheduling (used in some LLM memory systems) adapts interval based on recent recall patterns.

**Maturity**: MEDIUM — FSRS-6 is documented and in use, but its integration into a local-first version-controlled system is a research gap.

**Decision**: **Research FSRS-6 integration patterns** and document whether the Node version chain preserves FSRS state correctly. If gaps are found, either fix the integration or document the assumption. No algorithm change needed unless the integration is broken.

---

## Problem 4: Capability Registry Scaling (NL→Capability Mapping)

**Domain**: Capability registry, NLCL, taxonomy, seeds-as-truth
**Severity**: MEDIUM — The unified capability entry point (`/api/interpret`) maps natural language phrases to capability IDs via the NLCL catalog (`src/engines/nlcl/catalog.ts`) and the DB. Era 5-6 enforced CLI/API/MCP parity, but the mapping itself may not scale as the capability count grows (currently 459 engines at HEAD, was 341 at v0.1.0). The fallback parser chain (per-provider → generic → system) also affects how capabilities resolve.

**Current state**: `catalog.ts` contains NL patterns (e.g., `"send message to <provider>"`) mapped to capability IDs. Each provider declares `fallback` (parser name of the next tier). `ProviderRegistrar` reads this during registration and builds the `fallbackParserId` chain. Capability execution proceeds via `CapabilityEngine` → `CapabilityResolutionEngine` → `CapabilitySnapshot`.

**SOTA research directions**:
- **Taxonomy generation** from the seed provider manifests: can the system auto-generate the NL→capability mapping from provider declarations?
- **Fallback chain optimization**: the current chain is `provider/001 → generic/001 → system/001`. Research into RRF (Reciprocal Rank Fusion) or learned rankers for parser selection.
- **Confidence-aware mapping**: the parser system returns `getConfidence(rawBody)` — research into calibrating confidence thresholds for NL→capability routing.
- **Semantic vs lexical search** for capability discovery: as the catalog grows, keyword search may be insufficient; research into embedding-based capability search (e.g., `nomic-embed-text` at `localhost:11434`).

**Leading approaches**:
- `elasticsearch` or `opensearch` for capability catalog search.
- `fossil` or `fawkes` for NL→intent mapping.
- Embedding-based search with `nomic-embed-text` local inference.

**Maturity**: LOW-MEDIUM — the catalog is small enough (459 entries) that lexical search works, but scaling to 1000+ may require structural changes.

**Decision**: **Research embedding-based capability catalog search** as a supplementary lookup alongside the existing NL→capability patterns. If performance degrades beyond a threshold, introduce the indexed search. No immediate change needed.

---

## Problem 5: Cross-Boundary Storage Layer Correctness (Dual SQLite)

**Domain**: Storage engine, data boundaries, system/user separation
**Severity**: MEDIUM — The dual-DB split (Era 4) enforces that system metadata (providers, capabilities, routing, telemetry, health, config) lives in `prisma/system/` and user data (conversations, nodes, memory, sessions) in `prisma/user/`. The cross-boundary storage layer (`src/storage/snapshot.ts`, `src/storage/cross-boundary-cache.ts`, `src/storage/db-health.ts`, `src/storage/cross-boundary-store.ts`) must enforce that engine code declares which boundary it touches.

**Current state**: The storage layer provides `crossBoundarySnapshot()`, `readUserData()`, `readSystemData()`, and a per-engine contract that code touching user data must declare the boundary. Commit `11e6458` removed the accidentally committed generated Prisma client files that had inflated the +362k lines. No later era has formally verified the boundary's correctness under concurrent access.

**SOTA research directions**:
- **Formal boundary verification**: model-checking the cross-boundary contracts (e.g., TLA+ or Coq proofs that no engine can write system data from user context).
- **Migration ordering**: ensuring that seed migrations apply to both `system/` and `user/` DBs in the correct order.
- **Boundary violation detection**: runtime assertions that detect when engine code writes to the wrong DB.
- **Sync strategies**: two-phase commit or outbox pattern for cross-boundary operations.

**Leading approaches**:
- Outbox pattern for cross-DB writes (message queue + consumer).
- TLA+ model checking for simple boundary contracts (feasible for the 2-DB case).
- Runtime assertions + monitoring (lightweight, production-ready).

**Maturity**: LOW — the boundary is enforced by code review and convention, not by formal verification.

**Decision**: **Add runtime boundary violation assertions** in the storage layer (e.g., `ensureSystemDb()` / `ensureUserDb()` guards) and research TLA+ model-checking of the contracts as a future step. No full verification needed immediately.

---

## Problem 6: Tauri V2 Sidecar Binary Size and Startup (Desktop Binary)

**Domain**: Build pipeline, binary size, Tauri, Bun
**Severity**: MEDIUM — The Tauri V2 sidecar is compiled with `bun build --compile` and compressed via UPX `-3 --no-lzma`, yielding ~45.6 MB. The unpinned Bun runtime is ~94 MB. The devops desktop toolkit provides a 5-gate pipeline for building, installing, launching, and testing. The binary size and startup time affect the product's shippability.

**Current state**: Sidecar compressed size: 45.6 MB (UPX Level 3). Uncompressed: ~97 MB (94 MB Bun runtime + ~3 MB app code). The `scripts/tauri/build-sidecar.ps1` provides manual UPX compression. The `bun build --compile` produces a standalone executable that includes the entire Bun runtime.

**SOTA research directions**:
- **Custom Bun runtime** (`bkg` / Bun Packager): LZ4-compressed runtime with custom decompression startup code, targeting ~20% size reduction (76 MB vs 94 MB). Available in Bun canary.
- **Selective bundling**: tree-shaking the Bun binary to include only used modules (`bun build --syntax only` + manual module inclusion).
- **WASM-based approach**: moving non-critical path code into WASM modules loaded at runtime, reducing the embedded runtime footprint.
- **Alternative packagers**: `nexe`, `pkg`, or electron-fiddle patterns for smaller footprints.

**Leading approaches**:
- Bun canary `bkg` packager: ~20% reduction (76 MB), but canary quality varies.
- `nexe` / `pkg`: similar model but may not support Bun's ESM features.
- Manual `imports()`() dynamic imports to split the binary into a small core + lazy-loaded chunks.

**Maturity**: LOW-MEDIUM — the canary `bkg` approach is the most promising but not yet stable.

**Decision**: **Monitor Bun canary `bkg` packager**; if stabilization lands, adopt for the next release. Otherwise, keep current UPX `-3 --no-lzma` pipeline. No immediate binary rewrite needed.

---

## Problem 7: MCP Server/Client Adapter Maturity (MCP integration)

**Domain**: MCP, resource change monitoring, tool discovery, stdio vs HTTP
**Severity**: LOW-MEDIUM — The project has MCP adapters for server and client (spec 017 harness command registry), but the state of the art for embedding MCP in a local-first, offline-capable app may have evolved. The current adapters may not cover all MCP 1.0+ features (resource upgrades, prompt capabilities, proper disconnect/reconnect).

**Current state**: MCP integration present but possibly incomplete relative to the latest MCP specification. The `devops verify-cross-surface` script validates CLI/UI/API parity but does not include MCP surface parity.

**SOTA research directions**:
- **MCP 1.0+ feature compliance**: resource listening, prompt capability, proper disconnect/reconnect/stdin/stdout semantics.
- **Tool discovery and registration**: automated discovery of MCP servers, health checks, and capability negotiation.
- **Offline-first MCP**: adapting MCP for offline-capable scenarios where the server is not reachable.
- **stdio vs HTTP MCP**: evaluating whether the current deployment uses stdio (local process) or HTTP (remote), and which is SOTA for this use case.

**Leading approaches**:
- `model-context-protocol` Python/JS implementations tracking the latest MCP spec.
- `exa-research` / `exa-search` MCP servers for neural search patterns.
- `anthropic` / `openai` MCP-compatible endpoints as reference.

**Maturity**: LOW — MCP is an emerging standard; the project's adapters may lag the latest spec.

**Decision**: **Research MCP 1.0 compliance** of the existing adapters and patch any gaps. If the project does not use MCP extensively, document it as a “future enhancement” and defer.

---

## Problem 8: Provider Protocol Generation (DB→Static TS)

**Domain**: Code generation, static protocol, DB-driven, `bun run gen:protocol`
**Severity**: LOW — `bun run gen:protocol` reads the capability+seed runtime from the DB and produces `__generated__/provider-protocol.ts`, a static TypeScript file that the hot loop can read without DB lookups. The maturity and correctness of this generation has not been formally researched.

**Current state**: The generated protocol is used by the `ProviderRegistrar` to resolve `fallbackParserId` chains and by the `CapabilityResolutionEngine` for capability execution. The `__generated__/` directory is gitignored and regenerated at boot.

**SOTA research directions**:
- **Code generation correctness**: property-based testing of the generated TS against the DB schema (QuickCheck/fast-check).
- **Runtime vs static**: comparing the performance of the generated static protocol vs direct DB lookups.
- **Generation incrementalism**: only regenerating changed parts of the protocol on seed update.

**Leading approaches**:
- `typescript-codegen` / `plop` / `projen` patterns for DB→TS generation.
- `fast-check` property-based testing of generated output.
- `swagger-codegen` / `openapi-generator` patterns (language-agnostic).

**Maturity**: LOW — the generation exists but has not been property-tested or compared against runtime performance.

**Decision**: **Add property-based tests** for the protocol generator (quickcheck-style, validating that generated TS parses the same DB rows as the runtime reader). If the test suite catches discrepancies, fix the generator or switch to runtime-only.

---

## Problem 9: Harness Repair Engine Correctness (LLM payload repair)

**Domain**: LLM payload repair, schema evolution, harness command registry
**Severity**: MEDIUM — The harness repair engine (`HarnessRepairEngine`) uses `repairString`/`repairNumber`/`repairBoolean` helpers with alias remapping, code-fence stripping, trailing-comma fixes, and apostrophe-safe quote balancing. The `HarnessFeedbackCoordinator` escalates retry prompts with exponential backoff. No formal correctness proof exists that the repair helpers never corrupt valid payloads.

**Current state**: The harness command registry (`HarnessCommand` table) contains semver-versioned JSON schemas. The repair engine matches LLM-generated payloads against these schemas and applies the minimal fix. The feedback coordinator ensures prompts do not repeat the same defect.

**SOTA research directions**:
- **Formal verification of repair helpers**: proving that `repairString({aliases})` never alters valid JSON interiors.
- **Schema coverage**: measuring the percentage of common LLM defects covered by the existing JSON schemas.
- **Backoff convergence**: proving that the exponential backoff + diff escalation terminates (never loops forever).

**Leading approaches**:
- Property-based testing with `fast-check` generating random JSON payloads and verifying that repair + schema validation = original payload.
- QuickCheck-style testing in TypeScript/JS.

**Maturity**: LOW — the helpers exist and are used, but their correctness boundaries are undocumented.

**Decision**: **Add property-based tests** for the repair helpers (generate random payloads, apply repair, verify schema validation passes). If the tests reveal false positives/negatives, refine the helpers. No change needed if tests pass.

---

## Problem 10: Provider Fallback Chain Exhaustion (Parser resolution)

**Domain**: Parser system, fallback chains, provider resolution
**Severity**: LOW-MEDIUM — The provider protocol defines a fallback chain per provider: `provider/001 → generic/001 → system/001`. If none of the parsers in the chain can parse the wire format, the system falls back to `system-raw-text` (last-resort raw text, never throws). The chain is exhausted when all three tiers fail. As the number of providers grows, the probability of chain exhaustion may increase.

**Current state**: Each provider manifest in `seeds/providers/manifests.ts` declares a `fallback` parser name. `ProviderRegistrar` builds the `fallbackParserId` chain via 2-pass upsert (`ProviderStore.upsertParser` + `setParserFallback`). The `StreamParserEngine` resolves via the chain; if all fail, `system-raw-text` returns the raw body as text.

**SOTA research directions**:
- **Fallback chain optimization**: RRF (Reciprocal Rank Fusion) ranking of parser candidates instead of fixed ordering.
- **Auto-generated fallback**: can the system auto-detect the wire format and select the best parser, rather than relying on a fixed chain?
- **Parser confidence calibration**: the `getConfidence(rawBody)` function returns a number; research into calibrating thresholds for chain selection.

**Leading approaches**:
- BM25 / lexical ranking of parser candidates against the wire format signature.
- Format detection via heuristics (e.g., check for `[DONE]` terminator → ChatGPT; check for `candidates` → Gemini; check for `type, delta` → Claude SSE).

**Maturity**: MEDIUM — the fixed chain works for the current 6 providers, but may need optimization as providers grow.

**Decision**: **Research format detection heuristics** as a supplementary selector before the fixed chain. If the heuristic correctly identifies the format, it short-circuits the chain and improves confidence. No immediate chain restructuring needed.

---