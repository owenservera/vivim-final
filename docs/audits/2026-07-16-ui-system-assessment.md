# UI System Assessment — Resizable Components, Schema Contracts, Plugin Generation

**Date:** 2026-07-16  
**Context:** Can the current architecture accommodate:  
1. All UI components user-resizable with canvas-state-aware defaults  
2. UI elements follow strict Zod schema contracts  
3. UI component metadata facilitates automated plugin generation

---

## CURRENT STATE

### What exists (strong foundation)

| Layer | Component | Status |
|---|---|---|
| DB schema | `UiComponent` with `defaultRegionJson` (x, y, w, h) | ✅ Position + size stored per component row |
| DB schema | `UiComponent` with `sandboxJson` (CSP, allowCapabilities, budgetMs) | ✅ Sandbox policy stored |
| DB schema | `Primitive` with `defaultRegionJson`, `scope`, `familyId`, `providerId` | ✅ Slot catalog supports cross-type/family/provider scoping |
| DB schema | `ProviderType` with `slotCatalogJson`, `regionLayoutJson`, `interactionGrammarJson` | ✅ Family-level layout defaults |
| Resolution | `ConceptualModelService` — 4-tier precedence (provider → family → cross-type → system) | ✅ Correct resolution chain |
| Frontend | `UIComponentRegistry` — runtime hot-swap via `register()`/`applyClaim()` | ✅ Runtime component replacement |
| Frontend | `useSlot()` — subscribes to registry + WebSocket for live config changes | ✅ Hot-swap reactivity |
| Frontend | `SandboxedLayer` — iframe isolation with CSP, MessageChannel bridge, watchdog | ✅ Sandbox foundation |
| Shared | `CanvasLayout`, `RegionRect` types | ✅ Layout types with x,y,w,h |
| Shared | `SlotOverrideClaim` — backend → frontend component key mapping | ✅ Data-driven UI binding |

### What's missing (gaps that block the vision)

| Gap | Severity | Blocks |
|---|---|---|
| No Zod schemas for `UiComponent`, `Primitive`, `ProviderType`, `RegionRect` | 🔴 | Contract enforcement |
| No min/max/constraint fields on `UiComponent` or `Primitive` | 🔴 | Resize safety |
| No per-user layout override storage | 🔴 | User resizing persistence |
| No component input/output schema | 🔴 | Plugin generation + interop |
| No component capability declaration | 🔴 | Sandbox allowlist generation |
| No `interactionMode` contract on components | 🟡 | Drag vs click vs type behavior |
| `RegionRect` / `CanvasLayout` have no `z` field | 🔴 | Depth stacking (in plan, not implemented) |
| `slotCatalogJson` is `string[]` not `{ id, contract }[]` | 🔴 | Slot-level contracts |
| No versioned component migration | 🟡 | Plugin upgrades |
| No component preview/thumbnail | 🟡 | Plugin catalog UX |
| No runtime input validation | 🔴 | Malformed data propagates silently |
| `PluginRegistry` has no `componentsManifestJson` | 🟡 | Plugin self-description for generation |

---

## QUESTION 1: User Resizable Components with Canvas-State-Aware Defaults

### Verdict: PARTIALLY ACCOMMODATED — needs 4 additions

**What works:**
- Each `UiComponent` row has a `defaultRegionJson` with `{x, y, w, h}` — a sensible spawn position
- The `Primitive.defaultRegionJson` provides a family-level fallback
- The `CanvasLayerMounter` emits `canvas:layer:spawned` with layout
- Resize handles + drag-to-reposition are in the Agent B execution plan (Step 7)

**What still blocks this:**

1. **No per-user layout override store.** When a user drags a component to a new position or resizes it, where is that stored? The `defaultRegionJson` on `UiComponent` is the *canonical default* — it shouldn't be mutated by user actions. The current architecture has no `user_component_layout` table or equivalent. Without this, every resize/drag is lost on page reload.

   **Required:** Add a `user_layout` key in `UserPreference` or a dedicated `user_layout` table:
   ```sql
   user_component_layout (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL DEFAULT 'default',
     component_key TEXT NOT NULL,   -- UiComponent.componentKey
     instance_id TEXT NOT NULL,     -- per-instance tracking
     x REAL NOT NULL,
     y REAL NOT NULL,
     z REAL NOT NULL DEFAULT 0,
     w REAL NOT NULL,
     h REAL NOT NULL,
     minimized INTEGER DEFAULT 0,
     updated_at INTEGER NOT NULL
   )
   ```

2. **No resize constraints.** There's nothing preventing a user from resizing a composer to 10px wide or a sidebar to 10,000px wide. Components need declared constraints.

   **Required:** Add to `UiComponent` schema and `shared/ui-component.ts`:
   ```ts
   interface ComponentConstraints {
     minWidth?: number;    // minimum renderable width in px
     minHeight?: number;
     maxWidth?: number;    // null = unbounded
     maxHeight?: number;
     aspectRatio?: number; // lock w/h ratio (null = free)
     resizable: boolean;   // true = user can resize, false = fixed
     resizeAxes: 'both' | 'x' | 'y' | 'none';
   }
   ```

3. **No canvas-state-aware defaults.** When spawning a component, its default position should depend on what's already on the canvas. The current spawn always uses the static `defaultRegionJson`. If you spawn a second composer, it should appear offset from the first one, not stacked on top of it.

   **Required:** Add a `suggestPosition(componentKey, canvasState)` function to the canvas engine that:
   - Reads the current bounding boxes of all mounted components
   - Finds the nearest empty space with sufficient w×h
   - Offsets from the last spawn of the same component type
   - Returns `{x, y, z}` that avoids overlaps

4. **No z-axis.** `RegionRect` and `CanvasLayout` are `{x, y, w, h}` with no `z`. Two components at the same x/y but different z should stack. The execution plan Step 1 adds this — it's not done yet.

---

## QUESTION 2: Strict Zod Schema Contracts for UI Elements

### Verdict: NOT ACCOMMODATED — no runtime validation exists

**The gap is systemic:** The `shared/` directory has plain TypeScript interfaces (`UiComponent`, `Primitive`, `ProviderType`, `RegionRect`, `CanvasLayout`) with ZERO Zod schemas. The `src/schema/` directory has Zod schemas for 13 domains (chrome, streaming, provider-manifest, session, telemetry, automation, etc.) but NONE for the conceptual UI model.

**What this means in practice:**
- `plugin-router.ts` creates `UiComponent` rows by calling `componentStore.create()` with raw objects — no validation
- `seedConceptualModel()` writes `Primitive` + `UiComponent` rows from JSON — no validation
- `POST /api/canvas/layers` accepts layout updates — no validation
- A plugin could ship a manifest with `{ x: -99999, w: -1 }` and it would be written to the DB
- `UiComponent.sandboxJson` is stored as `String @default("{}")` — a plugin shipping `{ allowCapabilities: ["not","a","valid","array"] }` would be stored and only fail at runtime when the sandbox tries to parse it

**What's required — 6 new Zod schemas:**

### 1. `src/schema/conceptual-model.ts` (NEW)

```ts
import { z } from 'zod'

export const RegionRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().default(0),
  w: z.number().min(1).max(10000),
  h: z.number().min(1).max(10000),
})

export const ComponentConstraintsSchema = z.object({
  minWidth: z.number().min(1).optional(),
  minHeight: z.number().min(1).optional(),
  maxWidth: z.number().max(10000).optional(),
  maxHeight: z.number().max(10000).optional(),
  aspectRatio: z.number().positive().optional(),
  resizable: z.boolean().default(true),
  resizeAxes: z.enum(['both', 'x', 'y', 'none']).default('both'),
})

export const SandboxPolicySchema = z.object({
  csp: z.string().default("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"),
  allowNetwork: z.boolean().default(false),
  allowCapabilities: z.array(z.string()).default([]),
  budgetMs: z.number().min(100).max(60000).default(5000),
  allowInlineScript: z.literal(true), // current architecture requires inline scripts
})

export const PrimitiveScopeSchema = z.enum(['cross-type', 'family', 'provider'])

export const UiComponentInputSchema = z.object({
  primitiveId: z.string().min(1),
  scope: PrimitiveScopeSchema,
  ownerId: z.string().min(1),
  variant: z.string().nullable().optional(),
  componentKey: z.string().min(1).regex(/^[a-z0-9._-]+$/i, 'componentKey must be dot-separated identifier'),
  displayName: z.string().min(1).max(200),
  html: z.string().default(''),
  css: z.string().default(''),
  scriptUrl: z.string().nullable().optional(),
  sandbox: SandboxPolicySchema.default({}),
  constraints: ComponentConstraintsSchema.default({}),
  defaultRegion: RegionRectSchema.nullable().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'deprecated']).default('published'),
  author: z.enum(['system', 'user', 'agent']).default('system'),
  version: z.number().int().positive().default(1),
})

// Runtime input/output schema — what data the component consumes and produces
export const ComponentContractSchema = z.object({
  inputs: z.record(z.object({
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
    required: z.boolean().default(false),
    description: z.string().optional(),
    default: z.unknown().optional(),
  })).default({}),
  outputs: z.array(z.object({
    event: z.string(),
    payload: z.record(z.string()).optional(),
    description: z.string().optional(),
  })).default([]),
})
```

### 2. Wire validation at boundaries

Every code path that creates or updates a `UiComponent` row must validate through `UiComponentInputSchema.parse()`:

| Code path | File | What to add |
|---|---|---|
| Plugin install | `src/server/plugin-router.ts` L305 | Wrap `componentStore.create()` input in `UiComponentInputSchema.parse()` |
| Seed data | `seeds/conceptual-model/seed.ts` | Wrap each seed row in `.parse()` |
| Layer CRUD | `src/server/canvas-router.ts` | Validate `RegionRectSchema` on layout updates |
| Sandbox updates | Any endpoint updating `sandboxJson` | Validate `SandboxPolicySchema` |
| Component editor | Future `POST /api/conceptual/components` | Full `UiComponentInputSchema` |

### 3. Runtime slot contract enforcement

The `slotCatalogJson` on `ProviderType` is currently `string[]` (just primitive IDs). This needs to become an array of slot contracts:

```ts
// Current: ["prim:cross:composer", "prim:cross:sidebar"]
// Required:
[{
  primitiveId: "prim:cross:composer",
  required: true,          // family must provide this slot
  minInstances: 1,         // at least 1 instance per surface
  maxInstances: 3,         // at most 3 (e.g., multi-pane)
  accepts: ["text/html"],  // what content types the slot accepts
  contract: {              // input/output contract for the slot
    inputs: { providerSlug: { type: "string", required: true } },
    outputs: [{ event: "message:sent", payload: { text: "string" } }]
  }
}]
```

---

## QUESTION 3: Metadata for Automated Plugin Generation

### Verdict: NOT ACCOMMODATED — no self-description metadata exists

For a system to *generate* a plugin (not just install one), the metadata must describe the component in enough detail that a code generator can produce the HTML/CSS/JS scaffolding. Currently, a `UiComponent` row has:

| Field | Useful for generation? |
|---|---|
| `componentKey` | ✅ Identifies the component |
| `displayName` | ✅ Human label |
| `scope` / `ownerId` | ✅ Where it fits in the resolution chain |
| `html` / `css` | ❌ These are the OUTPUT, not the specification |
| `sandboxJson` | ✅ Permissions needed |
| `defaultRegionJson` | ✅ Default position |
| `tagsJson` | ✅ Search/filter |
| `primitiveId` | ✅ Which slot it fills |

**What's missing for generation:**

1. **Component contract** — what inputs does it accept? What events does it emit? This is the single most important piece for generation. Without it, a generator can't know what data to wire into the component.

2. **Component archetype** — is this a "list" component (sidebar, thread, inbox)? A "form" component (composer, settings)? A "display" component (bubble, result, card)? The archetype determines the HTML scaffolding structure.

3. **Interaction grammar** — `ProviderType.interactionGrammarJson` exists as a catch-all `Record<string, unknown>`. This should be a typed contract: what gestures does this family support? (click-to-send, drag-to-reorder, scroll-to-load-more, swipe-to-archive). The grammar tells the generator what event handlers to wire.

4. **Component variant examples** — if a generator produces a "composer" component for the `ai-chat` family, it needs examples of existing composers to learn from. A `component_examples` table or JSON field with reference implementations.

5. **Layout affinity** — components have natural affinities: "composer is always below thread," "sidebar is always left of thread," "settings is top-right overlay." This relational metadata lets the generator suggest intelligent default layouts.

### Required schema additions:

```ts
// Add to UiComponent model (and shared/ui-component.ts):

componentArchetype    String?  // 'list' | 'form' | 'display' | 'overlay' | 'card' | 'grid'
contractJson          String?  // ComponentContractSchema serialized
examplesJson          String?  // Array of { label, screenshot?, config } examples

// Add to ProviderType model:
interactionGrammarJson → split into typed fields:
  - gestureCatalogJson: GestureCatalog  // { send: 'click'|'enter', navigate: 'click', ... }
  - layoutRulesJson: LayoutRules        // { composer: { affinity: 'bottom', anchorTo: 'thread' }, ... }
  - scrollModel: 'infinite'|'paginated'|'fixed'
```

---

## CONCEPTUAL ENHANCEMENTS REQUIRED

Beyond the three specific questions, these additional contracts are needed for the "default views → user configured views → fully draggable components" vision:

### E.1 User Layout Layer (separation of canonical vs. user state)

```
Layer 1 (canonical): UiComponent.defaultRegionJson
    └── "I am a Claude composer. I default to {x:0, y:500, w:600, h:80}."
Layer 2 (family default): Primitive.defaultRegionJson  
    └── "Composers in the ai-chat family default to bottom-center."
Layer 3 (user override): user_component_layout (new table)
    └── "User dragged me to {x:100, y:450, w:700, h:100} on workspace 'coding'."
```

Resolution: `user_layout (if exists) > UiComponent.defaultRegionJson > Primitive.defaultRegionJson > system default`

### E.2 Workspace-Scoped Layouts

The current `WorkspaceMode` table stores a single `panelsJson`. When a user creates a new workspace ("Research" vs "Coding"), each should have its own layout state. The `user_component_layout` table needs a `workspace_id` column.

### E.3 Component Instance Identity

When the same `UiComponent` (e.g., `ai-chat.composer`) is spawned twice on the same canvas, each instance needs a unique identity. The current `CanvasLayerMounter` generates `instanceId` but doesn't persist it. Without instance identity, you can't say "resize the left composer but not the right one."

### E.4 View Presets (templates)

A "view" is a saved arrangement of components. A user creates a "Daily Standup" view with: composer (top-left), project list (left sidebar), knowledge search (bottom), and saves it. Other users (or the same user on a different workspace) can apply the view preset.

```sql
view_preset (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  layout_json TEXT NOT NULL,   -- array of { componentKey, region }
  workspace_id TEXT,
  is_public INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'system',
  created_at INTEGER NOT NULL
)
```

### E.5 Component Lifecycle Hooks

A component being spawned/dismissed/resized/moved should have lifecycle callbacks so it can adapt. The `SandboxedLayer` bridge should support:

```ts
// Messages sent TO the iframe:
{ type: 'lifecycle', event: 'mounted', layout: { x, y, z, w, h } }
{ type: 'lifecycle', event: 'resized', layout: { w, h } }
{ type: 'lifecycle', event: 'moved', layout: { x, y } }
{ type: 'lifecycle', event: 'visible', visible: boolean }
{ type: 'lifecycle', event: 'dismissed' }
```

A component can then optimize: a hidden component stops polling, a resized component switches to compact mode, etc.

### E.6 Component Interop Bus

Components in different sandboxed iframes can't communicate directly. If the "sidebar" component navigates to a conversation, the "thread" component needs to know. Currently there's no inter-component communication. The `CapabilityEventBus` already exists — it should be bridged into the sandbox as a filtered event stream:

```ts
// In SandboxedLayer bridge:
// Forward capabilityBus events that match the component's subscribed events
{ type: 'event', name: 'conversation:selected', payload: { conversationId } }
```

Each component's `contractJson` declares which events it emits and which it subscribes to.

### E.7 Component Version Compatibility

When a plugin upgrades from v1 to v2, the `UiComponent` rows are replaced. But what about user layout overrides for v1 components? The migration must:
1. Preserve user layouts (map old componentKey → new componentKey)
2. Re-validate against new constraints (v2 might have different min/max sizes)
3. Mark stale overrides if the component was removed

---

## SUMMARY TABLE

| Assessment Area | Current State | Gap Severity | Required Changes |
|---|---|---|---|
| User resizing | Layout stored, no per-user override | 🔴 | `user_component_layout` table, `ComponentConstraints` on `UiComponent` |
| Canvas-state defaults | Static `defaultRegionJson` only | 🟡 | `suggestPosition()` in canvas engine |
| Zod contracts | **None exist** — plain TS interfaces only | 🔴 | 6 new Zod schemas, wire at every write boundary |
| Slot contracts | `slotCatalogJson` is `string[]`, no per-slot schema | 🔴 | Structured slot catalog with input/output contracts |
| Plugin generation metadata | No archetype, no contract, no examples | 🔴 | `componentArchetype`, `contractJson`, `examplesJson` fields |
| Component instance identity | Generated at runtime, not persisted | 🟡 | Persist `instanceId` in layout store |
| View presets | Not modeled | 🟡 | `view_preset` table |
| Component lifecycle hooks | Not in bridge protocol | 🟡 | `lifecycle` message type in SandboxedLayer bridge |
| Component interop | Not supported | 🟡 | Filtered event bus relay to sandboxed iframes |
| Version compatibility | No migration path for user layouts | 🟡 | Preserve + re-validate user layouts on plugin upgrade |

---

## RECOMMENDED EXECUTION ORDER

These are additive — each builds on the previous:

1. **Add Zod schemas** (`src/schema/conceptual-model.ts`) — the foundation for ALL contract enforcement
2. **Wire validation** at the 3 write boundaries (plugin-router, seed, canvas-router)
3. **Add `ComponentConstraints`** to `UiComponent` schema + types — enables safe resizing
4. **Add `user_component_layout` table** — enables persistent user resizing
5. **Add z-axis** to `RegionRect` and `CanvasLayout` — enables depth stacking
6. **Structured slot catalog** — replace `string[]` with `{ primitiveId, contract }[]` on `ProviderType`
7. **Add `componentArchetype` + `contractJson`** to `UiComponent` — enables plugin generation
8. **Add lifecycle hooks** to `SandboxedLayer` bridge
9. **Add component interop** via filtered event bus relay
10. **Add `view_preset` table** + CRUD API
