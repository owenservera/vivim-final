# WebSocket Contract

URL: `ws://localhost:9420/ws` (this env `:9421`).

## Client → Server messages
| Type | Fields | Purpose |
|------|--------|---------|
| `subscribe` | `{ topic }` | Subscribe to a topic |
| `ping` | — | Keepalive (server replies `pong`) |

### Topics
- `conversation:<id>` — live message blocks for a conversation
- `config:changed` — backend config changed
- `kernel:oracle` — kernel oracle events
- `canvas` — canvas-wide events
- capability events via `agent:subscribe`

## Server → Client events (forwarded from event bus)
| Event | Fields | Maps to Moment |
|-------|--------|----------------|
| `conversation:block` | `{ conversationId, block }` | Moment 2 (streaming chunk) |
| `conversation:complete` | `{ conversationId }` | Moment 2 (done) |
| `conversation:error` | `{ conversationId, error }` | Moment 2 (error) |

## Reconnection
On drop → show "Reconnecting..." → exponential backoff → reopen → "Connected".
Target: reconnect within 5s (SC-004).
