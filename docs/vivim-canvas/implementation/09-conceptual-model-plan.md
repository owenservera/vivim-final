# Plan: Provider-Type Conceptual Model + DB-Backed Hot-Swappable UI Component Node

## Objective

Make the unified infinite-canvas system **functional** by introducing two missing
conceptual primitives, and wiring them end-to-end (full vertical slice):

1. **`ProviderConceptualModel`** — a DB-backed taxonomy primitive describing the
   *conceptual model* of a surface type. A chat-ai surface (chatgpt.com,
   claude.ai, gemini.google.com) has a fundamentally different mental model
   (composer + thread + bubbles) than a social-media stream (facebook, slack,
   telegram, whatsapp — feeds, posts, reactions) or a designer canvas. Today
   every provider is forced into `provider_type: 'llm'` and the chat-only slot
   set. This primitive lets each provider-type carry its own slot catalog,
   region layout, and interaction grammar.

2. **`UiComponent`** — a DB node that stores hot-swappable UI code (html/css/js +
   sandbox) keyed by `slotId` + `conceptualModelId`. Today `registerCatalogEntry`
   is hardcoded in `web/ui/src/ui/defaults/index.tsx`; there is **no** DB node
   for UI code. This makes the hot-swap system data-driven and persistent.

Both feed the existing canvas/registry machinery so the frontend loads UI from
the DB instead of only from code.

---

## Current State (what exists, what's missing)

**Exists:**
- `shared/canvas-types.ts` — `CanvasDefinition`, `LayerHost`, `SandboxPolicy`
- `web/ui/src/ui/registry.ts` — `UIComponentRegistry` (resolve cap>prov>default)
- `web/ui/src/ui/slots.ts` — `SLOT_IDS` (all `chat.*` only)
- `web/ui/src/features/canvas/*` — CanvasSurface, useNodeTypes, ZoomNode,
  SandboxedLayer, useUiSlots, useStreamBlocks, useCanvasEvents, useManifest
- `src/storage/contracts/canvas-store.ts` — `CanvasStore` contract (definitions/instances)
- `ProviderDefinition.provider_type` (defaults `'llm'`), `ProviderArchetype` /
  `ProviderShapeBinding` (capability-shape/DOM patterns — *not* surface conceptual models)
- Providers seeded in `seeds/providers/*.json` (chatgpt, claude, gemini, facebook,
  slack, telegram, whatsapp, …)

**Missing (this plan builds):**
- No `ProviderConceptualModel` table or seed rows (chat-ai / social-stream / etc.)
- No link from `ProviderDefinition` → conceptual model
- No `UiComponent` table; UI code is code-only (hardcoded defaults)
- `SLOT_IDS` is chat-only — no model-specific slot catalogs
- `useUiSlots` resolves `uiSlots` from capability overrides only; no model-driven
  slot set; no DB-loaded `UiComponent` code

---

## Design

> **Refined by `10-conceptual-matrix.md`.** The matrix shows the schema must
> express a 4-tier resolution chain (provider-unique → family-variant →
> family-global → cross-type → system) without a migration per new
> provider/variant. The design below uses a **closed `Primitive` vocabulary
> table** + a **single modular `UiComponent` table keyed by
> `(scope, ownerId, primitiveId, variant)`** that encodes all four tiers in one
> shape. This replaced the earlier rigid `ProviderConceptualModel` +
> `UiComponent(conceptualModelId)` pairing.

### Primitive 1 — `ProviderType` (family) + `Primitive` (vocabulary)

Two complementary tables:

- **`ProviderType`** — the four families: `ai-chat`, `email`, `messenger`,
  `social`. Owns the family-global slot catalog, canonical region layout, and
  interaction grammar.
- **`Primitive`** — the *closed vocabulary* of all UI primitives across every
  scope (`cross-type | family | provider`). Each primitive is declared ONCE with
  an `id`, `scope`, `familyId?`, `label`, and a `defaultRegion`. This is what
  keeps the system modular: new providers/variants reference existing primitives;
  the vocabulary is closed (P6).

The existing `SLOT_IDS` (`chat.entry`, `chat.thread`, …) become **family-global
primitives** of the `ai-chat` family. New families add their own primitive ids.

#### Shared types (`shared/conceptual-model.ts`)
```ts
export type ProviderTypeSlug = 'ai-chat' | 'email' | 'messenger' | 'social' | 'custom'
export type PrimitiveScope = 'cross-type' | 'family' | 'provider'

export interface ProviderType {
  id: string
  slug: ProviderTypeSlug
  displayName: string
  description: string
  slotCatalogJson: string        // Primitive ids this family exposes (ordered)
  regionLayoutJson: string       // canonical { primitiveId: {x,y,w,h} }
  interactionGrammarJson: string // family interaction rules
  basePrimitive: string
  version: number
}

export interface Primitive {
  id: string                      // e.g. 'message-bubble', 'ai-chat.composer'
  scope: PrimitiveScope
  familyId: string | null         // set when scope='family' | 'provider'
  providerId: string | null       // set when scope='provider'
  label: string
  description: string | null
  defaultRegionJson: string
  version: number
}
```

#### Prisma models (`prisma/schema.prisma`)
```prisma
model ProviderType {
  id                   String @id
  slug                 String @unique
  displayName          String @map("display_name")
  description          String?
  slotCatalogJson      String @default("[]") @map("slot_catalog_json")
  regionLayoutJson     String @default("{}") @map("region_layout_json")
  interactionGrammarJson String @default("{}") @map("interaction_grammar_json")
  basePrimitive        String @default("conversations") @map("base_primitive")
  version              Int    @default(1)
  createdAt            BigInt @map("created_at")
  updatedAt            BigInt @map("updated_at")

  providers            ProviderDefinition[]
  primitives           Primitive[]

  @@map("provider_type")
}

model Primitive {
  id              String  @id
  scope           String  @map("scope")      // 'cross-type' | 'family' | 'provider'
  familyId        String? @map("family_id")
  providerId      String? @map("provider_id")
  label           String
  description     String?
  defaultRegionJson String @default("{}") @map("default_region_json")
  version         Int     @default(1)
  createdAt       BigInt  @map("created_at")
  updatedAt       BigInt  @map("updated_at")

  family          ProviderType? @relation(fields: [familyId], references: [id], onDelete: Cascade)
  provider        ProviderDefinition? @relation(fields: [providerId], references: [id], onDelete: Cascade)
  components       UiComponent[]

  @@index([scope, familyId], map: "idx_prim_scope_family")
  @@index([scope, providerId], map: "idx_prim_scope_provider")
  @@map("primitive")
}
```
And add to `ProviderDefinition` (replaces the old `provider_type` string use for
surface typing):
```prisma
providerTypeId     String? @map("provider_type_id")
providerType       ProviderType? @relation(fields: [providerTypeId], references: [id], onDelete: SetNull)
@@index([providerTypeId], map: "idx_pd_ptype")
```
> Note: the legacy `provider_type` STRING column stays (kept for backward
> compat with automation/shape code); `providerTypeId` is the new FK to the
> family. Update `ProviderDefinitionRow` + `provider-store-impl.ts`.

### Primitive 2 — `UiComponent` (DB node for hot-swap code, modular)

A single table expressing **all four resolution tiers** via a
`(scope, ownerId, primitiveId, variant)` key. One row per (primitive, owner)
pairing, storing the actual UI code.

#### Shared types (`shared/ui-component.ts`)
```ts
export type UiComponentScope = 'cross-type' | 'family' | 'provider'
export type UiComponentStatus = 'draft' | 'published' | 'deprecated'

export interface UiComponent {
  id: string
  primitiveId: string            // FK → Primitive.id
  scope: UiComponentScope        // which tier this component belongs to
  ownerId: string                // familyId | providerId | 'global' (cross-type)
  variant: string | null         // e.g. 'gemini', 'gmail-rich', null = canonical
  componentKey: string           // catalog key, e.g. 'ai-chat.gemini.composer'
  displayName: string
  html: string
  css: string
  scriptUrl: string | null
  sandboxJson: string            // SandboxPolicy
  version: number
  status: UiComponentStatus
  author: 'system' | 'user' | 'agent'
  tagsJson: string
  createdAt: number
  updatedAt: number
}
```

#### Prisma model (`prisma/schema.prisma`)
```prisma
model UiComponent {
  id           String  @id
  primitiveId  String  @map("primitive_id")
  scope        String  @map("scope")        // 'cross-type' | 'family' | 'provider'
  ownerId      String  @default("global") @map("owner_id")
  variant      String? @map("variant")
  componentKey String  @map("component_key")
  displayName  String  @map("display_name")
  html         String  @default("")
  css          String  @default("")
  scriptUrl    String? @map("script_url")
  sandboxJson  String  @default("{}") @map("sandbox_json")
  version      Int     @default(1)
  status       String  @default("published")
  author       String  @default("system")
  tagsJson     String  @default("[]") @map("tags_json")
  createdAt    BigInt  @map("created_at")
  updatedAt    BigInt  @map("updated_at")

  primitive    Primitive @relation(fields: [primitiveId], references: [id], onDelete: Cascade)

  @@unique([primitiveId, scope, ownerId, variant])
  @@index([scope, ownerId], map: "idx_uc_scope_owner")
  @@index([primitiveId], map: "idx_uc_prim")
  @@map("ui_component")
}
```

#### Resolution (maps to `10-conceptual-matrix.md` §3)
Given a `(providerId, primitiveId)` request, the `UiComponentStore.resolve()`
walks:
```
provider + variant?  (scope='provider', ownerId=providerId, variant)
provider canonical?  (scope='provider', ownerId=providerId, variant=null)
family  + variant?   (scope='family',   ownerId=familyId,    variant)
family  canonical?   (scope='family',   ownerId=familyId,    variant=null)
cross-type?          (scope='cross-type', ownerId='global')
→ system built-in default
```
This is the DB realization of the 4-tier precedence. The existing
`UIComponentRegistry.resolve(capability > provider > default)` maps onto it:
capability→provider-unique, provider→family-variant/global, default→cross-type.

#### Storage contract + impl
- `src/storage/contracts/ui-component-store.ts` — `getForPrimitive(providerId,
  primitiveId)`, `resolve(providerId, primitiveId)`, `listByOwner(scope, ownerId)`,
  `create`, `upsertFromSeed`, `delete`.
- `src/storage/impl/ui-component-store-impl.ts` — Prisma impl + row⇄domain mappers.

#### Seeds (`seeds/ui-components/`)
Organized by family, then provider uniques:
- `ai-chat/` — `composer.cross-type.json` (shared prompt box), `composer.gemini.json`
  (variant), `message-bubble.cross-type.json`, `artifacts-pane.claude.json`
  (provider unique), `artifacts-pane.provider.json` (scope=provider, owner=claude).
- `email/` — `composer.gmail-rich.json`, `labels.gmail.json`, `message-list.cross-type.json`.
- `messenger/` — `message-bubble.whatsapp.json`, `voice-note.telegram.json`.
- `social/` — `feed.cross-type.json`, `post-card.cross-type.json`, `reels.instagram.json`.
- Loader `seeds/ui-components/seed.ts`.

#### Provider seeds
- `seeds/providers/{chatgpt,claude,gemini}.json` → `"provider_type": "ai-chat"`
  (already `llm`; add family slug mapping at registration).
- `{gmail,outlook,*}.json` → `"provider_type": "email"`.
- `{whatsapp,telegram,signal,discord}.json` → `"provider_type": "messenger"`.
- `{facebook,linkedin,instagram,twitter}.json` → `"provider_type": "social"`.
- Add `provider_type` (slug) handling in `ProviderManifestSchema` (optional) and
  map to `providerTypeId` in the registrar.

---

### Backend wiring (the "functional" half)

1. **`ConceptualModelService`** (`src/engines/conceptual-model-service.ts`):
   - `resolveFamilyForProvider(providerId)` → joins `ProviderDefinition.providerTypeId`.
   - `getSlotCatalog(familySlug)` → returns `Primitive[]` for that family.
   - `resolveUiComponent(providerId, primitiveId)` → walks the 4-tier precedence
     (see `10-conceptual-matrix.md` §3) and returns the winning `UiComponent`.
   - `getRegionLayout(familySlug)` → canonical regions for canvas placement.

2. **New endpoint** (extend `src/server/capability-router.ts`, no new transport):
   - `GET /api/provider-types/:slug` → family spec (slot catalog, regions, grammar)
     + its `UiComponent` rows. Frontend builds the node catalog + loads code.
   - `GET /api/providers/:slug/type` → provider → family resolution.
   - `GET /api/ui-components/resolve?providerId=&primitiveId=` → returns the
     resolved component (html/css/sandbox).

3. **`src/server/canvas-router.ts`** (new or extend existing): serve the above.

### Frontend wiring (load UI from DB)

1. **`web/ui/src/features/canvas/useConceptualModel.ts`** (new):
   - Fetches `/api/provider-types/:slug`; returns `{ primitives, regions, grammar }`.
   - On load, calls `applyUiComponents(components)` → for each `UiComponent`,
     `registry.registerUiComponent(component)` (sandboxed via `SandboxedLayer`).

2. **`web/ui/src/ui/registry.ts`** — add `registerUiComponent(component: UiComponent)`
   mapping `html/css/scriptUrl` → a React component wrapping `SandboxedLayer`,
   keyed by `componentKey`, then `registerCatalogEntry`.

3. **`CanvasSurface.tsx`** — replace hardcoded `SEED_NODES` (all `chat.*`) with
   family-driven seed nodes: fetch the provider's family, lay out nodes from
   `regionLayout`. chat-ai → chat slots; social → feed/composer/post; etc.

4. **`useNodeTypes.tsx`** — extend `SLOT_LABELS`/`CATEGORY_COLORS` to be
   family-aware so different families render differently with the same engine.

---

## Files to Create

- `shared/conceptual-model.ts` — `ProviderType`, `Primitive`, scope types
- `shared/ui-component.ts` — `UiComponent`, scope, status types
- `src/storage/contracts/provider-type-store.ts` — `ProviderTypeStore`
- `src/storage/contracts/primitive-store.ts` — `PrimitiveStore`
- `src/storage/contracts/ui-component-store.ts` — `UiComponentStore` (+ `resolve`)
- `src/storage/impl/provider-type-store-impl.ts`
- `src/storage/impl/primitive-store-impl.ts`
- `src/storage/impl/ui-component-store-impl.ts`
- `src/engines/conceptual-model-service.ts` — resolution + family lookup
- `src/server/canvas-router.ts` (or extend capability-router)
- `seeds/provider-types/{ai-chat,email,messenger,social}.json`
- `seeds/provider-types/seed.ts`
- `seeds/primitives/*.json` (cross-type + per-family primitives)
- `seeds/ui-components/{ai-chat,email,messenger,social}/*.json`
- `seeds/ui-components/seed.ts`
- `web/ui/src/features/canvas/useConceptualModel.ts`

## Files to Modify

- `prisma/schema.prisma` — add `ProviderType`, `Primitive`, `UiComponent` models
  + `ProviderDefinition.providerTypeId`
- `src/schema/types.ts` — new row types + `ProviderDefinitionRow.providerTypeId`
- `src/storage/impl/provider-store-impl.ts` — set `providerTypeId` on upsert
- `web/ui/src/ui/registry.ts` — `registerUiComponent`
- `web/ui/src/features/canvas/CanvasSurface.tsx` — family-driven seed nodes
- `web/ui/src/features/canvas/useNodeTypes.tsx` — family-aware labels/colors
- `web/ui/src/features/canvas/useUiSlots.ts` — also apply family UiComponents
- `seeds/providers/*.json` — add `"provider_type"` slug (ai-chat/email/messenger/social)

---

## Migration & Verification

1. `bunx prisma migrate dev --name add_provider_type_primitive_ui_component`
   (or `db push` for local-first dev) → creates tables.
2. Run seed loaders:
   `bun run seed:provider-types && bun run seed:primitives && bun run seed:ui-components`
   (wire into `package.json` scripts / existing seed runner).
3. `bun run typecheck` — must pass (including new shared types).
4. `bun test` — add unit tests:
   - `provider-type-store` / `primitive-store` round-trip (row⇄domain).
   - `ui-component-store` unique constraint `(primitiveId, scope, ownerId, variant)`
     + `resolve()` walks the 4-tier precedence.
   - `ConceptualModelService.resolveFamilyForProvider` + `resolveUiComponent`
     with seeded data (chatgpt → ai-chat → gemini.composer variant wins).
   - `registry.registerUiComponent` → `resolve` returns sandboxed wrapper.
5. Manual smoke (devops fullstack skill): start backend + frontend; open a
   chat-ai provider → canvas lays out chat slots from regionLayout; open a
   social provider → canvas lays out feed/composer/post from its family. Confirm
   `UiComponent` html renders via `SandboxedLayer` and a family/provider override
   from DB wins over the cross-type default.

---

## Open Questions Resolved by User

- Conceptual model storage: **DB-backed taxonomy** ✅
- UI component node: **new `UiComponent` table** ✅
- Scope: **full vertical slice** ✅

## Risks / Notes

- `ProviderArchetype`/`ProviderShapeBinding` already exist for *capability shapes*
  (DOM automation). The new `ProviderType`/`Primitive`/`UiComponent` tables are
  deliberately separate (surface grammar + UI code, not DOM selectors) to avoid
  conflation.
- `SLOT_IDS` is currently a `const` tuple (`as const`) of chat-only slots. The new
  design moves the *vocabulary* into the `Primitive` table (DB), so the code
  `SLOT_IDS` becomes the `ai-chat` family's seed primitives. New families add
  rows, not code.
- A single `UiComponent` table with `(scope, ownerId, variant)` expresses all four
  resolution tiers — no per-tier tables, so adding a tier or variant is a row
  insert, not a migration (graceful evolution, per `10-conceptual-matrix.md` §5).
- Sandboxed React rendering: `UiComponent.html` is rendered through the existing
  `SandboxedLayer` (iframe + MessageChannel). Non-sandboxed React defaults remain
  the fallback for primitives without a DB `UiComponent`.
- Backend endpoints reuse existing server patterns (capability-router) — no new
  transport (One Entry Point invariant preserved).

---

## Frontend Integration — Implemented (as-built)

The frontend wiring landed against `src/server/conceptual-router.ts` (not
`canvas-router.ts`). The endpoint used is:

```
GET /api/conceptual/surface?providerId=<providerId>
→ { ok, providerId, family, slots: [{ primitive, component, tier, fromSystemDefault }] }
```

`component` is the resolved `UiComponent` domain object (`html`, `css`,
`scriptUrl`, `componentKey`, `defaultRegion`).

### Files added / changed

- **`web/ui/src/ui/ui-component-renderer.tsx`** (new) — `createUiComponentRenderer(payload)`
  wraps a raw `html/css` payload into a React component (rendered via
  `dangerouslySetInnerHTML` inside a `.conceptual-ui-component` div). Kept as
  `.tsx` because `registry.ts` is `.ts` and cannot contain JSX.
- **`web/ui/src/ui/registry.ts`** —
  - `registerUiComponent(slot, slug, payload)` — registers the renderer under
    `payload.componentKey` in the catalog, then `applyClaim`s it for `(slot, slug)`.
  - `catalogResolve(key)` — resolves a catalog key directly to its component
    (used by the generic `conceptual` node type).
  - `UiComponentPayload` type now lives in `ui-component-renderer.tsx`.
  - `SlotOverrideClaim.slot` made optional (backend claim carries no `slot`).
- **`web/ui/src/features/canvas/useConceptualModel.ts`** (new) —
  `useConceptualModel(providerId)` fetches `/api/conceptual/surface`, hot-swaps
  each resolved component into the registry (mapped to a `chat.*` SlotId when the
  primitive id resolves), and exposes `toNodes()` to build `CanvasNode[]` from the
  resolved family primitives (position from `primitive.defaultRegion` or a slot
  fallback map).
- **`web/ui/src/features/canvas/useNodeTypes.tsx`** — added a generic
  `conceptual` node type (keyed by `data.componentKey`) so non-chat primitives
  render via their registered component; chat primitives still use the slot
  node types.
- **`web/ui/src/features/canvas/CanvasSurface.tsx`** — now takes a `providerId`
  prop (default `'chatgpt'`), consumes `useConceptualModel`, and swaps the
  hardcoded `SEED_NODES` for the resolved family nodes once the surface loads
  (seed nodes remain as a fallback when the backend is unreachable).
- **`web/ui/src/ui/slots.ts`** — `SlotOverrideClaim.slot` optional.

### Mapping note (primitive id → slot id)

The conceptual primitives are namespaced (`ai-chat.entry`, `ai-chat.composer`, …)
while the code slot catalog is flat (`chat.entry`, `chat.composer`). The hook maps
a primitive id to a slot id by dropping the family prefix and re-prefixing with
`chat.` when the result is in `SLOT_IDS`; otherwise the node uses the generic
`conceptual` type keyed by `componentKey`.

### Verification

- `bun run typecheck` (web/ui) — 0 new errors introduced (15 pre-existing
  unrelated errors in bun-types/vite/ChatPage/command-bar remain untouched).
- Backend 4-tier resolution verified separately (see prior session notes); the
  surface endpoint returns the seeded ai-chat family slots for `chatgpt`.

