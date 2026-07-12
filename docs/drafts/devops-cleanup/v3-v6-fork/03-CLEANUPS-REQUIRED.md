# Cleanups Required: v3-fork-canon

**Date:** 2026-07-12
**Status:** DRAFT

---

## Pre-Fork Validation: All Source Files Exist

| Source | Expected | Found | Status |
|--------|----------|-------|--------|
| v3 Phase 1 (1.1-1.12) | 12 spec files | 12 | ✅ |
| v3 Phase 2 (2.1-2.15) | 15 spec files | 15 | ✅ |
| v3 Phase 3 (3.1-3.13) | 13 spec files | 13 | ✅ |
| v3 Phase 4 (4.1-4.11) | 11 spec files | 11 | ✅ |
| v3 Phase 5 (5.1-5.10) | 10 spec files | 10 | ✅ |
| v3 Phase 6 (6.1-6.10) | 10 spec files | 10 | ✅ |
| v3 Phase 7 (7.1-7.12) | 12 spec files | 12 | ✅ |
| v3 Phase 8 (8.1-8.8) | 8 spec files | 8 | ✅ |
| v3 Phase 9 (9.1-9.9) | 9 spec files | 9 | ✅ |
| v3 Phase 10 (10.1-10.8) | 8 spec files | 8 | ✅ |
| v5 Phase 00 kernel (0.1-0.6, 0.5-schema) | 6 files | 6 | ✅ |
| v5 Phase 00 surgical (0.0, 0.5, 0.6a, 0.7) | 4 specs | 4 | ✅ |
| v5 Phase 15 oracle (15.1-15.4) | 4 spec files | 4 | ✅ |
| v5 Phase 16 surfaces (16.1-16.4) | 4 spec files | 4 | ✅ |
| v5 surgical 16.5, 16.6 | 2 spec files | 2 | ✅ |

**No missing source files detected.**

---

## Cleanup #1: v3 Tracker Header Update (NO TOUCH — only fork)

The original `docs/atomic-v3/01-tracker.md` currently says:

> ⚠️ **SUPERSEDED BY v6**
> v6 (`docs/atomic-v6/01-tracker.md`) is the canonical plan.

The fork (`docs/atomic-v3-fork-canon/01-tracker.md`) will:

1. **REMOVE** the "SUPERSEDED BY v6" header
2. **ADD** "CANONICAL PLAN — v3-fork-canon. THE canonical plan."
3. **DECLARE** v4/v5/v6 as superseded
4. State that v3-fork-canon is the single source of truth

---

## Cleanup #2: Renumbering Overlap

Original v3 Phase 2 runs from 2.1-2.15.
In the fork, these become Phase 3 (not Phase 2).

Kernel Phase 2 units use their v5 IDs: 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.6a, 0.7.

**Potential confusion:** Unit IDs 0.x sit between 1.x and 2.x. The tracker must clearly label:
- Phase 2 units as "Kernel" with a banner explaining they're v5-origin
- Phase 3+ units with their original v3 IDs

**Fix:** In the fork tracker, add a comment column or section header naming the source.

---

## Cleanup #3: File Path References

v3 tracker currently references specs at `docs/atomic-v3/phase-0*/`.
The fork tracker will reference specs at:
- v3 originals: `docs/atomic-v3/phase-{01..10}-*/` (unchanged)
- Kernel Phase 00: `docs/atomic-v5/phase-00-kernel-core/` and `docs/atomic-v5/phase-00-surgical-edit/`
- Kernel Phase 15: `docs/atomic-v5/phase-15-kernel-oracle/`
- Kernel Phase 16: `docs/atomic-v5/phase-16-kernel-surfaces/`

**No file copies needed.** All paths are cross-references to existing files.

---

## Cleanup #4: Phase Directory Creation

Create these directories in `docs/atomic-v3-fork-canon/`:

```
phase-01-stabilization/
phase-02-kernel-foundation/
phase-03-agentic-core/
phase-04-html-canvas/
phase-05-workspace-ui/
phase-06-provider-expansion/
phase-07-memory-knowledge/
phase-08-autonomous-orch/
phase-09-observability/
phase-10-sovereign-data/
phase-11-kernel-oracle/
phase-12-kernel-surfaces/
phase-13-polish-sdk/
```

Each directory will contain a `00-PHASE-INDEX.md` that lists all units in that phase
with their original spec locations and dependency relationships.

---

## Cleanup #5: Summary Table Update

The fork tracker summary needs to reflect:
- 127 total units (108 v3 + 19 kernel)
- 10 done (Phase 1 only)
- 117 pending
- Status per phase

---

## Cleanup #6: DevOps Select Tool Compatibility

The devops `select` tool at `devops/select.ts` is currently PAUSED.
The fork tracker at `docs/atomic-v3-fork-canon/01-tracker.md` should be in a
format compatible with the devops tool (standard `[ ]` / `[x]` markers).

Check `devops/select.ts` for:
- Tracker path used by the tool
- Markdown format expected
- Any hardcoded phase/unit references

**Potential issue:** The devops tool may hardcode `docs/atomic-v3/01-tracker.md`.
If so, it needs configuration to point to the fork instead.

---

## Cleanup #7: v6 Canonical Status

Currently `docs/atomic-v6/01-tracker.md` has the header:

> **CANONICAL PLAN** — v6 is the single source of truth.

The fork tracker at `docs/atomic-v3-fork-canon/01-tracker.md` will claim:
> **CANONICAL PLAN — v3-fork-canon** — THE single source of truth.

v4, v5, and v6 become "Reference only" — archived but untouched.

**Note:** The existing v6 tracker header says "Canonical" in bold. The fork
should also say "Canonical" unambiguously.

---

## Cleanup #8: v3 Phase 2 vs Fork Phase 3 File Path Confusion

Original v3 Phase 2 is `docs/atomic-v3/phase-02-agentic-core/`.
In the fork, Phase 2 is Kernel, Phase 3 is Agentic Core.

Researchers might look in `docs/atomic-v3-fork-canon/phase-02-*` expecting
Agentic Core content. **Fix:** Use clear directory names:
- `phase-02-kernel-foundation/`
- `phase-03-agentic-core/`

Never ambiguous names like "phase-02" without a descriptive suffix.

---

## Summary of Required Actions

| # | Action | Effort | Priority |
|---|--------|--------|----------|
| 1 | Create `docs/atomic-v3-fork-canon/` directory | 1m | High |
| 2 | Write canonical tracker `01-tracker.md` (127 units) | 30m | High |
| 3 | Create 13 phase index files | 15m | Medium |
| 4 | Write `PORT-OVER-PLAN.md` | 10m | Low |
| 5 | Write `PHASE-DEPENDENCIES.md` | 10m | Low |
| 6 | Write `CHANGELOG.md` | 5m | Low |
| 7 | Check devops tool compatibility | 15m | High |
| 8 | Total | ~1.5h | |
