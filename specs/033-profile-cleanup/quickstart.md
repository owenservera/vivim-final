# Quickstart: One Logged-In Profile Per Provider + Account

**Feature**: `033-profile-cleanup` | **Date**: 2026-07-20

Runnable validation scenarios proving the cleanup system and the setup wizard
cooperate. All commands run from repo root. PowerShell-safe.

## Prerequisites

- Backend/DB reachable (cleanup reads `ProviderAccount` via `CapStoreDb`).
- `bun` runtime.
- No Chrome holding a profile you intend to remove (stop first: `pwsh scripts/stop-all.ps1`).

## Scenario A — Audit (dry-run, no mutation)

```powershell
bun run devops profiles cleanup --dry-run --provider=gemini
```

**Expected**: prints groups/stray-roots/protected, exits 0, deletes nothing.
Verify no-op by hashing first:

```powershell
Get-ChildItem chrome-profiles -Recurse | Get-FileHash | Sort-Object Hash | ForEach-Object { $_.Hash } > .runtime/before.txt
bun run devops profiles cleanup --dry-run
# (hashes unchanged — SC-002)
```

## Scenario B — Enforce the invariant

Seed a duplicate to prove dedupe:

```powershell
# create a 2nd, unauthenticated account dir under gemini
mkdir chrome-profiles/gemini/oldaccount
bun run devops profiles cleanup --dry-run --provider=gemini
# -> keep chrome-profiles/gemini/owservera (authenticated), remove gemini/oldaccount
bun run devops profiles cleanup --force --provider=gemini
# -> oldaccount removed; exactly one dir remains
Get-ChildItem chrome-profiles/gemini | Measure-Object | Select-Object -ExpandProperty Count
# expected: 1
```

**Idempotency (SC-003)**: re-run `--force` → zero further removals.

## Scenario C — Wizard + cleanup cooperate (new account)

```powershell
# 1. Wizard adopts the single existing profile, does NOT create a duplicate (FR-016)
bun run devops agentic adopt --provider=gemini
# 2. Later, cleanup is a no-op for gemini (SC-001) and repairs drift elsewhere
bun run devops profiles cleanup --dry-run
bun run devops profiles cleanup --force --reconcile-db
```

**Expected**: gemini keeps its one authenticated profile; `ProviderAccount.profileDir`
and `loginState` match the kept dir; at most one `isDefault=1` per provider.

## Scenario D — Protect a live slave

```powershell
# Launch Chrome on a profile (e.g. via wizard, mid-login), then:
bun run devops profiles cleanup --dry-run
# -> the in-progress profile is listed PROTECTED (live slave), not removed (FR-006/FR-015)
```

## Scenarios reference design

- Violation classes + keep-one policy: `data-model.md`, `research.md` (D3).
- CLI + allocator + DB contracts: `contracts/cleanup-cli.md`.
- Wizard sync contract: `contracts/wizard-sync.md`.
- Entities: `data-model.md`.
