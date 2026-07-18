# Chrome Integration

## ChromeGovernor (src/engines/chrome-governor.ts)
Single authority for all Chrome CDP interaction. Provides:

```typescript
interface IChromeGovernor {
  boot(): Promise<string>           // slaveId
  ensureRunning(slaveId: string): Promise<void>
  execute(slaveId: string, plan: HarnessPlan): Promise<ExecutionResult>
  capture(slaveId: string, opts: CaptureOpts): Promise<ContentBlock[]>
  trace(slaveId: string, opts: TraceOpts): Promise<TraceSession>
  health(slaveId: string): Promise<HealthStatus>
  kill(slaveId: string): Promise<void>
}
```

## FleetSupervisor (src/executor/fleet-supervisor.ts)
Manages Chrome slave fleet state machine:
- State: `offline | booting | ready | busy | error | stopping`
- Circuit breaker: opens after 3 consecutive failures
- Auto-reap kills slaves idle > 30min

## CDP Transport (src/executor/cdp-transport.ts)
Real CDP client layer:
```typescript
interface CdpTransport {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
  on(event: string, handler: (data: unknown) => void): void
  close(): Promise<void>
}
```

## Slave Setup (scripts/setup-slaves.ts)
Bootstrap script for logged-in Chrome profiles:
- Creates profiles for claude.chat, chatgpt.com, gemini.google
- Manual login + headless reuse
- See docs/atomic/phase-11-executor/11.14-slave-setup-script.md

## Governor Canon (Invariant)
Only ChromeGovernor touches CDP. No engine imports BunCdpClient directly.