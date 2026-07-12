# v5 Fork Changelog

## What Changed vs Original v5

### Added
1. **Canonical header** — Added fork-specific header with status counts and philosophy
2. **Phase index files** — 17 new `00-PHASE-INDEX.md` files (none existed before)
3. **Port-over plan** — Cross-reference table mapping fork IDs to source specs
4. **Phase dependencies** — Documented intra-phase chains
5. **Fork structure** — Created `docs/atomic-v5-fork-canon/` directory tree
6. **Atomic spec files** — All 91 spec files copied from `docs/atomic-v4/` and `docs/atomic-v5/`
7. **Sanity-check fixes** — Applied 2 critical corrections:
   - `1.2-seed-pipeline.md`: Fixed `ProviderStoreImpl` import path
   - `3.6-selector-healing.md`: Added note that `recordHit()`/`proposeSelector()` must be added to `SelectorHealer`

### Changed
1. **Tracker header** — Updated from "v5 — Atomic Tracker (Kernel-Native)" to "v5-fork-canon — Atomic Tracker (Kernel-First + CDP)"
2. **Superseded note** — Removed "SUPERSEDED BY v6" note (v5 is now a standalone fork)
3. **Kernel directory consolidation** — v5 original splits kernel across `phase-00-surgical-edit/` and `phase-00-kernel-core/`. Fork keeps them in `phase-00-kernel-core/` for cleanliness.
4. **Unit count correction** — Original v5 header says "91 units" but Phase 0 only has 9 units (not 10). Fork correctly shows 90 units.
5. **Tracker paths** — Updated all path references to point to fork directory (not originals)

### NOT Changed
1. **Unit IDs** — Kept original v5 IDs (0.1, 1.1, 15.1, etc.) — already clean
2. **Phase names** — Kept original v5 phase names
3. **Unit content** — No changes to atomic spec files beyond the 2 critical fixes

### Removed
1. **v6 superseded note** — v5 is now a standalone fork, not superseded
2. **Cross-reference to v3** — v5 and v3 are separate execution paths (not subsets)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v5-fork-canon | 2026-07-12 | Copied specs, applied fixes, updated tracker paths |
| v5-fork-canon | 2026-07-12 | Initial fork: 90 units, 17 phases |
