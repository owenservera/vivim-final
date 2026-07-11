# Gemini — Provider Intelligence Profile

**Provider:** `gemini`
**Company:** Google
**URL:** https://gemini.google.com
**Category:** LLM / AI Assistant
**Auth Type:** Browser-based (Google session)

---

## Source Codebases

| Source | File(s) | LOC | What |
|--------|---------|-----|------|
| cap-store | `src/executor/parsers/gemini.ts` | 95 | batchexecute envelope decoder |
| cap-store | `src/executor/stream-detector.ts` | — | Completion detection config |
| cap-lab | `src/providers/registry.ts` | — | Provider config entry |
| cap-lab | `src/parsers/gemini.ts` | 140 | batchexecute envelope decoder, WrbFrame parser |
| backend | `src/registry/gemini_protocol.rs` | 1915 | **Full Gemini protocol**: RPC IDs, model registry, session state, JSPB headers, recipes |
| vivim-final | `seeds/providers/gemini.json` | 112 | Provider manifest seed |
| vivim-final | `seeds/parsers/gemini/001_batchexecute.ts` | — | Parser seed (v1) |
| vivim-final | `src/engines/stream-parser.ts` | — | No built-in Gemini parser |

---

## CDP Methods Used

| Method | Domain | Used For | Source |
|--------|--------|----------|--------|
| `Page.navigate` | Page | Navigate to gemini.google.com/app | cap-lab `cdp/client.ts` |
| `Runtime.evaluate` | Runtime | Execute JS for batchexecute interaction | cap-lab `cdp/locator.ts` |
| `Runtime.addBinding` | Runtime | CDP binding for `__vivimBlock` push callbacks | cap-lab `cdp/client.ts` |
| `Input.insertText` | Input | Type into `.ql-editor` (Quill editor) | cap-lab `cdp/input.ts` |
| `Input.dispatchKeyEvent` | Input | Send Enter key to submit | cap-lab `cdp/input.ts` |
| `Input.dispatchMouseEvent` | Input | Click send button | cap-lab `cdp/input.ts` |
| `Accessibility.getFullAXTree` | Accessibility | Locate elements by role + name | cap-lab `cdp/locator.ts` |
| `DOM.getDocument` | DOM | Query DOM for selectors | cap-lab `cdp/client.ts` |
| `DOM.querySelector` | DOM | CSS selector fallback | cap-lab `cdp/client.ts` |
| `DOM.getOuterHTML` | DOM | Read element content | cap-lab `cdp/client.ts` |
| `Fetch.enable` | Fetch | Intercept batchexecute responses | cap-lab `cdp/client.ts` |
| `Fetch.getResponseBody` | Fetch | Read full response body | cap-lab `recipe/executor.ts` |
| `Network.enable` | Network | Collect network traffic | cap-lab `cdp/network.ts` |
| `Network.getResponseBody` | Network | Pull response body after loadingFinished | cap-lab `recipe/executor.ts` |
| `Page.screenshot` | Page | Capture page state for debugging | cap-lab `cdp/client.ts` |

**Total: 15 CDP methods**

---

## Streaming & Parsing

### Transport
- **Type:** `batchexecute` (Google RPC over HTTP POST)
- **URL Pattern:** `gemini.google.com/_/BardChatUi/data/batchexecute` (captured via CDP Fetch/Network)
- **Content-Type:** `application/x-www-form-urlencoded` (request), `text/plain` (response — WrbFrame)
- **Format:** Google batchexecute envelope (NOT SSE)

### Completion Signals
| Signal | Type | Meaning |
|--------|------|---------|
| `"[["` (start of JSON array) | data prefix | Stream response start |
| `")]\\n"` | data suffix | Stream response end |
| No `[DONE]` equivalent | — | Batch responses are self-terminating |

### batchexecute Envelope Format
```
)]}'

123
[["wrb.fr","XGeminiResponse","[...]",null,"generic"]

124
[["wrb.fr","XAnotherResponse","[...]"]]
```

### WrbFrame Structure
Each response is a "WrbFrame":
- Line 1: `)]}'` (XSSI prefix)
- Line 2: `<length>\n` (body length)
- Line 3+: `["wrb.fr","<RpcId>","<JsonBody>",null,"<Type>"]`

### RPC IDs Used (from backend `gemini_protocol.rs`)
| RPC ID | Purpose | Args |
|--------|---------|------|
| `BardSettings` | User settings, model config | Null |
| `RateLimit` | Quota check | Null |
| `UserStatus` | Auth status | Null |
| `ConversationList` | List conversations | Null |
| `SendMessage` | Send prompt + get response | `ConversationId`, prompt text |
| `ModelSwitchAck` | Switch model | `BranchConversation` |
| `DeleteConversation1` | Delete conversation | `ConversationId` |
| `DeepResearchCaps` | Deep research capabilities | `ConversationId` |
| `QuotaPlan` | Plan quota info | Null |

### Block Types Produced
- `text` — markdown content
- `code` — code blocks
- `thinking` — Gemini "thinking" content (when enabled)

### Parser Chain
```
1. seeds/parsers/gemini/001_batchexecute.ts  (seed, versioned)
2. No built-in fallback in StreamParserEngine
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
| Composer | `.ql-editor` | Quill rich text editor |
| Send button | `button[aria-label='Send message']` | Aria-label based |
| Chat container | `main` | Standard main element |

### Composer Type
- **Quill editor** — Gemini uses Quill.js, which has a `.ql-editor` contenteditable div
- `Input.insertText` works for Quill
- May need `Input.dispatchKeyEvent` with ArrowDown/Enter for Quill-specific behavior

---

## Gemini-Specific: Model Registry

From backend `gemini_protocol.rs`:

```rust
pub const MODELS: &[ModelSpec] = &[
    ModelSpec { mode_id: "95b221a35f59a86d", model_num: 3, api_name: "gemini-3.1-pro", deprecated: false },
    ModelSpec { mode_id: "ba727baf0ec2ba6a", model_num: 6, api_name: "gemini-3.1-flash-lite", deprecated: false },
    // ... more models
];
```

**Key insight:** Gemini has a mode_id → model_num → api_name mapping. When Google rotates mode-ids, edit one place. All callers derive from here.

---

## Key Design Notes

1. **batchexecute is NOT SSE** — Gemini uses Google's batchexecute RPC format, not SSE. Parser must decode WrbFrame envelope.
2. **WrbFrame parsing** — each response has a length prefix, RPC ID, and JSON body. Parser must split on frame boundaries.
3. **XSSI prefix** — responses start with `)]}'` to prevent XSSI. Parser must skip this.
4. **Quill editor** — `.ql-editor` is a contenteditable div managed by Quill.js. Standard textarea typing won't work.
5. **Model rotation** — Google periodically changes mode-ids. The backend `GeminiProfile` pattern (single source of truth) should be ported.
6. **No `[DONE]`** — batchexecute responses are self-terminating. Completion detection uses JSON array markers.

---

## Extraction Status

| Item | Status | Source |
|------|--------|--------|
| CDP methods | ✓ Extracted | cap-lab CDP client/locator/input |
| Streaming config | ✓ Extracted | cap-store parsers, cap-lab registry |
| Capabilities | ✓ In vivim-final seed | `seeds/providers/gemini.json` |
| Parser seed | ✓ In vivim-final | `seeds/parsers/gemini/001_batchexecute.ts` |
| Selectors | ✓ In vivim-final seed | `seeds/providers/gemini.json` endpoints |
| Model registry | ✗ Backend only | `gemini_protocol.rs` MODELS — needs port |
| RPC specs | ✗ Backend only | `gemini_protocol.rs` BATCH_RPC_SPECS — needs port |
| Recipes | ✗ Backend only | `gemini_protocol.rs` RECIPES — needs port |
| Confidence scoring | ✗ Not yet | Needs harvest from cap-store |
| Status ladder | ✗ Not yet | Needs harvest from cap-store |
