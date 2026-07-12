# Changelog: v3-fork-canon

## 2026-07-12 — Atomic Spec Files Copied & Fixes Applied

- **Copied** all 128 atomic spec files from `docs/atomic-v3/` and `docs/atomic-v5/` into fork directories
- **Applied** sanity-check fixes (see `docs/drafts/sanity-check-reference.md`)
- **Updated** tracker to reference fork paths only (not originals)

## 2026-07-12 — Initial Fork Creation

- **Created** `docs/atomic-v3-fork-canon/` as the canonical execution plan
- **Absorbed** 19 kernel units from v5 (Phase 00, 15, 16) into v3's architecture
- **Preserved** all 108 original v3 units (IDs 1.1-10.8)
- **Restructured** from 10 to 13 phases (kernel added early, oracle/surfaces late)
- **Declared** canonical — v4, v5, v6 superseded as references

### Structural Changes
- New Phase 2: Kernel Foundation (9 units from v5 Phase 00)
- New Phase 11: Kernel Oracle (4 units from v5 Phase 15)
- New Phase 12: Kernel Surfaces (6 units from v5 Phase 16)
- Phase 10 (Sovereign Data) shifted to Phase 10
- Phase 10 (Polish/SDK) shifted to Phase 13
- v3 Phases 2-9 → Fork Phases 3-10

### Unit Count
- Total: 127 (108 v3 + 19 kernel)
- Done: 10 (Phase 1)
- Pending: 117
