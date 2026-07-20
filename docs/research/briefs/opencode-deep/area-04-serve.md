# Area 4 — Serve HTTP API & Auth

**Verified against:** opencode v1.17.15 (serve).
**Evidence:** `evidence/opencode-deep/04-serve-openapi.json` (full OpenAPI 3.1, 478KB), `evidence/opencode-deep/04-serve-probe*.log`, backend logs from T5.

## Launch
```
$env:OPENCODE_SERVER_PASSWORD='<pw>'
$env:OPENCODE_SERVER_USERNAME='opencode'   # optional, default 'opencode'
opencode serve --port <p> --hostname 127.0.0.1 --print-logs
```
- **ALWAYS** bind `127.0.0.1` + set `OPENCODE_SERVER_PASSWORD`. Never use `--mdns`/`--cors` (expose 0.0.0.0).
- `--attach`/longer wait needed; bare 5s GET races startup.

## Auth
- Basic auth enforced. `GET /api/health` without auth → **401**. With auth → **200** `{healthy:true}`.
- Credentials from `OPENCODE_SERVER_USERNAME` (default `opencode`) + `OPENCODE_SERVER_PASSWORD`.

## Key endpoints (from OpenAPI + probes)
| Method | Path | Result |
|--------|------|--------|
| GET | `/api/health` | 200 `{healthy:true}` (auth required) |
| GET | `/doc` | OpenAPI 3.1 JSON (478KB) |
| GET | `/api/event` | `text/event-stream`, emits `data: {type:"server.connected",...}` |
| GET | `/api/session/:id/event` | `text/event-stream` (live session events) |
| POST | `/session` | 200, returns `{id, slug, projectID, ...}` — **field is `id`, NOT `sessionID`** |
| GET | `/api/session/:id` | session detail + messages (use this to read results post-run) |
| POST | `/api/session/:id/message` | requires `{parts:[{type:"text",text:"..."}]}` → 400 if `parts` missing |
| POST | `/api/session/:id/prompt_async` | accepts prompt, returns **204** when model resolves |

## CRITICAL finding for v2 backend
- `serve` **inherits the repo `opencode.json`**. With `default_agent: build` → `anthropic/claude-sonnet-4-20250514` (unauthenticated), any prompt returns **HTTP 500 `ProviderModelNotFoundError`**.
- A v2 backend using `serve` MUST run from a **scratch directory** with its own `opencode.json` setting `model: opencode/<free>` + `permission: allow` (Area 10), OR pass `-m`/override per-request if the API supports it.
- SSE live-event capture in probes delivered 0 events (likely the `prompt_async` runner emits to a session event bus that a late-connecting SSE consumer misses, or events completed within the cold-start gap). **Reliable result capture = `GET /api/session/:id` after `prompt_async` returns 204**, not live SSE.

## OpenAPI
Full spec at `evidence/opencode-deep/04-serve-openapi.json` (~200 endpoints). The v2 backend should code against `/session` POST, `/api/session/:id/message`, `/prompt_async`, and `/api/session/:id` GET.
