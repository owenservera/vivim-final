# PRD — M1: Capture Provider Conversation URL on Turn 1

> Part of the Multi-Turn Conversations roadmap. Scope: `conversation-manager.ts` send pipeline.
> Grounded in: `conversation-manager.ts:289-299` (only checks provider ROOT url, never a specific
> conversation url); `governor.cdp.getPageState(slaveId)` returns `{url,title}` (chrome-governor.ts:386);
> `CAPTURE_PATTERNS` exist at conversation-manager.ts:128; M0 provides `providerConversationUrl` field.

## Goal
After turn 1's capture succeeds, read the live page URL and persist it as the conversation's
`providerConversationUrl` so M2 can re-open the exact thread.

## Current State (truth)
- `sendInternal` calls `getPageState` only to decide if it must navigate to the *root* provider URL.
- No read of the post-send URL; no write to `providerConversationUrl`.
- Capture happens at `conversation-manager.ts:394` via `governor.cdp.capture(...)`.
- `updateConversation` is already called at line 433 (for messageCount) — a second call is cheap.

## Success Criteria (gates)
1. **SC-M1-1 (capture+persist):** On a successful turn-1 send, after capture, the manager reads
   `getPageState(slaveId).url` and writes it to `updateConversation(id, { providerConversationUrl })`.
2. **SC-M1-2 (only on first turn):** URL is written only when `conv.providerConversationUrl` is null
   (avoids overwriting a correct URL on later turns). If already set, no write occurs.
3. **SC-M1-3 (normalize):** A pure helper `normalizeConversationUrl(providerId, rawUrl)` strips
   query/fragment and keeps the conversation path (e.g. `claude.ai/chat/<uuid>`, `chatgpt.com/c/<uuid>`,
   gemini session path). Unit-tested per provider.
4. **SC-M1-4 (best-effort):** If `getPageState` throws or returns no url, the send still returns
   `ok:true` and URL stays null (no pipeline break).
5. **SC-M1-5 (unit test):** Mock store + mock cdp asserts URL written on turn 1, not on turn 2+.
6. **SC-M1-6 (typecheck/lint):** `bun run typecheck` + `bun run lint` green.

## Out of Scope
- Navigation on turn 2+ (M2).
- Verifying capture regex (M3).

## Acceptance Test (backend)
- `tests/unit/engines/conversation-manager.test.ts` (new): inject a `getPageState` mock returning a
  provider conversation URL; assert `updateConversation` received `providerConversationUrl` on first
  `send`, and a second `send` does NOT re-write it.

## Definition of Done
All 6 SC pass; URL persists for M2 to consume.
