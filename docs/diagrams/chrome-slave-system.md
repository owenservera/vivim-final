# Chrome Slave System — Unified Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Chrome Slave System                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   ProfileAllocator│    │  FleetSupervisor │    │   FleetLimiter  │         │
│  │   (Profile Mgmt) │    │  (Lifecycle Mgmt)│    │  (Admission)    │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Profile Dirs    │    │  FleetInstances │    │  Queue/Timeout  │         │
│  │  chrome-profiles/│    │  (State Machine)│    │  (Browserless)  │         │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘         │
│                                  │                                         │
│                                  ▼                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │    Launcher      │    │   SlaveStates   │    │  ContextProbe   │         │
│  │  (Chrome Spawn)  │    │  (State Logic)  │    │  (Preflight)    │         │
│  └────────┬────────┘    └─────────────────┘    └─────────────────┘         │
│           │                                                                │
│           ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Chrome Instances                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │ Gemini   │  │ ChatGPT  │  │ Claude   │  │  ...     │           │   │
│  │  │ (CDP)    │  │ (CDP)    │  │ (CDP)    │  │          │           │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘           │   │
│  │       │              │              │                               │   │
│  └───────┼──────────────┼──────────────┼───────────────────────────────┘   │
│          │              │              │                                   │
│          ▼              ▼              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Provider Integration                           │   │
│  │  - gemini.google.com  - chatgpt.com  - claude.ai                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Slave Lifecycle States                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  stopped ──▶ starting ──▶ running ──▶ unhealthy                             │
│     ▲          │             │  │          │                                 │
│     │          │             │  └──────────┤ (transient failure)            │
│     │          │             ▼             ▼                                 │
│     │          │          restarting ──▶ error                               │
│     │          │             │            │                                  │
│     │          │             ▼            ▼                                  │
│     │          └───────── circuit_open ──▶ terminal(error)                  │
│     └─────────────────────────────────────────── (explicit stop)            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Fleet Super-State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Fleet Super-State                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  idle ──▶ active ──▶ degraded ──▶ terminal                                 │
│    ▲        │           │            │                                      │
│    │        │           │            │                                      │
│    └────────┴───────────┴────────────┘                                      │
│                                                                             │
│  Precedence: terminal > degraded > active > idle                            │
│                                                                             │
│  - idle: All slaves stopped                                                 │
│  - active: Any slave running/starting                                       │
│  - degraded: Any slave unhealthy/restarting/circuit_open                    │
│  - terminal: All slaves error/circuit_open                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Chrome Slave Data Flow                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Agent detects provider needed                                           │
│           │                                                                 │
│           ▼                                                                 │
│  2. FleetSupervisor.spawn(provider, account)                                │
│           │                                                                 │
│           ▼                                                                 │
│  3. FleetLimiter.acquire() ──▶ Queue if busy                                │
│           │                                                                 │
│           ▼                                                                 │
│  4. ProfileAllocator.allocate() ──▶ Get/Create profile                      │
│           │                                                                 │
│           ▼                                                                 │
│  5. Launcher.launchProfile() ──▶ Spawn Chrome                              │
│           │                                                                 │
│           ▼                                                                 │
│  6. Chrome navigates to provider URL                                        │
│           │                                                                 │
│           ▼                                                                 │
│  7. Health check confirms CDP connectivity                                  │
│           │                                                                 │
│           ▼                                                                 │
│  8. FleetInstance created and tracked                                       │
│           │                                                                 │
│           ▼                                                                 │
│  9. Capability execution via CDP                                            │
│           │                                                                 │
│           ▼                                                                 │
│  10. Response streamed to frontend                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Integration Points                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Chrome Slave System                                                        │
│       │                                                                     │
│       ├──▶ CapabilityResolutionEngine (capability execution)                │
│       │                                                                     │
│       ├──▶ StreamParserEngine (response parsing)                            │
│       │                                                                     │
│       ├──▶ ConversationManager (session state)                              │
│       │                                                                     │
│       ├──▶ CapabilityEventBus (lifecycle events)                            │
│       │                                                                     │
│       ├──▶ ProviderRegistrar (provider registration)                        │
│       │                                                                     │
│       └──▶ API Endpoints (fleet status)                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **ProfileAllocator** | `src/executor/profile-allocator.ts` | Profile dirs, allocation, auth check, cleanup |
| **FleetSupervisor** | `src/executor/fleet-supervisor.ts` | Instance lifecycle, state machine, circuit breaker |
| **Launcher** | `src/executor/launcher.ts` | Chrome/Edge spawn, kill, port resolution |
| **SlaveStates** | `src/executor/slave-states.ts` | State machine (7 states + super-state) |
| **FleetLimiter** | `src/executor/fleet-limiter.ts` | Admission control (queue, pressure) |
| **ContextProbe** | `devops/agentic/context-probe.ts` | PreflightSnapshot (DB+disk+CDP) |
| **ProfileCleanup** | `devops/profile-cleanup.ts` | Profile cleanup operator |

## Scripts

| Script | Purpose |
|--------|---------|
| `_shared.ps1` | Resolve-Bun, Kill-Pid, Kill-Port, Test-PortFree |
| `start-backend.ps1` | Backend launcher (port auto-fallback) |
| `stop-all.ps1` | Service teardown (PID + port + orphan) |
| `cleanup-credentials.ps1` | Strip cookies/passwords without deleting dirs |

## Invariants (Never Violate)

### Critical Invariants

1. **Profile = source of truth** — Cookie files determine "logged in", not DB row
2. **One profile per (provider, account)** — enforced by ProfileAllocator
3. **Governor Canon** — Only `ChromeGovernor` touches CDP
4. **Lazy startup** — Auto-launch when first needed, keep alive until `stop`
5. **No runaway creation** — FleetSupervisor limits + ProfileAllocator singleton
6. **Relogin ready** — Agent detects expiry, suggests relogin, user confirms

### State Management Invariants

7. **Triple-layer state** — Profile + DB + runtime must stay consistent
8. **Profile dir is canonical** — DB and runtime are derived from profile state
9. **Cookie presence = authenticated** — `isAuthenticated()` checks cookie files

### Lifecycle Invariants

10. **Stateful, dedicated slaves** — Login once, use indefinitely
11. **Auto-restart transient** — FleetSupervisor handles crash recovery
12. **Manual persistent** — Agent decides for persistent failures
13. **Circuit breaker** — Opens after 5 failures, prevents cascade

### Dev Loop Invariants

14. **Lazy startup** — Chrome slaves launch when first needed
15. **Keep alive** — Slaves persist until `stop` or session ends
16. **Core providers always-on** — gemini, chatgpt, claude during dev sessions

### Safety Invariants

17. **No orphan processes** — `stop-all.ps1` always runs on session end
18. **No zombie ports** — Port probe before reuse
19. **No stale locks** — SingletonLock cleanup before spawn
