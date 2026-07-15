# PRD: Chrome Slave System

- **Status:** Draft
- **Author:** Product Management (vivim-final)
- **Last Updated:** 2026-07-14
- **Feature Name:** Chrome Slave System

---

## 1. Feature Name

**Chrome Slave System** — the runtime subsystem that launches, authenticates, supervises, and repairs isolated per-provider Chrome browser instances ("slaves") used by the platform to drive provider conversations (e.g. `claude`, `chatgpt`, `gemini`) through their real web UIs.

---

## 2. Epic

- **Epic:** Chrome Fleet & Governance (`chrome-fleet`)
- **Parent Epic Document:** [`docs/merged-design-v2/01-merged-epic.md`](../../../merged-design-v2/01-merged-epic.md)
- **Parent Architecture Document:** [`docs/merged-design-v2/02-merged-architecture.md`](../../../merged-design-v2/02-merged-architecture.md)
- **Related Engine Spec (ChromeGovernor / Chrome Layer):** [`docs/merged-design-v2/04-merged-engines.md`](../../../merged-design-v2/04-merged-engines.md)

The Chrome Slave System is the concrete execution layer that realizes the **ChromeGovernor** responsibility in the 13-engine architecture: it is the *only* component permitted to spawn and manage Chrome processes and CDP connections for provider browsers (Governor Canon invariant).

---

## 3. Goal

### Problem

The platform needs to operate provider chat surfaces (Claude, ChatGPT, Gemini, …) as first-class, automatable runtimes. These providers are gated behind authenticated web sessions protected by Cloudflare / OAuth and do not expose a stable, scriptable API. Without a managed browser layer, every session would require a fresh manual login, crashes would go undetected, and concurrent provider usage would race for ports and profiles. Today the platform has no unified concept of a "running browser for provider X."

### Solution

Introduce a **Chrome Slave System**: a supervised fleet of per-provider Chrome instances, each bound to a dedicated, persistent profile directory and debug port. The system:

- Launches a slave on demand and detects **first run** (no persisted session) to open a **visible** browser for a one-time manual login; the resulting session cookies persist in the profile directory.
- Reuses the persisted, authenticated profile on all subsequent launches in **headless** mode so the provider session survives restarts.
- Continuously health-checks each slave and **auto-restarts** crashed or unhealthy slaves with exponential backoff, escalating to a terminal error state only after exhausting retries.
- Guards against thundering herds with a **circuit breaker** per slave.
- Arms a **read/observe layer** over the live page via CDP so the platform can capture conversation state from the provider UI.

### Impact

- **Login friction:** from "log in every launch" → "log in once per provider, then transparent."
- **Reliability:** crash-to-recover time bounded by backoff schedule (target < 30s for transient crashes).
- **Observability:** real-time slave status broadcast to operators/clients.
- **Safety:** exactly one browser per provider; no orphaned processes; clean teardown.

---

## 4. User Personas

1. **End User (Chat Operator)** — wants to send messages to a provider and get responses without thinking about browsers, logins, or crashes.
2. **Platform / Site Reliability Engineer** — owns the fleet; needs crashes surfaced, auto-healed, and debuggable; needs a single status view.
3. **Agent / Capability Runtime** — drives a provider browser programmatically via a stable debug port and reads conversation state from the UI.
4. **Privacy-Conscious Operator** — requires that each provider's session stays isolated in its own profile and is never cross-shared.

---

## 5. User Stories

- As an **End User**, I want to start a conversation with `claude` and have the browser already authenticated, so that I never re-enter my password.
- As an **End User**, I want to be prompted to log in exactly once (in a visible browser) on first use, so that subsequent use is seamless.
- As a **Platform Engineer**, I want a slave that crashes to be automatically respawned, so that provider conversations stay available.
- As a **Platform Engineer**, I want repeated failures to stop retrying and report a terminal error, so that I am not silently burning resources.
- As a **Platform Engineer**, I want real-time status (running / unhealthy / circuit-open) for every provider, so that I can monitor fleet health.
- As an **Agent**, I want a stable, known debug port for an active provider slave, so that I can attach CDP and drive the UI deterministically.
- As a **Privacy-Conscious Operator**, I want each provider's cookies and profile strictly isolated, so that one provider cannot read another's session.
- As an **End User**, I want to trigger a re-login (e.g. after session expiry) without restarting the whole platform, so that recovery is self-service.

---

## 6. Requirements

### 6.1 Functional Requirements

**Fleet & Lifecycle**
- FR-1: The system MUST maintain one supervised browser instance ("slave") per registered provider (e.g. `claude`, `chatgpt`, `gemini`).
- FR-2: Each slave MUST expose a stable, provider-specific debug port for CDP attachment.
- FR-3: The system MUST support at least the lifecycle states `stopped → starting → running → (unhealthy | restarting | error | circuit_open) → stopped`, with an aggregate `super-state` of `idle | active | degraded | terminal`.
- FR-4: The system MUST allow a slave to be started on demand (`ensure`) and stopped explicitly (`stop` / `kill`), and MUST support a clean shutdown of the whole fleet.
- FR-5: Launching a slave MUST first free any process already bound to its debug port (kill-by-port) before spawning, to avoid port collisions.

**Profile & Authentication**
- FR-6: Each provider MUST be bound to a dedicated, persistent profile directory (the "user data dir") that survives restarts.
- FR-7: The system MUST detect **first run** for a provider (no authenticated session present in the profile) and, on first run, launch the browser in **visible** mode with a clear prompt for the user to log in.
- FR-8: After a successful manual login, the provider session (cookies / tokens) MUST persist in the profile directory so that subsequent launches — including **headless** launches — reuse the authenticated session without re-login.
- FR-9: When a slave is already running, a request to make it visible for re-login MUST restart it in visible mode rather than spawning a second instance.
- FR-10: The system MUST provide a `recoverAuth` / re-login path that, for a not-logged-in provider, launches a visible browser for manual authentication.
- FR-11: Stale Chrome singleton locks in a profile directory MUST be cleared before launch to prevent "profile already in use" failures.

**Launch Mechanics (conceptual)**
- FR-12: Launch arguments MUST include remote-debugging port, user-data-dir, and flags that disable background throttling / session restore / first-run nags so the headless instance stays responsive and deterministic.
- FR-13: The Chrome executable path MUST be auto-detected from the host environment; the same system Chrome binary SHOULD be used so that OS-level cookie encryption (app-bound) remains valid.
- FR-14: The launch MUST wait for the debug port to become responsive (within a bounded launch timeout) and transition to `error` if it does not.

**Health, Resilience & Repair**
- FR-15: The system MUST perform an **inline health probe** (debug port responsive = alive) as part of launch.
- FR-16: Each running slave MUST be periodically health-checked on an adaptive interval (interval widens with idle time, with jitter to avoid synchronized probing).
- FR-17: A slave whose process exits unexpectedly MUST be detected and routed through crash handling.
- FR-18: Crash handling MUST kill the stale process, then relaunch with **exponential backoff**, up to a configured maximum number of restart attempts; beyond that it MUST transition to a terminal `error` state.
- FR-19: A per-slave **circuit breaker** MUST track consecutive failures and open (stop launching) after a threshold, entering a cooldown before half-open retry; while open, launch attempts MUST fail fast.

**Observation / Read Layer**
- FR-20: On a successful launch, the system MUST attach a CDP session to the page target and **arm a read/observe layer** that can capture conversation events from the provider UI (the "slave-read" capability).
- FR-21: All slave state transitions and key events (launch ok, arm ok/fail, crash, circuit open) MUST be emitted as observable deltas and broadcast to subscribers (e.g. WebSocket clients).

**Account Integration**
- FR-22: Provider account/profile metadata (profile dir, login state, debug port) SHOULD be loadable from the persistent store at boot so fleet state survives restarts.
- FR-23: The system MUST treat the profile directory as the source of truth for "is this provider authenticated"; it MUST NOT attempt to copy sessions from an external/unrelated browser profile.

### 6.2 Non-Functional Requirements

- NFR-1 **Isolation:** Each provider's profile, port, and process are strictly separate; no shared state between slaves.
- NFR-2 **Idempotency:** Repeated `ensure` calls for an already-running slave MUST be no-ops (return current state), not spawn duplicates.
- NFR-3 **Bounded Operations:** Every launch, probe, and kill MUST have a timeout so the supervisor can never hang.
- NFR-4 **Observability:** Slave status (state, super-state, pid, port, loggedIn, circuit state, last error, last health check) MUST be queryable at any time.
- NFR-5 **Crash Safety:** A crash in one slave MUST NOT affect other slaves or the supervisor process.
- NFR-6 **Security/Privacy:** Provider sessions stay in their own profile dir; credentials are never logged; cookies are only ever read by the owning Chrome process.
- NFR-7 **Determinism:** Anti-throttling / no-session-restore flags ensure backgrounded/headless slaves behave consistently for automated observation.
- NFR-8 **Portability:** Chrome path detection and launch flags MUST adapt to the host OS (Windows vs POSIX) without code forks in the call sites.

---

## 7. Acceptance Criteria

**AC-1 — Per-provider single instance (FR-1, FR-2, NFR-2)**
- *Given* a provider has no running slave, *When* `ensure(provider)` is called, *Then* exactly one Chrome process is spawned on the provider's debug port.
- *Given* the slave is already running, *When* `ensure(provider)` is called again, *Then* no new process is spawned and the current state is returned.

**AC-2 — First-run visible login (FR-7, FR-8)**
- *Given* a provider profile has no authenticated session, *When* the slave is launched, *Then* the browser opens in **visible** mode and the platform signals "please log in."
- *Given* the user completes login, *When* the slave is later relaunched (including headless), *Then* the provider session is reused without re-login.

**AC-3 — Headless reuse after login (FR-8, FR-11)**
- *Given* a provider profile contains a valid session, *When* the slave launches, *Then* it launches headless, attaches CDP, and the provider UI is authenticated (no interstitial/login redirect).
- *Given* a stale SingletonLock exists in the profile, *When* launch begins, *Then* the lock is cleared and launch proceeds.

**AC-4 — Health & crash recovery (FR-15, FR-17, FR-18)**
- *Given* a running slave, *When* its Chrome process is killed externally, *Then* the supervisor detects the exit and respawns it within the backoff window (transient crash recovered).
- *Given* a slave fails to become healthy `maxRestartAttempts` times, *When* the threshold is exceeded, *Then* it transitions to terminal `error` and stops retrying.

**AC-5 — Circuit breaker (FR-19)**
- *Given* a slave accumulates consecutive launch/health failures beyond threshold, *When* the breaker opens, *Then* subsequent `ensure` calls fail fast and a cooldown is observed before retry.

**AC-6 — Re-login self-service (FR-9, FR-10)**
- *Given* a provider reports not logged in, *When* `recoverAuth(provider)` is invoked, *Then* the slave restarts in visible mode for manual re-login without a full platform restart.

**AC-7 — Read/observe layer (FR-20, FR-21)**
- *Given* a slave is running, *When* launch completes, *Then* a CDP session is attached to the page and the read layer is armed; state transitions are broadcast to subscribers.

**AC-8 — Clean teardown (FR-4, FR-5)**
- *Given* a running fleet, *When* `shutdown()` is called, *Then* all slaves are killed, their debug ports freed, and no orphaned Chrome processes remain.

**AC-9 — Port conflict safety (FR-5, FR-14)**
- *Given* a debug port is occupied by a stale process, *When* a slave launch targets that port, *Then* the occupant is killed and the new slave binds successfully, or the launch fails safely (never silently collides).

---

## 8. Out of Scope

- **Credential storage / SSO broker:** The system does not store or broker usernames/passwords; login is performed by the user in the visible browser. OAuth/SSO is handled by the provider, not by this feature.
- **Conversation intelligence:** Parsing, summarizing, or acting on provider responses is owned by the Capability / observation engines, not the slave lifecycle.
- **Cross-profile session copying:** Deliberately excluded (FR-23) — sessions are never copied from unrelated browser profiles (avoids encryption/identity pitfalls).
- **Multi-account per provider:** One authenticated profile per provider in this version; multiple accounts per provider is a later enhancement.
- **Load balancing / horizontal scaling:** A single supervised instance per provider on one host; fleet orchestration across hosts is out of scope.
- **Provider UI automation specifics:** The exact DOM selectors / click sequences for each provider are defined by the observation/action layer, not by this PRD.
- **Frontend UI for the chat surface itself:** This PRD covers the *runtime slave*, not the React chat UI that consumes it.
