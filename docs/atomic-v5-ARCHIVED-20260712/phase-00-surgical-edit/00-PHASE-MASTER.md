# Phase 00: Surgical Edit — Foundation Upgrades

**Phase:** 00 · **Domain:** Cross-cutting · **Status:** DRAFT · **Units:** 6

## Purpose

Foundation upgrades discovered during cross-version gap analysis. These units
MUST be completed before Phase 0 (Kernel Core) because they fix production bugs
and add infrastructure that the kernel depends on.

## Units

| Unit | Title | Effort | Dependencies | Blocks |
|------|-------|--------|--------------|--------|
| 0.0 | CapabilityEventBus Upgrade | M (8h) | None | 0.1-0.6, all engines |
| 0.5 | Prisma Schema Migration | S (2h) | None | 0.1, 0.3, 0.4 |
| 0.6a | Server Bootstrap Refactor | S (4h) | 0.0, 0.5 | 0.6 |
| 0.7 | Test Infrastructure Consolidation | M (8h) | Kernel Core | all engine tests |
| 16.5 | MCP Server Kernel Integration | S (4h) | 15.1-15.4 | MCP surfaces |
| 16.6 | CLI Kernel Commands | S (4h) | 15.1-15.4 | CLI surfaces |

## Execution Order

```
0.0 CapabilityEventBus Upgrade     ← blocks everything
0.5 Prisma Schema Migration       ← blocks kernel tables
0.6a Server Bootstrap Refactor    ← wires kernel into bootstrap
    ↓
[Phase 0: Kernel Core can now proceed]
    ↓
0.7 Test Infrastructure           ← after kernel exists
    ↓
[Phase 15: Kernel Oracle can now proceed]
    ↓
16.5 MCP Server Integration       ← after oracle exists
16.6 CLI Kernel Commands          ← after oracle exists
```

## Cross-References

- **Event Bus SOTA:** `docs/research/event-bus-sota-2026.md`
- **Gap Analysis:** `docs/roadmap/CROSS-VERSION-GAP-ANALYSIS.md`
- **Research Report:** `docs/roadmap/RESEARCH-REPORT.md`

## Source Files (Existing Code)

- `src/engines/capability-event-bus.ts` — current bus (274 lines, needs upgrade)
- `src/server/index.ts` — `createServerWithEngines()` at line 212 (bootstrap insertion point)
- `prisma/schema.prisma` — existing schema (needs 4 new tables)
