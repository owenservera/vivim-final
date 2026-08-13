# Codebase Investigation — Final Summary Report

**Date**: August 12, 2025  
**Project**: vivim-final  
**Scanned**: 937 TypeScript files (src), 470 test files, 3,897-line Prisma schema (196 models), 219 frontend components, 179 engine files, 13 devops subdirectories, 40+ seed files

---

## Executive Summary

The codebase is **architecturally sound** with clear separation of concerns (contracts → impl → engines → API → CLI/UI). However, several **systemic issues** require attention before scaling. The most critical are: oversized files that are hard to maintain, empty catch blocks that hide errors, and scattered `any` type usage that defeats TypeScript's safety.

---

## Critical Findings by Severity

### P0 — Must Fix (Production Risk)

| # | Finding | Files | Effort |
|---|---------|-------|--------|
| 1 | Hardcoded default secret in config | `src/config.ts:432` | 1h |
| 2 | 100+ silent catch-all blocks | 179 engine files | 3-5d |
| 3 | 3.9KB Prisma schema (196 models) | `prisma/schema.prisma` | 1-2d |
| 4 | PrismaLoose `any` escape hatch | `src/storage/impl/prisma-client.ts` | 2-4h |
| 5 | 6 devops files >20KB | `devops/invariants.ts` (35.9KB) etc. | 5-7d |
| 6 | `autonomous-execution.ts` 43.4KB | `src/engines/autonomous-execution.ts` | 1d |

### P1 — Should Fix (Architecture/Quality)

| # | Finding | Files | Effort |
|---|---------|-------|--------|
| 7 | FNV-1a hash fallback (non-crypto) | `src/ids.ts:60` | 1h |
| 8 | CORS wildcard allowedOrigins | `src/server/index.ts` | 1h |
| 9 | Cache sweep timer leak on rejection | `src/server/index.ts` | 2h |
| 10 | plugin-router.ts 24KB, conversation-router.ts 16KB | `src/server/routers/` | 2-3d |
| 11 | Wrong import path in capability.ts | `src/engines/capability.ts:12` | 30m |
| 12 | 11 engine files >20KB | `src/engines/*.ts` | 3-5d |
| 13 | In-memory store in chrome-governor | `src/engines/chrome-governor.ts` | 2h |
| 14 | manifests.ts 32.5KB | `seeds/providers/manifests.ts` | 1d |
| 15 | 4 frontend components >20KB | `frontend/src/` | 2-3d |
| 16 | Test files with `as any` | `tests/unit/engines/_probe.test.ts` | 1d |
| 17 | Global mutable CLI state | `src/cli/index.ts:12-22` | 2h |
| 18 | Empty metrics-registry.ts (stub) | `src/engines/metrics-registry.ts` | 30m |

### P2 — Nice to Fix (Code Hygiene)

| # | Finding | Files | Effort |
|---|---------|-------|--------|
| 19 | Barrel export of impl files | `src/index.ts` | 2h |
| 20 | Side effects at import time | `src/index.ts:312-323` | 1h |
| 21 | Commented-out code | `src/server/routers/audit-comment-router.ts` | 30m |
| 22 | Missing error cause chain | `src/errors.ts` | 1h |
| 23 | Empty StoreFactory | `src/storage/factory.ts` | 30m |
| 24 | Duplicate seed.ts files | `seeds/capabilities/seed.ts`, `seeds/parsers/seed.ts` | 1d |
| 25 | Placeholder test files | `tests/unit/engines/_trivial.test.ts` etc. | 1d |

### P3 — Consider Fixing (Low Priority)

| # | Finding | Files | Effort |
|---|---------|-------|--------|
| 26 | No body size limit on POST routes | `src/server/routers/conversation-router.ts` | 1h |
| 27 | In-memory filtering for large datasets | `src/storage/impl/node-store.ts` | 1d |
| 28 | Dependency bloat risk (40+ Radix UI) | `frontend/package.json` | 1d |
| 29 | Legacy capability port (17.6KB) | `seeds/capabilities/og-capability-port.ts` | 2h |

---

## Area-by-Area Summary

| Area | Files | P0 | P1 | P2 | P3 | Total |
|------|-------|----|----|----|----|-------|
| Core (`src/`) | 4 | 1 | 1 | 3 | 0 | **5** |
| Storage | 130 | 2 | 0 | 2 | 1 | **5** |
| Server/API | 46 | 0 | 3 | 2 | 1 | **6** |
| CLI | 9 | 0 | 1 | 0 | 0 | **1** |
| Engines | 179 | 2 | 3 | 1 | 1 | **7** |
| Frontend | 219 | 0 | 1 | 1 | 1 | **3** |
| Tests | 470 | 0 | 1 | 1 | 1 | **3** |
| Seeds | 40 | 0 | 1 | 1 | 1 | **3** |
| DevOps | 50+ | 1 | 1 | 1 | 0 | **3** |
| **Total** | **937+** | **6** | **12** | **12** | **6** | **36** |

---

## Risk Matrix

```
           High Impact
               │
    ┌──────────┼──────────┐
    │  P0 #1   │  P0 #6   │  ← Fix immediately
    │  Secret  │  43KB    │
    │  Hardcoded│ file    │
    ├──────────┼──────────┤
    │  P1 #2   │  P1 #10  │  ← Fix soon
    │  Silent  │  Router  │
    │  catches │  bloat   │
    └──────────┼──────────┘
               │
           Low Impact
    ← Quick Win        Technical Debt →
```

---

## Recommended Fix Order

### Week 1: Critical Security + Architecture
1. Replace hardcoded secret with env variable (`config.ts:432`)
2. Add `catchDebug()` to all empty catch blocks (engines)
3. Fix CORS wildcard to explicit origins
4. Fix cache timer leak
5. Split `autonomous-execution.ts` (43.4KB)

### Week 2: Architecture + Large Files
6. Split `invariants.ts` (35.9KB)
7. Split `manifests.ts` (32.5KB)
8. Split `plugin-router.ts` (24KB)
9. Split `conversation-router.ts` (16KB)
10. Fix wrong import in `capability.ts`

### Week 3: Code Quality + Testing
11. Replace `any` casts in test files
12. Remove commented-out code
13. Complete placeholder tests
14. Add error cause chain to custom errors
15. Clean up stub files (metrics-registry, plugin-manager-impl)

### Week 4: Polish + Prevention
16. Add ESLint rule for empty catch blocks
17. Add file size CI check (warn >15KB, fail >25KB)
18. Run Biome format on all files
19. Verify E2E test infrastructure
20. Audit frontend dependency usage

---

## Effort Estimate

| Priority | Findings | Est. Effort |
|----------|----------|-------------|
| P0 (Must Fix) | 6 | 11-15 days |
| P1 (Should Fix) | 12 | 15-22 days |
| P2 (Nice to Fix) | 12 | 5-8 days |
| P3 (Consider) | 6 | 3-5 days |
| **Total** | **36** | **34-50 days** |

---

## Individual Reports

| Report | Area | Findings |
|--------|------|----------|
| [01-core-files.md](01-core-files.md) | `src/` root files | 6 |
| [02-storage-layer.md](02-storage-layer.md) | Prisma + storage | 8 |
| [03-server-api-cli.md](03-server-api-cli.md) | Server, API, CLI | 7 |
| [04-engines-layer.md](04-engines-layer.md) | 179 engine files | 8 |
| [05-frontend.md](05-frontend.md) | 219 TSX components | 3 |
| [06-tests.md](06-tests.md) | 470 test files | 3 |
| [07-seeds.md](07-seeds.md) | 40+ seed files | 3 |
| [08-devops.md](08-devops.md) | 13 devops dirs | 3 |
| **SUMMARY** | **Full codebase** | **36** |

---

*Generated by codebase investigation scan — 937+ TypeScript files, 470 test files, 3,897-line schema*
