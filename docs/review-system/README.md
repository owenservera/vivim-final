# VIVIM Code Review System — Methodological, Re-Runnable, Exhaustive

A repeatable, senior-engineer code review methodology. It can be pointed at the
codebase at **any point in time** — mid-feature, post-migration, before release —
and produce a comprehensive, severity-ranked engineering report that is
**comparable to every previous run**.

**Designed for a human who forgets everything.** You never need to remember the
taxonomy, the depth tiers, the prompt files, or what a previous run did. You run
ONE command and the system tells you — and any agent you feed the brief to —
exactly what to do next.

Three companion pieces complete the system:

- **`CONSTITUTION.md`** — the living engineering constitution: health thresholds,
  architecture scorecard, security checklist, testing taxonomy, engineering
  principles. The review system **reads from it** at run time.
- **`scripts/`** — the deterministic generators (L0) + the self-driving driver.
- **`prompts/`** — the agentic review units (L1) that produce the actual reports.

## The blended architecture (three layers)

The review is **NOT** just scripts and **NOT** just prompts — it is both, wired
together so the deterministic layer *drives* the agentic one:

```
┌─ L0  DETERMINISTIC  scripts/        manifest + health metrics + delta
│     (numbers, reproducible,         → written to runs/<id>/00-manifest.json,
│      trend-able, zero judgment)      01-health.json, delta.md
│
├─ L1  AGENTIC        prompts/        A0…C2: the real senior-engineer review,
│     (judgment, evidence,            run by an agent against the source,
│      findings)                      one report file per unit
│
├─ L2  SYNTHESIS      C1/C2           merges L0 numbers + L1 findings into the
│     (the deliverable)               ledger, architecture scorecard, and the
│                                     human-facing executive summary
│
└─ DRIVER            scripts/run.ts   the ONLY entry point. Runs L0, derives
      (self-driving)                  progress, writes RUN-BRIEF.md (the single
                                      file you feed any agent), and tells the
                                      human exactly what to paste.
```

**The blend in one line:** `run.ts` (driver) runs the scripts (L0) and emits a
self-contained **`RUN-BRIEF.md`** that instructs the agent (L1) which units are
missing, in what order, under which evidence contract — then the agent executes
those units against the source and writes the reports. The human's job is reduced
to one command plus one paste.

## Why it doesn't rot

Traditional "review phases" pin the reviewer to a fixed itinerary. New code that
lands outside the itinerary is silently missed. This system is built on three
parts that defeat that:

1. **A fixed review taxonomy** — stable prompt IDs (`A0`…`C2`), stable severity
   rules, stable evidence format. Results from different weeks line up.
2. **A live discovery manifest** — regenerated at the start of *every* run. It
   snapshots inventory, entry points, dependencies, schema, routes, tests, and
   the git delta. Prompts are told *"do not assume this manifest is complete —
   re-verify against source."*
3. **A delta pass** — the manifest is diffed against the previous run. The
   "changed surface" list is injected into every prompt so reviewers focus on
   what's new **and** anything not in the manifest gets flagged by design.

## Taxonomy (Focus Areas)

```
DISCOVERY — adaptive, run every time
  A0  Intake, Baseline Manifest & Health Dashboard
      (inventory + git delta + deps + entry points + QUANTITATIVE health metrics)
  A1  Bootstrap & Runtime             (entry, config init, DI, lifecycle, shutdown)

CORE — stable, ordered
  B1  Architecture & Boundaries       (layering, coupling, invariants, modularity)
  B2  Data & Persistence              (schema, migrations, stores, txns, query perf)
  B3  API & Integration Surfaces      (routes, contracts, validation, externals)
  B4  Concurrency & Reliability       (async, races, retries, timeouts, failure modes)
  B5  Security & Secret Hygiene       (secrets, injection, authn/z, exposure, sandbox)
  B6  Frontend & UX                   (state, components, a11y, backend parity, perf)
  B7  Testing & Quality Gates         (coverage, effectiveness, CI, flakiness)
  B8  Observability & Operability     (logs, metrics, traces, alerting, runbooks)
  B9  Performance & Efficiency        (hot paths, N+1, caching, memory, bundle)

SYNTHESIS — the deliverable
  C1  Opportunity & Ecosystem Scan    (better architectures, better/missing libraries)
  C2  Consolidated Ledger + Exec Summary + Tech Debt Ledger + Architecture Scorecard
```

## Depth tiers

`--depth quick | standard | deep` (default `standard`)

| Tier    | Units                                                    | Use when |
|---------|----------------------------------------------------------|----------|
| quick   | A0 A1 B1 B5 C2                                           | Daily / pre-commit sanity, change scoped |
| standard| all of A, B1–B9, C2                                      | Standard milestone review |
| deep    | all of A, B1–B9 + per-area drill-down, C1, C2            | Release / architecture decision |

Every depth tier still runs the **discovery manifest + delta first**, so even a
`quick` run catches new code.

## Running the system (for a human who remembers nothing)

There is **one command**. Depth defaults to `standard`. If a run with today's
date exists, add `--resume` to continue it; otherwise it creates one.

```bash
# normal         — standard depth, today's run-id
bun docs/review-system/scripts/run.ts

# fast triage (A0 A1 B1 B5 C2 only)
bun docs/review-system/scripts/run.ts --depth quick

# continue a previous run exactly where it stopped
bun docs/review-system/scripts/run.ts --resume run-2026-08-06

# just see progress, change nothing
bun docs/review-system/scripts/run.ts --resume run-2026-08-06 --status

# full deep pass (incl. C1 ecosystem scan)
bun docs/review-system/scripts/run.ts --depth deep
```

After it runs, the driver prints the one line to paste into any agent, which reads
only the per-run **`RUN-BRIEF.md`**. The brief is self-contained: it lists the
deterministic inputs, embeds the health + delta values, names the missing units in
order, and restates the evidence contract. The agent executes those units and
writes one report file each. Re-running the driver later re-derives progress from
disk, so resuming mid-review is always safe.

> **If you forget everything:** run `bun docs/review-system/scripts/run.ts` and
> paste the `NEXT` line into any agent. That is the whole workflow.
<!-- end -->

## Output structure (per run)

```
docs/review-system/runs/<run-id>/
  00-manifest.json                   # machine snapshot (git HEAD, inventory, deps…)
  00-manifest.md                     # human-readable manifest
  01-health.json + .md               # quantitative health metrics vs CONSTITUTION
  delta.md                           # diff vs previous manifest (changed surface)
  00-intake-summary.md               # A0 verdict + health readout + review surface
  01-foundation.md … 10-performance.md   # one file per Focus Area in scope
  11-opportunity-scan.md             # C1 — libraries/arch we should adopt
  12-consolidated.md                 # C2 — findings + debt ledger + scorecard
  13-executive-summary.md            # top risks + fix roadmap, for humans
```

## Evidence & severity contract (MANDATORY)

Every finding must be a ledger row:

```
[SEV] AREA-ID-<n> · file:line · one-line issue · evidence · recommendation
```

Severity is fixed (never "critical-ish"):
- `P0` — ships right now, must fix (security hole, data loss, crash on main path)
- `P1` — should fix this cycle (correctness bug, contract drift, perf cliff)
- `P2` — fix when convenient (dead code, duplicated logic, missing test)
- `P3` — nice to have / tech debt / design note

Evidence means a concrete code reference (`file:line` + quoted snippet) or a
measured number. A finding with no evidence is a comment, not a finding.

## Prompt contract

Each prompt file follows this skeleton (see `templates/prompt-template.md`):

1. **Role** — the persona (e.g. "senior backend engineer")
2. **Context** — injected `<MANIFEST>`, `<DELTA>`, and the repo's own docs
3. **Scope** — what to cover (never a hardcoded file list)
4. **Method** — the discover → inspect → recommend sequence
5. **Checklist** — specific review questions (specific enough to be rigorous,
   generic enough to survive new code)
6. **Output contract** — which report file(s) to write, in which format

## Alpha scope triage (default-in, flag-out)

The review system is **alpha-focused by default**: every finding is treated as
alpha-in-scope (gates the release) until the human explicitly flags its area as
out of scope. Nothing is pre-classified as future.

- **Alpha** = everything not flagged. P0/P1 in-scope findings gate launch.
- **Out of scope (future)** = areas the human lists in **`SCOPE.md`**. Findings
  there are **documented + tracked but never gate alpha and get no implementation
  time now** — they stay valid placeholders (e.g. cap-store auth, remote VIVIM
  tunnel).
- Flag by adding one row to `SCOPE.md`; remove the row to re-flag to alpha.
- Ambiguous findings fail toward alpha (never silently deferred).

This keeps review effort on the alpha release while preserving a complete,
tracked ledger of future work. Full rule in `CONSTITUTION.md §12`.

## File layout

```
docs/review-system/
  README.md                      # this file
  CONSTITUTION.md                # thresholds, scorecard, principles, debt ledger
  SCOPE.md                       # alpha/future out-of-scope register (human-flags)
  prompts/
    discovery/ A0-*.md  A1-*.md
    core/      B1-*.md … B9-*.md
    synthesis/ C1-*.md  C2-*.md
  templates/
    prompt-template.md           # skeleton every prompt must match
    report-template.md           # skeleton every report must match
  scripts/
    run.ts                       # SELF-DRIVING DRIVER — the one entry point
    taxonomy.ts                  # single source of truth for all units/depth
    state.ts                     # run-state tracker (done/pending, resume-safe)
    manifest.ts                  # discovery manifest generator (L0)
    metrics.ts                   # quantitative health dashboard (L0)
    delta.ts                     # changed-surface diff vs prior run (L0)
  runs/                          # one dir per run (gitignored)
    <run-id>/
      RUN-BRIEF.md               # the ONE file you feed an agent (auto-generated)
      run-state.json             # progress ledger (auto-generated)
```
