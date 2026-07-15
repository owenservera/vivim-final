# Architecture Audit — system-wide (surface) — 2026-07-14

- **Scope:** surface
- **Base commit:** d615ea0
- **Root:** C:\0-BlackBoxProject-0\vivim-final\devops\audit-arch
- **Mode:** system-wide

## Graph Overview

- **Modules:** 190
- **Module edges:** 610
- **Cycles:** 5
- **Layer histogram:** L0=25  L1=24  L2=7  L3=76  L4=6  L5=52
- **Top hubs:** index(71)  storage/contracts(59)  server/index(53)  errors(47)  ids(41)  engines/capability-event-bus(33)  engines/chrome-governor(27)  engines/unified-registry(26)

## Executive Summary

- **Risk score:** Medium (M)
- **Priorities:** P0: 0  P1: 5  P2: 0  P3: 0
- **Total findings:** 5

## Priority Legend

- **P0** — Critical — breaks an enforced boundary
- **P1** — High — structural integrity (cycle / wrong direction)
- **P2** — Medium — quality of the module graph
- **P3** — Low — hygiene

## P1 — 5 finding(s)

### Dimension: cycles

### [P1] AR-0001 — Cyclic module dependency (9 modules)
- **Dimension:** cycles
- **Location:** `src/engines/sandbox-runner:0`
- **Evidence:** `cycle: engines/sandbox-runner -> router/router -> engines/provider-mux -> engines/composer-typing -> executor/fleet-supervisor -> engines/chrome-governor -> engines/capability-resolution -> engines/mirror-engine -> storage/contracts -> engines/sandbox-runner`
- **Impact:** Cycles complicate reasoning, break lazy init, and make refactoring risky.
- **Fix Instructions:**
  - Introduce an interface/contract module that the cycle participants depend on, or invert one of the dependency directions.
  - Steps:
    - Pick the edge whose direction is most easily inverted.
    - Extract the shared abstraction into a new foundation module.
    - Depend on the abstraction instead of the concrete module.
    - Re-run `audit-arch` to confirm the cycle is gone.
  - Effort: L  - Auto-fixable: no

### [P1] AR-0002 — Cyclic module dependency (2 modules)
- **Dimension:** cycles
- **Location:** `src/engines/manifest-inference:0`
- **Evidence:** `cycle: engines/manifest-inference -> engines/provider-discovery -> engines/manifest-inference`
- **Impact:** Cycles complicate reasoning, break lazy init, and make refactoring risky.
- **Fix Instructions:**
  - Introduce an interface/contract module that the cycle participants depend on, or invert one of the dependency directions.
  - Steps:
    - Pick the edge whose direction is most easily inverted.
    - Extract the shared abstraction into a new foundation module.
    - Depend on the abstraction instead of the concrete module.
    - Re-run `audit-arch` to confirm the cycle is gone.
  - Effort: L  - Auto-fixable: no

### [P1] AR-0003 — Cyclic module dependency (9 modules)
- **Dimension:** cycles
- **Location:** `src/engines/stream-block-store:0`
- **Evidence:** `cycle: engines/stream-block-store -> engines/conversation-manager -> engines/nlcl -> engines/autonomous-replay -> engines/autonomous-execution -> engines/execution-policy -> storage/impl -> storage/prisma -> storage/db -> engines/stream-block-store`
- **Impact:** Cycles complicate reasoning, break lazy init, and make refactoring risky.
- **Fix Instructions:**
  - Introduce an interface/contract module that the cycle participants depend on, or invert one of the dependency directions.
  - Steps:
    - Pick the edge whose direction is most easily inverted.
    - Extract the shared abstraction into a new foundation module.
    - Depend on the abstraction instead of the concrete module.
    - Re-run `audit-arch` to confirm the cycle is gone.
  - Effort: L  - Auto-fixable: no

### [P1] AR-0004 — Cyclic module dependency (6 modules)
- **Dimension:** cycles
- **Location:** `src/server/canvas-router:0`
- **Evidence:** `cycle: server/canvas-router -> server/setup-router -> server/knowledge-router -> server/conversation-router -> server/capability-router -> server/index -> server/canvas-router`
- **Impact:** Cycles complicate reasoning, break lazy init, and make refactoring risky.
- **Fix Instructions:**
  - Introduce an interface/contract module that the cycle participants depend on, or invert one of the dependency directions.
  - Steps:
    - Pick the edge whose direction is most easily inverted.
    - Extract the shared abstraction into a new foundation module.
    - Depend on the abstraction instead of the concrete module.
    - Re-run `audit-arch` to confirm the cycle is gone.
  - Effort: L  - Auto-fixable: no

### [P1] AR-0005 — Cyclic module dependency (2 modules)
- **Dimension:** cycles
- **Location:** `src/mcp/discovery-tools:0`
- **Evidence:** `cycle: mcp/discovery-tools -> mcp/server -> mcp/discovery-tools`
- **Impact:** Cycles complicate reasoning, break lazy init, and make refactoring risky.
- **Fix Instructions:**
  - Introduce an interface/contract module that the cycle participants depend on, or invert one of the dependency directions.
  - Steps:
    - Pick the edge whose direction is most easily inverted.
    - Extract the shared abstraction into a new foundation module.
    - Depend on the abstraction instead of the concrete module.
    - Re-run `audit-arch` to confirm the cycle is gone.
  - Effort: L  - Auto-fixable: no


## Fix Backlog (prioritized)

| ID | P | Dimension | Location | Effort | Auto-fix |
|----|---|-----------|----------|--------|----------|
| AR-0001 | P1 | cycles | `src/engines/sandbox-runner:0` | L | no |
| AR-0002 | P1 | cycles | `src/engines/manifest-inference:0` | L | no |
| AR-0003 | P1 | cycles | `src/engines/stream-block-store:0` | L | no |
| AR-0004 | P1 | cycles | `src/server/canvas-router:0` | L | no |
| AR-0005 | P1 | cycles | `src/mcp/discovery-tools:0` | L | no |

---
*Generated by `bun run devops audit-arch surface`. Machine-readable findings: arch-findings.json*
