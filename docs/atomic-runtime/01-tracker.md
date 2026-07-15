# vivim-runtime — Atomic Tracker (Runtime-OS Dev Skill)

> **SATELLITE TRACKER — `docs/atomic-runtime/`**
>
> This tracker specifies `vivim-runtime`: a *development skill / runtime-OS* that
> the agent (opencode / claude-code / equivalent) runs to do long-horizon,
> agentic development of vivim. It is **meta-tooling**, not a vivim product
> feature. It orchestrates the existing vivim backend + frontend + provider
> slaves as the system-under-test.
>
> **States:** `[ ]` pending · `[~]` in_progress · `[x]` done · `[!]` blocked
>
> **Drive it:** `bun run devops select --tracker docs/atomic-runtime/01-tracker.md`
> then `bun run devops mark <id> <state> --tracker docs/atomic-runtime/01-tracker.md`
>
> **Design + gap analysis:** `RUNTIME-OS-DESIGN.md`, `GAP-MATRIX.md`, `SPEC-INDEX.md`
> (same directory).

---

**Total units:** 18 | **Done:** 0 | **Blocked:** 0 | **Pending:** 18

## Last Updated

2026-07-13

---

## Phase 1: Foundation — Supervisor + Pre-flight (4 units)

> Detached, supervised start/stop/restart + health for backend+frontend; a
> pre-flight that guarantees logged-in provider slaves before any loop runs.

- [ ] 1.1 — supervisor.ts: detached process supervisor (start/stop/restart/health) for backend+frontend; session-safe control channel
- [ ] 1.2 — scripts/dev-backend.ps1 + dev-frontend.ps1: PowerShell wrappers (detached start/stop/health)
- [ ] 1.3 — profile.ts + `preflight`: ensure logged-in slaves (setup-slaves --verify / prompt) + backend + frontend; block loop until ready
- [ ] 1.4 — `devops runtime up|down|restart|health`: index.ts dispatcher + case in devops/index.ts

## Phase 2: Engage + Discover (3 units)

> Drive the live app as a real user; discover capabilities on BOTH surfaces
> (backend provider protocol + frontend reusable-part gaps).

- [ ] 2.1 — engage.ts: drive live app as real user via ChromeGovernor (ActionRegistry dispatch + provider send); capture observations
- [ ] 2.2 — discover backend: wire capability-discovery-loop + protocol-loop-parser to a live slave → register UnifiedCapability (provider-unique method/protocol)
- [ ] 2.3 — discover frontend: static scan web/ui/src/registry+components → gaps (slug w/ surface 'ui' but no bespoke renderer / missing action)

## Phase 3: Test + Debug (3 units)

> Real-provider E2E (backend) + real-user UI gate (frontend, CDP) + failure capture.

- [ ] 3.1 — live-e2e.ts: replace mockGovernor in tests/e2e with real ChromeGovernor+slave driver; `bun test tests/e2e --live` (+ `--mock` CI path)
- [ ] 3.2 — ui-gate.ts: real-user UI gate via ChromeGovernor (no Playwright); assert render+behavior of capability components
- [ ] 3.3 — debug.ts: capture failures (backend observation-tap trace + frontend DOM snapshot); localize; emit precise build target

## Phase 4: Build (FRONTEND = BACKEND) (3 units)

> Scaffold/repair the reusable frontend part AND bind it to the backend
> capability; wire the missing api-client → registries data flow.

- [ ] 4.1 — build.ts scaffold: create reusable frontend component in web/ui/src/components, register in CapabilityRegistry+ActionRegistry, set backend ui.component=slug
- [ ] 4.2 — frontend data-flow wire: api-client fetches unified-registry surface 'ui' → auto-populates CapabilityRegistry/ActionRegistry (the missing render bridge)
- [ ] 4.3 — backend handler scaffold: scaffold UnifiedCapability handler for discovered provider protocols

## Phase 5: Orchestration + Skill (5 units)

> The lifecycle meta-command (both modes), the agent playbook skill, and the
> cross-references that make it a first-class part of the devops system.

- [ ] 5.1 — `devops runtime loop`: meta-command running launch→engage→discover→test→debug→build→test→debug→repeat until session goal satisfied (autonomous mode) + human-in-the-middle mode
- [ ] 5.2 — .opencode/skill/vivim-runtime/SKILL.md: agent playbook (two modes, pre-flight, FRONTEND=BACKEND)
- [ ] 5.3 — cross-refs: DEVOPS-SYSTEM-REFERENCE.md §12, AGENTS.md runtime line (mirror audit-code)
- [ ] 5.4 — per-unit spec files: promote SPEC-INDEX.md entries to docs/atomic-runtime/phase-XX/*.md with **Depends:** so loadDeps is fully wired
- [ ] 5.5 — smoke: end-to-end dry run of the loop on a trivial capability (launch→…→complete-working) as the acceptance gate for the whole tracker
