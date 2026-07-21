# Contracts: One Logged-In Profile Per Provider + Account

**Feature**: `033-profile-cleanup` | **Date**: 2026-07-20

## 1. CLI contract — `devops profiles cleanup`

New subcommand in `devops/index.ts` (mirrors existing `setup`/`adopt` which already
import `ProfileAllocator` + `CapStoreDb`).

```
bun run devops profiles cleanup [options]

Options:
  --dry-run            (DEFAULT) report violations, delete nothing
  --force              apply removals + DB reconcile actions
  --provider=<slug>    limit to one provider (e.g. gemini)
  --account=<email>    limit to one account email (sanitized for path)
  --reconcile-db       also update ProviderAccount.profileDir/loginState
  --json               emit CleanupPlan/Result as JSON

Exit codes:
  0  success (clean, or plan applied)
  1  usage error / DB unavailable
  2  applied with best-effort errors (see result.errors)
```

**Output (dry-run, human)**:
```
[audit] canonical base: chrome-profiles
[group] gemini::owservera  — 2 dirs
   keep : chrome-profiles/gemini/owservera        (authenticated, lastUsed 2026-07-20T...)
   remove: chrome-profiles/gemini/oldaccount     (not authenticated)
[stray] gemini/  (repo root, outside chrome-profiles/)  -> remove
[stray] discovery/protocol-probe  -> PROTECTED (special)
SUMMARY: groups=1 keep=1 removable=1 stray=1 protected=1
Run with --force to apply.
```

**Output (enforce)**: same plan, then removals performed, plan snapshot written to
`.runtime/profile-cleanup/<ts>.json`.

## 2. ProfileAllocator extension contract

Add to `src/executor/profile-allocator.ts` (no new engine surface — keeps Governor Canon / One Entry Point):

```typescript
// Groups every discovered profile by (providerSlug, accountId).
groupByProviderAccount(opts?: { provider?: string; account?: string }): Promise<ProfileGroup[]>

// Scans legacy/stray roots outside the canonical base.
findStrayRoots(): Promise<StrayRoot[]>

// True when a running Chrome holds this profile (debugPort in use / SingletonLock).
isLiveSlave(profileDir: string): Promise<boolean>

// Builds the full, serializable plan (pure — no mutation).
plan(opts?: PlanOpts): Promise<CleanupPlan>

// Applies a plan. Best-effort per removal; records protected live slaves.
enforce(plan: CleanupPlan, opts?: { reconcileDb?: boolean }): Promise<CleanupResult>
```

**Invariants enforced by implementation**:
- `plan()` is a pure read (FR-007, idempotency FR-009).
- `enforce()` never removes a `liveSlave` record (FR-006) or `discovery/` (FR-011).
- `enforce()` writes the snapshot before mutating (FR-008).

## 3. DB reconcile contract

When `--reconcile-db`, for each affected `ProviderAccount` (`prisma/schema.prisma:232`):

```typescript
// via CapStoreDb.prisma.providerAccount.update
{
  where: { id: action.providerAccountId },
  data: {
    profileDir: action.setProfileDir,                              // FR-010
    loginState: action.setLoginState,                              // from isAuthenticated
  }
}
```

- `setLoginState` derived from `ProfileAllocator.isAuthenticated(keptPath)` (FR-002 of spec:
  profile dir is source of truth, not the row).
- No `providerAccount` rows are deleted by this feature (research D6).
- Writes go through `CapStoreDb` (`src/storage/db.ts`), never raw SQL.

## 4. Idempotency / safety contract

- `enforce(plan)` then `enforce(plan')` → `plan'.removable` is empty (SC-003).
- `--dry-run` leaves filesystem + DB byte-identical (SC-002). Verifiable by hashing
  `chrome-profiles/` before/after.
- A live Chrome must be stopped first (`scripts/stop-all.ps1`); if detected running and
  a protected slave exists, warn and skip that record rather than failing the whole run.
