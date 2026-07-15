# Unit 37.4 — API Documentation (OpenAPI)

**Fork ID:** 13.6 (v3: 10.6) | **Status:** `[ ]` | **Class:** C

> **Audit (2026-07-13):** No `docs/api/` directory, no `openapi.yaml`, no `build-openapi.ts`. Routers + Zod schemas exist but are not harvested into OpenAPI. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.6-api-documentation.md`
**Depends on:** all routers

## Context
Every HTTP endpoint documented with params, request/response schemas, examples — auto-generated from a route→schema map. Published to `docs/api/` as YAML + rendered HTML.

## Current State
- `src/server/*-router.ts` routers exist; `src/schema/*` Zod schemas exist.
- No OpenAPI generator.

## Requirements
New `docs/api/build-openapi.ts`:
- `RouteSpec { method, path, requestSchema?, responseSchema, example }` per route.
- `buildOpenApi(specs)` → OpenAPI 3.1 doc from `src/schema/*` Zod defs.
- Output `docs/api/openapi.yaml` + rendered `openapi.html`.
- Idempotent.

## Acceptance Criteria
1. `openapi.yaml` valid 3.1 covering every route in `src/server/*-router.ts`.
2. Each op documents params, request/response schema, example.
3. Schemas sourced from Zod (no hand-duplicated JSON).
4. Rendered HTML produced; generator idempotent.
5. `bun run devops gate` passes.

## Tests
`tests/unit/api/openapi.test.ts` — build with real router specs → valid doc; path count ≥ registered routes; every path has `responses.200`.

## DevOps
```powershell
bun run docs/api/build-openapi.ts
bun run devops gate
```
