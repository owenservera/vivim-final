# Audit Fix Task List — Backend-to-Frontend Wiring Alignment

> Generated from AUDIT-REPORT.md findings  
> Last updated: 2026-08-06  
> Total tasks: 38 across 6 priority tiers

---

## P0 — Broken Functionality (WebSocket Streaming)

### Task P0-1: Fix WebSocket Event Envelope Mismatch
**Area**: WS | **Files**: Multiple
**Problem**: Frontend wraps WS messages with `{ type, payload? }` but backend sends flat events.
**Actions**:
- [ ] Read `frontend/src/shared/unified-io.ts` for WsMessage type
- [ ] Read all frontend consumers that access `msg.payload.*`
- [ ] Decision: Either (a) wrap backend events in `{ type, payload }` in websocket.ts, or (b) change frontend to access top-level fields
- [ ] Apply chosen fix to all conversation event handlers (Composer, ChatSurface, agent-bridge)
- [ ] Test: Send a message in a conversation and verify streaming blocks appear

### Task P0-2: Fix WebSocket Subscribe Protocol
**Area**: WS | **Files**: `frontend/src/components/canvas/UnifiedEntry.tsx` (or wherever `useWebSocket` lives)
**Problem**: Frontend sends `{ type: "subscribe", topic }` but backend expects `{ type: "subscribe", entityType, entityId }`.
**Actions**:
- [ ] Find the frontend subscribe implementation
- [ ] Change to send `{ type: "agent:subscribe", topic }` (which works per websocket.ts:209)
- [ ] Verify conversation topics are subscribed correctly
- [ ] Test: Subscribe to a conversation and verify events arrive

### Task P0-3: Bridge StreamingProtocol → EventBus
**Area**: WS | **Files**: `src/engines/streaming-protocol.ts`, `src/server/websocket.ts`, `src/engines/conversation-manager.ts`
**Problem**: StreamingProtocol has a private `emit()` that never reaches CapabilityEventBus. WebSocket forwarder listens on EventBus for `conversation:block` but receives nothing.
**Actions**:
- [ ] Read StreamingProtocol's emit() method
- [ ] Add an `onEvent` callback to StreamingProtocol that bridges to CapabilityEventBus
- [ ] In `conversation-manager.ts`, register this bridge when creating a StreamingProtocol
- [ ] Verify `conversation:block` events now flow through EventBus to WebSocket forwarder
- [ ] Test: Verify streaming blocks appear in real-time

### Task P0-4: Bridge EventBus → SSE Canvas Stream
**Area**: WS | **Files**: `src/server/canvas-router.ts`, canvas event forwarders
**Problem**: Canvas SSE stream only sends `connected` + keepalive. No EventBus→SSE bridge.
**Actions**:
- [ ] Read `canvas-router.ts` SSE handler
- [ ] Add EventBus listeners for `canvas:layer:spawned`, `canvas:layer:dismissed`, `canvas:def:updated`, `canvas:mutated`
- [ ] Forward these events into the SSE stream with proper SSE formatting
- [ ] Test: Verify canvas hot-reload events arrive via SSE

---

## P1 — Data Integrity (Error Handling + Type Safety)

### Task P1-1: Add `code` Property to IOError
**Area**: Error | **Files**: `frontend/src/shared/unified-io.ts`, `frontend/src/components/canvas/UnifiedIOProvider.tsx`
**Problem**: IOError has no `code` field; code is attached via unsafe type assertion.
**Actions**:
- [ ] Add `code?: ErrorCode` as a constructor parameter to IOError class
- [ ] Set `this.code = code` in constructor
- [ ] Remove the type assertion hack in UnifiedIOProvider.tsx
- [ ] Test: Verify error code is accessible on IOError instances

### Task P1-2: Consolidate Frontend Error Types
**Area**: Error | **Files**: `frontend/src/types/shared/errors.ts`, `frontend/src/types/shared/api-contract.ts`, `frontend/src/types/api.ts`
**Problem**: 3 conflicting error response type definitions. `ApiErrorResponse` in api-contract.ts has fields backend never sends (`ok`, `traceId`, `latencyMs`).
**Actions**:
- [ ] Delete `ApiErrorResponse` from `api-contract.ts` (the one extending ApiResponse)
- [ ] Delete `ErrorResponse` from `api-contract.ts`
- [ ] Keep only `ApiErrorResponse` from `errors.ts` as the canonical type
- [ ] Update `types/api.ts` to re-export from `errors.ts`
- [ ] Test: Verify no duplicate type errors

### Task P1-3: Wire ErrorClassifier to Backend Error Code
**Area**: Error | **Files**: `frontend/src/lib/errorClassifier.ts`, `frontend/src/shared/unified-io.ts`
**Problem**: errorClassifier pattern-matches on `error.message` strings instead of using the backend `code` field.
**Actions**:
- [ ] Read full errorClassifier.ts
- [ ] Add error code parameter to classifyError() method
- [ ] Use the ErrorCode→category mapping instead of string patterns
- [ ] Update all callers that create IOError to pass the code
- [ ] Wire up UnifiedIOProvider to pass the code through classifyError
- [ ] Test: Verify `AuthError` code maps to 'auth' category

### Task P1-4: Tighten errorResponse() Signature
**Area**: Error | **Files**: `src/server/response.ts`, `src/server/errors.ts`
**Problem**: `code` parameter is `string` — allows any non-canonical code silently.
**Actions**:
- [ ] Change `errorResponse(message: string, code: string, ...)` to `errorResponse(message: string, code: ErrorCode, ...)`
- [ ] Add missing codes to ErrorCode: `MethodNotAllowed`, `ServiceUnavailable`, `Locked`, `NotSupported`
- [ ] This will cause compile errors for all non-canonical codes — fix them:
  - `VALIDATION_ERROR` → `ValidationError` (18 files)
  - `NOT_FOUND` → `NotFound` (10 files)
  - `INTERNAL_ERROR` → `InternalError` (5 files)
  - `SURFACE_NOT_FOUND` → `NotFound` (2 files)
  - `EngineUnavailable` → `NotAvailable` (8 files)
  - `ServiceUnavailable` → `NotAvailable` (4 files)
  - `BadRequest` → `ValidationError` (3 files)
  - All domain-specific codes → `InternalError` or `ExecutionError`
- [ ] Test: `bun run typecheck` passes

### Task P1-5: Fix Backend Routers Bypassing errorResponse()
**Area**: Error | **Files**: `src/server/kernel-router.ts`, `src/server/webhook-router.ts`, `src/server/autonomous-router.ts`, `src/server/memory-viz-router.ts`, `src/server/index.ts`
**Problem**: 4 routers construct raw Response without `code` field. index.ts has inconsistent error shapes.
**Actions**:
- [ ] kernel-router.ts: Replace all `new Response(JSON.stringify({ error }))` with `errorResponse()`
- [ ] webhook-router.ts: Replace raw Response with `json()`/`errorResponse()`
- [ ] autonomous-router.ts: Replace local `error()` helper with `errorResponse()`
- [ ] memory-viz-router.ts: Replace custom `respond()` helper with `errorResponse()`
- [ ] index.ts opencode routes: Replace `json({ error })` with `errorResponse()`
- [ ] Test: Verify all error responses include `code` field

### Task P1-6: Adopt AppError Pattern in All Routers
**Area**: Error | **Files**: All 35 routers that don't use `appErrorResponse`
**Problem**: Only 2 of 37 routers use the canonical `appErrorResponse()`. Others do manual error extraction.
**Actions**:
- [ ] For each router with a catch block: replace `err instanceof Error ? err.message : String(err)` with `return appErrorResponse(err)`
- [ ] For each router: throw AppError instead of calling errorResponse directly in try/catch
- [ ] Let the top-level router handler (or the try/catch) call appErrorResponse once
- [ ] Test: Verify consistent error handling

### Task P1-7: Migrate api/client.ts to useIO()
**Area**: API | **Files**: `frontend/src/api/client.ts`, `frontend/src/components/canvas/CapabilityCatalog.tsx`
**Problem**: `capabilityApi` uses raw `fetch()` bypassing UnifiedIO — no retry, no auth, no traceId.
**Actions**:
- [ ] Convert `capabilityApi` methods to use `io.get()` / `io.post()`
- [ ] Add `responseSchema` for runtime validation
- [ ] Update CapabilityCatalog.tsx to use the updated API (or have it use `use-capability` hook instead)
- [ ] Delete the raw `request()` function in client.ts
- [ ] Test: Verify auth tokens and trace IDs appear in requests

### Task P1-8: Fix UnifiedIO Retry Scope
**Area**: Error | **Files**: `frontend/src/components/canvas/UnifiedIOProvider.tsx`
**Problem**: Retries ALL errors including 400/404/403 — wasteful and semantically wrong.
**Actions**:
- [ ] Add retry condition: only retry if status is in `{ 408, 429, 500, 502, 503, 504 }`
- [ ] Also retry on AbortError with `isAbort` check (already present)
- [ ] Keep exponential backoff behavior
- [ ] Test: Verify 400 errors don't retry, 503 errors do retry

---

## P2 — Robustness (Validation + Coverage)

### Task P2-1: Add Zod Response Schemas for All SDK Hooks
**Area**: Validation | **Files**: `frontend/src/api/schemas.ts`, all `frontend/src/sdk/web/use-*.ts` files
**Problem**: Only 4 of 106 typed API calls use `responseSchema`. 102 are unchecked at runtime.
**Actions**:
- [ ] Create Zod schemas for: use-mutation.ts (7 calls), use-variant.ts (6 calls), use-conversation-sync.ts (4 calls), use-session.ts (3 calls), use-interpret.ts (1 call)
- [ ] Create schemas for common component calls (use-provider, use-health, etc.)
- [ ] Wire `responseSchema` into each `io.get<T>()` / `io.post<T>()` call
- [ ] Test: Send malformed responses and verify Zod catches them

### Task P2-2: Type use-provider.ts
**Area**: API | **Files**: `frontend/src/sdk/web/use-provider.ts`
**Problem**: Uses `io.get<unknown>` — effectively untyped.
**Actions**:
- [ ] Define a proper ProviderListResponse type
- [ ] Replace `io.get<unknown>` with `io.get<ProviderListResponse>`
- [ ] Add responseSchema for runtime validation
- [ ] Handle both array and wrapped response shapes
- [ ] Test: Verify providers load with proper typing

### Task P2-3: Clean Up Dead Error Utility Code
**Area**: Error | **Files**: `frontend/src/types/shared/errors.ts`, `frontend/src/types/shared/api-contract.ts`, `frontend/src/types/api.ts`
**Problem**: `getUserMessage()`, `isRetryable()`, `ERROR_MESSAGES`, duplicate types are dead code.
**Actions**:
- [ ] Delete `getUserMessage()`, `isRetryable()`, `ERROR_MESSAGES` from `errors.ts`
- [ ] Delete duplicate `ApiErrorResponse` and `ErrorResponse` from `api-contract.ts`
- [ ] Update `types/api.ts` re-exports
- [ ] Wire up the living `getUserMessage()` pattern (using backend codes) in errorClassifier or SDK hooks
- [ ] Test: Verify no import errors

### Task P2-4: Migrate Raw fetch Violations to useIO()
**Area**: API | **Files**: `frontend/src/features/guided-landing.tsx:1178`
**Problem**: `GET /api/setup/profiles` uses raw `fetch()`.
**Actions**:
- [ ] Import and use `useIO()` or `useSession()` hook
- [ ] Remove direct fetch call
- [ ] Test: Verify auth token and trace ID are present

### Task P2-5: Emit canvas:node Events or Remove Dead Forwarder
**Area**: WS | **Files**: `src/server/websocket.ts`, canvas engine
**Problem**: `registerNodeEventForwarder` is wired but no backend code emits `canvas:node`.
**Actions**:
- [ ] Decision: Either (a) find appropriate place to emit `canvas:node` events, or (b) remove the dead forwarder
- [ ] If keeping: emit from canvas engine when node state changes
- [ ] If removing: delete `registerNodeEventForwarder` and remove forwarder registration
- [ ] Test: Verify no errors from removed code

### Task P2-6: Add hello:ack Response
**Area**: WS | **Files**: `src/server/websocket.ts`
**Problem**: Frontend defines `WsConnectedEvent { type: 'hello:ack', sessionId }` but backend never sends it.
**Actions**:
- [ ] In websocket.ts `message()` handler, when receiving `type: 'hello'`, send back `{ type: 'hello:ack', sessionId: msg.sessionId, timestamp: Date.now() }`
- [ ] Test: Verify frontend receives ack after WS connection

### Task P2-7: Add Capability Event UI Handlers
**Area**: WS | **Files**: Frontend components (DevConsole.tsx, TaskManager.tsx)
**Problem**: `capability:failed` and `capability:progress` have types but no UI handlers.
**Actions**:
- [ ] Add `capability:failed` handler in DevConsole — show error with recovery behavior info
- [ ] Add `capability:progress` handler in TaskManager — show progress bar or spinner
- [ ] Import type guards from ws-events.ts for runtime safety
- [ ] Test: Trigger a failing capability and verify error UI appears

### Task P2-8: Add config:changed Handler
**Area**: WS | **Files**: Frontend LiveConfigProvider
**Problem**: `config:changed` events have a forwarder but no frontend handler.
**Actions**:
- [ ] Subscribe to `config:changed` topic via WebSocket
- [ ] When received, trigger a state refresh in LiveConfigProvider
- [ ] Test: Change a config and verify frontend refreshes

---

## P3 — Cleanup & Consolidation

### Task P3-1: Consolidate NotFound vs NotFoundError
**Area**: Error | **Files**: `src/server/errors.ts`, `frontend/src/types/shared/errors.ts`, all routers
**Problem**: Two codes for the same semantic meaning.
**Actions**:
- [ ] Merge `NotFoundError` into `NotFound` in ErrorCode
- [ ] Update all routers using `NotFoundError` to use `NotFound`
- [ ] Update frontend ERROR_MESSAGES (remove NotFoundError entry)
- [ ] Test: Verify 404 errors still work

### Task P3-2: Remove Dead WebSocket Types
**Area**: WS | **Files**: `src/schema/api-types.ts`, `frontend/src/types/shared/ws-events.ts`
**Problem**: `hello:ack`, `pong`, `stream:block`, `canvas:node`, `conversation:created` are defined but never emitted.
**Actions**:
- [ ] Remove `WsHelloAckEvent` and `WsPongEvent` from api-types.ts
- [ ] Remove `WsStreamBlockEvent` from api-types.ts (backend never uses stream:block)
- [ ] Remove `conversation:created` from CapabilityEventBus union
- [ ] Remove corresponding frontend type definitions and type guards
- [ ] Or: Keep types but add `@deprecated` JSDoc
- [ ] Test: Verify no type errors

### Task P3-3: Standardize List Endpoint Response Wrapping
**Area**: API | **Files**: `src/server/conversation-router.ts`, `src/server/knowledge-router.ts`, `src/server/node-router.ts`, `src/server/routes/*.ts`
**Problem**: Some list endpoints return raw arrays, some return `{ items, count }`, some return `{ data, total }`. Inconsistent.
**Actions**:
- [ ] Decision: Choose standard list response format: `{ items: T[], total: number }` or `{ data: T[], total: number }`
- [ ] Apply chosen format to all list endpoints:
  - `GET /api/conversations` (raw array)
  - `GET /api/providers` (raw array)
  - `GET /api/conversations/:id/messages` (raw array)
  - `GET /api/nodes` (wrapped — already has `{ nodes, total }`)
  - `GET /api/knowledge/search` (raw array)
  - All routes/*.ts list endpoints (wrapped with `{ items/contacts/etc, count }`)
- [ ] Update frontend SDK hooks to match new format
- [ ] Test: Verify all list endpoints return consistent shape

### Task P3-4: Resolve Duplicate Routes
**Area**: API | **Files**: `src/server/memory-viz-router.ts`, `src/server/knowledge-router.ts`, `src/server/routes/knowledge.ts`
**Problem**: `GET /api/memory/export` exists in both memory-router and memory-viz-router. Knowledge entities/topics exist in both knowledge-router and routes/knowledge.
**Actions**:
- [ ] Delete duplicate `GET /api/memory/export` and `POST /api/memory/import` from one file
- [ ] Decide canonical knowledge store (Prisma vs MemoryIntelligenceStore) and remove duplicate
- [ ] Test: Verify routes still work

### Task P3-5: Consolidate Duplicate Event Bus Union Members
**Area**: WS | **Files**: `src/engines/capability-event-bus.ts`
**Problem**: 10 event types in the CapabilityEvent union are never emitted (dead types).
**Actions**:
- [ ] Audit: Verify these types are truly never emitted with comprehensive grep
- [ ] Remove confirmed dead types: `capability:confidence_changed`, `capability:selector_drifted`, `capability:status_changed`, `account:*`, `fleet:slave_status`, `fleet:crash_detected`, `fleet:circuit_changed`, `conversation:created`, `provider:seeded`, `intent:clarify`
- [ ] Add `// @deprecated` to types that might be used in future
- [ ] Test: Verify event bus still works

### Task P3-6: Emit `conversation:created` Event
**Area**: WS | **Files**: `src/engines/conversation-manager.ts`
**Problem**: `conversation:created` is in the union but never emitted.
**Actions**:
- [ ] Find where conversations are created (createConversation calls)
- [ ] Emit `{ type: 'conversation:created', conversationId, providerId, accountId }` after creation
- [ ] Verify WebSocket forwarder delivers it to subscribed clients
- [ ] Test: Create a conversation and verify event appears

### Task P3-7: Fix Response Shape for In-Process Routes
**Area**: API | **Files**: Multiple `frontend/src/app/api/*/route.ts`
**Problem**: 62 in-process routes have no standardized response format. Some return `{ ok: true, ... }`, some return raw data, some return `{ item: ... }`.
**Actions**:
- [ ] Audit all 62 in-process routes for response format
- [ ] Choose standard: all should return `{ ok: boolean, data?: T, error?: string }`
- [ ] Apply standard format
- [ ] Test: Verify consistent responses from all routes

### Task P3-8: Add responseSchema to api/client.ts Calls
**Area**: Validation | **Files**: `frontend/src/api/client.ts`
**Problem**: Even if we keep `api/client.ts`, its calls have no Zod validation.
**Actions**:
- [ ] Import schemas from `@/api/schemas`
- [ ] Add `responseSchema` parameter to the request function
- [ ] Pass it through to UnifiedIO when migrating (P1-7), or validate manually if keeping raw fetch
- [ ] Test: Verify validation catches malformed responses

### Task P3-9: Audit and Fix Duplicate Frontend Type Consumers
**Area**: API | **Files**: `frontend/src/sdk/web/use-conversation.ts`, `frontend/src/components/canvas/UnifiedEntry.tsx`
**Problem**: `GET /api/conversations` consumed by both with different response types (`ConversationRow[]` vs `{ id: string }`).
**Actions**:
- [ ] Audit all routes consumed by multiple frontend locations
- [ ] Standardize response type expectations
- [ ] Update consumers to use canonical types
- [ ] Test: Verify no type mismatches

### Task P3-10: Fix Frontend Dispatch-Behavior Error Handling
**Area**: Error | **Files**: `frontend/src/shared/dispatch-behavior.ts`
**Problem**: 7 API calls with inline `{ ok?, error? }` types — no backend error code usage.
**Actions**:
- [ ] Import `getUserMessage` (after P2-3 reactivates it)
- [ ] Use backend error code for user-friendly messages
- [ ] Add proper error classification
- [ ] Test: Verify errors from /api/interpret show user-friendly messages

---

## Execution Priority

| Week | Focus | Tasks |
|------|-------|-------|
| Week 1 | **P0**: Fix broken WebSocket streaming | P0-1 through P0-4 |
| Week 2 | **P1**: Error handling + type safety | P1-1 through P1-8 |
| Week 3 | **P2**: Validation + coverage | P2-1 through P2-8 |
| Week 4 | **P3**: Cleanup + consolidation | P3-1 through P3-10 |

**Total effort estimate**: 4 weeks, 38 tasks

---

## Validation Checklist

After all tasks are complete, verify:

- [ ] `bun run typecheck` passes with zero errors (backend)
- [ ] Frontend `tsc --noEmit` passes with zero new errors
- [ ] All backend error responses include `{ error, code, details? }` shape
- [ ] All canonical error codes are the only codes in use
- [ ] IOError has `code?: ErrorCode` as a first-class property
- [ ] Frontend errorClassifier uses backend error codes
- [ ] UnifiedIO only retries on transient errors
- [ ] Zero raw `fetch()` calls for API routes (except justified fire-and-forget)
- [ ] All SDK hooks use `responseSchema` for Zod validation
- [ ] WebSocket conversation streaming works end-to-end
- [ ] SSE canvas events arrive for hot-reload
- [ ] `hello:ack` sent on WS connection
- [ ] No dead types in CapabilityEventBus union
