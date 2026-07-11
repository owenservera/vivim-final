# 01 — Upgrade Objectives: Vision, Success Criteria, and Delta Analysis

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Source:** Codebase analysis of vivim-final v1.0.0 (137 units, 37 engines, ~65 tables)

---

## Meta-Objective

These 7 objectives compose into one outcome: **a local AI operating system that gives everyday users the same power engineering teams have — multi-model orchestration, context-aware automation, knowledge management, browser automation — wrapped in an interface that evolves from "simple chat" to "personal agent" as the user's needs grow.**

---

## Objective 1: The Sovereign Intelligence Layer

### Vision
Every conversation the user has with any AI provider becomes permanent, local, searchable knowledge — not locked in someone else's cloud.

### What This Means (Grounded in Current Code)
The current system has:
- `Conversation` + `ConversationMessage` + `StreamBlock` tables (schema.prisma L4, lines 515-605) that store messages from providers
- `EpisodicMemory`, `SemanticMemory`, `ProceduralRule` tables (schema.prisma L12, lines 1600-1658) for agent memory
- `MemoryEngine` (memory-engine.ts, 332 lines) with `recordEpisode`, `assertFact`, `createRule`, `recallEpisodes`, `recallFacts`, `minePatterns`, `consolidate`
- BUT: conversations are only from live provider sessions — no ingestion of external exports
- BUT: `MemoryEngine` uses non-ULID IDs (`mem_${Date.now()}_${counter}`, line 128)
- BUT: no structured extraction (facts, decisions, entities) from conversation content
- BUT: no semantic search — only keyword/tag matching
- BUT: no cross-conversation synthesis

### Success Criteria
1. User downloads their ChatGPT history export (JSON) → system ingests 500+ conversations, extracts 200+ facts, 45+ decisions, 12+ project threads → all searchable locally
2. User asks "what did I learn about React hooks across all my AI conversations?" → system returns synthesized answer citing specific conversations
3. User exports everything as JSON → zero data loss → importable into any other system
4. Memory uses ULID consistently (no ad-hoc ID formats)

### Before/After Table

| Aspect | Before (v1) | After (Upgrade) |
|--------|------------|-----------------|
| Conversation sources | Live provider sessions only | Live + imported from ChatGPT/Claude/Gemini |
| Memory IDs | `mem_${timestamp}_${counter}` | ULID (consistent with rest of system) |
| Fact extraction | None (manual) | Automatic Zod-validated extraction |
| Entity tracking | None | Named entities with provenance |
| Decision tracking | None | Explicit decisions with context |
| Search | Keyword + tag | Semantic (embedding-based) + keyword |
| Cross-conversation | None | Synthesis engine merges insights |
| Memory types | 3 (episodic, semantic, procedural) | 10 (adds entities, decisions, patterns, topics, projects, summaries, preferences) |
| Export | None | Full JSON/CSV export of all memory |

### What's Preserved
- All existing tables (`EpisodicMemory`, `SemanticMemory`, `ProceduralRule`, `Conversation`, `ConversationMessage`, `StreamBlock`)
- `MemoryEngine` class API (extended, not replaced)
- Store contract pattern
- EventBus integration

### New Engines/Tables/APIs/Components
- **Engines:** `KnowledgeIngestionEngine`, `KnowledgeExtractor`, `SemanticSearchEngine`, `CrossConversationSynthesizer`
- **Tables:** `Entity`, `EntityMention`, `DecisionRecord`, `PatternExtract`, `Topic`, `Project`, `ConversationTopic`, `ImportJob`, `MemoryEmbedding`
- **APIs:** `POST /api/knowledge/ingest`, `GET /api/knowledge/search`, `GET /api/knowledge/synthesize`, `GET /api/knowledge/export`
- **CLI:** `vivim knowledge ingest <file>`, `vivim knowledge search <query>`, `vivim knowledge export`

### Risk
- **Embedding storage:** SQLite doesn't natively support vectors. Mitigation: store embeddings as JSON arrays in `MemoryEmbedding` table, use cosine similarity in application code. For large datasets, consider `sqlite-vec` extension.
- **Import format volatility:** ChatGPT/Claude/Gemini export formats change. Mitigation: one parser per provider, versioned, with fallback to raw text.

### Priority: P1

---

## Objective 2: The Invisible Router

### Vision
The user never thinks about which AI to use. The system routes every request to the optimal provider based on capability, cost, latency, and learned preference.

### What This Means (Grounded in Current Code)
The current system has:
- `Router` class (router.ts, 207 lines) with priority-based dispatch through `RouteSpec` → `RouteTarget` → `RouteRequest` → `RouteEvent`
- `ProviderModel` table (schema.prisma L1, lines 193-216) with `pricingInputPer1m`, `pricingOutputPer1m`, `contextWindow`, `maxOutputTokens`, capability flags
- BUT: Router dispatches to ONE provider at a time — no fan-out
- BUT: No response synthesis (can't merge answers from multiple providers)
- BUT: No automatic failover between providers for the same capability
- BUT: No cost tracking or optimization
- BUT: No learned routing preferences
- BUT: `Router.listRequests` and `Router.getEvents` return empty arrays (stubs)

### Success Criteria
1. User asks a complex question → system fans out to Claude + GPT + Gemini → synthesizes best parts → user sees one coherent answer with "3 providers consulted" badge
2. If Claude is down, system automatically routes to the next best provider without user intervention
3. System learns that user prefers Claude for code, GPT for creative → future requests route accordingly
4. Monthly cost report shows per-provider spend, with recommendations for cost optimization

### Before/After Table

| Aspect | Before (v1) | After (Upgrade) |
|--------|------------|-----------------|
| Provider selection | Manual (user picks provider) | Automatic (system routes) |
| Multi-provider | Single provider per request | Fan-out to N providers, synthesis |
| Failover | None | Automatic (if provider A fails, try B) |
| Cost tracking | None | Per-request, per-provider, monthly |
| Routing intelligence | Static priority | Learned from outcomes |
| Response quality | Single provider | Synthesized from multiple |

### What's Preserved
- `Router` class (extended, not replaced)
- `RouteSpec`, `RouteTarget`, `RouteRequest`, `RouteEvent` tables
- `ProviderModel` table with pricing/capability data
- `ProviderHealthKernel` health signals

### New Engines/Tables/APIs/Components
- **Engines:** `ProviderMuxEngine`, `CostOptimizer`
- **Tables:** `MuxSession`, `MuxResponse`, `RoutingPreference`, `ProviderCostLog`, `ProviderLatencyLog`
- **APIs:** `POST /api/route/auto`, `POST /api/route/mux`, `GET /api/route/cost-report`
- **CLI:** `vivim route auto <message>`, `vivim route mux <message> --providers claude,gpt,gemini`

### Risk
- **Response synthesis quality:** Merging 3 provider responses requires LLM judgment. Mitigation: use the cheapest available provider for synthesis, fall back to concatenation if LLM unavailable.
- **Cost overrun:** Fan-out multiplies API costs. Mitigation: cost budget per request, configurable per-user.

### Priority: P1

---

## Objective 3: The Context-Aware Agent

### Vision
The system understands what the user is working on and assembles the right context automatically — before they ask.

### What This Means (Grounded in Current Code)
The current system has:
- `ConversationManager.send()` (conversation-manager.ts, lines 157-310) with a basic memory recall step calling `MemoryEngine.getAgentContext()` (line 171)
- `ConversationContext` interface (conversation-manager.ts, lines 60-80) with provider, account, chrome, capabilities, and optional memory
- BUT: Memory recall is a single call returning recent episodes + facts + rules — no ranking, no budget allocation, no situation detection
- BUT: No task type classification (can't tell coding from writing from research)
- BUT: No predictive pre-warming (doesn't anticipate what the user will need)
- BUT: No token budget management (all context treated equally)

### Success Criteria
1. User opens a conversation → system detects "software engineering task" → auto-injects relevant codebase context, recent decisions, project goals → user starts typing with full context already loaded
2. System pre-warms context at 9am because user typically reviews code then
3. Token budget allocated across layers: 40% identity/preferences, 30% topic/entity, 20% conversation history, 10% recent episodes
4. Context assembly takes <500ms p95

### Before/After Table

| Aspect | Before (v1) | After (Upgrade) |
|--------|------------|-----------------|
| Context source | Single `getAgentContext` call | 5-stage pipeline |
| Task detection | None | SituationDetector classifies task type |
| Context ranking | Chronological | Relevance-scored |
| Token budget | Unlimited | Budget-aware allocation |
| Pre-warming | None | Predictive (learns user patterns) |
| Context layers | 1 (recent episodes) | 7 (identity, preferences, topic, entity, conversation, recent, project) |

### What's Preserved
- `ConversationManager.send()` pipeline (extended with ContextAssemblyEngine)
- `ConversationContext` interface (extended with richer memory)
- `MemoryEngine.getAgentContext()` (called by ContextAssemblyEngine)
- `AgentMemoryContext` type

### New Engines/Tables/APIs/Components
- **Engines:** `SituationDetector`, `ContextAssemblyEngine`
- **Tables:** `SituationLog`, `ContextLayer`, `TokenBudget`
- **APIs:** `GET /api/context/assemble?conversationId=X`, `GET /api/context/situation`
- **CLI:** `vivim context show <conversationId>`, `vivim context warm`

### Risk
- **False positives in situation detection:** Wrong task classification wastes context tokens. Mitigation: confidence threshold, user override, learning from corrections.
- **Privacy:** Context assembly reads all user data. Mitigation: all local, no external calls.

### Priority: P2

---

## Objective 4: The Composable Interface

### Vision
Every capability is a building block — available in the UI, on the CLI, in workflows, and via plugins. No capability is locked to one surface.

### What This Means (Grounded in Current Code)
The current system has:
- `CommandRegistry` (cli/command-registry.ts, 36 lines) — CLI commands with Zod schemas
- `ActionRegistry` (web/ui/src/actions/registry.ts, 50 lines) — UI actions with Zod schemas
- `WorkflowEngine` (workflow-engine.ts, 361 lines) — DAG execution with trigger/action/logic/ai/data nodes
- `McpServerAdapter` (mcp-server-adapter.ts, 211 lines) — exposes Governor as MCP tools (but start() doesn't bind)
- BUT: CLI registry and UI registry are completely separate — no shared capability definitions
- BUT: No plugin hot-reload (plugins must be registered at boot)
- BUT: WebSocket AgentBridge exists but is basic (command/discover only)
- BUT: Workflow node types don't include "call capability" or "run CLI command"

### Success Criteria
1. User builds a workflow: "When I get a GitHub PR → summarize diff → check security → post review" — all composed from existing capabilities, no custom code
2. Every UI action has an equivalent CLI command with the same parameters
3. Third-party plugin dropped into `plugins/` directory is hot-loaded without restart
4. System controllable via WebSocket programmatic API (full bidirectional)

### Before/After Table

| Aspect | Before (v1) | After (Upgrade) |
|--------|------------|-----------------|
| Capability surfaces | Separate CLI and UI registries | Unified registry → CLI + UI + workflow + MCP |
| Plugin loading | Boot-time only | Hot-reload (file watcher) |
| Workflow nodes | 5 categories | 5 categories + capability_call + cli_command + plugin_call |
| WebSocket | Subscribe/unsubscribe + agent:command | Full bidirectional protocol |
| MCP server | Stub (doesn't bind) | Real MCP server on configurable port |

### What's Preserved
- `CommandRegistry` and `ActionRegistry` classes (both become views into UnifiedCapabilityRegistry)
- `WorkflowEngine` and `WorkflowCompiler`
- `AgentBridge`
- Zod validation pattern

### New Engines/Tables/APIs/Components
- **Engines:** `UnifiedCapabilityRegistry`, `PluginHotReload`
- **Tables:** `PluginRegistry`, `CliAlias`
- **APIs:** `GET /api/capabilities/all`, `POST /api/plugins/install`, `DELETE /api/plugins/:id`
- **CLI:** `vivim capabilities list`, `vivim plugins install <path>`, `vivim plugins reload`

### Risk
- **Plugin security:** Third-party code runs with full system access. Mitigation: sandbox plugins via `Function` constructor with limited scope, require explicit user approval for write operations.

### Priority: P2

---

## Objective 5: The Adaptive Workspace

### Vision
The interface evolves with the user — from simple chat to sophisticated multi-panel workspace to autonomous agent dashboard.

### What This Means (Grounded in Current Code)
The current system has:
- Web UI sandbox (web/sandbox/) with capability catalog + harness
- Provider setup wizard (web/ui/src/features/provider-setup-wizard.tsx)
- BUT: No workspace modes (same UI for casual question and complex project)
- BUT: Conversations are flat list — no project/topic organization
- BUT: No memory visualization (user can't see/edit what system knows)
- BUT: No adaptive UI (panels don't appear/disappear based on context)

### Success Criteria
1. New user asks "summarize this document" → sees clean chat interface
2. Six months later, same user has multi-panel workspace: memory graph, context assembly view, workflow builder, provider health dashboard — all evolved naturally from usage
3. User can see exactly what facts the system has extracted, edit incorrect ones, delete unwanted ones
4. Conversations organize into projects and topics automatically

### Before/After Table

| Aspect | Before (v1) | After (Upgrade) |
|--------|------------|-----------------|
| UI modes | Single mode | 3 modes (chat, expert, agent) |
| Conversation organization | Flat list | Projects → Topics → Conversations |
| Memory visibility | None | Full visualization with edit/delete |
| Context transparency | Hidden | Visible (user sees what was assembled) |
| Adaptive panels | Static | Context-driven (panels appear based on task) |

### What's Preserved
- Existing web/sandbox/ and web/ui/ structure
- `ActionRegistry` pattern
- React 19 + Zustand + Tailwind stack

### New Engines/Tables/APIs/Components
- **Engines:** `AdaptiveWorkspaceEngine`, `MemoryVisualizationEngine`
- **Tables:** `WorkspaceMode`, `UserPreference`, `MemoryCurated`, `MemoryFeedback`
- **APIs:** `GET /api/workspace/mode`, `PUT /api/workspace/mode`, `GET /api/memory/curated`, `PUT /api/memory/:id`, `GET /api/projects`, `POST /api/projects`
- **CLI:** `vivim workspace mode expert`, `vivim memory list`, `vivim memory edit <id>`

### Risk
- **UI complexity:** Too many panels overwhelm. Mitigation: progressive disclosure — panels appear only when user demonstrates need.

### Priority: P3

---

## Objective 6: The Autonomous Execution Engine

### Vision
The system can execute multi-step tasks autonomously — navigating Chrome, filling forms, managing conversations, running workflows — with human oversight only when needed.

### What This Means (Grounded in Current Code)
The current system has:
- `AgenticLoopEngine` (agentic-loop.ts, 98 lines) with sense→plan→act→observe→reflect→adapt — BUT the loop body says "Stub for v1" (line 63)
- `WorkflowEngine` (workflow-engine.ts, 361 lines) with DAG execution and HITL support
- `SelectorHealer` (selector-healer.ts, 316 lines) with 5 healing strategies
- `ChromeGovernor` with stub CDP methods (throws "implement in Phase 9")
- BUT: ChromeGovernor CDP is a stub — can't actually drive Chrome
- BUT: AgenticLoop sense/act steps are empty
- BUT: No execution policy engine (can't distinguish safe vs dangerous actions)
- BUT: No observability layer for autonomous actions

### Success Criteria
1. User says "find the cheapest flight to Paris next week and book it" → system navigates to Kayak, searches, compares, fills passenger details, pauses for payment approval → user confirms → done
2. Every autonomous action is traced, logged, and reviewable
3. Critical decisions pause for approval; routine actions execute automatically
4. If a selector breaks, SelectorHealer repairs it without user intervention

### Before/After Table

| Aspect | Before (v1) | After (Upgrade) |
|--------|------------|-----------------|
| Chrome CDP | Stub (throws) | Real (BunCdpClient wired) |
| Agentic loop | Stub body | Full sense→plan→act→observe→reflect→adapt |
| Execution policy | None | Policy engine (read/write/destructive classification) |
| HITL | Basic (workflow waiting_human) | Full gate system with approval/deny/skip |
| Observability | Trace entries | Full action trace + replay + audit |
| Self-healing | 5 strategies (exists) | 5 strategies + automatic fallback chain |

### What's Preserved
- `AgenticLoopEngine` class (extended)
- `WorkflowEngine` with HITL
- `SelectorHealer` with 5 strategies
- `HarnessRuntime` with DAG execution
- `ChromeGovernor` class (CDP transport wired)

### New Engines/Tables/APIs/Components
- **Engines:** `AutonomousExecutionEngine`, `ExecutionPolicyEngine`
- **Tables:** `AutonomousTask`, `AutonomousStep`, `HitlGate`
- **APIs:** `POST /api/autonomous/execute`, `GET /api/autonomous/status/:id`, `POST /api/autonomous/approve/:gateId`
- **CLI:** `vivim autonomous run <goal>`, `vivim autonomous status`, `vivim autonomous approve <id>`

### Risk
- **Unintended actions:** Autonomous system could do something dangerous. Mitigation: execution policy classifies every action, destructive actions always require approval.
- **Chrome instability:** Long-running automation may crash. Mitigation: checkpoint after every step, automatic resume.

### Priority: P1

---

## Objective 7: The Sovereign Data Platform

### Vision
All data lives locally. The user owns their intelligence. No telemetry, no cloud dependency, full portability.

### What This Means (Grounded in Current Code)
The current system has:
- SQLite database via Prisma (schema.prisma line 6)
- Local file storage for Chrome profiles
- BUT: No encryption at rest
- BUT: No WAL mode (performance and crash recovery)
- BUT: No export functionality
- BUT: No air-gap mode (system assumes network connectivity for provider access)
- BUT: No multi-device sync
- BUT: No telemetry audit (can't prove zero cloud calls)

### Success Criteria
1. User installs vivim → uses for 6 months → decides to switch → exports everything → imports into new system → zero lock-in
2. Database is encrypted at rest with user-supplied key
3. System works completely offline with local models (Ollama/llama.cpp)
4. Optional multi-device sync via E2E-encrypted relay
5. Telemetry audit proves zero outbound network calls except to user-chosen AI providers

### Before/After Table

| Aspect | Before (v1) | After (Upgrade) |
|--------|------------|-----------------|
| Encryption | None | AES-256 at rest (user key) |
| WAL mode | Not configured | Enabled (crash recovery, concurrent reads) |
| Export | None | Full JSON/CSV of all tables |
| Air-gap | Not supported | Full offline with local models |
| Multi-device | None | Optional E2E-encrypted sync |
| Telemetry proof | None | Network audit log (provable zero-cloud) |

### What's Preserved
- SQLite + Prisma stack
- All existing data (encryption is transparent)
- Provider access pattern (works with or without network)

### New Engines/Tables/APIs/Components
- **Engines:** `EncryptionEngine`, `ExportEngine`, `AirGapEngine`, `SyncEngine`
- **Tables:** `SyncLog`, `SyncPeer`
- **APIs:** `POST /api/export/full`, `GET /api/airgap/status`, `POST /api/sync/pair`, `GET /api/audit/network`
- **CLI:** `vivim export full`, `vivim airgap enable`, `vivim sync pair <peer>`, `vivim audit network`

### Risk
- **Key management:** User loses encryption key → data is unrecoverable. Mitigation: key escrow option (encrypted backup key stored locally, user-chosen passphrase).
- **Sync conflicts:** Multi-device concurrent writes. Mitigation: CRDT-inspired last-write-wins per table, with conflict log for manual resolution.

### Priority: P1

---

## Priority Summary

| Priority | Objectives | Rationale |
|----------|-----------|-----------|
| **P1** | 1, 2, 6, 7 | Core sovereignty: local knowledge, automatic routing, autonomous execution, data ownership |
| **P2** | 3, 4 | Enhancement: context awareness, composability |
| **P3** | 5 | Polish: adaptive workspace (builds on everything else) |

---

## What's NOT in Scope

- **Cloud hosting:** VIVIM is and remains local-first. No SaaS version.
- **Mobile app:** Local-first desktop only. Mobile access via sync.
- **Custom model training:** Uses existing provider models + local models, doesn't train.
- **Real-time voice:** Text and browser automation only.
- **Social features:** No sharing, no communities, no marketplace.
