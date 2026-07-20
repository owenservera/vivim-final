# Implementation Plan: OpenCode `serve` Backend Integration (v2 persistent harness)

**Branch**: `027-opencode-serve` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/027-opencode-serve/spec.md`

## Summary

Build the v2 persistent OpenCode surface: a supervised local `opencode serve` process, an HTTP/SSE
client that talks its API, and an ingest engine that projects served sessions into the four OpenCode
landing tables (`AgentSession`/`AgentPermissionDecision`/`AgentFileEdit`) plus the durable hash-chained
`EventRecord` outbox, and renders each session as a vivim chat thread via the Option C chat methods.
Governor owns permission decisions in-process (tier > 3 auto-denied). All wiring is additive,
env-gated, and OFF by default (local-first). Reuses the verified `parseOpencodeJson` grammar and the
`opencode` `ProviderDefinition` seeded by feature `022` — no new Prisma tables, no new message table.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod
**Storage**: SQLite via Prisma (dev.db) — reuse AgentSession/AgentPermissionDecision/AgentFileEdit/EventRecord
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (13 engines + API)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: Cold-start readiness poll bounded; supervisor restart backoff capped (max 5 attempts).
**Constraints**: Governor Canon (no engine imports BunCdpClient); Store Contracts (ingest depends on
`AgenticStoreContract` + `EventRecordStore`, not impls directly where possible); no `any`; custom errors
(`EngineError`); ULID via `src/ids.ts`; `.js` imports; localhost-only + password for `serve`.

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: `opencode-supervisor.ts` spawns `opencode serve` via `Bun.spawn`; imports nothing from `chrome-governor`/`BunCdpClient`.
- [x] Store Contracts: `opencode-ingest.ts` depends on `AgenticStoreContract` + `EventRecordStore` interfaces.
- [x] One Entry Point: the serve surface is opt-in via env/capability, not a new transport for existing ops; `cap:agent:run` (022) untouched.
- [x] Custom errors: engines throw `EngineError` from `src/errors.ts`, never raw `new Error()`.
- [x] TypeScript strict: no `any`, `type` imports, `.js` extensions.
- [x] Tests: S1/S2/S3 integration + unit grammar tests; `bun build` import gate (no full `tsc` per coordination plan).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code

```text
src/
├── engines/             # Engine implementations
├── storage/
│   ├── contracts/       # Engine-facing interfaces
│   └── impl/            # Prisma-backed implementations
├── server/              # HTTP routes + WebSocket
├── canvas/              # Canvas engine layer
├── schema/              # Zod schemas
├── cli/                 # CLI entry points
├── config.ts            # Configuration
├── errors.ts            # Custom error classes
├── ids.ts               # ULID generation
└── index.ts             # Barrel exports

web/
├── ui/src/
│   └── features/
│       ├── canvas/      # React Flow canvas components
│       └── chat/        # Chat UI components
└── sandbox/src/
    └── features/        # Sandbox frontend features

tests/
├── unit/engines/        # Engine unit tests
├── integration/         # Engine interaction tests
└── e2e/                 # Full stack tests
```

**Structure Decision**: Existing monorepo structure with 13 engines, Prisma ORM, and React Flow canvas frontend.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., raw SQL] | [performance-critical path] | [why Prisma query insufficient] |
