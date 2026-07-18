# PRD: Full Interactive Claude.ai — Multiturn + Multi-Content-Type

**Status:** Draft
**Date:** 2026-07-16
**Author:** Agent (codebase audit)
**Related:** MULTITURN-ROADMAP.md, PRODUCTION-ISSUES.md, INVARIANTS.md

## Problem Statement

The vivim system has an 8-step CDP-based send pipeline (type → submit → capture → parse → store) and a React frontend with provider chat surfaces. Claude.ai is seeded as a full provider with selectors, parsers, and capabilities. But the pipeline does not work end-to-end for Claude:

1. **The send pipeline captures empty responses.** The CDP `capture()` method reads DOM text from a stale page session after Claude navigates from `/new` to `/chat/{uuid}` on send. The response renders on the new page target but `readDom()` only queries the original primary session, so the DOM fallback never finds the assistant text.

2. **The conversation URL is stored incorrectly.** After send, `normalizeConversationUrl` stores `https://claude.ai/login` or `https://claude.ai/new` instead of the real chat thread URL `https://claude.ai/chat/{uuid}`. On turn 2+, the M2 re-target step navigates to the wrong page, breaking the thread.

3. **Chrome adoption fails — a new headless Chrome spawns on every send.** The FleetSupervisor's `spawn()` double-prefixes the account ID (`claude_claude_owservera` instead of `claude_owservera`), so the DB account lookup returns null. The ProfileAllocator base path resolves to `%LOCALAPPDATA%` instead of the project root, so even when Chrome is spawned, it uses a profile with no claude.ai session cookies.

4. **File upload is not implemented.** The Claude provider seed lists `upload_file` as a capability, and the `claude.json` manifest includes a `content_editable: true` composer with ProseMirror. But the send pipeline has no CDP-level file upload step (`DOM.setFileInputFiles`, file input interaction, or paste-into-composer strategy).

5. **The PS1 launch scripts do not integrate Chrome profile management.** `start-all.ps1` scans for existing Chrome on debug ports but does not launch Chrome with the canonical profile when none is found. `stop-all.ps1` kills Chrome by default, destroying the logged-in session.

## Solution

Fix the full Claude.ai interaction loop at three layers — CDP transport, send pipeline, and frontend — to achieve: send plain text, receive streaming SSE parsed into typed blocks, continue a conversation across multiple turns (same provider-side thread), and upload/attach files.

Additionally, harden the PS1 launch scripts so the system self-starts in production mode: launch Chrome with the canonical profile, adopt the CDP connection, start backend + frontend, and preserve the session across restarts.

## User Stories

### Core Send/Receive
1. As a vivim user, I want to send a text message to Claude.ai through the vivim UI, so that I can converse with Claude without leaving the vivim interface.
2. As a vivim user, I want to see Claude's streaming response appear in the chat thread in near-real-time, so that I can read the answer without waiting for the entire response to finish.
3. As a vivim user, I want Claude's responses parsed into typed content blocks (text, thinking, code, images, tool use), so that I can view structured output from my conversation.
4. As a vivim user, I want to see the assistant response blocks persisted and reloaded when I revisit a conversation, so that my history survives page refreshes and server restarts.

### Multiturn Conversations
5. As a vivim user, I want to send a second message in the same conversation and have it land in the SAME Claude thread on the provider side, so that Claude has the full context of our prior exchange.
6. As a vivim user, I want the system to automatically store the Claude chat URL (`/chat/{uuid}`) on turn 1 and re-navigate to it on turn 2+, so that the provider-side thread stays consistent without me managing URLs.
7. As a vivim user, I want the system to gracefully fall back to the Claude root page when the stored URL is invalid or the session expired, so that I don't get stuck on a broken navigation.
8. As a vivim user, I want to open an existing conversation from the sidebar and continue chatting, with the full prior history visible, so that I can pick up where I left off.
9. As a vivim user, I want to start a new chat with Claude and have a fresh conversation created on both vivim and provider sides.

### Multi-Content-Type: File Attachments
10. As a vivim user, I want to upload a document (PDF, DOCX, TXT) as an attachment to my Claude conversation, so that Claude can read and analyze my documents.
11. As a vivim user, I want to upload an image file, so that Claude can use its vision capability to analyze the image.
12. As a vivim user, I want to attach a file alongside my text message in a single send operation, so that I can ask questions about the file in the same turn.
13. As a vivim user, I want file attachments to persist and be visible in the vivim chat thread after upload, so that I know what files I've shared with Claude.
14. As a vivim user, I want to see Claude's response to my file attachment parsed into the same typed block format as text-only responses, so that the experience is consistent.

### Session & Authentication
15. As a vivim user, I want the system to use my existing logged-in Chrome session for Claude.ai (via `sessionKeyLC` cookie), so that I don't need to re-login every time.
16. As a vivim user, I want the backend to adopt my visible Chrome browser rather than spawning a headless one, so that my login state and 2FA are preserved.
17. As a vivim user, I want to run `pwsh scripts/start-bg.ps1` and have the full stack (Chrome + backend + frontend) come up automatically, with health polling to confirm readiness.

### Frontend Experience
18. As a vivim user, I want to see Claude as the default provider in the chat UI, so that I can start chatting immediately.
19. As a vivim user, I want an upload/attach button in the chat composer for Claude conversations, so that I can attach files intuitively.
20. As a vivim user, I want to see upload progress or status feedback when attaching files, so that I know if the upload succeeded or failed.

### Reliability
21. As a vivim user, I want the send operation to fail fast (within seconds, not minutes) when the composer is empty or the message wasn't actually sent, so that I get quick feedback on errors.
22. As a vivim user, I want the system to recover gracefully from a lost CDP session by re-attaching to the Chrome page and retrying once, so that transient connection issues don't ruin my conversation.
23. As a vivim user, I want `pwsh scripts/stop-all.ps1 --keep-chrome` to stop the backend/frontend without killing my Chrome session, so that I can restart the stack without losing my login.

## Implementation Decisions

### Decision 1: Profile Resolution Strategy

The canonical Chrome profile for Claude must live at a fixed, absolute path that both `ensure-accounts.ts` (DB seeding) and `ProfileAllocator` (runtime allocation) agree on. The profile at `{projectRoot}/claude/owservera/` contains 45KB of persistent cookies including the `sessionKeyLC` cookie from the user's authenticated claude.ai session. This path is recorded as the `profileDir` on the DB `ProviderAccount` row, and the `ProfileAllocator` base is set to the project root.

Both `FleetSupervisor.spawn()` and the `launchChrome()` path resolve to this same directory — a single source of truth for where the profile lives (FR-7/FR-8: a re-login reuses the persisted session).

### Decision 2: Adoption-First Chrome Lifecycle

The fleet manager always prefers adoption over spawning. On spawn attempt, `FleetSupervisor.spawn()` scans the configured port range (now [9220, 9350] to include the conventional debug port 9222) for a live Chrome whose `user-data-dir` matches the account's `profileDir`. If found, it attaches CDP to that instance. If no match but a live port exists, it adopts that port. Only if no live Chrome is found does it spawn a new process.

The `ensure-accounts.ts` seed records `debugPort: 9222` and `loginState: 'authenticated'` on the account row. At boot, the server iterates authenticated accounts and attempts CDP adoption on their recorded debug ports, so a Chrome launched externally (or by the PS1 script) is immediately adopted.

### Decision 3: Account ID Stability

The account ID is the canonical composite `{providerId}_{emailLocalPart}` (e.g., `claude_owservera`). The `resolveAccountId()` helper in the conversation router normalizes any incoming variant (full email, bare slug, provider-prefixed) to this canon. `FleetSupervisor.spawn()` uses the account ID directly without re-prefixing. The DB `ProviderAccount.id` column stores this canonical value.

### Decision 4: Multi-Page CDP DOM Reading

After a message send on claude.ai, the page navigates from `/new` to `/chat/{uuid}`. The original CDP page session becomes stale, but the CDP transport already attaches to all page targets and watches for `Target.targetCreated` during capture. The `readDom()` function now accepts a session list and iterates all attached page sessions when polling DOM text. The DOM fallback (`tryDomFallback`) uses 30 attempts × 2s intervals (60s window) and reads from all sessions.

This eliminates the primary root cause of empty capture: the response text renders on the new page target, but the old code only read from the first-attached session.

### Decision 5: Conversation URL Normalization

`normalizeConversationUrl()` now rejects URLs that are not stable conversation threads. For Claude, it only accepts paths matching `/chat/{uuid}` (a UUID-based chat URL). All other paths — `/new`, `/login`, `/`, root — return null, so they are never stored as `providerConversationUrl`. This prevents M2 from navigating to a landing page on turn 2+.

The normalization for all providers is tighter: ChatGPT only accepts `/c/{id}`, Gemini only accepts `/app/{id}`.

### Decision 6: File Upload via CDP

File upload for Claude's ProseMirror composer uses the CDP `DOM.setFileInputFiles` method. The upload flow:

1. Find the hidden file input element associated with the Claude upload button (or dispatch a click on the upload trigger to open the native file picker).
2. Use `DOM.setFileInputFiles` to inject the file path into the file input.
3. Dispatch `change` + `input` events so ProseMirror/React handlers fire.
4. The file appears in the composer as an attachment preview.
5. The normal send pipeline then submits the composer with the attached file.

A new `uploadFile` capability is implemented in a `ComposerAttacher` helper, not modifying the existing `ComposerTyping` flow directly — keeping the type/submit DAG nodes composable. The harness DAG gains an optional `attach_file` node type that the `CDPProxy.executeHarnessPlan` dispatches.

### Decision 7: DB-Driven Patterns Over Hardcoded Fallbacks

Per invariant B3 (Seeds Not Code) and the DB-Driven Protocol (P1) principle, provider-specific selectors, composer types, and capture patterns should prefer the DB `ProviderEndpoint` rows. The hardcoded maps in `provider-selectors.ts` and `conversation-manager.ts` serve only as fallbacks when a provider has no DB endpoint row. The Claude seed in `seeds/providers/claude.json` is updated with current UI selectors and the correct SSE streaming endpoint pattern.

### Decision 8: PS1 Launch Script Hardening

`start-all.ps1` gains a Chrome pre-launch phase: before starting the backend, check if Chrome is already listening on any port in the range [9222, 9224]. If not, launch Chrome with `--remote-debugging-port=9222` and the canonical profile dir. This ensures the backend always has a Chrome to adopt at boot time.

`stop-all.ps1` defaults to preserving Chrome (`--keep-chrome` behavior is now the default; a new `--kill-chrome` flag explicitly kills Chrome ports). This prevents accidental session destruction.

`start-bg.ps1` remains non-blocking but gains health polling output for both backend and Chrome so the user sees readiness at a glance.

## Testing Decisions

### What Makes a Good Test
- Unit tests mock the CDP transport and conversation store contracts; they test the send pipeline's retry logic, error handling, and URL normalization without real Chrome.
- Integration tests use a real or mock CDP transport against a test DB; they verify the full sendInternal flow including capture → parse → store.
- E2E tests drive a real Chrome + real claude.ai session; they verify URL continuity across turns (the conversation ID on turn 2 must be the same provider-side thread).

### Modules to Test
- `ConversationManager.send()` — mock CDP, verify capture body → parse → store
- `normalizeConversationUrl()` — unit-test all provider URL patterns with sample inputs
- `CdpTransportImpl.capture()` — mock BunCdpClient, verify multi-session DOM polling
- `FleetSupervisor.spawn()` — mock GovernorStore, verify account lookup and profile path
- `ComposerAttacher.attachFile()` (new) — mock CDP, verify DOM.setFileInputFiles called

### Prior Art
- `tests/unit/engines/conversation-manager.test.ts` exists as a skeleton
- `tests/e2e/chat/real-chrome-send.test.ts` exists but only asserts `ok:true` + row count — needs URL continuity assertion per M5 gate

## Out of Scope

- Re-auth / login flow through CDP (the user manually logs in once via visible Chrome; session is persisted via cookies)
- Claude Pro features (extended thinking rendering, artifact parsing — these require parser updates beyond the capture layer)
- Multi-provider mux (sending a message to Claude AND ChatGPT in parallel)
- WebSocket streaming to frontend (batch mode only for this PRD; progressive streaming via WS is M6 in MULTITURN-ROADMAP)
- iPad / mobile responsive layout for the chat UI (desktop-first)
- Provider health monitoring / circuit breaker tuning for Claude (existing health kernel works)
- Canvas surface for Claude (chat page only; canvas Claude layer is a separate PRD)
- Claude "Projects" / custom instructions injection
- Deep Research capability (seed exists but no CDP implementation)

## Further Notes

- The `sessionKeyLC` cookie from claude.ai has a short expiry (visible in the cookie value timestamp). If the session expires, the user must re-login via visible Chrome. A future PRD could add session-expiry detection and a re-login prompt.
- The Claude SSE streaming endpoint (`POST /api/organizations/{orgId}/chat_conversations/{convId}/completion`) returns `text/event-stream`. The `claude-streaming-sse.ts` parser handles the Anthropic SSE format natively. No changes needed to the parser.
- The `capture` method timeout for SSE streams should be tunable per provider via the `ProviderEndpoint` or `ProviderStreamConfig` row, rather than hardcoded at 60s.
- The `composer-typing.ts` `contenteditable` strategy's `execCommand('insertText')` approach works for current Claude ProseMirror but is deprecated in modern browsers. A future iteration should use `InputEvent('beforeinput')` as the primary strategy with `execCommand` as fallback, rather than the reverse.
- The `FleetSupervisor` port range [9220, 9350] is generous; production deployments should scope it to 3-5 ports per expected provider to avoid port exhaustion on long-running servers.
- The `ProfileAllocator` base directory resolution via `env.CAP_STORE_DATA_DIR` must be set in the PS1 scripts to point to the project root (or a stable data directory). Without this, profiles land in `%LOCALAPPDATA%` which is lost on machine migration.
