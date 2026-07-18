# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `specs/[###-feature-name]/spec.md`

## Summary

[Extract from feature spec: primary requirement + technical approach]

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 18, React Flow
**Storage**: SQLite via Prisma (dev.db)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: [domain-specific]
**Constraints**: [domain-specific, e.g., Governor Canon, Store Contracts, One Entry Point]

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [ ] Governor Canon: no engine imports BunCdpClient directly
- [ ] Store Contracts: engines depend on contracts, not impls
- [ ] One Entry Point: new operations are UnifiedCapabilities
- [ ] Custom errors: no raw `new Error()` in engines
- [ ] TypeScript strict: no `any`, `type` imports, `.js` extensions
- [ ] Tests: unit + integration + typecheck + lint gates

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
