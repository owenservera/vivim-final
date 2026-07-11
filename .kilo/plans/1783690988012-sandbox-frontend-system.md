# DevOps-Frontend Sandbox System — Design & Build Plan

## Goal

Build a **frontend-native sandbox** where we develop/test thin backend features/capabilities (chrome-slave, executor, capability resolution) against the *real* backend, find the best UX/interaction pattern for each, then **codify** the proven pattern into the production frontend. The sandbox is the forcing function that drives building the capability API — "backend features should be frontend-designed natively."

**Core invariant (NEW):** *Every single frontend UI action must be triggerable by an AI agent by design.* This is enforced as a Category B architectural invariant (B8) below. It shapes the frontend from the ground up: there is no action path that a human can use but an agent cannot.

## Confirmed Decisions

1. **Sandbox shape** — Separate isolated web app (`web/sandbox`), not an in-product route or mock harness.
2. **Backend link** — Connects to the *same real backend* we have + will build. No duplicated backend. Add a **sandbox-only debug channel** (rich WS stream + `/api/sandbox/debug`) for raw engine events, latency, traces, state reset.
3. **Codify step** — Shared `web/ui` capability-component **registry** + **promotion ledger** (which capabilities graduated + best-practice note per capability). No copy-paste.
4. **Agent transport** — Backend-proxied **WS command bus**: agent → backend (auth-gated) → existing WebSocket → frontend `ActionRegistry.dispatch()`. Human and agent share the identical dispatch path. CDP/DOM-driving of *our* frontend is forbidden as primary (allowed only for visual E2E).

## Context / Current State (verified)

- Backend built (Bun + Prisma + 13 engines). `src/server/index.ts` is a **minimal shell** — only `/health`, `/ws`, `/api/providers`, `/api/fleet/status`, `/api/conversations`, `/api/admin/seed` wired.
- **Gap:** full capability API from `docs/merged-design-v2/07-merged-api.md` is NOT implemented (no `GET /api/.../capabilities`, no capability *execution* endpoint). `CapabilityResolutionEngine.resolve()` exists but is not HTTP-exposed.
- Capability-driven UI model: every capability has a **21-field UI contract**; frontend renders what it receives, no conditional logic. Chrome-slave/fleet endpoints partially exist.
- Frontend is **greenfield**. Planned stack (`docs/roadmap/ROADMAP.md`): **React 19 + Zustand + Tailwind + Vite**.
- WS server (`src/server/websocket.ts`) has a typed `type`-based handler (`subscribe`/`unsubscribe`) — natural extension point for `agent:command`.
- Invariants live in `docs/roadmap/INVARIANTS.md` (Category B = architectural hard block, B1–B7 exist). New requirement becomes **B8**.

## Target Architecture

```
web/
  sandbox/      ← the devops-frontend sandbox app (Vite + React)
                  - capability catalog (reads real contracts from backend)
                  - per-capability bespoke harness view ("highly specific frontend")
                  - live debug panel (WS events, latency, traces, state reset)
                  - ALL affordances wired through @ui/actions (AgentBridge active)
  app/          ← future production frontend (same stack, same API client, same actions)
  ui/           ← shared package, imported by sandbox + app:
                  - generic contract-driven renderer + graduated bespoke renderers
                  - promotion ledger (promoted flag + best-practice note path)
                  - ★ ActionRegistry (registerAction / dispatch / listActions)
                  - ★ AgentBridge (WS agent:command / agent:discover / agent:result)
  api-client/   ← shared typed SDK client from 07-merged-api contract
src/server/     ← backend API extensions:
                  - capability resolution + execution endpoints
                  - WS agent command channel (session-routed agent:command)
```

Data flow (human): `UI affordance → dispatch(actionId, params) → ActionRegistry.run`
Data flow (agent): `agent → POST/WS to backend → server routes to session WS → AgentBridge → dispatch(actionId, params) → SAME ActionRegistry.run → agent:result → agent`
The two paths converge on `ActionRegistry.dispatch`. That convergence is what makes "every UI action is agent-triggerable" *structural*, not aspirational.

## Invariant B8 (to add to INVARIANTS.md)

Insert under **Category B**, after B7:

```
### B8: Agent-Addressable UI Actions

Rule: Every frontend UI action MUST be registered in the shared `ActionRegistry`
(`web/ui`) and executed ONLY through `dispatch(actionId, params)`. No interactive
affordance may perform side-effecting work via a handler that bypasses the registry.
An `AgentBridge` MUST expose the registry to AI agents over the backend WS command
channel (`agent:command` / `agent:result`), with Zod-validated params and an
introspectable catalog (`agent:discover`). Human UI and agent MUST share the identical
dispatch path. Driving the frontend via CDP/Playwright selectors is forbidden as a
primary mechanism (allowed only for visual E2E validation).

Enforcement: `devops/invariants.ts` checks:
- `web/ui/src/actions/registry.ts` exists, exports `ActionRegistry` with
  `registerAction`, `dispatch`, `listActions`.
- `web/ui/src/actions/agent-bridge.ts` exists, exports `AgentBridge`.
- `web/sandbox` and `web/app` import `@ui/actions`.
- `src/server/websocket.ts` handles `agent:command` and `agent:discover` message types.

Check:
  file web/ui/src/actions/registry.ts must export ActionRegistry + dispatch
  file web/ui/src/actions/agent-bridge.ts must export AgentBridge
  grep "agent:command" src/server/websocket.ts  → must match
  grep "agent:discover" src/server/websocket.ts → must match
Heuristic (soft warning): grep for raw `onClick=` in web/{sandbox,app}/src whose
body performs side effects without referencing `@ui/actions`.
```

Implementation of the invariant itself (part of the build, not pre-work):
- Edit `docs/roadmap/INVARIANTS.md` (add B8 block above).
- Add check to `devops/invariants.ts` (Category B scanner).
- Add test in `tests/unit/devops/invariants.test.ts`.
- Update `AGENTS.md` invariant summary.

## Build Phases (ordered)

### Phase 0 — Monorepo scaffold
- Create `web/` workspace (Vite + React 19 + TS + Tailwind + Zustand). Add `web/sandbox`, `web/app` (stub), `web/ui`, `web/api-client`.
- Shared `tsconfig` path aliases (`@ui`, `@api-client`). Add `bun run dev:sandbox`.

### Phase 1 — Shared API client + contract types (`web/api-client`)
- From `07-merged-api.md`: typed `listProviders`, `getFleetStatus`, `createConversation`, `sendMessage`, `resolveCapabilities(providerId|conversationId, planTier)`, WS subscribe helper.
- Generate `CapabilityUIContract` (21-field) + `ResolvedCapabilities` types from `03-merged-schema.md`.

### Phase 1.5 — ActionRegistry + AgentBridge (`web/ui`)  ← B8 enforcer
- `web/ui/src/actions/registry.ts`: `registerAction(id, { description, params: ZodSchema, run })`, `dispatch(id, params)` (validates → runs), `listActions()` (introspection), `getAction(id)`.
- `web/ui/src/actions/agent-bridge.ts`: opens `/ws`, sends `{type:'hello', role:'frontend', sessionId}`, listens for `agent:command {actionId, params, correlationId}` → validate via action's Zod schema → `dispatch` → reply `{type:'agent:result', correlationId, ok, data|error}`; answers `agent:discover` with `listActions()`.
- Export `<ActionTrigger actionId params />` + `useAction(id)` so ALL components go through the registry by construction.

### Phase 2 — Capability API backend (the gap the sandbox forces)
- Implement `GET /api/providers/:id/capabilities` and `GET /api/conversations/:id/capabilities` → `CapabilityResolutionEngine.resolve()` (3-layer override, filtering, grouping).
- **New:** generic capability execution `POST /api/conversations/:id/capabilities/:slug/execute` → runs the capability's harness module via ChromeGovernor/CDP, streams progress over WS. (Resolution exists; execution does not — this is the riskiest build item.)

### Phase 2.5 — Backend WS agent command channel (B8 backend half)
- `src/server/websocket.ts`: maintain `sessionId → ws` registry (client sends `hello`). Handle inbound `agent:command` (route to target `sessionId`'s ws) and `agent:discover`. Forward frontend `agent:result` frames back to the agent's ws. Auth-gated like all other `/ws` traffic.

### Phase 3 — Sandbox app MVP
- Capability **catalog** view: lists all capabilities from backend, grouped by `ui_position`.
- Click capability → **bespoke harness view**: renders its 21-field contract minimally, wires actions to real execution endpoint, shows live result/stream. ALL buttons/inputs are `<ActionTrigger>` (B8).
- **Debug channel:** rich WS stream panel (raw engine events, per-stage latency budgets, traces) + `/api/sandbox/debug` reset/seed.

### Phase 4 — Shared UI registry + promotion ledger (the "codify")
- `web/ui`: generic contract-driven renderer used by sandbox + prod. Proven bespoke renderer graduates into `web/ui/registry` keyed by capability slug.
- Promotion ledger: `docs/sandbox/PROMOTED.md` (slug → status, component path, best-practice note link). Keeps code/seed separation per invariant B3. Prod renderer reads ledger to pick bespoke vs generic.
- Scaffold template + `bun run sandbox new <slug>` to spin a fresh per-capability harness fast.

### Phase 5 — First real backend feature through the loop (proves the system)
- Drive ONE real feature end-to-end via sandbox (e.g. chrome-slave accounts or a single capability execution). Iterate UI → find best practice → codify into `web/ui`. Verify an agent can perform every step via `agent:command`.

## Validation
- `bun run dev:sandbox` boots; catalog shows real capabilities resolved from DB.
- Executing a capability in sandbox drives the REAL backend and streams live events to the debug panel.
- **B8 check passes:** `devops/invariants check --category B` green; `web/ui` exports `ActionRegistry` + `AgentBridge`; `websocket.ts` handles `agent:command`/`agent:discover`.
- **Agent parity test:** a script connects as an agent over WS, calls `agent:discover` (sees the catalog), then `agent:command` for a capability action, and the SAME outcome occurs as a human click. No action exists that a human can do but the agent cannot.
- Promotion ledger updates; prod renderer (`web/app` stub) renders graduated capability via shared registry, no duplicate component.
- `bun run typecheck` + `bun run lint` pass across `web/`.

## Risks / Open Questions
- **Capability execution model undefined** in current code — needs the generic `execute` endpoint + harness-module invocation design (riskiest build item).
- **Session routing for agent commands** needs a `sessionId → ws` registry in the WS layer; minor but required for B8 transport.
- Assistant-ui vs plain React for chat capability — defer; generic React first.
- State isolation: sandbox shares real backend data; rely on `/api/sandbox/debug` reset, not separate DB.
- `web/app` intentionally a stub until features proven in sandbox.
