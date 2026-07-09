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
