# Task 09 — Wire `PrismaOnboardingStore` into `PrismaStorageProvider`

**Phase**: D (Prove the swap)
**Depends on**: Task 08, v1-Task-09 (`PrismaOnboardingStore` + `UserOnboarding` Prisma model)
**Effort**: 30 min
**Files touched**:
- `frontend/src/storage/provider/prisma-storage-provider.ts` (swap one stub for the real impl)

## Context

v1's Task 09 created `PrismaOnboardingStore` (in `frontend/src/storage/impl/prisma-onboarding-store.ts`) and the `UserOnboarding` Prisma model. But v1 wired it via a hardcoded `if (process.env.NODE_ENV === 'production')` check in `canvas-engine-bootstrap.ts` — not via the provider abstraction.

This task moves that wiring into `PrismaStorageProvider.onboardingStore`, proving end-to-end that:
1. The env-driven swap works (`VIVIM_STORAGE_PROVIDER=prisma` selects the Prisma impl).
2. The provider abstraction correctly routes one store to Prisma while the rest stay as stubs.
3. `/api/storage/health` correctly reports the migration progress (1/24).
4. Onboarding state survives a server restart (the actual user-facing benefit).

## Goal

1. Replace the `NotImplementedErrorProxy` for `onboardingStore` in `PrismaStorageProvider` with `new PrismaOnboardingStore()`.
2. Verify `VIVIM_STORAGE_PROVIDER=prisma` makes `/api/onboarding/state` persist across restarts.
3. Verify `/api/storage/health` reports `migrationProgress: { migrated: 1, total: 24, pct: 4.17 }`.

## Spec

### Part 1: Update `PrismaStorageProvider`

In `frontend/src/storage/provider/prisma-storage-provider.ts`:

1. Uncomment the import at the top:
   ```ts
   import { PrismaOnboardingStore } from '../impl/prisma-onboarding-store';
   ```

2. Replace the `onboardingStore` property:
   ```ts
   // Before:
   readonly onboardingStore = NotImplementedErrorProxy.create(
     'onboardingStore', 'PrismaOnboardingStore',
   );

   // After:
   readonly onboardingStore = new PrismaOnboardingStore();
   ```

That's the entire code change. The rest is verification.

### Part 2: Verify the swap end-to-end

#### Step 2a: Confirm the health endpoint reports 1/24

```bash
cd frontend
VIVIM_STORAGE_PROVIDER=prisma bun run dev &
sleep 3
curl localhost:3000/api/storage/health | jq '.migrationProgress'
# Expected: { "migrated": 1, "total": 24, "pct": 4.17 }

curl localhost:3000/api/storage/health | jq '.stores.onboardingStore'
# Expected: { "impl": "PrismaOnboardingStore", "ready": true, "count": 0 }

curl localhost:3000/api/storage/health | jq '.stores.providerStore'
# Expected: { "impl": "NotImplementedErrorProxy", "ready": false, "count": null, "error": "PrismaProviderStore is not implemented yet..." }

kill %1
```

#### Step 2b: Confirm persistence across restart

```bash
# Start the server with prisma provider
VIVIM_STORAGE_PROVIDER=prisma DATABASE_URL="file:./test-onboarding.db" bun run dev &
sleep 3

# Push the schema (if not already done in v1)
bun x prisma db push

# Complete an onboarding step
curl -X POST localhost:3000/api/onboarding/complete \
  -H "Content-Type: application/json" \
  -d '{"userId":"user:persistence-test","stepId":"welcome"}'
# Expected: { "ok": true, "state": { "completedSteps": ["welcome"], ... } }

# Verify it's there
curl localhost:3000/api/onboarding/state?userId=user:persistence-test
# Expected: state with completedSteps: ["welcome"]

# Kill the server
kill %1

# Restart with the same DATABASE_URL
VIVIM_STORAGE_PROVIDER=prisma DATABASE_URL="file:./test-onboarding.db" bun run dev &
sleep 3

# Verify the state survived
curl localhost:3000/api/onboarding/state?userId=user:persistence-test
# Expected: SAME state with completedSteps: ["welcome"]
# (with VIVIM_STORAGE_PROVIDER=memory, this would return null because memory resets on restart)

kill %1
```

#### Step 2c: Confirm the CLI reports the migration

```bash
VIVIM_STORAGE_PROVIDER=prisma bun run storage:inspect | head -10
# Expected:
#   vivim storage inspection
#   ────────────────────────────────────────────────
#   provider:          prisma
#   migration:         1/24 (4.17%)
#   generated at:      ...
```

### Part 3: Cleanup

Delete the test DB:

```bash
rm -f frontend/test-onboarding.db frontend/test-onboarding.db-journal
```

If v1's hardcoded `if (process.env.NODE_ENV === 'production')` check is still in `canvas-engine-bootstrap.ts`, remove it now — the provider handles the swap. (If v1 was applied correctly, this check should already be gone, replaced by the provider call. Double-check.)

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/storage/provider/prisma-storage-provider.ts` | modified (one property swap) |

## Verification

1. `bun run tsc --noEmit` — passes.
2. Step 2a passes (health endpoint reports 1/24).
3. Step 2b passes (state survives restart with prisma, not with memory).
4. Step 2c passes (CLI reports 4.17% migration).
5. `VIVIM_STORAGE_PROVIDER=memory bun run dev` still works unchanged (memory path is unaffected).
6. `grep -n "NotImplementedErrorProxy" frontend/src/storage/provider/prisma-storage-provider.ts` — 23 matches (all stubs except onboarding).
7. `grep -n "PrismaOnboardingStore" frontend/src/storage/provider/prisma-storage-provider.ts` — one match (the import) + one match (the property assignment).

## Templates

- `templates/prisma-storage-provider.ts.template` (the post-Task-09 version is included as a comment block)

## Common pitfalls

- **Forgetting `DATABASE_URL`**: `PrismaOnboardingStore` needs `DATABASE_URL` to be set and the `UserOnboarding` migration applied. If you see `PrismaClientInitializationError`, run `bun x prisma db push` with the same `DATABASE_URL`.
- **Mixing memory and prisma data**: if you previously ran with `VIVIM_STORAGE_PROVIDER=memory` and had data in memory, switching to `prisma` loses that data (the prisma DB is empty). This is expected — Task 10's roadmap includes a `storage:migrate` CLI to move data from memory to prisma (future pack).
- **The v1 hardcoded check still in place**: if `canvas-engine-bootstrap.ts` still has `if (process.env.NODE_ENV === 'production') new PrismaOnboardingStore() else new MemoryOnboardingStore()`, the provider is bypassed for onboarding. Delete that check — the provider handles it now.
- **Test pollution**: the `test-onboarding.db` file lingers if you don't delete it. Always cleanup in step 3.
