# Production Readiness Audit — 2026-07-16

**Project:** vivim-final — cap-store v1 Knowledge Graph Rebuild  
**Invariants:**
1. Local-only app (no SaaS) — SQLite, no cloud dependencies
2. Frontend = Backend — co-located Bun server + React UI
3. Pure HTML + hot-swappable components on infinite layered canvas
4. User-definable workspaces with configurable layers
5. Local user memory — full conversation history import from all providers
6. Providers as versioned installable plugins
7. Automation with event triggers, conditional branching, retry

**Status legend:** 🔴 Critical | 🟡 Blocked | 🟢 In Progress | ⚪ Not Started | ✅ Resolved

---

## 1. Canvas & UI Surface (14 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 1.1 | 🔴 | Z-axis depth positioning. Layout structs have `{x,y,w,h}` — no `z`. | ⚪ |
| 1.2 | 🔴 | No 3D/depth rendering engine. React-Flow is 2D SVG. | ⚪ |
| 1.3 | 🔴 | User-created layers. Only 3 hardcoded modes. No `createLayer(name)` API. | ⚪ |
| 1.4 | 🟡 | Layer-scoped component spawning. Spawn API doesn't bind to parent layer. | ⚪ |
| 1.5 | 🟡 | No layer visibility/persistence toggle. | ⚪ |
| 1.6 | 🟡 | Canvas minimap missing. | ⚪ |
| 1.7 | 🟡 | Canvas navigation shortcuts (jump-to-layer, zoom-to-fit). | ⚪ |
| 1.8 | 🟡 | Component drag-to-reposition on canvas surface. | ⚪ |
| 1.9 | 🟡 | Component resize handles. | ⚪ |
| 1.10 | 🟡 | Snap-to-grid and alignment guides. | ⚪ |
| 1.11 | 🔴 | Canvas state serialization. No full save/restore of layer positions. | ⚪ |
| 1.12 | 🔴 | No canvas undo/redo. `mutation-caps.ts` declares types but no history stack. | ⚪ |
| 1.13 | 🟡 | Canvas layer theming (background, border, style per layer). | ⚪ |
| 1.14 | 🟡 | Layer lock (prevent drag/resize/spawn). | ⚪ |

> **Note:** Items 1.1–1.3 block most other canvas work. Fix them first.

---

## 2. Provider Plugin System (13 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 2.1 | 🔴 | Providers seeded from static JSON, not plugins. `PluginRegistry` table unused as primary path. | ⚪ |
| 2.2 | 🔴 | No `.vivim-plugin` packaging format. | ⚪ |
| 2.3 | 🔴 | No plugin integrity verification at load time. Hash stored, never checked. | ⚪ |
| 2.4 | 🟡 | No plugin signature verification. | ⚪ |
| 2.5 | 🔴 | No install API (`POST /api/plugins/install`). Manual file placement only. | ⚪ |
| 2.6 | 🔴 | No plugin upgrade path with data migration. | ⚪ |
| 2.7 | 🔴 | No uninstall cleanup cascade (provider + accounts + conversations + capabilities + components). | ⚪ |
| 2.8 | 🟡 | No plugin dependency resolution. | ⚪ |
| 2.9 | 🟡 | No plugin conflict detection (two plugins claiming same capability slug). | ⚪ |
| 2.10 | 🟡 | No disable/enable without uninstall. | ⚪ |
| 2.11 | 🟡 | Hot-reload watches directory — atomic swap-in needed for production. | ⚪ |
| 2.12 | 🟡 | No plugin telemetry (install count, usage count). | ⚪ |
| 2.13 | 🟡 | Missing plugin hooks: `onUninstall`, `onUpgrade`, `onHealthCheck`. | ⚪ |

---

## 3. Component Library & 4-Tier Resolution (11 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 3.1 | 🔴 | Seed data seeds families + primitives but few `UiComponent` rows. Resolution resolves to nothing. | ⚪ |
| 3.2 | 🔴 | No `ai-chat` family provider-specific components (ChatGPT canvas, Claude artifacts). | ⚪ |
| 3.3 | 🔴 | No `email` family components (composer with to/cc, inbox, attachments). | ⚪ |
| 3.4 | 🔴 | No `messenger` family components (Telegram vs WhatsApp vs Slack variants). | ⚪ |
| 3.5 | 🔴 | No `social` family components. | ⚪ |
| 3.6 | 🔴 | System default fallback components missing in `web/ui/src/ui/defaults/`. | ⚪ |
| 3.7 | 🟡 | No component preview/thumbnail. | ⚪ |
| 3.8 | 🟡 | No component search API across catalog. | ⚪ |
| 3.9 | 🟡 | No visual component authoring UI. `CanvasDesigner` is code-only. | ⚪ |
| 3.10 | 🟡 | Component hot-swap at runtime — frontend doesn't react to resolution changes. | ⚪ |
| 3.11 | 🟡 | No component version rollback. No version history table. | ⚪ |

---

## 4. Local Memory & Conversation Import (13 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 4.1 | 🔴 | `KnowledgeIngestionEngine` skeleton — per-source import adapters don't exist. | ⚪ |
| 4.2 | 🔴 | No ChatGPT JSON export parser. | ⚪ |
| 4.3 | 🔴 | No Claude conversation export parser. | ⚪ |
| 4.4 | 🔴 | No Gemini/Grok/DeepSeek export parsers. | ⚪ |
| 4.5 | 🟡 | No generic browser-scraped import via `HarnessDAG`. | ⚪ |
| 4.6 | 🔴 | Deduplication declared but unimplemented. Re-import creates duplicates. | ⚪ |
| 4.7 | 🔴 | Rich content preservation — import flattens everything to plain text. `ContentUnit` unused. | ⚪ |
| 4.8 | 🔴 | Large file handling — `readFileSync` on 100MB+ file will OOM. | ⚪ |
| 4.9 | 🟡 | No incremental import progress events. | ⚪ |
| 4.10 | 🟡 | No import resume on crash. | ⚪ |
| 4.11 | 🟡 | No import preview/summary before committing. | ⚪ |
| 4.12 | 🔴 | Entity/decision extraction depends on noop zero-vector embedding. Produces nothing. | ⚪ |
| 4.13 | 🔴 | `ConversationOrganizer.autoAssignTopic()` searches by ULID string, not content. | ⚪ |

---

## 5. Memory Unification (10 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 5.1 | 🔴 | Three separate memory systems, no unified query API. | ⚪ |
| 5.2 | 🟡 | `MemoryEngine.recall()` searches episodic only by tags. No cross-type search. | ⚪ |
| 5.3 | 🟡 | `MemoryIndexer` doesn't link to `Entity`, `DecisionRecord`, `PatternExtract`. | ⚪ |
| 5.4 | 🟡 | `MemoryLink` table not populated by indexer. | ⚪ |
| 5.5 | 🟡 | No UI to pin/verify/correct/delete memory items (`MemoryCurated`, `MemoryFeedback`). | ⚪ |
| 5.6 | 🟡 | `MemoryAccess` audit table never written to. | ⚪ |
| 5.7 | 🔴 | `semantic-search.ts` uses `noopEmbedding` (all-zero vectors). Search returns garbage. | ⚪ |
| 5.8 | 🔴 | No embedding model wired — `LocalModelAdapter` should serve embeddings. | ⚪ |
| 5.9 | 🟡 | `EvictionManager` doesn't clean expired `SemanticMemory`. | ⚪ |
| 5.10 | 🟡 | `ReflectionLog` never populated — no periodic reflection pass. | ⚪ |

---

## 6. Automation System (15 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 6.1 | 🔴 | `parseCronNextMs()` is a literal `// v1 stub` comment. Cron schedules never fire. | ⚪ |
| 6.2 | 🔴 | Event-triggered schedules unimplemented. `parseEventTrigger()` returns `null`. | ⚪ |
| 6.3 | 🔴 | `AutomationRunner.run()` has no concrete implementation registered. | ⚪ |
| 6.4 | 🔴 | `WorkflowEdge.condition` never evaluated. All edges unconditional. | ⚪ |
| 6.5 | 🔴 | No workflow trigger binding. `WorkflowDefinition` and `AutomationSchedule` are separate tables. | ⚪ |
| 6.6 | 🔴 | No persistent retry queue. Failed nodes marked `failed` — no retry, no dead-letter. | ⚪ |
| 6.7 | 🟡 | No workflow I/O schema validation between nodes. | ⚪ |
| 6.8 | 🟡 | `WorkflowEngine.executeNode()` constructs `Function` from config — code injection risk. | ⚪ |
| 6.9 | 🟡 | No workflow versioning. Edit while running = undefined behavior. | ⚪ |
| 6.10 | 🟡 | No parallel node execution. Nodes execute sequentially. | ⚪ |
| 6.11 | 🟡 | No workflow/node timeout or deadline. | ⚪ |
| 6.12 | 🟡 | `WorkflowWebhook` table exists — no webhook router wired. | ⚪ |
| 6.13 | 🟡 | `WorkflowCredential` not injected into `executeNode()`. | ⚪ |
| 6.14 | 🟡 | No workflow template library beyond `buildNewsletterWorkflow`. | ⚪ |
| 6.15 | 🟡 | No `HitlGate` creation in workflow engine. | ⚪ |

---

## 7. Workspace System (7 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 7.1 | 🔴 | `WorkspaceMode` stores single row per user. Multiple named workspaces not supported. | ⚪ |
| 7.2 | 🔴 | `mode` is single string. No custom workspace names, no user-created IDs. | ⚪ |
| 7.3 | 🟡 | `PanelConfig` is flat list. No nesting, no layer scoping. | ⚪ |
| 7.4 | 🟡 | No workspace-bound resource scoping. Everything global. | ⚪ |
| 7.5 | 🟡 | No workspace export/import. | ⚪ |
| 7.6 | 🟡 | Two competing state models: `WorkspaceMode.panelsJson` vs canvas layer system. | ⚪ |
| 7.7 | 🟡 | No workspace default template for first-run. | ⚪ |

---

## 8. Sandbox Safety (9 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 8.1 | 🔴 | `sandboxJson` defaults to `'{}'` — no restrictions. | ⚪ |
| 8.2 | 🔴 | CSP header computed from `sandboxJson`. Default `{}` = iframe runs with no restrictions. | ⚪ |
| 8.3 | 🔴 | `SandboxBridge` has no per-component capability allowlist enforcement. | ⚪ |
| 8.4 | 🟡 | No resource budget enforcement (CPU/memory/DOM limits). | ⚪ |
| 8.5 | 🟡 | Canvas sandbox doesn't audit violations. `SandboxAudit` unused. | ⚪ |
| 8.6 | 🟡 | No watchdog timer for hung iframes. | ⚪ |
| 8.7 | 🟡 | Network allowlist is binary toggle, should be URL pattern list. | ⚪ |
| 8.8 | 🔴 | `SandboxPolicy.allowInlineScript: false` contradicts `UiComponent.html` inline scripts. | ⚪ |
| 8.9 | 🟡 | Components share `SandboxBridge` — a malicious component could proxy capability calls. | ⚪ |

---

## 9. Data Portability (11 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 9.1 | 🟡 | Export writes file without checksum verification. | ⚪ |
| 9.2 | 🔴 | No import-from-export flow. Export is one-way. | ⚪ |
| 9.3 | 🔴 | Export omits `UiComponent` rows. | ⚪ |
| 9.4 | 🔴 | Export omits workspace config. | ⚪ |
| 9.5 | 🔴 | Export omits plugin registry state. | ⚪ |
| 9.6 | 🔴 | `SyncEngine.sync()` is a stub. No peer discovery, conflict resolution, CRDT. | ⚪ |
| 9.7 | 🟡 | `SyncConflictError` thrown but never caught. | ⚪ |
| 9.8 | 🟡 | No device pairing flow. | ⚪ |
| 9.9 | 🔴 | `BackupScheduler` never populated. No backup retention or verification. | ⚪ |
| 9.10 | 🟡 | No backup restore UI. | ⚪ |
| 9.11 | 🟡 | No cloud backup connector. | ⚪ |

---

## 10. Startup & Performance (10 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 10.1 | 🔴 | `createServerWithEngines` serializes all engine init — 3-8s cold start. | ⚪ |
| 10.2 | 🔴 | No lazy engine initialization. Everything constructor at boot. | ⚪ |
| 10.3 | 🔴 | `governor.boot()` blocks until Chrome fleet running. No Chrome = timeout/crash? | ⚪ |
| 10.4 | 🔴 | Canvas engine init buried at line ~626, after everything else. UI renders last. | ⚪ |
| 10.5 | 🟡 | No startup time measurement recorded as spans. | ⚪ |
| 10.6 | 🟡 | `/readyz` binary — no granular readiness per engine. | ⚪ |
| 10.7 | 🟡 | No offline/degraded mode indicator in UI. | ⚪ |
| 10.8 | 🟡 | No GPU/WebGL detection at startup. | ⚪ |
| 10.9 | 🟡 | Missing engines fail silently with zero user signal. | ⚪ |
| 10.10 | 🔴 | No `PRAGMA integrity_check` at boot. | ⚪ |

---

## 11. Reliability & Error Handling (11 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 11.1 | 🔴 | 6+ silent `try {} catch { /* silent */ }` blocks in bootstrap. | ⚪ |
| 11.2 | 🟡 | `IdempotencyGuard` never used. No API endpoint guarded. | ⚪ |
| 11.3 | 🟡 | `LockManager` never used. No conversation concurrency lock. | ⚪ |
| 11.4 | 🟡 | `RetryEngine` not wired into `ConversationManager.send()`. | ⚪ |
| 11.5 | 🔴 | Circuit breaker on slave doesn't prevent `ConversationManager` from using it. | ⚪ |
| 11.6 | 🟡 | No global HTTP request timeout. | ⚪ |
| 11.7 | 🟡 | No request queue or backpressure for concurrent sends. | ⚪ |
| 11.8 | 🟡 | Inline parser code compiled with raw `new Function()` — infinite loop = event loop blocked. | ⚪ |
| 11.9 | 🟡 | `ExecutionMemoizer` cache unbounded — no TTL, no eviction, no size limit. | ⚪ |
| 11.10 | 🟡 | `CapabilityEventBus` no backpressure for slow WebSocket consumers. | ⚪ |
| 11.11 | 🔴 | 8-step send pipeline has no rollback — step 6 failure after step 5 = data loss. | ⚪ |

---

## 12. Security & Privacy (10 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 12.1 | 🟡 | Single bearer token auth with no rotation, expiry, or scope. | ⚪ |
| 12.2 | 🟡 | No user identity system. All `userId` fields = `'default'`. | ⚪ |
| 12.3 | 🔴 | `DbEncryptionEngine` and `EncryptionEngine` exist but never wired. `config.storage.encryptDb` ignored. | ⚪ |
| 12.4 | 🟡 | `WorkflowCredential` encryption key management unresolved. | ⚪ |
| 12.5 | 🟡 | No pre-commit secret scanning. | ⚪ |
| 12.6 | 🔴 | CDP WebSocket connections to Chrome debug ports unauthenticated. | ⚪ |
| 12.7 | 🔴 | Profile directories contain browser cookies/sessions unencrypted on disk. | ⚪ |
| 12.8 | 🟡 | Export encryption cipher/KDF details absent. | ⚪ |
| 12.9 | 🟡 | `providerStateJson` may contain PII — no field-level encryption. | ⚪ |
| 12.10 | 🟡 | CORS hardcoded to `localhost:5175`. | ⚪ |

---

## 13. Chrome/CDP Layer (10 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 13.1 | 🔴 | Fleet starts ALL providers at boot. 12 providers × 3 accounts = 36 Chrome instances. | ⚪ |
| 13.2 | 🟡 | No slave pooling. One Chrome per account, no sharing. | ⚪ |
| 13.3 | 🟡 | No Chrome binary auto-detection across OS/browsers. | ⚪ |
| 13.4 | 🔴 | Conflicting port ranges: 9300-9400 in `createServerWithEngines` vs 9222-9250 in `config.ts`. | ⚪ |
| 13.5 | 🟡 | Slave health check too shallow — only `Browser.getVersion`. | ⚪ |
| 13.6 | 🟡 | `FleetEvent` missing event types: memory exceeded, disk full, Chrome auto-update breakage. | ⚪ |
| 13.7 | 🟡 | No Chrome version compatibility matrix or graceful upgrade handling. | ⚪ |
| 13.8 | 🟡 | `ProfileAllocator` no stale profile cleanup. | ⚪ |
| 13.9 | 🟡 | No environment-based headless detection. | ⚪ |
| 13.10 | 🟡 | No CDP command batching for harness DAGs. | ⚪ |

---

## 14. Provider Muxing (6 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 14.1 | 🔴 | Mux picks first successful response — no quality scoring, no LLM-judge. | ⚪ |
| 14.2 | 🟡 | No response quality scoring. | ⚪ |
| 14.3 | 🔴 | `RoutingPreference` scores never updated from outcomes. Learning loop disconnected. | ⚪ |
| 14.4 | 🟡 | `CostOptimizer.estimateCost()` hardcoded to 1000 chars. | ⚪ |
| 14.5 | 🟡 | `ProviderLatencyLog` never written to. | ⚪ |
| 14.6 | 🟡 | No provider failover via `TransferPattern`. | ⚪ |

---

## 15. NLCL (8 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 15.1 | 🟡 | Command pattern catalog needs coverage audit. | ⚪ |
| 15.2 | 🔴 | `LocalLLMAdapter` not wired in default bootstrap. Hybrid resolver falls through. | ⚪ |
| 15.3 | 🟡 | `LLMSlaveResolver` latency is seconds per command (full browser interaction). | ⚪ |
| 15.4 | 🟡 | `FuzzyResolver` and `SemanticResolver` not in default resolver chain. | ⚪ |
| 15.5 | 🔴 | NLCL knowledge graph (`NlclGraphNode` + `NlclGraphEdge`) empty — no population. | ⚪ |
| 15.6 | 🟡 | Multi-turn NLCL doesn't track conversation state. | ⚪ |
| 15.7 | 🟡 | Composite command splitting handles simple cases only. | ⚪ |
| 15.8 | 🔴 | No NLCL golden test file with known inputs → expected intents. | ⚪ |

---

## 16. Frontend Infrastructure (11 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 16.1 | 🟡 | Shared component library empty — 1 file: `action-trigger.tsx`. | ⚪ |
| 16.2 | 🔴 | No error boundaries. Single render crash takes down entire canvas. | ⚪ |
| 16.3 | 🟡 | No loading states (skeleton, spinner, progress). | ⚪ |
| 16.4 | 🟡 | No empty states or onboarding. First run = blank canvas. | ⚪ |
| 16.5 | 🟡 | `useStreamBlocks` polling vs WebSocket live updates — needs verification. | ⚪ |
| 16.6 | 🟡 | No keyboard shortcut handler or cheat sheet in UI. | ⚪ |
| 16.7 | 🟡 | No responsive layout adaptation. | ⚪ |
| 16.8 | 🟡 | No theme system (dark/light). | ⚪ |
| 16.9 | 🔴 | `UIComponentRegistry` hardcodes componentKey → React component. DB-loaded HTML not rendered. | ⚪ |
| 16.10 | 🟡 | No frontend error capture to backend. | ⚪ |
| 16.11 | 🟡 | `agent-bridge.ts` undocumented. | ⚪ |

---

## 17. Testing (10 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 17.1 | 🔴 | 80%+ target with most engines having zero unit tests. | ⚪ |
| 17.2 | 🔴 | Critical paths untested: `ConversationManager.send()`, `ChromeGovernor`, `CapabilityResolutionEngine`, `StreamParserEngine`, `NLCLEngine`. | ⚪ |
| 17.3 | 🔴 | No store contract tests against implementations. | ⚪ |
| 17.4 | 🔴 | No integration test for full send pipeline. | ⚪ |
| 17.5 | 🔴 | No integration test for canvas layer lifecycle. | ⚪ |
| 17.6 | 🔴 | No integration test for NLCL pipeline. | ⚪ |
| 17.7 | 🟡 | No performance benchmarks. | ⚪ |
| 17.8 | 🟡 | No chaos/robustness tests. | ⚪ |
| 17.9 | 🟡 | No visual regression tests for canvas UI. | ⚪ |
| 17.10 | 🟡 | No accessibility tests for `UiComponent` rendering. | ⚪ |

---

## 18. Database & Storage (10 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 18.1 | 🟡 | No WAL checkpoint management. | ⚪ |
| 18.2 | 🔴 | No pre-migration backup step. | ⚪ |
| 18.3 | 🟡 | No migration rollback. | ⚪ |
| 18.4 | 🔴 | Two sources of truth: `ProviderDefinition.capabilitiesJson` vs `ProviderCapability` rows. | ⚪ |
| 18.5 | 🔴 | Two representations of same data: `ConversationMessage.blocksJson` vs `StreamBlock` rows. | ⚪ |
| 18.6 | 🟡 | No periodic `PRAGMA optimize` or vacuum. | ⚪ |
| 18.7 | 🟡 | No query performance monitoring (slow query log). | ⚪ |
| 18.8 | 🟡 | `getDb()` singleton breaks parallel testing. | ⚪ |
| 18.9 | 🟡 | No `ConfigEntry.configJson` schema validation. | ⚪ |
| 18.10 | 🟡 | `SchemaMeta` table — dead code? | ⚪ |

---

## 19. Documentation (10 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 19.1 | 🔴 | 60+ doc subdirectories, archived versions v3-v18. No clear canonical path. | ⚪ |
| 19.2 | 🟡 | ADR freshness unknown. | ⚪ |
| 19.3 | 🟡 | No comprehensive API documentation. | ⚪ |
| 19.4 | 🟡 | No engine dependency graph documented. | ⚪ |
| 19.5 | 🟡 | No contributing guide. | ⚪ |
| 19.6 | 🟡 | No architecture diagram. | ⚪ |
| 19.7 | 🔴 | No README.md at root. | ⚪ |
| 19.8 | 🟡 | Personal config files at repo root. | ⚪ |
| 19.9 | 🟡 | Root cruft: `.kilo/`, `C0-BlackBoxProject-0/`, provider folders. | ⚪ |
| 19.10 | 🟡 | `kilo.json` unreferenced. | ⚪ |

---

## 20. Observability & Debugging (8 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 20.1 | 🔴 | `KernelSpan` system only used by kernel bootstrap. No engine self-instruments. | ⚪ |
| 20.2 | 🟡 | Kernel events collected but invisible — no query interface, dashboard, export. | ⚪ |
| 20.3 | 🟡 | `TraceEntry` logged but no query endpoint. | ⚪ |
| 20.4 | 🔴 | No structured logger. `console.log` with `[tag]` prefix only. | ⚪ |
| 20.5 | 🟡 | `TelemetryAggregator` data unvisualized, no anomaly detection. | ⚪ |
| 20.6 | 🟡 | `HealthDigestEngine` not wired to scheduler. | ⚪ |
| 20.7 | 🟡 | Crash artifacts at repo root (server.err, server.log). | ⚪ |
| 20.8 | 🟡 | `metrics.ts` purpose unknown. | ⚪ |

---

## 21. Autonomous Execution (5 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 21.1 | 🔴 | Autonomous API unavailable if any engine construction fails (try/catch wrapper). | ⚪ |
| 21.2 | 🔴 | Zero default `PolicyRule` rows — every action unclassified → silently allowed. | ⚪ |
| 21.3 | 🟡 | No event-driven autonomous task creation. | ⚪ |
| 21.4 | 🟡 | `ReplayController` no UI integration, no visual diff. | ⚪ |
| 21.5 | 🟡 | `AgenticLoopEngine` planning logic is a stub. | ⚪ |

---

## 22. Cross-Cutting Concerns (9 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 22.1 | 🔴 | No graceful shutdown for in-flight operations. Mid-send kill = data loss. | ⚪ |
| 22.2 | 🟡 | No process health monitoring (heap, event loop lag). | ⚪ |
| 22.3 | 🔴 | No crash recovery on restart — half-written rows, zombie Chrome instances. | ⚪ |
| 22.4 | 🟡 | Config read at module load — no hot-reload. | ⚪ |
| 22.5 | 🟡 | Two competing config systems: `config.ts` vs `ConfigManager` engine. | ⚪ |
| 22.6 | 🟡 | No feature flags. | ⚪ |
| 22.7 | 🟡 | No telemetry opt-out or privacy notice. | ⚪ |
| 22.8 | 🟡 | `alasql` dependency — dead? | ⚪ |
| 22.9 | 🟡 | Dependencies stale in `bun.lock`. | ⚪ |

---

## 23. Migration & Upgrade (4 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 23.1 | 🔴 | No app version upgrade flow (migrations + data transforms + breaking change comms). | ⚪ |
| 23.2 | 🟡 | No plugin schema migration hook for provider data upgrades. | ⚪ |
| 23.3 | 🟡 | No automated pre-migration backup. | ⚪ |
| 23.4 | 🟡 | No downgrade path. | ⚪ |

---

## 24. First-Run Experience (4 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 24.1 | 🔴 | No onboarding wizard. | ⚪ |
| 24.2 | 🟡 | No sample data / demo mode for empty canvas. | ⚪ |
| 24.3 | 🟡 | No provider catalog UI for discovery. | ⚪ |
| 24.4 | 🟡 | No "Getting Started" layer template. | ⚪ |

---

## 25. Accessibility & i18n (3 items)

| ID | Severity | Item | Status |
|---|---|---|---|
| 25.1 | 🟡 | No i18n infrastructure — all text hardcoded English. | ⚪ |
| 25.2 | 🔴 | Canvas inherently inaccessible — no keyboard nav, screen reader support, focus management. | ⚪ |
| 25.3 | 🟡 | No accessibility guarantee for DB-loaded `UiComponent` HTML. | ⚪ |

---

## Totals

| Category | Total | 🔴 Critical | 🟡 Blocked/Minor |
|---|---|---|---|
| 1. Canvas & UI | 14 | 5 | 9 |
| 2. Plugin System | 13 | 6 | 7 |
| 3. Component Library | 11 | 6 | 5 |
| 4. Memory & Import | 13 | 8 | 5 |
| 5. Memory Unification | 10 | 3 | 7 |
| 6. Automation | 15 | 6 | 9 |
| 7. Workspace | 7 | 2 | 5 |
| 8. Sandbox Safety | 9 | 4 | 5 |
| 9. Data Portability | 11 | 6 | 5 |
| 10. Performance | 10 | 5 | 5 |
| 11. Reliability | 11 | 3 | 8 |
| 12. Security | 10 | 3 | 7 |
| 13. Chrome/CDP | 10 | 2 | 8 |
| 14. Muxing | 6 | 2 | 4 |
| 15. NLCL | 8 | 3 | 5 |
| 16. Frontend | 11 | 2 | 9 |
| 17. Testing | 10 | 6 | 4 |
| 18. Database | 10 | 2 | 8 |
| 19. Documentation | 10 | 2 | 8 |
| 20. Observability | 8 | 2 | 6 |
| 21. Autonomous | 5 | 2 | 3 |
| 22. Cross-cutting | 9 | 2 | 7 |
| 23. Migration | 4 | 1 | 3 |
| 24. First-Run | 4 | 1 | 3 |
| 25. Accessibility | 3 | 1 | 2 |
| **TOTAL** | **232** | **77** | **155** |

---

*Audit performed 2026-07-16. Items will be updated as resolved during development.*

---

## DEEP DIVE A: Master → Slave / Chrome Harness System

### Architecture Overview

The harness system has 6 layers:

```
ConversationManager (orchestrator)
  └─▶ ChromeGovernor (authority gate)
       ├── CDPProxy (mutex + circuit-breaker gate)
       │    └── CdpTransportImpl (WS sessions)
       │         └── BunCdpClient (raw WebSocket)
       ├── FleetSupervisor (process lifecycle)
       │    ├── ProfileAllocator (disk profiles)
       │    ├── launcher.ts (Bun.spawn)
       │    └── PortReaper (port cleanup)
       ├── HealthMonitor (periodic probes)
       └── TraceLog (audit trail)
```

**Key design decisions:**
- **Governor Canon**: only `ChromeGovernor` touches CDP. All engines call `governor.cdp.send()`.
- **Adopt-first**: `FleetSupervisor.spawn()` checks for live Chrome on the profile's port before launching. Reuses existing browser sessions.
- **Per-slave mutex**: `CDPProxy` serializes all CDP commands per slave via `AsyncMutex`, preventing concurrent sends to the same browser.
- **Session validation**: `CdpTransportImpl.send()` validates the CDP session before every command (except lightweight pings), auto-re-attaching to page targets on failure.

### Findings

**A.1** 🔴 Two competing fleet implementations. `FleetSupervisor` (in `executor/`) manages instances, mutexes, health probes, and circuit breakers — with the `SlaveLifecycle` state machine. `ChromeGovernor` (in `engines/`) has its own `HealthMonitor` class, its own circuit breaker logic (`CircuitBreaker` interface + `circuitRecordSuccess/Failure` free functions), and its own `AsyncMutex` class. These are near-duplicate implementations of the same concepts. The governor's `HealthMonitor` is wired into `setHealthMonitor()` during bootstrap, but `FleetSupervisor.startHealthProbe()` is also started via `governor.boot()` → `fleetSupervisor.boot()`. Two health probe loops on the same slaves.

**A.2** 🔴 `FleetSupervisor` circuit breaker vs `ChromeGovernor` circuit breaker — two independent state machines tracking the same slaves. `FleetSupervisor` uses in-memory `circuits: Map<string, {state, failures, openedAt}>` while `ChromeGovernor` uses `circuitBreakers: Map<string, CircuitBreaker>`. They are never synchronized. The `HealthMonitor.probe()` calls `cdp.send()` which goes through `CDPProxy.mutex`, but the `CircuitBreaker` it checks is the governor's map, not FleetSupervisor's. When `FleetSupervisor.ensureRunning()` checks its own circuit state, it sees a different set of failures.

**A.3** 🔴 The `slaves` getter on `ChromeGovernor` (line 851) is a *derived map* — it calls `this.fleetSupervisor.getAllInstances()` on every access and re-derives the entire map. This means every call to `slaves.get(slaveId)` burns an O(n) scan of all fleet instances. The getter is called from `cdp` getter (line 885), which is called on every CDP operation, and from `HealthMonitor` (which holds a reference to `this.slaves` — a stale snapshot from construction time!). The HealthMonitor's `this.slaves` reference was captured in `setHealthMonitor()` and never updates as new slaves spawn.

**A.4** 🔴 `allocatePort()` (line 803) returns `this.config.portRange[0]` unconditionally — always the same port. The real port allocation is in `FleetSupervisor.allocatePort()` which increments `this.nextPort`. Governor's `allocatePort()` is unused (good) but exists as a port-collision footgun.

**A.5** 🔴 `seedAccounts()` (line 808) is empty — it emits a `governor:accounts-seeded` event with zero work. No accounts are seeded. The actual seeding happens in `ProviderRegistrar.seedAll()` during bootstrap. This stub is misleading.

**A.6** 🔴 `reapOrphanedPorts()` (line 812) emits a noop event. The real reaping happens in `FleetSupervisor.boot()` → `portReaper.reap()`. Another misleading stub.

**A.7** 🟡 No slave concurrency model for multi-step operations. The `AsyncMutex` in `CDPProxy` serializes all CDP commands to a single slave, which is correct. But `ConversationManager.send()` is an 8-step pipeline that runs on a single slave — while it holds the mutex for `typeMessage` then `submitMessage`, no other send can use that slave. The `capture` phase has its own mutex (`CDPProxy.capture()` acquires/releases). But the gap between `submit` completing and `capture` starting is unguarded — another send could sneak in.

**A.8** 🟡 `FleetSupervisor.spawn()` generates instance IDs as `${providerSlug}_${accountId}_${Date.now()}`. Every spawn gets a new ID. The `ensureRunningForAccount` on governor searches by `providerId + accountId` tuple and calls `ensureRunning(existing.slaveId)`, but `ensureRunning` checks `instance.status` on the *old* instance — if the status is `crashed` or `error`, it calls `spawn()` again, producing a new ID. The old instance remains in the map with status `error`. Over time, dead instances accumulate in `FleetSupervisor.instances` with no cleanup.

**A.9** 🟡 `CdpTransportImpl.capture()` multi-target strategy is sophisticated — it attaches Network to all page targets and watches for `Target.targetCreated` during capture. But the DOM fallback selectors are Claude-specific (`div.font-claude-response`). No per-provider DOM selectors — ChatGPT, Gemini, DeepSeek all fall through to generic `article:last-of-type` which is fragile.

**A.10** 🟡 No CDP error classification. When `BunCdpClient.send()` fails, the error is passed up as a raw string. No distinction between: timeout, protocol error, Chrome crash, page navigation, dialog blocking, rate limiting. The `RetryEngine` can't apply appropriate retry strategies without classified errors.

**A.11** 🟡 `BunCdpClient` has auto-reconnect logic (ping/pong, exponential backoff) but no max reconnect attempts or total reconnect time bound. A Chrome instance that's dead but port is still held by zombie process will be retried indefinitely.

**A.12** 🟡 `launcher.ts` `launchChrome()` legacy entry (line 117) creates a temp profile at `/tmp/chrome-profile-${Date.now()}` when no `userDataDir` is provided. This means every call that doesn't pass a profile dir gets a fresh Chrome with no cookies — functionally broken for any logged-in provider. The real path (via `FleetSupervisor.spawn()`) passes `profileDir` from `ProfileAllocator`, so this is only a problem for direct `launchChrome()` callers.

**A.13** 🟡 `chrome-instance-profile.ts` has a user-agent override (line 178-179) hardcoded to Chrome 126. Chrome auto-updates. When Chrome 130 is installed, the browser identifies itself as Chrome 130, but the user-agent header says Chrome 126 — detectable bot signature.

**A.14** 🟡 `composer-typing.ts` `typeMessage()` supports 4 composer types but `composerTypeForProvider()` in conversation-manager only maps 3 providers. All others default to `'textarea'` which will silently fail on contenteditable-based composers (most modern AI chat UIs).

**A.15** 🟡 The `HarnessDAG` executor in `CDPProxy.executeHarnessPlan()` supports 7 action types (`type_text`, `submit`, `click`, `wait`, `navigate`, `capture`, `evaluate`). But `submit` only handles button click or Enter key — no support for: form submission, multi-step auth flows, file upload, drag-and-drop, scroll-into-view, or iframe interaction. These are needed for provider-specific actions like "attach file" or "switch model."

**A.16** 🟡 `ProviderSelector` lists (`COMPOSER_SELECTORS`, `SEND_BUTTON_SELECTORS`) have 3 providers hardcoded. The DB model `ProviderEndpoint.selectorsJson` + `composerType` + `sendMethod` supports per-provider selector configuration, but the conversation-manager uses hardcoded maps, not DB-driven selectors. The `SelectorHealer` engine exists but isn't wired into the send pipeline.

**A.17** 🔴 `ChromeGovernor` has a `profileAllocator` and `FleetSupervisor` has its own `profileAllocator` (line 132). Both constructed with the same `chromeProfileBase`. They share no state. If the governor's allocator creates a profile dir at `getPath()`, the fleet's allocator creates the same path a second time (idempotent via `mkdir recursive`, but two allocators is brittle).

---

## DEEP DIVE B: Database Readiness

### Architecture

- **ORM**: Prisma v6.5 with SQLite provider
- **Models**: 2635-line schema with 54+ tables
- **Migrations**: 14 Prisma migrations in `prisma/migrations/`, plus 1 raw SQL baseline in `migrations/001_baseline.sql`
- **Access**: `CapStoreDb` wrapper (singleton) → PrismaClient → SQLite
- **WAL mode**: Configured via `configurePrisma()` at bootstrap, with 256MB mmap, -64MB cache, NORMAL synchronous mode

### Findings

**B.1** 🔴 Two migration systems. `prisma/migrations/` has 14 timestamped Prisma migrations. `migrations/` has one file `001_baseline.sql`. The `CapStoreDb.applyMigration()` method reads raw SQL and tracks applied migrations in `migration_log`. This suggests the app was originally raw SQL then migrated to Prisma, but both systems co-exist. Which is authoritative? A new developer running `prisma migrate deploy` applies only the Prisma migrations. The `001_baseline.sql` is orphaned.

**B.2** 🔴 `config.storage.encryptDb` flag exists but is never read. `DbEncryptionEngine` exists but is never constructed. The `EncryptionEngine` is constructed in `createServerWithEngines` only as a dependency for `ExportEngine`, and even then it's wrapped in try/catch that silently skips. Zero data encryption at rest.

**B.3** 🔴 No foreign key enforcement in SQLite. Prisma schema declares relations with `onDelete: Cascade`, `onDelete: SetNull`, etc., but these are ORM-level, not DB-level. SQLite foreign keys are enabled via `PRAGMA foreign_keys = ON` in `configurePrisma()`. However, if any raw SQL bypasses Prisma (e.g., `B.1`'s `applyMigration`), FK constraints don't apply. Direct SQLite CLI access could corrupt referential integrity.

**B.4** 🔴 `CapStoreDb` singleton (`getDb()` returns `_db`) is process-global. Every engine gets the same instance. Tests call `setDb(db)` to swap. But `getPrisma()` is a separate singleton in `prisma.ts` — two competing singletons that must stay in sync. If a test calls `setDb(new CapStoreDb())` but doesn't also replace the Prisma singleton, existing store impls hold stale PrismaClient references.

**B.5** 🟡 JSON-string fields proliferate. The schema has 50+ `*Json` columns storing JSON as text. SQLite has JSON functions (`json_extract`, `json_each`) but Prisma's SQLite provider treats them as `String`. Any query filtering or sorting on JSON fields requires raw SQL or post-fetch filtering. For example: `UiComponent.tagsJson` — searching for "all components with tag 'gmail'" requires loading all components and parsing JSON in TypeScript.

**B.6** 🟡 `ProviderDefinition.capabilitiesJson` + `modelsJson` duplicate normalized data in `ProviderCapability` and `ProviderModel` tables. The seed process (`ProviderRegistrar.seedAll()`) writes both, but what keeps them in sync? If `ProviderCapability` rows are added directly, `capabilitiesJson` on the parent row becomes stale. Two sources of truth.

**B.7** 🟡 `ConversationMessage.blocksJson` vs `StreamBlock` rows — same denormalization problem. `blocksJson` stores the parsed content blocks as a JSON array. `StreamBlock` stores the same blocks as individual rows indexed by `(conversationId, messageId, blockIndex)`. The `StreamBlockStore` writes `StreamBlock` rows during progressive streaming. Who writes `blocksJson`? The `ConversationManager.send()` pipeline? If not, `blocksJson` is always `'[]'` and the frontend must read `StreamBlock` rows instead. The API contract is ambiguous.

**B.8** 🟡 No read-replica or connection pooling needed (single-user local app), but SQLite's single-writer limitation is real. WAL mode allows concurrent readers + one writer, which is fine for a single-user desktop app. But if WebSocket event processing and health probes and conversation sends all write concurrently, SQLite's busy_timeout (5s) is the only backpressure. No write queue, no priority ordering.

**B.9** 🟡 No database integrity verification at startup. `PRAGMA integrity_check` is never run. SQLite databases can corrupt (power loss, crash during write, disk full). The app boots and reads corrupted data silently.

**B.10** 🟡 Migration history is fragile. `migration_log` tracks `filename + checksum + appliedAt`. But Prisma's `_prisma_migrations` table tracks the same data. Two migration logs. If a Prisma migration's checksum changes (schema drift), Prisma refuses to run. The raw SQL `migration_log` has no such protection — a modified SQL file re-runs without warning.

**B.11** 🟡 The schema has no soft-delete pattern. `ProviderDefinition.isActive`, `CapabilityBinding.status`, `CapabilityMacro.isActive` use integer flags. But `Conversation`, `ConversationMessage`, `StreamBlock`, `MemoryEngine` have no `isActive`/`deletedAt` column. Deleting a conversation is a hard delete. No trash/recovery.

**B.12** 🟡 No full-text search. `SemanticSearchEngine` uses vector embeddings (currently noop zero-vectors). For a local app, FTS5 on `ConversationMessage.content` would provide instant keyword search across all imported conversations. The table has no FTS virtual table companion.

**B.13** 🟡 `ConfigEntry` schema has `scopeType` + `scopeId` nullable with a unique constraint. But the constraint is `@@unique([engineId, scopeType, scopeId])` — and SQLite treats `NULL` as distinct in unique constraints (unlike other DBs). This means multiple rows with `scopeId: null` for the same `(engineId, scopeType)` can coexist, silently creating duplicate config entries.

**B.14** 🟡 No schema for import/export manifest tracking. `ImportJob` and `ExportEngine` exist, but there's no table tracking what was exported, when, to where, with what checksum. The `ExportManifest` is an in-memory type only.

**B.15** 🔴 `ViewModel` tables from `prisma/views_002.sql` — the file exists but its contents are unknown (not read). Prisma doesn't support SQLite views natively, so these are likely raw SQL views created via migration. If a view references columns that a later migration renames, the view silently breaks.

**B.16** 🟡 No data retention policy tables. `BackupScheduler` exists but there's no `backup_entry` table in the schema. The `BackupEntry` type is exported from `index.ts` but no table stores backup history.

**B.17** 🔴 Prisma's `migrate dev` resets the database. The `package.json` script `prisma:migrate:dev` maps to `bunx prisma migrate dev`. In development this can wipe data. For a local-first app where the user's DB is their data, this command must never be runnable against a real DB. There's no safeguard.

**B.18** 🟡 The WAL pragma configuration in `configurePrisma()` is hardcoded. Tuning values (mmap_size: 256MB, cache_size: -64MB) are reasonable defaults but should be configurable per machine (available RAM varies). A machine with 4GB RAM shouldn't mmap 256MB for SQLite.

**B.19** 🟡 No `PRAGMA optimize` scheduled. SQLite recommends running `PRAGMA optimize` periodically (daily) after WAL checkpoint to update query planner statistics. No scheduler runs this.

**B.20** 🟡 `ContextBudgetConfig` table stores per-user context token allocation (system 10%, memory 15%, conversation 50%, situation 10%, reserve 15%). These percentages are fixed defaults but should be user-adjustable. The table schema supports it (single row per user), but no settings UI exists.

---

## DEEP DIVE C: Provider Import Adapter Gap Analysis

*(Appended per session request — maps directly to §4 Local Memory)*

The `KnowledgeIngestionEngine` declares `ImportSource: 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'generic' | 'manual'` but the actual adapter implementations are skeletal. Here's the gap per source:

### C.1 ChatGPT Export Format
ChatGPT exports `conversations.json` with structure:
```json
[{
  "title": "...",
  "create_time": 1234567890,
  "mapping": { "<node-id>": {
    "message": { "author": {"role": "user|assistant|system"},
    "content": {"content_type": "text|code|multimodal", "parts": [...]} },
    "parent": "<parent-node-id>",
    "children": ["<child-node-id>"]
  }}
}]
```
**Readiness**: No parser exists. The `mapping` structure is a non-linear graph that needs tree-walk reconstruction. Rich content parts (images, code blocks, tool calls) need `ContentUnit` population. Conversation tree branching (edits) needs `parent_message_id` linking.

### C.2 Claude Export Format
Claude exports individual conversation JSON files with a different schema. **Readiness**: No parser exists.

### C.3 Gemini Export
Google Takeout for Gemini produces JSON. **Readiness**: No parser exists.

### C.4 Generic/Manual
**Readiness**: Skeleton only. A user pasting raw text needs NLP-based conversation boundary detection. The `KnowledgeExtractor` should handle this but depends on the noop embedding.

### C.5 Required Adapter Architecture
Each import source needs:
1. **File format detector** — auto-detect ChatGPT vs Claude vs Gemini vs unknown
2. **Streaming parser** — JSON parse file in chunks (100MB+ files won't fit in memory)
3. **Conversation reconstructor** — assemble nodes into messages with correct ordering
4. **Deduplicator** — hash-based comparison to skip already-imported conversations
5. **Content enrichment** — parse rich content into `ContentUnit` rows (code blocks, images, tool use, thinking)
6. **Entity extractor** — run `KnowledgeExtractor` over imported messages (requires a real embedding model)
7. **Progress emitter** — emit `knowledge:import_progress` events with current/total counts

---

## DEEP DIVE D: Automation Execution Model

*(Appended — maps directly to §6 Automation)*

The `WorkflowEngine.execute()` loop:

```
for each node in topological order:
  if all dependencies complete:
    execute node
    if success → continue
    if failed → stop entire workflow
```

### D.1 Execution Order Flaw
`execute()` uses a simple sequential loop with dependency pre-check. A DAG with parallel branches still executes sequentially because the loop iterates one node at a time. For a workflow with branches A→B and A→C (both depend on A), B and C should execute in parallel via `Promise.all`.

### D.2 Missing Retry
Failed nodes kill the entire workflow. No per-node retry with backoff. The `RetryEngine` exists as an independent engine but is never called from `WorkflowEngine`. A `retry_config` on `WorkflowNode.config` should specify `maxRetries`, `backoffMs`, `backoffFactor`.

### D.3 Missing Timeout
No per-node timeout. A node that hangs (stuck CDP connection, infinite LLM generation) blocks the workflow forever. `WorkflowNode.config` should accept `timeoutMs`.

### D.4 Missing Result Propagation
`executeNode()` returns `{success, output}`. The output is stored on the node execution but never passed as input to downstream nodes. A node's output should be available to downstream nodes via a `$prev` or `$node.<id>` variable reference in their config.

### D.5 Missing Workflow Pause/Resume
`WorkflowNodeExecution.status: 'waiting_human'` is a valid state but nothing creates it. The `HitlGate` table exists for autonomous tasks but `WorkflowEngine` never creates one. A node with `requiresApproval: true` should create a `HitlGate`, pause execution, emit an event, and wait for external resolution.

### D.6 Condition Evaluation
`WorkflowEdge.condition` is a string field. The `evaluateCondition()` method doesn't exist. Conditions should be JS expressions evaluated against the source node's output, e.g., `$result.price > 100`. This requires a safe expression evaluator (the `safe-eval.ts` module exists for parser code — reuse it here).

---

*Audit performed 2026-07-16. Items will be updated as resolved during development.*
