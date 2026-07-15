# Unit 37.6 — v3 Release

**Fork ID:** 13.8 (v3: 10.8) | **Status:** `[ ]` | **Class:** F

> **Audit (2026-07-13):** No `v3.0.0` git tag, no `CHANGELOG.md` for the v3 cut. `package.json` version not tagged for v3. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.8-v3-release.md`
**Depends on:** all v11 units, v10 SOA

## Context
Cut the v3 release: version bump, changelog, tag, publish SDK + manual, announce parity lock.

## Current State
- `package.json` version untagged for v3; v10 SOA already shipped.
- ADRs + docs present.

## Requirements
- Bump version; generate `CHANGELOG.md` from merged units (v3-fork-canon 58 done + v11 21).
- Tag `v3.0.0`; publish `sdk/` (37.1) if applicable.
- Verify `bun run devops invariants check` + `bun run devops gate` green.
- Landing note linking manual (37.5) + OpenAPI (37.4).

## Acceptance Criteria
1. Version bumped + tagged.
2. `CHANGELOG.md` reflects completed units.
3. Invariants + gate green.
4. SDK + manual published/linked.

## Tests
Release smoke: install from tag in clean dir; `bun test` green.

## DevOps
```powershell
bun run devops invariants check
bun run devops gate
bun test
```
