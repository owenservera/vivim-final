# Provider Logic Metadata — Complete Design

**Date:** 2026-07-11
**Status:** Design complete, atomic specs created, ready for implementation

---

## Summary

### Problem
The current schema is missing 3 targeted adjustments to fully support the provider logic lifecycle:
1. Missing DOM interaction config fields
2. Naming inconsistency for selector portfolio
3. Manual hash computation prone to error
4. Missing validation for delta paths

### Solution
4 new atomic units added to Phase 2:
- 2.13: ProviderEndpoint DOM Interaction Config
- 2.14: ProviderEndpoint selectorsJson Rename
- 2.15: ProviderParser Hash Auto-computation
- 2.16: ProviderStreamConfig Delta Path Validation

### Files Created
| File | Purpose |
|------|---------|
| `docs/atomic/phase-2-providers/13-endpoint-dom-interaction.md` | Atomic spec for DOM interaction config |
| `docs/atomic/phase-2-providers/14-selectors-json-rename.md` | Atomic spec for selectorsJson rename |
| `docs/atomic/phase-2-providers/15-parser-hash-autocompute.md` | Atomic spec for hash auto-computation |
| `docs/atomic/phase-2-providers/16-deltapath-validation.md` | Atomic spec for delta path validation |
| `docs/roadmap/RESEARCH-REPORT.md` | Research report for all 4 units |
| `docs/roadmap/INTERVIEW-LOG.md` | Interview log with user approval |
| `docs/audits/ARCHITECTURAL-ADJUSTMENTS.md` | Architectural analysis |
| `docs/audits/PROVIDER-LIFECYCLE.md` | Provider logic lifecycle design |

### Tracker Updated
- Phase 2: 12 → 16 units
- Total: 208 → 212 units
- Done: 164
- Pending: 41 → 45

---

## Implementation Plan

### Step 1: Unit 2.13 — ProviderEndpoint DOM Interaction Config
1. Add migration for 3 new columns
2. Update Zod schema
3. Update types
4. Update ProviderRegistrar
5. Update seed data

### Step 2: Unit 2.14 — ProviderEndpoint selectorsJson Rename
1. Add migration for column rename
2. Update all references
3. Update seed data

### Step 3: Unit 2.15 — ProviderParser Hash Auto-computation
1. Add hash computation function
2. Update ProviderRegistrar

### Step 4: Unit 2.16 — ProviderStreamConfig Delta Path Validation
1. Add Zod validation regex
2. Update ProviderManifestSchema

---

## Devops Cycle Integration

### Atomic Tracker
- Units added to Phase 2 in `docs/atomic/01-tracker.md`
- Atomic specs created in `docs/atomic/phase-2-providers/`

### Devops Roadmap
- Research report created in `docs/roadmap/RESEARCH-REPORT.md`
- Interview log created in `docs/roadmap/INTERVIEW-LOG.md`
- Domain health unaffected (provider-routing still 100%)

### Implementation Loop
- Units are now eligible for `bun run devops select`
- Dependencies are clear: 2.14 depends on 2.13
- All units are low-risk, backward compatible

---

## Next Steps

1. Run `bun run devops select` to get next unit
2. Implement unit per atomic spec
3. Run `bun run devops gate` to validate
4. Mark unit as done in tracker
5. Repeat for remaining units
