# Claude — Provider Intelligence Profile

**Provider:** `claude`
**Company:** Anthropic
**URL:** https://claude.ai
**Category:** LLM / AI Assistant
**Auth Type:** Browser-based (session cookies)

---

## Source Codebases

| Source | File(s) | LOC | What |
|--------|---------|-----|------|
| cap-store | `src/executor/parsers/claude.ts` | 41 | SSE parser — delta extraction |
| cap-store | `src/executor/parsers/claude-blocks.ts` | — | Content block parser |
| cap-store | `src/executor/stream-detector.ts` | — | Completion detection config |
| cap-lab | `src/providers/registry.ts` | — | Provider config entry |
| cap-lab | `src/parsers/sse.ts` | 125 | SSE line-framer + delta extraction |
| cap-lab | `src/parsers/artifacts.ts` | 73 | Code fence, antArtifact, thinking block extraction |
| backend | N/A | — | No Claude-specific protocol files |
| vivim-final | `seeds/providers/claude.json` | 139 | Provider manifest seed |
| vivim-final | `seeds/parsers/claude/001_streaming_sse.ts` | — | Parser seed (v1) |
| vivim-final | `src/engines/stream-parser.ts:48-83` | — | Built-in Claude parser (fallback) |

---

## CDP Methods Used

| Method | Domain | Used For | Source |
|--------|--------|----------|--------|
| `Page.navigate` | Page | Navigate to claude.ai/new, claude.ai/chat | cap-lab `cdp/client.ts` |
| `Runtime.evaluate` | Runtime | Execute JS: type into composer, click send | cap-lab `cdp/locator.ts` |
| `Runtime.addBinding` | Runtime | CDP binding for `__vivimBlock` push callbacks | cap-lab `cdp/client.ts` |
| `Input.insertText` | Input | Type into ProseMirror contenteditable | cap-lab `cdp/input.ts:138` |
| `Input.dispatchKeyEvent` | Input | Send Enter key to submit message | cap-lab `cdp/input.ts` |
| `Input.dispatchMouseEvent` | Input | Click send button | cap-lab `cdp/input.ts` |
| `Accessibility.getFullAXTree` | Accessibility | Locate elements by role + name | cap-lab `cdp/locator.ts:207` |
| `DOM.getDocument` | DOM | Query DOM for selectors | cap-lab `cdp/client.ts` |
| `DOM.querySelector` | DOM | CSS selector fallback | cap-lab `cdp/client.ts` |
| `DOM.getOuterHTML` | DOM | Read element content | cap-lab `cdp/client.ts` |
| `Fetch.enable` | Fetch | Intercept API responses for stream capture | cap-lab `cdp/client.ts` |
| `Fetch.getResponseBody` | Fetch | Read full SSE body after stream ends | cap-lab `recipe/executor.ts` |
| `Fetch.takeResponseBodyAsStream` | Fetch | Stream response body via IO domain | cap-lab `cdp/client.ts` |
| `IO.read` | IO | Read streaming response chunks | cap-lab `cdp/client.ts` |
| `IO.close` | IO | Close stream handle | cap-lab `cdp/client.ts` |
| `Network.enable` | Network | Collect network traffic for stream capture | cap-lab `cdp/network.ts:171` |
| `Network.getResponseBody` | Network | Pull response body after loadingFinished | cap-lab `recipe/executor.ts` |
| `Page.screenshot` | Page | Capture page state for debugging | cap-lab `cdp/client.ts` |

**Total: 18 CDP methods**

---

## Streaming & Parsing

### Transport
- **Type:** SSE (Server-Sent Events)
- **URL Pattern:** `claude.ai/api` (captured via CDP Fetch domain)
- **Content-Type:** `text/event-stream`
- **Format:** Anthropic SSE (custom delta format, NOT OpenAI-compatible)

### Completion Signals
| Signal | Type | Meaning |
|--------|------|---------|
| `"message_stop"` | event type | Stream complete |
| `"message_delta"` | event type | Delta with stop_reason field |
| `"[DONE]"` | data value | Fallback (may not appear) |

### Delta Format (Anthropic SSE)
```json
// Text content
{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

// Thinking content
{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Let me..."}}

// Stop signal
{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{...}}
```

### Block Types Produced
- `text` — markdown content
- `thinking` — extended thinking chain
- `code` — code blocks with language tag
- `tool_use` — tool call blocks

### Parser Chain
```
1. seeds/parsers/claude/001_streaming_sse.ts  (seed, versioned)
2. src/engines/stream-parser.ts builtinClaude()  (built-in fallback)
```

---

## Capabilities Registered

| Slug | Display Name | Category | Input |
|------|-------------|----------|-------|
| `select_model` | Select Model | session | modelSlug |
| `send_message` | Send Message | conversation | prompt (text) |
| `edit_message` | Edit Message | conversation | messageId + text |
| `regenerate_response` | Regenerate | conversation | — |
| `toggle_extended_thinking` | Extended Thinking | session | enabled (bool) |
| `upload_file` | Upload File | conversation | file |
| `create_new_chat` | New Chat | navigation | — |
| `navigate_chat` | Navigate Chat | navigation | conversationId |
| `delete_chat` | Delete Chat | navigation | conversationId |
| `rename_chat` | Rename Chat | navigation | title |
| `deep_research` | Deep Research | conversation | query |

**Total: 11 capabilities**

---

## Selectors

| Element | Selector | Notes |
|---------|----------|-------|
| Composer | `div[contenteditable="true"]` | ProseMirror, isTrusted=true required |
| Send button | `button[aria-label='Send Message']` | May need locale variant |
| Chat container | `div[class*="conversation"]` | Dynamic class names |

### Locale Variants
- `'New chat'` → `'Nueva conversación'` (Spanish)

---

## Key Design Notes

1. **ProseMirror composer** — requires trusted CDP Input events (`isTrusted=true`). `Input.insertText` is the only way to type reliably.
2. **Extended thinking** — Claude returns thinking blocks interleaved with text. Parser must handle `thinking_delta` events.
3. **No `[DONE]`** — unlike OpenAI, Claude uses `message_stop` event type. Fallback `[DONE]` may not appear.
4. **Locale-sensitive** — button labels change based on browser language. Use locale variants in selectors.
5. **File upload** — uses native file input, not drag-and-drop. `Input.dispatchFileChooserEvent` or `DOM.setFileInputFiles` needed.

---

## Extraction Status

| Item | Status | Source |
|------|--------|--------|
| CDP methods | ✓ Extracted | cap-lab CDP client/locator/input |
| Streaming config | ✓ Extracted | cap-store parsers, cap-lab registry |
| Capabilities | ✓ In vivim-final seed | `seeds/providers/claude.json` |
| Parser seed | ✓ In vivim-final | `seeds/parsers/claude/001_streaming_sse.ts` |
| Selectors | ✓ In vivim-final seed | `seeds/providers/claude.json` endpoints |
| Confidence scoring | ✗ Not yet | Needs harvest from cap-store |
| Status ladder | ✗ Not yet | Needs harvest from cap-store |
| Self-healing | ✗ Not yet | Needs harvest from cap-lab |
