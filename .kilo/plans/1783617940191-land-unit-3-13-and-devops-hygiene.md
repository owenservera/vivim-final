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

---

## Progress since plan (execution log)

### Completed
- **3.13 Store impls** — `gate PASS|PASS|PASS`. Committed `ce60282`. PROGRESS line added.
- **Doc hygiene** — `00-master-plan.md` totals → 114, status table → structural-only pointer; `PROGRESS.md` backfilled 3.8–3.13. Committed `765d051`.
- **3.14 ConversationManager context injection** — added `ConversationContext` interface + `buildConversationContext()` helper; injected as step [1.5] in `send()` (writes `contextJson` via `ConversationStore.updateConversation`). Tests added. `gate PASS|PASS|PASS`. Committed `bcc7263`. PROGRESS line added. Phase 3 now **14/14**.
- **Phase 4 fidelity cross-check** — `docs/atomic/phase-4-engines/01-stream-parser.md` verified **FAITHFUL** to `04-merged-engines.md §3` (class shape, `ParserStore`, `ParserModule`, `ParseResult`, `ParserConfig`, fallback chain all match). No drift.

### In progress — Unit 4.1 StreamParserEngine
Implemented (uncommitted):
- `src/storage/contracts/parser-store.ts` — `ParserStore` + `ProviderParserRow` (new contract; matches spec).
- `src/engines/stream-parser.ts` — real `StreamParserEngine` class with built-in claude/generic/system parsers, dynamic-import of seed `filePath`, 3-tier fallback chain (provider → generic → system → error block), `detectCompletion`/`reloadParser`/`preloadAll`, `parserCache`.
- `src/engines/conversation-manager.ts` — `StreamParserEngine`/`ParseResult`/`ContentBlock` now imported from `stream-parser.ts` (stub removed; re-exported for backward compat).
- `tests/fixtures/parsers/{claude-ok,throws}.ts` + `tests/unit/engines/stream-parser.test.ts`.

**Gate status:** typecheck PASS · lint PASS · test FAIL (1 test).

### 🐞 Root cause of the 4.1 test failure (needs fix)
The test `parse() falls back to generic parser when provider parser throws` fails because `expect(result.blocks.length).toBeGreaterThan(0)` receives `0`.

Cause: `builtinGeneric.parse('frame')` only emits blocks for lines beginning with `data:`; for non-SSE input like `'frame'` it returns `[]`. The generic fallback therefore yields zero blocks, so the assertion fails.

**Exact fix (one block in `builtinGeneric.parse` in `src/engines/stream-parser.ts`):** after the frame loop, if `blocks.length === 0`, push `{ kind: 'text', content: rawBody, index: 0 }`:
```typescript
      if (blocks.length === 0) blocks.push({ kind: 'text', content: rawBody, index: 0 })
      return blocks
```
This makes the generic parser lenient (never empty) and the fallback test passes; the "all parsers fail → error block" test is unaffected (it forces throws at every tier via `config.genericFilePath`/`fallbackFilePath`).

### Remaining steps for 4.1 (implementation agent)
1. Apply the `builtinGeneric` leniency fix above.
2. `bunx biome check --fix --unsafe src/ tests/` (normalize any CRLF/import order).
3. `bun run devops/index.ts gate` → expect `PASS typecheck | PASS lint | PASS test`.
4. `bun run devops/index.ts mark 4.1 done`.
5. `git add -A && git commit -m "feat(StreamParserEngine): implement unit 4.1 parser engine + tests"`.
6. Append PROGRESS line: `[2026-07-09] 4.1 StreamParserEngine -> done [<sha>] PASS typecheck | PASS lint | PASS test`.
7. `bun run devops/index.ts select` → expect 4.2 CapabilityEngine; continue loop (Phase 4 = 31 units).

### Note on tooling
- Ad-hoc `bun <script>.ts` debug runs are **blocked by permission rules** (only `bunx`, `bun test`, `bun /tmp/dbg.ts`, `bun run devops/index.ts *` are allowed). Diagnose via reading code / `bun test` instead.
- Use `C:\Users\VIVIM.inc\AppData\Local\Temp\kilo` (or a path inside the repo) for temp scripts — **never** `C:\tmp` (non-existent on this host).
- Use absolute module import paths (`C:/0-BlackBoxProject-0/vivim-final/src/...`) when a debug script lives outside the repo.

