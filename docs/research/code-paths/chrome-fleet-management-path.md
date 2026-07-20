# Chrome Fleet Management — Confirmed Code Path

**Convergence:** PROBABLE
**Iterations:** 3 | **Confidence:** Medium-High
**Date:** 2026-07-19

## Recommended Approach

Add a **governor-owned admission `Limiter`** (bounded concurrency + queue + queue
timeout) and a **pre-spawn pressure gate**, then wrap spawn with **retry-on-crash**
semantics — all *inside* `ChromeGovernor` so the Governor Canon invariant ("only
ChromeGovernor touches CDP / owns lifecycle") is preserved. The shape is proven by
browserless's `Limiter` (env-driven CONCURRENT/QUEUED) and puppeteer-cluster's
`retryLimit`/`retryDelay`/`taskerror(willRetry)` public API.

## Working Code Example

```typescript
// src/executor/fleet-config.ts — extend FleetConfig (additive, backward compatible)
export interface FleetConfig {
  chromePath?: string | null
  portRange: { start: number; end: number }
  healthProbeIntervalMs: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
  // ── admission control (SOTA: browserless Limiter) ──
  maxConcurrent?: number       // active slaves cap (default: portRange size)
  maxQueued?: number           // queue depth; SOTA guidance ~1.5-2x maxConcurrent
  queueTimeoutMs?: number      // reject if no slot within this window
  // ── pre-spawn pressure gate (SOTA: browserless priority cascade) ──
  cpuOverloadPct?: number      // e.g. 90 — reject/defer spawn above this
  memOverloadPct?: number      // e.g. 90
  // ── crash recovery (SOTA: puppeteer-cluster) ──
  retryLimit?: number          // task retries on slave crash (default 0)
  retryDelayMs?: number
}
```

```typescript
// src/executor/limiter.ts — governor-owned admission gate (no CDP here)
// Pattern source: browserless Limiter (queue + concurrency + timeout).
export class FleetLimiter {
  private active = 0
  private readonly waiters: Array<{
    resolve: () => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  }> = []

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number,
    private readonly queueTimeoutMs: number,
  ) {}

  /** Acquire a slot or throw. Caller MUST call release() in finally. */
  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++
      return
    }
    if (this.waiters.length >= this.maxQueued) {
      // browserless: overflow => reject (HTTP 429 analog)
      throw new Error('FLEET_QUEUE_FULL')
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.timer === timer)
        if (i >= 0) this.waiters.splice(i, 1)
        reject(new Error('FLEET_QUEUE_TIMEOUT'))
      }, this.queueTimeoutMs)
      this.waiters.push({ resolve, reject, timer })
    })
    this.active++
  }

  release(): void {
    this.active = Math.max(0, this.active - 1)
    const next = this.waiters.shift()
    if (next) {
      clearTimeout(next.timer)
      next.resolve()
    }
  }

  stats() {
    return { active: this.active, queued: this.waiters.length }
  }
}
```

```typescript
// Inside ChromeGovernor.spawn() — admission + pressure + retry wrapper (sketch)
async spawn(providerSlug: string, accountId: string): Promise<SlaveStatus> {
  // 1) pressure gate (SOTA cascade: queue -> CPU -> memory), reject before spawn
  const pressure = await this.readSystemPressure()   // os.loadavg / process mem, cheap
  if (pressure.cpuPct > (this.config.cpuOverloadPct ?? 100) ||
      pressure.memPct > (this.config.memOverloadPct ?? 100)) {
    await this.store.createFleetEvent({ slaveId: 'n/a', kind: 'spawn_rejected_pressure' })
    throw new Error('FLEET_PRESSURE_OVERLOAD')
  }
  // 2) admission (bounded concurrency + queue)
  await this.limiter.acquire()
  try {
    // 3) retry-on-crash (SOTA: puppeteer-cluster retryLimit/retryDelay)
    const retryLimit = this.config.retryLimit ?? 0
    let lastErr: unknown
    for (let attempt = 0; attempt <= retryLimit; attempt++) {
      try {
        return await this.launchAndTrack(providerSlug, accountId)  // the ONLY CDP path
      } catch (e) {
        lastErr = e
        await this.store.createFleetEvent({ slaveId: 'n/a', kind: 'spawn_retry' })
        if (attempt < retryLimit) await Bun.sleep(this.config.retryDelayMs ?? 0)
      }
    }
    throw lastErr
  } finally {
    this.limiter.release()
  }
}
```

## Why This Works

1. **Governor Canon preserved** — `FleetLimiter` and the pressure read contain **no
   CDP**; only `launchAndTrack()` touches Chrome. The invariant holds. (vivim
   AGENTS.md invariant + browserless single-orchestrator, 2 sources.)
2. **Limiter shape is proven** — browserless's `Limiter` is exactly acquire/queue/
   reject with CONCURRENT + QUEUED ([queueing docs](https://docs.browserless.io/enterprise/long-queues)).
3. **Retry shape is proven** — puppeteer-cluster's `retryLimit`/`retryDelay` +
   auto-restart is the canonical crash-recovery primitive
   ([puppeteer-cluster](https://github.com/thomasdondorf/puppeteer-cluster)).
4. **Additive & backward compatible** — all new `FleetConfig` fields are optional;
   defaults preserve current behavior.

## Prerequisites

- `src/executor/fleet-config.ts` field additions (optional fields only).
- A cheap local pressure read (`os.loadavg()`, `process.memoryUsage()` / `os.freemem`
  / `os.totalmem`) — no new deps. (browserless uses `systeminformation`; vivim can
  start with Node `os` to avoid a dependency.)
- New `FleetEvent` kinds: `spawn_rejected_pressure`, `spawn_retry`,
  `queue_full`, `queue_timeout` (extends existing `createFleetEvent`).

## Known Gotchas

- **Windows zombie Chrome** — always kill tracked child PIDs on governor shutdown;
  the `finally { limiter.release() }` must run even on throw (cross-platform analog
  of `dumb-init`). Mitigation: track PIDs in slave records, reap on stop-all.
  ([chromedp #234](https://github.com/chromedp/chromedp/issues/234))
- **Stuck sessions** — assign a stable tracking id per slave so queue/cleanup never
  keys on `undefined` (browserless #5103). vivim already has slave ids — reuse them.
- **Queue starvation** — set `queueTimeoutMs` so callers fail fast rather than hang.
- **Double release** — guard `release()` with `Math.max(0, ...)` (shown above).

## Alternatives Considered

| Approach | Why Rejected | Source |
|----------|--------------|--------|
| Adopt puppeteer-cluster wholesale | Second CDP surface; violates Governor Canon; vivim uses raw CDP not Puppeteer | puppeteer-cluster README |
| Run browserless as a sidecar service | Heavy (Docker), remote CDP, breaks local-first + per-provider profile model | browserless repo |
| Limiter as a separate engine calling governor | Would create a lifecycle owner outside the governor; keep it governor-owned | vivim Governor Canon |
| `systeminformation` dep for pressure | Extra dependency; Node `os` is sufficient for local-first v1 | browserless monitoring |

## Verification Steps

1. Unit-test `FleetLimiter`: acquire up to `maxConcurrent`, queue up to `maxQueued`,
   reject `FLEET_QUEUE_FULL` on overflow, `FLEET_QUEUE_TIMEOUT` after
   `queueTimeoutMs`, correct release/handoff. (Mirror `tests/unit/engines/chrome-governor.test.ts` style.)
2. Integration: spawn N+1 slaves against a mock with `maxConcurrent=N`; assert the
   N+1th queues then proceeds after a release.
3. Pressure gate: stub `readSystemPressure()` above threshold → assert
   `FLEET_PRESSURE_OVERLOAD` and a `spawn_rejected_pressure` FleetEvent.
4. Retry: make `launchAndTrack` fail once with `retryLimit=1` → assert one
   `spawn_retry` event then success.

## Risk Assessment

- **Technical risk:** Low — additive, in-process, no new transport, no new deps.
- **Integration risk:** Medium — must thread through `ChromeGovernor.spawn()` and
  `ProviderFleetConfig`; needs an ADR (A6) since it changes fleet behavior.
- **Maintenance risk:** Low — small, well-tested primitives mirroring proven OSS APIs.
