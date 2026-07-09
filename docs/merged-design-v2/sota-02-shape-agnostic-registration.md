# SOTA-02 — Priority #2: Shape-Agnostic Provider Registration

**Status:** DRAFT
**Priority:** P2
**Extends:** `04-merged-engines.md` (Engine 5: ProviderRegistrar), `06-merged-seeds.md` (Provider Manifest)
**Supersedes:** v1 P3 (Seeds Not Code → Seeds + Discovery + Self-Describing)

---

## Purpose

Adding a new provider must be **as frictionless as adding another AI chat app**, even if the new provider is fundamentally different — a coding IDE, a search engine, a custom internal tool, a design tool, a data dashboard. The system must adapt to the provider's shape, not force the provider into a predefined schema.

This document specifies three registration paths, all with equal friction:

1. **Seed Manifest** (v1 path, preserved) — write a JSON manifest, run `seedAll()`
2. **Auto-Discovery** (new) — point the system at a URL, it explores the DOM and infers capabilities
3. **Self-Describing Protocol** (new) — provider exposes a `/capabilities` endpoint, system reads it

Plus the infrastructure that makes all three paths produce the same internal representation:

- **Capability Shape Registry** — meta-registry of known capability archetypes
- **Manifest Inference Engine** — generates draft manifests from discovery
- **Polymorphic Capability Resolution** — different shapes → unified UI via adapters
- **Plugin System** — non-conforming providers can ship a TS adapter module
- **Schema Evolution** — manifests version themselves; old manifests always work

---

## Architecture

```
                    THREE REGISTRATION PATHS
                    ═══════════════════════

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  PATH A: Seed   │  │  PATH B: Auto   │  │  PATH C: Self-  │
│  Manifest       │  │  Discovery      │  │  Describing     │
│                 │  │                 │  │  Protocol       │
│  seeds/*.json   │  │  POST /discover │  │  GET /capabilities│
│  (v1 preserved) │  │  { url }        │  │  (provider-side) │
└───────┬─────────┘  └───────┬─────────┘  └───────┬─────────┘
        │                    │                    │
        │                    ▼                    │
        │    ┌───────────────────────────┐        │
        │    │  ProviderDiscoveryEngine  │        │
        │    │                           │        │
        │    │  1. Navigate to URL       │        │
        │    │  2. Extract DOM structure │        │
        │    │  3. Identify interactive  │        │
        │    │     elements              │        │
        │    │  4. Match against         │        │
        │    │     archetypes            │        │
        │    │  5. Infer capabilities    │        │
        │    │  6. Generate draft        │        │
        │    │     manifest              │        │
        │    └───────────┬───────────────┘        │
        │                │                        │
        │                ▼                        │
        │    ┌───────────────────────────┐        │
        │    │ ManifestInferenceEngine   │        │
        │    │                           │        │
        │    │  • Produces draft JSON    │        │
        │    │    matching ProviderMani  │        │
        │    │    fest schema (extended) │        │
        │    │  • Operator reviews &     │        │
        │    │    edits                  │        │
        │    │  • Approved manifest      │        │
        │    │    saved to seeds/        │        │
        │    └───────────┬───────────────┘        │
        │                │                        │
        └────────────────┼────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │    ProviderRegistrar          │
         │    (v1, extended)             │
         │                               │
         │  Reads manifest → writes DB   │
         │  Registers with ShapeRegistry │
         │  Triggers RegistrationAudit   │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │  CapabilityShapeRegistry      │
         │                               │
         │  Meta-registry of shapes:     │
         │  • chat_app archetype         │
         │  • coding_ide archetype       │
         │  • search_engine archetype    │
         │  • design_tool archetype      │
         │  • data_dashboard archetype   │
         │  • custom archetype           │
         │                               │
         │  Each shape defines:          │
         │  • expected capabilities      │
         │  • UI projection rules        │
         │  • parser expectations        │
         │  • adapter requirements       │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ CapabilityResolutionEngine    │
         │ (v1, extended for poly morph) │
         │                               │
         │  Resolves capabilities using  │
         │  shape-specific adapters →    │
         │  unified ResolvedCapabilities │
         └───────────────────────────────┘
```

---

## Capability Shape Registry

### Concept

A **shape** is a meta-description of how a class of providers works. It defines:

- What capabilities are expected (and which are optional)
- How the DOM is typically structured (for auto-discovery)
- How to project Chrome state into UI state (for MirrorEngine)
- What parser patterns are expected (for StreamParserEngine)
- What adapter is needed (if any) to bridge shape-specific behavior to the universal capability system

### Shape Definition Contract

```typescript
interface CapabilityShape {
  id: string;
  name: string;                    // 'chat_app', 'coding_ide', etc.
  description: string;

  // Expected capabilities (slug → requirement level)
  expectedCapabilities: Record<string, 'required' | 'optional' | 'extended'>;
  // e.g., { 'send_message': 'required', 'select_model': 'optional', 'run_code': 'extended' }

  // DOM discovery hints (used by ProviderDiscoveryEngine)
  discoveryHints: {
    // What URLs to look for
    urlPatterns: string[];
    // What DOM structures indicate this shape
    domIndicators: DomIndicator[];
    // What interactive elements to look for
    interactiveElementPatterns: InteractiveElementPattern[];
  };

  // UI projection rules (used by MirrorEngine)
  projectionRules: {
    // How to extract composer state from DOM
    composer: ProjectionRule;
    // How to extract model selector state
    modelSelector?: ProjectionRule;
    // How to extract message list state
    messageList: ProjectionRule;
    // Shape-specific extensions
    extensions?: Record<string, ProjectionRule>;
  };

  // Parser expectations
  parserExpectations: {
    // What response format is expected
    responseFormat: 'sse' | 'json' | 'html' | 'websocket' | 'custom';
    // What parser archetype to use (if auto-discovering)
    parserArchetype: string;
    // Fallback parser strategy
    fallbackStrategy: 'plain_text' | 'html_extract' | 'raw';
  };

  // Adapter (optional — for non-conforming providers)
  adapter?: {
    moduleId: string;              // e.g., 'coding_ide_adapter'
    // What the adapter does
    transforms: string[];          // ['dom_to_universal', 'universal_to_dom']
  };

  // Archetype inheritance
  extendsShape?: string;           // parent shape ID
  overrides?: Partial<CapabilityShape>;
}

interface DomIndicator {
  selector: string;
  attribute?: string;
  valuePattern?: string;
  description: string;
  confidence: number;              // 0.0-1.0 — how strongly this indicates the shape
}

interface InteractiveElementPattern {
  role: string;                    // 'textbox' | 'button' | 'combobox' | 'tab' | etc.
  labelPattern?: string;
  selectorHint?: string;
  mapsToCapability: string;        // which capability slug this element likely represents
  confidence: number;
}

interface ProjectionRule {
  // How to extract this state from the DOM
  selector: string;
  attribute?: string;
  transform?: 'text' | 'html' | 'value' | 'checked' | 'count' | 'exists';
  // What UI field this maps to
  mapsTo: string;
  // How often to re-check (ms)
  refreshIntervalMs: number;
}
```

### Built-In Shapes (Seeded)

| Shape ID | Name | Expected Capabilities | Parser Format |
|----------|------|----------------------|---------------|
| `chat_app` | AI Chat Application | send_message (required), select_model (optional), upload_file (optional), create_new_chat (optional) | sse / json |
| `coding_ide` | Online Code IDE | send_message (required), run_code (extended), select_language (optional), open_file (extended) | json / html |
| `search_engine` | AI Search Engine | send_query (required), filter_results (optional), select_source (optional) | json / html |
| `design_tool` | AI Design Tool | send_prompt (required), select_style (optional), export_asset (extended) | json / websocket |
| `data_dashboard` | Data Dashboard | apply_filter (required), refresh_data (optional), export_report (extended) | json |
| `custom` | Custom / Unknown | (discovered) | (discovered) |

### Shape Binding

Each provider is bound to a shape. A provider can extend a shape (override fields) or use the `custom` shape (no expectations — pure discovery).

```typescript
interface ProviderShapeBinding {
  providerId: string;
  shapeId: string;
  // Overrides for this specific provider
  shapeOverrides?: Partial<CapabilityShape>;
  // Custom adapter module (if shape.adapter is insufficient)
  customAdapterModuleId?: string;
  // Discovery session that produced this binding (if auto-discovered)
  discoverySessionId?: string;
  // Confidence in the shape match (0.0-1.0)
  matchConfidence: number;
  // Whether the operator has reviewed/approved
  approved: boolean;
  approvedBy?: string;
  approvedAt?: number;
}
```

---

## ProviderDiscoveryEngine

### Purpose

Given a URL, explore the target site and infer its capability shape, capabilities, selectors, and parser format. Produce a draft manifest for operator review.

### Public Interface

```typescript
interface DiscoverySession {
  id: string;
  targetUrl: string;
  status: 'pending' | 'navigating' | 'analyzing' | 'inferring' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  // Results
  detectedShape?: string;
  shapeMatchConfidence?: number;
  inferredCapabilities?: InferredCapability[];
  inferredEndpoints?: InferredEndpoint[];
  inferredParserFormat?: string;
  draftManifest?: ProviderManifest;
  // Telemetry
  domSnapshotsTaken: number;
  interactionsAttempted: number;
  llmCallsMade: number;
  error?: string;
}

interface InferredCapability {
  globalCapabilityId: string;       // matched against taxonomy
  slug: string;
  confidence: number;
  evidence: string[];               // DOM selectors, text, patterns that led to inference
  selectorCandidates: string[];     // possible selectors for this capability
  shapeSpecific?: boolean;          // is this a shape-specific capability (not in global taxonomy)?
}

interface InferredEndpoint {
  url: string;
  label: string;
  endpointType: 'landing' | 'chat' | 'login' | 'api' | 'auth';
  evidence: string;
  confidence: number;
}

class ProviderDiscoveryEngine {
  constructor(
    private governor: ChromeGovernor,
    private shapeRegistry: CapabilityShapeRegistry,
    private store: DiscoveryStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async discover(url: string, opts?: DiscoveryOptions): Promise<DiscoverySession>;

  async getDiscoverySession(sessionId: string): Promise<DiscoverySession | null>;
  async getDiscoveryResults(sessionId: string): Promise<DiscoveryResult>;
  async approveDiscovery(sessionId: string, edits?: ManifestEdits, approver: string): Promise<RegisterResult>;
  async rejectDiscovery(sessionId: string, reason: string): Promise<void>;

  // Interactive discovery — operator guides the exploration
  async interactiveDiscover(url: string): Promise<InteractiveDiscoverySession>;
  async recordInteraction(sessionId: string, interaction: UserInteraction): Promise<void>;
  async finalizeInteractive(sessionId: string): Promise<DiscoverySession>;
}

interface DiscoveryOptions {
  // Should the discovery engine attempt to interact with the page?
  interactive: boolean;            // default: true
  // Should it use LLM for semantic analysis?
  useLlm: boolean;                 // default: true
  // Maximum time for discovery
  timeoutMs: number;               // default: 60000
  // Should it attempt to detect login walls?
  detectLoginWall: boolean;        // default: true
  // Shape hint — if operator knows the shape, skip shape detection
  shapeHint?: string;
  // Provider name hint
  providerNameHint?: string;
}
```

### Discovery Flow

```
discover(url, opts)
  │
  ├─ [1] Create DiscoverySession row
  │
  ├─ [2] NAVIGATE — Governor launches Chrome, navigates to URL
  │     └─ If login wall detected → mark in results, attempt to skip
  │
  ├─ [3] DOM SNAPSHOT — Capture full DOM + accessibility tree
  │     └─ Store as dom_snapshot
  │
  ├─ [4] SHAPE DETECTION — Match against CapabilityShapeRegistry
  │     ├─ For each built-in shape:
  │     │   └─ Evaluate domIndicators → confidence score
  │     ├─ If best match confidence > 0.7 → use that shape
  │     ├─ If best match confidence 0.3-0.7 → use shape but flag for review
  │     └─ If best match confidence < 0.3 → use 'custom' shape (pure discovery)
  │
  ├─ [5] CAPABILITY INFERENCE — Identify interactive elements
  │     ├─ Extract all interactive elements (button, input, textarea, [role], contenteditable)
  │     ├─ For each element:
  │     │   ├─ Match against shape's interactiveElementPatterns
  │     │   ├─ If match → infer capability (with confidence)
  │     │   ├─ If no match and useLlm → ask LLM "what does this element do?"
  │     │   └─ Record as shapeSpecific capability if no global match
  │     └─ Produce InferredCapability[]
  │
  ├─ [6] INTERACTIVE PROBE (if opts.interactive)
  │     ├─ For each inferred capability:
  │     │   ├─ Attempt to interact (click, type test text)
  │     │   ├─ Observe DOM mutation + network response
  │     │   ├─ Validate that the selector works
  │     │   └─ Record success/failure as evidence
  │     └─ Refine selector candidates based on probe results
  │
  ├─ [7] PARSER FORMAT DETECTION
  │     ├─ Observe network requests during interaction
  │     ├─ Classify response format (SSE, JSON, HTML, WebSocket)
  │     ├─ If SSE → check for OpenAI-style or Claude-style or custom
  │     ├─ If JSON → check for standard API patterns
  │     └─ Record inferred parser format + archetype
  │
  ├─ [8] MANIFEST GENERATION — ManifestInferenceEngine
  │     ├─ Compile all findings into a ProviderManifest JSON
  │     ├─ Mark all inferred fields with confidence scores
  │     ├─ Flag low-confidence fields for operator review
  │     └─ Save as draft manifest in DiscoverySession
  │
  ├─ [9] RETURN session for operator review
  │     └─ Operator can approve, edit, or reject
  │
  └─ [10] On approval → ProviderRegistrar.register(manifest) → DB write
```

### Interactive Discovery Mode

For providers that resist automated discovery (heavy SPAs, login walls, non-standard patterns), the operator can guide discovery:

```
Operator: "I'll show you how this provider works"
  │
  ├─ [1] DiscoveryEngine launches Chrome, navigates to URL
  ├─ [2] Operator interacts with the page normally (types, clicks, etc.)
  ├─ [3] DiscoveryEngine records every interaction:
  │     └─ { action: 'click', selector: '...', element: '...', result: '...' }
  ├─ [4] After each interaction, DiscoveryEngine:
  │     ├─ Matches the interaction against known capability patterns
  │     ├─ Asks "was that a [send_message] action?" (if ambiguous)
  │     └─ Records the confirmed capability + selector
  ├─ [5] When operator is done → DiscoveryEngine compiles manifest
  └─ [6] Operator reviews and approves
```

---

## Manifest Inference Engine

### Purpose

Take discovery results and produce a valid `ProviderManifest` JSON that the `ProviderRegistrar` can consume. This is a pure transformation — no I/O.

```typescript
class ManifestInferenceEngine {
  constructor(
    private shapeRegistry: CapabilityShapeRegistry,
  ) {}

  async infer(session: DiscoverySession): Promise<InferredManifest>;

  async applyEdits(manifest: ProviderManifest, edits: ManifestEdits): Promise<ProviderManifest>;
  async validate(manifest: ProviderManifest): Promise<ValidationResult>;
}

interface InferredManifest {
  manifest: ProviderManifest;
  // Confidence annotations per field
  fieldConfidence: Record<string, number>;
  // Fields that need operator review (confidence < 0.7)
  needsReview: string[];
  // Fields that were inferred from LLM (vs. DOM evidence)
  llmInferred: string[];
  // Warnings
  warnings: string[];
}
```

---

## Self-Describing Provider Protocol

### Purpose

Some providers may expose a `/capabilities` endpoint (or equivalent) that describes their capabilities in a machine-readable format. The system reads this and registers the provider without discovery.

### Protocol

```typescript
// Provider exposes: GET https://provider.com/.well-known/capabilities
// Response:
interface SelfDescribingProviderResponse {
  provider: {
    slug: string;
    display_name: string;
    description: string;
    category: string;
    provider_type: string;
    website_url: string;
    auth_type: string;
    has_multi_account: boolean;
  };
  capabilities: Array<{
    slug: string;
    name: string;
    description: string;
    shape: string;                    // which CapabilityShape this claims
    ui_component: string;
    ui_position: string;
    input_schema: Record<string, unknown>;
    // Selector hints (the provider tells us where things are)
    selectors: Record<string, string>;
    // API info (if the provider exposes a direct API, not just browser automation)
    api_endpoint?: string;
    api_method?: string;
    api_auth?: string;
  }>;
  endpoints: Array<{
    url: string;
    label: string;
    endpoint_type: string;
  }>;
  // Parser info
  response_format: 'sse' | 'json' | 'html' | 'websocket';
  parser_hint?: string;
  // Models (if applicable)
  models?: Array<{
    slug: string;
    display_name: string;
    context_window?: number;
  }>;
}
```

### Registration Flow

```
POST /api/providers/register-self-describing
  body: { url: "https://provider.com/.well-known/capabilities" }
  │
  ├─ [1] Fetch the self-describing response
  ├─ [2] Validate against SelfDescribingProviderResponse schema
  ├─ [3] Transform to ProviderManifest
  ├─ [4] Register via ProviderRegistrar
  └─ [5] Return RegisterResult
```

---

## Polymorphic Capability Resolution

### Problem

Different providers have different capability shapes. A `send_message` on a chat app is different from a `send_query` on a search engine. The CapabilityResolutionEngine must resolve both into a unified UI contract.

### Solution: Capability Adapters

Each capability shape can have an **adapter** — a TypeScript module that transforms shape-specific behavior into the universal capability contract.

```typescript
interface CapabilityAdapter {
  shapeId: string;
  // Transform a shape-specific capability into universal ResolvedCapability
  toUniversal(shapeSpecific: ShapeSpecificCapability, shapeContext: CapabilityShape): ResolvedCapability;
  // Transform a universal UI action into shape-specific execution
  fromUniversal(action: MirrorAction, shapeContext: CapabilityShape): HarnessDAG;
  // Project shape-specific Chrome state into universal MirrorState
  projectState(rawState: Record<string, unknown>, shapeContext: CapabilityShape): Partial<MirrorState>;
}

// The CapabilityResolutionEngine uses adapters when resolving:
class CapabilityResolutionEngine {
  async resolve(providerId: string, planTier: PlanTier): Promise<ResolvedCapabilities> {
    // 1. Get provider's shape binding
    const shapeBinding = await this.store.getShapeBinding(providerId);

    // 2. Get adapter for shape (if exists)
    const adapter = this.shapeRegistry.getAdapter(shapeBinding.shapeId);

    // 3. Resolve capabilities (v1 SQL query)
    const rawCapabilities = await this.store.resolveCapabilities(providerId, planTier);

    // 4. If adapter exists, transform shape-specific caps to universal
    if (adapter) {
      return rawCapabilities.map(cap => adapter.toUniversal(cap, shapeBinding.shape));
    }

    // 5. No adapter → caps are already universal (standard chat_app shape)
    return rawCapabilities;
  }
}
```

### Adapter Registration

Adapters are TypeScript modules in `seeds/adapters/`:

```
seeds/adapters/
  ├── chat_app.adapter.ts           ← identity adapter (no transformation needed)
  ├── coding_ide.adapter.ts         ← transforms IDE-specific caps to universal
  ├── search_engine.adapter.ts      ← transforms search-specific caps to universal
  └── custom.adapter.ts             ← generic fallback adapter
```

Each adapter exports a `CapabilityAdapter` interface. The ShapeRegistry loads them via dynamic `import()`.

---

## Extended Provider Manifest Schema

The `ProviderManifest` schema from v1 is extended with shape-related fields:

```typescript
interface ProviderManifest {
  // ... all v1 fields preserved ...

  // NEW: Shape declaration
  shape: {
    id: string;                      // 'chat_app' | 'coding_ide' | 'search_engine' | 'custom'
    // Overrides for this provider's shape
    overrides?: Partial<CapabilityShape>;
    // Custom adapter module (if shape needs custom adapter)
    customAdapter?: string;          // file path relative to seeds/adapters/
    // How was this shape determined?
    discoveryMethod: 'seed' | 'auto_discovery' | 'self_describing' | 'manual';
    discoverySessionId?: string;
    matchConfidence?: number;
  };

  // NEW: Extended capabilities (shape-specific capabilities not in global taxonomy)
  extendedCapabilities?: Array<{
    slug: string;
    name: string;
    description: string;
    ui_component: string;
    ui_position: string;
    input_schema: Record<string, unknown>;
    selectors: Record<string, string>;
    // Is this capability exposed to the universal UI, or shape-specific only?
    expose_to_ui: boolean;
  }>;
}
```

---

## Plugin System (Escape Hatch)

For providers that are so non-conforming that even the custom shape + adapter is insufficient, the system supports a **plugin** — a full TypeScript module that takes over provider behavior.

```typescript
interface ProviderPlugin {
  providerId: string;

  // Called when provider is registered
  onRegister(manifest: ProviderManifest): Promise<void>;

  // Called when capabilities are resolved — plugin can inject/modify
  onResolveCapabilities(providerId: string, planTier: PlanTier): Promise<ResolvedCapability[] | null>;
  // Return null to use standard resolution

  // Called when an action is sent — plugin can intercept
  onAction(action: MirrorAction): Promise<MirrorAction | null>;
  // Return null to proceed with standard execution

  // Called when Chrome state is projected — plugin can modify
  onProjectState(rawState: Record<string, unknown>): Promise<Record<string, unknown>>;

  // Called when parser is selected — plugin can override
  onParse(rawBody: string): Promise<ContentBlock[] | null>;
  // Return null to use standard parser
}
```

Plugins are loaded from `seeds/plugins/<providerSlug>.plugin.ts`. If present, they are called at each hook point. Returning `null` means "use standard behavior." Returning a value means "override with this."

This is the **escape hatch** — it ensures that ANY provider can be supported, no matter how unusual, without modifying the core engine code.

---

## Friction Comparison

| Registration Path | Operator Effort | Time | Requires Code? |
|------------------|----------------|------|----------------|
| **Seed Manifest** (Path A) | Write JSON manifest | 10-30 min | No (JSON only) |
| **Auto-Discovery** (Path B) | Enter URL, review draft, approve | 2-5 min | No |
| **Self-Describing** (Path C) | Enter URL | 10 sec | No |
| **Interactive Discovery** (Path B') | Use the provider, confirm inferences | 5-10 min | No |
| **Plugin** (Escape Hatch) | Write TS plugin module | 1-4 hours | Yes (but rare) |

**Target:** 90% of new providers use Path A, B, or C. <10% need a plugin. <1% need core code changes.

---

## See also

- `SOTA-01` — MirrorEngine (uses shape projection rules for state projection)
- `SOTA-05` — Semantic browser automation (used by discovery engine)
- `SOTA-07` — Schema delta (new tables: provider_archetype, capability_shape, discovery_session, etc.)
- `06-merged-seeds.md` — v1 provider manifest schema (extended here)
