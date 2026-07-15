# Unit 36.3 — Backup Scheduling

**Fork ID:** 10.7 (v3: 9.7) | **Status:** `[ ]` | **Class:** C

> **Audit (2026-07-13):** No `backup-scheduler` / scheduled backup command. Encrypted export (10.6) exists but is not scheduled/rotated. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.7-backup-schedule.md`
**Depends on:** encrypted export (10.6 `[~]`), DB encryption (36.1)

## Context
Users need scheduled, encrypted backups of their sovereign data (local-first, no cloud) with rotation and restore.

## Current State
- Encrypted export capability exists (`encrypted-export` 10.6 `[~]`).
- No scheduler/cadence/rotation.

## Requirements
New `src/engines/backup-scheduler.ts`:
- Config-driven cadence (daily/weekly) + retention (keep N).
- Produces an encrypted archive via the export path; stores under a local backup dir.
- Rotation prunes old backups beyond retention.
- Restore command verifies integrity + decrypts.

## Acceptance Criteria
1. Scheduled run produces an encrypted backup.
2. Retention prunes beyond N.
3. Restore round-trips (export→restore yields identical data).
4. `bun run devops gate` passes.

## Tests
`tests/unit/engines/backup-scheduler.test.ts` — 3 runs + retention=2 → 2 kept; restore matches source.

## DevOps
```powershell
bun run devops gate
```
