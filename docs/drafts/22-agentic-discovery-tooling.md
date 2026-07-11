# Phase 22: Agentic Discovery Tooling

**Status:** DRAFT
**Priority:** P2 (extends SOTA-02 Shape-Agnostic Registration)
**Date:** 2026-07-11

---

## 1. Problem

Provider onboarding is manual. Adding a new AI chat provider requires:
1. Writing a JSON manifest by hand (`seeds/providers/*.json`)
2. Manually inspecting the provider's DOM to find selectors
3. Manually writing parser code (`seeds/parsers/*/*.ts`)
4. No way to discover capabilities automatically

The `ProviderDiscoveryEngine` (Phase 8.2) exists as a stub — in-memory sessions, no persistence, no LLM integration, no network observation. The `ManifestInferenceEngine` (Phase 8.3) is similarly skeletal. The adapter system (`seeds/adapters/`) doesn't exist.

**The gap:** No tooling for an AI agent to drive provider discovery end-to-end.

## 2. Solution: MCP Discovery Server

Build an **MCP (Model Context Protocol) server** that exposes provider discovery as agent-callable tools. An AI agent (Claude Code, OpenCode, any MCP client) connects to the server and uses tools to:

1. Navigate to a provider URL in Chrome
2. Inspect the DOM and accessibility tree
3. Click/type/interact with page elements
4. Observe network traffic patterns
5. Match against known provider shapes
6. Infer capabilities from DOM structure
7. Generate and validate a manifest
8. Test parsers against live responses
9. Approve and register the provider

**The agent IS the intelligence. The tools are the hands/eyes.**

### Why MCP (not REST)

- **Standard protocol** — Claude Code, OpenCode, Cursor, and other MCP clients connect natively
- **Tool definitions auto-discovered** — Client sees available tools without docs
- **Structured I/O** — JSON Schema inputs/outputs, no ad-hoc API shape knowledge
- **Streaming** — Long operations (navigation, DOM probing) can report progress

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  AI Agent (Claude Code / OpenCode / MCP Client)          │
│                                                          │
│  User: "Register perplexity.ai as a provider"           │
│  Agent: calls discover_start → discover_get_dom →        │
│         discover_click → discover_observe →              │
│         discover_match_shape → discover_generate →       │
│         discover_approve                                 │
└────────────────────┬─────────────────────────────────────┘
                     │ MCP protocol (stdio / SSE)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  Discovery MCP Server (src/mcp/)                         │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │ Tool Registry    │  │ Session Manager │               │
│  │ (25 tools)       │  │ (CRUD + state)  │               │
│  └────────┬────────┘  └────────┬────────┘               │
│           │                    │                         │
│  ┌────────┴────────────────────┴────────┐               │
│  │           Engine Delegates            │               │
│  └────────┬──────────┬──────────┬───────┘               │
└───────────┼──────────┼──────────┼───────────────────────┘
            │          │          │
            ▼          ▼          ▼
    ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │ Governor │ │ Discovery│ │ Manifest     │
    │ (CDP)    │ │ Engine   │ │ Inference    │
    └──────────┘ └──────────┘ └──────────────┘
            │          │          │
            ▼          ▼          ▼
    ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │ Chrome   │ │ Shape    │ │ Provider     │
    │ Browser  │ │ Registry │ │ Registrar    │
    └──────────┘ └──────────┘ └──────────────┘
```

### Tool Categories (25 tools)

| Category | Tools | Purpose |
|----------|-------|---------|
| **Session** | `discover_start`, `discover_get_session`, `discover_list_sessions`, `discover_delete_session` | Manage discovery sessions |
| **Navigation** | `discover_navigate`, `discover_get_page_state` | Navigate to URLs, check page state |
| **DOM** | `discover_get_dom`, `discover_get_accessibility_tree`, `discover_evaluate` | Inspect page structure |
| **Interaction** | `discover_click`, `discover_type`, `discover_scroll`, `discover_hover` | Interact with page elements |
| **Observation** | `discover_observe_start`, `discover_observe_stop`, `discover_observe_list`, `discover_intercept` | Capture network traffic |
| **Analysis** | `discover_match_shape`, `discover_infer_capabilities`, `discover_detect_parser_format` | Analyze provider structure |
| **Manifest** | `discover_generate_manifest`, `discover_validate_manifest`, `discover_edit_manifest` | Create/edit manifests |
| **Parser** | `discover_test_parser`, `discover_capture_response` | Test parsers against live responses |
| **Registration** | `discover_approve`, `discover_reject` | Finalize or discard discovery |

---

## 4. Store Contracts

### 4.1 DiscoveryStore

**File:** `src/storage/contracts/discovery-store.ts`

```typescript
interface DiscoverySessionRow {
  id: string
  url: string
  status: 'started' | 'navigating' | 'probing' | 'analyzing' | 'complete' | 'failed' | 'approved' | 'rejected'
  shapeId: string | null
  confidence: number
  capabilitiesJson: string          // stringified string[]
  interactiveJson: string           // stringified interactive elements
  parserFormat: string | null
  manifestDraftJson: string | null  // stringified ProviderManifestDraft
  error: string | null
  agentId: string | null            // which agent drove this session
  createdAt: number
  updatedAt: number
}

interface DiscoveryObservationRow {
  id: string
  sessionId: string
  url: string
  method: string
  status: number
  resourceType: string
  requestHeadersJson: string
  requestBodyJson: string | null
  responseHeadersJson: string
  responseBodyPreview: string | null  // first 4KB
  durationMs: number | null
  createdAt: number
}

interface DiscoveryStore {
  // Sessions
  createSession(row: DiscoverySessionRow): Promise<void>
  updateSession(id: string, updates: Partial<DiscoverySessionRow>): Promise<void>
  getSession(id: string): Promise<DiscoverySessionRow | null>
  listSessions(opts?: { status?: string; limit?: number }): Promise<DiscoverySessionRow[]>
  deleteSession(id: string): Promise<void>

  // Observations
  createObservation(row: DiscoveryObservationRow): Promise<void>
  getObservations(sessionId: string, opts?: { limit?: number }): Promise<DiscoveryObservationRow[]>
  deleteObservations(sessionId: string): Promise<void>
}
```

### 4.2 ShapeBindingStore

**File:** `src/storage/contracts/shape-binding-store.ts`

```typescript
interface ProviderShapeBindingRow {
  id: string
  providerId: string
  archetypeId: string
  shapeId: string
  configJson: string | null
  isActive: number
  createdAt: number
}

interface ShapeBindingStore {
  createBinding(row: ProviderShapeBindingRow): Promise<void>
  getBinding(providerId: string): Promise<ProviderShapeBindingRow | null>
  updateBinding(id: string, updates: Partial<ProviderShapeBindingRow>): Promise<void>
  deleteBinding(providerId: string): Promise<void>
}
```

---

## 5. Enhanced Engine Interfaces

### 5.1 ProviderDiscoveryEngine (Enhanced)

The existing engine (`src/engines/provider-discovery.ts`) is a stub. Enhance it to:

1. **Persist sessions** to DiscoveryStore (not in-memory Map)
2. **Accept a Governor reference** for CDP operations (already has it)
3. **Add network observation** — capture requests/responses during probing
4. **Add interactive probing** — click/type and observe DOM mutations
5. **Add LLM-assisted analysis** — delegate to agent via MCP (agent does the LLM call, engine provides the data)

**Key change:** Remove the in-memory `sessions` Map. All session state flows through DiscoveryStore.

```typescript
// Enhanced interface
class ProviderDiscoveryEngine {
  constructor(
    private governor: ChromeGovernor,
    private shapeRegistry: CapabilityShapeRegistry,
    private store: DiscoveryStore,           // NEW: persistence
    private eventBus: CapabilityEventBus,
  ) {}

  // Session management (persisted)
  async createSession(url: string, opts?: DiscoveryOptions): Promise<DiscoverySession>
  async getSession(sessionId: string): Promise<DiscoverySession | null>
  async updateSession(sessionId: string, updates: Partial<DiscoverySession>): Promise<void>
  async listSessions(opts?: { status?: string }): Promise<DiscoverySession[]>

  // Page operations (CDP through Governor)
  async navigate(sessionId: string, url: string): Promise<PageState>
  async getDomSnapshot(sessionId: string): Promise<DomSnapshot>
  async getAccessibilityTree(sessionId: string): Promise<AccessibilityNode>
  async click(sessionId: string, selector: string): Promise<DomMutationResult>
  async type(sessionId: string, selector: string, text: string): Promise<DomMutationResult>
  async evaluate(sessionId: string, expression: string): Promise<unknown>
  async screenshot(sessionId: string): Promise<Buffer>

  // Network observation
  async startObservation(sessionId: string, pattern?: string): Promise<void>
  async stopObservation(sessionId: string): Promise<void>
  async getObservations(sessionId: string): Promise<NetworkObservation[]>
  async interceptResponse(sessionId: string, pattern: string): Promise<string>

  // Analysis (agent does LLM calls, engine provides data)
  matchShape(sessionId: string): Promise<ShapeMatchResult>
  inferCapabilities(sessionId: string): Promise<InferredCapability[]>
  detectParserFormat(sessionId: string): Promise<string | null>

  // Manifest
  generateManifest(sessionId: string): Promise<ProviderManifestDraft>
  validateManifest(manifest: unknown): Promise<ValidationResult>

  // Registration
  approve(sessionId: string, manifest?: ProviderManifestDraft, approver?: string): Promise<RegisterResult>
  reject(sessionId: string, reason: string): Promise<void>
}
```

### 5.2 ManifestInferenceEngine (Enhanced)

Add confidence annotations and review workflow:

```typescript
interface InferredManifest {
  manifest: ProviderManifest
  fieldConfidence: Record<string, number>  // per-field confidence
  needsReview: string[]                     // fields with confidence < 0.7
  llmInferred: string[]                     // fields from LLM analysis
  warnings: string[]
}

class ManifestInferenceEngine {
  async infer(session: DiscoverySession): Promise<InferredManifest>
  async applyEdits(manifest: ProviderManifest, edits: ManifestEdits): Promise<ProviderManifest>
  async validate(manifest: ProviderManifest): Promise<ValidationResult>
}
```

### 5.3 CapabilityShapeRegistry (Enhanced)

Add adapter loading and shape inheritance:

```typescript
class CapabilityShapeRegistry {
  // Existing
  getShape(shapeId: string): CapabilityShape | null
  matchShape(domIndicators: DomIndicator[]): ShapeMatchResult | null
  registerShape(shape: CapabilityShape): void

  // New
  getAdapter(shapeId: string): CapabilityAdapter | null
  registerAdapter(adapter: CapabilityAdapter): void
  loadAdaptersFromDir(adapterDir: string): Promise<void>  // load seeds/adapters/
  getChildShapes(parentShapeId: string): CapabilityShape[]  // inheritance
}
```

### 5.4 ProviderRegistrar (Enhanced)

Shape-aware registration:

```typescript
class ProviderRegistrar {
  // Existing
  async register(manifest: ProviderManifest): Promise<RegisterResult>

  // New: shape-aware registration
  async registerWithShape(
    manifest: ProviderManifest,
    shapeBinding: { shapeId: string; archetypeId: string; configJson?: string }
  ): Promise<RegisterResult>
}
```

---

## 6. MCP Server

### 6.1 Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

### 6.2 Server Entry

**File:** `src/mcp/server.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

// Register all discovery tools
// Wire to engines
// Start stdio transport
```

### 6.3 Tool Definitions

**File:** `src/mcp/discovery-tools.ts`

Each tool is defined with:
- `name` — tool name (e.g., `discover_start`)
- `description` — what it does
- `inputSchema` — JSON Schema for inputs
- `handler` — async function that executes the tool

### 6.4 Tool Specifications

#### Session Management

```typescript
discover_start:
  input: { url: string, shapeHint?: string, providerNameHint?: string }
  output: { sessionId: string, status: string, url: string }
  handler: engine.createSession(url, { shapeHint, providerNameHint })

discover_get_session:
  input: { sessionId: string }
  output: DiscoverySession (full state)
  handler: engine.getSession(sessionId)

discover_list_sessions:
  input: { status?: string, limit?: number }
  output: DiscoverySession[]
  handler: engine.listSessions({ status, limit })

discover_delete_session:
  input: { sessionId: string }
  output: { ok: boolean }
  handler: engine.deleteSession(sessionId)
```

#### Navigation

```typescript
discover_navigate:
  input: { sessionId: string, url: string }
  output: { url: string, title: string, readyState: string }
  handler: engine.navigate(sessionId, url)

discover_get_page_state:
  input: { sessionId: string }
  output: { url: string, title: string, readyState: string }
  handler: engine.getPageState(sessionId)
```

#### DOM Inspection

```typescript
discover_get_dom:
  input: { sessionId: string, depth?: number }
  output: { url, title, forms, inputs[], buttons[], textareas, hasCodeEditor, hasCanvas, ... }
  handler: engine.getDomSnapshot(sessionId)

discover_get_accessibility_tree:
  input: { sessionId: string }
  output: AccessibilityNode (full tree)
  handler: engine.getAccessibilityTree(sessionId)

discover_evaluate:
  input: { sessionId: string, expression: string }
  output: { result: unknown, type: string }
  handler: engine.evaluate(sessionId, expression)
```

#### Interaction

```typescript
discover_click:
  input: { sessionId: string, selector: string, waitAfterMs?: number }
  output: { ok: boolean, selector: string, domChanged: boolean }
  handler: engine.click(sessionId, selector)

discover_type:
  input: { sessionId: string, selector: string, text: string, submit?: boolean }
  output: { ok: boolean, selector: string }
  handler: engine.type(sessionId, selector, text)

discover_scroll:
  input: { sessionId: string, direction: 'up'|'down'|'left'|'right', amount?: number }
  output: { ok: boolean }
  handler: engine.scroll(sessionId, direction, amount)

discover_hover:
  input: { sessionId: string, selector: string }
  output: { ok: boolean }
  handler: engine.hover(sessionId, selector)
```

#### Network Observation

```typescript
discover_observe_start:
  input: { sessionId: string, pattern?: string }
  output: { ok: boolean, observationId: string }
  handler: engine.startObservation(sessionId, pattern)

discover_observe_stop:
  input: { sessionId: string }
  output: { ok: boolean, capturedCount: number }
  handler: engine.stopObservation(sessionId)

discover_observe_list:
  input: { sessionId: string, limit?: number }
  output: NetworkObservation[]
  handler: engine.getObservations(sessionId, { limit })

discover_intercept:
  input: { sessionId: string, pattern: string, timeoutMs?: number }
  output: { body: string, durationMs: number }
  handler: engine.interceptResponse(sessionId, pattern, timeoutMs)
```

#### Analysis

```typescript
discover_match_shape:
  input: { sessionId: string }
  output: { shapeId: string, confidence: number, shapeName: string } | null
  handler: engine.matchShape(sessionId)

discover_infer_capabilities:
  input: { sessionId: string }
  output: InferredCapability[]
  handler: engine.inferCapabilities(sessionId)

discover_detect_parser_format:
  input: { sessionId: string }
  output: { format: string, archetype: string, evidence: string[] }
  handler: engine.detectParserFormat(sessionId)
```

#### Manifest

```typescript
discover_generate_manifest:
  input: { sessionId: string }
  output: { manifest: ProviderManifestDraft, warnings: string[] }
  handler: engine.generateManifest(sessionId)

discover_validate_manifest:
  input: { manifest: ProviderManifest }
  output: { valid: boolean, errors: string[], warnings: string[] }
  handler: engine.validateManifest(manifest)

discover_edit_manifest:
  input: { sessionId: string, edits: ManifestEdits }
  output: ProviderManifestDraft
  handler: engine.editManifest(sessionId, edits)
```

#### Parser Testing

```typescript
discover_test_parser:
  input: { sessionId: string, parserFile: string, pattern?: string }
  output: { blocks: ContentBlock[], confidence: number, rawLength: number }
  handler: engine.testParser(sessionId, parserFile, pattern)

discover_capture_response:
  input: { sessionId: string, pattern: string, timeoutMs?: number }
  output: { body: string, headers: Record<string,string>, durationMs: number }
  handler: engine.captureResponse(sessionId, pattern, timeoutMs)
```

#### Registration

```typescript
discover_approve:
  input: { sessionId: string, manifest?: ProviderManifest, approver?: string }
  output: RegisterResult
  handler: engine.approve(sessionId, manifest, approver)

discover_reject:
  input: { sessionId: string, reason: string }
  output: { ok: boolean }
  handler: engine.reject(sessionId, reason)
```

---

## 7. Agent Workflow

The intended workflow for an AI agent:

```
Agent: "I'll register perplexity.ai as a provider"

1. discover_start(url: "https://perplexity.ai")
   → { sessionId: "disc_...", status: "started" }

2. discover_navigate(sessionId, url: "https://perplexity.ai")
   → { url: "https://perplexity.ai", title: "Perplexity", readyState: "complete" }

3. discover_get_dom(sessionId)
   → { inputs: [...], buttons: [...], textareas: [...], ... }
   Agent analyzes: "This is a search engine shape. Has search input, no textarea."

4. discover_click(sessionId, selector: "input[type='search']")
   → { ok: true }
   Agent: "Found the search box"

5. discover_type(sessionId, selector: "input[type='search']", text: "test query")
   → { ok: true }

6. discover_observe_start(sessionId)
   → { ok: true }

7. discover_click(sessionId, selector: "button[type='submit']")
   → { ok: true }
   Agent: "Submitted search, now observing network"

8. discover_observe_list(sessionId)
   → [ { url: "/api/search", method: "POST", status: 200, ... } ]
   Agent: "Found API endpoint. Response is JSON."

9. discover_match_shape(sessionId)
   → { shapeId: "search_engine", confidence: 0.85 }

10. discover_infer_capabilities(sessionId)
    → [ { slug: "search", confidence: 0.9 }, { slug: "results_display", confidence: 0.8 } ]

11. discover_generate_manifest(sessionId)
    → { manifest: { slug: "perplexity-ai", displayName: "Perplexity", ... }, warnings: [] }

12. discover_validate_manifest(manifest)
    → { valid: true, errors: [], warnings: [] }

13. discover_approve(sessionId, manifest)
    → { providerId: "perplexity-ai", status: "created", ... }
    Agent: "Perplexity.ai registered successfully"
```

---

## 8. Atomic Units

### Phase 22: Agentic Discovery Tooling (15 units)

| Unit | Name | Depends On | Effort | Description |
|------|------|------------|--------|-------------|
| 22.1 | DiscoveryStore contract | — | S | Store interface for sessions + observations |
| 22.2 | DiscoveryStore Prisma impl | 22.1 | M | Prisma implementation of DiscoveryStore |
| 22.3 | ShapeBindingStore contract | — | S | Store interface for provider shape bindings |
| 22.4 | ShapeBindingStore Prisma impl | 22.3 | S | Prisma implementation |
| 22.5 | Enhanced ProviderDiscoveryEngine | 22.1, 22.3 | L | Rewrite: persistence, network obs, interactive probing, state machine |
| 22.6 | Enhanced ManifestInferenceEngine | 22.5 | M | Confidence scoring, field-level review, needsReview detection |
| 22.7 | Enhanced CapabilityShapeRegistry | — | M | Adapter loading, shape inheritance, `getChildShapes()` |
| 22.8 | Adapter seed modules | 22.7 | M | `seeds/adapters/`: chat_app, coding_ide, search_engine, custom |
| 22.9 | MCP Server scaffold | — | M | Stdio transport, tool registry, engine wiring |
| 22.10 | MCP tools: Session + Navigation | 22.5, 22.9 | S | 6 tools: start, get, list, delete, navigate, page_state |
| 22.11 | MCP tools: DOM + Interaction | 22.5, 22.9 | M | 7 tools: get_dom, a11y_tree, evaluate, click, type, scroll, hover |
| 22.12 | MCP tools: Network Observation | 22.5, 22.9 | S | 4 tools: observe_start/stop/list, intercept |
| 22.13 | MCP tools: Analysis + Manifest | 22.6, 22.9 | M | 6 tools: match_shape, infer_caps, detect_parser, generate/validate/edit manifest |
| 22.14 | MCP tools: Parser Testing | 22.5, 22.9 | M | 2 tools: test_parser, capture_response |
| 22.15 | MCP tools: Registration | 22.5, 22.9 | S | 2 tools: approve, reject |

### Dependency Graph

```
22.1 (DiscoveryStore)     22.3 (ShapeBindingStore)
  │                         │
  ▼                         ▼
22.2 (DiscoveryStoreImpl) 22.4 (ShapeBindingImpl)
  │                         │
  └────────┬────────────────┘
           ▼
22.5 (Enhanced DiscoveryEngine) ◄── 22.7 (Enhanced ShapeRegistry)
  │                                   │
  │                                   ▼
  │                              22.8 (Adapter Seeds)
  ▼
22.6 (Enhanced ManifestInference)
  │
  ▼
22.9 (MCP Server scaffold)
  │
  ├── 22.10 (Session + Navigation tools)
  ├── 22.11 (DOM + Interaction tools)
  ├── 22.12 (Network Observation tools)
  ├── 22.13 (Analysis + Manifest tools)
  ├── 22.14 (Parser Testing tools)
  └── 22.15 (Registration tools)
```

### Parallelization Opportunities

- **22.1 + 22.3** can run in parallel (both are store contracts)
- **22.2 + 22.4** can run in parallel (both are store impls)
- **22.7 + 22.8** can run in parallel (registry enhancement + adapter seeds)
- **22.10–22.15** can run in parallel (all are MCP tool modules)

---

## 9. Files to Create/Modify

### New Files

```
src/storage/contracts/discovery-store.ts       — DiscoveryStore interface
src/storage/impl/discovery-store-impl.ts       — Prisma implementation
src/storage/contracts/shape-binding-store.ts   — ShapeBindingStore interface
src/storage/impl/shape-binding-store-impl.ts   — Prisma implementation
src/mcp/server.ts                              — MCP server entry point
src/mcp/discovery-tools.ts                     — Tool definitions + handlers
src/mcp/index.ts                               — barrel exports
seeds/adapters/chat_app.adapter.ts             — identity adapter
seeds/adapters/coding_ide.adapter.ts           — IDE adapter
seeds/adapters/search_engine.adapter.ts        — search adapter
seeds/adapters/custom.adapter.ts               — fallback adapter
docs/atomic/phase-22-agentic-discovery/        — atomic unit specs (15 files)
```

### Modified Files

```
src/engines/provider-discovery.ts    — Full rewrite: persistence, CDP ops, network obs
src/engines/manifest-inference.ts    — Add confidence scoring, needsReview
src/engines/capability-shape-registry.ts — Add adapter loading, inheritance
src/engines/provider-registrar.ts    — Add registerWithShape()
src/index.ts                        — Add MCP barrel exports
package.json                        — Add @modelcontextprotocol/sdk
tsconfig.json                       — Add MCP types
```

---

## 10. Integration Points

### With Existing Engines

| Engine | Integration | How |
|--------|-------------|-----|
| ChromeGovernor | CDP transport | MCP tools delegate to `governor.cdp.*` |
| CapabilityShapeRegistry | Shape matching | MCP tools call `shapeRegistry.matchShape()` |
| ManifestInferenceEngine | Manifest generation | MCP tools call `manifestInference.infer()` |
| ProviderRegistrar | Final registration | MCP tools call `registrar.register()` |
| SemanticGroundingEngine | Selector resolution | MCP tools use for DOM probing |
| SelectorHealer | Selector repair | Agent can use for broken selectors |
| StreamParserEngine | Parser testing | MCP tools test parsers against captured responses |
| CapabilityEventBus | Events | All operations emit events for observability |

### With Frontend

The frontend (`web/`) can use the same REST endpoints (added in Phase 22) for manual discovery without an MCP agent. The MCP server is the primary interface; REST is a fallback.

### With Existing Schema

Discovery-related tables already exist in Prisma schema:
- `discovery_session` (line 1394)
- `discovery_result` (line 1411)
- `capability_shape` (line 1354)
- `capability_shape_binding` (line 1357)
- `provider_shape_binding` (line 1382)
- `provider_archetype` (line 1369)

No schema migration needed — tables exist but have no store contracts/impls.

---

## 11. Testing Strategy

### Unit Tests

- `tests/unit/mcp/discovery-tools.test.ts` — Tool handlers with mocked engines
- `tests/unit/engines/provider-discovery-enhanced.test.ts` — Enhanced discovery engine
- `tests/unit/engines/manifest-inference-enhanced.test.ts` — Confidence scoring

### Integration Tests

- `tests/integration/mcp/server.test.ts` — MCP server tool execution
- `tests/integration/discovery-store.test.ts` — Store CRUD with test DB

### E2E Tests

- `tests/e2e/discovery-flow.test.ts` — Full agent workflow (mocked Chrome)

---

## 12. Success Criteria

1. **MCP server starts** and advertises 25 discovery tools
2. **Agent can drive full loop** — from URL to registered provider using only MCP tools
3. **Sessions persist** — restart server, sessions survive
4. **Network observation captures** API calls during discovery
5. **Shape matching works** — 6 built-in shapes + custom fallback
6. **Manifest generation produces valid JSON** — passes ProviderManifestSchema validation
7. **Parser testing captures and parses** a response from a live provider
8. **Registration writes to DB** — provider appears in provider_definition table
9. **All tests pass** — unit + integration + E2E
10. **Typecheck passes** — no type errors

---

## 13. Open Questions

1. **MCP transport** — stdio (default) or SSE (for remote agents)? Start with stdio.
2. **LLM integration** — Should the MCP server have its own LLM call capability, or leave all analysis to the connecting agent? **Recommendation:** Leave to agent. Tools provide raw data; agent decides what to do with it.
3. **Multi-session Chrome** — Should each discovery session get its own Chrome slave, or share one? **Recommendation:** One slave per session (isolation).
4. **Adapter hot-reload** — Should adapter modules be loadable at runtime, or only at startup? **Recommendation:** Startup only (simplicity).

---

## 14. See Also

- `SOTA-02` — Shape-Agnostic Registration (design spec)
- `SOTA-07` — Schema delta (tables)
- `SOTA-09` — Harness Protocol Engine (response extraction patterns)
- `04-merged-engines.md` — Engine specifications
- `06-merged-seeds.md` — Provider manifest schema
