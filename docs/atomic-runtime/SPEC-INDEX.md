# vivim-runtime — Spec Index (Roadmap Unit Specs)

> One entry per unit in `01-tracker.md`. Each spec is the acceptance contract
> the agent satisfies when it works the unit. Phase gating (R1→R2→…→R5) is the
> only cross-unit dependency in this pass; R5.4 promotes these into per-unit
> spec files (`phase-XX/*.md`) wired through `loadDeps`.

---

## Phase 1 — Foundation: Supervisor + Pre-flight

### 1.1 `supervisor.ts` — detached process supervisor
- `start/stop/restart/health(service: 'backend'|'frontend')`.
- Children **detached** from agent process (PowerShell `Start-Process`/job or
  long-running node supervisor on a local socket). Agent never `await`s app proc.
- Health polls backend + Vite frontend ports (auto-discovered → `runtime.config.json`).
- Control channel so `restart` is a command, not an owned process.
- **Accept:** `devops runtime restart backend` works; agent keeps running; health reflects state.

### 1.2 `dev-backend.ps1` + `dev-frontend.ps1`
- PowerShell wrappers: `start`/`stop`/`health`, detached, idempotent.
- **Accept:** `pwsh scripts/dev-backend.ps1 start` launches `bun run serve` detached and `health` returns up.

### 1.3 `profile.ts` + `preflight`
- Wrap `setup-slaves` (`--verify`; prompt + spawn visible Chrome to login if needed, then relaunch headless).
- Verify backend + frontend up via supervisor health.
- Block loop with clear error if any prereq missing.
- **Accept:** preflight exits 0 only when slaves logged in + both runtimes healthy.

### 1.4 `devops runtime up|down|restart|health`
- `case 'runtime'` in `devops/index.ts` dispatching to supervisor + preflight.
- **Accept:** `bun run devops runtime up` brings up slaves+backend+frontend; `health` reports all up.

## Phase 2 — Engage + Discover

### 2.1 `engage.ts`
- Drive live app as real user via `ChromeGovernor`; dispatch `ActionRegistry` frontend actions; send real message through logged-in slave.
- Capture observations (DOM, network, stream).
- **Accept:** engages live app, returns observations usable by R2.2/R2.3.

### 2.2 discover backend
- Wire `capability-discovery-loop.ts` + `protocol-loop-parser.ts` + `provider-discovery.ts` to a **live** slave → register `UnifiedCapability` (provider-unique method/protocol + selectors).
- **Accept:** a discovered provider method becomes a `UnifiedCapability` row through the live path.

### 2.3 discover frontend
- Static scan `web/ui/src/registry` + `components` + `features` → gaps (slug w/ `surface:'ui'` but no bespoke `CapabilityRegistry` renderer; missing `ActionRegistry` entry).
- **Accept:** emits a frontend capability backlog listing missing/partial renderers.

## Phase 3 — Test + Debug

### 3.1 live-e2e.ts
- Replace `mockGovernor` in `tests/e2e` with real `ChromeGovernor`+slave driver; `bun test tests/e2e --live`; `--mock` retains CI path.
- **Accept:** `--live` runs true provider E2E and asserts real response blocks.

### 3.2 ui-gate.ts
- Real-user UI gate via `ChromeGovernor` (no Playwright): assert capability component renders + behaves.
- **Accept:** gate fails on a deliberately-broken component; passes on a correct one.

### 3.3 debug.ts
- On failure: backend `observation-tap` trace + `stream-block-store`; frontend DOM snapshot + console via `ChromeGovernor`. Emit precise build target.
- **Accept:** a failed capability yields a localized, actionable build target.

## Phase 4 — Build (FRONTEND = BACKEND)

### 4.1 build.ts scaffold
- Create reusable frontend component in `web/ui/src/components`; register in `CapabilityRegistry` + `ActionRegistry`; set backend `ui.component = <slug>` (idempotent upsert, mirror `auto-populate.ts`).
- **Accept:** new slug → backend handler + frontend renderer both registered, linked by slug.

### 4.2 frontend data-flow wire
- `web/api-client` fetches `unified-registry` filtered to `surface:'ui'` → auto-populate `CapabilityRegistry` + `ActionRegistry` on mount.
- **Accept:** frontend renders a backend capability with `surface:'ui'` without a hard-coded local entry (the render bridge works).

### 4.3 backend handler scaffold
- Scaffold `UnifiedCapability` handler for discovered provider protocols.
- **Accept:** a discovered provider protocol yields a runnable backend handler stub.

## Phase 5 — Orchestration + Skill

### 5.1 `devops runtime loop`
- Meta-command: launch→engage→discover→test→debug→build→test→debug→repeat until session goal satisfied; autonomous + human-in-the-middle modes.
- **Accept:** loop drives a trivial capability to "complete working" unattended.

### 5.2 `vivim-runtime` skill
- `.opencode/skill/vivim-runtime/SKILL.md`: agent playbook (two modes, pre-flight, FRONTEND=BACKEND, phase ordering). Mirror `source-audit` skill wiring.
- **Accept:** skill loads; documents the loop and gate.

### 5.3 cross-refs
- Add vivim-runtime to `DEVOPS-SYSTEM-REFERENCE.md` §12 + `AGENTS.md` runtime line (mirror audit-code entries).
- **Accept:** referenced in both docs.

### 5.4 per-unit spec files
- Promote these entries to `docs/atomic-runtime/phase-XX/*.md` with `**Depends:**` so `loadDeps` is fully wired.
- **Accept:** `devops select --tracker …` reflects spec-file deps.

### 5.5 loop smoke
- End-to-end dry run of the loop on a trivial capability as the acceptance gate for the whole tracker.
- **Accept:** loop completes a working capability (handler + renderer + UI gate pass) = tracker exit gate.
