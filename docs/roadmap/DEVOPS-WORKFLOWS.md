# DEVOPS-WORKFLOWS.md — AI Agent Orchestration Guide

**Purpose:** Single reference for AI agents running the devops loop. Defines 5 core workflows with exact CLI commands, stop conditions, and cross-system integration.

**When to read this file:**
- Starting a new devops session
- User says "ralph loop", "keep going", "implement all"
- Resuming work after context compaction
- Unsure which workflow to run

---

## System Map

```
docs/goals/GOALS.md          OKR hierarchy (goals → objectives → key results)
docs/decisions/ADR-NNN.md    Architectural decisions (multi-round review)
docs/atomic/01-tracker.md    Implementation progress (116/127 done)
docs/roadmap/INVARIANTS.md   Boundary enforcement (5 categories, 22+ rules)
docs/roadmap/OPEN-QUESTIONS.md  Resolved + pending architecture questions
```

```
┌─────────────────────────────────────────────────────────┐
│                    GOALS (Layer 0)                       │
│  G-001: Consumer Chat MVP (35%)                         │
│  G-002: Local-first Privacy (70%)                       │
│  G-003: Provider Ecosystem (45%)                        │
└──────────────────────┬──────────────────────────────────┘
                       │ progress flows bottom-up
┌──────────────────────┴──────────────────────────────────┐
│                 ADRs + INVARIANTS (Layer 1)              │
│  ADR-001..010: Approved decisions                       │
│  Categories A-E: Non-negotiable constraints             │
└──────────────────────┬──────────────────────────────────┘
                       │ decisions govern
┌──────────────────────┴──────────────────────────────────┐
│              ATOMIC TRACKER (Layer 2)                    │
│  116/127 done, 11 pending                               │
│  Phases 1-10 (core), 11-13 (chrome/app)                 │
└──────────────────────┬──────────────────────────────────┘
                       │ units implement
┌──────────────────────┴──────────────────────────────────┐
│               SOURCE CODE (Layer 3)                      │
│  src/engines/ + src/storage/ + src/server/              │
│  289 tests, typecheck clean                             │
└─────────────────────────────────────────────────────────┘
```

---

## Workflow 1: Implement a Unit

**Trigger:** `bun run devops select` returns a unit, or user says "implement next"

### Protocol

```
LOOP:
  1. sel = bun run devops select
     └─ null → "ALL UNITS DONE" → STOP

  2. bun run devops mark <id> in_progress

  3. Read unit's atomic file: docs/atomic/phase-X-*/<id>.md
     └─ No file → mark blocked "no atomic spec", goto LOOP

  4. Fidelity cross-check:
     a. Read docs/roadmap/RESEARCH-REPORT.md for this unit
     b. If classification is DONE → skip (mark done, goto LOOP)
     c. Read design docs: docs/merged-design-v2/04-merged-engines.md
     d. Verify: interface signatures, store contracts, dependencies
     e. DRIFT found → fix atomic file first, then proceed

  5. Implement:
     - Create/edit source files per interface + store contract
     - Write unit tests (tests/unit/engines/<engine>.test.ts)
     - Follow code conventions (AGENTS.md § Code Conventions)

  6. bun run devops gate
     ├─ PASS → step 7
     ├─ FAIL → fix, retry (max 3 attempts)
     └─ >3 fails → bun run devops mark <id> blocked "reason", STOP

  7. bun run devops mark <id> done

  8. bun run devops goals progress
     └─ Auto-recalculates goal completion from tracker

  9. Report progress:
     ✓ <unit-name> | done: N/127 | next: <next-unit-name>

  10. bun run devops roadmap --discover
      └─ Check if this unit's completion revealed new gaps

  goto LOOP
```

### Stop Conditions

| Condition | Action |
|-----------|--------|
| `select` returns null | All units done. Report "RALPH LOOP COMPLETE" |
| Unit blocked [!] | Mark blocked with reason, skip to next |
| Test fails 3+ retries | Mark blocked, report, continue to next |
| User interrupts | Save state, mark current in_progress |

### Critical Rules

- **NEVER ask "Should I continue?"** — just go to next unit
- **NEVER pause between units** unless blocked
- **ALWAYS report progress** after each unit
- **ALWAYS read the atomic file** before implementing

---

## Workflow 2: Make an Architecture Decision

**Trigger:** Architecture question, design trade-off, or user says "decide on X"

### Protocol

```
1. Check if decision already exists:
   bun run devops decision list
   └─ Existing ADR covers this → done

2. Create ADR:
   bun run devops decision create --title "..." --author "..."
   └─ Creates docs/decisions/ADR-NNN-title.md

3. Fill in problem statement + context + options (2+):
   Edit docs/decisions/ADR-NNN-title.md directly

4. Score goal alignment for each option:
   bun run devops goals score ADR-NNN
   └─ Suggests alignment scores based on goal mapping

5. AI review round:
   bun run devops decision prompt ADR-NNN
   └─ Generates structured review questions
   bun run devops decision prompt-review ADR-NNN \
     --reviewer "AI Agent" \
     --preference "A: Option Name" \
     --feasibility "3" \
     --risk "low"
   └─ Records AI review round

6. Human review round (required):
   bun run devops decision review ADR-NNN \
     --reviewer "User" \
     --feedback "..."
   └─ Minimum 2 rounds (AI + human) required

7. Decide:
   bun run devops decision decide ADR-NNN --option A --rationale "..."
   └─ Status → DECIDED

8. Approve:
   bun run devops decision approve ADR-NNN
   └─ Status → APPROVED
```

### Rules

- **Minimum 2 options** must be considered
- **Minimum 2 review rounds** (AI + human)
- Status flow: PROPOSED → IN_REVIEW → DECIDED → APPROVED
- ADRs are stored as markdown in `docs/decisions/ADR-NNN-title.md`
- **NOT for implementation details** — those go in atomic specs

---

## Workflow 3: Discover and Onboard New Units

**Trigger:** After completing a unit, or user says "what's missing?", "research first"

### Protocol

```
1. bun run devops roadmap --discover
   └─ Produces docs/roadmap/DISCOVERED-UNITS.md

2. Review discovered candidates:
   └─ For each GAP-id, decide: interview now or defer?

3. Interview (for each accepted candidate):
   bun run devops roadmap --interview <GAP-id>
   └─ Conversational protocol: AI asks questions, synthesizes atomic spec

4. After interview approval:
   bun run devops roadmap --merge-unit <id>
   └─ Adds unit to tracker as [ ] pending

5. Update dependency graph if needed:
   Edit docs/atomic/00-master-plan.md
```

### Unit Classification

| Class | Meaning | Action |
|-------|---------|--------|
| DONE | Already implemented | Skip (mark [x]) |
| PORT | Exists in vivim-final core | Implement against vivim-final source (cap-store = prior art) |
| CREATE | New work | Write atomic spec, implement |
| FIX | Stubs exist | Complete stub methods |

---

## Workflow 4: Goal Review and Recalibration

**Trigger:** User says "check progress", "how are goals?", end of session

### Protocol

```
1. bun run devops goals list
   └─ Shows all goals with completion %

2. bun run devops goals dashboard
   └─ Full health view with invariant compliance

3. bun run devops goals progress
   └─ Recalculates from atomic tracker (authoritative)

4. bun run devops goals align <goal-id>
   └─ Shows which ADRs serve this goal

5. bun run devops goals report
   └─ Full markdown report

6. If goal status needs update:
   bun run devops goals update G-XXX --status achieved
```

### Progress Calculation

Progress flows bottom-up:
```
Key Result completion → Objective average → Goal average
```

Key results are auto-calculated from atomic tracker:
- `relatedUnits` field maps KRs to atomic unit IDs
- If all related units are [x] done → KR is 100%
- If some are done → proportional completion

---

## Workflow 5: Quality Assurance

**Trigger:** Pre-commit (automatic), pre-push (automatic), periodic

### Pre-commit Hooks (lefthook)

Automatically runs on `git commit`:
```
lint        → biome check (staged .ts files)
format      → biome check --write (staged .js,.ts,.json,.md)
typecheck   → bunx tsc --noEmit
invariants  → bun run devops invariants check --category B
```

### Pre-push Hook

```
test → bun test
```

### Manual Quality Checks

```
bun run devops gate              # Full gate (typecheck + lint + tests + invariants)
bun run devops gate --strict     # Also fails on new lint issues in changed files
bun run devops invariants check  # All categories
bun run devops invariants check --category B  # Architectural only (hard blocks)
bun run devops invariants report # Compliance report
```

---

## Quick Reference: All CLI Commands

### Core Loop

| Command | Purpose |
|---------|---------|
| `bun run devops select` | Get next implementable unit (JSON or null) |
| `bun run devops mark <id> <state>` | Transition unit state |
| `bun run devops gate` | Run quality gate |
| `bun run devops report` | Progress summary |

### Research & Discovery

| Command | Purpose |
|---------|---------|
| `bun run devops roadmap` | Full research cycle |
| `bun run devops roadmap --discover` | Find new unit candidates |
| `bun run devops roadmap --interview <id>` | Interview for discovered unit |
| `bun run devops roadmap --unit <id>` | Research single unit |
| `bun run devops roadmap --merge-unit <id>` | Merge new unit to tracker |

### Decisions (ADR)

| Command | Purpose |
|---------|---------|
| `bun run devops decision create --title "..."` | Create ADR |
| `bun run devops decision list` | List all ADRs |
| `bun run devops decision show <id>` | Show ADR details |
| `bun run devops decision review <id>` | Add review round |
| `bun run devops decision prompt <id>` | Generate review questions |
| `bun run devops decision decide <id> --option A` | Select option |
| `bun run devops decision approve <id>` | Approve decision |
| `bun run devops decision compare <id>` | Compare options table |

### Goals

| Command | Purpose |
|---------|---------|
| `bun run devops goals list` | All goals with progress |
| `bun run devops goals show <id>` | Single goal detail |
| `bun run devops goals create --title "..."` | Create goal |
| `bun run devops goals update <id> --status ...` | Update goal |
| `bun run devops goals progress` | Recalculate from tracker |
| `bun run devops goals align <goal-id>` | Goal↔ADR alignment |
| `bun run devops goals score <adr-id>` | Suggest alignment scores |
| `bun run devops goals dashboard` | Health dashboard |
| `bun run devops goals report` | Full progress report |

### Invariants

| Command | Purpose |
|---------|---------|
| `bun run devops invariants check` | Check all categories |
| `bun run devops invariants check --category B` | Architectural only |
| `bun run devops invariants check --unit <id>` | Check for specific unit |
| `bun run devops invariants report` | Compliance report |

---

## Decision Tree: Which Workflow?

```
User says: "implement next" / "keep going" / "ralph loop"
  → Workflow 1: Implement a Unit

User says: "decide on X" / "should we use Y or Z?"
  → Workflow 2: Make an Architecture Decision

User says: "what's missing?" / "research first" / "gap analysis"
  → Workflow 3: Discover and Onboard New Units

User says: "check progress" / "how are goals?"
  → Workflow 4: Goal Review and Recalibration

User says: "run checks" / "verify" / "is it clean?"
  → Workflow 5: Quality Assurance

User says: "add a goal" / "create objective"
  → bun run devops goals create --title "..."

User says: "what should we work on?"
  → bun run devops goals dashboard
  → Then Workflow 1 for highest-priority incomplete goal
```

---

## Error Handling

### Gate Fails

```
1. Read gate output for specific failure
2. Fix the issue (type error, lint, test, invariant)
3. Re-run gate: bun run devops gate
4. Max 3 retries → mark blocked
```

### Unit Blocked

```
1. bun run devops mark <id> blocked "reason"
2. Report: "✗ <unit-name> BLOCKED: <reason>"
3. Continue to next unit (Workflow 1, step 1)
```

### Invariant Violation (Category B)

```
1. Hard block — must fix before commit
2. bun run devops invariants check --category B
3. Read violation details
4. Fix the architectural violation
5. Re-check: bun run devops invariants check --category B
```

### ADR Stuck in IN_REVIEW

```
1. bun run devops decision show <id>
2. Check review rounds: bun run devops decision prompt <id>
3. Add missing review (AI or human)
4. Proceed to decide
```
