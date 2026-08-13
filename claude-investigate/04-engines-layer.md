# Investigation Report: Engines Layer (179 files, 37 subdirectories)

## Area Overview
- **Files Scanned**: 179 engine files, 37 subdirectories
- **Priority**: HIGH — Core business logic layer

---

## Finding 1: P0 — 100+ Silent Catch-All Blocks

**Location**: Multiple files across the engines directory

```typescript
} catch {
  // silently ignored
}
```

**Issue**: There are 100+ `catch {}` blocks that silently swallow errors. This makes debugging extremely difficult and can hide critical failures.

**Examples**:
- `capability-bootstrap-generated.ts`: 7 silent catches
- `semantic-grounding.ts`: 5 silent catches
- `opencode-instance-registry.ts`: 4 silent catches
- `sandbox-runner-quickjs.ts`: 4 silent catches

**Resolution**:
1. Add `catchDebug()` or `log.debug()` to every catch block
2. For intentional "swallow" patterns, add a comment explaining why
3. Create a lint rule to flag empty catch blocks

---

## Finding 2: P0 — `autonomous-execution.ts` 43.4 KB Single File

**Location**: `src/engines/autonomous-execution.ts` (43,395 bytes)

**Issue**: This is the largest file in the codebase. At 43 KB, it likely contains multiple concerns that should be split.

**Resolution**:
1. Analyze the file and split by concern (planning, execution, HITL, recovery)
2. Create sub-modules under `autonomous/`
3. Add unit tests for each concern

---

## Finding 3: P1 — `capability.ts` Importing from `conversation-manager.ts`

**Location**: `src/engines/capability.ts:12`

```typescript
import type { CapabilityEventBus } from './conversation-manager.js'
```

**Issue**: The `CapabilityEventBus` type is imported from `conversation-manager.ts` instead of `capability-event-bus.ts`. This suggests a circular dependency or incorrect module organization.

**Resolution**:
1. Import `CapabilityEventBus` from `./capability-event-bus.js`
2. Verify no circular dependency exists
3. Fix the import chain

---

## Finding 4: P1 — Large Engine Files (>20 KB)

**Files exceeding 20 KB**:
- `autonomous-execution.ts` (43.4 KB)
- `chrome-governor.ts` (29.8 KB)
- `provider-discovery.ts` (28.2 KB)
- `memory-engine.ts` (25.6 KB)
- `context-assembly.ts` (23.2 KB)
- `version-manager.ts` (21.9 KB)
- `provider-protocol-generator.ts` (21.8 KB)
- `storage-relocation-engine.ts` (21.6 KB)
- `cdp-discovery.ts` (20.2 KB)
- `stream-parser.ts` (20.2 KB)
- `session-lifecycle-manager.ts` (20.4 KB)

**Issue**: These files are doing too much. They combine business logic, data access, and presentation concerns.

**Resolution**:
1. Split each file by concern (e.g., `chrome-governor/` directory)
2. Extract query logic to separate modules
3. Add interfaces for each concern

---

## Finding 5: P1 — `chrome-governor.ts` In-Memory Store Fallback

**Location**: `src/engines/chrome-governor.ts:30-66`

```typescript
function createInMemoryStealthStore(): StealthProfileStore {
  const launches = new Map<string, LaunchProfileRow>()
  // ...
}
```

**Issue**: The in-memory store fallback is defined in the same file as the main engine. This mixes concerns and makes testing harder.

**Resolution**:
1. Move `createInMemoryStealthStore()` to a separate test utility file
2. Or create `src/engines/chrome/in-memory-stealth-store.ts`
3. Add a comment explaining when to use the fallback vs. real store

---

## Finding 6: P2 — `metrics-registry.ts` Empty File (47 bytes)

**Location**: `src/engines/metrics-registry.ts`

**Issue**: This file is essentially empty (47 bytes). It's likely a placeholder that was never implemented.

**Resolution**:
1. Either implement the metrics registry or remove the file
2. If it's a placeholder, add a TODO comment
3. Update imports if any files reference it

---

## Finding 7: P2 — `plugin-manager-impl.ts` Stub (143 bytes)

**Location**: `src/engines/plugin-manager-impl.ts` (143 bytes)

**Issue**: This file is a stub that likely doesn't do anything useful.

**Resolution**:
1. Either implement the plugin manager or remove the file
2. Check if any imports reference it
3. Clean up dead code

---

## Finding 8: P3 — `prompt-augmenter.ts` and `structured-logger.ts` Stubs

**Locations**: 
- `src/engines/prompt-augmenter.ts` (129 bytes)
- `src/engines/structured-logger.ts` (125 bytes)

**Issue**: These are stub files that don't implement their intended functionality.

**Resolution**:
1. Either implement the functionality or remove the files
2. Check if any imports reference them
3. Clean up dead code

---

## Summary

| Finding | Severity | Effort | Impact |
|---------|----------|--------|--------|
| 100+ silent catch-all blocks | P0 | High | Debuggability |
| 43KB autonomous-execution.ts | P0 | High | Maintainability |
| Wrong import path capability.ts | P1 | Low | Architecture |
| 11 engine files >20KB | P1 | High | Testability |
| In-memory store in governor | P1 | Low | Separation of concerns |
| Empty metrics-registry.ts | P2 | Low | Dead code |
| Stub plugin-manager-impl.ts | P2 | Low | Dead code |
| Stub prompt-augmenter.ts | P3 | Low | Dead code |

**Estimated Total Effort**: 7-10 days for P0-P1 items
