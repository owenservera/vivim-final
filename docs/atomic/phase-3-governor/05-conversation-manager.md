# Unit 3.5: ConversationManager (8-Step Pipe)

**Phase:** 3 | **File:** `src/engines/conversation-manager.ts`
**Depends:** 3.1-3.4 ChromeGovernor, 3.7 CapabilityEventBus, 3.8 StreamBlockStore
**Produces:** 8-step send pipeline
**Source:** `04-merged-engines.md` §2

## Purpose
Orchestrates a single conversation send through an 8-step pipeline: RESOLVE→DERIVE SLAVE→LOCK→ENSURE→SEND→CAPTURE→PARSE→STORE+EMIT.

## Interface
```typescript
class ConversationManager {
  constructor(
    private governor: ChromeGovernor,
    private resolution: CapabilityResolutionEngine,
    private parser: StreamParserEngine,
    private blocks: StreamBlockStore,
    private store: ConversationStore,
    private eventBus: CapabilityEventBus,
    private memoizer: ExecutionMemoizer,
  ) {}

  async send(conversationId: string, message: string): Promise<SendResult>;
  async createConversation(providerId: string, title?: string): Promise<ConversationRow>;
  async getConversation(id: string): Promise<ConversationRow>;
  async getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<ConversationMessageRow[]>;
  async truncate(conversationId: string, beforeMessageId: string): Promise<void>;
}

interface SendResult {
  ok: boolean;
  messageId: string;
  blocks: ContentBlock[];
  text: string;
  latencyMs: number;
  error?: string;
}
```

## 8-Step Pipeline
```
ConversationManager.send(conversationId, message)
  ├─ [1] RESOLVE (5ms budget)
  │     const conv = await store.getConversation(conversationId);
  │     const account = await store.getAccount(conv.provider_session_id);
  │     const planTier = account.plan_tier;
  │     const capabilities = await memoizer.getOrCompute(
  │       `resolve:${conv.provider_id}:${planTier}`,
  │       () => resolution.resolve(conv.provider_id, planTier), 5000);
  │
  ├─ [2] DERIVE SLAVE (0ms)
  │     const slaveId = deriveSlaveId(conv.provider_id, account.id);
  │
  ├─ [3] LOCK (async mutex acquire — Governor handles internally)
  │
  ├─ [4] ENSURE (up to 10s)
  │     const slave = await governor.ensureRunning(slaveId);
  │
  ├─ [5] SEND (up to 30s)
  │     const dag: HarnessDAG = { type: 'sequence', steps: [...] };
  │     const sendResult = await governor.cdp.executeHarnessPlan(slaveId, dag, origin);
  │
  ├─ [6] CAPTURE (up to 30s)
  │     const captureResult = await governor.cdp.capture(slaveId, /\/api\/conversation\//, 30000, origin);
  │
  ├─ [7] PARSE (up to 500ms)
  │     const blocks = await parser.parse(captureResult.body, conv.provider_id);
  │
  └─ [8] STORE + EMIT
        const msgRow = await store.createMessage({ conversationId, role: 'assistant', blocks, ... });
        await blocks.storeBlocks(conversationId, msgRow.id, blocks);
        eventBus.emit({ type: 'conversation:complete', conversationId, message: msgRow });
        return { ok: true, messageId: msgRow.id, blocks, text: extractText(blocks), latencyMs };
```

## Store Contract
```typescript
interface ConversationStore {
  getConversation(id: string): Promise<ConversationRow | null>;
  createConversation(input: ConversationInput): Promise<ConversationRow>;
  updateConversation(id: string, patch: Partial<ConversationRow>): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  listConversations(opts?: { providerId?: string; limit?: number; offset?: number }): Promise<ConversationRow[]>;
  createMessage(input: MessageInput): Promise<ConversationMessageRow>;
  getMessage(id: string): Promise<ConversationMessageRow | null>;
  getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<ConversationMessageRow[]>;
  getLastMessage(conversationId: string): Promise<ConversationMessageRow | null>;
  getAccount(sessionId: string): Promise<ProviderAccountRow | null>;
}
```

## Tests
- [ ] `send()` completes full 8-step pipeline and returns SendResult
- [ ] `createConversation()` persists and returns conversation
- [ ] Step 1 RESOLVE uses memoized capability resolution
- [ ] Step 5 SEND builds correct HarnessDAG for composer typing
- [ ] Step 8 EMIT fires `conversation:complete` event on EventBus
- [ ] Error at any step → error flows through, event emitted
- [ ] Multi-turn send: two sends to same conversation work

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked Governor + Resolution + Parser
- Integration test: send message through mock CDP → parse → store → emit
