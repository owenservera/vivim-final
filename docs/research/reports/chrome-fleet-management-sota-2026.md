# Chrome Fleet Management: Research Report
*Generated: 2026-07-19 | Sources: 14 | Confidence: High*

## Executive Summary

Best-practice Chrome fleet management (as implemented by the dominant open-source
and commercial projects — **browserless**, **puppeteer-cluster**, **Steel**,
**Browserbase**, **chromedp**) converges on a small, stable set of patterns:
a **single orchestrator** that owns all browser lifecycle, a **concurrency limiter
with an explicit queue** (admission control), **health-gated admission** (reject
before you overload), **per-session tracking with deferred cleanup**, **auto-restart
on crash with task retry**, and — increasingly for AI-agent workloads —
**persistent authenticated profiles decoupled from the live session**.

vivim-final's `ChromeGovernor` already embodies the "single orchestrator / Governor
Canon" pattern and has circuit breakers + health probes + per-provider fleet config.
The main gaps versus SOTA are: (1) no explicit **admission-control queue** with a
bounded depth, (2) no **system-pressure gate** (CPU/memory) before spawn, (3) no
first-class **task-retry-on-crash** semantics, and (4) **profile pooling** is
directory-based but not modeled as a decoupled, reusable "authenticated profile"
artifact. These are additive, low-risk enhancements — not rewrites.

## 1. The Single-Orchestrator Pattern (Governor Canon)

Every mature project routes **all** browser lifecycle through one component.

- **browserless**: a single `browserless.ts` orchestrator wires DI subsystems
  (config, limiter, auth, `BrowserManager`, metrics, monitoring, webhooks). Routes
  never touch Chrome directly — they declare `browser: BrowserClasses` and the
  `BrowserManager.getBrowserForRequest()` resolves/launches the instance
  ([browserless system architecture](https://zread.ai/browserless/browserless/6-system-architecture)).
- **puppeteer-cluster**: the `Cluster` object is the sole owner; workers only
  receive a `page`/`context` — they never launch or close browsers
  ([puppeteer-cluster README](https://github.com/thomasdondorf/puppeteer-cluster)).

**vivim alignment:** This is exactly the Governor Canon invariant ("Only
`ChromeGovernor` touches CDP. No engine imports `BunCdpClient`."). vivim is
**already SOTA-aligned** on this axis. ✅

## 2. Concurrency Limiting + Explicit Queue (Admission Control)

The single most important fleet pattern is a **`Limiter`** that gates work:

- browserless's `Limiter` extends a queue with two knobs: `CONCURRENT` (max
  simultaneous sessions) and `QUEUED` (max waiting requests). When concurrency is
  full but queue has room → enqueue + fire a `queued` webhook. When both are full
  → reject with **HTTP 429** ([browserless queueing](https://docs.browserless.io/enterprise/long-queues)).
- Production sizing guidance: **`QUEUED` ≈ 1.5–2× `CONCURRENT`**, and a session
  `TIMEOUT`. Keep client concurrency slightly *below* total slots (e.g. 15–16 of
  18) so minor spikes don't fill the queue
  ([production best practices](https://docs.browserless.io/enterprise/docker/best-practices),
  [performance & capacity](https://docs.browserless.io/enterprise/private-deployment/performance)).
- **Queue timeout**: queued requests that don't get a slot in time are rejected
  ([timeouts](https://docs.browserless.io/enterprise/private-deployment/timeouts)).
- puppeteer-cluster models the queue as jobs; `maxConcurrency` bounds parallel
  workers, `workerCreationDelay` staggers spawn to avoid a network/CPU peak at
  start ([puppeteer-cluster](https://github.com/thomasdondorf/puppeteer-cluster)).
- Browserbase adds a **rate window** on top of concurrency: max *new* sessions per
  60s window, independent of active-session cap
  ([Browserbase concurrency](https://docs.browserbase.com/optimizations/concurrency/overview)).

**vivim gap:** `FleetConfig` has `portRange` + circuit-breaker + health-probe, but
no bounded queue / admission gate. Adding a `Limiter`-style gate (max concurrent
slaves per provider, bounded queue, queue timeout) would prevent resource
exhaustion under burst.

## 3. Health-Gated Admission (Fail Fast Before Overload)

browserless evaluates a **priority cascade** at admission time:
`concurrency/queue capacity → CPU overload → memory overload`
([system monitoring](https://zread.ai/browserless/browserless/18-system-monitoring)).

- A `Monitoring` subsystem samples CPU/memory via `systeminformation` and computes
  system "pressure". If `cpuOverloaded || memoryOverloaded`, requests are
  **immediately rejected (429)** and a webhook fires — *before* a browser is spawned
  ([session lifecycle](https://zread.ai/browserless/browserless/10-session-lifecycle-and-tracking)).
- The `/pressure` endpoint exposes this for external load balancers to route away
  from a hot instance.

**vivim gap:** vivim health-probes *existing* slaves (`healthProbeIntervalMs`) but
does not gate *new* spawns on system pressure. A pre-spawn CPU/mem check is a
cheap, high-value addition for local-first stability.

## 4. Per-Session Tracking + Deferred Cleanup

- browserless keeps a **map of active sessions** with a `numbConnected` refcount.
  DevTools/agents can **reconnect** to a live session by tracking id; a session is
  torn down only when `numbConnected` hits 0. Cleanup runs **in parallel**
  (`browser.close()` + deregister + clear timers). A `timers` Map holds **deferred
  cleanup timers** keyed by session id, giving a grace window for reconnect
  ([session lifecycle](https://zread.ai/browserless/browserless/10-session-lifecycle-and-tracking)).
- Known failure mode to design against: **"stuck `undefined` sessions"** that
  accumulate when tracking ids aren't assigned, and zombie processes when signals
  aren't forwarded ([browserless issue #5103](https://github.com/browserless/browserless/issues/5103)).

**vivim alignment:** vivim tracks slaves + fleet events + trace per slave (good).
The reconnect-by-refcount + deferred-cleanup-grace-window is a pattern worth
adopting so provider tabs can be reattached instead of relaunched.

## 5. Crash Recovery + Task Retry

- puppeteer-cluster **auto-restarts the browser on crash** and can **retry the job**
  (`retryLimit`, `retryDelay`). The `taskerror` event carries `(err, data,
  willRetry)` so callers can log/route retries. `CONCURRENCY_BROWSER` isolates each
  job in its own browser so one crash can't affect other jobs
  ([puppeteer-cluster](https://github.com/thomasdondorf/puppeteer-cluster)).
- `sameDomainDelay` and `skipDuplicateUrls` are politeness/dedup guards.

**vivim gap:** vivim has circuit breakers + `send-resilience` but retry-on-crash is
not modeled as a first-class fleet primitive with a bounded `retryLimit` and a
`willRetry` signal back to the caller.

## 6. Process Hygiene (Zombie Reaping, Signal Forwarding)

- browserless runs Node under **`dumb-init`** so SIGTERM/SIGINT are forwarded and
  zombie processes are reaped — essential for graceful shutdown; and uses
  `dbus-run-session` for proper session-bus lifecycle
  ([base image build](https://zread.ai/browserless/browserless/23-base-image-build-process)).
- Common `chromedp` pitfall: Chrome processes not closing when run in a
  wait-group/pool without explicit `cancel()`/`Close()`
  ([chromedp #234](https://github.com/chromedp/chromedp/issues/234)).

**vivim relevance:** On Windows, the equivalent is ensuring child Chrome PIDs are
tracked and killed on governor shutdown / stop-all. Worth an explicit reaper.

## 7. Concurrency Isolation Models

puppeteer-cluster's three models map cleanly onto fleet-design choices:

| Model | Isolation | Shared state | vivim analog |
|-------|-----------|--------------|--------------|
| `CONCURRENCY_PAGE` | tab per job | cookies/localStorage shared | multiple tabs, one profile |
| `CONCURRENCY_CONTEXT` | incognito context per job | none | ephemeral discovery |
| `CONCURRENCY_BROWSER` | full browser per job | none; crash-isolated | **one Chrome per provider profile** ← vivim today |

**vivim alignment:** vivim's "one authenticated Chrome per provider account" is the
`CONCURRENCY_BROWSER` model — the strongest isolation, correct for logged-in
provider sessions where crash-isolation and cookie-separation matter.

## 8. Persistent Authenticated Profiles (AI-Agent Frontier)

The newest, most vivim-relevant trend: **decouple login state from the live
session**.

- **browserless "Authenticated Profiles"**: capture a logged-in browser's auth
  state once, then inject it into any future session — separating credentials from
  the ephemeral browser ([browserless auth profiles](https://www.browserless.io/blog/introducing-authenticated-profiles)).
- **Steel "Profiles"**: persistent browser identity across sessions; agents reuse
  authenticated state on every run ([Steel profiles](https://steel.dev/blog/profiles)).
- **Browserbase "Contexts"**: save/reuse auth state to skip repeated logins
  ([Browserbase context](https://browserbase.com/templates/context)).
- **browser-use / Notte / Kernel**: same theme — "login once → persist profile →
  reuse forever until expiration" ([Playwright profile persistence](https://dev.to/amals367/persisting-login-sessions-in-headless-playwright-automation-k07),
  [Notte session profiles](https://www.notte.cc/blog/session-profiles-persistent-authentication-for-browser-agents)).

**vivim alignment + gap:** vivim already does directory-based profile persistence
(`chrome-profiles/<providerSlug>/<accountId>` + `.profile-meta.json` +
`ProfileAllocator.isAuthenticated`). This is **ahead of most** — it's the canonical
"persist profile, reuse forever" pattern. The SOTA delta is treating the profile as
a **first-class, portable artifact** (capture / inject / expire) rather than only a
bound-to-disk directory, enabling snapshot/restore and expiry tracking.

## Key Takeaways

- **Keep the Governor Canon** — vivim is already SOTA on single-orchestrator + CDP
  mediation. Do not dilute it.
- **Add a `Limiter`** — bounded per-provider concurrency + queue depth (≈1.5–2×
  concurrency) + queue timeout. Highest-value gap.
- **Add pre-spawn pressure gate** — reject/queue new slaves when local CPU/mem is
  overloaded; expose a `/pressure`-style signal.
- **Model task retry-on-crash** — `retryLimit`/`retryDelay` + a `willRetry` signal,
  reusing existing circuit-breaker state.
- **Deferred cleanup + reconnect** — refcount sessions, grace-window before teardown,
  reattach provider tabs instead of relaunching.
- **Process reaper on Windows** — track child Chrome PIDs, kill on shutdown to avoid
  zombies (the cross-platform analog of `dumb-init`).
- **Elevate profiles to artifacts** — capture/inject/expire auth state; vivim is
  already close.

## Sources

1. [browserless/browserless (GitHub)](https://github.com/browserless/browserless) — reference Chrome fleet in Docker; orchestrator + limiter + browser manager.
2. [browserless system architecture (zread)](https://zread.ai/browserless/browserless/6-system-architecture) — DI subsystem wiring, BrowserManager.
3. [browserless session lifecycle (zread)](https://zread.ai/browserless/browserless/10-session-lifecycle-and-tracking) — refcount, deferred cleanup, health-gated admission.
4. [browserless system monitoring (zread)](https://zread.ai/browserless/browserless/18-system-monitoring) — CPU/mem pressure, priority cascade.
5. [browserless queueing docs](https://docs.browserless.io/enterprise/long-queues) — CONCURRENT/QUEUED env knobs.
6. [browserless production best practices](https://docs.browserless.io/enterprise/docker/best-practices) — sizing (1.5–2× queue), timeouts.
7. [browserless performance & capacity](https://docs.browserless.io/enterprise/private-deployment/performance) — slot headroom guidance.
8. [browserless timeouts](https://docs.browserless.io/enterprise/private-deployment/timeouts) — queue timeout semantics.
9. [browserless base image build (zread)](https://zread.ai/browserless/browserless/23-base-image-build-process) — dumb-init zombie reaping, signal forwarding.
10. [browserless authenticated profiles](https://www.browserless.io/blog/introducing-authenticated-profiles) — decoupled auth state.
11. [thomasdondorf/puppeteer-cluster (GitHub)](https://github.com/thomasdondorf/puppeteer-cluster) — worker pool, retry, crash restart, concurrency models.
12. [Browserbase concurrency overview](https://docs.browserbase.com/optimizations/concurrency/overview) — rate window on top of concurrency.
13. [Steel.dev profiles](https://steel.dev/blog/profiles) — persistent authenticated identity.
14. [chromedp #234 (GitHub)](https://github.com/chromedp/chromedp/issues/234) — pool shutdown / process-not-closing pitfall.

## Methodology

Ran 5 web searches (web-search-prime) across fleet management, pooling,
concurrency/queue, crash recovery, and persistent-profile topics. Deep-read the two
authoritative OSS repos (browserless, puppeteer-cluster) via repo doc search and
README, cross-referencing claims against official docs. Cross-referenced vivim's
current `FleetConfig`, `GovernorStore`/`ProviderFleetConfig`, Governor Canon
invariant, and `chrome-profiles/` layout. Single-source claims are flagged inline;
all architectural patterns appear in ≥2 independent sources.
