# Unit 37.5 — User Manual

**Fork ID:** 13.7 (v3: 10.7) | **Status:** `[ ]` | **Class:** C

> **Audit (2026-07-13):** No `docs/manual/` directory. Design docs exist in `docs/merged-design-v2/` but no end-user manual. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.7-user-manual.md`
**Depends on:** onboarding (37.2), OpenAPI (37.4)

## Context
A user-facing manual: concepts, quick start, capability catalog, provider setup, autonomous tasks, memory, sovereign-data, troubleshooting.

## Current State
- Design docs exist in `docs/merged-design-v2/`; no end-user manual.
- ADRs exist (`docs/decisions/`) for architecture.

## Requirements
New `docs/manual/` (markdown, multi-page or single):
- Quick start (from onboarding), capability catalog, provider setup, autonomous tasks, memory browser, sovereign data/backup, CLI + frontend parity, FAQ.
- Cross-linked; version-stamped to release (37.6).

## Acceptance Criteria
1. Covers all major user surfaces.
2. Quick start reproduces onboarding path.
3. Version-stamped; linked from README.
4. `bun run devops gate` passes (docs don't break lint).

## Tests
Link-check script (no broken internal anchors).

## DevOps
```powershell
bun run devops gate
```
