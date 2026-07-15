# HTTP QUERY Method — Brief

**Source:** [full report](../reports/http-query-method-sota-2026.md)
**Confidence:** High | **Sources:** 8 | **Date:** 2026-07-12

## TL;DR

The HTTP QUERY method (RFC 10008, June 2026) provides safe, idempotent read operations with request body support — "GET with a body." For vivim-final, this enables semantic correctness for capability search endpoints (`POST /api/providers/:id/capabilities/search` → `QUERY /api/providers/:id/capabilities`), automatic retry safety, and CDN caching for repeated queries. Primary implementation risk is browser support (not yet universal), mitigated by POST fallback.

## Key Decisions

1. **Migrate capability search to QUERY** — Current `POST /api/providers/:id/capabilities/search` is semantically incorrect for a read operation. QUERY provides proper semantics.

2. **Implement dual-method support** — Run QUERY alongside existing POST endpoint with feature detection. Deprecate POST after browser adoption.

3. **Cache via Location header pattern** — Server assigns URI for equivalent resource, enabling GET-based caching for subsequent requests.

4. **Add Accept-Query header** — Advertise supported query formats on QUERY-capable endpoints.

## Evidence Summary

- **RFC 10008 §2**: QUERY is explicitly safe and idempotent, allowing automatic retries without partial state change concerns ([Source](https://www.rfc-editor.org/rfc/rfc10008.html), High confidence)
- **RFC 10008 §2.7**: Cache key must incorporate request content — body-aware caching required ([Source](https://www.rfc-editor.org/rfc/rfc10008.html), High confidence)
- **Node.js support**: Native QUERY parsing available since early 2024 ([Source](https://github.com/hardik-goel/http-queryable), High confidence)
- **Browser support gap**: Chrome/Firefox/Safari evaluating; fetch() not yet supporting QUERY (July 2026 status, [Source](https://dev.to/islamhafez0/post-search-is-a-lie-http-finally-admits-it-7jn), High confidence)
- **CORS preflight required**: QUERY not CORS-safelisted, requires OPTIONS preflight ([Source](https://http.dev/query), High confidence)

## Recommendations for vivim-final

### Immediate (Phase 1)
- Update `src/server/conversation-router.ts` to accept QUERY on capability endpoints
- Add `Accept-Query: application/json` response header on GET endpoints to advertise support
- Implement body-aware caching for in-memory cache (SHA-256 of normalized body + URL)

### Near-term (Phase 2)
- Add CORS preflight support for QUERY method
- Document migration path for SDK clients
- Monitor browser adoption quarterly

### Future (Phase 3)
- Consider QUERY for complex block filtering endpoints
- Evaluate http-queryable Node library for production caching
- Potentially expose QUERY on fleet status endpoints

## Open Questions

- **When will browser fetch() support QUERY?** No ETA from vendors as of July 2026.
- **How to handle cache key normalization for JSON bodies?** Need to decide on conservative vs aggressive normalization strategy.
- **Should Location header URIs be persistent?** RFC allows temporary URIs; vivim-final may want persistent saved queries.

## Used In

- **API Endpoint Refactoring**: Migrate `POST /api/providers/:id/capabilities/search` to QUERY
- **CapabilityResolutionEngine**: Result caching strategy enhancement
- **SDK Client**: Add query() method alongside searchCapabilities()

---

**Verification:** All claims cross-referenced. RFC 10008 is authoritative source. Implementation status verified via multiple technical blogs and GitHub repositories.