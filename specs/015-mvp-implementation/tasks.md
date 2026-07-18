# Tasks: MVP Implementation — End-to-End Chat Product

**Input:** `specs/015-mvp-implementation/plan.md`  
**Prerequisites:** plan.md ✅ | spec.md ✅

## Format: `[ID] [P?] [Story] Description`

## Phase 0: Setup & Verification

- [ ] T001 Verify `bun run typecheck` passes on existing codebase (record baseline)
- [ ] T002 Verify `bun test` passes on existing tests (record baseline)
- [ ] T003 Verify `bun run devops invariants check --category B` passes (record baseline)

---

## Phase 1: Provider Driver Orchestration (Blocking — enables all send/receive)

**Purpose:** Create the single "send to provider and get response" orchestration that ties CDP pieces together. This is the critical path.

- [ ] T010 [P] Create `src/engines/provider-driver.ts` — orchestrator: given providerId + slaveId + text, navigate to provider URL, wait for page ready, find composer, inject text, click send, capture stream response, parse into ContentBlock[]
- [ ] T011 [P] Wire provider-driver through ChromeGovernor (respect Governor Canon: driver uses governor.evaluate, not CdpTransport directly)
- [ ] T012 [P] Add provider-driver to barrel export in `src/index.ts`
- [ ] T013 [P] Write unit test `tests/unit/engines/provider-driver.test.ts` — mock CdpTransport, verify orchestration sequence: navigate → inject → send → capture → parse
- [ ] T014 Wire provider-driver into ConversationManager.send() — when send is called, driver executes the CDP flow
- [ ] T015 Wire SendResilienceEngine to use provider-driver as the send function
- [ ] T016 [P] Register provider-driver as UnifiedCapability (`cap:provider:send_message`) in capability-bootstrap.ts
- [ ] T017 Gate: `bun run typecheck && bun test tests/unit/engines/provider-driver* && bun run lint`

**Checkpoint:** Provider driver works end-to-end with mocked CDP. Proceed to frontend only after this gate passes.

---

## Phase 2: Frontend Chat Page Foundation

**Purpose:** Create the main chat page shell that will host all chat components.

- [ ] T020 [P] Create `web/ui/src/features/chat/chatApi.ts` — typed API client: GET /api/conversations, GET /api/conversations/:id, POST /api/conversations/:id/send, GET /api/conversations/:id/stream-blocks
- [ ] T021 [P] Create `web/ui/src/features/chat/useConversation.ts` — Zustand store: conversation list, active conversation, messages, send action
- [ ] T022 [P] Create `web/ui/src/features/chat/ChatPage.tsx` — main layout: sidebar (25%) + conversation view (75%) + composer at bottom
- [ ] T023 [P] Create `web/ui/src/features/chat/ProviderSelector.tsx` — dropdown showing connected providers from GET /api/accounts, switch active provider
- [ ] T024 Wire ChatPage route in `web/ui/src/App.tsx` (add /chat route)
- [ ] T025 Gate: `bun run typecheck` on frontend files

---

## Phase 3: Conversation List & Management

**Purpose:** Sidebar showing all conversations with search and creation.

- [ ] T030 [P] Create `web/ui/src/features/chat/ConversationSidebar.tsx` — list of conversations with title, provider badge, timestamp, search input
- [ ] T031 [P] Add "New Conversation" button that calls POST /api/conversations
- [ ] T032 [P] Add conversation click handler that loads conversation messages via GET /api/conversations/:id
- [ ] T033 [P] Add search input that calls POST /api/conversations/search with debounced query
- [ ] T034 Add empty state when no conversations exist
- [ ] T035 Gate: `bun run typecheck` on frontend files

---

## Phase 4: Message Rendering & Content Blocks

**Purpose:** Render messages with proper formatting for all content types.

- [ ] T040 [P] Create `web/ui/src/features/chat/ContentBlockRenderer.tsx` — switch on ContentBlock.kind, render appropriate component
- [ ] T041 [P] Create `web/ui/src/features/chat/TextBlock.tsx` — render text with markdown: bold, italic, headings, lists, blockquotes via react-markdown
- [ ] T042 [P] Create `web/ui/src/features/chat/CodeBlock.tsx` — code with language tag, copy button, syntax highlighting via highlight.js or shiki
- [ ] T043 [P] Create `web/ui/src/features/chat/LinkBlock.tsx` — clickable anchor tags, external link indicator
- [ ] T044 [P] Create `web/ui/src/features/chat/ThinkingBlock.tsx` — "Thinking..." indicator with animated dots
- [ ] T045 [P] Create `web/ui/src/features/chat/ToolUseBlock.tsx` — inline card: tool name + input summary + spinner, updates on completion
- [ ] T046 [P] Create `web/ui/src/features/chat/ErrorBlock.tsx` — error message with red styling
- [ ] T047 [P] Create `web/ui/src/features/chat/MessageBubble.tsx` — user message (right-aligned) or assistant message (left-aligned with provider icon), renders ContentBlock[] via ContentBlockRenderer
- [ ] T048 Create `web/ui/src/features/chat/ConversationView.tsx` — scrollable message list, auto-scroll to bottom on new messages
- [ ] T049 Gate: `bun run typecheck` on frontend files

---

## Phase 5: Streaming Response Rendering

**Purpose:** Progressive rendering of streaming responses.

- [ ] T050 [P] Create `web/ui/src/features/chat/useStreaming.ts` — hook: manages streaming state, accumulates ContentBlock[] from SSE/WS, provides blocks to ConversationView
- [ ] T051 [P] Create `web/ui/src/features/chat/StreamingIndicator.tsx` — animated "Provider is thinking..." with provider name, pulsing dots
- [ ] T052 Wire streaming into ConversationView: show StreamingIndicator while waiting for first block, switch to progressive rendering when blocks arrive
- [ ] T053 Add progressive text animation: new text chunks fade in over 100ms
- [ ] T054 Gate: `bun run typecheck` on frontend files

---

## Phase 6: Composer & Send

**Purpose:** Input area with send/cancel buttons.

- [ ] T060 [P] Create `web/ui/src/features/chat/Composer.tsx` — textarea with auto-resize, send button (Enter), shift+Enter for newline
- [ ] T061 Add send button click handler: calls POST /api/conversations/:id/send with message text
- [ ] T062 Add cancel/stop button: visible during active stream, sends abort signal, preserves partial response
- [ ] T063 Add streaming error recovery banner: "Response interrupted — click to retry" when stream breaks
- [ ] T064 Gate: `bun run typecheck` on frontend files

---

## Phase 7: Persistence Verification & Canvas Mirror

**Purpose:** Ensure data persists across restart.

- [ ] T070 Verify StreamBlockStore DB wiring: write test that creates conversation, sends message, restarts, verifies messages load from DB
- [ ] T071 [P] Create `src/storage/impl/canvas-mirror-store-impl.ts` — Prisma-backed CanvasMirrorStore implementing the contract from `src/storage/contracts/canvas-mirror-store.ts`
- [ ] T072 [P] Wire CanvasMirrorStoreImpl into server bootstrap (replace InMemoryCanvasMirrorStore)
- [ ] T073 [P] Write unit test `tests/unit/storage/canvas-mirror-store.test.ts` — CRUD operations, layout restore
- [ ] T074 Gate: `bun run typecheck && bun test tests/unit/storage/canvas-mirror* && bun run lint`

---

## Phase 8: Settings Persistence

**Purpose:** User preferences survive restart.

- [ ] T080 [P] Create `src/storage/contracts/settings-store.ts` — contract: get(key), set(key, value), getAll()
- [ ] T081 [P] Create `src/storage/impl/settings-store-impl.ts` — Prisma-backed implementation
- [ ] T082 [P] Add API route GET/POST /api/settings in conversation-router.ts or new settings-router.ts
- [ ] T083 [P] Create `web/ui/src/features/chat/useSettings.ts` — hook: load settings on mount, save on change
- [ ] T084 Gate: `bun run typecheck && bun test tests/unit/storage/settings* && bun run lint`

---

## Phase 9: Integration & Polish

**Purpose:** Wire everything together, verify end-to-end.

- [ ] T090 Wire ChatPage to use real API calls (replace mock data)
- [ ] T091 Verify provider selector switches conversation context
- [ ] T092 Verify conversation list loads from DB and updates on new messages
- [ ] T093 Verify streaming rendering works with real provider responses
- [ ] T094 Verify code blocks render with syntax highlighting
- [ ] T095 Verify links are clickable
- [ ] T096 Verify cancel button stops streaming
- [ ] T097 Verify error recovery shows partial response on stream break
- [ ] T098 Verify canvas layout persists across restart
- [ ] T099 Verify settings persist across restart
- [ ] T100 Gate: `bun run typecheck && bun test && bun run lint && bun run devops invariants check --category B`

---

## Phase 10: Final Verification

- [ ] T110 Run `bun run devops verify-cross-surface` — all capabilities resolve
- [ ] T111 Run `bun run devops audit-code standard` — 0 P0 findings
- [ ] T112 Manual E2E: `pwsh scripts/start-bg.ps1` → launch → onboarding → connect ChatGPT → send message → see streaming response → verify formatting → restart → verify persistence
- [ ] T113 Update `docs/atomic/01-tracker.md` with completed work
- [ ] T114 Update `docs/goals/MVP.md` — mark completed goals as Done

---

## Dependencies & Execution Order

```
Phase 0 (setup) — no deps
  ↓
Phase 1 (driver) — BLOCKS everything
  ↓
Phase 2 (chat page foundation) — depends on Phase 1
  ↓
Phase 3 (conversation list) — depends on Phase 2
Phase 4 (message rendering) — depends on Phase 2
Phase 5 (streaming) — depends on Phase 4
Phase 6 (composer) — depends on Phase 2, 4
  ↓
Phase 7 (persistence) — independent of frontend phases
Phase 8 (settings) — independent of frontend phases
  ↓
Phase 9 (integration) — depends on all above
Phase 10 (final) — depends on Phase 9
```

## Parallel Opportunities

- **Phase 7 + Phase 8** can run in parallel with Phases 2-6 (different files)
- **Phase 3 + Phase 4 + Phase 5 + Phase 6** are partially parallelizable (different components)
- **All [P] tasks** within a phase run in parallel (different files)
- **Phase 1 T010-T013** (driver creation + test) run in parallel

## Implementation Strategy — MVP First

1. **Phase 0:** Establish baseline — typecheck, test, invariants
2. **Phase 1:** Provider driver — this is the critical path. Without it, nothing works.
3. **Phase 2-6:** Frontend chat surface — can proceed once driver is wired
4. **Phase 7-8:** Persistence — can proceed in parallel with frontend
5. **Phase 9-10:** Integration and verification — after all pieces are in place

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Each phase must pass its gate before proceeding
- Commit after each task or logical group
- Governor Canon: all CDP stays in ChromeGovernor/CdpTransport — frontend never imports BunCdpClient
- Store Contracts: frontend uses API routes, never imports storage impls
- Verify tests fail before implementing (TDD where possible)
