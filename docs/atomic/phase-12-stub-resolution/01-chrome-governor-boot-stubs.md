# Unit 12.1: ChromeGovernor Boot Stubs

**Phase:** 12 | **File:** `src/engines/chrome-governor.ts`
**Depends:** 11.5 Fleet Supervisor | **Produces:** Real boot sequence for ChromeGovernor

## Purpose
Fixes the 2 stub methods in ChromeGovernor's boot sequence: account seeding and orphan port reaping. Currently these are placeholders — after Phase 11 is complete, wire them to the real components.

## Current Stubs

### Stub 1: Seed Accounts (line 577)
```typescript
// Seed accounts from provider_account table — stub for now
```
Replace with real account seeding from `GovernorStore.getAccounts()`.

### Stub 2: Orphan Port Reaping (line 582)
```typescript
// Kill processes on ports from previous runs — stub for now
```
Replace with real call to `PortReaper.reap(portRange)`.

## Interface Changes
```typescript
// In ChromeGovernor.boot():
async boot(): Promise<void> {
  // 1. Reap orphaned ports via PortReaper
  await this.portReaper.reap(this.fleetConfig.portRange);

  // 2. Seed accounts from GovernorStore
  const accounts = await this.store.getAccounts();
  for (const account of accounts) {
    // Register known accounts in internal map
    this.knownAccounts.set(account.id, account);
  }

  // 3. Initialize HealthMonitor
  this.healthMonitor = new HealthMonitor(this.store, this.fleetConfig);

  // 4. Start TraceLog
  this.traceLog.start();
}
```

## Implementation Notes
- `PortReaper` is available via `this.portReaper` (inject through constructor or create internally)
- Account seeding reads from `GovernorStore.getAccounts()` — already exists in store contract
- No new interfaces needed, just wire existing components
- Use FleetSupervisor's port range for reaping

## Tests
- [ ] `boot()` calls `PortReaper.reap()` with correct port range
- [ ] `boot()` seeds accounts from `GovernorStore.getAccounts()`
- [ ] `boot()` initializes HealthMonitor
- [ ] `boot()` starts TraceLog
- [ ] All existing ChromeGovernor tests still pass

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/engines/chrome-governor.test.ts` passes
- Governor boot completes without errors
