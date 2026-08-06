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
| (none yet — log starts fresh here) | | |

## Existing decisions (archived)

The pre-2026-08-06 decision log (ADR-001…ADR-025 + index) was written into
`.archive/` with the stale docs sweep. Notable archived decisions to re-record
here if still load-bearing (re-issue as new ADRs, superseding the archive):

- **ADR-001** — Node graph rebuild from edges (`rebuildGraphFromNodes`) — **still
  load-bearing**; referenced in `DATA.md`.
- **ADR-014** — SQLite + Cozo dual-store — verify still current before relying on
  it.
- Capability/one-entry-point, ChromeGovernor canon, DB-only parsers — these
  invariants live in `AGENTS.md` (still authoritative) and `OVERVIEW.md`.

To revive: read the archived ADR, re-record in the template above with a note
"supersedes archive ADR-<N>", bump the number.

## How to add

1. `docs/decisions/ADR-<NNN>.md` using the template.
2. Add a row to the Index above.
3. Reference the ADR from the affected `architecture/*.md` doc.
