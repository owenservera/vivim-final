# AUDIT: cap-store v1 Knowledge Graph Rebuild — Merged Design v2

**Audit Date:** 2026-07-09
**Documents Audited:** 20 files (00-08 baseline + SOTA-00 through SOTA-09)
**Scope:** Pure document proposal audit — no codebase review
**Verdict:** SIGNIFICANT structural ambition with critical implementation risks
**Follow-up (2026-07-09):** Cross-document consistency audit found 8 additional gaps (events 12-19 in contradiction resolution). All resolved in merged-design-v2 docs.
**Schema Update (2026-07-09):** Schema now managed via Prisma v6.5 (`prisma/schema.prisma`) instead of raw SQL migrations. CHECK constraints, views, and expression defaults applied via `prisma/seed.sql`. Database: SQLite (`prisma/dev.db`).

---

## EXECUTIVE SUMMARY

This proposal is a **complete rewrite** of cap-store from 42 incremental migrations + hardcoded provider logic into a knowledge-graph architecture with 30 engines, ~82 tables, and 10 phases. The baseline v1 (9 core engines, 54 tables, 6 phases) is internally consistent but aggressive. The SOTA v2 layer (17 additional engines, ~28 new tables, 4 more phases) introduces scope creep that threatens the viability of the entire project.

**Core tension:** The proposal tries to simultaneously be (a) a clean rebuild, (b) a production system, and (c) a research platform. These goals conflict.

---

## SECTION 1: ARCHITECTURAL SOUNDNESS

### 1.1 Governor Canon (P2) — STRONG

The "single I/O authority" principle is the best decision in the entire proposal. Centralizing all CDP access through `ChromeGovernor` with 4 subsystems (LifecycleManager, CDPProxy, TraceLog, HealthMonitor) is architecturally clean. It solves a real problem (5+ files importing `BunCdpClient` directly) and enables testability via mock.

**Concern:** The Governor becomes a god object. Its public API has 12+ methods, plus `cdp` sub-object with 6 methods, plus internal subsystems. If any subsystem has a bug, the entire I/O layer is affected. Consider whether the Governor should be decomposed into smaller, composable units that share a mutex pool.

### 1.2 8-Step ConversationManager — DEFENSIBLE BUT RIGID

The `RESOLVE→LOCK→ENSURE→SEND→CAPTURE→PARSE→STORE→EMIT` pipeline is clean and testable. Each step has explicit timeout budgets. The pipeline is linear, which makes debugging straightforward.

**Concern:** This pipeline assumes every send follows the same path. What about:
- Streaming sends where you want progressive block delivery mid-pipe?
- Capability execution that bypasses the "send a message" flow entirely?
- Workflow execution that needs multi-step orchestration within a single "send"?

The pipeline is too rigid for the SOTA vision. SOTA-01 and SOTA-09 acknowledge this by "wrapping" the pipeline, but wrapping adds indirection that makes the system harder to reason about.

### 1.3 Capability Resolution 3-Layer Override Chain — ELEGANT BUT COMPLEX

Global defaults → plan tier overrides → provider overrides is a well-understood pattern (like CSS specificity). The SQL query in `04-merged-engines.md` §6 is a monster (~70 lines of COALESCE/CASE) but it's correct and auditable.

**Concern:** The `provider_capability` table has 18 override columns (`ui_component_override`, `ui_label_override`, etc.). This is a denormalized approach that works for resolution speed but creates maintenance burden. Every new UI field requires adding an override column. The `capability_taxonomy` table already has 30+ columns; adding 10 vCode-pattern columns pushes it toward 40 columns.

### 1.4 Engine Count: 13 → 30 — CRITICAL RISK

The v1 proposal has 13 engines. The SOTA v2 adds 17 more, totaling 30. This is a **red flag**.

**Why this matters:**
- Each engine needs: store contract, store impl, types, tests, documentation
- 30 engines × ~4 files each = ~120 engine files
- Integration surface: 30 engines that need to compose correctly
- Test surface: 30 engine unit tests + integration tests between them

**The proposal estimates ~120 tests total.** This is wildly optimistic for 30 engines. A realistic count would be 300-500 tests (10-15 per engine for unit tests, plus integration tests).

### 1.5 Schema: 54 → 82 Tables — CONCERNING

54 tables in v1 is already large for a single-process SQLite system. 82 tables in v2 compounds this.

**Specific concerns:**
- `capability_taxonomy` has 30+ columns. SQLite handles wide tables, but queries become slow without careful indexing.
- 18 new tables in SOTA-07 add layers L14 (Observation) and L15 (Agentic Loop) that have no clear lifecycle ownership.
- The `hpe_session` table stores raw prompts + responses as TEXT. If HPE processes 1000 conversations/day with 10KB prompts, that's 10MB/day of raw text in SQLite.
- `workflow_definition` + `workflow_node` + `workflow_edge` + `workflow_execution` + `workflow_node_execution` is a mini-ORM inside the database. This is reinventing a workflow engine storage layer that already exists in n8n.

---

## SECTION 2: INTERNAL CONTRADICTIONS

### 2.1 Streaming: Batch vs Progressive

- `01-merged-epic.md` §"What Changes": "Batch-after-capture for v1"
- `02-merged-architecture.md` §Streaming Scope: "No `conversation:block` WS events"
- `sota-00-master-index.md` §P5: "**Real-time streaming is now wired.** `conversation:block` events restored."
- `sota-01-priority-pipe-mirror.md` §Architecture: Shows progressive streaming as core

**Resolution in docs:** SOTA supersedes v1 on conflict. But this means the v1 implementation plan (6 phases, batch-only) is obsolete before it starts. An implementer reading the docs sequentially would build batch-only in phases 1-6, then rip it out in phase 7. This is wasteful.

**Recommendation:** Either commit to progressive streaming from phase 1, or explicitly mark SOTA-01/SOTA-07 streaming as a separate project.

### 2.2 HarnessRuntime: DAG vs Agentic Loop

- `02-merged-architecture.md` §P9: "HarnessRuntime executes multi-step capability DAGs"
- `sota-00-master-index.md` §P9: "The DAG is one execution mode; the loop is the other"
- `sota-09-harness-protocol-engine.md` §3: HPE routes to `AgenticLoopEngine` OR `ChromeGovernor.cdp.executeHarnessPlan()`

**Problem:** The HarnessRuntime is defined in v1 as a DAG executor inside Chrome's page context. The SOTA adds an agentic loop that also runs inside Chrome. These are two different execution models for the same runtime. The document doesn't clarify how they coexist:
- Does the HarnessRuntime have a mode switch (DAG vs loop)?
- Does the agentic loop replace the DAG executor?
- Can a single execution use both?

### 2.3 Provider Registration: Seeds vs Auto-Discovery

- `02-merged-architecture.md` §P3: "Seeds Not Code — All provider configuration is seed files"
- `sota-00-master-index.md` §P3: "Seeds are now one of three registration paths, not the only one"

**Problem:** P3 is listed as a core principle in both v1 and v2, but the v2 version contradicts the v1 version. An implementer following v1 principles would build a seed-only system. The SOTA then says "actually, you also need auto-discovery and self-describing protocols."

### 2.4 Table Count Discrepancy

- `00-merged-index.md` §D2: "~54 tables total"
- `03-merged-schema.md` §Table Count Summary: "~54 tables"
- `sota-00-master-index.md` §Schema Delta: "~28 new tables. Total v2: ~82 tables"
- `sota-08-implementation-glossary-delta.md` §Part D: "Tables: ~54 (v1) → ~81 (v2)"

The v2 total is listed as both 81 and 82. Minor, but indicates imprecision in counting.

---

## SECTION 3: IMPLEMENTATION FEASIBILITY

### 3.1 Phase Plan: 10 Phases — AMBITIOUS

The v1 plan has 6 phases. SOTA adds 4 more (phases 7-10). Total: 10 phases.

**Concerns:**
- Phase 1 alone creates ~30 files (schema types, storage contracts, storage impls, tests)
- Phase 3 ports ~16 files and deletes ~16 files — this is a large refactor
- Phase 4 creates ~30 files (engines, parsers, harness modules, tests)
- Phase 7 creates the MirrorEngine + ObservationTap — this alone is a complex project

**The proposal estimates file counts but not effort.** A rough estimate:
- Phase 1: 2-3 days (schema + storage is mechanical)
- Phase 2: 1-2 days (seeds + registrar is straightforward)
- Phase 3: 5-7 days (Governor + ConversationManager is the hardest phase)
- Phase 4: 3-5 days (engines are well-specified)
- Phase 5: 3-4 days (API + SDK + CLI is boilerplate)
- Phase 6: 2-3 days (cleanup + E2E)
- Phase 7: 5-7 days (MirrorEngine is complex)
- Phase 8: 3-5 days (discovery + shapes)
- Phase 9: 5-7 days (agentic loop + grounding)
- Phase 10: 5-7 days (workflows + memory + MCP)

**Total: 34-50 days of focused implementation.** This is a 2-3 month project for a single developer, or 3-4 weeks for a small team. The proposal doesn't acknowledge this timeline.

### 3.2 Test Coverage: ~120 Tests — WILDLY OPTIMISTIC

The proposal estimates ~120 tests total for 13 engines (v1). With SOTA adding 17 more engines, the realistic count is:

- 13 v1 engines × 10 tests each = 130 unit tests
- 17 SOTA engines × 8 tests each = 136 unit tests
- 25+ API endpoints × 2 tests each = 50 integration tests
- 10+ E2E scenarios = 10 E2E tests
- Storage contract tests = 20 tests

**Realistic total: ~350 tests.** The proposal's 120 is off by 3x.

### 3.3 HarnessRuntime Inside Chrome — UNPROVEN

The HarnessRuntime executes inside Chrome's page context via `Page.addScriptToEvaluateOnNewDocument`. It receives DAGs via `Runtime.evaluate` and executes them.

**Concerns:**
- Chrome's page context is sandboxed. The harness can't access Node.js APIs, file system, or network directly.
- The harness modules use `zod/v4` for validation — but zod is a Node.js library. How does it work inside Chrome's page context?
- The `composer.module.ts` uses `document.execCommand('insertText')` — this is deprecated and doesn't work in all contexts.
- Shadow DOM penetration (SOTA-05) requires `element.shadowRoot` access, which may be blocked by cross-origin policies.
- The harness contract shows `ctx.intercept(pattern)` for network interception — this requires CDP-level `Fetch.enable`, not page-level JavaScript.

**Critical question:** Is the HarnessRuntime actually a CDP-injected script, or is it a Node.js process that communicates with Chrome via CDP? The documents are ambiguous.

### 3.4 HPE (SOTA-09) — OVERENGINEERED

The Harness Protocol Engine adds a bidirectional LLM↔harness bridge with 3 subsystems (PromptAugmenter, ResponseExtractor, ActionRouter). It intercepts the ConversationManager at 2 points and adds 2 new tables.

**Concerns:**
- HPE adds latency to every send (prompt augmentation) and every capture (response extraction). The proposal claims <5ms augmentation and <200ms extraction, but these are optimistic.
- The `llm_repair` strategy calls an external LLM to fix malformed JSON. This is a network call with variable latency. The proposal exempts it from the 200ms budget, but it's the most interesting strategy.
- HPE stores raw prompts and responses in `hpe_session`. This is a data retention liability.
- HPE validates actions against the capability registry. But the capability registry is populated by seeds. If a capability doesn't exist in the seed, HPE rejects it. This means HPE can only work with pre-registered capabilities — it can't handle novel LLM responses.

---

## SECTION 4: SCOPE CREEP ANALYSIS

### 4.1 The "Kitchen Sink" Problem

The SOTA documents add features that are individually reasonable but collectively overwhelming:

| Feature | Complexity | Dependencies |
|---------|-----------|-------------|
| MirrorEngine (real-time sync) | High | Governor, EventBus, Frontend |
| Auto-Discovery | High | Governor, LLM, ShapeRegistry |
| Self-Describing Protocol | Low | HTTP fetch + validation |
| Agentic Loop | Very High | LLM, Governor, MemoryEngine |
| Visual Workflow Engine | Very High | Compiler, Execution, Human-in-the-loop |
| Semantic Grounding | High | A11y tree, Screenshots, LLM |
| Selector Healer | Medium | LLM, Selector strategies |
| Memory Engine | High | Episodic/Semantic/Procedural stores |
| Transfer Accelerator | Medium | Memory, Cross-provider analysis |
| Progressive Streaming | Medium | CDP, Parser, WebSocket |
| MCP Server | Medium | MCP protocol, Governor |
| MCP Client | Medium | MCP protocol, External servers |
| Harness Protocol Engine | High | PromptAugmenter, ResponseExtractor, ActionRouter |

**Total: 13 new capabilities on top of 13 v1 engines.** This is a 2x scope increase.

### 4.2 What Should Be Deferred

Based on priority and dependency analysis:

**Must Ship (v1):**
- ChromeGovernor + ConversationManager (core)
- ProviderRegistrar + Seeds (core)
- CapabilityResolutionEngine (core)
- CapabilityEventBus (infrastructure)
- StreamBlockStore (core)
- REST API + SDK + CLI (core)

**Should Ship (v1.1):**
- RegistrationAuditor + VersionManager + TelemetryAggregator (lifecycle)
- ConfigManager (reprogrammability)
- ExecutionMemoizer (performance)

**Defer to v2:**
- MirrorEngine (complex, requires frontend coordination)
- Auto-Discovery (requires LLM integration)
- Agentic Loop (requires LLM integration)
- Visual Workflow Engine (entire subsystem)
- Semantic Grounding + Selector Healer (requires LLM)
- Memory Engine (requires retention policies)
- Transfer Accelerator (requires memory)
- MCP Server + Client (protocol integration)
- Harness Protocol Engine (requires LLM integration)

**Recommendation:** Ship v1 (13 engines, 54 tables, 6 phases) as a stable foundation. Then ship SOTA features incrementally, each as its own epic.

---

## SECTION 5: SCHEMA CONCERNS

### 5.1 Wide Tables

Several tables have 20+ columns:
- `capability_taxonomy`: 30+ columns (21 UI fields + 10 vCode fields + metadata)
- `provider_capability`: 25+ columns (18 override columns + health metrics)
- `capability_taxonomy_version`: 30+ columns (snapshot of full taxonomy row)
- `provider_health_history`: 20+ columns (aggregated health signals)

**Impact:** Wide tables slow down `SELECT *` queries and increase memory usage. The proposal doesn't discuss query optimization or whether these tables need partial indexes.

### 5.2 JSON-in-TEXT Columns

Despite P6 ("Relational First — No JSON-in-TEXT columns for queryable data"), many tables still use JSON TEXT:
- `provider_definition.fleet_config_json`
- `provider_definition.capabilities_json`
- `provider_definition.models_json`
- `provider_capability.recovery_strategies_json`
- `capability_taxonomy.ui_states_json`
- `capability_taxonomy.depends_on_json`
- `capability_taxonomy.search_hints_json`
- `capability_taxonomy.aliases_json`
- `capability_taxonomy.availability_json`
- `config_entry.config_json`
- `harness_checkpoint.active_dag_json`
- `capability_macro.dag_json`
- `workflow_definition` (entire DAG as JSON)
- Plus ~15 more across SOTA tables

**This contradicts P6.** The proposal claims "No JSON-in-TEXT columns for queryable data" but the schema has 30+ JSON TEXT columns. Some of these are genuinely non-queryable (fleet_config), but others like `models_json` and `depends_on_json` are queried.

### 5.3 Missing Indexes

Some high-traffic tables lack covering indexes:
- `conversation_message`: has `idx_cm_conv` on `(conversation_id, sequence_index)` but no index on `role` for filtering
- `stream_block`: has `idx_sb_conv` and `idx_sb_message` but no index on `created_at` for time-range queries
- `outcome`: has `idx_o_provider`, `idx_o_cap`, `idx_o_ok`, `idx_o_ts` but no composite index for the common query pattern `WHERE provider_id = ? AND capability_id = ? AND ok = ? ORDER BY ts DESC`

### 5.4 Cascade Delete Chains

The FK cascade chains are deep:
```
provider_definition → provider_capability → capability_binding → capability_program → program_version_metric
                                    ↓
                              capability_tier
                                    ↓
                           selector_strategy
                                    ↓
                               outcome
                                    ↓
                         failure_classification
```

Deleting a provider cascades through 6+ tables. This is correct but slow on large datasets. The proposal doesn't discuss vacuum/reindex strategy.

---

## SECTION 6: API DESIGN CONCERNS

### 6.1 Endpoint Count: 25+ — MANAGEABLE BUT GROWING

The v1 API has 25+ endpoints. SOTA adds:
- `POST /api/providers/discover` (auto-discovery)
- `POST /api/providers/register-self-describing`
- Mirror-related WebSocket events
- Workflow CRUD endpoints
- MCP endpoints

Total v2 API could reach 40+ endpoints. The proposal doesn't discuss API versioning or backward compatibility.

### 6.2 Auth Gate: Bearer Token Only

The auth gate is a simple Bearer token check. No RBAC, no per-endpoint permissions, no rate limiting.

**Concern:** The `POST /api/admin/wipe` endpoint destroys all data. It has the same auth level as `GET /api/providers`. In production, admin endpoints need stricter access controls.

### 6.3 Error Envelope: GOOD

The `{ error: string; code: string; details?: unknown }` envelope is clean and consistent. The error mapping table covers all engine errors. This is well-designed.

### 6.4 WebSocket Protocol: UNDERSPECIFIED

The WebSocket events are listed but the subscription model is thin:
- Client subscribes to `entityType` + `entityId`
- Server forwards events matching the subscription
- No heartbeat, no reconnection protocol, no backpressure

**Concern:** What happens when the WebSocket disconnects? Are events buffered? How many? What about the MirrorEngine's observation stream — if the client reconnects, does it get missed events?

---

## SECTION 7: SEED FILE ANALYSIS

### 7.1 Provider Manifests: ADEQUATE

The 7 provider manifests (Claude, ChatGPT, Gemini, DeepSeek, Studio-AI, Z-AI, Qwen) cover the main providers. The JSON schema is complete with all override fields.

**Concern:** The manifests are static. If Claude changes their DOM (new selector for the send button), the manifest is stale. The RegistrationAuditor detects drift, but doesn't auto-heal. This means manual manifest updates are required for every DOM change.

### 7.2 Parser Seeds: FRAGILE

The Claude SSE parser (`001_streaming_sse.ts`) parses `data: ` prefixed SSE lines. It handles `content_block_start`, `content_block_delta`, and `message_stop` events.

**Concerns:**
- The parser doesn't handle `content_block_delta` for non-text blocks (thinking, code). It only appends to the last text block.
- The `detectCompletion` method checks for `message_stop` OR `[DONE]`, but Claude's actual SSE format may differ.
- The Gemini parser (`001_batchexecute.ts`) parses nested JSON arrays. The `detectCompletion` heuristic (checking array length) is fragile.
- The fallback parser returns the entire raw body as a single text block. This is correct but means any parser failure produces unformatted output.

### 7.3 Harness Modules: UNPROVEN

The `composer.module.ts` is a good example but has issues:
- `document.execCommand('insertText')` is deprecated
- The `send` action clicks `[aria-label="Send Message"]` — this selector is Claude-specific
- The module uses `ctx.waitFor(sel, 5000)` — 5 seconds is long for a UI interaction
- No error recovery if the element disappears mid-operation

---

## SECTION 8: TESTING GAPS

### 8.1 No Load Testing

The proposal doesn't mention load testing. With 30 engines and 82 tables, SQLite performance under concurrent access is a real concern. The proposal uses `PRAGMA synchronous = NORMAL` which is fast but risks data loss on power failure.

### 8.2 No Chaos Testing

The proposal mentions circuit breakers and auto-recovery but doesn't test them. What happens when:
- Chrome crashes mid-capture?
- SQLite database is corrupted?
- WebSocket disconnects during a send?
- Two conversations target the same provider simultaneously?

### 8.3 No Migration Testing

The proposal replaces 42 migrations with a single baseline. But what about existing databases? There's no migration path from the old schema to the new one. The `PRAGMA foreign_keys = ON` means existing data can't be migrated without careful orchestration.

### 8.4 E2E Test Coverage: 3 Tests

The proposal lists only 3 E2E tests: `claude-send.test.ts`, `chatgpt-send.test.ts`, `multi-turn.test.ts`. These are manual tests. For a system with 30 engines and 82 tables, E2E coverage should include:
- Concurrent multi-provider sends
- Provider failure and recovery
- Config hot-reload
- WebSocket subscription lifecycle
- Memory retention and cleanup

---

## SECTION 9: DOCUMENT QUALITY

### 9.1 Strengths

- **Consistent terminology.** The glossary is comprehensive and used consistently across all 20 documents.
- **Complete SQL.** The baseline schema is copy-paste ready with all indexes, constraints, and views.
- **Engine interfaces.** Every engine has a full TypeScript interface with store contracts. This is implementable.
- **Dependency graph.** The engine dependency graph is clear and acyclic.
- **Contradiction resolution.** The 11 contradictions in v1 are documented and resolved.

### 9.2 Weaknesses

- **No effort estimates.** File counts are given but not time estimates. An implementer can't plan without knowing effort.
- **No rollback strategy.** If Phase 3 fails, what's the fallback? Can the old codebase continue running?
- **Ambiguous SOTA precedence.** "Where a v1 doc and a SOTA doc conflict, the SOTA doc wins" — but SOTA docs are DRAFT while v1 docs are FINAL. Should implementers wait for SOTA to finalize?
- **No data migration plan.** The proposal deletes 22 tables and creates 18+ new ones. Existing data is lost.
- **Missing cross-references.** SOTA-03 (Agentic Loop), SOTA-04 (Workflow), SOTA-05 (Grounding), SOTA-06 (Memory) are referenced but not fully read in this audit. They may contain additional contradictions.

### 9.3 Missing Documents

- **Deployment guide.** How to deploy this to production? Docker? Direct install?
- **Configuration reference.** What env vars are available? What are the defaults?
- **Troubleshooting guide.** Common failure modes and fixes.
- **Performance benchmarks.** Expected latency for key operations.
- **Security review.** CDP access is powerful — what prevents abuse?

---

## SECTION 10: RECOMMENDATIONS

### 10.1 Immediate Actions

1. **Split v1 and v2 into separate projects.** Ship v1 (13 engines, 54 tables, 6 phases) as `cap-store-v1`. SOTA becomes `cap-store-v2` built on top of v1.
2. **Add effort estimates.** Every phase needs day-level estimates for a single developer.
3. **Resolve the streaming contradiction.** Either build progressive streaming from phase 1, or defer it entirely.
4. **Clarify HarnessRuntime execution context.** Is it Node.js or browser? This affects the entire harness module system.
5. **Add data migration plan.** How to move from old schema to new without data loss.

### 10.2 Design Changes

1. **Reduce engine count.** Merge `ExecutionMemoizer` into `ConfigManager`. Merge `ToolUseProtocol` into `CapabilityEngine`. Target: 25 engines max.
2. **Simplify `capability_taxonomy`.** Split the 30+ column table into `capability_core` (5 columns) + `capability_ui_contract` (21 columns) + `capability_behavior` (10 columns). This improves query performance and maintainability.
3. **Replace JSON TEXT columns with junction tables** for `models_json`, `depends_on_json`, `search_hints_json`. These are queried and should be relational.
4. **Add API versioning.** Use `/api/v1/` prefix. Future breaking changes increment to `/api/v2/`.
5. **Add rate limiting.** The API has no rate limiting. A single client can flood the system.

### 10.3 Testing Improvements

1. **Target 300+ tests** (not 120). 10 tests per engine minimum.
2. **Add load tests.** 10 concurrent conversations, 5 providers, measure throughput.
3. **Add chaos tests.** Kill Chrome mid-capture, corrupt SQLite, disconnect WebSocket.
4. **Add migration tests.** Verify old data migrates cleanly.
5. **Add API contract tests.** Verify SDK types match API responses.

---

## SECTION 11: RISK MATRIX

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Phase 3 (Governor) takes 3x longer than estimated | High | Schedule slip | Build Governor incrementally; start with single-subsystem prototype |
| SOTA scope creep delays v1 ship | Very High | Project never ships | Ship v1 first; SOTA is separate epic |
| HarnessRuntime doesn't work in Chrome page context | Medium | Core feature broken | Prototype early; validate zod in browser context |
| SQLite performance degrades with 82 tables | Medium | Slow queries | Benchmark early; consider PostgreSQL for v2 |
| LLM integration (SOTA-03, SOTA-05, SOTA-09) is unreliable | High | Features don't work | Make LLM optional; fallback to rule-based |
| Auto-discovery produces wrong results | Medium | Broken providers | Require operator approval; confidence thresholds |
| WebSocket protocol is underspecified | Medium | Frontend integration fails | Write WebSocket protocol spec before Phase 5 |

---

## SECTION 12: FINAL VERDICT

### What's Good

The v1 baseline (documents 00-08) is a **solid, implementable design**. The Governor Canon, 8-step pipeline, capability resolution chain, and reprogrammable lifecycle engines are well-thought-out. The schema is complete with proper constraints. The engine interfaces are implementable. The phase plan is sequential and logical.

### What's Problematic

The SOTA v2 layer (SOTA-00 through SOTA-09) transforms a focused rebuild into an ambitious research platform. The 30-engine count, 82-table schema, and 10-phase plan are beyond what a single team should tackle in one project. The contradictions between v1 principles and SOTA supersessions create confusion for implementers.

### Recommendation

**Ship v1 as-is.** It solves the original problems (42 migrations, hardcoded providers, 3 parsing paths, 45+ TS errors). Then evaluate whether the SOTA features are needed based on actual user feedback.

**Do not ship v1 + SOTA together.** The risk of project failure is too high.

---

*Audit completed. 20 documents analyzed. 12 sections of findings. 11 recommendations.*
