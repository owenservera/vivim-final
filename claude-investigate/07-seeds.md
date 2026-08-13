# Investigation Report: Seeds Layer (40+ files, 10 subdirectories)

## Area Overview
- **Location**: `seeds/`
- **Subdirectories**: adapters, automation, capabilities, command-descriptions, conceptual-model, harness, intent-templates, parsers, providers, taxonomy
- **Largest Files**: `manifests.ts` (32.5KB), `seed.ts` (20.7KB), `og-capability-port.ts` (17.6KB)

---

## Finding 1: P1 — `manifests.ts` 32.5 KB Single File

**Location**: `seeds/providers/manifests.ts` (32,500 bytes)

**Issue**: This file contains all provider manifests in a single 32.5KB file, making it hard to maintain and causing slow type-checking.

**Resolution**:
1. Split into individual files per provider (`manifests/chatgpt.ts`, `manifests/claude.ts`, etc.)
2. Create an index barrel that re-exports all manifests
3. Add provider-specific tests

---

## Finding 2: P2 — Duplicate `seed.ts` Files

**Files**:
- `seeds/capabilities/seed.ts` (20.7KB)
- `seeds/parsers/seed.ts` (20.1KB)

**Issue**: Both seed files are ~20KB and likely contain similar patterns. The duplication makes maintenance harder.

**Resolution**:
1. Create a shared seed utility module (`seeds/shared/seed-utils.ts`)
2. Extract common patterns (upsert logic, error handling)
3. Keep provider-specific logic in individual seed files

---

## Finding 3: P3 — `og-capability-port.ts` 17.6 KB Legacy Port

**Location**: `seeds/capabilities/og-capability-port.ts` (17,600 bytes)

**Issue**: This file appears to be a legacy port of original capabilities. It may contain outdated patterns or dead code.

**Resolution**:
1. Audit the file for unused capabilities
2. Remove or deprecate any legacy patterns
3. Update to match current capability registration patterns

---

## Summary

| Finding | Severity | Effort | Impact |
|---------|----------|--------|--------|
| 32.5KB manifests.ts | P1 | Medium | Maintainability |
| Duplicate seed.ts files | P2 | Low | DRY principle |
| Legacy capability port | P3 | Low | Code hygiene |

**Estimated Total Effort**: 2-3 days
