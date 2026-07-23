

# ═══════════════════════════════════════════════════════════════
# PART FILE: 00-the-vision.md
# ═══════════════════════════════════════════════════════════════

# The Vivim Canvas: One Screen, Everything, Live

## What We're Building

Imagine opening a single browser tab — and that tab is not a webpage. It's a **space**.

Not a dashboard. Not an app. A living workspace where every piece of the interface is a thing you can grab, move, resize, replace, or let an agent create for you on the fly. Chat. Email. Code. Dashboards. They're all just **nodes on a surface**, floating in a boundless infinite canvas.

Right now, most software gives you a fixed grid. You get a sidebar here, a header there, a chat window somewhere else, and if you want to change that layout, you file a feature request and wait six months. The interface is **frozen** at compile time. The developers decided what you see, and that's what you get.

We're building the opposite.

---

## The Core Idea: The Interface Is Data, Not Code

In Vivim, the UI is stored in a database. Not a config file. Not a JSON blob. Real database rows — one per UI component — with the actual HTML, CSS, and (sandboxed) JavaScript that makes up each piece of the screen.

Every component lives in a table. Each row says: "Here's the markup. Here's the styling. Here's what it does. Here's who it belongs to." When you open the app, the system looks at what you need — which provider, which family of tools, which variant — and **resolves** the right components for the right slots on the canvas.

Change a row in the database, and the interface changes. No rebuild. No deploy. No restart. The canvas is **hot-swappable** by design.

This means:

- A new version of the chat composer? Write the HTML/CSS, update the row, and it's live for every user.
- A custom sidebar for a specific provider? Add a provider-scoped component, and it overrides the default.
- A family-wide theme for all email interfaces? Store it as a component row scoped to the `email` family, and every email provider inherits it.
- An agent builds a new UI panel while you watch? It writes a component row, and the node appears on your canvas in real time.

The shell doesn't know or care what's inside each node. It just resolves and renders. That's the power of making the UI **data**.

---

## The Canvas: An Infinite, Programmable Space

The single screen is an infinite canvas powered by React Flow. Every UI region — the chat header, the message thread, the composer, the sidebar, the action bar, the streaming results — is a **node** on this canvas.

You can drag them. Resize them. Minimize them. Zoom in and out. Layer them by depth. Snap them to a grid. Undo any change. The canvas remembers where everything is, per user, per workspace.

But here's what makes it more than a drawing tool:

**Every node is connected to the backend.** When you drag the composer, its new position is saved to the database. When you resize the thread panel, that's persisted. When an agent spawns a new node — say, a live results panel for a streaming response — it appears on the canvas via a WebSocket event, and it stays where you put it.

The canvas is not a static layout. It's a **living surface** where the interface reorganizes itself based on what you're doing, who you're talking to, and what the system needs to show you right now.

---

## Hot-Swappable Components: The Slot System

Think of the canvas as a collection of **slots**. Each slot has a name — `chat.header`, `chat.thread`, `chat.composer`, `chat.sidebar`, `chat.actionBar`, and so on. These are the capability globals: the slots that any UI surface can fill.

When you connect to a provider — say ChatGPT, or Gmail, or a custom tool — the system asks: "What components should fill these slots for *this* provider?"

The answer comes from a **4-tier resolution system**:

1. **Provider + variant**: If ChatGPT has a Gemini variant, use that component.
2. **Provider canonical**: If not, use ChatGPT's own override.
3. **Family + variant**: If the provider doesn't override, use the `ai-chat` family's version.
4. **Family canonical**: Or the family's default.
5. **Cross-type**: Or the universal default that works everywhere.
6. **System built-in**: Or the hardcoded fallback.

This means you can customize at any level. Override one slot for one provider. Override all slots for a whole family. Or let the system defaults handle everything. The resolution is automatic, deterministic, and driven entirely by data.

When a new component is published — say, someone writes a better chat composer — it can be hot-swapped into any slot without touching any other code. The shell doesn't recompile. The canvas doesn't blink. The old component is gone, the new one is there, and the user never noticed the transition.

---

## Composable On the Fly: Agents as UI Builders

This is where it gets powerful.

Because the UI is data, **agents can build it**. A Vivim agent doesn't just answer questions — it can create, modify, and arrange UI components on your canvas in real time.

Need a live dashboard that tracks your API usage? An agent can create a `UiComponent` row with the right HTML/CSS, assign it to a slot, and spawn a node on your canvas. It appears instantly via the WebSocket.

Want to customize how a particular provider renders its results? The agent can write a provider-scoped component, publish it, and the resolution system picks it up. No human intervention needed.

The canvas becomes a **programmable surface** where the interface evolves as you work. You're not just using software — you're co-creating it with your agents. They build the UI. You arrange it. They extend it. You refine it. The boundary between "user" and "builder" dissolves.

---

## The Conceptual Model: Family-Driven Surfaces

Not every provider needs a completely different UI. An email provider and a chat provider share a lot of structural DNA — they both have a composer, a message list, a sidebar, a header. The differences are in the details: what the send button does, how threads are structured, what metadata is shown.

The **conceptual model** captures this. Each provider belongs to a **family** — `ai-chat`, `email`, `messenger`, `social`, `custom`. Each family defines a **vocabulary** of primitives: the slots that are relevant to it. The `ai-chat` family might have `prompt-box`, `response-stream`, `tool-output`, `model-selector`. The `email` family might have `inbox-list`, `compose-window`, `attachment-bar`, `signature-editor`.

These primitives are the building blocks. Families compose them. Providers override them. The resolution system decides which version wins.

This means adding a new provider doesn't mean building a new UI from scratch. You declare its family, and the family's slot catalog and interaction grammar give you a working surface immediately. You only override what's different.

---

## Sandboxed, Secure, Live

Every component runs in a sandboxed iframe. No inline script. No access to the parent page. Communication happens through a MessageChannel with a strict Content Security Policy. The system controls what each sandboxed component can do — which capabilities it can call, how much CPU time it gets, what network requests it can make.

This isn't a restriction — it's a guarantee. Because every component is sandboxed, you can run untrusted code on the canvas without worrying about it breaking the shell. An agent can drop in a component written by a stranger, and it's safe. A provider can ship its own UI, and it can't snoop on other providers.

The sandbox is invisible to the user. Components render, interact, stream results, and feel native. But underneath, they're isolated and controlled.

---

## Progressive Results: Streaming Into the Canvas

When you send a message to an AI provider, the response doesn't appear all at once. It streams in — text blocks, thinking blocks, code blocks, citations, tool outputs, images, artifacts. Each block arrives as a `StreamBlock` with a kind and an index.

The canvas renders these progressively. A `StreamingSlot` shows the response building in real time. A `ResultSlot` organizes completed blocks. You see the AI thinking, writing code, fetching data, and assembling the answer — all as live nodes on the canvas, not a static text box.

This is the "progressive results" model. The interface doesn't wait for the backend to finish. It renders what's available, when it's available, where it's available. The canvas is always live.

---

## What This Enables (The Vision)

**One screen, everything.** Chat. Email. Code. Dashboards. Agents. Projects. Knowledge bases. All on one canvas. No tab switching. No context loss. You see everything at once, arranged the way you want.

**The interface is yours.** Drag nodes. Resize panels. Minimize what you don't need. Zoom into what matters. Save layouts as presets. Share them with your team. The canvas adapts to how you work, not the other way around.

**Agents build the UI.** Not just answer questions — *build the interface*. Create components. Arrange nodes. Customize surfaces. The canvas is a programmable space where agents and humans co-create the experience.

**New providers, instant surfaces.** Add a provider, declare its family, and you get a working UI. Override what's different. The resolution system handles the rest. No migrations. No rebuilds. Just data.

**Everything is live.** WebSocket events spawn and dismiss nodes in real time. Streaming responses render block by block. Changes propagate instantly. The canvas never feels stale.

**Everything is safe.** Sandboxed iframes. CSP. MessageChannel bridges. No inline script. The shell is inviolable. You can run untrusted code on the canvas without risk.

---

## The Technical Truth

Under the hood, this is:

- **Backend**: Bun + TypeScript (strict) + Prisma v6.5 (SQLite). 13 engines. A `ConceptualModelService` that resolves which component wins for which slot. A `CanvasLayerMounter` that emits spawn/dismiss events.
- **Frontend**: Vite + React + @xyflow/react (React Flow). A single `CanvasSurface` component. A `UIComponentRegistry` that maps slot IDs to components. Hooks that fetch, resolve, and render.
- **Data**: 54 database tables. `ProviderType` (families). `Primitive` (vocabulary). `UiComponent` (the HTML/CSS/script per slot). `UserComponentLayout` (where nodes live on the canvas). `StreamBlock` (progressive results).
- **Transport**: HTTP for CRUD. WebSocket for live events. Capability-backed routes — every operation is a `UnifiedCapability` that works across CLI, UI, API, and MCP.

The frontend shell is deliberately thin. It doesn't know what's inside each node. It just resolves, renders, and arranges. The richness lives in the registry, the database, and the components themselves.

That's the point. The shell is **dumb** by design. The data is **smart**. And the agents are **creative**.

---

## In One Sentence

We're building a single infinite canvas where the entire UI is database-driven, hot-swappable, sandboxed, agent-buildable, and live — so that the interface isn't something you use, it's something you **compose**, and it composes itself.



# ═══════════════════════════════════════════════════════════════
# PART FILE: 01-overview-and-vision.md
# ═══════════════════════════════════════════════════════════════

# DOC 1 — PROJECT OVERVIEW & THE CANVAS VISION (vivim-final)

> This is the single most important context file. Read it first. It explains what vivim-final is, what the unified canvas is, and the invariant rules you MUST NOT break when you build.

## 1. What vivim-final is

`vivim-final` is **cap-store v1 Knowledge Graph Rebuild** — a local-first AI conversation platform. It is NOT a generic web app; it is a capability-driven system where **every user operation is a `UnifiedCapability`** and the UI is generated from a database-backed model, not hardcoded React branches.

- **Runtime:** Bun
- **Language:** TypeScript (strict, ESNext, `.js` import extensions required)
- **ORM:** Prisma v6.5 (SQLite)
- **Frontend:** Vite + React + **@xyflow/react (React Flow)** for the canvas
- **Linter:** Biome

The PRIMARY frontend surface is the **unified infinite canvas** (`web/ui/src/features/canvas/CanvasSurface.tsx`). It renders every UI region as a swappable, data-driven node. A single React Flow instance IS the shell. There is no second registry — `UIComponentRegistry` IS the `nodeTypes` map.

## 2. The Canvas Vision (PRD-VIVIM-CANVAS-UNIFIED-SURFACE)

> "Redesign the primary user UI as an **infinite, programmable HTML canvas** where layers (chat, system, automation, agents, projects, knowledge, designer) are **swapped in on demand**. The shell is pure HTML — re-programmable by design — shipping with a robust closed set of core primitives. The canvas is an **oracle**: global access, global visibility, agentic-native, configurable by primitives."

Concrete realization = the **modular UI system**:
- A DB-backed **`ProviderType` (family)** conceptual model
- A **`UiComponent`** node that stores hot-swappable UI code (html/css/js + sandbox), resolved through a 4-tier precedence and rendered as canvas nodes.

## 3. THE INVARIANTS (never violate — these are enforced and will fail audits)

1. **Frontend = Backend (5.1):** A capability/provider `slug` is the single link between backend and frontend. Render the contract + resolve slots. NEVER hardcode `if (slug === 'x')`. The POC (`html-shell-sdk-1`) violates this — it hardcodes tools/themes in React. Your build must not.
2. **UI code is DATA, not code (P1):** `UiComponent` rows store html/css/sandboxJson. Surfaces are published from the DB, not compiled into the bundle.
3. **Dumb shell (P2):** `CanvasSurface` is a thin React Flow host. Richness lives in `registry.resolve()`.
4. **Governor Canon (P7/B1):** Only `ChromeGovernor` touches CDP. No engine imports CDP transport. The canvas layer mounter emits events only — it never touches the DOM.
5. **Sandboxed (P8):** `SandboxedLayer` renders components in an iframe with a CSP. NO inline `<script>` at def-time or render-time.
6. **One Entry Point (25.7):** Every operation is a `UnifiedCapability`. CLI/UI/API are thin shells over `POST /api/interpret` and `/api/capabilities/:id/execute`.
7. **Store Contracts (B2):** Engines depend on `src/storage/contracts/*`, never `src/storage/impl/*`.
8. **Type safety:** No `any`. Use `unknown` + narrowing. Zod at boundaries.
9. **FRONTEND=BACKEND cross-surface:** A capability must resolve across CLI, API, MCP, and UI. Verify with `bun run devops verify-cross-surface`.

## 4. The DB-Driven Protocol rule (P1)

Provider-specific composer selectors, send methods, capture patterns, fetch URL patterns, and DOM selectors live in the DB (`ProviderEndpoint` rows, seeded from `seeds/providers/*.json`). NEVER hardcode these in TypeScript. New providers: write JSON → `bun run seed`.

## 5. What the POC (`dev-poc/canvas/html-shell-sdk-1`) IS and IS NOT

The POC is a **standalone Next.js 15 + React 19 + Tailwind/shadcn** playground that proves a *generic* drawing-canvas SDK: an EventBus, CommandStack (undo/redo), QuadTree (spatial index), Scene, CanvasEngine, 8 tools (select/pan/rectangle/ellipse/line/text/freehand/connection), 5 renderers, theme switcher, and a `.zip` SDK download. It is a **SOTA reference for low-level canvas rendering mechanics** (rAF loop, spatial indexing, command pattern, plugin API) — NOT a model for how vivim's UI surface works.

**Gap (why we need you):** The POC knows nothing about vivim's conceptual model, capability system, DB, or React-Flow node graph. Its "canvas" is a freeform drawing board; vivim's "canvas" is a node-graph where each node is a *resolved capability/slot* rendered from `UiComponent` DB rows inside a sandboxed iframe. Your job is to bring the POC's rendering quality (smooth engine, spatial index, z-layers, tool system) INTO vivim's data-driven node canvas — without breaking the invariants above.

## 6. How the stack boots (for context)

- `bun run serve` starts engines only (no re-seeding, no migrate).
- `bun run db:setup` = migrate + seed (first time only).
- `bun run db:seed` = re-seed providers from JSON manifests.
- Frontend dev server is Vite on `:5173`; backend on `:9420` (resolve via `.runtime/backend.port`).
- Launch stack: `pwsh scripts/start-bg.ps1` (non-blocking). Tear down: `pwsh scripts/stop-all.ps1`.
- NEVER use Playwright. Use the project's own CDP tools (`devops runtime-test engage/verify/debug`).

## 7. Directory layout you must follow

```
src/
  engines/        # One file per engine. CanvasLayerMounter, ConceptualModelService, etc.
  storage/contracts/   # Store interfaces engines depend on
  storage/impl/        # Implementations (never imported by engines directly)
  schema/         # Zod schemas
  server/         # HTTP routers (canvas-router.ts, conceptual-router.ts, conversation-router.ts, websocket.ts)
  index.ts        # Public barrel
shared/           # Types shared by backend (Bun) AND frontend (Vite): canvas-types.ts, stream-blocks.ts, conceptual-model.ts, ui-component.ts
web/ui/src/
  features/canvas/  # CanvasSurface.tsx + hooks (useConceptualModel, useCanvasEvents, useUiSlots, useStreamBlocks, useNodeTypes, ...)
  ui/              # UIComponentRegistry (registry.ts), slots.ts (SLOT_IDS), defaults/, actions/registry.ts
seeds/conceptual-model/seed.ts  # Idempotent boot seeder for ProviderType + Primitive + UiComponent
prisma/schema.prisma            # All tables (54 tables; canvas model in L1b)
```

Frontend import rule: ALWAYS use `@/*` path alias → `./src/*`, `.js` extension in imports, `type` imports for types, no `any`.



# ═══════════════════════════════════════════════════════════════
# PART FILE: 02-data-model.md
# ═══════════════════════════════════════════════════════════════

# DOC 2 — DATA MODEL: PRISMA SCHEMA (canvas-relevant tables)

> This is the source of truth for what data exists. The frontend MUST render from these rows. Mirrored types live in `shared/`.

## 2.1 L1b: Provider-Type (family) + Primitive + UiComponent (the vivim-canvas conceptual model)

```prisma
model ProviderType {
  id                     String  @id
  slug                   String  @unique   // 'ai-chat' | 'email' | 'messenger' | 'social' | 'custom'
  displayName            String  @map("display_name")
  description            String?
  slotCatalogJson        String  @default("[]") @map("slot_catalog_json")   // ordered primitive ids
  regionLayoutJson       String  @default("{}") @map("region_layout_json")  // { primitiveId: RegionRect }
  interactionGrammarJson String  @default("{}") @map("interaction_grammar_json")
  basePrimitive          String  @default("conversations") @map("base_primitive")
  version                Int     @default(1)
  createdAt              BigInt  @map("created_at")
  updatedAt              BigInt  @map("updated_at")
  providers        ProviderDefinition[] @relation("ProviderTypeToDefinition")
  familyPrimitives Primitive[]          @relation("PrimitiveFamily")
  @@map("provider_type")
}

model Primitive {
  id                String  @id
  scope             String  @map("scope")   // 'cross-type' | 'family' | 'provider'
  familyId          String? @map("family_id")
  providerId        String? @map("provider_id")
  label             String
  description       String?
  defaultRegionJson String  @default("{}") @map("default_region_json")  // RegionRect JSON
  version           Int     @default(1)
  createdAt         BigInt  @map("created_at")
  updatedAt         BigInt  @map("updated_at")
  family     ProviderType?       @relation("PrimitiveFamily", fields: [familyId], references: [id], onDelete: Cascade)
  provider   ProviderDefinition? @relation("PrimitiveProvider", fields: [providerId], references: [id], onDelete: Cascade)
  components UiComponent[]
  @@index([scope, familyId], map: "idx_prim_scope_family")
  @@index([scope, providerId], map: "idx_prim_scope_provider")
  @@map("primitive")
}

model UiComponent {
  id                String  @id
  primitiveId       String  @map("primitive_id")
  scope             String  @map("scope")   // 'cross-type' | 'family' | 'provider'
  ownerId           String  @default("global") @map("owner_id")  // familyId | providerId | 'global'
  variant           String? @map("variant")  // e.g. 'gemini', 'chatgpt'
  componentKey      String  @map("component_key")  // e.g. 'ai-chat.gemini.composer'
  displayName       String  @map("display_name")
  html              String  @default("")
  css               String  @default("")
  scriptUrl         String? @map("script_url")
  sandboxJson       String  @default("{}") @map("sandbox_json")   // SandboxPolicy JSON (P8)
  constraintsJson   String  @default("{}") @map("constraints_json")  // ComponentConstraints
  contractJson      String  @default("{}") @map("contract_json")    // ComponentContract
  archetype         String? @map("archetype")  // 'list'|'form'|'display'|'overlay'|'card'|'grid'
  version           Int     @default(1)
  status            String  @default("published")  // 'draft'|'published'|'deprecated'
  author            String  @default("system")     // 'system'|'user'|'agent'
  tagsJson          String  @default("[]") @map("tags_json")
  defaultRegionJson String  @default("") @map("default_region_json")
  createdAt         BigInt  @map("created_at")
  updatedAt         BigInt  @map("updated_at")
  primitive Primitive @relation(fields: [primitiveId], references: [id], onDelete: Cascade)
  @@unique([primitiveId, scope, ownerId, variant])   // ONE table encodes all 4 tiers
  @@index([scope, ownerId], map: "idx_uc_scope_owner")
  @@index([primitiveId], map: "idx_uc_prim")
  @@map("ui_component")
}
```

## 2.2 User layout + view presets (canvas node positions persist here)

```prisma
model UserComponentLayout {
  id           String  @id
  userId       String  @map("user_id")
  componentKey String  @map("component_key")
  instanceId   String  @map("instance_id")
  workspaceId  String? @map("workspace_id")
  x Float; y Float; z Float @default(0); w Float; h Float
  minimized    Int    @default(0)
  updatedAt    BigInt  @map("updated_at")
  @@index([userId, workspaceId], map: "idx_ucl_user_workspace")
  @@index([componentKey, instanceId], map: "idx_ucl_component_instance")
  @@map("user_component_layout")
}

model ViewPreset {
  id          String  @id
  name        String
  description String?
  layoutJson  String  @map("layout_json")
  workspaceId String? @map("workspace_id")
  isPublic    Int     @default(0) @map("is_public")
  createdBy   String  @default("system") @map("created_by")
  createdAt   BigInt  @map("created_at")
  updatedAt   BigInt  @map("updated_at")
  @@index([workspaceId], map: "idx_vp_workspace")
  @@index([isPublic], map: "idx_vp_public")
  @@map("view_preset")
}
```

## 2.3 Provider knowledge graph (L1) — what surfaces are built for

```prisma
model ProviderDefinition {
  id               String  @id
  slug             String  @unique
  displayName      String  @map("display_name")
  description      String?
  category         String  @default("ai")
  providerType     String  @default("llm") @map("provider_type")
  // ... (capabilitiesJson/modelsJson DEPRECATED — use rows)
  providerTypeId   String? @map("provider_type_id")   // FK → ProviderType (family link)
  providerTypeRef  ProviderType? @relation("ProviderTypeToDefinition", fields: [providerTypeId], references: [id], onDelete: SetNull)
  endpoints        ProviderEndpoint[]
  capabilities     ProviderCapability[]
  models           ProviderModel[]
  accounts         ProviderAccount[]
  providerSessions ProviderSession[]
  conversations    Conversation[]
  @@map("provider_definition")
}

model ProviderEndpoint {
  id            String @id
  providerId    String @map("provider_id")
  url           String
  label         String
  endpointType  String @default("landing") @map("endpoint_type")
  selectorsJson String @default("{}") @map("selectors_json")
  composerType    String @default("textarea") @map("composer_type")  // 'textarea'|'contenteditable'|'prosemirror'|'quill'
  sendMethod      String @default("both") @map("send_method")        // 'enter_key'|'button_click'|'both'
  contentEditable Int    @default(0) @map("content_editable")
  provider ProviderDefinition @relation(fields: [providerId], references: [id], onDelete: Cascade)
  @@map("provider_endpoint")
}

model ProviderCapability {
  id                  String @id
  providerId          String @map("provider_id")
  globalCapabilityId  String @map("global_capability_id")
  uiComponentOverride String? @map("ui_component_override")   // JSON map → uiSlots
  // ... many ui*Override columns for data-driven UI
  confidence  Float @default(1.0)
  // @@unique([providerId, globalCapabilityId])
  @@map("provider_capability")
}
```

## 2.4 Conversations + streaming (L4)

```prisma
model Conversation {
  id String @id
  userId String; providerSessionId String; providerId String
  title String?; state String @default("active")
  messageCount Int @default(0)
  contextJson String @default("{}")
  // ... projectId, topicId, source, externalId, providerConversationUrl, importJobId
  messages    ConversationMessage[]
  streamBlocks StreamBlock[]
  @@map("conversation")
}

model ConversationMessage {
  id String @id
  conversationId String
  role String   // 'user' | 'assistant' | 'system'
  content String?
  blocksJson String @default("[]") @map("blocks_json")  // DEPRECATED — source of truth is StreamBlock
  blockCount Int @default(0)
  // ... parentMessageId, sequenceIndex, model, metadataJson
  streamBlocks StreamBlock[]
  @@map("conversation_message")
}

model StreamBlock {
  id String @id
  conversationId String
  messageId String
  blockIndex Int @map("block_index")
  blockKind String @map("block_kind")   // text|thinking|code|artifact|image|citation|tool_use|error|meta
  blockData String @map("block_data")
  blockMeta String @default("{}") @map("block_meta")
  @@unique([conversationId, messageId, blockIndex])
  @@map("stream_block")
}
```

## 2.5 Key point for the agent

- The **canvas model tables already exist** (no new migrations needed — PRD risk note: "No new migrations"). You ADD rows (UiComponent seeds) and routes/engines, not tables.
- 4 families seeded: `ai-chat`, `email`, `messenger`, `social`.
- 53 `primitive` rows, 22 `ui_component` rows, 63 `provider_definition` rows, 4 `provider_type` rows, 48 `conversation` rows currently in DB.
- Most `provider_capability`/`capability_taxonomy` tables are EMPTY (capability system is partially seeded). Conversations ARE populated (48 rows, 16 stream_blocks) — good test data.



# ═══════════════════════════════════════════════════════════════
# PART FILE: 03-shared-types.md
# ═══════════════════════════════════════════════════════════════

# DOC 3 — SHARED TYPES (the contract bridge between backend & frontend)

> These files in `shared/` are imported by BOTH Bun backend and Vite frontend. They are the exact shapes your components and engines must speak. Keep them in sync.

## 3.1 `shared/canvas-types.ts` — CanvasDefinition / LayerHost / SandboxPolicy

```ts
export type PrimitiveKind = 'workspace'|'projects'|'knowledge'|'agents'|'providers'|'conversations'
export type LayerCategory = 'system'|'chat'|'automation'|'agents'|'projects'|'knowledge'|'designer'|'plugin'
export type LayerAuthor = 'system'|'user'|'agent'
export type LayerStatus = 'draft'|'published'|'deprecated'
export type InstanceStatus = 'mounting'|'live'|'dismissed'|'error'

export interface SandboxPolicy {
  csp: string
  allowNetwork: boolean
  allowCapabilities: string[]   // which cap: slugs this sandboxed component may call
  budgetMs: number
  allowInlineScript: false       // ALWAYS false (P8)
}

export interface CanvasLayout { x:number; y:number; z:number; w:number; h:number; minimized?:boolean; detailZoom?:number }

export interface LayerBinding {
  regionId: string; role: string; selector: string
  primitive?: PrimitiveKind; capabilitySlug?: string
  direction: 'read'|'write'|'bidirectional'
}

export interface CanvasDefinition {
  id:string; slug:string; name:string; description:string
  category: LayerCategory; version:number
  html:string; css:string; scriptUrl?:string
  bindings: LayerBinding[]
  layout: CanvasLayout
  author: LayerAuthor
  sandbox: SandboxPolicy
  status: LayerStatus
  tags: string[]
  createdAt:number; updatedAt:number
}

export interface LayerHost {
  mount(instanceId:string, def:CanvasDefinition): Promise<{ hostNodeId:string }>
  unmount(instanceId:string): Promise<void>
  isMounted(instanceId:string): boolean
}
```

## 3.2 `shared/stream-blocks.ts` — progressive result blocks

```ts
export type ContentBlock =
  | { kind:'text';      content:string; index:number }
  | { kind:'thinking';  content:string; index:number }
  | { kind:'code';      content:string; language?:string; index:number }
  | { kind:'artifact';  content:string; artifactType?:string; index:number }
  | { kind:'image';     url:string; alt?:string; index:number }
  | { kind:'citation';  content:string; source?:string; index:number }
  | { kind:'tool_use';  toolName:string; input:Record<string,unknown>; index:number }
  | { kind:'error';     message:string; code?:string; index:number }
  | { kind:'meta';      key:string; value:unknown; index:number }
```

## 3.3 `shared/conceptual-model.ts` — ProviderType / Primitive / RegionRect

```ts
export type ProviderTypeSlug = 'ai-chat'|'email'|'messenger'|'social'|'custom'
export type PrimitiveScope = 'cross-type'|'family'|'provider'

export interface RegionRect { x:number; y:number; z:number; w:number; h:number }

export interface ComponentContract {
  inputs: Record<string, { type:'string'|'number'|'boolean'|'object'|'array'; required:boolean; description?:string; default?:unknown }>
  outputs: Array<{ event:string; payload?:Record<string,string>; description?:string }>
  subscriptions: string[]
}

export interface SlotCatalogEntry { primitiveId:string; required:boolean; minInstances:number; maxInstances:number; accepts:string[]; contract?:ComponentContract }
export interface GestureCatalog { send?:'click'|'enter'|'both'; navigate?:'click'|'tap'; contextMenu?:'right-click'|'long-press'; drag?:string[] }
export interface LayoutRule { affinity?:'top'|'bottom'|'left'|'right'|'overlay'; anchorTo?:string }
export interface InteractionGrammar { basePrimitive?:string; gesture?:GestureCatalog; layoutRules?:Record<string,LayoutRule>; scrollModel:'infinite'|'paginated'|'fixed' }

export interface ProviderType {
  id:string; slug:ProviderTypeSlug; displayName:string; description:string
  slotCatalog: SlotCatalogEntry[]               // ordered vocabulary for this family
  regionLayout: Record<string, RegionRect>      // canonical canvas placement
  interactionGrammar: InteractionGrammar
  basePrimitive: string; version:number
}

export interface Primitive {
  id:string; scope:PrimitiveScope; familyId:string|null; providerId:string|null
  label:string; description:string|null; defaultRegion:RegionRect; version:number
}
// + rowToProviderType / providerTypeToRow / rowToPrimitive / primitiveToRow helpers
```

## 3.4 `shared/ui-component.ts` — UiComponent (DB code node shape)

```ts
export type UiComponentStatus = 'draft'|'published'|'deprecated'
export type UiComponentAuthor = 'system'|'user'|'agent'
export type { PrimitiveScope as UiComponentScope }
export type ComponentArchetype = 'list'|'form'|'display'|'overlay'|'card'|'grid'

export interface ComponentConstraints { minWidth?:number; minHeight?:number; maxWidth?:number; maxHeight?:number; aspectRatio?:number; resizable:boolean; resizeAxes:'both'|'x'|'y'|'none' }
export interface ComponentContractInput { type:'string'|'number'|'boolean'|'object'|'array'; required:boolean; description?:string; default?:unknown }
export interface ComponentContractOutput { event:string; payload?:Record<string,string>; description?:string }
export interface ComponentContract { inputs:Record<string,ComponentContractInput>; outputs:ComponentContractOutput[]; subscriptions:string[] }

export interface UiComponent {
  id:string; primitiveId:string; scope:PrimitiveScope; ownerId:string; variant:string|null
  componentKey:string; displayName:string
  html:string; css:string; scriptUrl:string|null
  sandboxJson:string; constraintsJson:string; contractJson:string
  archetype: ComponentArchetype|null
  version:number; status:UiComponentStatus; author:UiComponentAuthor
  defaultRegion: RegionRect|null; tags:string[]; createdAt:number; updatedAt:number
}
// + rowToUiComponent / uiComponentToRow
```

## 3.5 THE 4-TIER RESOLUTION PRECEDENCE (encode this EXACTLY)

```
provider + variant  (scope='provider',   ownerId=providerId, variant)
provider canonical  (scope='provider',   ownerId=providerId, variant=null)
family  + variant  (scope='family',      ownerId=familyId,   variant)
family  canonical  (scope='family',      ownerId=familyId,   variant=null)
cross-type          (scope='cross-type', ownerId='global')
→ system built-in default
```

The resolver is `UiComponentStore.resolve(ctx)` and `ConceptualModelService.resolveSurface(providerId, familyId)` (see DOC 4). A resolved slot returns `{ primitive, component, tier, fromSystemDefault }`.



# ═══════════════════════════════════════════════════════════════
# PART FILE: 04-backend-engines.md
# ═══════════════════════════════════════════════════════════════

# DOC 4 — BACKEND ENGINES & ROUTERS (what exists, what to wire)

> Backend = Bun + Prisma. Engines live in `src/engines/`. Routers in `src/server/`. Do NOT import CDP. Do NOT import `src/storage/impl/*` from engines — use contracts.

## 4.1 `src/engines/conceptual-model-service.ts` (RESOLUTION BRAIN)

```ts
// Resolves which family a provider belongs to, the primitive (slot) catalog for
// that family, and the winning UiComponent per slot via 4-tier precedence.
export class ConceptualModelService {
  constructor(providerTypes, primitives, components, providers?)
  async resolveFamilyForProvider(providerId:string): Promise<ProviderType|null>
  async resolveSurface(providerId:string, familyId:string): Promise<ResolvedSlot[]>
  async resolveSlot(providerId, familyId, primitiveId): Promise<ResolvedSlot|null>
  async listFamilies(): Promise<ProviderType[]>
  async getFamilyBySlug(slug:string): Promise<ProviderType|null>
  async resolveComponent(ctx:ResolveContext): Promise<UiComponent|null>
}
export interface ResolvedSlot { primitive:Primitive; component:UiComponent|null; tier:'provider'|'family'|'cross-type'|'system'; fromSystemDefault:boolean }
```

**Usage:** `resolveSurface` returns `ResolvedSlot[]`. Each `component` (when present) carries `html`/`css`/`sandboxJson` to render. The frontend hydrates nodes from this.

## 4.2 `src/engines/canvas-layer-mounter.ts` (LIFECYCLE EMITTER)

```ts
// THIN emitter. No DOM, no CDP. Emits canvas:layer:spawned / canvas:layer:dismissed
// on the CapabilityEventBus so the frontend useCanvasEvents can react live.
export interface LayerDefinition { id:string; slug:string; category:string; layout:{x,y,z,w,h}; sandbox?:{allowCapabilities:string[]} }
export interface MountedLayer { instanceId:string; definitionId:string; slug:string }
export class CanvasLayerMounter {
  constructor(private eventBus: CapabilityEventBus)
  async spawn(def: LayerDefinition): Promise<MountedLayer>   // emits canvas:layer:spawned
  async dismiss(instanceId:string): Promise<boolean>          // emits canvas:layer:dismissed
  listMounted(): MountedLayer[]
}
```

**KEY:** This is the bridge to the POC. The POC's CanvasEngine renders freeform draw nodes; vivim's `CanvasLayerMounter` spawns *conceptual* nodes. You may REPLACE the POC's internal Scene/Node model with a React-Flow node (CanvasDefinition) whose `html`/`css` come from a resolved `UiComponent`. The mounter's `spawn()` is what triggers the frontend node to appear over `WS /ws/canvas`.

## 4.3 `src/server/conceptual-router.ts` — conceptual surface endpoints (BUILT)

Endpoints already exist (PRD §7):
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/conceptual/families` | GET | All families |
| `/api/conceptual/surface?providerId=` | GET | 4-tier resolved slots for a provider |
| `/api/conceptual/provider-types/:slug` | GET | Family spec + UiComponents |
| `/api/conceptual/resolve` | GET | Resolve single primitive |

Response shape (`/api/conceptual/surface`):
```json
{ "ok":true, "providerId":"chatgpt", "family":"ai-chat",
  "slots":[ { "primitive":{...}, "component":{ "id":"uc:...", "componentKey":"...", "html":"...", "css":"...", "scriptUrl":null }, "tier":"cross-type", "fromSystemDefault":false } ] }
```

## 4.4 `src/server/canvas-router.ts` — layer CRUD (BUILT, capability-backed)

Every route = `registry.execute('cap:canvas:*', input)`. Routes:
- `POST /api/canvas/layers` → `cap:canvas:add_layer`
- `GET  /api/canvas/layers` → `cap:canvas:layer_list`
- `PATCH /api/canvas/layers/:id` → `cap:canvas:set_layout` (validates `LayoutUpdateSchema` via Zod)
- `DELETE /api/canvas/layers/:id` → `cap:canvas:remove_layer`
- `GET /api/canvas/definitions` → `cap:canvas:list`
- `POST /api/canvas/definitions` → `cap:canvas:define`
- `POST /api/canvas/spawn` → `cap:canvas:spawn`
- `GET /api/canvas/manifest` → `cap:canvas:observe {op:'manifest'}`
- `POST .../import|export` → `cap:canvas:import|export`
- `GET /api/canvas/observe?op=oracle|manifest` → `cap:canvas:observe`
- `DELETE /api/canvas/instance/:id` → `cap:canvas:dismiss`
- `POST /api/canvas/instance/:id/mutate` → `cap:canvas:mutate`

**Wireability note:** The canvas tab already calls `GET/POST/PATCH /api/canvas/layers` and `/api/canvas/definitions`. Your engine work should extend these capabilities, not bypass them.

## 4.5 `src/server/conversation-router.ts` — PENDING stream-blocks endpoint

`GET /api/conversations/:id/stream-blocks` → `{ ok, conversationId, blocks: ContentBlock[], streaming: boolean }` is **NOT YET IMPLEMENTED** (PRD C6 pending). This is a build target. Blocks come from `StreamBlock` rows (keyed by `blockIndex`, `blockKind`). Wrap legacy `ConversationMessage.content` as one `text` block when no blocks exist.

## 4.6 `src/server/websocket.ts` — PENDING `/ws/canvas` forwarder

`registerCanvasLayerForwarder(eventBus)` must forward `canvas:layer:spawned` / `canvas:layer:dismissed` to subscribed browsers (mirror `registerCanvasMutationForwarder`). `useCanvasEvents` subscribes with `{ entityType:'canvas' }` on WS open. **PENDING (PRD C7).**

## 4.7 Store Contracts you depend on (do NOT import impl)

- `src/storage/contracts/primitive-store.ts` → `PrimitiveStore`
- `src/storage/contracts/provider-type-store.ts` → `ProviderTypeStore`
- `src/storage/contracts/ui-component-store.ts` → `UiComponentStore` (`resolve`, `resolveDomain`, `resolveContext`)
- `src/storage/contracts/provider-store.ts` → `ProviderStore` (`getDefinition`)

When you add canvas engine features, define the Store Contract FIRST, then implement in `src/storage/impl/`, then consume via contract in the engine.



# ═══════════════════════════════════════════════════════════════
# PART FILE: 05-frontend-canvas.md
# ═══════════════════════════════════════════════════════════════

# DOC 5 — FRONTEND CANVAS (web/ui/src/features/canvas)

> The frontend is a Vite + React + **@xyflow/react (React Flow)** app. The canvas folder is the primary surface. Read this to know exactly what hooks/components exist and where to inject the POC's rendering power.

## 5.1 `CanvasSurface.tsx` (the shell)

- A single `ReactFlow` instance renders every UI region as a `CanvasNode`.
- `nodeTypes = useNodeTypes()` — the registry IS the nodeTypes map.
- `useConceptualModel(providerId)` fetches the resolved surface and builds nodes via `toNodes()`.
- `useUiSlots()` applies backend `uiSlots` claims.
- `useCanvasEvents(setNodes)` subscribes to live WS spawn/dismiss.
- On mount, fetches `GET /api/canvas/layers` to restore persisted layout (drag/resize persisted via `PATCH /api/canvas/layers/:id`).
- Depth-sorting by `data.z`; minimap (`MinimapNode`); undo/redo (`useCanvasHistory`); keyboard shortcuts; error boundary; loading/empty/welcome/first-run states; `CanvasDesigner` for authoring.
- `SEED_NODES` (fallback when backend down): `chat.header/sidebar/entry/thread/composer/actionBar` with fixed positions.

`CanvasNode.data` carries: `overrideSlug, providerSlug, sandbox[], definitionId, primitiveId, slotId, componentKey, fromSystemDefault, tier, z, layerId`.

## 5.2 Hooks (what each does)

| File | Role |
|---|---|
| `useConceptualModel.ts` | `GET /api/conceptual/surface?providerId=` → `{ family, slots }`. For each resolved `component`, calls `registerUiComponent(slotId, family, {componentKey, html, css, script:null})`. Exposes `toNodes()` → `CanvasNode[]`. `primitiveToSlotId()` maps `ai-chat.entry` → `chat.entry` (flat slot catalog). |
| `useCanvasEvents.ts` | WS `/ws/canvas` subscribe → spawn/dismiss nodes live. |
| `useUiSlots.ts` | Apply backend `uiSlots` claims to `UIComponentRegistry`. |
| `useStreamBlocks.ts` | `GET /api/conversations/:id/stream-blocks` → `ContentBlock[]` (pending backend; hook exists). |
| `useNodeTypes.tsx` | Builds `nodeTypes` registry (SLOT_IDS + `conceptual` type). |
| `useManifest.ts` | Living manifest of mounted layers. |
| `useZoomLevel.ts` | Contextual zoom (dot/card/full). |
| `useCanvasHistory.ts` | Undo/redo command stack. |
| `useKeyboardShortcuts.tsx` | Shortcut map. |
| `useFirstRun.ts` | Onboarding state. |

Components: `BrowserLayerHost.tsx`, `SandboxedLayer.tsx` (iframe + MessageChannel CSP bridge, P8), `ResultSlot.tsx`, `StreamingSlot.tsx`, `ZoomNode.tsx`, `CanvasDesigner.tsx`, `ThemeProvider.tsx`, `WelcomeOverlay.tsx`, `FirstRunWizard.tsx`, `FeatureTour.tsx`, `ErrorBoundary.tsx`, `LoadingSkeleton.tsx`, `MinimapNode.tsx`, `index.ts`.

## 5.3 `web/ui/src/ui/` — the registry (slots are globals)

- `registry.ts` — `UIComponentRegistry`: `register(slot, slug, component, {sandbox})`, `resolve(slot, {providerSlug, capabilitySlug})`, `listOverrides()`, `applyClaim(slot, slug, claim)`, `hotSwap()`. External store consumed by `useSlot` via `useSyncExternalStore`.
- `slots.ts` — `SLOT_IDS` / `SlotMeta`. ALL namespaced `chat.*` (e.g. `chat.actionBar` NOT `actionBar`). The taxonomy pipeline's `CATEGORY_POSITIONS` MUST emit these exact values or `auto-populate` silently fails.
- `defaults/` — one generic component per slot.
- `defaults/index.tsx` — `registerDefaults()` (idempotent, called at boot).
- `actions/registry.ts` — `ActionRegistry` / `ActionSpec`. Every interactive slot dispatches through it (Zod-validated params). **B8 invariant.**
- `ui-component-renderer.ts` — `UiComponentPayload` type (`{ componentKey, html, css, script }`).
- `registry/index.ts` — `CapabilityRegistry` ledger: `slug → bespoke capability renderer`.

## 5.4 Slot catalog (capability globals) — current set

`chat.entry` (host), `chat.sidebar`, `chat.thread`, `chat.bubble`, `chat.composer`, `chat.send`, `chat.attach`, `chat.streaming`, `chat.result`, `chat.confirm`, `chat.error`, `chat.header`, `chat.actionBar`.

To add a new slot: add id to `SLOT_IDS` in `slots.ts`, give a generic default in `defaults/`, register in `registerDefaults()`. NEVER import a component directly into a surface — resolve through the registry.

## 5.5 How `useConceptualModel` maps primitives → slots (CRITICAL for POC integration)

`primitiveToSlotId('ai-chat.entry')` → splits on `.` → `chat.entry` → if `isSlotId`, returns it. So a `UiComponent` whose `primitiveId` is `prim:ai-chat:prompt-box` with `componentKey: 'prompt-box.ai-chat'` becomes the `chat.entry` node's rendered content. **This is how your POC-rendered component must plug in: as a `UiComponent` row whose resolved html/css renders inside the sandboxed node.**

## 5.6 Frontend build/verify commands

- `cd web/ui && bun run typecheck` (0 errors)
- `cd web/ui && bun run build` (vite build, 0 errors)
- `bun test tests/unit/ui/`
- `bun run devops verify-cross-surface` (capability resolution across surfaces)



# ═══════════════════════════════════════════════════════════════
# PART FILE: 06-project-skeleton.md
# ═══════════════════════════════════════════════════════════════

# DOC 6 — PROJECT SKELETON & SCAFFOLD (what's where)

> Directory map so the super-agent knows exactly where to write code. Relative to repo root `C:\0-BlackBoxProject-0\vivim-final`.

## 6.1 Backend source (`src/`)
```
src/
  cli/                  # CLI entry points (thin NL shells → POST /api/interpret)
  config.ts             # Configuration
  engines/
    conceptual-model-service.ts   # ★ resolution brain
    canvas-layer-mounter.ts       # ★ emits canvas:layer:spawned/dismissed
    capability-engine.ts          # UnifiedCapability registry
    conversation-manager.ts       # L4 session/state
    stream-block-store.ts         # L4 progressive results
    # ... 13 engines total (see AGENTS.md)
  errors.ts             # custom error classes
  ids.ts                # ULID
  index.ts              # public barrel
  schema/               # Zod schemas (boundary validation)
  server/
    canvas-router.ts        # ★ layer CRUD (cap:canvas:*)
    conceptual-router.ts    # ★ surface/family/resolve endpoints
    conversation-router.ts  # ★ PENDING stream-blocks endpoint
    websocket.ts            # ★ PENDING /ws/canvas forwarder
    index.ts                # router mount
  storage/
    contracts/   # ★ interfaces engines depend on (ProviderTypeStore, PrimitiveStore, UiComponentStore, ProviderStore)
    impl/        # Prisma-backed implementations
```

## 6.2 Shared types (`shared/`) — imported by BOTH sides
```
shared/
  canvas-types.ts       # CanvasDefinition, LayerHost, SandboxPolicy
  conceptual-model.ts    # ProviderType, Primitive, RegionRect
  ui-component.ts        # UiComponent (DB node)
  stream-blocks.ts       # ContentBlock[]
```

## 6.3 Frontend (`web/ui/`)
```
web/ui/src/
  features/canvas/      # ★ unified canvas surface
    CanvasSurface.tsx   # the shell (React Flow)
    components/         # BrowserLayerHost, SandboxedLayer, ResultSlot, StreamingSlot, CanvasDesigner, ZoomNode, ErrorBoundary, ...
    hooks/              # useConceptualModel, useCanvasEvents, useStreamBlocks, useNodeTypes, useCanvasHistory, ...
  ui/                   # capability globals (slots)
    slots.ts            # SLOT_IDS (namespaced chat.*)
    registry.ts         # UIComponentRegistry (the nodeTypes source)
    defaults/           # generic component per slot
    actions/registry.ts # ActionRegistry (B8)
  index.ts
```

## 6.4 Database & seeds
```
prisma/schema.prisma    # 54 tables; canvas model in L1b
seeds/
  providers/*.json     # provider endpoints (selectors, send method, URL)
  conceptual-model/seed.ts  # ★ idempotent family/primitive/component seeder (FAMILIES + CROSS_TYPE)
```

## 6.5 Devops scripts & docs
```
scripts/start-bg.ps1    # NON-BLOCKING stack launch (pwsh, never inline)
scripts/start-all.ps1   # BLOCKING
scripts/stop-all.ps1
devops/                 # speckit-bridge, unified-gate, speckit-*
docs/merged-design-v2/  # 00-08 engines/lifecycles, SOTA-00..09
docs/roadmap/prds/PRD-VIVIM-CANVAS-UNIFIED-SURFACE.md  # ★ canvas PRD
```

## 6.6 POC reference (DO NOT wire as-is — violates invariants)
```
dev-poc/canvas/html-shell-sdk-1/   # Next.js 15 + React 19 standalone drawing SDK
  src/lib/canvas-sdk/
    index.ts        # CanvasEngine bootstrap
    types.ts        # Node/Connection/ZLayer/ThemeTokens (world-space coords)
    core/           # EventBus, CommandStack (undo/redo), QuadTree (hit-test), CanvasEngine
    tools/          # 8 tools (select/move/resize/draw/erase/pan/zoom/comment)
    renderers/      # 5 (canvas2d/webgl/svg/dom/wasm-canvas)
```

## 6.7 Scaffold recipes for new work

**Add a UiComponent (the main way to add UI):**
1. Add a row to `seeds/conceptual-model/seed.ts` (or DB-seed it via API).
2. Run `bun run db:seed` (or insert into `ui_component` table).
3. Frontend resolves it automatically via 4-tier precedence.

**Add a canvas capability:**
1. `src/engines/*caps.ts` → `makeCapability({ id:'cap:canvas:xxx', surfaces:['cli','ui','api'], ... })`.
2. Bind NL pattern in `src/engines/nlcl/catalog.ts`.
3. Register handler in `canvas-router.ts` that calls `registry.execute('cap:canvas:xxx', input)`.

**Add a provider family UI:**
1. Add `ProviderType` + `Primitive` rows (seed.ts).
2. Add `UiComponent` rows for that family's slots.
3. `useConceptualModel.primitiveToSlotId` maps primitive → `chat.*` slot.

**NO new Prisma migrations** for canvas work (per PRD risk note). Add rows + routes/engines only.



# ═══════════════════════════════════════════════════════════════
# PART FILE: 07-poc-reference.md
# ═══════════════════════════════════════════════════════════════

# DOC 7 — POC REFERENCE: html-shell-sdk-1 (mechanics to harvest, gaps to close)

> The POC (`dev-poc/canvas/html-shell-sdk-1`) is a standalone Next.js 15 + React 19 + Tailwind/shadcn drawing SDK. It proves generic canvas rendering mechanics. It VIOLATES vivim invariants (hardcodes tools/themes, no React Flow, no DB). Use it as a SOTA *rendering-engine* reference, then re-express the good parts inside vivim's node model.

## 7.1 What the POC gives you (HARVEST these mechanics)

- **EventBus** (`src/lib/canvas-sdk/core/event-bus.ts`) — pub/sub for canvas events. Map → vivim `CapabilityEventBus` + WS forwarder.
- **CommandStack** (`core/command-stack.ts`) — undo/redo command pattern. Map → frontend `useCanvasHistory.ts` (already exists, may strengthen).
- **QuadTree** (`core/quad-tree.ts`) — spatial index for hit-testing/frustum culling at 10k+ nodes. Harvest the algorithm for `CanvasSurface` virtualized rendering.
- **CanvasEngine** (`core/canvas-engine.ts`) — single render orchestrator, world-space → screen-space transform, transform stack (pan/zoom/world-to-screen). This is the math you want behind `CanvasDefinition.layout` (x/y/z/w/h in world space).
- **8 Tools** (cursor/select, move/translate, resize, draw, erase, pan, zoom, comment) — generic interaction set. Map select/move/resize → React Flow node drag/resize; draw/erase/comment → future annotation layer (wishlist item).
- **5 Renderers** (canvas2d, webgl, svg, dom, wasm-canvas) — DOM renderer is the one compatible with vivim's sandboxed `UiComponent` (html/css). webgl/canvas2d render to `<canvas>` (use for the infinite-canvas background grid / minimap, not for UI nodes).
- **Theme system** (`core/theme.ts`, `ThemeTokens`) — token-driven theming. Map → vivim `ThemeProvider.tsx`; themes MUST come from DB (`UiComponent.css`) not hardcoded (POC gap: themes hardcoded).
- **Zip export/import** (`export/zip.ts`) — serialize scene → zip. Map → `cap:canvas:export/import` (canvas-router already has routes).

## 7.2 POC → vivim gap map

| POC does | vivim needs | Action |
|---|---|---|
| Hardcodes 8 tools, 5 renderers, themes | Tools/renderers/themes are DATA (UiComponent) | Move tool configs into `ui_component`/`provider_type` rows; renderer chosen by archetype |
| Freeform Node/Connection graph (drawing) | Conceptual, family-driven node graph | Replace POC `Scene`/`Node` with `CanvasDefinition` from resolved `UiComponent` |
| Next.js 15 standalone | Vite + React + @xyflow/react in `web/ui` | Do NOT import POC; reimplement engine math in `CanvasSurface` |
| No persistence | `user_component_layout` / `view_preset` tables | Use existing tables for node positions; POC zip → cap export |
| No CDP/provider link | Slug is the link (frontend=backend) | POC cannot drive providers; vivim canvas nodes carry `providerSlug` |
| inline script in sandboxed nodes | NEVER inline (P8 CSP) | POC's script injection model is unsafe; use `scriptUrl` + MessageChannel |

## 7.3 Decision: REPLACE, not import

The POC's internal `Scene`/`Node`/`Renderer` classes are incompatible with React Flow's node model and the DB-driven `UiComponent` contract. **Do not** `import` POC code into `web/ui`. Instead:
1. Harvest the **math** (world→screen transform, QuadTree culling) into `CanvasSurface` helpers.
2. Harvest the **CommandStack** pattern to strengthen `useCanvasHistory`.
3. Harvest the **tool vocabulary** (select/move/resize/draw/erase/comment) as an interaction *catalog* stored in `provider_type.interaction_grammar_json` (data-driven, per family).
4. Harvest **zip export** logic for `cap:canvas:export`.
5. Discard POC's hardcoded theme/renderer registries — those belong in the DB.

## 7.4 Mechanics snippet (POC coordinate model to mirror)

```ts
// POC CanvasEngine world→screen (mirror in CanvasSurface transform helpers)
interface Transform { panX:number; panY:number; zoom:number }
function worldToScreen(wx:number, wy:number, t:Transform) {
  return { x:(wx - t.panX) * t.zoom, y:(wy - t.panY) * t.zoom }
}
// vivim CanvasDefinition.layout is world-space {x,y,z,w,h}; z = depth (not zoom)
// use React Flow's own transform; only borrow QuadTree for culling offscreen nodes
```



# ═══════════════════════════════════════════════════════════════
# PART FILE: 08-wishlist.md
# ═══════════════════════════════════════════════════════════════

# DOC 8 — TOP-5 CANVAS WISHLIST (dev-poc vs vivim gap → build targets)

> Derived from comparing `html-shell-sdk-1` (rendering SOTA, zero vivim-compliance) against the vivim canvas PRD + 13-engine invariants. Each item is a concrete, wireable build target.

## W1 — Data-driven tool & interaction catalog (close POC's hardest gap)
**Gap:** POC hardcodes 8 tools + 5 renderers + themes. vivim must drive ALL interaction from `provider_type.interaction_grammar_json` + `ui_component`.
**Build:** Extend `InteractionGrammar` (DOC 3.3) with `tools: string[]` (select/move/resize/draw/erase/comment) and `renderer: 'dom'|'canvas2d'|'webgl'`. `ConceptualModelService` exposes per-family tool/renderer set. `CanvasSurface` reads it to enable only the family-allowed tools. `useCanvasHistory` adopts POC's `CommandStack` for undo/redo of tool ops.
**Wireable:** rows in `provider_type`, no migration; frontend reads `resolveFamilyForProvider`.

## W2 — Infinite canvas virtualization with QuadTree culling (borrow POC math)
**Gap:** POC's `QuadTree` handles 10k+ nodes; vivim `CanvasSurface` re-renders all nodes (will choke on large layouts).
**Build:** Port `QuadTree` (DOC 7.1) into `web/ui/src/features/canvas/lib/quad-tree.ts`. `CanvasSurface` computes viewport bounds → queries QuadTree → mounts only visible `CanvasNode`s (keep DOM node count bounded). Off-screen nodes stay as data.
**Wireable:** pure frontend lib; no backend change; respects existing `CanvasDefinition.layout`.

## W3 — Sandboxed drawing/annotation layer (POC's draw/erase/comment tools, vivim-safe)
**Gap:** POC has draw/erase/comment but as unsafe inline-script nodes. vivim has NO annotation surface.
**Build:** A new `UiComponent` archetype `'overlay'` (or `prim:cross-type:annotation`) rendering a `<canvas>` (DOM renderer) inside `SandboxedLayer` (POC-safe: `scriptUrl` + MessageChannel, `allowInlineScript:false`). Strokes stored as `StreamBlock` (kind `'artifact'`) or `view_preset.layout_json`. Draw/erase/comment tools enabled per W1 catalog.
**Wireable:** new `ui_component` row + `cap:canvas:mutate` payload for strokes.

## W4 — Live layer streaming over `/ws/canvas` (finish PRD C7)
**Gap:** `CanvasLayerMounter.spawn()` emits `canvas:layer:spawned` on the event bus, but `registerCanvasLayerForwarder` + `useCanvasEvents` WS path is PENDING. POC has a working EventBus but no cross-tab sync.
**Build:** Implement `registerCanvasLayerForwarder(eventBus)` in `websocket.ts` (mirror `registerCanvasMutationForwarder`). `useCanvasEvents` already subscribes — verify it mounts/dismisses nodes on WS message. This makes spawned layers appear in all open browsers instantly.
**Wireable:** backend WS forwarder + existing frontend hook; no schema change.

## W5 — Progressive result rendering from StreamBlock (finish PRD C6)
**Gap:** `GET /api/conversations/:id/stream-blocks` is NOT implemented; `useStreamBlocks` hook has no backend. POC has no streaming at all.
**Build:** `conversation-router.ts` → `cap:conversation:stream_blocks` returning `ContentBlock[]` from `StreamBlock` rows (keyed by `blockIndex`/`blockKind`), falling back to wrapping `ConversationMessage.content` as one `text` block. `useStreamBlocks` consumes it; `StreamingSlot`/`ResultSlot` render progressively (text/thinking/code/artifact/image/citation/tool_use).
**Wireable:** new router route + capability + existing frontend hook/components.

## Wishlist summary (priority order)
1. W4 — WS live layers (highest value, finishes a PENDING PRD item, pure integration)
2. W5 — Stream-blocks endpoint (finishes PENDING PRD C6, unblocks progressive UI)
3. W2 — QuadTree virtualization (scalability, pure frontend)
4. W1 — Data-driven tool catalog (closes POC's core gap, family-driven)
5. W3 — Sandboxed annotation layer (new surface, uses W1+W2)



# ═══════════════════════════════════════════════════════════════
# PART FILE: 09-devops-boot.md
# ═══════════════════════════════════════════════════════════════

# DOC 9 — DEVOPS, BOOT, LAUNCH & VERIFY (operational playbook)

> PowerShell-compatible commands ONLY. The default shell is PowerShell 7+. Never inline-pipe PS1 scripts (`$PSScriptRoot` collapses). Use `pwsh scripts/<name>.ps1` from repo root.

## 9.1 One-time install
```powershell
Set-Location "C:\0-BlackBoxProject-0\vivim-final"
bun run db:setup        # migrate + seed (first time only)
```

## 9.2 Launch the stack (non-blocking recommended)
```powershell
pwsh scripts/start-bg.ps1     # backend + frontend, returns immediately; poll health after
# OR blocking:
pwsh scripts/start-all.ps1
# Stop everything (infallible):
pwsh scripts/stop-all.ps1
# Continuous health monitor:
pwsh scripts/health-check.ps1
```

## 9.3 Backend-only / frontend-only
```powershell
pwsh scripts/start-backend.ps1
pwsh scripts/start-frontend.ps1
```

## 9.4 Backend (engines) boot — NOT a seeder
`bun run serve` starts engines only. Seeding/seed is `bun run db:setup` / `bun run db:seed` / `bun run db:migrate`. **Never** re-seed at boot (invariant).

## 9.5 Verify after canvas changes
```powershell
bun run typecheck                                  # backend TS (0 errors)
bun run lint                                       # Biome
bun test tests/unit/engines/conceptual-model-service  # resolution engine
bun test tests/unit/ui/                            # frontend canvas hooks
cd web/ui && bun run typecheck && bun run build    # frontend (0 errors)
bun run devops verify-cross-surface                # capability resolves CLI/API/MCP/UI
```

## 9.6 DB ops (all capability-backed)
| Cmd | Purpose |
|---|---|
| `bun run db:setup` | Fresh: migrate + seed (first time only) |
| `bun run db:seed` | Re-seed providers from JSON manifests |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:reset --force` | Wipe + migrate + seed |
| `bun run db:status` | Row counts, file size, migration history |
| `bun run db:backup` | VACUUM INTO ./backups/ |
| `bun run db:check` | PRAGMA integrity_check |

## 9.7 Adding a provider (canvas surface target)
1. Edit `seeds/providers/<slug>.json` (url, selectors, send method, composer type, endpoint_type).
2. `bun run db:seed`.
3. Add `UiComponent` rows (or family override) so `resolveSurface` returns rendered slots.

## 9.8 Runtime-test loop (devops-fullstack skill)
```powershell
bun run devops runtime-test loop --max-cycles=3 --mitm
bun run devops runtime-test preflight
bun run devops runtime-test discover-backend
bun run devops runtime-test test --nl "list conversations"
```
**Agent-safety:** 15s bootstrap timeout, 5s/fetch, 2min cap.

## 9.9 INVARIANTS (must never violate — enforced by `bun run devops invariants check`)
1. **Governor Canon** — only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Store Contracts** — engines depend on `src/storage/contracts/*`, never `src/storage/impl/*`.
3. **Research-First** — no implementation without research report classification.
4. **Phase Gates** — phase N needs N-1 complete.
5. **One Entry Point** — every op is a `UnifiedCapability`; CLI/UI are thin NL shells → `POST /api/interpret` → `POST /api/capabilities/:id/execute`.
6. **Frontend=Backend** — slug is the link; NO hardcoded `if (slug==='x')` in React. Add a `UiComponent` tier instead.
7. **Sandboxed UI (P8)** — `allowInlineScript:false` always; sandbox via `scriptUrl` + MessageChannel + CSP.
8. **Action Registry (B8)** — every interactive slot dispatches through `ActionRegistry` (Zod-validated).
9. **No `any`** — use `unknown` + narrowing; `.js` import ext; ULID ids; Zod at boundaries.
10. **No new canvas migrations** — PRD risk note: add rows + routes, not tables.

## 9.10 Cross-surface verify gotchas (from AGENTS.md)
- UI slot ids MUST be namespaced `chat.actionBar` (not `actionBar`). Taxonomy `CATEGORY_POSITIONS` must use exact values.
- Capability nodes may lack `category`; derive from `slug.split('_')[0]`.
- `Bun.spawn` `exitCode` is `null` until `await proc.exited`.
- Single-segment slugs → `cap:help:help` (never `cap:undefined:help`).
- Run `bun run devops verify-cross-surface` after ANY taxonomy/conceptual-model change.



# ═══════════════════════════════════════════════════════════════
# PART FILE: 10-starter-prompt.md
# ═══════════════════════════════════════════════════════════════

# DOC 10 — SUPER-AGENT STARTER PROMPT (build anything from downloaded source, wireable into vivim)

> This is the prompt you hand to a downstream super-agent. It packages all 9 docs above as context and constrains output to be natively wireable into vivim-final. Paste after the brief files are assembled.

---

```
You are a build agent for the vivim-final project (Bun + TypeScript strict + Prisma v6.5
SQLite + Vite + React + @xyflow/react). Your job: take ANY downloaded provider/web-app
source (HTML/CSS/JS/React) and turn it into a vivim canvas UI surface — a data-driven
node on the unified infinite canvas — WITHOUT violating project invariants.

## Context you have (read in order)
1. agent-brief/canvas/01-overview-and-vision.md   — vision, invariants, POC gap, boot
2. agent-brief/canvas/02-data-model.md            — Prisma canvas tables (no new migrations)
3. agent-brief/canvas/03-shared-types.md          — shared contract types (backend↔frontend)
4. agent-brief/canvas/04-backend-engines.md       — engines + routers to wire
5. agent-brief/canvas/05-frontend-canvas.md       — hooks/components, slot registry
6. agent-brief/canvas/06-project-skeleton.md      — where to write code
7. agent-brief/canvas/07-poc-reference.md         — POC mechanics to harvest, gaps to close
8. agent-brief/canvas/08-wishlist.md              — Top-5 build targets (W1–W5)
9. agent-brief/canvas/09-devops-boot.md          — launch/verify/invariants playbook
+ db-dump.txt (full DB sample, 15 tables) for realistic row shapes.

## Hard invariants (NEVER break — `bun run devops invariants check` will fail the build)
- FRONTEND=BACKEND: the provider slug is the ONLY link. NEVER `if (slug==='x')` in React.
  Render from resolved `UiComponent` rows (4-tier precedence: provider+variant > provider >
  family+variant > family > cross-type > system). Add a UiComponent tier, not a hardcoded branch.
- UI code is DATA: store html/css/scriptUrl in `ui_component` rows. Script runs ONLY in a
  sandboxed iframe (SandboxedLayer) with `allowInlineScript:false` + CSP + MessageChannel.
- NO new Prisma migrations for canvas work — add rows + routes/engines only.
- Engines depend on `src/storage/contracts/*`, never `src/storage/impl/*`.
- No `any`; use `unknown` + narrowing; `.js` import ext; ULID ids; Zod at boundaries.
- Every operation is a UnifiedCapability. CLI/UI are thin NL shells.
- Only ChromeGovernor touches CDP. No engine imports BunCdpClient.

## How to convert downloaded source into a vivim surface
1. Identify the provider family (ai-chat/email/messenger/social/custom). If new, add a
   ProviderType + Primitive rows in seeds/conceptual-model/seed.ts and a provider_definition.
2. Decompose the downloaded UI into PRIMITIVES (slots): composer, thread, sidebar, header,
   result, actionBar, etc. Map each to a `chat.*` SLOT_ID (web/ui/src/ui/slots.ts).
3. For each slot, create a UiComponent row: html (markup) + css (scoped) + scriptUrl
   (optional, sandboxed). Set componentKey like `chat.composer`, scope/ownerId per tier.
4. If the source has drawing/canvas mechanics, harvest ONLY the math (world→screen transform,
   QuadTree culling) into web/ui/src/features/canvas/lib/ — do NOT import the POC's Node/
   Renderer classes. See DOC 7 decision: REPLACE not import.
5. Wire any interactions through ActionRegistry (B8) + a cap:canvas:* capability if new.
6. Persist node positions via PATCH /api/canvas/layers/:id (user_component_layout table).

## Output contract (must be wireable as-is)
- Code files ready to drop into the paths in DOC 6. No scaffolding scripts needed.
- Every new UI surface = seed rows (UiComponent) + (if needed) a cap:canvas:* capability +
  router handler calling registry.execute. NO React conditional branches on provider slug.
- Typecheck clean: `bun run typecheck` + `cd web/ui && bun run typecheck && bun run build`.
- Include a short verify section: which `bun test` / `bun run devops verify-cross-surface`
  commands prove it works.
- If you cannot satisfy an invariant for a requested feature, STOP and report the conflict
  rather than silently bypassing it.

## Build priority (from wishlist W1–W5, DOC 8)
1. W4 live WS layers  2. W5 stream-blocks  3. W2 QuadTree virt  4. W1 tool catalog  5. W3 annotation
Start with whichever the downloaded source best supports; extend, don't rewrite, the canvas.
```



# ═══════════════════════════════════════════════════════════════
# PART FILE: 13-gap-assessment.md
# ═══════════════════════════════════════════════════════════════


