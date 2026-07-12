# v4 Fork Cleanups Required

## Overview

v4 needs fewer cleanups than v3 because it has no kernel to absorb and no cross-version merges.

## Cleanups

### 1. Header Normalization
**Status:** Required
**What:** Add canonical header to v4 tracker (same pattern as v3-fork-canon).
**Impact:** Tracker only, no unit changes.

### 2. Phase Index Files
**Status:** Required
**What:** Create `00-PHASE-INDEX.md` for each of 14 phases. None exist currently.
**Impact:** New files only.

### 3. v4 ID Normalization
**Status:** Required
**What:** v4 uses `1.1`, `2.1` etc. — clean decimal notation. No change needed.
**Impact:** None — v4 IDs are already clean.

### 4. Spec Reference Paths
**Status:** Required
**What:** Ensure all fork unit specs reference `docs/atomic-v4/phase-{01..14}-*/` paths.
**Impact:** Tracker references only.

### 5. Dead Units / Stubs
**Status:** Investigate
**What:** v4 tracker shows `[~]` status on some units (1.1, 1.2, 1.4, 1.6, 1.7, 2.1, 2.2, 2.6, 2.7, 3.1, 3.3, 3.5, 3.6, 4.5). These may have partial implementations.
**Impact:** Fork should preserve status markers — don't reset to `[ ]`.

### 6. Missing v5 Kernel Addition
**Status:** Not applicable for v4
**What:** v4 does NOT include kernel units. v5 adds kernel on top.
**Impact:** None — v4 intentionally excludes kernel.

### 7. Directory Structure
**Status:** Required
**What:** Create `docs/atomic-v4-fork-canon/` with 14 phase directories.
**Impact:** New directory tree.

### 8. Cross-Reference to v3
**Status:** Required
**What:** Document that v4 and v3 are separate execution paths (not subsets).
**Impact:** Documentation only.
