# v4 Fork Changelog

## What Changed vs Original v4

### Added
1. **Canonical header** — Added fork-specific header with status counts and philosophy
2. **Phase index files** — 14 new `00-PHASE-INDEX.md` files (none existed before)
3. **Port-over plan** — Cross-reference table mapping fork IDs to source specs
4. **Phase dependencies** — Documented intra-phase chains
5. **Fork structure** — Created `docs/atomic-v4-fork-canon/` directory tree

### Changed
1. **Tracker header** — Updated from "v4 — Atomic Tracker (User-Journey Driven)" to "v4-fork-canon — Atomic Tracker (CDP/Chrome Execution)"
2. **Superseded note** — Removed "SUPERSEDED BY v6" note (v4 is now a standalone fork)

### NOT Changed
1. **Unit IDs** — Kept original v4 IDs (1.1, 2.1, etc.) — already clean
2. **Phase names** — Kept original v4 phase names
3. **Spec references** — All point to original `docs/atomic-v4/phase-*` paths
4. **Unit content** — No changes to atomic spec files
5. **Status markers** — Preserved any `[~]` markers from original v4 tracker

### Removed
1. **v6 superseded note** — v4 is now a standalone fork, not superseded
2. **Cross-reference to v5** — v4 does NOT include kernel; v5 adds that separately

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v4-fork-canon | 2026-07-12 | Initial fork: 71 units, 14 phases |
