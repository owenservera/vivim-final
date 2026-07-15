# Architecture Audit — system-wide (full) — 2026-07-14

- **Scope:** full
- **Base commit:** d615ea0
- **Root:** C:\0-BlackBoxProject-0\vivim-final\devops\audit-arch
- **Mode:** system-wide

## Graph Overview

- **Modules:** 190
- **Module edges:** 615
- **Cycles:** 6
- **Layer histogram:** L0=25  L1=24  L2=7  L3=76  L4=6  L5=52
- **Top hubs:** index(71)  storage/contracts(60)  server/index(53)  errors(47)  ids(42)  engines/capability-event-bus(33)  engines/chrome-governor(27)  engines/unified-registry(27)

## Executive Summary

- **Risk score:** High (H)
- **Priorities:** P0: 1  P1: 42  P2: 287  P3: 3
- **Total findings:** 333

## Priority Legend

- **P0** — Critical — breaks an enforced boundary
- **P1** — High — structural integrity (cycle / wrong direction)
- **P2** — Medium — quality of the module graph
- **P3** — Low — hygiene

## Trend (vs baseline)

- **Baseline:** 2026-07-14
- **New:** 221  **Resolved:** 150  **Unchanged:** 112

## P0 — 1 finding(s)

### Dimension: boundaries

### [P0] AR-0267 — Boundary violation: B1 (B1)
- **Dimension:** boundaries
- **Location:** `src/engines/cdp-capability-registrar.ts:11`
- **Evidence:** `src/engines/cdp-capability-registrar.ts:11 — Engine imports CDP directly: import { type CdpMethodDescriptor, discoverCdpMethods } from './cdp`
- **Impact:** Breaks an enforced system boundary.
- **Fix Instructions:**
  - Route CDP access exclusively through ChromeGovernor.
  - Steps:
    - Remove the direct CDP/engine import.
    - Depend on a Governor contract exposed by ChromeGovernor.
    - Move the CDP call into chrome-governor.ts.
  - Effort: M  - Auto-fixable: no


## P1 — 42 finding(s)

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

### [P1] AR-0003 — Cyclic module dependency (2 modules)
- **Dimension:** cycles
- **Location:** `src/engines/cdp-capability-registrar:0`
- **Evidence:** `cycle: engines/cdp-capability-registrar -> engines/harness -> engines/cdp-capability-registrar`
- **Impact:** Cycles complicate reasoning, break lazy init, and make refactoring risky.
- **Fix Instructions:**
  - Introduce an interface/contract module that the cycle participants depend on, or invert one of the dependency directions.
  - Steps:
    - Pick the edge whose direction is most easily inverted.
    - Extract the shared abstraction into a new foundation module.
    - Depend on the abstraction instead of the concrete module.
    - Re-run `audit-arch` to confirm the cycle is gone.
  - Effort: L  - Auto-fixable: no

### [P1] AR-0004 — Cyclic module dependency (9 modules)
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

### [P1] AR-0005 — Cyclic module dependency (6 modules)
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

### [P1] AR-0006 — Cyclic module dependency (2 modules)
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


### Dimension: layering

### [P1] AR-0027 — Upward dependency: engines/autonomous-execution -> engines/nlcl
- **Dimension:** layering
- **Location:** `src/engines/autonomous-execution:0`
- **Evidence:** `edge engines/autonomous-execution -> engines/nlcl (layers 3 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/nlcl` rather than `engines/nlcl` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0030 — Upward dependency: engines/capability-bootstrap -> cli/discovery-stack
- **Dimension:** layering
- **Location:** `src/engines/capability-bootstrap:0`
- **Evidence:** `edge engines/capability-bootstrap -> cli/discovery-stack (layers 3 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `cli/discovery-stack` rather than `cli/discovery-stack` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0031 — Upward dependency: engines/capability-bootstrap -> engines/nlcl
- **Dimension:** layering
- **Location:** `src/engines/capability-bootstrap:0`
- **Evidence:** `edge engines/capability-bootstrap -> engines/nlcl (layers 3 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/nlcl` rather than `engines/nlcl` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0033 — Upward dependency: engines/capability -> engines/conversation-manager
- **Dimension:** layering
- **Location:** `src/engines/capability:0`
- **Evidence:** `edge engines/capability -> engines/conversation-manager (layers 2 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/conversation-manager` rather than `engines/conversation-manager` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0034 — Upward dependency: engines/cdp-capability-registrar -> engines/harness
- **Dimension:** layering
- **Location:** `src/engines/cdp-capability-registrar:0`
- **Evidence:** `edge engines/cdp-capability-registrar -> engines/harness (layers 3 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/harness` rather than `engines/harness` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0035 — Upward dependency: engines/chrome-governor -> engines/composer-typing
- **Dimension:** layering
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `edge engines/chrome-governor -> engines/composer-typing (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/composer-typing` rather than `engines/composer-typing` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0041 — Upward dependency: engines/config-universal-surface -> engines/telemetry-aggregator
- **Dimension:** layering
- **Location:** `src/engines/config-universal-surface:0`
- **Evidence:** `edge engines/config-universal-surface -> engines/telemetry-aggregator (layers 3 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/telemetry-aggregator` rather than `engines/telemetry-aggregator` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0050 — Upward dependency: engines/kernel -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/engines/kernel:0`
- **Evidence:** `edge engines/kernel -> engines/capability-event-bus (layers 1 -> 2)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/capability-event-bus` rather than `engines/capability-event-bus` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0051 — Upward dependency: engines/kernel -> engines/config-manager
- **Dimension:** layering
- **Location:** `src/engines/kernel:0`
- **Evidence:** `edge engines/kernel -> engines/config-manager (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/config-manager` rather than `engines/config-manager` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0052 — Upward dependency: engines/kernel -> engines/conversation-manager
- **Dimension:** layering
- **Location:** `src/engines/kernel:0`
- **Evidence:** `edge engines/kernel -> engines/conversation-manager (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/conversation-manager` rather than `engines/conversation-manager` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0053 — Upward dependency: engines/kernel -> engines/nlcl
- **Dimension:** layering
- **Location:** `src/engines/kernel:0`
- **Evidence:** `edge engines/kernel -> engines/nlcl (layers 1 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/nlcl` rather than `engines/nlcl` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0054 — Upward dependency: engines/kernel -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/engines/kernel:0`
- **Evidence:** `edge engines/kernel -> engines/unified-registry (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/unified-registry` rather than `engines/unified-registry` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0059 — Upward dependency: engines/provider-discovery -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/engines/provider-discovery:0`
- **Evidence:** `edge engines/provider-discovery -> engines/capability-event-bus (layers 1 -> 2)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/capability-event-bus` rather than `engines/capability-event-bus` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0060 — Upward dependency: engines/provider-discovery -> engines/capability-shape-registry
- **Dimension:** layering
- **Location:** `src/engines/provider-discovery:0`
- **Evidence:** `edge engines/provider-discovery -> engines/capability-shape-registry (layers 1 -> 2)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/capability-shape-registry` rather than `engines/capability-shape-registry` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0061 — Upward dependency: engines/provider-discovery -> engines/manifest-inference
- **Dimension:** layering
- **Location:** `src/engines/provider-discovery:0`
- **Evidence:** `edge engines/provider-discovery -> engines/manifest-inference (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/manifest-inference` rather than `engines/manifest-inference` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0062 — Upward dependency: engines/provider-health -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/engines/provider-health:0`
- **Evidence:** `edge engines/provider-health -> engines/capability-event-bus (layers 1 -> 2)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/capability-event-bus` rather than `engines/capability-event-bus` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0063 — Upward dependency: engines/provider-mux -> router/router
- **Dimension:** layering
- **Location:** `src/engines/provider-mux:0`
- **Evidence:** `edge engines/provider-mux -> router/router (layers 1 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `router/router` rather than `router/router` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0064 — Upward dependency: engines/provider-mux -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/engines/provider-mux:0`
- **Evidence:** `edge engines/provider-mux -> engines/capability-event-bus (layers 1 -> 2)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/capability-event-bus` rather than `engines/capability-event-bus` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0065 — Upward dependency: engines/provider-mux -> engines/messaging-archetypes
- **Dimension:** layering
- **Location:** `src/engines/provider-mux:0`
- **Evidence:** `edge engines/provider-mux -> engines/messaging-archetypes (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/messaging-archetypes` rather than `engines/messaging-archetypes` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0066 — Upward dependency: engines/provider-registrar -> engines/stream-align
- **Dimension:** layering
- **Location:** `src/engines/provider-registrar:0`
- **Evidence:** `edge engines/provider-registrar -> engines/stream-align (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/stream-align` rather than `engines/stream-align` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0068 — Upward dependency: engines/send-capability -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/engines/send-capability:0`
- **Evidence:** `edge engines/send-capability -> engines/unified-registry (layers 2 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/unified-registry` rather than `engines/unified-registry` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0135 — Upward dependency: schema/chrome -> executor/chrome-instance-profile
- **Dimension:** layering
- **Location:** `src/schema/chrome:0`
- **Evidence:** `edge schema/chrome -> executor/chrome-instance-profile (layers 0 -> 1)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `executor/chrome-instance-profile` rather than `executor/chrome-instance-profile` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0136 — Upward dependency: schema/chrome -> executor/slave-states
- **Dimension:** layering
- **Location:** `src/schema/chrome:0`
- **Evidence:** `edge schema/chrome -> executor/slave-states (layers 0 -> 1)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `executor/slave-states` rather than `executor/slave-states` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0182 — Upward dependency: storage/contracts -> canvas/types
- **Dimension:** layering
- **Location:** `src/storage/contracts:0`
- **Evidence:** `edge storage/contracts -> canvas/types (layers 0 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `canvas/types` rather than `canvas/types` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0183 — Upward dependency: storage/contracts -> executor/slave-states
- **Dimension:** layering
- **Location:** `src/storage/contracts:0`
- **Evidence:** `edge storage/contracts -> executor/slave-states (layers 0 -> 1)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `executor/slave-states` rather than `executor/slave-states` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0184 — Upward dependency: storage/contracts -> engines/mirror-engine
- **Dimension:** layering
- **Location:** `src/storage/contracts:0`
- **Evidence:** `edge storage/contracts -> engines/mirror-engine (layers 0 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/mirror-engine` rather than `engines/mirror-engine` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0185 — Upward dependency: storage/contracts -> engines/provider-mux
- **Dimension:** layering
- **Location:** `src/storage/contracts:0`
- **Evidence:** `edge storage/contracts -> engines/provider-mux (layers 0 -> 1)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/provider-mux` rather than `engines/provider-mux` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0186 — Upward dependency: storage/contracts -> engines/sandbox-runner
- **Dimension:** layering
- **Location:** `src/storage/contracts:0`
- **Evidence:** `edge storage/contracts -> engines/sandbox-runner (layers 0 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/sandbox-runner` rather than `engines/sandbox-runner` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0187 — Upward dependency: storage/db -> storage/impl
- **Dimension:** layering
- **Location:** `src/storage/db:0`
- **Evidence:** `edge storage/db -> storage/impl (layers 0 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `storage/impl` rather than `storage/impl` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0188 — Upward dependency: storage/impl -> engines/harness
- **Dimension:** layering
- **Location:** `src/storage/impl:0`
- **Evidence:** `edge storage/impl -> engines/harness (layers 3 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/harness` rather than `engines/harness` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no


### Dimension: commands

### [P1] AR-0268 — Dangling command: catalog binds "web.query" → missing "cap:web:query"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('web.query', …, { capabilityId: 'cap:web:query' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no

### [P1] AR-0269 — Dangling command: catalog binds "conversation.switch" → missing "cap:conversation:switch"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('conversation.switch', …, { capabilityId: 'cap:conversation:switch' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no

### [P1] AR-0270 — Dangling command: catalog binds "system.capabilities" → missing "cap:system:capabilities"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('system.capabilities', …, { capabilityId: 'cap:system:capabilities' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no

### [P1] AR-0271 — Dangling command: catalog binds "help" → missing "cap:help"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('help', …, { capabilityId: 'cap:help' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no

### [P1] AR-0272 — Dangling command: catalog binds "workflow.newsletter" → missing "cap:workflow:create_newsletter"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('workflow.newsletter', …, { capabilityId: 'cap:workflow:create_newsletter' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no

### [P1] AR-0273 — Dangling command: catalog binds "schedule.register" → missing "cap:schedule:register"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('schedule.register', …, { capabilityId: 'cap:schedule:register' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no


## P2 — 287 finding(s)

### Dimension: layering

### [P2] AR-0007 — Skip-layer dependency: canvas/canvas-agent-tools -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/canvas/canvas-agent-tools:0`
- **Evidence:** `edge canvas/canvas-agent-tools -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0008 — Skip-layer dependency: canvas/canvas-engine -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/canvas/canvas-engine:0`
- **Evidence:** `edge canvas/canvas-engine -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0009 — Skip-layer dependency: canvas/canvas-engine -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/canvas/canvas-engine:0`
- **Evidence:** `edge canvas/canvas-engine -> engines/capability-event-bus (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0010 — Skip-layer dependency: canvas/mutation-caps -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/canvas/mutation-caps:0`
- **Evidence:** `edge canvas/mutation-caps -> engines/capability-event-bus (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0011 — Skip-layer dependency: canvas/mutation-caps -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/canvas/mutation-caps:0`
- **Evidence:** `edge canvas/mutation-caps -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0012 — Skip-layer dependency: cli/commands -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/cli/commands:0`
- **Evidence:** `edge cli/commands -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0013 — Skip-layer dependency: cli/discovery-stack -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/capability-event-bus (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0014 — Skip-layer dependency: cli/discovery-stack -> engines/capability-shape-registry
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/capability-shape-registry (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0015 — Skip-layer dependency: cli/discovery-stack -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/chrome-governor (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0016 — Skip-layer dependency: cli/discovery-stack -> engines/discovery-session-runner
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/discovery-session-runner (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0017 — Skip-layer dependency: cli/discovery-stack -> engines/provider-discovery
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/provider-discovery (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0018 — Skip-layer dependency: cli/discovery-stack -> engines/provider-registrar
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/provider-registrar (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0019 — Skip-layer dependency: cli/discovery-stack -> engines/stream-align
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/stream-align (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0020 — Skip-layer dependency: cli/discovery-stack -> engines/stream-parser
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/stream-parser (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0021 — Skip-layer dependency: cli/discovery-stack -> engines/sandbox-runner
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> engines/sandbox-runner (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0022 — Skip-layer dependency: cli/discovery-stack -> storage/impl
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> storage/impl (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0023 — Skip-layer dependency: cli/discovery-stack -> executor/cdp-transport
- **Dimension:** layering
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `edge cli/discovery-stack -> executor/cdp-transport (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0024 — Skip-layer dependency: cli/index -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/cli/index:0`
- **Evidence:** `edge cli/index -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0025 — Skip-layer dependency: cli/provider-harness -> engines/provider-registrar
- **Dimension:** layering
- **Location:** `src/cli/provider-harness:0`
- **Evidence:** `edge cli/provider-harness -> engines/provider-registrar (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0026 — Skip-layer dependency: engines/autonomous-execution -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/autonomous-execution:0`
- **Evidence:** `edge engines/autonomous-execution -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0028 — Skip-layer dependency: engines/capability-bootstrap -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/capability-bootstrap:0`
- **Evidence:** `edge engines/capability-bootstrap -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0029 — Skip-layer dependency: engines/capability-bootstrap -> executor/profile-allocator
- **Dimension:** layering
- **Location:** `src/engines/capability-bootstrap:0`
- **Evidence:** `edge engines/capability-bootstrap -> executor/profile-allocator (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0032 — Skip-layer dependency: engines/capability-bootstrap -> engines/kernel
- **Dimension:** layering
- **Location:** `src/engines/capability-bootstrap:0`
- **Evidence:** `edge engines/capability-bootstrap -> engines/kernel (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0036 — Skip-layer dependency: engines/chrome-setup-wizard -> executor/launcher
- **Dimension:** layering
- **Location:** `src/engines/chrome-setup-wizard:0`
- **Evidence:** `edge engines/chrome-setup-wizard -> executor/launcher (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0037 — Skip-layer dependency: engines/chrome-setup-wizard -> executor/profile-allocator
- **Dimension:** layering
- **Location:** `src/engines/chrome-setup-wizard:0`
- **Evidence:** `edge engines/chrome-setup-wizard -> executor/profile-allocator (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0038 — Skip-layer dependency: engines/chrome-setup-wizard -> engines/provider-selectors
- **Dimension:** layering
- **Location:** `src/engines/chrome-setup-wizard:0`
- **Evidence:** `edge engines/chrome-setup-wizard -> engines/provider-selectors (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0039 — Skip-layer dependency: engines/composer-typing -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/composer-typing:0`
- **Evidence:** `edge engines/composer-typing -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0040 — Skip-layer dependency: engines/config-universal-surface -> engines/kernel
- **Dimension:** layering
- **Location:** `src/engines/config-universal-surface:0`
- **Evidence:** `edge engines/config-universal-surface -> engines/kernel (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0042 — Skip-layer dependency: engines/conversation-manager -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/conversation-manager:0`
- **Evidence:** `edge engines/conversation-manager -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0043 — Skip-layer dependency: engines/conversation-manager -> engines/provider-selectors
- **Dimension:** layering
- **Location:** `src/engines/conversation-manager:0`
- **Evidence:** `edge engines/conversation-manager -> engines/provider-selectors (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0044 — Skip-layer dependency: engines/discovery-session-runner -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/discovery-session-runner:0`
- **Evidence:** `edge engines/discovery-session-runner -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0045 — Skip-layer dependency: engines/discovery-session-runner -> engines/provider-discovery
- **Dimension:** layering
- **Location:** `src/engines/discovery-session-runner:0`
- **Evidence:** `edge engines/discovery-session-runner -> engines/provider-discovery (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0046 — Skip-layer dependency: engines/eviction-manager -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/eviction-manager:0`
- **Evidence:** `edge engines/eviction-manager -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0047 — Skip-layer dependency: engines/harness -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/harness:0`
- **Evidence:** `edge engines/harness -> engines/chrome-governor (layers 4 -> 1, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0048 — Skip-layer dependency: engines/harness -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/engines/harness:0`
- **Evidence:** `edge engines/harness -> engines/capability-event-bus (layers 4 -> 2, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0049 — Skip-layer dependency: engines/harness-runtime -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/harness-runtime:0`
- **Evidence:** `edge engines/harness-runtime -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0055 — Skip-layer dependency: engines/manifest-inference -> engines/provider-discovery
- **Dimension:** layering
- **Location:** `src/engines/manifest-inference:0`
- **Evidence:** `edge engines/manifest-inference -> engines/provider-discovery (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0056 — Skip-layer dependency: engines/mcp-server-adapter -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/mcp-server-adapter:0`
- **Evidence:** `edge engines/mcp-server-adapter -> engines/chrome-governor (layers 4 -> 1, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0057 — Skip-layer dependency: engines/mirror-engine -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/mirror-engine:0`
- **Evidence:** `edge engines/mirror-engine -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0058 — Skip-layer dependency: engines/nlcl -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/nlcl:0`
- **Evidence:** `edge engines/nlcl -> engines/chrome-governor (layers 4 -> 1, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0067 — Skip-layer dependency: engines/semantic-grounding -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/semantic-grounding:0`
- **Evidence:** `edge engines/semantic-grounding -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0069 — Skip-layer dependency: engines/streaming-channel-caps -> engines/provider-mux
- **Dimension:** layering
- **Location:** `src/engines/streaming-channel-caps:0`
- **Evidence:** `edge engines/streaming-channel-caps -> engines/provider-mux (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0070 — Skip-layer dependency: engines/telemetry-aggregator -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/engines/telemetry-aggregator:0`
- **Evidence:** `edge engines/telemetry-aggregator -> engines/capability-event-bus (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0071 — Skip-layer dependency: engines/telemetry-aggregator -> engines/config-manager
- **Dimension:** layering
- **Location:** `src/engines/telemetry-aggregator:0`
- **Evidence:** `edge engines/telemetry-aggregator -> engines/config-manager (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0072 — Skip-layer dependency: engines/version-manager -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/engines/version-manager:0`
- **Evidence:** `edge engines/version-manager -> engines/capability-event-bus (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0073 — Skip-layer dependency: engines/version-manager -> engines/config-manager
- **Dimension:** layering
- **Location:** `src/engines/version-manager:0`
- **Evidence:** `edge engines/version-manager -> engines/config-manager (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0074 — Skip-layer dependency: engines/workflow-engine -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/workflow-engine:0`
- **Evidence:** `edge engines/workflow-engine -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0075 — Skip-layer dependency: index -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/capability-event-bus (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0076 — Skip-layer dependency: index -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/chrome-governor (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0077 — Skip-layer dependency: index -> engines/conversation-manager
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/conversation-manager (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0078 — Skip-layer dependency: index -> engines/stream-parser
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/stream-parser (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0079 — Skip-layer dependency: index -> engines/capability
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/capability (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0080 — Skip-layer dependency: index -> engines/provider-registrar
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/provider-registrar (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0081 — Skip-layer dependency: index -> engines/capability-resolution
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/capability-resolution (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0082 — Skip-layer dependency: index -> engines/provider-health
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/provider-health (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0083 — Skip-layer dependency: index -> engines/stream-block-store
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/stream-block-store (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0084 — Skip-layer dependency: index -> engines/registration-auditor
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/registration-auditor (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0085 — Skip-layer dependency: index -> engines/config-manager
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/config-manager (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0086 — Skip-layer dependency: index -> engines/execution-memoizer
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/execution-memoizer (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0087 — Skip-layer dependency: index -> engines/harness-runtime
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/harness-runtime (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0088 — Skip-layer dependency: index -> engines/harness-checkpoint
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/harness-checkpoint (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0089 — Skip-layer dependency: index -> engines/capability-macro
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/capability-macro (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0090 — Skip-layer dependency: index -> engines/session-checkpoint
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/session-checkpoint (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0091 — Skip-layer dependency: index -> engines/state-transition
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/state-transition (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0092 — Skip-layer dependency: index -> engines/memory-engine
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/memory-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0093 — Skip-layer dependency: index -> engines/provider-mux
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/provider-mux (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0094 — Skip-layer dependency: index -> engines/cost-optimizer
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/cost-optimizer (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0095 — Skip-layer dependency: index -> engines/situation-detector
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/situation-detector (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0096 — Skip-layer dependency: index -> engines/context-assembly
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/context-assembly (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0097 — Skip-layer dependency: index -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0098 — Skip-layer dependency: index -> engines/plugin-hot-reload
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/plugin-hot-reload (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0099 — Skip-layer dependency: index -> engines/adaptive-workspace
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/adaptive-workspace (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0100 — Skip-layer dependency: index -> engines/conversation-organizer
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/conversation-organizer (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0101 — Skip-layer dependency: index -> engines/autonomous-execution
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/autonomous-execution (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0102 — Skip-layer dependency: index -> engines/autonomous-replay
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/autonomous-replay (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0103 — Skip-layer dependency: index -> engines/health-digest
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/health-digest (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0104 — Skip-layer dependency: index -> engines/db-encryption
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/db-encryption (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0105 — Skip-layer dependency: index -> engines/backup-scheduler
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/backup-scheduler (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0106 — Skip-layer dependency: index -> engines/execution-policy
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/execution-policy (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0107 — Skip-layer dependency: index -> executor/async-mutex
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> executor/async-mutex (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0108 — Skip-layer dependency: index -> executor/circuit-breaker
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> executor/circuit-breaker (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0109 — Skip-layer dependency: index -> executor/fleet-config
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> executor/fleet-config (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0110 — Skip-layer dependency: index -> executor/content-blocks
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> executor/content-blocks (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0111 — Skip-layer dependency: index -> executor/ids
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> executor/ids (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0112 — Skip-layer dependency: index -> alerting/alerter
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> alerting/alerter (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0113 — Skip-layer dependency: index -> automation/scheduler
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> automation/scheduler (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0114 — Skip-layer dependency: index -> engines/encryption
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/encryption (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0115 — Skip-layer dependency: index -> engines/export
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/export (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0116 — Skip-layer dependency: index -> engines/local-model-adapter
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/local-model-adapter (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0117 — Skip-layer dependency: index -> engines/sync
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/sync (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0118 — Skip-layer dependency: index -> storage/impl
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> storage/impl (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0119 — Skip-layer dependency: index -> engines/provider-discovery
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/provider-discovery (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0120 — Skip-layer dependency: index -> engines/manifest-inference
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/manifest-inference (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0121 — Skip-layer dependency: index -> engines/capability-shape-registry
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/capability-shape-registry (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0122 — Skip-layer dependency: index -> engines/session-caps
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/session-caps (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0123 — Skip-layer dependency: index -> engines/workflow-engine
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/workflow-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0124 — Skip-layer dependency: index -> engines/workflow-templates
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/workflow-templates (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0125 — Skip-layer dependency: index -> engines/send-capability
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/send-capability (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0126 — Skip-layer dependency: index -> engines/streaming-channel-caps
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/streaming-channel-caps (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0127 — Skip-layer dependency: index -> engines/messaging-archetypes
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/messaging-archetypes (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0128 — Skip-layer dependency: index -> engines/image-gen-bridge
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/image-gen-bridge (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0129 — Skip-layer dependency: index -> engines/observability
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/observability (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0130 — Skip-layer dependency: index -> engines/stealth
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/stealth (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0131 — Skip-layer dependency: mcp/types -> engines/provider-discovery
- **Dimension:** layering
- **Location:** `src/mcp/types:0`
- **Evidence:** `edge mcp/types -> engines/provider-discovery (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0132 — Skip-layer dependency: mcp/types -> engines/manifest-inference
- **Dimension:** layering
- **Location:** `src/mcp/types:0`
- **Evidence:** `edge mcp/types -> engines/manifest-inference (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0133 — Skip-layer dependency: mcp/types -> engines/capability-shape-registry
- **Dimension:** layering
- **Location:** `src/mcp/types:0`
- **Evidence:** `edge mcp/types -> engines/capability-shape-registry (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0134 — Skip-layer dependency: mcp/types -> engines/provider-registrar
- **Dimension:** layering
- **Location:** `src/mcp/types:0`
- **Evidence:** `edge mcp/types -> engines/provider-registrar (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0137 — Skip-layer dependency: server/autonomous-router -> engines/autonomous-execution
- **Dimension:** layering
- **Location:** `src/server/autonomous-router:0`
- **Evidence:** `edge server/autonomous-router -> engines/autonomous-execution (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0138 — Skip-layer dependency: server/autonomous-router -> engines/execution-policy
- **Dimension:** layering
- **Location:** `src/server/autonomous-router:0`
- **Evidence:** `edge server/autonomous-router -> engines/execution-policy (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0139 — Skip-layer dependency: server/canvas-router -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/server/canvas-router:0`
- **Evidence:** `edge server/canvas-router -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0140 — Skip-layer dependency: server/canvas-ws -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/server/canvas-ws:0`
- **Evidence:** `edge server/canvas-ws -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0141 — Skip-layer dependency: server/capability-router -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/server/capability-router:0`
- **Evidence:** `edge server/capability-router -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0142 — Skip-layer dependency: server/conversation-router -> engines/capability-resolution
- **Dimension:** layering
- **Location:** `src/server/conversation-router:0`
- **Evidence:** `edge server/conversation-router -> engines/capability-resolution (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0143 — Skip-layer dependency: server/conversation-router -> engines/provider-health
- **Dimension:** layering
- **Location:** `src/server/conversation-router:0`
- **Evidence:** `edge server/conversation-router -> engines/provider-health (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0144 — Skip-layer dependency: server/conversation-router -> engines/mirror-engine
- **Dimension:** layering
- **Location:** `src/server/conversation-router:0`
- **Evidence:** `edge server/conversation-router -> engines/mirror-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0145 — Skip-layer dependency: server/index -> engines/capability-bootstrap
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/capability-bootstrap (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0146 — Skip-layer dependency: server/index -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/capability-event-bus (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0147 — Skip-layer dependency: server/index -> engines/capability-resolution
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/capability-resolution (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0148 — Skip-layer dependency: server/index -> executor/profile-allocator
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> executor/profile-allocator (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0149 — Skip-layer dependency: server/index -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/chrome-governor (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0150 — Skip-layer dependency: server/index -> engines/conversation-manager
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/conversation-manager (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0151 — Skip-layer dependency: server/index -> engines/cost-optimizer
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/cost-optimizer (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0152 — Skip-layer dependency: server/index -> engines/cross-conversation-synthesis
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/cross-conversation-synthesis (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0153 — Skip-layer dependency: server/index -> engines/export
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/export (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0154 — Skip-layer dependency: server/index -> engines/idempotency-guard
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/idempotency-guard (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0155 — Skip-layer dependency: server/index -> engines/kernel
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/kernel (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0156 — Skip-layer dependency: server/index -> engines/knowledge-ingestion
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/knowledge-ingestion (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0157 — Skip-layer dependency: server/index -> engines/lock-manager
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/lock-manager (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0158 — Skip-layer dependency: server/index -> engines/provider-health
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/provider-health (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0159 — Skip-layer dependency: server/index -> engines/provider-mux
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/provider-mux (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0160 — Skip-layer dependency: server/index -> engines/retry-engine
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/retry-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0161 — Skip-layer dependency: server/index -> engines/semantic-search
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/semantic-search (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0162 — Skip-layer dependency: server/index -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0163 — Skip-layer dependency: server/index -> engines/autonomous-execution
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/autonomous-execution (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0164 — Skip-layer dependency: server/index -> engines/execution-policy
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/execution-policy (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0165 — Skip-layer dependency: server/index -> engines/stream-parser
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/stream-parser (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0166 — Skip-layer dependency: server/index -> engines/stream-block-store
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/stream-block-store (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0167 — Skip-layer dependency: server/index -> engines/execution-memoizer
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/execution-memoizer (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0168 — Skip-layer dependency: server/index -> engines/memory-engine
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/memory-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0169 — Skip-layer dependency: server/index -> storage/impl
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> storage/impl (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0170 — Skip-layer dependency: server/index -> engines/provider-registrar
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/provider-registrar (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0171 — Skip-layer dependency: server/index -> executor/cdp-transport
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> executor/cdp-transport (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0172 — Skip-layer dependency: server/index -> engines/knowledge-extractor
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/knowledge-extractor (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0173 — Skip-layer dependency: server/kernel-router -> engines/config-universal-surface
- **Dimension:** layering
- **Location:** `src/server/kernel-router:0`
- **Evidence:** `edge server/kernel-router -> engines/config-universal-surface (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0174 — Skip-layer dependency: server/memory-viz-router -> engines/memory-engine
- **Dimension:** layering
- **Location:** `src/server/memory-viz-router:0`
- **Evidence:** `edge server/memory-viz-router -> engines/memory-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0175 — Skip-layer dependency: server/mux-router -> engines/cost-optimizer
- **Dimension:** layering
- **Location:** `src/server/mux-router:0`
- **Evidence:** `edge server/mux-router -> engines/cost-optimizer (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0176 — Skip-layer dependency: server/mux-router -> engines/provider-mux
- **Dimension:** layering
- **Location:** `src/server/mux-router:0`
- **Evidence:** `edge server/mux-router -> engines/provider-mux (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0177 — Skip-layer dependency: server/setup-router -> executor/cdp
- **Dimension:** layering
- **Location:** `src/server/setup-router:0`
- **Evidence:** `edge server/setup-router -> executor/cdp (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0178 — Skip-layer dependency: server/setup-router -> executor/launcher
- **Dimension:** layering
- **Location:** `src/server/setup-router:0`
- **Evidence:** `edge server/setup-router -> executor/launcher (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0179 — Skip-layer dependency: server/setup-router -> executor/profile-allocator
- **Dimension:** layering
- **Location:** `src/server/setup-router:0`
- **Evidence:** `edge server/setup-router -> executor/profile-allocator (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0180 — Skip-layer dependency: server/websocket -> engines/capability-event-bus
- **Dimension:** layering
- **Location:** `src/server/websocket:0`
- **Evidence:** `edge server/websocket -> engines/capability-event-bus (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0181 — Skip-layer dependency: server/websocket -> engines/unified-registry
- **Dimension:** layering
- **Location:** `src/server/websocket:0`
- **Evidence:** `edge server/websocket -> engines/unified-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no


### Dimension: coupling

### [P2] AR-0191 — Hub module: engines/capability-event-bus (fan-in 33, fan-out 0)
- **Dimension:** coupling
- **Location:** `src/engines/capability-event-bus:0`
- **Evidence:** `fan-in=33 fan-out=0 I=0.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0192 — Hub module: engines/chrome-governor (fan-in 22, fan-out 5)
- **Dimension:** coupling
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `fan-in=22 fan-out=5 I=0.19`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0193 — Hub module: engines/unified-registry (fan-in 26, fan-out 1)
- **Dimension:** coupling
- **Location:** `src/engines/unified-registry:0`
- **Evidence:** `fan-in=26 fan-out=1 I=0.04`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0194 — Hub module: errors (fan-in 47, fan-out 0)
- **Dimension:** coupling
- **Location:** `src/errors:0`
- **Evidence:** `fan-in=47 fan-out=0 I=0.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0195 — Hub module: ids (fan-in 42, fan-out 0)
- **Dimension:** coupling
- **Location:** `src/ids:0`
- **Evidence:** `fan-in=42 fan-out=0 I=0.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0196 — Hub module: index (fan-in 0, fan-out 71)
- **Dimension:** coupling
- **Location:** `src/index:0`
- **Evidence:** `fan-in=0 fan-out=71 I=1.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0198 — Hub module: server/index (fan-in 7, fan-out 46)
- **Dimension:** coupling
- **Location:** `src/server/index:0`
- **Evidence:** `fan-in=7 fan-out=46 I=0.87`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0199 — Hub module: storage/contracts (fan-in 52, fan-out 8)
- **Dimension:** coupling
- **Location:** `src/storage/contracts:0`
- **Evidence:** `fan-in=52 fan-out=8 I=0.13`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no


### Dimension: cohesion

### [P2] AR-0200 — Low cohesion: canvas/canvas-agent-tools (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/canvas/canvas-agent-tools:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0201 — Low cohesion: canvas/canvas-engine (internal 0/14)
- **Dimension:** cohesion
- **Location:** `src/canvas/canvas-engine:0`
- **Evidence:** `selfDeps=0 totalDeps=14 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0202 — Low cohesion: canvas/canvas-registry (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/canvas/canvas-registry:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0203 — Low cohesion: canvas/capability-bridge (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/canvas/capability-bridge:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0204 — Low cohesion: canvas/capability-layer (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/canvas/capability-layer:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0205 — Low cohesion: canvas/designer (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/canvas/designer:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0206 — Low cohesion: canvas/index (internal 0/13)
- **Dimension:** cohesion
- **Location:** `src/canvas/index:0`
- **Evidence:** `selfDeps=0 totalDeps=13 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0207 — Low cohesion: canvas/layer-mounter (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/canvas/layer-mounter:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0208 — Low cohesion: canvas/mutation-caps (internal 0/6)
- **Dimension:** cohesion
- **Location:** `src/canvas/mutation-caps:0`
- **Evidence:** `selfDeps=0 totalDeps=6 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0209 — Low cohesion: cli/discovery-stack (internal 0/12)
- **Dimension:** cohesion
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `selfDeps=0 totalDeps=12 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0210 — Low cohesion: cli/index (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/cli/index:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0211 — Low cohesion: cli/provider-harness (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/cli/provider-harness:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0212 — Low cohesion: engines/agentic-loop (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/agentic-loop:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0213 — Low cohesion: engines/autonomous-execution (internal 0/11)
- **Dimension:** cohesion
- **Location:** `src/engines/autonomous-execution:0`
- **Evidence:** `selfDeps=0 totalDeps=11 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0214 — Low cohesion: engines/autonomous-replay (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/autonomous-replay:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0215 — Low cohesion: engines/backup-scheduler (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/backup-scheduler:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0216 — Low cohesion: engines/capability-bootstrap (internal 0/15)
- **Dimension:** cohesion
- **Location:** `src/engines/capability-bootstrap:0`
- **Evidence:** `selfDeps=0 totalDeps=15 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0217 — Low cohesion: engines/capability-discovery-loop (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/capability-discovery-loop:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0218 — Low cohesion: engines/capability (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/capability:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0219 — Low cohesion: engines/cdp-capability-registrar (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/cdp-capability-registrar:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0220 — Low cohesion: engines/chrome-governor (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0221 — Low cohesion: engines/chrome-setup-wizard (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/chrome-setup-wizard:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0222 — Low cohesion: engines/config-universal-surface (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/engines/config-universal-surface:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0223 — Low cohesion: engines/context-assembly (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/context-assembly:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0224 — Low cohesion: engines/conversation-manager (internal 0/12)
- **Dimension:** cohesion
- **Location:** `src/engines/conversation-manager:0`
- **Evidence:** `selfDeps=0 totalDeps=12 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0225 — Low cohesion: engines/conversation-organizer (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/conversation-organizer:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0226 — Low cohesion: engines/discovery-session-runner (internal 0/6)
- **Dimension:** cohesion
- **Location:** `src/engines/discovery-session-runner:0`
- **Evidence:** `selfDeps=0 totalDeps=6 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0227 — Low cohesion: engines/execution-policy (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/execution-policy:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0228 — Low cohesion: engines/harness (internal 1/7)
- **Dimension:** cohesion
- **Location:** `src/engines/harness:0`
- **Evidence:** `selfDeps=1 totalDeps=7 cohesion=0.14`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0229 — Low cohesion: engines/harness-runtime (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/harness-runtime:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0230 — Low cohesion: engines/kernel (internal 1/11)
- **Dimension:** cohesion
- **Location:** `src/engines/kernel:0`
- **Evidence:** `selfDeps=1 totalDeps=11 cohesion=0.09`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0231 — Low cohesion: engines/knowledge-ingestion (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/knowledge-ingestion:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0232 — Low cohesion: engines/memory-indexer (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/memory-indexer:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0233 — Low cohesion: engines/mirror-engine (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/mirror-engine:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0234 — Low cohesion: engines/nlcl (internal 1/8)
- **Dimension:** cohesion
- **Location:** `src/engines/nlcl:0`
- **Evidence:** `selfDeps=1 totalDeps=8 cohesion=0.13`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0235 — Low cohesion: engines/observability (internal 0/6)
- **Dimension:** cohesion
- **Location:** `src/engines/observability:0`
- **Evidence:** `selfDeps=0 totalDeps=6 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0236 — Low cohesion: engines/provider-discovery (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-discovery:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0237 — Low cohesion: engines/provider-health (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-health:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0238 — Low cohesion: engines/provider-mux (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-mux:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0239 — Low cohesion: engines/provider-registrar (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-registrar:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0240 — Low cohesion: engines/registration-auditor (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/registration-auditor:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0241 — Low cohesion: engines/sandbox-runner (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/sandbox-runner:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0242 — Low cohesion: engines/situation-detector (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/situation-detector:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0243 — Low cohesion: engines/sla-monitor (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/sla-monitor:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0244 — Low cohesion: engines/stream-block-store (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/stream-block-store:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0245 — Low cohesion: engines/stream-parser (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/stream-parser:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0246 — Low cohesion: engines/streaming-channel-caps (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/streaming-channel-caps:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0247 — Low cohesion: engines/telemetry-aggregator (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/telemetry-aggregator:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0248 — Low cohesion: engines/version-manager (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/version-manager:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0249 — Low cohesion: engines/workflow-engine (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/workflow-engine:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0250 — Low cohesion: executor/fleet-supervisor (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/executor/fleet-supervisor:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0251 — Low cohesion: index (internal 0/71)
- **Dimension:** cohesion
- **Location:** `src/index:0`
- **Evidence:** `selfDeps=0 totalDeps=71 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0252 — Low cohesion: mcp/index (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/mcp/index:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0253 — Low cohesion: mcp/types (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/mcp/types:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0254 — Low cohesion: router/router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/router/router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0255 — Low cohesion: schema/index (internal 0/15)
- **Dimension:** cohesion
- **Location:** `src/schema/index:0`
- **Evidence:** `selfDeps=0 totalDeps=15 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0256 — Low cohesion: server/canvas-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/canvas-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0257 — Low cohesion: server/canvas-ws (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/server/canvas-ws:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0258 — Low cohesion: server/capability-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/capability-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0259 — Low cohesion: server/conversation-router (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/server/conversation-router:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0260 — Low cohesion: server/index (internal 0/46)
- **Dimension:** cohesion
- **Location:** `src/server/index:0`
- **Evidence:** `selfDeps=0 totalDeps=46 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0261 — Low cohesion: server/knowledge-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/knowledge-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0262 — Low cohesion: server/mux-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/mux-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0263 — Low cohesion: server/setup-router (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/server/setup-router:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0264 — Low cohesion: storage/contracts (internal 1/8)
- **Dimension:** cohesion
- **Location:** `src/storage/contracts:0`
- **Evidence:** `selfDeps=1 totalDeps=8 cohesion=0.13`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0265 — Low cohesion: storage/db (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/storage/db:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0266 — Low cohesion: storage/impl (internal 1/14)
- **Dimension:** cohesion
- **Location:** `src/storage/impl:0`
- **Evidence:** `selfDeps=1 totalDeps=14 cohesion=0.07`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no


### Dimension: commands

### [P2] AR-0274 — Surface "ui" declared but not bound — cap:canvas:spawn
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:canvas:spawn is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:canvas:spawn" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0275 — Surface "ui" declared but not bound — cap:canvas:dismiss
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:canvas:dismiss is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:canvas:dismiss" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0276 — Surface "ui" declared but not bound — cap:canvas:mutate
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:canvas:mutate is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:canvas:mutate" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0277 — Surface "ui" declared but not bound — cap:canvas:observe
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:canvas:observe is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:canvas:observe" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0278 — Surface "ui" declared but not bound — cap:canvas:define
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:canvas:define is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:canvas:define" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0279 — Surface "ui" declared but not bound — cap:canvas:list
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:canvas:list is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:canvas:list" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0280 — Surface "ui" declared but not bound — cap:kernel:query
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:kernel:query is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:kernel:query" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0281 — Surface "ui" declared but not bound — cap:kernel:visibility
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:kernel:visibility is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:kernel:visibility" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0282 — Surface "ui" declared but not bound — cap:kernel:heal
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:kernel:heal is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:kernel:heal" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0283 — Surface "ui" declared but not bound — cap:config:list
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:config:list is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:config:list" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0284 — Surface "ui" declared but not bound — cap:config:get
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:config:get is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:config:get" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0285 — Surface "ui" declared but not bound — cap:config:set
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:config:set is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:config:set" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0286 — Potential new command — no NL catalog entry: cap:canvas:spawn
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:canvas:spawn' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:canvas:spawn' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0287 — Potential new command — no NL catalog entry: cap:canvas:dismiss
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:canvas:dismiss' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:canvas:dismiss' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0288 — Potential new command — no NL catalog entry: cap:canvas:mutate
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:canvas:mutate' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:canvas:mutate' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0289 — Potential new command — no NL catalog entry: cap:canvas:observe
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:canvas:observe' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:canvas:observe' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0290 — Potential new command — no NL catalog entry: cap:canvas:define
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:canvas:define' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:canvas:define' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0291 — Potential new command — no NL catalog entry: cap:canvas:list
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:canvas:list' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:canvas:list' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0292 — Potential new command — no NL catalog entry: cap:kernel:query
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:kernel:query' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:kernel:query' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0293 — Potential new command — no NL catalog entry: cap:kernel:visibility
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:kernel:visibility' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:kernel:visibility' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0294 — Potential new command — no NL catalog entry: cap:kernel:heal
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:kernel:heal' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:kernel:heal' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0295 — Potential new command — no NL catalog entry: cap:config:list
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:config:list' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:config:list' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0296 — Potential new command — no NL catalog entry: cap:config:get
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:config:get' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:config:get' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0297 — Potential new command — no NL catalog entry: cap:config:set
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0`
- **Evidence:** `capabilityId 'cap:config:set' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:config:set' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0298 — Potential new command — no NL catalog entry: cap:canvas:undo
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\mutation-caps.ts:0`
- **Evidence:** `capabilityId 'cap:canvas:undo' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:canvas:undo' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0299 — Potential new command — no NL catalog entry: cap:canvas:history
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\canvas\mutation-caps.ts:0`
- **Evidence:** `capabilityId 'cap:canvas:history' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:canvas:history' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0300 — Potential new command — no NL catalog entry: cap:conversation:send
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:conversation:send' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:conversation:send' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0301 — Potential new command — no NL catalog entry: cap:conversation:delete
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:conversation:delete' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:conversation:delete' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0302 — Potential new command — no NL catalog entry: cap:knowledge:search
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:knowledge:search' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:knowledge:search' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0303 — Potential new command — no NL catalog entry: cap:knowledge:ingest
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:knowledge:ingest' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:knowledge:ingest' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0304 — Potential new command — no NL catalog entry: cap:knowledge:synthesize
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:knowledge:synthesize' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:knowledge:synthesize' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0305 — Potential new command — no NL catalog entry: cap:memory:query
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:memory:query' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:memory:query' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0306 — Potential new command — no NL catalog entry: cap:memory:assert
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:memory:assert' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:memory:assert' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0307 — Potential new command — no NL catalog entry: cap:memory:forget
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:memory:forget' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:memory:forget' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0308 — Potential new command — no NL catalog entry: cap:admin:seed
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:admin:seed' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:admin:seed' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0309 — Potential new command — no NL catalog entry: cap:admin:config_get
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:admin:config_get' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:admin:config_get' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0310 — Potential new command — no NL catalog entry: cap:admin:config_set
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:admin:config_set' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:admin:config_set' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0311 — Potential new command — no NL catalog entry: cap:admin:config_history
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:admin:config_history' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:admin:config_history' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0312 — Potential new command — no NL catalog entry: cap:admin:audit
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:admin:audit' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:admin:audit' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0313 — Potential new command — no NL catalog entry: cap:admin:drift
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:admin:drift' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:admin:drift' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0314 — Potential new command — no NL catalog entry: cap:telemetry:summary
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:telemetry:summary' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:telemetry:summary' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0315 — Potential new command — no NL catalog entry: cap:telemetry:compare
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:telemetry:compare' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:telemetry:compare' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0316 — Potential new command — no NL catalog entry: cap:nlcl:interpret
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:nlcl:interpret' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:nlcl:interpret' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0317 — Potential new command — no NL catalog entry: cap:oracle:query
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:oracle:query' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:oracle:query' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0318 — Potential new command — no NL catalog entry: cap:oracle:heal
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:oracle:heal' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:oracle:heal' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0319 — Potential new command — no NL catalog entry: cap:oracle:scan
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:oracle:scan' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:oracle:scan' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0320 — Potential new command — no NL catalog entry: cap:oracle:events
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:oracle:events' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:oracle:events' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0321 — Potential new command — no NL catalog entry: cap:oracle:visibility
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:oracle:visibility' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:oracle:visibility' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0322 — Potential new command — no NL catalog entry: cap:oracle:manifest
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:oracle:manifest' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:oracle:manifest' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0323 — Potential new command — no NL catalog entry: cap:discovery:run
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:discovery:run' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:discovery:run' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0324 — Potential new command — no NL catalog entry: cap:discovery:interact
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:discovery:interact' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:discovery:interact' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0325 — Potential new command — no NL catalog entry: cap:discovery:align
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:discovery:align' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:discovery:align' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0326 — Potential new command — no NL catalog entry: cap:discovery:list
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:discovery:list' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:discovery:list' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0327 — Potential new command — no NL catalog entry: cap:discovery:show
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:discovery:show' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:discovery:show' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0328 — Potential new command — no NL catalog entry: cap:discovery:manifest
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `capabilityId 'cap:discovery:manifest' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:discovery:manifest' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0329 — Potential new command — no NL catalog entry: cap:email:send
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\send-capability.ts:0`
- **Evidence:** `capabilityId 'cap:email:send' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:email:send' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0330 — Potential new command — no NL catalog entry: cap:message:send
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\send-capability.ts:0`
- **Evidence:** `capabilityId 'cap:message:send' absent from catalog.ts patterns`
- **Impact:** Users cannot invoke this capability conversationally; a new command surface is missing.
- **Fix Instructions:**
  - Add an NL catalog pattern bound to this capability (or accept it is backend-only).
  - Steps:
    - Open src/engines/nlcl/catalog.ts.
    - Add pattern(..., { capabilityId: 'cap:message:send' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0331 — Central command candidate — cliCommand "kernel oracle query" defined by 2 capabilities
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `cliCommand.name 'kernel oracle query' → cap:kernel:query, cap:oracle:query`
- **Impact:** Command-surface fragmentation — the same verb maps to several handlers, confusing the single command layer.
- **Fix Instructions:**
  - Consolidate into one capability/cliCommand that dispatches by sub-argument.
  - Steps:
    - Pick or create a single canonical capability for the verb.
    - Re-point the other capabilities to delegate.
    - Update the catalog + frontend to the canonical id.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0332 — Central command candidate — cliCommand "kernel oracle visibility" defined by 2 capabilities
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `cliCommand.name 'kernel oracle visibility' → cap:kernel:visibility, cap:oracle:visibility`
- **Impact:** Command-surface fragmentation — the same verb maps to several handlers, confusing the single command layer.
- **Fix Instructions:**
  - Consolidate into one capability/cliCommand that dispatches by sub-argument.
  - Steps:
    - Pick or create a single canonical capability for the verb.
    - Re-point the other capabilities to delegate.
    - Update the catalog + frontend to the canonical id.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0333 — Central command candidate — cliCommand "kernel oracle heal" defined by 2 capabilities
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `cliCommand.name 'kernel oracle heal' → cap:kernel:heal, cap:oracle:heal`
- **Impact:** Command-surface fragmentation — the same verb maps to several handlers, confusing the single command layer.
- **Fix Instructions:**
  - Consolidate into one capability/cliCommand that dispatches by sub-argument.
  - Steps:
    - Pick or create a single canonical capability for the verb.
    - Re-point the other capabilities to delegate.
    - Update the catalog + frontend to the canonical id.
  - Effort: M  - Auto-fixable: no


## P3 — 3 finding(s)

### Dimension: coupling

### [P3] AR-0189 — Orphan module: cli/json-schema
- **Dimension:** coupling
- **Location:** `src/cli/json-schema:0`
- **Evidence:** `fan-in=0 fan-out=0 files=1`
- **Impact:** Isolated modules inflate the surface and may be unreachable dead code.
- **Fix Instructions:**
  - Confirm the module is reached (entry point / dynamic import) or remove it if unused.
  - Steps:
    - Grep the codebase for dynamic/string-based references.
    - If truly unused, delete it; otherwise document the entry path.
  - Effort: S  - Auto-fixable: no

### [P3] AR-0190 — Orphan module: cli/repl
- **Dimension:** coupling
- **Location:** `src/cli/repl:0`
- **Evidence:** `fan-in=0 fan-out=0 files=1`
- **Impact:** Isolated modules inflate the surface and may be unreachable dead code.
- **Fix Instructions:**
  - Confirm the module is reached (entry point / dynamic import) or remove it if unused.
  - Steps:
    - Grep the codebase for dynamic/string-based references.
    - If truly unused, delete it; otherwise document the entry path.
  - Effort: S  - Auto-fixable: no

### [P3] AR-0197 — Orphan module: schema/validators
- **Dimension:** coupling
- **Location:** `src/schema/validators:0`
- **Evidence:** `fan-in=0 fan-out=0 files=1`
- **Impact:** Isolated modules inflate the surface and may be unreachable dead code.
- **Fix Instructions:**
  - Confirm the module is reached (entry point / dynamic import) or remove it if unused.
  - Steps:
    - Grep the codebase for dynamic/string-based references.
    - If truly unused, delete it; otherwise document the entry path.
  - Effort: S  - Auto-fixable: no


## Fix Backlog (prioritized)

| ID | P | Dimension | Location | Effort | Auto-fix |
|----|---|-----------|----------|--------|----------|
| AR-0267 | P0 | boundaries | `src/engines/cdp-capability-registrar.ts:11` | M | no |
| AR-0001 | P1 | cycles | `src/engines/sandbox-runner:0` | L | no |
| AR-0002 | P1 | cycles | `src/engines/manifest-inference:0` | L | no |
| AR-0003 | P1 | cycles | `src/engines/cdp-capability-registrar:0` | L | no |
| AR-0004 | P1 | cycles | `src/engines/stream-block-store:0` | L | no |
| AR-0005 | P1 | cycles | `src/server/canvas-router:0` | L | no |
| AR-0006 | P1 | cycles | `src/mcp/discovery-tools:0` | L | no |
| AR-0027 | P1 | layering | `src/engines/autonomous-execution:0` | M | no |
| AR-0030 | P1 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0031 | P1 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0033 | P1 | layering | `src/engines/capability:0` | M | no |
| AR-0034 | P1 | layering | `src/engines/cdp-capability-registrar:0` | M | no |
| AR-0035 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0041 | P1 | layering | `src/engines/config-universal-surface:0` | M | no |
| AR-0050 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0051 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0052 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0053 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0054 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0059 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0060 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0061 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0062 | P1 | layering | `src/engines/provider-health:0` | M | no |
| AR-0063 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0064 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0065 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0066 | P1 | layering | `src/engines/provider-registrar:0` | M | no |
| AR-0068 | P1 | layering | `src/engines/send-capability:0` | M | no |
| AR-0135 | P1 | layering | `src/schema/chrome:0` | M | no |
| AR-0136 | P1 | layering | `src/schema/chrome:0` | M | no |
| AR-0182 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0183 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0184 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0185 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0186 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0187 | P1 | layering | `src/storage/db:0` | M | no |
| AR-0188 | P1 | layering | `src/storage/impl:0` | M | no |
| AR-0268 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0269 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0270 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0271 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0272 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0273 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0007 | P2 | layering | `src/canvas/canvas-agent-tools:0` | M | no |
| AR-0008 | P2 | layering | `src/canvas/canvas-engine:0` | M | no |
| AR-0009 | P2 | layering | `src/canvas/canvas-engine:0` | M | no |
| AR-0010 | P2 | layering | `src/canvas/mutation-caps:0` | M | no |
| AR-0011 | P2 | layering | `src/canvas/mutation-caps:0` | M | no |
| AR-0012 | P2 | layering | `src/cli/commands:0` | M | no |
| AR-0013 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0014 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0015 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0016 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0017 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0018 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0019 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0020 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0021 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0022 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0023 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0024 | P2 | layering | `src/cli/index:0` | M | no |
| AR-0025 | P2 | layering | `src/cli/provider-harness:0` | M | no |
| AR-0026 | P2 | layering | `src/engines/autonomous-execution:0` | M | no |
| AR-0028 | P2 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0029 | P2 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0032 | P2 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0036 | P2 | layering | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0037 | P2 | layering | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0038 | P2 | layering | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0039 | P2 | layering | `src/engines/composer-typing:0` | M | no |
| AR-0040 | P2 | layering | `src/engines/config-universal-surface:0` | M | no |
| AR-0042 | P2 | layering | `src/engines/conversation-manager:0` | M | no |
| AR-0043 | P2 | layering | `src/engines/conversation-manager:0` | M | no |
| AR-0044 | P2 | layering | `src/engines/discovery-session-runner:0` | M | no |
| AR-0045 | P2 | layering | `src/engines/discovery-session-runner:0` | M | no |
| AR-0046 | P2 | layering | `src/engines/eviction-manager:0` | M | no |
| AR-0047 | P2 | layering | `src/engines/harness:0` | M | no |
| AR-0048 | P2 | layering | `src/engines/harness:0` | M | no |
| AR-0049 | P2 | layering | `src/engines/harness-runtime:0` | M | no |
| AR-0055 | P2 | layering | `src/engines/manifest-inference:0` | M | no |
| AR-0056 | P2 | layering | `src/engines/mcp-server-adapter:0` | M | no |
| AR-0057 | P2 | layering | `src/engines/mirror-engine:0` | M | no |
| AR-0058 | P2 | layering | `src/engines/nlcl:0` | M | no |
| AR-0067 | P2 | layering | `src/engines/semantic-grounding:0` | M | no |
| AR-0069 | P2 | layering | `src/engines/streaming-channel-caps:0` | M | no |
| AR-0070 | P2 | layering | `src/engines/telemetry-aggregator:0` | M | no |
| AR-0071 | P2 | layering | `src/engines/telemetry-aggregator:0` | M | no |
| AR-0072 | P2 | layering | `src/engines/version-manager:0` | M | no |
| AR-0073 | P2 | layering | `src/engines/version-manager:0` | M | no |
| AR-0074 | P2 | layering | `src/engines/workflow-engine:0` | M | no |
| AR-0075 | P2 | layering | `src/index:0` | M | no |
| AR-0076 | P2 | layering | `src/index:0` | M | no |
| AR-0077 | P2 | layering | `src/index:0` | M | no |
| AR-0078 | P2 | layering | `src/index:0` | M | no |
| AR-0079 | P2 | layering | `src/index:0` | M | no |
| AR-0080 | P2 | layering | `src/index:0` | M | no |
| AR-0081 | P2 | layering | `src/index:0` | M | no |
| AR-0082 | P2 | layering | `src/index:0` | M | no |
| AR-0083 | P2 | layering | `src/index:0` | M | no |
| AR-0084 | P2 | layering | `src/index:0` | M | no |
| AR-0085 | P2 | layering | `src/index:0` | M | no |
| AR-0086 | P2 | layering | `src/index:0` | M | no |
| AR-0087 | P2 | layering | `src/index:0` | M | no |
| AR-0088 | P2 | layering | `src/index:0` | M | no |
| AR-0089 | P2 | layering | `src/index:0` | M | no |
| AR-0090 | P2 | layering | `src/index:0` | M | no |
| AR-0091 | P2 | layering | `src/index:0` | M | no |
| AR-0092 | P2 | layering | `src/index:0` | M | no |
| AR-0093 | P2 | layering | `src/index:0` | M | no |
| AR-0094 | P2 | layering | `src/index:0` | M | no |
| AR-0095 | P2 | layering | `src/index:0` | M | no |
| AR-0096 | P2 | layering | `src/index:0` | M | no |
| AR-0097 | P2 | layering | `src/index:0` | M | no |
| AR-0098 | P2 | layering | `src/index:0` | M | no |
| AR-0099 | P2 | layering | `src/index:0` | M | no |
| AR-0100 | P2 | layering | `src/index:0` | M | no |
| AR-0101 | P2 | layering | `src/index:0` | M | no |
| AR-0102 | P2 | layering | `src/index:0` | M | no |
| AR-0103 | P2 | layering | `src/index:0` | M | no |
| AR-0104 | P2 | layering | `src/index:0` | M | no |
| AR-0105 | P2 | layering | `src/index:0` | M | no |
| AR-0106 | P2 | layering | `src/index:0` | M | no |
| AR-0107 | P2 | layering | `src/index:0` | M | no |
| AR-0108 | P2 | layering | `src/index:0` | M | no |
| AR-0109 | P2 | layering | `src/index:0` | M | no |
| AR-0110 | P2 | layering | `src/index:0` | M | no |
| AR-0111 | P2 | layering | `src/index:0` | M | no |
| AR-0112 | P2 | layering | `src/index:0` | M | no |
| AR-0113 | P2 | layering | `src/index:0` | M | no |
| AR-0114 | P2 | layering | `src/index:0` | M | no |
| AR-0115 | P2 | layering | `src/index:0` | M | no |
| AR-0116 | P2 | layering | `src/index:0` | M | no |
| AR-0117 | P2 | layering | `src/index:0` | M | no |
| AR-0118 | P2 | layering | `src/index:0` | M | no |
| AR-0119 | P2 | layering | `src/index:0` | M | no |
| AR-0120 | P2 | layering | `src/index:0` | M | no |
| AR-0121 | P2 | layering | `src/index:0` | M | no |
| AR-0122 | P2 | layering | `src/index:0` | M | no |
| AR-0123 | P2 | layering | `src/index:0` | M | no |
| AR-0124 | P2 | layering | `src/index:0` | M | no |
| AR-0125 | P2 | layering | `src/index:0` | M | no |
| AR-0126 | P2 | layering | `src/index:0` | M | no |
| AR-0127 | P2 | layering | `src/index:0` | M | no |
| AR-0128 | P2 | layering | `src/index:0` | M | no |
| AR-0129 | P2 | layering | `src/index:0` | M | no |
| AR-0130 | P2 | layering | `src/index:0` | M | no |
| AR-0131 | P2 | layering | `src/mcp/types:0` | M | no |
| AR-0132 | P2 | layering | `src/mcp/types:0` | M | no |
| AR-0133 | P2 | layering | `src/mcp/types:0` | M | no |
| AR-0134 | P2 | layering | `src/mcp/types:0` | M | no |
| AR-0137 | P2 | layering | `src/server/autonomous-router:0` | M | no |
| AR-0138 | P2 | layering | `src/server/autonomous-router:0` | M | no |
| AR-0139 | P2 | layering | `src/server/canvas-router:0` | M | no |
| AR-0140 | P2 | layering | `src/server/canvas-ws:0` | M | no |
| AR-0141 | P2 | layering | `src/server/capability-router:0` | M | no |
| AR-0142 | P2 | layering | `src/server/conversation-router:0` | M | no |
| AR-0143 | P2 | layering | `src/server/conversation-router:0` | M | no |
| AR-0144 | P2 | layering | `src/server/conversation-router:0` | M | no |
| AR-0145 | P2 | layering | `src/server/index:0` | M | no |
| AR-0146 | P2 | layering | `src/server/index:0` | M | no |
| AR-0147 | P2 | layering | `src/server/index:0` | M | no |
| AR-0148 | P2 | layering | `src/server/index:0` | M | no |
| AR-0149 | P2 | layering | `src/server/index:0` | M | no |
| AR-0150 | P2 | layering | `src/server/index:0` | M | no |
| AR-0151 | P2 | layering | `src/server/index:0` | M | no |
| AR-0152 | P2 | layering | `src/server/index:0` | M | no |
| AR-0153 | P2 | layering | `src/server/index:0` | M | no |
| AR-0154 | P2 | layering | `src/server/index:0` | M | no |
| AR-0155 | P2 | layering | `src/server/index:0` | M | no |
| AR-0156 | P2 | layering | `src/server/index:0` | M | no |
| AR-0157 | P2 | layering | `src/server/index:0` | M | no |
| AR-0158 | P2 | layering | `src/server/index:0` | M | no |
| AR-0159 | P2 | layering | `src/server/index:0` | M | no |
| AR-0160 | P2 | layering | `src/server/index:0` | M | no |
| AR-0161 | P2 | layering | `src/server/index:0` | M | no |
| AR-0162 | P2 | layering | `src/server/index:0` | M | no |
| AR-0163 | P2 | layering | `src/server/index:0` | M | no |
| AR-0164 | P2 | layering | `src/server/index:0` | M | no |
| AR-0165 | P2 | layering | `src/server/index:0` | M | no |
| AR-0166 | P2 | layering | `src/server/index:0` | M | no |
| AR-0167 | P2 | layering | `src/server/index:0` | M | no |
| AR-0168 | P2 | layering | `src/server/index:0` | M | no |
| AR-0169 | P2 | layering | `src/server/index:0` | M | no |
| AR-0170 | P2 | layering | `src/server/index:0` | M | no |
| AR-0171 | P2 | layering | `src/server/index:0` | M | no |
| AR-0172 | P2 | layering | `src/server/index:0` | M | no |
| AR-0173 | P2 | layering | `src/server/kernel-router:0` | M | no |
| AR-0174 | P2 | layering | `src/server/memory-viz-router:0` | M | no |
| AR-0175 | P2 | layering | `src/server/mux-router:0` | M | no |
| AR-0176 | P2 | layering | `src/server/mux-router:0` | M | no |
| AR-0177 | P2 | layering | `src/server/setup-router:0` | M | no |
| AR-0178 | P2 | layering | `src/server/setup-router:0` | M | no |
| AR-0179 | P2 | layering | `src/server/setup-router:0` | M | no |
| AR-0180 | P2 | layering | `src/server/websocket:0` | M | no |
| AR-0181 | P2 | layering | `src/server/websocket:0` | M | no |
| AR-0191 | P2 | coupling | `src/engines/capability-event-bus:0` | L | no |
| AR-0192 | P2 | coupling | `src/engines/chrome-governor:0` | L | no |
| AR-0193 | P2 | coupling | `src/engines/unified-registry:0` | L | no |
| AR-0194 | P2 | coupling | `src/errors:0` | L | no |
| AR-0195 | P2 | coupling | `src/ids:0` | L | no |
| AR-0196 | P2 | coupling | `src/index:0` | L | no |
| AR-0198 | P2 | coupling | `src/server/index:0` | L | no |
| AR-0199 | P2 | coupling | `src/storage/contracts:0` | L | no |
| AR-0200 | P2 | cohesion | `src/canvas/canvas-agent-tools:0` | M | no |
| AR-0201 | P2 | cohesion | `src/canvas/canvas-engine:0` | M | no |
| AR-0202 | P2 | cohesion | `src/canvas/canvas-registry:0` | M | no |
| AR-0203 | P2 | cohesion | `src/canvas/capability-bridge:0` | M | no |
| AR-0204 | P2 | cohesion | `src/canvas/capability-layer:0` | M | no |
| AR-0205 | P2 | cohesion | `src/canvas/designer:0` | M | no |
| AR-0206 | P2 | cohesion | `src/canvas/index:0` | M | no |
| AR-0207 | P2 | cohesion | `src/canvas/layer-mounter:0` | M | no |
| AR-0208 | P2 | cohesion | `src/canvas/mutation-caps:0` | M | no |
| AR-0209 | P2 | cohesion | `src/cli/discovery-stack:0` | M | no |
| AR-0210 | P2 | cohesion | `src/cli/index:0` | M | no |
| AR-0211 | P2 | cohesion | `src/cli/provider-harness:0` | M | no |
| AR-0212 | P2 | cohesion | `src/engines/agentic-loop:0` | M | no |
| AR-0213 | P2 | cohesion | `src/engines/autonomous-execution:0` | M | no |
| AR-0214 | P2 | cohesion | `src/engines/autonomous-replay:0` | M | no |
| AR-0215 | P2 | cohesion | `src/engines/backup-scheduler:0` | M | no |
| AR-0216 | P2 | cohesion | `src/engines/capability-bootstrap:0` | M | no |
| AR-0217 | P2 | cohesion | `src/engines/capability-discovery-loop:0` | M | no |
| AR-0218 | P2 | cohesion | `src/engines/capability:0` | M | no |
| AR-0219 | P2 | cohesion | `src/engines/cdp-capability-registrar:0` | M | no |
| AR-0220 | P2 | cohesion | `src/engines/chrome-governor:0` | M | no |
| AR-0221 | P2 | cohesion | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0222 | P2 | cohesion | `src/engines/config-universal-surface:0` | M | no |
| AR-0223 | P2 | cohesion | `src/engines/context-assembly:0` | M | no |
| AR-0224 | P2 | cohesion | `src/engines/conversation-manager:0` | M | no |
| AR-0225 | P2 | cohesion | `src/engines/conversation-organizer:0` | M | no |
| AR-0226 | P2 | cohesion | `src/engines/discovery-session-runner:0` | M | no |
| AR-0227 | P2 | cohesion | `src/engines/execution-policy:0` | M | no |
| AR-0228 | P2 | cohesion | `src/engines/harness:0` | M | no |
| AR-0229 | P2 | cohesion | `src/engines/harness-runtime:0` | M | no |
| AR-0230 | P2 | cohesion | `src/engines/kernel:0` | M | no |
| AR-0231 | P2 | cohesion | `src/engines/knowledge-ingestion:0` | M | no |
| AR-0232 | P2 | cohesion | `src/engines/memory-indexer:0` | M | no |
| AR-0233 | P2 | cohesion | `src/engines/mirror-engine:0` | M | no |
| AR-0234 | P2 | cohesion | `src/engines/nlcl:0` | M | no |
| AR-0235 | P2 | cohesion | `src/engines/observability:0` | M | no |
| AR-0236 | P2 | cohesion | `src/engines/provider-discovery:0` | M | no |
| AR-0237 | P2 | cohesion | `src/engines/provider-health:0` | M | no |
| AR-0238 | P2 | cohesion | `src/engines/provider-mux:0` | M | no |
| AR-0239 | P2 | cohesion | `src/engines/provider-registrar:0` | M | no |
| AR-0240 | P2 | cohesion | `src/engines/registration-auditor:0` | M | no |
| AR-0241 | P2 | cohesion | `src/engines/sandbox-runner:0` | M | no |
| AR-0242 | P2 | cohesion | `src/engines/situation-detector:0` | M | no |
| AR-0243 | P2 | cohesion | `src/engines/sla-monitor:0` | M | no |
| AR-0244 | P2 | cohesion | `src/engines/stream-block-store:0` | M | no |
| AR-0245 | P2 | cohesion | `src/engines/stream-parser:0` | M | no |
| AR-0246 | P2 | cohesion | `src/engines/streaming-channel-caps:0` | M | no |
| AR-0247 | P2 | cohesion | `src/engines/telemetry-aggregator:0` | M | no |
| AR-0248 | P2 | cohesion | `src/engines/version-manager:0` | M | no |
| AR-0249 | P2 | cohesion | `src/engines/workflow-engine:0` | M | no |
| AR-0250 | P2 | cohesion | `src/executor/fleet-supervisor:0` | M | no |
| AR-0251 | P2 | cohesion | `src/index:0` | M | no |
| AR-0252 | P2 | cohesion | `src/mcp/index:0` | M | no |
| AR-0253 | P2 | cohesion | `src/mcp/types:0` | M | no |
| AR-0254 | P2 | cohesion | `src/router/router:0` | M | no |
| AR-0255 | P2 | cohesion | `src/schema/index:0` | M | no |
| AR-0256 | P2 | cohesion | `src/server/canvas-router:0` | M | no |
| AR-0257 | P2 | cohesion | `src/server/canvas-ws:0` | M | no |
| AR-0258 | P2 | cohesion | `src/server/capability-router:0` | M | no |
| AR-0259 | P2 | cohesion | `src/server/conversation-router:0` | M | no |
| AR-0260 | P2 | cohesion | `src/server/index:0` | M | no |
| AR-0261 | P2 | cohesion | `src/server/knowledge-router:0` | M | no |
| AR-0262 | P2 | cohesion | `src/server/mux-router:0` | M | no |
| AR-0263 | P2 | cohesion | `src/server/setup-router:0` | M | no |
| AR-0264 | P2 | cohesion | `src/storage/contracts:0` | M | no |
| AR-0265 | P2 | cohesion | `src/storage/db:0` | M | no |
| AR-0266 | P2 | cohesion | `src/storage/impl:0` | M | no |
| AR-0274 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0275 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0276 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0277 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0278 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0279 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0280 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0281 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0282 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0283 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0284 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0285 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0286 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0287 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0288 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0289 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0290 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0291 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0292 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0293 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0294 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0295 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0296 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0297 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\canvas-agent-tools.ts:0` | S | no |
| AR-0298 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\mutation-caps.ts:0` | S | no |
| AR-0299 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\canvas\mutation-caps.ts:0` | S | no |
| AR-0300 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0301 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0302 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0303 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0304 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0305 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0306 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0307 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0308 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0309 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0310 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0311 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0312 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0313 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0314 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0315 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0316 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0317 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0318 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0319 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0320 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0321 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0322 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0323 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0324 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0325 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0326 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0327 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0328 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0329 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\send-capability.ts:0` | S | no |
| AR-0330 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\send-capability.ts:0` | S | no |
| AR-0331 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | M | no |
| AR-0332 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | M | no |
| AR-0333 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | M | no |
| AR-0189 | P3 | coupling | `src/cli/json-schema:0` | S | no |
| AR-0190 | P3 | coupling | `src/cli/repl:0` | S | no |
| AR-0197 | P3 | coupling | `src/schema/validators:0` | S | no |

---
*Generated by `bun run devops audit-arch full`. Machine-readable findings: arch-findings.json*
