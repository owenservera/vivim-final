# PRD: GOALS System — Governing User Journey & Product Goals

**Status:** READY FOR AGENT
**Date:** 2026-07-10
**Author:** opencode
**Labels:** `ready-for-agent`

---

## Problem Statement

The vivim-final project has no explicit system for tracking high-level product goals and their relationship to implementation work. Currently:

1. **Roadmap phases** define what to build (Phases 11-20), but don't explicitly state *why* — what user journey or product outcome each phase serves
2. **Atomic tracker** tracks 127 implementation units, but doesn't connect them to measurable product outcomes
3. **ADR system** has a `goalAlignment` placeholder on each option, but no goals exist to score against
4. **No single source of truth** exists for "what are we trying to achieve and how do we know we're done?"

Without a goals system, there's no way to:
- Evaluate whether architectural decisions serve product outcomes
- Track progress toward user journey milestones
- Prioritize work based on goal contribution
- Answer "are we building the right thing?" with evidence

## Solution

Implement a **GOALS system** with OKR hierarchy (Goal → Objective → Key Result) that:

1. Defines governing user journeys and product goals at the highest level
2. Maps goals to roadmap phases and atomic implementation units
3. Provides measurable key results with targets and current values
4. Integrates with the ADR system for goal alignment scoring
5. Calculates progress automatically from atomic tracker completion
6. Enforces invariants: decisions must reference goals, key results must have measurable targets

### User Journey Focus

Goals represent the *user's* perspective on what matters:
- **Goal G-001:** Consumer Chat MVP — "I can talk to multiple AI providers in one app"
- **Goal G-002:** Agentic Capabilities — "AI can browse the web and act on my behalf"
- **Goal G-003:** Visual Workflows — "I can build automations visually"
- **Goal G-004:** Memory & Learning — "The system learns from my interactions"
- **Goal G-005:** Production Quality — "The app is reliable, secure, and performant"

Each goal decomposes into objectives (measurable outcomes) and key results (specific metrics).

## User Stories

### Goal Management

1. As a product owner, I want to define high-level goals so that all work serves clear outcomes
2. As a product owner, I want to create objectives under each goal so that I can track measurable progress
3. As a product owner, I want to define key results with specific metrics so that progress is objective, not subjective
4. As a product owner, I want to set target values for key results so that "done" is unambiguous
5. As a product owner, I want to update current values for key results so that progress reflects reality
6. As a product owner, I want to assign goals to timeframes (phases, quarters) so that priorities are clear
7. As a product owner, I want to assign owners to goals so that accountability is clear

### Progress Tracking

8. As a product owner, I want to see completion percentage for each goal so that I know overall progress
9. As a product owner, I want to see completion percentage for each objective so that I know which areas need attention
10. As a product owner, I want to see current vs target for each key result so that I know how close we are
11. As a product owner, I want progress calculated automatically from atomic tracker so that I don't manually update status
12. As a product owner, I want to see which atomic units contribute to each key result so that I understand the implementation path
13. As a product owner, I want a goals report that summarizes all goals with progress so that I can assess overall health

### ADR Integration

14. As a decision maker, I want to score ADR options against goal alignment so that architectural decisions serve product outcomes
15. As a decision maker, I want the system to suggest alignment scores based on goal mapping so that scoring is informed, not arbitrary
16. As a decision maker, I want to override suggested scores so that human judgment prevails
17. As a decision maker, I want to see which goals an ADR affects so that I understand the impact
18. As a decision maker, I want to see which ADRs are aligned to a goal so that I understand the architectural commitments

### Roadmap Integration

19. As a planner, I want goals to map to roadmap phases so that I understand what each phase achieves
20. As a planner, I want to see which goals are satisfied by phase completion so that I can plan releases
21. As a planner, I want to see goal gaps (goals without phase coverage) so that I can adjust the roadmap

### Invariants & Quality

22. As a quality gate, I want to enforce that every decision references at least one goal so that work doesn't drift
23. As a quality gate, I want to enforce that key results have measurable targets so that progress is quantifiable
24. As a quality gate, I want to enforce that goals have owners so that accountability is clear
25. As a quality gate, I want to warn when goal alignment scores are missing from ADR options so that scoring isn't skipped

### CLI & Reporting

26. As a developer, I want CLI commands to list, show, create, and update goals so that I can manage them from the terminal
27. As a developer, I want a `goals progress` command that recalculates from atomic tracker so that progress is always current
28. As a developer, I want a `goals align` command that shows ADRs for a goal so that I can see architectural commitments
29. As a developer, I want a `goals score` command that suggests alignment scores for an ADR so that scoring is guided
30. As a developer, I want a `goals report` command that outputs a full goals summary so that I can share progress

## Implementation Decisions

### 1. Data Model: OKR Hierarchy

Three-level hierarchy with clear ownership and metrics:

```
Goal (G-NNN)
  ├── Objective (O-NNN)
  │     ├── Key Result (KR-NNN)
  │     │     └── relatedUnits: string[]  (atomic unit IDs)
  │     │     └── metric: string          (e.g., "completion %", "latency ms")
  │     │     └── target: number
  │     │     └── current: number
  │     └── ...
  └── ...
```

**Types:**
- `GoalStatus`: `'not_started' | 'in_progress' | 'achieved' | 'blocked'`
- `Goal`: `{ id, title, description, status, completion, owner, timeframe, objectives }`
- `Objective`: `{ id, title, description, status, completion, keyResults }`
- `KeyResult`: `{ id, title, description, metric, target, current, status, relatedUnits }`

### 2. File Structure

Single master file for simplicity (single-developer project):

```
docs/goals/
  GOALS.md              # Master index with all goals, objectives, key results
```

Individual goal files (`G-001.md`) only created for complex goals with extensive context. Default is everything in `GOALS.md`.

### 3. Progress Calculation

Progress flows bottom-up:

1. **Key Result progress**: `(current / target) * 100` (clamped to 0-100)
2. **Objective progress**: average of child key results
3. **Goal progress**: average of child objectives

When `relatedUnits` are specified on a key result:
- Query atomic tracker for unit status
- If all related units are `[x]` (done), key result progress = 100%
- If some are done, progress = `(done / total) * 100`
- Override: manual `current` values take precedence over atomic-derived values

### 4. ADR Goal Alignment

**Integration points:**

1. `DecisionOption` gains `relatedGoals?: string[]` (goal IDs)
2. `goalAlignment` score (1-5) remains, but now has context
3. `bun run devops goals score <adr-id>` analyzes ADR options against goals:
   - Reads ADR's `relatedUnits`
   - Maps units → key results → objectives → goals
   - Suggests alignment scores based on goal contribution
   - Outputs suggestion; human confirms/overrides

**Scoring logic:**
- Option contributes to goal's key results → +1 per key result
- Option directly implements objective → +1
- Option's effort/risk affects score (high effort = -0.5, high risk = -0.5)
- Final score: clamp(suggested, 1, 5)

### 5. Invariants

Two new invariants added to `docs/roadmap/INVARIANTS.md`:

| Category | Invariant | Violation | Enforcement |
|----------|-----------|-----------|-------------|
| A | Decisions must reference at least one goal | Hard block | ADR validation in `decision.ts` |
| D | Key results must have measurable targets | Soft warning | Goal validation in `goals.ts` |

### 6. CLI Commands

```
bun run devops goals list                          # list all goals with progress
bun run devops goals show <id>                     # show goal details
bun run devops goals create --title "..." [...]    # create new goal
bun run devops goals update <id> --status ...      # update goal status
bun run devops goals progress                      # recalculate from atomic tracker
bun run devops goals align <goal-id>               # show ADRs aligned to this goal
bun run devops goals score <adr-id>                # suggest goal alignment scores
bun run devops goals report                        # full goals report
```

### 7. Relationship to Existing Systems

```
┌─────────────────────────────────────────────────────────────┐
│                     GOALS SYSTEM                            │
│              Goal → Objective → Key Result                   │
└─────────────────────────────────────────────────────────────┘
        ↑                   ↑                   ↑
        │                   │                   │
┌───────┴───────┐   ┌──────┴──────┐   ┌───────┴───────┐
│  ATOMIC       │   │  ROADMAP    │   │  ADR SYSTEM   │
│  TRACKER      │   │  (Phases)   │   │  (Decisions)  │
│               │   │             │   │               │
│ Units → KRs   │   │ Phases →    │   │ Options →     │
│               │   │ Goals       │   │ Goal Align    │
└───────────────┘   └─────────────┘   └───────────────┘
```

### 8. Roadmap Phase Mapping

Goals map to roadmap phases, not the other way around:

| Goal | Primary Phases | Description |
|------|----------------|-------------|
| G-001: Consumer Chat MVP | 11, 12, 13 | Chrome automation, remux backend, consumer UI |
| G-002: Agentic Capabilities | 14 | Tool use, agentic loop, safety guardrails |
| G-003: Visual Workflows | 15 | DAG builder, node types, execution panel |
| G-004: Memory & Learning | 16 | Episodic/semantic/procedural memory |
| G-005: Production Quality | 17, 18, 19, 20 | Hardening, providers, collaboration, platform |
| G-006: Knowledge Graph Substrate | 21 | Canonical property-graph backbone, traversal engine, domain bridge |

## Testing Decisions

### Test Philosophy

Tests verify **external behavior**, not implementation details:
- Can I create a goal and retrieve it?
- Does progress calculation return correct percentages?
- Does ADR scoring suggest reasonable alignment scores?
- Do invariants catch violations?

### Modules to Test

1. **Goal CRUD** (`goals.ts`)
   - Create, get, list, update goals
   - Create, get, update objectives and key results
   - File I/O round-trip (write → read → verify)

2. **Progress Calculation** (`goals-progress.ts`)
   - Key result progress from current/target
   - Objective progress from key results
   - Goal progress from objectives
   - Atomic tracker integration (related units → progress)

3. **ADR Integration** (`goals-align.ts`)
   - Alignment score suggestion
   - Goal → ADR mapping
   - ADR → Goal mapping

4. **CLI Commands** (`index.ts`)
   - Each subcommand produces expected output
   - Error handling for missing IDs, invalid states

5. **Invariants** (`invariants.ts`)
   - New invariant: decisions must reference goals
   - New invariant: key results must have targets

### Prior Art

- `tests/unit/devops/decision.test.ts` — 27 tests covering ADR lifecycle
- `tests/unit/devops/invariants.test.ts` — 7 tests covering invariant checks
- Same pattern: unit tests with mocked file I/O, no database dependencies

## Out of Scope

1. **Real-time progress dashboards** — CLI-only for now, no web UI
2. **Goal templates** — goals are created manually, no pre-built templates
3. **Goal dependencies** — goals don't block each other (use atomic tracker for that)
4. **Goal history/audit trail** — no versioning of goal changes (use git for that)
5. **Goal notifications** — no alerts when progress stalls
6. **Goal scoring algorithms** — simple arithmetic, no ML/AI scoring
7. **Goal export/import** — goals live in markdown, git handles portability
8. **Goal permissions** — single-developer project, no access control

## Further Notes

### Implementation Order

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| G.1 | Goal data model + types | S | None |
| G.2 | Goal file I/O (create, get, list, update) | M | G.1 |
| G.3 | Goal progress calculation (from atomic tracker) | M | G.2 |
| G.4 | Goal alignment scoring (for ADRs) | M | G.2 |
| G.5 | CLI commands (list, show, create, progress, align, score, report) | L | G.2, G.3, G.4 |
| G.6 | Tests for all goal functions | M | G.2, G.3, G.4 |
| G.7 | Update INVARIANTS.md with new invariants | S | G.1 |
| G.8 | Update AGENTS.md with goals system docs | S | All above |

### Design Rationale

**Why OKR hierarchy?** The user explicitly requested Goal → Objective → Key Result. This provides:
- High-level direction (Goals)
- Measurable outcomes (Objectives)
- Specific metrics (Key Results)

**Why single GOALS.md file?** Single-developer project. Splitting into individual files adds complexity without benefit. Git history provides change tracking.

**Why manual + automatic scoring?** Automatic scoring provides data-driven suggestions; human override ensures judgment prevails. Neither alone is sufficient.

**Why enforce "decisions must reference goals"?** Prevents drift. Every architectural decision should serve a product outcome. If it doesn't, question whether the decision is needed.

### Open Questions (Resolved)

1. **Hierarchy depth:** 3 levels (OKR) — confirmed by user
2. **Phase mapping:** Goals span phases, phases contribute to goals — recommended, user agreed
3. **Metrics:** Both completion % and qualitative status — confirmed by user
4. **ADR integration:** Both automatic and manual scoring — confirmed by user
