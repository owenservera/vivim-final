# v5 Fork Cleanups Required

## Overview

v5 needs more cleanups than v4 because it includes kernel units that were spread across multiple directories in the original v5 tracker.

## Cleanups

### 1. Header Normalization
**Status:** Required
**What:** Add canonical header to v5 tracker (same pattern as v3/v4 forks).
**Impact:** Tracker only, no unit changes.

### 2. Phase Index Files
**Status:** Required
**What:** Create `00-PHASE-INDEX.md` for each of 17 phases. None exist currently.
**Impact:** New files only.

### 3. Kernel Phase Numbering
**Status:** Required
**What:** v5 original uses Phase 0 for kernel, Phase 15 for oracle, Phase 16 for surfaces. Keep this numbering — it's clean and logical.
**Impact:** None — v5 numbering is already clean.

### 4. Spec Reference Paths
**Status:** Required
**What:** Ensure all fork unit specs reference correct paths:
- Phases 0, 15, 16: `docs/atomic-v5/phase-*` paths
- Phases 1-14: `docs/atomic-v4/phase-*` paths (v5 references v4 specs)
**Impact:** Tracker references only.

### 5. Dead Units / Stubs
**Status:** Investigate
**What:** v5 tracker shows `[~]` status on some units (1.1, 1.2, 1.4, 1.6, 1.7, 2.1, 2.2, 2.6, 2.7, 3.1, 3.3, 3.5, 3.6, 4.5). These may have partial implementations.
**Impact:** Fork should preserve status markers — don't reset to `[ ]`.

### 6. v5 Superseded Note
**Status:** Required
**What:** Remove "SUPERSEDED BY v6" note from v5 fork — v5 is now a standalone fork.
**Impact:** Documentation only.

### 7. Directory Structure
**Status:** Required
**What:** Create `docs/atomic-v5-fork-canon/` with 17 phase directories.
**Impact:** New directory tree.

### 8. Cross-Reference to v3
**Status:** Required
**What:** Document that v5 and v3 are separate execution paths (not subsets).
**Impact:** Documentation only.

### 9. Kernel Unit Spread
**Status:** Required
**What:** v5 kernel units are spread across `phase-00-surgical-edit/` and `phase-00-kernel-core/`. Fork should keep them in a single `phase-00-kernel-core/` directory for cleanliness.
**Impact:** Phase directory naming only — spec references stay the same.
