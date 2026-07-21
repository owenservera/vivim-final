# Chrome Slave System — Strategic Design Document

> **Status**: Active Design  
> **Created**: 2026-07-21  
> **Source**: Interview session with project owner  
> **Purpose**: Capture strategic decisions for Chrome slave lifecycle management

---

## 1. Purpose & Role

| Aspect | Decision |
|--------|----------|
| **Primary role** | CDP bridge to manage registered providers (chatgpt.com, gemini.google.com, claude.ai) and stream responses back to the system with frontend rendering |
| **Status** | Already working — this is the core functionality |

**Key Insight**: The Chrome slave system is NOT a testing tool — it's the production automation layer that powers the entire provider integration.

---

## 2. Scale & Concurrency

| Aspect | Decision |
|--------|----------|
| **Concurrent slaves** | 3-5 (gemini, chatgpt, claude + room for growth) |
| **Enforcement** | FleetSupervisor limits exist and work properly |
| **Admission control** | Bounded concurrency + queue + timeout (browserless pattern) |
| **Pressure gates** | CPU/memory overload check before spawn |

**FleetSupervisor Limits (Verified Working)**:

| Limit | Default | Purpose |
|-------|---------|---------|
| `maxConcurrent` | port range span | Active slave cap |
| `maxQueued` | maxConcurrent × 2 | Queue depth |
| `queueTimeoutMs` | 30,000ms | Reject if no slot |
| `cpuOverloadPct` | 100% (disabled) | Pre-spawn pressure gate |
| `memOverloadPct` | 100% (disabled) | Pre-spawn pressure gate |
| `autoRestart` | true | Auto-restart on crash |
| `maxRestarts` | 3 | Max restarts before circuit open |
| `circuitBreakerThreshold` | 5 | Failures before circuit open |
| `circuitBreakerResetMs` | 60,000ms | Circuit reset time |

**Spawn Guard (Verified Working)**:
- Returns existing running instance for this provider+account
- Kills existing Chrome holding this profile's SingletonLock
- Probes persisted port — if something is listening, don't reuse

---

## 3. Lifecycle Model

| Aspect | Decision |
|--------|----------|
| **Type** | Stateful, dedicated slaves |
| **Pattern** | Login once per provider + account, use indefinitely |
| **Dev loop** | Hybrid — lazy startup (auto-launch when first needed, keep alive until `stop`) |
| **User-facing** | Always-on for core providers during sessions |

**State Machine** (from `src/executor/slave-states.ts`):

```
stopped → starting → running → unhealthy
   ↑        │           │  │        │
   │        │           │  └────────┤ (transient failure, not yet terminal)
   │        │           ▼           ▼
   │        │        restarting ──▶ error
   │        │           │            │
   │        │           ▼            ▼
   │        └───────── circuit_open ──▶ terminal(error)
   └─────────────────────────────────────────── (explicit stop / shutdown)
```

**Fleet Super-State**: `idle | active | degraded | terminal`

---

## 4. State Management (Triple-Layer)

| Layer | Purpose |
|-------|---------|
| **Profile dirs** | Chrome's `--user-data-dir` — cookies, localStorage, session state |
| **DB (ProviderAccount)** | loginState, debugPort, profileDir, isDefault |
| **Runtime (.runtime/)** | Fast agent access, port files, PID files, health status |

**Invariant**: Profile directory (cookie files) is the source of truth for "logged in" — not DB loginState row.

**Profile Layout** (Canonical):
```
chrome-profiles/
  <provider-slug>/
    <accountId>/          # One authenticated profile per provider
      .profile-meta.json  # Provider slug, account ID, timestamps
```

---

## 5. Crash Recovery

| Scenario | Behavior |
|----------|----------|
| **Transient failure** | Auto-restart with same profile (state preserved via cookies) |
| **Persistent failure** | Manual intervention — agent must detect and decide |
| **Circuit breaker** | Opens after 5 failures, resets after 60s |
| **Max restarts** | 3 before circuit open |

**Exponential Backoff** (from `src/executor/slave-states.ts`):
```typescript
backoffDelay(attempt, baseMs = 1_000, factor = 2, maxMs = 30_000)
```

---

## 6. Session Expiry & Relogin

| Aspect | Decision |
|--------|----------|
| **Detection** | `isAuthenticated()` checks cookie files in profile dir |
| **Alerting** | Flag in preflight, agent decides |
| **Relogin sequence** | Hybrid — agent detects + suggests, user confirms, system executes |
| **Relogin flow** | Vivim-registered — `setup --provider=<slug>` launches Chrome, user logs in, system captures cookies |

**Relogin Flow**:
1. Agent detects expiry via `isAuthenticated()` check
2. Agent suggests relogin to user
3. User confirms
4. System executes `setup --provider=<slug>`
5. Chrome launches, user logs in
6. System captures cookies, updates DB + runtime

---

## 7. Dev Loop Behavior

| Aspect | Decision |
|--------|----------|
| **Startup** | Lazy — auto-launch when first needed |
| **Lifetime** | Keep alive until `stop` command |
| **Core providers** | Always-on during dev sessions (gemini, chatgpt, claude) |
| **Other providers** | On-demand per task |

**Dev Loop Integration**:
- `start-all.ps1` launches backend + frontend + adopts Chrome
- `stop-all.ps1` kills all services
- Lazy startup: Chrome slaves launch when first needed via `engage` or `test` commands
- Keep alive: Slaves persist until `stop` or session ends

---

## 8. Setup Wizard

| Aspect | Decision |
|--------|----------|
| **Existing system** | Don't change — `runtime-test setup` exists |
| **Integration** | Wire into Chrome slave lifecycle as the login mechanism |
| **Output** | Profile dir + DB row + runtime state |

**Setup Wizard Flow**:
1. `setup --provider=<slug> --account=<email>`
2. ProfileAllocator allocates profile dir
3. Chrome launches with profile
4. User logs in manually
5. System captures cookies
6. DB row created/updated
7. Runtime state updated

---

## 9. Runaway Prevention

| Layer | Mechanism |
|-------|-----------|
| **FleetSupervisor** | `maxConcurrent` + queue + timeout |
| **ProfileAllocator** | One profile per (provider, account) |
| **Spawn guard** | Returns existing running instance for this provider+account |
| **SingletonLock** | Kills existing Chrome holding profile's lock |
| **Port probe** | If something is listening on persisted port, don't reuse |

**Key Invariant**: One profile per (provider, account) — enforced by ProfileAllocator.

---

## 10. Capability Integration

| Aspect | Decision |
|--------|----------|
| **Model** | Hybrid — capabilities define WHAT, provider determines HOW |
| **Status** | Already wired — capabilities are provider-bound |
| **Resolution** | Via interpreter (`POST /api/nlcl/interpret`) |

**Capability-Provider Mapping**:
- `send_message` → provider-specific CDP actions
- `select_model` → provider-specific DOM interactions
- Each capability maps to CDP actions via provider manifest

**Failure Handling**:
- **Primary**: Try requested provider
- **Fallback**: Try alternative provider if primary fails (via parser fallback chains)
- **Circuit breaker**: Prevent cascade failures
- **Manual recovery**: Agent decides on persistent failures

---

## 11. Health Monitoring

| Layer | Responsibility |
|-------|----------------|
| **FleetSupervisor** | Periodic CDP ping, auto-restart on failure |
| **Agent** | Checks health via `preflight`/`status` commands |
| **Integration** | FleetSupervisor handles runtime, agent handles decision-making |

**Health Probe** (from `src/executor/fleet-supervisor.ts`):
- Interval: 30,000ms (configurable)
- Timeout: 5,000ms (configurable)
- Auto-restart on failure (if `autoRestart` enabled)

**Preflight Context** (from `devops/agentic/context-probe.ts`):
- Accounts from DB
- Profiles from disk
- Live Chrome instances from CDP scan
- Ready providers, restore candidates, gaps

---

## 12. Frontend Integration

| Aspect | Decision |
|--------|----------|
| **Model** | Both — direct for streaming, backend for state management |
| **Streaming** | Chrome slave streams responses directly to frontend via WebSocket |
| **State** | Backend mediates Chrome ↔ frontend communication |
| **Status** | Already working |

**Streaming Flow**:
1. Chrome slave captures provider response via CDP
2. Response streamed to backend via WebSocket
3. Backend forwards to frontend via WebSocket
4. Frontend renders response in real-time

---

## 13. State Persistence Across Restarts

| Aspect | Decision |
|--------|----------|
| **Profiles persist** | Cookie files survive restart |
| **No auto-relaunch** | Slaves need manual launch after restart |
| **Lazy launch** | Slaves only launch when first needed |
| **Simplicity** | Auto-relaunch adds complexity (startup race conditions) |

**Rationale**: Machine restarts are infrequent. Lazy launch is sufficient — slaves start when needed.

---

## 14. Chrome Conflict Handling

| Aspect | Decision |
|--------|----------|
| **Port check** | Verify debug port is free before launch |
| **No kill** | Don't terminate user's Chrome instances |
| **No share** | Don't reuse existing Chrome instances |
| **Fail if busy** | Return error if port is occupied |

**Rationale**: Current approach respects user's Chrome instances and fails safely if port is busy.

---

## 15. Profile Corruption Recovery

| Aspect | Decision |
|--------|----------|
| **Detection** | `isAuthenticated()` returns false |
| **Recovery** | Agent suggests relogin, user confirms |
| **No auto-recover** | Too risky — might delete valid profile |
| **No backup** | Profiles are disposable, re-login is fast |

**Rationale**: Profile corruption is rare. Manual recovery is safer than auto-recover.

---

## 16. Profile Sharing

| Aspect | Decision |
|--------|----------|
| **No sharing** | Each provider gets unique profile |
| **Isolation** | No cross-provider contamination |
| **Simplicity** | Sharing adds complexity (what to share, how to overlay) |
| **Security** | Isolated profiles are more secure |

**Rationale**: Isolation is simpler and more secure. Sharing adds unnecessary complexity.

---

## 17. Scalability Limits

| Aspect | Decision |
|--------|----------|
| **No hard limit** | Let FleetSupervisor manage based on system resources |
| **Soft limits** | `maxConcurrent` in FleetConfig (currently 5) |
| **Dynamic adjustment** | Adjust based on memory, CPU, ports |
| **Future-proof** | No need to hardcode limit |

**Rationale**: FleetSupervisor already has admission control. Let it decide based on system resources.

---

## 18. Resource Limits

| Aspect | Decision |
|--------|----------|
| **Fixed limits** | Hard caps on concurrent slaves, queue size |
| **Dynamic port allocation** | Find free port at launch |
| **Circuit breaker** | Prevent cascade failures |
| **System resources** | Let OS manage memory, CPU |

**Rationale**: FleetSupervisor already has fixed limits (maxConcurrent, queueTimeout). OS manages memory/CPU.

---

## 19. Port Conflict Resolution

| Aspect | Decision |
|--------|----------|
| **Dynamic allocation** | Find free port at launch |
| **Port reuse** | Prefer reusing existing ports |
| **Fail if busy** | Return error if no free port |
| **Port tracking** | Track allocated ports in FleetSupervisor |

**Rationale**: Dynamic allocation is flexible. Port reuse improves performance.

---

## 20. Process Cleanup

| Aspect | Decision |
|--------|----------|
| **Kill process** | Terminate Chrome process |
| **Profile cleanup** | Delete profile after process kill |
| **Graceful shutdown** | Close browser, then kill process |
| **Orphan detection** | Find and kill orphan Chrome processes |

**Cleanup Sequence**:
1. Send `Browser.close` via CDP
2. Wait for process to exit
3. Kill process if still running
4. Delete profile directory
5. Update FleetInstance status

**Rationale**: Current approach (kill + profile cleanup + orphan detection) is comprehensive.

---

## 21. Key Components (Source Code)

| Component | File | Responsibility |
|-----------|------|----------------|
| **ProfileAllocator** | `src/executor/profile-allocator.ts` | Profile dirs, allocation, auth check, cleanup |
| **FleetSupervisor** | `src/executor/fleet-supervisor.ts` | Instance lifecycle, state machine, circuit breaker |
| **Launcher** | `src/executor/launcher.ts` | Chrome/Edge spawn, kill, port resolution |
| **SlaveStates** | `src/executor/slave-states.ts` | State machine (7 states + super-state) |
| **FleetLimiter** | `src/executor/fleet-limiter.ts` | Admission control (queue, pressure) |
| **context-probe.ts** | `devops/agentic/context-probe.ts` | PreflightSnapshot (DB+disk+CDP) |
| **ensure-browser.ts** | `devops/runtime-test/ensure-browser.ts` | Browser precheck (adopted/spawned/none) |
| **engage.ts** | `devops/runtime-test/engage.ts` | Attach-first browser control |
| **cdp-resolver.ts** | `devops/runtime-test/cdp-resolver.ts` | CDP connection for provider |
| **profile-cleanup.ts** | `devops/profile-cleanup.ts` | Profile cleanup operator |

---

## 22. Scripts

| Script | Purpose |
|--------|---------|
| `_shared.ps1` | Resolve-Bun, Kill-Pid, Kill-Port, Test-PortFree |
| `start-backend.ps1` | Backend launcher (port auto-fallback) |
| `stop-all.ps1` | Service teardown (PID + port + orphan) |
| `cleanup-credentials.ps1` | Strip cookies/passwords without deleting dirs |

---

## 23. Invariants (Never Violate)

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

---

## 24. Metrics & Observability

| Category | Metrics | Implementation |
|----------|---------|----------------|
| **Basic** | Spawn count, restart count, circuit breaker events | Already tracked via FleetEvent table |
| **Performance** | Spawn latency, health probe latency, memory/CPU per slave | Extend FleetEvent with structured detailJson |
| **Health** | Uptime, failure rate, recovery time, session age | Add health scores to status endpoint |
| **Resource** | Port usage, profile disk size, Chrome process count | Monitor via profile-cleanup.ts |

**Visualization**: Hybrid approach
- **CLI**: `status`, `preflight` commands for agents
- **Dashboard**: Real-time web view for humans (via `/api/fleet/status`)
- **Logs**: Structured JSON logs for debugging

---

## 25. Chrome Version Tracking

| Action | Implementation |
|--------|----------------|
| **Track** | Store Chrome version in `FleetInstance` or `.profile-meta.json` |
| **Alert** | Flag in `preflight` when version is >30 days old |
| **No auto-upgrade** | Too risky — Chrome upgrades can break CDP selectors |

**Rationale**: Chrome version affects CDP compatibility, but auto-upgrade is dangerous (breaking changes). Alerting is sufficient.

---

## 26. Profile Backup Strategy

| Decision | Rationale |
|----------|-----------|
| **No backup** | Profiles are local, disposable |
| **Re-login is fast** | `setup` command captures cookies in seconds |
| **Git-ignored** | No backup needed for version control |
| **Simplicity** | Backup adds complexity (what to backup, when, where) |

**Exception**: If profiles become large or login is complex (2FA, enterprise SSO), revisit backup later.

---

## 27. Profile Cleanup Schedule

| Decision | Rationale |
|----------|-----------|
| **Manual only** | Current `profiles cleanup` command exists |
| **Sufficient for v1** | Profile cleanup is rare — only needed when duplicates/strays appear |
| **No scheduled cleanup** | Adds operational complexity |

**Future**: If profile sprawl becomes a problem, add weekly auto-cleanup via cron/lefthook.

---

## 28. Profile Isolation Model

| Decision | Rationale |
|----------|-----------|
| **Separate dirs** | `chrome-profiles/<provider>/<account>/` per provider/account |
| **Chrome enforcement** | Chrome enforces isolation via `--user-data-dir` |
| **No shared state** | No shared state between providers |
| **ProfileAllocator enforcement** | One profile per (provider, account) |

---

## 29. Security Model

| Decision | Rationale |
|----------|-----------|
| **No encryption** | Profiles are local-only |
| **Disk encryption** | BitLocker/FileVault is sufficient |
| **No key management** | Encryption adds complexity |
| **Session tokens only** | Cookie files are not highly sensitive |

**Exception**: If vivim becomes multi-user or cloud-hosted, revisit encryption.

---

## 30. Open Questions & Future Work

### Questions for Next Session

1. **Chrome slave lifecycle skill** — Should we create a dedicated skill that consolidates all Chrome slave management patterns?
2. **Multi-account support** — How should we handle multiple accounts per provider? (current: one account per provider)
3. **Chrome slave pooling** — Pre-warmed slaves for instant availability
4. **Chrome slave telemetry** — Structured logging for performance optimization

### Future Enhancements

1. **Chrome slave health dashboard** — Real-time web view of all slaves
2. **Automated relogin** — System prompts user when session expires
3. **Chrome version monitoring** — Alert when Chrome version is outdated
4. **Profile sprawl detection** — Alert when too many profiles exist
5. **Chrome slave metrics aggregation** — Telemetry for capacity planning

---

## 31. Related Documents

- `specs/033-profile-cleanup/` — Profile cleanup specification
- `src/executor/profile-allocator.ts` — Profile allocation implementation
- `src/executor/fleet-supervisor.ts` — Fleet management implementation
- `src/executor/slave-states.ts` — State machine definition
- `devops/agentic/context-probe.ts` — Preflight context generation
- `devops/runtime-test/ensure-browser.ts` — Browser availability check
- `devops/runtime-test/engage.ts` — Browser engagement
- `devops/profile-cleanup.ts` — Profile cleanup operator

---

## 32. Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-07-21 | Agent | Initial strategic design document from interview session |
| 2026-07-21 | Agent | Added sections 13-20 (State Persistence, Conflicts, Corruption, Sharing, Scalability, Resources, Ports, Cleanup) |
| 2026-07-21 | Agent | Updated sections 24-32 (Metrics, Versioning, Backup, Cleanup, Isolation, Security, Open Questions, Related Docs, Revision History) |

---

**Next Steps**: Review this document with project owner, identify gaps, and create implementation plan for any missing components.
