# HTTP QUERY Method Implementation Plan

**Created:** 2026-07-12
**Source Research:** `docs/research/briefs/http-query-method-brief.md`
**Confidence:** High

---

## Executive Summary

Migrate `POST /api/providers/:id/capabilities/search` → `QUERY /api/providers/:id/capabilities` using the new HTTP QUERY method (RFC 10008). This provides semantic correctness for read operations, automatic retry safety, and CDN caching for repeated queries. Implementation runs both QUERY and POST in parallel with feature detection fallback.

---

## Atomic Tasks

### 23.1 — QUERY Capabilities Router

Add QUERY method support to `/api/providers/:id/capabilities` endpoint.

**File:** `src/server/conversation-router.ts`
**Action:** Add QUERY handler with JSON body parsing
**Headers:** `Cache-Control: public, max-age=60`, `Accept-Query: application/json`
**Code:**
```typescript
if (capMatch) {
  if (method === 'QUERY') {
    const body = (await req.json()) as { query?: string }
    const resolved = await ctx.resolutionEngine.search(providerId, planTier, body.query ?? '')
    return json({ ...resolved, capabilities: flattenResolved(resolved) }, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'Accept-Query': 'application/json'
      }
    })
  }
}
```

### 23.2 — QUERY Conversation Capabilities

Add QUERY method support to `/api/conversations/:id/capabilities` endpoint.

**File:** `src/server/conversation-router.ts`

### 23.3 — SDK queryCapabilities Method

Add typed method to SDK client for QUERY operations.

**File:** `sdk/src/client.ts`

Add method:
```typescript
async queryCapabilities(
  providerId: string,
  query: string,
  planTier?: PlanTier,
): Promise<ResolvedCapabilities> {
  // Try QUERY first, fallback to POST for browser compatibility
}
```

### 23.4 — CORS Preflight Support

Add QUERY to CORS allowlist.

**File:** `src/server/response.ts` or middleware

### 23.5 — Integration Tests

Test QUERY method functionality.

**File:** `tests/integration/http-query-method.test.ts`

---

## Implementation Notes

### Current State Analysis

- **Router:** `src/server/conversation-router.ts` already has `searchCapabilities` via POST (lines 24-77 in design doc)
- **Engine:** `src/engines/capability-resolution.ts` has `search()` method ready for QUERY input
- **Store:** `src/storage/contracts/capability-resolution-store.ts` already supports `searchCapabilities()`
- **SDK:** `sdk/src/client.ts` exists with `searchCapabilities` using POST — add `queryCapabilities` as alternative

### SDK Enhancement

**File:** `sdk/src/client.ts` (line 75-77)

```typescript
// Current:
async searchCapabilities(providerId: string, query: string, planTier?: string): Promise<unknown> {
  return this.request<unknown>('POST', `/api/providers/${providerId}/capabilities/search`, { query, planTier })
}

// Add after:
async queryCapabilities(providerId: string, query: string, planTier?: string): Promise<unknown> {
  const suffix = planTier ? `?planTier=${planTier}` : ''
  // Try QUERY, fallback to POST for browser compatibility
  try {
    return this.request<unknown>('QUERY', `/api/providers/${providerId}/capabilities${suffix}`, { query })
  } catch {
    return this.searchCapabilities(providerId, query, planTier)
  }
}
```

### Verification Commands

```bash
# After implementation
curl -X QUERY http://localhost:9420/api/providers/claude/capabilities \
  -H "Content-Type: application/json" \
  -d '{"query":"send"}'

curl -X POST http://localhost:9420/api/providers/claude/capabilities/search \
  -H "Content-Type: application/json" \
  -d '{"query":"send"}'
```

## References

- Research report: `docs/research/reports/http-query-method-sota-2026.md`
- Research brief: `docs/research/briefs/http-query-method-brief.md`
- RFC 10008: https://www.rfc-editor.org/rfc/rfc10008.html
- Engine spec: `docs/merged-design-v2/04-merged-engines.md` §6