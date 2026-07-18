# Server & API

## Server Entry (src/server/index.ts)
Bun.serve REST API + WebSocket server:
- REST: `http://localhost:3000/api/*`
- WS: `ws://localhost:3000/ws` (EventBus integration)

## REST Endpoints

| Method | Path | Handler |
|--------|------|---------|
| GET | /api/conversations | ConversationService.list() |
| POST | /api/conversations | ConversationService.create() |
| GET | /api/conversations/:id | ConversationService.get() |
| GET | /api/conversations/:id/messages | MessageService.list() |
| POST | /api/conversations/:id/messages | MessageService.create() |
| GET | /api/capabilities | CapabilityService.list() |
| POST | /api/capabilities/:id/execute | CapabilityService.execute() |
| POST | /api/interpret | NLCLEngine.interpret() → execute() |

## WebSocket Events
- `conversation:created`
- `conversation:updated`
- `message:added`
- `capability:executing`
- `capability:completed`
- `capability:error`

## Auth Gate (src/server/auth-gate.ts)
- Bearer token validation
- 401 for missing/invalid tokens
- 403 for insufficient permissions

## SDK Client (sdk/src/client.ts)
Typed client for external consumption:
```typescript
import { VivimClient } from '@/sdk'

const client = new VivimClient({ baseUrl: 'http://localhost:3000' })
await client.conversations.list()
await client.capabilities.execute('cap:claude:chat', { prompt: '...' })
```