# GLM Prompt: Backend-to-Frontend API Contract Alignment

## Objective
Fix all mismatches between backend API responses and frontend type expectations to ensure type-safe, working API calls across the entire application.

## Critical Issues Found

### 1. Capability Response Format Mismatch

**Backend** (`src/server/capability-router.ts:57-61`):
```typescript
const response: CapabilityListResponse = {
  capabilities: caps.map(toDetail),
  total: caps.length,
}
```

**Frontend** (`frontend/src/sdk/web/use-capability.ts:28-30`):
```typescript
const res = await io.get<{ capabilities: Capability[] }>(`/api/capabilities${qs}`)
setCapabilities(res.data.capabilities ?? [])
```

**Frontend** (`frontend/src/api/client.ts:28-29`):
```typescript
listBySurface: (surface: string) =>
  request<ResolvedCapabilityDto[]>(`/api/capabilities?surface=${surface}`),
```

**Issue**: Backend wraps in `{ capabilities: [], total: N }`, but `api/client.ts` expects raw array.

**Fix**: Update `api/client.ts` to match the wrapped response format.

---

### 2. Capability Type Definition Divergence

**Backend** (`src/schema/api-types.ts:30-47`) - `CapabilityDetail`:
```typescript
interface CapabilityDetail {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  surfaces: string[]
  inputSchema: unknown
  outputSchema: unknown
  cliCommand: unknown
  ui: unknown
  uiAction: unknown
  apiEndpoint: unknown
  workflowNodeType: unknown
  mcpToolName: unknown
  requiresConfirmation: boolean
  tags: string[]
}
```

**Frontend** (`frontend/src/types/api.ts:29-37`) - `Capability`:
```typescript
interface Capability {
  id: string
  slug: string
  name: string
  description?: string
  surfaces?: string[]
  category?: string
  action?: string
}
```

**Frontend** (`frontend/src/api/client.ts:3-11`) - `ResolvedCapabilityDto`:
```typescript
interface ResolvedCapabilityDto {
  id: string
  slug: string
  name: string
  category: string
  description?: string
  uiSlots?: Record<string, { component?: string; sandbox?: string[] }>
  inputSchema?: { type: string; properties?: Record<string, { type: string }>; required?: string[] }
}
```

**Issue**: Three different type definitions for the same concept.

**Fix**: Create a shared type package or align all definitions to the backend's `CapabilityDetail`.

---

### 3. Capability Execute Response Mismatch

**Backend** (`src/schema/api-types.ts:49-55`):
```typescript
interface CapabilityExecuteResponse {
  ok: true
  capabilityId: string
  output: unknown
  traceId: string
  latencyMs: number
}
```

**Frontend** (`frontend/src/sdk/web/use-capability.ts:49-51`):
```typescript
const res = await io.post<{ success?: boolean; result?: unknown; error?: string }>(
  `/api/capabilities/${encodeURIComponent(capabilityId)}/execute`,
  input ?? {},
)
```

**Frontend** (`frontend/src/api/client.ts:30-37`):
```typescript
execute: (capabilityId: string, input: Record<string, unknown>) =>
  request<{ ok: boolean; result?: unknown; error?: string }>(
    `/api/capabilities/${encodeURIComponent(capabilityId)}/execute`,
    { method: 'POST', body: JSON.stringify({ input }) }
  )
```

**Issue**: Backend returns `{ ok, capabilityId, output, traceId, latencyMs }` but frontend expects `{ ok, result?, error? }`.

**Fix**: Align frontend types to match backend response or update backend to include `result` field.

---

### 4. Conversation Response Format

**Backend** (`src/schema/api-types.ts:186-197`):
```typescript
interface ConversationDetail {
  id: string
  providerSessionId: string
  providerId: string
  title: string | null
  state: string
  messageCount: number
  lastMessageAt: number | null
  contextJson: string
  createdAt: number
  updatedAt: number
}
```

**Frontend** (`frontend/src/types/api.ts:3-9`):
```typescript
interface Conversation {
  id: string
  title?: string
  providerId?: string
  createdAt: string
  updatedAt?: string
}
```

**Issue**: Backend returns `number` for timestamps, frontend expects `string`. Backend has more fields.

**Fix**: Update frontend `Conversation` type to match backend or add transformation layer.

---

### 5. Send Message Response

**Backend** (`src/schema/api-types.ts:215-234`):
```typescript
interface SendMessageResponse {
  ok: true
  messageId: string
  blocks: unknown[]
  text: string
  latencyMs: number
  traceId: string
}

interface SendMessageErrorResponse {
  ok: false
  messageId: string
  blocks: unknown[]
  text: string
  latencyMs: number
  error: string
  traceId: string
}
```

**Frontend** (`frontend/src/types/api.ts:19-27`):
```typescript
interface SendResult {
  ok: boolean
  messageId: string
  blocks: Array<Record<string, unknown>>
  text: string
  latencyMs: number
  timing?: Record<string, unknown>
  error?: string
}
```

**Issue**: Backend has `traceId`, frontend has `timing`. Different field names.

**Fix**: Align frontend `SendResult` to match backend response.

---

### 6. Missing Backend Routes

Frontend calls these routes that don't exist on backend:
- `POST /api/canvas/save` - Canvas persistence
- `GET /api/media/list` - Media listing
- `POST /api/media/generate` - Media generation
- `GET /api/document/list` - Document listing
- `POST /api/document/create` - Document creation
- `POST /api/canvas/node/stream` - Canvas streaming

**Fix**: Either implement these routes on backend or remove frontend calls.

---

### 7. Error Response Format

**Backend** (`src/server/response.ts:82-89`):
```typescript
function errorResponse(message: string, code: string, status = 500, details?: unknown): Response {
  return json({ error: message, code, details }, status)
}
```

**Frontend** expects: `{ error: string, code?: string }`

**Issue**: Backend always includes `code`, frontend makes it optional.

**Fix**: Make frontend error handling consistent with backend format.

---

## Implementation Plan

### Phase 1: Create Shared Types (Priority: HIGH)

1. Create `frontend/src/types/shared/api-contract.ts` with canonical types
2. Import these types in both backend and frontend
3. Remove duplicate type definitions

### Phase 2: Fix Capability API (Priority: HIGH)

1. Update `frontend/src/api/client.ts` to match wrapped response
2. Align `ResolvedCapabilityDto` with backend `CapabilityDetail`
3. Fix execute response type to match backend

### Phase 3: Fix Conversation API (Priority: MEDIUM)

1. Update frontend `Conversation` type to include all backend fields
2. Handle timestamp number/string conversion
3. Add defensive parsing for missing fields

### Phase 4: Fix Send Message API (Priority: MEDIUM)

1. Align `SendResult` with backend response
2. Add `traceId` field to frontend type
3. Remove `timing` field or add to backend

### Phase 5: Implement Missing Routes (Priority: LOW)

1. Add `/api/canvas/save` route to backend
2. Add `/api/media/*` routes to backend
3. Add `/api/document/*` routes to backend

### Phase 6: Error Handling (Priority: LOW)

1. Standardize error response format
2. Update frontend error parsing
3. Add error code handling

---

## Validation Checklist

After implementation, verify:

- [ ] `bun run typecheck` passes with no errors
- [ ] All API calls in frontend match backend response format
- [ ] All type definitions are consistent across frontend and backend
- [ ] Error responses are properly handled in frontend
- [ ] WebSocket events match expected types
- [ ] No `any` types used in API contracts
- [ ] All optional fields are properly handled with fallbacks

---

## Files to Modify

### Backend
- `src/schema/api-types.ts` - Add shared types export
- `src/server/capability-router.ts` - Ensure response matches contract
- `src/server/conversation-router.ts` - Ensure response matches contract
- `src/server/response.ts` - Standardize error format

### Frontend
- `frontend/src/types/api.ts` - Update to match backend
- `frontend/src/types/shared/api-contract.ts` - NEW: Shared types
- `frontend/src/api/client.ts` - Fix response types
- `frontend/src/sdk/web/use-capability.ts` - Fix response handling
- `frontend/src/sdk/web/use-conversation.ts` - Fix response handling
- `frontend/src/components/canvas/UnifiedIOProvider.tsx` - Add type validation

---

## Testing Strategy

1. **Unit Tests**: Test type compatibility with mock data
2. **Integration Tests**: Test actual API calls with backend
3. **Type Tests**: Use TypeScript compile-time checks
4. **E2E Tests**: Verify frontend renders correctly with real data

---

## Success Criteria

1. Zero TypeScript errors in `bun run typecheck`
2. All API calls return data matching frontend type expectations
3. No runtime type errors when consuming API responses
4. Consistent error handling across all endpoints
5. Shared type definitions used in both frontend and backend
