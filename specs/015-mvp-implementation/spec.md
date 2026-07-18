# Feature Specification: MVP Implementation — End-to-End Chat Product

**Feature Branch:** `015-mvp-implementation`  
**Created:** 2026-07-17 | **Status:** Active  
**Input:** `docs/goals/MVP.md` (P0 goals), existing specs 001-014, codebase audit

## Purpose

This spec unifies the work needed to deliver a working MVP: an end user installs the app, connects ChatGPT/Claude/Gemini, sends messages, sees streamed responses with proper formatting, and retains data across restarts. Existing specs 001-007 cover backend infrastructure; this spec covers the **frontend UI, orchestration driver, and persistence glue** that connect the pieces into a usable product.

## User Scenarios

### User Story 1 — First Launch to First Message (P1)

User installs the app, runs it, sees the onboarding wizard, connects a provider (ChatGPT/Claude/Gemini), types a message in the chat, and sees a streaming response render in their conversation.

**Acceptance Scenarios:**
1. **Given** the app is freshly installed, **When** user launches it, **Then** the onboarding wizard appears (FR-001)
2. **Given** onboarding wizard is shown, **When** user selects a provider and completes Chrome login, **Then** provider account is connected and dashboard shows it as authenticated (FR-002)
3. **Given** a provider is connected, **When** user types a message and sends it, **Then** the message appears in the conversation and the provider response streams in progressively (FR-003)
4. **Given** a response is streaming, **When** content arrives, **Then** text renders with formatting (bold, code, links), thinking indicators show, and a cancel button is available (FR-004)

### User Story 2 — Multi-Provider Conversation (P1)

User switches between providers mid-session, seeing different conversations for each.

**Acceptance Scenarios:**
1. **Given** multiple providers are connected, **When** user selects a different provider in the selector, **Then** the conversation switches to that provider's context (FR-005)
2. **Given** a conversation is active, **When** user creates a new conversation, **Then** a fresh context starts and old conversation is preserved in the list (FR-006)
3. **Given** conversation list exists, **When** user clicks a past conversation, **Then** it loads with full message history (FR-007)

### User Story 3 — Resilient Session (P2)

Provider session expires or Chrome crashes; system recovers gracefully.

**Acceptance Scenarios:**
1. **Given** a provider session expires, **When** user attempts to send, **Then** re-login wizard launches automatically and user can reconnect (FR-008)
2. **Given** Chrome crashes mid-stream, **When** error is detected, **Then** partial response is preserved and retry is offered (FR-009)
3. **Given** all providers are unhealthy, **When** user tries to send, **Then** circuit breaker state is shown with recovery ETA (FR-010)

### User Story 4 — Data Persists (P1)

User restarts the app and all conversations, canvas layout, and settings are restored.

**Acceptance Scenarios:**
1. **Given** conversations exist, **When** app restarts, **Then** all conversations load from database (FR-011)
2. **Given** canvas layers are arranged, **When** app restarts, **Then** layout is restored from DB (FR-012)
3. **Given** settings are configured, **When** app restarts, **Then** settings are restored (FR-013)

### User Story 5 — Uniform Content Rendering (P1)

Messages from any provider render with consistent formatting: code blocks with syntax highlighting, clickable links, bold/italic, lists, tables.

**Acceptance Scenarios:**
1. **Given** a message contains code, **When** it renders, **Then** code blocks show with language tag and syntax highlighting (FR-014)
2. **Given** a message contains a URL, **When** it renders, **Then** the URL is a clickable link (FR-015)
3. **Given** a message contains markdown formatting, **When** it renders, **Then** bold, italic, lists, and headings display correctly (FR-016)

## Requirements

### Functional Requirements

**Provider Connection (from MVP-G001-G005):**
- FR-001: Onboarding wizard must guide first-run user through provider connection
- FR-002: Provider account dashboard must show live login status via WebSocket
- FR-003: Re-login on session expiry must launch Chrome with existing profile
- FR-004: Account removal must confirm before deleting

**Core Conversation (from MVP-G006-G011):**
- FR-005: Provider selector must allow switching between connected providers
- FR-006: New conversation creation must start fresh context
- FR-007: Conversation list must load and display past conversations from DB
- FR-008: Provider-adaptive driver must orchestrate: navigate → inject → send → capture → parse per provider
- FR-009: Send message must type into provider page via CDP and trigger send
- FR-010: Receive response must capture streaming chunks and parse into ContentBlock[]

**Streaming UX (from MVP-G012-G017):**
- FR-011: Thinking indicator must show while waiting for first token
- FR-012: Progressive text rendering must show content as chunks arrive
- FR-013: Cancel button must send AbortSignal and preserve partial response
- FR-014: Streaming error recovery must preserve partial content and offer retry

**Content Rendering (from MVP-G018-G028):**
- FR-015: ContentBlock schema must support: text, code, image, tool_use, thinking, error, citation, artifact, meta
- FR-016: Code blocks must render with syntax highlighting via existing highlight system
- FR-017: Links must render as clickable anchors
- FR-018: Text formatting (bold, italic, headings, lists) must render via markdown parser
- FR-019: ChatGPT/Claude/Gemini parsers must produce uniform ContentBlock[] from provider responses

**Data Persistence (from MVP-G029-G031):**
- FR-020: Conversations must persist to Prisma DB on message completion
- FR-021: Canvas layout must persist via CanvasMirrorStore to DB
- FR-022: Settings must persist to DB

### Non-Functional Requirements

- NFR-001: First token renders within 200ms of arrival
- NFR-002: Conversation list loads within 500ms for 100 conversations
- NFR-003: Provider selector switch completes within 100ms
- NFR-004: Canvas restore completes within 1s of mount

### Success Criteria

- SC-001: User can install app, connect ChatGPT, send a message, and see a streaming response in under 5 minutes
- SC-002: All 3 providers (ChatGPT, Claude, Gemini) support send/receive end-to-end
- SC-003: Conversations survive app restart with zero data loss
- SC-004: Code blocks render with syntax highlighting for all providers
- SC-005: Streaming error recovery shows partial response on failure

## Key Entities

- **ContentBlock** — Union type (text | code | image | tool_use | thinking | error | citation | artifact | meta) in `src/schema/streaming.ts`
- **StreamParserEngine** — DB-driven parser loader in `src/engines/stream-parser.ts`
- **ProviderLLMExecutor** — NLCL executor that calls `ConversationManager.send()` in `src/engines/nlcl/executors/provider-llm-executor.ts`
- **ConversationManager** — Manages send/receive lifecycle in `src/engines/conversation-manager.ts`
- **CdpTransportImpl** — CDP session management + capture in `src/executor/cdp-transport.ts`
- **ComposerTyping** — Provider-specific text injection in `src/engines/composer-typing.ts`
- **ProviderSelectors** — Fallback selectors per provider in `src/engines/provider-selectors.ts`
- **StreamBlockStore** — Content block persistence in `src/storage/contracts/stream-block-store.ts`

## Edge Cases

1. Provider page navigation during send (Claude navigates from /new to /chat/<id>)
2. Empty response from provider (rate limit, content filter)
3. Mixed content types in single message (text + code + image)
4. Provider DOM changes breaking selectors (SPA framework updates)
5. Multiple rapid sends (debounce/queue)
6. Chrome session lost mid-capture (re-attach to page target)

## Assumptions

- Backend engines (ConversationManager, StreamParserEngine, CdpTransport) are functional
- Provider selectors are seeded in `provider-selectors.ts` and `seeds/providers/*.json`
- ContentBlock schema in `src/schema/streaming.ts` is stable
- Frontend shell (Vite + React 19 + Tailwind + Zustand) is scaffolded in `web/ui/`
- ChromeGovernor, FleetSupervisor, and ChromeSetupWizard are operational
- The existing `web/sandbox/` has patterns for capability execution UI

## Dependencies

- Spec 005 (onboarding) — backend complete
- Spec 006 (account dashboard) — backend complete
- Spec 007 (resilience) — backend complete
- Spec 003 (chat advanced) — backend capabilities registered
- Existing engines: ConversationManager, StreamParserEngine, CdpTransport, ChromeGovernor

## MVP Alignment

This spec serves MVP Goals: G001-G031 (all P0), G012-G016 (streaming P0), G018-G023 (content schema P0).
