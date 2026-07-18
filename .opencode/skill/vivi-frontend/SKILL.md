---
name: vivi-frontend
description: Component-driven, contract-first, hot-swappable frontend skill for vivim-final. Use when building frontend UI from capability globals (slots), promoting sandbox harnesses into reusable renderers, wiring UI actions, or making the React UI render from the CapabilityResolutionEngine contract. The frontend is composed of swappable capability-global slots resolved through the global UIComponentRegistry — any slot can be hot-swapped at runtime per provider/capability. Consumed by devops during its frontend build/verify steps.
---

# vivi-frontend — Hot-Swappable, Capability-Global Frontend Skill

**Purpose:** Make the React frontend a *reusable, slot-resolved, hot-swappable* surface rather than
a hardcoded feature app. The UI is composed of **capability globals** — named, swappable UI slots
(`chat.entry`, `chat.bubble`, `chat.send`, `chat.attach`, …) — each resolved at render time through
the global `UIComponentRegistry`. A slot has a generic **default** (shared by every provider) and can
be **hot-swapped** for a provider or capability slug at runtime, live-updating the mounted UI.

Baseline spec: `docs/prd-hot-swappable-ui.md`.

**Invocable by:** `devops` (Goal Mode — Frontend Build step), or directly by the agent when frontend
work is in scope.

> **Unified surface note:** The primary frontend surface is now the **infinite canvas** (`CanvasSurface.tsx`,
> a React-Flow node graph) driven by the DB-backed **provider-type conceptual model** (`ProviderType` /
> `UiComponent` tables, 4-tier resolution). The slot-based `ChatPage` is retained as a secondary tab but
> is no longer the only surface. New UI regions should be expressible as **conceptual-model `UiComponent`**
> rows (provider/family/cross-type/system tiers) resolved onto canvas nodes — not just `chat.*` slots.
> Slot overrides (`UIComponentRegistry`) still apply for fine-grained provider/capability hot-swaps
> within a surface, but the canvas + conceptual model is the generative backbone.
> Source of truth: `docs/roadmap/prds/PRD-VIVIM-CANVAS-UNIFIED-SURFACE.md`.

---

## 0. The Inviolable Rule: FRONTEND = BACKEND (and slots are globals)

A capability/provider `slug` is the single link between backend and frontend (invariant **5.1**). The
frontend MUST NOT contain feature-specific conditional rendering. It renders whatever the backend
contract + the slot registry resolve. If a feature needs UI, it is expressed as:
- a **contract field** on a capability (`ResolvedCapability`), and/or
- a **slot override** registered at runtime for a `slug` (provider or capability), never as
  `if (slug === 'x')` branches in a component.

The canonical slot taxonomy is the single source of truth for "what UI exists":
`web/ui/src/ui/slots.ts` (`SLOT_IDS` / `SlotMeta`). Every surface resolves its regions through these
slots — there is no component imported directly into a surface.

---

## 1. When to Activate

- Adding UI for the **unified canvas** (a new node type, layer host, or region) or the
  provider-type conceptual model (`UiComponent` row / seed tier).
- Adding UI for a new/existing capability or provider.
- Promoting a proven `web/sandbox` harness into a reusable slot default or bespoke renderer.
- **Hot-swapping** a slot for a specific provider/capability (runtime, no rebuild).
- Wiring a UI action (must go through `ActionRegistry` — invariant **B8**).
- Building or repairing the slot-resolved surface host (`features/chat/ChatPage.tsx` is the
  reference implementation).
- Any `devops loop --goal=...` step that touches `web/ui`.

---

## 2. Architecture: Capability Globals + UIComponentRegistry

```
UIComponentRegistry (web/ui/src/ui/registry.ts)   ← external store (live hot-swap)
  ├─ defaults: Record<SlotId, Component>           ← generic, shared by all providers
  ├─ bespoke:  Record<SlotId, Map<slug, {component, sandbox}>>
  └─ resolve(slot, {providerSlug, capabilitySlug}) → capabilitySlug > providerSlug > default

SlotProvider (web/ui/src/ui/context.tsx)          ← provides {providerSlug, capabilitySlug}
  └─ useSlot(slot)                                 ← useSyncExternalStore; re-renders on hot-swap

defaults/* (web/ui/src/ui/defaults/)               ← one generic component per slot
registerDefaults()                                 ← idempotent registration at app boot
```

### Resolution precedence (per slot)
```
resolve(slot, ctx) →
  bespoke[slot][ctx.capabilitySlug]   // most specific (capability-level override)
  ?? bespoke[slot][ctx.providerSlug]  // provider override
  ?? defaults[slot]                   // shared generic
```

The chat surface (`features/chat/ChatPage.tsx`) is composed **entirely** of slots: `chat.entry`
host → `chat.sidebar` / `chat.header` / `chat.thread` / `chat.error` / `chat.composer`; the thread
internally resolves `chat.bubble` + `chat.streaming` + `chat.result`; the composer internally
resolves `chat.send` + `chat.attach`. A provider can hot-swap any one of these without touching the
others.

### Slot catalog (capability globals)
| Slot | Role | Overridable by |
|------|------|----------------|
| `chat.entry` | Main chat box / host region | capability |
| `chat.sidebar` | Conversation list + new-chat | provider |
| `chat.thread` | Message scroll region | capability |
| `chat.bubble` | Single message | capability / provider |
| `chat.composer` | Input + send region | provider |
| `chat.send` | Send-message button | capability |
| `chat.attach` | Attach-file button | capability |
| `chat.streaming` | Progressive/streaming indicator | capability |
| `chat.result` | Rich result renderer (blocks) | capability |
| `chat.confirm` | Confirmation dialog | capability |
| `chat.error` | Error/toast surface | capability |
| `chat.header` | Provider switcher + account status | provider |
| `chat.actionBar` | Capability action buttons (B8) | capability |

**CRITICAL:** All slot IDs are namespaced with `chat.` prefix. The taxonomy pipeline's
`CATEGORY_POSITIONS` must emit these exact values (e.g. `chat.actionBar`, not `actionBar`).
A mismatch means `auto-populate.ts` cannot resolve the slot and `ui_position` silently fails.

To add a new capability global: add its id to `SLOT_IDS` in `web/ui/src/ui/slots.ts`, give it a
generic default in `web/ui/src/ui/defaults/`, and register it in `registerDefaults()`.

### Reusable primitives to reuse FIRST (do not reinvent)
| Primitive | Path | Use |
|-----------|------|-----|
| `UIComponentRegistry` | `web/ui/src/ui/registry.ts` | Global slot registry: `register`/`unregister`/`resolve`/`listOverrides`/`applyClaim`/`hotSwap` |
| `SlotProvider` / `useSlot` / `useResolvedSlot` | `web/ui/src/ui/context.tsx`, `useSlot.ts` | Resolve a slot under the current provider/capability context |
| `slots` catalog | `web/ui/src/ui/slots.ts` | `SLOT_IDS`, `SlotMeta`, `SlotOverrideClaim` |
| `registerDefaults` | `web/ui/src/ui/defaults/index.tsx` | Register generic defaults + catalog entries (call at boot) |
| `ActionRegistry` / `ActionSpec` | `web/ui/src/actions/registry.ts` | Dispatch + Zod-validated params (B8) |
| `ActionTrigger` | `web/ui/src/components/action-trigger.tsx` | Click → action dispatch |
| `CapabilityRegistry` | `web/ui/src/registry/index.ts` | Complementary ledger: `slug` → bespoke **capability** renderer (generic fallback) |

> The older `CapabilityRegistry` (slug→bespoke capability renderer) still exists and is used for
> capability-specific renderers. The slot-based `UIComponentRegistry` is the primary surface
> backbone — it is what makes components *shared and hot-swappable across providers*.

---

## 3. Build Strategy (follow in order)

1. **Resolve the goal to a slug.** `POST /api/nlcl/interpret` (or read the capability directly).
2. **Fetch the contract.** `GET /api/providers/:id/capabilities?planTier=free` →
   `ResolvedCapability[]`. Read `ui_position`, `ui_component`, `ui_input_schema`,
   `result_component`, `availability_json`, `requires_user_confirmation`, **and `uiSlots`** (the
   per-slot hot-swap map — see §4).
3. **Decide generic vs bespoke.**
   - **Generic:** render the slot's default. If you only need a custom capability renderer, register
     it in `CapabilityRegistry` (slug→bespoke) — zero new slot code.
   - **Bespoke slot:** register a component for a slot + slug in `UIComponentRegistry`
     (`register('chat.bubble', 'claude', MyBubble, { sandbox: ['claude.send_message'] })`).
4. **Wire the action** via `ActionRegistry` (id = slug; Zod params; `POST /api/.../execute`). Every
   interactive slot (send/attach/confirm) dispatches through it (B8).
5. **Mount in a surface** that wraps its tree in `<SlotProvider providerSlug={...}>` and resolves
   slots via `useSlot(...)`. No per-capability routing — the registry resolves it.
6. **Result rendering.** `chat.result` default renders `StreamParserEngine` blocks
   (`message.blocksJson`).
7. **Hot-swap (optional, runtime).** From devtools: `window.__vivim.ui.register('chat.bubble','claude', MyBubble)`.
   The mounted UI live-updates; the override persists to localStorage for dev.
8. **Verify.** `bun run typecheck` → `bun run lint` → `devops` `discover` (`:5173`) →
   `verify` (screenshot).

---

## 4. Data-Driven Swaps (FRONTEND = BACKEND, H6)

The backend drives slot overrides through `ResolvedCapability.uiSlots`, populated from
`provider_capability.ui_component_override` — a JSON map:

```json
{ "chat.bubble": { "component": "claude-bubble", "sandbox": ["claude.send_message"] } }
```

- Resolver: `CapabilityResolutionEngine` joins `provider_capability` and parses the override into
  `uiSlots` (`src/engines/capability-resolution.ts:parseUiSlots`). A legacy plain-string value is
  treated as no override.
- Frontend: `fetchCapabilities(providerId)` returns the caps; on open, the surface calls
  `UIComponentRegistry.applyClaim(slot, slug, claim)` for each entry. The `claim.component` key is
  resolved against the **component catalog** (`registerCatalogEntry`) — an unknown key is a safe
  no-op (it only records the claim).
- This makes the capability→frontend-slot link **data-driven**: seed an override in the provider
  manifest and the slot swaps without frontend code changes.

---

## 5. Hot-Swap & Persistence (H8)

- `UIComponentRegistry` is an **external store** (`subscribe`/`getVersion`) consumed by `useSlot`
  via `useSyncExternalStore`. A `register(...)` call bumps the version → every mounted surface
  re-renders with the new component.
- `exposeRuntime()` publishes `window.__vivim.ui` (`register`/`unregister`/`hotSwap`/`resolve`/
  `listOverrides`/`applyClaim`) for live devtools swaps.
- `loadPersisted()` re-applies overrides from `localStorage` (`vivim.ui.overrides`) at boot so a
  dev hot-swap survives reload. Only overrides whose component is a known catalog entry persist.
- **Sandbox (P8):** a bespoke renderer carries a `sandbox` whitelist of the capability(s) it may
  touch; `resolve(...)` returns it alongside the component so the surface can enforce it.

---

## 6. Integration with devops

`devops` invokes this skill during its **Frontend Build** step and lists it in its
**Integration with Skills** section. `discoverFrontend()` probes `:5173`; `verify()` screenshots the
result. The slot-resolved `ChatPage` is the reference surface; new surfaces follow the same
`SlotProvider` + `useSlot` pattern.

### U4 — the frontend renderer is also a canvas layer
The primary surface is now the **unified infinite canvas** (`web/ui/src/features/canvas/CanvasSurface.tsx`).
A capability surfaced by this skill is rendered on the canvas as a node. The canvas runtime is:
- `src/engines/canvas-layer-mounter.ts` — `CanvasLayerMounter` thin emitter; `spawn()` publishes a
  `CanvasDefinition` and the live event `canvas:layer:spawned` is forwarded to the browser over
  `/ws/canvas` via `registerCanvasLayerForwarder` (`src/server/websocket.ts`).
- `web/ui/src/features/canvas/*` — `BrowserLayerHost.tsx`, `SandboxedLayer.tsx`, `useManifest.ts`,
  `useNodeTypes.tsx`, `useStreamBlocks.ts`, `useConceptualModel.ts`, `useCanvasEvents.ts`.
- `shared/canvas-types.ts` — `CanvasDefinition`, `LayerHost`, `SandboxPolicy`, `LayerCategory`.

Surfaces are generated from the **DB-backed provider-type conceptual model** (`ProviderType` /
`UiComponent` tables, 4-tier resolution in `src/engines/conceptual-model-service.ts`), seeded at
server boot from `seeds/conceptual-model/seed.ts`. The renderer and the canvas layer are two views of
one atomic unit — Frontend=Backend (5.1) at the unit level.

### U5 — auto-register + manifest
`scaffoldFrontend({ renderers, slugs })` (devops/runtime-test/build-frontend.ts) appends each
renderer to the `CapabilityRegistry` ledger (`web/ui/src/registry/auto-generated.ts`) and emits
`web/ui/canvas-layer-manifest.json` so the runtime loop can spawn the matching canvas layers
without a live DB at build time. Slot-level bespoke renderers are additionally `register`ed with the
`UIComponentRegistry` so they hot-swap the corresponding surface slot.

---

## 7. Invariants (enforced)

- **FRONTEND = BACKEND (5.1):** slug links backend/frontend; render the contract + resolve slots,
  never hardcode `if (slug)`.
- **Slots are globals:** new UI regions are slots in `web/ui/src/ui/slots.ts`, resolved through the
  registry — not ad-hoc components imported into a surface.
- **Hot-swap live:** `register(slot, slug, component)` updates the mounted UI with no rebuild.
- **ActionRegistry (B8):** every UI action dispatches through `ActionRegistry`, Zod-validated.
- **Sandbox (P8):** a bespoke slot renderer carries a `sandbox` whitelist; resolve exposes it.
- **Generic-first:** new capabilities render with zero new components; promote only on merit.
- **Override awareness:** backend `overrideSources` + `uiSlots` tell you global/tier/provider origin
  — never assume.
- **Type safety:** no `any`; `unknown` + narrowing; `type` imports; `.js` import extensions.
- **Zod at boundaries:** all action params validated before `run`.
- **Tests before commit:** `bun test tests/unit/`, `tests/integration/`, `tests/e2e/` + typecheck + lint.

---

## 8. Verification Checklist

- [ ] `bun run typecheck` (backend) — 0 errors
- [ ] `bun run build` (web/ui, `vite build`) — 0 errors
- [ ] New capability/slot renders via the generic default with **no** new component code
- [ ] Promoted slot: `UIComponentRegistry.listOverrides()` includes the slug
- [ ] `devops discover` reports frontend `:5173` up
- [ ] `devops verify` screenshot shows the slot in its position
- [ ] `onboard test-frontend` mode validates canvas mount + capability invoke + DOM assert for the provider
- [ ] Hot-swap: `window.__vivim.ui.register('chat.bubble','claude', X)` live-updates only Claude
- [ ] Action dispatches via `ActionRegistry` and reaches the backend `/execute` route

---

## 9. CDP Gotchas (for browser adoption + e2e testing)

These affect any frontend testing that drives Chrome via CDP.

### WebSocket URL must be exact
Chrome REJECTS bare `ws://host:port/devtools/browser`. Always resolve from `/json/version`:
```typescript
const ver = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json())
// Use ver.webSocketDebuggerUrl — NOT a hand-built ws:// URL
```

### Provider sessions auto-created
`POST /api/conversations` with `{ providerId }` auto-creates a `providerSession` row + a
conversation. The send route reads `body.message` (NOT `body.content`).

### DB loginState can be stale
The DB may say `loginState: 'logged_in'` while the browser session has expired. Always
verify actual cookies/page URL before claiming a provider is ready.

### Network capture regex must match real endpoint
If the capture regex in `CAPTURE_PATTERNS[provider]` doesn't match the real streaming
endpoint, response text comes back empty. To debug, observe real requests in the browser
devtools or via CDP `Network.requestWillBeSent`.

---

## 10. Canvas & Conceptual-Model Build Recipe (the primary surface)

When the task is "add a surface / region / provider-family UI" — reach for the canvas + conceptual
model, not a hardcoded `ChatPage` branch.

**File map (single source of truth):**
- Backend: `src/engines/conceptual-model-service.ts` (4-tier `UiComponent` resolution),
  `src/engines/canvas-layer-mounter.ts` (`CanvasLayerMounter`),
  `src/server/conversation-router.ts` (`GET /api/conversations/:id/stream-blocks`),
  `seeds/conceptual-model/seed.ts` (idempotent seed, runs at boot).
- Shared: `shared/canvas-types.ts` (`CanvasDefinition`, `LayerHost`, `SandboxPolicy`,
  `LayerCategory`), `shared/stream-blocks.ts` (`ContentBlock` union).
- Frontend: `web/ui/src/features/canvas/CanvasSurface.tsx` (tab in `App.tsx`),
  `BrowserLayerHost.tsx`, `SandboxedLayer.tsx`, `ResultSlot.tsx`, `StreamingSlot.tsx`,
  `ZoomNode.tsx`, `useManifest.ts`, `useNodeTypes.tsx`, `useStreamBlocks.ts`,
  `useConceptualModel.ts`, `useCanvasEvents.ts`, `useUiSlots.ts`, `useZoomLevel.ts`, `index.ts`.

**Steps:**
1. `discover` / `test --nl="..."` → confirm the capability resolves (FRONTEND=BACKEND: `slug` link).
2. New region/component for a provider family? Add a `UiComponent` row (or seed tier) — precedence
   `provider+variant > provider > family+variant > family > cross-type > system default`. Resolve at
   runtime via `useConceptualModel.ts`. NEVER branch `if (slug === 'x')`.
3. Need a live canvas layer? Build a `CanvasDefinition` draft and `CanvasLayerMounter.spawn()` it; the
   `canvas:layer:spawned` event forwards over `/ws/canvas`. Verify the node mounts.
4. Progressive results: `useStreamBlocks.ts` → `GET /api/conversations/:id/stream-blocks`
   (renders `ContentBlock[]`, keyed by `index`).
5. Verify in the **canvas tab** (UI last), then `typecheck` + `lint`.

**Slot hot-swaps still apply** for fine-grained overrides *within* a surface (`UIComponentRegistry`
`register`/`hotSwap`); the conceptual model is the broader generative backbone. `ChatPage` remains a
valid secondary tab.

Source of truth: `docs/roadmap/prds/PRD-VIVIM-CANVAS-UNIFIED-SURFACE.md`.

---

## 11. Agentic Integration (LCAL — Limited Context Agent Loop)

vivi-frontend is now a first-class citizen of the agentic devops loop (`devops/agentic/`).
When an objective like "wire chatgpt.com for full frontend multiturn messaging" is decomposed,
UI-specific task templates are injected from this skill's catalog.

### Agentic sub-tasks this skill contributes

| Template | Objective | Files Scoped | Verification |
|----------|-----------|-------------|-------------|
| `canvas-layer` | Spawn/mount a canvas layer with correct z-axis + region | `CanvasSurface.tsx`, `SandboxedLayer.tsx`, `BrowserLayerHost.tsx`, `canvas-layer-mounter.ts`, `canvas-types.ts` | `cd web/ui && bun run typecheck` + canvas tab screenshot |
| `conceptual-component` | Seed/register a `UiComponent` row (4-tier resolution) conforming to Zod schema | `seeds/conceptual-model/seed.ts`, `src/schema/conceptual-model.ts`, `src/engines/conceptual-model-service.ts`, `shared/ui-component.ts` | `bun test tests/unit/storage/ui-component-store-impl.test.ts` |
| `slot-hotswap` | Register a bespoke component override at runtime via `UIComponentRegistry.hotSwap()` | `web/ui/src/ui/registry.ts`, `web/ui/src/ui/slots.ts`, `web/ui/src/ui/defaults/` | `bun test tests/unit/ui/` + devtools hot-swap test |
| `frontend-test` | Add typecheck + component render tests for a UI surface | `web/ui/src/features/**`, `tests/unit/ui/`, `web/ui/package.json` | `cd web/ui && bun run typecheck && bun test` |
| `canvas-conceptual-verify` | Verify all families resolve through 4-tier precedence with correct `UiComponent` rows | `src/engines/conceptual-model-service.ts`, `shared/conceptual-model.ts`, `seeds/conceptual-model/seed.ts` | `bun run devops agentic probe` → check `components.byScope` |
| `onboard-frontend-verify` | E2E provider frontend verification: canvas mount → capability invoke → DOM assert | `devops/frontend-automation-tester.ts`, `devops/onboard-controller.ts` | `bun run devops runtime-test onboard test-frontend --provider=<slug>` |

### How to invoke agentic from this skill

```
# Full objective-driven UI task decomposition
bun run devops agentic start --objective "add gemini canvas viewer component with Zod schema"

# Compact UI state snapshot
bun run devops agentic probe
→ components.byScope, canvasFamilyCount, slotOverrideCount

# Resume after a handoff
bun run devops agentic resume
```

---

## 12. Tooling (CLI Commands — Use Actual Devops CLI)

Frontend-specific commands are NOT standalone devops commands. Use these existing tools instead:

### UI State Probe
- `bun run devops agentic preflight` — full preflight: accounts, live Chrome, profiles, restore candidates, untested capabilities, gaps, suggested action
- `bun run devops runtime-test status --provider=<slug>` — per-provider capability status including UI test registry data

### UI Validation
- `cd web/ui && bun run typecheck` + `cd web/ui && bun run build` (standard build commands)
- `bun test tests/unit/ui/` (component tests)
- `bun run devops verify-cross-surface` — verifies every capability resolves across CLI/API/MCP/UI surfaces

### UI Frontend Verification
- `bun run devops runtime-test onboard test-frontend --provider=<slug>` — E2E frontend test (canvas mount + capability invoke + DOM assert). Auto-records into UiTestRegistry.
- `bun run devops ui-test status --provider=<slug>` — query UI test history (timestamps, result, notes)
- `bun run devops ui-test record --provider=<slug> --cap=<name> --result=<pass|fail> [--detail=...]` — manually record a UI test result

### Hot-Swap / Visual Verification
Hot-swap and screenshot capabilities are available through the Playwright MCP server in the agent's browser automation tool set — not through a devops CLI command. Use the agent's browser tools directly.

---

## 13. Hooks (Automated UI Guardrails)

Lefthook hooks that fire on git operations to enforce UI invariants before commits.

### Pre-commit: `ui-validate`
```yaml
pre-commit:
  ui-validate:
    glob: "web/ui/src/**/*.{ts,tsx}"
    run: cd web/ui && bun run typecheck
  ui-zod-check:
    glob: "seeds/conceptual-model/seed.ts"
    run: bunx tsc --noEmit 2>&1 | grep -q "conceptual-model" && exit 1 || exit 0
```

### Pre-push: `ui-test-gate`
```yaml
pre-push:
  ui-tests:
    glob: "web/ui/src/**/*.{ts,tsx}"
    run: bun test tests/unit/ui/
  ui-probe:
    run: bun run devops agentic preflight 2>&1 | findstr /i "gaps"
```

---

## SpecKit Integration

Frontend work for SpecKit specs is tracked through the unified pipeline.

### Frontend Build in SpecKit

When implementing a SpecKit feature with frontend scope:

1. **Task format**: `T###: Add React component for <feature>`
2. **Implementation**: Use this skill's patterns (hot-swap, slots, capability globals)
3. **Gate**: `bun run devops speckit gate --scope=phase` includes frontend checks
4. **Verify**: `bun run devops verify-cross-surface` for capability resolution

### Unified Surface (Canvas + Conceptual Model)

The primary frontend surface is the **infinite canvas** (`CanvasSurface.tsx`) driven by the DB-backed **provider-type conceptual model** (`ProviderType` / `UiComponent`). New UI regions should be expressible as:
- A **conceptual-model `UiComponent`** row (provider/family/cross-type/system tiers)
- Resolved onto canvas nodes via the 4-tier resolution

### Key Modules

| Module | Purpose |
|--------|---------|
| `devops/speckit-converge-bridge.ts` | Unified converge pipeline |
| `devops/unified-gate.ts` | Unified quality gate with frontend checks |
