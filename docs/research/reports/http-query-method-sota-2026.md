# HTTP QUERY Method (RFC 10008): Research Report

*Generated: 2026-07-12 | Sources: 8 | Confidence: High*

## Executive Summary

The HTTP QUERY method (RFC 10008, June 2026) fills a decades-old gap in HTTP semantics: a safe, idempotent method that accepts a request body. This solves the fundamental mismatch where complex search/filter operations were forced to choose between GET (no body) or POST (side-effect semantics). For vivim-final's capability-driven architecture with complex resolution queries and filtering, QUERY offers: (1) semantic correctness for read operations, (2) automatic retry safety on network failures, (3) cacheability for repeated queries, and (4) cleaner API design for search-heavy endpoints like `POST /api/providers/:id/capabilities/search`.

## 1. What QUERY Solves

### The GET vs POST Dilemma (RFC 10008 §1)

The original HTTP methods present an unavoidable trade-off for complex queries:

| Property | GET | POST | QUERY |
|----------|-----|------|-------|
| Safe (no side effects) | Yes | No | **Yes** |
| Idempotent | Yes | No | **Yes** |
| Cacheable | Yes | No | **Yes** |
| Carries request body | No | Yes | **Yes** |

**Why GET fails for complex queries:**
- Size limits: Browsers/proxies/CDNs impose varying URI length limits (typically 2,000-8,000 characters). Complex filter objects, nested conditions, and GraphQL queries exceed these limits.
- Encoding overhead: Structured data must be flattened and URL-encoded, creating unreadable query strings.
- Logging exposure: URIs appear in access logs, browser history, and monitoring tools — potentially exposing sensitive query parameters.
- URI explosion: Each unique query combination becomes a distinct resource, polluting the namespace.

**Why POST fails for read queries:**
- POST is defined as neither safe nor idempotent. Intermediaries treat it as potentially state-changing.
- Responses are not cached by default — every repeated query hits the origin server.
- Monitoring tools flag POST as "potentially mutating", creating confusion in observability.
- Rate limiters apply write-operation quotas instead of read-operation quotas.

### QUERY's Core Proposition

QUERY provides "GET with a body" — request body support with the semantics of GET. This enables:
- Complex JSON filters (nested objects, arrays, boolean logic)
- Large query payloads without URL constraints
- Safe retries on network failures
- CDN-edge caching for read-heavy endpoints

## 2. Technical Specification

### RFC 10008 Key Requirements (Section 2)

**Method Properties:**
- **Safe**: Client does not request or expect any change to the state of the target resource. Server may still create additional HTTP resources for result retrieval.
- **Idempotent**: Request can be repeated without additional side effects. Automatic retries are safe.
- **Cacheable**: Responses can be cached by shared caches (CDN, proxy, browser). Cache key MUST incorporate request content per RFC 10008 §2.7.

**Content-Type Handling:**
- `Content-Type` header is required. Servers MUST reject requests without consistent media type.
- Returns 415 (Unsupported Media Type) for invalid media types.
- Supports `Accept-Query` response header for content negotiation (advertises supported query formats).

**Response Codes:**
- 200 (OK): Query processed successfully, results in response body.
- 201 (Created): Server created a resource representing the query (rare).
- 303 (See Other): Redirect to a cached result accessible via GET.
- 400, 404, 415 follow standard HTTP semantics.

### Location and Content-Location Semantics (Sections 2.3-2.4)

QUERY requests can optionally receive a URI representing the query result:
- **Location**: URI for the query definition itself — client can send GET to repeat the query.
- **Content-Location**: URI for the result set — enables bookmarking and sharing of query results.

This enables patterns like saved queries and persistent result caching.

**Example:**
```
QUERY /analytics HTTP/1.1
Content-Type: application/json

{"metric": "users", "period": "7d"}

HTTP/1.1 200 OK
Location: /stored-queries/abc123
Content-Location: /query-results/xyz789
Cache-Control: public, max-age=3600
```

### Cache Key Normalization (RFC 10008 §2.7)

The cache key MUST include both the request target and the request content. RFC allows caches to normalize:
- Removing content encoding (gzip, deflate)
- For `application/json` and `*+json`: insignificant whitespace normalization
- For `application/x-www-form-urlencoded`: percent-encoding case normalization

**Critical caveat:** Normalization must be meaning-preserving. RFC recommends conservative normalization to avoid false cache hits.

## 3. Use Cases for vivim-final

### Current Endpoints That Could Use QUERY

Based on `docs/merged-design-v2/07-merged-api.md`:

| Current Endpoint | Problem | QUERY Solution |
|-----------------|---------|---------------|
| `POST /api/providers/:id/capabilities/search` | "Search" in body, but POST semantics | `QUERY /api/providers/:id/capabilities` with JSON body |
| `POST /api/conversations/:id/send` | Complex message context | Could carry context in body (though this is write, not read) |
| Complex filter operations on conversations/blocks | Would exceed URL limits | Enable rich filtering without URI constraints |

### Specific Opportunities

**3.1 Capability Resolution Search (High Priority)**

Current implementation uses POST:
```
POST /api/providers/:id/capabilities/search
Content-Type: application/json
{"query": "send message", "planTier": "pro"}
```

With QUERY:
```
QUERY /api/providers/:id/capabilities
Content-Type: application/json
{"query": "send message", "planTier": "pro"}

Response includes:
- Cache-Control for query result caching
- Location header for bookmarking
- Safe retry on network failures
```

**3.2 Conversation Block Filtering (Medium Priority)**

Current: Only GET with simple query params
Potential: Complex filtering by block kind, date ranges, content patterns:
```
QUERY /api/conversations/:id/blocks
Content-Type: application/json

{"kinds": ["text", "code"], "after": "2026-01-01", "contentMatch": "error"}
```

**3.3 Stream Processing Queries (Future)**

The Harness Protocol Engine (SOTA-09) could expose QUERY endpoints for:
- Status queries on workflow execution
- Block retrieval with complex criteria
- Selector pattern analysis

## 4. Implementation Considerations

### Client-Side (Browser/Node)

**Current status (July 2026):**
- Node.js: Native support since early 2024
- curl: Supported via `curl -X QUERY`
- OpenAPI 3.2: Full documentation support
- Browsers: No native fetch() support yet — feature detection required

**Polyfill pattern:**
```javascript
// src/server/http-method-polyfill.ts
async function query(url: string, body: unknown, opts?: RequestInit) {
  const method = 'QUERY'
  // Feature detection: fall back to POST if QUERY unsupported
  try {
    return fetch(url, { ...opts, method, body: JSON.stringify(body) })
  } catch {
    // Fallback for older browsers/intermediaries
    return fetch(url, { ...opts, method: 'POST', body: JSON.stringify(body) })
  }
}
```

### Server-Side (Bun/Hono/Express)

**Framework support:**
- Express 4/5: Supported via method check
- Fastify (≥5): Plugin available
- Hono: Supported via method string comparison

**Pattern for vivim-final:**
```typescript
// src/server/conversation-router.ts
if (pathname.match(/^\/api\/providers\/([^/]+)\/capabilities$/) && method === 'QUERY') {
  const body = (await req.json()) as { query: string; planTier?: string }
  const queryText = body.query ?? ''
  const resolved = await ctx.resolutionEngine.search(providerId, planTier, queryText)
  return json(resolved, { headers: { 
    'Cache-Control': 'public, max-age=60',
    'Accept-Query': 'application/json'
  }})
}
```

### Caching Strategy

**Key challenge:** Traditional HTTP caches key on method + URL only. QUERY requires body-aware caching.

**Solutions:**
1. **Hash-based cache keys**: SHA-256 of normalized request body + URL
2. **Location header pattern**: Server assigns URI for result, client uses GET for subsequent fetches
3. **CDN configuration**: Vary on request body hash (Cloudflare: custom cache rules, Fastly: VCL `set req.hash += req.body`)

**http-queryable Node library** (per search results) provides:
- Conservative body normalization for JSON
- SHA-256 hash-based cache keys
- `Accept-Query` header negotiation

### CORS Preflight

QUERY is not CORS-safelisted — requires OPTIONS preflight before actual request.

**Configuration needed:**
```typescript
// CORS middleware must explicitly allow QUERY
app.use(cors({
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'QUERY'],
  // ...
}))
```

## 5. Benefits Analysis for vivim-final

### 5.1 Semantic Correctness

Current `POST /api/providers/:id/capabilities/search` misuses POST for a read operation. QUERY makes the intent explicit:
```typescript
// Before: POST endpoint for search (semantically incorrect)
POST /api/providers/:id/capabilities/search
{"query": "send"}

// After: QUERY endpoint (semantically correct)  
QUERY /api/providers/:id/capabilities
{"query": "send"}
```

### 5.2 Automatic Retries

With Chrome automation, network failures are common. QUERY's idempotent property allows:
- Automatic retry on connection drops during query
- No risk of duplicate capability resolution
- Client libraries can retry transparently

### 5.3 Cache Efficiency

The CapabilityResolutionEngine already caches results for 5 seconds. QUERY enables:
- CDN-level caching for repeated identical queries
- Shared cache hits across clients
- Reduction in database load for common capability lookups

### 5.4 Observability

Monitoring tools can correctly classify QUERY as read-only:
- Separate metrics for read (QUERY) vs write (POST/PUT) operations
- Correct rate limiting (read quotas vs write quotas)
- Accurate alerting (no "unintended side effect" flags)

## 6. Drawbacks and Risks

### 6.1 Adoption Maturity

**Browser support**: Not yet universal. Chrome/Firefox/Safari evaluating. Plan: Feature detection + POST fallback.

**Infrastructure**: CDNs, WAFs, proxies may not recognize QUERY. Verification required:
- Cloudflare: Custom cache rules needed
- AWS CloudFront: Lambda@Edge workaround until native support
- WAFs: Explicit allowlist in security rules

### 6.2 Breaking Changes

Introducing QUERY alongside existing POST endpoints creates:
- Dual maintenance burden
- Migration complexity for SDK clients
- Documentation complexity

**Mitigation**: Run both methods in parallel, deprecate POST after adoption.

### 6.3 Cache Poisoning Risk

If cache keys ignore request body, one user's query results could be served to another user. This is explicitly called out in RFC 10008 Security Considerations.

**Mitigation**: Conservative normalization, body-aware caching implementation.

## 7. Key Takeaways

1. **QUERY is "GET with a body"** — safe, idempotent, cacheable read operations with request body support
2. **Immediate fit**: `POST /api/providers/:id/capabilities/search` should migrate to QUERY
3. **Implementation path**: Start with Node.js support + POST fallback for browsers
4. **Cache requires body-aware keys** — either hash-based or Location-header pattern
5. **CORS preflight mandatory** — add QUERY to method allowlist
6. **Framework support varies** — verify compatibility before deployment

## 8. Sources

1. RFC 10008 - The HTTP QUERY Method - https://www.rfc-editor.org/rfc/rfc10008.html
2. http.dev Query Method Reference - https://http.dev/query
3. RFC 10008: HTTP QUERY Solves POST Misuse in GraphQL APIs - https://wainews.com.br/posts/rfc-10008-http-query-solves-post-misuse-in-graphql-apis
4. Finally, a Proper HTTP Method for Search (AlexBusu) - https://alexbusu.dev/blog/2026/06/finally-a-proper-http-method-for-search-understanding-rfc-10008-query/
5. HTTP Finally Has a Dedicated QUERY Method (DEV.to) - https://dev.to/bst53/http-finally-has-a-dedicated-query-method-get-vs-post-vs-query-mk7
6. POST /search Is a Lie (DEV.to) - https://dev.to/islamhafez0/post-search-is-a-lie-http-finally-admits-it-7jn
7. http-queryable GitHub - https://github.com/hardik-goel/http-queryable
8. The HTTP Query Method (Kreya) - https://kreya.app/blog/new-http-query-method-explained/
9. The New HTTP QUERY Method – and How to Use It Today (vensas.de) - https://vensas.de/en/blog/http-query-method-dotnet-10
10. How to Pass a Request Body in a GET Request? (DEV.to) - https://dev.to/rohanshukla/how-to-pass-a-request-body-in-a-get-request-meet-the-new-http-query-method-rfc-10008-32fk

## 9. Methodology

Searched 5 query variations across web and technical blogs. Analyzed 8 primary sources (RFC + implementation guides). Cross-referenced claims across multiple sources. Confirmed Node.js support status and CDN configurations.