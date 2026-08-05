# GLM Prompt: API Validation with Zod Schemas

## Objective
Add comprehensive Zod validation for all API requests and responses to catch type errors at runtime, improve debugging, and ensure contract compliance.

## Critical Issues Found

### 1. Missing Request Validation

**Backend** (`src/server/capability-router.ts:73-81`):
```typescript
let body: { input?: Record<string, unknown>; ctx?: Partial<CapabilityContext> } = {}
try {
  const parsed = await req.json()
  if (parsed && typeof parsed === 'object') {
    body = parsed as typeof body
  }
} catch {
  body = {}
}
```

**Issue**: Uses `as` type assertion instead of validation.

**Fix**: Add Zod schema validation for request bodies.

---

### 2. Missing Response Validation

**Frontend** (`frontend/src/components/canvas/UnifiedIOProvider.tsx:139-145`):
```typescript
const text = await res.text()
let data: unknown
try {
  data = text ? JSON.parse(text) : null
} catch {
  data = text
}
```

**Issue**: Parses JSON but doesn't validate structure.

**Fix**: Add Zod schema validation for responses.

---

### 3. Inconsistent Validation Patterns

**Backend** uses Zod in some places:
```typescript
const schema = z.object({
  providerId: z.string().min(1),
  accountId: z.string().optional(),
  title: z.string().optional(),
})
const parsed = schema.safeParse(await req.json())
if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
```

But not in others (capability-router.ts).

**Issue**: Inconsistent validation across endpoints.

**Fix**: Standardize on Zod validation for all endpoints.

---

### 4. No Schema Documentation

**Issue**: No documentation of expected request/response shapes.

**Fix**: Add JSDoc comments with examples for all schemas.

---

## Implementation Plan

### Phase 1: Create Request Schemas (Priority: HIGH)

1. Create `src/schema/request-schemas.ts`
2. Define Zod schemas for all request bodies
3. Use in all routers

### Phase 2: Create Response Schemas (Priority: HIGH)

1. Create `src/schema/response-schemas.ts`
2. Define Zod schemas for all responses
3. Use in all routers

### Phase 3: Add Frontend Validation (Priority: MEDIUM)

1. Create `frontend/src/api/schemas.ts`
2. Import schemas from backend (or duplicate)
3. Validate responses in UnifiedIO

### Phase 4: Add Schema Documentation (Priority: LOW)

1. Add JSDoc comments with examples
2. Generate OpenAPI spec from schemas
3. Add schema validation tests

---

## Files to Modify

### Backend
- `src/schema/request-schemas.ts` - NEW: Request schemas
- `src/schema/response-schemas.ts` - NEW: Response schemas
- `src/server/capability-router.ts` - Add validation
- `src/server/conversation-router.ts` - Add validation

### Frontend
- `frontend/src/api/schemas.ts` - NEW: Frontend schemas
- `frontend/src/components/canvas/UnifiedIOProvider.tsx` - Add validation
- `frontend/src/sdk/web/use-capability.ts` - Add validation
- `frontend/src/sdk/web/use-conversation.ts` - Add validation

---

## Validation Checklist

- [ ] All request bodies validated with Zod
- [ ] All responses validated with Zod
- [ ] Validation errors return proper error responses
- [ ] Schemas documented with examples
- [ ] No runtime type errors
- [ ] Performance impact minimal
