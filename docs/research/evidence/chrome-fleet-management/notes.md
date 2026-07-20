# Chrome Fleet Management — Raw Notes

## vivim current state (baseline, from repo scan 2026-07-19)

- `src/executor/fleet-config.ts` — `FleetConfig`: `chromePath`, `portRange
  {start,end}`, `healthProbeIntervalMs`, `circuitBreakerThreshold`,
  `circuitBreakerResetMs`. **No queue / concurrency-cap / pressure fields.**
- `src/storage/contracts/governor-store.ts` — `ProviderFleetConfig`: `channel`,
  `mode`, `extraArgs`, `portRange`. Per-provider config exists but is launch-args
  focused, not admission-control.
- Governor Canon invariant (AGENTS.md): only `ChromeGovernor` touches CDP; engines
  depend on `GovernorStore` contract. **This matches SOTA single-orchestrator.**
- `chrome-profiles/<providerSlug>/<accountId>` + `.profile-meta.json`;
  `ProfileAllocator.isAuthenticated` checks Cookies. **This is the "persist profile,
  reuse forever" SOTA pattern already.**
- Existing resilience: `send-resilience.ts`, circuit-breaker state via
  `GovernorStore.getCircuitState/upsertCircuitState`, health ticks, trace entries.
- One-account-per-provider steady state = `CONCURRENCY_BROWSER` model.

## Pattern extraction (cross-project)

### Admission control (the big gap)
- browserless: Limiter = queue + CONCURRENT + QUEUED. Overflow => 429 + webhook.
- Sizing: QUEUED ~ 1.5-2x CONCURRENT. Keep client concurrency below total slots.
- Queue timeout on top of session timeout.
- Browserbase: also a *rate window* (new sessions / 60s) distinct from active cap.

### Health gate (second gap)
- Priority cascade at admission: queue-capacity -> CPU -> memory.
- Reject BEFORE spawning. `/pressure` endpoint for external LBs.
- vivim probes existing slaves but not pre-spawn system pressure.

### Crash recovery / retry (third gap)
- puppeteer-cluster auto-restarts browser + retries task (retryLimit/retryDelay).
- taskerror event => (err, data, willRetry). Callers decide logging/routing.
- CONCURRENCY_BROWSER isolates crashes per job.

### Session tracking
- refcount (numbConnected); teardown only at 0.
- deferred cleanup timers keyed by session id (grace window for reconnect).
- reconnect-by-tracking-id instead of relaunch.

### Process hygiene
- dumb-init for signal forwarding + zombie reaping (Linux/Docker).
- Windows analog: track child Chrome PIDs, kill on shutdown.
- Failure modes: stuck `undefined` sessions (#5103), chrome not closing (chromedp #234).

### Profiles as artifacts (frontier, vivim already close)
- Decouple auth state from live session: capture / inject / expire.
- Steel/Browserbase/Notte/Kernel all ship this. Pattern: "login once -> persist ->
  reuse forever until expiration."

## Convergence status
- CONFIRMED code-level pattern for a Limiter + retry primitive (from
  puppeteer-cluster public API + browserless env semantics). See code-path file.
- Not prototyped inside vivim yet — recommend a spike wiring the Limiter into
  ChromeGovernor.spawn() to preserve Governor Canon.
