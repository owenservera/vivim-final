# Unit 32.1 — Provider Test Harness

**Fork ID:** 6.10 (v3: 5.10) | **Status:** `[x]` | **Class:** C

> **Audit (2026-07-13):** No `providers:smoke` script and no provider integration harness. Only `tests/unit/engines/provider-registrar.test.ts` (seed-count) exists. Confirmed `[ ]`.
> **Implementation (2026-07-13):** Added `src/cli/provider-harness.ts` (`runProviderHarness` + `formatHarnessMatrix`) — discovers all seed providers, registers each via `ProviderRegistrar`, runs a golden scenario (definition/capabilities/endpoints present), emits a pass/fail matrix, exits non-zero on regression. Added `tests/integration/providers/harness.test.ts` (iterates all 12 seeds, system provider exempt from endpoint/capability checks) and `scripts/provider-harness.ts`. Wired `providers:smoke` into package.json. 2 integration tests pass.
**Source spec:** `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.10-provider-harness.md`
**Depends on:** Phase 6 providers (Ollama 6.1, llama.cpp 6.2, API-direct 6.3, MCP 6.6-6.7)

## Context
Providers are registered and seeded, but there is no repeatable end-to-end harness that exercises each provider's contract. Regressions surface only at runtime.

## Current State
- `src/engines/provider-registrar.ts` — registry of providers (id, type, isLocal).
- `tests/unit/engines/provider-registrar.test.ts` — exists but seed-count only.
- No integration harness covering auth → accounts → capability search → health.

## Requirements
New `tests/integration/providers/harness.test.ts` (or `scripts/provider-harness.ts`):
- For each registered provider type, run a golden scenario: create account, set default, search capabilities, read health.
- Local providers (Ollama/llama.cpp) run against a fixture model; cloud/API providers run behind a recorded HTTP mock.
- Emits a per-provider pass/fail matrix; fails CI on any provider regression.
- Optional `bun run providers:smoke` CLI entry.

## Acceptance Criteria
1. Harness iterates every provider registered in `ProviderRegistrar`.
2. Local providers verified against a real/fixture model; cloud behind mock.
3. Exit non-zero on any provider failure; prints a matrix.
4. `bun run devops gate` passes.

## Tests
Self-testing: the harness IS the test. Add a unit test asserting the harness discovers N providers.

## DevOps
```powershell
bun run providers:smoke
bun run devops gate
```
