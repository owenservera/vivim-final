# vivim-runtime — Runtime-OS Design (Assumed-Enabled Baseline)

> **Purpose:** This document specifies `vivim-runtime` as an *assumed-enabled
> baseline* — i.e. as if the full subsystem already existed — so we can
> gap-analyze it against the current repo and generate a roadmap to bridge the
> gap. It is **meta-tooling**: a development skill / runtime-OS that the agent
> (opencode / claude-code / equivalent) runs to do long-horizon, agentic
> development of vivim. It is **not** a vivim product feature.

---

## 1. Operating principle

`vivim-runtime` turns the agent into the runtime of its own dev loop. It
orchestrates the *existing* vivim backend (`bun run serve`), frontend
(`web/ui`), and provider slaves (`scripts/setup-slaves.ts`) as the
system-under-test, and drives them through one lifecycle:

```
launch → engage → discover → test → debug → build → test → debug → repeat
```

Two modes (both required):
- **Autonomous:** `devops runtime loop` runs the cycle unattended to the exit gate.
- **Human-in-the-middle:** the agent invokes each phase command and acts between them.

**Pre-flight guarantee (non-negotiable):** before any loop starts, the system
ensures logged-in provider slaves + backend + frontend are present (running
`setup-slaves` / `--verify` if needed). We always test against the **live
provider**.

## 2. FRONTEND = BACKEND

A **capability is one slug**. Its backend handler and its frontend reusable
renderer are two *surfaces* of that slug:

- Backend: `UnifiedCapability.surfaces` includes `'ui'`; `ui.component` = `<slug>`
  (`src/engines/unified-registry.ts:30,66`).
- Frontend: `CapabilityRegistry.register(slug, { component, bestPracticeNote })`
  (`web/ui/src/registry/index.ts`) + `ActionRegistry` (`web/ui/src/actions/registry.ts`).

The runtime grows **both surfaces together**. A capability is not "done" until
its handler *and* its reusable renderer exist and pass a real-user UI gate. The
`slug` is the single key linking backend and frontend.

## 3. Assumed-enabled baseline (component specification)

### 3.1 `devops/runtime-test/supervisor.ts`
Detached, supervised lifecycle for backend + frontend:
- `start(service)`, `stop(service)`, `restart(service)`, `health(service)`.
- Children are **detached** from the agent process (PowerShell `Start-Process` /
  job, or a long-running node supervisor on a local socket). The agent never
  `await`s the app process — this is the crux of "restart without breaking the
  session."
- Health polling against backend + Vite frontend ports (auto-discovered into a
  small `runtime.config.json`; not hardcoded).
- Exposes a control channel (local HTTP or CLI) so `restart` is a command, not a
  process the agent owns.

### 3.2 `scripts/dev-backend.ps1` + `scripts/dev-frontend.ps1`
PowerShell wrappers: `start` / `stop` / `health` of each runtime, detached.
Idempotent; safe to call repeatedly.

### 3.3 `devops/runtime-test/profile.ts` + `preflight`
- Wraps `scripts/setup-slaves.ts`: ensure slaves are logged in (`--verify`), or
  prompt + spawn visible Chrome to log in, then relaunch headless.
- Verifies backend + frontend are up (via supervisor health).
- Blocks the loop with a clear error if any prerequisite is missing.

### 3.4 `devops/runtime-test/engage.ts`
Drives the **live** app as a real user via `ChromeGovernor`:
- Frontend: click capability buttons / dispatch `ActionRegistry` actions
  (`web/ui/src/actions/registry.ts` dispatch path).
- Provider: send a real message through a logged-in slave.
- Captures observations (DOM, network, stream) for the discover/debug phases.

### 3.5 `devops/runtime-test/discover.ts`
Observe → deparse on **both** surfaces:
- **Backend:** from a live slave, capture the provider's unique method/protocol
  (SSE shape, selectors, CDP methods) and register a `UnifiedCapability` using
  the existing `capability-discovery-loop.ts` + `protocol-loop-parser.ts` +
  `provider-discovery.ts`.
- **Frontend:** static scan `web/ui/src/registry` + `components` + `features` to
  find gaps — slugs with `surface:'ui'` but no bespoke `CapabilityRegistry`
  renderer, and missing `ActionRegistry` entries. Emits a frontend capability
  backlog.

### 3.6 `devops/runtime-test/test.ts`
- **Backend real-provider E2E:** `bun test tests/e2e --live` drives a real slave
  through `ChromeGovernor` and asserts real response blocks (replaces the
  current `mockGovernor`). `--mock` retains the CI-safe mocked path.
- **Frontend real-user UI gate:** `ui-gate.ts` drives the real frontend as a user
  (via `ChromeGovernor`/CDP — **no Playwright dependency**) and asserts that the
  capability component renders and behaves correctly.

### 3.7 `devops/runtime-test/debug.ts`
On failure:
- Backend: pull the `observation-tap` trace / `stream-block-store` for the failed
  capability.
- Frontend: capture a DOM snapshot + console via `ChromeGovernor`.
- Localize the failure and emit a **precise build target** (which component /
  handler / binding to create or repair).

### 3.8 `devops/runtime-test/build.ts`
Scaffold / repair, mirroring existing registration patterns (idempotent upsert
like `web/ui/src/actions/auto-populate.ts`):
- Create the reusable frontend component in `web/ui/src/components`, register it
  in `CapabilityRegistry` + `ActionRegistry`, and set the backend capability's
  `ui.component = <slug>`.
- Wire the **api-client → registries** data flow (see 3.9) so FRONTEND=BACKEND
  actually renders.
- Optionally scaffold the backend `UnifiedCapability` handler for discovered
  provider protocols.

### 3.9 Frontend data-flow wire (the missing bridge)
`web/ui` currently does **not** fetch backend capabilities (grep `capability` in
`web/ui/src` = 0 hits). The baseline wires `web/api-client` to fetch
`unified-registry` filtered to `surface:'ui'` and auto-populate
`CapabilityRegistry` + `ActionRegistry` on mount. This is what makes the
FRONTEND=BACKEND contract render.

### 3.10 `devops/runtime-test/index.ts` + `loop`
`devops runtime <up|engage|discover|test|debug|build|loop>`. The `loop` meta
command runs the lifecycle (§1) until the **session goal is satisfied** (exit
gate): the target capability(s) have a working backend handler **and** a frontend
renderer, and the real-user UI gate passes.

### 3.11 `.opencode/skill/vivim-runtime/SKILL.md`
Agent playbook: how opencode / claude-code drives the loop (two modes, pre-flight,
FRONTEND=BACKEND, when to engage/discover/test/debug/build).

## 4. Exit gate ("complete working")

The loop stops when the **session goal is satisfied**:
- target capability(s) have a working backend handler **and** a frontend renderer;
- real-provider E2E passes (backend);
- real-user UI gate passes (frontend);
- no P0/P1 from `audit-code` introduced by the changes.

## 5. Reuse inventory (do not rebuild)

| Capability | Source |
|---|---|
| Logged-in provider slaves | `scripts/setup-slaves.ts` |
| CDP authority + slave restart | `src/engines/chrome-governor.ts` + `FleetSupervisor` |
| `surfaces:'ui'` + `ui.component` contract | `src/engines/unified-registry.ts` |
| Frontend reusable-parts store | `web/ui/src/registry/index.ts` + `actions/registry.ts` + `components`/`features` |
| Backend discover machinery | `capability-discovery-loop.ts`, `protocol-loop-parser.ts`, `provider-discovery.ts` |
| Observe/debug capture | `stream-parser.ts`, `stream-block-store.ts`, `observation-tap.ts` |
| Runtimes | `web/ui` (React 19, Vite) + `bun run serve` |
| Devops methodology | `tracker`/`select`/`mark`/`gate`, `invariants`, `audit-code` |

See `GAP-MATRIX.md` for the exists / partial / missing verdict per component, and
`SPEC-INDEX.md` for the per-unit specification that seeds `01-tracker.md`.
