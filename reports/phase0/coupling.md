# Module Coupling Map — Phase 0

## B1 Violations (non-Governor files importing CDPTransport)

| File | Import | Violation Type |
|------|--------|----------------|
| `src/engines/cdp-watchdog.ts` | `CDPTransport` | Direct CDP access |
| `src/engines/streaming-protocol.ts` | `CDPTransport` | Direct CDP access |

## High-Coupling Modules

| Module | Inbound | Outbound | Risk |
|--------|---------|----------|------|
| `chrome-governor.ts` | 12 | 8 | High — central hub |
| `fleet-supervisor.ts` | 6 | 11 | High — lifecycle owner |
| `cdp-transport.ts` | 4 | 3 | Medium — I/O boundary |
| `capability-snapshot.ts` | 8 | 2 | Medium — boot dependency |

## Phase-2 Extraction Candidates

1. `CDPProxy` inner class → `BrowserRuntime`
2. `HealthMonitor` inner class → `Runtime/health.ts`
3. `CdpWatchdog` → `Runtime/watchdog.ts`
4. `ReconnectManager` → `Runtime/reconnect.ts`
5. `SlaveStateStore` → `Runtime/state.ts`
