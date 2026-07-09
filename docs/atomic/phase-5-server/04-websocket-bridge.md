# Unit 5.4: WebSocket ↔ EventBus bridge integration

**Phase:** 5 | **File:** `src/server/websocket.ts` (extends unit 5.3)
**Depends:** 3.7 CapabilityEventBus, 5.1 Server entry | **Produces:** WebSocket server that forwards EventBus events to subscribed clients
**Source:** `07-merged-api.md` §C WebSocket Protocol, `04-merged-engines.md` §Engine 7 Publisher Table

## Purpose

Extends the WebSocket server (unit 5.3) with the EventBus forwarding bridge. When a WebSocket client sends `{ type: "subscribe", entityType, entityId }`, the bridge calls `eventBus.subscribe(ws, entityType, entityId)`. When events are emitted on the bus, the bridge serializes them and sends them to matching subscribed WebSocket clients.

## Protocol (from 07-merged-api.md §C)
```
Client → Server: { type: "subscribe", entityType: "conversation", entityId: "<convId>" }
Client → Server: { type: "subscribe", entityType: "fleet", entityId: "*" }
Client → Server: { type: "unsubscribe", entityType: "conversation", entityId: "<convId>" }
Server → Client: { type: "<event_type>", ...eventPayload }
```

## Bridge Logic
```typescript
// In websocket.ts handler:
ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === 'subscribe') {
    eventBus.subscribe(ws, msg.entityType, msg.entityId);
  } else if (msg.type === 'unsubscribe') {
    eventBus.unsubscribe(ws, msg.entityType, msg.entityId);
  }
});

// On ws.close:
ws.on('close', () => {
  eventBus.unsubscribeAll(ws);
});
```

## EventBus → WS forwarding (inside CapabilityEventBus)
```typescript
// When emit() fires an event:
// 1. Check wsSubscriptions for matching entityType + entityId
// 2. For each matching ws: ws.send(JSON.stringify(event))
// 3. entityId: "*" is a wildcard that matches all entities of that type
```

## Tests
- [ ] Subscribe message registers the WebSocket with the EventBus
- [ ] Unsubscribe removes the registration
- [ ] WebSocket close calls `unsubscribeAll`
- [ ] When EventBus emits `conversation:complete`, subscribed WS receives JSON
- [ ] Wildcard `entityId: "*"` receives all events of that entityType
- [ ] Unsubscribed WS does not receive events
- [ ] Malformed subscribe message does not crash the server

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `CapabilityEventBus` + mock WebSocket
- No memory leak: close cleans up all subscriptions
