# Architecture — API & Surface Map

> The routes, entry points, and event stream that expose vivim-final. Keep
> current when you add/remove a route or entry point.

## One entry point (invariant)

Every operation is a `UnifiedCapability`. Consumers are thin shells:

```
POST /api/interpret            NL text → resolved capabilityId (+ params)
GET  /api/capabilities[?surface]  list caps (cli|ui|api|mcp|all)
POST /api/capabilities/:id/execute  run a capability
```

CLI, frontend, MCP, and the OpenAPI spec all derive from the same registry —
never a hand-written parallel transport. New capability = register + bind NL
pattern in `catalog.ts`; it appears on every surface automatically.

## HTTP surface

Backend: default `http://localhost:9420` (`CAP_STORE_PORT`; resolved via
`.runtime/backend.port` for the zombie-socket Windows fallback).
`/api/openapi.json` + Swagger UI served (no auth — machine-readable contract).

### Router map (`src/server/*-router.ts` → `src/server/routes/*`)

| Namespace | Purpose |
|-----------|---------|
| `/api/capabilities`, `/api/interpret` | capability core (one entry point) |
| `/api/conversations`, `/api/conversation-sync` | conversation CRUD + capture |
| `/api/chrome`, `/api/fleet` | ChromeGovernor / profile operations |
| `/api/providers`, `/api/mux` | provider manifests + routing |
| `/api/setup` | first-run: profile restore/workspace/launch (auth-deferred) |
| `/api/nodes`, `/api/memory`, `/api/knowledge`, `/api/conceptual` | graph / memory / knowledge surfaces |
| `/api/canvas` (+ `/ws`) | canvas surface over WebSocket |
| `/api/kernel` | kernel oracle (planner/oracle integration) |
| `/api/generative`, `/api/automation`, `/api/autonomous`, `/api/agent` | autonomy engines |
| `/api/plugin[-builder]`, `/api/template`, `/api/variant` | plugin/template system |
| `/api/mutation`, `/api/storage`, `/api/version`, `/api/webhook`, `/api/update` | system ops |
| `/api/llm-harness`, `/api/surface`, `/api/nlcl`, `/db` | harness / surface / NL tooling |
| `routes/` | raw sub-handlers (knowledge, media, content, containers, contacts, notifications, sync, tunnel, update, users) |

**Auth**: an `auth-gate` middleware mounts before most routes; **fail-open by
default** (no `CAP_STORE_AUTH_TOKEN` → all allowed) — acceptable for a
localhost-bound alpha, tracked as future hardening. `/api/health`, `/openapi`,
Swagger, `/api/setup/*` are intentionally unauthenticated.

## WebSocket

- **`ws://localhost:9420/ws`** — event stream the frontend consumes: stream blocks,
  capability execute events, NL results, latency. Frontend RAF-batches to 60fps.

## Interfaces for the "external" world

- **CLI**: `src/cli/index.ts` — thin client to a running server (default port
  9420). Bridged capabilities + builtins (`automate`, `moments`).
- **MCP**: `llm_test_*` tools + semantics; MCP servers configured externally
  (e.g. Playwright for E2E).
- **SDK / shared**: `shared/` holds cross-cutting TS types (`api-types.ts`,
  `ui-slots.ts`, `stream-blocks.ts`, `canvas-types.ts`, `ui-component.ts`,
  `conceptual-model.ts`) shared between backend, frontend, and tools.

## Tauri desktop

- `src-tauri/` shell loads `frontend` static export (`out/`) + a Bun-compiled
  sidecar (`vivim-server`) via a supervisor. Window shows on `backend-ready`.
- Build: `scripts/tauri/build.ps1` (sidecar + static export + NSIS);
  `devops/desktop-loop` drives build→install→launch→test with hash-gated rebuilds.

## Changing the surface

Add/remove/modify a route → update this table **and** regenerate OpenAPI
(`bun run docs:openapi`) in the same PR. Cross-surface parity is verified by
`bun run devops verify-cross-surface`.