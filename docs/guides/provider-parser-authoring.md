# Provider Parser Authoring Guide

> **Scope:** How to write, test, upgrade, and seed stream parsers for vivim providers.  
> **Source:** Lessons distilled from the 10x Provider Upgrade session (2026-08-01).

---

## Overview

All parser logic lives **exclusively in the DB** as inline `logic_code` strings.
Source files under `seeds/parsers/harvested/*.ts` export a `LOGIC_CODE` constant that is
upserted into the DB via `seeds/parsers/harvest.seed.ts` on every server boot.
Never write parser logic directly into engine code.

**Fallback chain:** `provider/001` → `generic/001_format_agnostic` → `system/001_raw_text`

---

## File Layout

```
seeds/parsers/harvested/
  <provider>-<format>.ts     ← source of truth for LOGIC_CODE constant
seeds/parsers/harvest.seed.ts ← DEFS array + seedHarvestedParsers() + seedStreamConfigs()
src/engines/stream-parser.ts  ← runtime executor (never edit parser logic here)
```

---

## `LOGIC_CODE` Contract

Each parser module must export a **single template-literal string** containing a self-contained
CommonJS module with exactly three functions plus a default export:

```ts
export const LOGIC_CODE = `
function parse(rawBody) {
  // Returns ContentBlock[]
  // ContentBlock shapes:
  //   { type: 'text', text: string }
  //   { type: 'reasoning', text: string, signature?: string }
  //   { type: 'tool-call', toolCallId, toolName, input }
  //   { type: 'tool-result', toolCallId, text }
  //   { type: 'file', url, mediaType, filename }
  //   { type: 'meta', key: string, value: unknown }
  return blocks;
}
function detectCompletion(rawBody) { return boolean; }
function getConfidence(rawBody) { return 0..1; }
module.exports.default = {
  name: 'provider/001_format_name',
  version: N,                  // bump on EVERY substantive change
  providerId: 'provider',
  parse, detectCompletion, getConfidence
};
`
```

### Rules

- **No imports inside LOGIC_CODE.** The string is executed in a sandbox (`new Function`). All
  helpers must be defined inside the template literal.
- **Never throw.** Wrap all JSON.parse calls in try/catch and push a raw text block as fallback.
- **Bump `version`** each time you change parse logic. `harvest.seed.ts` uses the name as the
  upsert key, but version is stored and used for hash comparison.
- **`getConfidence` must return `1` for the canonical wire format**, `0.6` for plausible
  guesses, and `0` for clearly wrong format. The engine uses this to pick the best parser when
  multiple parsers claim the same body.

---

## Provider-Specific Patterns

### Claude SSE

```
data: {"type":"content_block_start","content_block":{"type":"thinking",...}}
data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"..."}}
data: {"type":"content_block_delta","delta":{"type":"signature_delta","signature":"..."}}
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
data: {"type":"content_block_stop","index":0}
data: {"type":"message_stop"}
```

Key lessons:
- Accumulate `thinking_delta` into a `reasoning` block; accumulate `text_delta` into `text`.
- `signature_delta` is Claude's HMAC verification token for thinking blocks — attach it as
  `last.signature` on the `reasoning` block (not a new block).
- On `content_block_stop`, scan the completed text block for `<antArtifact ...>` tags and
  replace the text block with a `file` block: `url: 'artifact://<identifier>'`.

### ChatGPT SSE (chat UI wire format)

```
data: {"o":"patch","v":[{"p":"/message/content/parts/0","o":"append","v":"..."}]}
data: {"o":"add","v":{"message":{"content":{"parts":["full text"]}}}}
data: [DONE]
```

Key lessons:
- `fromParts()` must return **all** blocks, not just `blocks[0]`. When `parts` contains mixed
  strings and objects (DALL-E `asset_pointer`, Code Interpreter `content_type:'text'`), collect
  all into an array and return the array if `length > 1`.
- `o:'patch'` frames give incremental deltas; `o:'add'` frames give the final assembled message.
  Parse both, deduplicate by preferring the `o:'add'` pass if both are present.
- Tool calls arrive as `data.type === 'tool_call'`; tool outputs as `data.type === 'tool_output'`
  or `data.name === 'code_interpreter' && data.output`.

### Gemini batchexecute

```
)]}'
<length>
[["wrb.fr","rpcId","<json-payload>",null,null,null,"generic"]]
<length>
[["e"]]
```

Key lessons:
- Strip the XSSI prefix `)]}\'\n` before parsing.
- Each line starting with `[` is a frame array. Look for `child[0] === 'wrb.fr'`.
- `child[2]` is a **JSON-encoded string** (double-encoded) — call `safeJsonParse(child[2])`.
- Text delta is at `payload[4][0][1]` (or `payload[3][0][0]` as fallback).
- Grounding citations live in non-text sections of the payload as arrays of `[url, title]` pairs.
  Emit them as `{ type: 'meta', key: 'grounding_link', value: { type:'link', url, title } }`.
- Terminal frame: `child[0] === 'e'`. Set `isTerminal = true` and skip text extraction.

---

## Registering a New Parser

1. **Create** `seeds/parsers/harvested/<provider>-<format>.ts` with `LOGIC_CODE`.

2. **Add to `DEFS`** in `seeds/parsers/harvest.seed.ts`:
   ```ts
   {
     name: 'provider/001_format_name',
     providerId: 'provider',
     version: 1,
     logicCode: IMPORT_ALIAS,
     fallback: 'generic/001_format_agnostic',
   }
   ```

3. **Add a `STREAM_CONFIGS` entry** (same file) so the parser engine knows the transport:
   ```ts
   {
     id: 'psc-<provider>-<format>',
     provider_id: '<provider>',
     stream_transport: 'sse' | 'batchexecute' | 'websocket',
     stream_terminal_json: JSON.stringify(['[DONE]']),
     sse_format: 'openai' | 'anthropic' | null,
     delta_path_json: JSON.stringify(['choices', '0', 'delta', 'content']),
     completion_detectors_json: JSON.stringify(['[DONE]']),
     ...
   }
   ```

4. **Restart server** — `seedHarvestedParsers` and `seedStreamConfigs` run on boot and upsert.

5. **Validate** with:
   ```bash
   bun run devops runtime-test onboard test-parse --provider=<slug>
   ```

---

## Upgrading an Existing Parser

1. Edit the `LOGIC_CODE` in the harvested file.
2. **Bump `version`** in the `module.exports.default` object inside `LOGIC_CODE`.
3. The harvest seed's upsert key is `parser:<providerId>:<nameSuffix>` — same ID, so the DB row
   is updated in-place.
4. Run `bun run gen:protocol` to regenerate `src/__generated__/provider-protocol.ts`.

---

## Testing Checklist

- [ ] `getConfidence(realWireFixture)` returns `1`
- [ ] `getConfidence(wrongFormat)` returns `< 0.5`
- [ ] `parse(sseFixture)` returns correct `ContentBlock[]` types
- [ ] `detectCompletion(partialBody)` returns `false`
- [ ] `detectCompletion(fullBody)` returns `true`
- [ ] Multi-block response: all blocks present (not just first)
- [ ] Malformed JSON frame: no throw, raw text fallback emitted
- [ ] `content_block_stop` triggers artifact extraction (Claude)
- [ ] Grounding links emitted as `meta` blocks (Gemini)

---

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do instead |
|----------|--------------|
| Import from other modules inside `LOGIC_CODE` | Define all helpers inside the template literal |
| `return blocks[0]` from `fromParts` | `return blocks.length === 1 ? blocks[0] : blocks` |
| Throw on malformed JSON | `try/catch` + push raw text fallback |
| Write parser logic in `stream-parser.ts` | Write it in the harvested file, seed into DB |
| Forget to bump `version` | Always bump on any logic change |
| Leave `streamConfigs: []` for a known provider | Add a `STREAM_CONFIGS` entry in harvest.seed.ts |
