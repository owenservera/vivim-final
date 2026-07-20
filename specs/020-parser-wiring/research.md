# Research: Parser Logic Harvest (020)

**Date**: 2026-07-18
**Sources**:
- `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store` (diagnostic + SSE sample)
- `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab\{CLAUDE,CHATGPT,GEMINI}-CAPABILITIES-AND-STREAMING.md`
- Our repo: `seeds/parsers/claude-streaming-sse.ts`, `src/engines/stream-parser.ts`,
  `src/storage/impl/parser-store-impl.ts`

## Classification: IMPLEMENT (build, not research-only)

The gap is execution, not knowledge. We have working reference parsers in the OG trees and a
DB-backed engine ready to run them. This research consolidates the harvestable logic.

## Harvested formats

### 1. Claude — SSE `content_block_delta` (already in our repo)
- Format: `data: {"type":"content_block_start",...}` / `content_block_delta` / `message_stop`.
- `parse()`: emits `text`/`reasoning`/`tool-call`/`file`/`meta` blocks; `message_stop` ⇒ done.
- Reference: `seeds/parsers/claude-streaming-sse.ts` (canonical; keep as v1).

### 2. ChatGPT / OpenAI — `choices[].delta.content`
Harvested from GEMINI doc `extractOpenAIBlock` (L435-478). Three sub-shapes:
- **OpenAI stream**: `data.choices[0].delta.content` (string) → text block.
- **ChatGPT patch**: `data.o === 'patch'`, `data.v[]` entries with
  `p` starting `/message/content/parts/...` and `o` in `append|add|replace` → joined text.
- **ChatGPT parts**: `data.o === 'add'`, `data.v.message.content.parts[]` (string ⇒ text,
  `{asset_pointer}` ⇒ image) OR `data.message.content.parts[]`.
- Terminal: `[DONE]` data frame.

### 3. Google AI Studio — `candidates[].content.parts[].text`
Harvested from GEMINI doc `extractGoogleAIStudioBlock` (L480-486):
`data.candidates[0].content.parts[0].text` → text block.

### 4. Gemini — batchexecute `[[...]]` arrays
Harvested from GEMINI doc `src/parsers/gemini.ts` (L202-320) + pipeline (L488-525):
- `decodeEnvelope(raw)`: strip XSSI `)]}'\n`, split lines, skip all-digit byte-counts, parse
  JSON arrays, find `wrb.fr` entries; terminal when any child array's first element is `"e"`.
- `parseStreamChunk(frame)`: text delta at `inner[4][0][1]` or fallback `inner[3][0][0]`.
- Terminal marker: `[["e"`.

## Data model findings

`provider_parser` already supports everything needed:
- `parser_version` (Int) — version/variation axis. ✅
- `fallbackParserId` (self FK) — fallback graph. ✅ (019 added `setParserFallback`)
- `parser_logic_type` enum `file|inline|composed` — we use `inline`. ✅
- `parser_logic_code` (String) — inline factory source. ✅
- `parser_hash` — cache invalidation (019 `computeParserHash`). ✅

**Gap**: `parser_version` is a single integer. Variations are encoded as distinct rows with
different `name`+`version`+`providerId`; the engine selects via
`getParserByProviderAndVersion(baseId, version)`. No schema change required — versioning is
row-level. We will add a `parser_variant` *tag* is NOT needed; `name` already disambiguates
(e.g. `chatgpt/001_openai_delta`, `chatgpt/002_parts`).

## Engine contract (how inline code is executed)

`StreamParserEngine.loadModuleFromRow` (stream-parser.ts:192):
- `logic_type==='inline'` + `logic_code` ⇒ `loadInlineParser` (sandbox `run`, globals
  `{module, exports}`) OR legacy host `new Function('module','exports', code)`.
- Inline code contract: `function(module, exports){ exports.default = { name, version,
  providerId, parse(rawBody), detectCompletion(rawBody), getConfidence(rawBody) } }`.
- Returns `ContentBlock[]` (normalized). `detectCompletion` ⇒ boolean. `getConfidence` ⇒ number.

## Fallback chain design

For each provider P:
```
P/001_<format>  --fallback-->  generic/001_format-agnostic  --fallback-->  system/001_raw-text
```
- `generic` parser: detects `data:` (SSE) vs `[[` (Gemini array) vs JSON `choices/candidates`,
  extracts best-effort text.
- `system` parser: returns `[{type:'text', text: rawBody}]` always (never throws).
- `resolveFallbackChain` (019) walks `fallbackParserId` until a parser succeeds; cycle-guarded.

## Multi-step program execution

`governor.executeSnapshotProgram` (chrome-governor.ts) currently runs `recipe.action` only.
The harness `Recipe` type (`recipe-types.ts`) supports `steps: RecipeStep[]` (MultiAction).
R4 extends it to iterate `recipe.steps` (or `recipe` if single action) and call
`browserHarness.runAction(slaveId, step.action, {...step.params, ...params})` per step,
collecting results; a thrown step is captured as a failed sub-result, not a hard crash.

## Risks
- Inline code size: Gemini `decodeEnvelope` is ~70 lines; within reason for `logic_code`.
- ChatGPT patch/parts heuristics can mis-parse; mitigated by the generic/system fallback tier.
- Sandbox permissions: parser code is read-only over `rawBody`; no network/DOM. Permissions
  already set in `StreamParserEngine.SANDBOX_PERMISSIONS`.
