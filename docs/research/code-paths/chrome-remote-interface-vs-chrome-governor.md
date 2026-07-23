# Chrome Remote Interface vs ChromeGovernor — Research

## Executive Summary

`chrome-remote-interface` (CRI) and its ecosystem are **raw CDP transport layers**: they manage WebSocket connections, JSON-RPC message framing, target/session discovery, and event subscriptions. `ChromeGovernor` is vivim's **orchestration authority**: it owns Chrome lifecycle, capability execution, trace logging, circuit breaking, health monitoring, and a mediated CDP surface. CRI peers with Puppeteer/Playwright/Chromex; ChromeGovernor peers with **Kimi's browser_guard.py + WebBridge layer**, **OpenClaw's Crabfleet run-lifecycle**, and **Leonxlnx's Tauri shell**.

---

## 1. Raw CDP Client Landscape (2026)

### 1.1 `chrome-remote-interface` (cyrus-and)

**What it is:** The lowest-level Node.js CDP binding. A 1:1 WebSocket JSON-RPC transport with target discovery, session management, and event subscriptions.

**Strengths:**
- Zero abstraction over CDP — direct `client.send(method, params, sessionId)`
- Supports Chrome, Opera, Firefox Nightly, Edge (partial)
- Protocol descriptor negotiation (remote vs local vs tip-of-tree)
- Bundled CLI REPL for interactive CDP experimentation
- 0.34.0 released Feb 2026 — actively maintained

**Gaps / Failure modes:**
- **No browser launch / lifecycle management** — assumes Chrome is already running
- **No retry / reconnect policy** beyond basic reconnection
- **No session / target lifecycle hardening** — caller must track `Target.attachToTarget`/`detachFromTarget`
- **No health monitoring / circuit breaking**
- **No capability / recipe execution model**
- **Protocol-churn risk:** tip-of-tree changes break without warning; stable 1.3 subset lags Chromium
- **Security surface:** network-port WebSocket only; no pipe-mode, no auth, no domain allow/block lists

### 1.2 Puppeteer / Puppeteer-core

**What it is:** High-level Chromium automation framework, internally uses CDP.

**vs ChromeGovernor:**
- Puppeteer **manages browser process** (download, launch, user-data-dir) — ChromeGovernor delegates spawn to `FleetSupervisor`
- Puppeteer exposes `CDPSession` for raw CDP — ChromeGovernor exposes `CdpTransport` interface, injected at construction
- Puppeteer has no **capability registry**, **harness recipe execution**, or **trace log**
- Cyppress issue #31749 (May 2025) proposes replacing CRI with Puppeteer-core for pipe-mode security — this is a **transport migration**, not an orchestration layer

### 1.3 Chromex (2026-03)

**What it is:** Agent-first CDP CLI + 85 MCP tools. Daemon-per-tab model over authenticated Unix socket.

**vs ChromeGovernor:**
- Chromex adds **per-tab daemons**, domain allow/block lists, audit logs, socket auth — these map to ChromeGovernor's `FleetSupervisor` + `TraceLog`
- Chromex has **no capability snapshot / harness recipe** execution; it's a tool surface, not an orchestration engine
- Chromex's "pipe mode" (`--pipe`) mirrors Chrome's `--remote-debugging-pipe` — vivim could adopt this in `CdpTransportImpl.resolveBrowserWsUrl`

### 1.4 `chrome-mirror` (2026-06)

**What it is:** CDP-to-web viewer relay. Multi-tab strip, keyboard/mouse passthrough, no detection.

**vs ChromeGovernor:**
- Pure relay; no orchestration, no capability execution
- Uses WebCodecs + OffscreenCanvas for rendering — irrelevant to vivim's backend
- Relevant signal: **live reconnect with exponential backoff** + status dot = ChromeGovernor's `scheduleReconnect` pattern

### 1.5 `cdp-skill` (lotreace, 2026-01)

**What it is:** 1,150+ unit-tested JSON-in/JSON-out CDP CLI for agents.

**vs ChromeGovernor:**
- Agent-optimized but still **raw CDP** — no lifecycle, no harness
- ARIA snapshots + site profiles map to vivim's `SemanticGroundingEngine` + provider-specific selectors
- Auto-launch Chrome on demand = ChromeGovernor's `spawn()` lazy-start pattern

### 1.6 CDP vs WebDriver BiDi (2026 trend)

- Chrome 124+ deprecated several CDP domains in favor of BiDi equivalents
- BiDi reached parity for navigation, screenshots, network interception (basic) by mid-2026
- **Gap for vivim:** BiDi lacks `Target.attachToTarget` for service workers, fine-grained `Performance.getMetrics`, several `Page.*` lifecycle events
- **Risk timeline:** CDP-only investments should plan 12-24 month BiDi migration window
- ChromeGovernor's `CdpTransport` interface is the **natural BiDi migration seam** — swap `BunCdpClient` for a BiDi client without touching orchestration logic

---

## 2. `BunCdpClient` (vivim's raw CDP transport)

**Location:** `src/executor/cdp.ts` (273 lines)

**What it does:**
- Raw WebSocket CDP client in TypeScript for Bun runtime
- JSON-RPC framing (`id`, `method`, `params`, `sessionId`)
- Pending request map with per-command timeouts
- Event subscription (`on`/`off`)
- Auto-reconnect with exponential backoff (`maxRetries`, `retryDelayMs`)
- WebSocket ping keepalive (`pingIntervalMs`)

**Design:** Homegrown, minimal, no external CDP library dependency. Matches CRI's core scope exactly but **without CRI's target discovery, protocol negotiation, or browser management**.

**Relationship to ChromeGovernor:**
- `BunCdpClient` is imported ONLY by `CdpTransportImpl`, `slave-read.ts`, `slave-write.ts`, `fleet-supervisor.ts`, `cdp-transport.ts`, `setup-router.ts`, `ui-automator.ts`
- All non-governor imports are **executor/infrastructure** — not engines
- Engine-side code calls `governor.evaluate()`, `governor.send()`, `governor.executeCdpMethod()` — never `BunCdpClient` directly

---

## 3. ChromeGovernor's Mediated Surface

**Location:** `src/engines/chrome-governor.ts` (1,346 lines)

**Public interface consumed by other engines:**

| Method | Layer | Purpose |
|--------|-------|---------|
| `spawn(providerId, accountId)` | Lifecycle | Launch Chrome slave with profile |
| `kill(slaveId)` / `killAll()` | Lifecycle | Terminate slave(s) |
| `ensureRunning(slaveId)` | Lifecycle | Auto-restart if dead |
| `recoverAuth(providerId, accountId)` | Lifecycle | Relogin flow |
| `setCdpTransport(transport)` | Transport | Inject raw CDP transport |
| `getTransport()` | Transport | Expose transport for advanced consumers (SelectorHealer) |
| `cdp` (getter) | Transport | Build `CDPProxy` on-demand with mutex + session routing |
| `enableDomains(slaveId, domains[])` | CDP | Centralised domain enable (prevents double-enable) |
| `evaluate(slaveId, expression)` | CDP | ONLY sanctioned `Runtime.evaluate` path |
| `executeCdpMethod(ref, cdpMethod, params)` | Capability | Resolve slave → send CDP → trace |
| `executeCapability(ref, slug)` | Capability | Resolve registered `cap:cdp:*` or snapshot program → execute |
| `runHarnessPlan(slaveId, dag)` | Harness | Execute multi-step harness DAG on slave |
| `getAllSlaves()` / `getSlave(slaveId)` | Fleet | Query slave state |
| `getSuperState()` | Fleet | Aggregate idle/active/degraded/terminal |
| `deriveProfile(providerId, accountId)` | Profile | Compute profile path |

**What ChromeGovernor does that CRI/Puppeteer/Playwright never do:**

1. **Fleet lifecycle management** — spawn, kill, restart, queue, circuit-break entire fleet of Chrome slaves
2. **Profile allocation** — deterministic `chrome-profiles/<provider>/<account>` layout with singleton enforcement
3. **Capability execution routing** — `executeCapability()` resolves by conversationId → providerId → slaveId → CDP method or harness program
4. **Trace logging** — every CDP capability execution recorded with params, result, duration, error
5. **Health monitoring** — `HealthMonitor` + `FleetSupervisor` probe with configurable intervals and timeouts
6. **Circuit breaking** — per-slave `circuitState: closed | half_open | open` with threshold-based tripping
7. **Mutex-based concurrency control** — per-slave `AsyncMutex` prevents overlapping sends
8. **Boot-time capability snapshot** — `CapabilitySnapshot` loads DB-backed `CapabilityBinding` rows once; no per-request DB hit
9. **Harness recipe execution** — multi-step DAG dispatching through `BrowserHarnessActions`
10. **Selector/protocol discovery injection** — `CdpSender` interface exposed to discovery/protocol engines without giving them raw CDP

---

## 4. Architectural Comparison Matrix

| Dimension | `chrome-remote-interface` | Puppeteer | ChromeGovernor |
|-----------|--------------------------|-----------|----------------|
| **Abstraction level** | Raw CDP transport | High-level browser automation | Orchestration authority |
| **Browser launch** | ❌ | ✅ | ✅ (via FleetSupervisor) |
| **Session/target attach** | ✅ manual | ✅ automatic | ✅ via CdpTransportImpl |
| **Auto-reconnect** | ❌ basic | ✅ | ✅ exponential backoff |
| **Circuit breaking** | ❌ | ❌ | ✅ per-slave |
| **Health monitoring** | ❌ | ❌ | ✅ probe + telemetry |
| **Capability registry** | ❌ | ❌ | ✅ snapshot + DB |
| **Harness/recipe execution** | ❌ | ❌ | ✅ HarnessDAG |
| **Trace/logging** | ❌ | ❌ | ✅ every CDP call |
| **Fleet management** | ❌ | ❌ | ✅ spawn/queue/evict |
| **Profile allocation** | ❌ | ❌ | ✅ singleton per provider+account |
| **Governor Canon** | ❌ | ❌ | ✅ single I/O authority |
| **Protocol migration seam** | N/A | N/A | ✅ CdpTransport interface |
| **BiDi readiness** | ❌ | ✅ (Playwright handles) | ⚠️ needs BiDi client behind CdpTransport |
| **TypeScript/Bun** | ✅ Node/Bun | ✅ Node | ✅ first-class Bun/TS |
| **MCP surface** | ❌ | ❌ | ✅ cap:cdp:* in registry |
| **Event subscription** | ✅ | ✅ | ✅ via governor.cdp |

---

## 5. Why vivim does NOT adopt `chrome-remote-interface`

1. **Governor Canon violation:** CRI would need to be imported by multiple engines to be useful, breaking the single-I/O-authority invariant. ChromeGovernor's `setCdpTransport(cdpTransport)` already injects a transport abstraction — replacing `BunCdpClient` with CRI inside `CdpTransportImpl` is possible without changing any engine callers.

2. **Already have a working raw client:** `BunCdpClient` is 273 lines, matches CRI's core scope exactly, and is Bun-native. CRI adds protocol negotiation and target discovery that vivim already handles in `CdpTransportImpl.resolvePageSession()`.

3. **Lifecycle/fleet gap:** CRI does not spawn Chrome, manage fleets, allocate profiles, or break circuits. Those are ChromeGovernor's value-add, not CRI's.

4. **Real alternative is BiDi migration, not CRI adoption:** The 2026 industry trend (Chrome 124+, BiDi Candidate Recommendation) is toward replacing CDP with WebDriver BiDi. CRI is CDP-only. ChromeGovernor's `CDPTransport` interface is the **correct migration seam** — swap the transport for BiDi, keep all orchestration.

5. **Where CRI would help:** If vivim needed CRI's **protocol descriptor negotiation** or **browser-versus-page target discovery patterns**, those could be ported into `CdpTransportImpl` without adopting the full library.

---

## 6. Kimi / SOTA Parallel

| Kimi Layer | Vivim Equivalent | Gap |
|-------------|-----------------|-----|
| `browser_guard.py` + CDP proxy | `ChromeGovernor` + `CdpTransportImpl` | Kimi uses Python + Playwright; vivim uses Bun + raw WebSocket |
| Per-session CDP | `CdpTransportImpl` per-slave `SlaveSession` | Same pattern |
| Environment-based compute (persistent FS + browser + code) | `chrome-profiles/` + `ensureGenericBrowser()` | Kimi's sandbox is richer; vivim's generic browser is nascent |
| Multi-agent swarm (300 parallel) | `FleetSupervisor` with `maxConcurrent` + queue | Kimi's swarm orchestration is more advanced |
| Goal Mode | `executeSnapshotProgram` + `browserHarness` | Both use recipe-driven execution |

---

## 7. Conclusion

`chrome-remote-interface` is a **transport primitive** useful when you need direct CDP access without browser management. ChromeGovernor is an **orchestration authority** that owns the entire Chrome lifecycle, capability execution, and mediated CDP surface. The two are not comparable at the same architectural level.

**vivim's correct position:**
- Keep `BunCdpClient` as the raw transport, or migrate it behind `CDPTransport` to BiDi when parity allows
- Treat ChromeGovernor's mediated surface (`enableDomains`, `evaluate`, `executeCapability`) as the **only** engine-facing CDP API
- No engine should ever import `BunCdpClient`, `chrome-remote-interface`, Puppeteer, or Playwright — Governor Canon is the invariant
- The `FleetSupervisor` + `ChromeGovernor` stack already exceeds CRI/Puppeteer/Chromex on fleet management, capability execution, and trace logging
