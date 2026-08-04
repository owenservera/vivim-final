# Test Cases

Specific test scenarios for the v2 pack. Each scenario lists the setup, action, and expected result. Use these as the basis for the parity test (Task 10) and for manual verification.

## TC-01: Singleton identity

**Setup**: fresh process, no env vars.
**Action**:
```ts
const a = getStorageProvider();
const b = getStorageProvider();
```
**Expected**: `a === b` (same reference).

## TC-02: Singleton reset

**Setup**: `getStorageProvider()` called once.
**Action**:
```ts
const a = getStorageProvider();
__resetStorageProviderForTests();
const b = getStorageProvider();
```
**Expected**: `a !== b` (different references).

## TC-03: Env var defaults to memory

**Setup**: `delete process.env.VIVIM_STORAGE_PROVIDER`.
**Action**: `getStorageProvider().name`
**Expected**: `'memory'`.

## TC-04: Env var selects prisma (after Task 08)

**Setup**: `process.env.VIVIM_STORAGE_PROVIDER = 'prisma'`.
**Action**: `getStorageProvider().name`
**Expected**: `'prisma'`.

## TC-05: Unknown env var throws

**Setup**: `process.env.VIVIM_STORAGE_PROVIDER = 'bogus'`.
**Action**: `getStorageProvider()`
**Expected**: throws `Error` with message matching `/Unknown VIVIM_STORAGE_PROVIDER/`.

## TC-06: Bag-store identity (the critical test)

**Setup**: `VIVIM_STORAGE_PROVIDER=memory` (or unset).
**Action**:
```ts
const bag = getEngineBag();
const storage = getStorageProvider();
for (const name of STORE_NAMES) {
  assert(bag[name] === storage[name]);
}
```
**Expected**: all 24 identity checks pass. If any fails, a back-compat getter in Task 04 is mis-wired.

## TC-07: Memory provider works end-to-end

**Setup**: `VIVIM_STORAGE_PROVIDER=memory`, `bun run dev`.
**Action**:
```bash
curl -X POST localhost:3000/api/onboarding/complete \
  -H "Content-Type: application/json" \
  -d '{"userId":"user:tc07","stepId":"welcome"}'
curl localhost:3000/api/onboarding/state?userId=user:tc07
```
**Expected**: first call returns `{ ok: true, state: { completedSteps: ["welcome"], ... } }`. Second call returns the same state (within the same process).

## TC-08: Memory state is lost on restart

**Setup**: TC-07 completed.
**Action**: kill server, restart, `curl localhost:3000/api/onboarding/state?userId=user:tc07`.
**Expected**: `{ ok: true, state: null }` (memory doesn't persist).

## TC-09: Prisma provider persists across restart

**Setup**: `VIVIM_STORAGE_PROVIDER=prisma DATABASE_URL="file:./test-tc09.db" bun run dev` (after Task 09).
**Action**:
```bash
bun x prisma db push  # ensure schema is applied
curl -X POST localhost:3000/api/onboarding/complete \
  -H "Content-Type: application/json" \
  -d '{"userId":"user:tc09","stepId":"welcome"}'
# kill server, restart with same env
curl localhost:3000/api/onboarding/state?userId=user:tc09
```
**Expected**: state survives restart — `completedSteps: ["welcome"]` is present after restart.
**Cleanup**: `rm -f frontend/test-tc09.db frontend/test-tc09.db-journal`.

## TC-10: Health endpoint in memory mode

**Setup**: `VIVIM_STORAGE_PROVIDER=memory bun run dev`.
**Action**: `curl localhost:3000/api/storage/health | jq .`
**Expected**:
- `ok: true`
- `provider: "memory"`
- `stores` has 24 entries, all with `ready: true`
- `migrationProgress: { migrated: 24, total: 24, pct: 100 }`

## TC-11: Health endpoint in prisma mode (after Task 09)

**Setup**: `VIVIM_STORAGE_PROVIDER=prisma DATABASE_URL="file:./test-tc11.db" bun run dev`.
**Action**: `curl localhost:3000/api/storage/health | jq .`
**Expected**:
- `ok: true`
- `provider: "prisma"`
- `stores.onboardingStore: { impl: "PrismaOnboardingStore", ready: true, ... }`
- `stores.providerStore: { impl: "NotImplementedErrorProxy", ready: false, ... }`
- (23 stores are `NotImplementedErrorProxy`)
- `migrationProgress: { migrated: 1, total: 24, pct: 4.17 }`
**Cleanup**: `rm -f frontend/test-tc11.db frontend/test-tc11.db-journal`.

## TC-12: Health endpoint survives a store throwing

**Setup**: `VIVIM_STORAGE_PROVIDER=prisma` (before Task 09 — all stores are stubs).
**Action**: `curl localhost:3000/api/storage/health`
**Expected**: 200 response, all 24 stores report `ready: false` with `impl: "NotImplementedErrorProxy"`. The endpoint does NOT crash.

## TC-13: CLI in memory mode

**Setup**: `cd frontend && bun run storage:inspect`.
**Expected**:
- Prints `provider: memory`
- Prints `migration: 24/24 (100%)`
- All 24 rows show `ready: yes`
- Exit code 0

## TC-14: CLI in prisma mode (after Task 09)

**Setup**: `cd frontend && VIVIM_STORAGE_PROVIDER=prisma bun run storage:inspect`.
**Expected**:
- Prints `provider: prisma`
- Prints `migration: 1/24 (4.17%)`
- 23 rows show `ready: NO` with `impl: NotImplementedErrorProxy`
- 1 row (`onboardingStore`) shows `ready: yes` with `impl: PrismaOnboardingStore`
- Exit code 1 (because not all stores are ready)

## TC-15: API route still works via back-compat getter

**Setup**: `VIVIM_STORAGE_PROVIDER=memory bun run dev`.
**Action**: `curl localhost:3000/api/onboarding/state?userId=user:tc15`
**Expected**: 200 response with `{ ok: true, state: null }` (or the existing state). The route uses `bag.onboardingStore` which is now a getter delegating to `bag.storage.onboardingStore` — the consumer doesn't notice.

## TC-16: ESLint rule blocks direct impl imports

**Setup**: add `import { MemoryOnboardingStore } from '@/storage/impl';` to `frontend/src/app/api/onboarding/state/route.ts`.
**Action**: `cd frontend && bun run lint`
**Expected**: lint fails with a message like "Use StorageProvider instead of importing impls directly."
**Cleanup**: revert the change.

## TC-17: ESLint rule allows provider imports

**Setup**: `frontend/src/storage/provider/memory-storage-provider.ts` imports from `../impl` (legitimate).
**Action**: `cd frontend && bun run lint`
**Expected**: lint passes (the rule exempts `storage/provider/**`).

## TC-18: Parity test passes

**Setup**: `cd frontend && bun test src/storage/__tests__/storage-provider.parity.test.ts`.
**Expected**: all 30 tests pass (1 singleton + 1 reset + 24 identity + 4 env-var).

## TC-19: Unknown env var message is helpful

**Setup**: `VIVIM_STORAGE_PROVIDER=bogus bun run dev`.
**Expected**: the error message contains "Unknown VIVIM_STORAGE_PROVIDER" and lists valid values (`memory, prisma, test`).

## TC-20: App boots with no env var

**Setup**: `unset VIVIM_STORAGE_PROVIDER; cd frontend && bun run dev`.
**Expected**: app boots, uses memory provider, `/api/storage/health` returns `provider: "memory"`.
