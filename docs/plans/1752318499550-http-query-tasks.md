# HTTP QUERY Method Implementation Tasks

**Created:** 2026-07-12
**Source Research:** `docs/research/briefs/http-query-method-brief.md`
**Confidence:** High

---

## Atomic Tasks

### 23.1 — QUERY Capabilities Router

Add QUERY method support to `/api/providers/:id/capabilities` endpoint.

**File:** `src/server/conversation-router.ts`
**Action:** Add QUERY handler with JSON body parsing
**Headers:** `Cache-Control: public, max-age=60`, `Accept-Query: application/json`

---

### 23.2 — QUERY Conversation Capabilities

Add QUERY method support to `/api/conversations/:id/capabilities` endpoint.

**File:** `src/server/conversation-router.ts`
**Action:** Mirror 23.1 changes for conversation-scoped capabilities

---

### 23.3 — SDK queryCapabilities Method

Add typed method to SDK client for QUERY operations.

**File:** `sdk/src/client.ts`
**Action:** Add `queryCapabilities()` with POST fallback for browser compatibility

---

### 23.4 — CORS Preflight Support

Add QUERY to CORS allowlist.

**File:** `src/server/response.ts` or middleware
**Action:** Add QUERY to allowed HTTP methods in preflight OPTIONS response

---

### 23.5 — Body-Aware Caching

Implement SHA-256 hash-based cache keys for QUERY responses.

**File:** `src/storage/impl/capability-resolution-store-impl.ts`
**Action:** Add cache key generation from normalized request body + URL

---

### 23.6 — Integration Tests

Test QUERY method functionality.

**File:** `tests/integration/http-query-method.test.ts`
**Action:** Verify QUERY works, POST fallback, caching headers

---

## Implementation Priority

1. **23.1** — Router support (enables QUERY)
2. **23.4** — CORS preflight (required for browser clients)
3. **23.2** — Conversation capabilities (reuse 23.1 pattern)
4. **23.3** — SDK method (client-side feature detection)
5. **23.5** — Caching (optional, performance enhancement)
6. **23.6** — Tests (validation)

---

## Validation

After implementation:
```bash
# Verify QUERY works
curl -X QUERY http://localhost:9420/api/providers/claude/capabilities \
  -H "Content-Type: application/json" \
  -d '{"query":"send"}'

# Verify POST fallback still works
curl -X POST http://localhost:9420/api/providers/claude/capabilities/search \
  -H "Content-Type: application/json" \
  -d '{"query":"send"}'
```

---

## References

- RFC 10008 specification
- Research report: `docs/research/reports/http-query-method-sota-2026.md`
- Research brief: `docs/research/briefs/http-query-method-brief.md`