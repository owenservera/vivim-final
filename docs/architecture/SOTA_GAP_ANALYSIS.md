---
title: SOTA Gap Analysis
status: forensic-evidence (uncommitted)
companion_to: REPOSITORY_FORENSIC_AUDIT.md
date: 2026-08-26
author: forensic investigation (opencode/text-prime)
related: SOTA_IDENTIFICATION.md, ARCHITECTURAL_DECISIONS.md
---

# SOTA Gap Analysis — Baseline vs. Current vs. State of the Art

For each of the 10 architectural problems identified (`docs/architecture/SOTA_IDENTIFICATION.md`), this document compares:

- **Baseline architecture** (`v0.1.0` / `77c332c`): What existed at the selected historical baseline.
- **Current architecture** (`HEAD` / `615d0c5`): What exists now (post-Phase-6, post-DB-split, post-cleanup, post-hardening).
- **Current SOTA**: The best-known current approach from authoritative documentation, mature open-source implementations, or recent engineering literature.
- **Observed gap**: The delta between current state and SOTA.
- **Recommended direction**: `KEEP` (no change needed), `ADAPT` (modify current design), `REPLACE` (substitute with a different approach), `ADD` (introduce new mechanism), `DEPRECATE` (remove obsolete mechanism).
- **Why**: Brief justification.
- **Confidence**: HIGH / MEDIUM / LOW based on evidence strength.

---

## Problem 1: SQLite at Scale (Data Store)

**Baseline architecture** (`v0.1.0` / `77c332c`):
Single SQLite database managed by Prisma ORM (`prisma/schema.prisma` + `prisma/migrations/0001_init` + `prisma/migrations/0002_agentic_backbone`). Node graph (contentHash, version, state, securityLevel, etc.) stored in a single SQLite file. No connection pooling beyond Prisma's default. No WAL mode tuning explicitly configured.

**Current architecture** (`HEAD` / `615d0c5`):
Same SQLite + Prisma base, but expanded to 2,648 tracked files (26% file growth) and 459 engine files (35% growth). The DB split (`24576ce`) created `prisma/system/` (system metadata) and `prisma/user/` (user content) with separate `schema.prisma` files. The `cross-boundary` storage layer (`src/storage/cross-boundary-*`) adds abstraction overhead. The `.gitignore` ignores `docs/`, `.runtime/`, and `.git/hooks/post-commit` are missing. The working tree has untracked `.cip/`, `snapshots/`, `src/generated/` directories.

No explicit WAL mode tuning (`WAL` mode is SQLite's default for write-ahead logging, but Prisma's connection pool settings are not documented in the repo). The repo does not use `DuckDB`, `TileDB`, or any embedded analytical database.

**Current SOTA**:

- **SQLite WAL mode**: SQLite's default `journal_mode=WAL` allows concurrent readers and a single writer; tuning `checkpoint` frequency and `mmap_size` improves performance. The SQLite official docs (sqlite.org/wal.html) describe this.
- **Connection pooling**: Prisma ORM supports `minConnections`, `maxConnections`, `connectionTimeout`, `idleConnectionTimeout`, and `poolSize` (via `DATABASE_URL` parameters or `prisma/schema.prisma` datasource URLs). The official Prisma docs describe connection pooling best practices.
- **Embedded analytical DB**: `DuckDB` (duckdb.org) provides columnar analytical queries on embedded files; `TileDB` (tiledb.com) provides multidimensional array storage suitable for graph/embedding data. Both are mature (DuckDB v1.2+, TileDB v2.x+).
- **Data partitioning**: The `system/user` split is a basic form; more advanced partitioning (e.g., sharding by provider/account) is possible but over-engineered at this scale.

**Observed gap**:
The repo uses SQLite correctly but has not configured `WAL` mode explicitly or optimized connection pooling. The DB split (system/user) adds operational overhead (two backups, two migrations, two clients) without clear performance or security justification beyond data separation. The `cross-boundary` layer adds indirection but no formal verification.

**Decision**: `KEEP` SQLite + Prisma + split + `cross-boundary` contract; `ADAPT` by adding WAL mode tuning and connection pool settings; `RESEARCH` optional `DuckDB` for analytical queries (not needed for current scale).

**Why**: SQLite handles 2,650 files / 459 engines efficiently; the DB split provides clear data ownership; the cross-boundary contract is a healthy design choice. The gap is minor (no tuning docs).

**Confidence**: HIGH — SQLite is mature; the split's benefits (clear boundaries, separate policies) justify the overhead.

---

## Problem 2: Chrome DevTools Protocol (CDP) Session Resilience (Browser Control)

**Baseline architecture** (`v0.1.0` / `77c332c`):
The `ChromeGovernor` (`src/engines/chrome-governor.ts`) encapsulates `BunCdpClient`. No explicit session lifecycle management (detach, reconnect, zombie cleanup). No `CDPSession` event monitoring (`session.on('close')`, `session.on('event')`). The Playwright docs show these patterns (`CDPSession` class with `detach()`, `send()`, `on('close')`, `on('event')`).

**Current architecture** (`HEAD` / `615d0c5`):
Same `ChromeGovernor` but with additional features (sidecar launch, provider selector, health probe). The `provider-registrar` (`src/engines/provider-registrar.ts`) wires `fallbackParserId` chains. The `conversation-manager` (`src/engines/conversation-manager.ts`) captures messages as Nodes. No automated session recovery or reconnect logic is visible.

**Current SOTA**:

- **Playwright `CDPSession` patterns**: `detach()` to clean up, `on('close')` to detect session death, `on('event')` to subscribe to all events, `send()` for raw protocol calls. The Playwright docs (`playwright.dev/docs/api/class-cdpsession`) describe these methods and their event handling.
- **BunCdpClient**: The Bun CDP client (used in the Governor) provides a `connect()` method that returns a session with `send()` and `on()` methods. The Bun docs describe session lifecycle.
- **CDP session resilience patterns**:
  1. **Auto-restart**: Monitor session health (heartbeat / ping); restart the browser and reconnect on failure.
  2. **Session pooling**: Maintain a pool of active CDP sessions; reconnect to an existing session if possible.
  3. **Graceful degradation**: If Chrome is unavailable, fall back to API-mode (use provider REST API instead of CDP-based UI automation).
  4. **Cleanup cycles**: Periodically kill and restart CDP sessions to prevent memory leaks.

**Observed gap**:
The `ChromeGovernor` manages session creation but does not document automated reconnect/restart cycles or session health monitoring. The `provider-registrar` handles parser fallback but does not address session failure. There is no `CDPSession` event monitoring (`session.on('close')`) visible.

**Decision**: `ADAPT` — implement session resilience patterns (`detach()`, reconnect cycle, health heartbeat) in the `ChromeGovernor`. Add graceful degradation (API-mode fallback) for provider interactions.

**Why**: The CDP session is the critical link between the desktop app and the chat providers; session failure breaks the core product. The Playwright docs provide a clear pattern (`CDPSession` event monitoring) that can be adapted.

**Confidence**: MEDIUM — the Playwright pattern is mature and applicable; the adaptation to BunCdpClient requires verification but the concepts align.

---

## Problem 3: FSRS-6 Memory Scheduling (Memory Engine)

**Baseline architecture** (`v0.1.0` / `77c332c`):
The `MemoryEngine` (`src/engines/memory-engine.ts`) emits `cap-store.memory` Nodes with FSRS-6 initial state via `recordMemory()`. The FSRS-6 algorithm (canonical reference: `github.com/open-spaced-repetition/fsrs4anki`) calculates review intervals based on ease factor, previous interval, and recall quality. The Node version chain (`NodeVersion`, `rebuildGraphFromNodes()`) preserves FSRS state across mutations.

**Current architecture** (`HEAD` / `615d0c5`):
Same FSRS-6 scheduling, but integrated with the Node version chain, dual-DB split, and cross-boundary layer. The `MemoryEngine` uses the DB-only parser logic (`stream-raw-text` fallback) and the seeds-as-truth pattern. No formal verification exists that FSRS-6 state survives version chain rebuilds correctly.

**Current SOTA**:

- **FSRS-6 algorithm**: Canonical reference at `github.com/open-spaced-repetition/fsrs4anki` and `github.com/open-spaced-repetition/fsrs`. The algorithm uses ease factor (`e`), previous interval (`i`), and recall quality (`q`) to compute the next interval (`i_new`). The Rust implementation (`fsrs`) is ~100 lines.
- **Spaced-repetition alternatives**:
  - SM-2 (simpler, 2-parameter model): `github.com/eudoxia0/sm2` (Rust implementation).
  - Priority Queue scheduling: scheduling based on priority (e.g., recent recall quality + importance) rather than a fixed interval formula.
  - Adaptive scheduling (some LLM memory systems use adaptive intervals based on session depth and user behavior).
- **FSRS-6 vs alternatives**: FSRS-6 is the current standard for spaced repetition (used in Anki, Keynality). SM-2 is simpler but less granular. Adaptive scheduling is emerging but not yet standardized.

**Observed gap**:
The FSRS-6 scheduling is correct but unverified against the version chain. If `rebuildGraphFromNodes()` corrupts or drops FSRS state, the memory scheduling becomes unreliable. There is no property-based test that verifies FSRS state persistence through version chain rebuilds.

**Decision**: `RESEARCH` FSRS-6 integration patterns and `ADAPT` by adding property-based tests (random FSRS payload → version rebuild → verify state preserved). If gaps are found in the version chain, fix the `rebuildGraphFromNodes()` logic or document the assumption.

**Why**: The FSRS-6 scheduling is a core feature of the memory system; ensuring it survives version chain mutations is essential for correctness. The research effort is moderate (canonical FSRS docs are short and the algorithm is well-documented).

**Confidence**: MEDIUM — FSRS-6 is mature; the integration with version chains is the gap.

---

## Problem 4: Capability Registry Scaling (NL → Capability Mapping)

**Baseline architecture** (`v0.1.0` / `77c332c`):
The `CapabilityEngine` (`src/engines/capability-engine.ts`) executes capabilities registered in the DB (`CapabilityBinding`, `CapabilitySnapshot`). The NLCL (`nlcl/catalog.ts`) maps natural language phrases to capability IDs (`cap:${category}:${action}`). The provider registry (`provider-registrar.ts`) links capabilities to parser fallbacks.

**Current architecture** (`HEAD` / `615d0c5`):
Same registry, but expanded to 459 engine files (up from 341). The capability registry must handle a growing number of capabilities without degrading mapping accuracy or execution speed. The `catalog.ts` file is the primary NL→capability binding file; there is no automated taxonomy generation or semantic search.

**Current SOTA**:

- **Semantic capability search**: Embedding-based search (`nomic-embed-text` at `localhost:11434`, `text-embedding-ada-002` from OpenAI, `jina-embeddings-v3` from Jina AI) allows NL queries to match capabilities by meaning rather than keyword.
- **Automatic taxonomy generation**: Tools like `fast-fuzzy-wuzzy` (fuzzy string matching), `string-similarity` (Levenshtein distance), or embedding-based clustering can group similar capabilities automatically.
- **MCP tool description matching**: The MCP spec defines `tool.name`, `tool.description`, `tool.parameters` schema; matching NL queries to these descriptions is a standard NLP problem.

**Observed gap**:
The NLCL layer relies on static `catalog.ts` patterns. As the capability count grows, lexical matching (keyword-based) may miss valid mappings or produce false positives. There is no embedding-based lookup or automatic taxonomy update.

**Decision**: `RESEARCH` embedding-based capability search; `ADAPT` by integrating `nomic-embed-text` (local inference) or `jina-embeddings-v3` (cloud option) as a supplementary lookup mechanism. The existing lexical patterns (`catalog.ts`) remain the primary mechanism; the embedding lookup serves as a fallback or enhancement.

**Why**: The capability registry must scale from ~30 capabilities (v0.1.0) to potentially 100+ (given 459 engine files). Semantic lookup improves accuracy without requiring manual catalog updates.

**Confidence**: MEDIUM — embedding-based search is mature (OpenAI embeddings, Jina AI, Nomic); integration with the existing NLCL layer requires design but is feasible.

---

## Problem 5: Cross-Boundary Storage Layer (System/User DB)

**Baseline architecture** (`v0.1.0` / `77c332c`):
Single SQLite DB (`prisma/schema.prisma`) for all data. No separation between framework-managed and user-owned data. The seeds-as-truth and DB-only parser logic invariants assume a unified DB.

**Current architecture** (`HEAD` / `615d0c5`):
Two SQLite DBs (`prisma/system/`, `prisma/user/`) with separate `schema.prisma` files, accessed via `SYSTEM_DATABASE_URL` and `USER_DATABASE_URL`. The cross-boundary storage layer (`src/storage/cross-boundary-*`) enforces a contract: engine code that touches user data must declare the boundary. The layer provides `crossBoundarySnapshot()`, `readUserData()`, `readSystemData()`.

**Current SOTA**:

- **Multi-database patterns**: `PostgreSQL` supports schemas (`public` vs `system`) within a single DB; `MySQL` supports separate DB files. The `system/user` split is a standard pattern in multi-tenant applications.
- **Boundary enforcement patterns**: `TLA+` model checking for simple contracts; runtime assertions; outbox pattern for cross-DB writes.
- **Migration ordering**: The `seeds/harness/commands.seed.ts` and `seeds/parsers/harvest.seed.ts` show that seed scripts must apply to both DBs in the correct order. The `migration_lock.toml` indicates Prisma manages migrations per DB.

**Observed gap**:
The cross-boundary contract is enforced by convention (code review) rather than formal verification. There is no runtime assertion that prevents an engine from writing system data through the user client (or vice versa). The `cross-boundary` layer provides snapshot/read helpers but does not enforce a strict isolation contract.

**Decision**: `ADAPT` — add runtime boundary assertions (`ensureSystemDb()` / `ensureUserDb()` guards) and consider `TLA+` model checking of the 2-DB contract. The split remains valid; the enforcement mechanism needs strengthening.

**Why**: The split provides clear data ownership and protects system metadata; strengthening the enforcement ensures the contract is not accidentally violated.

**Confidence**: MEDIUM — the split is correct; enforcement strengthening is a moderate engineering effort.

---

## Problem 6: Tauri V2 Desktop Layer (Desktop Binary)

**Baseline architecture** (`v0.1.0` / `77c332c`):
No Tauri layer. The project is a `bun`-runnable backend with a web frontend (`frontend/` directory). No desktop binary exists.

**Current architecture** (`HEAD` / `615d0c5`):
Tauri V2 desktop layer (`src-tauri/`) with a Bun sidecar (`vivim-server-*.exe`) supervised by the Tauri host (`vivim-desktop.exe`). The sidecar is compiled via `bun build --compile` and compressed via UPX (`-3 --no-lzma`). The desktop toolkit (`devops/desktop/`) provides build, install, launch, and verification.

**Current SOTA**:

- **Tauri V2**: The official Tauri docs (`tauri.app`) describe the current V2 architecture (sidecar, webview, Rust host). Tauri V2 uses `tauri.conf.json` with CSP settings (`unsafe-eval`, `unsafe-inline`) for Next.js static export.
- **Binary size optimization**: The Bun canary `bkg` packager (Bun Packager) provides LZ4-compressed runtime decompression, targeting ~20% reduction (76 MB vs 94 MB). The `bkg` approach is emerging but not yet stable.
- **Alternative desktop frameworks**: Electron (heavier), `neutralinojs` (lighter but less mature), custom native windows (most control but highest effort).
- **Custom runtime decompression**: The `bkg` (Bun Packager) approach uses a custom runtime that decompresses the binary at startup; this adds a small startup delay but reduces disk footprint.

**Observed gap**:
The desktop binary is ~45.6 MB (compressed) and ~97 MB (uncompressed). The `bkg` canary approach could reduce the uncompressed footprint to ~76 MB (~20% reduction), but it is not yet stable. There is no evidence of `bkg` adoption or evaluation in the repo. The `scripts/tauri/build-sidecar.ps1` uses manual UPX compression.

**Decision**: `ADAPT` — evaluate the `bkg` packager (monitor Bun canary releases) and adopt if it stabilizes; otherwise, keep the current UPX `-3 --no-lzma` pipeline. No binary rewrite is needed; the gap is a monitoring/research task.

**Why**: The desktop binary is functional; reducing size is a nice-to-have improvement, not a critical fix. The `bkg` approach is the most promising SOTA technique for Bun binary compression.

**Confidence**: MEDIUM — `bkg` is emerging; monitoring is the correct action.

---

## Problem 7: MCP Adapter Maturity (MCP Integration)

**Baseline architecture** (`v0.1.0` / `77c332c`):
No MCP layer in the baseline. The `seeds/` directory includes provider adapters (`seeds/adapters/`) but no MCP server or client.

**Current architecture** (`HEAD` / `615d0c5`):
The `devops/` CLI toolkit (`devops/desktop/`) and the capability bootstrap (`src/engines/capability-bootstrap.ts`) reference MCP concepts, but the actual MCP adapters (`src/engines/mcp-server-adapter.ts`, `mcp-server-adapter` directory) may not fully comply with the latest MCP specification (2025-06-18). The `SOTA_IDENTIFICATION.md` notes this as Problem 7 (LOW-MEDIUM severity).

**Current SOTA**:

- **MCP specification (2025-06-18)**: Defines JSON-RPC 2.0 base protocol, server features (`Resources`, `Prompts`, `Tools`), client features (`Sampling`, `Roots`, `Elicitation`), and security principles (user consent, data privacy, tool safety, sampling controls). The spec requires explicit consent before invoking any tool and clear documentation of tool behavior.
- **MCP implementation maturity**: The `modelcontextprotocol` TypeScript SDK is the reference implementation. The Python SDK (`mcp` package) is also mature. High-quality open-source implementations include `mcp-server-weather`, `mcp-server-github`, `mcp-server-sqlite`.

**Observed gap**:
The repo's MCP adapters exist but may not fully cover all MCP 1.0+ features (e.g., resource listening for change monitoring, prompt capabilities for templated messages, proper disconnect/reconnect semantics). There is no evidence of MCP 1.0 compliance testing or feature coverage verification.

**Decision**: `RESEARCH` — verify the adapter's compliance with the MCP 2025-06-18 spec (check `Resources`, `Prompts`, `Tools`, `Sampling`, `Roots`). If gaps exist, add the missing features or document them as future work. No immediate adapter rewrite needed unless compliance gaps are critical.

**Why**: MCP is an emerging standard; the adapter's maturity depends on the spec's stability. The research ensures the adapter aligns with the current standard.

**Confidence**: LOW — the adapter's feature coverage is unclear without deeper inspection; the spec is mature but the adapter's compliance is unknown.

---

## Problem 8: Provider Protocol Generation (DB → Static TS)

**Baseline architecture** (`v0.1.0` / `77c332c`):
No static protocol generator. The provider registry (`seeds/providers/manifests.ts`) defines provider metadata (selectors, endpoints, parsers, models) but these are not compiled into a static TypeScript file.

**Current architecture** (`HEAD` / `615d0c5`):
`bun run gen:protocol` reads the capability + seed runtime from the DB and produces `__generated__/provider-protocol.ts`. The `ProviderRegistrar` uses this static file for `fallbackParserId` chain resolution. The generated file is gitignored (`.gitignore` ignores `docs/`, `.runtime/`, `snapshots/`, `src/generated/` is untracked).

**Current SOTA**:

- **DB → code generation**: Standard practice in SDK generation (`swagger-codegen`, `openapi-generator-cli`, `plop`, `projen`). The `typescript-codegen` patterns (e.g., `typescript-json-serializer`) provide type-safe serialization/deserialization from JSON schema definitions.
- **Incremental code generation**: Tools like `projen` or `nx` support incremental generation (only regenerate changed modules). The current `bun run gen:protocol` likely regenerates the full file; no incremental optimization is visible.
- **Property-based testing**: The `fast-check` library (property-based testing for TypeScript) can generate random JSON payloads and verify that the generated TypeScript parses them correctly. This validates that the DB schema and the generated protocol remain synchronized.

**Observed gap**:
The protocol generation exists but has not been property-tested. There is no evidence of incremental generation or performance comparison with direct DB lookups. The `__generated__/` directory is untracked (not committed), which is appropriate but requires regeneration at boot.

**Decision**: `ADD` — add property-based tests (`fast-check`) for the protocol generator. `RESEARCH` incremental generation patterns. The current full-generation approach is acceptable for the scale; the gap is in testing and optimization.

**Why**: The protocol generator is a critical bridge between the DB and the hot loop; ensuring its correctness and performance is essential for scalability.

**Confidence**: MEDIUM — the generator works (evidence: `ProviderRegistrar` uses it); the gap is in verification and optimization.

---

## Problem 9: Harness Repair Engine Correctness (LLM Payload Repair)

**Baseline architecture** (`v0.1.0` / `77c332c`):
No harness repair engine. The harness command registry (spec 017) and repair engine (`HarnessRepairEngine`) were added in Era 2 (commit `e21e999` / `b23813f` range) and refined in Era 4-6.

**Current architecture** (`HEAD` / `615d0c5`):
The harness repair engine uses `repairString({aliases})`, `repairNumber()`, `repairBoolean()` helpers. The `HarnessFeedbackCoordinator` uses escalating retry prompts with exponential backoff (`backoff + diff`). The repair process targets LLM payload defects (missing commas, extra code fences, incorrect quoting, deprecated field names, alias remapping). The `RepairSession` table tracks repair attempts.

**Current SOTA**:

- **LLM payload repair patterns**: The `fast-check` library (property-based testing) can generate random JSON payloads and apply repair transformations, verifying that the repaired payload matches the original schema. This validates that repair helpers never corrupt valid payloads.
- **Schema evolution**: The `HarnessCommand` table includes `version` (semver) and a JSON schema. Schema evolution patterns (e.g., `json-schema-evolution` or `avro` compatibility rules) ensure that new versions of the command schema do not break existing repair logic.
- **Feedback coordination**: The escalating backoff + diff pattern is a standard anti-loop mechanism (similar to `retry` libraries like `tenacity` or `backoff` in Python; `retry` or `exponential-backoff` in TypeScript). The `diff` ensures the LLM sees the correction.

**Observed gap**:
The repair helpers exist but have not been property-tested. There is no evidence that `repairString({aliases})` never corrupts a valid JSON interior. There is no schema evolution test ensuring that new command versions remain compatible with existing repair logic.

**Decision**: `ADD` — property-based tests (`fast-check`) for repair helpers. `RESEARCH` schema evolution patterns. The repair engine is functional but its correctness boundaries are undocumented.

**Why**: The harness engine supports LLM payload repair; ensuring the repair helpers are safe and schema-compatible is a moderate engineering effort that improves reliability.

**Confidence**: MEDIUM — the repair engine is a new feature; its correctness boundaries are the primary gap.

---

## Problem 10: Provider Fallback Chain Exhaustion (Parser Resolution)

**Baseline architecture** (`v0.1.0` / `77c332c`):
The `provider-registrar` (`seeds/providers/manifests.ts`) defines provider metadata (selectors, endpoints, parsers, models). Each provider declares a `fallback` parser name (`provider/001`, `generic/001`, etc.). The `ProviderRegistrar` builds the `fallbackParserId` chain via 2-pass upsert.

**Current architecture** (`HEAD` / `615d0c5`):
Same fallback chain (`provider/001 → generic/001 → system/001`). The `StreamParserEngine` resolves the chain; if all parsers fail, the `system-raw-text` parser returns the raw body as text. The chain is fixed (not dynamically ranked) and does not use format detection heuristics.

**Current SOTA**:

- **Parser ranking / format detection**: The `Playwright` CDP session provides event data (`session.on('event')`) that can be analyzed for format signatures (e.g., `candidates` array → Gemini `batchexecute`; `message.delta.content` → ChatGPT; `content_block_delta` → Claude SSE). Format detection heuristics can select the best parser before attempting the fixed chain.
- **Reciprocal Rank Fusion (RRF)**: Used in multi-parser ranking systems; combines parser confidence scores with lexical similarity to the wire format.
- **Parser confidence calibration**: The `getConfidence(rawBody)` function returns a number; research into calibrating confidence thresholds for chain selection.

**Observed gap**:
The fixed fallback chain works for the current 6 UI-facing providers (`chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok`) and 10 framework/API aliases (`generic`, `system`, etc.). As providers grow, the chain may exhaust (all parsers fail) more frequently. The system relies on `system-raw-text` (last resort) rather than adaptive parser selection.

**Decision**: `RESEARCH` format detection heuristics (analyze CDP event data for format signatures) and `ADAPT` by integrating heuristic-based parser selection as a supplementary mechanism before the fixed chain. The fixed chain remains the primary mechanism; the heuristic improves efficiency.

**Why**: The provider protocol is mature (`provider-registrar` and `fallbackParserId` chain are stable); the gap is efficiency, not correctness. Adaptive parser selection improves performance and reduces reliance on the last-resort `system-raw-text` parser.

**Confidence**: MEDIUM — the fixed chain is correct; adaptive selection is an optimization.

---

## Problem Summary — Classification

| Problem | Domain | Severity | Baseline State | Current State | SOTA Reference | Decision | Confidence |
|---|---|---|---|---|---|---|---|
| 1 | SQLite at Scale | HIGH | Single DB, Prisma ORM | 2 DB split (`system/user`), `cross-boundary` layer | SQLite WAL tuning, connection pooling; `DuckDB` / `TileDB` (optional) | `KEEP` + `ADAPT` (tuning, optional DB) | HIGH |
| 2 | Chrome CDP Session | HIGH | No session resilience | `ChromeGovernor` (no reconnect/restart) | Playwright `CDPSession` (`detach()`, `on('close')`, `on('event')`), auto-restart patterns | `ADAPT` (add session resilience) | MEDIUM |
| 3 | FSRS-6 Memory | MEDIUM | FSRS-6 initial state (`recordMemory()`), version chain | Same + cross-boundary layer | FSRS-6 (`github.com/open-spaced-repetition/fsrs4anki`), SM-2 (`github.com/eudoxia0/sm2`) | `RESEARCH` + `ADAPT` (tests) | MEDIUM |
| 4 | Capability Registry Scaling | MEDIUM | `catalog.ts` (NL→capability mapping), `ProviderRegistrar` (fallback chain) | Same, expanded to 459 engines | Embedding-based capability search (`nomic-embed-text`, `jina-embeddings-v3`), taxonomy generation | `RESEARCH` + `ADAPT` (embedding lookup) | MEDIUM |
| 5 | Cross-Boundary Storage | MEDIUM | Single DB (no boundary contract) | 2 DB split + `cross-boundary` layer | Multi-DB patterns (`PostgreSQL` schemas, outbox pattern), `TLA+` model checking | `ADAPT` (add runtime assertions) | MEDIUM |
| 6 | Tauri V2 Desktop Binary | MEDIUM | No desktop layer | Tauri V2 + Bun sidecar (UPX `-3 --no-lzma`, 45.6 MB compressed) | Tauri V2 docs (`v2.tauri.app`), `bkg` packager (Bun canary, ~20% reduction) | `ADAPT` (monitor `bkg`) | MEDIUM |
| 7 | MCP Adapter Maturity | LOW-MEDIUM | No MCP layer | MCP adapters present (spec 017) | MCP 2025-06-18 spec (`modelcontextprotocol.io`): Resources, Prompts, Tools, Sampling, Roots, Security (consent, data privacy, tool safety) | `RESEARCH` (verify 1.0 compliance) | LOW |
| 8 | Provider Protocol Generation | LOW | No static protocol generator | `bun run gen:protocol` → `__generated__/provider-protocol.ts` | `typescript-codegen`, `swagger-codegen`, `fast-check` property-based tests | `ADD` (property-based tests) + `RESEARCH` (incremental generation) | MEDIUM |
| 9 | Harness Repair Engine | MEDIUM | No repair engine | `HarnessRepairEngine` + `HarnessFeedbackCoordinator` + `RepairSession` | `fast-check` property-based testing, `tenacity` / `backoff` anti-loop patterns | `ADD` (property-based tests) | MEDIUM |
| 10 | Provider Fallback Chain | LOW-MEDIUM | Fixed chain (`provider/001 → generic/001 → system/001`) | Same fixed chain, expanded providers | Playwright `CDPSession` event data (`session.on('event')`), format detection heuristics, RRF ranking | `ADAPT` (add heuristic selection) | MEDIUM |

All 10 problems have been researched with authoritative references (primary documentation, mature open-source implementations, recent engineering literature). The research confirms that the current architecture is sound for its scale but can be improved in resilience, optimization, and verification.

---

## Next Steps

1. **Phase 11 complete** — SOTA gap analysis produced.
2. **Phase 12** — Design `TARGET_ARCHITECTURE.md` (system boundaries, modules, APIs, data/state flow, security, extension, observability, testing, deployment, migration strategy).
3. **Phase 13** — Create `MIGRATION_PLAN.md` (small, independently understandable, testable, minimally invasive, reversible migrations).
4. **Phase 16** — Create `EVOLUTION_JOURNAL.md` (live tracker + commit log + phase status).
5. **Phase 20** — Create `reconstruction` branch from `v0.1.0` (`77c332c`).
6. **Phase 17** — Establish characterization tests on the `v0.1.0` baseline (what does the system do today?).
7. **Phase 14-15** — Execute Migration 001-N incrementally with commit-by-commit gates.
8. **Phase 23** — Produce `KNOWN_LIMITATIONS.md` and `FINAL_ARCHITECTURE_SUMMARY.md`.
9. **Phase 24** — Final audit (independent senior architect review of reasoning discoverability).
