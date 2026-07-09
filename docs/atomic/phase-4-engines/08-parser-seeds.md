# Unit 4.8-4.13: Parser Seed Files (6 units)

**Phase:** 4 | **Files:** `seeds/parsers/` (6 files)
**Depends:** 4.1 StreamParserEngine | **Produces:** Provider-specific response parsers
**Source:** `06-merged-seeds.md` §Parser Seed Files

## ParserModule Contract (all must implement)
```typescript
interface ParserModule {
  name: string;
  version: number;
  providerId: string;
  parse(rawBody: string): ContentBlock[];
  detectCompletion(rawBody: string): boolean;
  getConfidence(rawBody: string): number;
}
```

## 4.8: Parser — claude/001_streaming_sse.ts
- Provider: claude
- Format: SSE (Server-Sent Events)
- Parses `data:` prefixed lines
- Handles: content_block_start, content_block_delta, message_stop, error
- ContentBlock mapping: text, tool_use → tool_use, thinking → thinking, image → image, meta → meta
- detectCompletion: checks for `message_stop` or `[DONE]`
- getConfidence: 0 if no `data:` lines, 0.3 if no `content_block`, 0.7 baseline, 1.0 if `message_stop`

## 4.9: Parser — gemini/001_batchexecute.ts
- Provider: gemini
- Format: batchexecute nested JSON arrays
- Parses `[[["wrb.fr","...",...]]]` structure
- Extract text blocks from inner arrays
- detectCompletion: heuristic based on array structure
- getConfidence: 0.8 if parseable JSON, 0 otherwise

## 4.10: Parser — chatgpt/001_openai_sse.ts
- Provider: chatgpt
- Format: OpenAI-compatible SSE
- Parses `data:` lines with Delta objects
- Handles: text delta, tool_calls delta, finish_reason
- Similar structure to Claude SSE but different event types

## 4.11: Parser — generic/001_sse_frames.ts
- Provider: generic (fallback for any SSE-based provider)
- Format: Generic SSE frame parser
- Splits on `data:` lines, attempts JSON parse
- If JSON: wraps as structured block
- If plain text: wraps as text block

## 4.12: Parser — generic/002_openai_delta.ts
- Provider: generic (OpenAI-compatible delta format)
- Format: OpenAI-style delta streaming
- Parses `choices[0].delta.content` chunks
- Handles role, content, function_call, tool_calls

## 4.13: Parser — system/001_fallback.ts
- Provider: system (universal fallback)
- Format: Any text
- parse(): returns entire rawBody as single text block
- detectCompletion(): always returns true
- getConfidence(): 0.1 if body non-empty, 0 otherwise
- NEVER throws — must always succeed

## Tests (per parser)
- [ ] Parse canned response body → correct ContentBlock[] count
- [ ] detectCompletion returns true for complete responses
- [ ] getConfidence returns sensible values for valid/invalid input
- [ ] Fallback parser always succeeds (never throws)

## Gate
- All 6 parsers implement ParserModule interface
- Dynamic import() loads each parser module
- Fallback parser handles any input
