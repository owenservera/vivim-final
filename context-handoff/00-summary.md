# Context Handoff Summary

This directory contains 15 files summarizing the vivim-final project state.

## Files
1. `01-project-brief.md` — Project overview and stack
2. `02-architecture.md` — Folder structure and engine dependencies
3. `03-dependencies.md` — Package dependencies and scripts
4. `04-engines.md` — Core + SOTA engines reference
5. `05-storage-contracts.md` — Store contract interfaces
6. `06-chrome-integration.md` — ChromeGovernor + CDP transport
7. `07-server-api.md` — REST API + WebSocket endpoints
8. `08-cli.md` — CLI commands and usage
9. `09-error-handling.md` — Error hierarchy and patterns
10. `10-testing.md` — Test structure and commands
11. `11-frontend.md` — Frontend sandbox + ActionRegistry
12. `12-database.md` — Prisma schema tables
13. `13-progress.md` — Current phase status (219/225 done)
14. `14-dev-commands.md` — Development commands
15. `15-glossary.md` — Shared terminology

## Key Files to Read Next
- `src/engines/chrome-governor.ts` — Chrome CDP authority
- `src/executor/fleet-supervisor.ts` — Fleet state machine
- `src/engines/unified-registry.ts` — Unified capability registry
- `prisma/schema.prisma` — Database schema
- `docs/atomic/01-tracker.md` — Live progress tracker

## Verification
```powershell
bun run typecheck  # Must pass
bun test           # All tests green
```