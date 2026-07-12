# Plan B: v5 Fork — Phase 0 Kernel Core

**Assumption:** v4 Phase 2 is DONE. Agent A continues with Phases 3-14. Agent B builds v5 Phase 0 independently — zero file conflicts (all new files except `.prisma` schema append).

---

## Dependency Chain

```
[0.0] EventBus upgrade ────────────────────┐
[0.1] KernelRegistry (new file) ───────────┤
[0.3] KernelTracer   (new file) ───────────┤──→ [0.6a] Server bootstrap refactor
[0.4] KernelProvenance (new file) ─────────┤         └→ [0.6]  KernelBootstrap
[0.5] Prisma Schema  (append 4 tables) ────┘
                                            └──→ [0.7] Test infrastructure
[0.2] KernelContext  (new file) ── depends on 0.1
```

---

## Execution Plan

### Batch 1 — Parallel (all independent)

| Unit | File path | Effort | Deps |
|------|-----------|--------|------|
| 0.0 | `src/engines/capability-event-bus-v2.ts` (new) | 8h | None |
| 0.1 | `src/engines/kernel/kernel-registry.ts` (new) | 6h | None |
| 0.3 | `src/engines/kernel/kernel-tracer.ts` (new) | 8h | None |
| 0.4 | `src/engines/kernel/kernel-provenance.ts` (new) | 6h | None |
| 0.5 | `prisma/schema.prisma` (append) | 2h | None |

**Store contract (new file):** `src/storage/contracts/kernel-store.ts` — defines `KernelStore` interface that 0.3, 0.4, and 0.6 reference.

### Batch 2 — Sequential

| Unit | File path | Effort | Deps |
|------|-----------|--------|------|
| 0.2 | `src/engines/kernel/kernel-context.ts` + `types.ts` (new) | 4h | 0.1 |

### Batch 3 — Test Infrastructure (independent)

| Unit | File path | Effort | Deps |
|------|-----------|--------|------|
| 0.7 | `tests/helpers/mock-*` + `coverage.config.ts` (new) | 8h | None |

### Batch 4 — Server Bootstrap (DEFER for merge)

| Unit | File path | Effort | Deps |
|------|-----------|--------|------|
| 0.6a | `src/server/index.ts` (modify) | 4h | 0.0–0.5 |
| 0.6 | `src/server/index.ts` (modify) | 6h | 0.0–0.5 |

> **⚠ DEFER** until v4 Phase 3 complete. This is the only merge-conflict risk — both forks touch `createServerWithEngines`. Wait for merge, then apply.

---

## Merge Strategy

1. **Agent B** finishes Batch 1-3 (7 units, ~42h)
2. **Agent A** finishes v4 Phase 3 (6 units, ~48h sequential)
3. **Merge:** Agent B's new files merge cleanly (no collisions)
4. Only `src/server/index.ts` needs manual merge:
   - 0.6a adds kernel-first bootstrap wrapping
   - v4 Phase 3 adds CDP transport wiring
   - These are additive within the same file, not conflicting
5. Apply 0.6/0.6a on the merged result

---

## Summary

| Metric | v4 Fork (Agent A) | v5 Fork (Agent B) |
|--------|-------------------|-------------------|
| Total units | 56 (Phases 3–14) | 9 (Phase 0) |
| Phase-gated? | Yes — sequential per phase | Mostly parallel within phase |
| Frontend work? | Yes (Phases 4–6, 10) | No (backend-only) |
| New files | ~30 edits to existing | 7 new files + 1 schema append |
| Merge conflicts with other fork | None (Agent B files are new) | None until 0.6/0.6a |
| Estimated effort | ~280–350h | ~42–52h |
