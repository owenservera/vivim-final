# Data Model: One Logged-In Profile Per Provider + Account

**Feature**: `033-profile-cleanup` | **Date**: 2026-07-20

All entities are in-memory analysis results produced by the cleanup routine; only
`ProfileRecord.path` and `ProviderAccount` rows persist to disk/DB.

## Entities

### ProfileRecord
A single profile directory on disk.

| Field | Type | Source |
|-------|------|--------|
| providerSlug | string | parent dir name under canonical base |
| accountId | string | child dir name (sanitized email, `@`→`-at-`) |
| path | string (abs) | `ProfileAllocator.getPath(providerSlug, accountId)` |
| hasCookies | boolean | `ProfileAllocator.isAuthenticated(path)` |
| lastUsed | Date | `.profile-meta.json.lastUsed`, else fs mtime fallback |
| metaPresent | boolean | `.profile-meta.json` exists & parses |
| liveSlave | boolean | bound to a running Chrome (debugPort in use / SingletonLock held) |
| groupKey | string | `${providerSlug}::${accountId}` |

**Validation**: `path` must be under the resolved canonical base to count as a
first-class record; otherwise it is a `StrayRoot` (see below).

### ProfileGroup
All `ProfileRecord`s sharing a `groupKey`. The unit the "one per" invariant applies to.

| Field | Type | Notes |
|-------|------|-------|
| groupKey | string | `${providerSlug}::${accountId}` |
| records | ProfileRecord[] | all dirs in this group |
| authenticated | ProfileRecord[] | subset with `hasCookies` |
| keepCandidate | ProfileRecord? | selected keeper (see selection rule) |
| removable | ProfileRecord[] | records to delete |
| warnings | string[] | e.g. "live slave protected", "needs relogin" |

**Selection rule** (from research D3):
1. If `authenticated.length >= 1`: `keepCandidate` = authenticated record with max `lastUsed`.
2. Else: `keepCandidate` = record with max `lastUsed`; push warning "needs relogin".
3. `removable` = all records except `keepCandidate`.
4. Any record with `liveSlave === true` is removed from `removable` and a warning is pushed.

### StrayRoot
A profile directory located outside the canonical base (legacy top-level dirs).

| Field | Type | Notes |
|-------|------|-------|
| path | string | absolute stray path |
| providerHint | string? | inferred provider from dir name |
| disposition | 'remove' \| 'protect' | `discovery/` → protect; others → remove |

### CleanupPlan
The complete, serializable decision set. Written to `.runtime/profile-cleanup/<ts>.json`.

| Field | Type |
|-------|------|
| generatedAt | string (ISO) |
| canonicalBase | string |
| mode | 'dry-run' \| 'enforce' |
| groups | ProfileGroup[] |
| strayRoots | StrayRoot[] |
| dbActions | DbReconcileAction[] |
| summary | { providers: number; groups: number; keepCandidates: number; removable: number; protected: number; stray: number } |

### DbReconcileAction
A pending DB mutation (only produced when `--reconcile-db`).

| Field | Type | Notes |
|-------|------|-------|
| providerAccountId | string | `ProviderAccount.id` |
| setProfileDir | string? | new kept path |
| setLoginState | 'logged_in' \| 'logged_out' \| 'unknown' | from `isAuthenticated` |

### CleanupResult
What was actually applied (enforce mode).

| Field | Type |
|-------|------|
| removedPaths | string[] |
| protectedPaths | string[] (live slaves) |
| updatedDbRows | string[] |
| warnings | string[] |
| errors | string[] (best-effort failures) |

## State transitions

```
ProfileRecord.liveSlave == true  ──(always)──▶ PROTECTED (never removed)
ProfileGroup (|records| == 1, authenticated) ──▶ CLEAN (no-op)
ProfileGroup (|records| > 1) ──(enforce)──▶ keepCandidate kept, others removed
StrayRoot (discovery/) ──▶ PROTECTED
StrayRoot (other) ──(enforce)──▶ removed
```

## Relationships

- `ProfileGroup.groupKey` ↔ `ProviderAccount` via `(providerSlug → providerId, accountId → email)`.
- `DbReconcileAction.providerAccountId` → FK to `provider_account.id`.

## SetupWizardIntegration (sync with `ChromeSetupWizard`)

The cleanup system and the account setup wizard share state and MUST stay consistent.

### Shared resolver
`ProfileAllocator.canonicalPath(providerSlug, accountId)` is the single source of "the"
profile path, used by both `ChromeSetupWizard.runSetup` (allocate) and `cleanup.plan()`.

### Wizard → Cleanup handshakes

| Trigger | Wizard behavior | Cleanup guarantee |
|---------|-----------------|-------------------|
| Start setup | adopt existing single profile for (provider, account) if present (FR-016) | group already has ≤1 record |
| Chrome launched, pre-login | expose `debugPort` + `profileDir` as live slave | `isLiveSlave()` protects it (FR-015/FR-006) |
| `needsSetup` | use `isAuthenticated(profileDir)` (cookies) (FR-013) | same truth source as `plan()` |
| Save account | set `isDefault=1` for this account only; clear others' `isDefault` for provider (FR-014) | `--reconcile-db` repairs if drift remains |

### Cleanup → Wizard protection
A `ProfileRecord` with `liveSlave === true` (debugPort in use / `SingletonLock` held by a
running Chrome spawned by the wizard) is **never** removed, even if unauthenticated
(login in progress). This is the same rule that protects an agent-driven slave.

### Default-account invariant
Exactly one `ProviderAccount` per provider has `isDefault = 1`. Enforced on wizard save and
repaired by cleanup `--reconcile-db` (scans `provider_account` grouped by `providerId`).
