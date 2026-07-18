# Implementation Plan: MVP Implementation — End-to-End Chat Product

**Spec:** [spec.md](./spec.md)  
**Date:** 2026-07-17  
**Status:** Active

## Technical Context

- **Runtime:** Bun + TypeScript strict mode
- **Frontend:** Vite + React 19 + Tailwind + Zustand (scaffolded in `web/ui/`)
- **Backend:** Prisma v6.5 + 13 engines + unified capability system
- **CDP:** BunCdpClient → CdpTransportImpl → ChromeGovernor (Governor Canon)
- **Persistence:** Prisma ORM, SQLite, StreamBlockStore contract
- **Testing:** Bun test runner, mocked stores for unit tests

## Architecture: What Exists vs What's Missing

### Layer 1: Provider Connection ✅ DONE (Spec 005 + 006)
- `useFirstRun.ts` — first-run detection hook
- `FirstRunWizard.tsx` — onboarding wizard
- `FeatureTour.tsx` — post-wizard tour
- `ProviderAccountDashboard.tsx` — account cards with WS live status
- `AccountCard.tsx` — per-account card with re-login/remove

### Layer 2: CDP Infrastructure ✅ DONE
- `CdpTransportImpl` — session management, evaluate, capture, captureStream
- `ComposerTyping` — provider-specific text injection (textarea, contenteditable, quill)
- `ProviderSelectors` — fallback selectors for composer, send button, DOM capture per provider
- `StreamParserEngine` — DB-driven parser loader with fallback chain
- `ChromeGovernor` — CDP proxy, lifecycle, health

### Layer 3: Conversation Manager ✅ DONE (Backend)
- `ConversationManager` — send/receive lifecycle, integrates with StreamParserEngine
- `ProviderLLMExecutor` — NLCL executor calling ConversationManager.send()
- `StreamBlockStore` — content block persistence contract
- `conversation-router.ts` — API routes for conversations, search, stream-blocks

### Layer 4: Content Schema ✅ DONE
- `src/schema/streaming.ts` — ContentBlock union type (9 variants)
- `src/engines/stream-parser.ts` — StreamParserEngine with DB-loaded parsers
- `seeds/providers/chatgpt.json` — ChatGPT SSE parser with inline code
- `seeds/providers/claude.json` — Claude parser reference
- `seeds/providers/gemini.json` — Gemini parser reference

### Layer 5: Resilience ✅ DONE
- `SendResilienceEngine` — preflight gate, auto-reconnect, structured error
- `send-resilience.ts` — error classification, recovery kind routing
- `SendErrorSlot.tsx` — UI slot for recovery actions

### Layer 6: Frontend UI ❌ MISSING — THIS IS THE GAP

The entire frontend chat surface that renders conversations, streams responses, and provides the user interaction layer does not exist as production components.

## Gap Analysis

| Component | Backend | Frontend | Gap |
|-----------|---------|----------|-----|
| Onboarding wizard | ✅ | ✅ | None |
| Account dashboard | ✅ | ✅ | None |
| Provider connection | ✅ | ✅ | None |
| **Conversation list** | ✅ (DB + router) | ❌ | **No sidebar/list component** |
| **Conversation view** | ✅ (StreamBlockStore) | ❌ | **No message rendering surface** |
| **Composer/input** | ✅ (ConversationManager) | ❌ | **No input component** |
| **Provider selector** | ✅ (capabilities) | ❌ | **No dropdown component** |
| **Streaming text** | ✅ (StreamParserEngine) | ❌ | **No progressive renderer** |
| **Code highlighting** | N/A | ❌ | **No syntax highlight integration** |
| **Message formatting** | ✅ (ContentBlock types) | ❌ | **No markdown renderer** |
| **Streaming error UI** | ✅ (SendResilienceEngine) | ✅ (SendErrorSlot) | Minimal |
| **Canvas persistence** | ❌ (InMemory only) | N/A | **Need Prisma CanvasMirrorStore** |
| **Conversation persistence** | ✅ (StreamBlockStore) | N/A | Verify DB wiring |
| **Settings persistence** | ❌ | ❌ | **Need settings store** |
| **Provider driver orchestration** | Pieces exist | N/A | **Need unified driver** |

## Implementation Strategy: Build the Glue

The backend is 90% complete. The work is:
1. **Orchestration driver** — tie CDP pieces into a single "send to provider, get response" flow
2. **Frontend chat surface** — React components that consume existing APIs
3. **Persistence verification** — ensure DB wiring works end-to-end
4. **Canvas mirror DB store** — Prisma implementation of CanvasMirrorStore

## Constitution Check

- **Governor Canon:** ✅ All CDP interaction stays in ChromeGovernor/CdpTransport. Frontend never imports BunCdpClient.
- **Store Contracts:** ✅ Frontend uses API routes, never imports storage impls.
- **One Entry Point:** ✅ All operations route through UnifiedCapability system.
- **Research-First:** ✅ All backend infrastructure exists; this spec wires frontend to it.
- **Testing Gates:** ✅ Unit tests for new components, integration for driver orchestration.

## File Map

### New Files (Frontend — `web/ui/src/features/chat/`)

| File | Purpose |
|------|---------|
| `ChatPage.tsx` | Main chat page: sidebar + conversation view + composer |
| `ConversationSidebar.tsx` | Conversation list with search, new button |
| `ConversationView.tsx` | Message list with streaming renderer |
| `MessageBubble.tsx` | Single message: user or assistant, with ContentBlock rendering |
| `ContentBlockRenderer.tsx` | Dispatches ContentBlock variants to specific renderers |
| `TextBlock.tsx` | Markdown text rendering (bold, italic, lists, headings) |
| `CodeBlock.tsx` | Code with syntax highlighting |
| `LinkBlock.tsx` | Clickable link rendering |
| `ThinkingBlock.tsx` | Thinking/reasoning indicator |
| `ToolUseBlock.tsx` | Tool use card with spinner |
| `ErrorBlock.tsx` | Error message rendering |
| `Composer.tsx` | Input area with send button, cancel button |
| `ProviderSelector.tsx` | Dropdown for provider switching |
| `StreamingIndicator.tsx` | Thinking dots while waiting for first token |
| `useConversation.ts` | Hook: conversation state, send, receive |
| `useStreaming.ts` | Hook: streaming response management |
| `chatApi.ts` | API client for conversation endpoints |

### New Files (Backend)

| File | Purpose |
|------|---------|
| `src/storage/impl/canvas-mirror-store-impl.ts` | Prisma-backed CanvasMirrorStore |
| `src/engines/provider-driver.ts` | Orchestration driver: navigate → inject → send → capture → parse |
| `src/server/driver-router.ts` | API route for driver operations |

### Modified Files

| File | Change |
|------|--------|
| `web/ui/src/App.tsx` | Add ChatPage route |
| `src/storage/impl/stream-block-store-impl.ts` | Verify DB persistence wiring |
| `src/engines/capability-bootstrap.ts` | Register driver capabilities |
