# atomic-v13 — Chrome Slave System (Best-in-Class, Truth-Grounded)

**Parent PRD:** `docs/ways-of-work/plan/chrome-fleet/chrome-slave-system/prd.md`
**Parent Epic:** Chrome Fleet & Governance (`chrome-fleet`)
**Grounded against:** `src/executor/*`, `src/engines/chrome-governor.ts`, `src/schema/chrome.ts`

A **single cohesive design**, not a scatter of independent units. It consolidates the Chrome
Slave System into one supervised, config-driven fleet with a canonical state machine. Every
requirement was cross-checked against the existing source; gaps are called out and closed in
the implementation.

---

## 1. Truth-Grounded Gap Analysis (from existing source)

| PRD | Existing state | Verdict |
|-----|---------------|---------|
| FR-3 state machine `unhealthy\|restarting\|circuit_open` + super-state `idle\|active\|degraded\|terminal` | 3 divergent `SlaveStatus`/`SuperState` defs; none have the PRD states | **GAP — unify** |
| FR-11 SingletonLock clear | not present | **GAP — create** |
| FR-7/8 first-run detection | `chrome-setup-wizard` polls URL; no `isAuthenticated` on profile | **GAP — create** |
| User ask: config-driven chrome *type* | `launcher` hardcodes `--headless=new` + global path | **GAP — create** |
| FR-9/10 recoverAuth | not present | **GAP — create** |
| FR-16 adaptive health + jitter | fixed interval, no widen/jitter | **GAP — create** |
| FR-17 process-exit detection | health-probe timeout only | **GAP — create** |
| FR-18 exponential backoff | crude `maxRestarts` counter | **GAP — create** |
| FR-12/13 launch flags + channel path | partial (launcher) | **PORT** |
| FR-19 circuit breaker | `circuit-breaker.ts` + governor `HealthMonitor` | **DONE** |
| FR-20/21 read layer + broadcast | `slave-read.ts` + eventBus emits | **PORT** |
| FR-1/2/4/5/6/22 lifecycle, port, profile, store | `fleet-supervisor.ts` + `governor-store` | **DONE** |

---

## 2. Architecture — one supervised fleet

```
ChromeSlaveSystem (facade)
 ├─ ChromeInstanceProfile   // config-driven: channel + mode + flags  (NEW — user ask)
 ├─ SlaveStates             // canonical state machine + super-state  (NEW — FR-3)
 ├─ Launcher                // channel resolve + SingletonLock clear + first-run (NEW)
 ├─ ProfileAllocator        // + isAuthenticated()                    (EXTEND — FR-7/8)
 ├─ FleetSupervisor         // adopts canonical states, super-state,
 │                           //   exponential backoff, process-exit detect,
 │                           //   adaptive health w/ jitter, recoverAuth  (REWRITE — FR-3/16/17/18/9/10)
 └─ ChromeGovernor          // wires facade; keeps Governor Canon (only CDP authority)
```

### Module contracts

**`ChromeInstanceProfile`** (config-driven chrome type — the user's explicit requirement):
```ts
type ChromeChannel = 'system' | 'chrome' | 'chromium' | 'edge'
type ChromeMode    = 'headless-new' | 'headless' | 'headed'
interface ChromeInstanceProfile {
  channel: ChromeChannel
  mode: ChromeMode
  headless: boolean            // derived from mode
  userDataDir: string
  debugPort?: number
  windowSize?: { width: number; height: number }
  disableGpu?: boolean
  launchTimeoutMs: number
  extraArgs: string[]
}
```
- `resolveChromeBinary(channel)` returns executable path for the requested channel
  (env `CHROME_PATH` → channel-specific known paths → `which`/`where`).
- `buildChromeArgs(profile)` emits flags honoring `mode` and PRD anti-throttle/no-restore
  flags; derives `--headless=new` only for `headless-new`.

**`SlaveStates`** (canonical, single source of truth — FR-3):
```ts
type SlaveLifecycle = 'stopped'|'starting'|'running'|'unhealthy'|'restarting'|'error'|'circuit_open'
type FleetSuperState = 'idle'|'active'|'degraded'|'terminal'
computeSuperState(instances: {status: SlaveLifecycle}[]): FleetSuperState
```
Rules: all `stopped` → `idle`; any `running`/`starting` → `active`;
any `unhealthy`/`restarting`/`circuit_open` → `degraded`; all `error`/`circuit_open` → `terminal`.

**`Launcher`** (extend):
- `clearSingletonLock(userDataDir)` — delete `SingletonLock`/`SingletonCookie` before spawn (FR-11).
- First-run detection delegated to `ProfileAllocator.isAuthenticated`.

**`ProfileAllocator`** (extend):
- `isAuthenticated(userDataDir): boolean` — session cookies persisted in profile ⇒ authenticated (FR-7/8).
- `requiresFirstRun` = `!isAuthenticated`.

**`FleetSupervisor`** (rewrite core loop):
- Status vocabulary = `SlaveLifecycle`.
- `spawn` clears SingletonLock, resolves channel, launches; on first-run sets `visible` and emits `fleet:first_run`.
- `ensureRunning` uses **exponential backoff** (base 1s, factor 2, cap, maxAttempts) and routes crashes → `restarting` → `unhealthy`/`error`.
- **Process-exit detection (FR-17):** each launched proc registers an `exited` listener that transitions `running`→`restarting` and triggers auto-restart.
- **Adaptive health (FR-16):** interval widens with idle time (capped) + randomized jitter to avoid synchronized probing.
- `recoverAuth(provider,account)` kills running slave, relaunches `headed`/visible, emits `fleet:recover_auth`.
- `getSuperState()` returns `FleetSuperState`.

---

## 3. Store Contract (no change required)
`governor-store` already persists fleet events / health ticks / circuits. FleetSupervisor
continues to depend on `storage/contracts/governor-store` (canon: contracts only).

## 4. Test Contract
- Pure units (profile resolve, args build, SingletonLock clear, state machine, super-state,
  backoff schedule, first-run detection) tested without spawning real Chrome.
- FleetSupervisor tested with an injected `launcher` double + fake timer to assert backoff,
  exit-detection, adaptive interval, recoverAuth, super-state.

## 5. Gate
`bun run typecheck` + `bun run lint` + `bun test tests/unit/executor` (no real browser).
