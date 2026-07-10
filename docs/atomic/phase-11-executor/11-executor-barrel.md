# Unit 11.11: Executor Barrel + Wiring

**Phase:** 11 | **File:** `src/executor/index.ts`
**Depends:** 11.1–11.10 (all previous Phase 11 units)
**Produces:** Unified executor barrel with dependency injection wiring

## Purpose
Barrel export for all executor modules. Provides factory functions for wiring dependencies together and a unified `createExecutor()` function that bootstraps the full executor stack.

## Interface
```typescript
export { BunCdpClient } from './cdp.ts';
export type { CdpClientOptions, CommandOptions } from './cdp.ts';
export { CdpConnectionError, CdpTimeoutError } from './cdp.ts';

export { launchChrome, findChromeBinary, killChrome, isChromeRunning } from './launcher.ts';
export type { LaunchResult, ChromeLaunchOptions } from './launcher.ts';

export { ProfileAllocator } from './profile-allocator.ts';

export { PortReaper } from './port-reaper.ts';
export type { PortReaperOptions, ReapResult } from './port-reaper.ts';

export { FleetSupervisor } from './fleet-supervisor.ts';
export type { FleetSupervisorOptions, FleetSpawnOptions, FleetInstance, HealthProbeResult } from './fleet-supervisor.ts';
export { SlaveNotRunningError, CircuitOpenError, ChromeNotFoundError, PortOccupiedError } from './fleet-supervisor.ts';

export { SlaveWrite } from './slave-write.ts';
export { SlaveRead } from './slave-read.ts';

export { ConversationDriver } from './conversation-driver.ts';
export type { ConversationDriverOptions, SendMessageResult } from './conversation-driver.ts';

export { StreamCapture } from './stream-capture.ts';
export type { StreamChunk, CaptureResult as StreamCaptureResult } from './stream-capture.ts';

export { NetworkCapture } from './network-capture.ts';
export type { CapturedRequest, NetworkCaptureResult } from './network-capture.ts';

// Factory
export interface ExecutorComponents {
  profileAllocator: ProfileAllocator;
  portReaper: PortReaper;
  fleetSupervisor: FleetSupervisor;
  slaveWrite: SlaveWrite;
  slaveRead: SlaveRead;
  conversationDriver: ConversationDriver;
  streamCapture: StreamCapture;
  networkCapture: NetworkCapture;
}

export function createExecutor(
  store: GovernorStore,
  opts?: Partial<ExecutorOptions>,
): ExecutorComponents;

export interface ExecutorOptions {
  portRange: [number, number];
  chromeProfileBase: string;
  fleetOpts: Partial<FleetSupervisorOptions>;
}
```

## Required Capabilities
- Re-export all public types and classes from executor modules
- `createExecutor()` factory: wires all dependencies with sensible defaults:
  - `ProfileAllocator` with `chromeProfileBase`
  - `PortReaper` with `portRange`
  - `FleetSupervisor` wired to `ProfileAllocator`, `PortReaper`, `Launcher`
  - `SlaveWrite` / `SlaveRead` created per-connection
  - `ConversationDriver` wired to `FleetSupervisor` + slaves
- Type narrowing: `SlaveRead` and `SlaveWrite` accept `BunCdpClient | string` (string = create from slug)
- Default options: `portRange: [9222, 9332]`, `chromeProfileBase: 'chrome-profiles'`

## Tests
- [ ] All exports available from barrel
- [ ] `createExecutor()` returns all components wired together
- [ ] Default options applied when partial opts provided
- [ ] Types compile without errors

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/index.test.ts` passes
