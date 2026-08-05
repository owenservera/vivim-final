# GLM Prompt: Error Handling Standardization

## Objective
Standardize error handling across backend and frontend to ensure consistent error responses, proper error propagation, and user-friendly error messages.

## Critical Issues Found

### 1. Error Response Format Inconsistency

**Backend** (`src/server/response.ts:82-89`):
```typescript
function errorResponse(message: string, code: string, status = 500, details?: unknown): Response {
  return json({ error: message, code, details }, status)
}
```

Returns: `{ error: string, code: string, details?: unknown }`

**Frontend** error handling varies by component:
- `use-capability.ts`: `{ error: string }`
- `use-conversation.ts`: `{ error: string }`
- `UnifiedIOProvider.tsx`: `IOError` class with `message`, `status`, `traceId`

**Issue**: No consistent error shape across the application.

**Fix**: Define canonical error types and use them everywhere.

---

### 2. Error Code Taxonomy

**Backend** uses these error codes:
- `NotAvailable` - Service unavailable
- `NotFound` - Resource not found
- `ValidationError` - Input validation failed
- `ExecutionError` - Capability execution failed
- `InternalError` - Server error
- `NotFoundError` - Alternative not found

**Frontend** doesn't handle error codes, only error messages.

**Issue**: Frontend can't programmatically handle different error types.

**Fix**: Add error code handling in frontend with user-friendly messages.

---

### 3. Error Propagation in UnifiedIO

**Frontend** (`frontend/src/components/canvas/UnifiedIOProvider.tsx:184-210`):
```typescript
catch (err) {
  const ioError = err instanceof IOError
    ? err
    : new IOError(
        isAbort ? 'Request timed out' : String(err),
        0,
        traceId,
        err,
      )
  this.emit({
    type: 'request:error',
    traceId,
    method,
    url: fullUrl,
    error: ioError.message,
    timestamp: Date.now(),
  })
  throw ioError
}
```

**Issue**: All errors become `IOError` with status 0 for non-HTTP errors.

**Fix**: Map backend error codes to frontend error types.

---

### 4. Missing Error Boundaries

**Frontend** components don't consistently handle errors:
- `ConversationList.tsx`: Shows error message but no retry
- `CapabilityCatalog.tsx`: Shows error but doesn't log
- `DevConsole.tsx`: Shows raw error object

**Issue**: Inconsistent error UX across components.

**Fix**: Create error boundary component and use consistently.

---

## Implementation Plan

### Phase 1: Define Error Types (Priority: HIGH)

1. Create `frontend/src/types/shared/errors.ts`
2. Define `AppError` class with code, message, details
3. Map backend error codes to frontend error types

### Phase 2: Standardize Backend Errors (Priority: HIGH)

1. Create `src/server/errors.ts` with error classes
2. Use consistent error codes across all routers
3. Add error documentation

### Phase 3: Fix UnifiedIO Error Handling (Priority: MEDIUM)

1. Map HTTP status codes to error codes
2. Preserve backend error codes in `IOError`
3. Add error translation layer

### Phase 4: Add Error Boundaries (Priority: MEDIUM)

1. Create `ErrorBoundary` component
2. Add to all major UI sections
3. Include retry logic and error reporting

### Phase 5: User-Friendly Messages (Priority: LOW)

1. Create error message catalog
2. Map error codes to user messages
3. Add i18n support for errors

---

## Files to Modify

### Backend
- `src/server/errors.ts` - NEW: Error classes
- `src/server/response.ts` - Update error response format
- `src/server/capability-router.ts` - Use error classes
- `src/server/conversation-router.ts` - Use error classes

### Frontend
- `frontend/src/types/shared/errors.ts` - NEW: Error types
- `frontend/src/components/canvas/UnifiedIOProvider.tsx` - Fix error mapping
- `frontend/src/components/ErrorBoundary.tsx` - Update error boundary
- `frontend/src/sdk/web/use-capability.ts` - Add error handling
- `frontend/src/sdk/web/use-conversation.ts` - Add error handling

---

## Validation Checklist

- [ ] All errors have consistent format `{ error, code, details? }`
- [ ] Frontend handles all backend error codes
- [ ] Error boundaries catch and display errors
- [ ] Retry logic works for transient errors
- [ ] Error messages are user-friendly
- [ ] Error logging includes traceId for debugging
