# Feature Specification: One Logged-In Profile Per Provider + Account

**Feature Branch**: `033-profile-cleanup`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "design the system to cleanup so we only have one logged in profile per provider + account"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Audit profile sprawl without deleting (Priority: P1)

As an operator, I want to run a dry-run that reports every violation of the
"one logged-in profile per (provider, account)" invariant, so I can see what
*would* be cleaned before anything is touched.

**Why this priority**: Safety first. The filesystem holds authenticated Chrome
sessions (cookies). A read-only audit must exist before any destructive step.

**Independent Test**: `bun run devops profiles cleanup --dry-run` prints a plan
of duplicate/stray/orphan profiles and exits 0 without deleting anything.

**Acceptance Scenarios**:

1. **Given** two account dirs under `chrome-profiles/gemini/`, **When** `--dry-run` runs, **Then** it reports one as the keep-candidate and one as removable, and nothing is deleted.
2. **Given** a stray top-level `gemini/` dir at repo root (outside `chrome-profiles/`), **When** `--dry-run` runs, **Then** it is listed as a stray-root violation.
3. **Given** no violations, **When** `--dry-run` runs, **Then** it reports "clean" and removes nothing.

---

### User Story 2 - Enforce exactly one authenticated profile per (provider, account) (Priority: P1)

As an operator, I want to apply the cleanup so that for each (providerSlug,
accountId) exactly one profile directory exists and it is the authenticated one.

**Why this priority**: This is the core invariant the user asked for.

**Independent Test**: Seed two gemini account dirs (one authenticated, one not),
run `bun run devops profiles cleanup --force`, assert exactly one dir remains
under `chrome-profiles/gemini/` and it contains non-empty `Cookies`.

**Acceptance Scenarios**:

1. **Given** `gemini/owservera` (authenticated) and `gemini/oldaccount` (not), **When** enforced, **Then** `oldaccount` is removed and `owservera` is kept.
2. **Given** multiple unauthenticated dirs, **When** enforced, **Then** the most-recently-used is kept (flagged needs-relogin) and the rest removed.
3. **Given** a profile bound to a live Chrome slave, **When** enforced, **Then** it is protected (never removed) and a warning is emitted.

---

### User Story 3 - Reconcile filesystem with the ProviderAccount DB rows (Priority: P2)

As an operator, I want the cleanup to optionally fix DB/filesystem drift, so
`ProviderAccount.profileDir` and `loginState` reflect the kept profile.

**Why this priority**: Keeps the DB as a usable mirror; not strictly required for
the filesystem invariant but prevents silent desync.

**Independent Test**: After filesystem cleanup, `--reconcile-db` updates the kept
`ProviderAccount.profileDir` and sets `loginState` from `isAuthenticated()`.

**Acceptance Scenarios**:

1. **Given** a `ProviderAccount` whose `profileDir` points to a removed dir, **When** `--reconcile-db` runs, **Then** `profileDir` is updated to the kept path.
2. **Given** a kept dir with cookies, **When** reconciled, **Then** `loginState` becomes `logged_in`.

---

### Edge Cases

- A profile is currently attached to a running Chrome (debugPort in use) — never delete; warn and skip.
- `chrome-profiles/discovery/protocol-probe` is a special non-account profile — always protected.
- `profileDir` env (`CAP_STORE_PROFILE_DIR`) or `config.profileBaseDir` points elsewhere — resolve the canonical base before scanning, treat anything outside it as stray.
- `.profile-meta.json` is missing/corrupt — fall back to filesystem `mtime` for `lastUsed` ordering.
- Multiple providers, each with exactly one account already (the steady state) — cleanup is a no-op (idempotent).
- **Wizard-in-progress**: the setup wizard has launched Chrome on a fresh profile dir but login is not complete (no cookies yet). Cleanup must treat it as a live slave and protect it; the wizard must not allocate a second dir for the same account while one is in progress (FR-016).
- **Default-account drift**: two `ProviderAccount` rows for one provider both `isDefault=1` (the wizard sets `isDefault:1` on every create). Cleanup `--reconcile-db` must leave exactly one default per provider.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat `chrome-profiles/<providerSlug>/<accountId>/` (sanitized: `@`→`-at-`) as the canonical, single profile location per (provider, account).
- **FR-002**: System MUST detect, for each provider, more than one account directory as a violation.
- **FR-003**: System MUST select the keep-candidate per (provider, account) as: authenticated (non-empty `Cookies`/`Cookies-journal`/`Network/Cookies`) with the newest `.profile-meta.json.lastUsed`; if none authenticated, the newest `lastUsed` (flagged needs-relogin).
- **FR-004**: System MUST detect stray top-level provider dirs at repo root (`gemini/`, `chatgpt/`, `claude/`, `prov_claude/`, `data/chrome-profiles`) that are not under the canonical base.
- **FR-005**: System MUST detect orphan filesystem profiles with no matching `ProviderAccount` (providerSlug+email) row.
- **FR-006**: System MUST protect any profile bound to a live Chrome slave from removal.
- **FR-007**: System MUST support a `--dry-run` (default) mode that reports the plan and deletes nothing.
- **FR-008**: System MUST write the cleanup plan (pre-apply) to `.runtime/profile-cleanup/<timestamp>.json` for audit/recovery.
- **FR-009**: System MUST be idempotent — applying enforce twice yields the same end state.
- **FR-010**: System MUST, under `--reconcile-db`, update `ProviderAccount.profileDir` and `loginState` to match the kept filesystem profile.
- **FR-011**: System MUST never remove `chrome-profiles/discovery/` (special discovery probe profile).
- **FR-012**: The wizard (`ChromeSetupWizard`) and the cleanup system MUST share one canonical path resolver `ProfileAllocator.canonicalPath(providerSlug, accountId)` so both agree on "the" profile for a (provider, account).
- **FR-013**: `ChromeSetupWizard.needsSetup` MUST treat "logged in" as `ProfileAllocator.isAuthenticated(profileDir)` (cookies), not just DB `loginState`, so wizard and cleanup agree on source of truth (AGENTS.md: profile dir, not DB row).
- **FR-014**: When the wizard saves a new account, it MUST leave at most one `isDefault=1` `ProviderAccount` per provider — clearing other accounts' `isDefault` for that provider (or deferring to cleanup `--reconcile-db` to enforce single-default).
- **FR-015**: A profile currently driven by the wizard (Chrome launched, not yet logged in) is a live slave and MUST be protected by cleanup exactly like any other live slave (FR-006); the wizard MUST expose its `debugPort`/`profileDir` so cleanup can detect it.
- **FR-016**: Before allocating a fresh dir, the wizard MUST adopt an existing single profile for the same (provider, account) if one already exists (authenticated preferred), rather than creating a second directory.

### Key Entities

- **ProfileRecord**: a single `chrome-profiles/<provider>/<account>` directory. Attributes: `providerSlug`, `accountId` (sanitized email), `path`, `hasCookies` (authenticated), `lastUsed`, `metaPresent`, `liveSlave` (bound to running Chrome).
- **ProfileGroup**: all `ProfileRecord`s sharing a (providerSlug, accountId). The unit of the "one per" invariant.
- **CleanupPlan**: the full set of keep/remove decisions across all groups + stray roots, plus DB reconcile actions.
- **CleanupResult**: what was actually done (removed paths, updated DB rows, warnings, protected-live).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After enforce, every (provider, account) with at least one profile has exactly one directory, and it is authenticated when any authenticated copy existed.
- **SC-002**: `--dry-run` never mutates the filesystem or DB (verifiable by checksum before/after).
- **SC-003**: Re-running enforce produces zero further removals (idempotency).
- **SC-004**: No live Chrome slave's profile is ever deleted (verified by integration test with a mock live slave).

## Assumptions

- The account identifier on disk (`accountId`) equals the `ProviderAccount.email` (sanitized), per `ProfileAllocator.sanitizeDirName`.
- `ProfileAllocator.isAuthenticated()` (cookie presence) remains the source of truth for "logged in", not the DB `loginState` row.
- `scripts/cleanup-credentials.ps1` is a complementary *logout* tool (clears cookies, keeps dirs); this feature is a *structure/dedupe* tool. They are distinct and should not be merged.
- DB writes go through the Prisma `CapStoreDb` (`src/storage/db.ts`), not raw SQL.
