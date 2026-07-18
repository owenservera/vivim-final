# Architecture Overview

## Folder Structure

```
src/
  cli/          # CLI entry points and commands
  config.ts     # Configuration
  engines/      # Core engines (one file per engine)
  errors.ts     # Custom error classes (CapStoreError hierarchy)
  ids.ts        # ID generation (ULID-based)
  index.ts      # Public barrel exports
  schema/       # Zod schemas
  server/       # HTTP server / API routes
  storage/      # Database access layer
    contracts/  # Store interfaces (what engines need)
    impl/       # Prisma implementations
  executor/     # CDP transport and fleet management
tests/
  unit/         # Unit tests
  integration/  # Integration tests
  e2e/          # End-to-end tests
seeds/          # Database seed files
  providers/    # 7 provider manifests
  parsers/      # 6 parser seeds
  harness/      # 5 harness modules + stealth
```

## Key Files

| File | Purpose |
|------|---------|
| `src/engines/chrome-governor.ts` | Chrome CDP slave lifecycle management |
| `src/engines/conversation-manager.ts` | 8-step conversation pipeline |
| `src/engines/stream-block-store.ts` | Content block persistence |
| `src/engines/capability.ts` | UnifiedCapability definition |
| `src/executor/fleet-supervisor.ts` | Fleet state machine |
| `src/executor/cdp-transport.ts` | Real CDP transport layer |
| `src/index.ts` | Barrel exports for all engines |
| `src/server/index.ts` | Bun.serve REST + WebSocket server |
| `src/cli/index.ts` | CLI entry with remote server communication |

## Engine Dependencies

```
Phase 1 (Skeleton) -> Phase 2 (Providers) -> Phase 3 (Governor) -> Phase 4 (Engines)
      |                      |                      |                     |
      v                      v                      v                     v
   Phase 5 (Server)      Phase 6 (Ship)      Phase 7-10 (SOTA)    Phase 11+ (Executor)
```

## Storage Pattern
- Engines import from `src/storage/contracts/*.ts` (interfaces only)
- Implementations in `src/storage/impl/*-impl.ts`
- Prisma client singleton in `src/storage/prisma.ts`