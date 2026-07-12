# VIVIM-FINAL: COMPREHENSIVE SYSTEM DESIGN & ATOMIC FILE GENERATION

## ROLE

You are a principal systems architect with deep expertise in:
- TypeScript/Bun runtime architecture
- SQLite/Prisma ORM patterns
- React 19 frontend systems
- Chrome DevTools Protocol (CDP) automation
- Event-driven architecture (pub/sub, typed event buses)
- Knowledge graph database design
- Agentic workflow execution (DAG, state machines)
- Multi-provider AI orchestration

You have a 1M token context window. Use it fully. Read every file referenced before generating output.

---

## PROJECT IDENTITY

**Name:** vivim-final (cap-store v1 Knowledge Graph Rebuild)
**Runtime:** Bun
**Language:** TypeScript (strict mode, ESNext target)
**ORM:** Prisma v6.5
**Database:** SQLite (WAL mode, ~54 tables, 9 views)
**Frontend:** React 19 + Vite + Zustand + Tailwind
**Build:** tsup (ESM + DTS)
**Linter:** Biome
**Testing:** Bun test runner

**What it is:** A local-first AI conversation platform where capabilities, providers, parsers, and bindings are rows in a database — not hardcoded TypeScript files. The system is fully re-programmable: configuration, not code, controls runtime behavior. ChromeGovernor is the single I/O authority. The frontend sandbox is the prototype surface; validated components graduate to production.

---

## CORE ARCHITECTURAL INVARIANTS (NON-NEGOTIABLE)

1. **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Seeds Not Code:** Provider behavior is JSON manifests in `seeds/providers/`. Adding a provider = adding a JSON file.
3. **DB-Driven Runtime:** The database loads the runtime execution layer. Capability resolution, health scoring, parser selection, config overrides — all come from DB rows at runtime.
4. **Re-Programmable Engines:** Every lifecycle engine's behavior can be changed at runtime via ConfigManager. No restart required.
5. **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
6. **User Moments = Dev Strategy:** Every user journey moment (M-001 through M-014) maps to specific atomic units, components, stores, and API endpoints. The user journey IS the development roadmap.
7. **Sandbox → App Graduation:** Components are prototyped in `web/sandbox/`, validated with real backend, then graduated to `web/app/`.

---

## WHAT EXISTS TODAY (Truth State — Verified 2026-07-11)

### Backend Engines (40 files in `src/engines/`)

| Engine | Status | Async Methods | Notes |
|--------|--------|---------------|-------|
| `chrome-governor.ts` | REAL | 26 | Full CDP proxy, lifecycle, trace, health, mutex, circuit breaker |
| `conversation-manager.ts` | REAL | 5 | 8-step pipe, EventBus integration |
| `capability.ts` | REAL | 5 | Core capability engine |
| `capability-resolution.ts` | REAL | 2 | Polymorphic resolution |
| `capability-event-bus.ts` | REAL | 2 | Typed pub/sub |
| `capability-macro.ts` | REAL | 6 | Macro support |
| `capability-shape-registry.ts` | REAL | 2 | Shape-agnostic registration |
| `config-manager.ts` | REAL | 3 | Runtime config, no restart |
| `context-assembly.ts` | REAL | 9 | 5-stage pipeline |
| `provider-health.ts` | REAL | 4 | Health scoring |
| `provider-registrar.ts` | REAL | 5 | Provider registration |
| `registration-auditor.ts` | REAL | 7 | Audit trail |
| `version-manager.ts` | REAL | 13 | Versioning |
| `telemetry-aggregator.ts` | REAL | 12 | Telemetry collection |
| `stream-parser.ts` | REAL | 9 | DB-driven parser selection |
| `stream-block-store.ts` | REAL | 3 | ContentBlock persistence |
| `memory-engine.ts` | REAL | 17 | Episodic/semantic/procedural |
| `mirror-engine.ts` | REAL | 13 | UI ⇄ Chrome sync |
| `agentic-loop.ts` | REAL | 2 | sense→plan→act→observe |
| `workflow-engine.ts` | REAL | 17 | DAG execution |
| `workflow-compiler.ts` | REAL | 2 | JSON → HarnessDAG |
| `semantic-grounding.ts` | REAL | 10 | Accessibility + visual |
| `selector-healer.ts` | REAL | 6 | LLM-powered repair |
| `harness-runtime.ts` | REAL | 13 | Real context injection |
| `harness-protocol-engine.ts` | REAL | 2 | PromptAugmenter, ResponseExtractor, ActionRouter |
| `harness-checkpoint.ts` | REAL | 4 | Persistence |
| `provider-mux.ts` | REAL | 14 | Multi-provider mux |
| `cost-optimizer.ts` | REAL | 5 | Cost optimization |
| `unified-registry.ts` | REAL | 1 | Unified capability registry |
| `execution-policy.ts` | REAL | 6 | Execution policy |
| `autonomous-execution.ts` | REAL | 14 | Autonomous execution |
| `situation-detector.ts` | REAL | 4 | Situation detection |
| `adaptive-workspace.ts` | REAL | 4 | Workspace modes |
| `conversation-organizer.ts` | REAL | 5 | Projects/topics |
| `export.ts` | REAL | 2 | JSON/CSV export |
| `knowledge-extractor.ts` | REAL | 3 | Facts, decisions, patterns |
| `knowledge-ingestion.ts` | REAL | 5 | Ingestion |
| `semantic-search.ts` | REAL | 6 | Embedding search |
| `cross-conversation-synthesis.ts` | REAL | 2 | Synthesis |
| `plugin-system.ts` | REAL | 5 | Self-describing providers |
| `plugin-hot-reload.ts` | REAL | 4 | Hot reload |
| `observation-tap.ts` | REAL | 2 | Governor subsystem |
| `mcp-server-adapter.ts` | REAL | 3 | Governor as MCP server |
| `mcp-client-adapter.ts` | REAL | 4 | MCP providers |
| `manifest-inference.ts` | REAL | 3 | Manifest inference |
| `provider-discovery.ts` | REAL | 6 | Discovery engine |
| `transfer-accelerator.ts` | REAL | 3 | Transfer acceleration |
| `streaming-protocol.ts` | REAL | 4 | Progressive blocks |
| `execution-memoizer.ts` | REAL | 1 | Memoization |
| `state-transition.ts` | REAL | 3 | State recording |
| `session-checkpoint.ts` | REAL | 3 | Session checkpoint |
| `cost-optimizer.ts` | REAL | 5 | Cost optimization |

**Summary:** 40 engines, all with constructors and async methods. 16 have throw/PLACEHOLDER markers (partial stubs in some methods). Zero explicit TODO/STUB markers.

### Storage Contracts (30 files in `src/storage/contracts/`)

| Contract | Status |
|----------|--------|
| `conversation-store.ts` | EXISTS |
| `capability-store.ts` | EXISTS |
| `capability-resolution-store.ts` | EXISTS |
| `config-store.ts` | EXISTS |
| `governor-store.ts` | EXISTS |
| `health-store.ts` | EXISTS |
| `stream-block-store.ts` | EXISTS |
| `version-store.ts` | EXISTS |
| `telemetry-store.ts` | EXISTS |
| `registration-store.ts` | EXISTS |
| `provider-store.ts` | EXISTS |
| `mirror-store.ts` | EXISTS |
| `mux-store.ts` | EXISTS |
| `cost-store.ts` | EXISTS |
| `fleet-supervisor.ts` | EXISTS |
| `context-assembly-store.ts` | EXISTS |
| `situation-store.ts` | EXISTS |
| `organization-store.ts` | EXISTS |
| `parser-store.ts` | EXISTS |
| `stream-config-store.ts` | EXISTS |
| `workspace-store.ts` | EXISTS |
| `autonomous-store.ts` | EXISTS |
| `knowledge-extractor-store.ts` | EXISTS |
| `knowledge-ingestion-store.ts` | EXISTS |
| `cross-conversation-synthesis-store.ts` | EXISTS |
| `semantic-search-store.ts` | EXISTS |
| `router-store.ts` | EXISTS |
| `slave-setup-store.ts` | EXISTS |
| `hpe-session-store.ts` | EXISTS |

**Summary:** 30 contract files. All define typed interfaces for engine storage dependencies.

### Storage Impls (29 files in `src/storage/impl/`)

| Impl | Status | Size |
|------|--------|------|
| `conversation-store-impl.ts` | REAL | 7025 bytes |
| `capability-store-impl.ts` | REAL | 6370 bytes |
| `governor-store-impl.ts` | REAL | 7758 bytes |
| `health-store-impl.ts` | REAL | 6921 bytes |
| `version-store-impl.ts` | REAL | 11803 bytes |
| `registration-store-impl.ts` | REAL | 8891 bytes |
| `telemetry-store-impl.ts` | REAL | 7440 bytes |
| `mirror-store-impl.ts` | REAL | 5743 bytes |
| `mux-store-impl.ts` | REAL | 5157 bytes |
| `capability-resolution-store-impl.ts` | REAL | 2828 bytes |
| `router-store-impl.ts` | REAL | 6127 bytes |
| `knowledge-extractor-store-impl.ts` | REAL | 4893 bytes |
| `knowledge-ingestion-store-impl.ts` | REAL | 2741 bytes |
| `semantic-search-store-impl.ts` | REAL | 3471 bytes |
| `cross-conversation-synth-store-impl.ts` | REAL | 2106 bytes |
| `context-assembly-store-impl.ts` | REAL | 1471 bytes |
| `situation-store-impl.ts` | REAL | 1803 bytes |
| `autonomous-store-impl.ts` | REAL | 5479 bytes |
| `parser-store-impl.ts` | REAL | 4004 bytes |
| `stream-config-store-impl.ts` | REAL | 4130 bytes |
| `cost-store-impl.ts` | REAL | 3001 bytes |
| `slave-setup-store-impl.ts` | REAL | 3920 bytes |
| `policy-store-impl.ts` | REAL | 2586 bytes |
| `episodic-memory-store-impl.ts` | REAL | 2581 bytes |
| `procedural-memory-store-impl.ts` | REAL | 2781 bytes |
| `semantic-memory-store-impl.ts` | REAL | 1900 bytes |
| `stream-block-store-impl.ts` | REAL | 551 bytes |
| `prisma-like.ts` | UTILITY | 1037 bytes |

**Summary:** 29 implementation files. All are real Prisma-based implementations.

### Server Routes (10 files in `src/server/`)

| Route | Status | Size |
|-------|--------|------|
| `index.ts` | REAL | 16569 bytes |
| `conversation-router.ts` | REAL | 4575 bytes |
| `websocket.ts` | REAL | 4359 bytes |
| `setup-router.ts` | REAL | 6048 bytes |
| `mux-router.ts` | REAL | 5676 bytes |
| `knowledge-router.ts` | REAL | 5973 bytes |
| `memory-viz-router.ts` | REAL | 2794 bytes |
| `autonomous-router.ts` | REAL | 4217 bytes |
| `auth-gate.ts` | REAL | 903 bytes |
| `response.ts` | REAL | 704 bytes |

**Summary:** 10 server files. Main entry + 6 routers + websocket + auth + response helpers.

### Executor (14 files in `src/executor/`, NO barrel)

| File | Status | Size |
|------|--------|------|
| `cdp.ts` | REAL | 6745 bytes |
| `cdp-transport.ts` | REAL | 4143 bytes |
| `cdp-types.ts` | REAL | 290 bytes |
| `launcher.ts` | REAL | 5054 bytes |
| `fleet-supervisor.ts` | REAL | 11953 bytes |
| `port-reaper.ts` | REAL | 5831 bytes |
| `profile-allocator.ts` | REAL | 3432 bytes |
| `slave-write.ts` | REAL | 4325 bytes |
| `slave-read.ts` | REAL | 4757 bytes |
| `async-mutex.ts` | REAL | 587 bytes |
| `circuit-breaker.ts` | REAL | 932 bytes |
| `content-blocks.ts` | REAL | 341 bytes |
| `fleet-config.ts` | REAL | 280 bytes |
| `ids.ts` | REAL | 335 bytes |

**Summary:** 14 executor files. NO `index.ts` barrel (Unit 11.11 is BLOCKED).

### Frontend Sandbox (4 files in `web/sandbox/src/`)

| File | Status |
|------|--------|
| `main.tsx` | EXISTS |
| `app/sandbox-app.tsx` | EXISTS |
| `features/capability-catalog.tsx` | EXISTS |
| `features/capability-harness.tsx` | EXISTS |
| `store/capability-store.ts` | EXISTS |

**Summary:** 5 frontend files. Minimal MVP: catalog + harness + debug panel.

### Frontend UI (3 files in `web/ui/src/`)

| File | Status |
|------|--------|
| `index.ts` | EXISTS |
| `actions/registry.ts` | EXISTS |
| `actions/agent-bridge.ts` | EXISTS |

**Summary:** 3 frontend files. ActionRegistry + AgentBridge only.

### Tests

| Category | Count | Files |
|----------|-------|-------|
| e2e | 5 | chatgpt-send, claude-send, multi-turn, performance, sandbox-feature |
| integration | 4 | setup, execution, fleet-integration, real-mode |
| unit/engines | 9+ | autonomous-execution, capability-event-bus, capability-resolution, capability, chrome-governor, config-manager, context-assembly, conversation-manager, cost-optimizer |
| unit/devops | 5 | decision, goals, invariants, select, tracker |
| unit/cli | 1 | registry-bridge |

### Prisma Schema (2132 lines)

- **115 models** (tables)
- **0 views** (views are in `prisma/seed.sql`)
- **SQLite** with WAL mode

### Atomic Tracker State

| Phase | Total | Done | Blocked | Pending |
|-------|-------|------|---------|---------|
| 1-13 (v1 core) | 139 | 136 | 3 | 0 |
| 14-20 (Sovereign OS) | 60 | 52 | 0 | 8 |
| 21 (v1 Gap Closure) | 41 | 0 | 0 | 41 |
| 22 (Agentic Discovery) | 15 | 0 | 0 | 15 |
| **TOTAL** | **215** | **177** | **3** | **35** |

### Critical Blockers

| Unit | Name | Reason |
|------|------|--------|
| 11.11 | Executor Barrel | `src/executor/index.ts` does not exist |
| 11.13 | MirrorEngine Action Stubs | 3 stubs need real CDP wiring |
| 13.10 | First Feature E2E | Proof sandbox system works end-to-end |

### Missing Frontend (User Journey Gaps)

| Component | Needed For | Status |
|-----------|------------|--------|
| ConversationList | M-005, M-011 | MISSING |
| CreateConversationModal | M-005 | MISSING |
| MessageThread | M-006, M-007, M-008 | MISSING |
| MessageComposer | M-006 | MISSING |
| MessageBubble | M-007, M-008 | MISSING |
| ProviderSelector | M-010 | MISSING |
| ProviderStatusBadge | M-004 | MISSING |
| CapabilityToolbar | M-009 | MISSING |
| CapabilityDetailPanel | M-013 | MISSING |
| CapabilityResultPanel | M-014 | MISSING |
| FleetStatusBar | M-012 | MISSING |
| useConversationStore | All conversation moments | MISSING |
| useFleetStore | M-004, M-012 | MISSING |
| useExecutionStore | M-014 | MISSING |

---

## THE USER JOURNEY MOMENTS (Development Strategy)

Every moment maps to atomic units, components, stores, and API calls:

### Phase A: Bootstrap
| Moment | User Goal | Units | Components | API |
|--------|-----------|-------|------------|-----|
| M-001 | "See what this app can do" | 90.1-90.8 | SandboxApp, CapabilityCatalog | GET /api/providers |
| M-002 | "See available capabilities" | 90.2, 13.9 | CapabilityCatalog (DB-backed) | GET /api/providers/:id/capabilities |

### Phase B: Connection
| Moment | User Goal | Units | Components | API |
|--------|-----------|-------|------------|-----|
| M-003 | "Connect my AI provider" | 14.2, 14.4, 13.11 | ProviderSetupWizard | POST /api/providers/:id/accounts |
| M-004 | "Session established" | 11.3, 11.4, 3.1 | ProviderStatusBadge | GET /api/fleet/status |

### Phase C: Conversation
| Moment | User Goal | Units | Components | API |
|--------|-----------|-------|------------|-----|
| M-005 | "Start a new conversation" | 100.1, 100.2 | ConversationList, CreateConversationModal | POST /api/conversations |
| M-006 | "Send a message" | 100.3, 100.4 | MessageThread, MessageComposer | POST /api/conversations/:id/send |
| M-007 | "Get a response" | 14.2, 14.5, 14.7, 100.5 | MessageBubble (WS-driven) | WebSocket conversation:complete |
| M-008 | "Read the response" | 3.2, 3.3, 3.8, 4.1, 100.5 | MessageBubble (markdown) | GET /api/conversations/:id/messages |

### Phase D: Capabilities
| Moment | User Goal | Units | Components | API |
|--------|-----------|-------|------------|-----|
| M-009 | "Use advanced features" | 5.3, 3.6, 100.7 | CapabilityToolbar | GET /api/conversations/:id/capabilities |
| M-013 | "See capability details" | 13.4, 13.6, 100.8 | CapabilityDetailPanel | GET /api/providers/:id/capabilities |
| M-014 | "Execute and see result" | 18.2, 13.6, 4.2, 14.7, 100.9 | CapabilityResultPanel | POST /execute + WS capability:progress |

### Phase E: System
| Moment | User Goal | Units | Components | API |
|--------|-----------|-------|------------|-----|
| M-010 | "Switch providers" | 100.6 | ProviderSelector | GET /api/providers |
| M-011 | "Manage conversations" | 100.1 | ConversationList | GET /api/conversations |
| M-012 | "See fleet health" | 100.10 | FleetStatusBar | GET /api/fleet/status |

---

## WHAT YOU MUST DESIGN

Based on the Truth Matrix above, here is what's MISSING and needs to be designed:

### Priority 1: Fix Backend Blockers (Sprint 1)
- Unit 11.11: Create `src/executor/index.ts` barrel (wiring + factory)
- Unit 11.13: Replace MirrorEngine 3 stubs with real CDP wiring
- Unit 13.10: First Feature E2E proof

### Priority 2: Missing Frontend Components (Sprint 2-5)
All 13 missing components listed in "Missing Frontend" section above.

### Priority 3: Missing Zustand Stores (Sprint 2-5)
- `useConversationStore` — conversation CRUD, message sending
- `useFleetStore` — provider fleet status
- `useExecutionStore` — capability execution tracking

### Priority 4: API Endpoints for Frontend (Sprint 2-5)
Endpoints needed by the user journey that may not exist:
- `GET /api/conversations` — list conversations
- `POST /api/conversations` — create conversation
- `POST /api/conversations/:id/send` — send message
- `GET /api/conversations/:id/messages` — get messages
- `GET /api/fleet/status` — fleet health
- `POST /execute` — capability execution

### Priority 5: Phase 19-22 Backend (Sprint 6+)
- Phase 19: Autonomous Execution (8 units)
- Phase 20: Sovereign Data (8 units)
- Phase 21: v1 Gap Closure (41 units)
- Phase 22: Agentic Discovery Tooling (15 units)

---

### Part 1: Complete Atomic File List

For EVERY missing unit (see Priority sections above), generate a complete atomic file with:

```markdown
# Unit X.Y — [Name]

**Phase:** [N]
**Depends:** [units]
**Status:** [pending|in_progress|done|blocked]

## Interface
[Exact TypeScript interface the engine/component must implement]

## Store Contract
[What the engine needs from storage — typed interface]

## Gate Criteria
- [ ] [Measurable criterion]
- [ ] [Measurable criterion]

## Test Scenarios
[Specific test cases with assertions]
```

### Part 2: Component Specifications

For EVERY frontend component, generate:

```markdown
# Component: [Name]

## Props Interface
[TypeScript props type]

## Visual State
[ASCII wireframe of the component]

## Store Integration
[Which Zustand store it uses, which actions it calls]

## API Calls
[Exact endpoints with request/response types]

## Test Scenario
[Playwright or React Testing Library test]
```

### Part 3: Store Definitions

For EVERY Zustand store, generate:

```typescript
interface [StoreName]State {
  // State
  [field]: [type]
  
  // Actions
  [action]: ([params]) => Promise<[return]>
}

export const use[StoreName] = create<[StoreName]State>()((set, get) => ({
  // implementation
}))
```

### Part 4: API Contract Mapping

For EVERY endpoint needed by the user journey, generate:

| Endpoint | Method | Request | Response | Engine Method | Moment |
|----------|--------|---------|----------|---------------|--------|
| `/api/conversations` | GET | `?providerId=&limit=&offset=` | `ConversationRow[]` | `ConversationStore.listConversations()` | M-005 |

### Part 5: Dependency Graph

Generate a complete dependency graph showing:
- Which backend units block which frontend moments
- Which frontend components depend on which stores
- Which stores call which API endpoints
- Critical path analysis

### Part 6: Implementation Order

Generate a sprint-by-sprint plan based on ACTUAL gaps:
- Sprint 1: Fix 3 backend blockers (11.11, 11.13, 13.10)
- Sprint 2: Conversation foundation (useConversationStore + ConversationList + CreateConversationModal + API endpoints)
- Sprint 3: Message flow (MessageComposer + MessageThread + MessageBubble + WS integration)
- Sprint 4: Provider UI (ProviderSelector + ProviderStatusBadge + FleetStatusBar)
- Sprint 5: Capability UI (CapabilityToolbar + CapabilityDetailPanel + CapabilityResultPanel)
- Sprint 6: Phase 19-22 backend (autonomous execution, sovereign data, gap closure, discovery)

---

## KEY DESIGN DOCUMENTS (Read These First)

1. `docs/merged-design-v2/00-merged-index.md` — Master map, glossary
2. `docs/merged-design-v2/01-merged-epic.md` — Why rebuild
3. `docs/merged-design-v2/02-merged-architecture.md` — System design, 13 engines
4. `docs/merged-design-v2/03-merged-schema.md` — ~54 tables, 9 views
5. `docs/merged-design-v2/04-merged-engines.md` — Engine interfaces
6. `docs/merged-design-v2/05-merged-lifecycles.md` — Lifecycle engines
7. `docs/merged-design-v2/06-merged-seeds.md` — Provider manifests
8. `docs/merged-design-v2/07-merged-api.md` — REST, SDK, WebSocket, UI Contract
9. `docs/merged-design-v2/08-merged-implementation.md` — Phase plan
10. `docs/atomic/PROGRESS.md` — Current truth state
11. `docs/user-stories-moments/00-atomic-list.md` — User journey atomic units
12. `docs/user-stories-moments/STORE-DEFINITIONS.md` — Store schemas
13. `docs/drafts/user-journey-completion-plan.md` — Moment-to-unit mapping

---

## CRITICAL CONSTRAINTS

### TypeScript Conventions
- Use `@/*` path aliases (maps to `./src/*`)
- Prefer `type` imports: `import type { Foo } from './bar.js'`
- Use `.js` extension in imports (Bun ESM requirement)
- No `any` — use `unknown` + type narrowing
- Use Zod for runtime validation at boundaries
- Use ULID for IDs (`src/ids.ts`)

### Error Handling
- Custom error classes from `src/errors.ts`
- Never swallow errors silently
- Use `Result<T, E>` pattern where appropriate

### Testing
- Unit tests: `tests/unit/` — test individual functions
- Integration tests: `tests/integration/` — test engine interactions
- E2E tests: `tests/e2e/` — full stack tests
- Mock store contracts for unit/isolation tests

### Frontend
- Zustand for state management
- Tailwind CSS for styling
- React 19 with hooks
- WebSocket for real-time events
- ActionRegistry for all UI actions
- AgentBridge for agent parity

---

## OUTPUT FORMAT

Generate your response as a structured document with:

1. **Executive Summary** — What you're designing
2. **Atomic File List** — Every file with interface, contract, gate criteria
3. **Component Specifications** — Every React component
4. **Store Definitions** — Every Zustand store
5. **API Contract Mapping** — Every endpoint
6. **Dependency Graph** — Visual ASCII or Mermaid
7. **Implementation Order** — Sprint-by-sprint plan
8. **Risk Assessment** — What could go wrong
9. **Success Criteria** — How we know it's done

---

## FINAL INSTRUCTION

Read ALL referenced documents. Understand the FULL architecture. Then generate a complete, actionable plan that:

1. Maps every user moment to atomic units
2. Specifies every interface, store, and API call
3. Identifies every blocker and its resolution
4. Provides a clear implementation order
5. Ensures the DB drives the runtime execution layer
6. Maintains all architectural invariants

The user journey IS the development strategy. Every M-001 through M-014 moment must have a clear path from backend engine → API endpoint → frontend component → user interaction.

Generate the complete plan now.
