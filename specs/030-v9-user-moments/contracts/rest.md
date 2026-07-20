# REST Contracts

Base URL: `http://localhost:9420` (this env `:9421`). All responses are JSON.
Auth: session cookie from `POST /api/auth/login`; `GET /api/auth/session` returns current session.

## Moment 1 — First Contact (liveness + auth)
| Method | Path | Purpose | Success |
|--------|------|---------|---------|
| GET | `/api/health` | Liveness | `{ status: "ok" }` 200 |
| GET | `/api/auth/session` | Current session | `{ user: {email,name} }` or 401 |
| POST | `/api/auth/login` | Authenticate | `{ user }` 200 |

## Moment 2 — Send Message (streaming)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/conversations/:id/send` | Send message; streams via WS `conversation:<id>` |
| POST | `/api/interpret` | NL → capability resolution (body `{ nl }`) |

## Moment 3 — Conversation List
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/conversations` | List conversations (sidebar) |
| POST | `/api/conversations` | Create (body `{ title?, providerId? }`) |
| GET | `/api/conversations/:id/messages` | History |
| DELETE | `/api/conversations/:id` | Delete |

## Moment 4 — Switch Provider
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/providers` | List providers |
| GET | `/api/providers/:id/capabilities` | Resolved capabilities for provider |

## Moment 5 — Command Palette
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/capabilities?surface=cli` | CLI-surface capabilities |
| POST | `/api/capabilities/:id/execute` | Execute (body = inputSchema) |

## Moment 7 — Knowledge Search
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/knowledge/search?q=<query>` | Search across conversations |

## Moment 8 — Memory Management
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/memory/assert` | Assert fact (body `{ content }`) |
| GET | `/api/memory/query?q=<query>` | Query memory |

## Moment 9 — Provider Health
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/telemetry/health` | Fleet health (per-provider status/latency) |

## Moment 10 — Session Lifecycle
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/session/load` | Load session (body `{ providerId }`) |
| GET | `/api/session/list` | List sessions |
| DELETE | `/api/session/:id` | End session |

> Slugs for provider switch / memory / knowledge capabilities MUST be confirmed via
> `bun run devops verify-cross-surface` before UI binds (Constitution VI).
