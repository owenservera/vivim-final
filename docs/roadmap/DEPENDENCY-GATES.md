# VIVIM Dependency Mapping System

**Status:** BASELINE — ready for gate verification
**Date:** 2026-07-10
**Purpose:** Hard dependency gates — no node proceeds until its gate passes

---

## System Design

### What This Is
A **dependency graph with hard gates**. Each node (capability) has:
- **Inputs** — what it needs from other nodes
- **Outputs** — what it provides to other nodes
- **Gate** — specific, testable conditions that MUST pass before proceeding
- **Verify** — command to check the gate

### How Gates Work
1. Build the node's code
2. Run the verify command
3. If ALL gate criteria pass → node is `[✓]`
4. If ANY gate fails → node is `[✗]` — fix before proceeding
5. Dependent nodes CANNOT start until their dependency gates pass

### Status Markers
| Marker | Meaning |
|--------|---------|
| `[✓]` | Gate PASSED — all criteria verified |
| `[~]` | Gate PARTIAL — some criteria pass, some fail |
| `[✗]` | Gate FAILED — blocking |
| `[ ]` | Gate NOT CHECKED — not yet built |
| `[!]` | Gate BLOCKED — dependency gate hasn't passed |

---

## Dependency Graph

```
GATE 0: Storage Layer              [✓] PASS
    │
    ├── Gate 1a: CDP Client        [ ] ← CRITICAL PATH START
    │       │
    │       ├── Gate 2a: Chrome Launcher
    │       │       │
    │       │       ├── Gate 3a: Profile Allocator
    │       │       │       │
    │       │       │       └── Gate 4: Chrome Process Mgmt
    │       │       │               │
    │       │       └── Gate 3b: Port Reaper
    │       │               │
    │       └── Gate 2b: Fleet Supervisor
    │               │
    ├── Gate 1b: Engine Wiring     [ ] ← depends on Gate 1a
    │       │
    │       └── Gate 5: Conversation Pipeline  [ ] ← depends on Gate 1a, 1b
    │               │
    │               ├── Gate 6: API Layer       [ ] ← depends on Gate 5
    │               │       │
    │               │       └── Gate 7: CLI (real)  [ ] ← depends on Gate 6
    │               │
    │               └── Gate 8: Frontend         [ ] ← depends on Gate 6
    │
    └── Gate 9: Integration Tests  [ ] ← depends on all above
```

---

## Gate Definitions

### GATE 0: Storage Layer — `[✓] PASS**

**Why:** All stores have real Prisma implementations. ConversationStore, GovernorStore, HealthStore, StreamBlockStore all work.

**Gate Criteria:**
- [x] `bun test tests/unit/stores/` passes
- [x] All store contracts implemented
- [x] Prisma schema has all required tables

**Verify:** `bun test tests/unit/stores/`
**Status:** PASS — no action needed

---

### GATE 1a: CDP Client — `[ ] NOT CHECKED`

**Why:** The WebSocket CDP client is the foundation. Without it, nothing communicates with Chrome.

**Inputs (needs):**
- WebSocket library (Bun has built-in WebSocket)
- CDP protocol knowledge (method names, params, results)

**Outputs (provides):**
- `CDPTransport` implementation (implements chrome-governor.ts:116)
- `connect(wsUrl)` → connected client
- `send(method, params)` → CDP response
- `capture(pattern, timeout)` → intercepted HTTP response
- `getPageState()` → {url, title, readyState}
- `captureScreenshot()` → base64 image

**Gate Criteria:**
- [ ] `src/executor/cdp.ts` ≥ 200 lines (not stub)
- [ ] `BunCdpClient.connect(wsUrl)` connects to Chrome
- [ ] `BunCdpClient.send('Browser.getVersion')` returns Chrome version
- [ ] `BunCdpClient.send('Runtime.evaluate', {expression})` executes JS
- [ ] Auto-reconnect works (kill WS, client reconnects within 10s)
- [ ] Per-command timeout works (command that hangs → timeout error)
- [ ] Session management works (Target.attachToTarget)
- [ ] `bun test tests/unit/executor/cdp.test.ts` passes
- [ ] No `// v1 stub` or `// stub` comments in implementation

**Verify:** `bun run typecheck && bun test tests/unit/executor/cdp.test.ts`

**Source of truth (vivim-final):** `src/executor/cdp.ts` (already implemented — cap-store is prior art)

**Interview Questions:**
1. Should we port the 542-line cap-store CDP client verbatim, or refactor to match our interface signatures?
2. Do we need all reconnect logic for MVP, or can we start with connect-only and add reconnect later?
3. Should we add CDP tracing (logging all commands) from day one?

---

### GATE 2a: Chrome Launcher — `[ ] NOT CHECKED`

**Why:** Must launch Chrome with correct flags for CDP access.

**Inputs (needs):**
- Gate 1a (CDP Client) — to connect after launch
- Chrome binary path detection
- Port allocation logic

**Outputs (provides):**
- `launchChrome(opts)` → {pid, debugPort, userDataDir}
- `isChromeRunning(pid)` → boolean
- `terminateChrome(pid)` → void
- `detectChromePath()` → string
- `findAvailablePort()` → number

**Gate Criteria:**
- [ ] `src/executor/launcher.ts` ≥ 150 lines (not stub)
- [ ] `detectChromePath()` finds Chrome on Windows/Mac/Linux
- [ ] `launchChrome({profileName})` spawns Chrome process
- [ ] Chrome launches with `--remote-debugging-port=XXXX`
- [ ] Chrome launches with `--user-data-dir=<profile-dir>`
- [ ] `isChromeRunning(pid)` returns true for live process
- [ ] `terminateChrome(pid)` kills the process
- [ ] `findAvailablePort()` returns unused port in range
- [ ] `bun test tests/unit/executor/launcher.test.ts` passes

**Verify:** `bun run typecheck && bun test tests/unit/executor/launcher.test.ts`

**Source of truth (vivim-final):** `src/executor/launcher.ts` (already implemented — cap-store is prior art)

**Interview Questions:**
1. Do we support headless mode for testing, or always visible Chrome?
2. Should we auto-detect Chrome path or require config?
3. What's the default port range? (cap-store uses 9220-9250)

---

### GATE 3a: Profile Allocator — `[ ] NOT CHECKED`

**Why:** Each provider+account needs an isolated Chrome profile directory.

**Inputs (needs):**
- Gate 2a (Chrome Launcher) — to create profile dirs
- File system access (mkdir, existsSync)

**Outputs (provides):**
- `allocateProfile(providerId, accountId)` → profilePath
- `getProfile(providerId, accountId)` → profilePath | null
- `deleteProfile(providerId, accountId)` → void
- `listProfiles()` → profilePath[]

**Gate Criteria:**
- [ ] `src/executor/profile-allocator.ts` ≥ 80 lines
- [ ] `allocateProfile('claude', 'user@gmail.com')` creates `data/chrome-profiles/claude/user_gmail_com/`
- [ ] Same call twice returns same path (idempotent)
- [ ] `getProfile()` returns path if exists, null if not
- [ ] `deleteProfile()` removes directory
- [ ] Directory names are filesystem-safe (no special chars)
- [ ] `bun test tests/unit/executor/profile-allocator.test.ts` passes

**Verify:** `bun run typecheck && bun test tests/unit/executor/profile-allocator.test.ts`

**Source of truth (vivim-final):** `src/executor/profile-allocator.ts` (already implemented — cap-store is prior art)

---

### GATE 3b: Port Reaper — `[ ] NOT CHECKED`

**Why:** Kill orphaned Chrome processes from previous runs on startup.

**Inputs (needs):**
- Gate 2a (Chrome Launcher) — to check/kill processes

**Outputs (provides):**
- `reapOrphans(portRange)` → killedCount
- `isPortInUse(port)` → boolean

**Gate Criteria:**
- [ ] `src/executor/port-reaper.ts` ≥ 80 lines
- [ ] `reapOrphans([9220, 9250])` kills processes on those ports
- [ ] `isPortInUse(9222)` returns true if Chrome is on that port
- [ ] Doesn't kill non-Chrome processes
- [ ] `bun test tests/unit/executor/port-reaper.test.ts` passes

**Verify:** `bun run typecheck && bun test tests/unit/executor/port-reaper.test.ts`

**Source of truth (vivim-final):** `src/executor/port-reaper.ts` (already implemented — cap-store is prior art)

---

### GATE 2b: Fleet Supervisor — `[ ] NOT CHECKED`

**Why:** Manages Chrome fleet lifecycle — spawn, health check, restart, circuit breaker.

**Inputs (needs):**
- Gate 1a (CDP Client)
- Gate 2a (Chrome Launcher)
- Gate 3a (Profile Allocator)
- Gate 3b (Port Reaper)
- GovernorStore (Gate 0)

**Outputs (provides):**
- `spawnSlave(providerId, accountId)` → SlaveState
- `killSlave(slaveId)` → void
- `probeHealth(slaveId)` → HealthResult
- `getAllSlaves()` → SlaveState[]
- Circuit breaker integration

**Gate Criteria:**
- [ ] `src/executor/fleet-supervisor.ts` ≥ 300 lines
- [ ] `spawnSlave('claude', 'user@gmail.com')` launches Chrome + connects CDP
- [ ] `probeHealth(slaveId)` returns {alive: true, latencyMs: <1000}
- [ ] Health probe runs periodically (configurable interval)
- [ ] Crash detection: kill Chrome → status changes to 'error'
- [ ] Auto-restart: crashed slave restarts within 30s
- [ ] Circuit breaker: 3 failures → circuit opens → no more probes
- [ ] `bun test tests/unit/executor/fleet-supervisor.test.ts` passes

**Verify:** `bun run typecheck && bun test tests/unit/executor/fleet-supervisor.test.ts`

**Source of truth (vivim-final):** `src/executor/fleet-supervisor.ts` (already implemented — cap-store is prior art)

---

### GATE 4: Chrome Process Management — `[ ] NOT CHECKED`

**Why:** Integrates Fleet Supervisor into ChromeGovernor.

**Inputs (needs):**
- Gate 2b (Fleet Supervisor)
- ChromeGovernor existing structure

**Outputs (provides):**
- `ChromeGovernor.spawn()` — REAL Chrome launch
- `ChromeGovernor.kill()` — REAL process kill
- `ChromeGovernor.ensureRunning()` — REAL health check + restart
- `ChromeGovernor.reapOrphanedPorts()` — REAL orphan cleanup
- `ChromeGovernor.seedAccounts()` — REAL account seeding

**Gate Criteria:**
- [ ] `ChromeGovernor.spawn('claude', 'user@gmail.com')` returns slave with status='running'
- [ ] `ChromeGovernor.kill(slaveId)` terminates Chrome process
- [ ] `ChromeGovernor.ensureRunning(slaveId)` returns running slave
- [ ] `ChromeGovernor.reapOrphanedPorts()` kills orphaned processes
- [ ] `ChromeGovernor.cdp.send(slaveId, 'Browser.getVersion')` returns version
- [ ] `ChromeGovernor.cdp.capture(slaveId, /pattern/, 5000)` captures response
- [ ] `ChromeGovernor.cdp.getPageState(slaveId)` returns {url, title, readyState}
- [ ] `ChromeGovernor.cdp.captureScreenshot(slaveId)` returns base64
- [ ] Health probe runs and updates circuit breaker state
- [ ] `bun test tests/unit/engines/chrome-governor.test.ts` passes (updated)

**Verify:** `bun run typecheck && bun test tests/unit/engines/chrome-governor.test.ts`

**Note:** This gate upgrades ChromeGovernor from stub to real. Existing tests may need updating.

---

### GATE 1b: Engine Wiring — `[ ] NOT CHECKED`

**Why:** Bootstrap sequence that creates all engines and injects dependencies.

**Inputs (needs):**
- Gate 0 (Storage)
- Gate 4 (Chrome Process Mgmt)
- All engine constructors

**Outputs (provides):**
- `bootstrap()` → wired engine instances
- `createGovernor()` → ChromeGovernor with real CDP
- `createConversationManager()` → wired ConversationManager
- `createServer()` → working HTTP server

**Gate Criteria:**
- [ ] `src/bootstrap.ts` exists (or bootstrap in server/index.ts)
- [ ] `bootstrap()` creates all stores from Prisma
- [ ] `bootstrap()` creates ChromeGovernor with real CDP transport
- [ ] `bootstrap()` creates ConversationManager with real Governor
- [ ] `bootstrap()` creates CapabilityResolutionEngine with real store
- [ ] `bootstrap()` creates StreamParserEngine
- [ ] `bootstrap()` creates StreamBlockStore
- [ ] No circular dependencies
- [ ] All engines have real (not stub) dependencies injected
- [ ] `bun test tests/unit/bootstrap.test.ts` passes

**Verify:** `bun run typecheck && bun test tests/unit/bootstrap.test.ts`

**Source of truth (vivim-final):** `src/executor/index.ts` — wiring pattern (cap-store is prior art)

---

### GATE 5: Conversation Pipeline — `[ ] NOT CHECKED`

**Why:** The 8-step send pipeline must work end-to-end.

**Inputs (needs):**
- Gate 1a (CDP Client) — for send/capture
- Gate 4 (Chrome Process Mgmt) — for slave management
- Gate 1b (Engine Wiring) — for dependency injection
- StreamParserEngine (real)
- ConversationStore (real)

**Outputs (provides):**
- `ConversationManager.send(convId, message)` → SendResult
- Real CDP send (type text + submit)
- Real CDP capture (intercept API response)
- Real parse (SSE → ContentBlocks)
- Real store (persist to DB)

**Gate Criteria:**
- [ ] `send(convId, 'Hello')` types message in Chrome
- [ ] `send(convId, 'Hello')` submits message
- [ ] `send(convId, 'Hello')` captures streaming response
- [ ] `send(convId, 'Hello')` parses response into ContentBlocks
- [ ] `send(convId, 'Hello')` stores message in DB
- [ ] `send(convId, 'Hello')` returns {ok: true, blocks: [...], text: '...'}
- [ ] Response latency < 30s for simple message
- [ ] Error handling: provider down → graceful error message
- [ ] `bun test tests/unit/engines/conversation-manager.test.ts` passes (updated)

**Verify:** `bun run typecheck && bun test tests/unit/engines/conversation-manager.test.ts`

---

### GATE 6: API Layer — `[ ] NOT CHECKED`

**Why:** REST endpoints that the frontend will call.

**Inputs (needs):**
- Gate 5 (Conversation Pipeline)
- Gate 4 (Chrome Process Mgmt)

**Outputs (provides):**
- `POST /api/conversations/:id/send` → streaming response
- `GET /api/fleet/status` → slave statuses
- `GET /api/providers` → provider list
- `GET /api/conversations` → conversation list
- WebSocket streaming for response chunks

**Gate Criteria:**
- [ ] `POST /api/conversations/:id/send` with body {message} returns streaming response
- [ ] `GET /api/fleet/status` returns real slave statuses
- [ ] `GET /api/providers` returns provider list from DB
- [ ] `GET /api/conversations` returns conversation list from DB
- [ ] `GET /api/conversations/:id/messages` returns messages from DB
- [ ] WebSocket `/ws` streams response chunks in real-time
- [ ] Auth gate works (Bearer token required)
- [ ] Error responses have proper format {error, code, status}
- [ ] CORS works for frontend
- [ ] `bun test tests/unit/server/` passes

**Verify:** `bun run typecheck && bun test tests/unit/server/`

---

### GATE 7: CLI (Real) — `[ ] NOT CHECKED`

**Why:** CLI commands that actually do something.

**Inputs (needs):**
- Gate 6 (API Layer)
- Gate 4 (Chrome Process Mgmt)

**Outputs (provides):**
- `bun run cli chrome launch --provider claude` → launches Chrome
- `bun run cli chrome status` → shows slave statuses
- `bun run cli chrome kill --slave <id>` → kills Chrome
- `bun run cli chat send --conv <id> --message "hello"` → sends message
- `bun run cli providers list` → shows providers

**Gate Criteria:**
- [ ] `bun run cli chrome launch --provider claude` launches Chrome
- [ ] `bun run cli chrome status` shows running slaves
- [ ] `bun run cli chrome kill --slave <id>` kills Chrome
- [ ] `bun run cli chat send --conv <id> --message "hello"` sends and prints response
- [ ] `bun run cli providers list` shows providers
- [ ] `bun run cli conversations list` shows conversations
- [ ] All commands have proper error handling
- [ ] Output is formatted (JSON or table)

**Verify:** Manual test + `bun run typecheck`

---

### GATE 8: Frontend — `[ ] NOT CHECKED`

**Why:** The consumer product.

**Inputs (needs):**
- Gate 6 (API Layer)
- Tauri shell

**Outputs (provides):**
- Chat UI with message list + input
- Provider selector dropdown
- Streaming response display
- Conversation sidebar
- Settings panel

**Gate Criteria:**
- [ ] `src-tauri/` exists with Tauri config
- [ ] React app renders chat UI
- [ ] Can send message and see streaming response
- [ ] Can switch providers mid-conversation
- [ ] Conversation history persists
- [ ] `bun run dev` starts frontend
- [ ] Frontend connects to backend API

**Verify:** Manual test + `bun run typecheck`

---

### GATE 9: Integration Tests — `[ ] NOT CHECKED`

**Why:** Prove the whole system works end-to-end.

**Inputs (needs):**
- All above gates

**Outputs (provides):**
- E2E test: launch Chrome → navigate to Claude → send message → capture response
- E2E test: send to Claude → switch to ChatGPT → merged history
- Performance test: response latency < 5s

**Gate Criteria:**
- [ ] `bun test tests/e2e/claude-send.test.ts` passes with real Chrome
- [ ] `bun test tests/e2e/chatgpt-send.test.ts` passes with real Chrome
- [ ] `bun test tests/e2e/multi-turn.test.ts` passes with real Chrome
- [ ] `bun test tests/e2e/performance.test.ts` passes
- [ ] No Chrome process leaks (all processes killed after tests)
- [ ] Test database cleanup works

**Verify:** `bun test tests/e2e/`

---

## Gate Verification Protocol

### Step 1: Build
```bash
bun run typecheck
```

### Step 2: Unit Test
```bash
bun test tests/unit/<specific-test>
```

### Step 3: Gate Check
For each gate, verify ALL criteria are met:
- [ ] Code exists (not stub)
- [ ] Lines ≥ minimum threshold
- [ ] No `// stub` or `// v1 stub` comments
- [ ] Unit tests pass
- [ ] Integration test passes (if applicable)

### Step 4: Mark Gate
If ALL criteria pass → update gate status to `[✓]`
If ANY fail → update to `[✗]` and list failures

### Step 5: Proceed
Only start next gate if ALL dependency gates are `[✓]`

---

## Quick Reference: Gate Dependencies

| Gate | Depends On | Can Start When |
|------|-----------|----------------|
| 0: Storage | None | NOW (already done) |
| 1a: CDP Client | 0 | NOW |
| 2a: Chrome Launcher | 0 | NOW (parallel with 1a) |
| 3a: Profile Allocator | 2a | 2a passes |
| 3b: Port Reaper | 2a | 2a passes |
| 2b: Fleet Supervisor | 1a, 2a, 3a, 3b | All pass |
| 4: Chrome Process Mgmt | 2b | 2b passes |
| 1b: Engine Wiring | 0, 4 | 4 passes |
| 5: Conversation Pipeline | 1a, 1b, 4 | All pass |
| 6: API Layer | 5, 4 | 5 passes |
| 7: CLI (Real) | 6, 4 | 6 passes |
| 8: Frontend | 6 | 6 passes |
| 9: Integration Tests | All | All pass |

---

## Interview Queue

| # | Topic | Status | Questions |
|---|-------|--------|-----------|
| 1 | CDP Client port strategy | QUEUED | Verbatim vs refactor? |
| 2 | Chrome Launcher config | QUEUED | Headless default? Port range? |
| 3 | Profile Allocator paths | QUEUED | Where on disk? Cleanup policy? |
| 4 | Fleet Supervisor wiring | QUEUED | How to integrate with ChromeGovernor? |
| 5 | Engine Bootstrap | QUEUED | Single file or separate module? |
| 6 | API pattern | QUEUED | REST vs hybrid? Streaming format? |
| 7 | Frontend stack | QUEUED | React + Zustand + Tailwind? |

---

## Context Anchors

When resuming work, read these line ranges:

| Anchor | File | Lines | Purpose |
|--------|------|-------|---------|
| CDP interface | chrome-governor.ts | 116-121 | CDPTransport contract |
| Governor stubs | chrome-governor.ts | 498-584 | spawn/kill/ensure stubs |
| Conversation pipeline | conversation-manager.ts | 153-266 | 8-step send logic |
| API router | conversation-router.ts | 1-79 | Current REST endpoints |
| Server bootstrap | server/index.ts | 1-72 | Bun.serve setup |
| Gate 1a details | This file | Gate 1a section | CDP Client criteria |
