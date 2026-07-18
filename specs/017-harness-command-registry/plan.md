# Implementation Plan: Harness Command Registry

**Branch**: `017-harness-command-registry` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-harness-command-registry/spec.md`

## Summary

Re-home the pasted Playwright-based WebApp LLM I/O harness design onto vivim-final's
existing primitives: the `HarnessDAG`/`HarnessNode` engine inside `ChromeGovernor` and the
Harness Protocol Engine (HPE) design in `sota-09`. Deliver a **versioned harness command
registry** (`harness_command` table, seeded) and a **store-contract-driven repair engine**
that turns non-conformant WebApp JSON into typed Zod data — with real `retry`/`branch` DAG
node execution so transient failures and provider quirks self-heal. The result is an
integrated command/repair unit designed around the audit's known limitations (F2.1, F2.3, F3.x)
from day 0, with zero Governor-Canon violations and no new runtime dependencies.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod 3.24, React 18, React Flow — **no new deps** (no playwright/cheerio/jsonrepair)
**Storage**: SQLite via Prisma (`dev.db`); new `harness_command` table seeded from `seeds/harness-commands/*.json`
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: augment <5ms, extract/repair <200ms for <100KB (sota-09 NFR-1/2); retry backoff configurable.
**Constraints**: Governor Canon (only `ChromeGovernor` touches `BunCdpClient`), Store Contracts (repair engine depends on a contract, never on `impl`), One Entry Point (registry consumed via existing capability surface; no new transport).

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] **Governor Canon**: The repair engine (`HarnessRepairEngine`) has **no browser access** — it consumes `CaptureResult.body` (a string). All CDP is driven exclusively through `ChromeGovernor.executeHarnessPlan`, which already owns `BunCdpClient`. The `retry`/`branch` node execution lives *inside* `executeHarnessPlan`. No engine imports `BunCdpClient`. ✅
- [x] **Store Contracts**: `HarnessRepairEngine` depends on a `HarnessRepairStore` contract (interface in `src/storage/contracts/`); the Prisma impl lives in `src/storage/impl/`. `ChromeGovernor` already depends on `GovernorStore` contract. ✅
- [x] **One Entry Point**: The harness command registry is resolved and executed through the existing `ChromeGovernor.executeHarnessPlan` + a new `HarnessCommandRegistry` consumed by the capability layer (no new CLI/UI transport; if a capability is needed, it registers in a `*caps.ts` module per AGENTS.md). ✅
- [x] **Custom errors**: A `HarnessRepairError` (and reuse of `EngineError`) from `src/errors.ts` — no raw `new Error()` in engines. ✅
- [x] **TypeScript strict**: `type` imports, `.js` extensions, `unknown` + narrowing, no `any`. ✅
- [x] **Tests**: unit (repair engine, registry resolver, DAG executor with mock transport), integration (governor + mock store), typecheck + lint gates. ✅

## Project Structure

### Documentation (this feature)

```text
specs/017-harness-command-registry/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (additions / edits)

```text
src/
├── engines/
│   ├── chrome-governor.ts        # EDIT: implement retry/branch/sequence/precondition in executeHarnessPlan
│   ├── harness-repair-engine.ts  # NEW: store-contract-driven repair pipeline (FR-006..FR-012)
│   └── harness-command-registry.ts # NEW: versioned command registry + semver resolve (FR-001, FR-002, FR-010)
├── schema/
│   └── repair-metadata.ts        # NEW: RepairMetadata side-table + repair-aware field helpers (FR-008)
├── storage/
│   ├── contracts/
│   │   ├── governor-store.ts      # EDIT: add harness_command rows
│   │   └── harness-repair-store.ts # NEW: contract for repair persistence (FR-006)
│   └── impl/
│       ├── governor-store-impl.ts # EDIT: harness_command impl
│       └── harness-repair-store-impl.ts # NEW
├── errors.ts                      # EDIT: add HarnessRepairError
prisma/schema.prisma               # EDIT: add HarnessCommand model
seeds/harness-commands/            # NEW: JSON seed manifests
└── tests/
    ├── unit/engines/
    │   ├── harness-repair-engine.test.ts
    │   ├── harness-command-registry.test.ts
    │   └── chrome-governor-retry.test.ts
    └── integration/
        └── harness-registry-governor.test.ts
```

**Structure Decision**: Extends the existing 13-engine monorepo. Repair engine is a new engine
file following the one-file-per-engine convention; registry is a new engine-style module;
both are wired through existing contracts. No new surface.

## Complexity Tracking

> No constitution violations. All constraints satisfied by routing CDP exclusively through `ChromeGovernor` and keeping the repair engine browser-free.

## Design Notes (mapping pasted design → repo primitives)

| Pasted design component | Repo primitive it becomes |
|---|---|
| `WebAppDriver` (Playwright) | `ChromeGovernor.executeHarnessPlan` DAG nodes (`type_text`/`submit`/`capture`) — CDP, Governor-Canon compliant |
| `ResponseExtractor` (cheerio) | `HarnessRepairEngine.extract()` — Bun-native regex/HTML strip on `CaptureResult.body` (FR-014) |
| `RepairPipeline` (jsonrepair) | `HarnessRepairEngine.repair()` — local strategy chain, no external dep |
| `z.ZodType.prototype.repair` monkey-patch | `RepairMetadata` side-table `Map<ZodType, RepairMetadata>` (FR-008) |
| `SchemaRegistry` (lexicographic `latest`) | `HarnessCommandRegistry.resolve('latest')` semver-ordered (FR-010) |
| `FeedbackEngine` (same prompt each round) | `HarnessFeedbackCoordinator` with path-specific errors + exponential backoff (FR-012) |
| `LLMHarness` orchestrator | `retry`/`branch` `HarnessNode` types executed inside `executeHarnessPlan` (FR-003..FR-005) |

### Known defects fixed (from critique)
1. Zod prototype pollution → side-table metadata (FR-008).
2. Blind `'`→`"` rewrite corrupts `O'Brien` → apostrophe-safe repair (FR-009).
3. Lexicographic version sort (`'10' < '2'`) → semver (FR-010).
4. `waitForFunction` arg-name mismatch → not reproduced (Bun CDP path used instead).
5. Feedback prompt storm → backoff + diff (FR-012).
6. No boilerplate strip → `structure_detect` strips pleasantries/disclaimers (FR-011).
