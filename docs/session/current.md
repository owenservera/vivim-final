# Session: 2026-07-19 — cap-store → dev.db Migration

## Meta
- **Priority:** P0
- **Provider:** all
- **Started:** 2026-07-19 02:00
- **Status:** in_progress

## Goal
Port ALL intelligence from legacy cap-store DB (2,381 rows) into vivim-final dev.db so that the CapabilitySnapshot loader finds all 253 taxonomy entries, 104 bindings, and 104 programs at boot.

## Preconditions
- [x] Legacy DB analyzed: `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\data\capability-store.db`
- [x] Dev.db analyzed: `C:\0-BlackBoxProject-0\vivim-final\prisma\dev.db`
- [x] Both DBs dumped to `docs/legacy/`
- [x] Schema mapping complete (see `.runtime/HANDOFF-migration.md`)
- [x] Execution model understood (SnapshotRow → Recipe → browserHarness.runAction)

## Steps
- [x] Step 1: Dump legacy cap-store DB to SQL — `docs/legacy/cap-store-dump.sql` (620KB, 2381 rows)
- [x] Step 2: Dump dev.db to SQL — `docs/legacy/devdb-dump.sql` (203KB, 371 rows)
- [x] Step 3: Compare schemas — identified 14 tables only in legacy, 121 only in dev.db
- [x] Step 4: Map execution model — SnapshotRow needs taxonomy+binding+program join
- [x] Step 5: Write handoff doc — `.runtime/HANDOFF-migration.md`
- [ ] Step 6: Write migration script — `.runtime/migrate-cap-store.ts`
- [ ] Step 7: Run migration against dev.db
- [ ] Step 8: Verify SnapshotRow loader returns all capabilities
- [ ] Step 9: Restart server, confirm capabilities register

## Key Findings

### Legacy cap-store has 3 layers of intelligence:
1. **Provider definitions** (7 providers): chatgpt, claude, deepseek, gemini, studio-ai, z-ai, qwen
2. **Capability taxonomy** (253 capabilities): send-prompt, open-model-menu, etc. across 13 categories
3. **Execution programs** (104 programs): ActionStep[] arrays with selectors, CDP steps
4. **UI discoveries** (677 holes): buttons, inputs, nav elements per provider
5. **Execution history** (629 outcomes): ok/fail results with timing

### Dev.db is missing critical execution data:
- `provider_definition`: 0 rows (needs 7 providers)
- `capability_taxonomy`: 57 rows (needs 253 — only CDP methods seeded)
- `capability_binding`: 57 rows (needs 104)
- `capability_program`: 0 rows (needs 104 — THE ACTUAL CDP STEPS)
- `outcome`: 0 rows (needs 629)
- `hole`: TABLE NOT EXISTS (needs 677 → map to SelectorStrategy)

### Recipe format conversion needed:
Legacy `ActionStep[]` → dev.db `Recipe.steps: RecipeStep[]`
Each step needs `kind` field: type_text, click, submit, wait, navigate, capture, evaluate, etc.

## Blockers
- [none]

## Decisions
- Legacy `hole` table (677 rows) → convert to `SelectorStrategy` rows (dev.db has table but 0 rows)
- Legacy `outcome` table (629 rows) → compute aggregates into `CapabilityTelemetry` (not raw rows)
- Legacy `provider` → `provider_definition` with fields packed into JSON columns
- ID format: regenerate to match dev.db convention (keep existing dev.db IDs intact)

## Verification
- [ ] `bun run .runtime/migrate-cap-store.ts` completes without errors
- [ ] SnapshotRow count matches legacy (253 taxonomy, 104 bindings, 104 programs)
- [ ] `bun run devops runtime-test status` shows providers registered

## Completed

## Next Session
Read `.runtime/HANDOFF-migration.md` then write and run `migrate-cap-store.ts`.
