# PRD — M5: End-to-End Multi-Turn Regression (The Gate)

> Part of the Multi-Turn Conversations roadmap. Scope: `tests/e2e/` + `tests/integration/chat/`.
> Grounded in: `tests/e2e/multi-turn.test.ts` is a **hollow stub** (mock governor, no URL-continuity
> assertion, only checks `createConversation` returns something); `tests/e2e/chat/real-chrome-send.test.ts`
> has a "Multi-turn Chrome" describe that asserts `ok:true` on 2 sends but NEVER asserts the provider
> URL stayed constant or the thread continued on the provider side; `tests/integration/chat/send-receive-cycle.test.ts`
> asserts DB message count (which always increments) — it does NOT prove provider-side continuity;
> `ensure-browser` CLI returns `{ok, source:'adopted'|'spawned'|'none'}` so tests can skip when no
> browser is available.

## Goal
A regression suite that *actually proves* multi-turn: 3 sequential sends to one conversation keep the
provider on the same conversation URL and accumulate 6 DB rows (3 user + 3 assistant), for all three
providers — and skips cleanly when no Chrome is adopted.

## Current State (truth)
- Existing "multi-turn" tests pass for the wrong reason: they only check `ok:true` + DB row count,
  which increments regardless of whether the provider actually continued the thread.
- The only true gap-tests possible today would require the persisted URL (M0/M1/M2) to assert
  continuity — so M5 depends on M2.
- `ensure-browser` precheck exists → tests can gate on `source !== 'none'`.
- Per-provider e2e files already exist (`chatgpt-send.test.ts`, `claude-send.test.ts`) — M5 extends them.

## Success Criteria (gates)
1. **SC-M5-1 (URL continuity asserted):** A test sends 3 messages to ONE conversation and asserts
   `conv.providerConversationUrl` is set after turn 1 and UNCHANGED across turns 2-3 (the real proof
   of thread continuity on the provider side).
2. **SC-M5-2 (DB parity):** After 3 turns, `GET /api/conversations/:id/messages` returns ≥6 rows in
   user/assistant alternation.
3. **SC-M5-3 (per-provider coverage):** Separate specs for `chatgpt`, `claude`, `gemini` under
   `tests/e2e/chat/multiturn.<provider>.ts` (or parametrized), each asserting SC-M5-1 + SC-M5-2.
4. **SC-M5-4 (browser-gated skip):** Every real-Chrome test calls `ensure-browser` and `describe.skip`s
   when `source === 'none'` (no orphan failures in CI without a browser).
5. **SC-M5-5 (headless pipeline green):** `bun run typecheck && bun run lint && bun test` all green
   (unit + integration, regardless of browser availability).
6. **SC-M5-6 (kill the stub):** `tests/e2e/multi-turn.test.ts` is either deleted or upgraded to assert
   real URL continuity with mocks (no more hollow `createConversation`-only test).
7. **SC-M5-7 (audit gate):** `bun run devops audit-code standard` reports no P0/P1.

## Out of Scope
- New backend features (those are M0-M3).
- Frontend-only behavior (M4).

## Acceptance Test (full gate)
- Run `bun run devops runtime-test loop --objective="prove 3-turn continuity for claude"` style:
  with an adopted Chrome, 3 sends → URL constant + 6 rows. Without Chrome, suite skips and still green.

## Definition of Done
All 7 SC pass; the roadmap's headline claim ("full multi-turn conversations working for chatgpt,
claude, and gemini") is provable by `bun test`.
