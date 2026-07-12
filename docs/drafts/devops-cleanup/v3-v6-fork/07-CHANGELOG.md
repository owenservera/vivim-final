# Changelog: v3-fork-canon

**Date:** 2026-07-12

---

## What Changed vs Original v3

### Structural Changes

| Aspect | Original v3 | v3-fork-canon |
|--------|-------------|---------------|
| Total units | 108 | **127** (+19) |
| Phases | 10 | **13** (+3) |
| Done | 10 | 10 (unchanged) |
| Pending | 98 | **117** (+19 kernel) |
| Status | "SUPERSEDED BY v6" | **"CANONICAL PLAN"** |
| Source | v3 only | v3 + v5 kernel |

### New Phases

| Phase | Name | Units | Origin |
|-------|------|-------|--------|
| **2** | Kernel Foundation | 9 | v5 Phase 00 |
| **11** | Kernel Oracle | 4 | v5 Phase 15 |
| **12** | Kernel Surfaces | 6 | v5 Phase 16 |

### Reordered Phases

| Original v3 Phase | New Fork Phase | Units |
|-------------------|----------------|-------|
| Phase 1 (Stabilization) | **Phase 1** | 12 |
| Phase 2 (Agentic Core) | **Phase 3** | 15 |
| Phase 3 (HTML Canvas) | **Phase 4** | 13 |
| Phase 4 (Workspace) | **Phase 5** | 11 |
| Phase 5 (Providers) | **Phase 6** | 10 |
| Phase 6 (Memory) | **Phase 7** | 10 |
| Phase 7 (Orchestration) | **Phase 8** | 12 |
| Phase 8 (Observability) | **Phase 9** | 8 |
| Phase 9 (Sovereign) | **Phase 10** | 9 |
| Phase 10 (Polish/SDK) | **Phase 13** | 8 |

### Unit ID Remapping

v3-origin units keep their original IDs (1.1-10.8).
Kernel units keep their v5 IDs (0.0-0.7, 15.1-15.4, 16.1-16.6).
In the fork tracker, kernel units get fork-phase-prefixed IDs (2.1-2.9, 11.1-11.4, 12.1-12.6).

### Spec Paths

| Phase | Fork Spec Path | Original Spec Path |
|-------|---------------|-------------------|
| 1 | `docs/atomic-v3-fork-canon/phase-01-stabilization/` | `docs/atomic-v3/phase-01-stabilization/` |
| 2 | `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/` | `docs/atomic-v5/phase-00-{kernel-core,surgical-edit}/` |
| 3-13 | Same pattern | `docs/atomic-v3/phase-{02..10}-*/` + `docs/atomic-v5/phase-{15,16}-*/` |

### What Was Removed

Nothing. All 108 v3 units preserved. All 19 kernel units added.

### What Was Added

| Unit | Source | Type |
|------|--------|------|
| 0.0 | v5 Phase 00 | CapabilityEventBus upgrade |
| 0.1 | v5 Phase 00 | KernelRegistry |
| 0.2 | v5 Phase 00 | KernelContext |
| 0.3 | v5 Phase 00 | KernelTracer |
| 0.4 | v5 Phase 00 | KernelProvenance |
| 0.5 | v5 Phase 00 | Prisma schema migration |
| 0.6 | v5 Phase 00 | KernelBootstrap |
| 0.6a | v5 Phase 00 | Server bootstrap refactor |
| 0.7 | v5 Phase 00 | Test infrastructure |
| 15.1-15.4 | v5 Phase 15 | Kernel Oracle |
| 16.1-16.6 | v5 Phase 16 | Kernel Surfaces |

### Migration Notes

- The devops `select` tool may need reconfiguration to read from `docs/atomic-v3-fork-canon/01-tracker.md` instead of `docs/atomic-v3/01-tracker.md`
- All unit IDs from v3 are preserved — the tracker data format is unchanged
- No spec files were copied or moved — only the tracker and phase index files are new
