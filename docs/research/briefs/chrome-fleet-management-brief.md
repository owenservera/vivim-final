# Chrome Fleet Management — Brief

**Source:** [full report](../reports/chrome-fleet-management-sota-2026.md)
**Confidence:** High | **Sources:** 14 | **Date:** 2026-07-19

## TL;DR

Mature Chrome-fleet projects (browserless, puppeteer-cluster, Steel, Browserbase)
converge on: **single orchestrator owns all lifecycle**, **bounded concurrency +
queue with admission control**, **health-gated (CPU/mem) spawns**, **refcounted
sessions with deferred cleanup + reconnect**, **auto-restart + task retry on crash**,
and **persistent auth profiles decoupled from the live session**. vivim's
`ChromeGovernor` is already SOTA on the single-orchestrator (Governor Canon) axis and
on directory-based persistent profiles; the real gaps are the admission queue,
pre-spawn pressure gate, and first-class task-retry.

## Key Decisions

1. **Keep Governor Canon as-is** — vivim already matches SOTA (single CDP mediator).
   No change; protect the invariant.
2. **Add a per-provider `Limiter`** to `FleetConfig`: `maxConcurrent`, `maxQueued`
   (≈1.5–2× concurrent), `queueTimeoutMs`. Reject overflow instead of overloading.
3. **Add a pre-spawn pressure gate** — check local CPU/mem before spawning a slave;
   defer or reject when overloaded (browserless priority cascade:
   queue-capacity → CPU → memory).
4. **Model task retry-on-crash** as a fleet primitive (`retryLimit`, `retryDelay`,
   `willRetry` signal), reusing existing circuit-breaker + `send-resilience`.
5. **Deferred cleanup + reconnect** — refcount provider tabs, grace-window before
   teardown, reattach instead of relaunch.
6. **Windows process reaper** — track child Chrome PIDs, kill on governor shutdown
   (cross-platform analog of browserless's `dumb-init` zombie reaping).
7. **Elevate profiles to portable artifacts** — capture/inject/expire auth state
   (vivim is already close with `.profile-meta.json` + `ProfileAllocator`).

## Evidence Summary

- browserless `Limiter`: CONCURRENT + QUEUED knobs, 429 on overflow, queue ≈1.5–2×
  concurrent (High — official docs + repo).
- browserless admission cascade: queue-capacity → CPU-overload → memory-overload,
  reject before spawn (High — zread system-monitoring + session-lifecycle).
- puppeteer-cluster: auto-restart on crash, `retryLimit`/`retryDelay`, `taskerror`
  with `willRetry`; `CONCURRENCY_BROWSER` = crash-isolated per-job browser (High —
  README).
- Persistent auth profiles decoupled from session is the AI-agent frontier pattern
  (High — browserless/Steel/Browserbase/Notte, 4 independent sources).
- vivim's "one Chrome per provider profile" = puppeteer-cluster `CONCURRENCY_BROWSER`
  model (strongest isolation; correct for logged-in sessions) (High — cross-ref).
- Zombie/stuck-session failure modes are real and must be designed against (Medium —
  browserless issues #5103, chromedp #234).

## Open Questions

- Should the `Limiter` live inside `ChromeGovernor` or as a thin gate engine calling
  the governor (to preserve Governor Canon)? (Leaning: inside governor / governor-
  owned to avoid a second CDP surface.)
- What CPU/mem thresholds fit a local-first Windows dev machine vs. a server?
- Does vivim want session *reconnect* (refcount) given each provider is a long-lived
  single tab, or is relaunch-on-death sufficient?
- Profile expiry: track auth-state TTL, or rely on `ProfileAllocator.isAuthenticated`
  cookie check at spawn?

## Used In

- (proposed) ADR: "ChromeGovernor admission control & fleet limiter"
- (proposed) Unit: extend `FleetConfig` with concurrency/queue/pressure fields
- Informs: `src/engines/chrome-governor.ts`, `src/executor/fleet-config.ts`,
  `src/storage/contracts/governor-store.ts` (`ProviderFleetConfig`)
