# Architecture Audit — system-wide (surface) — 2026-07-22

- **Scope:** surface
- **Base commit:** f19efaf
- **Root:** C:\0-BlackBoxProject-0\vivim-final\devops\audit-arch
- **Mode:** system-wide

## Graph Overview

- **Modules:** 272
- **Module edges:** 866
- **Cycles:** 5
- **Layer histogram:** L0=43  L1=27  L2=7  L3=130  L4=6  L5=59
- **Top hubs:** index(92)  storage/contracts(85)  server/index(78)  errors(73)  ids(52)  engines/capability-event-bus(41)  engines/chrome-governor(34)  engines/unified-registry(34)

## Executive Summary

- **Risk score:** Medium (M)
- **Priorities:** P0: 0  P1: 51  P2: 0  P3: 0
- **Total findings:** 51

## Priority Legend

- **P0** — Critical — breaks an enforced boundary
- **P1** — High — structural integrity (cycle / wrong direction)
- **P2** — Medium — quality of the module graph
- **P3** — Low — hygiene

## P1 — 51 finding(s)

### Dimension: cycles

### [P1] AR-0001 — Cyclic module dependency (15 modules)
- **Dimension:** cycles
- **Location:** `src/router/router:0`
- **Evidence:** `cycle: router/router -> engines/provider-mux -> engines/capability-resolution -> engines/mirror-engine -> engines/cdp-capability-registrar -> engines/sandbox-runner -> engines/stream-parser -> engines/harness -> engines/composer-typing -> engines/capability-snapshot -> executor/fleet-limiter -> executor/fleet-supervisor -> engines/chrome-governor -> engines/browser-automation -> storage/contracts -> router/router`
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

### [P1] AR-0003 — Cyclic module dependency (20 modules)
- **Dimension:** cycles
- **Location:** `src/engines/kernel:0`
- **Evidence:** `cycle: engines/kernel -> engines/opencode -> engines/capability-bootstrap -> engines/memory -> engines/stream-block-store -> __generated__/provider-protocol -> __generated__/provider-protocol.dev -> engines/provider-protocol-generator -> engines/provider-protocol-loader -> config/provider-registry -> engines/provider-selectors -> engines/conversation-manager -> engines/nlcl -> engines/autonomous-replay -> engines/autonomous-execution -> engines/execution-policy -> storage/impl -> storage/prisma -> storage/db -> cli/discovery-stack -> engines/kernel`
- **Impact:** Cycles complicate reasoning, break lazy init, and make refactoring risky.
- **Fix Instructions:**
  - Introduce an interface/contract module that the cycle participants depend on, or invert one of the dependency directions.
  - Steps:
    - Pick the edge whose direction is most easily inverted.
    - Extract the shared abstraction into a new foundation module.
    - Depend on the abstraction instead of the concrete module.
    - Re-run `audit-arch` to confirm the cycle is gone.
  - Effort: L  - Auto-fixable: no

### [P1] AR-0004 — Cyclic module dependency (8 modules)
- **Dimension:** cycles
- **Location:** `src/server/canvas-router:0`
- **Evidence:** `cycle: server/canvas-router -> server/setup-router -> server/memory-router -> server/knowledge-router -> server/conversation-router -> server/capability-router -> server/index -> cli/index -> server/canvas-router`
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

### [P1] AR-0007 — Upward dependency: config/provider-registry -> engines/provider-protocol-loader
- **Dimension:** layering
- **Location:** `src/config/provider-registry:0`
- **Evidence:** `edge config/provider-registry -> engines/provider-protocol-loader (layers 0 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/provider-protocol-loader` rather than `engines/provider-protocol-loader` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0008 — Upward dependency: desktop/sidecar-entry -> server/index
- **Dimension:** layering
- **Location:** `src/desktop/sidecar-entry:0`
- **Evidence:** `edge desktop/sidecar-entry -> server/index (layers 3 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `server/index` rather than `server/index` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0009 — Upward dependency: engines/automation -> engines/harness
- **Dimension:** layering
- **Location:** `src/engines/automation:0`
- **Evidence:** `edge engines/automation -> engines/harness (layers 3 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/harness` rather than `engines/harness` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0010 — Upward dependency: engines/autonomous-execution -> engines/nlcl
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

### [P1] AR-0011 — Upward dependency: engines/capability-bootstrap -> cli/discovery-stack
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

### [P1] AR-0012 — Upward dependency: engines/capability-bootstrap -> engines/nlcl
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

### [P1] AR-0013 — Upward dependency: engines/capability-composer -> engines/version-manager
- **Dimension:** layering
- **Location:** `src/engines/capability-composer:0`
- **Evidence:** `edge engines/capability-composer -> engines/version-manager (layers 3 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/version-manager` rather than `engines/version-manager` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0014 — Upward dependency: engines/capability-event-bus -> engines/event-record-store
- **Dimension:** layering
- **Location:** `src/engines/capability-event-bus:0`
- **Evidence:** `edge engines/capability-event-bus -> engines/event-record-store (layers 2 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/event-record-store` rather than `engines/event-record-store` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0015 — Upward dependency: engines/capability -> engines/conversation-manager
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

### [P1] AR-0016 — Upward dependency: engines/cdp-capability-registrar -> engines/harness
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

### [P1] AR-0017 — Upward dependency: engines/chrome-governor -> engines/browser-automation
- **Dimension:** layering
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `edge engines/chrome-governor -> engines/browser-automation (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/browser-automation` rather than `engines/browser-automation` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0018 — Upward dependency: engines/chrome-governor -> engines/capability-snapshot
- **Dimension:** layering
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `edge engines/chrome-governor -> engines/capability-snapshot (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/capability-snapshot` rather than `engines/capability-snapshot` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0019 — Upward dependency: engines/chrome-governor -> engines/composer-typing
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

### [P1] AR-0020 — Upward dependency: engines/chrome-governor -> engines/harness
- **Dimension:** layering
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `edge engines/chrome-governor -> engines/harness (layers 1 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/harness` rather than `engines/harness` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0021 — Upward dependency: engines/config-universal-surface -> engines/telemetry-aggregator
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

### [P1] AR-0022 — Upward dependency: engines/kernel -> engines/capability-event-bus
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

### [P1] AR-0023 — Upward dependency: engines/kernel -> engines/config-manager
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

### [P1] AR-0024 — Upward dependency: engines/kernel -> engines/conversation-manager
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

### [P1] AR-0025 — Upward dependency: engines/kernel -> engines/nlcl
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

### [P1] AR-0026 — Upward dependency: engines/kernel -> engines/unified-registry
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

### [P1] AR-0027 — Upward dependency: engines/kernel -> lib/logger
- **Dimension:** layering
- **Location:** `src/engines/kernel:0`
- **Evidence:** `edge engines/kernel -> lib/logger (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `lib/logger` rather than `lib/logger` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0028 — Upward dependency: engines/live-capability-registry -> engines/mcp-client-adapter
- **Dimension:** layering
- **Location:** `src/engines/live-capability-registry:0`
- **Evidence:** `edge engines/live-capability-registry -> engines/mcp-client-adapter (layers 3 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/mcp-client-adapter` rather than `engines/mcp-client-adapter` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0029 — Upward dependency: engines/live-capability-registry -> engines/telemetry-audit
- **Dimension:** layering
- **Location:** `src/engines/live-capability-registry:0`
- **Evidence:** `edge engines/live-capability-registry -> engines/telemetry-audit (layers 3 -> 5)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/telemetry-audit` rather than `engines/telemetry-audit` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0030 — Upward dependency: engines/opencode -> engines/nlcl
- **Dimension:** layering
- **Location:** `src/engines/opencode:0`
- **Evidence:** `edge engines/opencode -> engines/nlcl (layers 3 -> 4)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/nlcl` rather than `engines/nlcl` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0031 — Upward dependency: engines/provider-discovery -> engines/capability-event-bus
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

### [P1] AR-0032 — Upward dependency: engines/provider-discovery -> engines/capability-shape-registry
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

### [P1] AR-0033 — Upward dependency: engines/provider-discovery -> engines/manifest-inference
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

### [P1] AR-0034 — Upward dependency: engines/provider-discovery -> engines/stream-align
- **Dimension:** layering
- **Location:** `src/engines/provider-discovery:0`
- **Evidence:** `edge engines/provider-discovery -> engines/stream-align (layers 1 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/stream-align` rather than `engines/stream-align` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0035 — Upward dependency: engines/provider-health -> engines/capability-event-bus
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

### [P1] AR-0036 — Upward dependency: engines/provider-mux -> router/router
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

### [P1] AR-0037 — Upward dependency: engines/provider-mux -> engines/capability-event-bus
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

### [P1] AR-0038 — Upward dependency: engines/provider-mux -> engines/messaging-archetypes
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

### [P1] AR-0039 — Upward dependency: engines/provider-registrar -> engines/stream-align
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

### [P1] AR-0040 — Upward dependency: engines/send-capability -> engines/unified-registry
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

### [P1] AR-0041 — Upward dependency: schema/chrome -> executor/chrome-instance-profile
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

### [P1] AR-0042 — Upward dependency: schema/chrome -> executor/slave-states
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

### [P1] AR-0043 — Upward dependency: storage/contracts -> engines/browser-automation
- **Dimension:** layering
- **Location:** `src/storage/contracts:0`
- **Evidence:** `edge storage/contracts -> engines/browser-automation (layers 0 -> 3)`
- **Impact:** Upward dependencies invert the intended layering and couple foundation modules to surface concerns.
- **Fix Instructions:**
  - Move the shared responsibility into a lower layer, or depend on a contract exposed by `engines/browser-automation` rather than `engines/browser-automation` itself.
  - Steps:
    - Identify the symbols imported from the higher layer.
    - Decide whether they belong in a shared lower-layer contract.
    - Re-point the import; otherwise accept the edge as an explicit policy exception.
  - Effort: M  - Auto-fixable: no

### [P1] AR-0044 — Upward dependency: storage/contracts -> canvas/types
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

### [P1] AR-0045 — Upward dependency: storage/contracts -> executor/slave-states
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

### [P1] AR-0046 — Upward dependency: storage/contracts -> engines/intent-decomposer
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

### [P1] AR-0047 — Upward dependency: storage/contracts -> engines/mirror-engine
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

### [P1] AR-0048 — Upward dependency: storage/contracts -> engines/provider-mux
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

### [P1] AR-0049 — Upward dependency: storage/contracts -> engines/sandbox-runner
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

### [P1] AR-0050 — Upward dependency: storage/db -> storage/impl
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

### [P1] AR-0051 — Upward dependency: storage/impl -> engines/harness
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


## Fix Backlog (prioritized)

| ID | P | Dimension | Location | Effort | Auto-fix |
|----|---|-----------|----------|--------|----------|
| AR-0001 | P1 | cycles | `src/router/router:0` | L | no |
| AR-0002 | P1 | cycles | `src/engines/manifest-inference:0` | L | no |
| AR-0003 | P1 | cycles | `src/engines/kernel:0` | L | no |
| AR-0004 | P1 | cycles | `src/server/canvas-router:0` | L | no |
| AR-0005 | P1 | cycles | `src/mcp/discovery-tools:0` | L | no |
| AR-0006 | P1 | layering | `src/automation/automation-router:0` | M | no |
| AR-0007 | P1 | layering | `src/config/provider-registry:0` | M | no |
| AR-0008 | P1 | layering | `src/desktop/sidecar-entry:0` | M | no |
| AR-0009 | P1 | layering | `src/engines/automation:0` | M | no |
| AR-0010 | P1 | layering | `src/engines/autonomous-execution:0` | M | no |
| AR-0011 | P1 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0012 | P1 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0013 | P1 | layering | `src/engines/capability-composer:0` | M | no |
| AR-0014 | P1 | layering | `src/engines/capability-event-bus:0` | M | no |
| AR-0015 | P1 | layering | `src/engines/capability:0` | M | no |
| AR-0016 | P1 | layering | `src/engines/cdp-capability-registrar:0` | M | no |
| AR-0017 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0018 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0019 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0020 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0021 | P1 | layering | `src/engines/config-universal-surface:0` | M | no |
| AR-0022 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0023 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0024 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0025 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0026 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0027 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0028 | P1 | layering | `src/engines/live-capability-registry:0` | M | no |
| AR-0029 | P1 | layering | `src/engines/live-capability-registry:0` | M | no |
| AR-0030 | P1 | layering | `src/engines/opencode:0` | M | no |
| AR-0031 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0032 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0033 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0034 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0035 | P1 | layering | `src/engines/provider-health:0` | M | no |
| AR-0036 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0037 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0038 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0039 | P1 | layering | `src/engines/provider-registrar:0` | M | no |
| AR-0040 | P1 | layering | `src/engines/send-capability:0` | M | no |
| AR-0041 | P1 | layering | `src/schema/chrome:0` | M | no |
| AR-0042 | P1 | layering | `src/schema/chrome:0` | M | no |
| AR-0043 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0044 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0045 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0046 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0047 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0048 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0049 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0050 | P1 | layering | `src/storage/db:0` | M | no |
| AR-0051 | P1 | layering | `src/storage/impl:0` | M | no |

---
*Generated by `bun run devops audit-arch surface`. Machine-readable findings: arch-findings.json*
