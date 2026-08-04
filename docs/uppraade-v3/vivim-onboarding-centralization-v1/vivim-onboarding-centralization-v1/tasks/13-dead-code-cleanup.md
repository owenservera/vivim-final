# Task 13 — Delete dead code + orphaned artifacts

**Phase**: D (Cleanup)
**Depends on**: Task 02 (relocate `checkNeedsSetup` first), Task 11 (confirm GuidedLanding is canonical)
**Effort**: 30 min
**Files touched**:
- DELETE: `frontend/src/features/onboard-flow.tsx`
- DELETE: `frontend/db/custom.db`
- DELETE: `migrations/001_baseline.sql`
- ARCHIVE: `scripts/_debug-launch.ts`, `scripts/_record_node_migration.ts`, `scripts/_record_node_layer_v2.ts`, `scripts/_verify_node_tables.ts`, `scripts/fix-b7-errors.ts`, `scripts/fix-b7-imports.ts` → `scripts/_archive/`
- MODIFY: `frontend/src/features/guided-landing.tsx` (relocate `checkNeedsSetup` if not already done)

## Context

Several files are dead code or orphaned artifacts:

1. **`frontend/src/features/onboard-flow.tsx`** (292 lines) — legacy 3-step card wizard, superseded by `guided-landing.tsx`. Not mounted on `page.tsx`. The only thing still used is `checkNeedsSetup`, which is re-exported through `guided-landing.tsx`.

2. **`frontend/db/custom.db`** (24 KB) — stale POC DB from legacy `DATABASE_URL=file:./db/custom.db` era. Flagged as PROLIFERATION/HIGH-risk by `report-db-inventory.ts`.

3. **`migrations/001_baseline.sql`** — orphaned raw SQL baseline (~54 tables). Acknowledged in audits as a second, parallel migration system that should be deleted and absorbed into Prisma migrations.

4. **One-shot debug/codemod scripts** — `scripts/_debug-launch.ts`, `scripts/_record_node_migration.ts`, `scripts/_record_node_layer_v2.ts`, `scripts/_verify_node_tables.ts`, `scripts/fix-b7-errors.ts`, `scripts/fix-b7-imports.ts`. These have already run; keeping them in `scripts/_archive/` preserves git history without cluttering the active scripts dir.

## Goal

Delete dead code, archive one-shot scripts, leave the repo lighter.

## Spec

### Step 1: Verify `checkNeedsSetup` is relocated

Before deleting `onboard-flow.tsx`, verify `checkNeedsSetup` is defined (or re-defined) in `guided-landing.tsx` itself, not just re-exported.

```bash
cd /home/z/my-project/vivim-final
grep -n "checkNeedsSetup" frontend/src/features/guided-landing.tsx
```

If `guided-landing.tsx` only has `export { checkNeedsSetup } from './onboard-flow'`, you need to inline the function. The function is ~5 lines:

```ts
export async function checkNeedsSetup(): Promise<boolean> {
  try {
    const res = await fetch('/api/setup/profiles');
    const data = await res.json();
    return !data?.profiles || data.profiles.length === 0;
  } catch {
    return true;  // Default to first-run on error
  }
}
```

Move this into `guided-landing.tsx` (or a new `frontend/src/lib/setup.ts` if you prefer). Update the import in `page.tsx` if needed:

```ts
// page.tsx
import { GuidedLanding, checkNeedsSetup } from '@/features/guided-landing';
// (was: import { checkNeedsSetup } from '@/features/onboard-flow';)
```

Also check for `PROVIDERS` and `detectProvider` exports from `onboard-flow.tsx` — if anything else imports them, relocate those too.

```bash
grep -rn "from.*onboard-flow" frontend/src/
```

### Step 2: Delete `onboard-flow.tsx`

```bash
rm frontend/src/features/onboard-flow.tsx
```

Verify nothing breaks:

```bash
cd frontend
bun run lint
bun run build
```

### Step 3: Delete `frontend/db/custom.db`

```bash
rm frontend/db/custom.db
# Also remove the empty db/ dir if it has nothing else
rmdir frontend/db 2>/dev/null || true
```

Search for any references and remove them:

```bash
grep -rn "custom.db" frontend/ src/ scripts/
```

If you find references (e.g. in a stale `.env` example or a script), update or delete them.

### Step 4: Delete `migrations/001_baseline.sql`

```bash
rm migrations/001_baseline.sql
# Also remove the empty migrations/ dir if it has nothing else
rmdir migrations 2>/dev/null || true
```

Search for references:

```bash
grep -rn "001_baseline" . --include="*.ts" --include="*.md" --include="*.json" --include="*.sh"
```

Update or delete any references.

### Step 5: Archive one-shot scripts

```bash
mkdir -p scripts/_archive
git mv scripts/_debug-launch.ts scripts/_archive/
git mv scripts/_record_node_migration.ts scripts/_archive/
git mv scripts/_record_node_layer_v2.ts scripts/_archive/
git mv scripts/_verify_node_tables.ts scripts/_archive/
git mv scripts/fix-b7-errors.ts scripts/_archive/
git mv scripts/fix-b7-imports scripts/_archive/
```

Add a `README.md` in `scripts/_archive/`:

```markdown
# Archived Scripts

These scripts have served their purpose and are kept here for historical reference.

- `_debug-launch.ts` — one-shot debug helper for Chrome launch.
- `_record_node_migration.ts` — recorded a migration in `migration_log` table.
- `_record_node_layer_v2.ts` — recorded node_layer_v2 migration.
- `_verify_node_tables.ts` — verified `node` + `node_edge` tables exist.
- `fix-b7-errors.ts` — one-shot codemod for audit findings.
- `fix-b7-imports.ts` — one-shot codemod for import fixes.

Do not run these. They are preserved for git-history reference only.
```

### Step 6: Verify

```bash
cd /home/z/my-project/vivim-final
bun run lint
bun run dev
# Open http://localhost:3000 — should still work
```

## Acceptance criteria

- [ ] `frontend/src/features/onboard-flow.tsx` is deleted.
- [ ] `checkNeedsSetup` is defined in `guided-landing.tsx` (or `lib/setup.ts`), not re-exported from `onboard-flow.tsx`.
- [ ] No file in `frontend/src/` imports from `onboard-flow`.
- [ ] `frontend/db/custom.db` is deleted.
- [ ] No file references `custom.db`.
- [ ] `migrations/001_baseline.sql` is deleted.
- [ ] No file references `001_baseline`.
- [ ] `scripts/_archive/` exists with the 6 one-shot scripts and a README.md.
- [ ] `bun run lint` passes.
- [ ] `bun run dev` boots without errors.
- [ ] `bun run build` succeeds.

## Verification

```bash
cd /home/z/my-project/vivim-final

# 1. Verify deletions
test ! -f frontend/src/features/onboard-flow.tsx && echo "✓ onboard-flow.tsx deleted"
test ! -f frontend/db/custom.db && echo "✓ custom.db deleted"
test ! -f migrations/001_baseline.sql && echo "✓ 001_baseline.sql deleted"

# 2. Verify no dangling imports
! grep -rn "from.*onboard-flow" frontend/src/ && echo "✓ no onboard-flow imports"
! grep -rn "custom.db" frontend/ src/ scripts/ && echo "✓ no custom.db references"
! grep -rn "001_baseline" . --include="*.ts" --include="*.md" --include="*.json" && echo "✓ no 001_baseline references"

# 3. Verify archive
ls scripts/_archive/

# 4. Build + run
cd frontend && bun run lint && cd ..
bun run dev
# Open http://localhost:3000 — should still work end-to-end
```

## Notes

- This task must come **after** Task 02 (so `/api/setup/*` routes exist and `checkNeedsSetup` works without `onboard-flow.tsx`) and Task 11 (so GuidedLanding is confirmed as canonical).
- Don't delete `MemoryOnboardingStore` — keep it for tests (Decision 11).
- Don't delete `prisma/migrations.bak/` in this task — that's a separate decision (the audit flagged it but it's lower priority). Leave for a future cleanup.
- If `git mv` fails because the files aren't tracked yet (e.g. they were created but not committed), use plain `mv` instead.
- The `frontend/db/` directory may have other files (e.g. `frontend/db/custom.db-journal` or similar). Delete those too — they're SQLite sidecar files for the deleted DB.
