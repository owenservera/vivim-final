# Feature Specification: Convergence Auditor for Remote Frontend Dev Agent

**Feature Branch**: `028-convergence-auditor`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Build a devops skill + scripts that, given a delivered frontend version (complete standalone app under dev-poc/canvas/vN), (1) audits integration + convergence state, (2) audits the version vs our vision/goals, (3) identifies core enhancements, and (4) generates the next-version blueprint as a concatenated .txt upload pack + full instruction prompt — for a full-stack dev agent that cannot read our source."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Audit a delivered version for integration + convergence (Priority: P1)

The devops operator receives a new frontend version (e.g. `v8`) as a complete standalone app under `dev-poc/canvas/vN`. They run the convergence auditor against it and get a `CONVERGENCE-REPORT.md` that states, with file evidence, whether the version actually integrates with the vivim-final backend (absolute backend URLs, WS endpoint, Zod v3.23, no own backend/Prisma/engines) and whether it converges with the prior version (no regressions, no stale/duplicated master prompt).

**Why this priority**: Without this audit, broken context drift ships silently — proven by `v7/upload/MASTER-PROMPT.txt` still saying "BUILD V6" and v8 arriving as a Next.js app with its own `src/server/` + `prisma/`, violating the ZERO-BACKEND contract. The operator cannot otherwise see these faults.

**Independent Test**: Run `bun run dev-poc/canvas/_audit/audit-version.ts --version v8`; assert the report flags the `src/server/` + `prisma/` violation and the missing backend-URL integration, and writes `v8/CONVERGENCE-REPORT.md`.

**Acceptance Scenarios**:

1. **Given** a delivered version dir, **When** the auditor runs, **Then** it emits `CONVERGENCE-REPORT.md` scoring integration (Phase A) and convergence (Phase B) with concrete file evidence.
2. **Given** v8 with its own backend, **When** audited, **Then** Phase A scores the integration contract as FAILED/BROKEN with the offending paths listed.
3. **Given** a prior version's `CONVERGENCE-REPORT.md` exists, **When** the next version is audited, **Then** Phase B detects regressions by diffing the convergence ledger.

---

### User Story 2 - Audit the version against vision + roadmap goals (Priority: P1)

The auditor scores the delivered version against two vision layers: (L1) the 5 canvas wishes from `agent-brief` + the V8 master-prompt vision/goals; (L2) the broader product vision from `docs/roadmap/GOALS.md`, `M4-CANVAS-PLAN.md`, `INVARIANTS.md`. Each wish/goal is scored advanced / partial / missing / regressed with evidence.

**Why this priority**: The remote agent builds toward a brief, not our roadmap. We must verify the delivered UI advances the actual product vision, not just the literal prompt, and surface where it drifts.

**Independent Test**: Run the audit on `v8`; assert the report's Phase C contains a scored row for each of the 5 wishes and each roadmap goal referenced, with a status and evidence path.

**Acceptance Scenarios**:

1. **Given** the baseline vision files exist under `dev-poc/canvas/_baseline/`, **When** audited, **Then** Phase C scores every L1 wish and L2 goal.
2. **Given** a wish is implemented, **When** scored, **Then** status = advanced with the file that proves it.
3. **Given** a goal is contradicted, **When** scored, **Then** status = regressed with evidence.

---

### User Story 3 - Generate the next-version blueprint upload pack (Priority: P1)

From the audit report, the system generates `dev-poc/canvas/vNEXT/` containing `MASTER-PROMPT.txt` (full instruction prompt: goal, architecture rules, preserve-from-vN, fix-per-audit, vNEXT feature set, build order, quality gates), concatenated `BUNDLE-*.txt` reference files (prior-version code patterns to preserve, schema contracts, data-model dumps, the audit's known-gaps section), and a single `COMBINED-PROMPTS.txt` — mirroring the proven upload format the remote agent already consumes.

**Why this priority**: This is the actual handoff artifact. It closes the loop: audit → blueprint → remote agent builds vNEXT → delivered → re-audited.

**Independent Test**: Run `bun run dev-poc/canvas/_audit/build-next-version.ts --version v8 --next v9`; assert `v9/MASTER-PROMPT.txt`, `v9/BUNDLE-*.txt`, and `v9/COMBINED-PROMPTS.txt` exist and `COMBINED-PROMPTS.txt` concatenates all bundles.

**Acceptance Scenarios**:

1. **Given** an audit report for `v8`, **When** blueprint is built, **Then** `v9/` contains the master prompt + bundles + combined file.
2. **Given** the build runs, **When** `COMBINED-PROMPTS.txt` is opened, **Then** it is the verbatim concatenation of every bundle in documented order.
3. **Given** the master prompt, **When** read, **Then** it instructs the remote agent to FIX the Phase A/B/C failures from v8 and PRESERVE the passing components.

---

### User Story 4 - One-shot converge command (Priority: P2)

A PowerShell wrapper `converge.ps1 -Version v8 -Next v9` runs audit → blueprint in sequence, `$PSScriptRoot`-safe (per AGENTS.md PS1 rules). Optional `devops convergence` CLI alias.

**Why this priority**: Ergonomics — the operator runs one command per delivered version instead of two scripts + manual wiring.

**Independent Test**: Run `pwsh dev-poc/canvas/_audit/converge.ps1 -Version v8 -Next v9` and assert both `v8/CONVERGENCE-REPORT.md` and `v9/` pack are produced.

**Acceptance Scenarios**:

1. **Given** a delivered version, **When** `converge.ps1` runs, **Then** both audit report and next-version pack are produced.
2. **Given** invoked via `pwsh scripts/...`, **When** run, **Then** `$PSScriptRoot` resolves correctly (no `$null` path collapse).

---

### Edge Cases

- `agent-brief/03-wishlist-top5.md` is missing — auditor falls back to the 5-wish summary in `00-MASTER-INDEX.md` + known-gaps in `02-current-canvas-state.md` and notes the gap.
- Delivered version has no prior `CONVERGENCE-REPORT.md` — Phase B reports "no baseline, first audit".
- Delivered version is huge (v8 `BUNDLE-04-engines.txt` is 1.2 MB) — auditor greps, never loads whole files into memory; report stays bounded.
- Remote agent cannot read our source — the blueprint pack must be fully self-contained (no repo-relative references the agent can't resolve).
- Stale/duplicated master prompt (v7 says "BUILD V6") — Phase B detects when `MASTER-PROMPT.txt` header version string ≠ actual version dir name.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a skill `.opencode/skill/convergence-auditor/SKILL.md` documenting the 4-phase workflow and baselines.
- **FR-002**: System MUST extract a self-contained vision baseline into `dev-poc/canvas/_baseline/` (4 `.txt` files: agent-brief wishes, v8 vision, roadmap goals, convergence contracts).
- **FR-003**: `audit-version.ts` MUST perform Phase A (integration audit) by checking convergence contracts against the delivered version's source + package.json.
- **FR-004**: `audit-version.ts` MUST perform Phase B (convergence-state audit) by diffing against the prior version's convergence ledger / report.
- **FR-005**: `audit-version.ts` MUST perform Phase C (vision-vs-goals audit) scoring L1 wishes + L2 roadmap goals with evidence.
- **FR-006**: `audit-version.ts` MUST perform Phase D (core enhancements) producing a prioritized gap + next-target list.
- **FR-007**: `audit-version.ts` MUST emit `dev-poc/canvas/vN/CONVERGENCE-REPORT.md` + `vN/_audit/ledger.json`.
- **FR-008**: `build-next-version.ts` MUST emit `dev-poc/canvas/vNEXT/MASTER-PROMPT.txt` with goal, architecture rules, preserve/fix sections, feature set, build order, quality gates.
- **FR-009**: `build-next-version.ts` MUST emit `BUNDLE-*.txt` reference files (prior code patterns, schema contracts, data-model dumps, audit known-gaps) and a single `COMBINED-PROMPTS.txt`.
- **FR-010**: `converge.ps1` MUST run audit → blueprint in sequence, `$PSScriptRoot`-safe.
- **FR-011**: The system MUST detect stale/duplicated master prompts (header version ≠ dir version) in Phase B.

### Key Entities

- **ConvergenceContract**: a non-negotiable integration rule the frontend MUST honor (backend URL, WS endpoint, Zod version, no-own-backend, FRONTEND=BACKEND invariant).
- **VisionBaseline**: the canonical vision/goals reference (L1 wishes + v8 vision; L2 roadmap GOALS/INVARIANTS).
- **ConvergenceLedger**: per-version JSON recording Phase A/B/C/D scores for regression diffing.
- **BlueprintPack**: the vNEXT upload artifacts (MASTER-PROMPT.txt, BUNDLE-*.txt, COMBINED-PROMPTS.txt).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running the auditor on `v8` produces a report that flags the own-backend violation (src/server + prisma) and the missing `localhost:9420` integration as FAILED with file evidence.
- **SC-002**: The v9 blueprint pack, when uploaded to the remote agent, is self-contained — contains no repo-relative paths the agent cannot resolve.
- **SC-003**: `COMBINED-PROMPTS.txt` byte-for-byte concatenates the bundles in documented order.
- **SC-004**: Phase B detects the v7→v8 stale master-prompt drift (header "BUILD V6" in a v7 dir).
- **SC-005**: The whole converge run (audit + blueprint) completes in < 30s for a v8-sized version.

## Assumptions

- The remote frontend agent consumes the existing upload format (MASTER-PROMPT.txt + concatenated reference bundles), proven by V6/V7/V8 `upload/` folders.
- The vivim-final backend runs at `localhost:9420` (this env `9421`) with WS at `ws://localhost:9420/ws`.
- The agent-brief `00-02` docs and `v8/V8_MASTER_PROMPT.txt` are the L1 baseline; `docs/roadmap/{GOALS,M4-CANVAS-PLAN,INVARIANTS}.md` are the L2 baseline.
- PowerShell 7+ is available; scripts invoked via `pwsh scripts/<name>.ps1` from repo root.
- Bun is available for the `.ts` auditor/blueprint scripts.
