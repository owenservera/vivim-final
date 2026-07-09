# Unit 3.2: Governor — LifecycleManager

**Phase:** 3 | **File:** Governor subsystem (within `chrome-governor.ts`)
**Depends:** 3.1 ChromeGovernor | **Produces:** Chrome process lifecycle management
**Source:** `04-merged-engines.md` §1, `02-merged-architecture.md` §ChromeGovernor

## Purpose
Handles all Chrome process lifecycle: spawn, kill, ensure, profile derivation, port allocation, seed accounts, and orphan port reaping. This is an internal subsystem of `ChromeGovernor` — no other engine calls it directly.

## Interface
```typescript
class LifecycleManager {
  constructor(
    private store: GovernorStore,
    private slaves: Map<string, ChromeSlave>,
    private config: FleetConfig,
    private eventBus?: CapabilityEventBus,
  ) {}

  async spawn(providerId: string, accountId: string, opts?: LaunchOptions): Promise<ChromeSlave>;
  async kill(slaveId: string): Promise<void>;
  async ensure(slaveId: string): Promise<ChromeSlave>;
  deriveProfile(providerId: string, accountId: string): string;
  allocatePort(): number;
  async seedAccounts(): Promise<void>;
  async reapOrphanedPorts(): Promise<void>;
}
```

## Operations
- **spawn()** — detectChrome path, derive port, allocate profile, launch Chrome with `--remote-debugging-port`
- **kill()** — CDP Browser.close, kill process, reap port
- **ensure()** — check liveness, restart if dead
- **deriveProfile()** — profile_dir per account
- **allocatePort()** — dynamic port from range
- **seedAccounts()** — create accounts from provider_account rows
- **reapOrphanPorts()** — kill processes on ports from previous runs

## Chrome Launch Args
```
--remote-debugging-port={port}
--user-data-dir={profile_dir}
--no-first-run
--disable-default-apps
--disable-sync
--disable-features=Translate
--disable-background-networking
+ provider-specific extraArgs from fleet_config
```

## Tests
- [ ] `spawn()` launches Chrome with correct port + profile
- [ ] `kill()` closes browser via CDP, kills process, reaps port
- [ ] `ensure()` returns existing slave if running, restarts if dead
- [ ] `allocatePort()` returns free port from configured range
- [ ] `seedAccounts()` creates ChromeSlave entries for all provider_account rows
- [ ] `reapOrphanedPorts()` kills leftover processes

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked CDP/spawn
- Chrome binary detected on PATH or configured chromePath
