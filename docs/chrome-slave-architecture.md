# Chrome Slave Architecture — Full System Design

**Last updated:** 2026-07-29  
**Scope:** Chrome browser lifecycle, profile management, CDP interaction, fleet supervision, and health recovery.  
**Canonical invariant:** [B1: Governor Canon](../docs/roadmap/INVARIANTS.md#b1-governor-canon--single-io-authority) — `ChromeGovernor` is the sole I/O authority for all Chrome interaction.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Layer 0: Config & Resolver](#2-layer-0-config--resolver)
3. [Layer 1: ProfileAllocator](#3-layer-1-profileallocator)
4. [Layer 2: Launcher](#4-layer-2-launcher)
5. [Layer 3: FleetSupervisor](#5-layer-3-fleetsupervisor)
6. [Layer 4: ChromeGovernor](#6-layer-4-chromegovernor)
7. [Layer 5: CDP Transport](#7-layer-5-cdp-transport)
8. [Layer 6: CDP Watchdog](#8-layer-6-cdp-watchdog)
9. [Layer 7: Health Monitor & Circuit Breaker](#9-layer-7-health-monitor--circuit-breaker)
10. [Layer 8: Anti-Detection](#10-layer-8-anti-detection)
11. [Layer 9: Setup Wizard](#11-layer-9-setup-wizard)
12. [Layer 10: Fleet Lifecycle Adapter](#12-layer-10-fleet-lifecycle-adapter)
13. [Lifecycle State Machine](#13-lifecycle-state-machine)
14. [Profile Layout & Authentication](#14-profile-layout--authentication)
15. [Error Recovery & Circuit Breaker](#15-error-recovery--circuit-breaker)
16. [Common Failure Modes](#16-common-failure-modes)
17. [Key Configuration](#17-key-configuration)
18. [DB Models & Data Layer](#18-db-models--data-layer)
19. [Harness DAG Execution](#19-harness-dag-execution)
20. [Composer Typing Strategies](#20-composer-typing-strategies)
21. [Humanized Interactions](#21-humanized-interactions)
22. [Provider Selectors & Fallbacks](#22-provider-selectors--fallbacks)
23. [Capability Snapshot](#23-capability-snapshot)
24. [Server Shutdown Sequence](#24-server-shutdown-sequence)
25. [Troubleshooting Checklist](#25-troubleshooting-checklist)

---

## 1. Architecture Overview

The Chrome slave system is a **10-layer architecture** that manages Chrome browser instances ("slaves") — one per (provider, account) pair — for CDP-based automation of AI chat providers (ChatGPT, Claude, Gemini, etc.).

```
┌──────────────────────────────────────────────────────────────┐
│  Server (src/server/index.ts)                                │
│  boot → createServerWithEngines()                            │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Layer 9: ChromeSetupWizard  (first-run auth)     │       │
│  │  Layer 10: FleetLifecycleAdapter (harness bridge) │       │
│  ├──────────────────────────────────────────────────┤       │
│  │  Layer 4: ChromeGovernor    (public API surface)  │       │
│  │    ┌──────────────────────┐                       │       │
│  │    │  Layer 5: CDPProxy    │                       │       │
│  │    │  Layer 6: TraceLog    │                       │       │
│  │    │  Layer 7: HealthMonitor                       │       │
│  │    │  (CircuitBreaker)    │                       │       │
│  │    └──────────────────────┘                       │       │
│  ├──────────────────────────────────────────────────┤       │
│  │  Layer 3: FleetSupervisor  (lifecycle manager)    │       │
│  │    ┌──────────────────────┐                       │       │
│  │    │  FleetLimiter        │  (admission control)  │       │
│  │    │  PortReaper          │  (orphan cleanup)     │       │
│  │    │  SystemPressure      │  (load gate)          │       │
│  │    └──────────────────────┘                       │       │
│  ├──────────────────────────────────────────────────┤       │
│  │  Layer 2: Launcher         (Bun.spawn Chrome)     │       │
│  │  Layer 1: ProfileAllocator (profile dirs)        │       │
│  │  Layer 0: Config + Instance Profile             │       │
│  ├──────────────────────────────────────────────────┤       │
│  │  Layer 8: Anti-Detection   (stealth scripts)     │       │
│  │  Layer 6: CdpWatchdog      (dialog/crash)        │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  Governor Store (Prisma DB):                                 │
│    FleetEvent, CircuitBreakerState, HealthTick, TraceEntry   │
│    ProviderAccount, HarnessCommand                           │
└──────────────────────────────────────────────────────────────┘
```

### File Map

| File | Layer | Purpose |
|------|-------|---------|
| `src/config.ts` | 0 | Centralized env-config, tunables, profileBaseDir resolution |
| `src/executor/chrome-instance-profile.ts` | 0 | Chrome channel/mode resolution, binary path, arg builder |
| `src/executor/profile-allocator.ts` | 1 | Profile directory allocation, auth detection, cleanup |
| `src/executor/launcher.ts` | 2 | `Bun.spawn` wrapper, singleton lock cleanup, port wait |
| `src/executor/fleet-supervisor.ts` | 3 | Instance lifecycle, health checks, circuit breaker |
| `src/executor/fleet-limiter.ts` | 3 | Admission control (bounded concurrency + queue + timeout) |
| `src/executor/port-reaper.ts` | 3 | Orphan Chrome process cleanup daemon |
| `src/executor/system-pressure.ts` | 3 | Host CPU/memory pressure read for pre-spawn gate |
| `src/executor/slave-states.ts` | 3 | Canonical lifecycle state machine, fleet super-state |
| `src/executor/cdp.ts` | 5 | Raw WebSocket CDP client (BunCdpClient) |
| `src/executor/cdp-transport.ts` | 5 | CdpTransportImpl — adapter from BunCdpClient→CDPTransport |
| `src/engines/chrome-governor.ts` | 4 | ChromeGovernor, CDPProxy, TraceLog, HealthMonitor |
| `src/engines/cdp-watchdog.ts` | 6 | Dialog dismiss + crash recovery per slave |
| `src/engines/anti-detection.ts` | 8 | Per-provider stealth script injection |
| `src/engines/chrome-setup-wizard.ts` | 9 | First-time login wizard (visible Chrome) |
| `src/engines/harness/fleet-lifecycle-adapter.ts` | 10 | Harness→Governor slave resolver bridge |
| `src/engines/composer-typing.ts` | — | Provider-specific composer typing strategies |
| `src/engines/humanized-interaction.ts` | — | Bézier mouse curves, random jitter |
| `src/engines/provider-selectors.ts` | — | Provider-specific URLs, selectors, login patterns |
| `src/engines/capability-snapshot.ts` | — | Boot-time in-memory capability registry |
| `src/storage/contracts/governor-store.ts` | — | Data access contract (interface) |
| `src/storage/impl/governor-store-impl.ts` | — | Prisma-backed implementation |
| `src/server/index.ts` | — | Bootstrap: wires everything together |

---

## 2. Layer 0: Config & Resolver

### 2.1 Environment Configuration (`src/config.ts`)

| Env Variable | Default | Purpose |
|---|---|---|
| `CAP_STORE_CHROME_PATH` | `null` | Override Chrome binary path |
| `CAP_STORE_PROFILE_DIR` | `<dataDir>/chrome-profiles` | Profile root directory |
| `CAP_STORE_FLEET_PORT_START` | `9222` | First CDP debug port |
| `CAP_STORE_FLEET_PORT_END` | `9250` | Last CDP debug port |
| `CAP_STORE_HEALTH_PROBE_MS` | `30000` | Health check interval |
| `CAP_STORE_CIRCUIT_THRESHOLD` | `5` | Consecutive failures before circuit opens |
| `CAP_STORE_CIRCUIT_RESET_MS` | `30000` | Circuit reset window |
| `CAP_STORE_AUTO_START_FLEET` | `false` | Auto-launch fleet on boot |

### 2.2 Chrome Instance Profile (`src/executor/chrome-instance-profile.ts`)

Defines **what** Chrome to launch and **how**:

```typescript
interface ChromeInstanceProfile {
  channel: 'system' | 'chrome' | 'chromium' | 'edge'
  mode: 'headless-new' | 'headless' | 'headed'
  headless: boolean           // derived from mode
  userDataDir: string         // profile directory
  debugPort?: number          // CDP debugging port
  windowSize?: { width, height }
  disableGpu?: boolean
  launchTimeoutMs: number     // default 15_000
  extraArgs: string[]
}
```

### 2.3 Binary Resolution (`resolveChromeBinary`)

Binary resolution checks `CHROME_PATH` env var first, then probes platform-specific paths:

**Windows paths per channel:**

| Channel | Paths |
|---------|-------|
| `chrome` | `C:\Program Files\Google\Chrome\Application\chrome.exe`, `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`, `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe` |
| `chromium` | `C:\Program Files\Chromium\Application\chrome.exe`, `%LOCALAPPDATA%\Chromium\Application\chrome.exe` |
| `edge` | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, `C:\Program Files\Microsoft\Edge\Application\msedge.exe` |
| `system` | Falls through `chrome` → `chromium` → `edge` |

**Unix paths per channel:** Probes via `which` command (`google-chrome`, `chromium-browser`, `microsoft-edge`, etc.)

Results are cached per channel. Throws `ChromeNotFoundError` if no binary found.

### 2.4 Chrome Launch Args (`buildChromeArgs`)

The arg builder produces flags organized by purpose:

**Debug & isolation:**
- `--remote-debugging-port=<port>` — CDP endpoint
- `--user-data-dir=<sanitized>` — profile isolation (sanitizes non-filesystem-safe chars)

**Headless mode:**
- `--headless=new` — modern headless (default)
- `--headless` — legacy headless
- `--window-position=100,100` — headed mode only
- Windows non-headed: `--window-position=-32000,-32000` — off-screen but not hidden

**Anti-throttle / determinism (NFR-7):**
- `--disable-background-timer-throttling`
- `--disable-backgrounding-occluded-windows`
- `--disable-renderer-backgrounding`
- `--disable-features=VizDisplayCompositor`
- `--no-default-browser-check`, `--no-pings`

**Session hygiene:**
- `--no-first-run`
- `--no-startup-window` (non-headed mode only)
- `--disable-session-crashed-bubble`
- `--disable-restore-last-session`

**Anti-detection:**
- `--disable-blink-features=AutomationControlled`
- `--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."` — standard Chrome user-agent

**GPU:** `--disable-gpu` added in headless modes and when `disableGpu` is true.

---

## 3. Layer 1: ProfileAllocator

**File:** `src/executor/profile-allocator.ts`

### Canonical Layout

```
chrome-profiles/
  <provider-slug>/              # e.g. gemini, chatgpt, claude
    <accountId>/                # sanitized email (owservera → owservera)
      .profile-meta.json        # { providerSlug, accountId, allocatedAt, lastUsed }
      Default/                  # Chrome profile directory
        Network/Cookies         # authentication source of truth
  discovery/
    protocol-probe/             # temporary profiles for protocol discovery
```

### Key Methods

| Method | Purpose |
|---|---|
| `allocate(slug, accountId)` | Create profile directory, write `.profile-meta.json` |
| `getPath(slug, accountId)` | Resolve canonical path |
| `isAuthenticated(profileDir)` | **Source of truth**: check cookie files exist with size > 0 |
| `requiresFirstRun(profileDir)` | `!isAuthenticated()` |
| `isLiveSlave(profileDir)` | Check `SingletonLock` file exists (running Chrome) |
| `list()` | Enumerate all profiles in base dir |
| `clean(olderThanDays)` | Remove profiles unused > N days |
| `plan()` | Build cleanup plan (which profiles are removable) |
| `enforce(plan)` | Apply cleanup plan (remove dups, protect live slaves) |
| `findExisting(slug, accountId)` | Find authenticated profile for adopt (setup wizard) |

### Authentication Detection

`isAuthenticated` checks 4 locations per profile subdirectory:
1. `Cookies` (root level)
2. `Cookies-journal`
3. `Network/Cookies`
4. Subdirectories: `Default`, `Profile 1`–`Profile 4`

Any non-empty cookie file = authenticated. This is the **source of truth** for login state — the DB `loginState` column is derived, not canonical.

### Stray Root Cleanup

Legacy top-level profile dirs (e.g. `./gemini/`, `./chatgpt/`, `./claude/` at repo root) are detected and swept by the cleanup plan. The canonical base is always `chrome-profiles/<provider>/<account>`.

---

## 4. Layer 2: Launcher

**File:** `src/executor/launcher.ts`

### Launch Flow

```
launchChrome(opts)
  → build ChromeInstanceProfile from opts
    → resolveChromeBinary(channel)     # find Chrome.exe
    → clearSingletonLock(userDataDir)  # FR-11: remove stale locks
    → clearSessionRestore(userDataDir) # remove stale tabs/history
    → buildChromeArgs(profile)         # build arg list
    → Bun.spawn([binary, ...args])     # detach + unref
    → waitForPort(debugPort, timeout)  # poll /json/version
    → return { process, binary, debugPort, pid, profileDir }
```

**Critical details:**
- `Bun.spawn` with `detached: true` and `proc.unref()` — Chrome survives parent exit
- `waitForPort` polls `http://127.0.0.1:$port/json/version` every 200ms up to `launchTimeoutMs` (default 15s)
- On timeout: **SIGKILLs** Chrome and throws `ChromeLaunchTimeoutError`
- Singleton lock cleanup removes `SingletonLock`, `SingletonCookie`, `SingletonSocket` before spawn
- Session restore cleanup removes `Preferences`, `Current Session`, `Current Tabs`, `Last Session`, `History`, `History-journal`, and `Sessions/` directory

### Kill Flow

```
killChrome(pid)
  → Windows: taskkill /F /T /PID <pid>   # tree kill
  → Unix: SIGTERM → wait 5s → SIGKILL
```

**Windows behavior (`taskkill /F /T`):**
- `/F` = force-terminate (bypass graceful shutdown)
- `/T` = terminate all child processes in the tree
- Chrome spawns multiple child processes (GPU, renderer, utility); `/T` ensures all are killed
- No waiting — command returns immediately

**Unix behavior:**
- `SIGTERM` sent first (allows graceful shutdown)
- Polls `isChromeRunning(pid)` every 100ms for up to 5 seconds
- If still running after 5s: `SIGKILL` (force kill)
- `isChromeRunning` uses `process.kill(pid, 0)` to check without sending signal

### Port Reuse Logic

Before allocating a new port, the launcher probes if the requested port is already responding:

```typescript
async function isPortInUse(port: number): Promise<boolean> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    })
    return resp.ok
  } catch {
    return false
  }
}
```

If the port is occupied, `freePort(start)` walks upward from `start+1` to find a free port within a 100-port span.

### Singleton Lock Cleanup

`clearSingletonLock(userDataDir)` removes three files that Chrome uses as process locks:
- `SingletonLock` — prevents multiple Chrome instances using same profile
- `SingletonCookie` — cross-process coordination file
- `SingletonSocket` — IPC socket file

These are removed before every spawn to handle crashed Chrome instances that left stale locks.

---

## 5. Layer 3: FleetSupervisor

**File:** `src/executor/fleet-supervisor.ts`

### Purpose

Owns the **instance map** (all running/stopped/crashed slaves) and manages lifecycle transitions. Single source of truth for "what Chrome processes exist."

### State Machine

```
stopped → starting → running → error
  ↑          ↓          ↓
  └──────────┴── killed ←┘
```

Valid states: `starting | running | stopping | stopped | crashed | error`

### Spawn Flow (detailed)

```
spawn(providerSlug, accountId, opts)
  │
  ├─ 1. Dedup: return existing running instance for same (provider, account)
  │
  ├─ 2. Profile resolution:
  │     a. Look up DB for existing ProviderAccount row → get profileDir
  │     b. If none → ProfileAllocator.allocate()
  │
  ├─ 3. Kill existing Chrome holding this profile's SingletonLock
  │     (killExistingChromeForProfile scans Win32 processes for --user-data-dir match)
  │
  ├─ 4. Port selection:
  │     a. Try persisted debugPort from DB (probe if still free via /json/version)
  │     b. Fall back to allocatePort() from range
  │
  ├─ 5. Pre-spawn pressure gate:
  │     readSystemPressure() → reject if CPU or mem > configured threshold
  │
  ├─ 6. Admission control:
  │     FleetLimiter.acquire() → queue if at maxConcurrent
  │
  ├─ 7. Launch with retry:
  │     for attempt = 0..spawnRetryLimit:
  │       launchChrome({ visible, debugPort, profileDir, extraArgs })
  │       Bun.sleep(spawnRetryDelayMs * 2^attempt) on failure (exp backoff)
  │
  ├─ 8. Post-launch navigation:
  │     Connect CDP → Target.createTarget(url)
  │     URL = PROVIDER_URLS[provider] ?? https://<provider>.com
  │
  └─ 9. Log FleetEvent('spawned') to DB
```

### Port Reaper (`src/executor/port-reaper.ts`)

The port reaper is a daemon that cleans up orphan Chrome processes:

- **Boot scan:** At startup, scans port range for Chrome PIDs. Kills any not in the `knownPids` map (fleet-managed instances).
- **Periodic scan:** Runs every 30s by default.
- **Windows detection:** `netstat -ano | findstr :port` to find PIDs listening on a port.
- **Unix detection:** `lsof -t -i:port` to find PIDs holding the port.
- **Kill behavior:** Uses `killChrome(pid)` (tree kill on Windows, SIGTERM→SIGKILL on Unix).

### System Pressure Gate (`src/executor/system-pressure.ts`)

- `cpuPct`: normalizes `os.loadavg()[0]` against logical core count → clamps to [0, 100]
- `memPct`: `(totalmem - freemem) / totalmem` → clamps to [0, 100]
- Default thresholds: 100 (disabled — no rejection)
- Throws `FleetPressureOverloadError` if either threshold exceeded

### Admission Control (`src/executor/fleet-limiter.ts`)

Pattern source: **browserless Limiter**
- `maxConcurrent`: active slave cap (default = port range span)
- `maxQueued`: queue depth (default = `maxConcurrent * 2`)
- `queueTimeoutMs`: reject if no slot within window (default 30s)
- Throws `FleetQueueFullError` (HTTP-429 analog) when queue is full
- Throws `FleetQueueTimeoutError` when slot not freed within timeout

---

## 6. Layer 4: ChromeGovernor

**File:** `src/engines/chrome-governor.ts`

### Purpose

**Public API surface** for all Chrome interaction. Implements the **Governor Canon** (B1): every other engine receives CDP access **only** through the governor's mediated methods.

### Constructor Wiring (from `src/server/index.ts:484`)

```typescript
const governor = new ChromeGovernor(govStore, {
  portRange: [9300, 9400],
  healthProbeIntervalMs: 30_000,
  healthProbeTimeoutMs: 5_000,
  autoRestart: true,
  maxRestarts: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60_000,
  profileBaseDir: workspaceHint,  // from workspace settings
})

// Then wired:
governor.setCdpTransport(cdpTransport)
governor.setTraceLog(govStore)
governor.setHealthMonitor(govStore)
```

### Public API

| Method | Purpose |
|---|---|
| `spawn(providerId, accountId, opts?)` | Deploy a new slave |
| `launch(providerId, opts?)` | Spawn with account='default' |
| `kill(slaveId)` | Kill one slave |
| `killAll()` | Kill all slaves |
| `ensureRunning(slaveId)` | Recover crashed/stopped slave |
| `ensureRunningForAccount(providerId, accountId)` | Find-or-spawn by provider+account |
| `ensureGenericBrowser()` | Find-or-spawn provider-free browser |
| `recoverAuth(providerId, accountId)` | Kill + relaunch visible for manual re-login |
| `getAllSlaves(opts?)` | List slaves (optionally filtered by provider) |
| `getSlave(slaveId)` | Get single slave |
| `getSuperState()` | Aggregate fleet health |
| `enableDomains(slaveId, domains)` | CDP.domain.enable() through governor |
| `evaluate(slaveId, expr)` | Governor-gated Runtime.evaluate |
| `executeCdpMethod(ref, method, params)` | Full CDP send via conversation/provider |
| `executeCapability(ref, slug)` | Execute registered capability |
| `captureScreenshot(slaveId, region?)` | Screenshot via CDP |
| `getAccessibilityTree(slaveId)` | Full AX tree |
| `runHarnessPlan(slaveId, dag)` | Execute multi-step harness DAG |

### CDPProxy (inner class)

- **Per-slave mutexes** (`AsyncMutex`) — serializes CDP commands per slave to prevent race conditions
- **ensureConnected(slaveId)** — lazy CDP connect on first command, sets up watchdog
- **Rebuild on every access** — the CDPProxy is rebuilt from the slave map on each access to handle live DB refreshes (slave state changes, port updates)
- **Harness DAG executor** — topologically-ordered step execution

### Harness Actions Supported

The CDPProxy supports these step types in Harness DAG execution:

| Action | Description |
|--------|-------------|
| `type_text` | Type text into composer (resolves composer type) |
| `submit` | Click send button or press Enter |
| `click` | Click element at selector |
| `wait` | Wait for specified duration |
| `navigate` | Navigate to URL |
| `capture` | Capture network response matching pattern |
| `evaluate` | Execute JavaScript expression |
| `scroll` | Scroll to position or element |
| `hover` | Hover over element |
| `select` | Select dropdown option |
| `press` | Press keyboard key |
| `upload` | Upload files to file input |
| `wait_selector` | Wait for selector to appear |
| `wait_text` | Wait for text to appear |
| `screenshot` | Capture screenshot |
| `assert` | Assert condition |
| `mock_request` | Mock network request |
| `cookie_set` | Set cookie |
| `observe` | Observe page state |
| `tab_open` | Open new tab |
| `tab_close` | Close tab |
| `tab_switch` | Switch to tab |
| `extract_markdown` | Extract page content as markdown |
| `human_gate` | Human-in-the-loop pause |

### Generic Browser

- Provider-free Chrome slave for open-web automation
- Spawned on first use, memoized (`_genericSlaveId`)
- Extra args: `--no-first-run`, `--disable-default-args`
- Cleared on `killAll()`

### Capability Execution (Stage 3)

```
executeCapability(ref, slug)
  → 1. Resolve slave from conversationId or providerId
  → 2. Look up capability in boot snapshot (CapabilitySnapshot)
  → 3. If cap:cdp:* → extract CDP method → executeCdpMethod()
  → 4. If DB-backed → compile recipe → executeSnapshotProgram()
  → 5. Record trace entry
```

---

## 7. Layer 5: CDP Transport

### 7.1 Raw Client (`src/executor/cdp.ts` — BunCdpClient)

WebSocket-based CDP client with:
- Auto-reconnect (exponential backoff, max 3 retries)
- Per-command timeout (default 30s)
- Event subscription (via `on`/`off`)
- Ping keepalive (every 30s)
- Session ID routing
- Full request/response matching via message ID

### 7.2 Transport Adapter (`src/executor/cdp-transport.ts` — CdpTransportImpl)

Bridges `BunCdpClient` → `CDPTransport` interface:

```
connect(slaveId, debugPort)
  → resolveBrowserWsUrl(port)     # GET /json/version → webSocketDebuggerUrl
  → BunCdpClient.connect(wsUrl)
  → resolvePageSession(client):
      Target.getTargets() → find page target
      if none → Target.createTarget('about:blank')
      Target.attachToTarget(flatten: true) → sessionId
  → store { client, sessionId }

send(slaveId, method, params)
  → client.send(method, params, { sessionId })

capture(slaveId, pattern, timeoutMs)
  → Network.enable → listen for Network.responseReceived
  → match URL against pattern → get body via Network.getResponseBody
  → returns { body, url, status, headers, durationMs }

captureStream(slaveId, pattern, timeoutMs)
  → Same as capture but also accumulates chunks for streaming
```

### 7.3 CDP Connection Sequence (detailed)

The full CDP connection sequence for a slave:

```
1. HTTP GET /json/version
   → Chrome returns JSON with webSocketDebuggerUrl
   → URL format: ws://127.0.0.1:<port>/devtools/browser/<UUID>
   → CRITICAL: bare /devtools/browser path is REJECTED by Chrome's WS upgrade handler

2. WebSocket connect to wsUrl
   → BunCdpClient opens WebSocket connection
   → Sets up ping keepalive (30s interval)
   → Configures auto-reconnect (exponential backoff, max 3 retries)

3. Target.getTargets()
   → Lists all browser targets (pages, workers, etc.)
   → Looks for type === 'page'

4. If no page target:
   Target.createTarget({ url: 'about:blank' })
   → Creates new page target

5. Target.attachToTarget({ targetId, flatten: true })
   → Attaches to page target
   → Returns sessionId for routing commands

6. Store { client, sessionId } in clients map
   → All subsequent commands routed through this sessionId
```

**Key:** The transport resolves the browser's exact WebSocket URL (with UUID suffix) from `/json/version` — the bare `/devtools/browser` path is **not** accepted by Chrome's WS upgrade handler.

### 7.4 Network Capture Flow

```
capture(slaveId, pattern, timeoutMs)
  │
  ├─ 1. Network.enable (via sessionId)
  │
  ├─ 2. Register event handlers:
  │     - Network.responseReceived → check URL against pattern
  │     - Network.loadingFinished → get response body
  │     - Network.loadingFailed → handle failure
  │
  ├─ 3. Wait for matching request:
  │     - Match URL against pattern
  │     - Collect requestId
  │
  ├─ 4. On match:
  │     Network.getResponseBody({ requestId }) → body
  │
  └─ 5. Return { body, url, status, headers, durationMs }
```

---

## 8. Layer 6: CDP Watchdog

**File:** `src/engines/cdp-watchdog.ts`

Per-slave watchdog that monitors for:
- **`dialog` events** — auto-dismisses alert/confirm/prompt dialogs (cookie consent, upgrade prompts, etc.)
- **`crash` events** — re-navigates to last known URL via `window.location.href`
- **`timeout`** and **`error`** events — handler extensibility

Set up in `CDPProxy.ensureConnected()` for each slave on first CDP connection.

### Watchdog Setup Flow

```
setupWatchdog(transport, slaveId, getLastUrl)
  │
  ├─ 1. Create CdpWatchdog instance
  │
  ├─ 2. setupDialogWatchdog():
  │     - Enable Page domain via CDP
  │     - Register 'dialog' handler
  │     - Handler: log dialog type, auto-dismiss via Page.handleJavaScriptDialog
  │
  ├─ 3. setupCrashWatchdog():
  │     - Register 'crash' handler
  │     - Handler: log error, re-navigate to lastUrl via window.location.href
  │
  └─ 4. Return watchdog instance
```

### Dialog Types Handled

- `alert` — OK button only
- `confirm` — OK + Cancel buttons
- `prompt` — OK + Cancel + text input
- `beforeunload` — page unload confirmation

All dialogs are auto-dismissed to prevent blocking automation.

---

## 9. Layer 7: Health Monitor & Circuit Breaker

### HealthMonitor

- Runs periodic health probes at `healthProbeIntervalMs` (default 30s)
- Each probe: `Browser.getVersion` via CDP
- On success: reset `consecutiveFailures` to 0, log `HealthTick('running')`
- On failure: increment `consecutiveFailures`, log `HealthTick('error')`, trigger circuit breaker

### Circuit Breaker

**States:** `closed → half_open → open`

| Transition | Condition |
|---|---|
| closed → open | `consecutiveFailures >= circuitBreakerThreshold` (default 5) |
| open → half_open | `Date.now() - openedAt >= circuitBreakerResetMs` (default 60s) |
| half_open → closed | Successful health probe |
| half_open → open | Any failure in half_open state |

**CircuitBreakerState** persists to DB (`CircuitBreakerState` model) so state survives process restart.

### Fleet Super-State (aggregate)

From `src/executor/slave-states.ts`:

| Super-State | Condition |
|---|---|
| `idle` | No instances |
| `active` | Any instance is `running` or `starting` |
| `degraded` | Any instance is `unhealthy`, `restarting`, or `circuit_open` |
| `terminal` | Any instance is `error` or `circuit_open` (highest priority) |

---

## 10. Layer 8: Anti-Detection

**File:** `src/engines/anti-detection.ts`

Injected via `Page.addScriptToEvaluateOnNewDocument` **before** navigating to provider pages. Scripts run before any page JS loads.

**Global scripts (_default):**
```javascript
Object.defineProperty(navigator, 'webdriver', { get: () => false })
delete window.__playwright
delete window.__puppeteer
delete window.__selenium
window.chrome = window.chrome || {}
window.chrome.runtime = window.chrome.runtime || {}
```

**Per-provider overrides:**
- `chatgpt`: Mocks `navigator.plugins` with Chrome PDF plugin array, sets `navigator.languages`
- `gemini`/`claude`: Minimal (Quill/ProseMirror are less aggressive about detection)
- `deepseek`/`qwen`/`grok`: Standard evasion only

### Injection Timing

Anti-detection scripts are injected via `Page.addScriptToEvaluateOnNewDocument` which ensures they execute **before** any page scripts load. This is critical because:
1. Detection scripts check `navigator.webdriver` immediately on page load
2. Framework artifacts (`__playwright`, `__puppeteer`) are set by page scripts
3. `chrome.runtime` must exist before provider JS checks for it

---

## 11. Layer 9: Setup Wizard

**File:** `src/engines/chrome-setup-wizard.ts`

First-time authentication flow for a new (provider, account):

```
runSetup(providerDbId, providerSlug, accountId)
  │
  ├─ 1. needsSetup() → check DB + cookie presence
  │     (DB row alone is NOT sufficient — must verify cookie file)
  │
  ├─ 2. ProfileAllocator.allocate(providerSlug, accountId)
  │
  ├─ 3. Find free debug port (9222–9331)
  │
  ├─ 4. LaunchChrome(visible=true, url=providerLoginUrl)
  │     Uses PROVIDER_URL_PATTERNS from provider-selectors
  │
  ├─ 5. Poll CDP HTTP API every 2s for URL change:
  │     GET /json/list → check page URL
  │     Timeout: 5 minutes
  │
  ├─ 6. On login detected:
  │     Upsert ProviderAccount to DB
  │     loginState='logged_in', profileDir, debugPort
  │     Demote any existing isDefault for this provider
  │
  └─ 7. LEAVE Chrome running for immediate agent use
```

**Login detection:** URL matches provider's logged-in pattern OR URL has moved past login/auth/signin pages.

---

## 12. Layer 10: Fleet Lifecycle Adapter

**File:** `src/engines/harness/fleet-lifecycle-adapter.ts`

Bridge between the harness system and ChromeGovernor. Provides a `SlaveResolver` that the harness uses to resolve `(providerId, accountId) → slaveId`:

```
resolve(providerId, accountId)
  → governor.ensureRunningForAccount(providerId, accountId)
  → if circuit open → governor.recoverAuth(providerId, accountId)
  → return slaveId
```

The adapter keeps the Governor Canon intact: the harness never touches CDP directly. It declares "I need a slave for provider X account Y" and the governor handles all lifecycle management.

---

## 13. Lifecycle State Machine

**Canonical definition:** `src/executor/slave-states.ts`

```
                   stopped
                      │
                      ▼
                  starting
                   │    │
                   ▼    ▼
                running  error
                   │      │
              ┌────┼──────┘
              │    │
              ▼    ▼
          unhealthy restarting
              │      │
              ▼      ▼
            error  circuit_open
              │      │
              └──┬───┘
                 ▼
              stopped (via kill)
```

**Valid transitions** (enforced by `nextState()`):

| From | To |
|---|---|
| `stopped` | `starting` |
| `starting` | `running`, `error` |
| `running` | `unhealthy`, `restarting`, `stopped`, `error` |
| `unhealthy` | `restarting`, `running`, `error`, `stopped` |
| `restarting` | `running`, `unhealthy`, `error`, `circuit_open` |
| `error` | `stopped`, `restarting`, `circuit_open` |
| `circuit_open` | `stopped`, `restarting` |

**Backoff schedule** (`backoffDelay(attempt)`): `1000 * 2^attempt`, capped at 30s.

---

## 14. Profile Layout & Authentication

### Directory Layout

```
<profileBaseDir>/                     # Default: chrome-profiles/ or <dataDir>/chrome-profiles/
  gemini/
    owservera-at-gmail.com/          # Sanitized email (@ → -at-)
      .profile-meta.json             # { providerSlug, accountId, allocatedAt, lastUsed }
      Default/                       # Chrome profile
        Network/Cookies              # Auth source of truth
        Preferences
        Bookmarks
        History
      SingletonLock                  # Present when Chrome is running
  chatgpt/
    owservera-at-gmail.com/
      ...
  claude/
    owservera-at-gmail.com/
      ...
  discovery/
    protocol-probe/                  # Temp profiles (protected from cleanup)
```

### Authentication Truth Chain

1. **Cookie files** in the profile directory are the **sole source of truth** for "is this provider authenticated" (`ProfileAllocator.isAuthenticated`)
2. **DB `ProviderAccount.loginState`** is derived/cached — never trust it alone
3. **SingletonLock** file presence indicates a live Chrome process
4. **Sanitization:** `@` → `-at-` in directory names to avoid Chrome `--user-data-dir` issues

### Account Slug Convention

| Raw email | Sanitized dir name |
|---|---|
| `owservera@gmail.com` | `owservera-at-gmail.com` |
| `user@company.com` | `user-at-company.com` |

---

## 15. Error Recovery & Circuit Breaker

### Crash Recovery Flow

```
1. HealthMonitor probes fail (Browser.getVersion throws)
2. consecutiveFailures++
3. If consecutiveFailures >= circuitBreakerThreshold → circuit opens
4. EventBus emits 'fleet:crash_detected'
5. On next ensureRunning():
   a. If circuit open → ensureRunning throws CircuitOpenError
   b. If circuit half_open → spawn(provider, account)
   c. If autoRestart enabled → spawn retries
   d. If maxRestarts exceeded → CircuitOpenError
```

### Restart Behavior

- `ensureRunning()` on `crashed`/`error` slave → relaunch if `consecutiveFailures < maxRestarts`
- `ensureRunning()` on `stopped` slave → always relaunch
- `recoverAuth()` → kill + visible relaunch for manual re-login

### Spawn Retry (puppeteer-cluster pattern)

- `spawnRetryLimit`: 0 (no retry by default)
- `spawnRetryDelayMs`: 1000ms base
- Exponential backoff: `delay * 2^attempt`
- Each retry logs `FleetEvent('spawn_retry')`
- Final failure logs `FleetEvent('spawn_failed')`

---

## 16. Common Failure Modes

### 16.1 Chrome Binary Not Found
- `ChromeNotFoundError` thrown by `resolveChromeBinary`
- Check: Is Chrome installed at standard paths? Is `CHROME_PATH` set correctly?

### 16.2 Launch Timeout
- `ChromeLaunchTimeoutError` thrown by `launchProfile`
- Causes: slow disk, anti-virus scanning, stale SingletonLock from crashed Chrome
- Fix: `ProfileAllocator` kills existing Chrome for same profile before spawn
- Singletons are cleared by `clearSingletonLock()`

### 16.3 Port Occupied
- `PortOccupiedError` from `FleetSupervisor.allocatePort()`
- Port range exhausted (default 9222–9250 for standalone, 9300–9400 in server)
- Fix: `PortReaper` reaps orphans at boot; increase range if needed

### 16.4 Profile Already in Use
- Chrome cannot start if another Chrome process holds the same `--user-data-dir`
- Fix: `killExistingChromeForProfile()` scans running processes and kills any matching

### 16.5 CDP Connection Failure
- `CdpConnectionError` from `BunCdpClient`
- Causes: Chrome crashed after spawn, port taken by another process
- Fix: Watchdog reconnects; health probe detects and triggers circuit breaker

### 16.6 Circuit Breaker Open
- `CircuitOpenError` thrown by `ensureRunning()`
- All operations rejected until `circuitBreakerResetMs` elapses (default 60s)
- Fix: Wait for half_open transition, then successful probe auto-closes

### 16.7 Fleet Queue Full / Timeout
- `FleetQueueFullError`: too many concurrent spawn requests
- `FleetQueueTimeoutError`: slot not freed within 30s
- Fix: Tune `maxConcurrent` / `maxQueued` / `queueTimeoutMs` in config

### 16.8 System Overload
- `FleetPressureOverloadError`: CPU or memory exceeds threshold
- Default thresholds are 100 (disabled)
- Fix: Reduce concurrent load or increase thresholds

### 16.9 PowerShell Object Pipeline Read Bug
- `Invoke-RestMethod | Select-Object ... | Out-File` silently produces empty output
- Always use a Bun script (`.runtime/*.ts`) to read API/JSON data, never PowerShell pipelines

---

## 17. Key Configuration

### Server Bootstrap Config (from `src/server/index.ts:484`)

```typescript
const governor = new ChromeGovernor(govStore, {
  portRange: [9300, 9400],              // Wider port range for server mode
  healthProbeIntervalMs: 30_000,         // Probe every 30s
  healthProbeTimeoutMs: 5_000,          // Each probe times out at 5s
  autoRestart: true,                    // Auto-restart crashed slaves
  maxRestarts: 3,                       // Max restart attempts
  circuitBreakerThreshold: 5,           // 5 failures → circuit opens
  circuitBreakerResetMs: 60_000,        // Reset after 60s
  profileBaseDir: workspaceHint,        // From workspace settings or 'chrome-profiles'
})
```

### Standalone FleetSupervisor Defaults

```typescript
{
  portRange: [9222, 9332],
  healthProbeIntervalMs: 30_000,
  healthProbeTimeoutMs: 5_000,
  autoRestart: true,
  maxRestarts: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60_000,
  chromeProfileBase: 'chrome-profiles',
  maxConcurrent: portRangeSpan,         // 111 by default
  maxQueued: portRangeSpan * 2,         // 222 by default
  queueTimeoutMs: 30_000,
  cpuOverloadPct: 100,                  // disabled
  memOverloadPct: 100,                  // disabled
  spawnRetryLimit: 0,                   // disabled
  spawnRetryDelayMs: 1_000,
}
```

---

## 18. DB Models & Data Layer

### GovernorStore Contract (`src/storage/contracts/governor-store.ts`)

The GovernorStore defines 6 data models and 10 methods:

#### Row Types

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ProviderAccountRow` | Provider account configuration | `providerId`, `accountSlug`, `profileDir`, `debugPort`, `isActive` |
| `FleetEventRow` | Lifecycle event audit trail | `slaveId`, `providerId`, `eventType`, `detailJson`, `ts` |
| `CircuitBreakerStateRow` | Circuit breaker persistence | `slaveId`, `state`, `failureCount`, `openedAt` |
| `HealthTickRow` | Health probe results | `slaveId`, `providerId`, `status`, `responseMs`, `error` |
| `TraceEntryRow` | CDP command audit trail | `slaveId`, `conversationId`, `method`, `paramsJson`, `resultJson`, `durationMs` |
| `HarnessCommandRow` | Harness command registry | `commandId`, `version`, `kind`, `paramsSchemaJson`, `adaptorRef` |

#### Methods

| Method | Purpose |
|--------|---------|
| `getAccount(accountId)` | Get provider account by ID |
| `getAccountsByProvider(providerId)` | List all accounts for a provider |
| `upsertAccount(account)` | Create or update account |
| `deleteAccount(accountId)` | Delete account |
| `createFleetEvent(event)` | Log lifecycle event |
| `getFleetEvents(slaveId, limit?)` | Get event history for slave |
| `getCircuitState(slaveId)` | Get circuit breaker state |
| `upsertCircuitState(state)` | Update circuit breaker state |
| `createHealthTick(tick)` | Log health probe result |
| `createTraceEntry(entry)` | Log CDP command trace |
| `getTrace(slaveId, limit?)` | Get trace history for slave |
| `getProviderFleetConfig(providerSlug)` | Get provider fleet configuration |
| `getHarnessCommand(commandId, version)` | Get harness command definition |
| `listHarnessCommands(commandId)` | List all versions of a command |
| `upsertHarnessCommand(cmd)` | Create or update harness command |

### Event Types

Common `eventType` values in `FleetEventRow`:

| Event Type | When |
|------------|------|
| `spawned` | Slave successfully launched |
| `killed` | Slave explicitly killed |
| `crashed` | Slave process crashed |
| `recovered` | Slave recovered from crash |
| `spawn_retry` | Spawn retry attempted |
| `spawn_failed` | All spawn retries exhausted |
| `circuit_open` | Circuit breaker opened |
| `circuit_closed` | Circuit breaker closed |

---

## 19. Harness DAG Execution

### Recipe Compilation (`src/engines/harness/recipe-compiler.ts`)

A `Recipe` (stored in DB as `CapabilityProgramRow.configJson`) is compiled to a `HarnessDAG` that the governor executes:

```
Recipe { steps: RecipeStep[], branches?: RecipeBranch[] }
  │
  ├─ Linear steps → HarnessNode[] (chained with edges)
  │   Each step maps to a HarnessNode with:
  │   - type: 'action' | 'branch' | 'parallel'
  │   - action: step kind (type_text, submit, click, etc.)
  │   - outputKey: unique identifier for step output
  │   - selector: DOM selector (if applicable)
  │   - params: step-specific parameters
  │
  ├─ Branches → conditional HarnessNode[] gated by when conditions
  │   Each branch node has:
  │   - condition: { outputKey, equals?, truthy? }
  │   - edges: sequential within branch
  │
  └─ Result: HarnessDAG { nodes: HarnessNode[], edges: HarnessEdge[] }
```

### Recipe Step Types

| Step Kind | Description |
|-----------|-------------|
| `type_text` | Type text into composer |
| `submit` | Click send button or press Enter |
| `click` | Click element |
| `wait` | Wait for duration |
| `navigate` | Navigate to URL |
| `capture` | Capture network response |
| `evaluate` | Execute JavaScript |
| `scroll` | Scroll to position |
| `hover` | Hover over element |
| `select` | Select dropdown option |
| `press` | Press keyboard key |
| `tab_open` | Open new tab |
| `tab_close` | Close tab |
| `tab_switch` | Switch to tab |
| `observe` | Observe page state |
| `upload` | Upload files |
| `extract_markdown` | Extract page content |
| `wait_selector` | Wait for selector |
| `wait_text` | Wait for text |
| `screenshot` | Capture screenshot |
| `assert` | Assert condition |
| `mock_request` | Mock network request |
| `cookie_set` | Set cookie |
| `branch_if` | Conditional branch |
| `loop_while` | Loop while condition |
| `parallel` | Parallel execution |
| `human_gate` | Human-in-the-loop pause |

### DAG Execution Flow

```
executeHarnessPlan(slaveId, dag)
  │
  ├─ 1. Topological sort of nodes (respecting edges)
  │
  ├─ 2. Execute nodes in order:
  │     for node in sortedNodes:
  │       a. Check condition (if branch node)
  │       b. Resolve selector (fallback list from provider-selectors)
  │       c. Execute action via CDP:
  │          - type_text → composer-typing.typeMessage()
  │          - submit → composer-typing.submitMessage()
  │          - click → humanized-interaction.humanizedClick()
  │          - etc.
  │       d. Store output in result map (keyed by outputKey)
  │
  ├─ 3. Capture results:
  │     - Network captures → parse via StreamParserEngine
  │     - Screenshots → return base64
  │     - Evaluations → return values
  │
  └─ 4. Return HarnessExecutionResult
```

---

## 20. Composer Typing Strategies

**File:** `src/engines/composer-typing.ts`

Different providers use different input frameworks. The typing strategy must match the composer type:

### Composer Types

| Type | Selector Examples | Strategy |
|------|-------------------|----------|
| `textarea` | `textarea`, `#prompt-textarea` | Native `HTMLTextAreaElement.value` setter + input/change events |
| `contenteditable` | `[contenteditable="true"]`, `div[contenteditable]` | `document.execCommand('insertText')` for React/ProseMirror compatibility |
| `quill` | `.ql-editor`, `[contenteditable="true"]` with Quill | `quill.setContents([]); quill.insertText(0, text)` via `__quill` property |
| `codemirror` | `.CodeMirror`, `.cm-editor` | `cm.setValue(text)` via CodeMirror instance |

### Strategy Details

**textarea (ChatGPT):**
```javascript
const el = document.querySelector(selector);
el.focus();
const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
setter.call(el, text);
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
```
Uses native property descriptor to bypass React's controlled input protection.

**contenteditable (Claude):**
```javascript
const el = document.querySelector(selector);
el.focus();
el.textContent = '';
document.execCommand('insertText', false, text);
```
Uses `execCommand` which fires proper input events for ProseMirror/React contenteditable.

**quill (Gemini):**
```javascript
const el = document.querySelector(selector);
const quill = el.__quill || el.closest('.ql-container')?.__quill;
if (quill) {
  quill.setContents([]);
  quill.insertText(0, text);
} else {
  // Fallback to contenteditable
  el.focus();
  el.textContent = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
```
Accesses Quill instance via `__quill` property on the editor element.

**codemirror:**
```javascript
const el = document.querySelector(selector);
const cm = el.closest('.CodeMirror')?.CodeMirror;
if (cm) {
  cm.setValue(text);
} else {
  // Fallback to textarea
  el.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
```
Accesses CodeMirror instance via `.CodeMirror` property on wrapper element.

### Submit Strategy

`submitMessage(transport, slaveId, sendSelector?, key?)`:
1. If `sendSelector` provided → find element position → `humanizedClick()` on send button
2. If position can't be determined → fallback to `element.click()`
3. If no selector → dispatch Enter key event via `Input.dispatchKeyEvent`

---

## 21. Humanized Interactions

**File:** `src/engines/humanized-interaction.ts`

Reduces bot detection by making mouse movements and clicks appear human-like.

### Bézier Mouse Movement

Instead of linear jumps, mouse moves along a cubic Bézier curve:

```
cubicBezier(t, p0, p1, p2, p3) = (1-t)³·p0 + 3·(1-t)²·t·p1 + 3·(1-t)·t²·p2 + t³·p3
```

- **Control points:** Randomly offset ±20px from linear path
- **Steps:** 15-25 steps (random)
- **Timing:** 8ms between steps with ±10ms jitter

### Click Sequence

```
humanizedClick(transport, slaveId, x, y, fromX?, fromY?)
  │
  ├─ 1. Start position: random viewport position if not provided
  │     startX = random(200, 1000)
  │     startY = random(100, 500)
  │
  ├─ 2. Move to target via Bézier curve
  │
  ├─ 3. Wait 50-150ms (random)
  │
  ├─ 4. mousePressed (left button, clickCount=1)
  │
  ├─ 5. Wait 10-40ms (random)
  │
  └─ 6. mouseReleased (left button, clickCount=1)
```

### Viewport Jitter

`jitterViewport(transport, slaveId)`:
- Applies random ±15px offset to viewport dimensions
- Defeats fingerprinting based on exact viewport size
- Apply once per page load, not per interaction

---

## 22. Provider Selectors & Fallbacks

**File:** `src/engines/provider-selectors.ts`

### Provider URLs

| Provider | URL |
|----------|-----|
| `gemini` | `https://gemini.google.com/app` |
| `chatgpt` | `https://chatgpt.com` |
| `claude` | `https://claude.ai` |
| Other | `https://{providerId}.com` |

All URLs are loaded from DB via `ProviderRegistry` at boot. Hardcoded values are fallbacks.

### Selector Fallback Lists

Each provider has fallback selector lists loaded from DB:

```typescript
getComposerSelectors(providerId): string[]
// Returns: ['textarea', '[contenteditable="true"]', '[role="textbox"]']

getSendButtonSelectors(providerId): string[]
// Returns: ['button[type="submit"]']
```

### Selector Resolution Flow

```
findWorkingSelector(cdpSend, selectors)
  for selector in selectors:
    result = cdpSend('Runtime.evaluate', {
      expression: `!!document.querySelector(${JSON.stringify(selector)})`
    })
    if result === true → return selector
  return null
```

### Heuristic Detection

When all known selectors fail, `findComposerHeuristic()` probes for any input-like element:
1. `textarea` → return 'textarea'
2. `[contenteditable="true"]` → return selector with id/class
3. `[role="textbox"]` → return '[role="textbox"]'

### Wait for Selector

`waitForSelector(cdpSend, selectors, timeoutMs)`:
- Polls every 200ms until deadline
- Returns first matching selector
- Returns null if timeout reached

---

## 23. Capability Snapshot

**File:** `src/engines/capability-snapshot.ts`

### Boot-Time Loading

```
CapabilitySnapshot.load(registeredProviderIds)
  │
  ├─ 1. Query DB for active bindings:
  │     CapabilityStore.loadSnapshot(registeredProviderIds)
  │     → Returns SnapshotRow[] with slug, providerId, programId, globalId
  │
  ├─ 2. Build in-memory maps:
  │     bySlugProvider: `${slug}@${providerId}` → entry
  │     byIdProvider: `${globalId}@${providerId}` → entry
  │     bySlugAny: `${slug}` → entry (first writer wins)
  │
  ├─ 3. Mark executable:
  │     entry.executable = (programId != null)
  │
  └─ 4. Return count of loaded entries
```

### Resolution

```
getBySlug(slug, providerId?)
  → First: try bySlugProvider[`${slug}@${providerId}`]
  → Fallback: try bySlugAny[`${slug}`]
  → Return null if not found

getById(globalId, providerId?)
  → Try byIdProvider[`${globalId}@${providerId}`]
  → Return null (globalId without provider scope is ambiguous)
```

### Hot Reload

`refresh(registeredProviderIds)` re-reads from DB and replaces the entire in-memory map. Called after seeding a new provider so ChromeGovernor picks it up without restart.

---

## 24. Server Shutdown Sequence

**File:** `src/server/index.ts`

### Graceful Shutdown Flow

```
SIGTERM / SIGINT received
  │
  ├─ 1. Set isShuttingDown = true
  │     → New requests get 503 "Server shutting down"
  │
  ├─ 2. Execute shutdown hooks in order:
  │     for hook in shutdownHooks:
  │       try:
  │         await hook()
  │       catch:
  │         log.error('Shutdown hook error')
  │
  ├─ 3. Hooks registered during bootstrap:
  │     onShutdown(async () => {
  │       await cdpTransport.disconnectAll()  // Close all CDP WebSocket connections
  │       await governor.killAll()            // Kill all Chrome processes
  │     })
  │
  ├─ 4. Log "Shutdown complete."
  │
  └─ 5. process.exit(0)
```

### Hook Registration

```typescript
// In createServerWithEngines():
onShutdown(async () => {
  await cdpTransport.disconnectAll()  // Close all CDP WebSocket connections
  await governor.killAll()            // Kill all Chrome processes
})

// In kernel bootstrap:
// Kernel shutdown hook registered separately
```

### Request Rejection During Shutdown

```typescript
if (isShuttingDown) {
  return json({ error: 'Server shutting down', code: 'ShuttingDown' }, 503)
}
```

---

## 25. Troubleshooting Checklist

When Chrome slaves fail to launch:

1. **Check Chrome binary** — `bun run devops runtime-test health` shows fleet status
2. **Check profile dirs** — verify `chrome-profiles/<provider>/<account>/` exists with `.profile-meta.json`
3. **Check cookie files** — `isAuthenticated()` needs non-empty cookie files
4. **Check port conflicts** — use `netstat -ano | findstr :9222` to see what's listening
5. **Check SingletonLock** — stale `SingletonLock` files prevent Chrome launch; cleared on each spawn
6. **Check DB** — `ProviderAccount` row should have `loginState='logged_in'`, `profileDir`, and `debugPort`
7. **Check circuit breaker** — `CircuitBreakerState` in DB may show `state='open'`
8. **Check fleet events** — `FleetEvent` rows in DB show spawn/kill/failure history
9. **Check system load** — high CPU/mem can trigger pre-spawn pressure gate
10. **Check setup wizard** — if first-time auth, run `ChromeSetupWizard.runSetup()` with `visible: true`
11. **Check port range** — in server mode, range is `9300–9400` (not the standalone `9222–9332`)
12. **Check workspace hint** — `profileBaseDir` from workspace settings may point to wrong location

### Quick Debug Commands

```powershell
# List all profiles
ls chrome-profiles/*/*/

# View profile meta
Get-Content chrome-profiles/gemini/owservera-at-gmail.com/.profile-meta.json

# Check if Chrome is listening on debug port
curl http://127.0.0.1:9300/json/version 2>$null

# View fleet events (via API)
bun run .runtime/fleet-events.ts

# Reap orphaned Chrome processes
bun run devops runtime-test preflight
```
