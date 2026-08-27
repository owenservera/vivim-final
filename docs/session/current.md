# VIVIM Reconstruction — Session State

> **READ ME FIRST.** Every agent session (Pro or Flash) reads this file + the canon below.
> This survives compaction and model swaps. Update before ending any session.
> **CONTROL-ROOM HANDOFF (newest context): `C:\0-BlackBoxProject-0\VIVIM_0\HANDOFF.md`**

## Canon (read in order — THE LAW)

1. `C:\0-BlackBoxProject-0\VIVIM_0\control-plane\CANON.md` — operating constitution (source-code-first, user-value-first, archaeology-first, SOTA-challenged)
2. `C:\0-BlackBoxProject-0\VIVIM_0\control-plane\PLAN-OF-PLANS.md` — v2 plan (Phases 0-8, Pro gates G0-G8)
3. This file — session state

**Ground-truth law:** NO document inside vivim-final is trusted as fact. Facts come only from
real source code, git evidence, or live runtime probes. In-repo docs are INTENT evidence only.

## Tooling (VIVIM_0/tooling — bun + TypeScript)

| Tool | Command | Output |
|---|---|---|
| Archaeology | `bun VIVIM_0/tooling/archaeology/run-git-archaeology.ts <repo>` | `.genome/topology.json, commits.jsonl, lineage.json, deleted-files.json, GENOME.md` |
| Census | `bun VIVIM_0/tooling/census/run-source-census.ts <repo>` | `.genome/census.json, CENSUS.md` |
| Intent miner | `bun VIVIM_0/tooling/intent/run-intent-miner.ts <repo>` | `.genome/intent-corpus.jsonl, MASTER-BLUEPRINT.md` |
| SOTA challenger | `bun VIVIM_0/tooling/sota/run-sota-challenger.ts <repo>` | `.genome/sota-report.json, CHALLENGES.md` |
| Session | `bun VIVIM_0/tooling/session/session.ts <state\|start\|handoff\|snapshot>` | this file |

## Current phase

**PHASE 0 — GIT ARCHAEOLOGY** (evidence collected 2026-08-27, gate G0 DECISION D-001 proposed)

**Incorporated full-project picture (git-only facts):**
- All lines diverge from `3949aa5` (2026-08-13). **`experimental-dev` = the product lineage**: 5 commits
  ahead — `24576ce` dual-DB split (real: prisma/system 77KB + prisma/user 66KB schemas),
  `391e36b` docs blueprint, bloat removal, and `174ddfa` H1-H15 security remediation
  (safe-eval gate, deps overrides, blocking CI, tsc 0, route-sync 100/100).
- `origin/master` = experimental-dev minus the final H1-H15 commit.
- Local `master` = docs (forensic set) + 4 code experiments (`3b05fcb`, `7f44bfd`, `ad6d2f2`,
  `9ca5527`) that do NOT exist on experimental-dev and were written against single-DB state.
- `docs/decisions/` on experimental-dev: only ADR-001 (CDP Transport Strategy) is real;
  ADR-002..013 are ADR-tool test artifacts.
- **Full project = master ∪ experimental-dev. Proposed integration line = experimental-dev.**
  Decision record: `.genome/DECISIONS.md` (D-001, awaiting owner ratification).

## Open Pro-gate G0 decisions (next Pro session)

1. Ratify or reverse D-001 (integration line = experimental-dev; port master's code
   experiments selectively; demote master's docs to history)
2. D-002 VERIFIED: dev-lineage = RECOVERED_REF (`experimental-dev`); 20/20 golden checkpoint
   SHAs verified (see `.genome/CHECKPOINTS.md`)
3. Commit `.genome/` evidence artifacts (canonical layout per CANON §L9)

## Tooling state (VIVIM_0/tooling — all built + run, see TOOLING-MANIFEST.md)

- phase0 (archaeology+recovery+checkpoints+hygiene), phase1 (census), phase2 (intent),
  phase3 (sota), gate, session — ALL operational; orchestrator: `bun VIVIM_0/tooling/run.ts <cmd>`
- Known cosmetic bugs (fix next session, Flash): sota semver label says "+N major" for any
  positive delta; CHECKPOINTS files-column shows 0 (pipe-in-args issue)
- SOTA first pass: 4/37 deps behind — alasql +2 major, prisma 6→8, typescript-language-server
  +1, libp2p patch. Pro answers CHALLENGES.md at gate G3.

## Handoff log

- 2026-08-27 (Pro): Phase 1 initialization. Read all prework. Built canon + plan-of-plans v2
  + 5 tooling scripts in VIVIM_0. Ran archaeology/census/intent tools — evidence in
  `.genome/`. Verified experimental-dev carries DB split + H1-H15 security state that
  local master lacks. Wrote D-001. **Zero repo mutation. No commits made.**
- 2026-08-27 (Pro): Strategic step-back. Re-read BOTH packs in full. Absorbed best assets into
  control-plane (REFERENCES.md, TOOLING-MANIFEST.md, CANON L10-L12, merged gates).
  Built+proved 5 more tools: recovery (RECOVERED_REF verdict, D-002), checkpoints (20/20
  verified), hygiene (root cleanliness), gate, run orchestrator. Fixed Bun exitCode-reaping
  bug across all tools. SOTA first pass done. Still zero repo mutation.
