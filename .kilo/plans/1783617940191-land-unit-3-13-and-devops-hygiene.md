# Plan — Land Unit 3.13 & Restore DevOps Hygiene

**Goal:** Get the atomic build loop back on track by (1) landing the in-flight unit **3.13 Store impls**, (2) correcting cosmetic doc drift, and (3) resuming the sequential devops loop at 3.14.

**Mode note:** Requires source edits + git commits + `devops mark`. Switch to an implementation-capable agent to execute.

---

## Assessment (verified this session)

- **DevOps mechanics:** `devops/select.ts` + `tracker.ts` + `deps.ts` read **only** `docs/atomic/01-tracker.md` (unit state) and each `docs/atomic/phase-*/*.md` `**Depends:** … | **Produces:` header. `computeStats`/`updateHeader` recompute the tracker header on every `mark`, so the tracker self-heals.
- **`00-master-plan.md` and `PROGRESS.md` are NOT read by any devops script.** Their drift is cosmetic/process-only and does **not** break the loop.
- **`deps.ts` blind spot (known, non-blocking):** grouped atomic files titled `# Unit 3.8-3.12 …` only register deps for `3.8`; units 3.9–3.13 resolve to empty deps (permissive selection). Acceptable for now.
- **Unit 3.13 code already written (uncommitted, untracked):**
  - `src/storage/impl/governor-store-impl.ts`, `conversation-store-impl.ts`, `health-store-impl.ts`, `stream-block-store-impl.ts`
  - `tests/helpers/prisma-mock.ts`
  - `tests/unit/storage/impl/*.test.ts` (4 files)
- **Current gate result:** `typecheck PASS` · `lint FAIL` (all auto-fixable) · `test FAIL` (1 test).

---

## Task 1 — Land unit 3.13 (primary)

### 1a. Fix the 1 failing test at its root cause (deterministic ordering)
`GovernorStoreImpl > createFleetEvent + getFleetEvents returns newest-first` fails because both events get an identical `ts = Date.now()` (same ms), so `orderBy {ts:'desc'}` cannot break the tie and insertion order wins.

**Fix in `src/storage/impl/governor-store-impl.ts`** — add a ULID-monotonic tiebreaker (ULIDs from `newId()` are time-sortable, so `id desc` = newest-first even within the same ms):
- `getFleetEvents`: change `orderBy: { ts: 'desc' }` → `orderBy: [{ ts: 'desc' }, { id: 'desc' }]`
- `getTrace`: change `orderBy: { ts: 'desc' }` → `orderBy: [{ ts: 'desc' }, { id: 'desc' }]` (same determinism; the mock and real Prisma both accept array `orderBy`)

No test edits needed after this; the assertion becomes valid.

### 1b. Resolve `noUselessConstructor` in `stream-block-store-impl.ts`
Biome flags the pass-through constructor. Simplify the class and drop the now-unused import:
- Body becomes: `export class StreamBlockStoreImpl extends StreamBlockStore implements StreamBlockStoreContract {}`
- Remove the `import type { CapStoreDb } from '../db.js'` line (becomes unused once the constructor is gone). Keep `StreamBlockStore` + `StreamBlockStoreContract` imports.

### 1c. Apply remaining auto-fixes (imports/formatting only)
Run: `bunx biome check --fix --unsafe src/ tests/`
- Fixes `organizeImports` in the 4 impl files + stream-block test, and multiline formatting in the 3 impl test files + `prisma-mock.ts`.
- Re-inspect the diff to confirm only import-order/formatting changed (no logic).

### 1d. Verify green
Run: `bun run devops/index.ts gate`
- Expect `PASS run typecheck | PASS run lint | PASS test` (should be ~172 pass / 0 fail).
- If any test still fails, fix root cause and re-run (max 3 attempts per devops SKILL); if truly blocked, `devops mark 3.13 blocked`, append reason to `PROGRESS.md`, `git checkout -- .`, stop.

### 1e. Mark done + commit + audit
- `bun run devops/index.ts mark 3.13 done`
- `git add -A && git commit -m "feat(StoreImpls): implement unit 3.13 Phase 3 store impls + tests"`
- Append to `docs/atomic/PROGRESS.md`:
  `[<ISO ts>] 3.13 Store impls: Phase 3 stores -> done [<git-sha>] PASS typecheck | PASS lint | PASS test`

---

## Task 2 — Doc hygiene (cosmetic; do NOT let it block the loop)

### 2a. `docs/atomic/00-master-plan.md`
It has drifted (`115 total`, `5 done`, all-pending status table) and duplicates the tracker's volatile counts. Prefer **removing the volatile numbers** so it cannot drift again:
- Header line: `**Total units:** 115` → `**Total units:** 114`.
- "Phase Unit Counts" table `Status` column + the `**Total** | | **114** | **N done**` row: replace per-phase status cells and the total-done cell with a pointer such as `See 01-tracker.md (authoritative)`, or update to current reality (Phase 1 ✓, Phase 2 ✓, Phase 3 in progress, rest pending). Recommended: replace counts with the pointer to avoid future drift.

### 2b. `docs/atomic/PROGRESS.md`
Currently only the header. Backfill audit lines for units completed this session so the log is coherent, then append one line per unit going forward (per Task 1e). Backfill (use real SHAs from `git log`):
- `3.8 StreamBlockStore`, `3.9 GovernorStore`, `3.10 ConversationStore`, `3.11 StreamBlockStore contract`, `3.12 HealthStore`, `3.13 Store impls` → each `-> done [sha] PASS typecheck | PASS lint | PASS test`.

### 2c. (Optional, defer) `deps.ts` grouped-file blind spot
Do not fix now. If precise dependency gating becomes necessary later, either split grouped atomic files into one-`# Unit`-heading-per-file, or extend `deps.ts` to parse multiple `# Unit X.Y` / range headings. Track as a backlog note only.

---

## Task 3 — Resume the sequential loop

1. `bun run devops/index.ts select` → expect **3.14 ConversationManager context injection** (atomic spec: `docs/atomic/phase-3-governor/09-context-injection.md`; adds to the 3.6 pipeline in `src/engines/conversation-manager.ts`).
2. Follow devops SKILL per unit: `mark in_progress` → read atomic file (Source: `04-merged-engines.md §2/§3`) → implement + tests → `gate` → `mark done` → commit → append `PROGRESS.md`.
3. Completing 3.14 closes Phase 3 → `phaseIsOpen` opens **Phase 4** (starts at 4.1 StreamParserEngine). Continue sequentially.
4. Fidelity gate (AGENTS.md): at the **first unit of Phase 4**, cross-check the Phase 4 atomic files against `docs/merged-design-v2/04-merged-engines.md` before coding; log any `⚠ DRIFT` to `PROGRESS.md` and fix the atomic file first.

---

## Implementation guardrails (apply throughout)

- **Source of code = `docs/merged-design-v2/` + atomic files.** These are specs (interfaces + SQL patterns + test/gate contracts), not copy-paste bodies. Implement by faithfully translating the documented interface/contract into Prisma calls; the mapper layer bridges contract row names ↔ real Prisma columns (e.g. `failureCount`↔`failCount`, `accountSlug`↔`email`, `detailJson`↔`eventDataJson`). Do not invent behavior beyond the spec; do not change `prisma/schema.prisma` to fit a contract.
- **PowerShell only** (AGENTS.md): no `grep/cat/head`; use `Select-String`, `Get-Content`, `Select-Object -First`.
- **One unit at a time, gate before done, commit per unit, clean tree.**

## Validation

- Primary: `bun run devops/index.ts gate` → `PASS | PASS | PASS`.
- After mark: `bun run devops/index.ts report` shows `done: 30/114`, Phase 3: 13/14.
- `git status` clean after each unit commit.
- `bun run devops/index.ts select` returns 3.14 (confirms loop integrity).

## Rollback

- If 3.13 can't go green in 3 attempts: `devops mark 3.13 blocked`, append reason to `PROGRESS.md`, `git checkout -- .` to discard the unit's working changes so dependents aren't contaminated, then stop and report.

## Open questions

- **2a style:** replace master-plan counts with a "see tracker" pointer (recommended, drift-proof) vs. update them to current numbers? Default to the pointer unless you want the numbers kept in sync manually.
