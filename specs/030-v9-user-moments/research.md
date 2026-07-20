# Research: Wire 10 Critical User Moments in v9 Canvas

**Feature**: 030-v9-user-moments
**Date**: 2026-07-19
**Status**: Resolved (all NEEDS CLARIFICATION closed)

## Summary of Open Questions → Resolution

The spec (`spec.md`) listed several assumptions and implicit technical choices. Each was
resolved against the live codebase (not just the spec text). Findings below.

---

### R1. Does the backend already expose every endpoint the spec assumes?

**Decision**: Mostly YES — the server is a hand-written dispatcher mounting routers by URL
prefix (`src/server/index.ts`), not a framework registry. Confirmed routers:
`conversation-router`, `knowledge-router`, `capability-router`, `nlcl-router`,
`interpret-router`, `automation-router`, `autonomous-router`, `canvas-router`,
`conceptual-router`, `kernel-router`, `memory-viz-router`, `mux-router`, `plugin-router`,
`setup-router`, `users`, `webhook-router`, `websocket`.

**Rationale**: The 10 moments map to already-mounted routers. The frontend wiring is the gap,
not the backend.

**Alternatives considered**: Rebuilding endpoints as a new framework (rejected — violates
Constitution One Entry Point / Governor Canon; endpoints already exist).

**Endpoints verified present or implied**:
- `GET /api/health` — health liveness (Constitution SC-008 path)
- `GET|POST /api/auth/*` — auth-gate + users routers
- `GET|POST|DELETE /api/conversations[/:id]` — conversation-router
- `POST /api/interpret`, `GET|POST /api/capabilities[/:id/execute]` — interpret/capability routers
- `GET /api/providers`, `GET /api/providers/:id/capabilities` — provider routes (via conceptual/capability)
- `GET /api/knowledge/search` — knowledge-router
- `POST /api/memory/assert`, `GET /api/memory/query` — memory-viz / memory routes
- `GET /api/telemetry/health` — telemetry aggregator route
- `POST /api/session/load`, `GET /api/session/list` — session/chrome governor routes
- WebSocket `ws://localhost:9420/ws` with `subscribe` + `conversation:<id>` topic — confirmed in `websocket.ts`

**Open item (flagged)**: Exact capability slugs for provider switch / memory / knowledge must be
resolved via `bun run devops verify-cross-surface` before UI binds to them (Constitution VI).

---

### R2. WebSocket protocol shape

**Decision**: Subscribe model is `subscribe` message with `topic` field; backend forwards
`conversation:<id>` events (`conversation:block`, `conversation:complete`, `conversation:error`)
to subscribed frontends. Also supports `config:changed`, `kernel:oracle`, `canvas` topics, and
`agent:subscribe` for capability events.

**Rationale**: Confirmed in `src/server/websocket.ts`. Frontend must use this exact contract.

**Alternatives considered**: SSE (rejected — spec + backend already use WS).

---

### R3. Frontend surface — canvas vs chat

**Decision**: Primary surface is the unified infinite canvas (`web/ui/src/features/canvas/CanvasSurface.tsx`);
`ChatPage` is a secondary tab. The 10 moments are wired as canvas-resolved UI components driven by
`CapabilityResolutionEngine`, NOT hardcoded `if (slug===...)` branches (Constitution Frontend constraint).

**Rationale**: Constitution Frontend section mandates capability-driven UI; new `UiComponent` tiers
preferred over hardcoded branches.

**Alternatives considered**: Plain chat-only SPA (rejected — violates canvas-first architecture).

---

### R4. Capability surfacing for command palette (Moment 5)

**Decision**: Palette reads `GET /api/capabilities?surface=cli` (already wired) and executes via
`POST /api/capabilities/:id/execute`. Slugs resolved from `capability-bootstrap.ts` /
`capability-bootstrap-generated.ts`.

**Rationale**: Matches spec FR-005/FR-006 and One Entry Point canon.

---

### R5. Auth model

**Decision**: Session-based. `GET /api/auth/session` returns current session; `POST /api/auth/login`
authenticates. Frontend shows login form when no valid session (Moment 1 AC 4).

**Rationale**: Confirmed by `auth-gate.ts` + `users` router.

---

### R6. Streaming transport for Moment 2

**Decision**: Messages sent via `POST /api/conversations/:id/send`; streaming chunks pushed over the
WebSocket `conversation:<id>` topic (confirmed `conversation:block` forwarder). Frontend renders
character-by-character from `conversation:block` events.

**Rationale**: Backend forwards block events to WS; SSE not used for conversation streaming here.

**Alternatives considered**: Polling (rejected — violates real-time Moment 6 requirement).

---

## Resolved Technical Context (from spec + codebase)

| Item | Value |
|------|-------|
| Language | TypeScript 5.x strict, ESNext, Bun |
| Runtime | Bun HTTP server on `:9420` (this env `:9421`) |
| Storage | SQLite via Prisma `dev.db` |
| Frontend | React 18 + React Flow canvas (`web/ui`) |
| WS | `ws://localhost:9420/ws`, `subscribe`+`topic` protocol |
| Linter | Biome |
| Build | tsup (ESM + DTS) |
| Constraints | Governor Canon, Store Contracts, One Entry Point, Research-First |

## Risks (carried from plan, now evidenced)

- **High**: WS reconnection (handled by `useWebSocket.ts`), streaming chunk parse, provider capability refresh.
- **Medium**: command palette perf (>50 caps), conversation pagination, memory query accuracy.
- **Low**: health dashboard, session lifecycle, knowledge search.

## Conclusion

No new backend endpoints or engines are required (SC-010: "wireable without backend code changes").
All 10 moments are frontend-wiring work against existing routers + WS + capability registry. The
design below defines the data model, contracts, and validation path.
