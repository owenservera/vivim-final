# Quickstart: Run the wired parser system (020)

## 1. Harvest is encoded as inline DB logic
Parsers live in `seeds/parsers/harvested/*.ts` as inline `logic_code` factory strings and are
upserted into `provider_parser` by `seeds/parsers/harvest.seed.ts`.

## 2. Build real fallback chains
Each provider manifest declares `fallback` (e.g. claude → generic → system). The registrar's
2-pass insert (019) resolves the `fallbackParserId` graph at seed time.

## 3. Exercise at runtime
```bash
# Boot loads the snapshot + seeds parsers; server runs with SandboxRunner.
pwsh scripts/start-backend.ps1

# Parse a Claude SSE stream (uses StreamParserEngine → DB parser → sandbox):
curl -X POST localhost:9421/api/interpret -d '{"nl":"list conversations"}'

# A corrupted claude payload automatically falls through to generic → system.
```

## 4. Test
```bash
bun test tests/unit/engines/harvested-parser.test.ts \
       tests/unit/engines/stream-parser.test.ts \
       tests/unit/engines/capability-snapshot.test.ts
```

## 5. Regenerate fixture DB
```bash
DATABASE_URL="file:./tests/fixtures/parser-harvest-test.db" \
  bunx prisma db push --skip-generate --accept-data-loss
bun run seed:parsers --db "file:./tests/fixtures/parser-harvest-test.db"
```
