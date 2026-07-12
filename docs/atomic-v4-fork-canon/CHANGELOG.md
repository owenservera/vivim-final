# v4 Fork Changelog

## What Changed vs Original v4

### Added
1. **Canonical header** — Added fork-specific header with status counts and philosophy
2. **Phase index files** — 14 new `00-PHASE-INDEX.md` files (none existed before)
3. **Port-over plan** — Cross-reference table mapping fork IDs to source specs
4. **Phase dependencies** — Documented intra-phase chains
5. **Fork structure** — Created `docs/atomic-v4-fork-canon/` directory tree
6. **Atomic spec files** — All 71 spec files copied from `docs/atomic-v4/`
7. **Sanity-check fixes** — Applied 2 critical corrections:
   - `1.2-seed-pipeline.md`: Fixed `ProviderStoreImpl` import path (was referencing non-existent impl file)
   - `3.6-selector-healing.md`: Added note that `recordHit()`/`proposeSelector()` must be added to `SelectorHealer`

### Changed
1. **Tracker header** — Updated from "v4 — Atomic Tracker (User-Journey Driven)" to "v4-fork-canon — Atomic Tracker (CDP/Chrome Execution)"
2. **Tracker paths** — Updated all path references to point to fork directory (not originals)

### NOT Changed
1. **Unit IDs** — Kept original v4 IDs (1.1, 2.1, etc.) — already clean
2. **Phase names** — Kept original v4 phase names
3. **Unit content** — No changes to atomic spec files beyond the 2 critical fixes

### Removed
1. **Superseded note** — v4 is now a standalone fork

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v4-fork-canon | 2026-07-12 | Copied specs, applied fixes, updated tracker paths |
| v4-fork-canon | 2026-07-12 | Initial fork: 71 units, 14 phases |
