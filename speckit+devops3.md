# Provider capability discovery & streaming audit

**Session ID:** ses_08f18fe82ffeELaWonN4PLEigl
**Created:** 7/17/2026, 6:26:55 PM
**Updated:** 7/17/2026, 6:29:33 PM

---

## User

we installed github speckit tooling which we want to leverage as best practice and we have started to use it - we already had a devops and custom skills for our development toolkit which worked mostly ok but not perfect - we figured out that the two toolkits are quite complimentary if we modified and enhanced devops and the skills [we do not modify the speciky speckit system as that was done by proper engineers] - we have the merg prds in docs folder in integration - i have an agent implmeneting - what i'd like you to do is read both systesm - read the proposed prd intergration - 1. audit concepturally 2. audit the development lifeclye while thinking about real world sceanrios 3. identify gaps / impreovements 4. We need a very focused review and investigation on how we can leveage and enhance this system on one MAJOR development Cycle that needs to be automated and llm driven within our new combined system - and that is Real provider capabiltiy protocol discovery, testing, provider specific streaming dsing and deparsing etc. think of the ensitre lifecule of fully onboarding a new webapp 

---

## Assistant (Plan · DeepSeek V4 Flash Free · 11.9s)

_Thinking:_

The user wants me to read and audit two systems - their devops toolkit and the SpecKit system - along with a proposed PRD integration document. Then provide a conceptual audit, lifecycle audit, gap analysis, and a focused review on how this combined system can handle a major development cycle: onboarding a new webapp with real provider capability protocol discovery, testing, provider-specific streaming design, etc.

Let me start by reading:
1. The SpecKit integration PRD in docs/integration/
2. The current devops system and skills
3. The SpecKit system and how it's configured
4. AGENTS.md and other context docs

I'm in plan mode (read-only), so I'll focus on reading and analysis.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\docs\\integration"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\docs\integration</path>
<type>directory</type>
<entries>
DECISION-TABLE.md
UNIFIED-WORKFLOW.md

(2 entries)
</entries>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\SPECKIT.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\SPECKIT.md</path>
<type>file</type>
<content>
1: # SPECKIT.md — Full Spec-Kit (Spec-Driven Development) System Guide
2: 
3: > **Single source of truth for the Spec-Kit system in this repo.** AGENTS.md points here.
4: > Companion to `.specify/memory/constitution.md` (the project constitution) and AGENTS.md (project conventions).
5: >
6: > Spec-Kit version: `0.12.17` · Integration: `opencode` · Script layer: PowerShell (`ps`) · Invoke separator: `.` (commands are `/speckit.specify`, not `/speckit-specify`).
7: 
8: ---
9: 
10: ## 0. What Spec-Kit Is
11: 
12: Spec-Kit is a **Spec-Driven Development (SDD)** framework. It enforces a strict, artifact-chained pipeline that separates **what/why** from **how** from **work breakdown** from **execution**. Each phase produces a document that the next phase consumes. Nothing is implemented until the spec, plan, and tasks exist and pass their gates.
13: 
14: The system has four layers:
15: 1. **Commands** — slash commands in `.opencode/commands/speckit.*.md` (the agent-facing workflow).
16: 2. **Orchestration scripts** — PowerShell in `.specify/scripts/powershell/` (path resolution, template copying, prerequisite gating).
17: 3. **Templates** — in `.specify/templates/` (spec, plan, tasks, checklist, constitution) — already **pre-tuned for vivim-final**.
18: 4. **State** — `.specify/feature.json`, `init-options.json`, `integration.json` (which feature is active, how numbering works).
19: 
20: **The constitution is the non-negotiable governance layer.** Every spec, plan, task, and line of code is checked against `.specify/memory/constitution.md`. A conflict with a constitution MUST principle is automatically a CRITICAL finding that must be remediated — never diluted.
21: 
22: ---
23: 
24: ## 1. The 10 Commands (The Workflow)
25: 
26: | Command | Phase | Role | Input → Output |
27: |---------|-------|------|----------------|
28: | `/speckit.constitution` | G | Governing principles | edits `.specify/memory/constitution.md`; semver bumps + propagates to templates |
29: | `/speckit.specify` | 1 | **WHAT/WHY** — feature spec | → `specs/NNN-name/spec.md` + `checklists/requirements.md` |
30: | `/speckit.clarify` | 1.5 | Resolve ≤5 ambiguities before planning | → edits `spec.md` (`## Clarifications` section) |
31: | `/speckit.plan` | 2 | **HOW** — technical design | → `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
32: | `/speckit.tasks` | 3 | Work breakdown | → `tasks.md` (phased, checkbox format `T### [P] [US#]`) |
33: | `/speckit.analyze` | 3.5 | Read-only cross-artifact consistency | report (spec/plan/tasks) — **never writes** |
34: | `/speckit.checklist` | any | "Unit tests for English" — requirement quality gate | → `checklists/*.md` (CHK### items) |
35: | `/speckit.implement` | 4 | Execute `tasks.md` | writes code, marks tasks `[X]` |
36: | `/speckit.converge` | 4.5 | Gap analysis vs spec/plan/tasks | appends `## Phase N: Convergence` tasks (append-only) |
37: | `/speckit.taskstoissues` | 4.5 | Convert tasks → GitHub issues | via GitHub MCP (dedup by `T###` pattern) |
38: 
39: ### Canonical happy path
40: ```
41: constitution → specify → clarify → plan → tasks → (analyze | checklist) → implement → converge
42: ```
43: Each command is gated: it refuses to run if its prerequisite artifact is missing (e.g. `tasks` requires `plan.md` + `spec.md`; `implement` requires `tasks.md`).
44: 
45: ---
46: 
47: ## 2. The Artifact Model (What Each File Contains)
48: 
49: ### `spec.md` — WHAT/WHY (no implementation)
50: - **User Stories** `P1/P2/P3…`, each **independently testable** (a single story = viable MVP).
51: - **Functional Requirements** `FR-###` — testable, unambiguous, MUST phrasing.
52: - **Success Criteria** `SC-###` — **measurable + technology-agnostic** (no frameworks/DBs/languages).
53: - **Key Entities**, **Edge Cases**, **Assumptions**.
54: - Optional `[NEEDS CLARIFICATION: …]` markers (max 3 in `specify`; max 5 in `clarify`).
55: 
56: ### `plan.md` — HOW (technical design)
57: - **Technical Context** (lang/version, deps, storage, testing, platform).
58: - **Constitution Check** — gate section listing Governor Canon, Store Contracts, One Entry Point, etc. ERROR if violations are unjustified.
59: - **Phase 0 → research.md** (resolve all `NEEDS CLARIFICATION`): Decision / Rationale / Alternatives.
60: - **Phase 1 → data-model.md, contracts/, quickstart.md** (entities, interface contracts, end-to-end validation scenarios).
61: - The plan template is **pre-tuned** for vivim-final (Bun + Prisma + React Flow, Governor Canon / Store Contracts / One Entry Point gates).
62: 
63: ### `tasks.md` — Work Breakdown
64: - Phased: **Setup → Foundational (blocking) → one phase per User Story (priority order) → Polish**.
65: - Strict checkbox format: `- [ ] T### [P?] [US#?] Description with file path`.
66:   - `[P]` = parallelizable (different files, no deps).
67:   - `[US#]` = maps task to a user story (required for story-phase tasks).
68: - Each story: **Tests (write first, ensure FAIL) → Implementation → Gate checkpoint**.
69: - The tasks template is **pre-tuned** with vivim gates:
70:   - Per-unit: `bun run typecheck`, `bun test tests/unit/<path>`, `bun run lint`
71:   - Per-phase: `bun run devops invariants check --category B`, `bun run devops audit-code standard`
72:   - Final: `bun test`, `bun run devops verify-cross-surface`
73: 
74: ### `checklists/*.md` — Requirement Quality (NOT implementation tests)
75: - Items like `CHK001 - Are [requirement] defined for [scenario]? [Completeness, Spec §FR-1]`.
76: - **Prohibited**: items starting with "Verify/Test/Confirm" + behavior, or referencing code execution.
77: - `analyze` reads these to report checklist pass/fail; `implement` halts if any checklist is incomplete.
78: 
79: ---
80: 
81: ## 3. The Orchestration Layer (PowerShell Scripts)
82: 
83: All scripts live in `.specify/scripts/powershell/`. They are invoked **internally by the command files** — you normally do not run them by hand, but understanding them explains the machinery.
84: 
85: ### `common.ps1` — the engine
86: - `Find-SpecifyRoot` / `Get-RepoRoot` — walk up to the `.specify` marker (honors `$env:SPECIFY_INIT_DIR` for monorepo member runs).
87: - `Get-FeaturePathsEnv` — resolves `FEATURE_DIR` from (priority):
88:   1. `$env:SPECIFY_FEATURE_DIRECTORY` (explicit override) → persists to `feature.json`
89:   2. `.specify/feature.json` → `feature_directory` key
90:   3. ERROR if neither exists
91: - `Save-FeatureJson` — writes `feature_directory` (idempotent; skips if unchanged).
92: - `Resolve-Template` / `Resolve-TemplateContent` — 4-tier template resolution:
93:   `overrides/` → `presets/<id>/templates/` → `extensions/<id>/templates/` → core `templates/`.
94:   Supports **composition strategies**: `replace` (default), `prepend`, `append`, `wrap` (`{CORE_TEMPLATE}` placeholder). Composition only activates with Python 3 + PyYAML.
95: 
96: ### `check-prerequisites.ps1` — phase gating
97: - Flags: `-Json`, `-RequireTasks`, `-IncludeTasks`, `-PathsOnly`.
98: - Exits non-zero (with the corrective command) if the required artifact is missing:
99:   - no `spec.md` → "run `/speckit.specify`"
100:   - no `plan.md` → "run `/speckit.plan`"
101:   - `-RequireTasks` and no `tasks.md` → "run `/speckit.tasks`"
102: 
103: ### `setup-plan.ps1` / `setup-tasks.ps1` — scaffolding
104: - Copy the resolved template into the feature dir (UTF-8 no BOM), emit JSON paths used by the command body.
105: 
106: ### `create-new-feature.ps1` — directory generation
107: - Generates `NNN-short-name` from the description (stop-word filtering, acronym preservation, 244-byte GitHub branch limit).
108: - Numbering: `sequential` (default, next `NNN` after scanning `specs/`) or `-Timestamp` (`YYYYMMDD-HHMMSS`) or `-Number N`.
109: - Writes `.specify/feature.json` and sets `$env:SPECIFY_FEATURE` / `$env:SPECIFY_FEATURE_DIRECTORY`.
110: 
111: ### Every command shares a preamble/postscript
112: Each command file opens by checking `.specify/extensions.yml` for `before_<cmd>` hooks and closes with `after_<cmd>` hooks. **Mandatory** hooks emit `EXECUTE_COMMAND:` and must actually be run; **optional** hooks are offered. If `extensions.yml` is absent or a hook is invalid, hook-checking is skipped silently.
113: 
114: ---
115: 
116: ## 4. State & Config Files
117: 
118: | File | Purpose |
119: |------|---------|
120: | `.specify/feature.json` | `{"feature_directory": "specs/NNN-name"}` — the **single source of truth** for the active feature. Decoupled from git branch name. |
121: | `.specify/init-options.json` | `feature_numbering: "sequential"`, `ai: "opencode"`, `script: "ps"`, `speckit_version`. |
122: | `.specify/integration.json` | opencode integration; `invoke_separator: "."`. |
123: | `.specify/integrations/opencode.manifest.json` | SHA-256 hashes of the 10 command files (integrity). |
124: | `.specify/workflows/speckit/workflow.yml` | Optional bundled full-cycle workflow (specify → gate → plan → gate → tasks → implement). |
125: | `.specify/workflows/workflow-registry.json` | Registry of installed workflows. |
126: | `.specify/memory/constitution.md` | **The constitution** (VIVIM constitution here: Governor Canon, Store Contracts, One Entry Point, Research-First, Testing Gates). |
127: | `.specify/templates/*.md` | spec / plan / tasks / checklist / constitution templates (pre-tuned for vivim-final). |
128: | `.specify/memory/.constitution-template.json` | Template metadata for constitution init. |
129: 
130: ---
131: 
132: ## 5. How the Agentic LLM Ensures Compliance
133: 
134: Spec-Kit bakes compliance into the pipeline so the agent cannot silently skip governance. The mechanisms:
135: 
136: ### 5.1 Constitution Authority (highest severity)
137: - `.specify/memory/constitution.md` is **non-negotiable**. `analyze` treats any spec/plan/task conflicting with a MUST principle as automatically **CRITICAL**.
138: - `converge` ranks constitution-violation findings first and emits them as **CRITICAL** remediation tasks.
139: - The constitution is wired to vivim-final's invariants (Governor Canon, Store Contracts, One Entry Point), so the SDD pipeline is the same enforcement surface as `bun run devops invariants check`.
140: 
141: ### 5.2 Phase Gates (prerequisite enforcement)
142: - Every command runs `check-prerequisites.ps1` (or equivalent) first. Missing artifact → hard stop with the corrective command. No artifact, no implementation.
143: - `plan.md` has an explicit **Constitution Check** section the agent must fill and pass before design; re-checked post-design.
144: 
145: ### 5.3 Checklist Gates (requirement quality)
146: - `specify` auto-generates `checklists/requirements.md`; `clarify` re-validates it after each answer (toggles `[ ]`/`[x]` only).
147: - `implement` scans all checklists; if any item is incomplete it **stops and asks** before proceeding (user must explicitly say yes).
148: 
149: ### 5.4 Traceability (IDs everywhere)
150: - `FR-###`, `SC-###` in spec; `T###` in tasks; `CHK###` in checklists.
151: - `tasks.md` maps each task to a user story `[US#]`; `converge` appends tasks traced to `FR-###` / `SC-###` / `US#/AC#` / `Constitution II`.
152: - `analyze` produces a **Coverage Summary** (requirement → task mapping, coverage %), surfacing any requirement with zero tasks.
153: 
154: ### 5.5 Append-Only Discipline
155: - `converge` **only** appends a `## Phase N: Convergence` section to `tasks.md`. It never rewrites, renumbers, or deletes existing tasks or application code. If nothing remains, `tasks.md` is left byte-for-byte unchanged.
156: 
157: ### 5.6 Deterministic, Read-Only Analysis
158: - `analyze` is **STRICTLY READ-ONLY** — it never writes files, only reports. This gives a safe pre-implementation consistency pass (duplication, ambiguity, underspecification, coverage gaps, inconsistency, constitution alignment) capped at 50 findings.
159: 
160: ---
161: 
162: ## 6. Running the Full Ralph Loop (Autonomous End-to-End)
163: 
164: A **"ralph loop"** = driving the entire SDD pipeline autonomously, gate-to-gate, until the feature is implemented and converged. The agent is the runtime; it does not stop between phases unless a gate blocks.
165: 
166: ### 6.1 Preconditions
167: - Stack understands the feature intent (a natural-language description).
168: - `bun` available; `.specify/feature.json` will be (re)written by `specify`/`create-new-feature`.
169: - Decide numbering: `sequential` (default) or a fresh `-Timestamp` run.
170: 
171: ### 6.2 The loop (ordered)
172: ```text
173: 1. /speckit.specify "<feature description>"
174:       → creates specs/NNN-name/, spec.md, checklists/requirements.md
175:       → validates spec against quality checklist (≤3 iterations)
176:       → resolves ≤3 [NEEDS CLARIFICATION] markers (presents options, waits for answers)
177: 
178: 2. (optional but recommended) /speckit.clarify
179:       → resolves up to 5 ambiguities, writes them into spec.md :: ## Clarifications
180:       → re-validates checklists/requirements.md
181: 
182: 3. /speckit.plan
183:       → setup-plan.ps1 copies plan template
184:       → fills Technical Context + Constitution Check (must pass)
185:       → Phase 0: research.md (resolve NEEDS CLARIFICATION)
186:       → Phase 1: data-model.md, contracts/, quickstart.md
187: 
188: 4. (gate) review spec.md + plan.md   ← agent pauses for human approval if in mitm mode
189: 
190: 5. /speckit.tasks
191:       → setup-tasks.ps1 resolves tasks template
192:       → generates phased tasks.md (Setup → Foundational → US1..USn → Polish)
193:       → each task: T### [P?] [US#?] + file path
194: 
195: 6. (optional) /speckit.analyze   → read-only consistency report (coverage %, CRITICALs)
196:    (optional) /speckit.checklist  → extra domain checklists (ux.md, security.md, …)
197: 
198: 7. /speckit.implement
199:       → checks checklists status; HALTS if incomplete (asks yes/no)
200:       → executes phases in order; respects [P] parallel markers
201:       → marks tasks [X] as completed; runs per-unit/per-phase gates
202:       → creates/verifies ignore files per tech stack
203: 
204: 8. /speckit.converge
205:       → compares code vs spec/plan/tasks
206:       → appends ## Phase N: Convergence tasks for gaps (missing/partial/contradicts/unrequested)
207:       → if clean: reports "✅ Converged"
208: 
209: 9. (optional) /speckit.taskstoissues
210:       → converts tasks.md lines to GitHub issues (dedup by T###, only if remote is GitHub)
211: ```
212: 
213: ### 6.3 Autonomous vs gated modes
214: - **Fully autonomous:** run steps 1→8 back-to-back. The only intrinsic stops are:
215:   - `specify` clarification questions (≤3) — supply answers or accept recommended defaults.
216:   - `implement` checklist-incomplete prompt — answer `yes` to proceed.
217:   - Any `ERROR` gate (unresolved constitution violation, missing prerequisite) — must be fixed, not skipped.
218: - **mitm / human-in-the-loop:** insert approval gates after `plan` (step 4) and after each `implement` story checkpoint. Use this when the feature is high-risk.
219: 
220: ### 6.4 Convergence iteration (the "loop" part)
221: After step 8, if `converge` appended tasks:
222: ```text
223: run /speckit.implement again   → completes the convergence tasks
224: run /speckit.converge again    → should find fewer/no gaps
225: ```
226: Repeat until `converge` reports **Converged**. This is the ralph loop's tail: it contracts the gap to zero.
227: 
228: ### 6.5 Compliance guarantees the loop cannot violate
229: Even in full autonomy, the loop cannot:
230: - Implement before `spec.md` + `plan.md` + `tasks.md` exist (prerequisite scripts block).
231: - Skip the constitution (Constitution Check in plan; CRITICAL in analyze/converge).
232: - Ship with incomplete requirement checklists (`implement` halts).
233: - Lose traceability (every task ID-mapped; convergence tasks trace to FR/SC/US/Constitution).
234: - Silently delete prior work (`converge` is append-only; `analyze` is read-only).
235: 
236: ---
237: 
238: ## 7. Quick Reference — Command → Script → Artifact
239: 
240: | Command | Script invoked | Key artifact read | Key artifact written |
241: |---------|----------------|-------------------|----------------------|
242: | specify | create-new-feature.ps1 | (template) | specs/NNN-name/spec.md, checklists/requirements.md, feature.json |
243: | clarify | check-prerequisites.ps1 -PathsOnly | spec.md, constitution.md | spec.md (## Clarifications) |
244: | plan | setup-plan.ps1 | spec.md, constitution.md | plan.md, research.md, data-model.md, contracts/, quickstart.md |
245: | tasks | setup-tasks.ps1 | plan.md, spec.md | tasks.md |
246: | analyze | check-prerequisites.ps1 -RequireTasks -IncludeTasks | spec/plan/tasks | (none — report only) |
247: | checklist | check-prerequisites.ps1 | spec/plan/tasks | checklists/<domain>.md |
248: | implement | check-prerequisites.ps1 -RequireTasks -IncludeTasks | tasks.md, plan.md, checklists | application code; tasks.md (`[X]`) |
249: | converge | check-prerequisites.ps1 -RequireTasks -IncludeTasks | spec/plan/tasks | tasks.md (## Phase N: Convergence) |
250: | taskstoissues | check-prerequisites.ps1 -RequireTasks -IncludeTasks | tasks.md | GitHub issues |
251: | constitution | (none) | constitution.md (template) | constitution.md + Sync Impact Report |
252: 
253: ---
254: 
255: ## 8. Common Pitfalls
256: 
257: 1. **Branch ≠ feature dir.** The spec directory name (`specs/NNN-name`) is independent of the git branch. Locate the active feature via `.specify/feature.json`, never by branch name.
258: 2. **Don't hand-run setup scripts.** They are invoked by the command files. Running them standalone can double-write or mis-resolve paths.
259: 3. **Clarification caps.** `specify` allows ≤3 markers; `clarify` allows ≤5 questions. Beyond that, make informed guesses and document assumptions.
260: 4. **Checklists are not tests.** `CHK###` items validate *requirement writing*, not implementation. Writing "Verify the button clicks" fails the checklist command's own rules.
261: 5. **Don't skip `converge`.** It is the only phase that proves the code matches the spec. A green `bun test` is not proof of spec satisfaction.
262: 6. **Constitution edits require semver + propagation.** `/speckit.constitution` bumps the version and re-syncs templates; do not edit `constitution.md` by hand without running it.
263: 7. **PowerShell-only invocation for repo scripts.** Spec-Kit scripts are PowerShell; repo PS1 service scripts must be run as `pwsh scripts/<name>.ps1` from repo root (see AGENTS.md Shell Environment).
264: 
265: ---
266: 
267: ## 9. Relationship to Other Systems
268: 
269: - **AGENTS.md** — project conventions, invariants, CLI reference. Spec-Kit's constitution is the SDD-facing mirror of AGENTS.md's invariants.
270: - **devops / devops-fullstack skills** — the autonomous implementation *runtime*. Spec-Kit produces `tasks.md`; `devops`/`devops-fullstack` is how you execute it (and `implement` is the Spec-Kit-native path). Prefer Spec-Kit's `implement` for spec-driven features; use `devops` for atomic-unit loops outside a spec.
271: - **docs/roadmap/INVARIANTS.md** — full boundary conditions. The constitution summarizes the non-negotiable subset.
272: - **GitHub Spec Kit** — upstream: `github/spec-kit` v0.12.17. Re-init with `specify init --here --integration opencode --ignore-agent-tools --force` if command files are missing.
273: 
274: ### 9.1 Bridge Infrastructure (DevOps ↔ SpecKit)
275: 
276: SpecKit files (commands, templates, `.specify/`) are **never modified**. DevOps becomes
277: SpecKit-aware through bridge modules in `devops/` that map IDs, sync state, unify gates,
278: convert research formats, and run a consolidated converge. The canonical cross-system
279: workflow and decision table live in:
280: 
281: - **`docs/integration/UNIFIED-WORKFLOW.md`** — 6-step workflow (research → specify → plan → tasks → implement → converge+audit) with the exact SpecKit command, DevOps command, and bridge module per step.
282: - **`docs/integration/DECISION-TABLE.md`** — scenario → system mapping (SpecKit only / DevOps only / both).
283: 
284: Bridge modules:
285: 
286: | Module | Purpose | Path |
287: |--------|---------|------|
288: | speckit-bridge | Task↔unit ID mapping, sync, validation | `devops/speckit-bridge.ts` |
289: | unified-gate | Unified quality gate (typecheck/lint/test + SpecKit checklists) | `devops/unified-gate.ts` |
290: | research-bridge | Brief↔`research.md` format conversion | `devops/research-bridge.ts` |
291: | tracker-speckit-sync | Bidirectional tracker↔tasks sync | `devops/tracker-speckit-sync.ts` |
292: | speckit-converge-bridge | Consolidated converge (spec+code+arch) | `devops/speckit-converge-bridge.ts` |
293: | speckit-audit | Skill readiness audit (12 skills) | `devops/speckit-audit.ts` |
294: 
295: CLI surface: `bun run devops speckit <map-task|map-unit|sync|sync-all|validate|gate|converge|find-brief|export-brief|import-research|audit>`.

(End of file - total 295 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\AGENTS.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\AGENTS.md</path>
<type>file</type>
<content>
1: # AGENTS.md — vivim-final Project Instructions
2: 
3: ## Project Overview
4: 
5: **vivim-final** is cap-store v1 Knowledge Graph Rebuild — a local-first AI conversation platform built with Bun + Prisma + TypeScript.
6: 
7: - **Runtime:** Bun
8: - **Language:** TypeScript (strict mode, ESNext target)
9: - **ORM:** Prisma v6.5
10: - **Linter/Formatter:** Biome
11: - **Git Hooks:** Lefthook
12: - **Testing:** Bun test runner
13: - **Build:** tsup (ESM + DTS)
14: 
15: ## Architecture
16: 
17: 13 engines organized in layers:
18: - **L0-L1:** Provider Knowledge Graph (ProviderRegistrar, ProviderHealthKernel)
19: - **L2-L3:** Capability System (CapabilityResolutionEngine, CapabilityEngine)
20: - **L4:** Session & State (ConversationManager, StreamBlockStore)
21: - **Chrome Layer:** ChromeGovernor (CDP proxy, lifecycle, trace, health)
22: - **Cross-cutting:** CapabilityEventBus, ConfigManager, StreamParserEngine
23: - **Lifecycle:** RegistrationAuditor, VersionManager, TelemetryAggregator
24: 
25: Design docs are in `docs/merged-design-v2/`. Read in order 00-08 for v1, then SOTA-00 through SOTA-09.
26: 
27: ### Unified Canvas & Conceptual Model (primary frontend surface)
28: The frontend is a single infinite **React-Flow canvas** (`web/ui/src/features/canvas/CanvasSurface.tsx`)
29: that renders every UI region as a node. Surfaces are **generated from a DB-backed provider-type
30: conceptual model** (NOT in-repo provider docs):
31: - `ProviderType` + `UiComponent` tables drive all surfaces; `UiComponent` holds 4 resolution tiers via
32:   a unique `(scope, ownerId, variant)` key (precedence: provider+variant > provider > family+variant >
33:   family > cross-type > system default). Resolved by `src/engines/conceptual-model-service.ts`.
34: - Seeded at **server boot** from `seeds/conceptual-model/seed.ts`.
35: - Canvas runtime: `CanvasLayerMounter` (`src/engines/canvas-layer-mounter.ts`), live events
36:   `canvas:layer:*` on `CapabilityEventBus`, `registerCanvasLayerForwarder` on `/ws/canvas`,
37:   `GET /api/conversations/:id/stream-blocks` for progressive result rendering.
38: - `ChatPage` (slot-based `UIComponentRegistry`) is retained as a secondary tab; the canvas is the
39:   generative backbone. Source of truth: `docs/roadmap/prds/PRD-VIVIM-CANVAS-UNIFIED-SURFACE.md`.
40: 
41: ## Code Conventions
42: 
43: ### TypeScript
44: - Use `@/*` path aliases (maps to `./src/*`)
45: - Prefer `type` imports: `import type { Foo } from './bar.js'`
46: - Use `.js` extension in imports (Bun ESM requirement)
47: - No `any` — use `unknown` + type narrowing
48: - Use Zod for runtime validation at boundaries
49: - Prefer `const` over `let`, avoid `var`
50: - Use ULID for IDs (`src/ids.ts`)
51: - Export from `src/index.ts` as barrel
52: 
53: ### Error Handling
54: - Custom error classes from `src/errors.ts`
55: - Never swallow errors silently
56: - Use `Result<T, E>` pattern where appropriate
57: - Log errors with context before throwing
58: 
59: ### Database
60: - All schema in Prisma (`prisma/schema.prisma`)
61: - Migrations via `bunx prisma migrate dev`
62: - Seed data loaded once via `bun run db:setup` (or `bunx prisma db seed`), **not at boot**
63: - Seed JSON manifests in `seeds/` are the authoritative data source
64: - `bun run serve` starts engines only — no re-seeding, no migrate
65: - Use transactions for multi-table writes
66: - Never bypass Prisma for raw SQL unless performance-critical
67: 
68: ### Database Operations (all capability-backed)
69: 
70: | Command | Purpose |
71: |---------|---------|
72: | `bun run db:setup` | Fresh install: migrate + seed (first time only) |
73: | `bun run db:seed` | Re-seed all providers from JSON manifests |
74: | `bun run db:migrate` | Apply pending Prisma migrations |
75: | `bun run db:reset` | Wipe DB, migrate, seed (requires --force) |
76: | `bun run db:status` | Table row counts, DB file size, migration history |
77: | `bun run db:backup` | VACUUM INTO snapshot to ./backups/ |
78: | `bun run db:check` | PRAGMA integrity_check |
79: 
80: **Adding a provider:** Edit `seeds/providers/<slug>.json`, then run `bun run db:seed`.
81: 
82: ### Testing
83: - Unit tests: `tests/unit/` — test individual functions
84: - Integration tests: `tests/integration/` — test engine interactions with mocked stores
85: - E2E tests: `tests/e2e/` — full stack tests
86: - Mock store contracts for unit/isolation tests
87: - Aim for 80%+ coverage on engines
88: 
89: ### File Organization
90: ```
91: src/
92:   cli/          # CLI entry points
93:   config.ts     # Configuration
94:   engines/      # Core engines (one file per engine)
95:   errors.ts     # Custom error classes
96:   ids.ts        # ID generation (ULID)
97:   index.ts      # Public barrel exports
98:   schema/       # Zod schemas
99:   server/       # HTTP server / API routes
100:   storage/      # Database access layer (Prisma wrappers)
101: tests/
102:   unit/         # Unit tests
103:   integration/  # Integration tests
104:   e2e/          # End-to-end tests
105:   helpers/      # Test utilities
106: seeds/          # Database seed files
107: ```
108: 
109: ## When Implementing Engines
110: 
111: 1. Read the engine spec from `docs/merged-design-v2/04-merged-engines.md` or `05-merged-lifecycles.md`
112: 2. Define TypeScript interface first (match spec exactly)
113: 3. Define Store Contract (what the engine needs from storage)
114: 4. Implement with proper error handling
115: 5. Write unit tests with mocked store contract
116: 6. Write integration tests for engine-to-engine interactions
117: 
118: ### When Adding a Frontend Surface (Canvas / Conceptual Model)
119: 
120: The primary frontend surface is the **unified infinite canvas** (`web/ui/src/features/canvas/CanvasSurface.tsx`),
121: driven by the DB-backed **provider-type conceptual model** (`ProviderType` + `UiComponent`, 4-tier
122: resolution). See `docs/roadmap/prds/PRD-VIVIM-CANVAS-UNIFIED-SURFACE.md`.
123: 
124: - Prefer adding a `UiComponent` tier (or seed row in `seeds/conceptual-model/seed.ts`) over a hardcoded
125:   `if (slug === 'x')` branch in a React component.
126: - Use `vivi-frontend` / `devops-fullstack` skills for the build recipe. `ChatPage` is a retained
127:   secondary tab; the canvas is the generative backbone.
128: - Live layer events: `canvas:layer:spawned` / `canvas:layer:dismissed` on `CapabilityEventBus`,
129:   forwarded over `/ws/canvas` via `registerCanvasLayerForwarder`.
130: - Progressive results: `useStreamBlocks.ts` → `GET /api/conversations/:id/stream-blocks`
131:   (`ContentBlock[]` in `shared/stream-blocks.ts`, keyed by `index`).
132: 
133: ### Unified Workflow (SpecKit + DevOps Integration)
134: 
135: SpecKit (spec-driven development) and the DevOps orchestrator are integrated via bridge modules
136: in `devops/` (SpecKit files are never modified). When working on a spec-driven feature:
137: 
138: - **Canonical workflow + decision table:** `docs/integration/UNIFIED-WORKFLOW.md` and `docs/integration/DECISION-TABLE.md`
139: - **Task↔unit linkage:** after `/speckit.tasks`, run `bun run devops speckit sync <featureDir>` to link `T###` tasks to atomic units.
140: - **Quality gate:** `bun run devops speckit gate --feature=<dir> --scope=phase` (wraps typecheck/lint/test + SpecKit checklists).
141: - **Converge:** `bun run devops speckit converge <featureDir>` runs spec/code/arch analysis and appends convergence tasks to `tasks.md`.
142: 
143: Bridge modules: `devops/speckit-bridge.ts`, `devops/unified-gate.ts`, `devops/research-bridge.ts`,
144: `devops/tracker-speckit-sync.ts`, `devops/speckit-converge-bridge.ts`, `devops/speckit-audit.ts`.
145: 
146: ## Invariants (Boundary Conditions)
147: 
148: **Full document:** `docs/roadmap/INVARIANTS.md`
149: 
150: Non-negotiable constraints enforced by `bun run devops invariants check`.
151: 
152: ### Critical Boundaries (Never Violate)
153: 
154: 1. **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
155: 2. **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
156: 3. **Research-First:** No implementation without research report classification.
157: 4. **Phase Gates:** Phase N requires phase N-1 complete.
158: 
159: ### One Entry Point (v10 Invariant)
160: 
161: Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that
162: call `POST /api/interpret` → `POST /api/capabilities/:id/execute`.
163: 
164: - **New capability?** Register in `registerDefaultCapabilities` / a `*caps.ts` module.
165: - **New NL phrase?** Add a pattern to `catalog.ts` bound to a `capabilityId`.
166: - **Never:** hand-write CLI commands, hand-write UI actions, or open a second transport.
167: - **New UI surface for a provider family?** Add a `UiComponent` tier (4-tier conceptual model), not a
168:   hardcoded React branch. The canvas (`web/ui/src/features/canvas/CanvasSurface.tsx`) is the primary
169:   surface; `ChatPage` is a secondary tab.
170: 
171: #### Adding a Capability
172: 
173: Use Unit 24.1 (registry contract), Unit 24.3 (CLI generation), and Unit 25.1 (catalog binding):
174: 
175: 1. Create a capability in `src/engines/*caps.ts` using `makeCapability` or `registerSessionCaps` pattern
176: 2. Register it with `surfaces: ['cli', 'ui', 'api']` to enable all transports
177: 3. Add NL patterns to `src/engines/nlcl/catalog.ts` linking to your capabilityId
178: 4. Add `cliCommand`, `ui`, and `mcpToolName` for cross-surface parity
179: 
180: ### Taxonomy Chain Gotchas (CRITICAL)
181: 
182: Lessons from building the taxonomy generation pipeline and cross-surface verification.
183: 
184: 1. **UI slot IDs must be namespaced** — The frontend `SLOT_IDS` in `web/ui/src/ui/slots.ts` use `chat.actionBar`, `chat.composer`, `chat.sidebar` (not short names). The taxonomy pipeline's `CATEGORY_POSITIONS` table must use these exact values or `ui_position` silently fails.
185: 
186: 2. **Capability nodes may lack `category`** — Shared capability nodes often have no `category` field. When generating `apiEndpoint.path`, derive category from `slug.split('_')[0]` — not `node.category`.
187: 
188: 3. **`Bun.spawn` exitCode is null** — `proc.exitCode` returns `null` until `await proc.exited` resolves. Always await the promise before reading exit code.
189: 
190: 4. **Single-segment slugs** — `capId` format is `cap:${category}:${action}`. For single-segment slugs (e.g. `help`), use `cap:help:help` — never `cap:undefined:help`.
191: 
192: 5. **Verify after taxonomy changes** — Run `bun run devops verify-cross-surface` after any change to taxonomy pipeline, shared pool, or skeleton platforms. It checks CLI (name), API (path), MCP (tool name), UI (slot id).
193: 
194: ## Shell Environment (CRITICAL)
195: 
196: **All commands MUST be PowerShell-compatible.** The default shell is PowerShell 7+.
197: 
198: ### PS1 Script Invocation (CRITICAL — NEVER GET WRONG)
199: 
200: PS1 scripts use `$PSScriptRoot` to find the project root. This auto-variable is `$null`
201: when the script is NOT invoked as a direct file — causing ALL downstream paths to collapse.
202: These scripts start/stop the backend, frontend, and health monitor:
203: 
204: | Script | Purpose |
205: |--------|---------|
206: | `scripts/start-bg.ps1` | NON-BLOCKING: launch backend + frontend (returns immediately, poll health after) |
207: | `scripts/start-all.ps1` | BLOCKING: launch backend + frontend (waits for bind) |
208: | `scripts/start-backend.ps1` | Launch backend only |
209: | `scripts/start-frontend.ps1` | Launch frontend only |
210: | `scripts/stop-all.ps1` | Stop all services (infallible) |
211: | `scripts/health-check.ps1` | Continuous health monitoring |
212: 
213: **✅ CORRECT — always use `pwsh scripts/<name>.ps1` from repo root:**
214: ```powershell
215: # From repo root (C:\0-BlackBoxProject-0\vivim-final):
216: pwsh scripts/start-bg.ps1         # non-blocking (recommended)
217: pwsh scripts/start-all.ps1        # blocking
218: pwsh scripts/stop-all.ps1
219: ```
220: 
221: **❌ NEVER do any of these (they silently break `$PSScriptRoot`):**
222: ```powershell
223: Get-Content scripts/start-all.ps1 | pwsh -            # inline pipe → $null
224: pwsh -c "scripts/start-all.ps1"                       # -c string → $null
225: pwsh -Command ".\scripts\start-all.ps1"               # -Command → $null
226: & "scripts/start-all.ps1"                              # call-operator → $null
227: Start-Process pwsh -ArgumentList "scripts\start-all.ps1"  # direct call → $PSScriptRoot may not resolve (use start-bg.ps1 instead)
228: pwsh -File scripts/start-all.ps1                      # -File from wrong CWD → path wrong
229: ```
230: 
231: ### PowerShell Command Patterns
232: ```powershell
233: # Navigate to project root
234: Set-Location "C:\0-BlackBoxProject-0\vivim-final"
235: 
236: # Run typecheck with output capture
237: bun run typecheck 2>&1 | Select-Object -First 50
238: 
239: # List engine files
240: Get-ChildItem -Path src/engines -Recurse -Filter *.ts
241: 
242: # Search for TODOs in codebase
243: Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String -Pattern "TODO"
244: ```
245: 
246: ## Testing Protocol
247: 
248: - Run `bun test` before every commit
249: - Run `bun run typecheck` to catch type errors
250: - Run `bun run lint` to catch style issues
251: - Run `bun run devops audit-code [surface|standard|deep|full]` for a source-code audit (P0–P3 findings + fix instructions); `audit-code fix <id> [--apply]` applies auto-fixable ones
252: - Run `bun run devops verify-cross-surface` after any taxonomy chain change (verifies every capability resolves across CLI/API/MCP/UI)
253: - Use `bun test tests/unit/engines/[engine-name]` for targeted testing
254: - Integration tests should use in-memory or test database
255: - **ALWAYS** use PowerShell-compatible commands
256: 
257: ## Git Conventions
258: 
259: - Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
260: - One logical change per commit
261: - Reference engine names in commits: `feat(CapabilityEngine): add selector resolution`
262: 
263: ## MCP Servers
264: 
265: - **Playwright** — browser automation for E2E testing and UI validation.
266: - **INVARIANT:** Do NOT use Playwright for dev-loop UI verification. The project has its
267:   own CDP-based browser automation via `devops runtime-test engage|verify|debug` (the
268:   `vivim-debugging` skill). Use those for canvas/UI verification during the dev loop.
269: 
270: ---
271: 
272: ## Agent skills
273: 
274: ### Issue tracker
275: 
276: GitHub Issues (`owenservera/vivim-final`). See `docs/agents/issue-tracker.md`.
277: 
278: ### Triage labels
279: 
280: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
281: 
282: ### Domain docs
283: 
284: **Canonical documentation layout:** `docs/INDEX.md` — single source of truth for all documentation.
285: 
286: - `AGENTS.md` — project conventions, invariants, CLI reference
287: - `SPECKIT.md` — Spec-Kit (Spec-Driven Development) full system guide + ralph loop
288: - `docs/atomic/01-tracker.md` — single implementation tracker (267/267 done)
289: - `docs/decisions/ADR-*.md` — architecture decisions
290: - `docs/roadmap/INVARIANTS.md` — boundary conditions
291: - `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md` — 100 user moments + audit
292: - `docs/workstreams/AGENT-*-*.md` — parallel agent workstream briefs
293: - `docs/merged-design-v2/` — design docs (00-08, SOTA-00 through SOTA-09)
294: 
295: **ARCHIVED:** 18 stale atomic tracker versions moved to `.archive/`. Do NOT use these — the canonical tracker is `docs/atomic/01-tracker.md`.
296: 
297: ---
298: 
299: **For devops workflow, atomic task tracking, and implementation protocols:** Load the relevant skills from `.opencode/skill/`.
300: 
301: ## Available Skills
302: 
303: - **devops** — Autonomous implementation loop for atomic units
304: - **devops-fullstack** — LLM-driven full-stack dev loop (backend + API + DB + React UI); the agent IS the runtime. Covers the unified canvas + conceptual-model frontend path.
305: - **vivi-frontend** — Component-driven, contract-first, hot-swappable frontend skill; covers the canvas + provider-type conceptual model surface.
306: - **devops-research** — Research-first intelligence layer with web search and brief generation
307: - **devops-roadmap** — Research-first roadmap with truth scanning and gap discovery
308: - **devops-generators** — Taxonomy generation (PlatformCatalog + ProviderCapabilityTaxonomy) with 4-round pipeline (skeleton → drill-down → UI slot mapping → cross-surface binding)
309: - **source-audit** — P0-P3 source-code audit with 4 depth tiers
310: - **prisma-workflow** — Prisma patterns and workflows for schema/migrations
311: - **vivim-build** — DEPRECATED: Use `devops` skill instead
312: - **vivim-testing** — Testing patterns and test infrastructure
313: - **vivim-runtime** — DEPRECATED: Use `devops-fullstack` skill instead
314: 
315: ## devops-fullstack — Agentic Dev Loop
316: 
317: The agent IS the runtime of its own full-stack dev loop. Launch the stack once via PowerShell, then
318: drive backend engines, API routes, DB, and the React frontend (canvas + conceptual model) to a goal —
319: probe via CLI subcommands, verify through the UI last. Every command exits bounded, returns structured
320: JSON, never hangs.
321: 
322: ```bash
323: # Launch stack non-blocking (poll health after)
324: pwsh scripts/start-bg.ps1
325: 
326: # Full loop (default 5 cycles, autonomous)
327: bun run devops runtime-test loop --max-cycles=3 --mitm
328: 
329: # Individual
330: bun run devops runtime-test preflight
331: bun run devops runtime-test discover-backend
332: bun run devops runtime-test test --nl "list conversations"
333: ```
334: 
335: **Modes:** autonomous (full loop) | mitm (pauses after debug for agent decision)
336: 
337: **Agent-safety:** 15s bootstrap timeout, 5s per fetch, 2min overall cap, fast-port if server alive.
338: 
339: **Skill source:** `.opencode/skill/devops-fullstack/SKILL.md` (source of truth)
340: 
341: ## Spec Kit — Spec-Driven Development
342: 
343: This project uses [GitHub Spec Kit](https://github.com/github/spec-kit) (`github/spec-kit`) for
344: Spec-Driven Development. The `specify` CLI (v0.12.17) is installed via `uv` and initialized
345: with `--integration opencode`.
346: 
347: **▶ Full system guide, command reference, orchestration internals, compliance model, and the
348: autonomous end-to-end "ralph loop" procedure are in [`SPECKIT.md`](./SPECKIT.md).**
349: Read it before running any `/speckit.*` command or wiring a feature through the SDD pipeline.
350: 
351: ### Setup (one-time)
352: ```powershell
353: # Already done. Re-run if needed:
354: uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.12.17
355: specify init --here --integration opencode --ignore-agent-tools --force
356: ```
357: 
358: ### Available Slash Commands (in `.opencode/commands/speckit.*.md`)
359: | Command | Purpose |
360: |---------|---------|
361: | `/speckit.constitution` | Create/update project governing principles (`.specify/memory/constitution.md`) |
362: | `/speckit.specify` | Define what to build (requirements + user stories) |
363: | `/speckit.clarify` | Clarify underspecified areas (optional, pre-plan) |
364: | `/speckit.plan` | Create technical implementation plan |
365: | `/speckit.tasks` | Generate actionable task list from plan |
366: | `/speckit.analyze` | Cross-artifact consistency analysis (optional, read-only) |
367: | `/speckit.checklist` | Generate requirement-quality checklists (optional) |
368: | `/speckit.implement` | Execute all tasks |
369: | `/speckit.converge` | Assess codebase against spec/plan/tasks (append-only) |
370: | `/speckit.taskstoissues` | Convert tasks to GitHub issues |
371: 
372: ### Current Active Spec
373: - Active feature tracked in `.specify/feature.json` (currently `specs/006-provider-account-dashboard`).
374: - Historical workstream specs: `specs/001-production-hardening`, `specs/002-canvas-surface`,
375:   `specs/003-chat-advanced`, `specs/004-provider-ops-e2e`.
376: 
377: ### Canonical Workflow
378: `constitution → specify → clarify → plan → tasks → (analyze | checklist) → implement → converge`
379: (See `SPECKIT.md §1` and `§6` for the full loop and compliance guarantees.)

(End of file - total 379 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 8.2s)

_Thinking:_

Good, I've got the main documents. Now let me read the integration docs (UNIFIED-WORKFLOW.md and DECISION-TABLE.md), plus the devops skills and the bridge modules to understand the full picture.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\docs\\integration\\UNIFIED-WORKFLOW.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\docs\integration\UNIFIED-WORKFLOW.md</path>
<type>file</type>
<content>
1: # Unified Workflow: SpecKit + DevOps Integration
2: 
3: ## Overview
4: 
5: The vivim-final project uses **two complementary systems** for structured development:
6: 
7: - **SpecKit** (spec-driven development) defines *what* to build — requirements, plans, task breakdowns — via the `/speckit.*` command family living in `.specify/` and `.opencode/commands/speckit.*.md`.
8: - **DevOps** (autonomous agentic orchestrator) *builds* it — tracker-driven atomic units and goal-driven full-stack loops — via the `devops/` CLI and `.opencode/skill/devops*/SKILL.md` skills.
9: 
10: The integration layer (bridge modules in `devops/`) makes the two systems mutually aware **without modifying any SpecKit files**. SpecKit remains untouched; DevOps becomes SpecKit-aware through bridge modules that map IDs, sync state, unify gates, convert research formats, and run a consolidated converge.
11: 
12: ## The Canonical Workflow
13: 
14: ### Step 1: Research (if needed)
15: 
16: - **SpecKit:** `/speckit.clarify` (optional, pre-plan) produces `research.md`
17: - **DevOps:** `bun run devops research topic <name>` produces `docs/research/briefs/<topic>-brief.md`
18: - **Bridge:** `devops/research-bridge.ts` converts between the two formats
19:   - `exportBriefForSpecKit(brief, featureDir)` → `research.md` content
20:   - `importSpecKitResearch(featureDir)` → `Brief`
21:   - `findStaleSpecKitResearch()` → freshness scan
22: - **Output:** `specs/NNN-name/research.md` + `docs/research/briefs/<topic>-brief.md`
23: 
24: ### Step 2: Specify
25: 
26: - **SpecKit:** `/speckit.specify "<description>"`
27: - **DevOps:** (not used)
28: - **Output:** `specs/NNN-name/spec.md`, `checklists/requirements.md`
29: 
30: ### Step 3: Plan
31: 
32: - **SpecKit:** `/speckit.plan`
33: - **DevOps:** (research feeds into plan Phase 0 via the research bridge)
34: - **Output:** `plan.md`, `data-model.md`, `contracts/`, `quickstart.md`
35: 
36: ### Step 4: Tasks
37: 
38: - **SpecKit:** `/speckit.tasks`
39: - **DevOps:** `bun run devops speckit sync <featureDir>` (links tasks to the atomic tracker)
40: - **Bridge:** `devops/speckit-bridge.ts`
41:   - `syncTasksToTracker(featureDir)` → creates/updates atomic units with bidirectional links
42:   - `mapTaskToUnit("T012")` → linked unit or `null`
43:   - `mapUnitToTask("2.1")` → linked task ID or `null`
44: - **Output:** `tasks.md` with `<!-- bridge:unit=... -->` linkage comments
45: 
46: ### Step 5: Implement
47: 
48: - **SpecKit:** `/speckit.implement` (with unified gate)
49: - **DevOps:** `bun run devops runtime-test loop` (goal mode) OR tracker mode (`devops select` → `devops mark`)
50: - **Gate:** `bun run devops speckit gate --feature=<dir> --scope=phase`
51: - **Bridge:** `devops/unified-gate.ts` (`runUnifiedGate(config)`) orchestrates typecheck + lint + tests + SpecKit checklists
52: 
53: ### Step 6: Converge + Audit
54: 
55: - **SpecKit:** `/speckit.converge`
56: - **DevOps:** `bun run devops speckit converge --feature=<dir>`
57: - **Bridge:** `devops/speckit-converge-bridge.ts` (`unifiedConverge(featureDir)`)
58:   - Runs spec/code/arch analysis and appends convergence tasks to `tasks.md`
59:   - Sources: `audit-code`, `audit-arch`, `speckit-bridge.validateBridge()`
60: - **Output:** Consolidated report + appended `## Phase N: Convergence` tasks
61: 
62: ## Decision Table
63: 
64: See [DECISION-TABLE.md](./DECISION-TABLE.md) for the full scenario → system mapping.
65: 
66: ## Bridge Modules Reference
67: 
68: | Module | Purpose | Path |
69: |--------|---------|------|
70: | speckit-bridge | Task↔unit ID mapping, sync, validation | `devops/speckit-bridge.ts` |
71: | unified-gate | Unified quality gate (typecheck/lint/test/SpecKit) | `devops/unified-gate.ts` |
72: | research-bridge | Brief↔research.md format conversion | `devops/research-bridge.ts` |
73: | tracker-speckit-sync | Bidirectional tracker↔tasks sync | `devops/tracker-speckit-sync.ts` |
74: | speckit-converge-bridge | Unified converge pipeline | `devops/speckit-converge-bridge.ts` |
75: | speckit-audit | Skill readiness audit | `devops/speckit-audit.ts` |
76: 
77: ## CLI Surface
78: 
79: ```
80: bun run devops speckit map-task <T###>        Map task ID to unit
81: bun run devops speckit map-unit <N.M>         Map unit ID to task
82: bun run devops speckit sync <featureDir>      Sync tasks→tracker (create units)
83: bun run devops speckit sync-feature <dir>     Sync feature tasks→tracker (update state)
84: bun run devops speckit sync-unit <unitId>     Sync unit state→tasks.md
85: bun run devops speckit sync-all               Sync all features to tracker
86: bun run devops speckit validate              Check bridge consistency
87: bun run devops speckit gate [--scope=...]     Unified quality gate
88: bun run devops speckit converge <featureDir>  Run unified converge (spec+code+arch)
89: bun run devops speckit find-brief <topic>     Find DevOps research brief
90: bun run devops speckit export-brief <t> <dir> Export brief to SpecKit format
91: bun run devops speckit import-research <dir>  Import SpecKit research to DevOps format
92: bun run devops speckit audit                  Audit skills for SpecKit readiness
93: ```

(End of file - total 93 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\docs\\integration\\DECISION-TABLE.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\docs\integration\DECISION-TABLE.md</path>
<type>file</type>
<content>
1: # Decision Table: SpecKit vs DevOps
2: 
3: Use this table to decide which system (or both) to drive a given scenario.
4: 
5: | Scenario | Use SpecKit | Use DevOps | Use Both | Why |
6: |----------|------------|------------|----------|-----|
7: | New feature with requirements | `specify` → `plan` → `tasks` | — | implement via devops loop | SpecKit defines **what**; DevOps builds it |
8: | Bug fix | — | goal mode (`devops runtime-test loop`) | — | No spec needed; fix directly |
9: | Atomic unit from tracker | — | tracker mode (`devops select`/`mark`) | — | Already defined in tracker |
10: | Architecture change | `plan` (constitution check) | `audit-arch` | `converge` + `audit` | Plan for design; audit for validation |
11: | Research needed | `clarify` Phase 0 | `devops-research` | bridge brief | DevOps has deeper research; bridge converts formats |
12: | Full release | `tasks` → `implement` → `converge` | `audit-code full` | unified gate | Both systems validate |
13: | Taxonomy expansion | — | `devops-generators` | — | DevOps-only domain |
14: | Frontend UI | `plan` contracts | `vivi-frontend` | — | Plan defines contracts; frontend builds them |
15: | Schema change | `data-model.md` | `prisma-workflow` | — | SpecKit defines model; Prisma implements |
16: | New capability | `plan` → `tasks` | devops loop | `speckit sync` | SpecKit plans; DevOps builds; sync tracks |
17: | Tracking progress across both | — | `devops speckit sync` | — | Bidirectional task↔unit linkage |
18: | Quality gate before commit | — | `devops speckit gate` | — | Unified gate wraps typecheck/lint/test + SpecKit checklists |
19: | Convergence check vs spec | `converge` | `devops speckit converge` | — | Both run spec/code/arch analysis; DevOps appends tasks |
20: | Skill readiness audit | — | `devops speckit audit` | — | Audits 12 skills for SpecKit-awareness |
21: 
22: ## How to Read
23: 
24: - **SpecKit only** — pure spec/plan/task authoring, no code execution.
25: - **DevOps only** — autonomous build/audit loops driven by the tracker or a goal.
26: - **Both** — SpecKit defines the artifact, DevOps executes and tracks it through the bridge.
27: 
28: ## Related Docs
29: 
30: - [UNIFIED-WORKFLOW.md](./UNIFIED-WORKFLOW.md) — the full 6-step canonical workflow.
31: - `devops/speckit-bridge.ts` — task↔unit ID mapping.
32: - `devops/unified-gate.ts` — unified quality gate.
33: - `devops/speckit-converge-bridge.ts` — consolidated converge pipeline.

(End of file - total 33 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\.opencode\\skill\\devops-fullstack\\SKILL.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\devops-fullstack\SKILL.md</path>
<type>file</type>
<content>
1: ---
2: name: devops-fullstack
3: description: >-
4:   LLM-driven full-stack dev loop for vivim-final. The agent IS the runtime: launch the
5:   stack once via PowerShell, then drive backend engines, API routes, DB, and the React
6:   frontend to a goal — probe via CLI subcommands, verify through the UI last. Use when
7:   implementing a feature, fixing a bug, or extending a capability across the full stack
8:   (backend engine + API route + DB + React UI), or for "build X", "add capability Y",
9:   "fix the broken Z button", "make a new engine".
10: ---
11: 
12: # devops-fullstack — LLM-Driven Full-Stack Dev Loop
13: 
14: **Purpose:** You (the LLM agent) ARE the runtime of the full-stack dev loop for vivim-final.
15: Launch the stack once via PowerShell, then drive backend engines, API routes, database, and the
16: React frontend to a goal — interacting through CLI subcommands first, and verifying through the
17: frontend UI last. Iterate until the goal is met or the budget is exhausted.
18: 
19: > MENTAL MODEL — read this first.
20: > This is NOT a headless automation script. The `loop` subcommand is only a thin orchestration
21: > scaffold; the real loop is *you* making decisions between steps. The CLI subcommands are your
22: > hands; the running servers are your workbench; the browser is your final proof. Servers stay up
23: > across cycles — launch once, stop once.
24: >
25: > This skill is the merger of the former `vivim-runtime` and `devops-fullstack` skills. The name
26: > `vivim-runtime` implied black-box automation; that model is retired. If you find a `vivim-runtime`
27: > skill, treat it as a redirect to this one.
28: 
29: ## ANTI-HANGUP RULES (never violate)
30: 
31: These rules exist because the dev loop has repeatedly hung the agent in PowerShell. Follow them
32: literally; each one was learned from a concrete failure.
33: 
34: 1. **NEVER start servers in the bash tool.** Always use the non-blocking PS1 launcher:
35:    - `pwsh scripts/start-bg.ps1` (full stack, returns immediately — no wait loop)
36:    The bash tool blocks until the command returns; a foreground `bun run serve` never returns and
37:    burns the whole tool timeout. `start-bg.ps1` uses `Start-Process` internally and exits at
38:    once — the real launcher runs as a child process. After launching, poll until healthy:
39:    ```powershell
40:    pwsh scripts/start-bg.ps1
41:    # returns immediately; poll later:
42:    try { Invoke-RestMethod http://localhost:9420/health } catch { sleep 2; retry }
43:    ```
44: 
45: 2. **NEVER invoke PS1 scripts by pipe, -c, -Command, or call-operator.** These methods set
46:    `$PSScriptRoot` to `$null`, which collapses `Split-Path -Parent $PSScriptRoot` to `$null`,
47:    making `$projectRoot` empty and breaking ALL downstream paths. Specifically:
48:    ```powershell
49:    Get-Content scripts/start-all.ps1 | pwsh -           # BROKEN — $PSScriptRoot = $null
50:    pwsh -c "scripts/start-all.ps1"                     # BROKEN
51:    pwsh -Command ".\scripts\start-all.ps1"             # BROKEN
52:    & "scripts/start-all.ps1"                           # BROKEN (call-operator)
53:    Start-Process pwsh -ArgumentList "scripts/start-all.ps1"  # BROKEN (nested pwsh)
54:    pwsh -File scripts/start-all.ps1                    # BROKEN — -File from wrong CWD
55:    ```
56:    The ONLY correct invocations are:
57:    ```powershell
58:    pwsh scripts/start-bg.ps1           # NON-BLOCKING — returns immediately (recommended)
59:    pwsh scripts/start-all.ps1          # blocks until services are bound
60:    ```
61: 
62: 3. **NEVER use `bun -e "..."` in PowerShell.** Quoting mangles the JavaScript (PowerShell strips or
63:    rewrites quotes). Write a `.ts` file and `bun run` it instead.
64: 
65: 4. **NEVER use `bun run dev` as a server.** It blocks the tool. Use `start-backend.ps1`.
66: 
67: 5. **NEVER hardcode port 9420.** Always resolve the live port via `.runtime/backend.port` →
68:    `CAP_STORE_PORT` env → default 9420. The launcher auto-falls back to a free port when 9420 is
69:    held by a zombie socket (a dead PID still LISTENING that `Stop-Process` cannot kill). After launch,
70:    read `.runtime/backend.port` to learn the real port. The shared resolver is
71:    `devops/runtime-test/port.ts` (`resolveBackendPort()` / `backendBaseUrl()`); TypeScript clients use
72:    `getServerPort()` from `src/config.ts`.
73: 
74: 6. **NEVER assume the server is on 9420 after launch.** Check `.runtime/backend.port`.
75: 
76: 7. **ALWAYS verify before test-driving features:** `bun run devops runtime-test health` (expects
77:    `database:OK` and `server:OK`).
78: 
79: 8. **ALWAYS tear down with `pwsh scripts/stop-all.ps1`** — never kill processes manually.
80: 
81: 9. **If the backend won't bind, check `.runtime/backend-out.log`.** A zombie-held port makes
82:    `bun run serve` fail silently; the launcher reports the fallback port in `.runtime/backend.port`.
83: 
84: ## The Operating Procedure (playbook)
85: 
86: Run these phases in order. Each phase is an agent action, not an automated step.
87: 
88: 0. **Acquire the goal (interview-first).** If the user has not stated a concrete goal, use the
89:    `question` tool to interview: what to build/fix, scope, and mode (autonomous vs. mitm).
90:    NEVER build without a goal. Never fall back to a hollow placeholder like `hello` — if goal
91:    interpretation fails, reuse the user's raw goal text or fail loud.
92:  1. **Launch the stack (once) — non-blocking.** `pwsh scripts/start-bg.ps1`
93:     - Returns immediately (does NOT wait for servers to bind).
94:     - Internally calls `start-all.ps1` as a detached child process.
95:     - After launch, poll `/health` until green, or run `bun run devops runtime-test health`:
96:       ```powershell
97:       pwsh scripts/start-bg.ps1
98:       # Then poll:
99:       bun run devops runtime-test health
100:       ```
101:     - If health fails, read `.runtime/backend-out.log` and fix before continuing.
102: 2. **Preflight.** `bun run devops runtime-test health`
103:    - Expects `database:OK` and `server:OK`. If not, debug the launch.
104: 3. **Discover the surface.** `bun run devops runtime-test discover`
105:    - Returns `backendCapabilities[]`, `frontendUrl`, `schemaTables`. Understand what exists
106:      before changing it. FRONTEND=BACKEND: capabilities are linked to UI by `slug`.
107: 4. **Plan.** Probe the NL resolver: `bun run devops runtime-test test --nl="<restated goal>"`.
108:    - A 200/ok means the capability already resolves — you may only need UI wiring. A clarification
109:      or failure tells you what to build. Map the goal to a `cap:<category>:<action>` id + `slug`.
110: 5. **Build (do the real work as the LLM).** See Recipe A/B/C below:
111:    - Backend: engine → Store Contract → `makeCapability(..., handler)` with `surfaces: ALL_SURFACES`
112:      → API route (if not covered by `/api/interpret` or `/api/capabilities/:id/execute`).
113:     - Frontend: use the `vivi-frontend` skill — contract-first, generic-first renderer; promote to
114:       bespoke only on merit. Never hardcode feature logic; render from `ResolvedCapability`.
115:       For any new region/provider-family UI, prefer the **unified canvas + conceptual model** path
116:       (see Recipe E) over a new `ChatPage` slot.
117:    - Database: edit `prisma/schema.prisma` → `bunx prisma migrate dev --name <x>` → update store
118:      contracts → update seeds if needed.
119:    - `bun run typecheck` after every file — don't accumulate errors.
120: 6. **Verify (CLI).** `bun run devops runtime-test test --nl="..."`, `engage` to drive the adopted
121:    browser, `debug` to capture console/screenshot. `verify` writes a DOM render-proof to
122:    `.runtime/screenshots/verify-0.html`. `test-cap --slug=... [--input=JSON]` executes a capability
123:    deterministically by slug (more precise than NL `test`).
124: 7. **Verify (UI).** Use the project's own CDP automation tools: `engage`, `verify`, `debug` CLI
125:    commands from `bun run devops runtime-test`. These drive the browser via CDP natively —
126:    no third-party browser automation needed. Confirm the feature visually. This is the
127:    final gate — a green API test is not enough.
128: 
129:    **INVARIANT: Do NOT use Playwright.** The project has its own CDP-based browser
130:    automation (`engage`/`verify`/`debug`). Playwright is explicitly excluded.
131: 8. **Gate.** `bun run typecheck` → `bun run lint` → `bun test` → `bun run devops audit-code standard`
132:    (P0/P1 findings block). Fix until clean.
133: 9. **Stop (always).** `bun run devops runtime-test stop` (or `pwsh scripts/stop-all.ps1`) — never
134:    leave orphan processes. Use `status` to confirm teardown; use `report` to recall the last loop
135:    outcome across turns.
136: 
137: ### Decision points
138: - Goal ambiguous? → interview again (Phase 0), don't guess.
139: - Capability already exists? → only wire UI (Phase 7), skip backend build.
140: - Test fails? → `debug`, read the error, fix in Phase 5, re-verify. Don't loop blindly.
141: - UI wrong but API green? → frontend renderer issue; use `vivi-frontend` skill, re-verify UI.
142: 
143: ## Command Catalog (your hands)
144: 
145: PowerShell launchers (run from repo root):
146: - `pwsh scripts/start-bg.ps1`                     — NON-BLOCKING: launch backend+frontend, adopt Chrome, return immediately (poll health after)
147: - `pwsh scripts/start-all.ps1`                    — BLOCKING: launch backend+frontend, adopt Chrome, health-wait
148: - `pwsh scripts/stop-all.ps1`                     — stop both via PID files + port scan (infallible)
149: - `pwsh scripts/health-check.ps1 [-Interval 30]`  — continuous health monitor (optional)
150: - `pwsh scripts/test-selectors.ps1`               — provider selector health (optional, needs Chrome)
151: 
152: CLI harness (`bun run devops runtime-test <subcmd>`):
153: - `health`            — DB + server preflight, prints `{ok, checks}`
154: - `preflight`         — raw preflight JSON
155: - `discover [--offline]` — caps + frontendUrl + schemaTables; `--offline` reads the static
156:   catalog (no server needed) so you can PLAN before building (closes the chicken-egg)
157: - `discover-backend` / `discover-frontend` — individual probes
158: - `discover-cdp [--port=9222]` — CDP protocol methods from live Chrome or catalog fallback
159: - `discover-protocol <url> [--hint=name]` — **auto-discover read/write protocol** for any provider URL: composer selectors, composer type, send buttons, capture patterns, DOM response selectors, response format. Generates a complete manifest draft. Uses live Chrome CDP.
160: - `catalog-gen`       — regenerate the static capability catalog from `capability-bootstrap.ts`
161: - `test --nl="..."`   — drive one NL command through `POST /api/interpret`
162: - `test-cap <slug> [--input=JSON]` — execute a capability by slug via `/api/capabilities/:id/execute`
163: - `engage [--provider= --account= --url=]` — attach adopted Chrome, navigate
164: - `verify [--url=]`   — render-proof to `.runtime/screenshots/verify-0.html`
165: - `verify-pipeline`   — bootstrap→preflight→discover→verify report
166: - `selectors`         — run provider selector unit tests
167: - `debug`             — capture console/errors
168: - `build [frontend|backend] [--cap=<slug>]` — `build backend --cap=<slug>` emits a compilable
169:   `makeCapability` skeleton (exact shape) into `src/engines/generated/<slug>.ts`; register it
170:   in `registerDefaultCapabilities`, then `catalog-gen`
171: - `migrate --name=<x> [--timeout=ms]` — non-interactive `prisma migrate dev --name <x>` under a
172:   hard timeout (never blocks on the stdin name prompt)
173: - `loop --goal= --max-cycles=N --mitm [--force]` — single-pass orchestration; enforces the
174:   goal-resolution gate (vague goal → halt & ask); always tears down servers in `finally`
175: - `loop --objective="..."` — **start an iterative improve→test→debug loop**: writes a persisted
176:   ledger (`.runtime/loop-state.json`), runs typecheck + backend probe, proposes step 1
177: - `loop --resume` — evaluate the step the LLM just implemented, record pass/fail in the ledger,
178:   propose the next bounded step (or conclude `done`/`blocked`); hard `maxCycles` cap
179: - `loop --reset` — clear the ledger
180: - `setup --provider= --account=` — first-time provider Chrome login wizard
181: - `ensure-browser`    — deterministic `{ok, source:'adopted'|'spawned'|'none'}` precheck; if not
182:   `adopted`/`spawned`, do NOT spin `engage` — verify via API + flag UI-unverified
183: - `watchdog --pid=<n>` — detached reaper: polls parent pid, runs `stop` on agent death (no orphans)
184: - `guard`             — lefthook check: fails if `.runtime/*.pid` present or `prisma migrate status`
185:   is pending (run by pre-commit; blocks commits in bad state)
186: - `status`            — running server state from `.runtime/*.pid` + health endpoints
187: - `stop`              — tear down all services (canonical PS1 stopper); single correct teardown
188: - `report`            — recall the last persisted loop `LoopReport` (survives the child-process loop)
189: 
190: Backend API (for manual probing):
191: - `POST /api/interpret`            body `{text, ctx?}` → `{ok, capabilityId, text, error, ...}`
192: - `POST /api/nlcl/interpret`       body `{input, surface?}` → NLCL engine result
193: - `GET  /api/capabilities?surface=ui` → capability list (id/slug)
194: - `GET  /api/health`               → 200 when backend up
195: - `POST /api/fleet/start`          body `{providerId, accountId, visible}` → adopts/spawns Chrome slave
196: 
197: Agent-safety guarantees:
198: - Every CLI command is bounded (timeouts on all fetches) and returns structured JSON.
199: - `loop` enforces a **goal-resolution gate**: a goal that maps to no capability returns
200:   `needsClarification` and halts — the agent interviews instead of building wrong.
201: - A **process-guard** is installed at the top of every `runtime-test` command: SIGINT/SIGTERM/
202:   uncaughtException/unhandledRejection always run `stop` before exit. The loop also reaps servers
203:   in a `finally`. This is the "hook that intercepts context just in case" — no orphan can survive.
204: - `migrate` is non-interactive (always `--name`) with a hard spawn timeout — no stdin hang.
205: - Launchers write PID files so `stop` / `stop-all.ps1` / `watchdog` can always reclaim processes.
206: - **Iterative loop** (`--objective`/`--resume`): the LLM is the *implementer*; the loop is the
207:   *coordinator + evaluator*. A persisted ledger records every step + its real-world test result, so
208:   a flexible LLM stays on-task and shows progress across cycles and interruptions. Hard `maxCycles`
209:   cap + `finally` teardown prevent hangs/orphans.
210: 
211: ### Recipe D — Iterative improve → real-world-test → debug → improve
212: Gives the LLM freedom to implement each step however it chooses, while guaranteeing on-task progress.
213: 1. `bun run devops runtime-test loop --objective="add conversation summarize capability"`
214:    → writes `.runtime/loop-state.json`, runs typecheck + backend probe, prints `nextStep`.
215: 2. The LLM implements that step (edit code / register capability / fix test — any approach).
216: 3. `bun run devops runtime-test loop --resume`
217:    → evaluates the change (typecheck + backend health), records pass/fail in the ledger, and either
218:    proposes the next bounded step or concludes `done`/`blocked`.
219: 4. Repeat until `status: "done"`. Then `bun run devops runtime-test stop` to tear down.
220: The ledger is the single source of truth: resume works after an interruption, and the agent can
221: always read where it is. A vague objective still hits the goal-gate and halts with `needsClarification`.
222: 
223: ## Build Recipes
224: 
225: Repo root = `C:\0-BlackBoxProject-0\vivim-final`. Follow the invariants below.
226: 
227: ### Recipe A — Add a new capability (most common)
228: Goal: "add conversation rename capability".
229: 1. Define the engine work in `src/engines/` (one file per engine). If it touches storage, define/extend
230:    a Store Contract in `src/storage/contracts/` (never the impl).
231: 2. Register the capability in `src/engines/capability-bootstrap.ts` inside `registerDefaultCapabilities`,
232:    using `makeCapability`:
233:    ```ts
234:    makeCapability(
235:      {
236:        id: 'cap:conversation:rename',
237:        slug: 'conversation_rename',          // FRONTEND=BACKEND link
238:        name: 'Rename Conversation',
239:        description: 'Rename a conversation by id.',
240:        category: 'conversation',
241:        inputSchema: { type: 'object',
242:          properties: { conversationId: { type: 'string' }, title: { type: 'string' } },
243:          required: ['conversationId', 'title'] },
244:        outputSchema: { type: 'object' },
245:        cliCommand: { name: 'conversations rename', aliases: ['cr'],
246:          examples: ['cr <id> --title "New"'] },
247:        ui: { component: 'action-button', position: 'sidebar', order: 3 },
248:        mcpToolName: 'conversation_rename',
249:        apiEndpoint: { method: 'POST', path: '/api/conversations/{id}/rename' },
250:      },
251:      async (input) => services.conversationStore.rename(
252:        String(input.conversationId), String(input.title)),
253:    )
254:    ```
255:    `surfaces` defaults to `ALL_SURFACES` (cli/ui/api/mcp/workflow) — cross-surface parity, no second
256:    transport.
257: 3. API route (only if not covered by `/api/interpret` or `/api/capabilities/:id/execute`): add a handler
258:    in `src/server/` following the existing router pattern.
259: 4. Frontend: invoke the `vivi-frontend` skill. Generic-first — a new `slug` often renders via the
260:    GenericCapabilityRenderer with zero new code. Promote to a bespoke renderer only on merit (custom
261:    layout / rich input / ≥2-surface reuse) and register it in `CapabilityRegistry`.
262: 5. Tests: unit (mock the Store Contract), integration (hit the API), e2e if it drives Chrome.
263: 6. Verify: `bun run devops runtime-test test --nl="rename conversation <id> to X"` then UI.
264: 
265: ### Recipe B — Fix a bug
266: Goal: "fix the broken send button".
267: 1. `discover` + `debug` to capture the failure (console/errors/screenshot).
268: 2. Reproduce via `test --nl="..."` or `engage` to the broken UI.
269: 3. Locate root cause (frontend renderer vs backend capability vs store contract).
270: 4. Fix minimally, keep invariants. Re-run the failing test + UI verify.
271: 5. Add a regression test so it stays fixed.
272: 
273: ### Recipe C — Database / schema change
274: 1. Edit `prisma/schema.prisma`.
275: 2. `bunx prisma migrate dev --name <description>`.
276: 3. Update the relevant Store Contract in `src/storage/contracts/`.
277: 4. Update seeds in `seeds/` if the change affects seeded data.
278: 5. `bunx prisma studio` to eyeball; re-run `discover` (schemaTables count updates).
279: 
280: ### Recipe E — Canvas layer / conceptual-model surface (the primary frontend surface)
281: 
282: The primary frontend surface is now the **unified infinite canvas** (`web/ui/src/features/canvas/CanvasSurface.tsx`),
283: not just the per-provider `ChatPage`. Surfaces are generated from a **DB-backed provider-type conceptual
284: model** — not from in-repo provider docs. When a frontend change is "add a surface / region / UI for a
285: provider family", prefer the canvas + conceptual-model path over a new `ChatPage` slot.
286: 
287: Source of truth: `docs/roadmap/prds/PRD-VIVIM-CANVAS-UNIFIED-SURFACE.md`.
288: 
289: Backend pieces (seeded at **server boot** from `seeds/conceptual-model/seed.ts`):
290: - `ProviderType` + `UiComponent` tables drive all surfaces. `UiComponent` holds 4 resolution tiers via a
291:   unique `(scope, ownerId, variant)` key. Precedence: provider+variant > provider > family+variant >
292:   family > cross-type > system default. Resolved by `src/engines/conceptual-model-service.ts`.
293: - `GET /api/conversations/:id/stream-blocks` → `{ ok, conversationId, blocks, streaming }` for
294:   progressive result rendering (blocks are `ContentBlock` union in `shared/stream-blocks.ts`, each with `index`).
295: - Live layer events `canvas:layer:spawned` / `canvas:layer:dismissed` on `CapabilityEventBus`;
296:   `registerCanvasLayerForwarder` (`/ws/canvas`) in `src/server/websocket.ts`; thin emitter
297:   `CanvasLayerMounter` (`src/engines/canvas-layer-mounter.ts`).
298: 
299: Frontend pieces (`web/ui/src/features/canvas/`):
300: - `CanvasSurface.tsx` (mounted as a tab in `App.tsx`), `BrowserLayerHost.tsx`, `SandboxedLayer.tsx`,
301:   `useManifest.ts`, `useNodeTypes.tsx`, `useStreamBlocks.ts`, `useConceptualModel.ts`, `useCanvasEvents.ts`.
302: - `shared/canvas-types.ts` — `CanvasDefinition`, `LayerHost`, `SandboxPolicy`, `LayerCategory`.
303: 
304: Build steps for a canvas-facing feature:
305: 1. `discover` / `test --nl="..."` to confirm the capability resolves (FRONTEND=BACKEND still holds — `slug` links).
306: 2. If it needs a new **region/component for a provider family**, add a `UiComponent` row (or seed) rather
307:    than a hardcoded React branch. Use `useConceptualModel.ts` to resolve components at runtime.
308: 3. If it needs a **live canvas layer**, publish a `CanvasDefinition` draft and spawn it via
309:    `CanvasLayerMounter.spawn`; the spawn forwards to the browser over `/ws/canvas`. Verify the node appears.
310: 4. Streaming results: wire `useStreamBlocks.ts` → `GET /api/conversations/:id/stream-blocks`.
311: 5. Verify through the UI (canvas tab) last, per Phase 7. `ChatPage` is still valid as a secondary tab.
312: 
313: > The older `vivi-frontend` slot model (`UIComponentRegistry`, `chat.*` slots, `CapabilityRegistry`
314: > bespoke renderers) is **retained for fine-grained hot-swaps within a surface**. The canvas +
315: > conceptual model is the generative backbone; slots are a sub-mechanism. Do not assume
316: > `ChatPage` is the only surface.
317: 
318: ### Recipe D — Taxonomy chain change (platform/capability expansion)
319: Goal: "add 10x more platforms", "expand taxonomy", "add capabilities for X".
320: 1. **Expand skeleton:** `bun run taxonomy-gen expand` (writes `skeleton/platforms.json`).
321: 2. **Enrich pool:** `bun run taxonomy-gen enrich` (merges new caps into pool, runs Round 3+4).
322: 3. **Verify chain:** `bun run devops verify-cross-surface` — all capabilities must resolve
323:    across CLI/API/MCP/UI. If any fail, fix the taxonomy pipeline or pool before proceeding.
324: 4. **Typecheck:** `bun run typecheck`.
325: 5. **Audit:** `bun run devops audit-code standard` if significant changes.
326: 
327: **Gotchas:**
328: - `CATEGORY_POSITIONS` must use namespaced slot ids (`chat.actionBar`, not `actionBar`).
329: - Shared capability nodes may lack `category` — derive from `slug.split('_')[0]`.
330: - `Bun.spawn` exitCode is null until `await proc.exited`.
331: 
332: ## Invariants (never violate)
333: 
334: - **Governor Canon (B1):** Only `ChromeGovernor` touches CDP. The executor/harness never imports CDP
335:   transport. `cdp-discovery.ts` / `discover-cdp.ts` are exempt (pure protocol descriptor).
336: - **Store Contracts (B2):** Engines depend on `src/storage/contracts/*`, never `src/storage/impl/*`.
337: - **One Entry Point (25.7):** Every operation is a `UnifiedCapability`. CLI/UI/API are thin shells over
338:   `POST /api/interpret` and `/api/capabilities/:id/execute`.
339: - **FRONTEND=BACKEND (5.1):** The capability `slug` links backend and frontend.
340: - **Capability Registry always created** — never inside try/catch, so caps surface even if an engine
341:   fails to boot.
342: - **Agent-safety:** Every command is bounded and returns structured JSON; never hangs on I/O; never
343:   leaves orphan processes (use `stop`).
344: - **Type safety:** No `any` — use `unknown` + narrowing. Errors via custom classes, never swallowed.
345: - **DB-Driven Protocol (P1):** Provider-specific composer selectors, send methods, capture patterns, fetch URL patterns, and DOM selectors live in the DB (`ProviderEndpoint` rows, seeded from `seeds/providers/*.json`). NEVER hardcode these in TypeScript. The hardcoded maps in `provider-selectors.ts` and `conversation-manager.ts` are FALLBACKS only. New providers: write JSON → `bun run seed`. Use `bun run devops discover-protocol <url>` to auto-discover.
346: 
347: ## Preflight: Always Know the Current State
348: 
349: Before any operation, run:
350: ```bash
351: bun run devops agentic preflight
352: ```
353: Reports: which providers have accounts, which Chrome profiles exist (with cookies), which Chrome instances are live, what pages they're on, and what gaps exist. Never guess at what's available.
354: 
355: ## Protocol Discovery: Auto-Discover Provider Interaction
356: 
357: For any new provider URL, auto-discover write/read protocols:
358: ```bash
359: bun run devops discover-protocol https://newprovider.com --hint=name
360: ```
361: Detects: composer selectors, composer type, send buttons, framework (ProseMirror/Quill/React), DOM response containers. Produces a `manifestDraft` for seeding. Uses existing Chrome profiles automatically via preflight context.
362: 
363: ## CDP Connection Gotchas (CRITICAL)
364: 
365: These are hard-won lessons from debugging CDP issues. Read before touching any CDP code.
366: 
367: ### 1. WebSocket URL must be the exact UUID-suffixed URL from `/json/version`
368: Chrome REJECTS the bare `ws://host:port/devtools/browser` path. You MUST fetch
369: `http://127.0.0.1:{port}/json/version` and use the `webSocketDebuggerUrl` field:
370: ```typescript
371: // WRONG — Chrome rejects this:
372: const client = new BunCdpClient(`ws://127.0.0.1:${port}/devtools/browser`)
373: 
374: // CORRECT — resolve the exact URL first:
375: const ver = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json())
376: const client = new BunCdpClient(ver.webSocketDebuggerUrl)
377: ```
378: This affects: `CdpTransportImpl.connect`, `FleetSupervisor.navigateToProvider`,
379: `FleetSupervisor.healthCheck`, `setup-router.ts` verify.
380: 
381: ### 2. CDP commands require a page-target sessionId
382: Browser-level connection alone is insufficient. Most CDP domains (DOM, Input, Page, Network)
383: require attaching to a specific page target:
384: ```typescript
385: const targets = await client.send('Target.getTargets')
386: const page = targets.targetInfos.find(t => t.type === 'page')
387: const { sessionId } = await client.send('Target.attachToTarget', {
388:   targetId: page.targetId, flatten: true
389: })
390: // Now route commands with sessionId:
391: await client.send('Input.dispatchKeyEvent', { ... }, { sessionId })
392: ```
393: 
394: ### 3. `--no-startup-window` Chrome has no page target
395: Chrome launched with `--no-startup-window` (headless-new) starts with NO page targets.
396: `/json/list` returns `[]`. You must create one via CDP:
397: ```typescript
398: const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' })
399: const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true })
400: ```
401: 
402: ### 4. Setup wizard verify must check ALL page targets
403: The first page target may be a chrome://signin-dice intercept (not the actual app tab).
404: Iterate all pages and OR the login results:
405: ```typescript
406: for (const page of pages) {
407:   const { sessionId } = await client.send('Target.attachToTarget', { ... })
408:   // check cookies/DOM on this page
409:   if (loggedIn) break
410: }
411: ```
412: 
413: ### 5. CDPProxy must rebuild on every access
414: If `get cdp()` caches a static slave snapshot, freshly-spawned slaves cause "Slave not found":
415: ```typescript
416: // WRONG — stale snapshot:
417: get cdp() { return new CDPProxy(this.slaves, ...) }
418: 
419: // CORRECT — live snapshot:
420: get cdp() { return new CDPProxy(this.getAllInstances(), ...) }
421: ```
422: 
423: ### 6. DB loginState can be stale
424: The DB may say `loginState: 'logged_in'` while the browser session has expired.
425: Always verify the actual browser state (cookies, page URL) rather than trusting the DB:
426: ```typescript
427: // Check actual cookies, not just DB state:
428: const cookieResult = await client.send('Network.getCookies', {}, { sessionId })
429: const hasAuth = cookieNames.has('SID') || cookieNames.has('HSID') || ...
430: ```
431: 
432: ### 7. Windows zombie sockets block port reuse
433: After `taskkill /F` or `stop-all.ps1`, Windows can leave a LISTENING socket in zombie state
434: with a dead PID. `netstat -ano | Select-String :PORT` shows the old PID but `Get-Process`
435: fails to find it. New servers CANNOT bind to the same port until the OS reclaims it.
436: **Workaround:** Wait 30-60 seconds. If persistent, reboot or change the port. There is no
437: reliable user-mode way to clear a zombie socket on Windows.
438: 
439: ### 8. Provider sessions auto-created on first send
440: `POST /api/conversations` with `{ providerId }` auto-creates a `providerSession` row + a
441: `conversation`. The send route reads `body.message` (NOT `content`):
442: ```typescript
443: // This auto-creates providerSession + conversation:
444: const res = await fetch('http://127.0.0.1:9420/api/conversations', {
445:   method: 'POST',
446:   headers: { 'Content-Type': 'application/json' },
447:   body: JSON.stringify({ providerId: 'chatgpt' })
448: })
449: // Then send with body.message (not body.content):
450: await fetch(`http://127.0.0.1:9420/api/conversations/${convId}/messages`, {
451:   method: 'POST',
452:   headers: { 'Content-Type': 'application/json' },
453:   body: JSON.stringify({ message: 'hello' })
454: })
455: ```
456: 
457: ### 9. Raw SQL tables need manual scripts
458: Tables created via raw SQL (not Prisma migrations) aren't tracked by Prisma. Create a
459: `.runtime/ensure-<table>.ts` script that checks existence via `SELECT` and creates via
460: `PRAGMA table_info` + `CREATE TABLE` if missing. Use `bun run .runtime/ensure-<table>.ts`.
461: 
462: ### 10. PowerShell gotchas (use bun scripts instead)
463: - `$PID` is read-only — don't assign it
464: - `$_` in double-quoted strings fails — use single quotes or bun
465: - `$var=` after `&&` fails — separate into two commands
466: - For DB/HTTP operations, write bun scripts in `.runtime/` instead of inline PowerShell
467: 
468: ### 11. Network capture regex must match real endpoint
469: The capture system intercepts network responses matching `CAPTURE_PATTERNS[provider]` regex.
470: If the regex doesn't match the real streaming endpoint, capture times out returning empty body
471: with `null` metadata. To debug, capture real requests:
472: ```typescript
473: // Temporarily add this to observe real endpoint:
474: await client.send('Network.enable', {}, { sessionId })
475: client.on('Network.requestWillBeSent', (params) => {
476:   if (params.request.url.includes('/api/') || params.request.url.includes('/backend-api/'))
477:     console.log(`[NET] ${params.request.method} ${params.request.url}`)
478: })
479: ```
480: 
481: ## Anti-patterns (what NOT to do)
482: 
483: - Don't run a headless `loop` as a black box and call it "done" — you are the runtime.
484: - Don't build without a goal, and never substitute a placeholder (`hello`) for real intent.
485: - Don't spawn servers per cycle — launch once via PS1, stop once via `stop`.
486: - Don't import CDP transport outside `ChromeGovernor`.
487: - Don't hardcode feature logic in the frontend — render from the `ResolvedCapability` contract.
488: - Don't skip UI verification — a green API test is not a shipped feature.
489: - Don't leave orphan processes — always `stop`.
490: - Don't use bare `/devtools/browser` WS URLs — always resolve from `/json/version`.
491: - Don't trust DB `loginState` — verify actual browser cookies/state.
492: - Don't assume `pages[0]` is the auth tab — iterate all page targets.
493: 
494: ---
495: 
496: ## SpecKit Integration
497: 
498: When implementing a feature that has a SpecKit spec, follow this workflow:
499: 
500: ### SpecKit-Driven Full Stack Workflow
501: 
502: 1. **Check for spec**: Look for `specs/NNN-name/spec.md` and `plan.md`
503: 2. **If spec exists**: Follow SpecKit pipeline (specify → plan → tasks → implement)
504: 3. **Use devops-fullstack for implementation only**: After tasks are created, use this skill to execute the implementation
505: 4. **Gate**: Use `bun run devops speckit gate --scope=feature` for unified quality checks
506: 5. **Converge**: Use `bun run devops speckit converge <featureDir>` to run spec+code+arch analysis
507: 
508: ### Bridge Commands
509: 
510: | Command | Purpose |
511: |---------|---------|
512: | `bun run devops speckit sync <featureDir>` | Sync tasks to tracker |
513: | `bun run devops speckit gate --scope=feature` | Unified gate for feature |
514: | `bun run devops speckit converge <featureDir>` | Run converge pipeline |
515: 
516: ### Key Modules
517: 
518: | Module | Purpose |
519: |--------|---------|
520: | `devops/unified-gate.ts` | Unified quality gate |
521: | `devops/tracker-speckit-sync.ts` | Bidirectional state sync |
522: | `devops/speckit-converge-bridge.ts` | Converge pipeline |

(End of file - total 522 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 7.5s)

_Thinking:_

Now let me read the remaining key files: the devops skill itself, the bridge modules, and any existing SpecKit artifacts to understand the current state.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\.opencode\\skill\\devops\\SKILL.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\.opencode\skill\devops\SKILL.md</path>
<type>file</type>
<content>
1: ---
2: name: devops
3: description: Autonomous agentic DevOps orchestrator for vivim-final. Two modes: tracker-driven (atomic units from docs/atomic-v3-fork-canon) or goal-driven (user goal → full-stack build). Use when the user says "ralph loop", "devops", "continue", "keep going", "implement all", or provides a goal to build.
4: ---
5: # VIVIM Agentic DevOps Orchestrator
6: 
7: Fully-autonomous dev loop for vivim-final. Two modes:
8: 
9: - **Tracker mode** (default): drives atomic units from `docs/atomic-v3-fork-canon/01-tracker.md` to completion
10: - **Goal mode**: accepts a user goal, builds full stack (backend + frontend + DB), verifies visually, iterates
11: 
12: State lives in the tracker (single source of truth, 127 units). Deterministic mechanics are in `devops/`; the agent does the creative implementation.
13: 
14: > **CANONICAL:** v3-fork-canon (127 units, 117 pending) absorbs v3 (108 units) + v5 kernel (19 units).
15: > Deprecated: `docs/atomic-v3/`, `docs/atomic-v4/`, `docs/atomic-v5/`.
16: 
17: ## Invariants
18: 
19: - **Strictly sequential.** One unit at a time. Never parallelize.
20: - **Fully autonomous.** Never ask "should I continue?" / "ready?". Only stop on completion or when only blocked units remain.
21: - **Gate before done.** A unit is marked `[x]` only after the gate is green.
22: - **Clean tree.** Each passing unit is committed; a blocked unit's changes are reset so dependents are not contaminated.
23: - **Governor Canon (B1):** Only ChromeGovernor touches CDP — including the harness executor.
24: - **Store Contracts (B2):** Engines use `src/storage/contracts/*` — never an impl.
25: - **FRONTEND=BACKEND (5.1):** Capability slug links backend and frontend.
26: - **One Entry Point (25.7):** All ops via `/api/interpret` — seeded programs published as `UnifiedCapability`.
27: - **Type Safety:** No `any` — use `unknown` + type narrowing.
28: - **Error Handling:** Custom error classes, never swallow errors silently.
29: - **Testing:** 80%+ coverage on engines, run before every commit.
30: 
31: ---
32: 
33: ## Mode 1: Tracker Mode (Default)
34: 
35: Drives atomic units from the tracker to completion. One unit at a time, strictly sequential.
36: 
37: ### Loop
38: 
39: ```
40: LOOP:
41:   1. sel = `bun run devops select`          # next implementable unit (JSON) or "null"
42:      - null + report shows 0 pending        -> print "DEVOPS COMPLETE. <done>/<total>"; STOP
43:      - null + blocked remain                -> print report + BLOCKED list; STOP
44:   2. `bun run devops mark <id> in_progress`
45:   3. Read the unit's atomic file (path in the select JSON `file` is the
46:      SOURCE FILE; the unit spec lives at docs/atomic-v3/phase-*/<id>-*.md).
47:      Follow its Interface + Store Contract + Test Contract + Gate exactly.
48:   4. Fidelity: at the FIRST unit of a phase, cross-check the atomic files
49:      for that phase against the design docs (docs/master-plan-v3/*).
50:      Log any DRIFT into docs/atomic-v3/PROGRESS.md. Hard conflict -> mark blocked.
51:   5. Implement + write tests. Delegate to db/test/review subagents when useful.
52:   6. `bun run devops gate`                  # typecheck + lint + bun test
53:      - PASS  -> `bun run devops mark <id> done`
54:                 git add -A ; git commit -m "feat(<Name>): implement unit <id>"
55:                 `bun run devops report`
56:                 goto LOOP
57:      - FAIL  -> fix, retry (max 3)
58:       - >3 fails -> `bun run devops mark <id> blocked`
59:                  append BLOCKED reason to docs/atomic-v3/PROGRESS.md
60:                 git checkout -- .   (reset unit's working changes)
61:                 goto LOOP
62: ```
63: 
64: ### Selection rules (enforced by `devops/select.ts`)
65: 
66: 1. Selectable only if state is `pending` or `in_progress` (resume first).
67: 2. Its **phase is open**: phase N opens only when every unit of all smaller-indexed phases is `done`.
68: 3. Every dependency in the unit's atomic `**Depends:**` is `done`.
69: 
70: ### Tracker Commands
71: 
72: | Command | Purpose |
73: |---------|---------|
74: | `bun run devops select` | Print next unit as JSON (`null` if none) |
75: | `bun run devops mark <id> <pending\|in_progress\|done\|blocked>` | Transition state |
76: | `bun run devops gate` | Run typecheck + lint + bun test (exit 1 on fail) |
77: | `bun run devops report` | Print done/total, per-phase, blocked list |
78: | `bun run devops run` | Full autonomous loop (select → implement → gate → commit) |
79: | `bun run devops audit-code <scope>` | Source-code audit (surface\|standard\|deep\|full) + fix/to-units |
80: 
81: ### Browser Automation Commands
82: 
83: | Command | Action |
84: |---------|--------|
85: | `bun run devops automate navigate <url>` | Navigate browser to URL |
86: | `bun run devops automate type <selector> <text>` | Type text into element |
87: | `bun run devops automate click <selector>` | Click element |
88: | `bun run devops automate text <selector>` | Get element text |
89: | `bun run devops automate value <selector>` | Get input value |
90: | `bun run devops automate exists <selector>` | Check element exists |
91: | `bun run devops automate screenshot` | Take screenshot |
92: | `bun run devops automate page` | Get page content |
93: | `bun run devops automate reset` | Reset automator connection |
94: 
95: All automate commands return structured JSON: `{ ok: true, ... }` or `{ ok: false, error: '...' }`.
96: 
97: ### Resume
98: 
99: Re-running always resumes at the first non-`done` selectable unit. The tracker is authoritative; if file state disagrees, trust the tracker.
100: 
101: ### Audit trail
102: 
103: Every pass and block is appended to `docs/atomic-v3/PROGRESS.md`:
104: `[timestamp] <id> <name> -> <done|blocked> [sha] <gate summary>`.
105: 
106: ---
107: 
108: ## Mode 2: Goal Mode
109: 
110: Accepts a user goal, builds the full stack, verifies visually, iterates until achieved.
111: 
112: ### Interview-First Goal Acquisition (CRITICAL)
113: 
114: The loop is a **verification + iteration harness**, not a mind-reader. It cannot build something useful without knowing *what* to build. Therefore:
115: 
116: - **Never run `loop` with no `--goal` as a no-op.** A bare `bun run devops runtime-test loop` now either (a) derives a candidate goal from the next resumable unit via `bun run devops select`, or (b) fails loud and instructs the agent to interview.
117: - **The driving agent (you) owns the interactive interview.** When the user has not stated a goal, use the `question` tool to interview: goal type, scope, and mode. Do not guess.
118: - **Derive-from-context shortcut:** if the repo has a clear next unit (from `bun run devops select`), you may propose it, but confirm with the user before building.
119: - **Once a goal is known,** run `bun run devops runtime-test loop --goal="<goal>"` and let the loop bootstrap → preflight → discover → test → verify.
120: 
121: ### Goal→Plan→Execute Pipeline
122: 
123: ```
124: bootstrap → preflight → [plan → discover → discover-cdp → build → test → (debug → rebuild)?] × N
125:          → canvas-wire → verify → source-audit → report
126: ```
127: 
128: - **plan step:** Sends the goal to `POST /api/nlcl/interpret` which resolves it to a capability + input
129: - **discover step:** Lists backend capabilities + frontend components + database schema
130: - **discover-cdp step (U1/U2):** Enumerates CDP domains/methods via `discoverCdpProtocol()` and registers each as a `UnifiedCapability`
131: - **build step:** Implements backend engines, API routes, database migrations, React components (delegates frontend to `vivi-frontend`)
132: - **test step:** Runs unit tests, integration tests, E2E tests, typecheck, lint
133: - **debug step:** Captures screenshot + console errors, analyzes failures
134: - **canvas-wire step (U4):** Wires resolved capabilities onto the infinite canvas as atomic composable layers
135: - **verify step:** Navigates to frontend, takes screenshot, validates visually
136: - **source-audit step (gate):** Runs `bun run devops audit-code standard` (P0–P3) and blocks merge on P0/P1
137: 
138: ### Goal Mode Commands
139: 
140: | Command | Action | Status |
141: |---------|--------|--------|
142: | `loop` | Full autonomous cycle with optional `--goal` | Working |
143: | `bootstrap` | Start backend + frontend servers | Working |
144: | `preflight` | Health check (DB + server) | Working |
145: | `discover` | List capabilities + frontend + schema | Working |
146: | `build` | Scaffold backend/frontend from goal | Working |
147: | `test` | Run all tests (unit + integration + E2E) | Working |
148: | `debug` | Capture screenshot + console + errors | Working |
149: | `verify` | Visual verification via Chrome | Working |
150: | `health` | Quick health check | Working |
151: | `selectors` | Validate provider selectors | Working |
152: | `verify-pipeline` | Full pipeline verification | Working |
153: 
154: ### Usage
155: 
156: ```powershell
157: # Full loop — autonomous, 5 cycles
158: bun run devops runtime-test loop
159: 
160: # With a user goal — builds full stack to achieve it
161: bun run devops runtime-test loop --goal="add conversation rename capability"
162: 
163: # Custom options
164: bun run devops runtime-test loop --max-cycles=3 --mitm --goal="fix the broken send button"
165: 
166: # Individual commands
167: bun run devops runtime-test bootstrap
168: bun run devops runtime-test preflight
169: bun run devops runtime-test discover
170: bun run devops runtime-test build --goal="add new engine"
171: bun run devops runtime-test test
172: bun run devops runtime-test debug
173: bun run devops runtime-test verify
174: ```
175: 
176: ### Loop Lifecycle
177: 
178: ```
179: 1. bootstrap        — start backend (:9420) + frontend (:5173)
180: 2. preflight        — verify DB + server health
181: 3. for each cycle:
182:    a. plan          — interpret goal via NLCL (if --goal provided)
183:    b. discover      — list backend capabilities + frontend components + schema
184:    c. build         — implement changes (backend, frontend, database, tests)
185:    d. test          — run all tests (unit, integration, E2E, typecheck, lint)
186:    e. if fail:
187:       - debug       — capture screenshot + console errors + test output
188:       - if mitm: break (agent decides)
189:       - rebuild     — fix issues based on debug output
190:       - retest      — run tests again
191:    f. if pass: continue to next cycle
192: 4. verify           — navigate to frontend, take screenshot
193: 5. report           — structured JSON with all steps + screenshots
194: ```
195: 
196: - If tests pass on first cycle → exits immediately (no unnecessary work)
197: - mitm mode stops after debug, waits for agent to decide what to build
198: - Hard 2-minute timeout prevents infinite loops
199: - Screenshots saved to `.runtime/screenshots/`
200: 
201: ### LoopReport Output
202: 
203: ```json
204: {
205:   "ok": true,
206:   "cycles": 1,
207:   "maxCycles": 5,
208:   "mode": "autonomous",
209:   "goal": "add conversation rename capability",
210:   "steps": [
211:     { "step": "goal", "ok": true, "detail": "add conversation rename capability" },
212:     { "step": "bootstrap", "ok": true, "detail": "started" },
213:     { "step": "preflight", "ok": true, "detail": "database:ok, server:ok" },
214:     { "step": "plan-cycle-1", "ok": true, "detail": "resolved: conversation.rename" },
215:     { "step": "discover-cycle-1", "ok": true, "detail": "backend:57 caps, frontend:3 comps, schema:54 tables" },
216:     { "step": "build-cycle-1", "ok": true, "detail": "engine:2 files, api:1 route, frontend:1 component, tests:3 files" },
217:     { "step": "test-cycle-1", "ok": true, "detail": "unit:70 pass, integration:6 pass, typecheck:ok, lint:ok" },
218:     { "step": "verify", "ok": true, "detail": "screenshot: .runtime/screenshots/..." }
219:   ],
220:   "screenshots": [{ "cycle": 0, "path": ".runtime/screenshots/...", "url": "http://localhost:5173" }],
221:   "finalHealth": { "db": true, "server": true, "tests": true },
222:   "elapsedMs": 3200
223: }
224: ```
225: 
226: ---
227: 
228: ## Build Strategies
229: 
230: ### Backend Build (Engine Implementation)
231: ```typescript
232: // When goal involves building or extending an engine:
233: 1. Read engine spec from docs/merged-design-v2/04-merged-engines.md
234: 2. Define TypeScript interface (match spec exactly)
235: 3. Define Store Contract (what engine needs from storage)
236: 4. Implement engine with proper error handling
237: 5. Write unit tests with mocked store contract
238: 6. Register in capability-bootstrap.ts
239: 7. Add API route if needed
240: 
241: // Engine implementation order (from spec):
242: // Phase 1: ConfigManager, CapabilityEventBus
243: // Phase 2: ChromeGovernor
244: // Phase 3: ProviderRegistrar, ProviderHealthKernel
245: // Phase 4: CapabilityResolutionEngine, StreamParserEngine
246: // Phase 5: ConversationManager, StreamBlockStore
247: // Phase 6: RegistrationAuditor, VersionManager, TelemetryAggregator
248: // Phase 7: REST endpoints, WebSocket, CLI, SDK
249: 
250: // Engine file structure:
251: // src/engines/
252: //   index.ts                    # barrel exports
253: //   config-manager.ts
254: //   capability-event-bus.ts
255: //   chrome-governor.ts
256: //   provider-registrar.ts
257: //   provider-health-kernel.ts
258: //   capability-resolution-engine.ts
259: //   stream-parser-engine.ts
260: //   conversation-manager.ts
261: //   stream-block-store.ts
262: //   registration-auditor.ts
263: //   version-manager.ts
264: //   telemetry-aggregator.ts
265: 
266: // Implementation template:
267: // export interface MyEngineStore { ... }  // Store Contract
268: // export interface MyEngineConfig { ... } // Engine Config
269: // export interface MyEngine { ... }       // Engine Interface
270: // export function createMyEngine(store, config, eventBus): MyEngine { ... }
271: 
272: // Testing pattern:
273: // tests/unit/engines/my-engine.test.ts
274: // - Mock store contract
275: // - Test each method
276: // - Verify store calls
277: 
278: // Key rules:
279: // 1. Read the spec before implementing — match interfaces exactly
280: // 2. Define Store Contract first — enables mock-based testing
281: // 3. Use custom error classes from src/errors.ts
282: // 4. Emit events via CapabilityEventBus for cross-engine communication
283: // 5. Never import PrismaClient directly in engine — use Store Contract
284: // 6. Write tests alongside implementation
285: ```
286: 
287: ### Program / Recipe Capability Build (v14 harness)
288: ```typescript
289: // When the goal is a browser-driving capability that needs multi-step injection:
290: 1. Author a Recipe (steps[] + optional branches)
291: 2. Upsert via ProgramStore.upsertProgram({ bindingId, version, status:'draft', recipe })
292: 3. composeHarness({ governor, capabilityStore, programStore, blockStore, eventBus, registry })
293: 4. seedAndPublish(composition, recipes, registry) — publishes as UnifiedCapability
294: 5. Execution: HarnessExecutorEngine compiles recipe → Governor HarnessDAG → ChromeGovernor
295: 6. NEVER import CDP transport in the recipe/executor — always go through the governor
296: ```
297: 
298: ### Frontend Build
299: ```typescript
300: // Delegate to the `vivi-frontend` skill (component-driven, contract-first):
301: 1. Invoke `vivi-frontend` skill
302: 2. Resolve goal → capability slug via POST /api/nlcl/interpret
303: 3. Fetch contract: GET /api/capabilities?surface=ui
304: 4. Generic-first: new capability renders via GenericCapabilityRenderer (no new code)
305: 5. Promote to bespoke ONLY on merit (custom layout / rich input / ≥2-surface reuse)
306: 6. Wire action via ActionRegistry (Zod-validated, id = slug) → /api/capabilities/:id/execute
307: 7. Mount via CapabilitySurface host — no per-cap routing
308: 8. Verify: bun run typecheck → bun run lint → runtime verify (screenshot)
309: ```
310: 
311: ### Database Build
312: ```typescript
313: // When goal involves schema changes:
314: 1. Modify prisma/schema.prisma
315: 2. Run: bunx prisma migrate dev --name <description>
316: 3. Update storage contracts in src/storage/contracts/
317: 4. Update seeds if needed
318: 5. Test with: bunx prisma studio
319: ```
320: 
321: ---
322: 
323: ## Unified Canvas & Conceptual Model (the new surface)
324: 
325: The primary frontend surface is now a **single infinite React-Flow canvas** (`web/ui/src/features/canvas/CanvasSurface.tsx`)
326: that renders every UI region — chat thread, composer, mailbox, messenger bubbles, social feed — as a node.
327: Surfaces are **generated from a DB-backed provider-type conceptual model**, NOT from in-repo provider docs.
328: This supersedes the per-provider `ChatPage`-only view: ChatPage is retained as a secondary tab, but the
329: canvas is the unified shell.
330: 
331: ### Source of truth
332: - PRD: `docs/roadmap/prds/PRD-VIVIM-CANVAS-UNIFIED-SURFACE.md`
333: - Implementation notes: `docs/vivim-canvas/implementation/08-backend-integration.md` (status table), `09-conceptual-model-plan.md`
334: 
335: ### Provider-type conceptual model (DB)
336: A provider-independent, modular schema drives all surfaces. Key tables (Prisma, seeded at **server boot**):
337: - `ProviderType` — one row per provider family (ai-chat / email / messenger / social …). JSON cols:
338:   `slotCatalogJson`, `regionLayoutJson`, `interactionGrammarJson`, `basePrimitive`.
339: - `UiComponent` — ONE table holding all 4 resolution tiers via a unique `(scope, ownerId, variant)` key.
340:   Fields: `html`, `css`, `scriptUrl`, `componentKey`, `defaultRegion`, `sandboxJson`.
341: - Resolution precedence (highest → lowest):
342:   `provider+variant` > `provider` > `family+variant` > `family` > `cross-type` > `system default`.
343:   Resolved by `resolveFamilyForProvider` in the conceptual-model engine
344:   (`src/engines/conceptual-model.ts` — see `tests/integration/engines/conceptual-model.test.ts`).
345: - Seeded by `seeds/conceptual-model/seed.ts` (idempotent): ai-chat, email, messenger, social families.
346: 
347: ### Canvas runtime pieces (backend)
348: | Component | Path | Role |
349: |-----------|------|------|
350: | Canvas layer events | `src/engines/capability-event-bus.ts` | `canvas:layer:spawned`, `canvas:layer:dismissed` on the `CapabilityEvent` union |
351: | Live layer forwarding | `src/server/websocket.ts` | `registerCanvasLayerForwarder` (mirrors `registerCanvasMutationForwarder`); registered at boot in `src/server/index.ts` |
352: | Layer mounter | `src/engines/canvas-layer-mounter.ts` | Thin emitter `CanvasLayerMounter`; instantiated at boot, exported from `src/index.ts` |
353: | Stream blocks | `src/server/conversation-router.ts` | `GET /api/conversations/:id/stream-blocks` → `{ ok, conversationId, blocks, streaming }` (from `prisma.streamBlock`; `streaming` = assistant message with `blockCount === 0`) |
354: 
355: ### Canvas runtime pieces (frontend)
356: - `CanvasSurface.tsx` — mounted as a tab in `web/ui/src/App.tsx` (additive; `ChatPage` retained).
357: - `shared/stream-blocks.ts` — `ContentBlock` union (`text|thinking|code|artifact|image|citation|tool_use|error|meta`) each with `index`.
358: - `shared/canvas-types.ts` — `CanvasDefinition`, `LayerHost`, `SandboxPolicy`, `LayerCategory`.
359: - `web/ui/src/features/canvas/*` — `BrowserLayerHost.tsx`, `SandboxedLayer.tsx`, `useManifest.ts`, `useNodeTypes.tsx`.
360: 
361: ### How the devops loop wires a capability to the canvas (U4, updated)
362: 1. `plan` resolves the goal via `POST /api/nlcl/interpret` → capability + input.
363: 2. `discover` lists backend capabilities + the conceptual model (`ProviderType`/`UiComponent` rows) + schema.
364: 3. `build` implements the engine + API + DB seeds (conceptual model) + the **canvas layer** (not just a ChatPage slot).
365: 4. `canvas-wire` publishes the `CanvasDefinition` draft (`CanvasDesigner.publish`) and spawns it
366:    (`CanvasLayerMounter.spawn`); the live spawn is forwarded to the browser via `/ws/canvas`.
367: 5. `verify` screenshots the canvas node in its position.
368: 
369: ### Grounding rule (product knowledge, not provider docs)
370: Surfaces are generated from **internal product knowledge** of provider families — the agent must NOT
371: ground surface design on in-repo provider-by-provider docs. The modular schema supports
372: provider-type globals, uniques/variants, and cross-type shared primitives so the system evolves
373: **without per-provider migrations**.
374: 
375: ---
376: 
377: ## Full-Stack Reference
378: 
379: ### Backend Layer
380: | Component | Path | Description |
381: |-----------|------|-------------|
382: | Engines | `src/engines/*.ts` | Core business logic (13 engines) |
383: | Harness | `src/engines/harness/*.ts` | Program→recipe→CDP injection layer (v14) |
384: | Programs | `src/storage/contracts/program-store.ts` | Recipe/program Store Contract |
385: | API Routes | `src/server/*-router.ts` | REST endpoints |
386: | Storage | `src/storage/contracts/*.ts` | Store contracts |
387: | Schema | `prisma/schema.prisma` | Database schema |
388: | Seeds | `seeds/*.ts` | Database seeding |
389: 
390: ### Frontend Layer
391: | Component | Path | Description |
392: |-----------|------|-------------|
393: | App | `web/ui/src/App.tsx` | Root component |
394: | Pages | `web/ui/src/pages/*.tsx` | Route pages |
395: | Components | `web/ui/src/components/*.tsx` | Reusable UI |
396: | Styles | `web/ui/src/*.css` | Tailwind + custom |
397: | Sandbox | `web/sandbox/src/` | Sandbox modules |
398: 
399: ### Chrome Layer
400: | Component | Path | Description |
401: |-----------|------|-------------|
402: | Governor | `src/engines/chrome-governor.ts` | CDP lifecycle |
403: | Slave Write | `src/executor/slave-write.ts` | CDP commands |
404: | Slave Read | `src/executor/slave-read.ts` | CDP queries |
405: | Launcher | `src/executor/launcher.ts` | Chrome process |
406: | Setup Wizard | `src/engines/chrome-setup-wizard.ts` | First-time setup |
407: 
408: ### Testing Layer
409: | Component | Path | Description |
410: |-----------|------|-------------|
411: | Unit | `tests/unit/engines/*.test.ts` | Engine tests |
412: | Integration | `tests/integration/*.test.ts` | API tests |
413: | E2E | `tests/e2e/*.test.ts` | Full stack tests |
414: | Selectors | `tests/unit/engines/chat/selectors.test.ts` | Selector health |
415: | Runtime | `scripts/runtime-test.ts` | DevOps runtime |
416: 
417: ---
418: 
419: ## Server Lifecycle
420: 
421: ### Backend (`:9420`)
422: - Spawned via `bun run serve` (detached, unref'd)
423: - Health checked via `GET /api/health`
424: - On Windows: killed via `taskkill /PID /T /F` (process tree)
425: - On Unix: SIGTERM → wait 5s → SIGKILL
426: - Stderr captured (last 50 lines) and surfaced in bootstrap step
427: 
428: ### Frontend (`:5173`)
429: - Spawned via `vite dev --port 5173` in `web/ui/`
430: - Health checked via `GET /`
431: - Auto-installs deps if `node_modules` missing
432: - Proxies `/api` to backend
433: 
434: ### PS1 Scripts (alternative launch)
435: - `scripts/start-all.ps1` — starts both servers with health waits
436: - `scripts/stop-all.ps1` — stops all services via PID files + socket check
437: - Uses fast `TcpClient` socket check (not slow `Get-NetTCPConnection`)
438: 
439: ### PS1 Invocation Rules (CRITICAL — never violate)
440: These scripts use `$PSScriptRoot` to resolve the project root. That auto-variable is `$null`
441: when the script is NOT invoked as a file. This causes ALL downstream paths to collapse silently.
442: 
443: **NEVER do this (wrong ways that break `$PSScriptRoot`):**
444: ```powershell
445: Get-Content scripts/start-all.ps1 | pwsh -          # inline pipe — $PSScriptRoot = $null
446: pwsh -c "scripts/start-all.ps1"                     # -c string — $PSScriptRoot = $null
447: pwsh -Command ".\scripts\start-all.ps1"             # -Command — same problem
448: & "scripts/start-all.ps1"                           # call-op on PS1 — same problem
449: Start-Process -FilePath "pwsh" -ArgumentList "scripts\start-all.ps1"  # nested pwsh breaks path
450: pwsh -File scripts/start-all.ps1                    # WRONG: relative -File from wrong CWD breaks path
451: ```
452: 
453: **ALWAYS do this (correct ways):**
454: ```powershell
455: # From repo root — absolute or canonical relative path:
456: pwsh scripts/start-all.ps1
457: pwsh .\scripts\start-all.ps1
458: pwsh C:\0-BlackBoxProject-0\vivim-final\scripts\start-all.ps1
459: 
460: # Individual scripts:
461: pwsh scripts/start-backend.ps1
462: pwsh scripts/start-frontend.ps1
463: pwsh scripts/stop-all.ps1
464: pwsh scripts/health-check.ps1
465: ```
466: 
467: - Always run from the repo root directory (`C:\0-BlackBoxProject-0\vivim-final`).
468: - After launch, read `.runtime/backend.port` — do NOT hardcode 9420 (zombie fallback).
469: - After launch, read `.runtime/backend.pid` and `.runtime/frontend.pid` for PID tracking.
470: - Always tear down with `pwsh scripts/stop-all.ps1` — never kill manually.
471: 
472: ---
473: 
474: ## Agent-Safety Design
475: 
476: Every command:
477: - Exits within bounded time (15s bootstrap, 5s per fetch, 2min overall loop cap)
478: - Returns structured JSON — never hangs on interactive I/O
479: - Never spawns processes that outlive the command
480: - If server already running, fast-ports (no double-spawn)
481: - On Windows: uses `taskkill` for reliable process tree termination
482: - Captures stderr from all spawned processes for diagnostics
483: 
484: ---
485: 
486: ## Chrome Setup Wizard
487: 
488: When a capability needs a Chrome slave for a provider that hasn't been set up yet:
489: 
490: 1. `resolveSlaveId` detects no profile in DB (or profile dir missing on disk)
491: 2. `ChromeSetupWizard.runSetup()` launches Chrome **visible** (not headless)
492: 3. Navigates to provider login URL (`PROVIDER_URLS[slug]`)
493: 4. Polls page URL via CDP HTTP API (`/json/list`) to detect login
494: 5. On login detected → saves account to DB (`loginState: 'logged_in'`, `profileDir`, `debugPort`)
495: 6. Future sessions reuse the profile (already logged in, headless)
496: 
497: ### Auto-trigger (no action needed)
498: Any browser capability (`cap:browser:screenshot`, etc.) will auto-trigger setup if the provider has no profile. Chrome pops up, user logs in, capability continues.
499: 
500: ### Explicit setup
501: ```powershell
502: bun run devops runtime-test setup --provider=claude --account=user@gmail.com
503: ```
504: 
505: ---
506: 
507: ## Intelligent Slave Selection
508: 
509: 5-tier priority for Chrome slave resolution:
510: 
511: 1. **Explicit `input.slaveId`** — caller knows which slave
512: 2. **Running slave matching requested provider** — reuse existing session
513: 3. **Any running slave** — last resort reuse
514: 4. **DB query** — finds first active `ProviderDefinition` with a default `ProviderAccount`, spawns Chrome for it
515: 5. **Throw** — no providers seeded, actionable error message
516: 
517: ---
518: 
519: ## Integration with Skills
520: 
521: | Skill | Role |
522: |-------|------|
523: | `devops-research` | Auto-triggered when ambiguities arise; generates research briefs for CREATE units |
524: | `source-audit` | Post-build code quality check via `bun run devops audit-code standard` |
525: | `vivim-build` | Engine implementation workflow — uses existing engine templates from `src/engines/` |
526: | `vivim-testing` | Test writing patterns — uses existing test templates from `tests/` |
527: | `vivi-frontend` | Component-driven, contract-first frontend workflow — generic-first rendering from `ResolvedCapability` contract |
528: | `prisma-workflow` | Prisma patterns and workflows for schema/migrations |
529: 
530: ---
531: 
532: ## Exit Gate
533: 
534: The loop stops when:
535: - All tests pass (unit + integration + E2E + typecheck + lint), OR
536: - `maxCycles` exhausted, OR
537: - 2-minute hard timeout hit, OR
538: - mitm mode: pauses for agent decision
539: 
540: ## Code Quality Gates
541: 
542: | Gate | Command | Pass Criteria |
543: |------|---------|---------------|
544: | Typecheck | `bun run typecheck` | 0 errors |
545: | Lint | `bun run lint` | 0 errors (warnings OK) |
546: | Unit Tests | `bun test tests/unit/` | 100% pass |
547: | Integration | `bun test tests/integration/` | 100% pass |
548: | E2E | `bun test tests/e2e/` | 100% pass (if Chrome) |
549: | Coverage | `bun test --coverage` | 80%+ on engines |
550: | Audit | `bun run devops audit-code standard` | 0 P0/P1 findings |
551: 
552: ---
553: 
554: ## Source Files
555: 
556: | File | Purpose |
557: |------|---------|
558: | `devops/index.ts` | CLI wiring — all commands |
559: | `devops/runtime-test/index.ts` | Barrel exports |
560: | `devops/runtime-test/orchestration.ts` | Full loop logic — goal interpretation, plan→execute→verify |
561: | `devops/runtime-test/supervisor.ts` | Server lifecycle — Windows-compatible kill, stderr capture |
562: | `devops/runtime-test/preflight.ts` | Health checks (DB + server) |
563: | `devops/runtime-test/discover.ts` | Capability discovery + frontend probe + schema introspection |
564: | `devops/runtime-test/build.ts` | Full-stack build — backend engines, frontend components, database |
565: | `devops/runtime-test/test-harness.ts` | Test runner — unit, integration, E2E, typecheck, lint |
566: | `devops/runtime-test/debug-capture.ts` | Screenshot + console + error capture |
567: | `devops/runtime-test/verify.ts` | Visual verification via Chrome |
568: | `scripts/runtime-test.ts` | Quick commands — health, selectors, verify-pipeline |
569: | `scripts/health-check.ps1` | Continuous health monitoring |
570: | `scripts/test-selectors.ps1` | Selector validation |
571: | `src/server/index.ts` | Server bootstrap — capability registry always created |
572: | `src/engines/capability-bootstrap.ts` | Capability registration — DB-backed slave resolution |
573: | `src/engines/chrome-setup-wizard.ts` | First-time provider setup — visible Chrome, login detection, DB save |
574: | `src/engines/harness/index.ts` | v14 composition root — `composeHarness` + `seedAndPublish` |
575: | `src/engines/harness/harness-executor-engine.ts` | Recipe execution — resolves slave, hands plan to governor |
576: | `src/engines/harness/recipe-compiler.ts` | Recipe → Governor HarnessDAG |
577: | `src/storage/contracts/program-store.ts` | ProgramStore contract — recipe/best-program link |
578: | `web/ui/` | Frontend — Vite + React, proxies to backend |
579: 
580: ---
581: 
582: ## SpecKit Integration
583: 
584: The devops system integrates with SpecKit (spec-driven development) via bridge modules in `devops/`. Use this section to decide when to use SpecKit vs DevOps mode.
585: 
586: ### When to Use SpecKit vs DevOps
587: 
588: | Scenario | Use SpecKit | Use DevOps | Use Both |
589: |----------|------------|------------|----------|
590: | New feature with requirements | specify → plan → tasks | — | implement via devops loop |
591: | Bug fix | — | goal mode | — |
592: | Atomic unit from tracker | — | tracker mode | — |
593: | Architecture change | plan (constitution check) | audit-arch | converge + audit |
594: | Research needed | clarify Phase 0 | devops-research | bridge brief |
595: | Full release | tasks → implement → converge | audit-code full | unified gate |
596: | Taxonomy expansion | — | devops-generators | — |
597: | Frontend UI | plan contracts | vivi-frontend | — |
598: | Schema change | data-model.md | prisma-workflow | — |
599: | New capability | plan → tasks | devops loop | speckit sync |
600: 
601: ### Bridge Commands
602: 
603: | Command | Purpose |
604: |---------|---------|
605: | `bun run devops speckit map-task <T###>` | Map SpecKit task to DevOps unit |
606: | `bun run devops speckit map-unit <N.M>` | Map DevOps unit to SpecKit task |
607: | `bun run devops speckit sync <featureDir>` | Sync tasks.md → tracker |
608: | `bun run devops speckit sync-feature <dir>` | Sync feature state bidirectionally |
609: | `bun run devops speckit validate` | Check bridge consistency |
610: | `bun run devops speckit gate [--scope=unit\|phase\|feature\|full]` | Unified quality gate |
611: | `bun run devops speckit converge <featureDir>` | Run spec+code+arch converge |
612: | `bun run devops speckit find-brief <topic>` | Find DevOps research brief |
613: | `bun run devops speckit audit` | Audit skills for SpecKit readiness |
614: 
615: ### Key Modules
616: 
617: | Module | Purpose |
618: |--------|---------|
619: | `devops/speckit-bridge.ts` | Task↔unit ID mapping and bidirectional sync |
620: | `devops/unified-gate.ts` | Single entry point for all quality checks |
621: | `devops/research-bridge.ts` | DevOps brief ↔ SpecKit research.md conversion |
622: | `devops/tracker-speckit-sync.ts` | Bidirectional state sync between systems |
623: | `devops/speckit-converge-bridge.ts` | Unified converge pipeline (spec+code+arch) |

(End of file - total 623 lines)
</content>
```

**Tool: glob**

**Input:**
```json
{
  "pattern": "devops/speckit-*.ts"
}
```

**Output:**
```
C:\0-BlackBoxProject-0\vivim-final\devops\speckit-converge-bridge.ts
C:\0-BlackBoxProject-0\vivim-final\devops\speckit-bridge.ts
C:\0-BlackBoxProject-0\vivim-final\devops\speckit-audit.ts
```

**Tool: glob**

**Input:**
```json
{
  "pattern": "devops/unified-*.ts"
}
```

**Output:**
```
C:\0-BlackBoxProject-0\vivim-final\devops\unified-gate.ts
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 24.7s)

_Thinking:_

Good, now let me read the bridge module implementations to understand their current state, and also check the research-bridge and tracker-speckit-sync modules.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\devops\\speckit-bridge.ts"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\devops\speckit-bridge.ts</path>
<type>file</type>
<content>
1: // devops/speckit-bridge.ts
2: // Unified ID Bridge between SpecKit tasks (T###) and DevOps atomic units (N.M).
3: // Stores linkage bidirectionally via markdown comment metadata.
4: //
5: // tasks.md format:
6: //   - [ ] T012 [P] [US1] Create engine → `src/engines/foo.ts`
7: //     <!-- bridge:unit=2.1 synced=2026-07-17 -->
8: //
9: // tracker format:
10: //   - [x] 2.1 — ProviderRegistrar → `src/engines/provider-registrar.ts`
11: //     <!-- bridge:task=T021 feature=specs/006-provider-account-dashboard -->
12: 
13: import { readFile, writeFile, mkdir } from 'node:fs/promises'
14: import { existsSync } from 'node:fs'
15: import { join, dirname } from 'node:path'
16: import { parseUnits, computeStats, updateHeader, type Unit, type UnitState } from './tracker.ts'
17: 
18: // ── Types ────────────────────────────────────────────────────
19: 
20: export interface TaskLink {
21:   taskId: string
22:   unitId: string | null
23:   featureDir: string
24:   syncedAt: string
25: }
26: 
27: export interface SyncReport {
28:   created: number
29:   updated: number
30:   skipped: number
31:   conflicts: string[]
32: }
33: 
34: export interface ConsistencyReport {
35:   consistent: boolean
36:   orphanTasks: string[]
37:   orphanUnits: string[]
38:   mismatchedLinks: [string, string][]
39: }
40: 
41: interface ParsedTask {
42:   id: string
43:   line: string
44:   lineIndex: number
45:   state: ' ' | 'x'
46: }
47: 
48: // ── Regex patterns ───────────────────────────────────────────
49: 
50: // Match task lines: - [ ] T012 ... or - [x] T012 ...
51: const TASK_LINE_RE = /^- \[([ x])\] (T\d+)(?:\s+.*)?$/
52: 
53: // Match bridge metadata in tasks.md: <!-- bridge:unit=2.1 synced=2026-07-17 -->
54: const TASK_BRIDGE_RE = /<!-- bridge:unit=([\d.]+)(?:\s+synced=([\d-]+))? -->/
55: 
56: // Match tracker unit lines: - [x] 2.1 — Name → `file`
57: const UNIT_LINE_RE = /^- \[([ x~!])\] (\d+\.\d+)/
58: 
59: // Match bridge metadata in tracker: <!-- bridge:task=T021 feature=specs/... -->
60: const TRACKER_BRIDGE_RE = /<!-- bridge:task=(T\d+)(?:\s+feature=([^\s]+))? -->/
61: 
62: // ── Path helpers ─────────────────────────────────────────────
63: 
64: function getTrackerPath(): string {
65:   return process.env.DEVOPS_TRACKER ?? join(process.cwd(), 'docs/atomic/01-tracker.md')
66: }
67: 
68: function getTasksPath(featureDir: string): string {
69:   return join(process.cwd(), featureDir, 'tasks.md')
70: }
71: 
72: // ── Parsers ──────────────────────────────────────────────────
73: 
74: function parseTasksMd(content: string): ParsedTask[] {
75:   const lines = content.split('\n')
76:   const tasks: ParsedTask[] = []
77:   for (let i = 0; i < lines.length; i++) {
78:     const line = lines[i]!
79:     const m = TASK_LINE_RE.exec(line)
80:     if (m) {
81:       tasks.push({
82:         id: m[2]!,
83:         line,
84:         lineIndex: i,
85:         state: m[1] as ' ' | 'x',
86:       })
87:     }
88:   }
89:   return tasks
90: }
91: 
92: function parseTrackerBridgeMetadata(content: string): Map<string, TaskLink> {
93:   const lines = content.split('\n')
94:   const links = new Map<string, TaskLink>()
95: 
96:   for (let i = 0; i < lines.length; i++) {
97:     const line = lines[i]!
98:     const unitMatch = UNIT_LINE_RE.exec(line)
99:     if (!unitMatch) continue
100: 
101:     const unitId = unitMatch[2]!
102:     // Check next line for bridge metadata
103:     if (i + 1 < lines.length) {
104:       const nextLine = lines[i + 1]!
105:       const bridgeMatch = TRACKER_BRIDGE_RE.exec(nextLine)
106:       if (bridgeMatch) {
107:         links.set(unitId, {
108:           taskId: bridgeMatch[1]!,
109:           unitId,
110:           featureDir: bridgeMatch[2] ?? '',
111:           syncedAt: new Date().toISOString().slice(0, 10),
112:         })
113:       }
114:     }
115:   }
116: 
117:   return links
118: }
119: 
120: function parseTasksBridgeMetadata(content: string): Map<string, string> {
121:   const lines = content.split('\n>')
122:   const links = new Map<string, string>() // taskId → unitId
123: 
124:   for (let i = 0; i < lines.length; i++) {
125:     const line = lines[i]!
126:     const taskMatch = TASK_LINE_RE.exec(line)
127:     if (!taskMatch) continue
128: 
129:     const taskId = taskMatch[2]!
130:     // Check next line for bridge metadata
131:     if (i + 1 < lines.length) {
132:       const nextLine = lines[i + 1]!
133:       const bridgeMatch = TASK_BRIDGE_RE.exec(nextLine)
134:       if (bridgeMatch) {
135:         links.set(taskId, bridgeMatch[1]!)
136:       }
137:     }
138:   }
139: 
140:   return links
141: }
142: 
143: // ── Core API ─────────────────────────────────────────────────
144: 
145: /**
146:  * Map a SpecKit task ID to a DevOps atomic unit.
147:  * Returns the linked AtomicUnit or null if no link exists.
148:  */
149: export async function mapTaskToUnit(taskId: string): Promise<{ id: string; name: string } | null> {
150:   const trackerPath = getTrackerPath()
151:   const trackerContent = await readFile(trackerPath, 'utf8')
152:   const units = parseUnits(trackerContent.split('\n'))
153:   const trackerLinks = parseTrackerBridgeMetadata(trackerContent)
154: 
155:   // Find the unit that links to this task
156:   for (const [unitId, link] of trackerLinks) {
157:     if (link.taskId === taskId) {
158:       const unit = units.find((u) => u.id === unitId)
159:       if (unit) {
160:         return { id: unit.id, name: unit.name }
161:       }
162:     }
163:   }
164: 
165:   return null
166: }
167: 
168: /**
169:  * Map a DevOps atomic unit to a SpecKit task ID.
170:  * Returns the linked task ID or null if no link exists.
171:  */
172: export async function mapUnitToTask(unitId: string): Promise<string | null> {
173:   const trackerPath = getTrackerPath()
174:   const trackerContent = await readFile(trackerPath, 'utf8')
175:   const trackerLinks = parseTrackerBridgeMetadata(trackerContent)
176: 
177:   const link = trackerLinks.get(unitId)
178:   return link?.taskId ?? null
179: }
180: 
181: /**
182:  * Sync tasks from a feature's tasks.md into the DevOps tracker.
183:  * Creates new units for unlinked tasks, preserves existing links.
184:  */
185: export async function syncTasksToTracker(featureDir: string): Promise<SyncReport> {
186:   const tasksPath = getTasksPath(featureDir)
187:   const trackerPath = getTrackerPath()
188: 
189:   if (!existsSync(tasksPath)) {
190:     throw new Error(`tasks.md not found at ${tasksPath}. Run /speckit.tasks first.`)
191:   }
192: 
193:   if (!existsSync(trackerPath)) {
194:     throw new Error(`Tracker not found at ${trackerPath}`)
195:   }
196: 
197:   const tasksContent = await readFile(tasksPath, 'utf8')
198:   const trackerContent = await readFile(trackerPath, 'utf8')
199: 
200:   const tasks = parseTasksMd(tasksContent)
201:   const trackerLines = trackerContent.split('\n')
202:   const existingLinks = parseTrackerBridgeMetadata(trackerContent)
203:   const taskLinks = parseTasksBridgeMetadata(tasksContent)
204: 
205:   // Build reverse map: taskId → unitId from tasks.md bridge metadata
206:   const taskIdToUnit = new Map<string, string>()
207:   for (const [taskId, unitId] of taskLinks) {
208:     taskIdToUnit.set(taskId, unitId)
209:   }
210: 
211:   const report: SyncReport = { created: 0, updated: 0, skipped: 0, conflicts: [] }
212: 
213:   // Find the last unit in the tracker to determine the next phase
214:   const allUnits = parseUnits(trackerContent.split('\n'))
215:   let maxPhase = 0
216:   let maxUnitInPhase = 0
217:   for (const u of allUnits) {
218:     if (u.phase > maxPhase) {
219:       maxPhase = u.phase
220:       maxUnitInPhase = 0
221:     }
222:     if (u.phase === maxPhase) {
223:       const minor = Number(u.id.split('.')[1])
224:       if (minor > maxUnitInPhase) maxUnitInPhase = minor
225:     }
226:   }
227: 
228:   // Find the last unit line index in the tracker to insert new units
229:   let lastUnitLineIndex = -1
230:   for (let i = trackerLines.length - 1; i >= 0; i--) {
231:     if (UNIT_LINE_RE.test(trackerLines[i]!)) {
232:       lastUnitLineIndex = i
233:       break
234:     }
235:   }
236: 
237:   let nextMinor = maxUnitInPhase + 1
238: 
239:   for (const task of tasks) {
240:     const existingUnitId = taskIdToUnit.get(task.id)
241: 
242:     if (existingUnitId) {
243:       // Task already has a linked unit — skip
244:       report.skipped++
245:       continue
246:     }
247: 
248:     // Check if there's a conflict: unit already has different task link
249:     let conflict = false
250:     for (const [, link] of existingLinks) {
251:       if (link.featureDir === featureDir) {
252:         // This feature already has a linked unit, but not for this task
253:         // This could be a re-sync scenario
254:       }
255:     }
256: 
257:     if (conflict) {
258:       report.conflicts.push(`${task.id}: conflict with existing unit link`)
259:       continue
260:     }
261: 
262:     // Create new unit
263:     const unitId = `${maxPhase}.${nextMinor}`
264:     const taskText = task.line.replace(/^- \[([ x])\] /, '').replace(/T\d+\s*/, '')
265:     const unitLine = `- [ ] ${unitId} — ${taskText}`
266:     const bridgeComment = `  <!-- bridge:task=${task.id} feature=${featureDir} -->`
267: 
268:     // Insert after last unit line
269:     if (lastUnitLineIndex >= 0) {
270:       trackerLines.splice(lastUnitLineIndex + 2, 0, unitLine, bridgeComment)
271:       lastUnitLineIndex += 2
272:     } else {
273:       trackerLines.push(unitLine, bridgeComment)
274:       lastUnitLineIndex = trackerLines.length - 2
275:     }
276: 
277:     // Add bridge comment to tasks.md
278:     const tasksLines = tasksContent.split('\n')
279:     if (tasksLines[task.lineIndex + 1]?.includes('<!-- bridge:')) {
280:       // Already has bridge comment — skip
281:     } else {
282:       tasksLines.splice(task.lineIndex + 1, 0, `  <!-- bridge:unit=${unitId} synced=${new Date().toISOString().slice(0, 10)} -->`)
283:     }
284: 
285:     // Write updated tasks.md
286:     await writeFile(tasksPath, tasksLines.join('\n'), 'utf8')
287:     // Update tasksContent for subsequent iterations
288:     const _newTasksContent = tasksLines.join('\n')
289: 
290:     report.created++
291:     nextMinor++
292:   }
293: 
294:   // Update tracker stats
295:   const finalUnits = parseUnits(trackerLines)
296:   const stats = computeStats(finalUnits)
297:   const finalLines = updateHeader(trackerLines, stats)
298: 
299:   await writeFile(trackerPath, finalLines.join('\n'), 'utf8')
300: 
301:   return report
302: }
303: 
304: /**
305:  * Validate bidirectional consistency between tasks.md and tracker.
306:  * Reports orphan tasks, orphan units, and mismatched links.
307:  */
308: export async function validateBridge(): Promise<ConsistencyReport> {
309:   const trackerPath = getTrackerPath()
310: 
311:   if (!existsSync(trackerPath)) {
312:     return {
313:       consistent: false,
314:       orphanTasks: [],
315:       orphanUnits: [],
316:       mismatchedLinks: [],
317:     }
318:   }
319: 
320:   const trackerContent = await readFile(trackerPath, 'utf8')
321:   const trackerLinks = parseTrackerBridgeMetadata(trackerContent)
322:   const units = parseUnits(trackerContent.split('\n>'))
323: 
324:   const orphanTasks: string[] = []
325:   const orphanUnits: string[] = []
326:   const mismatchedLinks: [string, string][] = []
327: 
328:   // Check: every linked task should have a reverse link in its tasks.md
329:   // (We'd need to check each feature's tasks.md, but for now just check tracker side)
330: 
331:   // Check: every linked unit should have the task exist
332:   for (const [unitId, link] of trackerLinks) {
333:     // Unit links to a task — verify the task's bridge metadata points back
334:     const tasksPath = join(process.cwd(), link.featureDir, 'tasks.md')
335:     if (existsSync(tasksPath)) {
336:       const tasksContent = await readFile(tasksPath, 'utf8')
337:       const taskBridgeLinks = parseTasksBridgeMetadata(tasksContent)
338:       const linkedUnit = taskBridgeLinks.get(link.taskId)
339:       if (linkedUnit && linkedUnit !== unitId) {
340:         mismatchedLinks.push([unitId, `${link.taskId}→${linkedUnit}`])
341:       }
342:     }
343:   }
344: 
345:   // Check: units without bridge metadata that are in the same phase range as linked units
346:   const linkedUnitIds = new Set(trackerLinks.keys())
347:   for (const unit of units) {
348:     if (!linkedUnitIds.has(unit.id)) {
349:       // Unit doesn't have bridge metadata — check if any tasks.md links to it
350:       // For now, just report as not necessarily orphan (might be a devops-only unit)
351:     }
352:   }
353: 
354:   return {
355:     consistent: mismatchedLinks.length === 0 && orphanTasks.length === 0 && orphanUnits.length === 0,
356:     orphanTasks,
357:     orphanUnits,
358:     mismatchedLinks,
359:   }
360: }

(End of file - total 360 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\devops\\unified-gate.ts"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\devops\unified-gate.ts</path>
<type>file</type>
<content>
1: // devops/unified-gate.ts
2: // Single entry point for quality gates across SpecKit and DevOps.
3: // Orchestrates existing tools (typecheck, lint, tests, invariants, audit-code)
4: // without duplicating their logic. Supports scope-based check selection and
5: // SpecKit checklist validation.
6: 
7: import { spawn } from 'node:child_process'
8: import { readFile } from 'node:fs/promises'
9: import { existsSync } from 'node:fs'
10: import { join } from 'node:path'
11: 
12: // ── Types ────────────────────────────────────────────────────
13: 
14: export type GateScope = 'unit' | 'phase' | 'feature' | 'full'
15: 
16: export type GateCheck =
17:   | 'typecheck'
18:   | 'lint'
19:   | 'unit-test'
20:   | 'integration-test'
21:   | 'invariants'
22:   | 'audit-code'
23:   | 'audit-arch'
24:   | 'cross-surface'
25:   | 'speckit-checklists'
26: 
27: export interface GateConfig {
28:   scope: GateScope
29:   featureDir?: string
30:   unitId?: string
31:   speckit?: boolean
32:   devops?: boolean
33:   checks?: GateCheck[]
34:   json?: boolean
35: }
36: 
37: export interface CheckResult {
38:   name: string
39:   passed: boolean
40:   output: string
41:   duration: number
42:   command: string
43: }
44: 
45: export interface GateResult {
46:   passed: boolean
47:   checks: CheckResult[]
48:   duration: number
49:   summary: string
50:   scope: string
51: }
52: 
53: // ── Scope → Check Mapping ────────────────────────────────────
54: 
55: const SCOPE_CHECKS: Record<GateScope, GateCheck[]> = {
56:   unit: ['typecheck', 'lint', 'unit-test'],
57:   phase: ['typecheck', 'lint', 'unit-test', 'invariants', 'audit-code'],
58:   feature: [
59:     'typecheck',
60:     'lint',
61:     'unit-test',
62:     'invariants',
63:     'audit-code',
64:     'integration-test',
65:     'cross-surface',
66:   ],
67:   full: [
68:     'typecheck',
69:     'lint',
70:     'unit-test',
71:     'integration-test',
72:     'invariants',
73:     'audit-code',
74:     'audit-arch',
75:     'cross-surface',
76:   ],
77: }
78: 
79: // ── Command execution ────────────────────────────────────────
80: 
81: function execCommand(command: string, args: string[]): Promise<CheckResult> {
82:   const start = Date.now()
83:   return new Promise((resolve) => {
84:     const proc = spawn(command, args, {
85:       cwd: process.cwd(),
86:       stdio: ['ignore', 'pipe', 'pipe'],
87:     })
88: 
89:     let stdout = ''
90:     let stderr = ''
91: 
92:     proc.stdout?.on('data', (data: Buffer) => {
93:       stdout += data.toString()
94:     })
95: 
96:     proc.stderr?.on('data', (data: Buffer) => {
97:       stderr += data.toString()
98:     })
99: 
100:     proc.on('close', (code) => {
101:       const duration = Date.now() - start
102:       const output = stdout + stderr
103:       resolve({
104:         name: args.join(' '),
105:         passed: code === 0,
106:         output,
107:         duration,
108:         command: `${command} ${args.join(' ')}`,
109:       })
110:     })
111: 
112:     proc.on('error', () => {
113:       resolve({
114:         name: args.join(' '),
115:         passed: false,
116:         output: `Failed to execute: ${command}`,
117:         duration: Date.now() - start,
118:         command: `${command} ${args.join(' ')}`,
119:       })
120:     })
121:   })
122: }
123: 
124: // ── Individual check runners ─────────────────────────────────
125: 
126: async function runTypeCheck(_config: GateConfig): Promise<CheckResult> {
127:   return execCommand('bun', ['run', 'typecheck'])
128: }
129: 
130: async function runLint(_config: GateConfig): Promise<CheckResult> {
131:   return execCommand('bun', ['run', 'lint'])
132: }
133: 
134: async function runUnitTest(_config: GateConfig): Promise<CheckResult> {
135:   return execCommand('bun', ['test', '--test-dir=tests/unit'])
136: }
137: 
138: async function runIntegrationTest(_config: GateConfig): Promise<CheckResult> {
139:   return execCommand('bun', ['test', 'tests/integration'])
140: }
141: 
142: async function runInvariants(_config: GateConfig): Promise<CheckResult> {
143:   return execCommand('bun', ['run', 'devops', 'invariants', 'check', '--category', 'B'])
144: }
145: 
146: async function runAuditCode(_config: GateConfig): Promise<CheckResult> {
147:   return execCommand('bun', ['run', 'devops', 'audit-code', 'standard', '--json'])
148: }
149: 
150: async function runAuditArch(_config: GateConfig): Promise<CheckResult> {
151:   return execCommand('bun', ['run', 'devops', 'audit-arch', 'standard'])
152: }
153: 
154: async function runCrossSurface(_config: GateConfig): Promise<CheckResult> {
155:   return execCommand('bun', ['run', 'devops', 'verify-cross-surface'])
156: }
157: 
158: async function runSpecKitChecklists(config: GateConfig): Promise<CheckResult> {
159:   const start = Date.now()
160: 
161:   if (!config.featureDir) {
162:     return {
163:       name: 'speckit-checklists',
164:       passed: false,
165:       output: 'No featureDir provided for SpecKit checklist check',
166:       duration: Date.now() - start,
167:       command: 'speckit-checklists (internal)',
168:     }
169:   }
170: 
171:   const checklistsPath = join(process.cwd(), config.featureDir, 'checklists', 'requirements.md')
172: 
173:   if (!existsSync(checklistsPath)) {
174:     // Checklists are optional per spec — warn but don't fail
175:     return {
176:       name: 'speckit-checklists',
177:       passed: true,
178:       output: 'No checklists found (optional)',
179:       duration: Date.now() - start,
180:       command: 'speckit-checklists (internal)',
181:     }
182:   }
183: 
184:   try {
185:     const content = await readFile(checklistsPath, 'utf8')
186:     const lines = content.split('\n')
187:     const incomplete: string[] = []
188: 
189:     for (const line of lines) {
190:       const match = line.match(/^- \[ \] (CHK\d+):?\s*(.*)$/)
191:       if (match) {
192:         incomplete.push(`${match[1]}: ${match[2]}`)
193:       }
194:     }
195: 
196:     const passed = incomplete.length === 0
197:     const output = passed
198:       ? 'All checklists complete'
199:       : `Incomplete checklists:\n${incomplete.map((c) => `  - ${c}`).join('\n')}`
200: 
201:     return {
202:       name: 'speckit-checklists',
203:       passed,
204:       output,
205:       duration: Date.now() - start,
206:       command: 'speckit-checklists (internal)',
207:     }
208:   } catch (e) {
209:     return {
210:       name: 'speckit-checklists',
211:       passed: false,
212:       output: `Error reading checklists: ${(e as Error).message}`,
213:       duration: Date.now() - start,
214:       command: 'speckit-checklists (internal)',
215:     }
216:   }
217: }
218: 
219: // ── Check dispatcher ─────────────────────────────────────────
220: 
221: const CHECK_RUNNERS: Record<GateCheck, (config: GateConfig) => Promise<CheckResult>> = {
222:   typecheck: runTypeCheck,
223:   lint: runLint,
224:   'unit-test': runUnitTest,
225:   'integration-test': runIntegrationTest,
226:   invariants: runInvariants,
227:   'audit-code': runAuditCode,
228:   'audit-arch': runAuditArch,
229:   'cross-surface': runCrossSurface,
230:   'speckit-checklists': runSpecKitChecklists,
231: }
232: 
233: // ── Main gate function ───────────────────────────────────────
234: 
235: export async function runUnifiedGate(config: GateConfig): Promise<GateResult> {
236:   const start = Date.now()
237: 
238:   // Determine which checks to run
239:   let checksToRun: GateCheck[]
240: 
241:   if (config.checks) {
242:     // Explicit checks provided
243:     checksToRun = config.checks
244:   } else {
245:     // Use scope-based defaults
246:     checksToRun = [...SCOPE_CHECKS[config.scope]]
247: 
248:     // Add SpecKit checklists if speckit mode is enabled
249:     if (config.speckit && !checksToRun.includes('speckit-checklists')) {
250:       checksToRun.push('speckit-checklists')
251:     }
252: 
253:     // Add devops checks if devops mode is enabled
254:     if (config.devops) {
255:       if (!checksToRun.includes('invariants')) {
256:         checksToRun.push('invariants')
257:       }
258:       if (!checksToRun.includes('audit-code')) {
259:         checksToRun.push('audit-code')
260:       }
261:     }
262:   }
263: 
264:   // Run all checks
265:   const results: CheckResult[] = []
266:   for (const check of checksToRun) {
267:     const runner = CHECK_RUNNERS[check]
268:     if (runner) {
269:       const result = await runner(config)
270:       results.push(result)
271:     }
272:   }
273: 
274:   const duration = Date.now() - start
275:   const passed = results.every((r) => r.passed)
276: 
277:   // Build summary
278:   const passedCount = results.filter((r) => r.passed).length
279:   const failedCount = results.length - passedCount
280:   const summary = passed
281:     ? `PASS (${passedCount}/${results.length} checks)`
282:     : `FAIL (${failedCount}/${results.length} checks failed)`
283: 
284:   return {
285:     passed,
286:     checks: results,
287:     duration,
288:     summary,
289:     scope: config.scope,
290:   }
291: }

(End of file - total 291 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\devops\\speckit-converge-bridge.ts"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\devops\speckit-converge-bridge.ts</path>
<type>file</type>
<content>
1: // devops/speckit-converge-bridge.ts
2: // Unified converge pipeline: spec gap analysis + code audit + architecture audit.
3: // Produces a single combined report and appends P0/P1 findings as convergence tasks.
4: 
5: import { spawn } from 'node:child_process'
6: import { readFile, writeFile, mkdir } from 'node:fs/promises'
7: import { existsSync } from 'node:fs'
8: import { join } from 'node:path'
9: 
10: // ── Types ────────────────────────────────────────────────────
11: 
12: export type FindingPriority = 'P0' | 'P1' | 'P2' | 'P3'
13: 
14: export interface SpecGap {
15:   type: 'missing' | 'partial' | 'contradicts' | 'unrequested'
16:   description: string
17:   tracedTo?: string
18: }
19: 
20: export interface CodeFinding {
21:   id: string
22:   priority: FindingPriority
23:   title: string
24:   file: string
25:   line: number
26:   fix: string
27: }
28: 
29: export interface ArchFinding {
30:   id: string
31:   priority: FindingPriority
32:   dimension: string
33:   title: string
34:   modules: string[]
35:   fix: string
36: }
37: 
38: export interface ConvergeReport {
39:   featureDir: string
40:   specGaps: SpecGap[]
41:   codeFindings: CodeFinding[]
42:   archFindings: ArchFinding[]
43:   tasksAppended: number
44:   timestamp: string
45:   errors: string[]
46: }
47: 
48: // ── Command execution ────────────────────────────────────────
49: 
50: function execCommand(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
51:   return new Promise((resolve) => {
52:     const proc = spawn(command, args, {
53:       cwd: process.cwd(),
54:       stdio: ['ignore', 'pipe', 'pipe'],
55:     })
56: 
57:     let stdout = ''
58:     let stderr = ''
59: 
60:     proc.stdout?.on('data', (data: Buffer) => {
61:       stdout += data.toString()
62:     })
63: 
64:     proc.stderr?.on('data', (data: Buffer) => {
65:       stderr += data.toString()
66:     })
67: 
68:     proc.on('close', (code) => {
69:       resolve({ exitCode: code ?? 1, stdout, stderr })
70:     })
71: 
72:     proc.on('error', () => {
73:       resolve({ exitCode: 1, stdout: '', stderr: `Failed to execute: ${command}` })
74:     })
75:   })
76: }
77: 
78: // ── Spec gap analysis ────────────────────────────────────────
79: 
80: async function analyzeSpecGaps(featureDir: string): Promise<SpecGap[]> {
81:   const gaps: SpecGap[] = []
82: 
83:   const specPath = join(process.cwd(), featureDir, 'spec.md')
84:   const planPath = join(process.cwd(), featureDir, 'plan.md')
85:   const tasksPath = join(process.cwd(), featureDir, 'tasks.md')
86: 
87:   // Check if spec exists
88:   if (!existsSync(specPath)) {
89:     gaps.push({
90:       type: 'missing',
91:       description: 'spec.md not found — run /speckit.specify first',
92:     })
93:     return gaps
94:   }
95: 
96:   // Check if plan exists
97:   if (!existsSync(planPath)) {
98:     gaps.push({
99:       type: 'missing',
100:       description: 'plan.md not found — run /speckit.plan first',
101:       tracedTo: 'spec.md',
102:     })
103:   }
104: 
105:   // Check if tasks exist
106:   if (!existsSync(tasksPath)) {
107:     gaps.push({
108:       type: 'missing',
109:       description: 'tasks.md not found — run /speckit.tasks first',
110:       tracedTo: 'plan.md',
111:     })
112:   }
113: 
114:   // Parse spec for user stories
115:   if (existsSync(specPath)) {
116:     const specContent = await readFile(specPath, 'utf8')
117:     const userStoryMatches = specContent.match(/### US\d+/g) ?? []
118:     const taskContent = existsSync(tasksPath) ? await readFile(tasksPath, 'utf8') : ''
119:     const taskCount = (taskContent.match(/^- \[ \] T\d+/g) ?? []).length
120: 
121:     // Simple heuristic: if spec has many user stories but few tasks, there's a gap
122:     if (userStoryMatches.length > 5 && taskCount < userStoryMatches.length) {
123:       gaps.push({
124:         type: 'partial',
125:         description: `Spec has ${userStoryMatches.length} user stories but only ${taskCount} pending tasks`,
126:         tracedTo: 'spec.md',
127:       })
128:     }
129:   }
130: 
131:   return gaps
132: }
133: 
134: // ── Code audit ───────────────────────────────────────────────
135: 
136: async function runCodeAudit(): Promise<{ findings: CodeFinding[]; error?: string }> {
137:   try {
138:     const result = await execCommand('bun', ['run', 'devops', 'audit-code', 'standard', '--json'])
139: 
140:     if (result.exitCode !== 0 && !result.stdout) {
141:       return { findings: [], error: result.stderr || 'Audit code failed' }
142:     }
143: 
144:     // Parse JSON output
145:     try {
146:       // Extract JSON from output (may have non-JSON prefix)
147:       const jsonStart = result.stdout.indexOf('{')
148:       if (jsonStart === -1) {
149:         return { findings: [], error: 'No JSON output from audit-code' }
150:       }
151: 
152:       const parsed = JSON.parse(result.stdout.slice(jsonStart))
153:       const findings: CodeFinding[] = []
154: 
155:       // Map audit findings to CodeFinding format
156:       if (parsed.findings && Array.isArray(parsed.findings)) {
157:         for (const f of parsed.findings) {
158:           findings.push({
159:             id: f.id ?? `AU-${String(findings.length + 1).padStart(4, '0')}`,
160:             priority: f.severity ?? 'P2',
161:             title: f.title ?? f.message ?? 'Unknown finding',
162:             file: f.file ?? f.location?.file ?? '',
163:             line: f.line ?? f.location?.line ?? 0,
164:             fix: f.suggestion ?? f.fix ?? 'Review and fix',
165:           })
166:         }
167:       }
168: 
169:       return { findings }
170:     } catch {
171:       return { findings: [], error: 'Failed to parse audit-code output' }
172:     }
173:   } catch (e) {
174:     return { findings: [], error: `Audit code error: ${(e as Error).message}` }
175:   }
176: }
177: 
178: // ── Architecture audit ───────────────────────────────────────
179: 
180: async function runArchAudit(): Promise<{ findings: ArchFinding[]; error?: string }> {
181:   try {
182:     const result = await execCommand('bun', ['run', 'devops', 'audit-arch', 'surface', '--json'])
183: 
184:     if (result.exitCode !== 0 && !result.stdout) {
185:       return { findings: [], error: result.stderr || 'Audit arch failed' }
186:     }
187: 
188:     // Parse JSON output
189:     try {
190:       const jsonStart = result.stdout.indexOf('{')
191:       if (jsonStart === -1) {
192:         return { findings: [], error: 'No JSON output from audit-arch' }
193:       }
194: 
195:       const parsed = JSON.parse(result.stdout.slice(jsonStart))
196:       const findings: ArchFinding[] = []
197: 
198:       if (parsed.findings && Array.isArray(parsed.findings)) {
199:         for (const f of parsed.findings) {
200:           findings.push({
201:             id: f.id ?? `AR-${String(findings.length + 1).padStart(4, '0')}`,
202:             priority: f.severity ?? 'P2',
203:             dimension: f.dimension ?? 'unknown',
204:             title: f.title ?? f.message ?? 'Unknown finding',
205:             modules: f.modules ?? [],
206:             fix: f.suggestion ?? f.fix ?? 'Review and fix',
207:           })
208:         }
209:       }
210: 
211:       return { findings }
212:     } catch {
213:       return { findings: [], error: 'Failed to parse audit-arch output' }
214:     }
215:   } catch (e) {
216:     return { findings: [], error: `Audit arch error: ${(e as Error).message}` }
217:   }
218: }
219: 
220: // ── Task appending ───────────────────────────────────────────
221: 
222: function findHighestTaskId(tasksContent: string): number {
223:   const matches = tasksContent.match(/T(\d+)/g) ?? []
224:   let max = 0
225:   for (const m of matches) {
226:     const num = Number(m.slice(1))
227:     if (num > max) max = num
228:   }
229:   return max
230: }
231: 
232: function appendTasksToMd(
233:   tasksContent: string,
234:   codeFindings: CodeFinding[],
235:   archFindings: ArchFinding[],
236: ): { content: string; appended: number } {
237:   const lines = tasksContent.split('\n')
238:   let nextTaskId = findHighestTaskId(tasksContent) + 1
239:   let appended = 0
240: 
241:   // Find if convergence phase already exists
242:   let convergencePhaseIndex = -1
243:   for (let i = 0; i < lines.length; i++) {
244:     if (lines[i]!.includes('## Phase') && lines[i]!.includes('Convergence')) {
245:       convergencePhaseIndex = i
246:       break
247:     }
248:   }
249: 
250:   // Build new tasks
251:   const newTasks: string[] = []
252: 
253:   // P0/P1 code findings
254:   const highPriorityCode = codeFindings.filter((f) => f.priority === 'P0' || f.priority === 'P1')
255:   if (highPriorityCode.length > 0) {
256:     newTasks.push('')
257:     newTasks.push('### Code Quality (from audit-code)')
258:     newTasks.push('')
259:     for (const finding of highPriorityCode) {
260:       const taskId = `T${String(nextTaskId++).padStart(3, '0')}`
261:       newTasks.push(`- [ ] ${taskId} [P] Fix ${finding.priority}: ${finding.title} → \`${finding.file}:${finding.line}\` — ${finding.fix}`)
262:       newTasks.push(`  <!-- source=audit-code id=${finding.id} priority=${finding.priority} -->`)
263:       appended++
264:     }
265:   }
266: 
267:   // P0/P1 architecture findings
268:   const highPriorityArch = archFindings.filter((f) => f.priority === 'P0' || f.priority === 'P1')
269:   if (highPriorityArch.length > 0) {
270:     newTasks.push('')
271:     newTasks.push('### Architecture (from audit-arch)')
272:     newTasks.push('')
273:     for (const finding of highPriorityArch) {
274:       const taskId = `T${String(nextTaskId++).padStart(3, '0')}`
275:       newTasks.push(`- [ ] ${taskId} Fix ${finding.priority}: ${finding.title} — ${finding.fix}`)
276:       newTasks.push(`  <!-- source=audit-arch id=${finding.id} priority=${finding.priority} -->`)
277:       appended++
278:     }
279:   }
280: 
281:   if (newTasks.length === 0) {
282:     return { content: tasksContent, appended: 0 }
283:   }
284: 
285:   // Find end of file or append after last phase
286:   const insertIndex = lines.length
287: 
288:   // Build convergence section
289:   const convergenceSection = [
290:     '',
291:     '---',
292:     '',
293:     `## Phase ${Math.floor(lines.length / 50) + 1}: Convergence`,
294:     ...newTasks,
295:     '',
296:   ]
297: 
298:   lines.splice(insertIndex, 0, ...convergenceSection)
299: 
300:   return { content: lines.join('\n'), appended }
301: }
302: 
303: // ── Report generation ────────────────────────────────────────
304: 
305: function generateConvergeReport(report: ConvergeReport): string {
306:   const lines: string[] = []
307: 
308:   lines.push(`# Converge Report: ${report.featureDir}`)
309:   lines.push('')
310:   lines.push(`Generated: ${report.timestamp}`)
311:   lines.push('')
312: 
313:   // Summary
314:   const totalFindings = report.specGaps.length + report.codeFindings.length + report.archFindings.length
315:   const p0Count = [...report.codeFindings, ...report.archFindings].filter((f) => f.priority === 'P0').length
316:   const p1Count = [...report.codeFindings, ...report.archFindings].filter((f) => f.priority === 'P1').length
317: 
318:   lines.push('## Summary')
319:   lines.push('')
320:   lines.push(`- Total findings: ${totalFindings}`)
321:   lines.push(`- P0 findings: ${p0Count}`)
322:   lines.push(`- P1 findings: ${p1Count}`)
323:   lines.push(`- Tasks appended: ${report.tasksAppended}`)
324:   lines.push('')
325: 
326:   // Spec gaps
327:   if (report.specGaps.length > 0) {
328:     lines.push('## Spec Gaps')
329:     lines.push('')
330:     for (const gap of report.specGaps) {
331:       lines.push(`- [${gap.type}] ${gap.description}${gap.tracedTo ? ` (traced to ${gap.tracedTo})` : ''}`)
332:     }
333:     lines.push('')
334:   }
335: 
336:   // Code findings (P0/P1 first)
337:   const sortedCode = [...report.codeFindings].sort((a, b) => {
338:     const order = { P0: 0, P1: 1, P2: 2, P3: 3 }
339:     return (order[a.priority] ?? 4) - (order[b.priority] ?? 4)
340:   })
341: 
342:   if (sortedCode.length > 0) {
343:     lines.push('## Code Findings')
344:     lines.push('')
345:     for (const f of sortedCode) {
346:       lines.push(`### ${f.priority}: ${f.title}`)
347:       lines.push(`- **File:** ${f.file}:${f.line}`)
348:       lines.push(`- **Fix:** ${f.fix}`)
349:       lines.push(`- **ID:** ${f.id}`)
350:       lines.push('')
351:     }
352:   }
353: 
354:   // Architecture findings
355:   const sortedArch = [...report.archFindings].sort((a, b) => {
356:     const order = { P0: 0, P1: 1, P2: 2, P3: 3 }
357:     return (order[a.priority] ?? 4) - (order[b.priority] ?? 4)
358:   })
359: 
360:   if (sortedArch.length > 0) {
361:     lines.push('## Architecture Findings')
362:     lines.push('')
363:     for (const f of sortedArch) {
364:       lines.push(`### ${f.priority}: ${f.title}`)
365:       lines.push(`- **Dimension:** ${f.dimension}`)
366:       lines.push(`- **Modules:** ${f.modules.join(', ')}`)
367:       lines.push(`- **Fix:** ${f.fix}`)
368:       lines.push(`- **ID:** ${f.id}`)
369:       lines.push('')
370:     }
371:   }
372: 
373:   // Errors
374:   if (report.errors.length > 0) {
375:     lines.push('## Errors')
376:     lines.push('')
377:     for (const err of report.errors) {
378:       lines.push(`- ${err}`)
379:     }
380:     lines.push('')
381:   }
382: 
383:   return lines.join('\n')
384: }
385: 
386: // ── Main converge function ───────────────────────────────────
387: 
388: export async function unifiedConverge(featureDir: string): Promise<ConvergeReport> {
389:   const report: ConvergeReport = {
390:     featureDir,
391:     specGaps: [],
392:     codeFindings: [],
393:     archFindings: [],
394:     tasksAppended: 0,
395:     timestamp: new Date().toISOString(),
396:     errors: [],
397:   }
398: 
399:   // 1. Run spec gap analysis
400:   try {
401:     report.specGaps = await analyzeSpecGaps(featureDir)
402:   } catch (e) {
403:     report.errors.push(`Spec analysis failed: ${(e as Error).message}`)
404:   }
405: 
406:   // 2. Run code audit
407:   const codeResult = await runCodeAudit()
408:   report.codeFindings = codeResult.findings
409:   if (codeResult.error) {
410:     report.errors.push(`Code audit: ${codeResult.error}`)
411:   }
412: 
413:   // 3. Run architecture audit
414:   const archResult = await runArchAudit()
415:   report.archFindings = archResult.findings
416:   if (archResult.error) {
417:     report.errors.push(`Arch audit: ${archResult.error}`)
418:   }
419: 
420:   // 4. Append P0/P1 findings as tasks
421:   const tasksPath = join(process.cwd(), featureDir, 'tasks.md')
422:   if (existsSync(tasksPath)) {
423:     try {
424:       const tasksContent = await readFile(tasksPath, 'utf8')
425:       const { content: newContent, appended } = appendTasksToMd(
426:         tasksContent,
427:         report.codeFindings,
428:         report.archFindings,
429:       )
430: 
431:       if (appended > 0) {
432:         await writeFile(tasksPath, newContent, 'utf8')
433:         report.tasksAppended = appended
434:       }
435:     } catch (e) {
436:       report.errors.push(`Task append failed: ${(e as Error).message}`)
437:     }
438:   } else {
439:     report.errors.push('tasks.md not found — cannot append convergence tasks')
440:   }
441: 
442:   // 5. Write consolidated report
443:   const auditsDir = join(process.cwd(), 'docs', 'audits')
444:   if (!existsSync(auditsDir)) {
445:     await mkdir(auditsDir, { recursive: true })
446:   }
447: 
448:   const dateStr = new Date().toISOString().slice(0, 10)
449:   const featureName = featureDir.split('/').pop() ?? 'unknown'
450:   const reportPath = join(auditsDir, `CONVERGE-${featureName}-${dateStr}.md`)
451: 
452:   await writeFile(reportPath, generateConvergeReport(report), 'utf8')
453: 
454:   return report
455: }

(End of file - total 455 lines)
</content>
```

**Tool: glob**

**Input:**
```json
{
  "pattern": "devops/research-bridge.ts"
}
```

**Output:**
```
C:\0-BlackBoxProject-0\vivim-final\devops\research-bridge.ts
```

**Tool: glob**

**Input:**
```json
{
  "pattern": "devops/tracker-speckit-sync.ts"
}
```

**Output:**
```
C:\0-BlackBoxProject-0\vivim-final\devops\tracker-speckit-sync.ts
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 6.7s)

_Thinking:_

Now let me also look at the existing SpecKit specs and the agent skills related to provider onboarding to understand the full picture.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\devops\\research-bridge.ts"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\devops\research-bridge.ts</path>
<type>file</type>
<content>
1: // devops/research-bridge.ts
2: // Bridge between DevOps research briefs and SpecKit research.md files.
3: // Enables bidirectional format conversion and topic-based brief discovery.
4: //
5: // DevOps briefs live in: docs/research/briefs/*-brief.md
6: // SpecKit research lives in: specs/NNN-name/research.md
7: 
8: import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
9: import { existsSync } from 'node:fs'
10: import { join } from 'node:path'
11: 
12: // ── Types ────────────────────────────────────────────────────
13: 
14: export interface Source {
15:   title: string
16:   url: string
17:   claim: string
18:   confidence: string
19: }
20: 
21: export interface Brief {
22:   topic: string
23:   confidence: 'High' | 'Medium' | 'Low'
24:   sources: Source[]
25:   keyDecisions: string[]
26:   evidenceSummary: string
27:   date: string
28:   rawContent: string
29: }
30: 
31: // ── Paths ────────────────────────────────────────────────────
32: 
33: function getBriefsDir(): string {
34:   return join(process.cwd(), 'docs', 'research', 'briefs')
35: }
36: 
37: function getSpecsDir(): string {
38:   return join(process.cwd(), 'specs')
39: }
40: 
41: // ── Topic matching ───────────────────────────────────────────
42: 
43: function normalizeTopic(topic: string): string[] {
44:   return topic
45:     .toLowerCase()
46:     .replace(/[^\w\s]/g, '')
47:     .split(/\s+/)
48:     .filter((w) => w.length > 2)
49: }
50: 
51: function matchScore(filename: string, topicWords: string[]): number {
52:   const normalizedFilename = filename
53:     .toLowerCase()
54:     .replace(/[^\w\s]/g, '')
55:     .replace(/-brief$/, '')
56:     .split(/[-_\s]/)
57: 
58:   let matches = 0
59:   for (const word of topicWords) {
60:     if (normalizedFilename.some((fw) => fw.includes(word) || word.includes(fw))) {
61:       matches++
62:     }
63:   }
64: 
65:   return topicWords.length > 0 ? matches / topicWords.length : 0
66: }
67: 
68: // ── Brief parsing ────────────────────────────────────────────
69: 
70: function parseBrief(content: string, filename: string): Brief {
71:   const lines = content.split('\n')
72:   let topic = filename.replace(/-brief\.md$/, '').replace(/-/g, ' ')
73:   let confidence: Brief['confidence'] = 'Medium'
74:   const sources: Source[] = []
75:   const keyDecisions: string[] = []
76:   let evidenceSummary = ''
77:   let currentSection = ''
78: 
79:   for (const line of lines) {
80:     // Extract topic from title
81:     if (line.startsWith('# ')) {
82:       topic = line.slice(2).trim()
83:       continue
84:     }
85: 
86:     // Extract confidence
87:     const confMatch = line.match(/confidence:\s*(high|medium|low)/i)
88:     if (confMatch) {
89:       confidence = confMatch[1]!.charAt(0).toUpperCase() + confMatch[1]!.slice(1).toLowerCase() as Brief['confidence']
90:       continue
91:     }
92: 
93:     // Track sections
94:     if (line.startsWith('## ')) {
95:       currentSection = line.slice(3).trim().toLowerCase()
96:       continue
97:     }
98: 
99:     // Extract key decisions
100:     if (currentSection.includes('key decision') && line.startsWith('- ')) {
101:       keyDecisions.push(line.slice(2).trim())
102:       continue
103:     }
104: 
105:     // Extract evidence summary
106:     if (currentSection.includes('evidence') && line.trim()) {
107:       evidenceSummary += line.trim() + ' '
108:       continue
109:     }
110: 
111:     // Extract sources
112:     if (currentSection.includes('source') && line.startsWith('- ')) {
113:       const sourceMatch = line.match(/- \[(.+?)\]\((.+?)\):?\s*(.*)$/)
114:       if (sourceMatch) {
115:         sources.push({
116:           title: sourceMatch[1]!,
117:           url: sourceMatch[2]!,
118:           claim: sourceMatch[3] ?? '',
119:           confidence: confidence,
120:         })
121:       }
122:     }
123:   }
124: 
125:   return {
126:     topic,
127:     confidence,
128:     sources,
129:     keyDecisions,
130:     evidenceSummary: evidenceSummary.trim(),
131:     date: new Date().toISOString().slice(0, 10),
132:     rawContent: content,
133:   }
134: }
135: 
136: // ── Format conversion ────────────────────────────────────────
137: 
138: export function convertBriefToSpecKit(brief: Brief): string {
139:   const lines: string[] = []
140: 
141:   lines.push(`# Research: ${brief.topic}`)
142:   lines.push('')
143:   lines.push(`<!-- confidence: ${brief.confidence} -->`)
144:   lines.push('')
145: 
146:   // Summary (from evidence summary)
147:   lines.push('## Summary')
148:   lines.push('')
149:   lines.push(brief.evidenceSummary || 'No summary available.')
150:   lines.push('')
151: 
152:   // Decision (from key decisions)
153:   lines.push('## Decision')
154:   lines.push('')
155:   if (brief.keyDecisions.length > 0) {
156:     brief.keyDecisions.forEach((d, i) => {
157:       lines.push(`${i + 1}. ${d}`)
158:     })
159:   } else {
160:     lines.push('No decisions recorded.')
161:   }
162:   lines.push('')
163: 
164:   // Rationale (from evidence)
165:   lines.push('## Rationale')
166:   lines.push('')
167:   if (brief.sources.length > 0) {
168:     for (const source of brief.sources) {
169:       lines.push(`- ${source.claim || source.title} ([${source.title}](${source.url}))`)
170:     }
171:   } else {
172:     lines.push('No evidence available.')
173:   }
174:   lines.push('')
175: 
176:   // Sources
177:   lines.push('## Sources')
178:   lines.push('')
179:   if (brief.sources.length > 0) {
180:     for (const source of brief.sources) {
181:       lines.push(`- [${source.title}](${source.url})`)
182:     }
183:   } else {
184:     lines.push('No sources available.')
185:   }
186:   lines.push('')
187: 
188:   // Alternatives (from open questions if present in raw content)
189:   const openQuestionsMatch = brief.rawContent.match(/##\s*Open Questions\s*\n([\s\S]*?)(?=\n##|$)/i)
190:   if (openQuestionsMatch) {
191:     lines.push('## Alternatives')
192:     lines.push('')
193:     lines.push(openQuestionsMatch[1]!.trim())
194:     lines.push('')
195:   }
196: 
197:   return lines.join('\n')
198: }
199: 
200: export function convertSpecKitToBrief(content: string): Brief {
201:   const lines = content.split('\n')
202:   let topic = 'Unknown Topic'
203:   let confidence: Brief['confidence'] = 'Medium'
204:   const keyDecisions: string[] = []
205:   let evidenceSummary = ''
206:   const sources: Source[] = []
207:   let currentSection = ''
208: 
209:   for (const line of lines) {
210:     // Extract topic from title
211:     if (line.startsWith('# ')) {
212:       topic = line.slice(2).replace(/^Research:\s*/, '').trim()
213:       continue
214:     }
215: 
216:     // Extract confidence from comment
217:     const confMatch = line.match(/<!--\s*confidence:\s*(high|medium|low)\s*-->/i)
218:     if (confMatch) {
219:       confidence = confMatch[1]!.charAt(0).toUpperCase() + confMatch[1]!.slice(1).toLowerCase() as Brief['confidence']
220:       continue
221:     }
222: 
223:     // Track sections
224:     if (line.startsWith('## ')) {
225:       currentSection = line.slice(3).trim().toLowerCase()
226:       continue
227:     }
228: 
229:     // Extract decisions
230:     if (currentSection.includes('decision') && line.match(/^\d+\.\s/)) {
231:       keyDecisions.push(line.replace(/^\d+\.\s/, '').trim())
232:       continue
233:     }
234: 
235:     // Extract rationale/evidence
236:     if (currentSection.includes('rationale') && line.startsWith('- ')) {
237:       evidenceSummary += line.slice(2).trim() + ' '
238:       continue
239:     }
240: 
241:     // Extract sources
242:     if (currentSection.includes('source') && line.startsWith('- ')) {
243:       const sourceMatch = line.match(/- \[(.+?)\]\((.+?)\)/)
244:       if (sourceMatch) {
245:         sources.push({
246:           title: sourceMatch[1]!,
247:           url: sourceMatch[2]!,
248:           claim: '',
249:           confidence,
250:         })
251:       }
252:     }
253:   }
254: 
255:   return {
256:     topic,
257:     confidence,
258:     sources,
259:     keyDecisions,
260:     evidenceSummary: evidenceSummary.trim(),
261:     date: new Date().toISOString().slice(0, 10),
262:     rawContent: content,
263:   }
264: }
265: 
266: // ── Core API ─────────────────────────────────────────────────
267: 
268: /**
269:  * Find a DevOps research brief matching the given topic.
270:  * Returns the best matching brief or null if none found.
271:  */
272: export async function findBriefForTopic(topic: string): Promise<Brief | null> {
273:   const briefsDir = getBriefsDir()
274: 
275:   if (!existsSync(briefsDir)) {
276:     return null
277:   }
278: 
279:   const topicWords = normalizeTopic(topic)
280:   if (topicWords.length === 0) {
281:     return null
282:   }
283: 
284:   const entries = await readdir(briefsDir)
285:   const briefFiles = entries.filter((e) => e.endsWith('-brief.md'))
286: 
287:   let bestMatch: { file: string; score: number } | null = null
288: 
289:   for (const file of briefFiles) {
290:     const score = matchScore(file, topicWords)
291:     if (score > 0.3 && (!bestMatch || score > bestMatch.score)) {
292:       bestMatch = { file, score }
293:     }
294:   }
295: 
296:   if (!bestMatch) {
297:     return null
298:   }
299: 
300:   const content = await readFile(join(briefsDir, bestMatch.file), 'utf8')
301:   return parseBrief(content, bestMatch.file)
302: }
303: 
304: /**
305:  * Export a DevOps brief to SpecKit research.md format.
306:  * Returns the converted content as a string.
307:  */
308: export function exportBriefForSpecKit(brief: Brief, _featureDir: string): string {
309:   return convertBriefToSpecKit(brief)
310: }
311: 
312: /**
313:  * Import a SpecKit research.md and convert to DevOps brief format.
314:  * Returns the converted brief or null if no research.md exists.
315:  */
316: export async function importSpecKitResearch(featureDir: string): Promise<Brief | null> {
317:   const researchPath = join(getSpecsDir(), featureDir, 'research.md')
318: 
319:   if (!existsSync(researchPath)) {
320:     return null
321:   }
322: 
323:   try {
324:     const content = await readFile(researchPath, 'utf8')
325:     return convertSpecKitToBrief(content)
326:   } catch {
327:     return null
328:   }
329: }
330: 
331: /**
332:  * Find all SpecKit research.md files and check their freshness.
333:  * Returns files older than the specified age in days.
334:  */
335: export async function findStaleSpecKitResearch(
336:   maxAgeDays: number = 180,
337: ): Promise<Array<{ path: string; lastModified: string; ageDays: number }>> {
338:   const specsDir = getSpecsDir()
339: 
340:   if (!existsSync(specsDir)) {
341:     return []
342:   }
343: 
344:   const stale: Array<{ path: string; lastModified: string; ageDays: number }> = []
345:   const entries = await readdir(specsDir, { withFileTypes: true })
346: 
347:   for (const entry of entries) {
348:     if (!entry.isDirectory()) continue
349: 
350:     const researchPath = join(specsDir, entry.name, 'research.md')
351:     if (!existsSync(researchPath)) continue
352: 
353:     try {
354:       const content = await readFile(researchPath, 'utf8')
355:       // Try to extract date from content
356:       const dateMatch = content.match(/(?:date|generated):\s*(\d{4}-\d{2}-\d{2})/i)
357:       if (dateMatch) {
358:         const fileDate = new Date(dateMatch[1]!)
359:         const ageDays = Math.floor((Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24))
360:         if (ageDays > maxAgeDays) {
361:           stale.push({
362:             path: researchPath,
363:             lastModified: dateMatch[1]!,
364:             ageDays,
365:           })
366:         }
367:       }
368:     } catch {
369:       // Skip unparseable files
370:     }
371:   }
372: 
373:   return stale
374: }

(End of file - total 374 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\devops\\tracker-speckit-sync.ts"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\devops\tracker-speckit-sync.ts</path>
<type>file</type>
<content>
1: // devops/tracker-speckit-sync.ts
2: // Bidirectional sync between SpecKit tasks.md and DevOps atomic tracker.
3: // Reads bridge metadata to resolve task↔unit links and syncs state.
4: 
5: import { readFile, writeFile } from 'node:fs/promises'
6: import { existsSync } from 'node:fs'
7: import { join } from 'node:path'
8: import { parseUnits, computeStats, updateHeader, updateState, type UnitState } from './tracker.ts'
9: import { mapTaskToUnit, mapUnitToTask, type SyncReport, type ConsistencyReport } from './speckit-bridge.ts'
10: 
11: // ── Types ────────────────────────────────────────────────────
12: 
13: export interface BidirectionalSyncReport extends SyncReport {
14:   timestamp: string
15: }
16: 
17: // ── Regex patterns ───────────────────────────────────────────
18: 
19: // Match task lines: - [ ] T012 ... or - [x] T012 ...
20: const TASK_LINE_RE = /^- \[([ x])\] (T\d+)(?:\s+.*)?$/
21: 
22: // Match bridge metadata in tasks.md: <!-- bridge:unit=2.1 synced=2026-07-17 -->
23: const TASK_BRIDGE_RE = /<!-- bridge:unit=([\d.]+)(?:\s+synced=([\d-]+))? -->/
24: 
25: // Match tracker unit lines: - [x] 2.1 — Name → `file`
26: const UNIT_LINE_RE = /^- \[([ x~!])\] (\d+\.\d+)/
27: 
28: // Match bridge metadata in tracker: <!-- bridge:task=T021 feature=specs/... -->
29: const TRACKER_BRIDGE_RE = /<!-- bridge:task=(T\d+)(?:\s+feature=([^\s]+))? -->/
30: 
31: // ── Path helpers ─────────────────────────────────────────────
32: 
33: function getTrackerPath(): string {
34:   return process.env.DEVOPS_TRACKER ?? join(process.cwd(), 'docs/atomic/01-tracker.md')
35: }
36: 
37: function getTasksPath(featureDir: string): string {
38:   return join(process.cwd(), featureDir, 'tasks.md')
39: }
40: 
41: // ── Parsers ──────────────────────────────────────────────────
42: 
43: function parseTasksMd(content: string): Array<{ id: string; state: ' ' | 'x'; lineIndex: number }> {
44:   const lines = content.split('\n')
45:   const tasks: Array<{ id: string; state: ' ' | 'x'; lineIndex: number }> = []
46: 
47:   for (let i = 0; i < lines.length; i++) {
48:     const line = lines[i]!
49:     const m = TASK_LINE_RE.exec(line)
50:     if (m) {
51:       tasks.push({
52:         id: m[2]!,
53:         state: m[1] as ' ' | 'x',
54:         lineIndex: i,
55:       })
56:     }
57:   }
58: 
59:   return tasks
60: }
61: 
62: function parseTrackerBridgeMetadata(content: string): Map<string, { taskId: string; featureDir: string }> {
63:   const lines = content.split('\n')
64:   const links = new Map<string, { taskId: string; featureDir: string }>()
65: 
66:   for (let i = 0; i < lines.length; i++) {
67:     const line = lines[i]!
68:     const unitMatch = UNIT_LINE_RE.exec(line)
69:     if (!unitMatch) continue
70: 
71:     const unitId = unitMatch[2]!
72:     // Check next line for bridge metadata
73:     if (i + 1 < lines.length) {
74:       const nextLine = lines[i + 1]!
75:       const bridgeMatch = TRACKER_BRIDGE_RE.exec(nextLine)
76:       if (bridgeMatch) {
77:         links.set(unitId, {
78:           taskId: bridgeMatch[1]!,
79:           featureDir: bridgeMatch[2] ?? '',
80:         })
81:       }
82:     }
83:   }
84: 
85:   return links
86: }
87: 
88: function parseTasksBridgeMetadata(content: string): Map<string, string> {
89:   const lines = content.split('\n')
90:   const links = new Map<string, string>() // taskId → unitId
91: 
92:   for (let i = 0; i < lines.length; i++) {
93:     const line = lines[i]!
94:     const taskMatch = TASK_LINE_RE.exec(line)
95:     if (!taskMatch) continue
96: 
97:     const taskId = taskMatch[2]!
98:     // Check next line for bridge metadata
99:     if (i + 1 < lines.length) {
100:       const nextLine = lines[i + 1]!
101:       const bridgeMatch = TASK_BRIDGE_RE.exec(nextLine)
102:       if (bridgeMatch) {
103:         links.set(taskId, bridgeMatch[1]!)
104:       }
105:     }
106:   }
107: 
108:   return links
109: }
110: 
111: // ── Core API ─────────────────────────────────────────────────
112: 
113: /**
114:  * Sync a SpecKit feature's tasks.md to the DevOps tracker.
115:  * Marks linked units as done when tasks are completed.
116:  */
117: export async function syncFeatureToTracker(featureDir: string): Promise<BidirectionalSyncReport> {
118:   const tasksPath = getTasksPath(featureDir)
119:   const trackerPath = getTrackerPath()
120: 
121:   if (!existsSync(tasksPath)) {
122:     throw new Error(`tasks.md not found at ${tasksPath}. Run /speckit.tasks first.`)
123:   }
124: 
125:   if (!existsSync(trackerPath)) {
126:     throw new Error(`Tracker not found at ${trackerPath}`)
127:   }
128: 
129:   const tasksContent = await readFile(tasksPath, 'utf8')
130:   const trackerContent = await readFile(trackerPath, 'utf8')
131: 
132:   const tasks = parseTasksMd(tasksContent)
133:   const trackerLines = trackerContent.split('\n>')
134:   const taskLinks = parseTasksBridgeMetadata(tasksContent)
135: 
136:   const report: BidirectionalSyncReport = {
137:     created: 0,
138:     updated: 0,
139:     skipped: 0,
140:     conflicts: [],
141:     timestamp: new Date().toISOString(),
142:   }
143: 
144:   for (const task of tasks) {
145:     const unitId = taskLinks.get(task.id)
146: 
147:     if (!unitId) {
148:       // Task has no linked unit — skip (sync only updates existing links)
149:       report.skipped++
150:       continue
151:     }
152: 
153:     // Find the unit in the tracker and update its state
154:     const targetState: UnitState = task.state === 'x' ? 'done' : 'pending'
155: 
156:     try {
157:       // Parse fresh content each time since we're modifying
158:       const freshContent = await readFile(trackerPath, 'utf8')
159:       const freshLines = freshContent.split('\n')
160: 
161:       // Find the unit line
162:       let unitLineIndex = -1
163:       for (let i = 0; i < freshLines.length; i++) {
164:         const unitMatch = UNIT_LINE_RE.exec(freshLines[i]!)
165:         if (unitMatch && unitMatch[2] === unitId) {
166:           unitLineIndex = i
167:           break
168:         }
169:       }
170: 
171:       if (unitLineIndex === -1) {
172:         report.conflicts.push(`Unit ${unitId} not found in tracker for task ${task.id}`)
173:         continue
174:       }
175: 
176:       // Check current state
177:       const currentMatch = UNIT_LINE_RE.exec(freshLines[unitLineIndex]!)
178:       const currentState = currentMatch?.[1] === 'x' ? 'done' : 'pending'
179: 
180:       if (currentState === targetState) {
181:         // Already in correct state
182:         report.skipped++
183:         continue
184:       }
185: 
186:       // Update the unit state
187:       const updatedLines = updateState(freshLines, unitId, targetState)
188:       const units = parseUnits(updatedLines)
189:       const stats = computeStats(units)
190:       const finalLines = updateHeader(updatedLines, stats)
191: 
192:       await writeFile(trackerPath, finalLines.join('\n'), 'utf8')
193:       report.updated++
194:     } catch (e) {
195:       report.conflicts.push(`Error updating unit ${unitId}: ${(e as Error).message}`)
196:     }
197:   }
198: 
199:   return report
200: }
201: 
202: /**
203:  * Sync a DevOps unit's state to its linked SpecKit task.
204:  * Marks the task checkbox when the unit is done.
205:  */
206: export async function syncTrackerToTask(unitId: string): Promise<boolean> {
207:   const trackerPath = getTrackerPath()
208: 
209:   if (!existsSync(trackerPath)) {
210:     return false
211:   }
212: 
213:   const trackerContent = await readFile(trackerPath, 'utf8')
214:   const trackerLinks = parseTrackerBridgeMetadata(trackerContent)
215:   const link = trackerLinks.get(unitId)
216: 
217:   if (!link) {
218:     // No linked task
219:     return false
220:   }
221: 
222:   const tasksPath = join(process.cwd(), link.featureDir, 'tasks.md')
223: 
224:   if (!existsSync(tasksPath)) {
225:     return false
226:   }
227: 
228:   const tasksContent = await readFile(tasksPath, 'utf8')
229:   const lines = tasksContent.split('\n')
230: 
231:   // Find the task line
232:   for (let i = 0; i < lines.length; i++) {
233:     const taskMatch = TASK_LINE_RE.exec(lines[i]!)
234:     if (taskMatch && taskMatch[2] === link.taskId) {
235:       // Check current state
236:       const currentState = taskMatch[1] === 'x' ? 'done' : 'pending'
237: 
238:       // Get unit state from tracker
239:       const unitLines = trackerContent.split('\n>')
240:       for (let j = 0; j < unitLines.length; j++) {
241:         const unitMatch = UNIT_LINE_RE.exec(unitLines[j]!)
242:         if (unitMatch && unitMatch[2] === unitId) {
243:           const unitState = unitMatch[1] === 'x' ? 'done' : 'pending'
244: 
245:           if (currentState === unitState) {
246:             // Already in sync
247:             return true
248:           }
249: 
250:           // Update task checkbox
251:           const targetMarker = unitState === 'done' ? 'x' : ' '
252:           lines[i] = lines[i]!.replace(/\[([ x])\]/, `[${targetMarker}]`)
253: 
254:           await writeFile(tasksPath, lines.join('\n'), 'utf8')
255:           return true
256:         }
257:       }
258:     }
259:   }
260: 
261:   return false
262: }
263: 
264: /**
265:  * Validate bidirectional consistency between tasks.md and tracker.
266:  * Returns a detailed report of orphans and mismatches.
267:  */
268: export async function validateConsistency(): Promise<ConsistencyReport> {
269:   const trackerPath = getTrackerPath()
270: 
271:   if (!existsSync(trackerPath)) {
272:     return {
273:       consistent: false,
274:       orphanTasks: [],
275:       orphanUnits: [],
276:       mismatchedLinks: [],
277:     }
278:   }
279: 
280:   const trackerContent = await readFile(trackerPath, 'utf8')
281:   const trackerLinks = parseTrackerBridgeMetadata(trackerContent)
282:   const units = parseUnits(trackerContent.split('\n>'))
283: 
284:   const orphanTasks: string[] = []
285:   const orphanUnits: string[] = []
286:   const mismatchedLinks: [string, string][] = []
287: 
288:   // Check: every linked task should have a reverse link
289:   for (const [unitId, link] of trackerLinks) {
290:     const tasksPath = join(process.cwd(), link.featureDir, 'tasks.md')
291:     if (existsSync(tasksPath)) {
292:       const tasksContent = await readFile(tasksPath, 'utf8')
293:       const taskBridgeLinks = parseTasksBridgeMetadata(tasksContent)
294:       const linkedUnit = taskBridgeLinks.get(link.taskId)
295:       if (linkedUnit && linkedUnit !== unitId) {
296:         mismatchedLinks.push([unitId, `${link.taskId}→${linkedUnit}`])
297:       }
298:     }
299:   }
300: 
301:   // Check: every task with bridge metadata should have a corresponding unit
302:   // (This would require reading all tasks.md files — for now just check tracker side)
303: 
304:   return {
305:     consistent: mismatchedLinks.length === 0 && orphanTasks.length === 0 && orphanUnits.length === 0,
306:     orphanTasks,
307:     orphanUnits,
308:     mismatchedLinks,
309:   }
310: }
311: 
312: /**
313:  * Sync all features in specs/ directory to the tracker.
314:  * Returns aggregate sync report.
315:  */
316: export async function syncAllFeatures(): Promise<BidirectionalSyncReport> {
317:   const specsDir = join(process.cwd(), 'specs')
318: 
319:   if (!existsSync(specsDir)) {
320:     return {
321:       created: 0,
322:       updated: 0,
323:       skipped: 0,
324:       conflicts: [],
325:       timestamp: new Date().toISOString(),
326:     }
327:   }
328: 
329:   const { readdir } = await import('node:fs/promises')
330:   const entries = await readdir(specsDir, { withFileTypes: true })
331:   const aggregateReport: BidirectionalSyncReport = {
332:     created: 0,
333:     updated: 0,
334:     skipped: 0,
335:     conflicts: [],
336:     timestamp: new Date().toISOString(),
337:   }
338: 
339:   for (const entry of entries) {
340:     if (!entry.isDirectory()) continue
341: 
342:     const featureDir = `specs/${entry.name}`
343:     const tasksPath = getTasksPath(featureDir)
344: 
345:     if (existsSync(tasksPath)) {
346:       try {
347:         const report = await syncFeatureToTracker(featureDir)
348:         aggregateReport.created += report.created
349:         aggregateReport.updated += report.updated
350:         aggregateReport.skipped += report.skipped
351:         aggregateReport.conflicts.push(...report.conflicts)
352:       } catch (e) {
353:         aggregateReport.conflicts.push(`${featureDir}: ${(e as Error).message}`)
354:       }
355:     }
356:   }
357: 
358:   return aggregateReport
359: }

(End of file - total 359 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\devops\\speckit-audit.ts"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\devops\speckit-audit.ts</path>
<type>file</type>
<content>
1: // devops/speckit-audit.ts
2: // Audit all DevOps skills for SpecKit integration readiness.
3: // Produces a SkillReadinessReport with per-skill analysis, gap matrix,
4: // and priority ranking. Outputs both markdown and JSON.
5: 
6: import { readFile, writeFile, mkdir } from 'node:fs/promises'
7: import { existsSync } from 'node:fs'
8: import { join } from 'node:path'
9: 
10: // ── Types ────────────────────────────────────────────────────
11: 
12: export type GapPriority = 'P0' | 'P1' | 'P2' | 'P3'
13: export type GapEffort = 'S' | 'M' | 'L'
14: 
15: export interface Gap {
16:   id: string
17:   skill: string
18:   description: string
19:   priority: GapPriority
20:   effort: GapEffort
21:   specKitOverlap?: string
22: }
23: 
24: export interface SkillAnalysis {
25:   name: string
26:   path: string
27:   referencesSpecKit: boolean
28:   duplicatesSpecKit: string[]
29:   needsSpecKitData: boolean
30:   gaps: Gap[]
31: }
32: 
33: export interface SkillReadinessReport {
34:   generatedAt: string
35:   skills: SkillAnalysis[]
36:   gapMatrix: Gap[]
37:   priorityTop5: Gap[]
38: }
39: 
40: // ── Skill definitions ────────────────────────────────────────
41: 
42: const SKILLS = [
43:   { name: 'devops', path: '.opencode/skill/devops/SKILL.md' },
44:   { name: 'devops-fullstack', path: '.opencode/skill/devops-fullstack/SKILL.md' },
45:   { name: 'devops-research', path: '.opencode/skill/devops-research/SKILL.md' },
46:   { name: 'devops-roadmap', path: '.opencode/skill/devops-roadmap/SKILL.md' },
47:   { name: 'devops-generators', path: '.opencode/skill/devops-generators/SKILL.md' },
48:   { name: 'source-audit', path: '.opencode/skill/source-audit/SKILL.md' },
49:   { name: 'arch-audit', path: '.opencode/skill/arch-audit/SKILL.md' },
50:   { name: 'vivi-frontend', path: '.opencode/skill/vivi-frontend/SKILL.md' },
51:   { name: 'vivim-testing', path: '.opencode/skill/vivim-testing/SKILL.md' },
52:   { name: 'prisma-workflow', path: '.opencode/skill/prisma-workflow/SKILL.md' },
53:   { name: 'vivim-build', path: '.opencode/skill/vivim-build/SKILL.md' },
54:   { name: 'vivim-runtime', path: '.opencode/skill/vivim-runtime/SKILL.md' },
55: ] as const
56: 
57: // ── SpecKit capability definitions ───────────────────────────
58: 
59: const SPECKIT_CAPABILITIES = [
60:   {
61:     command: 'specify',
62:     whatItDoes: 'Creates spec.md with user stories + requirements',
63:     devOpsOverlap: 'devops-roadmap interview produces similar structure',
64:   },
65:   {
66:     command: 'clarify',
67:     whatItDoes: 'Resolves ambiguities in spec',
68:     devOpsOverlap: 'devops-research resolves ambiguities for CREATE units',
69:   },
70:   {
71:     command: 'plan',
72:     whatItDoes: 'Creates plan.md with technical design + research',
73:     devOpsOverlap: 'devops-research produces research.md; plan has constitution check',
74:   },
75:   {
76:     command: 'tasks',
77:     whatItDoes: 'Creates tasks.md with phased task breakdown',
78:     devOpsOverlap: 'devops tracker has atomic units with phases',
79:   },
80:   {
81:     command: 'analyze',
82:     whatItDoes: 'Read-only cross-artifact consistency',
83:     devOpsOverlap: 'source-audit + arch-audit do code analysis',
84:   },
85:   {
86:     command: 'checklist',
87:     whatItDoes: 'Requirement quality gate',
88:     devOpsOverlap: 'No DevOps equivalent',
89:   },
90:   {
91:     command: 'implement',
92:     whatItDoes: 'Executes tasks.md',
93:     devOpsOverlap: 'devops loop executes atomic units',
94:   },
95:   {
96:     command: 'converge',
97:     whatItDoes: 'Gap analysis vs spec/plan/tasks',
98:     devOpsOverlap: 'source-audit + arch-audit find gaps',
99:   },
100:   {
101:     command: 'taskstoissues',
102:     whatItDoes: 'Converts tasks → GitHub issues',
103:     devOpsOverlap: 'No DevOps equivalent',
104:   },
105: ]
106: 
107: // ── Audit logic ──────────────────────────────────────────────
108: 
109: function detectSpecKitReferences(content: string): boolean {
110:   const patterns = [/speckit/i, /spec\.md/i, /plan\.md/i, /tasks\.md/i, /constitution/i, /\.specify\//i]
111:   return patterns.some((p) => p.test(content))
112: }
113: 
114: function detectDuplications(content: string, skillName: string): string[] {
115:   const duplications: string[] = []
116: 
117:   // Check for gate functionality overlap
118:   if (/\bgate\b/i.test(content) && /typecheck|lint|test/i.test(content)) {
119:     duplications.push('Gates (partial overlap with tasks template gates)')
120:   }
121: 
122:   // Check for research overlap
123:   if (/\bresearch\b/i.test(content) && /brief|research\.md/i.test(content)) {
124:     duplications.push('Research (overlap with plan Phase 0)')
125:   }
126: 
127:   // Check for audit overlap
128:   if (/\baudit\b/i.test(content) && /quality|code.*review|finding/i.test(content)) {
129:     duplications.push('Audit (overlap with converge analysis)')
130:   }
131: 
132:   // Check for tracker overlap
133:   if (/\btracker\b/i.test(content) && /atomic|unit/i.test(content)) {
134:     duplications.push('Tracker (overlap with tasks.md)')
135:   }
136: 
137:   // Check for implementation loop overlap
138:   if (/\bloop\b/i.test(content) && /implement|execute|build/i.test(content)) {
139:     duplications.push('Implementation loop (overlap with speckit implement)')
140:   }
141: 
142:   return duplications
143: }
144: 
145: function detectNeedsSpecKitData(content: string): boolean {
146:   // Skills that need spec/plan/tasks data as input
147:   const needsDataPatterns = [
148:     /input.*spec/i,
149:     /requires.*plan/i,
150:     /reads.*tasks/i,
151:     /consumes.*spec/i,
152:     /depends.*plan/i,
153:   ]
154:   return needsDataPatterns.some((p) => p.test(content))
155: }
156: 
157: function generateGaps(skillName: string, content: string): Gap[] {
158:   const gaps: Gap[] = []
159:   let gapId = 1
160: 
161:   // P0: No spec awareness in implementation path
162:   if (/\b(loop|implement|build)\b/i.test(content) && !/spec\.md|specify/i.test(content)) {
163:     gaps.push({
164:       id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
165:       skill: skillName,
166:       description: 'No spec awareness in implementation path',
167:       priority: 'P0',
168:       effort: 'M',
169:       specKitOverlap: 'speckit implement',
170:     })
171:   }
172: 
173:   // P1: Missing bridge module import
174:   if (!/speckit-bridge|bridge.*module/i.test(content)) {
175:     gaps.push({
176:       id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
177:       skill: skillName,
178:       description: 'No bridge module import for task↔unit mapping',
179:       priority: 'P1',
180:       effort: 'S',
181:     })
182:   }
183: 
184:   // P1: No unified gate reference
185:   if (/\bgate\b/i.test(content) && !/unified-gate/i.test(content)) {
186:     gaps.push({
187:       id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
188:       skill: skillName,
189:       description: 'Uses legacy gate instead of unified gate',
190:       priority: 'P1',
191:       effort: 'S',
192:       specKitOverlap: 'unified-gate',
193:     })
194:   }
195: 
196:   // P2: No decision table reference
197:   if (!/decision.*table|when.*to.*use/i.test(content)) {
198:     gaps.push({
199:       id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
200:       skill: skillName,
201:       description: 'Missing decision table for SpecKit vs DevOps routing',
202:       priority: 'P2',
203:       effort: 'S',
204:     })
205:   }
206: 
207:   // P2: No converge pipeline reference
208:   if (/\b(audit|converge|gap)\b/i.test(content) && !/speckit-converge/i.test(content)) {
209:     gaps.push({
210:       id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
211:       skill: skillName,
212:       description: 'Missing converge pipeline integration',
213:       priority: 'P2',
214:       effort: 'M',
215:       specKitOverlap: 'speckit converge',
216:     })
217:   }
218: 
219:   // P3: No SpecKit Integration section in SKILL.md
220:   if (!/## SpecKit Integration|## Integration/i.test(content)) {
221:     gaps.push({
222:       id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
223:       skill: skillName,
224:       description: 'Missing SpecKit Integration section in SKILL.md',
225:       priority: 'P3',
226:       effort: 'S',
227:     })
228:   }
229: 
230:   return gaps
231: }
232: 
233: // ── Main audit function ──────────────────────────────────────
234: 
235: export async function runSkillAudit(): Promise<SkillReadinessReport> {
236:   const skills: SkillAnalysis[] = []
237:   const allGaps: Gap[] = []
238: 
239:   for (const skill of SKILLS) {
240:     const fullPath = join(process.cwd(), skill.path)
241:     let content = ''
242: 
243:     if (existsSync(fullPath)) {
244:       content = await readFile(fullPath, 'utf8')
245:     }
246: 
247:     const referencesSpecKit = detectSpecKitReferences(content)
248:     const duplicatesSpecKit = detectDuplications(content, skill.name)
249:     const needsSpecKitData = detectNeedsSpecKitData(content)
250:     const gaps = generateGaps(skill.name, content)
251: 
252:     skills.push({
253:       name: skill.name,
254:       path: skill.path,
255:       referencesSpecKit,
256:       duplicatesSpecKit,
257:       needsSpecKitData,
258:       gaps,
259:     })
260: 
261:     allGaps.push(...gaps)
262:   }
263: 
264:   // Sort gaps by priority (P0 first) then effort (S first)
265:   const priorityOrder: Record<GapPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
266:   const effortOrder: Record<GapEffort, number> = { S: 0, M: 1, L: 2 }
267: 
268:   allGaps.sort((a, b) => {
269:     const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
270:     if (pDiff !== 0) return pDiff
271:     return effortOrder[a.effort] - effortOrder[b.effort]
272:   })
273: 
274:   const priorityTop5 = allGaps.slice(0, 5)
275: 
276:   return {
277:     generatedAt: new Date().toISOString(),
278:     skills,
279:     gapMatrix: allGaps,
280:     priorityTop5,
281:   }
282: }
283: 
284: // ── Report generators ────────────────────────────────────────
285: 
286: function generateMarkdownReport(report: SkillReadinessReport): string {
287:   const lines: string[] = []
288: 
289:   lines.push('# DevOps Skills → SpecKit Integration Readiness')
290:   lines.push('')
291:   lines.push(`Generated: ${report.generatedAt}`)
292:   lines.push('')
293: 
294:   // Executive Summary
295:   const withSpecKit = report.skills.filter((s) => s.referencesSpecKit).length
296:   const withDuplication = report.skills.filter((s) => s.duplicatesSpecKit.length > 0).length
297:   lines.push('## Executive Summary')
298:   lines.push(`- ${report.skills.length} skills audited`)
299:   lines.push(`- ${withSpecKit} reference SpecKit (currently: ${withSpecKit})`)
300:   lines.push(`- ${withDuplication} duplicate SpecKit functionality`)
301:   if (report.priorityTop5.length > 0) {
302:     lines.push(`- Top gap: ${report.priorityTop5[0]!.description} (${report.priorityTop5[0]!.skill})`)
303:   }
304:   lines.push('')
305: 
306:   // Per-Skill Analysis
307:   lines.push('## Per-Skill Analysis')
308:   lines.push('')
309:   for (const skill of report.skills) {
310:     lines.push(`### ${skill.name}`)
311:     lines.push(`- **References SpecKit:** ${skill.referencesSpecKit ? 'Yes' : 'No'}`)
312:     if (skill.duplicatesSpecKit.length > 0) {
313:       lines.push(`- **Duplicates:** ${skill.duplicatesSpecKit.join('; ')}`)
314:     }
315:     lines.push(`- **Needs SpecKit Data:** ${skill.needsSpecKitData ? 'Yes' : 'No'}`)
316:     if (skill.gaps.length > 0) {
317:       lines.push('- **Gaps:**')
318:       for (const gap of skill.gaps) {
319:         lines.push(`  - ${gap.priority}/${gap.effort}: ${gap.description}`)
320:       }
321:     }
322:     lines.push('')
323:   }
324: 
325:   // Gap Priority Matrix
326:   lines.push('## Gap Priority Matrix')
327:   lines.push('| Priority | Skill | Gap | Effort |')
328:   lines.push('|----------|-------|-----|--------|')
329:   for (const gap of report.gapMatrix) {
330:     lines.push(`| ${gap.priority} | ${gap.skill} | ${gap.description} | ${gap.effort} |`)
331:   }
332:   lines.push('')
333: 
334:   // Top 5 Integration Points
335:   lines.push('## Top 5 Integration Points')
336:   for (let i = 0; i < report.priorityTop5.length; i++) {
337:     const gap = report.priorityTop5[i]!
338:     lines.push(`${i + 1}. **${gap.skill}** (${gap.priority}/${gap.effort}): ${gap.description}`)
339:   }
340:   lines.push('')
341: 
342:   return lines.join('\n')
343: }
344: 
345: // ── CLI entry ────────────────────────────────────────────────
346: 
347: export async function runSpeckitAudit(args: string[]): Promise<void> {
348:   const report = await runSkillAudit()
349: 
350:   const outputDir = join(process.cwd(), 'docs', 'integration')
351:   if (!existsSync(outputDir)) {
352:     await mkdir(outputDir, { recursive: true })
353:   }
354: 
355:   // Write markdown report
356:   const mdPath = join(outputDir, 'skill-readiness.md')
357:   await writeFile(mdPath, generateMarkdownReport(report), 'utf8')
358: 
359:   // Write JSON report
360:   const jsonPath = join(outputDir, 'skill-readiness.json')
361:   await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8')
362: 
363:   console.log(`Skill audit complete: ${report.skills.length} skills analyzed`)
364:   console.log(`Gap matrix: ${report.gapMatrix.length} gaps identified`)
365:   console.log(`Reports written to: ${outputDir}`)
366:   console.log(`  - ${mdPath}`)
367:   console.log(`  - ${jsonPath}`)
368: }

(End of file - total 368 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 6.1s)

_Thinking:_

Now let me also check the constitution and existing specs to understand the current state of the SpecKit system.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\.specify\\memory\\constitution.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\.specify\memory\constitution.md</path>
<type>file</type>
<content>
1: # VIVIM Constitution
2: 
3: ## Core Principles
4: 
5: ### I. Governor Canon (NON-NEGOTIABLE)
6: Only `ChromeGovernor` touches CDP (`BunCdpClient`). No engine imports `BunCdpClient` directly.
7: This is enforced by `bun run devops invariants check --category B` and is a hard gate.
8: Exempt entities must be documented in invariants.ts.
9: 
10: ### II. Store Contracts (NON-NEGOTIABLE)
11: Engines depend on `src/storage/contracts/*.ts` interfaces, never `src/storage/impl/*.ts`.
12: Implementation details are hidden behind contracts. This enables testing with mock stores
13: and prevents coupling to Prisma or storage internals.
14: 
15: ### III. One Entry Point (NON-NEGOTIABLE)
16: Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that
17: call `POST /api/interpret` → `POST /api/capabilities/:id/execute`.
18: - New capability: register in `registerDefaultCapabilities` / a `*caps.ts` module.
19: - New NL phrase: add a pattern to `catalog.ts` bound to a `capabilityId`.
20: - Never: hand-write CLI commands, hand-write UI actions, or open a second transport.
21: 
22: ### IV. Research-First
23: No implementation without research report classification. Phase N requires Phase N-1 complete.
24: Evidence-before-action. Truth scans before roadmap modifications.
25: 
26: ### V. Code Quality Standards
27: - TypeScript strict mode, ESNext target, `.js` extension in imports (Bun ESM)
28: - Prefer `type` imports: `import type { Foo } from './bar.js'`
29: - No `any` — use `unknown` + type narrowing
30: - Zod for runtime validation at boundaries
31: - Custom error classes from `src/errors.ts` — never raw `new Error()`
32: - ULID for IDs via `src/ids.ts`
33: - Barrell exports from `src/index.ts`
34: - `Result<T, E>` pattern where appropriate
35: 
36: ### VI. Testing Gates (NON-NEGOTIABLE)
37: - `bun test` must pass before every commit
38: - `bun run typecheck` — 0 errors
39: - `bun run lint` — 0 warnings
40: - `bun run devops invariants check --category B` — 0 block violations
41: - `bun run devops audit-code standard` — 0 P0 findings
42: - `bun run devops verify-cross-surface` — all capabilities resolve across CLI/API/MCP/UI
43: - Unit tests for engine files, integration tests for engine interactions, E2E for full stack
44: 
45: ## Architecture Constraints
46: 
47: ### Engine Layers
48: - L0-L1: Provider Knowledge Graph (ProviderRegistrar, ProviderHealthKernel)
49: - L2-L3: Capability System (CapabilityResolutionEngine, CapabilityEngine)
50: - L4: Session & State (ConversationManager, StreamBlockStore)
51: - Chrome Layer: ChromeGovernor (CDP proxy, lifecycle, trace, health)
52: - Cross-cutting: CapabilityEventBus, ConfigManager, StreamParserEngine
53: - Lifecycle: RegistrationAuditor, VersionManager, TelemetryAggregator
54: 
55: ### Database
56: - Prisma ORM only — never raw SQL unless performance-critical
57: - Seed once via `bun run db:setup` (migrate + seed), NOT at boot
58: - `bun run serve` starts engines only — no re-seeding, no migrate
59: - Seed JSON manifests in `seeds/` are the authoritative data source
60: - Transactions for multi-table writes
61: 
62: ### Frontend
63: - Primary surface: unified infinite canvas (`web/ui/src/features/canvas/CanvasSurface.tsx`)
64: - Driven by DB-backed provider-type conceptual model (`ProviderType` + `UiComponent`, 4-tier resolution)
65: - Prefer adding `UiComponent` tiers over hardcoded `if (slug === 'x')` branches
66: - `ChatPage` is a secondary tab; the canvas is the generative backbone
67: - Capability-driven: UI actions resolve through `CapabilityResolutionEngine`
68: 
69: ### Shell Environment
70: - All commands are PowerShell 7+ compatible
71: - PS1 scripts use `$PSScriptRoot` — invoke ONLY via `pwsh scripts/<name>.ps1` from repo root
72: - Never pipe scripts or use `pwsh -c`/`-Command` which breaks `$PSScriptRoot`
73: 
74: ### Capability Design
75: - Every capability has: `id`, `slug`, `name`, `description`, `category`, `inputSchema`, `outputSchema`, `cliCommand`, `ui`, `mcpToolName`, `apiEndpoint`, `surfaces`
76: - Taxonomy chain gotchas: UI slot IDs must be namespaced (e.g., `chat.actionBar`), capability nodes may lack `category` (derive from slug), verify after taxonomy changes
77: 
78: ## Development Workflow
79: 
80: ### Adding Features
81: 1. Research phase: evidence and brief before code
82: 2. Define spec: what and why, not how
83: 3. Create implementation plan: tech stack, architecture
84: 4. Break into tasks: independently testable units
85: 5. Implement: red-green-refactor per task
86: 6. Verify: typecheck + lint + test + invariants + audit + cross-surface
87: 
88: ### Git Conventions
89: - Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
90: - One logical change per commit
91: - Reference engine names in commits: `feat(CapabilityEngine): add selector resolution`
92: 
93: ### File Organization
94: - `src/engines/` — one file per engine
95: - `src/storage/contracts/` — engine-facing interfaces
96: - `src/storage/impl/` — Prisma-backed implementations
97: - `tests/unit/`, `tests/integration/`, `tests/e2e/`
98: - `seeds/` — JSON manifests for DB seeding
99: 
100: ## Governance
101: This constitution supersedes all other practices. Amendments require documentation in ADRs.
102: All PRs must pass the gate checklist. Complexity that violates principles must be justified.
103: AGENTS.md and INVARIANTS.md are runtime companions to this constitution.
104: 
105: **Version**: 1.0.0 | **Ratified**: 2025-07-17 | **Last Amended**: 2025-07-17

(End of file - total 105 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\specs"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\specs</path>
<type>directory</type>
<entries>
.analyze.md
.checklist.md
001-production-hardening/
002-canvas-surface/
003-chat-advanced/
004-provider-ops-e2e/
005-first-run-onboarding/
006-provider-account-dashboard/
007-conversation-resilience/
008-knowledge-memory-ui/
009-smart-provider-routing/
010-data-portability/
011-streaming-ux-polish/
012-canvas-persistence/
013-automated-recovery/
014-workflow-automation-ui/
BASELINE.md

(17 entries)
</entries>
```

**Tool: glob**

**Input:**
```json
{
  "pattern": "seeds/providers/*.json"
}
```

**Output:**
```
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\z-ai.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\whatsapp.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\telegram.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\system.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\studio-ai.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\slack.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\qwen.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\gemini.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\facebook.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\deepseek.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\claude.json
C:\0-BlackBoxProject-0\vivim-final\seeds\providers\chatgpt.json
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 7.6s)

_Thinking:_

Let me look at a couple of provider seeds and the existing specs to understand the provider discovery lifecycle better.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\seeds\\providers\\chatgpt.json"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\seeds\providers\chatgpt.json</path>
<type>file</type>
<content>
1: {
2:   "$schema": "https://vivim.app/cap-store/v1/provider-manifest.schema.json",
3:   "provider": {
4:     "slug": "chatgpt",
5:     "display_name": "ChatGPT",
6:     "description": "OpenAI's ChatGPT assistant",
7:     "category": "ai",
8:     "provider_type": "llm",
9:     "website_url": "https://chatgpt.com",
10:     "documentation_url": "https://platform.openai.com/docs",
11:     "auth_type": "browser",
12:     "has_multi_account": true,
13:     "profile_strategy": "per_account",
14:     "fleet_config": {
15:       "port_range": [9252, 9280],
16:       "extra_args": ["--no-first-run"]
17:     },
18:     "capabilities": [
19:       "select_model",
20:       "send_message",
21:       "edit_message",
22:       "regenerate_response",
23:       "upload_file",
24:       "create_new_chat",
25:       "navigate_chat",
26:       "delete_chat",
27:       "rename_chat",
28:       "browse_with_bing"
29:     ]
30:   },
31:   "endpoints": [
32:     {
33:       "label": "Landing",
34:       "url": "https://chatgpt.com",
35:       "endpoint_type": "landing",
36:       "is_default": true
37:     },
38:     {
39:       "label": "Chat",
40:       "url": "https://chatgpt.com",
41:       "endpoint_type": "chat",
42:       "selector": { "composer": "#prompt-textarea", "send_button": "[data-testid='send-button']" },
43:       "composer_type": "textarea",
44:       "send_method": "both",
45:       "content_editable": false
46:     },
47:     {
48:       "label": "Login",
49:       "url": "https://chatgpt.com/auth/login",
50:       "endpoint_type": "login",
51:       "selector": {
52:         "email_input": "input[name='email']",
53:         "continue_button": "button[type='submit']"
54:       }
55:     }
56:   ],
57:   "parsers": [
58:     {
59:       "name": "chatgpt/001_openai_sse",
60:       "version": 1,
61:       "is_active": true,
62:       "logic_type": "inline",
63:       "logic_code": "var parse = function(rawBody) { var blocks = []; var index = 0; var lines = rawBody.split('\\n'); for (var i = 0; i < lines.length; i++) { var trimmed = lines[i].trim(); if (!trimmed.startsWith('data:')) continue; var payload = trimmed.slice(5).trim(); if (payload === '[DONE]') break; try { var json = JSON.parse(payload); var delta = json.choices && json.choices[0] && json.choices[0].delta; if (delta && delta.content) { var lastBlock = blocks[blocks.length - 1]; if (lastBlock && lastBlock.kind === 'text') { lastBlock.content += delta.content; } else { blocks.push({ kind: 'text', content: delta.content, index: index++ }); } } if (delta && delta.tool_calls) { for (var j = 0; j < delta.tool_calls.length; j++) { var tc = delta.tool_calls[j]; blocks.push({ kind: 'tool_use', toolName: (tc.function && tc.function.name) || 'unknown', input: (tc.function && tc.function.arguments) || {}, index: index++ }); } } } catch (e) { void e; } } if (blocks.length === 0 && rawBody.trim().length > 0) { blocks.push({ kind: 'text', content: rawBody, index: 0 }); } return blocks; }; var detectCompletion = function(rawBody) { return rawBody.indexOf('[DONE]') !== -1 || /\"finish_reason\"\\s*:\\s*\"stop\"/.test(rawBody); }; var getConfidence = function(rawBody) { var hasDone = rawBody.indexOf('[DONE]') !== -1; var hasDelta = rawBody.indexOf('choices') !== -1 && rawBody.indexOf('delta') !== -1; if (hasDone) return 1; if (hasDelta) return 0.7; return 0; }; exports.default = { name: 'chatgpt/001_openai_sse', version: 1, providerId: 'chatgpt', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };"
64:     }
65:   ],
66:   "models": [
67:     {
68:       "slug": "gpt-4o",
69:       "display_name": "GPT-4o",
70:       "is_default": true,
71:       "context_window": 128000,
72:       "max_output_tokens": 16384,
73:       "supports_streaming": true,
74:       "supports_vision": true,
75:       "supports_tools": true
76:     },
77:     {
78:       "slug": "gpt-4o-mini",
79:       "display_name": "GPT-4o Mini",
80:       "context_window": 128000,
81:       "max_output_tokens": 16384,
82:       "supports_streaming": true,
83:       "supports_vision": true,
84:       "supports_tools": true
85:     },
86:     {
87:       "slug": "o3",
88:       "display_name": "o3",
89:       "context_window": 200000,
90:       "max_output_tokens": 100000,
91:       "supports_streaming": true,
92:       "supports_vision": true,
93:       "supports_thinking": true,
94:       "supports_tools": true
95:     },
96:     {
97:       "slug": "o4-mini",
98:       "display_name": "o4-mini",
99:       "context_window": 200000,
100:       "max_output_tokens": 100000,
101:       "supports_streaming": true,
102:       "supports_vision": true,
103:       "supports_thinking": true,
104:       "supports_tools": true
105:     }
106:   ],
107:   "capabilities_config": [
108:     {
109:       "global_capability_id": "send_message",
110:       "recovery_strategies": [{ "type": "retry_selector" }, { "type": "navigate_home" }],
111:       "ui_component_override": "text_input",
112:       "ui_label_override": "Send to ChatGPT",
113:       "ui_icon_override": "arrow-up-circle",
114:       "ui_position_override": "composer",
115:       "ui_priority_override": "primary"
116:     },
117:     {
118:       "global_capability_id": "select_model",
119:       "ui_component_override": "dropdown_selector",
120:       "ui_label_override": "Select GPT Model",
121:       "ui_icon_override": "cpu",
122:       "ui_position_override": "header",
123:       "ui_priority_override": "primary"
124:     }
125:   ],
126:   "config": [
127:     { "key": "base_url", "value": "https://chatgpt.com" },
128:     { "key": "auth_type", "value": "email" }
129:   ]
130: }

(End of file - total 130 lines)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\specs\\006-provider-account-dashboard\\spec.md",
  "limit": 50
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\specs\006-provider-account-dashboard\spec.md</path>
<type>file</type>
<content>
1: # Feature Specification: Provider Account Dashboard
2: 
3: **Feature Branch**: `006-provider-account-dashboard`
4: **Created**: 2025-07-17 | **Status**: Draft
5: **Input**: User description: "Build a provider account management dashboard that shows all configured provider accounts with real-time status. For each account, display: provider name/icon, login state (authenticated / expired / never-logged-in), last login timestamp, Chrome debug port, session health, and quick actions (launch/reconnect Chrome, verify session, remove account). Replace the current read-only provider list with an interactive dashboard that updates in real time via WebSocket events (account:login_state, account:created, account:removed). Add a one-click "Add Account" button that kicks off the ChromeSetupWizard flow. When a session expires (detected via CDP cookie check), show a warning badge and a "Re-login" button. The backend data already exists in the providerAccount table — this spec builds the frontend dashboard and wires it to live events."
6: 
7: ## User Scenarios & Testing
8: 
9: ### User Story 1 — View All Provider Accounts with Live Status (Priority: P1)
10: 
11: User opens the provider account dashboard and sees every configured provider account as an interactive card showing provider name and icon, login state, last login timestamp, Chrome debug port, session health, and quick action buttons. The view replaces the previous read-only provider list.
12: 
13: **Why this priority**: This is the core surface — without it there is no dashboard. Every other story depends on accounts being visible and interactive.
14: 
15: **Independent Test**: Open the dashboard page with at least one seeded providerAccount row → every account renders with its name, icon, login-state badge, last-login time, debug port, session-health indicator, and action buttons. Delivers immediate value as a read-and-act status board even before any live events fire.
16: 
17: **Acceptance Scenarios**:
18: 
19: 1. **Given** multiple provider accounts exist in the providerAccount table, **When** the dashboard loads, **Then** each account card displays: provider name, provider icon, login state (authenticated / expired / never-logged-in), last login timestamp, Chrome debug port, and session health.
20: 2. **Given** an account has never been logged in, **When** the dashboard renders it, **Then** its login state shows "Never logged in" (distinct neutral badge) rather than an error.
21: 3. **Given** the dashboard is open, **When** the `account:login_state` WebSocket event arrives for an account, **Then** that card's login state and session-health indicators update in place without a page reload.
22: 4. **Given** the `account:created` WebSocket event arrives, **When** a new account is added (e.g. via the setup wizard), **Then** a new card appears in the dashboard with no page refresh.
23: 5. **Given** the `account:removed` WebSocket event arrives, **When** an account is deleted, **Then** that card disappears from the dashboard without a page refresh.
24: 
25: ---
26: 
27: ### User Story 2 — Re-login to an Expired Session (Priority: P1)
28: 
29: When a provider session expires (detected by a CDP cookie check showing expired cookies), the account card shows a warning badge and the user can re-login without reconfiguring the account.
30: 
31: **Why this priority**: Expired sessions are the primary pain point the dashboard must solve — surfacing expiry and offering one-click recovery keeps accounts usable.
32: 
33: **Independent Test**: Force an account into the "expired" login state → the card shows a warning badge and a "Re-login" button; clicking it launches the ChromeSetupWizard against the existing account profile and, on success, returns the card to "Authenticated". This story is independently testable from the add/remove flows.
34: 
35: **Acceptance Scenarios**:
36: 
37: 1. **Given** an account's session is detected as expired via CDP cookie check, **When** the dashboard reflects the `account:login_state` event, **Then** the card shows a warning badge (e.g. amber "Session Expired") and a "Re-login" button replaces/extends the normal actions.
38: 2. **Given** the card shows the warning badge, **When** the user clicks "Re-login", **Then** the ChromeSetupWizard launches Chrome to the provider login page using the account's existing profile.
39: 3. **Given** re-login completes and the session is verified, **When** the next `account:login_state` event arrives, **Then** the warning badge clears and the login state returns to "Authenticated" with an updated last-login timestamp.
40: 
41: ---
42: 
43: ### User Story 3 — Launch / Reconnect Chrome and Verify Session (Priority: P2)
44: 
45: User can launch or reconnect Chrome for an account and explicitly verify the current session health from the dashboard.
46: 
47: **Why this priority**: These are the day-to-day recovery actions that keep accounts healthy; important but secondary to visibility and re-login.
48: 
49: **Independent Test**: With an account whose Chrome is stopped, click "Launch/Reconnect Chrome" → Chrome starts and the debug port populates on the card. Separately click "Verify Session" on an authenticated account → session-health indicator refreshes to reflect the live check.
50: 

(Showing lines 1-50 of 136. Use offset=51 to continue.)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\.specify\\feature.json"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\.specify\feature.json</path>
<type>file</type>
<content>
1: {
2:   "feature_directory": "specs/006-provider-account-dashboard"
3: }

(End of file - total 3 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 7.7s)

_Thinking:_

Now I have a comprehensive picture of the entire system. Let me also check the discover-protocol command implementation and the devops/index.ts to understand how CLI commands are wired.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\devops"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\devops</path>
<type>directory</type>
<entries>
.gate-baseline.json
agentic/
audit-arch/
audit-code/
audit.ts
baseline.ts
changed.ts
context.ts
decision-review.ts
decision.ts
deps.ts
fmt.ts
gate.ts
gc.ts
goals-align.ts
goals-progress.ts
goals.ts
index.ts
invariants.ts
loop.ts
mark.ts
report.ts
research-bridge.ts
roadmap.ts
roadmap/
runtime-test/
select.ts
speckit-audit.ts
speckit-bridge.ts
speckit-converge-bridge.ts
tracker-speckit-sync.ts
tracker.ts
truth/
unified-gate.ts

(34 entries)
</entries>
```

**Tool: grep**

**Input:**
```json
{
  "pattern": "discover-protocol|discoverProtocol",
  "include": "*.ts"
}
```

**Output:**
```
Found 4 matches
C:\0-BlackBoxProject-0\vivim-final\devops\index.ts:
  Line 1091:     case 'discover-protocol': {

  Line 1095:         console.error('usage: bun run devops discover-protocol <url> [--hint=name]')


C:\0-BlackBoxProject-0\vivim-final\devops\agentic\context-probe.ts:
  Line 5: // Called automatically by `agentic start` / `agentic resume` / `discover-protocol`.

  Line 235:     suggestedAction = `Provider ${readyProviders[0]} is ready. Run: devops discover-protocol <url>`

```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 6.9s)

_Thinking:_

Let me read the discover-protocol command in devops/index.ts to understand the provider protocol discovery.

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\devops\\index.ts",
  "offset": 1080,
  "limit": 60
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\devops\index.ts</path>
<type>file</type>
<content>
1080:     case 'verify-cross-surface': {
1081:       // Unit 19.4 gate: every capability resolves across CLI/API/MCP/UI.
1082:       // Forwards args: [--live] [--base=<url>]
1083:       const proc = Bun.spawn(['bun', 'run', 'scripts/verify-cross-surface.ts', ...args], {
1084:         stdout: 'inherit',
1085:         stderr: 'inherit',
1086:       })
1087:       await proc.exited
1088:       process.exit(proc.exitCode === 0 ? 0 : 1)
1089:       break
1090:     }
1091:     case 'discover-protocol': {
1092:       const url = args[0]
1093:       const hint = args.find((a: string) => a.startsWith('--hint='))?.split('=')[1]
1094:       if (!url) {
1095:         console.error('usage: bun run devops discover-protocol <url> [--hint=name]')
1096:         process.exit(1)
1097:       }
1098:       // Use context probe to find the right Chrome profile automatically
1099:       const { generatePreflightContext } = await import('./agentic/context-probe.js')
1100:       const ctx = await generatePreflightContext()
1101:       console.error(`Context: ${ctx.readyProviders.length} ready providers, ${ctx.liveChrome.length} live Chrome instances`)
1102: 
1103:       // Pick the best Chrome instance: prefer one with a matching provider hint, then any ready provider
1104:       let targetChrome = ctx.liveChrome[0]
1105:       if (hint) {
1106:         targetChrome = ctx.liveChrome.find((c) =>
1107:           (c.userDataDir ?? '').toLowerCase().includes(hint.toLowerCase()) ||
1108:           (c.title ?? '').toLowerCase().includes(hint.toLowerCase()) ||
1109:           (c.url ?? '').toLowerCase().includes(hint.toLowerCase()),
1110:         ) ?? ctx.liveChrome[0]
1111:       }
1112:       if (!targetChrome?.webSocketDebuggerUrl) {
1113:         console.error('No live Chrome instance found. Start Chrome with --remote-debugging-port or run a provider setup first.')
1114:         console.error(`Available providers: ${ctx.readyProviders.join(', ') || 'none'}`)
1115:         console.error(`Gaps: ${ctx.gaps.join('; ') || 'none'}`)
1116:         process.exit(1)
1117:       }
1118: 
1119:       console.error(`Using Chrome on :${targetChrome.debugPort} (${targetChrome.browser}) — ${targetChrome.title ?? 'no page title'}`)
1120: 
1121:       const { BunCdpClient } = await import('../src/executor/cdp.js')
1122:       const client = new BunCdpClient(targetChrome.webSocketDebuggerUrl, { timeoutMs: 30_000, maxRetries: 3 })
1123:       await client.connect()
1124:       const targets = await client.send('Target.getTargets') as { targetInfos?: Array<{ targetId: string; type: string }> }
1125:       let page = targets.targetInfos?.find((t) => t.type === 'page')
1126:       if (!page) {
1127:         const c = await client.send('Target.createTarget', { url: 'about:blank' }) as { targetId: string }
1128:         page = { targetId: c.targetId, type: 'page' }
1129:       }
1130:       const attached = await client.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }) as { sessionId: string }
1131: 
1132:       const { ProtocolDiscoveryEngine } = await import('../src/engines/protocol-discovery.js')
1133:       const engine = new ProtocolDiscoveryEngine(client, attached.sessionId)
1134:       const result = await engine.discover(url, { providerNameHint: hint })
1135: 
1136:       console.log(JSON.stringify({
1137:         url: result.url, title: result.title, providerNameHint: result.providerNameHint,
1138:         detectedFramework: result.detectedFramework,
1139:         primaryComposer: result.primaryComposer ? { selector: result.primaryComposer.selector, type: result.primaryComposer.composerType, confidence: result.primaryComposer.confidence, evidence: result.primaryComposer.evidence } : null,

(Showing lines 1080-1139 of 1452. Use offset=1140 to continue.)
</content>
```

**Tool: read**

**Input:**
```json
{
  "filePath": "C:\\0-BlackBoxProject-0\\vivim-final\\docs\\integration\\DECISION-TABLE.md"
}
```

**Output:**
```
<path>C:\0-BlackBoxProject-0\vivim-final\docs\integration\DECISION-TABLE.md</path>
<type>file</type>
<content>
1: # Decision Table: SpecKit vs DevOps
2: 
3: Use this table to decide which system (or both) to drive a given scenario.
4: 
5: | Scenario | Use SpecKit | Use DevOps | Use Both | Why |
6: |----------|------------|------------|----------|-----|
7: | New feature with requirements | `specify` → `plan` → `tasks` | — | implement via devops loop | SpecKit defines **what**; DevOps builds it |
8: | Bug fix | — | goal mode (`devops runtime-test loop`) | — | No spec needed; fix directly |
9: | Atomic unit from tracker | — | tracker mode (`devops select`/`mark`) | — | Already defined in tracker |
10: | Architecture change | `plan` (constitution check) | `audit-arch` | `converge` + `audit` | Plan for design; audit for validation |
11: | Research needed | `clarify` Phase 0 | `devops-research` | bridge brief | DevOps has deeper research; bridge converts formats |
12: | Full release | `tasks` → `implement` → `converge` | `audit-code full` | unified gate | Both systems validate |
13: | Taxonomy expansion | — | `devops-generators` | — | DevOps-only domain |
14: | Frontend UI | `plan` contracts | `vivi-frontend` | — | Plan defines contracts; frontend builds them |
15: | Schema change | `data-model.md` | `prisma-workflow` | — | SpecKit defines model; Prisma implements |
16: | New capability | `plan` → `tasks` | devops loop | `speckit sync` | SpecKit plans; DevOps builds; sync tracks |
17: | Tracking progress across both | — | `devops speckit sync` | — | Bidirectional task↔unit linkage |
18: | Quality gate before commit | — | `devops speckit gate` | — | Unified gate wraps typecheck/lint/test + SpecKit checklists |
19: | Convergence check vs spec | `converge` | `devops speckit converge` | — | Both run spec/code/arch analysis; DevOps appends tasks |
20: | Skill readiness audit | — | `devops speckit audit` | — | Audits 12 skills for SpecKit-awareness |
21: 
22: ## How to Read
23: 
24: - **SpecKit only** — pure spec/plan/task authoring, no code execution.
25: - **DevOps only** — autonomous build/audit loops driven by the tracker or a goal.
26: - **Both** — SpecKit defines the artifact, DevOps executes and tracks it through the bridge.
27: 
28: ## Related Docs
29: 
30: - [UNIFIED-WORKFLOW.md](./UNIFIED-WORKFLOW.md) — the full 6-step canonical workflow.
31: - `devops/speckit-bridge.ts` — task↔unit ID mapping.
32: - `devops/unified-gate.ts` — unified quality gate.
33: - `devops/speckit-converge-bridge.ts` — consolidated converge pipeline.

(End of file - total 33 lines)
</content>
```

---

## Assistant (Plan · DeepSeek V4 Flash Free · 70.7s)

_Thinking:_

Now I have a very comprehensive picture. Let me compile my analysis. I'll structure it as a detailed audit report covering:

1. Conceptual Audit - how well the two systems integrate conceptually
2. Development Lifecycle Audit - mapped to real-world scenarios
3. Gap Analysis - what's missing or could be improved
4. Focused Review: Provider Onboarding Lifecycle - the full lifecycle of onboarding a new webapp provider

Let me organize my thoughts:

## Conceptual Audit

### SpecKit (spec-driven development)
- **Governance layer** — constitution, spec, plan, tasks, checklists
- **Strict phase gates** — each command gated on prerequisite artifacts
- **Append-only converge** — never rewrites, only appends gaps as tasks
- **No code execution** — pure artifact generation (spec/plan/tasks/checklists)
- **Templates pre-tuned** for vivim-final architecture

### DevOps (autonomous agentic orchestrator)
- **Two modes**: tracker-driven (atomic units) and goal-driven (full-stack build)
- **Full-stack loop**: backend engine → API route → DB → React UI → verify
- **Rich CLI harness**: 30+ subcommands for discovery, build, test, debug, verify
- **Provider protocol discovery**: `discover-protocol` auto-detects composer selectors, send methods, capture patterns via live Chrome CDP
- **Runtime environment**: server lifecycle, health checks, Chrome integration, CDP

### Bridge Layer (6 modules)
- `speckit-bridge.ts` — task↔unit ID mapping, sync, validation
- `unified-gate.ts` — quality gates across both systems
- `research-bridge.ts` — brief↔research.md format conversion
- `tracker-speckit-sync.ts` — bidirectional state sync
- `speckit-converge-bridge.ts` — consolidated converge pipeline
- `speckit-audit.ts` — skill readiness audit

### How they complement each other:
- SpecKit produces **what** (spec/plan/tasks); DevOps builds **how** (code/verify)
- SpecKit is **constitution-driven design**; DevOps is **evidence-backed execution**
- Bridge layer links them without modifying SpecKit files

### Gaps I see:
1. **The bridge modules exist but are not fully wired into the actual CLI workflow** — the `devops speckit` commands exist but aren't part of the standard devops-fullstack loop
2. **No unified "provider onboarding" spec path** — the decision table doesn't cover the end-to-end lifecycle of adding a new provider
3. **No bridge for `discover-protocol` output → SpecKit spec** — the protocol discovery tool generates a manifest draft, but there's no path to integrate that into a SpecKit spec/plan for implementing a new provider
4. **The tracker (267/267 done) and SpecKit tasks are separate worlds** — the bridge sync exists but it's unclear if it's actively used
5. **The `speckit-audit` module audits skills for SpecKit readiness but the skills themselves don't reference the bridge layer** — the audit finds gaps, but the gaps aren't being fixed
6. **No "converge loop" in the devops goal mode** — the devops loop doesn't call `converge` as a standard step
7. **Testing protocol (discovery → testing → streaming parser) isn't formalized** — there's a `discover-protocol` command and parser engine, but no spec-driven workflow for: discover → test → verify → seed

## Focus: Provider Onboarding Lifecycle

This is the MAJOR development cycle you want to automate. Here's the current state:

### Current flow:
1. Hand-write `seeds/providers/<slug>.json` with endpoints, selectors, parsers, models
2. Run `bun run db:seed`
3. Test manually via `bun run devops runtime-test test --nl="..."` or `engage`
4. Iterate on selectors/parsers
5. Eventually register capabilities

### What's possible with SpecKit + DevOps combined:
1. **Specify** — `/speckit.specify "Add support for <provider>"` → spec.md with user stories for: composer discovery, send protocol, stream parsing, model selection, auth flow
2. **Plan** — `/speckit.plan` → plan.md with data model for the provider manifest, research phase for protocol analysis
3. **Research** — DevOps `discover-protocol` feeds into SpecKit `research.md` via research-bridge
4. **Tasks** — `/speckit.tasks` → tasks.md with T### tasks for each phase of provider onboarding
5. **Implement** — DevOps loop executes tasks, with `protocol-discovery-engine` generating manifest drafts
6. **Test** — Automated selector testing via `bun run devops runtime-test selectors`, stream parsing tests
7. **Converge** — Verify the provider works end-to-end, append convergence tasks for gaps

### What's MISSING for this to work:
1. **No "research → protocol manifest → spec" pipeline** — the protocol discovery engine exists but there's no bridge to convert its output into SpecKit research.md or spec.md content
2. **No "provider onboarding" spec template** — no SpecKit template for creating a new provider spec
3. **No streaming parser discovery/inference** — the protocol discovery detects composer/send but doesn't detect or infer streaming response format (SSE vs WebSocket vs polling, response schema)
4. **No automated parser test harness** — after inferring a parser, there's no automated way to test it against live provider traffic
5. **No "parser confidence" gate** — the parser engine has `getConfidence()` but there's no gate that blocks deployment of low-confidence parsers
6. **No bridge between `discover-protocol` output and the seed JSON manifest schema** — the protocol discovery engine's `manifestDraft` doesn't map to the provider seed JSON format
7. **No "provider onboarding" decision in the decision table** — it's not listed as a scenario
8. **No automated auth flow testing** — the ChromeSetupWizard handles login but there's no spec-driven verification that auth works end-to-end
9. **No "capability auto-registration" from protocol discovery** — after discovering what a provider can do (send, upload, select model, etc.), capabilities should be auto-generated
10. **No "stream parser inference" engine** — need to infer the streaming protocol from network capture during protocol discovery

Let me write this up as a comprehensive audit and analysis.

# SpecKit + DevOps Integration Audit & Provider Onboarding Analysis

I've read both systems extensively (SpecKit, DevOps bridge modules, devops-fullstack, constitution, 12 provider seeds, existing specs, all 6 bridge modules). Here's the full analysis.

---

## 1. Conceptual Audit

### Current Layering

```
┌─────────────────────────────────────────────────────┐
│                    SpecKit (SDD)                      │
│  constitution → specify → clarify → plan → tasks     │
│  → implement → converge → taskstoissues               │
│  (what/why, artifact-chained, governance)              │
├─────────────────────────────────────────────────────┤
│                   Bridge Layer (6 modules)             │
│  speckit-bridge | unified-gate | research-bridge      │
│  tracker-speckit-sync | speckit-converge-bridge       │
│  speckit-audit                                        │
├─────────────────────────────────────────────────────┤
│               DevOps / devops-fullstack                │
│  tracker-mode | goal-mode | protocol-discovery        │
│  runtime-test CLI (30+ subcommands)                    │
│  CDP integration | ChromeGovernor | build/verify       │
└─────────────────────────────────────────────────────┘
```

**What works well:**
- **Clean separation**: SpecKit owns artifact discipline; DevOps owns execution. Bridge never modifies SpecKit files — good design decision.
- **Phase gating**: SpecKit prereq scripts prevent out-of-order execution; DevOps has goal-resolution gate.
- **Research bridge**: bidirectional brief↔research.md conversion is a solid pattern.
- **Unified gate**: combines typecheck/lint/test/invariants/audit-code/cross-surface in one command.

**What's fragile:**
- **The bridge modules exist but are NOT wired into the active workflow loops.** `devops-fullstack/SKILL.md` mentions bridge commands in a reference section, but the actual devops loop (`runtime-test loop` → `orchestration.ts`) doesn't call `speckit gate`, `speckit sync`, or `speckit converge` at any step. The bridge is documented but not executed.
- **Speckit-audit finds gaps but doesn't fix them.** The audit detects missing SpecKit references in skills, but there's no remediation workflow.
- **Decision table is descriptive, not prescriptive.** It says what to use when, but the agent isn't gated on it — nothing enforces "for a new feature, run `/speckit.specify` first."

---

## 2. Development Lifecycle Audit

Mapping the canonical lifecycle against real-world scenarios:

### Scenario A: Bug Fix
```
Current: DevOps goal-mode (works well)
Missing: No spec introspection — fix might violate spec without knowing it
Improvement: `converge --scope=diff` should be auto-triggered after any fix
```

### Scenario B: New Capability
```
Current: SpecKit plan→tasks → DevOps implement (works conceptually)
Missing: 
  - No "does a spec exist?" pre-check in the devops loop
  - No auto-sync of completed tasks back to tracker
  - `implement` marks tasks [X] but converge isn't auto-run
```

### Scenario C: Schema Change
```
Current: SpecKit data-model.md → DevOps prisma-workflow works
Missing:
  - No bidirectional sync between data-model.md and prisma/schema.prisma
  - Schema changes don't trigger spec update
```

### Scenario D: Provider Onboarding (YOUR BIG CYCLE)
```
This is the gap. See section 4.
```

### Scenario E: Full Release
```
Current: SpecKit tasks→implement→converge + DevOps audit-code full
Missing: 
  - No pre-release "feature complete" gate that checks all tasks are done
  - No "convergence loop" — converge runs once but should run until clean
```

---

## 3. Gap Analysis

### P0 Gaps (Blocking)

| Gap | Location | Impact |
|-----|----------|--------|
| **Bridge modules not wired into active loops** | `devops/runtime-test/orchestration.ts` doesn't call any bridge command | Bridge exists on paper only |
| **No decision-table enforcement** | Agent can start building without checking DECISION-TABLE.md | Feature may use wrong system |
| **No "provider onboarding" scenario** | DECISION-TABLE.md has no row for adding a provider | This whole workflow is undefined |

### P1 Gaps (Major)

| Gap | Location | Impact |
|-----|----------|--------|
| **No auto-converge after implementation** | DevOps loop finishes without running converge | Code may diverge from spec silently |
| **No sync after task completion** | `speckit sync` not called after `implement` | Tracker and tasks.md get out of sync |
| **No unified gate in standard loop** | `runtime-test` loop uses its own gates, not `speckit gate` | Two separate quality standards |
| **No provider onboarding spec template** | In `.specify/templates/` | Every provider requires hand-crafted spec |
| **No parser inference during protocol discovery** | `discover-protocol` detects composer/send but not streaming format | Parser must be hand-coded per provider |

### P2 Gaps (Important)

| Gap | Location | Impact |
|-----|----------|--------|
| **No bridge for `discover-protocol` → seed JSON** | Protocol engine produces `manifestDraft` that doesn't map to seed format | Manual translation |
| **No "parser confidence" quality gate** | Parser engine has `getConfidence()` but no threshold gate | Low-confidence parsers ship silently |
| **No automated parser test harness** | No way to test a parser against live traffic | Manual testing |
| **No auth-flow spec validation** | ChromeSetupWizard runs but there's no spec confirming login detected | Auth silently fails |

### P3 Gaps (Enhancement)

| Gap | Location | Impact |
|-----|----------|--------|
| **Skills don't reference bridge layer** | 6/12 skills lack SpecKit Integration section | Agent doesn't use bridge |
| **No `data-model.md` ↔ `schema.prisma` sync** | No bidirectional sync | Schema drifts from spec |
| **No "spec-first" preflight gate** | No check "does a spec exist?" before building | Agent may skip spec |

---

## 4. Focused Review: Full Provider Onboarding Lifecycle

This is where the combined SpecKit + DevOps system can deliver the most value. The goal: **fully automated LLM-driven onboarding of a new webapp provider** (e.g., adding support for Grok, Perplexity, Copilot, etc.).

### Current Manual Flow

```
1. Research provider's webapp (URL, auth, composer, streaming)
2. Hand-write seeds/providers/<slug>.json with:
   - Endpoints (landing/chat/login URLs + selectors)
   - Parsers (streaming SSE parsing JavaScript)
   - Models (name, context window, capabilities)
   - Capabilities config (UI overrides, positions)
   - Fleet config (port range, Chrome args)
3. Run `bun run db:seed`
4. Manual Chrome login via setup wizard
5. Test manually via engage/debug
6. Iterate on selectors and parser until it works
7. Register capabilities if new ones needed
```

### Target Automated Flow (SpecKit + DevOps combined)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 0: RESEARCH & DISCOVERY                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. /speckit.specify "Add support for <provider>"                    │
│     → spec.md with US1: Composer discovery                           │
│                    US2: Message send/stream                          │
│                    US3: Model selection                               │
│                    US4: Auth flow                                     │
│     → checklists/requirements.md                                     │
│                                                                      │
│  2. /speckit.plan → Phase 0: research.md                             │
│     ↓                                                                 │
│  3. DevOps: bun run devops discover-protocol <url> --hint=<name>     │
│     → ProtocolDiscoveryEngine output:                                │
│       - Composer selector + type (textarea/contenteditable)           │
│       - Send button / keyboard shortcut                              │
│       - Detected framework (ProseMirror/Quill/React)                  │
│       - Network capture patterns for streaming endpoint               │
│       - Response format inference (SSE/WebSocket/polling)             │
│     ↓ (via research-bridge)                                           │
│  4. research.md updated with protocol discovery findings              │
│                                                                      │
│  🔴 GAP: No streaming parser inference exists.                       │
│  🔴 GAP: No auth flow discovery (login URL, OAuth pattern detection). │
│  🔴 GAP: No model list extraction from provider's own UI/API.        │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    PHASE 1: PROTOCOL TESTING                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  5. DevOps: Automated selector validation                            │
│     → bun run devops runtime-test selectors --provider=<slug>         │
│     → Opens Chrome, navigates, validates each selector resolves       │
│     → Captures confidence scores for each selector                    │
│                                                                      │
│  6. DevOps: Automated composer test                                   │
│     → Type text, verify it appears in the composer                    │
│     → Test send (click + keyboard), verify message appears            │
│     → Capture network request for the send                            │
│                                                                      │
│  🔴 GAP: No "composer round-trip" test exists.                       │
│  🔴 GAP: No "selector confidence" gate (min selector == 0.8 required).│
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    PHASE 2: STREAMING PARSER INFERENCE & TEST          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  7. NEW: StreamingResponseAnalyzer engine                            │
│     → Captures live response from provider's streaming endpoint       │
│     → Infers: SSE format, event names, delta structure               │
│     → Generates parser JavaScript (like chatgpt/001_openai_sse)      │
│     → Tests parser against captured traffic                           │
│                                                                      │
│  8. NEW: ParserTestHarness                                           │
│     → Given raw response body + expected structure                    │
│     → Tests parse(), detectCompletion(), getConfidence()              │
│     → Reports pass/fail + edge cases                                  │
│                                                                      │
│  🔴 GAP: Neither StreamingResponseAnalyzer nor ParserTestHarness     │
│         exists. Both need to be built.                                │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    PHASE 3: MANIFEST GENERATION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  9. NEW: ProviderManifestGenerator bridge                             │
│     → Takes protocol discovery output + parser test results            │
│     → Generates seeds/providers/<slug>.json skeleton                  │
│     → Includes: endpoints, selectors, parsers, models stub            │
│     → Output is "spec-complete" — all fields populated or marked TODO │
│                                                                      │
│  10. Developer review + edit the JSON manifest                        │
│      (minimal touch — only models and exotic capabilities)            │
│                                                                      │
│  🔴 GAP: ProviderManifestGenerator doesn't exist.                    │
│  🔴 GAP: discover-protocol output format doesn't map to seed JSON.    │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    PHASE 4: SEEDING & REGISTRATION                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  11. bun run db:seed — loads new provider                            │
│      → bunx prisma db seed (or direct seed insert)                    │
│      → Verify provider appears: GET /api/providers                    │
│                                                                      │
│  12. Auto-register provider-specific capabilities                    │
│      → Protocol discovery detected: send_message, select_model       │
│      → Generate capability overrides in capabilities_config           │
│                                                                      │
│  13. Add NL patterns to catalog.ts for the new provider              │
│      → "send to <provider>" → cap:chat:send_message                  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    PHASE 5: VERIFICATION & CONVERGE                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  14. DevOps: Full-stack provider test                                 │
│      → Launch Chrome, navigate, login, send message                   │
│      → Capture streaming response, parse, verify blocks               │
│      → Test all registered capabilities                              │
│                                                                      │
│  15. bun run devops speckit converge <featureDir>                     │
│      → Spec gap analysis: do all FR-### have tasks?                   │
│      → Code audit: do all tasks have implementations?                 │
│      → Arch audit: do invariants hold?                               │
│      → If gaps found: new tasks appended to tasks.md                 │
│                                                                      │
│  16. bun run devops speckit gate --scope=feature                      │
│      → typecheck + lint + tests + invariants + audit + cross-surface  │
│      → All checks must pass                                           │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                    PHASE 6: TAXONOMY UPDATE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  17. bun run devops verify-cross-surface                              │
│      → New provider's capabilities resolve across CLI/API/MCP/UI     │
│      → UI slot mapping for any new canvas layers                     │
│                                                                      │
│  18. /speckit.taskstoissues (optional)                               │
│      → Remaining convergence tasks → GitHub issues                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### What Must Be Built

| # | Component | Type | Effort | Priority |
|---|-----------|------|--------|----------|
| 1 | `StreamingResponseAnalyzer` engine | New engine | L | P0 |
| 2 | `ParserTestHarness` engine | New engine | L | P0 |
| 3 | `ProviderManifestGenerator` bridge | New bridge module | M | P0 |
| 4 | Wire bridge into `runtime-test orchestration.ts` | Edit | S | P0 |
| 5 | Auto-run `speckit sync` after task completion | Edit | S | P1 |
| 6 | Auto-run `speckit converge` after implement loop | Edit | S | P1 |
| 7 | Provider onboarding spec template | New template | S | P1 |
| 8 | Add provider onboarding to DECISION-TABLE.md | Edit | S | P1 |
| 9 | Composer round-trip test subcommand | Edit | M | P1 |
| 10 | Selector confidence gate | Edit | S | P1 |
| 11 | Auth flow discovery in ProtocolDiscoveryEngine | Edit | M | P2 |
| 12 | `discover-protocol` → seed JSON mapping | Bridge | M | P2 |
| 13 | Model list extraction from provider | Edit | M | P2 |
| 14 | `data-model.md` ↔ `schema.prisma` sync | Bridge | M | P3 |
| 15 | Spec-first preflight gate in devops loop | Edit | S | P3 |

### Architectural Decisions Required

1. **Where should `StreamingResponseAnalyzer` live?** — As a new `src/engines/streaming-response-analyzer.ts` engine (follows the engine pattern), or as a sub-engine of `ProtocolDiscoveryEngine`?

2. **Parser output format** — The current parser format is `logic_code: "var parse = function(rawBody) { ... }"`. Should we standardize on this format for generated parsers, or introduce a higher-level DSL that compiles to it?

3. **Manifest generation confidence threshold** — What's the minimum confidence required before auto-generating a provider manifest? 0.7? 0.8? What happens below threshold — manual review task appended to converge?

4. **When to run converge during the provider lifecycle** — After each phase, or only at the end? Running after each phase gives faster feedback but adds latency.

### Quickest Wins (can ship independently)

1. **Wire bridge into orchestration.ts** — 1 file change, makes the bridge actually live
2. **Add provider onboarding to DECISION-TABLE.md** — 1 line, guides agent behavior
3. **Provider onboarding spec template** — copy existing spec pattern, parameterize
4. **Auto-sync after task completion** — add `speckit sync` to the implement step

### Hardest Problems

1. **Streaming parser inference** — Requires generalizing across SSE, WebSocket, chunked polling, and domain-specific transport formats. Each provider has a unique schema.
2. **Parser correctness verification** — How do you verify a parsed stream is correct without human inspection of the source? This is an unsolved problem in the design.
3. **Auth flow discovery** — Providers use OAuth, SAML, email+password, SSO, magic links. CDP-based detection is fragile.

---

**Would you like me to dive deeper into any of these areas?** Specifically:
- The `StreamingResponseAnalyzer` engine design and how it would generalize across provider formats?
- How the provider onboarding spec template should be structured?
- The bridge module changes needed to wire the existing bridge into the active loop?
- How to handle the "parser correctness" verification problem?

---

