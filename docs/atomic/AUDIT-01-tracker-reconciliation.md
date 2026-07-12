# AUDIT-01: Tracker Reconciliation Report

**Date:** 2026-07-11
**Scope:** `docs/atomic/01-tracker.md` — full file existence audit
**Method:** Glob all `→` targets, compare `[x]`/`[ ]`/`[!]`/`[>]` status against filesystem

---

## A. HEADER METADATA ERRORS

| Field | Header Claims | Actual Count | Delta |
|-------|--------------|-------------|-------|
| Total units | 215 | **261** | +46 |
| Done `[x]` | 177 | **178** | +1 |
| Pending `[ ]` | 35 | **75** | +40 |
| Blocked `[!]` | 0 ("None yet") | **3** | +3 |
| Skipped `[>]` | 0 (untracked) | **5** | +5 |

**Root cause:** Phase 19-22 sub-items and Phase 21.5 test items were added after the header was last updated. Phase 5 header claims "13 units" but only 12 are listed. The Phase 14-20 header says "all pending" but Phases 14-18 are 100% `[x]`.

---

## B. `[x]` MARKED BUT FILE DOES NOT EXIST (7 items)

These are **phantom done** — marked complete but the target file is missing from disk.

| Unit | Tracker Path | Notes |
|------|-------------|-------|
| 11.11 | `src/executor/index.ts` | `[!]` — correctly blocked, no file |
| 13.2 | `web/tsconfig.base.json` | `[x]` — **phantom done** |
| 13.6 | `src/server/routes/capabilities.ts` | `[x]` — **directory doesn't exist** (`src/server/routes/` is not a real path) |
| 15.2 | `seeds/parsers/chatgpt/export.ts` | `[x]` — **phantom done** |
| 15.3 | `seeds/parsers/claude/export.ts` | `[x]` — **phantom done** |
| 15.4 | `seeds/parsers/gemini/export.ts` | `[x]` — **phantom done** |
| 18.8 | `src/server/routes/memory-viz.ts` | `[x]` — **wrong path** (actual: `src/server/memory-viz-router.ts`) |

### Recommended fixes:
- 13.2: Create `web/tsconfig.base.json` or update tracker to reflect actual path
- 13.6: Either create `src/server/routes/` directory structure, or mark as `[!]` and update target path
- 15.2-15.4: These export parsers need to be implemented, then marked `[x]`
- 18.8: Update target path to `src/server/memory-viz-router.ts`

---

## C. `[ ]` MARKED PENDING BUT FILE ALREADY EXISTS (2 items)

These are **phantom pending** — work is done but tracker wasn't updated.

| Unit | Tracker Path | Actual File |
|------|-------------|-------------|
| 19.1 | `src/engines/autonomous-execution.ts` | **EXISTS** — should be `[x]` |
| 19.8 | `src/engines/execution-policy.ts` | **EXISTS** — should be `[x]` |

### Recommended fix:
Mark 19.1 and 19.8 as `[x]` in the tracker. Verify they pass typecheck before confirming.

---

## D. FILE NAME MISMATCHES (2 items)

| Unit | Tracker Says | Actual File |
|------|-------------|-------------|
| 18.7 | `conversation-organization.ts` | `conversation-organizer.ts` |
| 11.7 | `[>]` skipped | `src/executor/slave-read.ts` **EXISTS** |

### Recommended fix:
- 18.7: Update tracker target to `src/engines/conversation-organizer.ts`
- 11.7: Re-evaluate if `slave-read.ts` is truly redundant. If it exists, either use it or delete it.

---

## E. `[>]` SKIPPED BUT FILE EXISTS

| Unit | Description | File |
|------|-------------|------|
| 11.7 | Slave Read | `src/executor/slave-read.ts` — **EXISTS** despite being marked redundant |

This file exists and may contain valid functionality. Should be audited for whether it's truly superseded by `CdpTransportImpl + HarnessRuntime` or if it adds unique value.

---

## F. MISSING PHASE 12

Phase numbering jumps from 11 to 13. No Phase 12 exists anywhere in the tracker. Either:
- Phase 12 was removed from the plan and numbers weren't renumbered, OR
- Phase 12 was absorbed into Phase 11 or 13

This is a cosmetic issue but creates confusion when referencing phases.

---

## G. MISSING ENTIRE DIRECTORIES

| Directory | Expected By | Status |
|-----------|-------------|--------|
| `src/mcp/` | Phase 22.9–22.15 | **Does not exist** — 7 pending units target this directory |
| `src/server/routes/` | 13.6, 18.8 | **Does not exist** — routes are flat in `src/server/` |

### Impact:
- Phase 22 MCP server work (15 units) requires creating `src/mcp/` from scratch
- 13.6 and 18.8 target a non-existent directory structure

---

## H. UNTRACKED FILES (exist but not in any unit)

These files exist on disk but have no corresponding tracker entry.

### Executor helpers (6 files)
| File | Notes |
|------|-------|
| `src/executor/async-mutex.ts` | Concurrency utility |
| `src/executor/circuit-breaker.ts` | Resilience pattern |
| `src/executor/cdp-types.ts` | CDP type definitions |
| `src/executor/content-blocks.ts` | Content block types |
| `src/executor/fleet-config.ts` | Fleet configuration |
| `src/executor/ids.ts` | ID generation |

### Storage helpers (5 files)
| File | Notes |
|------|-------|
| `src/storage/impl/prisma-like.ts` | Prisma abstraction |
| `src/storage/impl/episodic-memory-store-impl.ts` | Memory impl |
| `src/storage/impl/semantic-memory-store-impl.ts` | Memory impl |
| `src/storage/impl/procedural-memory-store-impl.ts` | Memory impl |
| `src/storage/impl/policy-store-impl.ts` | Policy impl |

### Storage contracts (3 files)
| File | Notes |
|------|-------|
| `src/storage/contracts/config-store.ts` | Config contract |
| `src/storage/contracts/organization-store.ts` | Org contract |
| `src/storage/contracts/workspace-store.ts` | Workspace contract |

### Server & CLI (3 files)
| File | Notes |
|------|-------|
| `src/server/setup-router.ts` | Setup routes |
| `src/server/autonomous-router.ts` | Autonomous routes |
| `src/cli/command-registry.ts` | CLI registry |

### Frontend (1 file)
| File | Notes |
|------|-------|
| `web/ui/src/components/action-trigger.tsx` | UI component |

### Seeds (1 file)
| File | Notes |
|------|-------|
| `seeds/providers/system.json` | Extra seed not in Phase 2 |

---

## I. PHASE 21.5 TEST COVERAGE: EXIST vs PENDING

| Test File | Tracker Says | Actual |
|-----------|-------------|--------|
| `memory-engine.test.ts` | 21.5.1 `[ ]` | **EXISTS** |
| `harness-runtime.test.ts` | 21.5.2 `[ ]` | **EXISTS** |
| `mirror-engine.test.ts` | 21.5.3 `[ ]` | **MISSING** |
| `selector-healer.test.ts` | 21.5.4 `[ ]` | **MISSING** |
| `semantic-grounding.test.ts` | 21.5.5 `[ ]` | **MISSING** |
| `observation-tap.test.ts` | 21.5.6 `[ ]` | **MISSING** |
| `workflow-engine.test.ts` | 21.5.7 `[ ]` | **MISSING** |
| `agentic-loop.test.ts` | 21.5.9 `[ ]` | **MISSING** |
| `plugin-system.test.ts` | 21.5.13 `[ ]` | **MISSING** |
| `state-transition.test.ts` | 21.5.20 `[ ]` | **MISSING** |
| `capability-macro.test.ts` | 21.5.22 `[ ]` | **MISSING** |
| `capability-shape-registry.test.ts` | 21.5.18 `[ ]` | **MISSING** |

**Summary:** 2 of 12 sampled tests already exist but are marked pending. 10 tests are genuinely missing.

---

## J. REBUILT HEADER (corrected)

```
**Total units:** 261 | **Done:** 178 | **Blocked:** 3 | **Pending:** 75 | **Skipped:** 5
**Phantom done:** 7 (files don't exist despite [x])
**Exists-but-pending:** 2 (files exist despite [ ])
**Untracked:** 19+ files with no unit assignment
**Missing directories:** src/mcp/, src/server/routes/
```

---

## K. CORRECTED PHASE DESCRIPTIONS

| Phase | Header Says | Reality |
|-------|-------------|---------|
| 14-20 | "all pending" | 14-18 are 100% done, only 19-20 pending |
| 12 | (missing) | Phase 12 doesn't exist — numbering gap |
| 5 | "13 units" | Only 12 units listed |
| Blocked section | "(None yet)" | 3 units are `[!]` |

---

## L. PRIORITY ACTIONS

1. **Immediate:** Fix header metadata (counts, phase descriptions)
2. **Immediate:** Mark 19.1 and 19.8 as `[x]` (files exist)
3. **Immediate:** Mark 15.2-15.4, 13.2, 13.6 as `[!]` (phantom done)
4. **Short-term:** Create `src/mcp/` directory structure for Phase 22
5. **Short-term:** Audit 19+ untracked files for proper tracker assignment
6. **Short-term:** Decide fate of `slave-read.ts` (11.7)
7. **Long-term:** Add dependency edges between units
8. **Long-term:** Renumber or remove Phase 12 gap
