# Implementation Plan: OpenCode Serve Capability Integration (029)

**Feature**: 029 | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

## Summary

Wire the existing OpenCode serve infrastructure (027) into vivim's capability system. Create an
executor for NLCL routing, register 4 capabilities, add NL patterns, and expose API routes.
All additive — env-gated, default OFF, no schema changes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod
**Storage**: No new tables — reuse AgentSession/EventRecord from 027
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server

## Constitution Check

- [x] Governor Canon: executor imports OpenCodeClient (HTTP), not CDP
- [x] Store Contracts: depends on OpenCodeClient + OpenCodeIngest interfaces
- [x] One Entry Point: capabilities registered via `makeCapability`, routed through `/api/interpret`
- [x] Custom errors: uses `OpenCodeServeError` from `src/errors.ts`
- [x] TypeScript strict: no `any`, `type` imports, `.js` extensions

## Project Structure

### Source Code

```text
src/engines/opencode/
├── opencode-supervisor.ts       # (027) existing
├── opencode-client.ts           # (027) existing
├── opencode-ingest.ts           # (027) existing
├── opencode-executor.ts         # (029) NEW — NLCL executor
└── types.ts                     # (027) existing

src/engines/capability-bootstrap.ts  # (029) MODIFY — register 4 capabilities
src/engines/nlcl/catalog.ts          # (029) MODIFY — add NL patterns
src/engines/nlcl/nlcl-engine.ts      # (029) MODIFY — register executor
src/server/index.ts                  # (029) MODIFY — API routes + boot wiring
```

### Tests

```text
tests/unit/engines/opencode-executor.test.ts   # (029) NEW
tests/integration/opencode/                     # (027) existing — should still pass
```

## Implementation Order

### Phase 1: Executor (Core)

1. Create `src/engines/opencode/opencode-executor.ts` — NLCL executor class
2. Register executor in `nlcl-engine.ts`
3. Add unit test

### Phase 2: Capabilities

4. Add `opencodeClient`/`opencodeIngest` to `BootstrapServices` interface
5. Register 4 capabilities in `capability-bootstrap.ts`
6. Pass objects from `globalThis.__opencodeServe` in `server/index.ts`

### Phase 3: NL Patterns

7. Add `opencodePatterns` to `catalog.ts`
8. Spread into `getDefaultCommandPatterns()`

### Phase 4: API Routes

9. Add `POST /api/opencode/send` route
10. Add `POST /api/opencode/session` route
11. Add `GET /api/opencode/sessions` route
12. Add `POST /api/opencode/permission/:id` route

### Phase 5: Gate

13. `bun run typecheck` — 0 errors
14. `bun run lint` — 0 warnings
15. `bun test` — all pass
16. `bun run devops runtime-test test --nl="send message to opencode"` — resolves
