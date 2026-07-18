# Dependencies

## Runtime
- Bun (primary runtime)

## External Packages
| Package | Version | Purpose |
|---------|---------|---------|
| @prisma/client | 6.5.0 | ORM client |
| prisma | 6.5.0 | ORM CLI |
| ulid | 2.3.0 | ID generation |
| zod | 3.24.2 | Runtime validation |
| alasql | 4.17.3 | In-memory SQL |

## Dev Dependencies
| Package | Purpose |
|---------|---------|
| biome | Formatting/linting |
| lefthook | Git hooks |
| tsup | Build bundler |

## Scripts
| Script | Command |
|--------|---------|
| typecheck | bunx tsc --noEmit |
| lint | biome check --apply . |
| format | biome format --apply . |
| test | bun test |
| build | tsup