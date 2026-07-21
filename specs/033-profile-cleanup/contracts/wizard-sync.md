# Contract: Setup Wizard ↔ Cleanup Sync

**Feature**: `033-profile-cleanup` | **Date**: 2026-07-20

This contract makes `ChromeSetupWizard` (`src/engines/chrome-setup-wizard.ts`) and the
cleanup system cooperate so there is always exactly one logged-in profile per
(provider, account).

## 1. Shared resolver (both systems)

```typescript
// ProfileAllocator (used by wizard runSetup AND cleanup.plan)
canonicalPath(providerSlug: string, accountId: string): string
// === chrome-profiles/<providerSlug>/<sanitize(accountId)>
```

Both `ChromeSetupWizard.runSetup` and cleanup MUST resolve the target dir via this method —
no ad-hoc path construction.

## 2. Wizard pre-setup reconcile (FR-016)

Before `allocate()`, the wizard adopts an existing single profile when present:

```typescript
// pseudo — added to ChromeSetupWizard.runSetup
const existing = await this.profileAllocator.findExisting(providerSlug, accountId)
const profileDir = existing
  ? existing.path                                   // adopt (authenticated preferred)
  : await this.profileAllocator.allocate(providerSlug, accountId)
```

`findExisting` returns the cleanup-selected keep-candidate for the group (authenticated,
newest `lastUsed`) — i.e. the same logic `cleanup.plan()` uses. This guarantees the wizard
never creates a 2nd directory for an account that already has one.

## 3. Live-slave handshake (FR-015 / FR-006)

While the wizard drives Chrome (launched, login pending), the profile has no cookies yet
but is a live slave. Detection both systems rely on:

```typescript
// ProfileAllocator.isLiveSlave(profileDir)
// true if: a Chrome process holds SingletonLock in profileDir
//      OR a debugPort recorded on the matching ProviderAccount is accepting CDP
```

Cleanup's `plan()` removes any live-slave record from `removable` and pushes a warning.
The wizard does not need to call cleanup — it only needs to leave Chrome running with the
recorded `debugPort` so `isLiveSlave` returns true.

## 4. Cookie-truth in needsSetup (FR-013)

```typescript
// ChromeSetupWizard.needsSetup — replace DB-only check
async needsSetup(providerDbId, accountId): Promise<boolean> {
  const account = await this.db.prisma.providerAccount.findFirst({
    where: { providerId: providerDbId, email: accountId },
  })
  if (account?.profileDir && existsSync(account.profileDir)) {
    if (await this.profileAllocator.isAuthenticated(account.profileDir)) return false // cookie truth
  }
  return true
}
```

This makes the wizard's "do I need to set up?" decision identical to cleanup's
`hasCookies` truth source.

## 5. Single-default on save (FR-014)

```typescript
// ChromeSetupWizard.saveAccount — enforce one isDefault per provider
await this.db.prisma.providerAccount.updateMany({
  where: { providerId: providerDbId, isDefault: 1 },
  data: { isDefault: 0 },
})
await this.db.prisma.providerAccount.upsert({
  where: { providerId_email: { providerId: providerDbId, email: accountId } },
  create: { /* ... */ isDefault: 1, loginState: 'logged_in', profileDir, debugPort },
  update: { isDefault: 1, loginState: 'logged_in', profileDir, debugPort, loginAttempts: { increment: 1 } },
})
```

Cleanup `--reconcile-db` additionally repairs any `isDefault` drift left by older rows:

```typescript
// cleanup reconcile: per provider, keep at most one isDefault=1
for (const providerId of providers) {
  const defaults = await db.prisma.providerAccount.findMany({ where: { providerId, isDefault: 1 } })
  if (defaults.length > 1) {
    // keep the one whose profileDir isAuthenticated, else newest lastLoginAt
    await db.prisma.providerAccount.updateMany({ where: { providerId, id: { not: keepId } }, data: { isDefault: 0 } })
  }
}
```

## 6. End-to-end cooperation scenario

1. Operator runs `bun run devops agentic adopt --provider=gemini` (wizard).
2. Wizard adopts existing `chrome-profiles/gemini/owservera` (FR-016) — does not create a duplicate.
3. Wizard launches Chrome, records `debugPort`; cleanup would protect this live slave.
4. Login completes; wizard saves `ProviderAccount` with `isDefault=1` (others cleared) + `profileDir`.
5. Later `bun run devops profiles cleanup --force --reconcile-db` is a **no-op** for gemini
   (single authenticated profile) and repairs any stray/drift elsewhere — the two systems agree.
