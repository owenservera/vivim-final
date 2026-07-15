# PRD-DISC-5: HTTP QUERY Method + Body Cache + ETag

**Status:** Proposed · **Priority:** P1 · **Phase:** 1 (atomic-v12 1.5)
**Owner:** vivim-runtime · **Depends on:** none

## 1. Problem
`src/server/index.ts` only registers `GET`/`POST`/`PUT`/`DELETE`. There is no `QUERY` method (the
cap-store pattern for safe, body-bearing reads) and no response caching/ETag. The runtime-OS test/debug
steps (R3) and the loop hammer endpoints repeatedly; without `QUERY` + cache the loop is slow and
cannot do conditional requests. This PRD adds `QUERY`, an in-memory body cache with TTL, and ETag
support — speeding R3/R5.

## 2. Current State (research-first)
- `src/server/index.ts:177` — `registerRoutes` wires GET/POST/PUT/DELETE only.
- No `QUERY` handler; no `Cache-Control`/`ETag` emitted.
- `capability-router.ts` / `response.ts` have no cache layer.

## 3. Design
- Add `app.query(path, handler)` (alias `app.use` with method `QUERY`) for safe reads with body.
- `response.ts`: `sendJson` gains optional `ETag` + `Cache-Control` from a `cacheKey`.
- A small `Map`-backed cache (`cacheKey → {etag, body, expires}`) with TTL (default 5s for loop).
- `GET /api/capabilities` returns `ETag`; repeat with `If-None-Match` → `304`.

## 4. Implementation Steps
1. `server/index.ts`: register `QUERY` method handler.
2. `response.ts`: add `etag`, `cacheTtl` options; emit headers; honour `If-None-Match`.
3. `capability-router.ts`: mark read routes cacheable with `cacheKey`.

## 5. Acceptance Criteria
- `curl -X QUERY /api/capabilities -d '{}'` → 200 with body.
- Second identical request with `If-None-Match: <etag>` → `304`.
- `bun run typecheck` clean.

## 6. Tests
- `tests/unit/server/response.test.ts`: etag + 304.
- `tests/integration/server/query.test.ts`: QUERY method + cache hit.

## 7. Dependencies
- Speeds R3 (test), R5 (orchestration loop). No hard block on other phases.
- Independent of other DISC PRDs.

## 8. Risks
- Over-caching stale caps during a loop → TTL short (5s) + bust on capability write.
