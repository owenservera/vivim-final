# Unit 36.1 — Database-level Encryption Option

**Fork ID:** 10.2 (v3: 9.2) | **Status:** `[ ]` | **Class:** C

> **Audit (2026-07-13):** `src/engines/encryption.ts` provides field-level encryption (unit 10.1, done). No `encryptDb` flag, no SQLCipher/whole-DB envelope option. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.2-db-encryption.md`
**Depends on:** field encryption (10.1 done), Prisma schema

## Context
Field-level encryption (10.1) covers sensitive columns. This adds an optional whole-database encryption (SQLCipher-style / at-rest envelope) for users who want full-DB confidentiality.

## Current State
- `src/storage/*` wraps Prisma; field encryption exists for select columns.
- No DB-level encryption option.

## Requirements
- Config flag `storage.encryptDb` (default off; respects airgap 10.4).
- Envelope key from local keychain/env; derived per-DB.
- Migration path: create encrypted DB, copy, swap, shred old.
- Works with the existing Prisma client (connection-wrapper or alternative driver).

## Acceptance Criteria
1. With `encryptDb:true`, the on-disk DB is unreadable without the key.
2. App boots and migrates normally with the key present.
3. Migration from unencrypted → encrypted is non-destructive.
4. `bun run devops gate` passes; tests use an in-memory encrypted fixture.

## Tests
`tests/unit/storage/db-encryption.test.ts` — key present → read/write; wrong key → open fails; migrate path.

## DevOps
```powershell
bun run devops gate
```
