# Investigation Report: Tests Layer (470 files)

## Area Overview
- **Total Test Files**: 470
- **Structure**: `tests/unit/` (356), `tests/integration/` (57), `tests/e2e/` (24), `tests/arch/` (7), `tests/helpers/` (5), `tests/cli/` (2), `tests/fixtures/` (3)
- **Engine Tests**: 250 files in `tests/unit/engines/` alone

---

## Finding 1: P1 — Test Files With `as any` Cast

**Location**: `tests/unit/engines/_probe.test.ts` (lines 4, 20, 27, 28, etc.)

```typescript
function makeConv(o?: any) { ... }
const store: any = { ... }
const gov: any = { ... }
```

**Issue**: This test uses `any` casts liberally, defeating TypeScript's safety and potentially hiding real type mismatches.

**Resolution**:
1. Type all mock objects with their proper interfaces (`ConversationStore`, `ChromeGovernor`)
2. Use `Partial<T>` for mock objects instead of `any`
3. Create shared mock factories in `tests/helpers/`

---

## Finding 2: P2 — Placeholder/Temporary Test Files

**Files identified**:
- `tests/unit/engines/_trivial.test.ts` (29 lines) — Tests a single error path with minimal coverage
- `tests/unit/engines/_sp_copy.test.ts` — Appears to be a copy/scaffold
- `tests/unit/engines/.tmp-export-test/` — Temporary test directory

**Issue**: These files are scaffolds or temporary tests that should be completed or removed.

**Resolution**:
1. Complete `_trivial.test.ts` with comprehensive stream-parser coverage
2. Delete `.tmp-export-test/` directory
3. Review `_sp_copy.test.ts` and either complete or remove

---

## Finding 3: P3 — No E2E Test Infrastructure Evidence

**Location**: `tests/e2e/` (24 files)

**Issue**: The E2E test directory has files, but no evidence of Playwright configuration or test runner setup in the project root (no `playwright.config.ts` found in the initial scan).

**Resolution**:
1. Verify Playwright is installed and configured
2. Add `playwright.config.ts` to project root if missing
3. Document E2E test running procedure

---

## Summary

| Finding | Severity | Effort | Impact |
|---------|----------|--------|--------|
| `as any` casts in tests | P1 | Medium | Test reliability |
| Placeholder test files | P2 | Low | Code hygiene |
| E2E infrastructure gaps | P3 | Medium | Testing coverage |

**Estimated Total Effort**: 2-3 days
