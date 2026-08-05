# Full Backend-to-Frontend Wiring Audit Report

> **Generated**: 2026-08-06  
> **Scope**: Complete audit of every backend route, frontend consumer, WebSocket event, error path, and storage contract in the vivim-final codebase.  
> **Method**: Exhaustive grep/read of 40+ backend routers, 106+ frontend API calls, 85+ WebSocket event types, 265+ error paths, and 71 Next.js proxy routes.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total backend HTTP routes | **185** across 38 router files |
| Total frontend typed API calls | **106** (`io.*<T>()` calls) |
| Raw `fetch()` calls bypassing UnifiedIO | **7** (violating One Entry Point invariant) |
| Next.js frontend API routes | **71** (62 in-process, 9 proxy to backend) |
| WebSocket event types on EventBus | **85** (23 typed union + 62 generic/as-never) |
| Frontend WS event type definitions | **18** |
| `errorResponse()` calls in backend | **265+** across 38 files |
| Non-canonical error codes | **33 unique** (~140 occurrences) |
| Files bypassing canonical error response | **4** (kernel-router, webhook-router, autonomous-router, memory-viz-router) |

### Critical Findings

| # | Severity | Finding | Area |
|---|----------|---------|------|
| 1 | 🔴 CRITICAL | WebSocket streaming is **silently broken** — frontend expects `{ type, payload }` envelope but backend sends flat `{ type, conversationId, ... }`. All `conversation:complete`, `conversation:error`, `conversation:block` handlers **never fire**. | WS |
| 2 | 🔴 CRITICAL | WebSocket subscribe protocol mismatch — frontend sends `{ type: "subscribe", topic }` but backend expects `{ type: "subscribe", entityType, entityId }`. **All topic subscriptions are silently dropped.** | WS |
| 3 | 🔴 CRITICAL | `conversation:block` events never reach EventBus — StreamingProtocol has its own private `emit()`. The WebSocket forwarder listens on EventBus but receives nothing. **Real-time streaming is non-functional.** | WS |
| 4 | 🔴 CRITICAL | SSE canvas events pipeline is incomplete — only sends `connected` + keepalive. No EventBus→SSE bridge. **Canvas hot-reload and live updates are non-functional.** | WS |
| 5 | 🔴 HIGH | 33 non-canonical error codes used across backend (e.g., `VALIDATION_ERROR`, `SURFACE_NOT_FOUND`, `EngineUnavailable`) — frontend cannot reliably switch on codes. | Error |
| 6 | 🔴 HIGH | 4 backend routers bypass `errorResponse()` entirely, returning `{ error: string }` without `code` field. | Error |
| 7 | 🔴 HIGH | Frontend has 3 conflicting error response type definitions; `IOError` lacks a `code` property; `errorClassifier.ts` ignores backend error codes entirely. | Error |
| 8 | 🔴 HIGH | `api/client.ts` is a parallel transport bypassing `useIO()` — no retry, no auth tokens, no Zod validation, no trace IDs. | API |
| 9 | 🟡 MEDIUM | Only 4 of 106 typed API calls use Zod `responseSchema` validation. | Validation |
| 10 | 🟡 MEDIUM | UnifiedIO retries ALL non-abort errors including 400/404/403 — wasteful and semantically wrong. | Error |
| 11 | 🟡 MEDIUM | `use-provider.ts` uses `io.get<unknown>` — effectively untyped. | API |
| 12 | 🟡 MEDIUM | 7 raw `fetch()` calls violate One Entry Point invariant. | API |
| 13 | 🟡 MEDIUM | `getUserMessage()`, `isRetryable()`, `ERROR_MESSAGES` are dead code — never imported. | Error |
| 14 | 🟡 MEDIUM | Backend returns raw arrays for many routes (e.g., `GET /api/conversations`, `GET /api/providers`) while frontend sometimes expects wrapped shapes. | API |
| 15 | 🟡 LOW | Duplicate routes exist (`GET /api/memory/export` in 2 files, `GET /api/knowledge/entities` in 2 files). | API |
| 16 | 🟡 LOW | `NotFound` vs `NotFoundError` used inconsistently across routers. | Error |
| 17 | 🟡 LOW | `hello:ack`, `pong`, `stream:block`, `canvas:node` are dead types — defined but never emitted. | WS |

---

## Section 1: Backend API Routes (185 routes)

### 1.1 Route Inventory by Router

| Router | Routes | Validation (Zod/Manual/None) | Error Codes |
|--------|--------|---------------------------|-------------|
| capability-router | 3 | Zod+manual | Canonical |
| conversation-router | 22 | Mixed | Mostly canonical |
| interpret-router | 1 | Zod | `MethodNotAllowed` (non-canonical) |
| generative-router | 4 | Manual | Canonical |
| memory-router | 2 | Zod/manual | `InternalError` |
| memory-viz-router | 13 | Manual | **Custom shape `{ error }` — NO `code`** |
| knowledge-router | 10 | Zod/manual | Canonical + `NotFoundError` |
| mutation-router | 6 | Zod | **SCREAMING_CASE: `VALIDATION_ERROR`, `SURFACE_NOT_FOUND`, `INTERNAL_ERROR`** |
| node-router | 15 | Manual | `InternalError`, `NotFoundError` |
| canvas-router | 9 | Zod/manual | **`CanvasUnavailable`**, domain-specific codes |
| plugin-router | 7 | Zod/manual | Canonical + `InvalidPlugin`, `MissingDependency` |
| plugin-builder-router | 2 | Zod | **`VALIDATION_ERROR`** |
| setup-router | 7 | Zod | Canonical + `VerificationError` |
| storage-router | 5 | Zod/manual | Domain-specific codes |
| surface-router | 3 | Manual | **`SURFACE_NOT_FOUND`, `INTERNAL_ERROR`** |
| template-router | 5 | Zod | **`NOT_FOUND`, `VALIDATION_ERROR`** |
| version-router | 9 | Zod/manual | **`NOT_FOUND`, `VALIDATION_ERROR`, `APPLY_FAILED`** |
| variant-router | 7 | Zod | **`VALIDATION_ERROR`, `NOT_FOUND`, `LOCKED`, `APPLY_FAILED`** |
| webhook-router | 1 | Manual | **Custom shape — raw Response** |
| automation-router | 3 | Zod/manual | `AutomationError` (non-canonical) |
| autonomous-router | 10 | Zod | **Custom `{ error }` shape — NO `code`** |
| agent-canvas-router | 4 | Zod | **`VALIDATION_ERROR`, `INTERNAL_ERROR`, `NLCL_UNAVAILABLE`** |
| chrome-router | 2 | None | **`INTERNAL_ERROR`** |
| conceptual-router | 4 | Manual | **`ConceptualUnavailable`**, domain-specific |
| conversation-sync-router | 4 | Manual | `ValidationError`, `NotSupported`, `SyncError`, `FetchError` |
| kernel-router | 13 | Zod | **Custom shape — NO `code`** |
| llm-harness-router | 3 | Zod | **`VALIDATION_ERROR`, `CONFIRMATION_INVALID`, `AGENT_NOT_CONFIGURED`, `APPLY_FAILED`** |
| nlcl-router | 8 | Zod | `MethodNotAllowed`, `NLCLError` |
| mux-router | 5 | Zod/manual | Canonical |
| routes/contacts | 10 | Zod/manual | `EngineUnavailable` (non-canonical) |
| routes/containers | 9 | Zod/manual | `EngineUnavailable` |
| routes/content | 7 | Zod/manual | `EngineUnavailable` |
| routes/knowledge | 27 | Zod/manual | `EngineUnavailable`, `KnowledgeError` |
| routes/media | 10 | Zod/manual | `EngineUnavailable` |
| routes/notifications | 9 | Zod/manual | `EngineUnavailable` |
| routes/sync | 7 | Zod/manual | `EngineUnavailable`, `NotImplemented` |
| routes/tunnel | 8 | None | `ServiceUnavailable` (non-canonical) |
| routes/update | 9 | Zod/manual | Domain-specific SCREAMING_CASE codes |
| routes/users | 7 | Zod/manual | `EngineUnavailable`, `UserError` |

### 1.2 Error Code Usage Map (Non-Canonical → Canonical Mapping)

| Current Code | Occurrences | Recommended Canonical |
|-------------|------------|----------------------|
| `VALIDATION_ERROR` | 18 | `ValidationError` |
| `NOT_FOUND` | 10 | `NotFound` |
| `INTERNAL_ERROR` | 5 | `InternalError` |
| `SURFACE_NOT_FOUND` | 2 | `NotFound` |
| `EngineUnavailable` | 8 | `NotAvailable` |
| `MethodNotAllowed` | 5 | Add to ErrorCode or use `ValidationError` |
| `ServiceUnavailable` | 4 | `NotAvailable` |
| `InvalidPlugin` | 4 | `ValidationError` |
| `NotSupported` | 3 | `ValidationError` |
| `LOCKED` | 3 | Add to ErrorCode as `Locked` |
| `BadRequest` | 3 | `ValidationError` |
| `APPLY_FAILED` | 3 | `ExecutionError` |
| `CONFIRMATION_INVALID` | 1 | `ValidationError` |
| `AGENT_NOT_CONFIGURED` | 1 | `NotAvailable` |
| `NLCL_UNAVAILABLE` | 1 | `NotAvailable` |
| `CanvasUnavailable` | 1 | `NotAvailable` |
| `ConceptualUnavailable` | 1 | `NotAvailable` |
| `VerificationError` | 1 | `ValidationError` |
| `AutomationError` | 1 | `ExecutionError` |
| `SyncError` | 1 | `ExecutionError` |
| `FetchError` | 1 | `ExecutionError` |
| `MissingDependency` | 1 | `Conflict` |
| `DSL_PARSE_ERROR` | 1 | `ValidationError` |
| `UNSUPPORTED_MUTATION` | 1 | `ValidationError` |
| `CanvasListFailed` | 1 | `InternalError` |
| (6 more canvas domain codes) | 6 | `InternalError` |
| (5 more conceptual domain codes) | 5 | `InternalError` |
| `Unreachable` | 1 | `InternalError` |
| `UpgradeFailed` | 2 | `InternalError` |
| `UserError` | 1 | `InternalError` |
| `KnowledgeError` | 1 | `InternalError` |

### 1.3 Response Shape Inconsistencies

| Pattern | Routers | Issue |
|--------|---------|-------|
| Raw array (no wrapper) | conversation (`GET /api/conversations`, `GET /api/conversations/:id/messages`), providers (`GET /api/providers`), knowledge (`GET /api/knowledge/search`, entities, topics), nodes, etc. | Frontend sometimes expects `{ items: [...], count }` or `{ conversations: [...] }` wrapper |
| Wrapped `{ ok, result }` | canvas-router, most surface/template/version/variant/mutation/chrome/conceptual routes | Consistent within this group |
| Pass-through | knowledge-router, storage-router, mux-router | Response shape depends entirely on engine output — no contract |
| `{ error }` only (no code) | memory-viz-router, autonomous-router, kernel-router, webhook-router | Breaks canonical error contract |
| Duplicate routes | `GET /api/memory/export` in memory-router + memory-viz-router; `GET /api/knowledge/{entities,topics}` in knowledge-router + routes/knowledge.ts | Different implementations, potentially different response shapes |

---

## Section 2: Frontend API Consumers (106 typed + 7 raw)

### 2.1 Transport Layer Analysis

| Transport | Calls | Has Retry | Has Auth | Has TraceId | Has Zod |
|----------|-------|-----------|---------|------------|---------|
| `useIO()` (UnifiedIO) | 106 | ✅ (2 retries, exponential backoff) | ✅ (Bearer token) | ✅ (auto-generated ULID) | ⚠️ (4 calls only) |
| `api/client.ts` (raw fetch) | 3 | ❌ | ❌ | ❌ | ❌ |
| Raw `fetch()` | 7 | ❌ | ❌ | ❌ | ❌ |

### 2.2 Zod Validation Coverage

| SDK Hook | Total Calls | With `responseSchema` | Coverage |
|----------|-----------|------------------------|----------|
| `use-capability.ts` | 2 | 2 | 100% |
| `use-conversation.ts` | 3 | 1 (list only) | 33% |
| `use-mutation.ts` | 7 | 0 | 0% |
| `use-variant.ts` | 6 | 0 | 0% |
| `use-conversation-sync.ts` | 4 | 0 | 0% |
| `use-session.ts` | 3 | 0 | 0% |
| `use-interpret.ts` | 1 | 0 | 0% |
| `use-provider.ts` | 1 | 0 | 0% |
| `use-health.ts` | 1 | 0 | 0% |
| **All components** | **70** | **0** | **0%** |

### 2.3 Raw `fetch()` Violations (One Entry Point)

| File | Route | Justified? |
|------|-------|-----------|
| `features/onboarding/useAnalytics.ts:54` | `POST /api/onboarding/analytics` | Fire-and-forget analytics — acceptable |
| `features/help-system/useHelpAnalytics.ts:73` | `POST /api/onboarding/analytics` | Fire-and-forget analytics — acceptable |
| `canvas/persistence.ts:62` | `POST /api/canvas/save` | Fire-and-forget save — acceptable |
| `lib/errorLogger.ts:33` | `POST ${backendUrl}/api/error-log` | Error logging — acceptable (avoids loops) |
| `hooks/useNetworkStatus.ts:31` | `HEAD ${HEARTBEAT_URL}` | External heartbeat — acceptable |
| `canvas/export.ts:56` | `GET data:URL` | Local blob — acceptable |
| `features/guided-landing.tsx:1178` | `GET /api/setup/profiles` | **NOT justified** — should use `useIO()` |

### 2.4 `api/client.ts` Parallel Transport Issues

The `capabilityApi` object uses raw `fetch()` via `getApiBase()`:
- **No retry** on transient failures (unlike UnifiedIO's 2-retry with backoff)
- **No auth token** injection (UnifiedIO adds `Authorization: Bearer <token>`)
- **No trace ID** propagation (`X-Trace-Id` header)
- **No Zod validation** of responses
- **No deduplication** of concurrent GET requests

---

## Section 3: WebSocket Events (85 types)

### 3.1 Critical Protocol Mismatches

#### MISMATCH 1: Event Envelope Wrapping
- **Frontend** (`useWebSocket.ts`) wraps all WS messages: `WsMessage { type, payload?, timestamp? }`
- **Backend** sends flat events: `{ type: "conversation:complete", conversationId: "xxx", message: {...} }`
- **Impact**: `Composer.tsx:142` accesses `msg.payload.block` → `undefined`. All conversation streaming handlers silently skip events.

#### MISMATCH 2: Subscribe Protocol
- **Frontend** sends: `{ type: "subscribe", topic: "conversation:xxx" }`
- **Backend** expects: `{ type: "subscribe", entityType: string, entityId: string }`
- **Impact**: The `subscribe` handler in `websocket.ts:246` checks `entityType && entityId` — topic-only messages are silently dropped.

#### MISMATCH 3: conversation:block Pipeline Break
- `StreamingProtocol` has its own private `emit()` — events only go to locally-registered handlers
- `WebSocket` forwarder (`websocket.ts:96`) listens for `conversation:block` on `CapabilityEventBus`
- **No bridge** connects StreamingProtocol to EventBus
- **Impact**: Real-time message streaming blocks never reach WebSocket clients.

#### MISMATCH 4: SSE Canvas Events Incomplete
- `canvas-router.ts` SSE stream only sends `connected` event + keepalive comments
- No EventBus listener bridges canvas events to the SSE stream
- **Impact**: `canvas:layer:spawned`, `canvas:def:updated`, `workspace:reresolved` expected by frontend never arrive. Canvas hot-reload is non-functional.

### 3.2 Event Status Matrix

| Event Type | Defined | Emitted | Reaches WS | Frontend Handles | Status |
|-----------|---------|---------|-----------|-----------------|--------|
| `capability:executed` | ✅ | ✅ | ✅ | ✅ DevConsole | ✅ Working |
| `capability:failed` | ✅ | ✅ | ✅ | Type only | ⚠️ No UI handler |
| `capability:progress` | ✅ | ✅ | ✅ | Type only | ⚠️ No UI handler |
| `conversation:complete` | ✅ | ✅ | ✅ | ✅ Composer | 🔴 Broken (payload) |
| `conversation:error` | ✅ | ✅ | ✅ | ✅ Composer | 🔴 Broken (payload) |
| `conversation:block` | — | ✅ (StreamingProtocol) | ❌ | ✅ Composer | 🔴 Pipeline broken |
| `conversation:created` | ✅ | ❌ | ❌ | ❌ | 💀 Dead type |
| `config:changed` | ✅ | ✅ | ✅ | ❌ | ⚠️ No handler |
| `canvas:mutated` | ✅ | ✅ | ✅ | ❌ | ⚠️ No handler |
| `canvas:node` | ✅ | ❌ | ❌ | ❌ | 💀 Dead type |
| `stream:block` | ✅ | ❌ | ❌ | ❌ | 💀 Phantom type |
| `hello:ack` | ✅ | ❌ | ❌ | ❌ | 💀 Dead type |
| `pong` | ✅ | ❌ | ❌ | ❌ | 💀 Dead type |
| `kernel:oracle` | ✅ | ✅ | ✅ | Type only | ⚠️ No handler |
| `canvas:layer:spawned` | — | ✅ (EventBus) | ❌ | ❌ (SSE) | 🔴 SSE not wired |
| `canvas:def:updated` | — | ✅ (EventBus) | ❌ | ❌ (SSE) | 🔴 SSE not wired |
| `workspace:reresolved` | — | ❌ | ❌ | ❌ (SSE) | 💀 Never sent |
| (62 more generic events) | — | ✅ | ✅ | ❌ | ⚠️ Firehose only |

### 3.3 Frontend `useWebSocket` Subscribe Behavior

Frontend code (`canvas/unified-entry.tsx` or similar) subscribes via:
```typescript
ws.send(JSON.stringify({ type: 'subscribe', topic: `conversation:${id}` }))
```
Backend requires:
```typescript
// Only this works:
ws.send(JSON.stringify({ type: 'agent:subscribe', topic: `conversation:${id}` }))
// OR this works:
ws.send(JSON.stringify({ type: 'subscribe', entityType: 'conversation', entityId: id }))
```
The `topic`-only format matches NO handler in `websocket.ts`.

---

## Section 4: Error Handling (265+ error paths)

### 4.1 Backend Error Code Taxonomy

Total unique error codes: **46**  
Canonical (in `errors.ts` ErrorCode): **13**  
Non-canonical: **33**

### 4.2 Backend Response Shape Violations

| File | Response Helper | Error Shape | Has CORS? |
|------|---------------|------------|-----------|
| `response.ts:errorResponse()` | `json({ error, code, details })` | `{ error, code, details }` | ✅ |
| `kernel-router.ts` | `new Response(JSON.stringify({ error }))` | `{ error }` | ❌ |
| `webhook-router.ts` | `new Response(JSON.stringify({ ... }))` | Mixed | ❌ |
| `autonomous-router.ts` | Local `error()` helper | `{ error }` | ❌ |
| `memory-viz-router.ts` | Custom `respond()` helper | `{ error }` | ❌ |
| `server/index.ts` (opencode) | `json({ error })` or `json({ error, code })` | Inconsistent | ✅ (via json()) |

### 4.3 Frontend Error Type Definitions (3 conflicting)

| Type | File | Shape | Used? |
|------|------|-------|-------|
| `ApiErrorResponse` | `shared/errors.ts` | `{ error, code: ErrorCode, details? }` | ❌ Never imported |
| `ApiErrorResponse` | `shared/api-contract.ts` | `{ ok: false, error, code, details, traceId, latencyMs }` | ❌ Never matches backend |
| `ErrorResponse` | `shared/api-contract.ts` | `{ error: string, code: string, details? }` | ❌ Never imported |

### 4.4 IOError Missing `code` Property

```typescript
// Current (unified-io.ts)
class IOError extends Error {
  constructor(message, status, traceId, cause) { ... }
}
// Code attached via unsafe cast in UnifiedIOProvider.tsx:
;(ioError as IOError & { code?: string }).code = errCode
```

### 4.5 Dead Utility Code

| Export | File | Imported By |
|--------|------|-----------|
| `getUserMessage()` | `errors.ts` | Nobody |
| `isRetryable()` | `errors.ts` | Nobody |
| `ERROR_MESSAGES` | `errors.ts` | `getUserMessage()` only (also dead) |
| `ApiErrorResponse` | `errors.ts` | Nobody |
| `ApiErrorResponse` | `api-contract.ts` | Nobody |
| `ErrorResponse` | `api-contract.ts` | Nobody |

### 4.6 ErrorClassifier Ignores Backend Code

`errorClassifier.ts:classifyError()` uses regex patterns against `error.message` — never reads the backend `code` field. The entire standardized error code system is bypassed at the classification layer.

### 4.7 UnifiedIO Retries All Errors

```typescript
// UnifiedIOProvider.tsx:190-198
if (attempt < retries && !isAbort) {
  // Retries 400 ValidationErrors, 404 NotFounds, 403 Forbiddens — all wasteful
}
```

Should only retry transient errors: 408, 429, 500, 502, 503, 504.

---

## Section 5: Next.js API Routes (71 routes)

### 5.1 Architecture Split

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Frontend     │────▶│  Next.js BFF      │────▶│  Backend      │
│  (React)      │     │  (71 routes)      │     │  (Bun server)  │
│              │◀────│  9 proxy routes   │◀────│               │
│              │     │  62 in-process    │     │               │
└──────────────┘     └──────────────────┘     └───────────────┘
```

### 5.2 Proxy Routes (9)

| Frontend Route | Backend Route | Method |
|---------------|--------------|--------|
| `/api/health` | `http://localhost:${port}/api/health` | GET |
| `/api/setup/workspace` | `http://localhost:${port}/api/setup/workspace` | GET/POST |
| `/api/setup/profiles` | `http://localhost:${port}/api/setup/profiles` | GET |
| `/api/setup/launch-visible` | `http://localhost:${port}/api/setup/launch-visible` | POST |
| `/api/setup/verify` | `http://localhost:${port}/api/setup/verify` | POST |
| `/api/setup/complete` | `http://localhost:${port}/api/setup/complete` | POST |
| `/api/setup/kill` | `http://localhost:${port}/api/setup/kill` | POST |
| `/api/help/agent` | `http://localhost:${backendPort}/api/interpret` | POST |
| `/api/help/search` | `http://localhost:${backendPort}/api/interpret` | POST |

### 5.3 In-Process Routes (62)

These call engine methods directly via `getEngineBag()` without going through the backend HTTP API. They share the same URL namespace as the backend but are implemented entirely within the Next.js process.

---

## Section 6: Storage Contract Alignment

### 6.1 Timestamp Convention

| Layer | Format | Type |
|-------|--------|------|
| Backend (ConversationRow) | Unix epoch ms (`number`) | `createdAt: number` |
| Backend API responses | Raw pass-through | `createdAt: number` |
| Frontend domain model | ISO 8601 (`string`) | `createdAt: string` |
| Frontend JSON fields | JSON strings (`contextJson`, `blocksJson`, `metadataJson`) | Parsed via transformers |

### 6.2 Null vs Undefined

| Backend | Frontend |
|---------|----------|
| `null` for missing values | `undefined` for optional fields |
| `description: string \| null` | `description?: string` |
| `lastMessageAt: number \| null` | `lastMessageAt?: string` |

Transformers handle this correctly in `use-conversation.ts` and `use-capability.ts`.

### 6.3 Storage Contracts Not Used by Frontend

The frontend does NOT directly call any storage contracts. It only consumes API responses that derive from storage. However, the backend's `routes/knowledge.ts` uses `MemoryIntelligenceStore` while `knowledge-router.ts` uses Prisma — two different storage backends for the same conceptual entities.

---

## Section 7: Summary of Gaps by Priority

### 🔴 P0 — Broken Functionality (Fix Now)

1. **WebSocket streaming pipeline** — Event envelope mismatch + subscribe protocol + StreamingProtocol→EventBus bridge
2. **WebSocket subscribe protocol** — Frontend sends wrong format, backend drops all subscriptions

### 🔴 P1 — Data Integrity (Fix Next)

3. **Error code standardization** — 33 non-canonical codes, 4 bypass routers
4. **IOError `code` property** — Add as first-class field, remove type assertion hack
5. **ErrorClassifier integration** — Use backend `code` instead of string pattern matching
6. **Duplicate error types** — Consolidate to single `ApiErrorResponse`
7. **`api/client.ts` parallel transport** — Migrate to `useIO()` or at minimum add retry/auth/traceId
8. **UnifiedIO retry scope** — Only retry transient errors, not 4xx

### 🟡 P2 — Robustness (Fix Soon)

9. **Zod validation coverage** — Add `responseSchema` to all SDK hooks and component API calls
10. **Dead code cleanup** — Remove unused `getUserMessage`, `isRetryable`, `ERROR_MESSAGES`, duplicate types
11. **`use-provider.ts` typing** — Replace `io.get<unknown>` with proper typed response
12. **Raw fetch violations** — Migrate `guided-landing.tsx` to `useIO()`
13. **SSE canvas pipeline** — Bridge EventBus events to SSE stream
14. **Canvas live events** — Emit `canvas:node` events or remove dead forwarder

### 🟢 P3 — Cleanup (Fix Later)

15. **Duplicate route consolidation** — Merge duplicate memory and knowledge routes
16. **`NotFound` vs `NotFoundError`** — Consolidate to single code
17. **Dead WS types** — Remove `hello:ack`, `pong`, `stream:block`, `canvas:node`, `conversation:created`
18. **Missing capability handlers** — Add UI for `capability:failed`, `capability:progress`
19. **Response wrapper standardization** — Decide on raw-array vs wrapped for list endpoints
20. **`appErrorResponse` adoption** — Migrate remaining 35 routers to throw `AppError`
