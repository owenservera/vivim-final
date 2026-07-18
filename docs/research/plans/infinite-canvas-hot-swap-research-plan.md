# Research Plan: Infinite-Canvas HTML Hot-Swappable UI for vivim-final

## 1. Situation Report (what exists today — in-repo facts)

vivim-final has **two parallel, mostly-scaffolded systems** around the "infinite canvas + hot-swap UI" concept:

### A. `vivim-canvas` (src/canvas/*, src/server/canvas-*)
A data-driven **infinite-plane HTML layer system** (vision P1–P9). Present and functional as *logic*:
- `types.ts` — full domain model: `CanvasDefinition` (HTML/CSS/sandboxed `scriptUrl`/bindings/layout), `CanvasLayout{x,y,z,w,h,detailZoom}`, `SandboxPolicy`, `BridgeMessage` postMessage protocol, oracle/manifest types.
- `canvas-registry.ts`, `layer-mounter.ts`, `canvas-mirror.ts`, `capability-bridge.ts`, `oracle-reader.ts`, `primitives.ts`, `designer.ts`, `mutation-caps.ts`, `canvas-engine.ts` — full engine wiring.
- `src/storage/contracts/canvas-store.ts` + `in-memory-store.ts` — persistence contract + impl.
- `src/server/canvas-ws.ts` — `ServerLayerHost implements LayerHost` (node/WS side).
- Seed layers exist but are **empty placeholder stubs** (`<div data-region>`).

### B. Hot-swappable UI (web/ui/src/ui/*)
A **slot-based, runtime-swappable component registry** (PRD `docs/prd-hot-swappable-ui.md`). Largely *implemented*:
- `slots.ts` — canonical `SLOT_IDS` catalog (11 chat slots).
- `registry.ts` — global `UIComponentRegistry` external store, `capabilitySlug > providerSlug > default` precedence, P8 sandbox whitelist, `window.__vivim.ui` runtime bridge, localStorage persistence.
- `useSlot.ts` — `useSyncExternalStore` hook for live re-render.
- `features/chat/ChatPage.tsx` — actually resolves **every** slot through the registry; actions dispatch via `ActionRegistry`.

### The real gaps (what web research must de-risk)
1. **No infinite-canvas *viewport* renderer.** `x,y,z,w,h` are pure data. **Nothing** in `src`/`web` (outside `node_modules`) pans/zooms/CSS-transforms a browser surface or mounts a `CanvasDefinition` into real DOM. `LayerHost` is only implemented server-side. The "infinite plane" is currently conceptual, not rendered.
2. **Seed layers are non-visual stubs** — no production HTML/CSS to render.
3. **PRD H5/H6 (backend `ResolvedCapability.uiSlots` → data-driven frontend seeding) and H10 (streaming/result slot wiring) are the unfinished hot-swap units.**
4. **No bridge between systems** — canvas layers and UI slots are disconnected; a canvas layer cannot yet drive/consume a UI slot, nor vice-versa.

---

## 2. Research Questions (to execute in Step 3)

**Q1 — Infinite-canvas viewport architecture (the biggest gap).**
How to build a performant pan/zoom/semantic-zoom renderer for absolutely-positioned HTML layers on an infinite plane? Sub-questions: CSS-transform viewport vs canvas-vs-DOM; virtualization (only mount visible layers + `detailZoom` culling); wheel/drag/zoom gesture math; coordinate<->screen mapping; integration with React (portal/transform wrapper vs imperative layer host). Targets: tldraw, excalidraw, react-flow, tldraw "Editor" model, infinite canvas UX patterns (e.g. "infinite canvas" by void.dev / Josh Comeau), CSS `will-change`/`transform: translate() scale()` pitfalls.

**Q2 — Sandboxed HTML-layer execution & capability bridge.**
Best-practice patterns for running untrusted HTML/CSS/JS layers safely in-browser: iframe `sandbox` attribute + CSP, `postMessage` bridge protocol design, `allow` lists, time-budget enforcement, preventing DOM-escape. Validate our existing `BridgeMessage` protocol against tldraw/iframe-sandbox/Cesium/observable-hq patterns.

**Q3 — Hot-swap / live component registry patterns.**
Runtime-swappable component registries: external-store + `useSyncExternalStore` (our approach) vs module-federation / `import()` dynamic + HMR; data-driven (backend manifest → frontend registration) per capability/provider slug; precedence resolution. Validate against our `UIComponentRegistry` design and the prior `capability-ui-patterns-brief.md`.

**Q4 — Canvas ↔ UI-slot integration & "living manifest".**
How a canvas layer's bound regions (`LayerBinding.regionId/role/selector`) map to hot-swappable UI slots; how an oracle/living manifest stays consistent as layers spawn/dismiss; event-bus driven re-resolution. Patterns from micro-frontend / component-registry / design-system "slot" models.

---

## 3. Research Execution Plan (Step 3 — to be run after plan approval)

Per `devops-research` skill workflow. **MCP availability note:** `opencode.json` currently configures **only the Playwright MCP** — no `firecrawl`, `exa`, or `web-search-prime` MCP is present. Per the skill's fallback rule, research will use the **`web-search-prime` tool** (Z.AI MCP, available in this session) and/or the `websearch` tool as primary web sources; if both unavailable, fall back to local-knowledge with `confidence: Low` flagged.

For each Q (target 15–30 unique sources total, prioritize official docs > reputable blog > academic):
1. 2–3 keyword variations per sub-question.
2. Deep-read 3–5 key sources.
3. Cross-reference (single source = flag unverified).

**Convergence loop (iterative deep-dive, max 6 iters):** Because Q1 (the viewport) is a complex integration with conflicting approaches, run the convergence loop to reach a **confirmed workable code path** for the infinite-canvas viewport (react-flow transform model vs tldraw vs custom CSS-transform) and emit `docs/research/code-paths/infinite-canvas-viewport-path.md`.

### Outputs to produce
- `docs/research/reports/infinite-canvas-hot-swap-sota-2026.md` (full report, 384+ lines)
- `docs/research/briefs/infinite-canvas-hot-swap-brief.md` (gate currency for implementation units)
- `docs/research/evidence/infinite-canvas-hot-swap/{sources.json,notes.md}`
- `docs/research/code-paths/infinite-canvas-viewport-path.md` (confirmed viewport approach) + `-trace.md`
- Wire into devops: update `docs/research/INDEX.md`, `FRESHNESS.md`, `CROSS-REF.md`.

---

## 4. Proposed Implementation Units (post-research, for tracker)

| Unit | Delivers | Gap addressed |
|------|----------|----------------|
| C1 | Browser `InfiniteCanvasViewport` (pan/zoom/semantic-zoom, virtualization) | Gap 1 |
| C2 | Browser `LayerHost` impl mounting `CanvasDefinition` into viewport via `LayerMounter` | Gap 1 |
| C3 | Real seed-layer HTML/CSS (replace stubs) + `detailZoom` culling | Gap 2 |
| C4 | Backend `ResolvedCapability.uiSlots` + contract populate (H5/H6) | Gap 3 |
| C5 | Frontend data-driven seeding of `UIComponentRegistry` from `uiSlots` (H6) | Gap 3 |
| C6 | `chat.streaming` / `chat.result` slot ← `StreamParserEngine` blocks (H10) | Gap 3 |
| C7 | Canvas↔UI-slot bridge: layer region binds to slot override | Gap 4 |
| C8 | Living-manifest consistency via `CapabilityEventBus` re-resolution | Gap 4 |

---

## 5. Open Questions for User (before/at execution)

1. **Scope of this pass:** Research-only (reports + briefs, gate-ready), or also implement C1–C8 afterward? *Recommend: research this pass; implementation follows as CREATE units gated by the brief (invariant A5).*
2. **Viewport tech:** Greenfield custom CSS-transform viewport vs adopt an existing lib (react-flow / tldraw / excalidraw core)? *Research will converge; flag if a lib is allowed vs must-be-from-scratch (bundle/security constraints).*
3. **Is the `vivim-canvas` browser surface a new top-level route (e.g. `/canvas`) or does it replace/augment the existing `ChatPage` hot-swap surface?** This decides whether C2 mounts into the chat shell or a new canvas app.
4. **MCP gap:** web research will rely on `web-search-prime`/`websearch` (firecrawl/exa not configured). OK, or should those be added to `opencode.json` first for higher-confidence SOTA?
