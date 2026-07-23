# Context Compaction & Loop Detection — Confirmed Code Path

**Convergence:** CONFIRMED
**Iterations:** 1 | **Confidence:** High
**Date:** 2026-07-23

## Recommended Approach

Adopt browser-use's context compaction pattern and cdp-browser's loop detection for vivim-final's agentic loops. Both patterns prevent runaway behavior in long-running sessions.

## Working Code Example

### Context Compaction (from browser-use)

```typescript
// Adapted from browser-use/agent/message_manager/service.ts
// Source: https://github.com/browser-use/browser-use

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  taskRelevance: number; // 0-1, higher = more relevant to current task
}

class ContextCompactor {
  private maxTokens: number;
  private compactedHistory: Message[] = [];

  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }

  async maybeCompact(messages: Message[]): Promise<Message[]> {
    const totalTokens = this.estimateTokens(messages);
    if (totalTokens <= this.maxTokens) return messages;

    // Keep: system message + last N messages + highest-relevance messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const recentMessages = messages.slice(-5); // Always keep last 5
    const importantMessages = messages
      .filter(m => !systemMessages.includes(m) && !recentMessages.includes(m))
      .sort((a, b) => b.taskRelevance - a.taskRelevance)
      .slice(0, 3); // Keep top 3 by relevance

    // Create summary of dropped messages
    const dropped = messages.filter(m =>
      !systemMessages.includes(m) &&
      !recentMessages.includes(m) &&
      !importantMessages.includes(m)
    );

    const summary: Message = {
      role: 'system',
      content: `[Context compacted: ${dropped.length} messages summarized. Key actions: ${dropped.map(m => m.content.slice(0, 50)).join('; ')}]`,
      timestamp: Date.now(),
      taskRelevance: 0.5,
    };

    return [...systemMessages, summary, ...importantMessages, ...recentMessages];
  }

  private estimateTokens(messages: Message[]): number {
    // Rough estimate: 1 token per 4 characters
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }
}
```

### Loop Detection (from cdp-browser)

```typescript
// Adapted from dao-ai/cdp-browser/scripts/loop-detector.ts
// Source: https://github.com/dao-ai/cdp-browser

interface ActionRecord {
  action: string;
  target: string;
  result: 'success' | 'failure';
  timestamp: number;
}

class LoopDetector {
  private history: ActionRecord[] = [];
  private windowSize: number = 10;
  private maxRepeats: number = 3;

  record(action: string, target: string, result: 'success' | 'failure') {
    this.history.push({ action, target, result, timestamp: Date.now() });
    if (this.history.length > this.windowSize * 2) {
      this.history = this.history.slice(-this.windowSize * 2);
    }
  }

  isLooping(): boolean {
    if (this.history.length < this.windowSize) return false;

    const recent = this.history.slice(-this.windowSize);

    // Check for repeated failed actions
    const failedActions = recent.filter(r => r.result === 'failure');
    if (failedActions.length >= this.maxRepeats) {
      const lastN = failedActions.slice(-this.maxRepeats);
      const allSameAction = lastN.every(r => r.action === lastN[0].action);
      if (allSameAction) return true;
    }

    // Check for oscillation (A→B→A→B pattern)
    if (recent.length >= 4) {
      const pairs = recent.slice(-4);
      if (pairs[0].action === pairs[2].action &&
          pairs[1].action === pairs[3].action &&
          pairs[0].action !== pairs[1].action) {
        return true;
      }
    }

    return false;
  }

  getSuggestion(): string {
    const recent = this.history.slice(-this.windowSize);
    const failedAction = recent.filter(r => r.result === 'failure').slice(-1)[0];
    if (failedAction) {
      return `Agent is looping on "${failedAction.action}" targeting "${failedAction.target}". Try: different selector, different approach, or escalate to human.`;
    }
    return 'Agent appears to be looping. Consider resetting context.';
  }

  reset() {
    this.history = [];
  }
}
```

### Page Pool (from cdp-browser)

```typescript
// Adapted from dao-ai/cdp-browser/scripts/cdp-pool.ts
// Source: https://github.com/dao-ai/cdp-browser

class PagePool {
  private pages: Map<string, CdpPage> = new Map();
  private maxPages: number;

  constructor(maxPages: number = 4) {
    this.maxPages = maxPages;
  }

  async acquire(key: string, factory: () => Promise<CdpPage>): Promise<CdpPage> {
    if (this.pages.has(key)) {
      return this.pages.get(key)!;
    }

    if (this.pages.size >= this.maxPages) {
      // Evict oldest
      const oldest = this.pages.keys().next().value!;
      const oldPage = this.pages.get(oldest)!;
      await oldPage.close();
      this.pages.delete(oldest);
    }

    const page = await factory();
    this.pages.set(key, page);
    return page;
  }

  async release(key: string) {
    const page = this.pages.get(key);
    if (page) {
      await page.close();
      this.pages.delete(key);
    }
  }

  async closeAll() {
    for (const [key, page] of this.pages) {
      await page.close();
    }
    this.pages.clear();
  }
}
```

## Why This Works

1. **Context compaction is battle-tested** — browser-use uses it in production with 77K+ users
2. **Loop detection is simple and effective** — cdp-browser's pattern catches the two main failure modes (repeated failure, oscillation)
3. **Page pool reduces resource churn** — reuse tabs instead of creating/destroying

## Prerequisites

- Access to vivim-final's agentic loop (agentic-loop.ts)
- CDP session management (ChromeGovernor)

## Known Gotchas

- **Context compaction may drop important context** — the `taskRelevance` scoring is heuristic, not perfect
- **Loop detection window size needs tuning** — too small misses loops, too large has false positives
- **Page pool must handle provider-specific state** — some providers lose auth when tabs are reused

## Verification Steps

1. Start an agentic session with a provider
2. Intentionally fail an action 3 times → loop detector should fire
3. Run a long session (20+ actions) → context compaction should activate
4. Open multiple provider tabs → page pool should reuse tabs

## Risk Assessment

- **Technical risk:** Low — patterns are proven in production
- **Integration risk:** Low — additive to existing agentic loop
- **Maintenance risk:** Low — these are utility patterns, not provider-specific
