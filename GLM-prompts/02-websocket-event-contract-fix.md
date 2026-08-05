# GLM Prompt: WebSocket Event Contract Alignment

## Objective
Fix all mismatches between backend WebSocket event emissions and frontend event handling to ensure real-time updates work correctly.

## Critical Issues Found

### 1. Event Type Divergence

**Backend** (`src/server/websocket.ts`) emits events like:
```typescript
{
  type: 'capability:executed',
  capabilityId: string,
  latencyMs: number,
  traceId: string,
}
```

**Frontend** (`frontend/src/shared/unified-io.ts:63-80`) expects:
```typescript
interface IOEvent {
  type: 'request:start' | 'request:success' | 'request:error' | 'sse:open' | 'sse:event' | 'sse:close' | 'sse:error'
  traceId: string
  method?: IOMethod
  url?: string
  status?: number
  durationMs?: number
  error?: string
  data?: unknown
  timestamp: number
}
```

**Issue**: Backend emits domain events, frontend expects IO events. Different event schemas.

**Fix**: Create a unified event type that covers both IO and domain events.

---

### 2. Stream Block Events

**Backend** emits:
```typescript
{
  type: 'stream:block',
  conversationId: string,
  messageId: string,
  blockIndex: number,
  blockKind: string,
  blockData: string,
  blockMeta: string,
}
```

**Frontend** components expect different shapes depending on the component:
- `MessageBlock.tsx` expects `blockData` as parsed JSON
- `DevConsole.tsx` expects raw string
- `StreamingIndicator.tsx` expects `blockKind` to determine UI

**Issue**: No consistent type for stream block events.

**Fix**: Create `StreamBlockEvent` type and validate at reception.

---

### 3. Capability Progress Events

**Backend** (`src/server/conversation-router.ts:90-97`):
```typescript
ctx.eventBus.emit({
  type: 'capability:progress',
  step: 0,
  total: 1,
  description: `Dispatched ${slug}`,
  moduleId: capability.id,
  slaveId: conversationId,
})
```

**Frontend** doesn't have a handler for `capability:progress` events.

**Issue**: Backend emits progress events that frontend ignores.

**Fix**: Add progress event handler in frontend for loading states.

---

### 4. WebSocket Connection Lifecycle

**Backend** (`src/server/websocket.ts`):
- Sends `{ type: 'connected', clientId: string }` on connection
- Sends `{ type: 'pong' }` in response to ping

**Frontend** expects:
- `{ type: 'welcome', version: string }` on connection
- `{ type: 'error', message: string }` on errors

**Issue**: Different connection lifecycle events.

**Fix**: Align connection events or add adapter layer.

---

## Implementation Plan

### Phase 1: Create Shared Event Types (Priority: HIGH)

1. Create `frontend/src/types/shared/ws-events.ts`
2. Define all event types with discriminated unions
3. Import in both backend and frontend

### Phase 2: Fix Stream Block Events (Priority: HIGH)

1. Define `StreamBlockEvent` interface
2. Add validation in WebSocket handler
3. Update frontend components to use shared type

### Phase 3: Fix Capability Events (Priority: MEDIUM)

1. Define `CapabilityEvent` union type
2. Add progress event handler in frontend
3. Update loading states to use progress events

### Phase 4: Fix Connection Lifecycle (Priority: MEDIUM)

1. Align connection events or add adapter
2. Update frontend connection handler
3. Add reconnection logic based on events

### Phase 5: Add Event Validation (Priority: LOW)

1. Add Zod schemas for all events
2. Validate events at emission point
3. Log invalid events for debugging

---

## Files to Modify

### Backend
- `src/server/websocket.ts` - Use shared event types
- `src/engines/capability-event-bus.ts` - Use shared event types

### Frontend
- `frontend/src/types/shared/ws-events.ts` - NEW: Shared event types
- `frontend/src/shared/unified-io.ts` - Update IOEvent type
- `frontend/src/components/canvas/DevConsole.tsx` - Update event handling
- `frontend/src/components/chat/MessageBlock.tsx` - Update stream block handling
- `frontend/src/components/canvas/StreamingIndicator.tsx` - Add progress handling

---

## Validation Checklist

- [ ] All WebSocket events have consistent types
- [ ] Frontend handles all backend event types
- [ ] Stream blocks parse correctly
- [ ] Progress events update UI state
- [ ] Connection lifecycle events work
- [ ] Invalid events are logged and ignored
