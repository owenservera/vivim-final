# PRD: CDP Session Management & Send Reliability

## Problem Statement

The multi-chat send flow (frontend → API → ConversationManager → CDP harness → Chrome) fails silently because:

1. **Stale CDP sessions**: `CdpTransportImpl` caches a sessionId on first connect and never re-validates. If the Chrome tab is closed, navigated, or becomes unresponsive, the transport says "connected" (Map lookup) but all commands go to a dead session. The harness reports success because CDP errors are swallowed.

2. **Silent typing failures**: `typeMessage` ignores `exceptionDetails` from `Runtime.evaluate`. When the contenteditable expression fails on the page (wrong target, stale session, focused elsewhere), the text never lands but no error is thrown. This turns a trivial selector bug into a 60-second capture timeout.

3. **No submit confirmation**: `submitMessage` returns even if no send button was clicked AND the Enter key was dispatched to a dead session. There's no feedback that the message actually reached the provider.

4. **Process chaos**: Multiple backend instances can run simultaneously (9420 + 9421), with stale pwsh wrappers holding ports after bun dies. The frontend vite proxy hangs on API calls to a dead backend with no timeout.

5. **No observability**: Backend logs are just topology snapshots. There's no way to trace a send operation through the stack without attaching a debugger.

## Solution

Build a resilient CDP session lifecycle layer that validates sessions before every operation, fails fast with clear diagnostics, and provides observability throughout the send pipeline.

## User Stories

1. As a user, I want to send a message to ChatGPT from the frontend and receive a real response, so that I can have a conversation.

2. As a user, I want to send multiple messages in the same conversation (multiturn), so that I can have a coherent dialogue.

3. As a user, I want to switch between ChatGPT, Claude, and Gemini conversations, so that I can use different providers.

4. As a user, I want the frontend to show "reconnecting..." instead of "server: down" when the backend restarts, so that I know the system is recovering.

5. As a user, I want API calls to timeout client-side after 30s instead of hanging indefinitely, so that the UI doesn't freeze.

6. As a developer, I want the backend to kill all stale processes before starting, so that I don't get port conflicts.

7. As a developer, I want every send operation to log timing breakdowns (resolve, recall, ensure, type, capture, parse, store), so that I can diagnose where failures occur.

8. As a developer, I want the CDP transport to re-validate sessions before each `send()`, so that stale sessions are detected immediately.

9. As a developer, I want `typeMessage` to throw on `exceptionDetails` from Runtime.evaluate, so that typing failures surface as real errors instead of silent no-ops.

10. As a developer, I want `submitMessage` to confirm the click happened or Enter was dispatched to an active session, so that I know the message was sent.

11. As a developer, I want the capture timeout to fail fast when no matching request starts within N seconds of submit, instead of waiting the full 60s.

12. As a developer, I want a `POST /api/debug/cdp-session` endpoint that returns the current session state for a slave, so that I can diagnose session issues without attaching a debugger.

13. As a developer, I want the backend to include Chrome session validity in the `/health` response, so that monitoring can detect stale sessions.

14. As a developer, I want the frontend to retry failed API calls with exponential backoff, so that transient backend issues don't break the UX.

15. As a developer, I want the `stop-all.ps1` script to find and kill ALL bun/pwsh processes on 9420/9421, so that stale instances never block a fresh start.

16. As a user, I want the conversation list to refresh automatically when a new conversation is created, so that I don't have to manually reload.

17. As a user, I want the send button to be disabled while a message is in flight, so that I don't accidentally send duplicates.

18. As a user, I want to see typing indicators while waiting for a response, so that I know the system is working.

19. As a developer, I want the harness to log which CDP target and session it's using for each operation, so that I can correlate backend logs with browser state.

20. As a developer, I want the transport to emit events when sessions are re-attached or fail, so that I can build monitoring dashboards.

## Implementation Decisions

### Module 1: CdpTransportImpl Session Validation

**Current state:** `connect()` caches sessionId once. `isConnected()` checks a Map. No re-validation.

**Change:** Add `validateSession()` method that pings Chrome with `Runtime.evaluate` before each `send()`. If the ping fails, re-attach to the page target. If re-attachment fails, throw `CdpSessionError` with the slaveId and last error.

**Interface:**
```typescript
interface CDPTransport {
  // Existing
  connect(slaveId: string, debugPort: number): Promise<void>
  send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
  isConnected(slaveId: string): boolean
  
  // New
  validateSession(slaveId: string): Promise<boolean>
  onSessionEvent(handler: (event: SessionEvent) => void): void
}

type SessionEvent = 
  | { type: 're-attached'; slaveId: string; sessionId: string }
  | { type: 'session-lost'; slaveId: string; reason: string }
  | { type: 'reconnect-failed'; slaveId: string; error: string }
```

**Files:** `src/executor/cdp-transport.ts`

### Module 2: TypeMessage Error Propagation

**Current state:** `typeMessage` calls `Runtime.evaluate` and ignores `exceptionDetails`. Page-side errors (wrong target, stale session, focused elsewhere) are silent.

**Change:** Check `exceptionDetails` after every `Runtime.evaluate` in the contenteditable strategy. If present, throw with the page error message. Also return the post-write `textContent` so callers can verify what landed.

**Interface:**
```typescript
interface TypeResult {
  success: boolean
  textLanded: string  // what actually ended up in the composer
  error?: string      // page-side error if any
}

async function typeMessage(
  transport: CDPTransport,
  slaveId: string,
  selector: string,
  text: string,
  composerType: ComposerType,
): Promise<TypeResult>
```

**Files:** `src/engines/composer-typing.ts`

### Module 3: SubmitMessage Confirmation

**Current state:** `submitMessage` tries send-button candidates, falls back to Enter. Returns void. No confirmation.

**Change:** Return whether a button was clicked or Enter was dispatched. If neither succeeded (no button found, Enter to dead session), throw.

**Interface:**
```typescript
interface SubmitResult {
  method: 'button' | 'enter'
  selector?: string  // which button was clicked
  confirmed: boolean // true if click dispatched or key sent to active session
}

async function submitMessage(
  transport: CDPTransport,
  slaveId: string,
  sendSelector?: string,
  key?: string,
  sendSelectorCandidates?: string[],
): Promise<SubmitResult>
```

**Files:** `src/engines/composer-typing.ts`

### Module 4: Fast-Fail Capture

**Current state:** Capture waits full 60s timeout even if no matching request ever starts.

**Change:** Add a 5s pre-check: if no `Network.requestWillBeSent` with a matching URL fires within 5s of submit, abort early with a clear error ("No matching request started within 5s of submit — message may not have been sent").

**Interface:** Internal change to `capture()` in `cdp-transport.ts`. Add optional `preCheckMs` parameter.

**Files:** `src/executor/cdp-transport.ts`

### Module 5: Backend Process Hygiene

**Current state:** `stop-all.ps1` kills known PIDs. Stale pwsh wrappers can hold ports.

**Change:** `stop-all.ps1` should:
1. Find ALL processes on 9420/9421 via `Get-NetTCPConnection`
2. Kill each PID with `taskkill /F /T` (tree kill)
3. Wait 2s and verify ports are free
4. If still held, log the stubborn PID and continue

Also add a `pre-flight` check in `start-all.ps1` that kills any existing backend before starting a new one.

**Files:** `scripts/stop-all.ps1`, `scripts/start-all.ps1`

### Module 6: Health Endpoint Enhancement

**Current state:** `/health` returns `{ status: 'ok', version: '1.0.0' }`.

**Change:** Add Chrome session state:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "chrome": {
    "chatgpt": { "connected": true, "sessionId": "abc123", "targetUrl": "https://chatgpt.com/" },
    "claude": { "connected": true, "sessionId": "def456", "targetUrl": "https://claude.ai/" },
    "gemini": { "connected": false, "error": "Session lost" }
  }
}
```

**Files:** `src/server/kernel-router.ts` (health endpoint)

### Module 7: Frontend Resilience

**Current state:** Vite proxy hangs on dead backend. No client-side timeout. "server: down" with no recovery.

**Changes:**
1. Add 30s timeout to all `fetch()` calls in `client.ts`
2. Add exponential backoff retry (3 attempts, 1s/2s/4s)
3. Show "Reconnecting..." with a spinner instead of static "server: down"
4. Disable send button while request is in flight
5. Auto-refresh conversation list when new conversation created

**Files:** `frontend/src/api/client.ts`, `frontend/src/features/chat/ChatPage.tsx`

### Module 8: Send Observability

**Current state:** Backend logs are topology snapshots only.

**Change:** Add structured logging to `ConversationManager.send()`:
- Log at each phase: resolve, recall, ensure, type, capture, parse, store
- Include timing breakdown in log
- Include CDP target/session info
- Emit to `CapabilityEventBus` for dashboard consumption

**Files:** `src/engines/conversation-manager.ts`

## Testing Decisions

### What makes a good test
- Test external behavior (what the API returns, what the transport does), not implementation details
- Use mock CDP transport for unit tests (already exists in `tests/helpers/`)
- Use real Chrome for integration tests (already available on 9222/9223/9224)

### Modules to test
1. **CdpTransportImpl.validateSession** — unit test with mock BunCdpClient
2. **typeMessage error propagation** — unit test with mock transport
3. **submitMessage confirmation** — unit test with mock transport
4. **Fast-fail capture** — integration test with real Chrome
5. **Process hygiene** — shell test (kill all, verify ports free)
6. **Health endpoint** — integration test (start backend, check /health includes chrome state)
7. **Frontend timeout/retry** — unit test with mock fetch

### Prior art
- `tests/unit/engines/conversation-manager.test.ts` — existing send tests
- `tests/helpers/mock-cdp.ts` — mock CDP transport
- `tests/integration/cdp-session.test.ts` — does not exist yet, create it

## Out of Scope

- Provider discovery / auto-detection of composer selectors (future work)
- Streaming response capture (current batch capture is sufficient for v1)
- Multi-tab Chrome support (one tab per provider is the design)
- Frontend conversation persistence across page reloads (already works via API)

## Further Notes

- The zombie process on port 9421 (PID 16736) persists despite `taskkill /F`. This is a Windows socket handle leak. The fix is to not rely on process killing alone — the start script should check if the port is actually free before binding, and scan for a free port if not (which `start-all.ps1` already does).
- The contenteditable typing strategy has 3 fallbacks (execCommand → beforeinput → DOM write). All 3 work when run directly against the correct target. The issue is exclusively that the governor's transport isn't hitting the visible page target.
- The `CDPProxy` mutex serializes harness plans per slaveId. This is correct — we don't want two sends racing on the same Chrome tab. But it means a stale session blocks all subsequent operations until the 60s capture timeout expires. Fast-fail capture (Module 4) addresses this.
