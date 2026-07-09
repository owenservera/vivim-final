# Unit 3.9: ConversationManager — Context Injection

**Phase:** 3 | **File:** Add to `src/engines/conversation-manager.ts` (part of unit 3.6)
**Depends:** 3.6 ConversationManager, 3.7 CapabilityEventBus | **Produces:** Context injection in 8-step pipeline
**Source:** `04-merged-engines.md` §Engine 2 "Context Injection"

## Purpose

Extends the ConversationManager 8-step pipeline with context injection. Before each send, the manager builds a `ConversationContext` object and attaches it to `conversation.context_json`. This gives downstream systems (HarnessRuntime, telemetry, UI) provider/account/chrome/capability state at send time.

## Interface (addition to 3.6)

```typescript
interface ConversationContext {
  provider: {
    id: string;
    slug: string;
    displayName: string;
  };
  account: {
    email: string;
    planTier: string;
    loginState: string;
  };
  chrome: {
    status: string;
    circuitState: string;
  };
  capabilities: {
    total: number;
    available: number;
  };
}

// Injected into pipeline between step [1] RESOLVE and step [2] DERIVE SLAVE:
// [1.5] INJECT CONTEXT
//   const context: ConversationContext = {
//     provider: { id: conv.provider_id, slug: ..., displayName: ... },
//     account: { email: account.email, planTier: account.plan_tier, loginState: account.login_state },
//     chrome: { status: slave.status, circuitState: slave.circuitState },
//     capabilities: { total: resolved.total, available: resolved.composer.length },
//   };
//   await store.updateConversation(conversationId, { context_json: JSON.stringify(context) });
```

## Store Contract (addition to ConversationStore)
```typescript
// ConversationStore must support:
updateConversation(id: string, patch: { context_json?: string }): Promise<void>;
```

## Tests
- [ ] After `send()`, `conversation.context_json` is populated with valid JSON
- [ ] Context includes provider slug, account email, chrome status, capability count
- [ ] Context injection does not break the 8-step pipeline timing
- [ ] Missing provider/account data produces graceful defaults (not throws)

## Gate
- `bunx tsc --noEmit` passes
- Pipeline still completes within latency budgets
- Context is queryable via `GET /api/conversations/:id`
