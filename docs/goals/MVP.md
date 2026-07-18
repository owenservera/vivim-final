# MVP Goals — Governing Development Priority

**Status:** ACTIVE
**Last Updated:** 2026-07-17
**Governance:** This document is the single authoritative priority source. No feature work proceeds outside these goals until all P0 goals are met. Amendments require explicit reprioritization.

---

## Governance Rules

1. **P0 (Blocking):** Nothing else moves until P0 goals are complete. All engineering effort prioritizes P0.
2. **P1 (Core):** Work may begin on P1 goals only when no P0 goals are unfinished. P1 goals must be demonstrably working before P2 can begin.
3. **P2 (Enhancement):** May be deferred to post-MVP. No P2 work while any P0 or P1 goal is incomplete.
4. **Status tracking:** Each goal has a status in this document. The tracker (`docs/atomic/01-tracker.md`) references goal IDs.
5. **Spec alignment:** Every spec must declare which MVP goal it serves in its `plan.md` "MVP Alignment" section.
6. **Gate enforcement:** `bun run devops goals check` verifies alignment. No spec work without an active MVP goal.
7. **Updates:** Add new goals by appending to the relevant category. Change priority only by explicit decision.

---

## Goal Index

| ID | Name | Priority | Category | Status |
|----|------|----------|----------|--------|
| **Category A — Provider Setup & Accounts** |
| MVP-G001 | First-run onboarding wizard | P0 | Setup | Not Started |
| MVP-G002 | Connect provider accounts (ChatGPT, Claude, Gemini) | P0 | Setup | Not Started |
| MVP-G003 | Provider account dashboard with live status | P0 | Setup | Not Started |
| MVP-G004 | Re-login on session expiry | P0 | Setup | Not Started |
| MVP-G005 | Remove provider account | P1 | Setup | Not Started |
| **Category B — Core Conversation** |
| MVP-G006 | Send message to any connected provider | P0 | Conversation | Not Started |
| MVP-G007 | Receive streaming response | P0 | Conversation | Not Started |
| MVP-G008 | Provider selector (choose which provider to chat with) | P0 | Conversation | Not Started |
| MVP-G009 | Conversation list and history | P0 | Conversation | Not Started |
| MVP-G010 | Create new / switch between conversations | P0 | Conversation | Not Started |
| MVP-G011 | Provider-adaptive conversation driver (CDP: navigate, inject, capture, parse per provider) | P0 | Conversation | Not Started |
| **Category C — Streaming UX** |
| MVP-G012 | Thinking indicator while waiting for first token | P0 | Streaming | Not Started |
| MVP-G013 | Progressive text rendering with smooth animation | P0 | Streaming | Not Started |
| MVP-G014 | Tool use visualization cards | P1 | Streaming | Not Started |
| MVP-G015 | Streaming error recovery (partial response + retry) | P0 | Streaming | Not Started |
| MVP-G016 | Cancel/stop button during streaming | P0 | Streaming | Not Started |
| MVP-G017 | Token/speed counter | P2 | Streaming | Not Started |
| **Category D — Conversation Text Types Schema** |
| MVP-G018 | Define internal uniform message rendering schema (ContentBlock types) | P0 | Schema | Not Started |
| MVP-G019 | ChatGPT parser → uniform schema | P0 | Schema | Not Started |
| MVP-G020 | Claude.ai parser → uniform schema | P0 | Schema | Not Started |
| MVP-G021 | Gemini parser → uniform schema | P0 | Schema | Not Started |
| MVP-G022 | Text formatting: bold, italic, headings, lists, blockquotes | P0 | Schema | Not Started |
| MVP-G023 | Code blocks with syntax highlighting | P0 | Schema | Not Started |
| MVP-G024 | LaTeX / math rendering | P1 | Schema | Not Started |
| MVP-G025 | Clickable link rendering | P0 | Schema | Not Started |
| MVP-G026 | Table rendering | P1 | Schema | Not Started |
| MVP-G027 | Emoji and inline image rendering | P1 | Schema | Not Started |
| MVP-G028 | Mixed-content messages (text + code + images + tables) | P1 | Schema | Not Started |
| **Category E — Data Persistence** |
| MVP-G029 | Conversations persist across app restart | P0 | Persistence | Not Started |
| MVP-G030 | Canvas layout persists (layer positions, sizes, visibility) | P0 | Persistence | Not Started |
| MVP-G031 | Settings and preferences persist | P0 | Persistence | Not Started |
| **Category F — Canvas Surface** |
| MVP-G032 | Unified canvas as primary workspace | P1 | Canvas | Not Started |
| MVP-G033 | Layer management (add, remove, arrange layers) | P1 | Canvas | Not Started |
| MVP-G034 | Semantic zoom thresholds (full / compact / dot) | P2 | Canvas | Not Started |
| **Category G — Download / Sync Conversations** |
| MVP-G035 | Pull conversation history from provider to local | P1 | Sync | Not Started |
| MVP-G036 | Configurable sync range (last N messages, all, date range) | P1 | Sync | Not Started |
| MVP-G037 | Sync settings management UI (auto-sync toggle, interval) | P2 | Sync | Not Started |
| **Category H — File Send/Receive** |
| MVP-G038 | File upload / attachment to outgoing messages | P1 | Files | Not Started |
| MVP-G039 | File download from incoming messages | P1 | Files | Not Started |
| MVP-G040 | Supported file type detection and limits per provider | P1 | Files | Not Started |
| **Category I — Resilience & Recovery** |
| MVP-G041 | Auto-reconnect Chrome on crash / CDP disconnect | P1 | Resilience | Not Started |
| MVP-G042 | Session expiry preemptive warning | P1 | Resilience | Not Started |
| MVP-G043 | Circuit breaker auto-recovery (open → half-open → closed) | P2 | Resilience | Not Started |
| **Category J — Export / Data Portability** |
| MVP-G044 | One-click export all data (conversations, memory, canvas) | P2 | Portability | Not Started |
| MVP-G045 | Import from backup with conflict resolution | P2 | Portability | Not Started |

---

## Detailed Goal Definitions

### Category A — Provider Setup & Accounts

#### MVP-G001: First-run onboarding wizard
- **Priority:** P0
- **Description:** On first launch, a guided wizard walks the user through connecting their first provider. After completion, the wizard does not reappear.
- **Acceptance Criteria:**
  1. App detects first-run state on initial launch
  2. Full-screen wizard appears before any other UI
  3. Wizard offers ChatGPT, Claude, Gemini as connection options
  4. Each option launches Chrome-based provider login flow
  5. Progress is tracked per step
  6. On completion, onboarding flag is set and wizard never shows again
  7. Feature tour (canvas/chat/health highlights) shows after wizard completes
- **Related Specs:** 005-first-run-onboarding
- **Status:** Backend exists. Some frontend wiring may remain.

#### MVP-G002: Connect provider accounts
- **Priority:** P0
- **Description:** User can connect ChatGPT, Claude, and Gemini accounts via Chrome-based setup wizard. Each provider has a working login flow.
- **Acceptance Criteria:**
  1. "Add Account" flow exists for each provider
  2. Chrome launches with provider login page
  3. CDP captures login completion
  4. Session cookies/state stored in providerAccount table
  5. Connection confirmed with live session health check
  6. Multiple accounts per provider supported (future)
- **Related Specs:** 006-provider-account-dashboard, PRD-12
- **Dependencies:** MVP-G001

#### MVP-G003: Provider account dashboard with live status
- **Priority:** P0
- **Description:** Dashboard showing all connected accounts with real-time login state, last login time, session health. Updates via WebSocket without page reload.
- **Acceptance Criteria:**
  1. Each account renders as a card with provider icon and name
  2. Login state displayed as badge (authenticated / expired / disconnected)
  3. Last login timestamp shown (or "Never" if null)
  4. WebSocket subscription receives `account:login_state` events
  5. Cards update in-place on WS events (no reload)
  6. Disconnected indicator when WS drops
- **Related Specs:** 006-provider-account-dashboard

#### MVP-G004: Re-login on session expiry
- **Priority:** P0
- **Description:** When a provider session expires, user can re-login with one click, reusing the existing Chrome profile.
- **Acceptance Criteria:**
  1. Expired session shows warning badge and "Re-login" button
  2. Clicking launches ChromeSetupWizard with existing profile
  3. On successful re-login, state returns to authenticated
  4. `account:login_state` emitted on completion
- **Related Specs:** 006-provider-account-dashboard, 007-conversation-resilience

#### MVP-G005: Remove provider account
- **Priority:** P1
- **Description:** User can remove a connected account with confirmation.
- **Acceptance Criteria:**
  1. "Remove" button visible on account card
  2. Confirmation dialog warns about profile deletion
  3. On confirm, account is deleted and `account:removed` emitted
  4. Card disappears from dashboard

---

### Category B — Core Conversation

#### MVP-G006: Send message to any connected provider
- **Priority:** P0
- **Description:** User can type a message and send it to any connected, healthy provider. Message is delivered via CDP-driven conversation driver.
- **Acceptance Criteria:**
  1. Composer input is always visible when a conversation is active
  2. Send button / Enter sends the message
  3. Message is routed to the currently selected provider
  4. Provider-adaptive driver navigates to correct URL, injects message, triggers send
  5. Sending state is indicated (message pending)
  6. Empty / whitespace-only messages are rejected
- **Related Specs:** 003-chat-advanced, provider-adaptive conversation drivers
- **Dependencies:** MVP-G002 (account must exist), MVP-G011 (driver)

#### MVP-G007: Receive streaming response
- **Priority:** P0
- **Description:** Provider response appears progressively as CDP captures stream chunks. Response content blocks are parsed and rendered in real-time.
- **Acceptance Criteria:**
  1. StreamCapture captures response chunks from provider page
  2. Each chunk parsed into uniform ContentBlock format
  3. Content blocks rendered progressively as they arrive
  4. Stream complete signal terminates rendering
  5. Partial response preserved if stream interrupted
- **Dependencies:** MVP-G011 (driver + capture), MVP-G018 (schema)

#### MVP-G008: Provider selector
- **Priority:** P0
- **Description:** UI control allowing user to select which provider handles the current conversation.
- **Acceptance Criteria:**
  1. Visual selector shows all connected providers
  2. Only healthy providers are selectable
  3. Current provider is clearly indicated
  4. Switching provider mid-conversation is handled gracefully
- **Related Specs:** 009-smart-provider-routing

#### MVP-G009: Conversation list and history
- **Priority:** P0
- **Description:** Sidebar or panel listing all past conversations with search/filter.
- **Acceptance Criteria:**
  1. All conversations listed with title, provider, timestamp
  2. Click loads that conversation
  3. Empty state shown when no conversations exist
  4. Basic search by title or content
- **Related Specs:** 003-chat-advanced

#### MVP-G010: Create new / switch conversations
- **Priority:** P0
- **Description:** User can create a new conversation or switch between existing ones without losing state.
- **Acceptance Criteria:**
  1. "New Conversation" button always accessible
  2. Switching conversations preserves scroll position of each
  3. Active conversation is highlighted in list
  4. Delete conversation with confirmation

#### MVP-G011: Provider-adaptive conversation driver
- **Priority:** P0
- **Description:** CDP-driven conversation driver that adapts to each provider's DOM structure. Navigates to provider URL, injects message into the correct input, triggers send, captures response stream, and detects completion.
- **Acceptance Criteria:**
  1. ChatGPT driver: navigates to chat.openai.com, finds textarea, injects text, clicks send, captures stream via DOM observers, detects response complete
  2. Claude driver: navigates to claude.ai, finds input, injects text, triggers send, captures response, detects complete
  3. Gemini driver: navigates to gemini.google.com, finds input, injects, sends, captures, detects complete
  4. Each driver uses provider-specific selectors from selector_strategy table
  5. Error handling per provider (different error DOM patterns)
  6. Driver selection is automatic based on conversation's provider
- **Related Specs:** 003-chat-advanced, PRD-12
- **Dependencies:** MVP-G002

---

### Category C — Streaming UX

#### MVP-G012: Thinking indicator
- **Priority:** P0
- **Description:** Animated indicator while waiting for first response token from provider.
- **Acceptance Criteria:**
  1. Shows provider name + animated dots
  2. Appears immediately on send
  3. Smoothly transitions out when first token arrives
  4. Different visual per provider state

#### MVP-G013: Progressive text rendering
- **Priority:** P0
- **Description:** Response text appears smoothly as chunks arrive, not all at once.
- **Acceptance Criteria:**
  1. Text renders incrementally as stream chunks arrive
  2. Smooth fade-in or character-by-character appearance
  3. Full content rendered at stream completion

#### MVP-G014: Tool use visualization cards
- **Priority:** P1
- **Description:** Inline cards showing tool calls the provider makes (search, code exec, etc.)
- **Acceptance Criteria:**
  1. Card shows tool name and input summary
  2. Spinner while tool is executing
  3. Card updates with result on completion
  4. Stream continues after result

#### MVP-G015: Streaming error recovery
- **Priority:** P0
- **Description:** If stream breaks mid-response, partial content is preserved and retry is offered.
- **Acceptance Criteria:**
  1. Partial response remains visible
  2. "Response interrupted — click to retry" banner shown
  3. Retry resumes from point of failure or restarts appropriately
  4. No raw stack traces shown to user

#### MVP-G016: Cancel button
- **Priority:** P0
- **Description:** User can stop a streaming response at any time.
- **Acceptance Criteria:**
  1. "Stop" button visible during active stream
  2. Click cancels via AbortSignal
  3. Partial response remains visible after cancel
  4. Button disappears when stream is not active

---

### Category D — Conversation Text Types Schema

#### MVP-G018: Define internal uniform message rendering schema
- **Priority:** P0
- **Description:** Design and implement a `ContentBlock` schema (TypeScript types + Zod validation) that can represent every message content type from any provider in a uniform format. All parsers output this schema; all renderers consume it.
- **Acceptance Criteria:**
  1. Schema covers: text, code, image, tool_use, tool_result, reasoning, error
  2. Text block supports: rich formatting (bold, italic, headings, lists, blockquotes, links, tables, LaTeX, emoji)
  3. Code block supports: language tag, content, optional filename
  4. Image block supports: URL, data URL, alt text, MIME type
  5. Tool blocks support: name, input (JSON), output, status
  6. Schema validated with Zod at runtime
  7. Discriminated union: `type` field + variant-specific payload
  8. Schema file: `src/schema/content-blocks.ts` or similar
  9. Exported as shared package so frontend and backend use same types
- **Dependencies:** Foundation for all parsers and renderers

#### MVP-G019: ChatGPT parser → uniform schema
- **Priority:** P0
- **Description:** Parse ChatGPT's response DOM into the uniform ContentBlock schema. Handles ChatGPT's specific HTML structure for text, code, lists, tables, and images.
- **Acceptance Criteria:**
  1. Plain text paragraphs → text blocks
  2. Code blocks with language tag → code blocks
  3. Ordered/unordered lists → text blocks with list formatting
  4. Tables → text blocks with table formatting or dedicated table blocks
  5. LaTeX → correctly captured and tagged
  6. Links → preserved as markdown links
  7. Images → image blocks
  8. Edge cases: empty responses, streaming partial content, error messages
- **Dependencies:** MVP-G018, MVP-G011

#### MVP-G020: Claude.ai parser → uniform schema
- **Priority:** P0
- **Description:** Parse Claude.ai's response DOM into the uniform ContentBlock schema.
- **Acceptance Criteria:**
  1. Same content types as ChatGPT parser
  2. Claude-specific: thinking/reasoning blocks captured
  3. Claude-specific: tool use / tool result blocks parsed
  4. Edge cases handled per Claude's DOM patterns
- **Dependencies:** MVP-G018, MVP-G011

#### MVP-G021: Gemini parser → uniform schema
- **Priority:** P0
- **Description:** Parse Gemini's response DOM into the uniform ContentBlock schema.
- **Acceptance Criteria:**
  1. Same content types as ChatGPT parser
  2. Gemini-specific content structures handled
  3. Google ecosystem features (Search Grounding, etc.) captured where possible
- **Dependencies:** MVP-G018, MVP-G011

#### MVP-G022 through MVP-G028: Rendering
- **Priority:** As noted per goal
- **Description:** React renderers for each ContentBlock variant. Each renderer handles its content type with proper styling, interactivity, and accessibility.
- **Acceptance Criteria (per renderer type):**
  1. Renderer exists for each ContentBlock variant
  2. Styling matches the app's design system
  3. Copy/paste preserves formatting
  4. Accessibility: proper ARIA roles, keyboard navigation
  5. Fallback renderer for unknown types
- **Dependencies:** MVP-G018

---

### Category E — Data Persistence

#### MVP-G029: Conversations persist across restart
- **Priority:** P0
- **Description:** All conversations, messages, and their content blocks survive server restart.
- **Acceptance Criteria:**
  1. ConversationManager writes to DB on message completion
  2. StreamBlockStore persists content blocks to DB
  3. On restart, all conversations load from DB
  4. No data loss on clean shutdown
- **Related Specs:** 012-canvas-persistence (extends concept to canvas)

#### MVP-G030: Canvas layout persists
- **Priority:** P0
- **Description:** Canvas layer positions, sizes, visibility, and lock state survive restart.
- **Acceptance Criteria:**
  1. CanvasMirrorStore persists layout to DB on drag stop
  2. 500ms debounce on auto-save
  3. Layout restored on canvas mount
  4. "Saved" indicator shown
- **Related Specs:** 012-canvas-persistence

#### MVP-G031: Settings persist
- **Priority:** P0
- **Description:** User preferences and settings survive restart.
- **Acceptance Criteria:**
  1. Provider selection persists
  2. UI preferences (panel state, widths) persist
  3. Theme / display preferences persist

---

### Category F — Canvas Surface

#### MVP-G032: Unified canvas as primary workspace
- **Priority:** P1
- **Description:** The infinite canvas is the primary UI surface, rendering conversation, provider status, and other components as layers.
- **Acceptance Criteria:**
  1. Canvas renders with React Flow
  2. Conversation layer renders on canvas
  3. Provider status layer renders on canvas
  4. Layers are draggable and resizable
- **Related Specs:** 002-canvas-surface

#### MVP-G033: Layer management
- **Priority:** P1
- **Description:** Add, remove, and arrange layers on the canvas.
- **Acceptance Criteria:**
  1. Layers can be added via UI
  2. Layers can be removed
  3. Layer positions persist (via MVP-G030)

---

### Category G — Download / Sync Conversations

#### MVP-G035: Pull conversation history from provider
- **Priority:** P1
- **Description:** User can download/sync their conversation history from a connected provider account to local storage.
- **Acceptance Criteria:**
  1. Sync triggers per-provider export/navigation flow
  2. Conversations parsed and stored in uniform format
  3. Progress shown during sync
  4. Sync does not require re-authentication if session is valid

#### MVP-G036: Configurable sync range
- **Priority:** P1
- **Description:** User can choose how much history to sync.
- **Acceptance Criteria:**
  1. Options: last 10 messages, last 100, all, date range
  2. Default is last 100 messages
  3. Setting saved per provider

---

### Category H — File Send/Receive

#### MVP-G038: File upload/attachment
- **Priority:** P1
- **Description:** User can attach files to outgoing messages.
- **Acceptance Criteria:**
  1. File picker / drag-drop zone in composer
  2. Supported file types enforced
  3. File size limits enforced
  4. Upload progress shown
- **Related Specs:** 003-chat-advanced

---

### Category I — Resilience & Recovery

#### MVP-G041: Auto-reconnect Chrome on crash
- **Priority:** P1
- **Description:** If Chrome slave crashes, system auto-restarts it and recovers the conversation.
- **Acceptance Criteria:**
  1. Health probe detects crash within 30s
  2. Auto-restart with existing profile
  3. Recovered state shown in health dashboard
- **Related Specs:** 013-automated-recovery, 007-conversation-resilience

---

### Category J — Export / Data Portability

#### MVP-G044: One-click export
- **Priority:** P2
- **Description:** Export all conversations, memory, and canvas definitions as a .zip file.
- **Acceptance Criteria:**
  1. Shows preview of items to export
  2. Generates .zip with organized JSON files
  3. Progress bar during export
  4. Automatic browser download
- **Related Specs:** 010-data-portability

---

## Provider Capability Matrix

For each target provider, the MVP must support:

| Capability | ChatGPT (chat.openai.com) | Claude (claude.ai) | Gemini (gemini.google.com) |
|------------|--------------------------|--------------------|---------------------------|
| Connect account (Chrome login) | P0 | P0 | P0 |
| Send message | P0 | P0 | P0 |
| Receive streaming response | P0 | P0 | P0 |
| Parse text + formatting | P0 | P0 | P0 |
| Parse code blocks | P0 | P0 | P0 |
| Parse LaTeX | P1 | P0 | P1 |
| Parse tables | P1 | P1 | P1 |
| Parse images | P1 | P1 | P1 |
| Tool use visualization | P1 | P1 | P2 |
| File upload | P1 | P1 | P1 |
| Session health check | P0 | P0 | P0 |
| Re-login on expiry | P0 | P0 | P0 |
| Sync conversation history | P1 | P1 | P1 |

---

## Dependency Map

```
MVP-G001 (onboarding wizard)
  └── MVP-G002 (connect accounts)
        ├── MVP-G011 (provider driver)
        │     ├── MVP-G006 (send message)
        │     ├── MVP-G007 (receive stream)
        │     ├── MVP-G019 (ChatGPT parser)
        │     ├── MVP-G020 (Claude parser)
        │     └── MVP-G021 (Gemini parser)
        ├── MVP-G003 (account dashboard)
        └── MVP-G004 (re-login)
              └── MVP-G005 (remove account)

MVP-G018 (content schema)
  ├── MVP-G019/020/021 (parsers)
  └── MVP-G022-028 (renderers)

MVP-G006/007 (send/receive)
  ├── MVP-G012 (thinking indicator)
  ├── MVP-G013 (progressive text)
  ├── MVP-G015 (error recovery)
  └── MVP-G016 (cancel)

MVP-G029 (conversation persistence)
MVP-G030 (canvas persistence)
MVP-G031 (settings persistence)

MVP-G032/033 (canvas surface) → after persistence

MVP-G035/036 (sync) → after providers work
MVP-G038/039 (files) → after core conversation
MVP-G041 (auto-recovery) → after core conversation
MVP-G044 (export) → post-MVP
```

---

## Execution Strategy

### Triage Phase (Hour 0)
1. Audit current state: what's done vs claimed vs missing for each P0 goal
2. Identify quick wins (already done, just needs wiring)
3. Produce initial status for each goal (Not Started / In Progress / Complete / Blocked)

### Sprint 1 (Days 1-3) — Foundation + Provider Connection
- MVP-G001: Onboarding wizard (mostly done)
- MVP-G002: Connect all 3 providers (CDP flows)
- MVP-G018: ContentBlock schema design + implementation
- MVP-G029/030/031: Persistence layer

### Sprint 2 (Days 4-7) — Conversation + Streaming
- MVP-G011: Provider-adaptive conversation driver (all 3)
- MVP-G006/007: Send/receive with streaming
- MVP-G019/020/021: Parsers for all 3 providers
- MVP-G012/013/015/016: Streaming UX primitives

### Sprint 3 (Days 8-10) — UX + Resilience
- MVP-G003: Account dashboard
- MVP-G004: Re-login on expiry
- MVP-G008/009/010: Conversation list, selector, switching
- MVP-G022-028: Content renderers (P0 types first)

### Sprint 4 (Days 11-14) — Polish + Edge Cases
- Remaining P0 edge cases
- Error handling across all flows
- P1 goals start as bandwidth allows

---

## Amendment Log

| Date | Change | Rationale |
|------|--------|-----------|
| 2026-07-17 | Initial draft | Created from governance design session |
