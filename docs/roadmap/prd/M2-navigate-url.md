# PRD — M2: Navigate to Persisted URL on Turn 2+

> Part of the Multi-Turn Conversations roadmap. Scope: `conversation-manager.ts` send pipeline.
> Grounded in: `conversation-manager.ts:289-299` (root-url-only navigation); the composer selector
> is resolved at `:322-326` *before* the optional navigation at `:294` — meaning after a nav the
> selector may be stale; M1 guarantees `conv.providerConversationUrl` is populated after turn 1.

## Goal
On turn 2+, ensure the Chrome slave is on the *exact* provider conversation URL before typing, so
the provider continues the same thread instead of starting a new one.

## Current State (truth)
- Navigation logic only compares against `PROVIDER_URL_PATTERNS` (root). Never targets a specific
  conversation URL.
- `Page.navigate` is issued but the code does NOT wait for the composer to re-render, and resolves
  the composer selector *before* navigating — fragile on SPA route changes.
- `findWorkingSelector` / `waitForSelector` helpers already exist in `provider-selectors.ts`.

## Success Criteria (gates)
1. **SC-M2-1 (re-target on turn 2+):** If `conv.providerConversationUrl` is set and current page
   URL differs, the manager calls `Page.navigate(providerConversationUrl)` then waits for the composer
   (via `waitForSelector`) before typing.
2. **SC-M2-2 (composer resolved post-nav):** The working composer selector is resolved *after*
   navigation completes, not before — eliminating stale-selector failures.
3. **SC-M2-3 (no nav when already there):** If current URL already equals `providerConversationUrl`,
   no `Page.navigate` is issued (avoids needless reload + lost context).
4. **SC-M2-4 (graceful fallback):** If navigation fails (cdp error / timeout), the manager falls back
   to the current page and continues the send (never hard-fails a turn; logs a warning).
5. **SC-M2-5 (turn 1 unchanged):** When `providerConversationUrl` is null, behavior equals today
   (root-url check + navigate-to-root only).
6. **SC-M2-6 (integration test):** `tests/integration/engines/conversation-manager.test.ts` (new or
   extended) with a recording mock cdp asserts `Page.navigate` is called with the persisted URL on
   turn 2, and with the root URL on turn 1.
7. **SC-M2-7 (typecheck/lint):** green.

## Out of Scope
- Capture pattern correctness (M3).
- Frontend changes (M4).

## Acceptance Test (backend)
- Integration test: two sequential `send` calls on one conversation; mock cdp records navigate URLs;
  assert `[root] → [persisted conversation url]`.

## Definition of Done
All 7 SC pass; a second turn demonstrably targets the same provider thread.
