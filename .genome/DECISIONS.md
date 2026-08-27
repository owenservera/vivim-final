# DECISIONS — arbitration records (evidence-based)

> Every decision cites git evidence or file reads. Docs are never the basis.
> Canon: C:\0-BlackBoxProject-0\VIVIM_0\control-plane\CANON.md

---

## D-001 — FULL PROJECT = master ∪ experimental-dev, integration line = experimental-dev (RATIFIED 2026-08-27)

**Date:** 2026-08-27 (Pro session)
**Status:** RATIFIED — executed via `git merge --no-ff -X theirs experimental-dev` into master (no force ops, all history preserved). Master remains the branch name; experimental-dev's code state is canonical.

### Evidence (git-only)

- Merge-base of `master`, `origin/master`, `experimental-dev` = `3949aa5` (2026-08-13, "Phase 6").
- `experimental-dev` = `3949aa5` + 5 commits (all real product code):
  1. `24576ce` (08-14) dual-DB split — `prisma/system/schema.prisma` (77 KB) + `prisma/user/schema.prisma` (66 KB) + cross-boundary storage layer
  2. `391e36b` (08-15) docs blueprint + archive straggling docs
  3. `11e6458` (08-15) remove generated binaries from tracking
  4. `2b6adde` (08-15) cleanup bloat
  5. `174ddfa` (08-24) H1-H15 remediation: safe-eval denylist + `VIVIM_UNSAFE_VM=1` gate, deps overrides (audit 20→2 highs), blocking CI (no `|| true`), route-sync 100/100, tsc 0. Also contains `FIXES-APPLIED-2026-08-24.md` + `OUTPUT-2026-08-24.md` + `TICKETS-2026-08-24.md` (audit records).
- `origin/master` = `2b6adde` (experimental-dev minus the H1-H15 commit).
- `master` = `3949aa5` + 12 commits: 8 docs-only (forensic set) + 4 code/test:
  - `3b05fcb` characterization tests, `7f44bfd` boundary-assertions, `ad6d2f2` chrome-governor-resilience, `9ca5527` fixes.
  - **None of these 4 exist on experimental-dev.** They were written against the single-DB state.
- Working tree is checked out at local `master` (single-DB: `prisma/system/` + `prisma/user/` absent on disk).
- `docs/decisions/` on experimental-dev: ADR-001 "CDP Transport Strategy" is real; ADR-002..013 are ADR-tool **test artifacts** ("Review Test Decision", "No Options", "Fresh Decision", "Empty", "No Goals", "Prompt Test", "Goal Roundtrip"...) — NOT real decisions.
- File-level diff master↔experimental-dev: 672 files, +16,663 / −307,868 lines (bloat removal dominates).

### Consequence

The product lineage (DB split, security hardening, CI) lives on `experimental-dev`.
Local master's unique commits are: (a) docs — demoted to intent/history evidence per canon;
(b) 4 code experiments that must be RE-EVALUATED against experimental-dev state:
- `chrome-governor-resilience.ts` → candidate port (real value; adapt to experimental-dev's governor)
- `boundary-assertions.ts` → likely redundant (experimental-dev has its own cross-boundary layer) — verify at census
- characterization tests → rewrite against union state

### Integration (ratified 2026-08-27)

1. Adopt `experimental-dev` as the integration line (checkout or merge strategy TBD at gate G0 execution — no force ops).
2. Port master's 3 code experiments selectively after census comparison.
3. Keep master's forensic docs as history; mark them superseded by code evidence.
4. ADR-002..013 flagged as tool artifacts; only ADR-001 enters the decision record.

### User-value check

Experimental-dev is the state that actually implements the split + ships hardened security —
it is strictly closer to an installable, secure product. Master adds only experiments + docs.

---

## D-002 — Dev-lineage recovery classification: RECOVERED_REF (VERIFIED)

**Date:** 2026-08-27 (Pro session)
**Status:** VERIFIED against local git

### Evidence (git-only)

- `git fsck --full --no-reflogs --unreachable`: **0 dangling commits, 0 garbage** (object store
  clean: 1,278 loose objects / 15.66 MiB, 1 pack / 11.60 MiB).
- The "experimental dev branch with at least five commits" = **`experimental-dev`** ref:
  5 commits past merge-base `3949aa5` → `24576ce` (dual-DB) → `391e36b` (docs) → `11e6458` →
  `2b6adde` (cleanup) → `174ddfa` (H1-H15 remediation, local-only tip).
- GitHub remote: `origin/master` = `2b6adde` (4th of those 5); the 5th commit is local-only.
- No hidden lineage exists in local objects — nothing was lost, nothing to reconstruct.

### Classification (per BRANCH-RECOVERY-PROTOCOL)

**RECOVERED_REF** — the dev lineage is a live local ref (`experimental-dev`), not a lost branch.
The recovery task closes: preserve the ref (never force-op), treat its 5 commits as product code
(D-001), and do NOT run `git gc --prune` during forensics.

### Golden checkpoint verification (20/20 SHAs exist locally)

Genesis `8e3b7c6` (2026-07-09) → Node/ACU `b23813f` → OG migration `a356d1f` → devops `8e4202e`
→ Canvas-native `88e6d2f` → HITL `7c544eb` → VVV transplant `e527f21` → convergence `a208a0b` →
282-errors `8cd6d9f` → UnifiedIO `123b661` → StorageProvider `0766007` → WP-10 transplant
`3abafce` (2,377 files) → deep-scan `14ffb4a` → Tauri V2 `e1952fc` → ActionPlan `f21042c` →
ExecutionKernel wiring `7521b3b` → intelligence upgrade `8d29543` → [diverge at `3949aa5`] →
Dual DB `24576ce` (experimental-dev only) → docs `391e36b` → cleanup `2b6adde`.
Full evidence: `.genome/checkpoint-map.json` + `CHECKPOINTS.md`.
