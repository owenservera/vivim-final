# vivim-final — DevOps & devops-roadmap System (Full Reference)

> **Scope:** A complete, self-contained description of the **`devops`** and **`devops-roadmap`**
> skills and the system behind them — skill specs, the CLI entry (`devops/index.ts`), every core
> module with real source snippets, the invariant checker (categories A–E), the truth-grounding
> subsystem, the research/roadmap subsystem, the ADR (decision) subsystem, and the goals (OKR)
> subsystem. Also documents how it wires into OpenCode CLI and the atomic tracker (single source
> of truth).

---

## 1. Overview

vivim-final is driven by an **agentic DevOps orchestrator** plus a **research-first roadmap
system**. Both live under two roofs:

- **Skills** (`.opencode/skill/devops/`, `.opencode/skill/devops-roadmap/`) — natural-language
  operating instructions for the OpenCode agent.
- **System** (`devops/`) — the deterministic TypeScript implementation the agent calls via
  `bun run devops <cmd>`.

The two halves are deliberately separated: **skills = creative orchestration**, **`devops/` =
deterministic mechanics**. State lives entirely in `docs/atomic/01-tracker.md` (single source of
truth) plus a few companion markdown files.

```
OpenCode agent (build / plan / test / review / db / debug)
   reads .opencode/skill/devops/SKILL.md        (the LOOP)
   reads .opencode/skill/devops-roadmap/SKILL.md (research-first)
            │  bun run devops <cmd>
            ▼
devops/  (Bun + TypeScript, stdlib + Bun only)
  index.ts ── command dispatcher
   ├─ select   (next implementable unit, JSON)
   ├─ mark     (state transition in tracker)
   ├─ gate     (typecheck+lint+test+invariants)
   ├─ report   (progress summary)
   ├─ audit    (append PROGRESS.md line w/ real sha)
   ├─ fmt / gc / truth / roadmap / invariants / decision / goals
  tracker.ts ── parse/serialize 01-tracker.md (authoritative)
  select.ts  ── phase+dependency gating, tooling-phase exemption
  mark.ts    ── write state back to tracker
  gate.ts    ── quality gate (strict/integration modes)
  invariants.ts ── A/B/C/D/E boundary enforcement
  deps.ts    ── extract **Depends:** from unit files (ranges supported)
  report.ts / audit.ts
  roadmap/   ── research engine (research/discover/interview/merge-gate/report)
  truth/     ── truth grounding (scanner/comparators/gap-generator)
  decision.ts / decision-review.ts ── ADR workflow
  goals.ts / goals-progress.ts / goals-align.ts ── OKR tracking
            │ reads/writes
            ▼
docs/atomic/01-tracker.md · PROGRESS.md · docs/roadmap/* · docs/decisions/* · docs/goals/GOALS.md
```

---

## 2. The `devops` Skill (`.opencode/skill/devops/SKILL.md`)

**Trigger:** "ralph loop", "devops", "continue", "keep going", "implement all".

**Invariants enforced by the agent:**
- **Strictly sequential** — one unit at a time, never parallelize.
- **Fully autonomous** — never ask "should I continue?"; stop only on completion or when only
  blocked units remain.
- **Gate before done** — a unit is `[x]` only after the gate is green.
- **Clean tree** — each passing unit is committed; a blocked unit's changes are reset.

**The LOOP** (verbatim mechanics):

```
LOOP:
  1. sel = `bun run devops select`        # next unit as JSON, or "null"
     - null + 0 pending      -> "DEVOPS COMPLETE. <done>/<total>"; STOP
     - null + blocked remain -> print report + BLOCKED list; STOP
  2. `bun run devops mark <id> in_progress`
  3. Read the unit's atomic file; follow Interface + Store Contract + Test Contract + Gate.
  4. Fidelity: at first unit of a phase, cross-check atomic files vs design docs; log DRIFT.
  5. Implement + write tests (delegate to db/test/review subagents when useful).
  6. `bun run devops gate`
     - PASS -> mark done; git commit; `bun run devops report`; goto LOOP
     - FAIL -> fix, retry (max 3)
     - >3   -> mark blocked; append reason to PROGRESS.md; `git checkout -- .`; goto LOOP
```

**Selection rules** (enforced in `select.ts`): (1) selectable only if `pending`/`in_progress`;
(2) its **phase is open** — phase N opens only when every smaller-indexed phase is `done` (SOTA
7–10 blocked until phase 6 complete); (3) every `**Depends:**` is `done`.

**Commands exposed:** `select`, `mark <id> <state>`, `gate`, `report`.

**Resume:** re-running always resumes at the first non-`done` selectable unit; tracker is
authoritative over file state.

**Audit trail:** every pass/block appended to `docs/atomic/PROGRESS.md`:
`[timestamp] <id> <name> -> <done|blocked> [sha] <gate summary>`.

---

## 3. The `devops-roadmap` Skill (`.opencode/skill/devops-roadmap/SKILL.md`)

**Trigger:** "devops roadmap", "research first", "audit before implementing", "what already
exists?", "gap analysis", "discover new units".

**Architecture:**

```
Truth System (scanner, comparators, gap-generator)
    ↓
devops-roadmap (research engine)
    ↓
Enriched Atomic Tracker  →  devops loop (implementation)
```

**When to load:** before the devops loop; at the first unit of a new phase; after completing a
unit (discover new gaps); when the user suggests a new feature.

**Workflow (7 phases):**
1. **Truth Scan** — `bun run devops truth full` → `docs/roadmap/TRUTH-GAPS.md`.
2. **Tracker State** — `bun run devops select` + read `01-tracker.md`.
3. **Per-Unit Research** — read atomic spec → read existing vivim-final code (source of truth)
   → compare → classify DONE/PORT/CREATE/FIX → identify gaps → estimate effort (S/M/L/XL).
4. **Gap Discovery** — gaps not mapping to an existing unit → candidates in `DISCOVERED-UNITS.md`.
5. **Interview Protocol** — AI presents candidate, asks questions, synthesizes atomic spec,
   user approves.
6. **Merge Gate** — enrichment auto-merge if < 24h old & no DRIFT; new-unit merge requires human
   approval; user wins conflicts.
7. **Report** — writes `RESEARCH-REPORT.md`, `DISCOVERED-UNITS.md`, `INTERVIEW-LOG.md`,
   `DOMAIN-HEALTH.md`.

**Unit Classification:**

| Class | Meaning | Action |
|---|---|---|
| DONE | Already fully implemented | Skip |
| PORT | Exists in vivim-final core, needs adaptation | Implement against vivim-final source |
| CREATE | Doesn't exist anywhere | Implement new |
| FIX | Exists but has stubs | Complete stub methods |

**Key invariants:** research before implementation; truth-grounded (from truth scanner, not
assumptions); interview before expansion; merge gate required; user wins conflicts.

---

## 4. CLI Surface — `devops/index.ts`

Single `switch (cmd)` dispatcher. Commands:

| Command | Purpose |
|---|---|
| `select` | Print next implementable unit as JSON (`null` if none) |
| `mark <id> <pending\|in_progress\|done\|blocked>` | Transition state |
| `gate [--strict] [--include-integration\|--full]` | Quality gate → JSON, exit non-zero on fail |
| `fmt` | Format (`biome check --write`) |
| `audit <id> "<summary>"` | Append audit line w/ real commit sha |
| `gc [--force]` | Garbage-collect stale state |
| `report` | Progress summary |
| `truth <scan\|compare\|interfaces\|full\|report>` | Truth grounding system |
| `roadmap [--unit\|--domain\|--discover\|--interview\|--merge\|--merge-unit]` | Research engine |
| `invariants <check\|report> [--unit <id>] [--category <A\|B\|C\|D\|E>]` | Boundary enforcement |
| `decision <create\|show\|compare\|list\|review\|prompt\|prompt-review\|decide\|approve\|reject\|analyze>` | ADR workflow |
| `goals <list\|show\|create\|update\|progress\|align\|score\|report\|dashboard>` | OKR tracking |

`gate` is the only command that sets the process exit code from its result
(`process.exit(gateResult.pass ? 0 : 1)`), so it can gate CI.

---

## 5. Core Modules (with source)

### 5.1 `tracker.ts` — the single source of truth

Deterministic parse/serialize of `docs/atomic/01-tracker.md`. It **only** rewrites state markers,
the header stats, and the "Last Updated" line — never section order, headings, or prose — so it
stays compatible with concurrent human edits.

```ts
export type UnitState = "pending" | "in_progress" | "done" | "blocked";

const MARKER: Record<UnitState, string> = {
  pending: " ", in_progress: "~", done: "x", blocked: "!",
};

// Accepts both em-dash ("2.1 — Name") and hyphen ("1.1 - Name"); optional `file` ref.
const UNIT_RE =
  /^(\s*)-\s+\[([ x~!])\]\s+(\d+\.\d+)\s+(?:—|-)\s+(.+?)(?:\s+→\s+`(.+?)`)?\s*$/;
const PHASE_RE = /^##\s+Phase\s+(\d+):\s+(.+)$/;
const HEADER_RE =
  /^\*\*Total units:\*\*\s*(\d+)\s*\|\s*\*\*Done:\*\*\s*(\d+)\s*\|\s*\*\*Blocked:\*\*\s*(\d+)\s*\|\s*\*\*Pending:\*\*\s*(\d+)/;

export function parseUnits(lines: string[]): Unit[] { /* ... */ }
export function computeStats(units: Unit[]): Stats { /* done/blocked/pending/total */ }
export function updateState(lines: string[], id: string, state: UnitState): string[] {
  const idx = lines.findIndex(l => UNIT_RE.exec(l)?.at(3) === id);
  if (idx === -1) throw new Error(`Unit ${id} not found in tracker`);
  const out = lines.slice();
  out[idx] = lines[idx]!.replace(/\[([ x~!])\]/, `[${MARKER[state]}]`);
  return out;
}
export function updateHeader(lines: string[], stats: Stats): string[] { /* rewrite header + Last Updated */ }
```

### 5.2 `select.ts` — phase + dependency gating

Picks the next unit. Key concept: **tooling phases** (`phase >= 90`, e.g. the Frontend Sandbox
gating harness in Phase 90) are cross-cutting — exempt from the sequential product-phase gate in
both directions.

```ts
export const TOOLING_PHASE_MIN = 90;

function phaseIsOpen(units: Unit[], target: number, done: Set<string>): boolean {
  if (target >= TOOLING_PHASE_MIN) return true;            // tooling phases always open
  for (const u of units) {
    if (u.phase >= TOOLING_PHASE_MIN) continue;            // never block product phases
    if (u.phase < target && u.state !== "done") return false;
  }
  return true;
}

export function selectFrom(units: Unit[], deps: Map<string,string[]>): Selection | null {
  const done = new Set(units.filter(u => u.state==="done").map(u=>u.id));
  const candidates = units.filter(u => {
    if (u.state !== "pending" && u.state !== "in_progress") return false;
    if (!phaseIsOpen(units, u.phase, done)) return false;
    const d = deps.get(u.id) ?? [];
    return d.every(dep => done.has(dep));                   // all deps done
  });
  if (candidates.length === 0) return null;
  candidates.sort((a,b) => {                                // in_progress first, then phase, then id
    const ar = a.state==="in_progress"?0:1, br = b.state==="in_progress"?0:1;
    if (ar!==br) return ar-br;
    if (a.phase!==b.phase) return a.phase-b.phase;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
  const chosen = candidates[0]!;
  return { id: chosen.id, name: chosen.name, phase: chosen.phase, phaseName: chosen.phaseName,
           file: chosen.file, deps: deps.get(chosen.id) ?? [], resume: chosen.state==="in_progress" };
}
```

### 5.3 `mark.ts` — write state back

```ts
export async function markUnit(id: string, state: UnitState): Promise<void> {
  const raw = await readFile(TRACKER, "utf8");
  const lines = raw.split("\n");
  const next = updateState(lines, id, state);
  const stats = computeStats(parseUnits(next));
  const final = updateHeader(next, stats);
  await writeFile(TRACKER, final.join("\n"), "utf8");
}
```

### 5.4 `deps.ts` — dependency extraction

Reads `**Depends:**` from each unit's atomic markdown file. Supports comma lists and ranges
(`3.1-3.4`, `10.8-10.10`) which expand to contiguous minor numbers in the same phase.

```ts
const DEPENDS_RE = /^\*\*Depends:\*\*\s*(.*?)\s*\|\s*\*\*Produces:/m;
const RANGE_RE = /(\d+)\.(\d+)\s*-\s*(\d+)\.(\d+)/g;

function expandUnitRef(token: string): string[] {
  const range = RANGE_RE.exec(token);
  if (range) { /* expand to `${major}.${m}` for m in [start,end] */ }
  const m = ID_RE.exec(token);
  return m ? [`${m[1]}.${m[2]}`] : [];
}
export async function loadDeps(atomicDir: string): Promise<Map<string,string[]>> { /* walk phase-* dirs */ }
```

### 5.5 `gate.ts` — the quality gate

Runs `typecheck`, `lint`, unit tests, then invariants. Supports `--strict` (fails on ANY new lint
diagnostic in the changed files) and `--include-integration` (runs `tests/integration`, conditional
on Chrome availability via `CHROME_PATH` / `SKIP_CHROME_INTEGRATION`).

```ts
export async function runGate(strict=false, includeIntegration=false): Promise<GateResult> {
  const steps: GateStep[] = [];
  steps.push(await run('bun', ['run','typecheck']));
  steps.push(await run('bun', ['run','lint']));
  steps.push(await run('bun', ['test','--test-dir=tests/unit']));
  const pass = steps.every(s => s.ok);

  let strictResult;
  if (strict) strictResult = { ok: newIssuesInChangedFiles().length === 0, newIssues };

  const invRaw = await checkInvariants();
  const invariantResult = { pass: invRaw.pass, blocks: invRaw.violations.length, warnings: invRaw.warnings.length };

  const ok = pass && !strictFailed && !invariantFailed && !integrationFailed;
  return { pass: ok, steps, summary, strict: strictResult, invariants: invariantResult, integration };
}
```

`newIssuesInChangedFiles()` uses `getChangedFiles()` (from `changed.ts`) and parses Biome's JSON
reporter, flagging only diagnostics that land on files the agent edited — so strict mode stops
warning debt from accumulating in the active unit without blocking pre-existing debt elsewhere.

### 5.6 `invariants.ts` — boundary enforcement (categories A–E)

This is the architectural backbone. Each `checkBx_*` function scans `src/engines/*.ts` for
forbidden patterns. The gate runs category B (and others) as a **hard block**.

| ID | Cat | Check | Severity |
|---|---|---|---|
| A1 | A | `RESEARCH-REPORT.md` exists | block |
| A2 | A | Unit has `classification:` in report | block |
| A3 | A | PORT unit has `vivimRef:`/`vivimLines:` | block |
| A4 | A | Truth score ≥ 80% | block |
| **B1** | B | **Governor Canon** — no engine imports `BunCdpClient` / `cdp` (except `chrome-governor.ts`) | block |
| **B2** | B | **Store contract isolation** — no engine imports `storage/impl` | block |
| B3 | B | Seeds not code — no hardcoded provider config | block |
| B5 | B | Config authority — engines use `ConfigManager`, not `process.env`/`readFile config` | block |
| B6 | B | Server-side harness — no `addScriptToEvaluateOnNewDocument` in `harness-runtime.ts` | block |
| B7 | B | No raw `new Error()` in engines (use custom error classes) | block |
| B8 | B | Agent-addressable UI — `web/ui/src/actions/registry.ts` + `agent-bridge.ts` + `agent:command`/`agent:discover` in `websocket.ts` | block |
| C1 | C | Phase gate — previous phase fully `done` | block |
| C2 | C | Dependency gate — all `**Depends:**` `done` | block |
| C3 | C | Atomic spec file exists for unit | block |
| C4 | C | Atomic spec references a Source/Design Doc | block |
| D1 | D | Each engine has a unit test | warning |
| D2 | D | No `any` type in engines | warning |
| D4 | D | Each engine class exported from `src/index.ts` | warning |
| E5 | E | Executor/sandbox units have integration tests | warning |

Representative scanner (category B):

```ts
async function checkB1_GovernorCanon(): Promise<Violation[]> {
  const matches = await scanDirForPattern(
    ENGINES_DIR,
    /BunCdpClient|from.*['"].*cdp['"]|import.*cdp/,
    'chrome-governor.ts',           // exclusion: the Governor itself may touch CDP
  );
  for (const m of matches)
    violations.push({ id:'B1', category:'B', severity:'block',
      message:`Engine imports CDP directly: ${m.match}`, file:m.file, line:m.line });
  return violations;
}

async function checkB2_StoreContractIsolation(): Promise<Violation[]> {
  const matches = await scanDirForPattern(ENGINES_DIR, /storage\/impl|from.*['"]\.\.\/storage\/impl/);
  // → B2 violation per match
}
```

`checkInvariants(unitId?, category?)` runs the selected categories, splits results into
`violations` (block) and `warnings`, and `pass = blockViolations.length === 0`.
`generateInvariantReport()` renders a markdown compliance report. This is what `bun run devops
invariants check` and the gate's final step call.

### 5.7 `report.ts` / `audit.ts`

`report()` prints `done: N/total | blocked | pending` plus a per-phase breakdown and the blocked
list. `audit()` appends one line to `docs/atomic/PROGRESS.md` using the **real** HEAD sha
(`git rev-parse --short HEAD`), avoiding a `[PENDING-COMMIT]` placeholder:

```ts
export function audit(id: string, summary: string): void {
  const commit = sha();                                  // git rev-parse --short HEAD
  const line = `[${ts}] ${id} ${name} -> done [${commit}] ${summary}\n`;
  // dedup by commit; append to docs/atomic/PROGRESS.md
}

---

## 6. Truth Subsystem (`./truth/`)

Run via `bun run devops truth <scan|compare|interfaces|full|report>`. CLI barrel: `truth/cli.ts`
exports `runTruthCommand` and thin wrappers (`truthScan`, `truthCompare`, `compareInterfaces`,
`compareFull`, `truthReport`).

| Command | Output | What it does |
|---|---|---|
| `scan` | `docs/roadmap/TRUTH-GAPS.md` | Crawl `src/`, `scripts/`, `tests/`, `docs/` for files with `// TODO`, `stub`, `not implemented`, `@placeholder`; bucket by area; compute a truth score per domain. |
| `compare` | design comparison | `design-comparator.ts` diffs `docs/` intent vs implemented signatures. |
| `interfaces` | interface comparison | `interface-comparator.ts` compares declared engine interfaces (Zod schemas / method signatures) against `src/engines/*`. |
| `full` | `docs/roadmap/TRUTH-FULL.md` | scan + compare + interfaces combined. |
| `report` | console + markdown | Summarises domain health (truth %). |

`gap-generator.ts` turns scan/comparison results into candidate atomic units (consumed by
`devops-roadmap`). The truth score feeds invariant **A4** (≥ 80% to implement a unit).

Architecture: `truth/scanner.ts` (filesystem walk + pattern buckets) → `truth/design-comparator.ts`
and `truth/interface-comparator.ts` (intent-vs-code) → `truth/gap-generator.ts` (candidate units) →
`truth/cli.ts` (barrel).

---

## 7. Roadmap Subsystem (`./roadmap/`)

Run via `bun run devops roadmap [flags]` → `roadmap.ts::runResearchCommand`. This is the
research-first engine described in skill `devops-roadmap`.

| Flag | Purpose |
|---|---|
| `--unit <id>` | Research a single unit (classification DONE/PORT/CREATE/FIX + effort). |
| `--domain <name>` | Research all units in a domain. |
| `--discover` | Gap-discovery pass → `docs/roadmap/DISCOVERED-UNITS.md`. |
| `--interview <GAP-id>` | Start the interview protocol for a discovered gap. |
| `--merge` | Merge enriched data into tracker (auto-merge if fresh, no DRIFT). |
| `--merge-unit <id>` | Merge a single new unit after interview approval. |

Outputs: `docs/roadmap/RESEARCH-REPORT.md` (per-unit research), `DISCOVERED-UNITS.md` (candidates),
`INTERVIEW-LOG.md`, `DOMAIN-HEALTH.md`.

The research engine reads the **existing vivim-final source** first (it is the source of truth for
PORT units), then classifies and estimates effort (S/M/L/XL). It never assumes a library is
available — it verifies against `package.json`.

---

## 8. ADR Subsystem (`decision.ts`, `decision-review.ts`)

Architecture decisions, multi-round review. Status flow: PROPOSED → IN_REVIEW → REVISED →
IN_REVIEW → DECIDED → APPROVED. Stored as markdown in `docs/decisions/ADR-NNN-title.md`.

Commands (`bun run devops decision <sub>`):

| Sub | Purpose |
|---|---|
| `create --title --author` | New ADR with ≥2 options. |
| `show <id>` | Print ADR detail. |
| `compare <id>` | Side-by-side options. |
| `list` | All ADRs. |
| `review <id> --reviewer --feedback` | Add a review round (≥2 required). |
| `prompt <id>` | Generated review questions. |
| `prompt-review <id>` | Generated decision-prompt. |
| `decide <id> --option A --rationale` | Select an option. |
| `approve <id>` / `reject <id>` | Final state. |
| `analyze <id>` | Score options, suggest best. |

Decisions embed `goalAlignment` (1–5) per option and `relatedGoals` so goals and ADRs cross-link.

---

## 9. Goals Subsystem (`goals.ts`, `goals-progress.ts`, `goals-align.ts`)

OKR hierarchy: Goal → Objective → Key Result, in `docs/goals/GOALS.md`. Progress flows bottom-up.

Commands (`bun run devops goals <sub>`):

| Sub | Purpose |
|---|---|
| `list` | Goals with completion %. |
| `show <G-id>` | Goal detail. |
| `create --title --description --owner --timeframe` | New goal. |
| `update <G-id> --status` | Set status. |
| `progress` | Recalculate from atomic tracker. |
| `align <G-id>` | Goal↔ADR alignment. |
| `score <ADR-id>` | Suggest alignment scores. |
| `report` | Full markdown progress report. |
| `dashboard` | Health dashboard + invariants. |

Current status (from `GOALS.md`): **G-001 Core Platform DONE 100%**, **G-002 SOTA DONE 100%**,
**G-003 Executor + Polish 20%**, **G-004 Frontend Sandbox 15%**.

---

## 10. State & Data Files

| File | Role | Writer |
|---|---|---|
| `docs/atomic/01-tracker.md` | **Single source of truth** for unit states (`[ ] [~] [x] [!]`), phase headers, stats. | `tracker.ts` (marker/header only) |
| `docs/atomic/PROGRESS.md` | Audit trail of passes/blocks w/ real sha. | `audit.ts` |
| `docs/atomic/master-plan.md` | Dependency graph (phase order). | human |
| `docs/roadmap/TRUTH-GAPS.md` | Truth scan output. | `truth scan` |
| `docs/roadmap/TRUTH-FULL.md` | Full truth comparison. | `truth full` |
| `docs/roadmap/RESEARCH-REPORT.md` | Per-unit research + classification. | `roadmap` |
| `docs/roadmap/DISCOVERED-UNITS.md` | Candidate new units. | `roadmap --discover` |
| `docs/roadmap/INTERVIEW-LOG.md` | Interview transcripts. | `roadmap --interview` |
| `docs/roadmap/DOMAIN-HEALTH.md` | Truth scores per domain. | `roadmap` |
| `docs/decisions/ADR-NNN-*.md` | Architecture decisions. | `decision` |
| `docs/goals/GOALS.md` | OKR tree. | `goals` |

**Wiring into OpenCode CLI:** the agent loads `.opencode/skill/devops/SKILL.md` and
`.opencode/skill/devops-roadmap/SKILL.md` as operating instructions; it then drives the deterministic
mechanics through `bun run devops <cmd>`. References (`docs/merged-design-v2`) feed the fidelity
cross-check. Hooks (Lefthook) + `/check` (quality gate) run the same `gate` logic outside the loop.
The baseline MCP surface (playwright/observer, web-reader, web-search-prime, zai, codex-status)
supports tests, research, and truth scanning but is **not** part of the deterministic `devops/`
core (Bun + stdlib only, per constraint).

**End of reference.**
```
