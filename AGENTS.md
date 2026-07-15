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

Non-negotiable constraints enforced by `bun run devops invariants check`.

### Critical Boundaries (Never Violate)

1. **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
3. **Research-First:** No implementation without research report classification.
4. **Phase Gates:** Phase N requires phase N-1 complete.

### One Entry Point (v10 Invariant)

Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that
call `POST /api/interpret` → `POST /api/capabilities/:id/execute`.

- **New capability?** Register in `registerDefaultCapabilities` / a `*caps.ts` module.
- **New NL phrase?** Add a pattern to `catalog.ts` bound to a `capabilityId`.
- **Never:** hand-write CLI commands, hand-write UI actions, or open a second transport.

#### Adding a Capability

Use Unit 24.1 (registry contract), Unit 24.3 (CLI generation), and Unit 25.1 (catalog binding):

1. Create a capability in `src/engines/*caps.ts` using `makeCapability` or `registerSessionCaps` pattern
2. Register it with `surfaces: ['cli', 'ui', 'api']` to enable all transports
3. Add NL patterns to `src/engines/nlcl/catalog.ts` linking to your capabilityId
4. Add `cliCommand`, `ui`, and `mcpToolName` for cross-surface parity

### Taxonomy Chain Gotchas (CRITICAL)

Lessons from building the taxonomy generation pipeline and cross-surface verification.

1. **UI slot IDs must be namespaced** — The frontend `SLOT_IDS` in `web/ui/src/ui/slots.ts` use `chat.actionBar`, `chat.composer`, `chat.sidebar` (not short names). The taxonomy pipeline's `CATEGORY_POSITIONS` table must use these exact values or `ui_position` silently fails.

2. **Capability nodes may lack `category`** — Shared capability nodes often have no `category` field. When generating `apiEndpoint.path`, derive category from `slug.split('_')[0]` — not `node.category`.

3. **`Bun.spawn` exitCode is null** — `proc.exitCode` returns `null` until `await proc.exited` resolves. Always await the promise before reading exit code.

4. **Single-segment slugs** — `capId` format is `cap:${category}:${action}`. For single-segment slugs (e.g. `help`), use `cap:help:help` — never `cap:undefined:help`.

5. **Verify after taxonomy changes** — Run `bun run devops verify-cross-surface` after any change to taxonomy pipeline, shared pool, or skeleton platforms. It checks CLI (name), API (path), MCP (tool name), UI (slot id).

## Shell Environment (CRITICAL)

**All commands MUST be PowerShell-compatible.** The default shell is PowerShell 7+.

### PS1 Script Invocation (CRITICAL — NEVER GET WRONG)

PS1 scripts use `$PSScriptRoot` to find the project root. This auto-variable is `$null`
when the script is NOT invoked as a direct file — causing ALL downstream paths to collapse.
These scripts start/stop the backend, frontend, and health monitor:

| Script | Purpose |
|--------|---------|
| `scripts/start-all.ps1` | Launch backend + frontend, fully detached |
| `scripts/start-backend.ps1` | Launch backend only |
| `scripts/start-frontend.ps1` | Launch frontend only |
| `scripts/stop-all.ps1` | Stop all services (infallible) |
| `scripts/health-check.ps1` | Continuous health monitoring |

**✅ CORRECT — always use `pwsh scripts/<name>.ps1` from repo root:**
```powershell
# From repo root (C:\0-BlackBoxProject-0\vivim-final):
pwsh scripts/start-all.ps1
pwsh scripts/start-backend.ps1
pwsh scripts/start-frontend.ps1
pwsh scripts/stop-all.ps1
```

**❌ NEVER do any of these (they silently break `$PSScriptRoot`):**
```powershell
Get-Content scripts/start-all.ps1 | pwsh -            # inline pipe → $null
pwsh -c "scripts/start-all.ps1"                       # -c string → $null
pwsh -Command ".\scripts\start-all.ps1"               # -Command → $null
& "scripts/start-all.ps1"                              # call-operator → $null
Start-Process pwsh -ArgumentList "scripts\start-all.ps1"  # nested pwsh → path broken
pwsh -File scripts/start-all.ps1                      # -File from wrong CWD → path wrong
```

### PowerShell Command Patterns
```powershell
# Navigate to project root
Set-Location "C:\0-BlackBoxProject-0\vivim-final"

# Run typecheck with output capture
bun run typecheck 2>&1 | Select-Object -First 50

# List engine files
Get-ChildItem -Path src/engines -Recurse -Filter *.ts

# Search for TODOs in codebase
Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String -Pattern "TODO"
```

## Testing Protocol

- Run `bun test` before every commit
- Run `bun run typecheck` to catch type errors
- Run `bun run lint` to catch style issues
- Run `bun run devops audit-code [surface|standard|deep|full]` for a source-code audit (P0–P3 findings + fix instructions); `audit-code fix <id> [--apply]` applies auto-fixable ones
- Run `bun run devops verify-cross-surface` after any taxonomy chain change (verifies every capability resolves across CLI/API/MCP/UI)
- Use `bun test tests/unit/engines/[engine-name]` for targeted testing
- Integration tests should use in-memory or test database
- **ALWAYS** use PowerShell-compatible commands

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One logical change per commit
- Reference engine names in commits: `feat(CapabilityEngine): add selector resolution`

## MCP Servers

- **Playwright** — browser automation for E2E testing and UI validation

---

**For devops workflow, atomic task tracking, and implementation protocols:** Load the relevant skills from `.kilo/skill/`.

## Available Skills

- **devops** — Autonomous implementation loop for atomic units
- **devops-research** — Research-first intelligence layer with web search and brief generation
- **devops-roadmap** — Research-first roadmap with truth scanning and gap discovery
- **devops-generators** — Taxonomy generation (PlatformCatalog + ProviderCapabilityTaxonomy) with 4-round pipeline (skeleton → drill-down → UI slot mapping → cross-surface binding)
- **source-audit** — P0-P3 source-code audit with 4 depth tiers
- **prisma-workflow** — Prisma patterns and workflows for schema/migrations
- **vivim-build** — DEPRECATED: Use `devops` skill instead
- **vivim-testing** — Testing patterns and test infrastructure
- **vivim-runtime** — DEPRECATED: Use `devops` skill instead

## vivim-runtime — Agentic Dev Loop

Agent becomes the runtime of its own dev loop. Every command exits bounded, returns structured JSON, never hangs.

```bash
# Full loop (default 5 cycles, autonomous)
bun run devops runtime-test

# Custom
bun run devops runtime-test loop --max-cycles=3 --mitm

# Individual
bun run devops runtime-test preflight
bun run devops runtime-test discover-backend
bun run devops runtime-test test --nl "list conversations"
```

**Modes:** autonomous (full loop) | mitm (pauses after debug for agent decision)

**Agent-safety:** 15s bootstrap timeout, 5s per fetch, 2min overall cap, fast-port if server alive.

**Skill source:** `.kilo/skills/vivim-runtime/SKILL.md` (devops dir, source of truth)
**Harness copy:** `.opencode/skill/vivim-runtime/SKILL.md` (generated from source)