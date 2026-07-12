> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-04: Three-Provider Demo

**Phase:** 4 | **Units:** 5 | **Goal:** ChatGPT, Claude, and Gemini all verified working E2E

## Problem

Each provider has different DOM structures, different API patterns, and different response formats. The seeds exist (`seeds/providers/chatgpt.json`, `claude.json`, `gemini.json`) but their selectors and parsers are untested E2E. Provider-specific differences:

| Aspect | ChatGPT | Claude | Gemini |
|--------|---------|--------|--------|
| Composer | `#prompt-textarea` | `div[contenteditable]` | `div.ql-editor[contenteditable]` |
| Submit | `[data-testid='send-button']` | `button[aria-label='Send Message']` | `button.send-button` |
| API Pattern | `/backend-api/conversation` | `/api/organizations/*/chat_conversations/*/completion` | `/_api/BardFrontendService/StreamGenerate` |
| Response Format | OpenAI SSE deltas | Anthropic SSE events | Protobuf-like JSON batches |
| Multi-account | Yes (separate profiles) | Yes | Yes (Google accounts) |

## User Story

> As a user, I want to have active conversations with all three AI providers simultaneously, switching between them in the frontend without any provider-specific breakage.

## Success Criteria

1. User can send "Hello, what is 2+2?" to ChatGPT and receive a text response
2. User can send the same message to Claude and receive a text response
3. User can send the same message to Gemini and receive a text response
4. User can switch between three active conversations without page state bleed
5. Provider health dashboard shows all three as healthy
6. Each provider's parser correctly extracts text blocks from its response format

## Verification Protocol

For each provider:

```
1. Seed loaded → DB has provider_definition + endpoints + parsers + capabilities
2. Login → visible Chrome, user logs in, session saved
3. Headless spawn → profile reuse works, page loads logged-in
4. Single send → message typed + submitted + response captured + parsed
5. Multi-turn → 3+ messages work, DOM stays stable
6. Parser → response body → ContentBlock[] with text content
7. Health → ProviderHealthKernel reports healthy (≥80 score)
```

## Provider-Specific Parser Notes

### ChatGPT (OpenAI SSE)
- Format: `data: {"choices":[{"delta":{"content":"..."}}]}`
- Completion: `data: [DONE]`
- Parser: `seeds/parsers/chatgpt/001_openai_sse.ts` (inline, verified)

### Claude (Anthropic SSE)
- Format: `event: completion\ndata: {"completion":"...","type":"content_block_delta"}`
- Completion: `event: message_stop`
- Parser: `seeds/parsers/claude/001_streaming_sse.ts` (needs verification)

### Gemini (Batch JSON)
- Format: Nested array responses `)]}{"wrb.fr":"...","data":[[["...",["...",["response text"]]]]]}`
- Completion: End of stream (no explicit marker)
- Parser: `seeds/parsers/gemini/001_batchexecute.ts` (needs verification, complex format)

## Key Files

- `seeds/providers/{chatgpt,claude,gemini}.json` — manifests
- `seeds/parsers/{chatgpt,claude,gemini}/` — parser logic
- `src/engines/provider-registrar.ts` — seed loading
- `src/engines/stream-parser.ts` — parser execution
- `web/ui/src/features/provider-setup-wizard.tsx` — provider list

## Units

| Unit | Title | Key Files |
|------|-------|-----------|
| 4.1 | ChatGPT E2E verification | All pipeline files + chatgpt seeds |
| 4.2 | Claude E2E verification | All pipeline files + claude seeds |
| 4.3 | Gemini E2E verification | All pipeline files + gemini seeds |
| 4.4 | Multi-provider switching | `web/sandbox/src/`, conversation-router |
| 4.5 | Provider health monitoring | `provider-health.ts`, `chrome-governor.ts` |

