# CLI Commands

## Development
```bash
bun run typecheck      # TypeScript checking
bun run lint           # Biome formatting/linting
bun run build          # tsup bundler
bun test              # Run all tests
```

## Database
```bash
bunx prisma migrate dev    # Create migration
bunx prisma db seed        # Seed database
bunx prisma studio         # Open studio
```

## Running Servers
```bash
bun src/server/index.ts    # HTTP + WebSocket server
bun src/cli/index.ts       # CLI entry
```

## Dev Automation Hooks
- Lefthook + Biome for pre-commit
- See `.lefthook/pre-commit` for hook definitions

## Available Scripts (from package.json)
- `typecheck` — Type checking
- `lint` — Biome check
- `format` — Biome format
- `test` — Bun test
- `build` — tsup