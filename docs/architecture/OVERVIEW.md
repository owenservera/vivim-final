# Architecture — System Overview (zoom-out)

> The 30-second mental model of vivim-final. Read this before anything else.
> Each layer's detail lives in `ENGINES.md` (zoom-in) and the archived design
> docs are superseded by this set.

## What it is

A **local-first AI conversation platform** that drives real browser Chrome
sessions (via CDP) to send/persist messages on 6 provider surfaces (chatgpt,
claude, gemini, deepseek, qwen, grok) and exposes the results through a pure
capability API. Everything a user touches — CLI, frontend, API, MCP — routes
through **one capability entry point**.

## The one-liner architecture

```
  you (CLI / frontend / MCP)  →  /api/interpret (NL → capability)
                                    │
                                    ▼
                    UnifiedCapabilityRegistry
                                    │  execute(capabilityId)
                                    ▼
              ChromeGovernor ─── CDP ───▶ real browser (provider chat UI)
                    │              │
                    ▼              ▼
              StreamParserEngine  ConversationManager
              (parse wire stream) (persist messages/nodes)
                    │              │
                    ▼              ▼
                  CapStore (Prisma, SQLite)   Provider profiles (chrome-profiles/)
```

## Layers

### 1. Capability layer (one entry point)
- **`UnifiedCapabilityRegistry`** — every operation is a `UnifiedCapability`.
  CLI and frontend are thin NL shells that call
  `POST /api/interpret` → `POST /api/capabilities/:id/execute`. **No second
  transport.** New capability = register + bind NL pattern in `catalog.ts`.

### 2. Provider layer (Chrome-automation)
- **`ChromeGovernor`** is the *only* module that touches CDP (invariant:
  "Governor Canon"). Spawns/manages logged-in Chrome slaves under
  `chrome-profiles/<provider>/<account>/`.
- **`ConversationManager`** captures messages from provider UI, applies
  provider-specific capture patterns, and auto-captures every message as a Node.

### 3. Parser layer (DB-driven)
- **`StreamParserEngine`** loads parser `logic_code` **only from the DB**
  (inline, `SandboxRunner`), with a fallback chain
  `provider/001 → generic/001 → system/001`. Parsers are seeds in
  `seeds/parsers/harvested/*.ts`, never hand-written in engine code.

### 4. State & persistence layer
- **Storage** split into contracts (`src/storage/contracts/*.ts`) vs impls
  (`src/storage/impl/*.ts`). Engines depend on contracts only.
- **Prisma** — 196 models schematized in `prisma/schema.prisma` (SQLite by
  default). A **universal Node store** holds all node types with `parentId`
  forking + `NodeVersion`/`NodeAlias`/`NodeEdge` for time-travel + graph.

### 5. Bootstrap / server
- `src/server/index.ts` → `createServerWithEngines` → `bootstrap-engines.ts`
  wires config → engines → capabilities → routes. Auth via a fail-open-by-default
  gate (acceptable for localhost alpha; tracked as future hardening).

## Cross-cutting systems

- **Reliability**: retry-engine, request-queue, idempotency-guard, lock-manager,
  fleet-supervisor (Chrome limit), watchdog, SLA monitor, resilience-pipeline.
- **Observability**: pino logger, telemetry-aggregator (aggregation+retention),
  kernel-tracer, metrics-registry, OTEL export.
- **Desktop**: Tauri shell (`src-tauri/`) with Bun-compiled sidecar; UPX-compressed
  binary (~45.6MB level-3); NSIS installer. Desktop loop toolkit in `devops/`.
- **Node layer v2**: every message/memory becomes a typed Node
  (`cap-store.*`), graph rebuildable from edges (`rebuildGraphFromNodes`).

## Key runtime facts

- **Port**: backend default `9420` (`CAP_STORE_PORT`); resolves via
  `.runtime/backend.port` (Windows zombie-socket fallback). Frontend: `3000`.
- **Entry points**: `src/cli/index.ts` (serve/thin client), `src/index.ts`
  (public barrel).
- **Language**: TypeScript ESM (`.js` import suffix), Bun runtime, strict.
- **Invariants** (non-negotiable): only `ChromeGovernor` touches CDP; engines
  depend on storage contracts not impls; parsers DB-only; one capability entry
  point; Chrome-slave profile dir is source of truth for auth.

## See also

- `ENGINES.md` — every engine, its job, its code path.
- `DATA.md` — the persistence model + migrations.
- `API.md` — the surface map (routes, entry points, event stream).
- `FRONTEND.md` — the UI consuming this.
- `runbooks/DEV.md` — how to run it.