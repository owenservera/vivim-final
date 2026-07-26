# Plan — M4 (Option B): Canvas as Default Shell + Real Multi-Turn

**Date:** 2026-07-16
**Decision:** Pivot M4 from `ChatPage`-only fixes to making `CanvasSurface` the default
frontend shell with a working multi-turn send path, then retiring `ChatPage`.
**Supersedes:** `docs/roadmap/prd/M4-frontend.md` (ChatPage-only scope).

---

## 0. Truth snapshot (verified by reading code)

| Fact | Evidence |
|------|----------|
| `App.tsx` routes the live `chat` tab to `ChatPage`; `CanvasSurface` is **not imported/routed** | `frontend/src/App.tsx:97` |
| Canvas has **no send/conversation state** — `chat.composer/thread/sidebar` nodes render slot components with **no props** (dead send) | `CanvasSurface.tsx:32-39`, `useNodeTypes.tsx:78` (`<Component slotId={slotId} />` only) |
| Slot components (`Thread`, `Composer`, `Sidebar`, `Header`, `ErrorBar`) are **prop-driven pure renderers** | `messages.tsx:67`, `composer.tsx:70`, `defaults/index.tsx` |
| `SlotProvider` exists (`ui/context.tsx`) but is **used nowhere** | grep: 0 usages |
| `sendMessage` → `POST /api/conversations/:id/send` → `ConversationManager.send` (M0–M3 backend) — **alive** | `api.ts:95`, `client.ts:217`, `conversation-router.ts:322` |
| `StreamBlockStore.getBlocksByConversation(id, opts)` exists | `stream-block-store.ts:40` |
| **Missing backend:** `GET /api/conversations/:id/stream-blocks` | not found in `src` |
| **Missing backend:** `/ws/canvas`, `canvas:layer:*` events, `LayerMounter` | not found in `src` |
| `CapabilityEvent` union has **no** `canvas:layer:*` variant | `capability-event-bus.ts:7-107` |

**Conclusion:** The canvas is a render-only shell. For a *functional multi-turn* canvas we need
(1) a state-owning controller feeding the existing slot components, (2) routing, plus backend
wires C6 (stream-blocks) and optionally C7 (live layer WS). M0–M3 backend is untouched and reused.

---

## 1. Strategy

- **Reuse, don't rewrite.** Extract `ChatPage`'s controller logic (openProvider / selectProvider /
  selectConversation / newChat / doSend / error-clear) into a `ChatStateProvider` React context.
- **Inject state via context, not prop-drilling.** Create thin canvas **node adapters** that read
  `useChatState()` and pass values as `props` to the *existing* slot components. The shared slot
  defaults stay prop-driven and unchanged → preserves FRONTEND=BACKEND + hot-swap.
- **Route `CanvasSurface` as the default shell**, retire `ChatPage` from `App.tsx` (keep file as
  fallback per doc 08, delete once green).
- **Backend C6** (`stream-blocks` endpoint) — small, required for `ResultSlot`/progressive blocks.
- **Backend C7** (`/ws/canvas` + `canvas:layer:*` events) — **deferred to a follow-up**; not needed
  for basic multi-turn. Document as remaining gap. Canvas still works; `useCanvasEvents` simply
  receives no spawn/dismiss messages yet.
- **Keep M4's spirit:** no phantom error bubbles (errors → `chat.error` slot), reconcile thread
  after send (now via `fetchMessages` in the provider), clear error/sending on switch.

---

## 2. Deliverables / steps

### Phase 1 — Chat state controller (frontend)
1. **`frontend/src/features/canvas/useChatState.tsx`** (new): `ChatStateProvider` + `useChatState()`.
   Move the controller logic out of `ChatPage.tsx` (`openProvider`, `selectProvider`,
   `selectConversation`, `newChat`, `doSend`, `doAttach`) verbatim, exposing:
   `{ providerId, account, conversations, activeId, messages, sending, busy, error,
      doSend, doAttach, selectProvider, selectConversation, newChat }`.
   - Fix M4 bugs here: on `doSend` failure → `setError` ONLY (no fake assistant bubble);
     on success → `fetchMessages(activeId)` re-sync (reconcile); `selectProvider`/
     `selectConversation`/`newChat` reset `error` + `sending`.
2. Wrap `CanvasSurface` tree in `<ChatStateProvider>` (in `App.tsx` or inside `CanvasSurface`).

### Phase 2 — Feed slot components via context (no edits to shared defaults)
3. **`frontend/src/features/canvas/nodes/ChatNodes.tsx`** (new): thin adapters — `ThreadNode`,
   `ComposerNode`, `SidebarNode`, `HeaderNode`, `ErrorNode` — each calls `useChatState()` and
   renders the existing slot component with the right props
   (e.g. `ComposerNode` → `<Composer adapter onSend={doSend} onAttach={doAttach} disabled={sending} />`).
4. Point `SEED_NODES` / `useNodeTypes` for `chat.thread|composer|sidebar|header|error` at these
   adapters (registry `register`/override or node `type` swap). Keep `chat.entry|actionBar|bubble`
   on defaults.

### Phase 3 — Routing + retirement
5. **`App.tsx`**: replace `<ChatPage />` chat tab with `<CanvasSurface />`; keep `Capabilities`/
   `Setup` tabs. Delete `ChatPage.tsx` (and its `api.ts`/`types.ts` if unused elsewhere — verify).
6. Keep `registerDefaults()` call in `main.tsx` (canvas uses the same registry).

### Phase 4 — Backend C6 (stream-blocks)
7. **`src/server/conversation-router.ts`**: add `GET /api/conversations/:id/stream-blocks`
   (query: `messageId?`, `blockKind?`, `limit?`, `offset?`) →
   `ctx.streamBlocks.getBlocksByConversation(id, {messageId, blockKind})` + a `streaming` flag
   (derive from conversation status / live send flag). Response `{ blocks, streaming }`.
8. Add a `StreamingSlot`/`ResultSlot` wiring already present (`useStreamBlocks.ts` polls this) — verify
   the polling URL matches; map `StreamBlockRow` → `ContentBlock` (shared/stream-blocks.ts).

### Phase 5 — (Deferred) Backend C7
9. Add `canvas:layer:spawned` / `canvas:layer:dismissed` to `CapabilityEvent` union; emit from a
   `LayerMounter`; add `/ws/canvas` forwarder. **Out of this plan's must-have** — track as
   `M4-canvas-followup`. `useCanvasEvents` tolerates zero messages.

---

## 3. Tests / verification (SC gates)

- **SC-1 (no phantom bubbles):** `tests/unit/web/chat-state.test.tsx` (new) — `doSend` failure →
  `messages` count unchanged, `error` set, no `role:'assistant'` `(error)` row.
- **SC-2 (reconcile):** success → after settle, `messages` equals `fetchMessages` server rows
  (mock `sendMessage` returns ok, assert re-fetch called).
- **SC-3 (switch clears):** `selectProvider`/`selectConversation` reset `error`+`sending`.
- **SC-4 (canvas routes):** `App` renders `CanvasSurface` for chat tab; `ChatPage` not mounted.
- **SC-5 (send works on canvas):** integration test — mount `CanvasSurface` under
  `ChatStateProvider`, type in `ComposerNode`, submit → `sendMessage` called, thread updates.
- **SC-6 (FRONTEND=BACKEND):** no `if (slug===…)` added; rendering via slots/registry;
  `bun run devops audit-code standard` clean on changed files.
- **SC-7 (build/lint):** `bun run build` (web/ui) + `bun run lint` green; `bun run typecheck` clean.
- **SC-8 (visual):** `bun run devops runtime-test verify` screenshot shows 2+ turns in one thread,
  no phantom error bubble, canvas shell.
- **SC-9 (C6 backend):** `tests/unit/server/stream-blocks.test.ts` (new) — endpoint returns
  blocks + streaming flag from `StreamBlockStore` (mock store).

---

## 4. Files touched

**New**
- `frontend/src/features/canvas/useChatState.tsx`
- `frontend/src/features/canvas/nodes/ChatNodes.tsx`
- `tests/unit/web/chat-state.test.tsx`
- `tests/unit/web/canvas-multiturn.test.tsx`
- `tests/unit/server/stream-blocks.test.ts`

**Edit**
- `frontend/src/App.tsx` (route to `CanvasSurface`)
- `frontend/src/features/canvas/CanvasSurface.tsx` (wrap in `ChatStateProvider`; seed nodes → adapters)
- `frontend/src/features/canvas/useNodeTypes.tsx` (map chat.* slots to adapters)
- `src/server/conversation-router.ts` (stream-blocks endpoint)

**Delete**
- `frontend/src/features/chat/ChatPage.tsx` (+ verify `api.ts`/`types.ts` still used)

**Untouched**
- M0–M3 backend (`conversation-manager.ts` URL capture/navigate/patterns) — fully reused.
- Shared slot defaults (`ui/defaults/*`) — unchanged (prop-driven).
- `CapabilityEventBus` union — C7 deferred.

---

## 5. Risks / open questions

- **`ChatPage.api.ts`/`types.ts` reuse:** `CanvasSurface` controllers need the same `sendMessage`/
  `fetchMessages`/`createConversation` API. Confirm no ChatPage-only coupling before deleting.
- **`providerConversationUrl` visibility:** M1 persisted it; optionally surface in a canvas node
  tooltip later (not blocking).
- **Streaming flag source:** need a live "is this conversation currently generating" signal.
  Simplest: derive from a `conversation.status` column or a transient EventBus flag. Confirm
  `conversation` schema has a status field; else use `sending` client-side only.
- **C7 deferred** means live layer spawn/dismiss is not in M4; canvas is a static seed layout that
  still drives real multi-turn chat. Acceptable per doc 08 "pending" list.

---

## 6. Rollout order

1. Phase 1 (controller) + Phase 2 (adapters) + Phase 3 (route) → **green multi-turn canvas** on the
   live surface, ChatPage retired.
2. Phase 4 (C6) → progressive blocks/ResultSlot light up.
3. Verify SC-1..8. C7 (Phase 5) as separate follow-up.

## 7. Roadmap ledger update

- Rewrite `docs/roadmap/MULTITURN-ROADMAP.md` M4 entry: status `M4-canvas-in-progress`, point to
  this plan; mark old `M4-frontend.md` superseded.
- Keep M0/M1/M2/M3 complete records intact.
