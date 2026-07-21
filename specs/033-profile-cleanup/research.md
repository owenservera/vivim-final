# Research: One Logged-In Profile Per Provider + Account

**Feature**: `033-profile-cleanup` | **Date**: 2026-07-20

## Decisions (resolved from code, not assumed)

### D1 — Canonical profile location
**Decision**: The single source of truth is `chrome-profiles/<providerSlug>/<accountId>/`
(resolved by `ProfileAllocator.getPath`, `src/executor/profile-allocator.ts:32`).
**Rationale**: AGENTS.md (Chrome Profile Layout, CANONICAL) states this layout is
canonical and warns that stray top-level `gemini/`, `chatgpt/`, `claude/` dirs at
repo root are duplicates that "get deleted". `ProfileAllocator.DEFAULT_PROFILE_BASE = 'chrome-profiles'`.
**Alternatives considered**: treating the legacy roots in `scripts/cleanup-credentials.ps1`
(`chatgpt`, `claude`, `gemini`, `prov_claude`, `data/chrome-profiles`) as valid — rejected;
they are explicitly legacy/stray per AGENTS.md.

### D2 — "Logged in" definition
**Decision**: Reuse `ProfileAllocator.isAuthenticated(profileDir)` — non-empty
`Cookies` / `Cookies-journal` / `Network/Cookies` (`profile-allocator.ts:140`).
**Rationale**: AGENTS.md (line 131) states the profile dir — not the `Account` DB row —
is the source of truth for authentication. Reusing the existing method avoids drift.
**Alternatives considered**: trusting `ProviderAccount.loginState` — rejected (AGENTS.md
explicitly says DB `loginState` can be stale; verify actual cookies).

### D3 — Keep-one selection policy
**Decision**: Per (provider, account): keep the authenticated dir with the newest
`.profile-meta.json.lastUsed`; if none authenticated, keep the newest `lastUsed`
and flag needs-relogin; remove all others.
**Rationale**: `ProfileAllocator` already writes `allocatedAt`/`lastUsed`
(`profile-allocator.ts:43`). Most-recently-used is the safest "which to keep" signal.
**Alternatives considered**: keep by largest cookie set, keep lexicographically-first —
rejected as less deterministic / riskier.

### D4 — Live-slave protection
**Decision**: Never remove a profile currently bound to a running Chrome. Detect via
`ProviderAccount.debugPort`/`chromeSlaveId` cross-checked against live ports, or a
`SingletonLock` held by a running process.
**Rationale**: Deleting a profile a live browser holds corrupts the session and can
crash Chrome. AGENTS.md CDP gotcha #7 notes Windows zombie-socket issues; we avoid
touching live instances entirely.
**Alternatives considered**: stopping Chrome automatically first — rejected for the
default path (operator should stop via `scripts/stop-all.ps1`); we warn and skip instead.

### D5 — Special profiles excluded
**Decision**: `chrome-profiles/discovery/protocol-probe` (and any `discovery/` tree)
is never touched. It is a non-account discovery probe.
**Rationale**: `devops discover-protocol` and preflight use it; AGENTS.md lists
`chrome-profiles/discovery/protocol-probe` as a legitimate entry.
**Alternatives considered**: treating `discovery` as a provider — rejected.

### D6 — DB reconciliation is opt-in
**Decision**: Filesystem cleanup is the primary, always-on behavior. `--reconcile-db`
(updating `ProviderAccount.profileDir` + `loginState`) is a separate, explicit flag.
**Rationale**: Keeps the destructive surface minimal; filesystem invariant is the ask.
`ProviderAccount` (`prisma/schema.prisma:232`) has `profileDir`, `chromeSlaveId`,
`debugPort`, `loginState`, `email`, `providerId`, `isDefault`.
**Alternatives considered**: auto-mutating DB on every run — rejected (scope creep,
risk of deleting provider accounts).

### D7 — Delivery vehicle
**Decision**: Extend `ProfileAllocator` with grouping/dedupe/reconcile methods and add a
`devops profiles cleanup [--dry-run] [--provider=] [--account=] [--force] [--reconcile-db]`
command in `devops/index.ts` (alongside the existing `setup`/`adopt` usages of
`ProfileAllocator`, e.g. `devops/index.ts:989-992`).
**Rationale**: Reuses the existing allocator + DB wiring; avoids a new engine surface
(Governor Canon / One Entry Point). Not exposed as a `UnifiedCapability` — it is a
devops/operator maintenance command, consistent with `devops agentic adopt`/`setup`.
**Alternatives considered**: a new engine + capability — rejected (not a user-facing
capability; it is infrastructure hygiene).

## Best-practices tasks (validated)

- **Idempotency**: enforce applied twice = same state; dry-run is pure read. Mirrors
  `ProfileAllocator.clean()`'s best-effort, re-runnable nature.
- **Snapshot before mutate**: write plan to `.runtime/profile-cleanup/<ts>.json`
  (consistent with `.runtime/llm-testing/sessions/` audit-trail pattern).
- **Powershell-safe**: any PS1 helper uses `$PSScriptRoot`; this feature is a `bun` devops
  command (no new PS1 needed) — simpler and matches `devops/index.ts` style.

## Open items (resolved with defaults)

- **Removing orphan DB rows**: decided to NOT delete `ProviderAccount` rows by default.
  Only `profileDir`/`loginState` are updated. Deletion of accounts is out of scope
  (operator does it via existing flows). Marked resolved.

## Wizard ↔ Cleanup sync (user refinement: "make them work together")

The user asked the cleanup system to be synced with `ChromeSetupWizard`
(`src/engines/chrome-setup-wizard.ts`) for new provider accounts. Findings from the
wizard source:

- `runSetup` calls `ProfileAllocator.allocate(providerSlug, accountId)`
  (`chrome-setup-wizard.ts:96`) — `allocate()` returns the existing path if present
  (mkdir recursive, never deletes) but does **not** dedupe *other* dirs under the same
  provider, nor adopt a stray dir.
- `saveAccount` upserts with `isDefault: 1` on **every** create
  (`chrome-setup-wizard.ts:278`) → multiple `isDefault=1` rows per provider (drift).
- `needsSetup` trusts `loginState === 'logged_in'` + `existsSync(profileDir)`
  (`chrome-setup-wizard.ts:48`) and does **not** call `isAuthenticated()` → agrees with
  the DB-staleness trap AGENTS.md warns about (line 131).
- The wizard **leaves Chrome running** after login (`chrome-setup-wizard.ts:155-156`),
  so during setup the profile is a **live slave** with no cookies yet.

### D8 — Shared canonical path + cookie-truth
**Decision**: Both systems use `ProfileAllocator.canonicalPath(providerSlug, accountId)`
and `isAuthenticated()` as the single definition of "the profile" and "logged in"
(FR-012, FR-013). `needsSetup` switches to `isAuthenticated(profileDir)` so the wizard
and cleanup never disagree.
**Rationale**: AGENTS.md line 131 — profile dir (cookies), not DB row, is source of truth.
**Alternatives**: keep two definitions — rejected (desync is exactly the bug class this
feature removes).

### D9 — Wizard adopts the single existing profile; cleanup protects in-progress
**Decision**:
- Wizard does a **pre-setup reconcile**: before `allocate()`, if a profile already exists
  for (provider, account) — authenticated preferred — adopt it (FR-016) instead of creating
  a second dir. Reuses the same grouping logic the cleanup `plan()` builds.
- Wizard registers its `debugPort`/`profileDir` so cleanup's `isLiveSlave()` detects the
  in-progress profile and protects it (FR-015, FR-006). During active setup the dir has no
  cookies → cleanup would otherwise flag it; live-slave protection covers it.
- Wizard enforces single-`isDefault` per provider on save, and cleanup `--reconcile-db`
  repairs any drift (FR-014).

**Rationale**: The two systems become cooperative — wizard creates/uses the *one* profile,
cleanup guarantees there is never more than one, and neither deletes the other's live work.
**Alternatives**: separate independent tools — rejected (user explicitly wants them synced).
