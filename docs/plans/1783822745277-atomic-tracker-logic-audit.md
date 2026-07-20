# Atomic Tracker Logic Audit — v3/v4/v5/v6 Status Reassignment Issues

**Finding:** Critical logic errors in version selection and status parsing that corrupt the implementation plan.

## Core Problem Summary

### 1. Wrong Tracker File Loaded (CRITICAL)

**Location:** `devops/select.ts:25-26`

```typescript
export const TRACKER = join(process.cwd(), "docs/atomic-v3/01-tracker.md");
export const ATOMIC_DIR = join(process.cwd(), "docs/atomic-v3");
```

**Issue:** The selection logic reads `docs/atomic-v3/01-tracker.md` while v6 (`docs/atomic-v6/01-tracker.md`) is the canonical plan per the v6 header comment.

**Impact:** All `bun run devops select` calls return v3 units (like `1.11-coverage-target`) instead of v6 units (like `0.0-capability-event-bus-upgrade`). The v3 plan is 108 units, v6 is 117 units — **9 units of Phase 0 are completely missed**.

**Evidence:** Running `bun run devops select` returns:
```json
{
  "id": "1.11",
  "name": "Achieve 80% coverage...",
  "phase": 1,
  "phaseName": "Stabilization & Cleanup"
}
```

But v6 Phase 0 (Kernel Core) has 10 units that should be first priority, none of which are being selected.

---

### 2. Status Marker Parsing Corruption

**Location:** `devops/tracker.ts:10-22` and `devops/tracker.ts:77`

```typescript
const STATE_BY_MARKER: Record<string, UnitState> = {
  " ": "pending",    // [ ]
  "~": "in_progress", // [~]  
  x: "done",          // [x]
  "!": "blocked",     // [!]
};
```

**Issue:** v5/v6 uses `[~]` for "EXISTS" (code exists, needs FIX). The parser maps `[~]` → `in_progress`, conflating:
- **in_progress:** Work started, not complete
- **EXISTS:** Code exists but needs modification

**Impact:** Units marked `[~]` in v5/v6 are treated as actively being worked on, not as "existing code to fix". This obscures the real work: some `[~]` units have ALREADY-EXISTING code that needs FIX, while others are CREATE tasks.

**Evidence:** v5 Phase 1:
- `1.1` — `[~] Wire CDP transport` — EXISTS: ChromeGovernor exists
- `1.2` — `[~] Provider seed pipeline` — EXISTS: seeds exist
- `1.4` — `[~] Launch visible Chrome` — EXISTS: FleetSupervisor exists

But `FleetSupervisor` launching with profiles may NOT match the atomic spec. The selector thinks these are "in progress" when they may be "pending with existing code".

---

### 3. Phase 0 Surgical Edit Unit Placement Confusion

**Location:** `docs/atomic-v5/phase-00-surgical-edit/` units referenced in v5/v6 Phase 0

**Units Involved:**
| Unit | Atomic File Location | What It Represents |
|------|---------------------|-------------------|
| 0.0 | `phase-00-surgical-edit/0.0-capability-event-bus-upgrade.md` | Event Bus Upgrade (cross-cutting fix) |
| 0.5 | `phase-00-surgical-edit/0.5-prisma-schema-migration.md` | DB Schema Migration |
| 0.6a | `phase-00-surgical-edit/0.6a-server-bootstrap-refactor.md` | Bootstrap Refactor |
| 0.7 | `phase-00-surgical-edit/0.7-test-infrastructure.md` | Test Consolidation |
| 16.5 | `phase-00-surgical-edit/16.5-mcp-server-integration.md` | MCP Kernel Integration |
| 16.6 | `phase-00-surgical-edit/16.6-cli-kernel-commands.md` | CLI Commands |

**Issue:** Units `16.5` and `16.6` are numbered as Phase 16 units but placed in Phase 0 of the v5 plan. The `phaseIsOpen()` logic in `select.ts:48-57` checks:

```typescript
function phaseIsOpen(units: Unit[], target: number, done: Set<string>): boolean {
  if (target >= TOOLING_PHASE_MIN) return true; // Phase >= 90 always open
  // Phase N opens only when all units of phases < N are done
}
```

**Impact:** Phase 0 units with IDs `16.x` (16.5, 16.6) would fail the phase gate logic. A Phase 0 unit named `16.5` creates confusion in the phase ordering system.

---

### 4. Cross-Version Mapping Gaps

**Location:** `docs/roadmap/CROSS-VERSION-GAP-ANALYSIS.md` lines 95-154

**Issue:** The gap analysis says "v5 = v4 + Kernel" and "Phases 1-14 are identical to v4." But the surgical edits (Phase 0) and Phase 16 (Kernel Surfaces) are **v5-only additions** that aren't in v4.

**Specific Confusion:**

| v5 Unit | v4 Equivalent? | Reality Check |
|---------|----------------|---------------|
| 0.0 Event Bus Upgrade | No (v4 has no Phase 0) | v4 engines work, but event bus has bugs |
| 0.5 Prisma Schema | No | v4 has no kernel tables |
| 0.6a Bootstrap Refactor | No | Modifies v4/v5 bootstrap |
| 0.7 Test Infrastructure | No | New shared mocks |
| 16.5 MCP Integration | No | v5-specific |
| 16.6 CLI Commands | No | v5-specific |

The "v5 = v4 + Kernel" philosophy is partially broken. Phase 0 requires foundational work that v4 engines don't have yet.

---

### 5. Status Count Mismatches

**v3 Tracker Header:** `**Total units:** 108 | **Done:** 10 | **Blocked:** 0 | **Pending:** 98`
- Phase 1 shows `10/12` done (units 1.1-1.10 are `[x]`, 1.11-1.12 are `[ ]`)
- Status counts match

**v5 Tracker Header:** `**Total units:** 71 | **Done:** 0 | **Blocked:** 0 | **Pending:** 71`
- But Phase 1 shows 5 units marked `[~]` (EXISTS)
- If `[~]` = `in_progress`, then `in_progress` count should be ≥5, but header says 0

**v6 Tracker Header:** `**Total units:** 117 | **Done:** 0 | **Blocked:** 0 | **Pending:** 91 | **Exists:** 6 | **Deferred:** 26`
- Header now includes Exists/Deferred columns
- But `tracker.ts` parser only recognizes 4 states, not 6 columns
- The "Exists: 6" count in header is NOT matched by parser state

---

## Recommended Fixes

### Fix 1: Point devops to v6 tracker

```typescript
// devops/select.ts:25-26
- export const TRACKER = join(process.cwd(), "docs/atomic-v3/01-tracker.md");
- export const ATOMIC_DIR = join(process.cwd(), "docs/atomic-v3");
+ export const TRACKER = join(process.cwd(), "docs/atomic-v6/01-tracker.md");
+ export const ATOMIC_DIR = join(process.cwd(), "docs/atomic-v6");
```

### Fix 2: Extend status markers to include EXISTS/DEFERRED

```typescript
// devops/tracker.ts:8-15
+ export type UnitState = "pending" | "in_progress" | "done" | "blocked" | "exists" | "deferred";

+ const MARKER: Record<UnitState, string> = {
+   pending: " ",
+   in_progress: "~",
+   done: "x",
+   blocked: "!",
+   exists: "E",    // [E] for EXISTS (code exists, needs FIX)
+   deferred: "D",  // [D] for DEFERRED (v3 gap, later review)
+ };
```

### Fix 3: Recalculate Phase 0 unit ordering

The surgical edit units `16.5` and `16.6` should either:
- Be renamed to `0.8` and `0.9` (if they logically belong in Phase 0)
- Or remain as Phase 16 units but NOT placed in Phase 0 section

### Fix 4: Reconcile header stats parsing

v6 header has 6 columns (Total/Done/Blocked/Pending/Exists/Deferred) but:
- The parser only handles 4 columns
- The report command (`devops/report.ts`) likely doesn't read the new columns either

---

## Action Plan

1. **[Immediate]** Update `devops/select.ts` to read v6 tracker
2. **[Immediate]** Add `exists` and `deferred` states to `tracker.ts`
3. **[Soon]** Fix v6 header format to be parseable or accept manual stats
4. **[Soon]** Audit all `[~]` units in v5/v6 to determine correct status:
   - EXISTS (has code, needs FIX) vs
   - in_progress (work actively in progress)
5. **[Soon]** Rename 16.5/16.6 or move to correct phase in tracker