# Investigation Report: DevOps Layer (13 subdirectories, 15+ files >10KB)

## Area Overview
- **Location**: `devops/`
- **Subdirectories**: agentic, audit-arch, audit-code, commands, deep-scan, desktop, llm-testing, opencode, roadmap, router, runtime-test, toolkit, truth
- **Largest Files**: `invariants.ts` (35.9KB), `code-index.ts` (28.8KB), `onboard-controller.ts` (26.5KB), `production-build.ts` (21.2KB), `decision.ts` (21.1KB), `goals.ts` (20.9KB)

---

## Finding 1: P0 — Multiple Oversized DevOps Files

**Files exceeding 20 KB**:
| File | Size |
|------|------|
| `invariants.ts` | 35.9 KB |
| `code-index.ts` | 28.8 KB |
| `onboard-controller.ts` | 26.5 KB |
| `production-build.ts` | 21.2 KB |
| `decision.ts` | 21.1 KB |
| `goals.ts` | 20.9 KB |

**Issue**: These are CLI scripts and orchestration modules doing too much. At 20-36KB each, they combine argument parsing, business logic, output formatting, and error handling.

**Resolution**:
1. Split each file by concern (e.g., `invariants/check.ts`, `invariants/format.ts`)
2. Extract shared utilities to `devops/shared/`
3. Add unit tests for each concern

---

## Finding 2: P1 — `invariants.ts` 35.9 KB Single File

**Location**: `devops/invariants.ts` (35,900 bytes)

**Issue**: This is the second-largest file in the entire codebase (after `autonomous-execution.ts`). It contains ALL invariant checks in a single file, making it extremely hard to maintain.

**Resolution**:
1. Split into `invariants/critical.ts`, `invariants/warnings.ts`, `invariants/info.ts`
2. Create `invariants/registry.ts` to manage all checks
3. Add descriptive error messages for each invariant

---

## Finding 3: P2 — `code-index.ts` 28.8 KB Single File

**Location**: `devops/code-index.ts` (28,800 bytes)

**Issue**: The code indexing tool is a single file that combines indexing, querying, and output formatting.

**Resolution**:
1. Split into `code-index/indexer.ts`, `code-index/query.ts`, `code-index/format.ts`
2. Add configuration options for indexing scope
3. Add incremental indexing support

---

## Summary

| Finding | Severity | Effort | Impact |
|---------|----------|--------|--------|
| 6 files >20KB | P0 | High | Maintainability |
| invariants.ts 35.9KB | P1 | High | Architecture |
| code-index.ts 28.8KB | P2 | Medium | Maintainability |

**Estimated Total Effort**: 5-7 days
