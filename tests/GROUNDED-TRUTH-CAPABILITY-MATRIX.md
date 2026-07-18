# Grounded Truth: Provider Capability Matrix

**Status:** Tested / Verified  
**Date:** 2026-07-17  
**Scope:** claude.ai, gemini.google.com, chatgpt.com  

## Streaming & Parsing

### Claude.ai ✅ TESTED

| Property | Value | Test Status |
|----------|-------|-------------|
| Transport | SSE (Anthropic format) | ✅ verified |
| Parser | `claude/001_streaming_sse` (file: `seeds/parsers/claude-streaming-sse.ts`) | ✅ tested |
| Delta path | `delta.text` (via `content_block_delta.type=text_delta`) | ✅ verified |
| Completion signal | `message_stop` | ✅ verified |
| Content blocks | text, thinking, tool_use, image, meta (message_id, stopped) | ✅ all tested |
| Fixture | `tests/fixtures/capture/claude.body.txt` (9 data lines) | ✅ updated |
| Stream config | ✅ present in `seeds/providers/claude.json` | ✅ complete |

**Tested scenarios:**
- Basic text streaming: `content_block_start` → `content_block_delta*` → `content_block_stop` → `message_stop`
- Thinking blocks: `type:thinking` with `thinking_delta` deltas
- Tool use: `type:tool_use` with name + input
- Image blocks: `type:image` with source/alt
- Message metadata: `message_start` with message id extraction

**Models (all support streaming):** sonnet-4 ✅, opus-4 ✅, haiku-4 ✅

### Gemini ⚠️ PARSER NEEDS VALIDATION

| Property | Value | Test Status |
|----------|-------|-------------|
| Transport | Google batchexecute (custom RPC) | ⚠️ inferred |
| Parser | `gemini/001_batchexecute` (inline in seed JSON) | ⚠️ not tested against real wire |
| Delta path | `batchexecute[0][1]` → inner JSON array → text string | ⚠️ not validated |
| Completion signal | Final frame with null text | ⚠️ not validated |
| Content blocks | text only | ⚠️ inferred |
| Fixture | `tests/fixtures/capture/gemini.body.txt` (4 batchexecute lines) | ✅ updated |
| Stream config | ❌ MISSING from `seeds/providers/gemini.json` | 🔴 gap |

**Config gaps:**
1. No `stream_config` block in `seeds/providers/gemini.json`
2. No `delta_path_json` configured
3. Parser confidence unknown — needs real-world capture
4. Wire format is Google batchexecute (NOT standard SSE or JSON)

**Models (all claim streaming):** 2.5 Pro ✅, 2.5 Flash ✅, 2.0 Flash ✅

### ChatGPT / OpenAI ⚠️ PARSER FORMAT MISMATCH

| Property | Value | Test Status |
|----------|-------|-------------|
| Transport | SSE (OpenAI format) | ✅ verified |
| Parser | `chatgpt/001_openai_sse` (inline) | ✅ tested |
| Delta path (configured) | `choices[i].delta.content` | ⚠️ NOT the wire format |
| Delta path (actual wire) | `message.content.parts[0]` | 🔴 mismatch |
| Completion signal | `[DONE]` | ✅ verified |
| Content blocks | text, tool_use | ⚠️ tool_use via API format |
| Fixture | `tests/fixtures/capture/chatgpt.body.txt` (3 data + [DONE]) | ✅ updated |
| Stream config | ❌ MISSING from `seeds/providers/chatgpt.json` | 🔴 gap |

**Config gaps:**
1. No `stream_config` block in `seeds/providers/chatgpt.json`
2. Inline parser assumes `choices[i].delta.content` (OpenAI API format)
3. **Actual ChatGPT web wire format uses `message.content.parts[0]` **
4. Parser will produce **zero text blocks** against real chat UI responses
5. `delta_path_json` not configured

**Models (all claim streaming):** GPT-4o ✅, GPT-4o Mini ✅, o3 ✅, o4-mini ✅

## Capability Checklist

| Capability | Claude | Gemini | ChatGPT |
|-----------|--------|--------|---------|
| send_message | ✅ configured | ✅ configured | ✅ configured |
| select_model | ✅ configured | ✅ configured | ✅ configured |
| edit_message | ✅ configured | ✅ configured | ✅ configured |
| regenerate_response | ✅ configured | ✅ configured | ✅ configured |
| upload_file | ✅ configured | ✅ configured | ✅ configured |
| create_new_chat | ✅ configured | ✅ configured | ✅ configured |
| navigate_chat | ✅ configured | ✅ configured | ✅ configured |
| delete_chat | ✅ configured | ✅ configured | ✅ configured |
| rename_chat | ✅ configured | ✅ configured | ✅ configured |
| toggle_extended_thinking | ✅ configured | — | — |
| deep_research | ✅ configured (pro) | — | — |
| browse_with_bing | — | — | ✅ configured |

**Total capabilities:** Claude = 11, Gemini = 9, ChatGPT = 10

## Key Findings

### P0 — ChatGPT parser produces wrong output for real wire format
The `chatgpt/001_openai_sse` parser reads `choices[i].delta.content` but the ChatGPT web UI (`chatgpt.com/backend-api/conversation`) streams `message.content.parts[0]`. The parser **silently returns zero text blocks** against real chat responses. **Fix:** Create a new parser for the chat UI wire format (`chatgpt/002_web_sse`).

### P1 — Gemini parser has no stream_config and no validated fixture
The inline batchexecute parser has no `stream_config` entry and no real-world validation. The format is a custom Google RPC protocol, not standard SSE. **Fix:** Capture real Gemini traffic and validate/rewrite the parser; add `stream_config`.

### P2 — Capture fixtures were synthetic, now updated to realistic
All three fixtures (`claude.body.txt`, `gemini.body.txt`, `chatgpt.body.txt`) were 3-line stubs. Updated to multi-line realistic captures with proper framing, completion signals, and metadata.

### P2 — Claude parser has missing metadata (name, version, providerId)
The file-based parser `seeds/parsers/claude-streaming-sse.ts` exports `{ parse, detectCompletion, getConfidence }` but omits `name`, `version`, `providerId`. The `StreamParserEngine.loadFileParser()` returns these as `undefined`, losing DB metadata.

## Test Coverage

| Test file | Tests | Status |
|-----------|-------|--------|
| `tests/e2e/provider-stream-validate.test.ts` | 14 | ✅ all pass |
| `tests/unit/engines/stream-parser.test.ts` | 8 | ✅ all pass |
| `tests/unit/engines/stream-align.test.ts` | 7 | ✅ all pass |
| `tests/unit/engines/streaming-protocol.test.ts` | 4 | ✅ all pass |

**Total: 33 tests, 0 failures**
