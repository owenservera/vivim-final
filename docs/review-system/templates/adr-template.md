# ADR Template — Best-Practice Codification (match existing `docs/decisions/ADR-*.md`)

Fill this in when a review finding is promoted to a codified engineering decision.
Keep the same spine as existing ADRs (Problem → Context → Options → Decision →
Interface → Consequences → Review History) so the index stays uniform.

---

# ADR-NNN: <Title — the best practice you are codifying>

**Status:** PROPOSED | APPROVED | REVISED | SUPERSEDED
**Date:** YYYY-MM-DD
**Author:** (implementer)
**Finding:** FIX-<AREA>-<n> (from review run `<run-id>`)
**Related units/areas:** (e.g. B1 architecture, B5 security)

## Problem Statement

Why the finding matters: the failure mode, the cost of leaving it, and who hits it.

## Context

- What the codebase does today (evidence: `file:line`).
- Constraints (stack, invariants, existing ADRs it builds on / contradicts).
- The blast radius if the best practice is adopted vs ignored.

## Options Considered

### Option A: <option>
**Pros:** …
**Cons:** …
(keep to 2–3 real options; the deciding factors must be concrete)

### Option B: <option> (SELECTED)
**Pros:** …
**Cons:** …

## Decision

**Selected:** Option B.
**Rationale:** one paragraph tying the choice back to the review evidence and the
CONSTITUTION thresholds it improves.

## Interface / Contract

The rule, in enforceable form — how a future reviewer KNOWS the practice holds:
- measurable gate (e.g. "no function > 75 LOC" → lint rule / metric)
- or structural rule (e.g. "engines depend on storage contracts, never impls")
- or workflow rule (e.g. "every P0/P1 fix runs its verification recipe")

## Consequences

- What changes now (files, scripts, gates).
- What future reviews will verify (link the metric or checklist item).
- Anything explicitly deferred.

## Review History
[No reviews yet]
