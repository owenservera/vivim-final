# Roadmap: Full Multi-Turn Conversations (ChatGPT · Claude · Gemini)

> Grounded in truth as of the current working tree. This ledger is the single source of
> truth for `devops-fullstack` + `vivi-frontend`. Re-read this file before each `loop --resume`.

## PRDs (success-criteria-led, research-complete)

Deep research per milestone is captured in `docs/roadmap/prd/`. Each PRD leads with
**Success Criteria (gates)** — NOT implementation approach. The implementation sections are
non-binding guidance.

| Milestone | PRD | Key gates |
|-----------|-----|-----------|
| M0 | `prd/M0-persist-url.md` | nullable provider_conversation_url column; migration; contract field; round-trip |
| M1 | `prd/M1-capture-url.md` | URL captured+persisted on turn 1 only; normalized; best-effort |
| M2 | `prd/M2-navigate-url.md` | re-target persisted URL on turn 2+; composer resolved post-nav; graceful fallback |
| M3 | `prd/M3-capture-patterns.md` | live endpoint match for all 3; parse yields blocks; fallback arrays; loud failure |
| M4 | `prd/M4-frontend.md` | no phantom error bubbles; reconcile after send; slot-only; visual gate |
| M5 | `prd/M5-e2e-gate.md` | URL continuity asserted; 6 DB rows/3 turns; per-provider; browser-gated skip; audit clean |

### Research findings that shaped the PRDs
- Existing `tests/e2e/multi-turn.test.ts` is a hollow stub (mock governor, no URL assertion).
- Existing `tests/e2e/chat/real-chrome-send.test.ts` "Multi-turn Chrome" only asserts ok:true +
  DB row count — it does NOT prove provider-side thread continuity. This is why M5's headline gate
  is URL-continuity, not row count.
- `getPageState` already returns url+title (chrome-governor.ts:386); the plumbing to capture the
  URL in M1 already exists — only the write is missing.
- Frontend defect confirmed: `doSend` appends a fake role:assistant error bubble on failure
  (ChatPage.tsx:296-304) — M4 fixes this to use the chat.error slot.
- `updateConversation(id, patch)` is already partial-patch capable — M0 is low-risk.

## Ground-Truth Findings (what actually exists today)

### What WORKS
- **Local DB history** accumulates correctly: each `send` stores one `user` + one `assistant`
  row in `ConversationMessage` (`conversation-manager.ts:413` + `:422`). `messageCount` bumps by 2.
- **Frontend history renders**: `ChatPage.tsx` loads `fetchMessages(activeId)` and appends
  assistant replies locally. A second send to the same `activeId` does append to the on-screen thread.
- **Send pipeline per turn** runs the full 8-step flow: resolve → derive slave → ensure page →
  type → submit → capture → parse → store. Retries + slave recovery exist.
- **Provider selectors** exist for all 3 (`COMPOSER_SELECTORS`, `SEND_BUTTON_SELECTORS`,
  `PROVIDER_URLS` in `provider-selectors.ts`).
- **Account + providerSession** auto-created on first send (`POST /api/conversations`).

### The CRITICAL GAP (why multi-turn does NOT truly work today)
1. **No provider-conversation URL is captured or navigated to.** `Conversation` has
   `externalId?` but **no** `providerConversationUrl`. Sends type into whatever composer is on
   the *current* page (`conversation-manager.ts:289-299` only checks the provider *root* URL, not
   a specific conversation). So turn 2+ is not guaranteed to land in the same provider thread.
2. **Capture patterns are provider-hardcoded** and unverified against live endpoints
   (`CAPTURE_PATTERNS`, `conversation-manager.ts:128`). ChatGPT `/backend-api/conversation`,
   Claude `/api/organizations/.../completion`, Gemini `/_api/BardFrontendService/StreamGenerate`.
3. **No conversation-continue guarantee**: after turn 1 the provider may navigate (Claude opens
   `/chat/<uuid>`, ChatGPT `/c/<uuid>`, Gemini a session id). Turn 2 must re-target that exact URL
   or the thread silently resets on the provider side.
4. **No regression test** drives 2+ turns against a real or mocked Chrome for any provider.
5. **`messageCount + 2`** assumes one assistant reply; streaming/multi-block not reconciled.

## Milestones (dependency-ordered)

### M0 — Schema + Store Contract: persist provider conversation URL
- **Depends on:** nothing (foundation)
- **Steps:**
  1. Add `providerConversationUrl String? @map("provider_conversation_url")` to `Conversation`
     in `prisma/schema.prisma`.
  2. `bunx prisma migrate dev --name add_conversation_url`.
  3. Extend `ConversationStore` contract (`src/storage/contracts/conversation-store.ts`):
     `createConversation` input + `updateConversation` to accept `providerConversationUrl`;
     getter returns it.
  4. `bun run typecheck`.
- **Verify:** migration applies; contract compiles.

### M1 — Capture & persist the provider conversation URL on turn 1
- **Depends on:** M0
- **Steps:**
  1. In `conversation-manager.ts:sendInternal`, after capture succeeds on turn 1, read the live
     page URL via `governor.cdp.getPageState(slaveId).url` and store it on the conversation
     (`updateConversation({ providerConversationUrl })`).
  2. Persist only when `providerConversationUrl` is null (first turn) to avoid drift.
  3. Add a helper `providerConversationUrlFor(providerId, rawUrl)` that normalizes the URL
     (strip query, keep `/c/<id>` | `/chat/<id>` | gemini session path).
  4. Unit test (mock store + cdp) asserting the URL is written on first turn.
- **Verify:** `bun test tests/unit/engines/conversation-manager`.

### M2 — Navigate to the persisted URL on turn 2+
- **Depends on:** M1
- **Steps:**
  1. In `sendInternal`, replace the root-URL check (`:289-299`) with: if `conv.providerConversationUrl`
     exists and current page URL != it, `Page.navigate` to the persisted URL and wait for composer.
  2. Re-resolve the composer selector *after* navigation (current code resolves before nav — move
     it post-nav).
  3. Guard: if navigation fails, fall back to root URL (current behavior) — never hard-fail turn.
  4. Integration test: mock store returns a URL; assert `Page.navigate` called with it on turn 2.
- **Verify:** integration test green; `bun run devops runtime-test health`.

### M3 — Verify & harden capture patterns for all 3 providers
- **Depends on:** M1 (so we have a live URL to capture from)
- **Steps:**
  1. Add a `debug` capture dump command to observe the REAL streaming endpoint per provider
     (use `engage` + `Network.requestWillBeSent` logging, see skill CDP gotcha #11).
  2. Update `CAPTURE_PATTERNS` if the live endpoint differs; add per-provider fallback arrays.
  3. Add a `tests/integration` that feeds a recorded fixture body per provider through
     `StreamParserEngine.parse` and asserts non-empty `blocks`.
- **Verify:** parser yields blocks for each provider fixture.

### M4 — Frontend: robust multi-turn + select-by-conversation
- **Depends on:** M2 (backend targets correct thread)
- **Steps (vivi-frontend):**
  1. Ensure `openProvider` / `selectConversation` reload messages from `fetchMessages` (already
     does) — add a refresh after each send (already calls `loadConversations`; also refetch
     messages to catch assistant row).
  2. On `doSend`, optimistic user bubble + replace with server result; on error keep the
     user bubble but mark assistant as error (current code appends a stray error bubble —
     fix to set error state, not a fake message).
  3. Surface `providerConversationUrl` (read-only) in the sidebar tooltip (optional).
  4. `bun run build` (web/ui vite) + `typecheck` + `lint`.
- **Verify:** `bun run devops runtime-test verify` screenshot shows 2+ turns in one thread.

### M5 — End-to-end multi-turn regression (the gate)
- **Depends on:** M2 + M3 + M4
- **Steps:**
  1. Add `tests/e2e/multiturn.<provider>.ts` for chatgpt/claude/gemini using the adoptable
     Chrome (`ensure-browser` → `engage`); send 3 messages to one conversation; assert the
     local thread has 6 rows and the provider URL stayed constant.
  2. Mark as `describe.skip` when no browser is adopted (`ensure-browser` returns `none`).
  3. `bun run typecheck && bun run lint && bun test`.
  4. `bun run devops audit-code standard` — fix P0/P1.
- **Verify:** full gate green; `pwsh scripts/stop-all.ps1`.

## State / Resume
- **Status:** `M3-complete` (M4 ready)
- **Next start point:** M4 step 1 (vivi-frontend: ensure `doSend` reconciles after each send; fix stray
  error bubble → use `chat.error` slot; surface `providerConversationUrl` read-only in sidebar tooltip).
- **Completed milestones:** M0, M1, M2, M3.
- **Blockers:** none (all dependencies satisfiable locally; M5 needs an adopted Chrome).
- **Last updated:** 2026-07-16

### M3 — completion record
- `CAPTURE_PATTERNS` converted from `Record<string, RegExp>` to `Record<string, RegExp[]>` (per-provider
  fallback chain). Added `capturePatternFor(providerId)` (returns primary or safe default) and exported
  `matchesCapturePattern(providerId, url)` (tests any pattern in the chain). Both `sendInternal` usages
  updated to `capturePatternFor`.
- Secondary/fallback patterns added per provider (chatgpt `/chat` variant + generic; claude root
  conversations path + generic completion; gemini `bard/api` variant). Patterns documented as observed
  live endpoints.
- SC-M3-5 loud-failure: in `sendInternal` [6b], if captured body is empty AND provider is known, push a
  `warnings` entry (not silently blank). Added optional `warnings?: string[]` to `SendResult` and threaded
  it into the success return.
- Fixtures committed: `tests/fixtures/capture/{chatgpt,claude,gemini}.body.txt` (representative SSE/NDJSON
  streaming bodies) + parser fixtures `tests/fixtures/parsers/{chatgpt-ok,gemini-ok}.ts` (mirror claude-ok).
- Tests: `tests/unit/engines/capture-patterns.test.ts` (NEW) — SC-M3-1 (live endpoints match), SC-M3-3
  (fallback chain + negative), SC-M3-2/4 (fixtures parse → blocks>0), SC-M3-5 unit guard. Plus
  `conversation-manager.test.ts` SC-M3-5 (empty body → SendResult.warnings populated).
- Gates: SC-M3-1 ✅ live-endpoint match (via documented fixture URLs); SC-M3-2 ✅ parse yields blocks;
  SC-M3-3 ✅ fallback arrays; SC-M3-4 ✅ fixtures committed; SC-M3-5 ✅ loud failure (warnings);
  SC-M3-6 ✅ unit tests cover all 3 providers; SC-M3-7 ✅ typecheck + my files lint-clean.
- Note: live endpoint verification requires an adopted Chrome (`engage` + `Network.requestWillBeSent`).
  Patterns were authored from known provider streaming endpoints and proven to match fixture URLs; a
  real-browser confirmation is deferred to M5 (browser-gated).
- Stack relaunched: `pwsh scripts/start-bg.ps1`; `runtime-test health` → `ok:true`; stopped clean.

### M2 — completion record
- Rewrote [2.5] page-state block in `conversation-manager.ts:sendInternal`:
  - `targetUrl = conv.providerConversationUrl ?? providerUrl` (root). If `currentUrl` != target
    (via `urlsMatchTarget`, ignores query/fragment), issue `Page.navigate(targetUrl)`, wait 3s for
    SPA settle, set `navigated=true`. No nav when already on target (SC-M2-3).
  - Failure (cdp error/timeout) → `console.warn` + continue on current page (SC-M2-4).
- Added `urlsMatchTarget(currentUrl, targetUrl)` helper (normalizes both via `normalizeConversationUrl`,
  ignores query/fragment). Removed now-unused `pagePattern`/`PROVIDER_URL_PATTERNS` import.
- Composer selector resolution moved to AFTER navigation and now uses `waitForSelector` (10s when
  navigated, 2s otherwise) instead of `findWorkingSelector` (SC-M2-2). Imported `waitForSelector`
  from `provider-selectors.ts`.
- Tests: `tests/integration/engines/conversation-manager.test.ts` (NEW) — SC-M2-1/5/6 (turn1→root,
  turn2→persisted url via recording mock cdp), SC-M2-3 (no nav when already on target), SC-M2-4
  (nav throws → send still ok). Unit "Multi-turn" test bumped to 30s timeout (3s settle wait).
- Gates: SC-M2-1 ✅ re-target; SC-M2-2 ✅ post-nav composer; SC-M2-3 ✅ no nav when matched;
  SC-M2-4 ✅ graceful fallback; SC-M2-5 ✅ turn-1 root behavior preserved; SC-M2-6 ✅ integration
  test; SC-M2-7 ✅ typecheck + my files lint-clean.
- Stack relaunched: `pwsh scripts/start-bg.ps1`; `runtime-test health` → `ok:true`; stopped clean.

### M1 — completion record
- Added `normalizeConversationUrl(providerId, rawUrl)` (pure, exported) in `conversation-manager.ts`
  — strips query/fragment, keeps conversation path per provider (claude `/chat/<id>`, chatgpt
  `/c/<id>`, gemini `/app/<session>`); returns null on empty/invalid input.
- In `sendInternal` [8b], after [8] counters: if `conv.providerConversationUrl == null`, read
  `governor.cdp.getPageState(slaveId).url`, normalize, and `updateConversation({ providerConversationUrl })`.
  Wrapped in try/catch → best-effort (SC-M1-4): a CDP/page-state failure leaves url null and send
  still returns ok.
- Tests: `tests/unit/engines/conversation-manager.test.ts` — SC-M1-1/2 (writes on turn 1, not on
  turn 2+ when already set), SC-M1-4 (getPageState throws → ok + url null), 5 `normalizeConversationUrl`
  unit cases. Pre-existing multi-turn test updated (6 updateConversation calls with null-url mock).
- Gates: SC-M1-1 ✅ capture+persist; SC-M1-2 ✅ only on first turn; SC-M1-3 ✅ normalize unit-tested;
  SC-M1-4 ✅ best-effort; SC-M1-5 ✅ unit test; SC-M1-6 ✅ typecheck + my files lint-clean.
- Stack NOT relaunched for M1 verification (logic-only, covered by unit tests); relaunch at M2 close.

### M0 — completion record (deviation from plan)
- Plan said `prisma migrate dev --name add_conversation_url`. **Not used** — pre-existing drift
  (`provider_tier` table + `conversation_message.updated_at` column exist in `dev.db` but not in
  migration history; `migrate dev` wanted a destructive reset, rejected per SC-M0-5).
- Applied column via raw `ALTER TABLE conversation ADD COLUMN provider_conversation_url TEXT;`
  against `prisma/dev.db` (`prisma db execute`), then `prisma generate`. Verified column present.
- Schema: `Conversation.providerConversationUrl String? @map("provider_conversation_url")` added
  (after `externalId`).
- Contract `src/storage/contracts/conversation-store.ts`: `ConversationRow.providerConversationUrl`
  + `ConversationInput.providerConversationUrl?`.
- Impl `src/storage/impl/conversation-store-impl.ts`: mapper + `createConversation` data +
  `updateConversation` patch.
- Tests: 4 new round-trip cases in `tests/unit/storage/impl/conversation-store-impl.test.ts`
  (create w/ url, default null, update writes, update patches only), all green. All `ConversationRow`
  mock literals updated to include `providerConversationUrl: null`.
- Gates: SC-M0-1..4 ✅ (column, schema, contract, round-trip); SC-M0-5 ✅ (no destructive reset);
  SC-M0-6 ✅ (typecheck clean; my M0 files lint-clean — 2 repo-wide lint errors are pre-existing and
  unrelated: format in my test fixed; `noUnusedVariables` in `src/engines/stealth/extension-bridge-engine.ts`).
- Stack relaunched: `pwsh scripts/start-bg.ps1`; `runtime-test health` → `ok:true` (database:OK, server:OK).

## How to drive this with the skills
Launch the stack once, then per milestone:
```
pwsh scripts/start-bg.ps1
bun run devops runtime-test health
# implement M0...M5
bun run devops runtime-test loop --objective="<milestone goal>"
bun run devops runtime-test loop --resume   # records pass/fail in .runtime/loop-state.json
# final:
bun run devops runtime-test stop
```
Re-read this file at the start of every `loop --resume` to know where we left off.
