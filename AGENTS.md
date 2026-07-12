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

## Shell Environment (CRITICAL)

**All commands MUST be PowerShell-compatible.** The default shell is PowerShell 7+.

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