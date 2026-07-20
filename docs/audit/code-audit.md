# Code Audit: Dead Code, Orphaned Code & Contract Drift

**Project:** vivim-final (cap-store v1 Knowledge Graph Rebuild)
**Date:** 2026-07-18
**Scope:** Full repo — `src/`, `tests/`, `web/ui/`, `seeds/`, `devops/`, `scripts/`
**Method:** Static transitive reachability closure from live roots (`src/index.ts`, `src/cli/index.ts`, `src/server/index.ts`, plus seed/devops entry points), grep-based reference counting, and contract↔impl mapping. No typecheck or test execution was run (per project guardrails).

> **Reachability roots used:** `src/index.ts`, `src/cli/index.ts`, `src/server/index.ts`, `prisma/seed.ts`, `src/server/index.ts` (harness/automation seeds), `devops/index.ts`, `web/ui/src/main.tsx`. Any module not reachable from a root (directly, via barrel re-exports, or `await import()`) is classified **ORPHANED**.

---

## Executive Summary

| Category | Count | Headline |
|----------|-------|----------|
| Orphaned engine modules | ~73 files | Large dead substrate in `engines/`, incl. full `browser-automation/` and `harness/` subtrees |
| Duplicate engine files | 6 | Superseded twins in `browser-automation/`, `capability-event-bus-v2`, `canvas-layer-mounter` |
| Unmounted server routers | 7 | Defined but never imported/mounted in `server/index.ts` |
| Orphaned storage impls | 4 | Never imported anywhere |
| Contracts with no impl | 8 | Spec-only contracts consumed only as types |
| Impls with no contract | 6 | Contract lives outside `contracts/` or missing |
| Dead store-factory | 1 | `store-factory.ts` is a stub wiring nothing |
| Orphaned UI components | ~35 | Entire `web/ui` canvas subsystem never mounted |
| Orphaned seeds | 11 | Harness modules + unused adapters + taxonomy seed |
| Orphaned devops modules | 3 | |
| Orphaned scripts | ~11 | Debug/one-off scratch scripts |
| Stale/duplicate tests | 4 | Stray probe + temp artifact + 2 duplicate pairs |

No large commented-out code blocks were found; the dead code is predominantly **whole unused modules**, not disabled code blocks.

---

## 1. `src/engines/` — Dead & Duplicate Modules

### 1.1 DUPLICATE-FILE (dead twin of a live module)
- `src/engines/browser-automation/agentic-loop.ts:69` — `class AgenticLoopEngine`. Live twin: `src/engines/agentic-loop.ts:45` (re-exported by `index.ts`). Never imported.
- `src/engines/browser-automation/selector-healer.ts:18` — `class SelectorHealer`. Live twin: `src/engines/selector-healer.ts:36` (used by `autonomous-execution.ts`). Never imported.
- `src/engines/browser-automation/semantic-grounding.ts:24` — `class SemanticGroundingEngine`. Live twin: `src/engines/semantic-grounding.ts:46` (used by `autonomous-execution.ts`). Never imported.
- `src/engines/capability-event-bus-v2.ts` — superseded v2 of `capability-event-bus.ts` (live, ~40 usages). Zero imports.
- `src/engines/canvas-layer-mounter.ts:29` — `class CanvasLayerMounter`. Live twin: `src/canvas/layer-mounter.ts` (imported by `server/canvas-ws.ts:11`). Never imported.

### 1.2 ORPHANED-MODULE (no importer anywhere)
**`browser-automation/` dead subtree** (driven by orphan `registry.ts`):
- `engines/browser-automation/registry.ts` + `defs/{capture,extract,flow,input,nav,net,observe,os,scroll,state,tab,wait}.ts` (13 files, ~1.5k LOC)

**`harness/` orphaned composition subtree** (`harness/index.ts` composition root never imported; `harness-contract.ts`/`harness-runtime.ts`/`harness-protocol-engine.ts` ARE live):
- `engines/harness/{index,harness-executor-engine,capability-program-registrar,fleet-lifecycle-adapter,binding-status-ladder,circuit-breaker-adapter,confidence-promotion,content-pipeline-adapter,health-probe-adapter,observability-streaming,stream-capture-reconstruct,timeout-guard}.ts` (11 files)

**`stealth/` engines not wired by `stealth/index.ts`** (only 4 of 21 are exported):
- `audio-context-engine.ts`, `behavioral-pattern-engine.ts`, `canvas-noise-engine.ts`, `cdp-artifact-cleaner.ts`, `font-screen-engine.ts`, `human-keyboard-engine.ts`, `human-mouse-engine.ts`, `human-scroll-engine.ts`, `network-fingerprint-engine.ts`, `profile-warmup-engine.ts`, `webgl-spoof-engine.ts`

**`canvas/` orphan:** `canvas/capability-layer.ts`

**`automation/` orphans:** `automation/automation-router.ts`, `automation/ui-automator.ts` (server uses `src/server/automation-router.ts`)

**Misc engine orphans (~30 files):**
`chrome-setup-wizard.ts`, `command-parity-capabilities.ts`, `config-universal-surface.ts`, `consent-engine.ts`, `eviction-manager.ts`, `intent-decomposer.ts`, `mcp-client-adapter.ts`, `mcp-server-adapter.ts`, `memory-indexer.ts`, `nlcl/graph/graph-model.ts`, `nlcl/tfidf-embedding-provider.ts`, `parser-repair.ts`, `parsers/{chatgpt,claude,gemini}-import.ts`, `plugin-system.ts`, `protocol-discovery.ts`, `protocol-loop-parser.ts`, `request-queue.ts`, `send-resilience.ts`, `streaming-response-analyzer.ts`, `tool-use-protocol.ts`, `transfer-accelerator.ts`, `trust-score.ts` (185 lines, never instantiated), `workflow-compiler.ts`, `workflow-templates/{cleanup-inactive,daily-digest,health-report,reindex-memory}.ts`, `harness-protocol-engine.ts`, `capability-discovery-loop.ts`, `canvas-layer-mounter.ts`.

### 1.3 Highest-value engine cleanup (save ~2k LOC, 73 files)
1. Delete `browser-automation/` duplicate trio + `registry.ts` + 12 `defs/*` (14 files).
2. Delete `capability-event-bus-v2.ts`, `engines/canvas-layer-mounter.ts`.
3. Delete orphaned `harness/` composition subtree (11 files); delete 11 unwired `stealth/*` engines.
4. Investigate `automation/automation-router.ts` vs `src/server/automation-router.ts` path-confusion duplicate.

---

## 2. `src/storage/` — Contract vs Implementation Drift

### 2.1 CONTRACT-NO-IMPL (interface exists, zero impl in `impl/`)
| Contract | Consumed by |
|----------|-------------|
| `contracts/agent-loop-store.ts:20` `AgentLoopStore` | `engines/browser-automation/agentic-loop.ts:7` (orphan) |
| `contracts/selector-heal-store.ts:21` `SelectorHealStore` | `engines/browser-automation/selector-healer.ts:7` (orphan) |
| `contracts/organization-store.ts:26` `OrganizationStore` | `engines/conversation-organizer.ts:10` |
| `contracts/kernel-store.ts:100` `KernelStore` | 11 kernel/engine files |
| `contracts/workspace-store.ts` `WorkspaceStore` | `engines/adaptive-workspace.ts:5` |
| `contracts/config-store.ts` `ConfigStore` | `kernel-bootstrap.ts:40`, `config-manager.ts:7` |
| `contracts/fleet-supervisor.ts:25` `FleetSupervisor` | `engines/chrome-governor.ts:9` (type-only) |
| `contracts/canvas-store.ts:81` `CanvasStore` | canvas layer (impl does NOT implement it — see 2.2) |

### 2.2 IMPL-NO-CONTRACT (impl class with no `contracts/*.ts` interface)
- `impl/capability-macro-store-impl.ts:7` — contract inline in engine
- `impl/workflow-store-impl.ts:11` — no `contracts/workflow-store.ts`
- `impl/sync-store-impl.ts:7` — no `contracts/sync-store.ts`
- `impl/harness-checkpoint-store-impl.ts:10` — no `contracts/harness-checkpoint-store.ts`
- `impl/policy-store-impl.ts:9` — no `contracts/policy-store.ts`
- `impl/canvas-store-impl.ts` `CanvasStoreImpl` — standalone class, does NOT `implements CanvasStore` (drift vs `contracts/canvas-store.ts`)

### 2.3 ORPHANED-IMPL (never imported anywhere in `src/`)
- `impl/intent-template-store-impl.ts` — 0 references
- `impl/stealth-store-impl.ts` (`InMemoryStealthStore`+`PrismaStealthStore`) — 0 references
- `impl/channel-store-impl.ts` (`InMemoryChannelStore`) — 0 real references
- `impl/canvas-store-impl.ts` (`CanvasStoreImpl`) — 0 references (canvas uses `InMemoryCanvasStore` in `canvas/in-memory-store.ts`)

### 2.4 UNWIRED-IN-FACTORY (DEAD by non-instantiation)
`src/storage/store-factory.ts` is a **stub** — it only holds `backend`/`db` and exposes `getBackend()/getDb()/isPostgres()/isSQLite()`. No store is registered or instantiated through it. Stores are wired ad-hoc at call sites.

Impl classes with a contract but **never instantiated anywhere** in `src/` (~24): `user-identity-store-impl`, `version-store-impl`, `registration-store-impl`, `provider-type-store-impl`, `telemetry-store-impl`, `stream-config-store-impl`, `memory-curated-store-impl`, `health-digest-store-impl`, `capability-macro-store-impl`, `workflow-store-impl`, `sync-store-impl`, `shape-binding-store-impl`, `hpe-session-store-impl`, `harness-checkpoint-store-impl`, `alert-store-impl`, `context-assembly-store-impl`, `situation-store-impl`, `hitl-gate-store-impl`, `workflow-version-store-impl`, `workflow-retry-queue-store-impl`, `mirror-store-impl`, `stream-block-store-impl`, `program-store-mem`, `automation-store-impl`.

Genuinely wired impls: `ProviderStoreImpl`, `ConversationStoreImpl`, `GovernorStoreImpl`, `CapabilityResolutionStoreImpl`, `ParserStoreImpl`, `CapabilityStoreImpl`, `EpisodicMemoryStoreImpl`, `SemanticMemoryStoreImpl`, `ProceduralMemoryStoreImpl`, `SandboxAuditStoreImpl`, `NodeStoreImpl`, `KnowledgeExtractorStoreImpl`, `KnowledgeIngestionStoreImpl`, `SemanticSearchStoreImpl`, `CrossConversationSynthesizerStoreImpl`, `CostStoreImpl`, `MuxStoreImpl`, `RouterStoreImpl`, `AutonomousStoreImpl`, `PolicyStoreImpl`, `HealthStoreImpl`, `PrimitiveStoreImpl`, `UiComponentStoreImpl`, `DiscoveryStoreImpl`, `SlaveSetupStoreImpl`, `InMemoryCanvasStore`.

### 2.5 Contract drift (duplicated row types)
- `ProviderAccountRow` duplicated in `conversation-store.ts:36` AND `governor-store.ts:6` (consumers import from differing files).
- `SelectorStrategyRow` duplicated in `capability-store.ts:37` AND `selector-heal-store.ts:5`.

---

## 3. `src/server/`, `src/cli/`, `src/mcp/` — Unmounted & Orphaned

### 3.1 UNMOUNTED-ROUTER (defined but never imported/mounted)
- `src/server/interpret-router.ts:43` `createInterpretRouter` (+ `createInterpretRouterMinimal:129`) — `/api/nlcl/` served by `nlcl-router.ts` instead (dead duplicate).
- `src/server/conceptual-router.ts:4` `createConceptualRouter`
- `src/server/plugin-router.ts:90` `createPluginRouter`
- `src/server/webhook-router.ts` (whole module)
- `src/server/memory-viz-router.ts:21` `createMemoryVizRouter`
- `src/server/kernel-router.ts:63` `createKernelRouter`
- `src/server/routes/users.ts:7` `createUserRouter` (`ServerContext.userIdentity` never set; cannot run even if mounted)

### 3.2 ORPHANED-CLI-COMMAND (violates AGENTS.md)
`src/cli/commands/automate.ts:170` and `src/cli/commands/moments.ts:170` contain `if (import.meta.main)` blocks — runnable as standalone scripts that bypass `CommandRegistry`. They ARE bridged correctly via `builtins.ts`, so only the `import.meta.main` blocks are the offending parts. AGENTS.md: "do NOT hand-write standalone `commands/*.ts` scripts that bypass the registry."

### 3.3 ORPHANED-MODULE
- `src/mcp/nlcl-tools.ts:9` `registerNLCLTools` — never imported or called; not exported from `src/mcp/index.ts`.

---

## 4. `web/ui/` — Orphaned UI Components (~35 files)

Entry `main.tsx` → `App.tsx` renders only `ChatPage` + `ProviderSetupWizard`. The following are never imported by any reachable parent/router/barrel:
- **Entire canvas subsystem** (`features/canvas/`): `CanvasSurface.tsx` + `CanvasDesigner`, `FeatureTour`, `FirstRunWizard`, `WelcomeOverlay`, `BrowserLayerHost`, `SandboxedLayer`, `LoadingSkeleton`, `ErrorBoundary`, `MinimapNode`, `ZoomNode`, `StreamingSlot`, `ResultSlot`, `ThemeProvider`, hooks (`useCanvasEvents`, `useCanvasHistory`, `useConceptualModel`, `useFirstRun`, `useKeyboardShortcuts`, `useManifest`, `useNodeTypes`, `useUiSlots`, `useZoomLevel`) — `features/canvas/index.ts` itself is never imported.
- `features/capabilities/CapabilityDashboard.tsx`
- `features/command-bar.tsx` (`CommandBar`)
- `features/provider-account-dashboard/{ProviderAccountDashboard,AccountCard,accountSlice}.ts(x)`
- `features/chat/{Composer,ConversationSidebar,HitlGate,MemoryPanels,SendErrorSlot}.tsx` — duplicates; `ChatPage` resolves these via `useSlot('chat.*')` from `ui/defaults/`.
- `ui/defaults/{DefaultChat,DefaultAgents,DefaultProjects,DefaultProviders,DefaultSettings,DefaultWorkspace,DefaultKnowledge}.tsx` — distinct from wired slot-defaults, never imported.
- `ui/auto-populate.ts`, `features/auto-populate.ts`, `ui/ui-component-renderer.tsx` (`createUiComponentRenderer`).

---

## 5. `seeds/` — Orphaned Seeds (11 files)

Entry points: `prisma/seed.ts`, `src/index.ts`/`src/server/index.ts` (harness/automation), `tests/*`. Unreferenced:
- `seeds/og-capability-port.ts` — only in `docs/session/CDP-PORT-OBJECTIVES.md`
- `seeds/taxonomy/taxonomy-seed.ts` — self-documented, not wired into any seeder
- Adapters: `seeds/adapters/{chat_app,coding_ide,search_engine,custom}.adapter.ts` — only `chatgpt/claude/gemini` used
- Harness modules: `seeds/harness/{capture,composer,login,navigation,selector,stealth}.module.ts` — never imported

_NOTE:_ `seeds/intent-templates/catalog.json` is **NOT** orphaned (consumed by `src/storage/impl/intent-template-store-impl.ts:12`); `seeds/parsers/claude-streaming-sse.ts` is used as a test fixture.

---

## 6. `devops/` & `scripts/` — Orphaned Modules

### 6.1 ORPHANED-DEVOPS-MODULE
- `devops/output-format.ts` (distinct from wired `src/cli/output-formatter.ts`)
- `devops/research-bridge.ts`
- `devops/skill-cli-verifier.ts` (only self-guards `process.argv`)

### 6.2 ORPHANED-SCRIPT
Debug/one-off scratch: `scripts/_debug-launch.ts`, `scripts/_record_node_layer_v2.ts`, `scripts/_record_node_migration.ts`, `scripts/_verify_node_tables.ts`, `scripts/fix-b7-imports.ts`, `scripts/fix-b7-errors.ts`, `scripts/debug-parser.ts`, `scripts/test-claude-parser.ts` (overlaps `scripts/test-parser.ts`), `scripts/gen-canvas-source.ps1`, `scripts/verify-moment.ts`, `scripts/backfill-taxonomy.ts` (package script points at `taxonomy-gen/run.ts`).

_NOTE:_ `start-*.ps1`/`stop-all.ps1`/`health-check.ps1` are the canonical launch surface (per AGENTS.md) — not flagged. `provider-harness.ts`, `manual-gen.ts`, `openapi-gen.ts`, `generate-skills.ts`, `taxonomy-gen/run.ts` are in `package.json` — not flagged.

---

## 7. `tests/` — Stale & Duplicate Tests

- `tests/unit/engines/_probe.test.ts` — scratch probe writing temp files; not a real spec.
- `tests/unit/engines/.tmp-export-test/import-test.json` — stray temp artifact in tree.
- Duplicate pairs (same symbol, two files):
  - `tests/unit/engines/capability-shape-registry.test.ts` **&** `capability-shape-registry-enhanced.test.ts`
  - `tests/unit/engines/provider-discovery.test.ts` **&** `provider-discovery-enhanced.test.ts`
- No `skip`/`todo`/`xtest` blockers found. No tests import from non-existent modules.

---

## Recommended Remediation Order (CORRECTED — see §8 Value Assessment)

> **Correction vs. first draft:** The initial remediation list (step 2) wrongly suggested purging the `engines/harness/` subtree. The Value Assessment (§8) shows that subtree is **live via test roots** and should be KEPT. The ordering below reflects the assessment.

1. **Purge safe duplicates** (clear superseded twins, no value risk): `browser-automation/` (14 files), `capability-event-bus-v2.ts`, `engines/canvas-layer-mounter.ts`. (~2k LOC)
2. **Remove `import.meta.main` blocks** in `cli/commands/automate.ts:170` and `moments.ts:170` (AGENTS.md compliance).
3. **Purge unmounted routers** (dead stubs, several fail typecheck on missing `ServerContext` fields): `interpret-router`, `conceptual-router`, `plugin-router`, `webhook-router`, `memory-viz-router`, `kernel-router`, `routes/users.ts`; purge `mcp/nlcl-tools.ts`.
4. **Purge 11 unwired stealth engines** (real code but not registered by `register-defaults.ts`; spec-complete but never wired).
5. **Purge orphaned seeds** (12 files: `og-capability-port.ts`, `taxonomy/taxonomy-seed.ts`, 4 unused adapters, 6 harness `*.module.ts`).
6. **Purge orphaned devops/scripts** (3 devops modules + ~11 scratch scripts) and **stale/duplicate tests** (`_probe.test.ts`, `.tmp-export-test/`, 2 duplicate pairs).
7. **Storage drift decision** (keep/implement vs purge):
   - **KEEP:** `stream-block-store-impl.ts`, `program-store-mem.ts` (live), and contracts `selector-heal-store`, `kernel-store`, `config-store`, `fleet-supervisor`, `canvas-store` (live consumers).
   - **SAFE PURGE:** `stream-config-store-impl.ts` (0 refs), `shape-binding-store-impl.ts` (barrel-only), `hpe-session-store-impl.ts` (barrel+test only).
   - **IMPL-ONLY-NO-CONSUMER (purge impl, keep contract OR purge both):** `user-identity`, `version`, `registration`, `provider-type`, `telemetry`, `memory-curated`, `health-digest`, `capability-macro`, `workflow`, `sync`, `harness-checkpoint`, `alert`, `context-assembly`, `situation`, `hitl-gate`, `workflow-version`, `workflow-retry-queue`, `mirror`, `automation` store-impls.
   - **CONTRACT-ONLY-DEAD-CONSUMER (purge contract + orphaned engine):** `agent-loop-store.ts`+`browser-automation/agentic-loop.ts`, `organization-store.ts`+`conversation-organizer.ts`, `workspace-store.ts`+`adaptive-workspace.ts`.
   - Root cause: `store-factory.ts` is a stub wiring nothing — fix wiring or delete.
8. **De-duplicate row types** (`ProviderAccountRow`, `SelectorStrategyRow`).

**DO NOT PURGE (intended substrate / spec'd-untapped value):**
- `engines/harness/` composition subtree (11 files) — live via `tests/integration/harness/atomic-v14-smoke.test.ts` + `tests/unit/harness/harness-executor.test.ts`.
- `web/ui/src/features/canvas/` (24 files) — spec'd (specs/002, 005, 006), backend `canvas-router.ts` is live; intended front-end mount, not scrap.
- `web/ui` orphan components that are spec deliverables but unwired (`CapabilityDashboard`, `ProviderAccountDashboard`, `command-bar`) — **keep or mount**, not delete.
- `automation/automation-router.ts` + `automation/ui-automator.ts` — re-evaluate against `src/server/automation-router.ts` (possible path-confusion duplicate, not proven dead).

---

## 8. Value Assessment (Keep vs Purge)

After cataloguing, each ambiguous item was re-examined for **non-code references** (docs/specs/roadmap/tests) and **test-root reachability**, to separate intentional substrate/cruft. Reachability was extended to test roots (`tests/`), not just app/server roots.

### 8.1 Storage layer
- **KEEP (live consumers):** `stream-block-store-impl.ts` (instantiated in `server/index.ts` for `KnowledgeIngestionEngine`/`ConversationManager`), `program-store-mem.ts` (live harness pipeline substrate). Contracts `selector-heal-store`, `kernel-store`, `config-store`, `fleet-supervisor`, `canvas-store` all have live consuming engines (`chrome-governor`, `kernel-bootstrap`, `config-manager`, executor runtime, `canvas-engine`).
- **SAFE PURGE (zero real refs):** `stream-config-store-impl.ts` (0 hits outside storage), `shape-binding-store-impl.ts` (barrel-only), `hpe-session-store-impl.ts` (barrel+test only).
- **IMPL-ONLY-NO-CONSUMER (purge impl; keep contract as spec substrate or purge both):** `user-identity`, `version`, `registration`, `provider-type`, `telemetry`, `memory-curated`, `health-digest`, `capability-macro`, `workflow`, `sync`, `harness-checkpoint`, `alert`, `context-assembly`, `situation`, `hitl-gate`, `workflow-version`, `workflow-retry-queue`, `mirror`, `automation` store-impls — each imported only as a *type* by an engine that is itself never instantiated at runtime (root cause: `store-factory.ts` stub wires nothing).
- **CONTRACT-ONLY-DEAD-CONSUMER (purge contract + orphaned engine):** `agent-loop-store.ts`+`browser-automation/agentic-loop.ts`, `organization-store.ts`+`conversation-organizer.ts`, `workspace-store.ts`+`adaptive-workspace.ts` — the consuming engines are themselves orphaned.

### 8.2 Servers, harness, stealth
- **Unmounted routers — PURGE all 7.** Dead stubs; several fail typecheck on missing `ServerContext` fields (`conceptual-router`, `routes/users.ts`). `interpret-router` is a duplicate of the live `nlcl-router`.
- **`engines/harness/` subtree — KEEP all 11.** Correction to first-pass audit: `harness/index.ts` (`composeHarness`) is imported by **test roots** (`tests/integration/harness/atomic-v14-smoke.test.ts:10`, `tests/unit/harness/harness-executor.test.ts:8`). Live substrate, explicitly tested, v14 roadmap.
- **`engines/stealth/` unwired 11 — PURGE.** Real code, spec-complete (phases 12–14), but never registered by `register-defaults.ts` (which registers only 4 of 21). `register-defaults.ts` even has commented-out `registerModule` placeholders for them — intent-but-unfinished. Safe to delete unless a future phase wires them.

### 8.3 web/ui + seeds
- **`web/ui/src/features/canvas/` (24 files) — KEEP.** Spec'd (specs/002-canvas-surface, 005-first-run, 006-provider-account-dashboard); backend `canvas-router.ts` is live; intended front-end mount not yet wired. Quarantine/mount, don't delete.
- **Other orphaned UI components — PURGE** (no importers, not in `ui/defaults/index.tsx` slot registry): `CapabilityDashboard.tsx`, `command-bar.tsx`, `provider-account-dashboard/*` (3), `chat/{ConversationSidebar,HitlGate,MemoryPanels,SendErrorSlot,Composer}.tsx` (last two are duplicates of live `ui/defaults/*`), `ui/defaults/Default{Chat,Agents,Projects,Providers,Settings,Workspace,Knowledge}.tsx` (7 unused placeholders), `ui/auto-populate.ts`, `ui/ui-component-renderer.tsx`. (`features/auto-populate.ts` does not exist.)
- **Seeds — PURGE all 12:** `og-capability-port.ts` (OG migration, points at external `vivim-app-og`), `taxonomy/taxonomy-seed.ts` (live generator is `taxonomy-gen/run.ts`), adapters `chat_app`/`coding_ide`/`search_engine`/`custom` (live are chatgpt/claude/gemini), harness `*.module.ts` ×6 (not imported by `commands.seed.ts`). None are in any seeder/loader/registry.

### 8.4 Decision summary
| Bucket | Keep | Purge |
|--------|------|-------|
| Storage impls | 2 live | 3 zero-ref + 19 type-only-no-consumer |
| Storage contracts | 5 live | 3 dead-consumer |
| Unmounted routers | 0 | 7 |
| `harness/` subtree | 11 | 0 |
| `stealth/` unwired | 0 | 11 |
| `web/ui` canvas | 24 | 0 |
| Other UI orphans | 0 | ~22 |
| Seeds | 0 | 12 |

**Net safe-purge target:** ~74 files (7 routers + 11 stealth + 12 seeds + ~22 UI orphans + 3 storage + 14 `browser-automation` duplicates + 2 event-bus duplicates + scratch scripts/tests) — **excluding** the `harness/` subtree and `web/ui` canvas subsystem, which have real (test/roadmap-backed) value.

---

## Caveats
- Reachability is static; dynamic `import()` and runtime registry lookups are conservative (a module only reachable at runtime was treated as reachable if referenced via `await import`).
- ~24 non-instantiated storage impls may be intentional "spec substrate" for future wiring — flagged as DRIFT, not definitively dead, pending product decision.
- No typecheck was run (per project guardrails: typecheck only on explicit request).
