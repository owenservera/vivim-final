---
title: Architectural Decisions
status: forensic-evidence (uncommitted)
companion_to: REPOSITORY_FORENSIC_AUDIT.md
date: 2026-08-26
author: forensic investigation (opencode/text-prime)
related: AUDIT_BASELINE_v010_77c332c (annotated tag at `7e6de5a → 77c332c`)
---

# Architectural Decisions — Deep Reasoning Reconstruction

This document reconstructs the probable motivations, trade-offs, and validity of the major architectural decisions in vivim-final's history. Each decision is anchored to specific commits, files, and evidence.

For each decision we answer:

- **Decision**: What was introduced or changed?
- **Evidence**: Which commits, files, or behaviors establish this?
- **Probable motivation**: What problem was the change attempting to solve?
- **Benefits**: What gains did the change provide?
- **Costs**: What liabilities or complexities did it introduce?
- **Assumptions**: Which beliefs were embedded as invariants?
- **What later changed**: How did subsequent eras modify or rely on this?
- **Was the decision still valid?**: Does the decision hold given current state and SOTA?
- **Confidence**: HIGH / MEDIUM / LOW — strength of the inference.

## Decision 1: Atomic Cognitive Unit (ACU) Node Graph (Era 1)

**Decision**: Model every domain object as a Node with properties for provenance (contentHash, version, state, securityLevel, etc.), version chains (NodeVersion), entity aliases (NodeAlias), and weighted edges (NodeEdge). Register all domain-specific shapes (Memory, Acu, Notebook, Note, Bookmark, Artifact, Document, Email) as typed schemas under the `cap-store.*` namespace.

**Evidence**:
- Commit `b23813f`: "feat(node-layer): universal compliant Node DB with ACU/FSRS/version-chain/alias"
- Files: `prisma/schema.prisma` (single SQLite schema with Node model), `seeds/nodes/`, `seeds/capabilities/`, `seeds/parsers/`, `seeds/adapters/`, `src/storage/contracts/node-store.ts`, `src/storage/impl/*`
- Stats: +120,406 / -4,567 lines, 481 files at anchor (vs 81 at seed)

**Probable motivation**: 
The initial seed (`8e3b7c6`) treated persistence as "throwing messages into a DB" with minimal structure. To enable advanced features like spaced-repetition (FSRS-6), provenance tracking, undo/redo, and knowledge graph traversal, a richer data model was necessary. The Node abstraction unifies all domain objects under a common interface, enabling generic algorithms (versioning, linking, security) while allowing shape specialization.

**Benefits**:
- Provides a universal substrate for all knowledge content (messages, memories, bookmarks, etc.).
- Enables time-travel via NodeVersion chains and recovery via rebuildGraphFromNodes().
- Supports FSRS-6 scheduling for memory retention.
- Facilitates entity disambiguation via NodeAlias.
- Allows edges to carry confidence/weight (NodeEdge.weight) for ranking and inference.
- Seeds encode the contract as data, not code, supporting the seeds-as-truth pattern (Invariant 4).
- Big-bang introduction of 341 engines in one transaction stabilized the engine surface for future eras.

**Costs**:
- High initial complexity: 481 files, 120k lines in one commit impairs bisect-ability and obscures fault injection.
- Early tension between contracts and implementations (`src/storage/contracts/*` vs `src/storage/impl/*`) that required later architectural enforcement (Invariant 2).
- Assumption that "every domain object is a Node" may be too broad; if incorrect, the system accumulates unnecessary complexity.
- One-file-per-TypeScript-Node granularity makes bulk imports expensive (debt: Era 1 assumes fine-grained Node editing).

**Assumptions baked in**:
- Every domain object can and should be represented as a Node (Invariant: universal Node graph).
- Node shape can be extended via typed schemas without breaking the core Node contract.
- The seeds directory is the source of truth for schema and initial data.
- The Node graph is sufficiently performant for CRUD and traversal at scale.

**What later changed**:
- Era 4 (DB split) introduced a system/user partition, but the Node model remained intact within each database.
- Era 5 added static protocol generation (`bun run gen:protocol`) to decouple the hot loop from DB latency.
- Era 6 added cleanup of generated bloat, but the Node core persisted.
- The assumption held: no later era removed the Node model; they only extended it (e.g., adding new typed shapes).

**Was the decision still valid?**:
**Yes, with minor caveats**. The Node model remains the canonical data shape for all knowledge content. The ACU/FSRS/version-chain/alias design has proven correct for the project's goals (local-first AI conversation platform). The only nuance is that the universal Node assumption may be slightly too broad for non-knowledge assets (e.g., configuration files), but those are kept outside the Node graph (in config/seeds). The decision is strongly validated by subsequent eras building atop it.

**Confidence**: HIGH

---

## Decision 2: Single Entry Point / Unified Capability Registry (Era 3)

**Decision**: Establish a single entry point for all capability execution: `/api/interpret` (NL → capability ID) and `/api/capabilities/:id/execute` (capability ID → result). All capabilities are defined as `UnifiedCapability` rows in the DB, bound to NL patterns in `src/engines/nlcl/catalog.ts`, and executed via the `CapabilityEngine`. No engine or transport may bypass this registry.

**Evidence**:
- Commit `39bb583`: "CapabilityEngine: unit 4.2 capability execution + recovery"
- Commit `5277ba1`: "CapabilityResolutionEngine: unit 4.3"
- Files: `src/engines/capability.ts`, `src/engines/capability-resolution.ts`, `src/engines/nlcl/catalog.ts`, `src/server/index.ts` (routes), `src/schema/capability.ts` (Zod schema), `src/storage/contracts/capability-store.ts`
- Invariant 11 in AGENTS.md: "Every operation is a UnifiedCapability. CLI and frontend are thin NL shells that call POST /api/interpret → POST /api/capabilities/:id/execute."

**Probable motivation**: 
Early development suffered from multiplicity of ways to invoke functionality: direct engine calls, ad-hoc API routes, CLI commands, UI actions, and MCP tools. This created inconsistency, duplication, and difficulty in maintaining cross-surface parity (CLI/UI/API/MCP). The project needed a canonical way to bind natural language to implementation, ensuring that any surface (CLI, UI, API, MCP) could invoke the same capability with the same semantics.

**Benefits**:
- Enforces cross-surface parity: a capability registered once appears everywhere.
- Simplifies mental model: developers think in terms of capabilities, not surfaces or transports.
- Facilitates tooling: the `devops verify-cross-surface` script can automatically validate CLI/UI/API/MCP parity.
- Supports dynamic capability registration via seeds and DB.
- Reduces surface-area: no need to maintain separate implementation paths for each transport.
- Allows the NLCL layer to evolve independently of the execution layer.

**Costs**:
- Introduces indirection: NL → capability ID → engine execution adds a small overhead.
- Requires discipline: every new capability must be registered in the DB and NLCL catalog.
- Early versions had gaps where some transports (e.g., MCP) lagged behind; required active maintenance to keep parity.
- The capability table can grow large, requiring indexing and caching strategies.

**Assumptions**:
- The capability registry is the authoritative source for what the system can do.
- Natural language is a sufficient interface for invoking capabilities (i.e., the NLCL layer can map phrases to capability IDs with acceptable accuracy).
- The capability execution engine is secure and performs input validation.
- The registry can be kept in sync across surfaces via the seeds-as-truth pattern.

**What later changed**:
- Era 5 added the static protocol generator (`bun run gen:protocol`) to produce `__generated__/provider-protocol.ts` from the DB, allowing the hot loop to avoid DB lookups for capability metadata.
- Era 6 added the harness command registry (spec 017) for declarative LLM payload repair, still accessed via the same entry point (`/api/interpret`).
- Era 7 added the ExecutionKernel as an optional fast path behind a feature flag, but still accessed via the capability registry.
- No later era removed the single entry point; they only optimized or extended it (e.g., static protocol generation, execution kernel).

**Was the decision still valid?**:
**Yes**. The single entry point remains a cornerstone of the architecture. It has enabled the project to maintain cross-surface parity as it grew. The only tension is the performance cost of the indirection, which has been mitigated by caching (static protocol generation) and optional fast paths (ExecutionKernel). The decision is validated by the continued ability to add new capabilities and surfaces without architectural drift.

**Confidence**: HIGH

---

## Decision 3: Dual-DB Split (System/User) (Era 4)

**Decision**: Split the single Prisma SQLite database into two: a system database (read-only, framework-managed) for providers, capabilities, routing, telemetry, health, and config; and a user database (user-owned) for conversations, nodes, memory, and sessions. Each database has its own `schema.prisma` under `prisma/system/` and `prisma/user/`, accessed via separate PrismaClient singletons resolved by `SYSTEM_DATABASE_URL` and `USER_DATABASE_URL` environment variables.

**Evidence**:
- Commit `24576ce`: "feat: dual-DB split (system/user), prisma schema split, and cross-boundary storage layer"
- Files: `prisma/schema.prisma`, `prisma/system/schema.prisma`, `prisma/user/schema.prisma`, `src/storage/prisma.ts`, `src/storage/snapshot.ts`, `src/storage/cross-boundary-cache.ts`, `src/storage/db-health.ts`, `src/storage/cross-boundary-store.ts`
- Stats: +373,787 / -2,948 lines (includes 362,653 generated Prisma client lines); real hand-written delta: +11,134 / -2,948 lines across 514 files.

**Probable motivation**: 
The single database created a boundary tension: system metadata (providers, capabilities, routing) needed to be protected from accidental user corruption (e.g., a user deleting their data and inadvertently wiping the system registry). Additionally, the system database should be treated as read-only at runtime, while the user database is mutable. The split enforces this separation at the data layer, preventing reverse-tenant issues and clarifying ownership.

**Benefits**:
- Enforces a clear separation of concerns: system vs. user data.
- Prevents accidental corruption of system metadata by user operations.
- Allows different backup, migration, and access policies for each database.
- Enables the cross-boundary storage layer to explicitly declare when engine code touches user data (via the `cross-boundary` contract).
- The split is transparent to the engine layer via the dual PrismaClient singletons in `src/storage/prisma.ts`.
- Preserves the ability to query across boundaries when needed (via the cross-boundary layer).

**Costs**:
- Increases operational complexity: two databases to back up, migrate, and monitor.
- Schema migrations must be applied to both databases, requiring synchronization.
- Cross-boundary queries require explicit handling via the storage layer (cannot be done implicitly via Prisma relations).
- Generated Prisma client bloat: the initial commit accidentally tracked 50 generated client files (~362k lines), later removed in `11e6458`.
- The split introduces a slight performance penalty for cross-boundary queries due to the storage layer abstraction.

**Assumptions**:
- The system database contains only framework-managed, read-only-at-runtime data.
- The user database contains only user-owned, mutable data.
- The cross-boundary layer is sufficient for all necessary interactions between system and user data.
- The environment variables (`SYSTEM_DATABASE_URL`, `USER_DATABASE_URL`) are correctly set in all deployment contexts.

**What later changed**:
- Commit `11e6458` removed the accidentally committed generated Prisma client files (~362k lines), correcting the hygiene problem.
- The cross-boundary layer (`src/storage/*`) was refined in later eras (e.g., Era 5 intelligence upgrade, Era 6 bloat archaeology).
- The assumption held: no later era removed the split; they only refined the cross-boundary contracts.

**Was the decision still valid?**:
**Yes, with operational nuance**. The split correctly isolates system and user data, preventing the reverse-tenant problem. The only remaining tension is the operational overhead of managing two databases, which is acceptable for a local-first desktop application where each user manages their own instance. The decision is validated by the continued clarity of data ownership and the absence of cross-corruption incidents.

**Confidence**: HIGH

---

## Decision 4: Seeds-as-Truth and DB-Only Parser Logic (Invariant 4 & Invariant 6)

**Decision**: 
- The `seeds/` directory is the second source of truth: every boot reads from it to populate the DB (Invariant 4).
- Parser logic (`logic_code`) must be stored in the DB as inline JavaScript; file-based parsers are rejected unless `allowFileLogic` is explicitly enabled (Invariant 6).

**Evidence**:
- Files: `seeds/` directory tree (`seeds/providers/`, `seeds/parsers/`, `seeds/capabilities/`, etc.), `src/storage/seeds.ts`, `src/storage/migration/`, `src/engines/capability-bootstrap.ts`
- Invariant 4 and Invariant 6 listed in AGENTS.md under "Invariants (Boundary Conditions)".
- The `StreamParserEngine` loads `parser_logic_code` from the DB only; it rejects file-based logic unless `allowFileLogic=true`.

**Probable motivation**: 
Early development suffered from drift between code and data: seeds in the DB would become out-of-sync with the `seeds/` directory, leading to inconsistent behavior. Additionally, parser logic living in engine code (`src/engines/*`) made it difficult to update parsers without redeploying the engine. The project needed a way to ensure that the DB state is derivable from the seeds, and that parser logic is versioned and auditable via the DB.

**Benefits**:
- Guarantees that the DB can be reconstructed from seeds (`bun run devops ... reseed`).
- Enables parser updates without engine redeployment: update the DB row, and the next boot uses the new logic.
- Supports the seeds-as-truth pattern for all data: capabilities, providers, parsers, taxonomy, etc.
- Allows the DB to be the single source of truth for runtime behavior, while seeds remain the source of truth for intent.
- File-based parser logic is discouraged to prevent drift and ensure auditability.

**Costs**:
- Requires discipline: every seed change must be accompanied by a DB update (handled by the seed scripts).
- Parser logic stored as strings in the DB is less ergonomic to edit than native TypeScript (though mitigated by syntax highlighting and versioning).
- The DB becomes larger due to storing logic strings (though the logic is typically small).

**Assumptions**:
- The seeds directory is complete and correct: it contains all necessary data to bootstrap the DB.
- The seed scripts are idempotent and safe to run at boot.
- Parser logic stored as strings is sufficiently performant when executed via the SandboxRunner (or `new Function` fallback).
- No engine or transport should need to embed parser logic in code; if they do, they must opt-in via `allowFileLogic`.

**What later changed**:
- The seed scripts were refined and made idempotent in Era 5 (`45b0b1d`: "Make seeds idempotent at boot + parser boundary validation").
- The parser logic contract remained unchanged: all seeded parsers live in `seeds/parsers/harvested/*.ts` as `LOGIC_CODE` strings and are upserted into DB via `seeds/parsers/harvest.seed.ts`.
- No later era removed the seeds-as-truth or DB-only parser logic invariants; they only strengthened them.

**Was the decision still valid?**:
**Yes**. The seeds-as-truth pattern has proven essential for maintaining consistency between code and data. The DB-only parser logic invariant ensures that parser updates are traceable and auditable via the DB. Both invariants are validated by the ability to reset the DB from seeds and by the clarity of parser versioning.

**Confidence**: HIGH

---

## Decision 5: ChromeGovernor Canon (Invariant 1)

**Decision**: Only the `ChromeGovernor` engine may interact with the Chrome DevTools Protocol (CDP). No other engine or transport may import or use `BunCdpClient` directly. All CDP-mediated actions (provider setup, message capture, response parsing, etc.) must go through the ChromeGovernor.

**Evidence**:
- Files: `src/engines/chrome-governor.ts`, `src/engines/provider-registrar.ts`, `src/engines/conversation-manager.ts`
- Invariant 1 in AGENTS.md: "Governor Canon: Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`."
- The `ChromeGovernor` encapsulates `BunCdpClient` and exposes a higher-level API (e.g., `executeSnapshotProgram`, `navigate`, `evaluate`, `waitFor`).

**Probable motivation**: 
Early development suffered from multiple, ad-hoc uses of CDP: different engines would open their own CDP sessions, leading to resource conflicts, inconsistent state, and difficulty in debugging. The project needed a central authority to manage the Chrome lifecycle, ensuring that only one entity talks to CDP at a time and that all provider interactions are mediated through a consistent interface.

**Benefits**:
- Prevents CDP session conflicts and resource leaks.
- Centralizes provider setup, navigation, and teardown logic.
- Enables the ChromeGovernor to enforce invariants (e.g., only one instance per provider/account).
- Simplifies mental model: developers think in terms of the ChromeGovernor API, not raw CDP.
- Facilitates testing and mocking: the ChromeGovernor can be stubbed or replaced for unit tests.

**Costs**:
- Introduces a layer of indirection: all CDP traffic must go through the ChromeGovernor.
- Requires discipline: no engine may bypass the Governor to use `BunCdpClient` directly.
- The Governor must be carefully designed to avoid becoming a bottleneck.

**Assumptions**:
- The ChromeGovernor can safely manage all CDP interactions for the system.
- The Governor's API is sufficient for all provider-specific needs (navigation, capture, parsing, etc.).
- No legitimate use case requires direct CDP access outside the Governor.

**What later changed**:
- Era 3 stabilized the ChromeGovernor (`aeed6f5`: "Sidecar port argument parsing and duplicate server prevention").
- Era 4 added the cross-boundary layer, but the Governor remained the CDP authority.
- Era 5 added the static protocol generator, but the Governor still handled CDP.
- No later era removed the Governor canon; they only refined its responsibilities.

**Was the decision still valid?**:
**Yes**. The ChromeGovernor remains the sole authority for CDP interactions, preventing session conflicts and ensuring consistent provider management. The decision is validated by the absence of CDP-related bugs in later eras and by the clarity of the provider lifecycle.

**Confidence**: HIGH

---

## Decision 6: Harness Engine / DB-Driven Protocol (Spec 017)

**Decision**: Establish a declarative harness command registry (`HarnessCommand` table) with semver-versioned command definitions and JSON schemas. Build a repair engine (`HarnessRepairEngine`) that uses `repairString`/`repairNumber`/`repairBoolean` helpers to fix LLM payloads via alias remapping, code-fence stripping, trailing-comma fixes, and apostrophe-safe quote balancing. The repair process is coordinated by the `HarnessFeedbackCoordinator` with escalating prompts and exponential backoff.

**Evidence**:
- Commit `e21e999`: "HarnessRuntime: unit 4.7, DAG executor: sequence/parallel/branch/retry/precondition"
- Files: `src/engines/harness-command-registry.ts`, `src/engines/harness-repair-engine.ts`, `src/engines/harness-feedback-coordinator.ts`
- Models: `HarnessCommand`, `RepairSession`
- Storage contracts: `HarnessRepairStore` (`createRepairSession`, `findRepairSessionsByConversation`)
- Schema: `src/schema/repair-metadata.ts` (`registerRepair`/`getRepairMetadata` with helpers)
- Seeds: `seeds/harness/commands.seed.ts` → `seedHarnessCommands()` in `src/engines/capability-bootstrap.ts`

**Probable motivation**: 
LLM-generated payloads (e.g., JSON, code) are often malformed: missing commas, extra code fences, incorrect quoting, or deprecated field names. Instead of attempting to improve prompt engineering alone, the project needed a systematic way to repair common LLM output defects at runtime, ensuring that the system could consume imperfect LLM generations.

**Benefits**:
- Provides a systematic, configurable way to repair LLM payloads without prompt engineering.
- Supports versioned command definitions: each `HarnessCommand` row has a JSON schema and a semver version, allowing safe evolution.
- The repair helpers are composable and auditable: `repairString({aliases})` for alias remapping, etc.
- The feedback coordinator ensures that repair prompts escalate and do not repeat the same fix.
- Enables the system to "self-heal" common LLM defects, improving robustness.

**Costs**:
- Adds complexity: new storage contracts, models, and seeds.
- Requires maintenance of the harness command registry (though seeds keep it in sync).
- The repair process adds latency (though typically small).
- The system must trust that the repair helpers are correct and do not introduce false positives.

**Assumptions**:
- Common LLM defects are predictable and can be fixed via syntactic transformations (alias remapping, code-fence stripping, etc.).
- The JSON schema validation is sufficient to detect structural defects.
- The feedback coordinator's exponential backoff is sufficient to avoid infinite loops.
- The repair helpers are safe and do not corrupt valid payloads.

**What later changed**:
- No later era removed the harness engine or repair logic; they only refined it (e.g., Era 6 bloat archaeology).
- The seeds continue to populate the `HarnessCommand` table via `seedHarnessCommands()`.

**Was the decision still valid?**:
**Yes**. The harness engine provides a critical safety net for LLM-generated content, which is inherently unreliable. The decision is validated by the system's ability to handle imperfect LLM output without crashing or requiring perfect prompts.

**Confidence**: HIGH

---

## Decision 7: Tauri V2 Desktop Layer (Era 2)

**Decision**: Adopt Tauri V2 as the desktop shell, shipping a bundled binary (`vivim-desktop.exe`) that supervises a Bun sidecar (`vivim-server-*.exe`) via WebSocket over loopback. The Tauri layer provides the window, menu, and system tray, while the Bun sidecar runs the backend (API, engines, DB). The sidecar is compiled with `bun build --compile` and compressed via UPX (`-3 --no-lzma`).

**Evidence**:
- Commit `e1952fc`: "feat: integrate Tauri V2 desktop layer + new backend modules, fix capability boot await"
- Files: `src-tauri/` (Cargo.toml, tauri.conf.json, src, icons, gen, build.rs), `scripts/tauri/` (`build.ps1`, `build-sidecar.ps1`, `version.ts`, `compile-sidecar.ts`, `prepare-frontend.ts`), `devops/desktop/` (the 15-action CLI toolkit).
- Stats: +1,589 / -320 lines (at anchor); Bun sidecar ~94 MB runtime + ~3 MB app code → UPX compressed to 45.6 MB.

**Probable motivation**: 
The project began as a local script (`bun run dev`) but needed to evolve into a shippable desktop application that non-developers could run. Electron was considered too heavy (~100+ MB baseline), and Tauri V2 offered a lighter alternative (~45 MB after UPX) with smaller resource usage and faster startup. The sidecar pattern keeps the Bun backend isolated, allowing independent updates.

**Benefits**:
- Produces a single, native-like executable that non-developers can run.
- Reduces resource usage compared to Electron (Tauri + Bun ≈ 45–50 MB vs Electron ≈ 100+ MB).
- Separates concerns: Tauri handles the window/menu/system tray; Bun handles the backend.
- Enables independent versioning: the Tauri layer and Bun sidecar can be updated separately.
- The devops desktop toolkit provides a 5-gate orchestrator (Build → Install → Launch+Render → Capture → Report) for reliable shipping.

**Costs**:
- Introduces a Rust/Tauri layer that requires Rust toolchain and Cargo.
- The sidecar pattern adds complexity: two processes must communicate via WebSocket/loopback.
- The UPX compression step adds build time (though it is a one-time cost per release).
- The Tauri layer must be kept in sync with the Bun backend (API contracts, event formats).

**Assumptions**:
- The Tauri V2 + Bun sidecar stack is stable and secure for desktop use.
- The WebSocket/loopback communication is sufficiently low-latency for the backend-frontend interaction.
- The devops desktop toolkit can reliably build, install, and test the desktop application.

**What later changed**:
- Era 3 added the real CDP transport (`ChromeGovernor`) and real Chrome slaves, but the Tauri/Bun architecture remained.
- Era 4 added the DB split, but the Tauri/Bun layer was unaffected.
- Era 5 added the intelligence upgrade and Phase 6, but the desktop layer remained the shipping mechanism.
- No later era removed the Tauri V2 desktop layer; they only refined it (e.g., Era 6 bloat archaeology, Era 7 hardening).

**Was the decision still valid?**:
**Yes**. The Tauri V2 desktop layer successfully provides a shippable, low-resource desktop application. The decision is validated by the existence of the `vivim-desktop.exe` binary and the devops desktop toolkit's ability to build and test it.

**Confidence**: HIGH

---

## Decision 8: Frontend = Backend = CLI = API = MCP Parity (Era 5-6)

**Decision**: Establish and enforce parity across all surfaces (CLI, UI, API, MCP) such that every capability appears identically everywhere. The `devops verify-cross-surface` script validates that a capability's name (CLI), path (API), tool name (MCP), and slot ID (UI) are consistent. The capability `slug` is the single link between surfaces; no surface may contain `if (slug === 'x')` conditionals.

**Evidence**:
- Files: `src/engines/nlcl/catalog.ts` (NL patterns → capability IDs), `src/engines/*caps.ts` (capability registration), `frontend/src/ui/slots.ts` (SLOT_IDS), `devops/verify-cross-surface.ts` (the validation script), `src/server/index.ts` (API routes), `src/cli/index.ts` (CLI command registry), `src/mcp/` (MCP tool registration)
- Invariant 11 in AGENTS.md: "Every operation is a UnifiedCapability. CLI and frontend are thin NL shells that call POST /api/interpret → POST /api/capabilities/:id/execute."

**Probable motivation**: 
Early development suffered from surface fragmentation: a capability might exist in the CLI but not the UI, or have different behavior in the API vs. MCP. This created confusion and increased maintenance burden. The project needed a canonical way to ensure that capabilities are uniform across surfaces, reducing cognitive load and duplication.

**Benefits**:
- Reduces mental model complexity: developers learn one capability set that works everywhere.
- Eliminates duplication: no need to implement the same functionality multiple times for different surfaces.
- Facilitates testing: `devops verify-cross-surface` can automatically catch parity violations.
- Supports the thin-client principle: CLI and frontend are mere presentation layers over the same capability core.
- Enables feature flags and gradual rollouts: a capability can be toggled on/off uniformly across surfaces.

**Costs**:
- Requires discipline: every capability must be registered with the correct metadata for all surfaces.
- Initial buildup of metadata (slot IDs, NL patterns, tool names) is labor-intensive.
- The system must avoid surface-specific conditionals that break parity.

**Assumptions**:
- The capability `slug` is sufficient to identify a capability across surfaces.
- The metadata for each surface (CLI alias, API path, MCP tool name, UI slot ID) can be kept in sync.
- No legitimate use case requires surface-specific behavior that cannot be expressed via capability configuration.

**What later changed**:
- Era 5 added the static protocol generator, but parity was maintained.
- Era 6 added the harness command registry, but parity was maintained for its commands.
- Era 7 added the ExecutionKernel as an optional fast path, but it is still accessed via the capability registry.
- No later era removed the parity requirement; they only refined the mechanisms to maintain it.

**Was the decision still valid?**:
**Yes**. The parity requirement has remained a cornerstone of the architecture, ensuring that the system presents a unified face to users and developers. The decision is validated by the continued success of `devops verify-cross-surface` and by the absence of major parity violations in later eras.

**Confidence**: HIGH

---