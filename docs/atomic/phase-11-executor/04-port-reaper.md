# Unit 11.4: Port Reaper

**Phase:** 11 | **File:** `src/executor/port-reaper.ts`
**Depends:** 11.3 Profile Allocator | **Produces:** Orphan Chrome process cleanup
**Source:** cap-store `src/executor/port-reaper.ts` (181 lines, port to vivim-final)

## Purpose
Cleans up orphaned Chrome processes and their ports on startup and periodically. Detects zombie Chrome instances from previous sessions by scanning for processes listening on known debug ports and killing them.

## Interface
```typescript
export class PortReaper {
  constructor(private opts?: PortReaperOptions) {}

  async reap(portRange?: [number, number]): Promise<ReapResult>;
  async reapProcess(pid: number): Promise<boolean>;
  async findOrphans(portRange: [number, number]): Promise<Array<{ pid: number; port: number; cmd: string }>>;
  startPeriodicReap(intervalMs?: number): void;
  stopPeriodicReap(): void;
}

export interface PortReaperOptions {
  defaultPortRange?: [number, number];
  periodicIntervalMs?: number;
}

export interface ReapResult {
  reaped: number;
  failed: number;
  orphans: Array<{ pid: number; port: number }>;
  durationMs: number;
}

export class PortReaperError extends Error {}
```

## Required Capabilities
- Scan port range for processes listening on those ports
- Identify Chrome processes by command line inspection
- Kill orphaned processes gracefully (SIGTERM then SIGKILL after timeout)
- Track which PIDs were intentionally launched to avoid killing active sessions
- Periodic reaping to prevent port exhaustion
- Safe on Windows (use `tasklist` / `taskkill`)
- Report results: how many reaped, how many failed, duration

## Tests
- [ ] `findOrphans([9222, 9225])` returns list of orphan PIDs (or empty)
- [ ] `reapProcess(pid)` kills process and resolves
- [ ] `reap([9222, 9225])` returns ReapResult with correct stats
- [ ] Periodic reaping: starts and stops interval timer
- [ ] Does not kill intentionally launched processes (tracks pid set)

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/port-reaper.test.ts` passes

## Port Notes
Port from cap-store `src/executor/port-reaper.ts`. On Windows use `taskkill /F /PID <pid>` via `Bun.spawnSync`. On Unix use `process.kill(pid, 'SIGTERM')`. Keep OS-conditional logic.
