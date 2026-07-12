# Phase 3: HTML Canvas System

**Status:** PROPOSED
**Units:** 13
**Depends on:** Phase 2
**Produces:** The five-engine canvas subsystem that makes "frontends as HTML canvases" real. **This is the core user objective of v3.**

---

## Goal

After Phase 3, an agent can create, populate, modify, and destroy HTML frontends on demand. The user sees these frontends in their workspace and interacts with them naturally; every interaction is observed by the agent and every agent action is reflected in the canvas. The canvas system is the **primary UX paradigm** of v3: frontends are data (declarative specs in DB), not code (compiled React components).

A canvas is defined by:
1. An HTML template (with `data-cap-bind` attributes on elements).
2. A CSS stylesheet.
3. Optional JS (runs sandboxed in the canvas iframe).
4. A binding spec mapping capability outputs → element state and element events → capability inputs.

Canvases render in sandboxed iframes inside the workspace. The agent operates on them via the Governor (CDP) exactly as it operates on third-party provider websites — but with lower friction because the canvas runtime exposes a structured event channel.

---

## Units

### 3.1 CanvasDefinition model + CanvasRegistry engine
**Source:** v3 Overview §1.6
**Depends on:** —
**Produces:** `canvas_definition` table; `CanvasRegistry.{define, get, list, update, delete}`.

CanvasDefinition fields: `id, name, description, htmlTemplate (text), cssTemplate (text), jsTemplate (text|null), bindingSpecJson, requiredCapabilities[], version, isActive, createdBy ('agent'|'user'|'system'), createdAt, updatedAt`.

### 3.2 Built-in canvas templates
**Source:** v3 Overview §1.6
**Depends on:** 3.1
**Produces:** 8 system-defined canvases seeded at startup.

Templates: `chat-pane` (conversation viewer), `model-selector`, `markdown-viewer`, `form-generic`, `dashboard-grid`, `code-block`, `image-gallery`, `data-table`. Each is ~50 lines of HTML+CSS with `data-cap-bind` hooks. Seeded under `seeds/canvases/*.html` (separate files for readability).

### 3.3 CanvasInstance model + CanvasSpawner engine
**Source:** v3 Overview §1.6
**Depends on:** 3.1
**Produces:** `canvas_instance` table; `CanvasSpawner.{spawn, destroy, list, get}`.

Spawning: (1) load CanvasDefinition, (2) allocate a unique canvasId, (3) allocate a Chromium tab via Governor (or a sandboxed iframe in the workspace frontend), (4) write the instance row, (5) emit `canvas:spawned` event. Destruction: kill the tab, delete the row, emit `canvas:destroyed`.

### 3.4 CanvasBinder — declarative data flow
**Source:** v3 Overview §1.6
**Depends on:** 3.3
**Produces:** `CanvasBinder.bind(instanceId, bindingSpec)` + reactive update loop.

Binding spec maps: `{outputs: [{capabilityOutputKey, selector, attribute}], inputs: [{selector, event, capabilityInputKey}]}`. On capability output, binder queries the canvas DOM and updates the named attribute. On DOM event, binder emits `canvas:action` with the input key.

### 3.5 CanvasMirror — agent → canvas sync
**Source:** v3 Overview §1.6
**Depends on:** 3.3
**Produces:** `CanvasMirror.applyMutation(canvasId, mutation)`.

Agent sends structured DOM mutations (`{op: 'setAttribute'|'insertHTML'|'remove'|'setText', selector, value}`); mirror applies them via CDP `Runtime.evaluate` with structured clone (not string interpolation — safe against injection). Confirms via re-query that the mutation took.

### 3.6 CanvasMirror — canvas → agent sync
**Source:** v3 Overview §1.6
**Depends on:** 3.5
**Produces:** Event listener in canvas runtime that emits `canvas:event` over WebSocket.

Canvas JS runtime subscribes to `data-cap-emit` elements; on user interaction, emits `{canvasId, elementType, selector, eventType, value}`. Server fans out to subscribed agents and records in `canvas_event` table (truncated to 7 days).

### 3.7 CanvasDiscovery — agent reads canvas state
**Source:** v3 Overview §1.6
**Depends on:** 3.3
**Produces:** `CanvasDiscovery.{snapshot, extractForm, listInteractive, screenshot}`.

`snapshot(canvasId)` returns full DOM as JSON tree. `extractForm(canvasId, selector)` returns form field values. `listInteractive(canvasId)` returns all elements with `data-cap-bind` or standard interactive roles. `screenshot(canvasId)` returns PNG.

### 3.8 CanvasDiscovery — agent writes canvas state
**Source:** v3 Overview §1.6
**Depends on:** 3.7
**Produces:** `CanvasDiscovery.{fillForm, click, type, scroll}`.

High-level operations analogous to `SlaveWrite` but for canvases. `fillForm(canvasId, data)` walks the form and sets each field by name. Used when the agent needs to drive a canvas it didn't author (e.g., populating a third-party provider's search form).

### 3.9 Canvas runtime JS (in-iframe)
**Source:** v3 Overview §1.6
**Depends on:** 3.6
**Produces:** `web/canvas-runtime/index.js` injected into every canvas iframe.

Runtime: ~200 lines of vanilla JS. Responsibilities: (a) establish `postMessage` channel with parent workspace, (b) on `canvas:mutate` messages, apply DOM mutations, (c) on user events on `[data-cap-emit]` elements, send `canvas:event` messages, (d) expose `canvas.dispatch(actionId, params)` for in-canvas capability invocation.

### 3.10 Canvas HTTP router (`/api/canvas/*`)
**Source:** v3 Overview §3
**Depends on:** 3.1, 3.3, 3.4, 3.5, 3.7
**Produces:** REST endpoints for canvas CRUD + spawn/destroy + query.

Endpoints: `GET /api/canvas/definitions`, `POST /api/canvas/definitions`, `POST /api/canvas/spawn`, `DELETE /api/canvas/instance/:id`, `GET /api/canvas/instance/:id/snapshot`, `POST /api/canvas/instance/:id/mutate`, `POST /api/canvas/instance/:id/discover`.

### 3.11 Canvas WebSocket protocol v2
**Source:** v3 Overview §3
**Depends on:** 3.6
**Produces:** Typed WS frames for canvas events.

Frames: `canvas:spawned`, `canvas:destroyed`, `canvas:event` (user interaction), `canvas:mutated` (agent applied mutation), `canvas:action` (dispatched capability), `canvas:state` (periodic snapshot). Workspace frontend subscribes to `canvasId`-filtered streams.

### 3.12 Canvas security model
**Source:** v3 Overview §1.9
**Depends on:** 3.9, 2.13
**Produces:** Per-canvas capability tokens; CSP rules; iframe sandbox.

Each canvas instance gets a `capabilityToken` listing allowed capability slugs. Canvas runtime includes token in every `canvas:action`; server validates before dispatching. CSP: `default-src 'none', script-src 'self'`. Iframe sandbox: `allow-scripts` only (no same-origin).

### 3.13 Canvas agent tools (MCP + UnifiedCapabilityRegistry)
**Source:** v3 Overview §1.6
**Depends on:** 3.3, 3.4, 3.5, 3.7
**Produces:** Canvas operations registered as capabilities + MCP tools.

Capabilities: `canvas_spawn`, `canvas_destroy`, `canvas_mutate`, `canvas_observe`, `canvas_fill_form`, `canvas_define`, `canvas_list`. Auto-exported to MCP so external agents (Claude Code, etc.) can drive canvases.

---

## Acceptance

- Agent can spawn a `chat-pane` canvas, bind it to a provider's `send_message` capability, and the user can chat through it.
- Agent can `canvas_observe` a canvas it didn't create, extract a form's values, and submit it.
- `canvas_mutate` operations are confirmed by re-query (no silent failures).
- CSP blocks any `<script>` tag injection in canvas HTML templates.
- Canvas events flow end-to-end in <50ms p95.
