# Implementation Plan: Production Hardening & Sovereign Trust

**Branch**: `001-production-hardening` | **Date**: 2025-07-17 | **Spec**: `specs/001-production-hardening/spec.md`

**Input**: Feature specification from `specs/001-production-hardening/spec.md`

## Summary

Verify and complete production hardening fixes for P0 violations, then fill remaining gaps in the sovereign trust engine layer. **Key finding from code research**: ConsentEngine, TrustScoreEngine, consent gate wiring, trust score integration in ProviderHealthKernel, HITL gate UI, and smoke tests ALL already exist. The primary remaining work is verification, unit testing, and CHANGELOG correction.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 18, React Flow
**Storage**: SQLite via Prisma (dev.db)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: Trust score computation <100ms per provider, consent gate check <1ms (in-memory)
**Constraints**: Governor Canon (no engine imports BunCdpClient), Store Contracts, One Entry Point, no raw Error

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] **Governor Canon**: No new CDP imports — engines already use correct patterns
- [x] **Store Contracts**: New store contracts follow interface-first pattern (if any new ones needed)
- [x] **One Entry Point**: No new CLI/UI bypass — all ops via existing UnifiedCapability framework
- [x] **Custom errors**: `ConsentViolationError`, `HitlGateExpiredError`, `HitlGateDeniedError` already in `src/errors.ts`
- [x] **TypeScript strict**: Existing code follows strict mode, `type` imports, `.js` extensions
- [x] **Testing**: Tests use Bun test runner, mocked store contracts

**Gate result**: PASS — no constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/001-production-hardening/
├── plan.md              # This file
├── research.md          # Phase 0 output — code audit findings
├── data-model.md        # Phase 1 output — entity definitions
├── quickstart.md        # Phase 1 output — validation guide
├── contracts/           # Phase 1 output — store contract specs
│   └── consent-store.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (files touched)

```text
src/engines/
├── consent-engine.ts          # EXISTS — add unit tests
├── trust-score.ts             # EXISTS — add unit tests
├── provider-health.ts         # EXISTS — trust score already wired
├── capability-bootstrap.ts    # EXISTS — consent gates already wired
├── autonomous-execution.ts    # EXISTS — consentCheck already present
└── cdp-capability-registrar.ts # EXISTS — B1 already resolved

src/
├── errors.ts                  # EXISTS — all needed error classes present

web/sandbox/src/features/
├── hitl-gate.tsx              # EXISTS — verify functionality

tests/
├── unit/engines/
│   ├── consent-engine.test.ts # NEW — unit tests
│   └── trust-score.test.ts    # NEW — unit tests
├── e2e/
│   └── smoke.test.ts          # EXISTS — verify/enhance

CHANGELOG.md                   # EXISTS — correct Phase 31
```

**Structure Decision**: Existing monorepo structure. Focus is on test creation and verification, not new engine files.

## Complexity Tracking

No constitution violations to justify. All work follows existing patterns.
