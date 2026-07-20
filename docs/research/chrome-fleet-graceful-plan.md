# Chrome Fleet — Graceful Admission Control & Crash Recovery

**Plan date:** 2026-07-19
**Scope:** Add 3 SOTA fleet capabilities to `FleetSupervisor` (limiter, pressure gate,
first-class retry-on-crash) + Windows orphan reaper hardening. All governor-owned;
**Governor Canon preserved** (no new CDP surface).

**Grounded in code (read, not assumed):**
- `src/executor/fleet-supervisor.ts:182` — `spawn()` is the real entry; `ChromeGovernor.spawn`
  (chrome-governor.ts:777) delegates to it.
- `FleetSupervisorOptions` (fleet-supervisor.ts:35) is the live config bag → admit fields here.
- Restart machinery already exists: `consecutiveFailures`, `autoRestart`, `maxRestarts`,
  `CircuitOpenError` (lines 295-311, 88-93). Retry-on-crash **extends** this, does not fork it.
- `PortReaper` (port-reaper.ts) already tracks PIDs → reuse for Windows reaper.
- `FleetEventInput.eventType` is a free string → new event types are additive, no schema break.

---

## Design Principles (the "graceful" part)

1. **Fail soft, fail loud.** Every rejection/queue/timeout emits a `FleetEvent` and a typed
   error so callers can react instead of hanging.
2. **Backward compatible by default.** All new `FleetSupervisorOptions` fields are **optional**
   with safe defaults → current behavior unchanged when unset.
3. **No new deps.** Pressure read uses Node `os` only. Limiter is ~60 lines of in-process code.
4. **Governor Canon.** `FleetLimiter` + pressure read contain **zero CDP**. Only `launchChrome`
   (inside `spawn`) touches Chrome.
5. **One owner of lifecycle.** Limiter/gate live *inside* `FleetSupervisor`, not a sibling engine.

---

## Component 1 — `FleetLimiter` (admission control)

**File:** `src/executor/fleet-limiter.ts` (new, ~70 lines, no CDP)
**Pattern:** browserless `Limiter` (acquire / queue / reject) — proven OSS shape.

### Config (added to `FleetSupervisorOptions`)
```typescript
maxConcurrent?: number   // default: portRange span (current effective cap)
maxQueued?: number       // default: maxConcurrent * 2  (SOTA 1.5–2x)
queueTimeoutMs?: number  // default: 30_000 — fail fast, never hang
```

### Behavior
- `acquire()`: if `active < maxConcurrent` → `active++`, return.
- else if `waiters.length >= maxQueued` → throw `FleetQueueFullError` (HTTP-429 analog).
- else → enqueue a waiter with a `queueTimeoutMs` timer; on fire → throw `FleetQueueTimeoutError`.
- `release()`: `active = max(0, active-1)`; hand slot to next waiter (clear its timer, resolve).
- `stats()`: `{ active, queued }` for health dashboards.

### New error classes (in fleet-supervisor.ts, beside existing errors)
```typescript
export class FleetQueueFullError extends Error { /* 429 analog */ }
export class FleetQueueTimeoutError extends Error { /* caller fails fast */ }
```

### New FleetEvent types
`queue_full`, `queue_timeout` (emitted by supervisor when limiter throws).

---

## Component 2 — Pressure Gate (pre-spawn)

**File:** `src/executor/system-pressure.ts` (new, ~40 lines) — or inline helper in supervisor.
**Pattern:** browserless priority cascade (check host load *before* spending a Chrome).

### Config
```typescript
cpuOverloadPct?: number   // default: 100 (disabled)
memOverloadPct?: number   // default: 100 (disabled)
```

### Behavior
- `readSystemPressure()`: cheap `os.loadavg()` → normalize to `%` of core count;
  `os.freemem()/os.totalmem()` → used `%`. No new dependency.
- In `spawn()`, **before** `limiter.acquire()`:
  ```typescript
  const p = readSystemPressure()
  if (p.cpuPct > (cfg.cpuOverloadPct ?? 100) || p.memPct > (cfg.memOverloadPct ?? 100)) {
    await store.createFleetEvent({ slaveId: id, eventType: 'spawn_rejected_pressure', ... })
    throw new FleetPressureOverloadError(p)
  }
  ```
- Gates even a queued caller (don't burn a queue slot on a host that can't sustain it).

### New error class
```typescript
export class FleetPressureOverloadError extends Error { constructor(public pressure: {...}) {...} }
```

### New FleetEvent type
`spawn_rejected_pressure`.

---

## Component 3 — First-class Retry-on-Crash

**Grounded:** restart logic already exists for `ensureRunning` (crashed/error → respawn up to
`maxRestarts`). The gap is the **initial** `spawn()` body (lines 216-257) which tries launch
*once* and falls through to `status:'error'`. We wrap the launch in a bounded retry loop.

### Config
```typescript
spawnRetryLimit?: number   // default: 0 (preserve current single-attempt behavior)
spawnRetryDelayMs?: number // default: 1000, exponential backoff base
```

### Behavior (wraps `launchChrome` call at fleet-supervisor.ts:223)
```typescript
let lastErr: unknown
for (let attempt = 0; attempt <= (cfg.spawnRetryLimit ?? 0); attempt++) {
  try {
    const result = await launchChrome(launchOpts)
    instance.pid = result.pid
    instance.debugPort = result.debugPort
    instance.status = 'running'
    instance.consecutiveFailures = 0
    this.portReaper.trackPid(result.debugPort, result.pid)
    // ... navigation + 'spawned' event (existing)
    return instance
  } catch (err) {
    lastErr = err
    instance.consecutiveFailures++
    await store.createFleetEvent({ slaveId: id, eventType: 'spawn_retry',
      detailJson: JSON.stringify({ attempt, error: String(err) }) })
    if (attempt < (cfg.spawnRetryLimit ?? 0)) {
      await Bun.sleep((cfg.spawnRetryDelayMs ?? 1000) * 2 ** attempt)  // exp backoff
    }
  }
}
instance.status = 'error'
// existing spawn_failed event, then return instance
```

- Reuses `consecutiveFailures` counter (already on `FleetInstance`) — no new field.
- Distinct from `autoRestart`/`maxRestarts`: those cover *runtime* crash in `ensureRunning`;
  this covers *launch* failure at spawn time. Both share the same counter + circuit breaker,
  so they compose instead of conflicting.

### New FleetEvent type
`spawn_retry`.

---

## Component 4 — Windows Orphan Reaper (hardening)

**Grounded:** `port-reaper.ts` already `trackPid(port, pid)` + `killExistingChromeForProfile`
(fleet-supervisor.ts:160-180) does best-effort `process.kill`. The gap: no tree-reap of the
Chrome **child** processes (renderer/gpu helpers) on governor shutdown, and no reaper registered
on `process.on('exit')`.

### Changes
- In `kill()` / `killAll()`: after `killChrome(pid)`, also call a
  `portReaper.reapTree(pid)` that walks child PIDs (Windows: `wmic`/`tasklist`; POSIX: `ps -o ppid`)
  and SIGKILLs them. Bounded, best-effort, never throws.
- Register `process.once('beforeExit' | 'SIGTERM' | 'SIGINT', () => supervisor.killAll())`
  once at `FleetSupervisor` construction (idempotent guard so it isn't double-registered in tests).
- Reuse existing `killExistingChromeForProfile` as the SingletonLock safety net — already present.

---

## Wiring Summary

| Concern | Where | Touch CDP? |
|---------|-------|-----------|
| `FleetLimiter` | `fleet-limiter.ts` (new) + `spawn()` | No |
| Pressure gate | `system-pressure.ts` (new) + `spawn()` | No |
| Retry-on-crash | `spawn()` loop (extend existing) | Only `launchChrome` |
| Orphan reaper | `port-reaper.ts` + `killAll` + `beforeExit` | No (kill only) |
| Config fields | `FleetSupervisorOptions` (additive) | — |
| Events | `createFleetEvent` (new eventType strings) | — |

---

## Tests (mirror `tests/unit/engines/chrome-governor.test.ts` style)

1. **Limiter unit** — acquire to `maxConcurrent`, (N+1)th queues, overflow →
   `FleetQueueFullError`, timeout → `FleetQueueTimeoutError`, release hands off correctly.
2. **Pressure gate** — stub `readSystemPressure` above threshold → `FleetPressureOverloadError`
   + `spawn_rejected_pressure` event; below threshold → proceeds.
3. **Retry** — `launchChrome` throws once with `spawnRetryLimit=1` → one `spawn_retry` event then
   success; throws twice → `spawn_failed` + `error` status.
4. **Reaper** — `killAll` on a mocked PID tree → all child PIDs receive kill (Windows path
   fenced behind `process.platform === 'win32'` with a POSIX equivalent).
5. **Integration** — `maxConcurrent=2`, spawn 4 concurrently → 2 running, 2 queued, then drain as
   releases happen; assert `stats()` transitions.

---

## Rollout (graceful, low-blast)

1. Land `FleetLimiter` + `system-pressure.ts` + new errors/events — **default-disabled** (thresholds
   at 100, retryLimit 0). Zero behavior change until configured.
2. Wire `FleetSupervisorOptions` defaults in the single construction site (find via grep of
   `new FleetSupervisor(`).
3. Add tests; run `bun test`.
4. Draft ADR "ChromeGovernor admission control & fleet limiter" (CROSS-REF.md row 📋 Draft → 🟢).
5. Opt-in via `ProviderFleetConfig` / env only after tests green — no forced enable.

## Risk
- **Technical:** Low — additive, in-process, no deps, no transport change.
- **Integration:** Medium — must thread options through the one `FleetSupervisor` constructor and
  keep `ChromeGovernor.spawn` delegation intact. Covered by tests 1–5.
- **Canon:** None — CDP still only via `launchChrome` / `BunCdpClient`.
