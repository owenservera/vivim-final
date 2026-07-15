# PRD — Hot-Swappable Capability-Global UI

**Status:** Draft for system baseline
**Author:** vivim runtime (agent)
**Scope:** Frontend architecture for a fully hot-swappable, shared-component UI driven by
capability globals (provider-agnostic atoms that any provider/capability can override at runtime).

---

## 1. Context & Problem

We are building a full multi-turn chat that must serve **Claude, ChatGPT, Gemini, and future
providers** through one reusable component set. The backend already supports multi-turn
conversations for any provider (`ConversationManager.send` appends user+assistant messages;
per-provider selectors, capture patterns, and parsers already exist in `provider-selectors.ts`,
`seeds/parsers/*`). The frontend gap is twofold:

1. **No shared component taxonomy.** Today `web/ui/src/features/chat/*` hard-codes a
   `ChatPage` that renders `MessageBubble`, `Composer`, `ConversationSidebar` directly. There is
   no concept of a *capability global* — a cross-cutting UI atom (main chat box, send button,
   attach button, message bubble, etc.) that is defined once and reused everywhere.
2. **No hot-swap.** Swapping a component (e.g. a richer Claude bubble, a custom attach button)
   currently requires editing source and rebuilding. We need runtime registration that live-updates
   the mounted UI without a rebuild.

What exists today that we build on:
- `web/ui/src/registry/index.ts` — `CapabilityRegistry` (bespoke vs generic per capability slug).
- `web/ui/src/providers/registry.ts` — `PROVIDER_ADAPTERS` (brand/icon/copy per provider).
- `web/ui/src/features/chat/registry.ts` — first hot-swap registry (bubble/composer/sidebar slots,
  external store, `registerChatRenderer` / `resolveChatRenderer` / `useSyncExternalStore`).
- Backend `ResolvedCapability` (capability-resolution.ts) already carries UI contract fields
  (`uiPosition`, `uiLayerDepth`, `resultComponent`, `requiresUserConfirmation`, …).

## 2. Goals

- **G1 — Capability globals.** Define a canonical catalog of UI slots (the shared atoms) that every
  surface renders through one resolution path.
- **G2 — Hot-swap.** Any slot can be overridden at runtime for a `slug` (capability or provider) and
  the mounted UI updates live — no rebuild.
- **G3 — Default reuse.** Every slot has a generic default; Claude/ChatGPT/Gemini share defaults and
  only override what they need.
- **G4 — FRONTEND=BACKEND.** Slot resolution is keyed by the same capability/provider slug the
  backend uses, so a backend capability maps deterministically to its frontend renderer.
- **G5 — Action routing (B8).** Every interactive slot (send, attach, confirm) dispatches through the
  `ActionRegistry` by `id = slug`; no ad-hoc handlers.
- **G6 — Sandbox safety (P8).** A swapped/bespoke component is still sandboxed to exactly its
  capability(s) — whitelist enforced in the registry resolve path.

## 3. Non-Goals

- Rewriting the backend chat pipeline (already works).
- Per-provider *business logic* in the UI — logic stays backend-side; the UI only renders + dispatches.
- A full design-system / Tailwind migration (styling stays inline/utilitarian for now).

## 4. Conceptual Model

### 4.1 Capability globals (the slot catalog)

A **capability global** is a named UI slot — a fixed position in the surface that renders a
swappable component. Proposed canonical slots (this is the taxonomy we must baseline):

| Slot ID | Role | Default | Overridable by |
|---------|------|---------|----------------|
| `chat.entry` | Main chat box / frontend entry point (host region) | `ChatPage` | capability |
| `chat.sidebar` | Conversation list + new-chat | `ConversationSidebar` | provider |
| `chat.thread` | Message scroll region | generic | capability |
| `chat.bubble` | Single message (user/assistant) | `MessageBubble` | provider/capability |
| `chat.composer` | Input + send region | `Composer` | provider |
| `chat.send` | Send-message button | inside `Composer` | capability |
| `chat.attach` | Attach-file button | generic (hidden until capability enables) | capability |
| `chat.streaming` | Progressive/streaming indicator | generic | capability |
| `chat.result` | Rich result renderer (blocks/artifacts) | `GenericResultRenderer` | capability |
| `chat.confirm` | Confirmation dialog (destructive ops) | `ConfirmDialog` | capability |
| `chat.error` | Error/toast surface | generic | capability |
| `chat.header` | Provider switcher + account status | generic | provider |
| `chat.actionBar` | Capability action buttons (B8) | `ActionBar` | capability |

These slots are the **shared components** referenced. Defining them once and resolving each through
the registry is what makes the UI plug-and-play.

### 4.2 Resolution precedence

```
resolve(slot, context) →
  bespoke[slot][capabilitySlug]            // most specific
  ?? bespoke[slot][providerSlug]           // provider override
  ?? default[slot]                         // shared generic
```

`context` carries `{ capabilitySlug?, providerSlug }`. This is what lets Claude hot-swap only its
bubble while ChatGPT/Gemini keep the default.

### 4.3 Hot-swap mechanism

The registry is an **external store** (already proven in `chat/registry.ts`):

- `registerChatRenderer(slot, slug, Component)` → stores override + bumps a version + notifies subscribers.
- `resolveChatRenderer(slot, slug)` → returns active component per precedence.
- `subscribe(listener)` / `getVersion()` → consumed by `useSyncExternalStore` so a runtime swap
  live-re-renders the mounted surface.

This must be **global** (not just chat sub-components) and exposed for runtime use:
`window.__vivim.ui.register(slot, slug, Component)` / `hotSwap(slot, slug, Component)`.

## 5. What Is Structurally Missing (baseline gaps)

To reach G1–G6 the following are not yet in place:

1. **No canonical slot taxonomy.** Slots are ad-hoc (`bubble/composer/sidebar` only). We need the
   full `SlotCatalog` (§4.1) typed in one place so every surface resolves through it.
2. **Hot-swap is chat-local.** `chat/registry.ts` only covers 3 slots. There is no global
   `UIComponentRegistry` that `chat.entry`, `chat.attach`, `chat.result`, `chat.confirm`,
   `chat.actionBar`, etc. resolve through.
3. **Backend contract not mapped to slots.** `ResolvedCapability` has `resultComponent` /
   `uiPosition` but no per-slot override fields (`composerComponent`, `attachComponent`,
   `resultComponent`, `confirmComponent`). The capability→frontend-slot link is implicit, not data-driven.
4. **No server-provided slot manifest.** `CapabilityRegistry` (frontend ledger) and the backend
   capability row don't yet enumerate *which slots* a capability overrides. Swaps can't be discovered
   or seeded from the backend.
5. **No runtime entry point.** Nothing exposes live registration (devtools/`window.__vivim`) for a
   swap without editing source.
6. **Swaps are ephemeral.** A runtime swap is lost on reload. Need optional persistence
   (localStorage for dev, or backend `ProviderCapability.ui_component_override` for prod) so a
   promoted bespoke renderer survives restart.
7. **Actions not slot-driven (B8).** `chat.send` / `chat.attach` call handlers inline. They must
   dispatch through `ActionRegistry` by `id = slug` so the same action works across surfaces.
8. **Sandbox not enforced on swaps (P8).** A bespoke component isn't yet whitelisted to its
   capability(s) at resolve time; the registry must attach the capability slug + sandbox claims.
9. **Streaming/blocks not wired to a slot.** `StreamParserEngine` blocks exist but there is no
   `chat.streaming` / `chat.result` slot consuming them progressively.
10. **Provider adapter vs component swap are separate systems.** `providers/registry.ts` (branding)
    and `chat/registry.ts` (components) must be unified under one resolver so a provider can override
    both brand and components consistently.

## 6. Proposed Baseline Design

### 6.1 `web/ui/src/ui/slots.ts` — canonical `SlotCatalog`
Typed union of all slot IDs (§4.1). Single source of truth.

### 6.2 `web/ui/src/ui/registry.ts` — global `UIComponentRegistry`
External store superseding `chat/registry.ts`. API:
- `register(slot: SlotId, slug: string, component, opts?: { sandbox?: string[] })`
- `resolve(slot, ctx: { capabilitySlug?; providerSlug }): ComponentType`
- `subscribe` / `getVersion` (for `useSyncExternalStore`)
- `listOverrides()` (for the manifest / debug surface)
- Enforces P8: a resolved bespoke component carries its `sandbox` whitelist.

### 6.3 Resolve everywhere
`ChatPage` (and future surfaces) render **every** slot via `resolve(...)`. Defaults live in
`web/ui/src/ui/defaults/*`. No component is imported directly into a surface.

### 6.4 Backend contract extension
Extend `ResolvedCapability` (capability-resolution.ts) with an `uiSlots` map:
`{ [slotId]: { component?: string; sandbox?: string[] } }`, populated from
`ProviderCapability.ui_component_override`. `GET /api/capabilities` already returns the contract; the
frontend reads `uiSlots` and calls `register(slot, slug, resolvedComponent)` on load. This makes the
link **data-driven** (FRONTEND=BACKEND).

### 6.5 Action routing (B8)
`chat.send`, `chat.attach`, `chat.confirm` dispatch via `ActionRegistry` (`id = slug`). The
`ActionBar` slot renders from `ResolvedCapability` actions.

### 6.6 Runtime + persistence
- Expose `window.__vivim.ui` for live hot-swap (dev/debug).
- On load, apply persisted overrides (localStorage in dev; backend `ui_component_override` in prod).

## 7. Implementation Plan (units)

| Unit | Delivers | Depends on |
|------|----------|------------|
| H1 | `slots.ts` canonical `SlotCatalog` | — |
| H2 | Global `UIComponentRegistry` (external store, P8 sandbox) | H1 |
| H3 | `ui/defaults/*` generic components for all slots | H1 |
| H4 | Refactor `ChatPage` to resolve every slot via registry | H2, H3 |
| H5 | Backend `ResolvedCapability.uiSlots` + contract populate from `ProviderCapability` | — |
| H6 | Frontend applies `uiSlots` on capability load (data-driven swaps) | H2, H5 |
| H7 | `ActionRegistry` wiring for send/attach/confirm | H4 |
| H8 | `window.__vivim.ui` runtime hot-swap + persistence | H2 |
| H9 | Unify `providers/registry.ts` branding into the same resolver | H2 |
| H10 | `chat.streaming` / `chat.result` slot consuming `StreamParserEngine` blocks | H4 |

## 8. Invariants & Acceptance

- **FRONTEND=BACKEND (5.1):** slot resolution keyed by backend capability/provider slug.
- **One Entry Point (25.7):** slot actions dispatch via `ActionRegistry` (`id = slug`).
- **Governor Canon (B1):** UI never touches CDP; only dispatches actions the backend executes.
- **Sandbox (P8):** bespoke component whitelisted to its capability(s).
- **Acceptance:** swapping `register('chat.bubble','claude', MyBubble)` from devtools live-updates
  only Claude's bubbles; ChatGPT/Gemini unchanged; reload restores persisted override.

## 9. Open Questions

- Should bespoke overrides be persisted to backend `ProviderCapability.ui_component_override` (prod)
  or stay dev-only (localStorage)? Recommend: both, gated by `NODE_ENV`.
- Do we need per-**capability** (not just provider) bubble overrides, or is provider-level enough?
  Recommend: capability-level (most specific) wins.
- Streaming: does `chat.streaming` replace `chat.bubble` during streaming, or compose? Recommend compose
  (streaming indicator inside the bubble region).
