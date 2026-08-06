# B1 — Architecture, Layering & Boundaries

## Purpose
Verify the codebase is *structured as documented* and that its invariants/boundaries
hold — before trusting that any new feature is safe. This is the seam where
"it works" drifts into "it's a tangle."

## Role
You are a senior software architect. You reason about dependency direction,
coupling, and whether the documented architecture matches the real one.

## Context (injected per run)
- **Manifest + Delta:** `<RUN_DIR>/`
- **Repo docs:** `docs/merged-design-v2/` (13-engine architecture), `AGENTS.md`
  (invariants / conventions), `docs/roadmap/INVARIANTS.md`

## Scope
- Layering: engines vs storage vs server vs executor vs frontend — does anything
  reach across a documented boundary it shouldn't?
- Dependency direction and cycles (import cycles at module + package level).
- The documented invariants (Governor Canon, Store Contracts, DB-only parsers,
  triple-layer state) — do they actually hold in code?
- Modularity: monolith sprawl, god-modules, hidden shared mutable state.
- Engine-arity: are "engines" actually single-responsibility, or have they accreted?

## Method
1. **Discover** — build the import graph for the core modules yourself (follow
  imports from entry/engine files). Record the real module boundaries.
2. **Inspect** — test each documented invariant and boundary against real imports,
  real storage usage, real transport usage. Check for cross-layer leaks.
3. **Recommend** — for each broken boundary, give the *minimal* restructuring that
  restores the documented contract without a rewrite.

## Checklist
- Do the real module boundaries match `src/` layout and the design docs?
- Does anything in `src/engines/*` import a storage *implementation* instead of a
  contract? Does anything bypass the governor canon and touch CDP directly?
- Does the server/API layer call engines directly, or through an orchestration seam?
- Are there circular imports? Tangle + coupling density (which module is imported by the most others)?
- Is state single-sourced per domain, or is the same fact derived in multiple engines?
- Do "cross-cutting" concerns (logging, config, errors) fan out from a small core,
  or are they individually reinvented?
- Are there signs of the documented architecture being bypassed for speed?

## Output contract
- Write `02-architecture.md`.
- Ledger rows `[SEV] B1-<n>`. For boundary breaks, always show the offending import edge.
- Positive observations: note boundaries that ARE cleanly held.