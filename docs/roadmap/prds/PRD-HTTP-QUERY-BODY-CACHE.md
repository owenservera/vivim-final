# PRD: HTTP QUERY Method + Body-Aware Caching

**Status:** READY FOR AGENT
**Date:** 2026-07-13
**Author:** opencode (research review)
**Labels:** `ready-for-agent`, `research-proposal`, `api-server`, `phase-2`
**Source brief:** `docs/research/briefs/http-query-method-brief.md` (High confidence, 8 sources)
**RFC:** RFC 10008 (HTTP QUERY, June 2026)

---

## Problem Statement

The brief recommends adopting the HTTP **QUERY** method (RFC 10008) — "GET with a body" — for
read/search endpoints, with dual-method fallback, `Accept-Query` advertisement, and body-aware
caching. Today:

- `src/server/capability-router.ts` and `src/server/conversation-router.ts` handle **only** GET/POST.
  No `QUERY` method, no `Accept-Query` response header, no body-aware cache.
- Capability resolution is already GET-with-query-string (`conversation-router.ts:46`
  `GET /api/providers/:id/capabilities`), so the brief's "fix the POST search" concern is partly moot —
  but **complex body queries** (e.g. semantic capability search with a JSON filter body) have no
  QUERY transport and no caching.
- Browser `fetch()` does not yet support QUERY (July 2026) → POST fallback required.

## Solution

### A. QUERY transport (Bun native)

Bun's HTTP server can dispatch on `QUERY`. Add a method matcher in the router entry
(`src/server/index.ts` request handler) that routes `QUERY` to the same handler as the equivalent
`GET`/`POST` for capability/search endpoints. Keep POST as fallback for browsers.

### B. `Accept-Query` advertisement

On capability GET endpoints add response header `Accept-Query: application/json` to advertise QUERY
support (RFC 10008 §2 semantics).

### C. Body-aware cache

In-memory cache keyed by `SHA-256(normalize(url) + normalize(body))` for QUERY/POST search results
(RFC 10008 §2.7 requires body-aware cache key). TTL-bounded LRU.

```typescript
function cacheKey(url: string, body: unknown): string {
  const norm = JSON.stringify(stableStringify(body ?? {}))
  return crypto.subtle ? sha256(url + '|' + norm) : hash(url + norm)
}
```

### D. CORS preflight

QUERY is not CORS-safelisted → ensure `OPTIONS` preflight handles `QUERY` in `src/server/index.ts`.

## Implementation Plan

1. Extend the request dispatcher in `src/server/index.ts` to branch on `req.method === 'QUERY'`
   (route to GET/POST handler for capability/search routes).
2. Add `Accept-Query: application/json` header on `GET /api/capabilities` and
   `GET /api/providers/:id/capabilities`.
3. Implement `src/server/query-cache.ts` (SHA-256 body key, LRU, TTL) and wrap search handlers.
4. Add `QUERY` to CORS `Access-Control-Allow-Methods` + `OPTIONS` preflight.
5. Document SDK `query()` alongside existing `searchCapabilities()` (in `src/mcp/` / SDK clients).

## Acceptance Criteria

1. `QUERY /api/providers/:id/capabilities` with a JSON body returns the same result as the GET form.
2. `GET /api/capabilities` response includes `Accept-Query: application/json`.
3. Repeated identical QUERY/POST search hits the cache (verified via a hit-counter in tests).
4. `OPTIONS` preflight for `QUERY` succeeds (CORS ok).

## Tests

- `tests/unit/server/query-method.test.ts` — QUERY routed to GET handler; Accept-Query header present.
- `tests/unit/server/query-cache.test.ts` — same body+url → cache hit; different body → miss.
- `tests/integration/server/cors-query.test.ts` — preflight allows QUERY.

## Dependencies / Risks

- Browser `fetch()` lacks QUERY (July 2026) → must keep POST fallback; do not break web client.
- Cache key normalization must be conservative (stable stringify) to avoid false misses.
- Monitor browser adoption quarterly (brief Phase 2).

## References

- `docs/research/briefs/http-query-method-brief.md`
- `docs/research/reports/http-query-method-sota-2026.md`
- `src/server/{index,capability-router,conversation-router}.ts`
- RFC 10008 (https://www.rfc-editor.org/rfc/rfc10008.html)
