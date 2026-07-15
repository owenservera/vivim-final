# PRD-DISC-3: CDP Runtime-Enable / evaluate Elimination

**Status:** Proposed · **Priority:** P0 · **Phase:** 1 (atomic-v12 1.2)
**Owner:** vivim-runtime · **Depends on:** none

## 1. Problem
The Governor Canon states only `ChromeGovernor` may open CDP. Yet `slave-read.ts:40` calls
`Runtime.enable` directly and `evaluate` is used in `slave-write.ts:102/115`,
`cdp-transport.ts:214`, `cdp.ts:261`. These raw `Runtime.enable`/`evaluate` calls are exactly the
taxonomy the runtime-OS `engage` step needs to eliminate: probing a page should use Governor-mediated
`evaluate`/`enableDomains`, never raw. This blocks R2 (engage) and risks double-enabling Runtime.

## 2. Current State (research-first)
- `src/executor/slave-read.ts:40` — `Runtime.enable` sent directly (UI probe).
- `src/executor/slave-write.ts:102,115` — `Runtime.evaluate` for CSS + scroll.
- `src/executor/cdp-transport.ts:214` — `Runtime.evaluate` wrapper.
- `src/executor/cdp.ts:261` — `Runtime.evaluate` for capability extraction.
- `src/engines/chrome-governor.ts` has `enableDomains` + `evaluate` (the sanctioned surface) but
  they are NOT used by the slave modules.

## 3. Design
- Remove `Runtime.enable` from `slave-read.ts`; rely on Governor `enableDomains(['Runtime','DOM','Page'])`.
- Route all `evaluate` through `governor.evaluate(targetId, expr, opts)` (await session attach).
- Add a lint/guard: `Runtime.enable` / raw `Runtime.evaluate` string literals flagged in CI (allowed
  only inside `chrome-governor.ts`).
- Keep `cdp-transport.ts` as the low-level transport; it may send evaluate only when invoked BY the
  Governor (not by slaves).

## 4. Implementation Steps
1. `slave-read.ts`: drop `Runtime.enable`; call `governor.enableDomains(['Runtime','DOM','Page'])` once.
2. `slave-write.ts` + `cdp.ts`: replace `Runtime.evaluate` with `governor.evaluate(...)`.
3. `cdp-transport.ts`: gate `evaluate` behind a `viaGovernor` flag (set by Governor only).
4. Add CI grep guard for raw `Runtime.enable` outside `chrome-governor.ts`.

## 5. Acceptance Criteria
- grep across `src/executor` returns ZERO `Runtime.enable` outside `chrome-governor.ts`.
- A UI probe still returns capability map (covered by `tests/integration`).
- `bun run typecheck` clean.

## 6. Tests
- `tests/integration/engines/chrome-governor.test.ts`: enableDomains + evaluate path exercised.
- grep guard test in CI.

## 7. Dependencies
- Hard prereq for R2 (engage) and R3.2 (ui-gate).
- Independent of other DISC PRDs.

## 8. Risks
- Behavioural change in probe timing → cover with an integration test on a headless page.
