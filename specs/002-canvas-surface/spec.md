# Feature Specification: Canvas Surface Gap Closure

**Feature Branch**: `002-canvas-surface`
**Created**: 2025-07-17
**Status**: Ready
**Input**: Close 5 canvas core gaps + 5 advanced features for the unified infinite React Flow canvas
**Source**: `docs/workstreams/AGENT-2-CANVAS-SURFACE.md`
**Source Audit**: `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md`

## User Scenarios & Testing

### User Story 1 — Capability Bridge Roundtrip (Priority: P1)

A sandboxed iframe layer on the canvas can call capabilities via postMessage → WebSocket → CapabilityEventBus → executed → response returned. Currently `SandboxBridge` exists in backend but the roundtrip isn't fully wired.

**Why this priority**: Without the bridge, sandboxed layers are isolated and cannot interact with the system. This is the critical path.

**Independent Test**: Send `bridge:capability:request` from sandboxed context → receive `bridge:capability:response` with result.

**Acceptance Scenarios**:
1. **Given** a sandboxed iframe, **When** `postMessage({ type: 'bridge:capability:request', ... })` is sent, **Then** the capability executes and response is returned
2. **Given** an unknown capability ID, **When** bridge request is sent, **Then** response has `ok: false, error: 'capability not found'`
3. **Given** a capability that takes >30s, **When** bridge request is sent, **Then** response returns with timeout error

### User Story 2 — Canvas Mutations Forwarder + Layer Spawn/Dismiss (Priority: P1)

`canvas:mutated` events are emitted by the backend when layers change, and the frontend reacts to `canvas:layer:spawned`/`dismissed` events to add/remove React Flow nodes. Currently only spawn/dismiss events are forwarded; mutations and frontend reactions are incomplete.

**Why this priority**: Enables real-time multi-client canvas synchronization and dynamic layer management.

**Independent Test**: Move a layer via API → `canvas:mutated` event emitted → frontend node moves. Spawn a layer → node appears on canvas. Dismiss → node removed.

**Acceptance Scenarios**:
1. **Given** `canvas:mutated` event emitted, **When** WebSocket forwarder picks it up, **Then** frontend node position/size updates
2. **Given** `POST /api/canvas/layers`, **When** spawn succeeds, **Then** `canvas:layer:spawned` emitted and frontend adds node
3. **Given** `DELETE /api/canvas/layers/:id`, **When** dismiss succeeds, **Then** `canvas:layer:dismissed` emitted and frontend removes node

### User Story 3 — Canvas Designer Tool + Manifest API (Priority: P2)

Frontend designer panel for creating/editing canvas layer definitions (HTML, CSS, scriptUrl, bindings), plus a manifest API endpoint for external tool consumption.

**Why this priority**: Enables users to create custom canvas layers without code. Manifest API enables agent tooling integration.

**Independent Test**: Create a new definition → appears in list. Edit HTML → preview updates. `GET /api/canvas/manifest` → returns valid manifest with definitions and oracle data.

**Acceptance Scenarios**:
1. **Given** the designer panel, **When** user creates a new definition with HTML/CSS/bindings, **Then** it appears in the definitions list
2. **Given** the manifest endpoint, **When** `GET /api/canvas/manifest` is called, **Then** response includes `definitions[]` and `oracle` object
3. **Given** a published definition, **When** user clicks Publish, **Then** definition status changes to 'published'

### User Story 4 — Canvas Persistence & Multi-Client Sync (Priority: P2)

Canvas mirror persists layer positions across page reloads and server restarts. Mutation events cascade to all connected clients via WebSocket.

**Why this priority**: Without persistence, user layout is lost on refresh. Without cascade, canvas is single-user only.

**Independent Test**: Drag a node → refresh page → node at saved position. Move a node in tab 1 → tab 2 sees the move within 200ms.

**Acceptance Scenarios**:
1. **Given** a dragged node, **When** page reloads, **Then** node position is restored from mirror
2. **Given** two browser tabs, **When** node moves in tab 1, **Then** tab 2 updates position within 200ms
3. **Given** server restart, **When** client reconnects, **Then** saved positions persist (DB-backed mirror)

### User Story 5 — Semantic Zoom & Export/Import (Priority: P3)

Semantic zoom thresholds show different detail levels. Canvas definitions can be exported/imported as `.vivim-layer.json` files.

**Why this priority**: Polish features that complete the canvas UX and enable sharing.

**Independent Test**: Zoom out → nodes collapse to dots. Export a definition → JSON file downloaded. Import that file → definition recreated.

**Acceptance Scenarios**:
1. **Given** zoom level <0.2, **When** user zooms out, **Then** nodes render as colored dots with hover labels
2. **Given** zoom level >0.5, **When** user zooms in, **Then** nodes expand to full detail
3. **Given** an exported definition file, **When** imported, **Then** definition recreated with same slug, HTML, CSS, bindings

## Requirements

### Functional Requirements

- **FR-001**: SandboxBridge MUST route capability requests from iframe → backend → response
- **FR-002**: `canvas:mutated` events MUST be forwarded to subscribed WebSocket clients
- **FR-003**: Frontend MUST react to `canvas:layer:spawned` by creating React Flow nodes
- **FR-004**: Frontend MUST react to `canvas:layer:dismissed` by removing React Flow nodes
- **FR-005**: Designer tool MUST support CRUD operations on canvas definitions
- **FR-006**: `GET /api/canvas/manifest` MUST return definitions array + oracle data
- **FR-007**: Canvas mirror MUST persist layer positions across page reloads
- **FR-008**: Mutation events MUST cascade to all connected clients
- **FR-009**: Semantic zoom MUST collapse/expand nodes at defined thresholds
- **FR-010**: Export/import MUST produce valid `.vivim-layer.json` files

### Key Entities

- **CanvasDefinition**: slug, HTML template, CSS, scriptUrl, bindings[], status (draft/published)
- **CanvasLayerInstance**: instanceId, definitionId, layout {x,y,z,w,h}, state
- **CanvasMirrorSnapshot**: instanceId → {x,y,z,w,h} position map
- **ManifestEntry**: definition metadata for agent consumption

## Success Criteria

### Measurable Outcomes

- **SC-001**: Bridge roundtrip latency < 1s for capability execute+response
- **SC-002**: Node position persists across page reload
- **SC-003**: Multi-client position sync within 200ms
- **SC-004**: Manifest endpoint returns valid JSON with all definitions
- **SC-005**: Imported definitions match exported content byte-for-byte

## Assumptions

- Canvas WebSocket already connects at `/ws`
- `bun run devops runtime-test verify` can verify canvas UI
- `InMemoryCanvasMirrorStore` exists for initial implementation
- Debounced saves (200ms) are acceptable for drag persistence

## File Conflict Notes

No shared files with other agents. Canvas files are exclusive to Agent 2.
