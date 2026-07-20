# Quickstart Validation Guide: Wire 10 Critical User Moments

**Feature**: 030-v9-user-moments
**Date**: 2026-07-19

Runnable validation scenarios that prove each moment works end-to-end. Implementation
detail belongs in `tasks.md`; this is a validation/run guide. Prerequisites, commands,
expected outcomes only.

## Prerequisites
- Backend running: `pwsh scripts/start-backend.ps1` (serves `:9420`; this env `:9421`).
- Frontend running: `pwsh scripts/start-frontend.ps1` (serves `:3000`).
- DB seeded: `bun run db:setup`.
- Authenticated session (or use `POST /api/auth/login`).
- Port numbers: read `.runtime/backend.port` and `.runtime/frontend.port`.

## Validation Scenarios (mapped to spec Acceptance Criteria)

### Moment 1 — First Contact
- **Given** app open, **When** backend reachable, **Then** "Connected" green indicator.
- **Command**: open `http://localhost:3000` → expect status badge "Connected" < 2s.
- **API proof**: `GET /api/health` → `{status:"ok"}`; `GET /api/auth/session`.

### Moment 2 — Send Message (streaming)
- **Given** composer, **When** Enter/Send, **Then** message appears + `conversation:block` WS events stream character-by-character.
- **API proof**: `POST /api/conversations/:id/send` then watch WS `conversation:<id>` topic.
- **NL proof**: `POST /api/interpret {nl:"send message to gemini"}` → execute resolved cap.

### Moment 3 — Conversation List
- **Given** app load, **When** conversations exist, **Then** sidebar lists titles < 500ms.
- **API proof**: `GET /api/conversations`; create `POST /api/conversations`; delete `DELETE /api/conversations/:id`.

### Moment 4 — Switch Provider
- **Given** on chatgpt, **When** select claude, **Then** capabilities refresh < 1s.
- **API proof**: `GET /api/providers`; `GET /api/providers/:id/capabilities`.

### Moment 5 — Command Palette
- **Given** Cmd+K, **When** palette opens, **Then** fuzzy search over `GET /api/capabilities?surface=cli` < 100ms.
- **Execute**: select cap → `POST /api/capabilities/:id/execute`.

### Moment 6 — Real-time Events
- **Given** WS connected, **When** new block arrives, **Then** UI updates live.
- **Proof**: kill backend WS → "Reconnecting..." → restore → "Connected" within 5s (SC-004).
- **Topic**: `subscribe {topic:"conversation:<id>"}` (see `contracts/websocket.md`).

### Moment 7 — Knowledge Search
- **Given** query, **When** execute, **Then** results with source titles < 1s.
- **API proof**: `GET /api/knowledge/search?q=<query>`.

### Moment 8 — Memory Management
- **Given** "Remember: ...", **When** assert, **Then** stored; query returns it < 500ms.
- **API proof**: `POST /api/memory/assert`; `GET /api/memory/query?q=<query>`.

### Moment 9 — Provider Health
- **Given** health dashboard open, **When** providers online/offline, **Then** badges + latency shown; refreshes every 30s.
- **API proof**: `GET /api/telemetry/health`.

### Moment 10 — Session Lifecycle
- **Given** "Load Session", **When** provider selected, **Then** loading → active, composer enabled; "End Session" deactivates.
- **API proof**: `POST /api/session/load`; `GET /api/session/list`; `DELETE /api/session/:id`.

## Cross-Surface Verification (Constitution VI)
After wiring, run:
```
bun run devops verify-cross-surface
```
Expect: every capability resolves across CLI / API / MCP / UI.

## Gate Checklist
- [ ] P0 (Moments 1,2,3) wireable + validated
- [ ] P1 (Moments 4,5,6) wireable + validated
- [ ] P2 (Moments 7,8,9,10) wireable + validated
- [ ] `bun run devops verify-cross-surface` passes (0 unresolved)
- [ ] `bun run lint` 0 warnings, `bun test` passes
