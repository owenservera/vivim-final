# Generic / OpenAI-Compatible — Provider Intelligence Profile

**Purpose:** Documents the shared patterns used by OpenAI-compatible providers (deepseek, qwen, z-ai, studio-ai)

---

## OpenAI-Compatible Provider Family

These providers all share the same SSE format and delta structure:

| Provider | Base URL | Parser Reuse |
|----------|----------|--------------|
| ChatGPT | `chatgpt.com` | `chatgpt/001_openai_sse.ts` |
| DeepSeek | `chat.deepseek.com` | `generic/002_openai_delta.ts` |
| Qwen | `chat.qwen.ai` | `generic/002_openai_delta.ts` |
| Z-AI | `z.ai` | `generic/002_openai_delta.ts` |
| Studio-AI | `aistudio.google.com` | `generic/002_openai_delta.ts` |

---

## Shared SSE Format

```json
// Text content
{"choices":[{"delta":{"content":"..."},"finish_reason":null}]}

// Tool call
{"choices":[{"delta":{"tool_calls":[{"function":{"name":"...","arguments":"..."}}]},"finish_reason":null}]}

// Stop
{"choices":[{"delta":{},"finish_reason":"stop"}]}

// End
data: [DONE]
```

## Shared Completion Signal

| Signal | Value |
|--------|-------|
| Terminal | `"[DONE]"` |

## Shared Parser

```
seeds/parsers/generic/002_openai_delta.ts
```

This parser is reusable for any provider that uses OpenAI-compatible SSE format.

---

## Provider-Specific Differences

| Aspect | ChatGPT | DeepSeek | Qwen | Z-AI | Studio-AI |
|--------|---------|----------|------|------|-----------|
| Composer | `#prompt-textarea` | `textarea` | `.chat-input` | `textarea` | varies |
| Send button | `data-testid="send-button"` | `aria-label='Send'` | varies | varies | varies |
| ContentEditable | No | No | No | No | No |
| Extended thinking | No | No | No | No | No |
| Tool calls | Yes | Yes | Yes | Yes | Yes |
| File upload | Yes | Yes | Yes | Yes | Yes |

All use standard `<textarea>` — none require ProseMirror or Quill contenteditable handling.
