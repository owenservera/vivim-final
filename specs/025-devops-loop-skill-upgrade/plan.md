# Implementation Plan: DevOps Loop & Skill System Upgrade

**Branch**: `025-devops-loop-skill-upgrade` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/025-devops-loop-skill-upgrade/spec.md`

## Summary

Upgrade the devops autonomous loop and skill system to eliminate friction patterns identified in the 2026-07-19 audit:
1. Single-pass audit commit (`mark done` + commit in one step) — removes 2-commit anti-pattern.
2. Pre-compaction context checkpoint — preserves work before auto-compaction.
3. Subagent parallelize — fans out independent units.
4. Structured pino logging — replaces ad-hoc console.log.
5. OTel sink — traces LLM calls via gen_ai semantics.

All changes are tooling/doc only; no engine logic or atomic specs are modified (per audit non-goal).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 18, React Flow
**Storage**: SQLite via Prisma (dev.db)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: Parallelize reduces wall-clock for independent units by ≥40%; OTel adds <5ms overhead per span.
**Constraints**: Governor Canon, Store Contracts, One Entry Point, Research-First, Code Quality Standards, Testing Gates (all from VIVIM Constitution v1.0.0).

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: no engine imports BunCdpClient directly — N/A (no CDP changes)
- [x] Store Contracts: engines depend on contracts, not impls — N/A (no storage changes)
- [x] One Entry Point: new operations are UnifiedCapabilities — N/A (tooling only)
- [x] Custom errors: no raw `new Error()` in engines — N/A (no engine logic changes)
- [x] TypeScript strict: no `any`, `type` imports, `.js` extensions — applies to new `devops/*.ts` code
- [x] Tests: unit + integration + typecheck + lint gates — new commands get unit tests

## Project Structure

### Documentation (this feature)

```text
specs/025-devops-loop-skill-upgrade/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (modified)

```text
devops/
├── mark.ts              # FR-001: single-pass done+commit
├── parallelize.ts       # FR-005: subagent fan-out (NEW)
├── context-checkpoint.ts # FR-003: checkpoint config loader (NEW)
src/
├── lib/logger.ts        # FR-007: pino singleton (NEW)
├── engines/otel-sink.ts # FR-009: OTel sink (NEW)
.opencode/
└── plugin-context-checkpoint/index.ts  # FR-003: pre-compaction plugin (NEW)
scripts/
└── sync-skills.ps1      # existing (no change)
```

**Structure Decision**: Existing monorepo structure. New files follow engine/storage contract conventions where applicable (parallelize reads tracker; logger is a lib utility).

## Complexity Tracking

> No constitution violations. All changes are additive tooling.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    |            |                                     |
