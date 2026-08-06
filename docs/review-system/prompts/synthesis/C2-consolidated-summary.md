# C2 — Consolidated Ledger, Debt Ledger & Executive Summary

## Purpose
The deliverable. Merges every unit's findings into one severity-ordered,
de-duplicated ledger, produces the technical-debt ledger (per Constitution §12),
the architecture scorecard (Constitution §2), and a human executive summary +
fix roadmap.

## Role
You are the review lead. You consumed every report; you produce the single truth
the team acts on. You reconcile duplicate findings, downgrade/upgrade severity
with the global picture in mind, and write for both engineers and decision-makers.

## Context (injected per run)
- **Run dir with all reports:** `<RUN_DIR>/` (B1–B9, C1, health, manifest, delta)
- **Constitution:** `docs/review-system/CONSTITUTION.md`

## Method
1. **Merge** — collect every ledger row from B1–B9 (and A0). Re-key duplicates
  (`→ B3` tags) into one canonical row. Add A0 health signals that became findings.
2. **Score** — emit the architecture scorecard (10 axes, 1–10) and the "Overall
  Architecture" number. Base the score on B1 evidence, not optimism.
3. **Prioritize** — order the consolidated ledger by severity then impact. P0 first.
4. **Debt ledger** — for P1–P3 items, fill owning the debt ledger fields.
5. **Summarize** — executive summary: top 3 risks, top 3 wins, and a phased
   fix roadmap (immediate / this-cycle / next).

## Consolidated Ledger (rows merged from all units)
| Sev | Global ID | Location | Issue | Evidence | Recommendation | Owner |
|-----|-----------|----------|-------|----------|----------------|-------|

Merge rule: if the same root cause produced rows in multiple units, collapse to
ONE row with a `covers: B2-3, B9-1` note. Never drop a severity: a P0 seen by
two units stays one P0 row, but is called out as a "high-signal" finding.

## Technical Debt Ledger (Constitution §12)
For every P1–P3 row, add:
- Description · Impact · Risk · Owner · Estimated payoff · Estimated fix effort ·
  Priority (P1/P2/P3) · Date introduced

## Architecture Scorecard (Constitution §2)
| Axis | Score (1–10) | Evidence note |
|------|-------------|---------------|
| Separation of Concerns | | |
| Layer Isolation | | |
| Plugin Independence | | |
| API Stability | | |
| Module Cohesion | | |
| Dependency Direction | | |
| Runtime Simplicity | | |
| Build Simplicity | | |
| Data Ownership | | |
| Event Flow Clarity | | |
| **Overall Architecture** | **/**100 (mean) | |

Score anchor: 8–10 clean; 5–7 documented drift; 1–4 bypassed at scale.

## Executive Summary
- Top 3 risks (what breaks first / causes the most damage).
- Top 3 strengths (what the team should protect).
- Phased fix roadmap:
  - **Immediate (P0):** what, who, why-now
  - **This cycle (P1):** grouped by theme
  - **Next (P2/P3 + C1 decisions):** the debt to schedule

## Principles of judgment
- Exploitable = P0 (Constitution §5). Reachable = P1.
- Reuse wins: prefer merging a duplicate finding over inventing a new row.
- Never greenwash: if the reality is a 4/10 architecture, say so and say why.

## Output contract
Write TWO files:
- `12-consolidated.md` (ledger + debt ledger + scorecard)
- `13-executive-summary.md` (top risks, wins, phased roadmap — the human artifact)