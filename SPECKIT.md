# SPECKIT.md — Full Spec-Kit (Spec-Driven Development) System Guide

> **Single source of truth for the Spec-Kit system in this repo.** AGENTS.md points here.
> Companion to `.specify/memory/constitution.md` (the project constitution) and AGENTS.md (project conventions).
>
> Spec-Kit version: `0.12.17` · Integration: `opencode` · Script layer: PowerShell (`ps`) · Invoke separator: `.` (commands are `/speckit.specify`, not `/speckit-specify`).

---

## 0. What Spec-Kit Is

Spec-Kit is a **Spec-Driven Development (SDD)** framework. It enforces a strict, artifact-chained pipeline that separates **what/why** from **how** from **work breakdown** from **execution**. Each phase produces a document that the next phase consumes. Nothing is implemented until the spec, plan, and tasks exist and pass their gates.

The system has four layers:
1. **Commands** — slash commands in `.opencode/commands/speckit.*.md` (the agent-facing workflow).
2. **Orchestration scripts** — PowerShell in `.specify/scripts/powershell/` (path resolution, template copying, prerequisite gating).
3. **Templates** — in `.specify/templates/` (spec, plan, tasks, checklist, constitution) — already **pre-tuned for vivim-final**.
4. **State** — `.specify/feature.json`, `init-options.json`, `integration.json` (which feature is active, how numbering works).

**The constitution is the non-negotiable governance layer.** Every spec, plan, task, and line of code is checked against `.specify/memory/constitution.md`. A conflict with a constitution MUST principle is automatically a CRITICAL finding that must be remediated — never diluted.

---

## 1. The 10 Commands (The Workflow)

| Command | Phase | Role | Input → Output |
|---------|-------|------|----------------|
| `/speckit.constitution` | G | Governing principles | edits `.specify/memory/constitution.md`; semver bumps + propagates to templates |
| `/speckit.specify` | 1 | **WHAT/WHY** — feature spec | → `specs/NNN-name/spec.md` + `checklists/requirements.md` |
| `/speckit.clarify` | 1.5 | Resolve ≤5 ambiguities before planning | → edits `spec.md` (`## Clarifications` section) |
| `/speckit.plan` | 2 | **HOW** — technical design | → `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| `/speckit.tasks` | 3 | Work breakdown | → `tasks.md` (phased, checkbox format `T### [P] [US#]`) |
| `/speckit.analyze` | 3.5 | Read-only cross-artifact consistency | report (spec/plan/tasks) — **never writes** |
| `/speckit.checklist` | any | "Unit tests for English" — requirement quality gate | → `checklists/*.md` (CHK### items) |
| `/speckit.implement` | 4 | Execute `tasks.md` | writes code, marks tasks `[X]` |
| `/speckit.converge` | 4.5 | Gap analysis vs spec/plan/tasks | appends `## Phase N: Convergence` tasks (append-only) |
| `/speckit.taskstoissues` | 4.5 | Convert tasks → GitHub issues | via GitHub MCP (dedup by `T###` pattern) |

### Canonical happy path
```
constitution → specify → clarify → plan → tasks → (analyze | checklist) → implement → converge
```
Each command is gated: it refuses to run if its prerequisite artifact is missing (e.g. `tasks` requires `plan.md` + `spec.md`; `implement` requires `tasks.md`).

---

## 2. The Artifact Model (What Each File Contains)

### `spec.md` — WHAT/WHY (no implementation)
- **User Stories** `P1/P2/P3…`, each **independently testable** (a single story = viable MVP).
- **Functional Requirements** `FR-###` — testable, unambiguous, MUST phrasing.
- **Success Criteria** `SC-###` — **measurable + technology-agnostic** (no frameworks/DBs/languages).
- **Key Entities**, **Edge Cases**, **Assumptions**.
- Optional `[NEEDS CLARIFICATION: …]` markers (max 3 in `specify`; max 5 in `clarify`).

### `plan.md` — HOW (technical design)
- **Technical Context** (lang/version, deps, storage, testing, platform).
- **Constitution Check** — gate section listing Governor Canon, Store Contracts, One Entry Point, etc. ERROR if violations are unjustified.
- **Phase 0 → research.md** (resolve all `NEEDS CLARIFICATION`): Decision / Rationale / Alternatives.
- **Phase 1 → data-model.md, contracts/, quickstart.md** (entities, interface contracts, end-to-end validation scenarios).
- The plan template is **pre-tuned** for vivim-final (Bun + Prisma + React Flow, Governor Canon / Store Contracts / One Entry Point gates).

### `tasks.md` — Work Breakdown
- Phased: **Setup → Foundational (blocking) → one phase per User Story (priority order) → Polish**.
- Strict checkbox format: `- [ ] T### [P?] [US#?] Description with file path`.
  - `[P]` = parallelizable (different files, no deps).
  - `[US#]` = maps task to a user story (required for story-phase tasks).
- Each story: **Tests (write first, ensure FAIL) → Implementation → Gate checkpoint**.
- The tasks template is **pre-tuned** with vivim gates:
  - Per-unit: `bun run typecheck`, `bun test tests/unit/<path>`, `bun run lint`
  - Per-phase: `bun run devops invariants check --category B`, `bun run devops audit-code standard`
  - Final: `bun test`, `bun run devops verify-cross-surface`

### `checklists/*.md` — Requirement Quality (NOT implementation tests)
- Items like `CHK001 - Are [requirement] defined for [scenario]? [Completeness, Spec §FR-1]`.
- **Prohibited**: items starting with "Verify/Test/Confirm" + behavior, or referencing code execution.
- `analyze` reads these to report checklist pass/fail; `implement` halts if any checklist is incomplete.

---

## 3. The Orchestration Layer (PowerShell Scripts)

All scripts live in `.specify/scripts/powershell/`. They are invoked **internally by the command files** — you normally do not run them by hand, but understanding them explains the machinery.

### `common.ps1` — the engine
- `Find-SpecifyRoot` / `Get-RepoRoot` — walk up to the `.specify` marker (honors `$env:SPECIFY_INIT_DIR` for monorepo member runs).
- `Get-FeaturePathsEnv` — resolves `FEATURE_DIR` from (priority):
  1. `$env:SPECIFY_FEATURE_DIRECTORY` (explicit override) → persists to `feature.json`
  2. `.specify/feature.json` → `feature_directory` key
  3. ERROR if neither exists
- `Save-FeatureJson` — writes `feature_directory` (idempotent; skips if unchanged).
- `Resolve-Template` / `Resolve-TemplateContent` — 4-tier template resolution:
  `overrides/` → `presets/<id>/templates/` → `extensions/<id>/templates/` → core `templates/`.
  Supports **composition strategies**: `replace` (default), `prepend`, `append`, `wrap` (`{CORE_TEMPLATE}` placeholder). Composition only activates with Python 3 + PyYAML.

### `check-prerequisites.ps1` — phase gating
- Flags: `-Json`, `-RequireTasks`, `-IncludeTasks`, `-PathsOnly`.
- Exits non-zero (with the corrective command) if the required artifact is missing:
  - no `spec.md` → "run `/speckit.specify`"
  - no `plan.md` → "run `/speckit.plan`"
  - `-RequireTasks` and no `tasks.md` → "run `/speckit.tasks`"

### `setup-plan.ps1` / `setup-tasks.ps1` — scaffolding
- Copy the resolved template into the feature dir (UTF-8 no BOM), emit JSON paths used by the command body.

### `create-new-feature.ps1` — directory generation
- Generates `NNN-short-name` from the description (stop-word filtering, acronym preservation, 244-byte GitHub branch limit).
- Numbering: `sequential` (default, next `NNN` after scanning `specs/`) or `-Timestamp` (`YYYYMMDD-HHMMSS`) or `-Number N`.
- Writes `.specify/feature.json` and sets `$env:SPECIFY_FEATURE` / `$env:SPECIFY_FEATURE_DIRECTORY`.

### Every command shares a preamble/postscript
Each command file opens by checking `.specify/extensions.yml` for `before_<cmd>` hooks and closes with `after_<cmd>` hooks. **Mandatory** hooks emit `EXECUTE_COMMAND:` and must actually be run; **optional** hooks are offered. If `extensions.yml` is absent or a hook is invalid, hook-checking is skipped silently.

---

## 4. State & Config Files

| File | Purpose |
|------|---------|
| `.specify/feature.json` | `{"feature_directory": "specs/NNN-name"}` — the **single source of truth** for the active feature. Decoupled from git branch name. |
| `.specify/init-options.json` | `feature_numbering: "sequential"`, `ai: "opencode"`, `script: "ps"`, `speckit_version`. |
| `.specify/integration.json` | opencode integration; `invoke_separator: "."`. |
| `.specify/integrations/opencode.manifest.json` | SHA-256 hashes of the 10 command files (integrity). |
| `.specify/workflows/speckit/workflow.yml` | Optional bundled full-cycle workflow (specify → gate → plan → gate → tasks → implement). |
| `.specify/workflows/workflow-registry.json` | Registry of installed workflows. |
| `.specify/memory/constitution.md` | **The constitution** (VIVIM constitution here: Governor Canon, Store Contracts, One Entry Point, Research-First, Testing Gates). |
| `.specify/templates/*.md` | spec / plan / tasks / checklist / constitution templates (pre-tuned for vivim-final). |
| `.specify/memory/.constitution-template.json` | Template metadata for constitution init. |

---

## 5. How the Agentic LLM Ensures Compliance

Spec-Kit bakes compliance into the pipeline so the agent cannot silently skip governance. The mechanisms:

### 5.1 Constitution Authority (highest severity)
- `.specify/memory/constitution.md` is **non-negotiable**. `analyze` treats any spec/plan/task conflicting with a MUST principle as automatically **CRITICAL**.
- `converge` ranks constitution-violation findings first and emits them as **CRITICAL** remediation tasks.
- The constitution is wired to vivim-final's invariants (Governor Canon, Store Contracts, One Entry Point), so the SDD pipeline is the same enforcement surface as `bun run devops invariants check`.

### 5.2 Phase Gates (prerequisite enforcement)
- Every command runs `check-prerequisites.ps1` (or equivalent) first. Missing artifact → hard stop with the corrective command. No artifact, no implementation.
- `plan.md` has an explicit **Constitution Check** section the agent must fill and pass before design; re-checked post-design.

### 5.3 Checklist Gates (requirement quality)
- `specify` auto-generates `checklists/requirements.md`; `clarify` re-validates it after each answer (toggles `[ ]`/`[x]` only).
- `implement` scans all checklists; if any item is incomplete it **stops and asks** before proceeding (user must explicitly say yes).

### 5.4 Traceability (IDs everywhere)
- `FR-###`, `SC-###` in spec; `T###` in tasks; `CHK###` in checklists.
- `tasks.md` maps each task to a user story `[US#]`; `converge` appends tasks traced to `FR-###` / `SC-###` / `US#/AC#` / `Constitution II`.
- `analyze` produces a **Coverage Summary** (requirement → task mapping, coverage %), surfacing any requirement with zero tasks.

### 5.5 Append-Only Discipline
- `converge` **only** appends a `## Phase N: Convergence` section to `tasks.md`. It never rewrites, renumbers, or deletes existing tasks or application code. If nothing remains, `tasks.md` is left byte-for-byte unchanged.

### 5.6 Deterministic, Read-Only Analysis
- `analyze` is **STRICTLY READ-ONLY** — it never writes files, only reports. This gives a safe pre-implementation consistency pass (duplication, ambiguity, underspecification, coverage gaps, inconsistency, constitution alignment) capped at 50 findings.

---

## 6. Running the Full Ralph Loop (Autonomous End-to-End)

A **"ralph loop"** = driving the entire SDD pipeline autonomously, gate-to-gate, until the feature is implemented and converged. The agent is the runtime; it does not stop between phases unless a gate blocks.

### 6.1 Preconditions
- Stack understands the feature intent (a natural-language description).
- `bun` available; `.specify/feature.json` will be (re)written by `specify`/`create-new-feature`.
- Decide numbering: `sequential` (default) or a fresh `-Timestamp` run.

### 6.2 The loop (ordered)
```text
1. /speckit.specify "<feature description>"
      → creates specs/NNN-name/, spec.md, checklists/requirements.md
      → validates spec against quality checklist (≤3 iterations)
      → resolves ≤3 [NEEDS CLARIFICATION] markers (presents options, waits for answers)

2. (optional but recommended) /speckit.clarify
      → resolves up to 5 ambiguities, writes them into spec.md :: ## Clarifications
      → re-validates checklists/requirements.md

3. /speckit.plan
      → setup-plan.ps1 copies plan template
      → fills Technical Context + Constitution Check (must pass)
      → Phase 0: research.md (resolve NEEDS CLARIFICATION)
      → Phase 1: data-model.md, contracts/, quickstart.md

4. (gate) review spec.md + plan.md   ← agent pauses for human approval if in mitm mode

5. /speckit.tasks
      → setup-tasks.ps1 resolves tasks template
      → generates phased tasks.md (Setup → Foundational → US1..USn → Polish)
      → each task: T### [P?] [US#?] + file path

6. (optional) /speckit.analyze   → read-only consistency report (coverage %, CRITICALs)
   (optional) /speckit.checklist  → extra domain checklists (ux.md, security.md, …)

7. /speckit.implement
      → checks checklists status; HALTS if incomplete (asks yes/no)
      → executes phases in order; respects [P] parallel markers
      → marks tasks [X] as completed; runs per-unit/per-phase gates
      → creates/verifies ignore files per tech stack

8. /speckit.converge
      → compares code vs spec/plan/tasks
      → appends ## Phase N: Convergence tasks for gaps (missing/partial/contradicts/unrequested)
      → if clean: reports "✅ Converged"

9. (optional) /speckit.taskstoissues
      → converts tasks.md lines to GitHub issues (dedup by T###, only if remote is GitHub)
```

### 6.3 Autonomous vs gated modes
- **Fully autonomous:** run steps 1→8 back-to-back. The only intrinsic stops are:
  - `specify` clarification questions (≤3) — supply answers or accept recommended defaults.
  - `implement` checklist-incomplete prompt — answer `yes` to proceed.
  - Any `ERROR` gate (unresolved constitution violation, missing prerequisite) — must be fixed, not skipped.
- **mitm / human-in-the-loop:** insert approval gates after `plan` (step 4) and after each `implement` story checkpoint. Use this when the feature is high-risk.

### 6.4 Convergence iteration (the "loop" part)
After step 8, if `converge` appended tasks:
```text
run /speckit.implement again   → completes the convergence tasks
run /speckit.converge again    → should find fewer/no gaps
```
Repeat until `converge` reports **Converged**. This is the ralph loop's tail: it contracts the gap to zero.

### 6.5 Compliance guarantees the loop cannot violate
Even in full autonomy, the loop cannot:
- Implement before `spec.md` + `plan.md` + `tasks.md` exist (prerequisite scripts block).
- Skip the constitution (Constitution Check in plan; CRITICAL in analyze/converge).
- Ship with incomplete requirement checklists (`implement` halts).
- Lose traceability (every task ID-mapped; convergence tasks trace to FR/SC/US/Constitution).
- Silently delete prior work (`converge` is append-only; `analyze` is read-only).

---

## 7. Quick Reference — Command → Script → Artifact

| Command | Script invoked | Key artifact read | Key artifact written |
|---------|----------------|-------------------|----------------------|
| specify | create-new-feature.ps1 | (template) | specs/NNN-name/spec.md, checklists/requirements.md, feature.json |
| clarify | check-prerequisites.ps1 -PathsOnly | spec.md, constitution.md | spec.md (## Clarifications) |
| plan | setup-plan.ps1 | spec.md, constitution.md | plan.md, research.md, data-model.md, contracts/, quickstart.md |
| tasks | setup-tasks.ps1 | plan.md, spec.md | tasks.md |
| analyze | check-prerequisites.ps1 -RequireTasks -IncludeTasks | spec/plan/tasks | (none — report only) |
| checklist | check-prerequisites.ps1 | spec/plan/tasks | checklists/<domain>.md |
| implement | check-prerequisites.ps1 -RequireTasks -IncludeTasks | tasks.md, plan.md, checklists | application code; tasks.md (`[X]`) |
| converge | check-prerequisites.ps1 -RequireTasks -IncludeTasks | spec/plan/tasks | tasks.md (## Phase N: Convergence) |
| taskstoissues | check-prerequisites.ps1 -RequireTasks -IncludeTasks | tasks.md | GitHub issues |
| constitution | (none) | constitution.md (template) | constitution.md + Sync Impact Report |

---

## 8. Common Pitfalls

1. **Branch ≠ feature dir.** The spec directory name (`specs/NNN-name`) is independent of the git branch. Locate the active feature via `.specify/feature.json`, never by branch name.
2. **Don't hand-run setup scripts.** They are invoked by the command files. Running them standalone can double-write or mis-resolve paths.
3. **Clarification caps.** `specify` allows ≤3 markers; `clarify` allows ≤5 questions. Beyond that, make informed guesses and document assumptions.
4. **Checklists are not tests.** `CHK###` items validate *requirement writing*, not implementation. Writing "Verify the button clicks" fails the checklist command's own rules.
5. **Don't skip `converge`.** It is the only phase that proves the code matches the spec. A green `bun test` is not proof of spec satisfaction.
6. **Constitution edits require semver + propagation.** `/speckit.constitution` bumps the version and re-syncs templates; do not edit `constitution.md` by hand without running it.
7. **PowerShell-only invocation for repo scripts.** Spec-Kit scripts are PowerShell; repo PS1 service scripts must be run as `pwsh scripts/<name>.ps1` from repo root (see AGENTS.md Shell Environment).

---

## 9. Relationship to Other Systems

- **AGENTS.md** — project conventions, invariants, CLI reference. Spec-Kit's constitution is the SDD-facing mirror of AGENTS.md's invariants.
- **devops / devops-fullstack skills** — the autonomous implementation *runtime*. Spec-Kit produces `tasks.md`; `devops`/`devops-fullstack` is how you execute it (and `implement` is the Spec-Kit-native path). Prefer Spec-Kit's `implement` for spec-driven features; use `devops` for atomic-unit loops outside a spec.
- **docs/roadmap/INVARIANTS.md** — full boundary conditions. The constitution summarizes the non-negotiable subset.
- **GitHub Spec Kit** — upstream: `github/spec-kit` v0.12.17. Re-init with `specify init --here --integration opencode --ignore-agent-tools --force` if command files are missing.

### 9.1 Bridge Infrastructure (DevOps ↔ SpecKit)

SpecKit files (commands, templates, `.specify/`) are **never modified**. DevOps becomes
SpecKit-aware through bridge modules in `devops/` that map IDs, sync state, unify gates,
convert research formats, and run a consolidated converge. The canonical cross-system
workflow and decision table live in:

- **`docs/integration/UNIFIED-WORKFLOW.md`** — 6-step workflow (research → specify → plan → tasks → implement → converge+audit) with the exact SpecKit command, DevOps command, and bridge module per step.
- **`docs/integration/DECISION-TABLE.md`** — scenario → system mapping (SpecKit only / DevOps only / both).

Bridge modules:

| Module | Purpose | Path |
|--------|---------|------|
| speckit-bridge | Task↔unit ID mapping, sync, validation | `devops/speckit-bridge.ts` |
| unified-gate | Unified quality gate (typecheck/lint/test + SpecKit checklists) | `devops/unified-gate.ts` |
| research-bridge | Brief↔`research.md` format conversion | `devops/research-bridge.ts` |
| tracker-speckit-sync | Bidirectional tracker↔tasks sync | `devops/tracker-speckit-sync.ts` |
| speckit-converge-bridge | Consolidated converge (spec+code+arch) | `devops/speckit-converge-bridge.ts` |
| speckit-audit | Skill readiness audit (12 skills) | `devops/speckit-audit.ts` |

CLI surface: `bun run devops speckit <map-task|map-unit|sync|sync-all|validate|gate|converge|find-brief|export-brief|import-research|audit>`.

---

## 10. Provider Onboarding via SpecKit + DevOps (PRD-12)

New webapp providers (e.g. "onboard chatgpt.com with full frontend capability") follow a **two-phase hybrid**:

### Phase 1: SpecKit defines the contract

1. `/speckit.specify` — writes `specs/NNN-provider-<slug>/spec.md` defining provider contract (auth, capabilities, selectors, parser schema).
2. `/speckit.plan` — technical implementation plan for seeding the provider.
3. `/speckit.tasks` — task breakdown.

**Template:** `.specify/templates/provider-onboarding/spec-template.md`

### Phase 2: DevOps onboard modes build + verify

After SpecKit produces the plan:

```powershell
bun run devops runtime-test onboard run --goal="onboard <url> with full frontend capability"
```

This runs the **static phase map**:
```
discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
```

Each phase is independently runnable:
```powershell
bun run devops runtime-test onboard discover --provider=<slug> --url=<url>
bun run devops runtime-test onboard test-selectors --provider=<slug>
bun run devops runtime-test onboard test-parse --provider=<slug>
```

**Resume from failure:**
```powershell
bun run devops runtime-test onboard run --goal="onboard <url>" --resume
bun run devops runtime-test onboard run --goal="onboard <url>" --from=test-selectors
```

### Integration with unified workflow

See `docs/integration/DECISION-TABLE.md` ("New webapp provider" row):

| Scenario | Spec | Plan | Build | Verify | Notes |
|----------|------|------|-------|--------|-------|
| New webapp provider (onboard) | `specify` → `plan` | `runtime-test onboard run` | `onboard converge` (unified gate) | SpecKit defines contract; DevOps onboarding modes build + verify; every activity logged for post-mortem |

### Activity logging

Every mode entry/exit is logged to `.runtime/activity.log` (JSONL) via `automationLog` for post-mortem analysis. The ledger at `.runtime/onboard-ledger.json` supports `--from` and `--resume` across sessions.

### Gate behavior

- Selector confidence < 0.8 or parser confidence < 0.7 **halts** the run and appends a convergence task.
- The operator fixes the issue and resumes with `--resume`.
- No silent skips or degraded passes.
