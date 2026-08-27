# Architecture — API & Surface Map

> HTTP routes, WebSocket, and the unified surface model.

---

## Surfaces

Vivim exposes the same capabilities through **five surfaces**:

| Surface | Transport | Entry Point | Purpose |
|---------|-----------|-------------|---------|
| **CLI** | In-process | `src/cli/index.ts` | Developer tooling, scripting |
| **HTTP API** | REST | `src/server/index.ts` | Backend API (port 9420) |
| **WebSocket** | WS | `src/server/websocket.ts` | Real-time streaming |
| **MCP** | stdio/HTTP | `src/mcp/` | Model Context Protocol |
| **UI** | React | `frontend/src/` | Browser interface (port 3000) |

**One entry point rule:** Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that call `POST /api/interpret` → `POST /api/capabilities/:id/execute`.

---

## HTTP API (Port 9420)

### Core Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check |
| `GET` | `/readyz` | Readiness probe |
| `GET` | `/api/openapi.json` | OpenAPI schema |
| `POST` | `/api/interpret` | Natural language → resolved capability |
| `POST` | `/api/capabilities/:id/execute` | Execute a capability |
| `GET` | `/api/capabilities` | List capabilities (filterable by `?surface=`) |

### Conversation Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/conversations` | List conversations |
| `POST` | `/api/conversations` | Create conversation |
| `GET` | `/api/conversations/:id` | Get conversation |
| `POST` | `/api/conversations/:id/send` | Send message (blocks until provider responds) |
| `GET` | `/api/conversations/:id/messages` | List messages |
| `GET` | `/api/conversations/:id/stream` | SSE stream of response blocks |

### Provider Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/providers` | List registered providers |
| `GET` | `/api/providers/:slug` | Get provider details |
| `GET` | `/api/providers/:slug/health` | Provider health status |

### Node Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/nodes` | Query nodes |
| `POST` | `/api/nodes` | Create node |
| `GET` | `/api/nodes/:id` | Get node |
| `GET` | `/api/nodes/:id/history` | Version history |
| `GET` | `/api/nodes/:id/edges` | Node edges |

### Admin Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/db/status` | Database status |
| `POST` | `/api/admin/db/backup` | Trigger backup |
| `GET` | `/api/admin/telemetry` | Telemetry summary |

---

## WebSocket (Port 9420/ws)

Real-time event stream for:

- **Streaming blocks** — Response chunks as they arrive from providers
- **Capability events** — Capability resolution and execution lifecycle
- **Health updates** — Provider health changes
- **Chrome events** — Browser process lifecycle

### Protocol

```json
{
  "type": "stream_block",
  "conversationId": "...",
  "block": {
    "type": "text",
    "text": "Hello",
    "parserName": "claude-streaming-sse",
    "confidence": 0.98
  }
}
```

---

## Frontend (Port 3000)

Next.js 16 app that proxies `/api/*` to the backend on `:9420`.

### Key Pages

| Path | Purpose |
|------|---------|
| `/` | Main chat interface |
| `/canvas` | Canvas live-config |
| `/api/*` | Proxied to backend |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `⌘K` | Command Palette |
| `Ctrl+`` ` `` | Dev Console toggle |
| `Ctrl+Tab` | Cycle surface tabs |

---

## Capability Resolution Flow

```
1. User sends NL input ("send message to claude")
2. POST /api/interpret → CapabilityResolutionEngine
3. Returns: { capabilityId: "cap:chat:send_message", confidence: 0.95, provider: "claude" }
4. POST /api/capabilities/cap:chat:send_message/execute
5. CapabilityEngine routes to ChromeGovernor
6. ChromeGovernor executes via CDP
7. StreamParserEngine parses response
8. Response streamed via WebSocket
```

---

## CORS & Proxy

The Next.js frontend proxies API calls to the backend:

```javascript
// next.config.mjs
rewrites: async () => [
  { source: '/api/:path*', destination: 'http://localhost:9420/api/:path*' },
  { source: '/ws', destination: 'http://localhost:9420/ws' },
]
```

---

See [OVERVIEW.md](OVERVIEW.md) for the high-level mental model.
