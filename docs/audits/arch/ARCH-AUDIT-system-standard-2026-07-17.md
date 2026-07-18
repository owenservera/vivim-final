# Architecture Audit — system-wide (standard) — 2026-07-17

- **Scope:** standard
- **Base commit:** 47342ab
- **Root:** C:\0-BlackBoxProject-0\vivim-final\devops\audit-arch
- **Mode:** system-wide

## Graph Overview

- **Modules:** 212
- **Module edges:** 714
- **Cycles:** 5
- **Layer histogram:** L0=26  L1=25  L2=7  L3=91  L4=6  L5=57
- **Top hubs:** index(74)  server/index(67)  storage/contracts(64)  errors(58)  ids(47)  engines/capability-event-bus(36)  engines/chrome-governor(30)  engines/unified-registry(30)

## Executive Summary

- **Risk score:** Medium (M)
- **Priorities:** P0: 0  P1: 41  P2: 86  P3: 4
- **Total findings:** 131

## Priority Legend

- **P0** — Critical — breaks an enforced boundary
- **P1** — High — structural integrity (cycle / wrong direction)
- **P2** — Medium — quality of the module graph
- **P3** — Low — hygiene

## P1 — 41 finding(s)

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

### [P1] AR-0004 — Cyclic module dependency (32 modules)
- **Dimension:** cycles
- **Location:** `src/server/routes:0`
- **Evidence:** `cycle: server/routes -> server/canvas-ws -> server/canvas-router -> server/webhook-router -> server/plugin-router -> server/conceptual-router -> server/setup-router -> server/nlcl-router -> server/knowledge-router -> server/conversation-router -> server/capability-router -> server/autonomous-router -> engines/trust-score -> engines/provider-health -> engines/idempotency-guard -> engines/kernel -> engines/chrome-setup-wizard -> engines/cross-conversation-synthesis -> engines/capability-bootstrap -> server/index -> engines/stream-block-store -> engines/semantic-search -> engines/context-assembly -> engines/conversation-manager -> engines/nlcl -> engines/autonomous-replay -> engines/autonomous-execution -> engines/execution-policy -> storage/impl -> storage/prisma -> storage/db -> cli/discovery-stack -> server/routes`
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


### Dimension: layering

### [P1] AR-0006 — Upward dependency: automation/automation-router -> server/response
- **Dimension:** layering
- **Location:** `src/automation/automation-router:0`
- **Evidence:** `edge automation/automation-router -> server/response (layers 3 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `server/response` rather than `server/response` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0007 — Upward dependency: engines/autonomous-execution -> engines/nlcl
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

### [P1] AR-0008 — Upward dependency: engines/capability-bootstrap -> cli/discovery-stack
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

### [P1] AR-0009 — Upward dependency: engines/capability-bootstrap -> engines/nlcl
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

### [P1] AR-0010 — Upward dependency: engines/capability -> engines/conversation-manager
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

### [P1] AR-0011 — Upward dependency: engines/cdp-capability-registrar -> engines/harness
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

### [P1] AR-0012 — Upward dependency: engines/chrome-governor -> engines/composer-typing
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

### [P1] AR-0013 — Upward dependency: engines/config-universal-surface -> engines/telemetry-aggregator
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

### [P1] AR-0014 — Upward dependency: engines/conversation-manager -> server/index
- **Dimension:** layering
- **Location:** `src/engines/conversation-manager:0`
- **Evidence:** `edge engines/conversation-manager -> server/index (layers 3 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `server/index` rather than `server/index` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0015 — Upward dependency: engines/kernel -> engines/capability-event-bus
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

### [P1] AR-0016 — Upward dependency: engines/kernel -> engines/config-manager
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

### [P1] AR-0017 — Upward dependency: engines/kernel -> engines/conversation-manager
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

### [P1] AR-0018 — Upward dependency: engines/kernel -> engines/nlcl
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

### [P1] AR-0019 — Upward dependency: engines/kernel -> engines/unified-registry
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

### [P1] AR-0020 — Upward dependency: engines/provider-discovery -> engines/capability-event-bus
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

### [P1] AR-0021 — Upward dependency: engines/provider-discovery -> engines/capability-shape-registry
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

### [P1] AR-0022 — Upward dependency: engines/provider-discovery -> engines/manifest-inference
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

### [P1] AR-0023 — Upward dependency: engines/provider-health -> engines/capability-event-bus
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

### [P1] AR-0024 — Upward dependency: engines/provider-health -> engines/trust-score
- **Dimension:** layering
- **Location:** `src/engines/provider-health:0`
- **Evidence:** `edge engines/provider-health -> engines/trust-score (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/trust-score` rather than `engines/trust-score` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0025 — Upward dependency: engines/provider-mux -> router/router
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

### [P1] AR-0026 — Upward dependency: engines/provider-mux -> engines/capability-event-bus
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

### [P1] AR-0027 — Upward dependency: engines/provider-mux -> engines/messaging-archetypes
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

### [P1] AR-0028 — Upward dependency: engines/provider-registrar -> engines/stream-align
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

### [P1] AR-0029 — Upward dependency: engines/semantic-search -> engines/nlcl
- **Dimension:** layering
- **Location:** `src/engines/semantic-search:0`
- **Evidence:** `edge engines/semantic-search -> engines/nlcl (layers 3 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/nlcl` rather than `engines/nlcl` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0030 — Upward dependency: engines/send-capability -> engines/unified-registry
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

### [P1] AR-0031 — Upward dependency: schema/chrome -> executor/chrome-instance-profile
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

### [P1] AR-0032 — Upward dependency: schema/chrome -> executor/slave-states
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

### [P1] AR-0033 — Upward dependency: storage/contracts -> canvas/types
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

### [P1] AR-0034 — Upward dependency: storage/contracts -> executor/slave-states
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

### [P1] AR-0035 — Upward dependency: storage/contracts -> engines/intent-decomposer
- **Dimension:** layering
- **Location:** `src/storage/contracts:0`
- **Evidence:** `edge storage/contracts -> engines/intent-decomposer (layers 0 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/intent-decomposer` rather than `engines/intent-decomposer` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0036 — Upward dependency: storage/contracts -> engines/mirror-engine
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

### [P1] AR-0037 — Upward dependency: storage/contracts -> engines/provider-mux
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

### [P1] AR-0038 — Upward dependency: storage/contracts -> engines/sandbox-runner
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

### [P1] AR-0039 — Upward dependency: storage/db -> storage/impl
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

### [P1] AR-0040 — Upward dependency: storage/impl -> engines/harness
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

### [P1] AR-0131 — Duplicate capability id: cap:conversation:send
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0`
- **Evidence:** `id: 'cap:conversation:send' repeated 2× in capability-bootstrap.ts`
- **Impact:** Registry collision — the later definition shadows earlier ones; commands silently resolve to the wrong handler.
- **Fix Instructions:**
  - Make each capability id unique (namespaced by category).
  - Steps:
    - Find the duplicate makeCapability blocks.
    - Rename one id to a distinct, namespaced value.
    - Re-run the catalog binding check.
  - Effort: S  - Auto-fixable: no


## P2 — 86 finding(s)

### Dimension: coupling

### [P2] AR-0043 — Hub module: engines/capability-event-bus (fan-in 36, fan-out 0)
- **Dimension:** coupling
- **Location:** `src/engines/capability-event-bus:0`
- **Evidence:** `fan-in=36 fan-out=0 I=0.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0044 — Hub module: engines/chrome-governor (fan-in 23, fan-out 7)
- **Dimension:** coupling
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `fan-in=23 fan-out=7 I=0.23`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0045 — Hub module: engines/unified-registry (fan-in 29, fan-out 1)
- **Dimension:** coupling
- **Location:** `src/engines/unified-registry:0`
- **Evidence:** `fan-in=29 fan-out=1 I=0.03`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0046 — Hub module: errors (fan-in 58, fan-out 0)
- **Dimension:** coupling
- **Location:** `src/errors:0`
- **Evidence:** `fan-in=58 fan-out=0 I=0.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0048 — Hub module: ids (fan-in 47, fan-out 0)
- **Dimension:** coupling
- **Location:** `src/ids:0`
- **Evidence:** `fan-in=47 fan-out=0 I=0.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0049 — Hub module: index (fan-in 0, fan-out 74)
- **Dimension:** coupling
- **Location:** `src/index:0`
- **Evidence:** `fan-in=0 fan-out=74 I=1.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0051 — Hub module: server/index (fan-in 11, fan-out 56)
- **Dimension:** coupling
- **Location:** `src/server/index:0`
- **Evidence:** `fan-in=11 fan-out=56 I=0.84`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0052 — Hub module: storage/contracts (fan-in 54, fan-out 10)
- **Dimension:** coupling
- **Location:** `src/storage/contracts:0`
- **Evidence:** `fan-in=54 fan-out=10 I=0.16`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no


### Dimension: cohesion

### [P2] AR-0053 — Low cohesion: canvas/canvas-agent-tools (internal 0/7)
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

### [P2] AR-0054 — Low cohesion: canvas/canvas-engine (internal 0/14)
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

### [P2] AR-0055 — Low cohesion: canvas/canvas-registry (internal 0/5)
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

### [P2] AR-0056 — Low cohesion: canvas/capability-bridge (internal 0/4)
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

### [P2] AR-0057 — Low cohesion: canvas/capability-layer (internal 0/4)
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

### [P2] AR-0058 — Low cohesion: canvas/designer (internal 0/3)
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

### [P2] AR-0059 — Low cohesion: canvas/index (internal 0/13)
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

### [P2] AR-0060 — Low cohesion: canvas/layer-mounter (internal 0/4)
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

### [P2] AR-0061 — Low cohesion: canvas/mutation-caps (internal 0/6)
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

### [P2] AR-0062 — Low cohesion: cli/commands (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/cli/commands:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0063 — Low cohesion: cli/discovery-stack (internal 0/13)
- **Dimension:** cohesion
- **Location:** `src/cli/discovery-stack:0`
- **Evidence:** `selfDeps=0 totalDeps=13 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0064 — Low cohesion: cli/index (internal 0/5)
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

### [P2] AR-0065 — Low cohesion: cli/provider-harness (internal 0/3)
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

### [P2] AR-0066 — Low cohesion: engines/agentic-loop (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/engines/agentic-loop:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0067 — Low cohesion: engines/autonomous-execution (internal 0/11)
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

### [P2] AR-0068 — Low cohesion: engines/autonomous-replay (internal 0/5)
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

### [P2] AR-0069 — Low cohesion: engines/capability-bootstrap-generated (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/capability-bootstrap-generated:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0070 — Low cohesion: engines/capability-bootstrap (internal 0/21)
- **Dimension:** cohesion
- **Location:** `src/engines/capability-bootstrap:0`
- **Evidence:** `selfDeps=0 totalDeps=21 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0071 — Low cohesion: engines/capability-discovery-loop (internal 0/3)
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

### [P2] AR-0072 — Low cohesion: engines/capability (internal 0/5)
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

### [P2] AR-0073 — Low cohesion: engines/cdp-capability-registrar (internal 0/4)
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

### [P2] AR-0074 — Low cohesion: engines/chrome-governor (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0075 — Low cohesion: engines/chrome-setup-wizard (internal 0/6)
- **Dimension:** cohesion
- **Location:** `src/engines/chrome-setup-wizard:0`
- **Evidence:** `selfDeps=0 totalDeps=6 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0076 — Low cohesion: engines/command-parity-capabilities (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/command-parity-capabilities:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0077 — Low cohesion: engines/config-universal-surface (internal 0/7)
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

### [P2] AR-0078 — Low cohesion: engines/context-assembly (internal 0/5)
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

### [P2] AR-0079 — Low cohesion: engines/conversation-manager (internal 0/14)
- **Dimension:** cohesion
- **Location:** `src/engines/conversation-manager:0`
- **Evidence:** `selfDeps=0 totalDeps=14 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0080 — Low cohesion: engines/conversation-organizer (internal 0/3)
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

### [P2] AR-0081 — Low cohesion: engines/discovery-session-runner (internal 0/6)
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

### [P2] AR-0082 — Low cohesion: engines/execution-policy (internal 0/3)
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

### [P2] AR-0083 — Low cohesion: engines/harness (internal 1/8)
- **Dimension:** cohesion
- **Location:** `src/engines/harness:0`
- **Evidence:** `selfDeps=1 totalDeps=8 cohesion=0.13`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0084 — Low cohesion: engines/harness-runtime (internal 0/3)
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

### [P2] AR-0085 — Low cohesion: engines/kernel (internal 1/11)
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

### [P2] AR-0086 — Low cohesion: engines/knowledge-ingestion (internal 0/5)
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

### [P2] AR-0087 — Low cohesion: engines/memory-indexer (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/memory-indexer:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0088 — Low cohesion: engines/mirror-engine (internal 0/5)
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

### [P2] AR-0089 — Low cohesion: engines/nlcl (internal 1/9)
- **Dimension:** cohesion
- **Location:** `src/engines/nlcl:0`
- **Evidence:** `selfDeps=1 totalDeps=9 cohesion=0.11`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0090 — Low cohesion: engines/observability (internal 0/6)
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

### [P2] AR-0091 — Low cohesion: engines/provider-discovery (internal 0/7)
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

### [P2] AR-0092 — Low cohesion: engines/provider-health (internal 0/6)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-health:0`
- **Evidence:** `selfDeps=0 totalDeps=6 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0093 — Low cohesion: engines/provider-mux (internal 0/7)
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

### [P2] AR-0094 — Low cohesion: engines/provider-registrar (internal 0/5)
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

### [P2] AR-0095 — Low cohesion: engines/registration-auditor (internal 0/3)
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

### [P2] AR-0096 — Low cohesion: engines/sandbox-runner (internal 0/3)
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

### [P2] AR-0097 — Low cohesion: engines/semantic-search (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/semantic-search:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0098 — Low cohesion: engines/send-resilience (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/send-resilience:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0099 — Low cohesion: engines/session-caps (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/session-caps:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0100 — Low cohesion: engines/situation-detector (internal 0/3)
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

### [P2] AR-0101 — Low cohesion: engines/sla-monitor (internal 0/3)
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

### [P2] AR-0102 — Low cohesion: engines/stream-block-store (internal 0/3)
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

### [P2] AR-0103 — Low cohesion: engines/stream-parser (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/stream-parser:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0104 — Low cohesion: engines/streaming-channel-caps (internal 0/5)
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

### [P2] AR-0105 — Low cohesion: engines/telemetry-aggregator (internal 0/3)
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

### [P2] AR-0106 — Low cohesion: engines/user-identity (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/user-identity:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0107 — Low cohesion: engines/version-manager (internal 0/5)
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

### [P2] AR-0108 — Low cohesion: engines/workflow-compiler (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/workflow-compiler:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0109 — Low cohesion: engines/workflow-engine (internal 0/6)
- **Dimension:** cohesion
- **Location:** `src/engines/workflow-engine:0`
- **Evidence:** `selfDeps=0 totalDeps=6 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0110 — Low cohesion: executor/fleet-supervisor (internal 0/7)
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

### [P2] AR-0111 — Low cohesion: index (internal 0/74)
- **Dimension:** cohesion
- **Location:** `src/index:0`
- **Evidence:** `selfDeps=0 totalDeps=74 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0112 — Low cohesion: mcp/index (internal 0/3)
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

### [P2] AR-0113 — Low cohesion: mcp/types (internal 0/4)
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

### [P2] AR-0114 — Low cohesion: router/router (internal 0/3)
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

### [P2] AR-0115 — Low cohesion: schema/index (internal 0/16)
- **Dimension:** cohesion
- **Location:** `src/schema/index:0`
- **Evidence:** `selfDeps=0 totalDeps=16 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0116 — Low cohesion: server/canvas-router (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/server/canvas-router:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0117 — Low cohesion: server/canvas-ws (internal 0/7)
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

### [P2] AR-0118 — Low cohesion: server/capability-router (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/server/capability-router:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0119 — Low cohesion: server/conceptual-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/conceptual-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0120 — Low cohesion: server/conversation-router (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/server/conversation-router:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0121 — Low cohesion: server/index (internal 0/56)
- **Dimension:** cohesion
- **Location:** `src/server/index:0`
- **Evidence:** `selfDeps=0 totalDeps=56 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0122 — Low cohesion: server/interpret-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/interpret-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0123 — Low cohesion: server/kernel-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/kernel-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0124 — Low cohesion: server/knowledge-router (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/server/knowledge-router:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0125 — Low cohesion: server/mux-router (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/server/mux-router:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0126 — Low cohesion: server/plugin-router (internal 0/7)
- **Dimension:** cohesion
- **Location:** `src/server/plugin-router:0`
- **Evidence:** `selfDeps=0 totalDeps=7 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0127 — Low cohesion: server/setup-router (internal 0/8)
- **Dimension:** cohesion
- **Location:** `src/server/setup-router:0`
- **Evidence:** `selfDeps=0 totalDeps=8 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0128 — Low cohesion: storage/contracts (internal 1/10)
- **Dimension:** cohesion
- **Location:** `src/storage/contracts:0`
- **Evidence:** `selfDeps=1 totalDeps=10 cohesion=0.10`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0129 — Low cohesion: storage/db (internal 0/4)
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

### [P2] AR-0130 — Low cohesion: storage/impl (internal 1/16)
- **Dimension:** cohesion
- **Location:** `src/storage/impl:0`
- **Evidence:** `selfDeps=1 totalDeps=16 cohesion=0.06`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no


## P3 — 4 finding(s)

### Dimension: coupling

### [P3] AR-0041 — Orphan module: cli/json-schema
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

### [P3] AR-0042 — Orphan module: cli/repl
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

### [P3] AR-0047 — Orphan module: executor/cdp-error-classifier
- **Dimension:** coupling
- **Location:** `src/executor/cdp-error-classifier:0`
- **Evidence:** `fan-in=0 fan-out=0 files=1`
- **Impact:** Isolated modules inflate the surface and may be unreachable dead code.
- **Fix Instructions:**
  - Confirm the module is reached (entry point / dynamic import) or remove it if unused.
  - Steps:
    - Grep the codebase for dynamic/string-based references.
    - If truly unused, delete it; otherwise document the entry path.
  - Effort: S  - Auto-fixable: no

### [P3] AR-0050 — Orphan module: schema/validators
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
| AR-0001 | P1 | cycles | `src/engines/sandbox-runner:0` | L | no |
| AR-0002 | P1 | cycles | `src/engines/manifest-inference:0` | L | no |
| AR-0003 | P1 | cycles | `src/engines/cdp-capability-registrar:0` | L | no |
| AR-0004 | P1 | cycles | `src/server/routes:0` | L | no |
| AR-0005 | P1 | cycles | `src/mcp/discovery-tools:0` | L | no |
| AR-0006 | P1 | layering | `src/automation/automation-router:0` | M | no |
| AR-0007 | P1 | layering | `src/engines/autonomous-execution:0` | M | no |
| AR-0008 | P1 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0009 | P1 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0010 | P1 | layering | `src/engines/capability:0` | M | no |
| AR-0011 | P1 | layering | `src/engines/cdp-capability-registrar:0` | M | no |
| AR-0012 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0013 | P1 | layering | `src/engines/config-universal-surface:0` | M | no |
| AR-0014 | P1 | layering | `src/engines/conversation-manager:0` | M | no |
| AR-0015 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0016 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0017 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0018 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0019 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0020 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0021 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0022 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0023 | P1 | layering | `src/engines/provider-health:0` | M | no |
| AR-0024 | P1 | layering | `src/engines/provider-health:0` | M | no |
| AR-0025 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0026 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0027 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0028 | P1 | layering | `src/engines/provider-registrar:0` | M | no |
| AR-0029 | P1 | layering | `src/engines/semantic-search:0` | M | no |
| AR-0030 | P1 | layering | `src/engines/send-capability:0` | M | no |
| AR-0031 | P1 | layering | `src/schema/chrome:0` | M | no |
| AR-0032 | P1 | layering | `src/schema/chrome:0` | M | no |
| AR-0033 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0034 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0035 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0036 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0037 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0038 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0039 | P1 | layering | `src/storage/db:0` | M | no |
| AR-0040 | P1 | layering | `src/storage/impl:0` | M | no |
| AR-0131 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-bootstrap.ts:0` | S | no |
| AR-0043 | P2 | coupling | `src/engines/capability-event-bus:0` | L | no |
| AR-0044 | P2 | coupling | `src/engines/chrome-governor:0` | L | no |
| AR-0045 | P2 | coupling | `src/engines/unified-registry:0` | L | no |
| AR-0046 | P2 | coupling | `src/errors:0` | L | no |
| AR-0048 | P2 | coupling | `src/ids:0` | L | no |
| AR-0049 | P2 | coupling | `src/index:0` | L | no |
| AR-0051 | P2 | coupling | `src/server/index:0` | L | no |
| AR-0052 | P2 | coupling | `src/storage/contracts:0` | L | no |
| AR-0053 | P2 | cohesion | `src/canvas/canvas-agent-tools:0` | M | no |
| AR-0054 | P2 | cohesion | `src/canvas/canvas-engine:0` | M | no |
| AR-0055 | P2 | cohesion | `src/canvas/canvas-registry:0` | M | no |
| AR-0056 | P2 | cohesion | `src/canvas/capability-bridge:0` | M | no |
| AR-0057 | P2 | cohesion | `src/canvas/capability-layer:0` | M | no |
| AR-0058 | P2 | cohesion | `src/canvas/designer:0` | M | no |
| AR-0059 | P2 | cohesion | `src/canvas/index:0` | M | no |
| AR-0060 | P2 | cohesion | `src/canvas/layer-mounter:0` | M | no |
| AR-0061 | P2 | cohesion | `src/canvas/mutation-caps:0` | M | no |
| AR-0062 | P2 | cohesion | `src/cli/commands:0` | M | no |
| AR-0063 | P2 | cohesion | `src/cli/discovery-stack:0` | M | no |
| AR-0064 | P2 | cohesion | `src/cli/index:0` | M | no |
| AR-0065 | P2 | cohesion | `src/cli/provider-harness:0` | M | no |
| AR-0066 | P2 | cohesion | `src/engines/agentic-loop:0` | M | no |
| AR-0067 | P2 | cohesion | `src/engines/autonomous-execution:0` | M | no |
| AR-0068 | P2 | cohesion | `src/engines/autonomous-replay:0` | M | no |
| AR-0069 | P2 | cohesion | `src/engines/capability-bootstrap-generated:0` | M | no |
| AR-0070 | P2 | cohesion | `src/engines/capability-bootstrap:0` | M | no |
| AR-0071 | P2 | cohesion | `src/engines/capability-discovery-loop:0` | M | no |
| AR-0072 | P2 | cohesion | `src/engines/capability:0` | M | no |
| AR-0073 | P2 | cohesion | `src/engines/cdp-capability-registrar:0` | M | no |
| AR-0074 | P2 | cohesion | `src/engines/chrome-governor:0` | M | no |
| AR-0075 | P2 | cohesion | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0076 | P2 | cohesion | `src/engines/command-parity-capabilities:0` | M | no |
| AR-0077 | P2 | cohesion | `src/engines/config-universal-surface:0` | M | no |
| AR-0078 | P2 | cohesion | `src/engines/context-assembly:0` | M | no |
| AR-0079 | P2 | cohesion | `src/engines/conversation-manager:0` | M | no |
| AR-0080 | P2 | cohesion | `src/engines/conversation-organizer:0` | M | no |
| AR-0081 | P2 | cohesion | `src/engines/discovery-session-runner:0` | M | no |
| AR-0082 | P2 | cohesion | `src/engines/execution-policy:0` | M | no |
| AR-0083 | P2 | cohesion | `src/engines/harness:0` | M | no |
| AR-0084 | P2 | cohesion | `src/engines/harness-runtime:0` | M | no |
| AR-0085 | P2 | cohesion | `src/engines/kernel:0` | M | no |
| AR-0086 | P2 | cohesion | `src/engines/knowledge-ingestion:0` | M | no |
| AR-0087 | P2 | cohesion | `src/engines/memory-indexer:0` | M | no |
| AR-0088 | P2 | cohesion | `src/engines/mirror-engine:0` | M | no |
| AR-0089 | P2 | cohesion | `src/engines/nlcl:0` | M | no |
| AR-0090 | P2 | cohesion | `src/engines/observability:0` | M | no |
| AR-0091 | P2 | cohesion | `src/engines/provider-discovery:0` | M | no |
| AR-0092 | P2 | cohesion | `src/engines/provider-health:0` | M | no |
| AR-0093 | P2 | cohesion | `src/engines/provider-mux:0` | M | no |
| AR-0094 | P2 | cohesion | `src/engines/provider-registrar:0` | M | no |
| AR-0095 | P2 | cohesion | `src/engines/registration-auditor:0` | M | no |
| AR-0096 | P2 | cohesion | `src/engines/sandbox-runner:0` | M | no |
| AR-0097 | P2 | cohesion | `src/engines/semantic-search:0` | M | no |
| AR-0098 | P2 | cohesion | `src/engines/send-resilience:0` | M | no |
| AR-0099 | P2 | cohesion | `src/engines/session-caps:0` | M | no |
| AR-0100 | P2 | cohesion | `src/engines/situation-detector:0` | M | no |
| AR-0101 | P2 | cohesion | `src/engines/sla-monitor:0` | M | no |
| AR-0102 | P2 | cohesion | `src/engines/stream-block-store:0` | M | no |
| AR-0103 | P2 | cohesion | `src/engines/stream-parser:0` | M | no |
| AR-0104 | P2 | cohesion | `src/engines/streaming-channel-caps:0` | M | no |
| AR-0105 | P2 | cohesion | `src/engines/telemetry-aggregator:0` | M | no |
| AR-0106 | P2 | cohesion | `src/engines/user-identity:0` | M | no |
| AR-0107 | P2 | cohesion | `src/engines/version-manager:0` | M | no |
| AR-0108 | P2 | cohesion | `src/engines/workflow-compiler:0` | M | no |
| AR-0109 | P2 | cohesion | `src/engines/workflow-engine:0` | M | no |
| AR-0110 | P2 | cohesion | `src/executor/fleet-supervisor:0` | M | no |
| AR-0111 | P2 | cohesion | `src/index:0` | M | no |
| AR-0112 | P2 | cohesion | `src/mcp/index:0` | M | no |
| AR-0113 | P2 | cohesion | `src/mcp/types:0` | M | no |
| AR-0114 | P2 | cohesion | `src/router/router:0` | M | no |
| AR-0115 | P2 | cohesion | `src/schema/index:0` | M | no |
| AR-0116 | P2 | cohesion | `src/server/canvas-router:0` | M | no |
| AR-0117 | P2 | cohesion | `src/server/canvas-ws:0` | M | no |
| AR-0118 | P2 | cohesion | `src/server/capability-router:0` | M | no |
| AR-0119 | P2 | cohesion | `src/server/conceptual-router:0` | M | no |
| AR-0120 | P2 | cohesion | `src/server/conversation-router:0` | M | no |
| AR-0121 | P2 | cohesion | `src/server/index:0` | M | no |
| AR-0122 | P2 | cohesion | `src/server/interpret-router:0` | M | no |
| AR-0123 | P2 | cohesion | `src/server/kernel-router:0` | M | no |
| AR-0124 | P2 | cohesion | `src/server/knowledge-router:0` | M | no |
| AR-0125 | P2 | cohesion | `src/server/mux-router:0` | M | no |
| AR-0126 | P2 | cohesion | `src/server/plugin-router:0` | M | no |
| AR-0127 | P2 | cohesion | `src/server/setup-router:0` | M | no |
| AR-0128 | P2 | cohesion | `src/storage/contracts:0` | M | no |
| AR-0129 | P2 | cohesion | `src/storage/db:0` | M | no |
| AR-0130 | P2 | cohesion | `src/storage/impl:0` | M | no |
| AR-0041 | P3 | coupling | `src/cli/json-schema:0` | S | no |
| AR-0042 | P3 | coupling | `src/cli/repl:0` | S | no |
| AR-0047 | P3 | coupling | `src/executor/cdp-error-classifier:0` | S | no |
| AR-0050 | P3 | coupling | `src/schema/validators:0` | S | no |

---
*Generated by `bun run devops audit-arch standard`. Machine-readable findings: arch-findings.json*
