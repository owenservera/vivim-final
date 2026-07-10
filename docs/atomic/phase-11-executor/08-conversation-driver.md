# Unit 11.8: Conversation Driver

**Phase:** 11 | **File:** `src/executor/conversation-driver.ts`
**Depends:** 11.5 Fleet Supervisor, 11.6 Slave Write, 11.7 Slave Read
**Produces:** Full send→capture→extract orchestration for AI conversations
**Source:** cap-store `src/executor/conversation-driver.ts` (221 lines, port to vivim-final)

## Purpose
Orchestrates the full send-capture cycle for AI conversations. Takes a user message, sends it through the browser UI (type into chat input, click send), captures the streaming response, and extracts the final text. Coordinates Fleet Supervisor for Chrome lifecycle and Slave Read/Write for browser interaction.

## Interface
```typescript
export class ConversationDriver {
  constructor(
    private fleet: FleetSupervisor,
    private write: SlaveWrite,
    private read: SlaveRead,
    private opts?: ConversationDriverOptions,
  ) {}

  async sendMessage(
    providerSlug: string,
    accountId: string,
    message: string,
    opts?: SendMessageOptions,
  ): Promise<SendMessageResult>;

  async sendMessageWithCapture(
    providerSlug: string,
    accountId: string,
    message: string,
    opts?: SendCaptureOptions,
  ): Promise<CaptureResult>;

  async getConversationHistory(
    providerSlug: string,
    accountId: string,
  ): Promise<Array<{ role: string; text: string }>>;

  async resetConversation(providerSlug: string, accountId: string): Promise<void>;
}

export interface ConversationDriverOptions {
  ensureChromeOnSend?: boolean;    // auto-launch Chrome if not running (default: true)
  defaultCaptureTimeoutMs?: number; // default 60000
  pollIntervalMs?: number;          // default 200
}

export interface SendMessageOptions {
  captureTimeoutMs?: number;
  autoLaunch?: boolean;
}

export interface SendCaptureOptions extends SendMessageOptions {
  stopPattern?: RegExp;       // pattern that signals response complete
  maxWaitMs?: number;
}

export interface SendMessageResult {
  ok: boolean;
  responseText: string;
  captureDurationMs: number;
  chunks?: Array<{ text: string; timestamp: number }>;
  error?: string;
}

export class ConversationDriverError extends Error {}
```

## Required Capabilities
- Ensure Chrome instance exists for provider+account (auto-launch via Fleet Supervisor)
- Navigate to provider URL (chat.openai.com, claude.ai, etc.)
- Wait for chat input element to appear (detectable via selectors from provider manifest)
- Type message into input
- Click send button
- Wait for response to complete (detect via stop pattern or timeout)
- Extract response text from the DOM
- Return result with response text, duration, chunks
- Handle errors: Chrome crash, timeout, element not found, login required

## Tests
- [ ] `sendMessage('claude', 'acc_123', 'Hello')` launches Chrome, sends message, captures response (e2e)
- [ ] Auto-launch: Chrome not running → spawned, message sent
- [ ] Timeout: response exceeds timeoutMs → error
- [ ] `resetConversation()` navigates to provider URL, starts new chat
- [ ] `getConversationHistory()` extracts messages from DOM

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/conversation-driver.test.ts` passes

## Port Notes
Port from cap-store `src/executor/conversation-driver.ts`. Adapt to vivim-final's FleetSupervisor interface. Remove cap-store-specific event bus integration (vivim-final uses CapabilityEventBus instead). Selector strategies come from provider manifests.
