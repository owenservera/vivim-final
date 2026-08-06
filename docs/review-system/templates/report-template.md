# Report Template (skeleton — every unit report in `runs/<id>/` must match this)

## <AREA-ID> — <Focus Area name>  (run `<run-id>`, git `<short-head>`)

### 1. Scope & Method
What this unit covered, and how (discovery, tools used, depth tier).

### 2. Inventory Observed (live)
What the surface actually contains at review time — files, functions, types,
routes, schemas touched. Re-derived from source, not copied from the manifest.

### 3. Findings Ledger
<!-- Canonical rows. Merge-ready for C2. -->
| Severity | ID | Location | Issue | Evidence | Recommendation | Owner |
|----------|----|----------|-------|----------|----------------|-------|
| P0 | B1-1 | `src/foo.ts:42` | one-line issue | quoted snippet / measured number | concrete fix | (team) |
| P1 | B1-2 | ... | ... | ... | ... | |

Rules:
- One row per distinct finding. If a finding belongs to another area, tag it
  `→ B3` in the Location cell and still record it.
- P0/P1 must have an *actionable* recommendation. P3 may be a design note.
- Owner: suggest a role/team (e.g. `backend`, `frontend`, `data`, `ops`) so C2 can
  build the debt ledger. Leave blank if unknown.
- Empty sections are fine; write "None found." rather than deleting the heading.

### 4. Positive Observations
What is done well here (concrete, so the team keeps it that way).

### 5. Fix List (actionable, ordered)
Short, do-now bullet list of the P0/P1 items from the ledger (no re-analysis).

### 6. Opportunity Scan (this area only)
Better architecture / better or missing libraries for THIS area. Full ecosystem
synthesis lives in C1; keep this scoped and concrete.

### 7. Open Questions / Requires-Decision
Anything blocking a verdict, or a judgment call the team must make.
