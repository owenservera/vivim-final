# 08 — Backend Integration Contract

**Scope:** What the backend must provide for the frontend canvas to be fully
functional. The frontend is **done**; these are the backend wires still missing.

---

## 1. Summary

| # | Endpoint / Event | Method | Purpose | Consumed by | Status |
|---|------------------|--------|---------|-------------|--------|
| 1 | `/api/capabilities?surface=ui` | GET | List capabilities with `uiSlots` | `useUiSlots` (C5) | ✅ exists |
| 2 | `/api/conversations/:id/capabilities` | GET | Capabilities for a conversation | `useUiSlots` (C5) | ✅ exists |
| 3 | `/api/conversations/:id/stream-blocks` | GET | Stream blocks + streaming flag | `useStreamBlocks` (C6) | ✅ exists |
| 4 | `/ws/canvas` | WS | `canvas:layer:spawned` / `dismissed` | `useCanvasEvents` (C7) | ✅ exists |
| 5 | `canvas:layer:*` events | EventBus | Emitted by `CanvasLayerMounter` | forwarder → `/ws/canvas` | ✅ exists |
| 6 | `/api/conceptual/families` | GET | All families (ProviderType) | surface picker / oracle | ✅ exists |
| 7 | `/api/conceptual/surface?providerId=` | GET | 4-tier resolved slots for a provider | `useConceptualModel` | ✅ exists |
| 8 | `/api/conceptual/provider-types/:slug` | GET | Family spec (catalog, regions, grammar) + `UiComponent`s | `useConceptualModel` (alt) | ✅ exists |
| 9 | `/api/conceptual/resolve` | GET | Resolve a single primitive on a provider | debug / devtools | ✅ exists |

All items implemented. `CanvasSurface` is mounted as a **Canvas** tab in `App.tsx`
(alongside `ChatPage`); the conceptual endpoints, stream-blocks endpoint, WS layer
forwarder, and `CanvasLayerMounter` events are all wired.

---

## 2. Endpoint 3 — Stream blocks (C6)

**Route:** `GET /api/conversations/:id/stream-blocks`

**Query params:**
- `messageId` (optional) — filter to a single message
- `blockKind` (optional) — filter by kind (`text`, `code`, …)
- `limit`, `offset` (optional) — pagination

**Response:**
```json
{
  "blocks": [
    { "kind": "text", "content": "Hello", "index": 0 },
    { "kind": "code", "content": "print(1)", "language": "python", "index": 1 }
  ],
  "streaming": true
}
```

**Backend source:** `StreamBlockStore` (`src/engines/stream-block-store.ts`,
instantiated at boot) — queried via `ctx.db.prisma.streamBlock` for
`GET /api/conversations/:id/stream-blocks` in `src/server/conversation-router.ts`.
The blocks are the deserialized `ContentBlock[]` (blockData JSON). The `streaming`
flag is `true` when an assistant message exists with `blockCount === 0` (a turn is
in flight).

**Implementation:**
```ts
// src/server/conversation-router.ts
const blocksMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/stream-blocks$/)
if (blocksMatch && method === 'GET') {
  const conversationId = blocksMatch[1]
  const where: Record<string, unknown> = { conversationId }
  if (messageId) where.messageId = messageId
  if (blockKind) where.blockKind = blockKind
  const rows = await ctx.db.prisma.streamBlock.findMany({ where, orderBy: {...}, take, skip })
  const blocks = rows.map(r => JSON.parse(r.blockData))
  const pending = await ctx.db.prisma.conversationMessage.findFirst({
    where: { conversationId, role: 'assistant', blockCount: 0 },
  })
  return json({ ok: true, conversationId, blocks, streaming: Boolean(pending) })
}
```

---

## 3. Endpoint 4 — Canvas WebSocket (C7)

**Route:** `WS /ws/canvas`

**Messages sent to client:**
```json
{ "type": "canvas:layer:spawned", "instance": { "instanceId": "inst:foo:abc", "definitionId": "def:foo", "slug": "foo" }, "definition": { "id": "def:foo", "slug": "foo", "category": "chat", "layout": { "x": 0, "y": 0, "w": 400, "h": 300 }, "sandbox": { "allowCapabilities": ["foo.*"] } } }
```
```json
{ "type": "canvas:layer:dismissed", "instanceId": "inst:foo:abc" }
```

**Backend source:** `registerCanvasLayerForwarder(eventBus)` in
`src/server/websocket.ts` (mirrors `registerCanvasMutationForwarder`, registered at
boot in `src/server/index.ts`). Relays `canvas:layer:spawned` /
`canvas:layer:dismissed` to sessions subscribed to `topic: canvas`.

---

## 4. Event 5 — EventBus emission (C7)

`CanvasLayerMounter` (`src/engines/canvas-layer-mounter.ts`) emits events on the
`CapabilityEventBus` (added to the `CapabilityEvent` union in
`src/engines/capability-event-bus.ts`):

```ts
// in spawn():
this.eventBus.emit({
  type: 'canvas:layer:spawned',
  instanceId,
  definitionId: def.id,
  slug: def.slug,
  category: def.category,
  layout: def.layout,
  sandbox: def.sandbox,
})

// in dismiss():
this.eventBus.emit({ type: 'canvas:layer:dismissed', instanceId })
```

The mounter is a thin emitter (not the full Phase-03 canvas engine). The frontend
`SandboxedLayer` owns the actual DOM mount; this engine only satisfies the event
contract. Instantiated at boot in `src/server/index.ts`.

---

## 5. Endpoint 1 & 2 — Capabilities (C5, already exist)

`GET /api/capabilities?surface=ui` (src/server/capability-router.ts:44)
already returns `ResolvedCapability[]` with `uiSlots` populated from
`parseUiSlots(ui_component_override)`.

`GET /api/conversations/:id/capabilities` (src/server/conversation-router.ts:91)
resolves via the conversation's provider.

The frontend `useUiSlots` already consumes these. **No backend change needed**
for C5 — only catalog seeding on the frontend (see `05-data-driven-seeding.md`
open items).

---

## 6. DB columns (already exist)

| Column | Table | Used by |
|--------|-------|---------|
| `ui_component_override` | `provider_capability` | C5 (`uiSlots`) |
| `stream_block` (table) | `StreamBlockStore` | C6 (blocks) |
| `provider_type` / `primitive` / `ui_component` | conceptual model | `useConceptualModel` (09/10) |
| `provider_type_id` | `provider_definition` | family linkage for resolution |

---

## 6b. Conceptual endpoints (6–9, already implemented)

Served by `src/server/conceptual-router.ts` (mounted in `src/server/index.ts`).
Resolution brain: `src/engines/conceptual-model-service.ts`.

**`GET /api/conceptual/families`** → `{ families: ProviderType[] }`
(all seeded families: `ai-chat`, `email`, `messenger`, `social`, `custom`).

**`GET /api/conceptual/surface?providerId=<id>`** →
```json
{
  "ok": true,
  "providerId": "chatgpt",
  "family": "ai-chat",
  "slots": [
    {
      "primitive": { "id": "ai-chat.entry", "scope": "family", "label": "Entry", "defaultRegion": { "x": 0, "y": 0, "w": 400, "h": 300 }, "version": 1 },
      "component": { "id": "uc:...", "componentKey": "ai-chat.entry.system", "html": "...", "css": "...", "scriptUrl": null },
      "tier": "cross-type",
      "fromSystemDefault": false
    }
  ]
}
```
`component` is the resolved `UiComponent` domain object from the 4-tier precedence;
`null` (with `tier: "system"`, `fromSystemDefault: true`) means the frontend uses its
built-in default. The frontend `useConceptualModel` maps a primitive id to a
`chat.*` SlotId when possible and hot-swaps the component into the registry.

**`GET /api/conceptual/provider-types/:slug`** → family spec + its `UiComponent` rows.
**`GET /api/conceptual/resolve?providerId=&familyId=&primitiveId=&variant=`** →
single resolved `UiComponent` (debug / devtools).

Seeds load at server boot via `seeds/conceptual-model/seed.ts` (idempotent).

---

## 7. CanvasSurface mount (C1 follow-up)

`CanvasSurface` is mounted as an additive **Canvas** tab in `App.tsx`
(`<CanvasSurface providerId="chatgpt" />`), alongside `ChatPage` (kept intact as a
working fallback). `ChatPage` is NOT retired — the canvas tab is additive per
product decision.

```tsx
// web/ui/src/App.tsx
{tab === 'canvas' && <CanvasSurface providerId="chatgpt" />}
```

The seed nodes in `CanvasSurface` already render the same slots `ChatPage` did, and
are replaced at runtime by the family-driven resolved surface.

---

## 8. Acceptance (full system)

- [x] `GET /api/conceptual/{families,surface,provider-types/:slug,resolve}` return resolution
- [x] `useConceptualModel` fetches `/api/conceptual/surface` and hot-swaps components
- [x] `CanvasSurface` lays out family-driven nodes (ai-chat seeded; fallback `SEED_NODES`)
- [x] `/api/conversations/:id/stream-blocks` returns blocks + streaming flag
- [x] `/ws/canvas` relays `canvas:layer:spawned` / `dismissed`
- [x] `CanvasLayerMounter` emits `canvas:layer:*` events on spawn/dismiss
- [x] `CanvasSurface` mounted as a Canvas tab in `App.tsx` (ChatPage retained)
- [ ] End-to-end: spawn a layer → node appears → `useManifest` updates → oracle sees it
- [ ] End-to-end: stream a response → `StreamingSlot` pulses → `ResultSlot` fills
- [x] `bun run typecheck` + `bun test` pass
