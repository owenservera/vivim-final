# Architecture Audit — system-wide (full) — 2026-07-23

- **Scope:** full
- **Base commit:** 436108a
- **Root:** C:\0-BlackBoxProject-0\vivim-final\devops\audit-arch
- **Mode:** system-wide

## Graph Overview

- **Modules:** 272
- **Module edges:** 869
- **Cycles:** 5
- **Layer histogram:** L0=43  L1=27  L2=7  L3=130  L4=6  L5=59
- **Top hubs:** index(92)  storage/contracts(85)  server/index(79)  errors(74)  ids(52)  engines/capability-event-bus(41)  engines/chrome-governor(34)  engines/unified-registry(34)

## Executive Summary

- **Risk score:** Medium (M)
- **Priorities:** P0: 0  P1: 57  P2: 405  P3: 6
- **Total findings:** 468

## Priority Legend

- **P0** — Critical — breaks an enforced boundary
- **P1** — High — structural integrity (cycle / wrong direction)
- **P2** — Medium — quality of the module graph
- **P3** — Low — hygiene

## P1 — 57 finding(s)

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

### [P1] AR-0028 — Upward dependency: config/provider-registry -> engines/provider-protocol-loader
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

### [P1] AR-0029 — Upward dependency: desktop/sidecar-entry -> server/index
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

### [P1] AR-0031 — Upward dependency: engines/automation -> engines/harness
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

### [P1] AR-0033 — Upward dependency: engines/autonomous-execution -> engines/nlcl
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

### [P1] AR-0035 — Upward dependency: engines/capability-bootstrap -> cli/discovery-stack
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

### [P1] AR-0038 — Upward dependency: engines/capability-bootstrap -> engines/nlcl
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

### [P1] AR-0040 — Upward dependency: engines/capability-composer -> engines/version-manager
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

### [P1] AR-0041 — Upward dependency: engines/capability-event-bus -> engines/event-record-store
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

### [P1] AR-0042 — Upward dependency: engines/capability -> engines/conversation-manager
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

### [P1] AR-0043 — Upward dependency: engines/cdp-capability-registrar -> engines/harness
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

### [P1] AR-0044 — Upward dependency: engines/chrome-governor -> engines/browser-automation
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

### [P1] AR-0045 — Upward dependency: engines/chrome-governor -> engines/capability-snapshot
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

### [P1] AR-0046 — Upward dependency: engines/chrome-governor -> engines/composer-typing
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

### [P1] AR-0047 — Upward dependency: engines/chrome-governor -> engines/harness
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

### [P1] AR-0053 — Upward dependency: engines/config-universal-surface -> engines/telemetry-aggregator
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

### [P1] AR-0062 — Upward dependency: engines/kernel -> engines/capability-event-bus
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

### [P1] AR-0063 — Upward dependency: engines/kernel -> engines/config-manager
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

### [P1] AR-0064 — Upward dependency: engines/kernel -> engines/conversation-manager
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

### [P1] AR-0065 — Upward dependency: engines/kernel -> engines/nlcl
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

### [P1] AR-0066 — Upward dependency: engines/kernel -> engines/unified-registry
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

### [P1] AR-0067 — Upward dependency: engines/kernel -> lib/logger
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

### [P1] AR-0068 — Upward dependency: engines/live-capability-registry -> engines/mcp-client-adapter
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

### [P1] AR-0069 — Upward dependency: engines/live-capability-registry -> engines/telemetry-audit
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

### [P1] AR-0074 — Upward dependency: engines/opencode -> engines/nlcl
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

### [P1] AR-0075 — Upward dependency: engines/provider-discovery -> engines/capability-event-bus
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

### [P1] AR-0076 — Upward dependency: engines/provider-discovery -> engines/capability-shape-registry
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

### [P1] AR-0077 — Upward dependency: engines/provider-discovery -> engines/manifest-inference
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

### [P1] AR-0078 — Upward dependency: engines/provider-discovery -> engines/stream-align
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

### [P1] AR-0079 — Upward dependency: engines/provider-health -> engines/capability-event-bus
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

### [P1] AR-0080 — Upward dependency: engines/provider-mux -> router/router
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

### [P1] AR-0081 — Upward dependency: engines/provider-mux -> engines/capability-event-bus
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

### [P1] AR-0082 — Upward dependency: engines/provider-mux -> engines/messaging-archetypes
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

### [P1] AR-0083 — Upward dependency: engines/provider-registrar -> engines/stream-align
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

### [P1] AR-0086 — Upward dependency: engines/send-capability -> engines/unified-registry
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

### [P1] AR-0173 — Upward dependency: schema/chrome -> executor/chrome-instance-profile
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

### [P1] AR-0174 — Upward dependency: schema/chrome -> executor/slave-states
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

### [P1] AR-0242 — Upward dependency: storage/contracts -> engines/browser-automation
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

### [P1] AR-0243 — Upward dependency: storage/contracts -> canvas/types
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

### [P1] AR-0244 — Upward dependency: storage/contracts -> executor/slave-states
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

### [P1] AR-0245 — Upward dependency: storage/contracts -> engines/intent-decomposer
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

### [P1] AR-0246 — Upward dependency: storage/contracts -> engines/mirror-engine
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

### [P1] AR-0247 — Upward dependency: storage/contracts -> engines/provider-mux
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

### [P1] AR-0248 — Upward dependency: storage/contracts -> engines/sandbox-runner
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

### [P1] AR-0249 — Upward dependency: storage/db -> storage/impl
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

### [P1] AR-0250 — Upward dependency: storage/impl -> engines/harness
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


### Dimension: boundaries

### [P1] AR-0358 — Boundary violation: B5 (B5)
- **Dimension:** boundaries
- **Location:** `src/engines/api-provider-adapter.ts:20`
- **Evidence:** `src/engines/api-provider-adapter.ts:20 — Engine reads config directly instead of ConfigManager: process.env`
- **Impact:** Breaks an enforced system boundary.
- **Fix Instructions:**
  - Read configuration via ConfigManager.
  - Steps:
    - Inject ConfigManager instead of reading process.env directly.
    - Move raw config reads behind ConfigManager.get().
  - Effort: M  - Auto-fixable: no

### [P1] AR-0359 — Boundary violation: B7 (B7)
- **Dimension:** boundaries
- **Location:** `src/engines/workspace-presets.ts:116`
- **Evidence:** `src/engines/workspace-presets.ts:116 — Engine uses raw 'new Error()' instead of custom error class: new Error(`
- **Impact:** Breaks an enforced system boundary.
- **Fix Instructions:**
  - Use custom error classes from src/errors.ts.
  - Steps:
    - Import the domain error class.
    - Throw it instead of `new Error(...)`.
  - Effort: M  - Auto-fixable: no


### Dimension: commands

### [P1] AR-0360 — Dangling command: catalog binds "llm.test.run" → missing "cap:llm_test:run"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('llm.test.run', …, { capabilityId: 'cap:llm_test:run' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no

### [P1] AR-0361 — Dangling command: catalog binds "llm.test.parity" → missing "cap:llm_test:parity"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('llm.test.parity', …, { capabilityId: 'cap:llm_test:parity' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no

### [P1] AR-0362 — Dangling command: catalog binds "llm.test.status" → missing "cap:llm_test:status"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('llm.test.status', …, { capabilityId: 'cap:llm_test:status' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no

### [P1] AR-0363 — Dangling command: catalog binds "system.fleet" → missing "cap:fleet:status"
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0`
- **Evidence:** `pattern('system.fleet', …, { capabilityId: 'cap:fleet:status' }) — capability not found in capability-bootstrap.ts`
- **Impact:** Natural-language invocation resolves to a non-existent capability; the command never executes.
- **Fix Instructions:**
  - Point the catalog pattern at a real capability id, or register the missing capability.
  - Steps:
    - Open the catalog pattern.
    - Correct capabilityId to a defined id, or add the capability in capability-bootstrap.ts.
  - Effort: S  - Auto-fixable: no


## P2 — 405 finding(s)

### Dimension: layering

### [P2] AR-0007 — Skip-layer dependency: automation/ui-automator -> executor/cdp
- **Dimension:** layering
- **Location:** `src/automation/ui-automator:0`
- **Evidence:** `edge automation/ui-automator -> executor/cdp (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0008 — Skip-layer dependency: canvas/canvas-agent-tools -> engines/unified-registry
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

### [P2] AR-0009 — Skip-layer dependency: canvas/canvas-engine -> engines/unified-registry
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

### [P2] AR-0010 — Skip-layer dependency: canvas/canvas-engine -> engines/capability-event-bus
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

### [P2] AR-0011 — Skip-layer dependency: canvas/mutation-caps -> engines/capability-event-bus
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

### [P2] AR-0012 — Skip-layer dependency: canvas/mutation-caps -> engines/unified-registry
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

### [P2] AR-0013 — Skip-layer dependency: cli/commands -> api/setup-client
- **Dimension:** layering
- **Location:** `src/cli/commands:0`
- **Evidence:** `edge cli/commands -> api/setup-client (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0014 — Skip-layer dependency: cli/commands -> engines/unified-registry
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

### [P2] AR-0015 — Skip-layer dependency: cli/discovery-stack -> engines/capability-event-bus
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

### [P2] AR-0016 — Skip-layer dependency: cli/discovery-stack -> engines/capability-shape-registry
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

### [P2] AR-0017 — Skip-layer dependency: cli/discovery-stack -> engines/chrome-governor
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

### [P2] AR-0018 — Skip-layer dependency: cli/discovery-stack -> engines/discovery-session-runner
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

### [P2] AR-0019 — Skip-layer dependency: cli/discovery-stack -> engines/provider-discovery
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

### [P2] AR-0020 — Skip-layer dependency: cli/discovery-stack -> engines/provider-registrar
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

### [P2] AR-0022 — Skip-layer dependency: cli/discovery-stack -> engines/stream-align
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

### [P2] AR-0023 — Skip-layer dependency: cli/discovery-stack -> engines/stream-parser
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

### [P2] AR-0024 — Skip-layer dependency: cli/discovery-stack -> storage/impl
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

### [P2] AR-0025 — Skip-layer dependency: cli/discovery-stack -> executor/cdp-transport
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

### [P2] AR-0026 — Skip-layer dependency: cli/index -> engines/unified-registry
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

### [P2] AR-0027 — Skip-layer dependency: cli/provider-harness -> engines/provider-registrar
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

### [P2] AR-0030 — Skip-layer dependency: engines/automation -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/automation:0`
- **Evidence:** `edge engines/automation -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0032 — Skip-layer dependency: engines/autonomous-execution -> engines/chrome-governor
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

### [P2] AR-0034 — Skip-layer dependency: engines/browser-automation -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/browser-automation:0`
- **Evidence:** `edge engines/browser-automation -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0036 — Skip-layer dependency: engines/capability-bootstrap -> executor/profile-allocator
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

### [P2] AR-0037 — Skip-layer dependency: engines/capability-bootstrap -> engines/chrome-governor
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

### [P2] AR-0039 — Skip-layer dependency: engines/capability-bootstrap -> engines/kernel
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

### [P2] AR-0048 — Skip-layer dependency: engines/chrome-setup-wizard -> executor/launcher
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

### [P2] AR-0049 — Skip-layer dependency: engines/chrome-setup-wizard -> executor/profile-allocator
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

### [P2] AR-0050 — Skip-layer dependency: engines/chrome-setup-wizard -> engines/provider-selectors
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

### [P2] AR-0051 — Skip-layer dependency: engines/composer-typing -> engines/chrome-governor
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

### [P2] AR-0052 — Skip-layer dependency: engines/config-universal-surface -> engines/kernel
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

### [P2] AR-0054 — Skip-layer dependency: engines/conversation-manager -> engines/chrome-governor
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

### [P2] AR-0055 — Skip-layer dependency: engines/conversation-manager -> engines/provider-selectors
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

### [P2] AR-0056 — Skip-layer dependency: engines/discovery-session-runner -> engines/chrome-governor
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

### [P2] AR-0057 — Skip-layer dependency: engines/discovery-session-runner -> engines/provider-discovery
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

### [P2] AR-0058 — Skip-layer dependency: engines/eviction-manager -> engines/chrome-governor
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

### [P2] AR-0059 — Skip-layer dependency: engines/harness -> engines/chrome-governor
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

### [P2] AR-0060 — Skip-layer dependency: engines/harness -> engines/capability-event-bus
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

### [P2] AR-0061 — Skip-layer dependency: engines/harness-runtime -> engines/chrome-governor
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

### [P2] AR-0070 — Skip-layer dependency: engines/manifest-inference -> engines/provider-discovery
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

### [P2] AR-0071 — Skip-layer dependency: engines/mcp-server-adapter -> engines/chrome-governor
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

### [P2] AR-0072 — Skip-layer dependency: engines/mirror-engine -> engines/chrome-governor
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

### [P2] AR-0073 — Skip-layer dependency: engines/nlcl -> engines/chrome-governor
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

### [P2] AR-0084 — Skip-layer dependency: engines/provider-test-harness -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/provider-test-harness:0`
- **Evidence:** `edge engines/provider-test-harness -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0085 — Skip-layer dependency: engines/semantic-grounding -> engines/chrome-governor
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

### [P2] AR-0087 — Skip-layer dependency: engines/send-resilience -> engines/chrome-governor
- **Dimension:** layering
- **Location:** `src/engines/send-resilience:0`
- **Evidence:** `edge engines/send-resilience -> engines/chrome-governor (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0088 — Skip-layer dependency: engines/send-resilience -> engines/provider-health
- **Dimension:** layering
- **Location:** `src/engines/send-resilience:0`
- **Evidence:** `edge engines/send-resilience -> engines/provider-health (layers 3 -> 1, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0089 — Skip-layer dependency: engines/streaming-channel-caps -> engines/provider-mux
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

### [P2] AR-0090 — Skip-layer dependency: engines/telemetry-aggregator -> engines/capability-event-bus
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

### [P2] AR-0091 — Skip-layer dependency: engines/telemetry-aggregator -> engines/config-manager
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

### [P2] AR-0092 — Skip-layer dependency: engines/version-manager -> engines/capability-event-bus
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

### [P2] AR-0093 — Skip-layer dependency: engines/version-manager -> engines/config-manager
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

### [P2] AR-0094 — Skip-layer dependency: engines/workflow-engine -> engines/chrome-governor
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

### [P2] AR-0095 — Skip-layer dependency: index -> engines/capability-event-bus
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

### [P2] AR-0096 — Skip-layer dependency: index -> engines/chrome-governor
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

### [P2] AR-0097 — Skip-layer dependency: index -> engines/conversation-manager
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

### [P2] AR-0098 — Skip-layer dependency: index -> engines/stream-parser
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

### [P2] AR-0099 — Skip-layer dependency: index -> engines/capability
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

### [P2] AR-0100 — Skip-layer dependency: index -> engines/provider-registrar
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

### [P2] AR-0101 — Skip-layer dependency: index -> engines/capability-resolution
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

### [P2] AR-0102 — Skip-layer dependency: index -> engines/provider-health
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

### [P2] AR-0103 — Skip-layer dependency: index -> engines/stream-block-store
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

### [P2] AR-0104 — Skip-layer dependency: index -> engines/registration-auditor
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

### [P2] AR-0105 — Skip-layer dependency: index -> engines/config-manager
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

### [P2] AR-0106 — Skip-layer dependency: index -> engines/execution-memoizer
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

### [P2] AR-0107 — Skip-layer dependency: index -> engines/harness-runtime
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

### [P2] AR-0108 — Skip-layer dependency: index -> engines/harness-checkpoint
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

### [P2] AR-0109 — Skip-layer dependency: index -> engines/capability-macro
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

### [P2] AR-0110 — Skip-layer dependency: index -> engines/capability-composer
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/capability-composer (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0111 — Skip-layer dependency: index -> engines/session-checkpoint
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

### [P2] AR-0112 — Skip-layer dependency: index -> engines/state-transition
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

### [P2] AR-0113 — Skip-layer dependency: index -> engines/memory-engine
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

### [P2] AR-0114 — Skip-layer dependency: index -> engines/provider-mux
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

### [P2] AR-0115 — Skip-layer dependency: index -> engines/cost-optimizer
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

### [P2] AR-0116 — Skip-layer dependency: index -> engines/situation-detector
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

### [P2] AR-0117 — Skip-layer dependency: index -> engines/context-assembly
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

### [P2] AR-0118 — Skip-layer dependency: index -> engines/unified-registry
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

### [P2] AR-0119 — Skip-layer dependency: index -> engines/plugin-hot-reload
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

### [P2] AR-0120 — Skip-layer dependency: index -> engines/adaptive-workspace
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

### [P2] AR-0121 — Skip-layer dependency: index -> engines/conversation-organizer
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

### [P2] AR-0122 — Skip-layer dependency: index -> engines/autonomous-execution
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

### [P2] AR-0123 — Skip-layer dependency: index -> engines/autonomous-replay
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

### [P2] AR-0124 — Skip-layer dependency: index -> engines/health-digest
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

### [P2] AR-0125 — Skip-layer dependency: index -> engines/db-encryption
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

### [P2] AR-0126 — Skip-layer dependency: index -> engines/backup-scheduler
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

### [P2] AR-0127 — Skip-layer dependency: index -> engines/execution-policy
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

### [P2] AR-0128 — Skip-layer dependency: index -> engines/governance-engine
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/governance-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0129 — Skip-layer dependency: index -> engines/budget-engine
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/budget-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0130 — Skip-layer dependency: index -> engines/objective-engine
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/objective-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0131 — Skip-layer dependency: index -> engines/belief-store
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/belief-store (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0132 — Skip-layer dependency: index -> engines/capability-binder
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/capability-binder (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0133 — Skip-layer dependency: index -> engines/agent-builder
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/agent-builder (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0134 — Skip-layer dependency: index -> engines/event-record-store
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/event-record-store (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0135 — Skip-layer dependency: index -> storage/impl
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

### [P2] AR-0136 — Skip-layer dependency: index -> executor/async-mutex
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

### [P2] AR-0137 — Skip-layer dependency: index -> executor/circuit-breaker
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

### [P2] AR-0138 — Skip-layer dependency: index -> executor/fleet-config
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

### [P2] AR-0139 — Skip-layer dependency: index -> executor/ids
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

### [P2] AR-0140 — Skip-layer dependency: index -> alerting/alerter
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

### [P2] AR-0141 — Skip-layer dependency: index -> automation/scheduler
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

### [P2] AR-0142 — Skip-layer dependency: index -> engines/encryption
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

### [P2] AR-0143 — Skip-layer dependency: index -> engines/export
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

### [P2] AR-0144 — Skip-layer dependency: index -> engines/local-model-adapter
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

### [P2] AR-0145 — Skip-layer dependency: index -> engines/embedding-ollama
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/embedding-ollama (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0146 — Skip-layer dependency: index -> engines/embedding-minilm
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/embedding-minilm (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0147 — Skip-layer dependency: index -> engines/semantic-search
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/semantic-search (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0148 — Skip-layer dependency: index -> engines/sync
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

### [P2] AR-0149 — Skip-layer dependency: index -> storage/cozo
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> storage/cozo (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0150 — Skip-layer dependency: index -> engines/provider-discovery
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

### [P2] AR-0151 — Skip-layer dependency: index -> engines/manifest-inference
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

### [P2] AR-0152 — Skip-layer dependency: index -> engines/capability-shape-registry
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

### [P2] AR-0153 — Skip-layer dependency: index -> engines/session-caps
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

### [P2] AR-0154 — Skip-layer dependency: index -> engines/workflow-engine
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

### [P2] AR-0155 — Skip-layer dependency: index -> engines/workflow-templates
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

### [P2] AR-0156 — Skip-layer dependency: index -> engines/send-capability
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

### [P2] AR-0157 — Skip-layer dependency: index -> engines/workspace-presets
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/workspace-presets (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0158 — Skip-layer dependency: index -> engines/capability-taxonomy
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/capability-taxonomy (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0159 — Skip-layer dependency: index -> engines/provider-test-harness
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/provider-test-harness (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0160 — Skip-layer dependency: index -> engines/streaming-channel-caps
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

### [P2] AR-0161 — Skip-layer dependency: index -> engines/messaging-archetypes
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

### [P2] AR-0162 — Skip-layer dependency: index -> engines/image-gen-bridge
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

### [P2] AR-0163 — Skip-layer dependency: index -> engines/observability
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

### [P2] AR-0164 — Skip-layer dependency: index -> engines/api-provider-adapter
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/api-provider-adapter (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0165 — Skip-layer dependency: index -> engines/stealth
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

### [P2] AR-0166 — Skip-layer dependency: index -> engines/harness-command-registry
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/harness-command-registry (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0167 — Skip-layer dependency: index -> engines/harness-repair-engine
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/harness-repair-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0168 — Skip-layer dependency: index -> engines/harness-feedback-coordinator
- **Dimension:** layering
- **Location:** `src/index:0`
- **Evidence:** `edge index -> engines/harness-feedback-coordinator (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0169 — Skip-layer dependency: mcp/types -> engines/provider-discovery
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

### [P2] AR-0170 — Skip-layer dependency: mcp/types -> engines/manifest-inference
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

### [P2] AR-0171 — Skip-layer dependency: mcp/types -> engines/capability-shape-registry
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

### [P2] AR-0172 — Skip-layer dependency: mcp/types -> engines/provider-registrar
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

### [P2] AR-0175 — Skip-layer dependency: server/automation-router -> engines/automation
- **Dimension:** layering
- **Location:** `src/server/automation-router:0`
- **Evidence:** `edge server/automation-router -> engines/automation (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0176 — Skip-layer dependency: server/autonomous-router -> engines/autonomous-execution
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

### [P2] AR-0177 — Skip-layer dependency: server/autonomous-router -> engines/execution-policy
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

### [P2] AR-0178 — Skip-layer dependency: server/canvas-router -> engines/unified-registry
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

### [P2] AR-0179 — Skip-layer dependency: server/canvas-ws -> engines/unified-registry
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

### [P2] AR-0180 — Skip-layer dependency: server/capability-router -> engines/unified-registry
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

### [P2] AR-0181 — Skip-layer dependency: server/conversation-router -> engines/capability-resolution
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

### [P2] AR-0182 — Skip-layer dependency: server/conversation-router -> engines/provider-health
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

### [P2] AR-0183 — Skip-layer dependency: server/conversation-router -> engines/mirror-engine
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

### [P2] AR-0184 — Skip-layer dependency: server/index -> engines/capability-bootstrap-generated
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/capability-bootstrap-generated (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0185 — Skip-layer dependency: server/index -> engines/capability-bootstrap
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

### [P2] AR-0186 — Skip-layer dependency: server/index -> engines/capability-event-bus
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

### [P2] AR-0187 — Skip-layer dependency: server/index -> engines/capability-resolution
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

### [P2] AR-0188 — Skip-layer dependency: server/index -> engines/cdp-capability-registrar
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/cdp-capability-registrar (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0189 — Skip-layer dependency: server/index -> engines/cdp-discovery
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/cdp-discovery (layers 5 -> 2, gap 3)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0190 — Skip-layer dependency: server/index -> engines/chrome-governor
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

### [P2] AR-0191 — Skip-layer dependency: server/index -> engines/conceptual-model-service
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/conceptual-model-service (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0192 — Skip-layer dependency: server/index -> engines/conversation-manager
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

### [P2] AR-0193 — Skip-layer dependency: server/index -> engines/cost-optimizer
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

### [P2] AR-0194 — Skip-layer dependency: server/index -> engines/cross-conversation-synthesis
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

### [P2] AR-0195 — Skip-layer dependency: server/index -> engines/export
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

### [P2] AR-0196 — Skip-layer dependency: server/index -> engines/idempotency-guard
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

### [P2] AR-0197 — Skip-layer dependency: server/index -> engines/kernel
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

### [P2] AR-0198 — Skip-layer dependency: server/index -> engines/knowledge-ingestion
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

### [P2] AR-0199 — Skip-layer dependency: server/index -> engines/lock-manager
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

### [P2] AR-0200 — Skip-layer dependency: server/index -> engines/provider-health
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

### [P2] AR-0201 — Skip-layer dependency: server/index -> engines/provider-mux
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

### [P2] AR-0202 — Skip-layer dependency: server/index -> engines/retry-engine
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

### [P2] AR-0203 — Skip-layer dependency: server/index -> engines/semantic-search
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

### [P2] AR-0204 — Skip-layer dependency: server/index -> engines/unified-registry
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

### [P2] AR-0205 — Skip-layer dependency: server/index -> engines/user-identity
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/user-identity (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0206 — Skip-layer dependency: server/index -> engines/autonomous-execution
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

### [P2] AR-0207 — Skip-layer dependency: server/index -> engines/execution-policy
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

### [P2] AR-0208 — Skip-layer dependency: server/index -> engines/automation
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/automation (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0209 — Skip-layer dependency: server/index -> engines/memory
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/memory (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0210 — Skip-layer dependency: server/index -> engines/agent-builder
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/agent-builder (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0211 — Skip-layer dependency: server/index -> engines/memory-engine
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

### [P2] AR-0212 — Skip-layer dependency: server/index -> engines/stream-parser
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

### [P2] AR-0213 — Skip-layer dependency: server/index -> engines/sandbox-runner
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/sandbox-runner (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0214 — Skip-layer dependency: server/index -> storage/impl
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

### [P2] AR-0215 — Skip-layer dependency: server/index -> engines/stream-block-store
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

### [P2] AR-0216 — Skip-layer dependency: server/index -> engines/execution-memoizer
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

### [P2] AR-0217 — Skip-layer dependency: server/index -> engines/capability-snapshot
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/capability-snapshot (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0218 — Skip-layer dependency: server/index -> engines/provider-registrar
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

### [P2] AR-0219 — Skip-layer dependency: server/index -> executor/cdp-transport
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

### [P2] AR-0220 — Skip-layer dependency: server/index -> engines/knowledge-extractor
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

### [P2] AR-0221 — Skip-layer dependency: server/index -> engines/embedding-ollama
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/embedding-ollama (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0222 — Skip-layer dependency: server/index -> engines/embedding-minilm
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/embedding-minilm (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0223 — Skip-layer dependency: server/index -> executor/profile-allocator
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

### [P2] AR-0224 — Skip-layer dependency: server/index -> engines/belief-store
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/belief-store (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0225 — Skip-layer dependency: server/index -> engines/event-record-store
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/event-record-store (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0226 — Skip-layer dependency: server/index -> engines/opencode
- **Dimension:** layering
- **Location:** `src/server/index:0`
- **Evidence:** `edge server/index -> engines/opencode (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0227 — Skip-layer dependency: server/kernel-router -> engines/config-universal-surface
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

### [P2] AR-0228 — Skip-layer dependency: server/memory-router -> engines/memory-export
- **Dimension:** layering
- **Location:** `src/server/memory-router:0`
- **Evidence:** `edge server/memory-router -> engines/memory-export (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0229 — Skip-layer dependency: server/memory-viz-router -> engines/memory-engine
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

### [P2] AR-0230 — Skip-layer dependency: server/memory-viz-router -> engines/memory-export
- **Dimension:** layering
- **Location:** `src/server/memory-viz-router:0`
- **Evidence:** `edge server/memory-viz-router -> engines/memory-export (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0231 — Skip-layer dependency: server/mux-router -> engines/cost-optimizer
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

### [P2] AR-0232 — Skip-layer dependency: server/mux-router -> engines/provider-mux
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

### [P2] AR-0233 — Skip-layer dependency: server/plugin-router -> engines/safe-eval
- **Dimension:** layering
- **Location:** `src/server/plugin-router:0`
- **Evidence:** `edge server/plugin-router -> engines/safe-eval (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0234 — Skip-layer dependency: server/plugin-router -> engines/provider-registrar
- **Dimension:** layering
- **Location:** `src/server/plugin-router:0`
- **Evidence:** `edge server/plugin-router -> engines/provider-registrar (layers 5 -> 1, gap 4)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0235 — Skip-layer dependency: server/plugin-router -> storage/impl
- **Dimension:** layering
- **Location:** `src/server/plugin-router:0`
- **Evidence:** `edge server/plugin-router -> storage/impl (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0236 — Skip-layer dependency: server/setup-router -> executor/cdp
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

### [P2] AR-0237 — Skip-layer dependency: server/setup-router -> executor/launcher
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

### [P2] AR-0238 — Skip-layer dependency: server/setup-router -> executor/profile-allocator
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

### [P2] AR-0239 — Skip-layer dependency: server/webhook-router -> engines/workflow-engine
- **Dimension:** layering
- **Location:** `src/server/webhook-router:0`
- **Evidence:** `edge server/webhook-router -> engines/workflow-engine (layers 5 -> 3, gap 2)`
- **Impact:** Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.
- **Fix Instructions:**
  - Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.
  - Steps:
    - Confirm the intermediate layer owns the needed capability.
    - Add the dependency at the correct layer.
    - If intentional, add a comment + update policy.ts.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0240 — Skip-layer dependency: server/websocket -> engines/capability-event-bus
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

### [P2] AR-0241 — Skip-layer dependency: server/websocket -> engines/unified-registry
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

### [P2] AR-0253 — Hub module: engines/capability-event-bus (fan-in 40, fan-out 1)
- **Dimension:** coupling
- **Location:** `src/engines/capability-event-bus:0`
- **Evidence:** `fan-in=40 fan-out=1 I=0.02`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0254 — Hub module: engines/chrome-governor (fan-in 26, fan-out 8)
- **Dimension:** coupling
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `fan-in=26 fan-out=8 I=0.24`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0256 — Hub module: engines/unified-registry (fan-in 33, fan-out 1)
- **Dimension:** coupling
- **Location:** `src/engines/unified-registry:0`
- **Evidence:** `fan-in=33 fan-out=1 I=0.03`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0257 — Hub module: errors (fan-in 74, fan-out 0)
- **Dimension:** coupling
- **Location:** `src/errors:0`
- **Evidence:** `fan-in=74 fan-out=0 I=0.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0259 — Hub module: ids (fan-in 52, fan-out 0)
- **Dimension:** coupling
- **Location:** `src/ids:0`
- **Evidence:** `fan-in=52 fan-out=0 I=0.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0260 — Hub module: index (fan-in 0, fan-out 92)
- **Dimension:** coupling
- **Location:** `src/index:0`
- **Evidence:** `fan-in=0 fan-out=92 I=1.00`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0263 — Hub module: server/index (fan-in 12, fan-out 67)
- **Dimension:** coupling
- **Location:** `src/server/index:0`
- **Evidence:** `fan-in=12 fan-out=67 I=0.85`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no

### [P2] AR-0264 — Hub module: storage/contracts (fan-in 72, fan-out 13)
- **Dimension:** coupling
- **Location:** `src/storage/contracts:0`
- **Evidence:** `fan-in=72 fan-out=13 I=0.15`
- **Impact:** Excessive fan-in makes the module a single point of coupling; a change touches many dependents.
- **Fix Instructions:**
  - Decompose the module or route dependents through narrower interfaces to lower its degree.
  - Steps:
    - List the top dependents.
    - Identify a cohesion group to extract into a sub-module.
    - Introduce a focused contract for the extracted responsibility.
  - Effort: L  - Auto-fixable: no


### Dimension: cohesion

### [P2] AR-0265 — Low cohesion: canvas/canvas-agent-tools (internal 0/7)
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

### [P2] AR-0266 — Low cohesion: canvas/canvas-engine (internal 0/14)
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

### [P2] AR-0267 — Low cohesion: canvas/canvas-registry (internal 0/5)
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

### [P2] AR-0268 — Low cohesion: canvas/capability-bridge (internal 0/4)
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

### [P2] AR-0269 — Low cohesion: canvas/capability-layer (internal 0/4)
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

### [P2] AR-0270 — Low cohesion: canvas/designer (internal 0/3)
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

### [P2] AR-0271 — Low cohesion: canvas/index (internal 0/13)
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

### [P2] AR-0272 — Low cohesion: canvas/layer-mounter (internal 0/4)
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

### [P2] AR-0273 — Low cohesion: canvas/mutation-caps (internal 0/6)
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

### [P2] AR-0274 — Low cohesion: cli/discovery-stack (internal 0/12)
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

### [P2] AR-0275 — Low cohesion: cli/index (internal 0/5)
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

### [P2] AR-0276 — Low cohesion: cli/provider-harness (internal 0/3)
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

### [P2] AR-0277 — Low cohesion: engines/agent-builder (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/agent-builder:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0278 — Low cohesion: engines/agentic-loop (internal 0/3)
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

### [P2] AR-0279 — Low cohesion: engines/autonomous-execution (internal 0/11)
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

### [P2] AR-0280 — Low cohesion: engines/autonomous-replay (internal 0/5)
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

### [P2] AR-0281 — Low cohesion: engines/backup-scheduler (internal 0/3)
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

### [P2] AR-0282 — Low cohesion: engines/capability-bootstrap-generated (internal 0/3)
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

### [P2] AR-0283 — Low cohesion: engines/capability-bootstrap (internal 0/17)
- **Dimension:** cohesion
- **Location:** `src/engines/capability-bootstrap:0`
- **Evidence:** `selfDeps=0 totalDeps=17 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0284 — Low cohesion: engines/capability-composer (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/capability-composer:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0285 — Low cohesion: engines/capability-discovery-loop (internal 0/3)
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

### [P2] AR-0286 — Low cohesion: engines/capability-event-bus-v2 (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/capability-event-bus-v2:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0287 — Low cohesion: engines/capability (internal 0/5)
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

### [P2] AR-0288 — Low cohesion: engines/cdp-capability-registrar (internal 0/4)
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

### [P2] AR-0289 — Low cohesion: engines/chrome-governor (internal 0/8)
- **Dimension:** cohesion
- **Location:** `src/engines/chrome-governor:0`
- **Evidence:** `selfDeps=0 totalDeps=8 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0290 — Low cohesion: engines/chrome-setup-wizard (internal 0/5)
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

### [P2] AR-0291 — Low cohesion: engines/command-parity-capabilities (internal 0/4)
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

### [P2] AR-0292 — Low cohesion: engines/config-universal-surface (internal 0/7)
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

### [P2] AR-0293 — Low cohesion: engines/context-assembly (internal 0/5)
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

### [P2] AR-0294 — Low cohesion: engines/conversation-manager (internal 0/16)
- **Dimension:** cohesion
- **Location:** `src/engines/conversation-manager:0`
- **Evidence:** `selfDeps=0 totalDeps=16 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0295 — Low cohesion: engines/conversation-organizer (internal 0/3)
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

### [P2] AR-0296 — Low cohesion: engines/discovery-session-runner (internal 0/6)
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

### [P2] AR-0297 — Low cohesion: engines/execution-policy (internal 0/3)
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

### [P2] AR-0298 — Low cohesion: engines/harness (internal 1/9)
- **Dimension:** cohesion
- **Location:** `src/engines/harness:0`
- **Evidence:** `selfDeps=1 totalDeps=9 cohesion=0.11`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0299 — Low cohesion: engines/harness-repair-engine (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/harness-repair-engine:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0300 — Low cohesion: engines/harness-runtime (internal 0/3)
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

### [P2] AR-0301 — Low cohesion: engines/intent-decomposer (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/intent-decomposer:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0302 — Low cohesion: engines/kernel (internal 1/12)
- **Dimension:** cohesion
- **Location:** `src/engines/kernel:0`
- **Evidence:** `selfDeps=1 totalDeps=12 cohesion=0.08`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0303 — Low cohesion: engines/knowledge-extractor-continuous (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/knowledge-extractor-continuous:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0304 — Low cohesion: engines/knowledge-ingestion (internal 0/5)
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

### [P2] AR-0305 — Low cohesion: engines/live-capability-registry (internal 0/8)
- **Dimension:** cohesion
- **Location:** `src/engines/live-capability-registry:0`
- **Evidence:** `selfDeps=0 totalDeps=8 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0306 — Low cohesion: engines/local-agent (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/local-agent:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0307 — Low cohesion: engines/memory (internal 1/9)
- **Dimension:** cohesion
- **Location:** `src/engines/memory:0`
- **Evidence:** `selfDeps=1 totalDeps=9 cohesion=0.11`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0308 — Low cohesion: engines/memory-engine (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/memory-engine:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0309 — Low cohesion: engines/memory-indexer (internal 0/3)
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

### [P2] AR-0310 — Low cohesion: engines/mirror-engine (internal 0/5)
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

### [P2] AR-0311 — Low cohesion: engines/nlcl (internal 1/11)
- **Dimension:** cohesion
- **Location:** `src/engines/nlcl:0`
- **Evidence:** `selfDeps=1 totalDeps=11 cohesion=0.09`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0312 — Low cohesion: engines/observability (internal 0/6)
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

### [P2] AR-0313 — Low cohesion: engines/opencode (internal 1/8)
- **Dimension:** cohesion
- **Location:** `src/engines/opencode:0`
- **Evidence:** `selfDeps=1 totalDeps=8 cohesion=0.13`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0314 — Low cohesion: engines/provider-discovery (internal 0/8)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-discovery:0`
- **Evidence:** `selfDeps=0 totalDeps=8 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0315 — Low cohesion: engines/provider-health (internal 0/5)
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

### [P2] AR-0316 — Low cohesion: engines/provider-mux (internal 0/7)
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

### [P2] AR-0317 — Low cohesion: engines/provider-protocol-loader (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-protocol-loader:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0318 — Low cohesion: engines/provider-registrar (internal 0/6)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-registrar:0`
- **Evidence:** `selfDeps=0 totalDeps=6 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0319 — Low cohesion: engines/provider-test-harness (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/engines/provider-test-harness:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0320 — Low cohesion: engines/registration-auditor (internal 0/3)
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

### [P2] AR-0321 — Low cohesion: engines/sandbox-runner (internal 0/3)
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

### [P2] AR-0322 — Low cohesion: engines/send-resilience (internal 0/4)
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

### [P2] AR-0323 — Low cohesion: engines/situation-detector (internal 0/3)
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

### [P2] AR-0324 — Low cohesion: engines/sla-monitor (internal 0/3)
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

### [P2] AR-0325 — Low cohesion: engines/stream-block-store (internal 0/3)
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

### [P2] AR-0326 — Low cohesion: engines/stream-parser (internal 0/5)
- **Dimension:** cohesion
- **Location:** `src/engines/stream-parser:0`
- **Evidence:** `selfDeps=0 totalDeps=5 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0327 — Low cohesion: engines/streaming-channel-caps (internal 0/5)
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

### [P2] AR-0328 — Low cohesion: engines/telemetry-aggregator (internal 0/3)
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

### [P2] AR-0329 — Low cohesion: engines/user-identity (internal 0/3)
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

### [P2] AR-0330 — Low cohesion: engines/version-manager (internal 0/5)
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

### [P2] AR-0331 — Low cohesion: engines/workflow-compiler (internal 0/3)
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

### [P2] AR-0332 — Low cohesion: engines/workflow-engine (internal 0/6)
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

### [P2] AR-0333 — Low cohesion: executor/fleet-supervisor (internal 0/7)
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

### [P2] AR-0334 — Low cohesion: index (internal 0/92)
- **Dimension:** cohesion
- **Location:** `src/index:0`
- **Evidence:** `selfDeps=0 totalDeps=92 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0335 — Low cohesion: mcp/index (internal 0/3)
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

### [P2] AR-0336 — Low cohesion: mcp/types (internal 0/4)
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

### [P2] AR-0337 — Low cohesion: router/router (internal 0/3)
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

### [P2] AR-0338 — Low cohesion: schema/content (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/schema/content:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0339 — Low cohesion: schema/index (internal 0/17)
- **Dimension:** cohesion
- **Location:** `src/schema/index:0`
- **Evidence:** `selfDeps=0 totalDeps=17 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0340 — Low cohesion: schema/schemas (internal 0/11)
- **Dimension:** cohesion
- **Location:** `src/schema/schemas:0`
- **Evidence:** `selfDeps=0 totalDeps=11 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0341 — Low cohesion: server/automation-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/automation-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0342 — Low cohesion: server/canvas-router (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/server/canvas-router:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0343 — Low cohesion: server/canvas-ws (internal 0/7)
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

### [P2] AR-0344 — Low cohesion: server/capability-router (internal 0/4)
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

### [P2] AR-0345 — Low cohesion: server/conversation-router (internal 0/5)
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

### [P2] AR-0346 — Low cohesion: server/index (internal 0/67)
- **Dimension:** cohesion
- **Location:** `src/server/index:0`
- **Evidence:** `selfDeps=0 totalDeps=67 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0347 — Low cohesion: server/interpret-router (internal 0/3)
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

### [P2] AR-0348 — Low cohesion: server/kernel-router (internal 0/3)
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

### [P2] AR-0349 — Low cohesion: server/knowledge-router (internal 0/4)
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

### [P2] AR-0350 — Low cohesion: server/memory-router (internal 0/4)
- **Dimension:** cohesion
- **Location:** `src/server/memory-router:0`
- **Evidence:** `selfDeps=0 totalDeps=4 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0351 — Low cohesion: server/memory-viz-router (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/server/memory-viz-router:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0352 — Low cohesion: server/mux-router (internal 0/4)
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

### [P2] AR-0353 — Low cohesion: server/plugin-router (internal 0/8)
- **Dimension:** cohesion
- **Location:** `src/server/plugin-router:0`
- **Evidence:** `selfDeps=0 totalDeps=8 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0354 — Low cohesion: server/setup-router (internal 0/6)
- **Dimension:** cohesion
- **Location:** `src/server/setup-router:0`
- **Evidence:** `selfDeps=0 totalDeps=6 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0355 — Low cohesion: storage/contracts (internal 1/13)
- **Dimension:** cohesion
- **Location:** `src/storage/contracts:0`
- **Evidence:** `selfDeps=1 totalDeps=13 cohesion=0.08`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0356 — Low cohesion: storage/db (internal 0/3)
- **Dimension:** cohesion
- **Location:** `src/storage/db:0`
- **Evidence:** `selfDeps=0 totalDeps=3 cohesion=0.00`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no

### [P2] AR-0357 — Low cohesion: storage/impl (internal 1/18)
- **Dimension:** cohesion
- **Location:** `src/storage/impl:0`
- **Evidence:** `selfDeps=1 totalDeps=18 cohesion=0.06`
- **Impact:** Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.
- **Fix Instructions:**
  - Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.
  - Steps:
    - Map the external dependencies to subject areas.
    - Split the module along those areas.
    - Re-run to confirm cohesion rises above the threshold.
  - Effort: M  - Auto-fixable: no


### Dimension: commands

### [P2] AR-0364 — Surface "cli" declared but not bound — cap:conversation:send_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:conversation:send_message is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:conversation:send_message" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0365 — Surface "ui" declared but not bound — cap:conversation:send_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:conversation:send_message is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:conversation:send_message" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0366 — Surface "mcp" declared but not bound — cap:conversation:send_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:conversation:send_message is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:conversation:send_message" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0367 — Surface "api" declared but not bound — cap:conversation:send_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:conversation:send_message is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:conversation:send_message" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0368 — Surface "cli" declared but not bound — cap:conversation:read_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:conversation:read_response is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:conversation:read_response" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0369 — Surface "ui" declared but not bound — cap:conversation:read_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:conversation:read_response is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:conversation:read_response" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0370 — Surface "mcp" declared but not bound — cap:conversation:read_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:conversation:read_response is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:conversation:read_response" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0371 — Surface "api" declared but not bound — cap:conversation:read_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:conversation:read_response is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:conversation:read_response" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0372 — Surface "cli" declared but not bound — cap:conversation:edit_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:conversation:edit_message is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:conversation:edit_message" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0373 — Surface "ui" declared but not bound — cap:conversation:edit_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:conversation:edit_message is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:conversation:edit_message" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0374 — Surface "mcp" declared but not bound — cap:conversation:edit_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:conversation:edit_message is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:conversation:edit_message" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0375 — Surface "api" declared but not bound — cap:conversation:edit_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:conversation:edit_message is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:conversation:edit_message" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0376 — Surface "cli" declared but not bound — cap:conversation:regenerate_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:conversation:regenerate_response is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:conversation:regenerate_response" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0377 — Surface "ui" declared but not bound — cap:conversation:regenerate_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:conversation:regenerate_response is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:conversation:regenerate_response" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0378 — Surface "mcp" declared but not bound — cap:conversation:regenerate_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:conversation:regenerate_response is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:conversation:regenerate_response" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0379 — Surface "api" declared but not bound — cap:conversation:regenerate_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:conversation:regenerate_response is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:conversation:regenerate_response" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0380 — Surface "cli" declared but not bound — cap:conversation:new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:conversation:new_chat is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:conversation:new_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0381 — Surface "ui" declared but not bound — cap:conversation:new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:conversation:new_chat is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:conversation:new_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0382 — Surface "mcp" declared but not bound — cap:conversation:new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:conversation:new_chat is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:conversation:new_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0383 — Surface "api" declared but not bound — cap:conversation:new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:conversation:new_chat is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:conversation:new_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0384 — Surface "cli" declared but not bound — cap:model:select_model
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:model:select_model is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:model:select_model" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0385 — Surface "ui" declared but not bound — cap:model:select_model
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:model:select_model is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:model:select_model" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0386 — Surface "mcp" declared but not bound — cap:model:select_model
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:model:select_model is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:model:select_model" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0387 — Surface "api" declared but not bound — cap:model:select_model
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:model:select_model is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:model:select_model" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0388 — Surface "cli" declared but not bound — cap:model:toggle_web_search
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:model:toggle_web_search is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:model:toggle_web_search" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0389 — Surface "ui" declared but not bound — cap:model:toggle_web_search
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:model:toggle_web_search is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:model:toggle_web_search" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0390 — Surface "mcp" declared but not bound — cap:model:toggle_web_search
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:model:toggle_web_search is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:model:toggle_web_search" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0391 — Surface "api" declared but not bound — cap:model:toggle_web_search
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:model:toggle_web_search is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:model:toggle_web_search" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0392 — Surface "cli" declared but not bound — cap:model:toggle_extended_thinking
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:model:toggle_extended_thinking is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:model:toggle_extended_thinking" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0393 — Surface "ui" declared but not bound — cap:model:toggle_extended_thinking
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:model:toggle_extended_thinking is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:model:toggle_extended_thinking" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0394 — Surface "mcp" declared but not bound — cap:model:toggle_extended_thinking
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:model:toggle_extended_thinking is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:model:toggle_extended_thinking" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0395 — Surface "api" declared but not bound — cap:model:toggle_extended_thinking
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:model:toggle_extended_thinking is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:model:toggle_extended_thinking" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0396 — Surface "cli" declared but not bound — cap:tools:run_code
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:tools:run_code is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:tools:run_code" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0397 — Surface "ui" declared but not bound — cap:tools:run_code
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:tools:run_code is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:tools:run_code" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0398 — Surface "mcp" declared but not bound — cap:tools:run_code
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:tools:run_code is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:tools:run_code" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0399 — Surface "api" declared but not bound — cap:tools:run_code
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:tools:run_code is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:tools:run_code" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0400 — Surface "cli" declared but not bound — cap:tools:upload_file
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:tools:upload_file is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:tools:upload_file" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0401 — Surface "ui" declared but not bound — cap:tools:upload_file
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:tools:upload_file is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:tools:upload_file" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0402 — Surface "mcp" declared but not bound — cap:tools:upload_file
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:tools:upload_file is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:tools:upload_file" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0403 — Surface "api" declared but not bound — cap:tools:upload_file
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:tools:upload_file is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:tools:upload_file" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0404 — Surface "cli" declared but not bound — cap:tools:deep_research
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:tools:deep_research is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:tools:deep_research" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0405 — Surface "ui" declared but not bound — cap:tools:deep_research
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:tools:deep_research is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:tools:deep_research" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0406 — Surface "mcp" declared but not bound — cap:tools:deep_research
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:tools:deep_research is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:tools:deep_research" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0407 — Surface "api" declared but not bound — cap:tools:deep_research
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:tools:deep_research is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:tools:deep_research" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0408 — Surface "cli" declared but not bound — cap:context:clear_context
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:context:clear_context is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:context:clear_context" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0409 — Surface "ui" declared but not bound — cap:context:clear_context
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:context:clear_context is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:context:clear_context" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0410 — Surface "mcp" declared but not bound — cap:context:clear_context
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:context:clear_context is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:context:clear_context" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0411 — Surface "api" declared but not bound — cap:context:clear_context
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:context:clear_context is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:context:clear_context" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0412 — Surface "cli" declared but not bound — cap:context:memory_recall
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:context:memory_recall is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:context:memory_recall" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0413 — Surface "ui" declared but not bound — cap:context:memory_recall
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:context:memory_recall is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:context:memory_recall" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0414 — Surface "mcp" declared but not bound — cap:context:memory_recall
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:context:memory_recall is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:context:memory_recall" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0415 — Surface "api" declared but not bound — cap:context:memory_recall
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:context:memory_recall is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:context:memory_recall" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0416 — Surface "cli" declared but not bound — cap:context:memory_store
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:context:memory_store is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:context:memory_store" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0417 — Surface "ui" declared but not bound — cap:context:memory_store
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:context:memory_store is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:context:memory_store" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0418 — Surface "mcp" declared but not bound — cap:context:memory_store
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:context:memory_store is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:context:memory_store" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0419 — Surface "api" declared but not bound — cap:context:memory_store
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:context:memory_store is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:context:memory_store" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0420 — Surface "cli" declared but not bound — cap:export:export_conversation
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:export:export_conversation is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:export:export_conversation" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0421 — Surface "ui" declared but not bound — cap:export:export_conversation
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:export:export_conversation is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:export:export_conversation" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0422 — Surface "mcp" declared but not bound — cap:export:export_conversation
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:export:export_conversation is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:export:export_conversation" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0423 — Surface "api" declared but not bound — cap:export:export_conversation
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:export:export_conversation is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:export:export_conversation" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0424 — Surface "cli" declared but not bound — cap:media:image_generate
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:media:image_generate is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:media:image_generate" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0425 — Surface "ui" declared but not bound — cap:media:image_generate
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:media:image_generate is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:media:image_generate" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0426 — Surface "mcp" declared but not bound — cap:media:image_generate
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:media:image_generate is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:media:image_generate" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0427 — Surface "api" declared but not bound — cap:media:image_generate
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:media:image_generate is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:media:image_generate" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0428 — Surface "cli" declared but not bound — cap:navigation:delete_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:navigation:delete_chat is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:navigation:delete_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0429 — Surface "ui" declared but not bound — cap:navigation:delete_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:navigation:delete_chat is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:navigation:delete_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0430 — Surface "mcp" declared but not bound — cap:navigation:delete_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:navigation:delete_chat is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:navigation:delete_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0431 — Surface "api" declared but not bound — cap:navigation:delete_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:navigation:delete_chat is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:navigation:delete_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0432 — Surface "cli" declared but not bound — cap:navigation:rename_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:navigation:rename_chat is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:navigation:rename_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0433 — Surface "ui" declared but not bound — cap:navigation:rename_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:navigation:rename_chat is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:navigation:rename_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0434 — Surface "mcp" declared but not bound — cap:navigation:rename_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:navigation:rename_chat is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:navigation:rename_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0435 — Surface "api" declared but not bound — cap:navigation:rename_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:navigation:rename_chat is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:navigation:rename_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0436 — Surface "cli" declared but not bound — cap:navigation:list_conversations
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:navigation:list_conversations is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:navigation:list_conversations" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0437 — Surface "ui" declared but not bound — cap:navigation:list_conversations
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:navigation:list_conversations is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:navigation:list_conversations" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0438 — Surface "mcp" declared but not bound — cap:navigation:list_conversations
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:navigation:list_conversations is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:navigation:list_conversations" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0439 — Surface "api" declared but not bound — cap:navigation:list_conversations
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:navigation:list_conversations is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:navigation:list_conversations" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0440 — Surface "cli" declared but not bound — cap:navigation:search_messages
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:navigation:search_messages is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:navigation:search_messages" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0441 — Surface "ui" declared but not bound — cap:navigation:search_messages
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:navigation:search_messages is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:navigation:search_messages" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0442 — Surface "mcp" declared but not bound — cap:navigation:search_messages
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:navigation:search_messages is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:navigation:search_messages" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0443 — Surface "api" declared but not bound — cap:navigation:search_messages
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:navigation:search_messages is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:navigation:search_messages" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0444 — Surface "cli" declared but not bound — cap:navigation:create_new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'cli' — missing cliCommand`
- **Impact:** A central command is needed: cap:navigation:create_new_chat is advertised on "cli" but no client entry point exists.
- **Fix Instructions:**
  - Add the cliCommand binding (or drop "cli" from surfaces).
  - Steps:
    - Add cliCommand to the "cap:navigation:create_new_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0445 — Surface "ui" declared but not bound — cap:navigation:create_new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'ui' — missing ui`
- **Impact:** A central command is needed: cap:navigation:create_new_chat is advertised on "ui" but no client entry point exists.
- **Fix Instructions:**
  - Add the ui binding (or drop "ui" from surfaces).
  - Steps:
    - Add ui to the "cap:navigation:create_new_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0446 — Surface "mcp" declared but not bound — cap:navigation:create_new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'mcp' — missing mcpToolName`
- **Impact:** A central command is needed: cap:navigation:create_new_chat is advertised on "mcp" but no client entry point exists.
- **Fix Instructions:**
  - Add the mcpToolName binding (or drop "mcp" from surfaces).
  - Steps:
    - Add mcpToolName to the "cap:navigation:create_new_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0447 — Surface "api" declared but not bound — cap:navigation:create_new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `surfaces includes 'api' — missing apiEndpoint`
- **Impact:** A central command is needed: cap:navigation:create_new_chat is advertised on "api" but no client entry point exists.
- **Fix Instructions:**
  - Add the apiEndpoint binding (or drop "api" from surfaces).
  - Steps:
    - Add apiEndpoint to the "cap:navigation:create_new_chat" capability.
    - Re-run the commands pass to confirm parity.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0448 — Potential new command — no surface binding: cap:conversation:send_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:conversation:send_message' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:conversation:send_message" on a surface or add pattern(..., { capabilityId: 'cap:conversation:send_message' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0449 — Potential new command — no surface binding: cap:conversation:read_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:conversation:read_response' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:conversation:read_response" on a surface or add pattern(..., { capabilityId: 'cap:conversation:read_response' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0450 — Potential new command — no surface binding: cap:conversation:edit_message
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:conversation:edit_message' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:conversation:edit_message" on a surface or add pattern(..., { capabilityId: 'cap:conversation:edit_message' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0451 — Potential new command — no surface binding: cap:conversation:regenerate_response
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:conversation:regenerate_response' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:conversation:regenerate_response" on a surface or add pattern(..., { capabilityId: 'cap:conversation:regenerate_response' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0452 — Potential new command — no surface binding: cap:conversation:new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:conversation:new_chat' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:conversation:new_chat" on a surface or add pattern(..., { capabilityId: 'cap:conversation:new_chat' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0453 — Potential new command — no surface binding: cap:model:select_model
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:model:select_model' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:model:select_model" on a surface or add pattern(..., { capabilityId: 'cap:model:select_model' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0454 — Potential new command — no surface binding: cap:model:toggle_web_search
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:model:toggle_web_search' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:model:toggle_web_search" on a surface or add pattern(..., { capabilityId: 'cap:model:toggle_web_search' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0455 — Potential new command — no surface binding: cap:model:toggle_extended_thinking
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:model:toggle_extended_thinking' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:model:toggle_extended_thinking" on a surface or add pattern(..., { capabilityId: 'cap:model:toggle_extended_thinking' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0456 — Potential new command — no surface binding: cap:tools:run_code
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:tools:run_code' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:tools:run_code" on a surface or add pattern(..., { capabilityId: 'cap:tools:run_code' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0457 — Potential new command — no surface binding: cap:tools:upload_file
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:tools:upload_file' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:tools:upload_file" on a surface or add pattern(..., { capabilityId: 'cap:tools:upload_file' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0458 — Potential new command — no surface binding: cap:tools:deep_research
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:tools:deep_research' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:tools:deep_research" on a surface or add pattern(..., { capabilityId: 'cap:tools:deep_research' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0459 — Potential new command — no surface binding: cap:context:clear_context
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:context:clear_context' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:context:clear_context" on a surface or add pattern(..., { capabilityId: 'cap:context:clear_context' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0460 — Potential new command — no surface binding: cap:context:memory_recall
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:context:memory_recall' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:context:memory_recall" on a surface or add pattern(..., { capabilityId: 'cap:context:memory_recall' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0461 — Potential new command — no surface binding: cap:context:memory_store
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:context:memory_store' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:context:memory_store" on a surface or add pattern(..., { capabilityId: 'cap:context:memory_store' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0462 — Potential new command — no surface binding: cap:export:export_conversation
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:export:export_conversation' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:export:export_conversation" on a surface or add pattern(..., { capabilityId: 'cap:export:export_conversation' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0463 — Potential new command — no surface binding: cap:media:image_generate
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:media:image_generate' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:media:image_generate" on a surface or add pattern(..., { capabilityId: 'cap:media:image_generate' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0464 — Potential new command — no surface binding: cap:navigation:delete_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:navigation:delete_chat' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:navigation:delete_chat" on a surface or add pattern(..., { capabilityId: 'cap:navigation:delete_chat' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0465 — Potential new command — no surface binding: cap:navigation:rename_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:navigation:rename_chat' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:navigation:rename_chat" on a surface or add pattern(..., { capabilityId: 'cap:navigation:rename_chat' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0466 — Potential new command — no surface binding: cap:navigation:list_conversations
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:navigation:list_conversations' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:navigation:list_conversations" on a surface or add pattern(..., { capabilityId: 'cap:navigation:list_conversations' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0467 — Potential new command — no surface binding: cap:navigation:search_messages
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:navigation:search_messages' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:navigation:search_messages" on a surface or add pattern(..., { capabilityId: 'cap:navigation:search_messages' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no

### [P2] AR-0468 — Potential new command — no surface binding: cap:navigation:create_new_chat
- **Dimension:** commands
- **Location:** `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0`
- **Evidence:** `capabilityId 'cap:navigation:create_new_chat' absent from catalog.ts AND no cliCommand/ui/mcpToolName/apiEndpoint`
- **Impact:** The capability is unreachable from every client surface; a command entry point is missing.
- **Fix Instructions:**
  - Add at least one surface binding (cliCommand/ui/mcpToolName/apiEndpoint) or an NL catalog pattern.
  - Steps:
    - Open src/engines/nlcl/catalog.ts or the capability definition.
    - Bind "cap:navigation:create_new_chat" on a surface or add pattern(..., { capabilityId: 'cap:navigation:create_new_chat' }).
    - Re-run the commands pass.
  - Effort: S  - Auto-fixable: no


## P3 — 6 finding(s)

### Dimension: coupling

### [P3] AR-0251 — Orphan module: cli/json-schema
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

### [P3] AR-0252 — Orphan module: cli/repl
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

### [P3] AR-0255 — Orphan module: engines/streaming-response-analyzer
- **Dimension:** coupling
- **Location:** `src/engines/streaming-response-analyzer:0`
- **Evidence:** `fan-in=0 fan-out=0 files=1`
- **Impact:** Isolated modules inflate the surface and may be unreachable dead code.
- **Fix Instructions:**
  - Confirm the module is reached (entry point / dynamic import) or remove it if unused.
  - Steps:
    - Grep the codebase for dynamic/string-based references.
    - If truly unused, delete it; otherwise document the entry path.
  - Effort: S  - Auto-fixable: no

### [P3] AR-0258 — Orphan module: executor/cdp-error-classifier
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

### [P3] AR-0261 — Orphan module: schema/command-description
- **Dimension:** coupling
- **Location:** `src/schema/command-description:0`
- **Evidence:** `fan-in=0 fan-out=0 files=1`
- **Impact:** Isolated modules inflate the surface and may be unreachable dead code.
- **Fix Instructions:**
  - Confirm the module is reached (entry point / dynamic import) or remove it if unused.
  - Steps:
    - Grep the codebase for dynamic/string-based references.
    - If truly unused, delete it; otherwise document the entry path.
  - Effort: S  - Auto-fixable: no

### [P3] AR-0262 — Orphan module: schema/validators
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
| AR-0001 | P1 | cycles | `src/router/router:0` | L | no |
| AR-0002 | P1 | cycles | `src/engines/manifest-inference:0` | L | no |
| AR-0003 | P1 | cycles | `src/engines/kernel:0` | L | no |
| AR-0004 | P1 | cycles | `src/server/canvas-router:0` | L | no |
| AR-0005 | P1 | cycles | `src/mcp/discovery-tools:0` | L | no |
| AR-0006 | P1 | layering | `src/automation/automation-router:0` | M | no |
| AR-0028 | P1 | layering | `src/config/provider-registry:0` | M | no |
| AR-0029 | P1 | layering | `src/desktop/sidecar-entry:0` | M | no |
| AR-0031 | P1 | layering | `src/engines/automation:0` | M | no |
| AR-0033 | P1 | layering | `src/engines/autonomous-execution:0` | M | no |
| AR-0035 | P1 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0038 | P1 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0040 | P1 | layering | `src/engines/capability-composer:0` | M | no |
| AR-0041 | P1 | layering | `src/engines/capability-event-bus:0` | M | no |
| AR-0042 | P1 | layering | `src/engines/capability:0` | M | no |
| AR-0043 | P1 | layering | `src/engines/cdp-capability-registrar:0` | M | no |
| AR-0044 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0045 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0046 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0047 | P1 | layering | `src/engines/chrome-governor:0` | M | no |
| AR-0053 | P1 | layering | `src/engines/config-universal-surface:0` | M | no |
| AR-0062 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0063 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0064 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0065 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0066 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0067 | P1 | layering | `src/engines/kernel:0` | M | no |
| AR-0068 | P1 | layering | `src/engines/live-capability-registry:0` | M | no |
| AR-0069 | P1 | layering | `src/engines/live-capability-registry:0` | M | no |
| AR-0074 | P1 | layering | `src/engines/opencode:0` | M | no |
| AR-0075 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0076 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0077 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0078 | P1 | layering | `src/engines/provider-discovery:0` | M | no |
| AR-0079 | P1 | layering | `src/engines/provider-health:0` | M | no |
| AR-0080 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0081 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0082 | P1 | layering | `src/engines/provider-mux:0` | M | no |
| AR-0083 | P1 | layering | `src/engines/provider-registrar:0` | M | no |
| AR-0086 | P1 | layering | `src/engines/send-capability:0` | M | no |
| AR-0173 | P1 | layering | `src/schema/chrome:0` | M | no |
| AR-0174 | P1 | layering | `src/schema/chrome:0` | M | no |
| AR-0242 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0243 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0244 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0245 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0246 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0247 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0248 | P1 | layering | `src/storage/contracts:0` | M | no |
| AR-0249 | P1 | layering | `src/storage/db:0` | M | no |
| AR-0250 | P1 | layering | `src/storage/impl:0` | M | no |
| AR-0358 | P1 | boundaries | `src/engines/api-provider-adapter.ts:20` | M | no |
| AR-0359 | P1 | boundaries | `src/engines/workspace-presets.ts:116` | M | no |
| AR-0360 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0361 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0362 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0363 | P1 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\nlcl\catalog.ts:0` | S | no |
| AR-0007 | P2 | layering | `src/automation/ui-automator:0` | M | no |
| AR-0008 | P2 | layering | `src/canvas/canvas-agent-tools:0` | M | no |
| AR-0009 | P2 | layering | `src/canvas/canvas-engine:0` | M | no |
| AR-0010 | P2 | layering | `src/canvas/canvas-engine:0` | M | no |
| AR-0011 | P2 | layering | `src/canvas/mutation-caps:0` | M | no |
| AR-0012 | P2 | layering | `src/canvas/mutation-caps:0` | M | no |
| AR-0013 | P2 | layering | `src/cli/commands:0` | M | no |
| AR-0014 | P2 | layering | `src/cli/commands:0` | M | no |
| AR-0015 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0016 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0017 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0018 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0019 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0020 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0021 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0022 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0023 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0024 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0025 | P2 | layering | `src/cli/discovery-stack:0` | M | no |
| AR-0026 | P2 | layering | `src/cli/index:0` | M | no |
| AR-0027 | P2 | layering | `src/cli/provider-harness:0` | M | no |
| AR-0030 | P2 | layering | `src/engines/automation:0` | M | no |
| AR-0032 | P2 | layering | `src/engines/autonomous-execution:0` | M | no |
| AR-0034 | P2 | layering | `src/engines/browser-automation:0` | M | no |
| AR-0036 | P2 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0037 | P2 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0039 | P2 | layering | `src/engines/capability-bootstrap:0` | M | no |
| AR-0048 | P2 | layering | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0049 | P2 | layering | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0050 | P2 | layering | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0051 | P2 | layering | `src/engines/composer-typing:0` | M | no |
| AR-0052 | P2 | layering | `src/engines/config-universal-surface:0` | M | no |
| AR-0054 | P2 | layering | `src/engines/conversation-manager:0` | M | no |
| AR-0055 | P2 | layering | `src/engines/conversation-manager:0` | M | no |
| AR-0056 | P2 | layering | `src/engines/discovery-session-runner:0` | M | no |
| AR-0057 | P2 | layering | `src/engines/discovery-session-runner:0` | M | no |
| AR-0058 | P2 | layering | `src/engines/eviction-manager:0` | M | no |
| AR-0059 | P2 | layering | `src/engines/harness:0` | M | no |
| AR-0060 | P2 | layering | `src/engines/harness:0` | M | no |
| AR-0061 | P2 | layering | `src/engines/harness-runtime:0` | M | no |
| AR-0070 | P2 | layering | `src/engines/manifest-inference:0` | M | no |
| AR-0071 | P2 | layering | `src/engines/mcp-server-adapter:0` | M | no |
| AR-0072 | P2 | layering | `src/engines/mirror-engine:0` | M | no |
| AR-0073 | P2 | layering | `src/engines/nlcl:0` | M | no |
| AR-0084 | P2 | layering | `src/engines/provider-test-harness:0` | M | no |
| AR-0085 | P2 | layering | `src/engines/semantic-grounding:0` | M | no |
| AR-0087 | P2 | layering | `src/engines/send-resilience:0` | M | no |
| AR-0088 | P2 | layering | `src/engines/send-resilience:0` | M | no |
| AR-0089 | P2 | layering | `src/engines/streaming-channel-caps:0` | M | no |
| AR-0090 | P2 | layering | `src/engines/telemetry-aggregator:0` | M | no |
| AR-0091 | P2 | layering | `src/engines/telemetry-aggregator:0` | M | no |
| AR-0092 | P2 | layering | `src/engines/version-manager:0` | M | no |
| AR-0093 | P2 | layering | `src/engines/version-manager:0` | M | no |
| AR-0094 | P2 | layering | `src/engines/workflow-engine:0` | M | no |
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
| AR-0131 | P2 | layering | `src/index:0` | M | no |
| AR-0132 | P2 | layering | `src/index:0` | M | no |
| AR-0133 | P2 | layering | `src/index:0` | M | no |
| AR-0134 | P2 | layering | `src/index:0` | M | no |
| AR-0135 | P2 | layering | `src/index:0` | M | no |
| AR-0136 | P2 | layering | `src/index:0` | M | no |
| AR-0137 | P2 | layering | `src/index:0` | M | no |
| AR-0138 | P2 | layering | `src/index:0` | M | no |
| AR-0139 | P2 | layering | `src/index:0` | M | no |
| AR-0140 | P2 | layering | `src/index:0` | M | no |
| AR-0141 | P2 | layering | `src/index:0` | M | no |
| AR-0142 | P2 | layering | `src/index:0` | M | no |
| AR-0143 | P2 | layering | `src/index:0` | M | no |
| AR-0144 | P2 | layering | `src/index:0` | M | no |
| AR-0145 | P2 | layering | `src/index:0` | M | no |
| AR-0146 | P2 | layering | `src/index:0` | M | no |
| AR-0147 | P2 | layering | `src/index:0` | M | no |
| AR-0148 | P2 | layering | `src/index:0` | M | no |
| AR-0149 | P2 | layering | `src/index:0` | M | no |
| AR-0150 | P2 | layering | `src/index:0` | M | no |
| AR-0151 | P2 | layering | `src/index:0` | M | no |
| AR-0152 | P2 | layering | `src/index:0` | M | no |
| AR-0153 | P2 | layering | `src/index:0` | M | no |
| AR-0154 | P2 | layering | `src/index:0` | M | no |
| AR-0155 | P2 | layering | `src/index:0` | M | no |
| AR-0156 | P2 | layering | `src/index:0` | M | no |
| AR-0157 | P2 | layering | `src/index:0` | M | no |
| AR-0158 | P2 | layering | `src/index:0` | M | no |
| AR-0159 | P2 | layering | `src/index:0` | M | no |
| AR-0160 | P2 | layering | `src/index:0` | M | no |
| AR-0161 | P2 | layering | `src/index:0` | M | no |
| AR-0162 | P2 | layering | `src/index:0` | M | no |
| AR-0163 | P2 | layering | `src/index:0` | M | no |
| AR-0164 | P2 | layering | `src/index:0` | M | no |
| AR-0165 | P2 | layering | `src/index:0` | M | no |
| AR-0166 | P2 | layering | `src/index:0` | M | no |
| AR-0167 | P2 | layering | `src/index:0` | M | no |
| AR-0168 | P2 | layering | `src/index:0` | M | no |
| AR-0169 | P2 | layering | `src/mcp/types:0` | M | no |
| AR-0170 | P2 | layering | `src/mcp/types:0` | M | no |
| AR-0171 | P2 | layering | `src/mcp/types:0` | M | no |
| AR-0172 | P2 | layering | `src/mcp/types:0` | M | no |
| AR-0175 | P2 | layering | `src/server/automation-router:0` | M | no |
| AR-0176 | P2 | layering | `src/server/autonomous-router:0` | M | no |
| AR-0177 | P2 | layering | `src/server/autonomous-router:0` | M | no |
| AR-0178 | P2 | layering | `src/server/canvas-router:0` | M | no |
| AR-0179 | P2 | layering | `src/server/canvas-ws:0` | M | no |
| AR-0180 | P2 | layering | `src/server/capability-router:0` | M | no |
| AR-0181 | P2 | layering | `src/server/conversation-router:0` | M | no |
| AR-0182 | P2 | layering | `src/server/conversation-router:0` | M | no |
| AR-0183 | P2 | layering | `src/server/conversation-router:0` | M | no |
| AR-0184 | P2 | layering | `src/server/index:0` | M | no |
| AR-0185 | P2 | layering | `src/server/index:0` | M | no |
| AR-0186 | P2 | layering | `src/server/index:0` | M | no |
| AR-0187 | P2 | layering | `src/server/index:0` | M | no |
| AR-0188 | P2 | layering | `src/server/index:0` | M | no |
| AR-0189 | P2 | layering | `src/server/index:0` | M | no |
| AR-0190 | P2 | layering | `src/server/index:0` | M | no |
| AR-0191 | P2 | layering | `src/server/index:0` | M | no |
| AR-0192 | P2 | layering | `src/server/index:0` | M | no |
| AR-0193 | P2 | layering | `src/server/index:0` | M | no |
| AR-0194 | P2 | layering | `src/server/index:0` | M | no |
| AR-0195 | P2 | layering | `src/server/index:0` | M | no |
| AR-0196 | P2 | layering | `src/server/index:0` | M | no |
| AR-0197 | P2 | layering | `src/server/index:0` | M | no |
| AR-0198 | P2 | layering | `src/server/index:0` | M | no |
| AR-0199 | P2 | layering | `src/server/index:0` | M | no |
| AR-0200 | P2 | layering | `src/server/index:0` | M | no |
| AR-0201 | P2 | layering | `src/server/index:0` | M | no |
| AR-0202 | P2 | layering | `src/server/index:0` | M | no |
| AR-0203 | P2 | layering | `src/server/index:0` | M | no |
| AR-0204 | P2 | layering | `src/server/index:0` | M | no |
| AR-0205 | P2 | layering | `src/server/index:0` | M | no |
| AR-0206 | P2 | layering | `src/server/index:0` | M | no |
| AR-0207 | P2 | layering | `src/server/index:0` | M | no |
| AR-0208 | P2 | layering | `src/server/index:0` | M | no |
| AR-0209 | P2 | layering | `src/server/index:0` | M | no |
| AR-0210 | P2 | layering | `src/server/index:0` | M | no |
| AR-0211 | P2 | layering | `src/server/index:0` | M | no |
| AR-0212 | P2 | layering | `src/server/index:0` | M | no |
| AR-0213 | P2 | layering | `src/server/index:0` | M | no |
| AR-0214 | P2 | layering | `src/server/index:0` | M | no |
| AR-0215 | P2 | layering | `src/server/index:0` | M | no |
| AR-0216 | P2 | layering | `src/server/index:0` | M | no |
| AR-0217 | P2 | layering | `src/server/index:0` | M | no |
| AR-0218 | P2 | layering | `src/server/index:0` | M | no |
| AR-0219 | P2 | layering | `src/server/index:0` | M | no |
| AR-0220 | P2 | layering | `src/server/index:0` | M | no |
| AR-0221 | P2 | layering | `src/server/index:0` | M | no |
| AR-0222 | P2 | layering | `src/server/index:0` | M | no |
| AR-0223 | P2 | layering | `src/server/index:0` | M | no |
| AR-0224 | P2 | layering | `src/server/index:0` | M | no |
| AR-0225 | P2 | layering | `src/server/index:0` | M | no |
| AR-0226 | P2 | layering | `src/server/index:0` | M | no |
| AR-0227 | P2 | layering | `src/server/kernel-router:0` | M | no |
| AR-0228 | P2 | layering | `src/server/memory-router:0` | M | no |
| AR-0229 | P2 | layering | `src/server/memory-viz-router:0` | M | no |
| AR-0230 | P2 | layering | `src/server/memory-viz-router:0` | M | no |
| AR-0231 | P2 | layering | `src/server/mux-router:0` | M | no |
| AR-0232 | P2 | layering | `src/server/mux-router:0` | M | no |
| AR-0233 | P2 | layering | `src/server/plugin-router:0` | M | no |
| AR-0234 | P2 | layering | `src/server/plugin-router:0` | M | no |
| AR-0235 | P2 | layering | `src/server/plugin-router:0` | M | no |
| AR-0236 | P2 | layering | `src/server/setup-router:0` | M | no |
| AR-0237 | P2 | layering | `src/server/setup-router:0` | M | no |
| AR-0238 | P2 | layering | `src/server/setup-router:0` | M | no |
| AR-0239 | P2 | layering | `src/server/webhook-router:0` | M | no |
| AR-0240 | P2 | layering | `src/server/websocket:0` | M | no |
| AR-0241 | P2 | layering | `src/server/websocket:0` | M | no |
| AR-0253 | P2 | coupling | `src/engines/capability-event-bus:0` | L | no |
| AR-0254 | P2 | coupling | `src/engines/chrome-governor:0` | L | no |
| AR-0256 | P2 | coupling | `src/engines/unified-registry:0` | L | no |
| AR-0257 | P2 | coupling | `src/errors:0` | L | no |
| AR-0259 | P2 | coupling | `src/ids:0` | L | no |
| AR-0260 | P2 | coupling | `src/index:0` | L | no |
| AR-0263 | P2 | coupling | `src/server/index:0` | L | no |
| AR-0264 | P2 | coupling | `src/storage/contracts:0` | L | no |
| AR-0265 | P2 | cohesion | `src/canvas/canvas-agent-tools:0` | M | no |
| AR-0266 | P2 | cohesion | `src/canvas/canvas-engine:0` | M | no |
| AR-0267 | P2 | cohesion | `src/canvas/canvas-registry:0` | M | no |
| AR-0268 | P2 | cohesion | `src/canvas/capability-bridge:0` | M | no |
| AR-0269 | P2 | cohesion | `src/canvas/capability-layer:0` | M | no |
| AR-0270 | P2 | cohesion | `src/canvas/designer:0` | M | no |
| AR-0271 | P2 | cohesion | `src/canvas/index:0` | M | no |
| AR-0272 | P2 | cohesion | `src/canvas/layer-mounter:0` | M | no |
| AR-0273 | P2 | cohesion | `src/canvas/mutation-caps:0` | M | no |
| AR-0274 | P2 | cohesion | `src/cli/discovery-stack:0` | M | no |
| AR-0275 | P2 | cohesion | `src/cli/index:0` | M | no |
| AR-0276 | P2 | cohesion | `src/cli/provider-harness:0` | M | no |
| AR-0277 | P2 | cohesion | `src/engines/agent-builder:0` | M | no |
| AR-0278 | P2 | cohesion | `src/engines/agentic-loop:0` | M | no |
| AR-0279 | P2 | cohesion | `src/engines/autonomous-execution:0` | M | no |
| AR-0280 | P2 | cohesion | `src/engines/autonomous-replay:0` | M | no |
| AR-0281 | P2 | cohesion | `src/engines/backup-scheduler:0` | M | no |
| AR-0282 | P2 | cohesion | `src/engines/capability-bootstrap-generated:0` | M | no |
| AR-0283 | P2 | cohesion | `src/engines/capability-bootstrap:0` | M | no |
| AR-0284 | P2 | cohesion | `src/engines/capability-composer:0` | M | no |
| AR-0285 | P2 | cohesion | `src/engines/capability-discovery-loop:0` | M | no |
| AR-0286 | P2 | cohesion | `src/engines/capability-event-bus-v2:0` | M | no |
| AR-0287 | P2 | cohesion | `src/engines/capability:0` | M | no |
| AR-0288 | P2 | cohesion | `src/engines/cdp-capability-registrar:0` | M | no |
| AR-0289 | P2 | cohesion | `src/engines/chrome-governor:0` | M | no |
| AR-0290 | P2 | cohesion | `src/engines/chrome-setup-wizard:0` | M | no |
| AR-0291 | P2 | cohesion | `src/engines/command-parity-capabilities:0` | M | no |
| AR-0292 | P2 | cohesion | `src/engines/config-universal-surface:0` | M | no |
| AR-0293 | P2 | cohesion | `src/engines/context-assembly:0` | M | no |
| AR-0294 | P2 | cohesion | `src/engines/conversation-manager:0` | M | no |
| AR-0295 | P2 | cohesion | `src/engines/conversation-organizer:0` | M | no |
| AR-0296 | P2 | cohesion | `src/engines/discovery-session-runner:0` | M | no |
| AR-0297 | P2 | cohesion | `src/engines/execution-policy:0` | M | no |
| AR-0298 | P2 | cohesion | `src/engines/harness:0` | M | no |
| AR-0299 | P2 | cohesion | `src/engines/harness-repair-engine:0` | M | no |
| AR-0300 | P2 | cohesion | `src/engines/harness-runtime:0` | M | no |
| AR-0301 | P2 | cohesion | `src/engines/intent-decomposer:0` | M | no |
| AR-0302 | P2 | cohesion | `src/engines/kernel:0` | M | no |
| AR-0303 | P2 | cohesion | `src/engines/knowledge-extractor-continuous:0` | M | no |
| AR-0304 | P2 | cohesion | `src/engines/knowledge-ingestion:0` | M | no |
| AR-0305 | P2 | cohesion | `src/engines/live-capability-registry:0` | M | no |
| AR-0306 | P2 | cohesion | `src/engines/local-agent:0` | M | no |
| AR-0307 | P2 | cohesion | `src/engines/memory:0` | M | no |
| AR-0308 | P2 | cohesion | `src/engines/memory-engine:0` | M | no |
| AR-0309 | P2 | cohesion | `src/engines/memory-indexer:0` | M | no |
| AR-0310 | P2 | cohesion | `src/engines/mirror-engine:0` | M | no |
| AR-0311 | P2 | cohesion | `src/engines/nlcl:0` | M | no |
| AR-0312 | P2 | cohesion | `src/engines/observability:0` | M | no |
| AR-0313 | P2 | cohesion | `src/engines/opencode:0` | M | no |
| AR-0314 | P2 | cohesion | `src/engines/provider-discovery:0` | M | no |
| AR-0315 | P2 | cohesion | `src/engines/provider-health:0` | M | no |
| AR-0316 | P2 | cohesion | `src/engines/provider-mux:0` | M | no |
| AR-0317 | P2 | cohesion | `src/engines/provider-protocol-loader:0` | M | no |
| AR-0318 | P2 | cohesion | `src/engines/provider-registrar:0` | M | no |
| AR-0319 | P2 | cohesion | `src/engines/provider-test-harness:0` | M | no |
| AR-0320 | P2 | cohesion | `src/engines/registration-auditor:0` | M | no |
| AR-0321 | P2 | cohesion | `src/engines/sandbox-runner:0` | M | no |
| AR-0322 | P2 | cohesion | `src/engines/send-resilience:0` | M | no |
| AR-0323 | P2 | cohesion | `src/engines/situation-detector:0` | M | no |
| AR-0324 | P2 | cohesion | `src/engines/sla-monitor:0` | M | no |
| AR-0325 | P2 | cohesion | `src/engines/stream-block-store:0` | M | no |
| AR-0326 | P2 | cohesion | `src/engines/stream-parser:0` | M | no |
| AR-0327 | P2 | cohesion | `src/engines/streaming-channel-caps:0` | M | no |
| AR-0328 | P2 | cohesion | `src/engines/telemetry-aggregator:0` | M | no |
| AR-0329 | P2 | cohesion | `src/engines/user-identity:0` | M | no |
| AR-0330 | P2 | cohesion | `src/engines/version-manager:0` | M | no |
| AR-0331 | P2 | cohesion | `src/engines/workflow-compiler:0` | M | no |
| AR-0332 | P2 | cohesion | `src/engines/workflow-engine:0` | M | no |
| AR-0333 | P2 | cohesion | `src/executor/fleet-supervisor:0` | M | no |
| AR-0334 | P2 | cohesion | `src/index:0` | M | no |
| AR-0335 | P2 | cohesion | `src/mcp/index:0` | M | no |
| AR-0336 | P2 | cohesion | `src/mcp/types:0` | M | no |
| AR-0337 | P2 | cohesion | `src/router/router:0` | M | no |
| AR-0338 | P2 | cohesion | `src/schema/content:0` | M | no |
| AR-0339 | P2 | cohesion | `src/schema/index:0` | M | no |
| AR-0340 | P2 | cohesion | `src/schema/schemas:0` | M | no |
| AR-0341 | P2 | cohesion | `src/server/automation-router:0` | M | no |
| AR-0342 | P2 | cohesion | `src/server/canvas-router:0` | M | no |
| AR-0343 | P2 | cohesion | `src/server/canvas-ws:0` | M | no |
| AR-0344 | P2 | cohesion | `src/server/capability-router:0` | M | no |
| AR-0345 | P2 | cohesion | `src/server/conversation-router:0` | M | no |
| AR-0346 | P2 | cohesion | `src/server/index:0` | M | no |
| AR-0347 | P2 | cohesion | `src/server/interpret-router:0` | M | no |
| AR-0348 | P2 | cohesion | `src/server/kernel-router:0` | M | no |
| AR-0349 | P2 | cohesion | `src/server/knowledge-router:0` | M | no |
| AR-0350 | P2 | cohesion | `src/server/memory-router:0` | M | no |
| AR-0351 | P2 | cohesion | `src/server/memory-viz-router:0` | M | no |
| AR-0352 | P2 | cohesion | `src/server/mux-router:0` | M | no |
| AR-0353 | P2 | cohesion | `src/server/plugin-router:0` | M | no |
| AR-0354 | P2 | cohesion | `src/server/setup-router:0` | M | no |
| AR-0355 | P2 | cohesion | `src/storage/contracts:0` | M | no |
| AR-0356 | P2 | cohesion | `src/storage/db:0` | M | no |
| AR-0357 | P2 | cohesion | `src/storage/impl:0` | M | no |
| AR-0364 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0365 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0366 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0367 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0368 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0369 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0370 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0371 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0372 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0373 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0374 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0375 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0376 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0377 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0378 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0379 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0380 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0381 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0382 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0383 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0384 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0385 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0386 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0387 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0388 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0389 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0390 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0391 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0392 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0393 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0394 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0395 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0396 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0397 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0398 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0399 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0400 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0401 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0402 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0403 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0404 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0405 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0406 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0407 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0408 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0409 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0410 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0411 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0412 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0413 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0414 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0415 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0416 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0417 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0418 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0419 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0420 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0421 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0422 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0423 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0424 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0425 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0426 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0427 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0428 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0429 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0430 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0431 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0432 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0433 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0434 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0435 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0436 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0437 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0438 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0439 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0440 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0441 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0442 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0443 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0444 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0445 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0446 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0447 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0448 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0449 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0450 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0451 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0452 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0453 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0454 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0455 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0456 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0457 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0458 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0459 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0460 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0461 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0462 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0463 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0464 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0465 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0466 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0467 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0468 | P2 | commands | `C:\0-BlackBoxProject-0\vivim-final\src\engines\capability-taxonomy.ts:0` | S | no |
| AR-0251 | P3 | coupling | `src/cli/json-schema:0` | S | no |
| AR-0252 | P3 | coupling | `src/cli/repl:0` | S | no |
| AR-0255 | P3 | coupling | `src/engines/streaming-response-analyzer:0` | S | no |
| AR-0258 | P3 | coupling | `src/executor/cdp-error-classifier:0` | S | no |
| AR-0261 | P3 | coupling | `src/schema/command-description:0` | S | no |
| AR-0262 | P3 | coupling | `src/schema/validators:0` | S | no |

---
*Generated by `bun run devops audit-arch full`. Machine-readable findings: arch-findings.json*
