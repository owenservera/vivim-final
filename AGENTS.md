# AGENTS.md — vivim-final Project Instructions

## Project Overview

**vivim-final** is cap-store v1 Knowledge Graph Rebuild — a local-first AI conversation platform built with Bun + Prisma + TypeScript.

- **Runtime:** Bun
- **Language:** TypeScript (strict mode, ESNext target)
- **ORM:** Prisma v6.5
- **Linter/Formatter:** Biome
- **Git Hooks:** Lefthook
- **Testing:** Bun test runner
- **Build:** tsup (ESM + DTS)

## Architecture

13 engines organized in layers:
- **L0-L1:** Provider Knowledge Graph (ProviderRegistrar, ProviderHealthKernel)
- **L2-L3:** Capability System (CapabilityResolutionEngine, CapabilityEngine)
- **L4:** Session & State (ConversationManager, StreamBlockStore)
- **Chrome Layer:** ChromeGovernor (CDP proxy, lifecycle, trace, health)
- **Cross-cutting:** CapabilityEventBus, ConfigManager, StreamParserEngine
- **Lifecycle:** RegistrationAuditor, VersionManager, TelemetryAggregator

Design docs are in `docs/merged-design-v2/`. Read in order 00-08 for v1, then SOTA-00 through SOTA-09.

## Code Conventions

### TypeScript
- Use `@/*` path aliases (maps to `./src/*`)
- Prefer `type` imports: `import type { Foo } from './bar.js'`
- Use `.js` extension in imports (Bun ESM requirement)
- No `any` — use `unknown` + type narrowing
- Use Zod for runtime validation at boundaries
- Prefer `const` over `let`, avoid `var`
- Use ULID for IDs (`src/ids.ts`)
- Export from `src/index.ts` as barrel

### Error Handling
- Custom error classes from `src/errors.ts`
- Never swallow errors silently
- Use `Result<T, E>` pattern where appropriate
- Log errors with context before throwing

### Database
- All schema in Prisma (`prisma/schema.prisma`)
- Migrations via `bunx prisma migrate dev`
- Seeds in `seeds/` directory
- Use transactions for multi-table writes
- Never bypass Prisma for raw SQL unless performance-critical

### Testing
- Unit tests: `tests/unit/` — test individual functions
- Integration tests: `tests/integration/` — test engine interactions with mocked stores
- E2E tests: `tests/e2e/` — full stack tests
- Mock store contracts for unit/isolation tests
- Aim for 80%+ coverage on engines

### File Organization
```
src/
  cli/          # CLI entry points
  config.ts     # Configuration
  engines/      # Core engines (one file per engine)
  errors.ts     # Custom error classes
  ids.ts        # ID generation (ULID)
  index.ts      # Public barrel exports
  schema/       # Zod schemas
  server/       # HTTP server / API routes
  storage/      # Database access layer (Prisma wrappers)
tests/
  unit/         # Unit tests
  integration/  # Integration tests
  e2e/          # End-to-end tests
  helpers/      # Test utilities
seeds/          # Database seed files
```

## When Implementing Engines

1. Read the engine spec from `docs/merged-design-v2/04-merged-engines.md` or `05-merged-lifecycles.md`
2. Define TypeScript interface first (match spec exactly)
3. Define Store Contract (what the engine needs from storage)
4. Implement with proper error handling
5. Write unit tests with mocked store contract
6. Write integration tests for engine-to-engine interactions

## Invariants (Boundary Conditions)

**Full document:** `docs/roadmap/INVARIANTS.md`

Non-negotiable constraints that govern all planning and development. Enforced by `bun run devops invariants check`.

### Quick Reference

| Category | Violation | Enforcement |
|----------|-----------|-------------|
| **A: Ground Truth** | Hard block | Research report required before `[~]`, classification mandatory |
| **B: Architectural** | Hard block | No engine imports BunCdpClient, no `-impl` imports, seeds not code, relational first, config through ConfigManager, harness server-side, no raw `new Error()` |
| **C: Planning** | Hard block | Phase gates, dependency gates, atomic specs required, design doc reference |
| **D: Quality** | Soft warning | Engine tests with mocked stores, no `any` in engines, barrel exports |
| **E: Goal Invariants** | Soft warning | Key results must have targets, goals must have owners, units should reference goals |

### Commands

```bash
bun run devops invariants check              # check all invariants
bun run devops invariants check --unit 11.5  # check for specific unit
bun run devops invariants check --category B # check architectural only
bun run devops invariants report             # compliance report
bun run devops gate                          # includes invariant check as final step
```

### Critical Boundaries (Never Violate)

1. **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
3. **Research-First:** No implementation without research report classification.
4. **Phase Gates:** Phase N requires phase N-1 complete.

## Architecture Decision Records (ADR)

Standards-based decision tracking system in `docs/decisions/`. Separate from the interview protocol (which tracks discovery/approval of atomic units). ADRs track architectural decisions with multi-round review.

### When to Use ADRs
- **Architecture decisions** — transport layer, state management, error handling patterns
- **Design trade-offs** — choosing between 2+ viable options
- **Cross-cutting concerns** — logging, testing strategy, build tooling
- **NOT for implementation details** — those go in atomic specs

### Workflow

```
1. bun run devops decision create    # Create ADR with options
2. bun run devops decision review    # Add AI/human review rounds (min 2)
3. bun run devops decision decide    # Select option with rationale
4. bun run devops decision approve   # Final approval
```

### Rules
- **Minimum 2 options** must be considered
- **Minimum 2 review rounds** (AI + human) before decision
- ADRs are stored as markdown in `docs/decisions/ADR-NNN-title.md`
- Status flow: PROPOSED → IN_REVIEW → REVISED → IN_REVIEW → DECIDED → APPROVED

### Commands

```bash
bun run devops decision create --title "..." --author "..."  # Create new ADR
bun run devops decision list                                   # List all ADRs
bun run devops decision show ADR-001                           # Show ADR details
bun run devops decision review ADR-001                         # Add review round
bun run devops decision decide ADR-001 --option A --rationale "..."  # Select option
bun run devops decision approve ADR-001                        # Approve decision
```

## Goals System (OKR Hierarchy)

Goal → Objective → Key Result hierarchy for governing user journeys and product goals. Lives in `docs/goals/GOALS.md`.

### Hierarchy

```
Goal (owner, timeframe, status, completion%)
├── Objective (status, completion%)
│   ├── Key Result (target, current, relatedUnits)
│   └── Key Result (target, current, relatedUnits)
└── Objective
    └── Key Result
```

### How It Works

- **Progress flows bottom-up:** Key Result → Objective → Goal (averages)
- **Goal-aware selection:** Units prioritized by goal contribution (count of key results they contribute to)
- **ADR integration:** `goalAlignment` scores (1-5) on ADR options, `relatedGoals` array
- **File:** Single `docs/goals/GOALS.md` (single-developer project)

### Commands

```bash
bun run devops goals list                  # Show all goals with progress
bun run devops goals show G-001            # Show single goal detail
bun run devops goals create --title "..." --description "..." --owner "..." --timeframe "..."
bun run devops goals update G-001 --status achieved
bun run devops goals progress              # Recalculate from atomic tracker
bun run devops goals align G-001           # Show goal↔ADR alignment
bun run devops goals score ADR-001         # Suggest alignment scores for ADR options
bun run devops goals report                # Full progress report (markdown)
bun run devops goals dashboard             # Goal health dashboard with invariants
```

## Shell Environment (CRITICAL)

**All commands MUST be PowerShell-compatible.** The default shell is PowerShell 7+.

### Forbidden Unix Commands
Do NOT use these Unix commands — they do not exist in PowerShell:
- `head` / `tail` → Use `Select-Object -First N` / `Select-Object -Last N`
- `grep` → Use `Select-String -Pattern "regex"`
- `cat` → Use `Get-Content`
- `wc` → Use `(Get-Content).Count`
- `chmod` / `chown` → Not applicable on Windows
- `which` → Use `Get-Command`
- `curl` → Use `Invoke-WebRequest` or `Invoke-RestMethod`
- `ls` → Use `Get-ChildItem`
- `cp` / `mv` → Use `Copy-Item` / `Move-Item`
- `rm` → Use `Remove-Item`
- `mkdir` → Use `New-Item -ItemType Directory`
- `touch` → Use `New-Item`
- `echo` → Use `Write-Output` or `Write-Host`

### PowerShell Command Patterns
```powershell
# Piping with output filtering
bun run typecheck 2>&1 | Select-Object -First 50

# Chaining commands
Set-Location "C:\0-BlackBoxProject-0\vivim-final"; bun run typecheck

# Run multiple commands sequentially
bun run typecheck; bun run lint; bun test

# Run command and capture output
$output = bun run typecheck 2>&1; $output | Select-String -Pattern "error"

# List files (use Get-ChildItem, not ls)
Get-ChildItem -Path src/engines -Recurse -Filter *.ts

# Search file contents (use Select-String, not grep)
Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String -Pattern "TODO"
```

## Testing Protocol

- Run `bun test` before every commit
- Run `bun run typecheck` to catch type errors
- Run `bun run lint` to catch style issues
- Use `bun test tests/unit/engines/[engine-name]` for targeted testing
- Integration tests should use in-memory or test database
- **ALWAYS** use PowerShell-compatible commands — see Shell Environment section above

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One logical change per commit
- Reference engine names in commits: `feat(CapabilityEngine): add selector resolution`

## MCP Servers

- **Playwright** — browser automation for E2E testing and UI validation
- Use Playwright tools for testing web interfaces, taking screenshots, validating UI state

## Agent Usage

- **build** (default) — Use for all implementation work
- **plan** — Use for architecture analysis, design review, planning
- **@test** — Use for writing/fixing tests, coverage analysis
- **@review** — Use for code review, quality checks
- **@db** — Use for Prisma schema changes, migrations, seeds
- **@debug** — Use for investigating bugs, analyzing failures

## Ralph Loop — Auto-Implement Mode

When user says **"IMPLEMENT ALL"**, **"ralph loop"**, **"keep going"**, or **"continue"**:

### Session Planning: Design Fidelity Cross-Check

Before starting any batch of atomic tasks (e.g., tasks 2.1–2.4, or a full phase), **audit the atomic files against the original design source** to ensure faithfulness.

#### Protocol
1. **Read the source design docs** — identify which `docs/merged-design-v2/*.md` files cover the batch's domain (e.g., `04-merged-engines.md` for engine units, `sota-01-priority-pipe-mirror.md` for Phase 7)
2. **Read each atomic task file** in the batch (`docs/atomic/phase-X-*/`)
3. **Cross-check** — for each atomic file, verify:
   - Interface signatures match the design doc's spec (method names, params, return types)
   - Store contracts cover all data access the design implies
   - Dependencies listed match the design's actual dependency chain
   - No invented abstractions or missing abstractions vs. the design
   - Error handling patterns align with design intent
4. **Report findings** — for each atomic file, output one of:
   - `✓ FAITHFUL` — matches design, ready to implement
   - `⚠ DRIFT: <description>` — mismatch found, needs correction before coding
5. **Fix drift** — if any `⚠ DRIFT` findings, update the atomic file to match the design BEFORE implementing
6. **Proceed** — only after all atomic files in the batch are `✓ FAITHFUL`, begin implementation

#### When to Run
- **First session of the day** — always cross-check before coding
- **New phase start** — cross-check the full phase before first unit
- **After design doc edits** — re-audit affected atomic files
- **Skipping is forbidden** — never implement an atomic file without confirming faithfulness

### Protocol
1. Read `docs/atomic/01-tracker.md` for current status
2. Read `docs/atomic/00-master-plan.md` for dependency graph
3. Find the **next unblocked [ ] unit** (all dependencies are [x])
4. Mark it **[~]** in tracker (in progress)
5. Read the unit's atomic file from `docs/atomic/`
6. Implement: create/edit source files, write code per the interface + store contract
7. Run validation: `bun run typecheck` + run relevant tests
8. If validation passes → mark **[x]** in tracker, report progress
9. If validation fails → fix, retry (up to **3 attempts**)
10. Go to step 3

### Stop Conditions
- **All units [x]** → "RALPH LOOP COMPLETE. All 95+ units done."
- **Unit blocked [!]** → mark blocked, report reason, skip to next
- **Test fails 3+ retries** → mark [!], report "Blocked: <reason>", continue to next unit
- **User interrupts**

### Critical Rules
- **NEVER ask "Should I continue?" / "Want me to proceed?" / "Ready for next?"**
- **NEVER pause between units** unless blocked
- **ALWAYS report progress**: "✓ unit-name | done: 23/95 | next: next-unit-name"
- **ALWAYS read the atomic file before implementing** — it has the full interface
- If a unit is already done (files exist + tests pass), mark it [x] and move on

## DevOps Roadmap — Research-First Workflow

**The devops-roadmap system is THE entry point for new atomic tasks** — both AI-recommended and user-suggested. Grounded in the atomic list + truth system.

### When to Load

**BEFORE the devops loop starts:**
1. Starting a new devops session (before `bun run devops select`)
2. Beginning a new phase (first unit of phase N)
3. User says "what already exists?" or "research first"
4. After completing a unit (to discover new gaps)
5. User suggests a new feature or unit

**Do NOT load when:**
- Resuming an in-progress unit (just run devops loop)
- Unit is already clearly defined and ready to implement

### Commands

| Command | Purpose |
|---------|---------|
| `bun run devops roadmap` | Full research cycle (scan + discover + report) |
| `bun run devops roadmap --unit <id>` | Research single unit |
| `bun run devops roadmap --domain <name>` | Research domain |
| `bun run devops roadmap --discover` | Run discovery only (identify new unit candidates) |
| `bun run devops roadmap --interview <GAP-id>` | Start interview for discovered unit |
| `bun run devops roadmap --merge` | Merge enriched data into tracker (after review) |
| `bun run devops roadmap --merge-unit <id>` | Merge specific new unit (after interview approval) |

### Workflow

```
1. Run `bun run devops roadmap` — produces:
   - docs/roadmap/RESEARCH-REPORT.md (per-unit research)
   - docs/roadmap/DISCOVERED-UNITS.md (candidate future units)
   - docs/roadmap/DOMAIN-HEALTH.md (truth scores per domain)

2. Read research report before implementing each unit:
   - Classification: DONE / PORT / CREATE / FIX
   - Existing code analysis
   - Cap-store reference (if porting)
   - Gap analysis
   - Effort estimate

3. For discovered units:
   - Run `bun run devops roadmap --interview <GAP-id>`
   - Answer questions about the unit
   - AI synthesizes atomic spec draft
   - If approved → merge to tracker
```

### Unit Classification

| Classification | Meaning | Action |
|----------------|---------|--------|
| DONE | Already fully implemented | Skip (don't re-implement) |
| PORT | Exists in vivim-final core, needs adaptation | Implement against vivim-final source |
| CREATE | Doesn't exist anywhere | Implement new |
| FIX | Exists but has stubs | Complete stub methods |

### Integration with DevOps Loop

```
LOOP:
  1. sel = `bun run devops select`
  2. `bun run devops mark <id> in_progress`
  3. Read unit's atomic file
  4. Fidelity:
     a. Read docs/roadmap/RESEARCH-REPORT.md for this unit
     b. If classification is DONE → skip (already implemented)
     c. Cross-check against design docs
     d. Log DRIFT if found
  5. Implement + write tests
  6. `bun run devops gate`
     - PASS → commit, goto LOOP
     - FAIL → fix, retry (max 3)
     - >3 fails → mark blocked, goto LOOP
  7. AFTER COMPLETION: Run `bun run devops roadmap --discover`
     (Check if this unit's completion revealed new gaps)
```

## Atomic Tracker System

**File:** `docs/atomic/01-tracker.md` — single source of truth for implementation progress.

### States
| Mark | State | Meaning |
|------|-------|---------|
| `[ ]` | pending | Not started, waiting for dependencies |
| `[~]` | in_progress | Currently being worked on |
| `[x]` | done | Implemented, tested, typecheck passes |
| `[!]` | blocked | Cannot proceed (test failure, missing dep, design conflict) |

### Protocol
- **After EVERY unit completion**, update the tracker
- Report progress in format: `✓ unit-name | done: N/95 | next: next-unit-name`
- When starting a new agent session, read the tracker FIRST to know where to resume
- The tracker is authoritative — if it conflicts with file state, update the tracker

### Report Format
```
✓ ChromeGovernor.boot() | done: 23/95 (Phase 3: 6/15) | next: CDPProxy
```

## DevOps Workflows — AI Agent Orchestration

**Full reference:** `docs/roadmap/DEVOPS-WORKFLOWS.md`

5 core workflows that connect goals, decisions, tracker, invariants, and gate into a coherent loop.

### Quick Decision Tree

```
What do you need to do?
├── "implement next" / "keep going"     → Workflow 1: Implement a Unit
├── "decide on X" / "Y or Z?"          → Workflow 2: Make an Architecture Decision
├── "what's missing?" / "research first" → Workflow 3: Discover and Onboard New Units
├── "check progress" / "how are goals?" → Workflow 4: Goal Review and Recalibration
└── "run checks" / "verify"            → Workflow 5: Quality Assurance
```

### Workflow 1: Implement a Unit (Main Loop)

```
select → mark in_progress → read atomic file → fidelity cross-check
→ implement → gate → mark done → goals progress → discover gaps → LOOP
```

Key commands:
```bash
bun run devops select                    # Get next unit
bun run devops mark <id> in_progress     # Start work
bun run devops gate                      # Validate (typecheck + lint + test + invariants)
bun run devops mark <id> done            # Complete
bun run devops goals progress            # Recalculate goal completion
bun run devops roadmap --discover        # Check for new gaps
```

### Workflow 2: Make an Architecture Decision

```
create ADR → fill options → score goals → AI review → human review → decide → approve
```

Key commands:
```bash
bun run devops decision create --title "..." --author "..."
bun run devops goals score ADR-NNN           # Suggest goal alignment
bun run devops decision prompt ADR-NNN       # Generate review questions
bun run devops decision review ADR-NNN --reviewer "..." --feedback "..."
bun run devops decision decide ADR-NNN --option A --rationale "..."
bun run devops decision approve ADR-NNN
```

### Workflow 3: Discover and Onboard New Units

```
discover → interview → merge to tracker → update dependencies
```

Key commands:
```bash
bun run devops roadmap --discover           # Find candidates
bun run devops roadmap --interview <GAP-id> # Interview
bun run devops roadmap --merge-unit <id>    # Add to tracker
```

### Workflow 4: Goal Review and Recalibration

```
list → dashboard → progress → align → report → update
```

Key commands:
```bash
bun run devops goals list                   # All goals
bun run devops goals dashboard              # Health view
bun run devops goals progress               # Recalculate
bun run devops goals align G-001            # Goal↔ADR alignment
bun run devops goals report                 # Full report
bun run devops goals update G-XXX --status achieved
```

### Workflow 5: Quality Assurance

```
pre-commit hooks → pre-push tests → manual gate check
```

Key commands:
```bash
bun run devops gate                         # Full gate
bun run devops gate --strict                # Strict (new issues = fail)
bun run devops invariants check             # All categories
bun run devops invariants check --category B # Architectural only
bun run devops invariants report            # Compliance report
```

### Critical Rules

- **NEVER ask "Should I continue?"** — just go to next unit
- **NEVER pause between units** unless blocked
- **ALWAYS report progress** after each unit: `✓ <name> | done: N/127 | next: <name>`
- **ALWAYS read the atomic file** before implementing
- **ALWAYS run gate** before marking done
- **NEVER skip fidelity cross-check** — design drift is the enemy

---

## Key Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start dev server |
| `bun test` | Run all tests |
| `bun run typecheck` | TypeScript check |
| `bun run lint` | Biome lint |
| `bun run format` | Auto-format |
| `bun run migrate` | Run migrations |
| `bun run seed` | Seed database |
| `/check` | Full quality gate |
| `/ship` | Pre-merge verification |
| `bun run devops goals list` | Show all goals with progress |
| `bun run devops goals dashboard` | Goal health dashboard with invariants |

### PowerShell Command Examples
```powershell
# Navigate to project root
Set-Location "C:\0-BlackBoxProject-0\vivim-final"

# Run typecheck with output capture
bun run typecheck 2>&1 | Select-Object -First 50

# List engine files
Get-ChildItem -Path src/engines -Recurse -Filter *.ts

# Search for TODOs in codebase
Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String -Pattern "TODO"

# Count test files
(Get-ChildItem -Path tests -Recurse -Filter *.ts).Count

# Check for specific error patterns
bun run typecheck 2>&1 | Select-String -Pattern "error TS"
```
