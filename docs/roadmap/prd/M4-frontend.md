# PRD — M4: Frontend Multi-Turn Robustness (ChatPage)

> Part of the Multi-Turn Conversations roadmap. Scope: `web/ui/src/features/chat/`.
> Built with the `vivi-frontend` skill (slot-resolved, FRONTEND=BACKEND). Grounded in:
> `ChatPage.tsx` `doSend` (`:275-318`) appends a **fake assistant error bubble** on failure
> (`{id:'err_…', role:'assistant', content:'(error) …'}`) instead of using the `chat.error` slot;
> `fetchMessages` is called on open/select (`:189`, `:242`) but NOT re-fetched after a send;
> surface is already fully slot-composed (`chat.entry/sidebar/thread/composer/error`) — no new
> slots needed.

## Goal
Make the frontend a faithful, resilient view of the backend conversation: errors show in the
`chat.error` slot (never as phantom messages), and the thread reconciles with the server after
each turn so multi-turn stays consistent with the DB.

## Current State (truth)
- `doSend` optimistic-renders the user bubble, then on `!result.ok` pushes a fake `role:'assistant'`
  error bubble (`:296-304`). This diverges from the DB (which never stored that row) and pollutes
  multi-turn history.
- After a successful send, the thread is NOT re-fetched — local state can drift from DB if the
  backend stored a different/richer result.
- Switching provider/conversation resets `messages`/`activeId` but `error`/`sending` are not always
  cleared in every path.
- All rendering goes through slots (good) — no `if (slug)` branching to add.

## Success Criteria (gates)
1. **SC-M4-1 (no phantom bubbles):** On send failure, NO assistant message is appended; the
   `chat.error` slot shows the message and `sending` resets. Local message count stays in parity
   with the DB.
2. **SC-M4-2 (reconcile after send):** After a successful send, the thread re-syncs from
   `fetchMessages(activeId)` so local === DB (catches streamed/blocked results).
3. **SC-M4-3 (error cleared on switch):** Selecting a different conversation/provider clears
   `error` and `sending`.
4. **SC-M4-4 (component test):** `tests/unit/web/chat-page.test.tsx` (new) drives `doSend` with a
   mocked `sendMessage` (success + failure) and asserts: failure → no new assistant bubble + error
   set; success → thread length matches server messages.
5. **SC-M4-5 (FRONTEND=BACKEND):** No `if (slug===…)` added; rendering still via slots/registry.
   `bun run devops audit-code standard` finds no P0/P1 on these files.
6. **SC-M4-6 (build/lint):** `bun run build` (web/ui, vite) + `bun run lint` green.
7. **SC-M4-7 (visual gate):** `bun run devops runtime-test verify` screenshot shows 2+ turns in one
   thread with no phantom error bubble.

## Out of Scope
- New capability globals / slots (not needed).
- Backend API changes (M0-M3 own those).

## Acceptance Test (frontend)
- `doSend` failing → `messages` unchanged in count, `error` non-null.
- `doSend` succeeding → after settle, `fetchMessages` called and rendered list equals DB rows.

## Definition of Done
All 7 SC pass; multi-turn UI is a faithful mirror of the backend.
