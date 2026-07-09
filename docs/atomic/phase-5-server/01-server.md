# Unit 5.1-5.5: Server — Bun.serve, Response, WebSocket, Router, Auth

**Phase:** 5 | **Files:** `src/server/` (5 files)
**Depends:** Phase 3 (Governor + ConversationManager), Phase 4 (all engines) | **Produces:** REST API + WebSocket server
**Source:** `07-merged-api.md`, `02-merged-architecture.md`

## 5.1: Server Entry (`src/server/index.ts`)
```typescript
// Bun.serve on port 9420
// Mounts: ConversationRouter, WebSocket handler, AuthGate
// Boot sequence:
//   1. openDb()
//   2. Create CapabilityEventBus (singleton)
//   3. Create ConfigManager
//   4. Create all engines (dependency order)
//   5. Start TelemetryAggregator
//   6. Start ProviderHealthKernel
//   7. ChromeGovernor.boot()
//   8. Bun.serve({ port: 9420, fetch, websocket })
```

## 5.2: Response Helpers (`src/server/response.ts`)
```typescript
// CORS middleware
// JSON response helper: json(data, status?)
// Error response helper: error(message, code, status?, details?)
// Error envelope: { error: string, code: string, details?: unknown }
```

## 5.3: WebSocket Bridge (`src/server/websocket.ts`)
```typescript
// WS subscription model:
//   Client → Server: { type: "subscribe", entityType: "conversation", entityId: "<id>" }
//   Client → Server: { type: "unsubscribe", entityType: "conversation", entityId: "<id>" }
//
// Server → Client events (forwarded from CapabilityEventBus):
//   conversation:complete, conversation:error, conversation:created
//   fleet:slave_status, fleet:crash_detected, fleet:circuit_changed
//   capability:progress (during HarnessDAG execution)
//   provider:health_changed, config:changed
```

## 5.4: ConversationRouter (`src/server/conversation-router.ts`)
30+ REST endpoints (all JSON, all authenticated except /health):

```typescript
// Health
GET    /health
// Providers
GET    /api/providers
GET    /api/providers/:id
GET    /api/providers/:id/health
GET    /api/providers/:id/accounts
GET    /api/providers/:id/accounts/:accountId
POST   /api/providers/:id/accounts          { email }
DELETE /api/providers/:id/accounts/:accountId
POST   /api/providers/:id/accounts/:accountId/default
GET    /api/providers/:id/capabilities       ?planTier=
POST   /api/providers/:id/capabilities/search { query, planTier? }
// Fleet
GET    /api/fleet/status
POST   /api/fleet/start                      { providerId, accountId }
POST   /api/fleet/stop                       { providerId, accountId }
// Conversations
GET    /api/conversations                    ?providerId=&limit=&offset=
POST   /api/conversations                    { providerId, title? }
GET    /api/conversations/:id
PATCH  /api/conversations/:id                { title?, state? }
DELETE /api/conversations/:id
POST   /api/conversations/:id/send           { message }
GET    /api/conversations/:id/messages       ?limit=&before=
GET    /api/conversations/:id/capabilities   ?planTier=
GET    /api/conversations/:id/blocks         ?messageId=&blockKind=&limit=&offset=
// Admin
POST   /api/admin/seed                       ?source=
POST   /api/admin/wipe
GET    /api/admin/audit/:providerId          ?limit=&since=
GET    /api/admin/drift                      ?providerId=
// Config
GET    /api/config/:engineId                 ?scopeType=&scopeId=
PUT    /api/config/:engineId                 { config, scopeType?, scopeId? }
GET    /api/config/:engineId/history         ?limit=
// Telemetry
GET    /api/telemetry/health/:providerId     ?days=
GET    /api/telemetry/summary/:providerId    ?from=&to=
GET    /api/telemetry/compare               ?from=&to=
// Versioning
GET    /api/bindings/:id/promotion-history
POST   /api/bindings/:id/compare-versions
POST   /api/capabilities/:id/rollback        { version }
GET    /api/capabilities/:id/versions        ?limit=
```

## 5.5: Auth Gate (`src/server/auth-gate.ts`)
```typescript
// Bearer token validation
// If AUTH_TOKEN env var set → require matching Bearer token
// If no AUTH_TOKEN → allow all (dev mode)
// Returns 401 { error: "Authentication required", code: "AuthRequired" }
```

## Error Mapping
| Engine Error | HTTP | Code |
|-------------|------|------|
| ValidationError | 400 | ValidationError |
| NotFoundError | 404 | NotFoundError |
| ConflictError / SlaveBusyError | 409 | ConflictError |
| CdpTimeoutError | 504 | GatewayTimeout |
| SlaveNotRunningError / CircuitOpenError | 503 | ServiceUnavailable / CircuitOpenError |
| CdpConnectionError | 502 | BadGateway |
| Any other Error | 500 | InternalError |

## Tests
- [ ] GET /health returns { status: "ok", version: "0.1.0" }
- [ ] GET /api/providers returns provider list
- [ ] POST /api/conversations/:id/send returns SendResult
- [ ] Auth gate returns 401 for missing/invalid token
- [ ] WebSocket subscription receives conversation:complete events
- [ ] All endpoints return correct JSON error envelope on failure

## Gate
- `bunx tsc --noEmit` passes
- All API integration tests pass
- Server boots on port 9420
