# DeepSeek — Provider Intelligence Profile

**Provider:** `deepseek`
**Company:** DeepSeek
**URL:** https://chat.deepseek.com
**Category:** LLM / AI Assistant
**Auth Type:** Browser-based (session cookies)

---

## Source Codebases

| Source | File(s) | LOC | What |
|--------|---------|-----|------|
| cap-store | `src/executor/parsers/index.ts` | — | Maps `deepseek` → `createOpenAISSEParser()` |
| cap-lab | `src/providers/registry.ts` | — | Provider config entry (reuses OpenAI format) |
| backend | N/A | — | No DeepSeek-specific protocol files |
| vivim-final | `seeds/providers/deepseek.json` | — | Provider manifest seed |
| vivim-final | `seeds/parsers/generic/002_openai_delta.ts` | — | Generic OpenAI delta parser (shared) |

---

## CDP Methods Used

Same as ChatGPT — DeepSeek reuses the OpenAI SSE format:

| Method | Domain | Used For |
|--------|--------|----------|
| `Page.navigate` | Page | Navigate to chat.deepseek.com |
| `Runtime.evaluate` | Runtime | Execute JS for interaction |
| `Input.insertText` | Input | Type into textarea |
| `Input.dispatchKeyEvent` | Input | Send Enter key |
| `Input.dispatchMouseEvent` | Input | Click send button |
| `Accessibility.getFullAXTree` | Accessibility | Locate elements |
| `DOM.querySelector` | DOM | CSS selector fallback |
| `Fetch.enable` | Fetch | Intercept API responses |
| `Fetch.getResponseBody` | Fetch | Read full SSE body |
| `Network.enable` | Network | Collect traffic |

**Total: 10 CDP methods (subset of ChatGPT)**

---

## Streaming & Parsing

### Transport
- **Type:** SSE (Server-Sent Events)
- **URL Pattern:** `chat.deepseek.com/api` (captured via CDP Fetch domain)
- **Content-Type:** `text/event-stream`
- **Format:** OpenAI-compatible SSE

### Completion Signals
| Signal | Type | Meaning |
|--------|------|---------|
| `"[DONE]"` | data value | Stream complete — OpenAI standard |

### Delta Format
Identical to OpenAI SSE format. DeepSeek is an OpenAI-compatible provider.

### Parser Reuse
DeepSeek reuses the generic OpenAI parser:
```
1. seeds/parsers/generic/002_openai_delta.ts  (shared with chatgpt, qwen, etc.)
```

---

## Capabilities Registered

| Slug | Display Name | Category | Input |
|------|-------------|----------|-------|
| `send_message` | Send Message | conversation | prompt (text) |
| `create_new_chat` | New Chat | navigation | — |
| `navigate_chat` | Navigate Chat | navigation | conversationId |
| `delete_chat` | Delete Chat | navigation | conversationId |

**Total: 4 capabilities (minimal set)**

---

## Selectors

| Element | Selector | Notes |
|---------|----------|-------|
| Composer | `textarea` | Standard textarea |
| Send button | `button[aria-label='Send']` | May need locale variant |

---

## Key Design Notes

1. **OpenAI-compatible** — DeepSeek uses the same SSE format as ChatGPT. The generic OpenAI parser handles both.
2. **Minimal capabilities** — fewer registered capabilities than ChatGPT/Claude/Gemini.
3. **No extended thinking** — DeepSeek does not return thinking blocks in the stream.
4. **Generic parser reuse** — `seeds/parsers/generic/002_openai_delta.ts` is the canonical parser for all OpenAI-compatible providers.

---

## Extraction Status

| Item | Status | Source |
|------|--------|--------|
| CDP methods | ✓ Extracted | cap-lab (reuses ChatGPT patterns) |
| Streaming config | ✓ Extracted | cap-store (maps to OpenAI parser) |
| Capabilities | ✓ In vivim-final seed | `seeds/providers/deepseek.json` |
| Parser seed | ✓ In vivim-final | `seeds/parsers/generic/002_openai_delta.ts` (shared) |
| Selectors | ✓ In vivim-final seed | `seeds/providers/deepseek.json` |
