# Feature: 029-command-language

## Overview

Command Language Engine — deterministic NL → command parser with alias resolution,
validation, and execution dispatch. Enables typed command execution from natural
language input across CLI, API, and UI surfaces.

## Metadata

| Field | Value |
|-------|-------|
| **ID** | `029-command-language` |
| **Name** | Command Language Engine |
| **Phase** | 6 (Core Engine Layer) |
| **Status** | `done` |
| **Owning Skill** | `vivim-build` |
| **Spec Ref** | `docs/atomic-v3-fork-canon/phase-6/029-command-language.md` |
| **Coverage** | 95% |
| **Last Verified** | 2026-07-20 |

## Owning Engines

| Engine | Path | Purpose |
|--------|------|---------|
| CommandLanguageEngine | `src/engines/command-language.ts` | NL → command resolution, alias binding, validation |

## Coverage

| Metric | Value |
|--------|-------|
| Unit tests | 114 / 114 pass |
| Coverage | ~95% (command-language.test.ts) |
| Integration tests | pending |
| E2E tests | pending |

## Invariants

| ID | Category | Check |
|----|----------|-------|
| D1 | Quality | Engine has unit tests (command-language.test.ts) |
| B2 | Architectural | Engine depends on contracts, not impl |

## Lifecycle History

| Date | Event | Notes |
|------|-------|-------|
| 2026-07-20 | proposed | Registered in feature governance system |
| 2026-07-20 | done | 114 tests passing, all phases complete |

## Dependencies

- `src/engines/capability-resolution-engine.ts` — resolves commands to capabilities
- `src/storage/contracts/capability-store.ts` — capability data access

## Notes

This feature was the first to complete the full 5-phase implementation pipeline
(select → implement → test → verify → document). It serves as the reference
pattern for all future feature governance entries.
