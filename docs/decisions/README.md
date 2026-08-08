# Decisions (ADR index)

> The decision log for vivim-final. Every non-trivial engineering decision gets
> an ADR here.

## Why

A decision made and forgotten is a decision re-litigated. ADRs capture the
**context → decision → consequences** so future readers (human or agent) know
*why* the code looks the way it does. Keep them short — a paragraph each section.

## ADR template (use this)

```markdown
# ADR-<NNN>: <Title>

- Status: proposed | accepted | superseded
- Date: <YYYY-MM-DD>
- Decision-maker: <who>

## Context
Why this decision is needed (the forces).

## Decision
What we decided (the choice, concretely).

## Consequences
Positive + negative/risk, and any follow-up tracked.
```

## Index

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001-run-2026-08-06-A1 | FIX-A1-1: Split `bootstrap-engines.ts` god-wiring fn | SUPERSEDED by ADR-015 |
| ADR-002-run-2026-08-06-A1 | FIX-A1-2: Two-layer bootstrap duplication | SUPERSEDED by ADR-015 |
| ADR-003-run-2026-08-06-B1 | FIX-B1-1: Split `catalog.ts` 1,783-LOC god-module | SUPERSEDED by ADR-015 |
| ADR-004-run-2026-08-06-B1 | FIX-B1-2: Engines import across implicit boundaries | SUPERSEDED by ADR-015 |
| ADR-005-run-2026-08-06-B2 | FIX-B2-1: 196-models-in-one-schema migration risk | DEFERRED (post-alpha) — superseded by ADR-014 |
| ADR-014 | Defer Prisma schema split to post-alpha | accepted |
| ADR-015 | Session 1 closure — alpha P1s verified closed | accepted |
| ADR-016 | OpenCode serve contract snapshot + weekly drift check | accepted |

> ADR-006 through ADR-010 (`run-2026-08-06-*` duplicates of ADR-001 through
> ADR-005 with extra detail) were removed in session 1 — they held the same
> finding IDs as 001-005 with marginal annotation. The original 001-005 are
> authoritative.

## Existing decisions (archived)

The pre-2026-08-06 decision log (ADR-001…ADR-025 + index) was written into
`.archive/` with the stale docs sweep. Notable archived decisions to re-record
here if still load-bearing (re-issue as new ADRs, superseding the archive):

- **ADR-001 (archive)** — Node graph rebuild from edges (`rebuildGraphFromNodes`) — **still
  load-bearing**; referenced in `DATA.md`.
- **ADR-014 (archive)** — SQLite + Cozo dual-store — verify still current before relying on
  it.
- Capability/one-entry-point, ChromeGovernor canon, DB-only parsers — these
  invariants live in `AGENTS.md` (still authoritative) and `OVERVIEW.md`.

To revive: read the archived ADR, re-record in the template above with a note
"supersedes archive ADR-<N>", bump the number.

## How to add

1. `docs/decisions/ADR-<NNN>.md` using the template.
2. Add a row to the Index above.
3. Reference the ADR from the affected `architecture/*.md` doc.
