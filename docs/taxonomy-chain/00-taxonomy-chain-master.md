# Taxonomy Chain — Master Design

**Status:** DESIGN
**Date:** 2026-07-15
**Purpose:** Comprehensive taxonomy chain that unifies frontend and backend development through a single generation pipeline.

---

## 1. The Problem

Today the system has three disconnected knowledge layers:

| Layer | Source of Truth | What it knows |
|-------|----------------|---------------|
| **Backend Capabilities** | `capability-bootstrap.ts` → `UnifiedCapabilityRegistry` | slug, id, handler, surfaces, CLI/API/MCP bindings |
| **Frontend Slots** | `web/ui/src/ui/slots.ts` → `UIComponentRegistry` | Slot IDs, component resolution, hot-swap overrides |
| **Provider Taxonomy** | `scripts/taxonomy-gen/` → `CapabilityTaxonomy` table | platform capabilities, selectors, protocols, parsers |

**The gap:** These three layers don't know about each other. A capability registered in the backend has no automatic mapping to a frontend slot. The taxonomy generator produces platform capabilities but doesn't generate the `ui_component` / `ui_position` / `ui_order` that the `CapabilityResolutionStore` needs. The frontend slot registry is manually populated with defaults but has no data-driven path from taxonomy → slot binding.

**The goal:** One generation pipeline that produces a unified taxonomy document where every node knows its cross-surface bindings — backend capability, frontend slot, CLI command, API endpoint, MCP tool — all from a single `slug`.

---

## 2. The Taxonomy Chain Topology

```
                    ┌─────────────────────────────────────────────────┐
                    │           ROUND 1: SKELETON (PlatformCatalog)  │
                    │                                                 │
                    │  10 categories × 15-20 platforms = ~180        │
                    │  Output: PlatformCatalog entries (slug, category│
                    │  url, authType, interactionPattern)             │
                    └──────────────────────┬──────────────────────────┘
                                           │
                                           ▼
                    ┌─────────────────────────────────────────────────┐
                    │     ROUND 2: DRILL-DOWN (per platform)         │
                    │                                                 │
                    │  Sections: meta → capabilities → intents →     │
                    │  selectors → constraints → validate             │
                    │                                                 │
                    │  Output: ProviderCapabilityTaxonomy             │
                    │  - capability nodes (shared)                    │
                    │  - method nodes (per platform)                  │
                    │  - protocol nodes (shared)                      │
                    │  - parser nodes (shared)                        │
                    │  - webapp_tech_stack nodes (shared)             │
                    │  - probability_table nodes (shared)             │
                    └──────────────────────┬──────────────────────────┘
                                           │
                                           ▼
                    ┌─────────────────────────────────────────────────┐
                    │     ROUND 3: UI SLOT MAPPING (NEW)             │
                    │                                                 │
                    │  For each capability node in Round 2:           │
                    │  - Map to frontend slot (chat.bubble, etc.)     │
                    │  - Generate ui_component, ui_position, ui_order │
                    │  - Generate ui_input_schema, interaction_mode   │
                    │  - Generate ui_states_json, ui_visibility_rule  │
                    │                                                 │
                    │  Output: CapabilityTaxonomy rows with           │
                    │  UI columns populated                            │
                    └──────────────────────┬──────────────────────────┘
                                           │
                                           ▼
                    ┌─────────────────────────────────────────────────┐
                    │     ROUND 4: CROSS-SURFACE BINDING (NEW)       │
                    │                                                 │
                    │  For each capability:                           │
                    │  - Generate CLI command name + aliases           │
                    │  - Generate API endpoint (method + path)        │
                    │  - Generate MCP tool name                        │
                    │  - Generate uiAction component mapping           │
                    │  - Generate workflow node type                   │
                    │                                                 │
                    │  Output: UnifiedCapability spec (ready for      │
                    │  makeCapability registration)                   │
                    └──────────────────────┬──────────────────────────┘
                                           │
                                           ▼
                    ┌─────────────────────────────────────────────────┐
                    │     MERGE → Database → Runtime                  │
                    │                                                 │
                    │  CapabilityTaxonomy table (all columns)          │
                    │  → CapabilityResolutionStore resolves           │
                    │  → UnifiedCapabilityRegistry registers           │
                    │  → UIComponentRegistry applies overrides        │
                    │  → CLI/API/MCP surfaces serve                   │
                    └─────────────────────────────────────────────────┘
```

---

## 3. The Unified Taxonomy Node

Every capability in the taxonomy is a single node with **all cross-surface bindings**:

```typescript
interface UnifiedTaxonomyNode {
  // ── Identity ──
  id: string                    // e.g. "cap:conversation:send"
  slug: string                  // e.g. "conversation_send" (THE link)
  name: string                  // e.g. "Send Message"
  description: string
  category: string              // e.g. "conversation"
  capabilityKind: 'action' | 'query' | 'state' | 'config' | 'navigation'

  // ── Backend binding ──
  surfaces: CapabilitySurface[] // ['cli', 'ui', 'workflow', 'mcp', 'api']
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>

  // ── CLI surface ──
  cliCommand?: {
    name: string                // e.g. "conversations send"
    aliases: string[]           // e.g. ["cs"]
    examples: string[]
  }

  // ── API surface ──
  apiEndpoint?: {
    method: string              // e.g. "POST"
    path: string                // e.g. "/api/conversations/{id}/send"
  }

  // ── MCP surface ──
  mcpToolName?: string          // e.g. "conversation_send"

  // ── UI surface ──
  ui?: {
    component: string           // e.g. "action-button" or "composer"
    position: string            // e.g. "sidebar" or "composer"
    group?: string
    order: number
    icon?: string
    shortcut?: string
    requiresConfirmation?: boolean
  }

  // ── Workflow surface ──
  workflowNodeType?: string

  // ── Provider-specific (from taxonomy-gen Round 2) ──
  platformBindings?: {
    platformSlug: string
    selectorType: string
    selectorValue: string
    sendMethod: string
    protocolSlug: string
    parserSlug?: string
    techStackSlug?: string
  }[]
}
```

---

## 4. Round 3: UI Slot Mapping — The Key Innovation

The existing `CapabilityTaxonomy` table has 40+ columns for UI metadata (from `RawResolutionRow`). Round 3 populates these from the taxonomy chain:

### Mapping Rules

| Capability Kind | Default Slot | Default Position | Default Order |
|----------------|-------------|-----------------|---------------|
| `action` | `chat.actionBar` | `actionBar` | 100 |
| `query` | `chat.result` | `thread` | 50 |
| `state` | `chat.header` | `header` | 10 |
| `config` | `chat.sidebar` | `sidebar` | 200 |
| `navigation` | `chat.entry` | `entry` | 0 |

### Per-Category Overrides

| Category | Primary Slot | Interaction Mode |
|----------|-------------|-----------------|
| `conversation` | `chat.composer` | `input` |
| `chrome` | `chat.actionBar` | `button` |
| `memory` | `chat.result` | `list` |
| `knowledge` | `chat.result` | `card` |
| `telemetry` | `chat.header` | `dashboard` |
| `workflow` | `chat.actionBar` | `button` |

### Resolution Chain

```
CapabilityTaxonomy.ui_component
  → if null: use category default from mapping table
  → if set:  use the explicit value

CapabilityTaxonomy.ui_component_override (per provider)
  → hot-swaps the component for a specific provider
  → stored in ProviderCapability table
  → applied via UIComponentRegistry.applyClaim()
```

---

## 5. Round 4: Cross-Surface Binding Generation

For each capability node, Round 4 generates the complete `UnifiedCapability` spec:

### CLI Command Generation

```
slug: "conversation_send"
  → name: "conversations send"     (split on _, capitalize)
  → aliases: ["cs"]                (first letters of each word)
  → examples: ["cs <id> --message \"hello\""]
```

### API Endpoint Generation

```
category: "conversation"
capabilityKind: "action"
  → method: "POST"                 (actions are POST)
  → path: "/api/conversations/{id}/send"  (from category + slug)
```

### MCP Tool Name Generation

```
slug: "conversation_send"
  → mcpToolName: "conversation_send"  (slug = tool name)
```

### UI Action Generation

```
capabilityKind: "action"
  → uiAction: { component: "action-button", position: "sidebar", order: 100 }
capabilityKind: "query"
  → ui: { component: "result-card", position: "thread", order: 50 }
```

---

## 6. Generation Session Manifest

### Session Inventory

| Session | Round | Platforms | Output | Est. Time |
|---------|-------|-----------|--------|-----------|
| `skeleton` | 1 | All ~180 | `PlatformCatalog` entries | 1 session |
| `drilldown-social_messaging` | 2 | 7 | capabilities + selectors per platform | 1 session |
| `drilldown-social_feed` | 2 | 8 | capabilities + selectors per platform | 1 session |
| `drilldown-dating` | 2 | 5 | capabilities + selectors per platform | 1 session |
| `drilldown-ai_chatbot` | 2 | 8 | capabilities + selectors per platform | 1 session |
| `drilldown-ai_tooling` | 2 | 8 | capabilities + selectors per platform | 1 session |
| `drilldown-ide` | 2 | 6 | capabilities + selectors per platform | 1 session |
| `drilldown-agentic_agent` | 2 | 7 | capabilities + selectors per platform | 1 session |
| `drilldown-browser_automation` | 2 | 6 | capabilities + selectors per platform | 1 session |
| `drilldown-productivity` | 2 | 9 | capabilities + selectors per platform | 1 session |
| `drilldown-forum` | 2 | 5 | capabilities + selectors per platform | 1 session |
| `ui-slot-mapping` | 3 | All capabilities | UI columns in CapabilityTaxonomy | 1 session |
| `cross-surface-binding` | 4 | All capabilities | UnifiedCapability specs | 1 session |
| `merge-seed` | — | — | `pool.taxonomy.json` + seed file | 1 session |

**Total sessions:** 14 (1 skeleton + 10 drill-downs + 1 UI mapping + 1 cross-surface + 1 merge)

### Per-Platform Drill-Down Section Order

Each platform session follows this exact order (existing taxonomy-gen flow):

1. **meta** → `{ slug, displayName, category, url, description, authType }`
2. **capabilities** → `{ capabilities: [{slug, type, authScope, description}], messageTypes: [] }`
3. **intents** → `{ intents: [{intent, patterns, confidence, requiredEntities}] }`
4. **selectors** → `{ discoveryHints: {composerSelector, sendButtonSelector, messageListSelector}, entityTypes: [] }`
5. **constraints** → `{ constraints: {rateLimits, maxMessageLength, supportedMediaTypes}, authRequirements: [] }`
6. **validate** → merged + validated full taxonomy

**New for Round 3+:** After Round 2 completes, the `ui-slot-mapping` session processes all capability nodes and adds UI metadata.

---

## 7. Database Schema Alignment

The existing `CapabilityTaxonomy` table already has the columns needed. The taxonomy chain populates them:

```prisma
model CapabilityTaxonomy {
  id                String   @id
  slug              String   @unique
  name              String
  description       String?
  kind              String   // "action" | "query" | "state" | "config" | "navigation"
  category          String   // "conversation" | "chrome" | "memory" | ...

  // ── UI columns (populated by Round 3) ──
  ui_component      String   @default("action-button")
  ui_label          String   @default("")
  ui_icon           String   @default("")
  ui_position       String   @default("sidebar")
  ui_order          Int      @default(100)
  ui_group          String   @default("")
  ui_layer_depth    Int      @default(0)
  ui_priority       String   @default("normal")
  interaction_mode  String   @default("button")
  ui_states_json    String   @default("{}")
  ui_visibility_rule String?
  ui_input_schema   String   @default("{}")

  // ── Backend columns ──
  existential_rule        String?
  mutation_effects_json   String   @default("{}")
  recovery_behavior       String   @default("retry")
  state_persistence       String   @default("none")
  data_flow               String   @default("request-response")
  min_plan_tier           String   @default("free")
  depends_on_json         String   @default("[]")

  // ── vCode pattern columns ──
  concurrency_safe            Int      @default(1)
  op_classification           String?
  requires_user_confirmation  Int      @default(0)
  max_result_size             Int      @default(10000)
  result_component            String   @default("text")
  result_layout               String   @default("single")

  // ── Relations ──
  parentCapabilityId   String?
  parent               CapabilityTaxonomy?  @relation(...)
  children             CapabilityTaxonomy[] @relation(...)
  bindings             CapabilityBinding[]
  programs             CapabilityProgramRow[]
  intents              CapabilityIntent[]
  versions             CapabilityTaxonomyVersion[]
}
```

---

## 8. The slug = THE Single Link

```
                    slug: "conversation_send"
                         │
          ┌──────────────┼──────────────────┐
          │              │                  │
          ▼              ▼                  ▼
    Backend:          Frontend:          Taxonomy:
    UnifiedCap.       UIComponent        CapabilityTaxonomy
    Registry          Registry           row
    │                 │                  │
    ├─ id:            ├─ resolve(        ├─ slug: "conversation_send"
    │  "cap:conv:     │  "chat.composer" │  name: "Send Message"
    │   send"         │  {providerSlug,  │  ui_component: "composer"
    │                 │   capabilitySlug: │  ui_position: "composer"
    ├─ slug:           │   "conversation_ │  ui_order: 1
    │  "conversation_  │   send"})        │  interaction_mode: "input"
    │   send"         │                  │
    │                 ├─ returns:        ├─ platformBindings:
    ├─ handler:        │  {component:    │  [{platformSlug: "whatsapp",
    │  async (input)  │   SendComponent, │    selectorType: "css",
    │  => ...         │   source:        │    selectorValue: "[data-testid=
    │                 │   'capability'}  │    'send']"}]
    ├─ cliCommand:    │                  │
    │  {name:         └──────────────────┘
    │   "conversations
    │   send",
    │   aliases:["cs"]}
    │
    ├─ apiEndpoint:
    │  {method: "POST",
    │   path: "/api/
    │   conversations/
    │   {id}/send"}
    │
    ├─ mcpToolName:
    │  "conversation_send"
    │
    └─ ui:
       {component:
        "composer",
        position:
        "composer",
        order: 1}
```

---

## 9. Atomic-v19: Full Frontend=Backend Wiring

### Overview

Atomic-v19 is the phase that wires the taxonomy chain into the runtime. It has 4 units:

| Unit | Name | Purpose |
|------|------|---------|
| 19.1 | Taxonomy Chain Pipeline | Wire Round 3+4 into taxonomy-gen, produce unified nodes |
| 19.2 | Capability Bootstrap from Taxonomy | Generate `registerDefaultCapabilities` from taxonomy pool |
| 19.3 | Frontend Slot Auto-Population | Generate UI slot defaults from taxonomy UI columns |
| 19.4 | Cross-Surface Verification | Verify slug→CLI/API/MCP/UI all resolve correctly |

### Unit 19.1: Taxonomy Chain Pipeline

**Input:** `pool.taxonomy.json` (from taxonomy-gen Round 1+2)
**Output:** `pool.taxonomy.json` (enriched with Round 3+4 data)

Changes to `scripts/taxonomy-gen/lib/`:
- Add `ui-slot-mapper.ts` — maps capability kind/category → slot metadata
- Add `cross-surface-binder.ts` — generates CLI/API/MCP/UI specs from slug
- Update `merge.ts` — include Round 3+4 data in final pool

### Unit 19.2: Capability Bootstrap from Taxonomy

**Input:** `pool.taxonomy.json` (unified nodes)
**Output:** `src/engines/capability-bootstrap-generated.ts`

The existing `capability-bootstrap.ts` has ~1100 lines of hand-written `makeCapability` calls. Unit 19.2 replaces this with a generated version:

```typescript
// AUTO-GENERATED from taxonomy pool — do not edit manually
import { pool } from '../../seeds/taxonomy/pool.taxonomy.json'
import { makeCapability } from './capability-bootstrap.js'
import type { BootstrapServices } from './capability-bootstrap.js'

export function registerGeneratedCapabilities(
  registry: UnifiedCapabilityRegistry,
  services: BootstrapServices,
): void {
  for (const node of pool.nodes.filter(n => n.kind === 'capability')) {
    const spec = node as UnifiedTaxonomyNode
    registry.register(makeCapability(
      {
        id: spec.id,
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        category: spec.category,
        inputSchema: spec.inputSchema,
        outputSchema: spec.outputSchema,
        cliCommand: spec.cliCommand,
        ui: spec.ui,
        mcpToolName: spec.mcpToolName,
        apiEndpoint: spec.apiEndpoint,
      },
      resolveHandler(spec, services),
    ))
  }
}
```

### Unit 19.3: Frontend Slot Auto-Population

**Input:** `CapabilityTaxonomy` table with UI columns populated
**Output:** Frontend receives slot overrides via `/api/capabilities?surface=ui`

The existing `CapabilityResolutionStore.resolveCapabilities()` already returns `RawResolutionRow` with all UI columns. Unit 19.3 ensures:

1. Every capability in the DB has `ui_component` set (no nulls)
2. The frontend `ChatPage` (or equivalent surface) queries capabilities and applies slot overrides
3. The `UIComponentRegistry` is populated from DB data at boot time

### Unit 19.4: Cross-Surface Verification

**Input:** All capabilities registered
**Output:** Verification report

Test every capability across all surfaces:
- CLI: `bun run devops runtime-test test --nl="<capability name>"`
- API: `POST /api/capabilities/:id/execute` returns 200
- MCP: Tool appears in MCP server tool list
- UI: Slot resolves in `UIComponentRegistry`

---

## 10. Execution Plan

### Phase A: Taxonomy Chain Foundation (Week 1)

| Task | Skill | Output |
|------|-------|--------|
| Run Round 1 skeleton | devops-generators | `PlatformCatalog` entries |
| Run Round 2 drill-downs (10 categories) | devops-generators | `pool.taxonomy.json` |
| Build `ui-slot-mapper.ts` | devops-fullstack | New file in `scripts/taxonomy-gen/lib/` |
| Build `cross-surface-binder.ts` | devops-fullstack | New file in `scripts/taxonomy-gen/lib/` |

### Phase B: Database + Runtime Wiring (Week 2)

| Task | Skill | Output |
|------|-------|--------|
| Run Round 3 UI mapping | devops-roadmap | Enriched `CapabilityTaxonomy` rows |
| Run Round 4 cross-surface binding | devops-roadmap | Unified capability specs |
| Run merge → seed | devops-generators | `pool.taxonomy.json` + seed file |
| Run migration | devops-fullstack | DB schema updated |
| Seed DB | devops-fullstack | `CapabilityTaxonomy` populated |

### Phase C: Frontend + Backend Integration (Week 3)

| Task | Skill | Output |
|------|-------|--------|
| Generate `capability-bootstrap-generated.ts` | devops-fullstack | Auto-generated bootstrap |
| Wire frontend slot auto-population | vivi-frontend | ChatPage reads from DB |
| Cross-surface verification | devops-fullstack | All surfaces green |
| Typecheck + lint + test | devops | Clean gate |

---

## 11. Invariants

1. **slug is THE link.** Every capability has exactly one slug that connects backend handler, frontend slot, CLI command, API endpoint, and MCP tool.

2. **No hand-written bootstrap.** After atomic-v19.2, `capability-bootstrap.ts` is generated from the taxonomy pool. New capabilities are added by running the taxonomy chain, not by editing code.

3. **No null UI columns.** After atomic-v19.3, every `CapabilityTaxonomy` row has `ui_component`, `ui_position`, `ui_order` populated. Defaults are computed from kind + category.

4. **FRONTEND=BACKEND is enforced by data.** The frontend never hardcodes feature logic. It resolves slots from the registry, which is populated from the same taxonomy data that populates the backend.

5. **Generation before implementation.** The devops-roadmap skill's Phase 1 (Truth Scan) must run before any new capability is added. The truth scanner checks if the taxonomy chain already covers the requested capability.

---

## 12. File Manifest

```
scripts/taxonomy-gen/
  lib/
    ui-slot-mapper.ts          ← NEW: Round 3 logic
    cross-surface-binder.ts    ← NEW: Round 4 logic
    taxonomy-model.ts          ← EXTENDED: add UI + cross-surface fields
    merge.ts                   ← UPDATED: include Round 3+4 in pool
    catalog-scan.ts            ← UPDATED: report on UI column coverage

src/engines/
  capability-bootstrap.ts           ← KEPT: backward compatibility
  capability-bootstrap-generated.ts ← NEW: generated from taxonomy pool

web/ui/src/ui/
  slots.ts                     ← UNCHANGED: slot catalog
  registry.ts                  ← UNCHANGED: hot-swap engine
  auto-populate.ts             ← NEW: reads DB, applies slot overrides at boot

docs/taxonomy-chain/
  00-taxonomy-chain-master.md  ← THIS FILE
  01-ui-slot-mapping.md        ← Round 3 detailed spec
  02-cross-surface-binding.md  ← Round 4 detailed spec
  03-atomic-v19-units.md       ← Implementation units
  04-generation-sessions.md    ← Session manifest + prompts
```
