# PRD: Autonomous Development System with Background Verification

**Status:** READY FOR AGENT
**Date:** 2026-07-10
**Author:** opencode
**Labels:** `ready-for-agent`

---

## Problem Statement

The vivim-final project has multiple devops systems (atomic tracker, ADR, invariants, roadmap) that operate independently. There is no unifying "why" connecting them, no automatic progress propagation, and verification is manual. This creates three problems:

1. **No goal coherence** — Decisions, implementation units, and roadmap phases exist in isolation. There is no way to answer "does this architectural decision serve our product goals?" or "when are we done?"

2. **Manual orchestration** — The ralph loop requires human trigger ("IMPLEMENT ALL"), manual progress tracking, and manual verification runs. The system cannot autonomously drive itself toward completion.

3. **Reactive quality** — Verification happens after implementation (gate check). There is no continuous monitoring, no proactive issue detection, and no background assurance that architecture, design fidelity, and goal alignment are maintained.

The result: a human must constantly supervise, prioritize, verify, and decide. The system is a tool, not an autonomous partner.

## Solution

Build a three-layer autonomous development system:

### Layer 1: GOALS System (Foundation)
A hierarchical Goal → Objective → Key Result (OKR) system that:
- Defines governing user journeys and product goals at the highest level
- Maps to roadmap phases and atomic implementation units
- Provides measurable key results with targets and current values
- Integrates with ADR system for goal alignment scoring
- Calculates progress automatically from atomic tracker completion

### Layer 2: Goal-Aware Autonomous Loop (Enhancement)
Enhance the existing ralph loop to be goal-aware:
- Select next atomic unit by goal contribution (not just dependency)
- Auto-recalculate goal progress when units complete
- Stop when goals are satisfied (not just when units are done)
- Enforce goal-related invariants (decisions must reference goals)

### Layer 3: Background Verification Agent (Assurance)
A continuous verification system that runs in parallel:
- **Phase 1 (Hooks):** Pre-commit/pre-push checks via lefthook
- **Phase 2 (File Watcher):** Real-time typecheck + lint + test watching
- **Phase 3 (Parallel Agent):** AI agent for architecture review, design fidelity, goal alignment monitoring

**User perspective:** Set high-level goals once → system autonomously implements, verifies, and reports progress → human only intervenes for business decisions and course corrections.

## User Stories

### Goal Definition and Management

1. As a product owner, I want to define high-level goals (e.g., "Consumer Chat MVP") so that all work serves clear outcomes
2. As a product owner, I want to create objectives under each goal (e.g., "Chrome Automation Layer") so that I can track measurable progress
3. As a product owner, I want to define key results with specific metrics (e.g., "CDP client connects to Chrome") so that progress is objective, not subjective
4. As a product owner, I want to set target values for key results so that "done" is unambiguous
5. As a product owner, I want to update current values for key results so that progress reflects reality
6. As a product owner, I want to assign goals to timeframes (phases, quarters) so that priorities are clear
7. As a product owner, I want to assign owners to goals so that accountability is clear
8. As a product owner, I want to create goals via CLI so that I can manage them from the terminal
9. As a product owner, I want to list all goals with progress so that I can see overall status at a glance
10. As a product owner, I want to show detailed goal information so that I can drill into specifics

### Progress Tracking and Calculation

11. As a product owner, I want progress calculated automatically from atomic tracker so that I do not manually update status
12. As a product owner, I want to see completion percentage for each goal so that I know overall progress
13. As a product owner, I want to see completion percentage for each objective so that I know which areas need attention
14. As a product owner, I want to see current vs target for each key result so that I know how close we are
15. As a product owner, I want to see which atomic units contribute to each key result so that I understand the implementation path
16. As a product owner, I want a goals report that summarizes all goals with progress so that I can assess overall health
17. As a product owner, I want to recalculate progress on demand so that I can see fresh numbers

### Roadmap Integration

18. As a planner, I want goals to map to roadmap phases so that I understand what each phase achieves
19. As a planner, I want to see which goals are satisfied by phase completion so that I can plan releases
20. As a planner, I want to see goal gaps (goals without phase coverage) so that I can adjust the roadmap
21. As a planner, I want roadmap phases to reference related goals so that the connection is explicit

### ADR Integration

22. As a decision maker, I want to score ADR options against goal alignment so that architectural decisions serve product outcomes
23. As a decision maker, I want the system to suggest alignment scores based on goal mapping so that scoring is informed, not arbitrary
24. As a decision maker, I want to override suggested scores so that human judgment prevails
25. As a decision maker, I want to see which goals an ADR affects so that I understand the impact
26. As a decision maker, I want to see which ADRs are aligned to a goal so that I understand the architectural commitments
27. As a decision maker, I want ADR options to have relatedGoals field so that alignment is explicit

### Autonomous Loop

28. As a developer, I want the ralph loop to select units by goal contribution so that high-impact work is prioritized
29. As a developer, I want the ralph loop to auto-update goal progress when units complete so that tracking is automatic
30. As a developer, I want the ralph loop to stop when goals are satisfied so that work does not continue unnecessarily
31. As a developer, I want the ralph loop to report goal progress after each unit so that I can see impact
32. As a developer, I want the ralph loop to skip units that do not contribute to active goals so that effort is focused
33. As a developer, I want the ralph loop to discover new gaps when units complete so that the plan evolves

### Background Verification Phase 1: Hooks

34. As a developer, I want pre-commit hooks to run typecheck so that errors are caught before commit
35. As a developer, I want pre-commit hooks to run lint so that style issues are caught before commit
36. As a developer, I want pre-commit hooks to run invariant checks so that architectural violations are caught before commit
37. As a developer, I want pre-push hooks to run the full gate so that quality is assured before push
38. As a developer, I want pre-push hooks to run goal progress calculation so that progress is current before push

### Background Verification Phase 2: File Watcher

39. As a developer, I want a file watcher that runs typecheck on file changes so that I get immediate feedback
40. As a developer, I want a file watcher that runs lint on file changes so that style issues are caught immediately
41. As a developer, I want a file watcher that runs relevant tests when test files change so that I know if tests pass
42. As a developer, I want a file watcher that reports issues in real-time so that I do not wait for commit to discover problems

### Background Verification Phase 3: Parallel Agent

43. As a developer, I want a background AI agent that monitors architecture quality so that drift is caught early
44. As a developer, I want the agent to compare implementation to design docs so that fidelity is maintained
45. As a developer, I want the agent to check goal alignment so that decisions serve goals
46. As a developer, I want the agent to suggest improvements proactively so that quality increases over time
47. As a developer, I want the agent to block progress if critical issues are found so that bad code does not accumulate
48. As a developer, I want the agent to report to the main loop so that the autonomous system is self-correcting

### Goal Health Dashboard

49. As a product owner, I want a goal health dashboard so that I can see overall system health at a glance
50. As a product owner, I want the dashboard to show goal progress so that I know what is done
51. As a product owner, I want the dashboard to show ADR alignment coverage so that I know if decisions serve goals
52. As a product owner, I want the dashboard to show invariant compliance so that I know if architecture is sound
53. As a product owner, I want the dashboard to show design fidelity score so that I know if implementation matches design
54. As a product owner, I want the dashboard to show atomic unit completion so that I know implementation progress

### Invariants and Quality

55. As a quality gate, I want to enforce that every decision references at least one goal so that work does not drift
56. As a quality gate, I want to enforce that key results have measurable targets so that progress is quantifiable
57. As a quality gate, I want to enforce that goals have owners so that accountability is clear
58. As a quality gate, I want to warn when goal alignment scores are missing from ADR options so that scoring is not skipped
59. As a quality gate, I want to warn when atomic units do not reference goals so that implementation is purposeful

### CLI and Reporting

60. As a developer, I want CLI commands to list, show, create, and update goals so that I can manage them from the terminal
61. As a developer, I want a `goals progress` command that recalculates from atomic tracker so that progress is always current
62. As a developer, I want a `goals align` command that shows ADRs for a goal so that I can see architectural commitments
63. As a developer, I want a `goals score` command that suggests alignment scores for an ADR so that scoring is guided
64. As a developer, I want a `goals report` command that outputs a full goals summary so that I can share progress
65. As a developer, I want a `goals dashboard` command that shows the goal health dashboard so that I can see overall health

## Implementation Decisions

### 1. Data Model: OKR Hierarchy

Three-level hierarchy with clear ownership and metrics. This came from the user's explicit request for "Goal → Objective → Key Result (OKR)" hierarchy.

```
Goal (G-NNN)
  ├── Objective (O-NNN)
  │     ├── Key Result (KR-NNN)
  │     │     ├── relatedUnits: string[]  (atomic unit IDs)
  │     │     ├── metric: string          (e.g., "completion %", "latency ms")
  │     │     ├── target: number
  │     │     ├── current: number
  │     │     └── status: GoalStatus
  │     └── ...
  └── ...
```

**Types:**
- `GoalStatus`: `'not_started' | 'in_progress' | 'achieved' | 'blocked'`
- `Goal`: `{ id, title, description, status, completion, owner, timeframe, objectives }`
- `Objective`: `{ id, title, description, status, completion, keyResults }`
- `KeyResult`: `{ id, title, description, metric, target, current, status, relatedUnits }`

### 2. File Structure

Single master file for simplicity (single-developer project). Individual goal files only created for complex goals with extensive context. This was chosen over per-goal files to reduce fragmentation.

```
docs/goals/
  GOALS.md              # Master index with all goals, objectives, key results
```

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

### 5. Goal-Aware Selection

Enhance `devops/select.ts` to prioritize by goal contribution:

```
Score = goalContribution × dependencyWeight

goalContribution = count of key results this unit contributes to
dependencyWeight = 1.0 (all deps met) or 0 (blocked)
```

Units that contribute to more key results are prioritized. This ensures high-impact work is done first.

### 6. Invariants

New Category E (Goal Invariants) added to `docs/roadmap/INVARIANTS.md`:

| ID | Rule | Violation | Enforcement |
|----|------|-----------|-------------|
| E1 | Decisions must reference at least one goal | Hard block | ADR validation in `decision.ts` |
| E2 | Key results must have measurable targets | Soft warning | Goal validation in `goals.ts` |
| E3 | Goals must have owners | Soft warning | Goal validation in `goals.ts` |
| E4 | Atomic units should reference goals | Soft warning | Unit validation |

### 7. Background Verification Architecture

**Three-phase approach:**

**Phase 1: Hook-Based (Immediate)**
- Enhance lefthook with invariant checks
- Add goal progress calculation to gate
- Simple, no background process, runs on every commit/push

**Phase 2: File Watcher (Short-term)**
- `bun run devops watch` command
- Real-time typecheck + lint feedback
- Test watching for affected modules

**Phase 3: Parallel Agent (Long-term)**
- Separate AI agent for architecture review
- Design fidelity monitoring
- Goal alignment validation
- Proactive issue reporting
- Blocks if critical issues found

### 8. Relationship to Existing Systems

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
        ↑                                   ↑
        │                                   │
┌───────┴───────────────────────────────────┴───────┐
│           AUTONOMOUS LOOP + BACKGROUND AGENT       │
│                                                    │
│  - Select by goal contribution                     │
│  - Auto-update progress                            │
│  - Continuous verification                         │
│  - Design fidelity monitoring                      │
│  - Proactive issue reporting                       │
└────────────────────────────────────────────────────┘
```

### 9. CLI Commands

```
# Goal management
bun run devops goals list                          # list all goals with progress
bun run devops goals show <id>                     # show goal details
bun run devops goals create --title "..." [...]    # create new goal
bun run devops goals update <id> --status ...      # update goal status

# Progress and alignment
bun run devops goals progress                      # recalculate from atomic tracker
bun run devops goals align <goal-id>               # show ADRs aligned to this goal
bun run devops goals score <adr-id>                # suggest goal alignment scores

# Reporting
bun run devops goals report                        # full goals report
bun run devops goals dashboard                     # goal health dashboard

# Background verification
bun run devops watch                               # start file watcher
```

### 10. Implementation Order

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| G.1 | Goal data model + types | S | None |
| G.2 | Goal file I/O (create, get, list, update) | M | G.1 |
| G.3 | Goal progress calculation (from atomic tracker) | M | G.2 |
| G.4 | Goal alignment scoring (for ADRs) | M | G.2 |
| G.5 | CLI commands (all goals subcommands) | L | G.2, G.3, G.4 |
| G.6 | Tests for all goal functions | M | G.2, G.3, G.4 |
| G.7 | Update INVARIANTS.md with Category E | S | G.1 |
| G.8 | Update AGENTS.md with goals system docs | S | All above |
| G.9 | Enhance lefthook with goal-related checks | S | G.7 |
| G.10 | Enhance ralph loop with goal-aware selection | M | G.3, G.5 |
| G.11 | File watcher (`bun run devops watch`) | M | None |
| G.12 | Goal health dashboard command | M | G.3, G.5 |
| G.13 | Background verification agent (Phase 3) | L | G.9, G.11 |

## Testing Decisions

### Test Philosophy

Tests verify **external behavior**, not implementation details:
- Can I create a goal and retrieve it?
- Does progress calculation return correct percentages?
- Does ADR scoring suggest reasonable alignment scores?
- Do invariants catch violations?
- Does the autonomous loop select the right unit?

### Modules to Test

1. **Goal CRUD** (`goals.ts`)
   - Create, get, list, update goals
   - Create, get, update objectives and key results
   - File I/O round-trip (write → read → verify)
   - Error handling for missing IDs, invalid states

2. **Progress Calculation** (`goals-progress.ts`)
   - Key result progress from current/target
   - Objective progress from key results
   - Goal progress from objectives
   - Atomic tracker integration (related units → progress)
   - Override: manual current values take precedence

3. **ADR Integration** (`goals-align.ts`)
   - Alignment score suggestion
   - Goal → ADR mapping
   - ADR → Goal mapping
   - Scoring logic (contribution, effort, risk)

4. **Goal-Aware Selection** (`select.ts` enhancement)
   - Selection prioritizes by goal contribution
   - Blocked units are skipped
   - Empty goals do not affect selection

5. **CLI Commands** (`index.ts`)
   - Each subcommand produces expected output
   - Error handling for missing IDs, invalid states
   - Output format matches documentation

6. **Invariants** (`invariants.ts`)
   - E1: Decisions must reference goals
   - E2: Key results must have targets
   - E3: Goals must have owners
   - E4: Atomic units should reference goals

7. **File Watcher** (`watch.ts`)
   - Watches correct directories
   - Runs appropriate checks on file changes
   - Reports issues in real-time
   - Handles errors gracefully

### Prior Art

- `tests/unit/devops/decision.test.ts` — 27 tests covering ADR lifecycle
- `tests/unit/devops/invariants.test.ts` — 7 tests covering invariant checks
- Same pattern: unit tests with mocked file I/O, no database dependencies

## Out of Scope

1. **Real-time web dashboards** — CLI-only for now, no web UI
2. **Goal templates** — goals are created manually, no pre-built templates
3. **Goal dependencies** — goals do not block each other (use atomic tracker for that)
4. **Goal history/audit trail** — no versioning of goal changes (use git for that)
5. **Goal notifications** — no alerts when progress stalls
6. **Goal scoring algorithms** — simple arithmetic, no ML/AI scoring
7. **Goal export/import** — goals live in markdown, git handles portability
8. **Goal permissions** — single-developer project, no access control
9. **Parallel agent implementation** — Phase 3 is designed but not implemented in this PRD
10. **Webhook-based verification** — file watcher is local, not webhook-based

## Further Notes

### Design Rationale

**Why three layers?** Separation of concerns:
- Layer 1 (GOALS) defines what success looks like
- Layer 2 (Autonomous Loop) drives toward success
- Layer 3 (Background Verification) ensures quality along the way

**Why phased background verification?** Risk management:
- Phase 1 (Hooks) is low-risk, immediate value
- Phase 2 (File Watcher) adds real-time feedback
- Phase 3 (Parallel Agent) is high-value but complex

**Why goal-aware selection?** Efficiency:
- Units that contribute to more key results are prioritized
- This ensures high-impact work is done first
- Blocked units are skipped automatically

**Why enforce "decisions must reference goals"?** Prevents drift:
- Every architectural decision should serve a product outcome
- If it does not, question whether the decision is needed

### Key Insight

The GOALS system is the missing piece that connects everything. Once implemented:
- Atomic units know WHY they exist (goal contribution)
- ADRs know WHAT they serve (goal alignment)
- The autonomous loop knows WHEN to stop (goals satisfied)
- The background agent knows WHAT to check (goal compliance)
