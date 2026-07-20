# OpenCode Pre-Compaction Hook Implementation Plan

## Goal
Create a mechanism to trigger output generation at a configurable token threshold BEFORE auto-compaction occurs, preserving valuable context that would otherwise be lost.

## Current State Analysis

### OpenCode Capabilities (via SDK)
- **Events available**: `session.next.compaction.started`, `session.next.compaction.delta`, `session.next.compaction.ended`, `session.compacted`
- **Plugin hooks**: `experimental.session.compacting` (before compaction starts), `experimental.compaction.autocontinue` (after compaction)
- **Token fields**: `input`, `output`, `reasoning`, `cache.read/write` in session data
- **Event subscription**: SSE-based via `Global.event()` endpoint

### Limitation
The `experimental.session.compacting` hook fires AFTER compaction decision is made, not at a configurable token threshold beforehand.

## Proposed Solution

### Option 1: OpenCode Plugin (Recommended)
Create an `@opencode-ai/plugin` that:
1. Subscribes to `session.next.*` events via SSE
2. Tracks cumulative token usage per session
3. When threshold reached (e.g., 80% of context limit):
   - Emits a toast notification to the user
   - Optionally triggers a "summarize" prompt to capture work-in-progress

**Configuration schema for opencode.json:**
```json
{
  "experimental": {
    "context_checkpoint_threshold": 0.8,
    "context_checkpoint_prompt": "Summarize current work and next steps"
  }
}
```

### Option 2: External Monitor Script
A standalone script that:
1. Polls session stats via `opencode session list`
2. Watches for token accumulation patterns
3. Triggers notifications/exports before threshold

### Option 3: Custom Skill with Prompts
Guide users to use `/session-objectives` skill before hitting thresholds to manually capture state.

## Implementation Details (Option 1)

### Plugin Structure
```typescript
// plugins/context-checkpoint/src/index.ts
import { Plugin } from "@opencode-ai/plugin";

export default Plugin({
  async event({ client }) {
    // Subscribe to session events
    const events = await client.Global.event();
    
    for await (const event of events) {
      if (event.type === "session.next.compaction.started") {
        // Could intercept here, but after decision made
      }
      if (event.type === "session.next.context.updated") {
        // Monitor token usage
        const threshold = config.preserve_recent_tokens * config.context_limit;
        // Check if approaching threshold
      }
    }
  },

  "experimental.session.compacting": async ({ sessionID }) => {
    // Last chance to add context before compaction
    return {
      context: ["Critical work captured before compaction..."],
      // Or replace entirely: prompt: "Custom compaction prompt..."
    };
  }
});
```

### Key Files to Create/Modify
1. **New plugin**: `.opencode/plugin-context-checkpoint/index.ts`
2. **Add to config**: `opencode.json` with experimental flag

## Validation Plan
1. Run plugin during session
2. Verify toast notification appears at threshold
3. Confirm context is preserved in compaction output
4. Test autocontinue behavior after checkpointing

## Open Questions
1. Can plugins interrupt/modify ongoing LLM generation? (May require core modification)
2. Should this be upstreamed to OpenCode as a built-in feature?
3. How to handle multi-turn reasoning in flight?

## Recommendation
Start with Option 1 (plugin) as proof-of-concept, then consider upstreaming to OpenCode core if token-threshold hooks are not already planned.