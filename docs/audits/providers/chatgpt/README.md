# ChatGPT — Provider Intelligence Profile

**Provider:** `chatgpt`
**Company:** OpenAI
**URL:** https://chatgpt.com
**Category:** LLM / AI Assistant
**Auth Type:** Browser-based (session cookies)

---

## Source Codebases

| Source | File(s) | LOC | What |
|--------|---------|-----|------|
| cap-store | `src/executor/parsers/chatgpt.ts` | 93 | Patch format parser — delta extraction |
| cap-store | `src/executor/stream-detector.ts` | — | Completion detection config |
| cap-lab | `src/providers/registry.ts` | — | Provider config entry |
| cap-lab | `src/parsers/sse.ts` | 125 | SSE line-framer + delta extraction |
| cap-lab | `src/parsers/artifacts.ts` | 73 | Code fence, thinking block extraction |
| backend | N/A | — | No ChatGPT-specific protocol files |
| vivim-final | `seeds/providers/chatgpt.json` | — | Provider manifest seed |
| vivim-final | `seeds/parsers/chatgpt/001_openai_sse.ts` | — | Parser seed (v1) |
| vivim-final | `seeds/parsers/generic/002_openai_delta.ts` | — | Generic OpenAI delta parser |

---

## CDP Methods Used

| Method | Domain | Used For | Source |
|--------|--------|----------|--------|
| `Page.navigate` | Page | Navigate to chatgpt.com | cap-lab `cdp/client.ts` |
| `Runtime.evaluate` | Runtime | Execute JS for interaction | cap-lab `cdp/locator.ts` |
| `Runtime.addBinding` | Runtime | CDP binding for `__vivimBlock` push callbacks | cap-lab `cdp/client.ts` |
| `Input.insertText` | Input | Type into textarea | cap-lab `cdp/input.ts` |
| `Input.dispatchKeyEvent` | Input | Send Enter key to submit | cap-lab `cdp/input.ts` |
| `Input.dispatchMouseEvent` | Input | Click send button | cap-lab `cdp/input.ts` |
| `Accessibility.getFullAXTree` | Accessibility | Locate elements by role + name | cap-lab `cdp/locator.ts` |
| `DOM.getDocument` | DOM | Query DOM for selectors | cap-lab `cdp/client.ts` |
| `DOM.querySelector` | DOM | CSS selector fallback | cap-lab `cdp/client.ts` |
| `DOM.getOuterHTML` | DOM | Read element content | cap-lab `cdp/client.ts` |
| `Fetch.enable` | Fetch | Intercept API responses | cap-lab `cdp/client.ts` |
| `Fetch.getResponseBody` | Fetch | Read full SSE body after stream ends | cap-lab `recipe/executor.ts` |
| `Network.enable` | Network | Collect network traffic | cap-lab `cdp/network.ts` |
| `Network.getResponseBody` | Network | Pull response body after loadingFinished | cap-lab `recipe/executor.ts` |
| `Page.screenshot` | Page | Capture page state for debugging | cap-lab `cdp/client.ts` |

**Total: 15 CDP methods**

---

## Streaming & Parsing

### Transport
- **Type:** SSE (Server-Sent Events)
- **URL Pattern:** `backend-api/conversation` (captured via CDP Fetch domain)
- **Content-Type:** `text/event-stream`
- **Format:** OpenAI SSE (standard delta format)

### Completion Signals
| Signal | Type | Meaning |
|--------|------|---------|
| `"[DONE]"` | data value | Stream complete — OpenAI standard |

### Delta Format (OpenAI SSE)
```json
// Text content
{"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}

// Tool call
{"choices":[{"delta":{"tool_calls":[{"function":{"name":"get_weather","arguments":"{\"loc\"}"}}]},"finish_reason":null}]}

// Stop signal
{"choices":[{"delta":{},"finish_reason":"stop"}]}

// End of stream
data: [DONE]
```

### Block Types Produced
- `text` — markdown content
- `code` — code blocks with language tag
- `tool_use` — function call blocks

### Parser Chain
```
1. seeds/parsers/chatgpt/001_openai_sse.ts  (seed, versioned)
2. seeds/parsers/generic/002_openai_delta.ts  (generic OpenAI, reusable for deepseek, etc.)
3. No built-in fallback in StreamParserEngine
```

---

## Capabilities Registered

| Slug | Display Name | Category | Input |
|------|-------------|----------|-------|
| `select_model` | Select Model | session | modelSlug |
| `send_message` | Send Message | conversation | prompt (text) |
| `edit_message` | Edit Message | conversation | messageId + text |
| `regenerate_response` | Regenerate | conversation | — |
| `upload_file` | Upload File | conversation | file |
| `create_new_chat` | New Chat | navigation | — |
| `navigate_chat` | Navigate Chat | navigation | conversationId |
| `delete_chat` | Delete Chat | navigation | conversationId |
| `rename_chat` | Rename Chat | navigation | title |

**Total: 9 capabilities**

---

## Selectors

| Element | Selector | Notes |
|---------|----------|-------|
| Composer | `#prompt-textarea` | Standard textarea (NOT contenteditable) |
| Send button | `button[data-testid="send-button"]` | data-testid attribute, more stable |
| Chat container | `main` | Standard main element |

### Composer Type
- **NOT contenteditable** — ChatGPT uses a standard `<textarea>` element
- `composerIsContentEditable: false` in cap-lab registry
- Can use standard `textarea.value = ...` or `Input.insertText` (both work)

---

## Key Design Notes

1. **Standard textarea** — unlike Claude, ChatGPT uses a standard textarea, not ProseMirror. Simpler typing.
2. **`[DONE]` signal** — standard OpenAI SSE pattern. All OpenAI-compatible providers (deepseek, qwen) reuse this.
3. **Generic parser reuse** — `seeds/parsers/generic/002_openai_delta.ts` is reusable for deepseek, qwen, z-ai, studio-ai.
4. **Tool calls** — ChatGPT supports function calling in the stream. Parser must handle `tool_calls` delta field.
5. **No extended thinking** — ChatGPT does not return thinking/reasoning blocks in the stream.

---

## Extraction Status

| Item | Status | Source |
|------|--------|--------|
| CDP methods | ✓ Extracted | cap-lab CDP client/locator/input |
| Streaming config | ✓ Extracted | cap-store parsers, cap-lab registry |
| Capabilities | ✓ In vivim-final seed | `seeds/providers/chatgpt.json` |
| Parser seed | ✓ In vivim-final | `seeds/parsers/chatgpt/001_openai_sse.ts` |
| Selectors | ✓ In vivim-final seed | `seeds/providers/chatgpt.json` endpoints |
| Generic parser | ✓ In vivim-final | `seeds/parsers/generic/002_openai_delta.ts` |
| Confidence scoring | ✗ Not yet | Needs harvest from cap-store |
| Status ladder | ✗ Not yet | Needs harvest from cap-store |
