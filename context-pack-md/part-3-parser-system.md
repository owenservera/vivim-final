# part-3-parser-system.md

> vivim-final context pack — DB-driven stream parser system: 7 harvested parsers (sample ingestion = chatgpt-openai-delta), StreamParserEngine, alignment, registration, conversation capture, provider manifests

## seeds/parsers/harvested/claude-streaming-sse.ts

```ts
// seeds/parsers/harvested/claude-streaming-sse.ts
// Claude SSE streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Harvested from seeds/parsers/claude-streaming-sse.ts (canonical Claude format).
//
// Format:
//   data: {"type":"content_block_start",...}
//   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
//   data: {"type":"message_stop"}
export const LOGIC_CODE = `
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split('\\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const json = JSON.parse(payload);
      if (json.type === 'content_block_start' && json.content_block) {
        const cb = json.content_block;
        if (cb.type === 'thinking') blocks.push({ type: 'reasoning', text: '' });
        else if (cb.type === 'tool_use') blocks.push({ type: 'tool-call', toolCallId: 'tc_' + blocks.length, toolName: String(cb.name || ''), input: cb.input || {} });
        else if (cb.type === 'image' || cb.type === 'image_url') blocks.push({ type: 'file', mediaType: cb.source && cb.source.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', url: String((cb.source && cb.source.url) || cb.url || ''), filename: String(cb.alt || '') });
        else if (cb.type === 'text') blocks.push({ type: 'text', text: String(cb.text || '') });
      }
      if (json.type === 'content_block_delta' && json.delta) {
        const delta = json.delta;
        if (typeof delta.text === 'string') {
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'text') last.text += delta.text;
          else blocks.push({ type: 'text', text: delta.text });
        } else if (typeof delta.thinking === 'string') {
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'reasoning') last.text += delta.thinking;
          else blocks.push({ type: 'reasoning', text: delta.thinking });
        } else if (typeof delta.signature === 'string') {
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'reasoning') last.signature = delta.signature;
          else blocks.push({ type: 'meta', key: 'thinking_signature', value: delta.signature });
        }
      }
      if (json.type === 'content_block_stop' && json.index !== undefined) {
        const last = blocks[blocks.length - 1];
        if (last && last.type === 'text' && last.text.indexOf('<antArtifact') !== -1) {
          const match = last.text.match(/<antArtifact[^>]*identifier="([^"]*)"[^>]*type="([^"]*)"[^>]*title="([^"]*)"[^>]*>\\n?([\\s\\S]*?)\\n?<\\/antArtifact>/);
          if (match) {
            blocks.pop();
            blocks.push({ type: 'file', url: 'artifact://' + match[1], mediaType: match[2], filename: match[3], text: match[4] });
          }
        }
      }
      if (json.type === 'message_start' && json.message) blocks.push({ type: 'meta', key: 'message_id', value: json.message.id });
      if (json.type === 'message_stop' || json.type === 'error') {
        const last = blocks[blocks.length - 1];
        if (last && last.type !== 'meta') blocks.push({ type: 'meta', key: 'stopped', value: json.type });
      }
    } catch (_e) { /* skip unparseable lines */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: 'text', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes('message_stop') || String(rawBody).includes('[DONE]');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  const hasData = b.includes('data:');
  const hasContent = b.includes('content_block_delta') || b.includes('content_block_start');
  if (!hasData) return 0;
  if (!hasContent) return b.includes('message_stop') ? 0.7 : 0.3;
  return 1;
}
module.exports.default = { name: 'claude/001_streaming_sse', version: 2, providerId: 'claude', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
```

## seeds/parsers/harvested/chatgpt-openai-delta.ts

```ts
// seeds/parsers/harvested/chatgpt-openai-delta.ts
// ChatGPT / OpenAI streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Harvested from capabilit-lab GEMINI-CAPABILITIES-AND-STREAMING.md extractOpenAIBlock.
//
// Handles: OpenAI delta (choices[].delta.content), ChatGPT patch (o:'patch', v:[]),
// and ChatGPT parts (o:'add', v.message.content.parts[] | message.content.parts[]).
export const LOGIC_CODE = `
function extractOpenAIBlock(data) {
  const api = data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content;
  if (api !== undefined && api !== null) return { type: 'text', text: String(api) };
  if (data.o === 'patch' && Array.isArray(data.v)) {
    const parts = [];
    for (const patch of data.v) {
      if (patch && typeof patch === 'object' && typeof patch.p === 'string' && typeof patch.v === 'string') {
        if (patch.p.indexOf('/message/content/parts/') === 0 && (patch.o === 'append' || patch.o === 'add' || patch.o === 'replace')) parts.push(patch.v);
      }
    }
    if (parts.length > 0) return { type: 'text', text: parts.join('') };
  }
  if (data.o === 'add' && data.v && data.v.message && data.v.message.content && data.v.message.content.parts) {
    return fromParts(data.v.message.content.parts);
  }
  const cp = data.message && data.message.content && data.message.content.parts;
  if (Array.isArray(cp)) return fromParts(cp);
  if (data.type === 'tool_call' || data.type === 'function_call') {
    return { type: 'tool-call', toolCallId: String(data.id || 'tc_' + Date.now()), toolName: String(data.name || data.function?.name || 'code_interpreter'), input: data.arguments || data.function?.arguments || {} };
  }
  if (data.type === 'tool_output' || (data.name === 'code_interpreter' && data.output)) {
    return { type: 'tool-result', toolCallId: String(data.tool_call_id || ''), text: String(data.output || data.content || '') };
  }
  if (data.type === 'image_url' || (data.content_type && String(data.content_type).indexOf('image/') === 0)) {
    return { type: 'file', url: String(data.url || data.asset_pointer || ''), mediaType: String(data.content_type || 'image/png'), filename: String(data.name || '') };
  }
  return null;
}
function fromParts(parts) {
  const blocks = [];
  for (const p of parts) {
    if (typeof p === 'string') blocks.push({ type: 'text', text: p });
    else if (p && typeof p === 'object') {
      if ('asset_pointer' in p) blocks.push({ type: 'file', url: String(p.asset_pointer), mediaType: p.metadata && p.metadata.content_type ? String(p.metadata.content_type) : 'image/png', filename: String(p.name || '') });
      else if ('content_type' in p && String(p.content_type) === 'text') blocks.push({ type: 'text', text: String(p.text || '') });
      else if ('content' in p && typeof p.content === 'string') blocks.push({ type: 'text', text: p.content });
    }
  }
  if (blocks.length === 0) return null;
  return blocks.length === 1 ? blocks[0] : blocks;
}
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split('\\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const data = JSON.parse(payload);
      const block = extractOpenAIBlock(data);
      if (block) {
        if (Array.isArray(block)) blocks.push.apply(blocks, block);
        else blocks.push(block);
      }
    } catch (_e) { /* skip */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: 'text', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes('[DONE]') || String(rawBody).includes('"finish_reason"');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (!b.includes('data:')) return 0;
  if (b.includes('choices') && b.includes('delta')) return 1;
  if (b.includes('[DONE]')) return 0.7;
  return 0.3;
}
module.exports.default = { name: 'chatgpt/001_openai_delta', version: 1, providerId: 'chatgpt', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
```

## seeds/parsers/harvested/gemini-batchexecute.ts

```ts
// seeds/parsers/harvested/gemini-batchexecute.ts
// Gemini batchexecute streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Harvested from capabilit-lab GEMINI-CAPABILITIES-AND-STREAMING.md src/parsers/gemini.ts.
//
// Format: XSSI-prefixed batchexecute envelope of JSON arrays; text delta at
// inner[4][0][1] or fallback inner[3][0][0]; terminal frame starts with "e".
export const LOGIC_CODE = `
function safeJsonParse(s) { try { return JSON.parse(s); } catch (_e) { return s; } }
function decodeEnvelope(raw) {
  const frames = [];
  let text = String(raw);
  if (text.indexOf(")]}'\\n") === 0) text = text.slice(5);
  const lines = text.split('\\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^\\d+$/.test(t)) continue;
    if (t.charAt(0) !== '[') continue;
    try {
      const arr = JSON.parse(t);
      if (!Array.isArray(arr)) continue;
      let isTerminal = false;
      for (const child of arr) { if (Array.isArray(child) && child[0] === 'e') { isTerminal = true; break; } }
      for (const child of arr) {
        if (Array.isArray(child) && child[0] === 'wrb.fr') {
          frames.push({ rpc: String(child[1] || ''), payload: typeof child[2] === 'string' ? safeJsonParse(child[2]) : child[2], error: child[5] != null ? child[5] : null, isTerminal: isTerminal });
        }
      }
      if (isTerminal && frames.length === 0) frames.push({ rpc: '', payload: null, error: null, isTerminal: true });
    } catch (_e) { /* skip */ }
  }
  return frames;
}
function parseStreamChunk(frame) {
  const payload = frame.payload;
  if (!Array.isArray(payload)) return null;
  const candidate = payload[4] != null ? payload[4] : payload[3];
  const textArr = Array.isArray(candidate) ? candidate[0] : undefined;
  let deltaArr = Array.isArray(textArr) ? (textArr[1] != null ? textArr[1] : textArr[0]) : undefined;
  if (typeof deltaArr === 'undefined' && Array.isArray(textArr)) deltaArr = textArr[0];
  let textDelta = '';
  if (Array.isArray(deltaArr)) textDelta = deltaArr.filter(function (s) { return typeof s === 'string'; }).join('');
  else if (typeof deltaArr === 'string') textDelta = deltaArr;
  return textDelta ? { textDelta: textDelta } : null;
}
function extractGrounding(frame) {
  const payload = frame.payload;
  if (!Array.isArray(payload)) return [];
  const grounding = [];
  for (let i = 0; i < payload.length; i++) {
    const section = payload[i];
    if (!Array.isArray(section)) continue;
    for (const item of section) {
      if (!Array.isArray(item) || item.length < 2) continue;
      const entries = item[1];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (Array.isArray(entry) && entry.length >= 2 && typeof entry[0] === 'string' && entry[0].indexOf('http') === 0) {
          grounding.push({ type: 'link', url: entry[0], title: String(entry[1] || '') });
        } else if (entry && typeof entry === 'object' && entry.url) {
          grounding.push({ type: 'link', url: String(entry.url), title: String(entry.title || entry.name || '') });
        }
      }
    }
  }
  return grounding;
}
function parse(rawBody) {
  const blocks = [];
  const frames = decodeEnvelope(rawBody);
  for (const frame of frames) {
    if (frame.isTerminal) continue;
    if (frame.rpc) {
      const delta = parseStreamChunk(frame);
      if (delta && delta.textDelta) blocks.push({ type: 'text', text: delta.textDelta });
      else {
        const grounding = extractGrounding(frame);
        if (grounding.length > 0) {
          for (const g of grounding) blocks.push({ type: 'meta', key: 'grounding_link', value: g });
        } else {
          blocks.push({ type: 'meta', key: 'gemini_' + frame.rpc, value: frame.payload });
        }
      }
    }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: 'text', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  const b = String(rawBody);
  return b.includes('[["e"') || b.includes('"e"') || b.includes('"isTerminal":true');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (b.indexOf(')]}\\'') === 0 || b.includes('wrb.fr')) return 1;
  if (b.includes('[[')) return 0.6;
  return 0.2;
}
module.exports.default = { name: 'gemini/001_batchexecute', version: 2, providerId: 'gemini', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
```

## seeds/parsers/harvested/google-ai-studio.ts

```ts
// seeds/parsers/harvested/google-ai-studio.ts
// Google AI Studio streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Harvested from capabilit-lab GEMINI-CAPABILITIES-AND-STREAMING.md extractGoogleAIStudioBlock.
//
// Format: data.candidates[0].content.parts[0].text
export const LOGIC_CODE = `
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split('\\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const data = JSON.parse(payload);
      const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (text !== undefined && text !== null) blocks.push({ type: 'text', text: String(text) });
    } catch (_e) { /* skip */ }
  }
  if (blocks.length === 0 && rawBody.length > 0) blocks.push({ type: 'text', text: rawBody });
  return blocks;
}
function detectCompletion(rawBody) {
  return String(rawBody).includes('[DONE]') || String(rawBody).includes('"finishReason"');
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (!b.includes('data:')) return 0;
  if (b.includes('candidates') && b.includes('parts')) return 1;
  if (b.includes('[DONE]')) return 0.7;
  return 0.3;
}
module.exports.default = { name: 'gemini/002_ai_studio', version: 2, providerId: 'gemini', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
```

## seeds/parsers/harvested/deepseek-reasoning-sse.ts

```ts
// seeds/parsers/harvested/deepseek-reasoning-sse.ts
// DeepSeek R1 streaming parser — inline logic_code (DB-driven, sandbox-executed).
// Handles DeepSeek SSE format with reasoning_content / text deltas and <think> tags.

export const LOGIC_CODE = `
function parse(rawBody) {
  const blocks = [];
  const lines = String(rawBody).split('\\n');
  let currentReasoning = '';
  let currentText = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const data = JSON.parse(payload);
      const delta = data.choices && data.choices[0] && data.choices[0].delta;
      if (!delta) continue;

      if (delta.reasoning_content) {
        currentReasoning += delta.reasoning_content;
      }
      if (delta.content) {
        currentText += delta.content;
      }
    } catch (_e) { /* ignore non-json lines */ }
  }

  // Handle inline <think> tags if present in plain text
  if (!currentReasoning && currentText.includes('<think>')) {
    const thinkMatch = currentText.match(/<think>([\\s\\S]*?)(?:<\\/think>|$)/);
    if (thinkMatch && thinkMatch[1]) {
      currentReasoning = thinkMatch[1];
      currentText = currentText.replace(/<think>[\\s\\S]*?(?:<\\/think>|$)/, '');
    }
  }

  if (currentReasoning) {
    blocks.push({ type: 'reasoning', text: currentReasoning });
  }
  if (currentText) {
    blocks.push({ type: 'text', text: currentText });
  }

  if (blocks.length === 0 && rawBody.length > 0) {
    blocks.push({ type: 'text', text: rawBody });
  }
  return blocks;
}

function detectCompletion(rawBody) {
  return String(rawBody).includes('[DONE]') || String(rawBody).includes('"finish_reason":"stop"');
}

function getConfidence(rawBody) {
  const b = String(rawBody);
  if (b.includes('reasoning_content') || b.includes('<think>')) return 0.95;
  if (b.includes('data:') && b.includes('choices')) return 0.85;
  return 0.2;
}

exports.default = {
  name: 'deepseek/001_reasoning_sse',
  version: 1,
  providerId: 'deepseek',
  parse: parse,
  detectCompletion: detectCompletion,
  getConfidence: getConfidence
};
`
```

## seeds/parsers/harvested/generic-format-agnostic.ts

```ts
// seeds/parsers/harvested/generic-format-agnostic.ts
// Generic format-agnostic parser — inline logic_code (DB-driven, sandbox-executed).
// Terminal-of-chain fallback for every provider. Best-effort text extraction across
// SSE / Gemini-array / OpenAI / AI-Studio shapes; never throws.
export const LOGIC_CODE = `
function parse(rawBody) {
  const b = String(rawBody);
  const blocks = [];
  // SSE data: frames
  const lines = b.split('\\n');
  let sawSse = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    sawSse = true;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') continue;
    try {
      const data = JSON.parse(payload);
      const choices = data.choices && data.choices[0];
      const delta = choices && choices.delta && choices.delta.content;
      if (typeof delta === 'string' && delta) { blocks.push({ type: 'text', text: delta }); continue; }
      const parts = choices && choices.message && choices.message.content && choices.message.content.parts;
      if (Array.isArray(parts)) { blocks.push({ type: 'text', text: parts.join('') }); continue; }
      const studio = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (typeof studio === 'string' && studio) { blocks.push({ type: 'text', text: studio }); continue; }
    } catch (_e) { /* not JSON, leave to raw fallback */ }
  }
  // Gemini batchexecute array
  if (!blocks.length && b.indexOf('[[') === 0) {
    try {
      const arr = JSON.parse(b);
      const walk = function (node) {
        if (typeof node === 'string') blocks.push({ type: 'text', text: node });
        else if (Array.isArray(node)) node.forEach(walk);
      };
      walk(arr);
    } catch (_e) { /* leave to raw */ }
  }
  if (!blocks.length) blocks.push({ type: 'text', text: b });
  return blocks;
}
function detectCompletion(rawBody) {
  const b = String(rawBody);
  return b.includes('[DONE]') || b.includes('message_stop') || b.indexOf('[["e"') === 0;
}
function getConfidence(rawBody) {
  const b = String(rawBody);
  if (b.includes('choices') || b.includes('candidates') || b.includes('wrb.fr')) return 0.4;
  if (b.includes('data:') || b.includes('[[')) return 0.2;
  return 0.1;
}
module.exports.default = { name: 'generic/001_format_agnostic', version: 1, providerId: 'generic', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
```

## seeds/parsers/harvested/system-raw-text.ts

```ts
// seeds/parsers/harvested/system-raw-text.ts
// System last-resort parser — inline logic_code (DB-driven, sandbox-executed).
// Always succeeds: returns the raw body as a single text block. Never throws.
export const LOGIC_CODE = `
function parse(rawBody) {
  const b = String(rawBody);
  return b.length > 0 ? [{ type: 'text', text: b }] : [];
}
function detectCompletion() { return true; }
function getConfidence() { return 0.05; }
module.exports.default = { name: 'system/001_raw_text', version: 1, providerId: 'system', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };
`
```

## src/engines/stream-parser.ts

```ts
// src/engines/stream-parser.ts
// StreamParserEngine — parse raw provider responses into typed ContentBlock[] (04-merged-engines.md §3).
// All parser logic loaded from DB — engine is a loader/executor, not a parser repository.
// Fallback chain: provider → generic → system → error (all from DB).
//
// ContentBlock is the canonical ContentPart from schema/streaming.
// Legacy {kind,content,index} blocks from seed parsers are auto-migrated at the boundary.

import { EngineError } from '../errors.js'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import { ContentPartSchema, isLegacyBlock, migrateLegacyParts } from '../schema/streaming.js'

const log = getLogger('stream-parser')
import type { ContentPart } from '../schema/streaming.js'
import type { ParserExecutionLogStore } from '../storage/contracts/parser-execution-log-store.js'
import type { ParserStore, ProviderParserRow } from '../storage/contracts/parser-store.js'
import { repairLowConfidenceParser } from './parser-repair.js'
import { SandboxRunner } from './sandbox-runner.js'
import type { SandboxPermissions } from './sandbox-runner.js'

export type ContentBlock = ContentPart

export interface ParserModule {
  name: string
  version: number
  providerId: string
  parse(rawBody: string): ContentBlock[]
  detectCompletion(rawBody: string): boolean
  getConfidence(rawBody: string): number
}

/** Block-level classification counts for diagnostics. */
export interface BlockDiagnostics {
  textBlocks: number
  toolCallBlocks: number
  fileBlocks: number
  errorBlocks: number
  reasoningBlocks: number
  codeBlocks: number
  sourceBlocks: number
}

/** Wire format detection for diagnostics. */
export type WireFormat =
  | 'sse'
  | 'ndjson'
  | 'json-array'
  | 'batchexecute'
  | 'xssi'
  | 'plain-text'
  | 'unknown'

export interface ParseResult {
  blocks: ContentBlock[]
  confidence: number
  parserName: string
  parserVersion: number
  durationMs: number
  /** Block-level classification counts. */
  blockDiagnostics: BlockDiagnostics
  /** Detected wire format of the raw input. */
  wireFormat: WireFormat
  /** Number of fallback parsers tried before success. */
  fallbackDepth: number
  /** Size of the raw input in bytes. */
  rawSizeBytes: number
}

export interface ParserConfig {
  fallbackTimeoutMs: number
  maxRetries: number
  confidenceMinThreshold: number
  preloadProviders?: string[]
  /**
   * When false (default), the engine NEVER executes parser logic loaded from a
   * file on disk — only DB-stored `inline`/`composed` logic is executed. This
   * enforces the architectural rule that parsing logic lives in the DB, and
   * code only executes it by need. Set true only for trusted, out-of-band
   * file-based parser loading (e.g. local dev).
   */
  allowFileLogic?: boolean
}

function errorBlock(_providerId: string, message: string): ContentBlock[] {
  return [{ type: 'error', message, code: 'PARSE_FAILED' }]
}

// ── Diagnostic helpers ────────────────────────────────────────────────────

function classifyBlocks(blocks: ContentBlock[]): BlockDiagnostics {
  const diag: BlockDiagnostics = {
    textBlocks: 0,
    toolCallBlocks: 0,
    fileBlocks: 0,
    errorBlocks: 0,
    reasoningBlocks: 0,
    codeBlocks: 0,
    sourceBlocks: 0,
  }
  for (const b of blocks) {
    switch (b.type) {
      case 'text':
        diag.textBlocks++
        break
      case 'tool-call':
        diag.toolCallBlocks++
        break
      case 'file':
        diag.fileBlocks++
        break
      case 'error':
        diag.errorBlocks++
        break
      case 'reasoning':
        diag.reasoningBlocks++
        break
      case 'code':
        diag.codeBlocks++
        break
      case 'source':
        diag.sourceBlocks++
        break
    }
  }
  return diag
}

function detectWireFormat(raw: string): WireFormat {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith('data:') || trimmed.includes('\n\n')) {
    if (trimmed.includes('data:')) return 'sse'
  }
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) return 'json-array'
    } catch (e) {
      catchDebug(e, 'stream-parser: JSON detection partial')
    }
  }
  if (trimmed.includes(")]}'") || trimmed.startsWith(')]}')) return 'xssi'
  if (trimmed.includes('$rpc')) return 'batchexecute'
  const lines = trimmed.split('\n').filter((l) => l.trim())
  if (
    lines.length > 0 &&
    lines.every((l) => {
      try {
        JSON.parse(l)
        return true
      } catch (e) {
        catchDebug(e, 'stream-parser: JSON detection failed')
        return false
      }
    })
  )
    return 'ndjson'
  if (lines.some((l) => l.startsWith('data:') || l.startsWith('event:'))) return 'sse'
  return 'plain-text'
}

// ── Legacy migration helper ───────────────────────────────────────────────
// Detects old {kind,content,index} blocks from seed parsers and converts them
// to canonical {type,text,...} ContentPart. Runs as a pass over parser output.

function normalizeBlocks(blocks: ContentBlock[]): ContentBlock[] {
  if (blocks.length === 0) return blocks
  if (isLegacyBlock(blocks[0])) {
    return migrateLegacyParts(blocks as unknown as Parameters<typeof migrateLegacyParts>[0])
  }
  return validateBlocks(blocks)
}

/**
 * Enforce the unified ContentPart contract at the parser boundary. A parser
 * (DB-inline or protocol-primed) may emit malformed parts; we drop them here
 * rather than letting bad shapes reach the ContentUnit decomposition / DB layer.
 * Returns only schema-valid parts and logs a warning for any rejected ones.
 */
function validateBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const valid: ContentBlock[] = []
  let rejected = 0
  for (const block of blocks) {
    const result = ContentPartSchema.safeParse(block)
    if (result.success) {
      valid.push(result.data as ContentBlock)
    } else {
      rejected++
    }
  }
  if (rejected > 0) {
    log.warn(`[stream-parser] rejected ${rejected} schema-invalid block(s) at boundary`)
  }
  return valid
}

export class StreamParserEngine {
  private parserCache = new Map<string, { module: ParserModule; hash: string }>()
  private inlineCache = new Map<string, ParserModule>()
  /**
   * Provider-prime cache: compiled modules from the generated protocol, keyed by
   * `${providerId}/${parserName}`. When populated by `primeFromProtocol()`, the
   * hot parse path reads ONLY from here and performs ZERO DB queries. The DB
   * fallback chain in `resolveFallbackChain()` remains as a runtime safety net.
   */
  private primedParsers = new Map<string, ParserModule>()

  // Hardened execution environment for inline parser code (Unit 31.1). When
  // present, inline parser logic is compiled inside a frozen vm context with a
  // CPU/memory budget and an audit row — replacing the raw `new Function` path.
  private static readonly SANDBOX_PERMISSIONS: SandboxPermissions = {
    canFetch: [],
    canReadFile: [],
    canWriteFile: [],
    canUseClipboard: false,
  }

  constructor(
    private store: ParserStore,
    private config?: ParserConfig,
    private sandbox?: SandboxRunner,
    private logStore?: ParserExecutionLogStore,
  ) {}

  async parse(rawBody: string, providerId: string): Promise<ParseResult> {
    const start = Date.now()

    // Fast path: if primed from the generated protocol, parse with zero DB reads.
    const primed = this.resolvePrimed(providerId, rawBody)
    if (primed) {
      const module = primed
      const blocks = normalizeBlocks(module.parse(rawBody))
      const confidence =
        typeof module.getConfidence === 'function' ? module.getConfidence(rawBody) : 0.5
      const result: ParseResult = {
        blocks,
        confidence,
        parserName: module.name,
        parserVersion: module.version,
        durationMs: Date.now() - start,
        blockDiagnostics: classifyBlocks(blocks),
        wireFormat: detectWireFormat(rawBody),
        fallbackDepth: 0,
        rawSizeBytes: rawBody.length,
      }
      this.logParseResult(result, providerId)
      return result
    }

    // Walk the DB-driven fallback graph (provider → fallbackParserId → …) until
    // one parser succeeds. No hardcoded tiers: the chain is entirely data.
    const chain = await this.resolveFallbackChain(providerId)
    let module: ParserModule | null = null
    let blocks: ContentBlock[] = []

    for (const row of chain) {
      try {
        module = await this.loadModuleFromRow(row)
        blocks = normalizeBlocks(module.parse(rawBody))
        break
      } catch (e) {
        catchDebug(e, 'stream-parser: module load failed')
        module = null
      }
    }

    if (!module) {
      blocks = errorBlock(providerId, 'all parsers failed — check provider_parser table')
      module = {
        name: 'error',
        version: 0,
        providerId,
        parse: () => blocks,
        detectCompletion: () => true,
        getConfidence: () => 0,
      }
    }

    const confidence =
      typeof module.getConfidence === 'function' ? module.getConfidence(rawBody) : 0.5

    const result: ParseResult = {
      blocks,
      confidence,
      parserName: module.name,
      parserVersion: module.version,
      durationMs: Date.now() - start,
      blockDiagnostics: classifyBlocks(blocks),
      wireFormat: detectWireFormat(rawBody),
      fallbackDepth: Math.max(0, chain.length - 1),
      rawSizeBytes: rawBody.length,
    }
    this.logParseResult(result, providerId)

    // Auto-repair: when confidence drops below threshold or the system fallback
    // was used, asynchronously regenerate an inline parser and persist it to DB.
    // The fire-and-forget pattern avoids blocking the parse path; the next parse
    // call will pick up the repaired parser via the cache or fallback chain.
    const threshold = this.config?.confidenceMinThreshold ?? 0.7
    if (result.confidence < threshold && this.store) {
      void repairLowConfidenceParser(this, this.store, providerId, rawBody, {
        minConfidence: threshold,
      })
        .then((report) => {
          if (report.repaired) {
            log.info(
              `[stream-parser] auto-repaired parser for ${providerId}: ${report.beforeConfidence.toFixed(3)} → ${report.afterConfidence.toFixed(3)}`,
            )
          }
        })
        .catch((err: unknown) => {
          log.warn(`[stream-parser] auto-repair failed for ${providerId}: ${String(err)}`)
        })
    }

    return result
  }

  async detectCompletion(rawBody: string, providerId: string): Promise<boolean> {
    const primed = this.resolvePrimed(providerId, rawBody)
    if (primed) return primed.detectCompletion(rawBody)

    const chain = await this.resolveFallbackChain(providerId)
    for (const row of chain) {
      try {
        const module = await this.loadModuleFromRow(row)
        return module.detectCompletion(rawBody)
      } catch (e) {
        catchDebug(e, 'stream-parser: detectCompletion failed, trying next')
      }
    }
    return true
  }

  /**
   * Resolve a parser module from the protocol-primed cache. Splits an optional
   * `@version` suffix and walks the provider's primed parsers (no DB access).
   * Returns null when the provider was not primed, falling back to the DB chain.
   */
  private resolvePrimed(
    providerId: string,
    rawBodyForSelection: string | null = null,
  ): ParserModule | null {
    if (this.primedParsers.size === 0) return null
    const [baseId, version] = providerId.split('@')
    const entries = [...this.primedParsers.entries()].filter(
      ([k]) => k === `${baseId}/` || k.startsWith(`${baseId}/`),
    )
    if (entries.length === 0) return null
    if (version) {
      const exact = this.primedParsers.get(`${baseId}/${version}`)
      if (exact) return exact
    }
    // Score every candidate parser against the actual payload and pick the
    // highest-confidence one. A blind "highest version wins" pick is wrong
    // when a provider serves multiple wire formats (e.g. gemini: batchexecute
    // RPC vs Google AI Studio SSE) — the chosen parser must understand
    // the bytes it is given, not just be the newest. Falls back to the
    // highest version when no parser reports a usable confidence.
    if (rawBodyForSelection != null) {
      let best: ParserModule | null = null
      let bestC = -1
      for (const [, mod] of entries) {
        const c =
          typeof mod.getConfidence === 'function' ? mod.getConfidence(rawBodyForSelection) : 0
        if (c > bestC) {
          bestC = c
          best = mod
        }
      }
      if (best && bestC > 0) return best
    }
    let best: ParserModule | null = null
    let bestV = -1
    for (const [, mod] of entries) {
      if (mod.version > bestV) {
        bestV = mod.version
        best = mod
      }
    }
    return best
  }

  /**
   * Resolve the chain of parser rows to try, walking the `fallbackParserId`
   * edge from the by-need resolved provider parser. `providerId` may carry an
   * `@version` suffix (e.g. `claude@2`) for semver-aware selection; `@latest`
   * or no suffix picks the highest active version.
   *
   * Guards against cycles via a visited-set. Terminal parsers (no fallback
   * edge) end the chain. This replaces the previous hardcoded
   * provider→generic→system ordering.
   */
  private async resolveFallbackChain(providerId: string): Promise<ProviderParserRow[]> {
    const atIdx = providerId.indexOf('@')
    const baseId = atIdx >= 0 ? providerId.slice(0, atIdx) : providerId
    const version = atIdx >= 0 ? providerId.slice(atIdx + 1) : 'latest'
    let start = await this.store.getParserByProviderAndVersion(baseId, version)

    // No provider-specific parser? Fall back to the generic parser so unknown
    // providers still get best-effort parsing instead of an immediate error.
    if (!start && baseId !== 'generic') {
      start = await this.store.getParserByProviderAndVersion('generic', 'latest')
    }
    if (!start) return []

    const chain: ProviderParserRow[] = []
    const visited = new Set<string>()
    let cursor: ProviderParserRow | null = start
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id)
      chain.push(cursor)
      if (!cursor.fallbackParserId) break
      cursor = await this.store.getParserById(cursor.fallbackParserId)
    }
    return chain
  }

  async reloadParser(providerId: string): Promise<void> {
    const atIdx = providerId.indexOf('@')
    const baseId = atIdx >= 0 ? providerId.slice(0, atIdx) : providerId
    const version = atIdx >= 0 ? providerId.slice(atIdx + 1) : 'latest'
    const row = await this.store.getParserByProviderAndVersion(baseId, version)
    if (row) this.parserCache.delete(row.id)
  }

  async preloadAll(): Promise<void> {
    for (const providerId of this.config?.preloadProviders ?? []) {
      try {
        const row = await this.store.getParserByProviderAndVersion(providerId, 'latest')
        if (row) await this.loadModuleFromRow(row)
      } catch (e) {
        catchDebug(e, 'stream-parser: parser load deferred')
      }
    }
  }

  /**
   * Prime the parser cache from the generated protocol's inline logic_code, so
   * the hot parse path performs ZERO DB reads. The DB-backed fallback chain
   * (resolveFallbackChain) remains as a runtime safety net if a protocol-derived
   * module is missing or fails to compile. Compiled modules are keyed by their
   * parser hash; the generated protocol carries the same hash the DB row has.
   */
  async primeFromProtocol(protocol: {
    providers: Array<{
      slug: string
      parsers: Array<{
        name: string
        version: number
        logicCode: string
        hash: string
        isActive: boolean
      }>
    }>
  }): Promise<void> {
    for (const p of protocol.providers) {
      for (const pr of p.parsers) {
        if (!pr.isActive || !pr.logicCode) continue
        try {
          const module = await this.loadInlineParser(pr.logicCode, pr.hash)
          // Tag so resolvePrimed() can pick by version + fallback to highest.
          const tagged: ParserModule = {
            ...module,
            name: pr.name,
            version: pr.version,
            providerId: p.slug,
          }
          this.primedParsers.set(`${p.slug}/${pr.version}`, tagged)
          this.primedParsers.set(`${p.slug}/${pr.name.split('/')[1] ?? pr.version}`, tagged)
        } catch (err) {
          catchDebug(err, 'engines:stream-parser:471')
          // non-fatal: DB chain resolves it lazily on parse()
        }
      }
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async loadModuleFromRow(row: ProviderParserRow): Promise<ParserModule> {
    const cached = this.parserCache.get(row.id)
    if (cached && cached.hash === row.hash) return cached.module

    let module: ParserModule

    if (row.logicType === 'inline' && row.logicCode) {
      module = await this.loadInlineParser(row.logicCode, row.hash)
    } else if (row.logicType === 'file' && row.filePath) {
      // File-based parser loading is gated: off by default so the engine only
      // ever executes DB-stored logic. See ParserConfig.allowFileLogic.
      if (!this.config?.allowFileLogic) {
        throw new EngineError(
          `Parser '${row.name}' uses file logic but allowFileLogic is false — parsing logic must live in the DB`,
        )
      }
      module = await this.loadFileParser(row.filePath)
    } else {
      throw new EngineError(`Parser '${row.name}' has no logic (logicType=${row.logicType})`)
    }

    this.parserCache.set(row.id, { module, hash: row.hash })
    return module
  }

  private async loadInlineParser(code: string, hash: string): Promise<ParserModule> {
    const cached = this.inlineCache.get(hash)
    if (cached) return cached

    const mod = { exports: {} as Record<string, unknown> }

    if (!this.sandbox) {
      this.sandbox = new SandboxRunner({
        create: async () => {},
        list: async () => [],
      })
    }

    const res = await this.sandbox.run(code, {}, StreamParserEngine.SANDBOX_PERMISSIONS, {
      handlerSlug: `parser:${hash}`,
      globals: { module: mod, exports: mod.exports },
    })
    if (!res.ok) {
      throw new EngineError(
        `Failed to compile inline parser in sandbox: ${res.error ?? 'unknown sandbox error'}`,
      )
    }

    const candidate = (mod.exports.default ?? mod.exports) as Partial<ParserModule>
    if (typeof candidate.parse !== 'function') {
      throw new EngineError('Inline parser has no parse() method')
    }

    const module = candidate as ParserModule
    this.inlineCache.set(hash, module)
    return module
  }

  private async loadFileParser(filePath: string): Promise<ParserModule> {
    const imported = await import(filePath)
    const candidate = (imported.default ?? imported) as Partial<ParserModule>
    if (typeof candidate.parse !== 'function') {
      throw new EngineError(`Parser at ${filePath} has no parse() method`)
    }
    return candidate as ParserModule
  }

  /**
   * Best-effort diagnostic logging. Failures are swallowed — logging must never
   * break the parse path. When logStore is absent (default), this is a no-op.
   */
  private logParseResult(result: ParseResult, providerId: string): void {
    if (!this.logStore) return
    const d = result.blockDiagnostics
    void this.logStore
      .logExecution({
        providerId,
        parserName: result.parserName,
        parserVersion: result.parserVersion,
        conversationId: null,
        messageId: null,
        confidence: result.confidence,
        blockCount: result.blocks.length,
        textBlocks: d.textBlocks,
        toolCallBlocks: d.toolCallBlocks,
        fileBlocks: d.fileBlocks,
        errorBlocks: d.errorBlocks,
        durationMs: result.durationMs,
        rawSizeBytes: result.rawSizeBytes,
        wireFormat: result.wireFormat,
        fallbackUsed: result.fallbackDepth > 0 ? 1 : 0,
        metadataJson: JSON.stringify({
          reasoningBlocks: d.reasoningBlocks,
          codeBlocks: d.codeBlocks,
          sourceBlocks: d.sourceBlocks,
          fallbackDepth: result.fallbackDepth,
        }),
      })
      .catch(() => {}) // swallow — diagnostic logging is best-effort
  // [audit] log the error with context here
  }
}
```

## src/engines/stream-align.ts

```ts
// src/engines/stream-align.ts
// StreamAlignmentEngine — Phase 23.1
// Aligns a *captured* provider stream against the DB-driven StreamParserEngine.
// Answers: does the parser we have actually parse what the provider streams?
// Infers the real wire format, detects the response delta path, validates a
// configured delta path (unit 2.16), and autocomputes parser hashes (unit 2.15).

import { createHash } from 'node:crypto'
import { EngineError } from '../errors.js'
import { catchDebug } from '../lib/catch-logger.js'
import type { StreamParserEngine } from './stream-parser.js'

export type StreamFormat = 'sse' | 'json' | 'html' | 'websocket' | 'custom'

export interface AlignmentReport {
  providerId: string
  sampleCount: number
  parserName: string | null
  parserConfiguredFormat: StreamFormat | null
  inferredFormat: StreamFormat
  confidence: number
  blockCount: number
  textBlocks: number
  detectedDeltaPath: string | null
  streamFieldCandidates: string[]
  mismatches: string[]
  suggestions: string[]
  ok: boolean
}

export interface DeltaPathValidation {
  valid: boolean
  resolvedValue: unknown
  error?: string
}

// Candidate response delta paths, most common first.
const DELTA_PATH_CANDIDATES = [
  'choices[0].delta.content',
  'choices[0].message.content',
  'choices[0].text',
  'delta.content',
  'message.content',
  'content',
  'text',
  'data.content',
  'data.text',
  'outputs[0].text',
  'response',
]

function getAtPath(root: unknown, path: string): unknown {
  let cur: unknown = root
  for (const token of path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)) {
    if (cur == null) return undefined
    if (Array.isArray(cur)) {
      const idx = Number(token)
      cur = Number.isNaN(idx) ? undefined : cur[idx]
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[token]
    } else {
      return undefined
    }
  }
  return cur
}

export class StreamAlignmentEngine {
  constructor(private readonly streamParser: StreamParserEngine) {}

  /**
   * Align a set of captured raw stream bodies against the active parser for
   * `providerId`. Produces a report the CLI can print and the discovery runner
   * can persist.
   */
  async alignCaptured(
    bodies: string[],
    providerId: string,
    configuredFormat?: StreamFormat | null,
  ): Promise<AlignmentReport> {
    const samples = bodies.filter((b) => b && b.trim().length > 0)
    if (samples.length === 0) {
      return {
        providerId,
        sampleCount: 0,
        parserName: null,
        parserConfiguredFormat: configuredFormat ?? null,
        inferredFormat: 'custom',
        confidence: 0,
        blockCount: 0,
        textBlocks: 0,
        detectedDeltaPath: null,
        streamFieldCandidates: [],
        mismatches: [
          'No stream body was captured — interaction may not have triggered a response.',
        ],
        suggestions: [
          'Verify the composer selector and send action; increase the capture timeout.',
        ],
        ok: false,
      }
    }

    let parserName: string | null = null
    let totalConfidence = 0
    let blockCount = 0
    let textBlocks = 0

    for (const body of samples) {
      const result = await this.streamParser.parse(body, providerId)
      parserName ??= result.parserName
      totalConfidence += result.confidence
      blockCount += result.blocks.length
      for (const b of result.blocks) {
        if (b.type === 'text' || b.type === 'code' || b.type === 'reasoning') textBlocks++
      }
    }

    const inferredFormat = samples[0] ? this.inferFormat(samples[0]) : 'custom'
    const jsonSample = samples[0] ? this.extractJsonSample(samples[0]) : null
    const { path: detectedDeltaPath, candidates: streamFieldCandidates } =
      this.detectDeltaPath(jsonSample)

    const mismatches: string[] = []
    const suggestions: string[] = []

    if (configuredFormat && configuredFormat !== inferredFormat) {
      mismatches.push(
        `Configured format '${configuredFormat}' does not match inferred wire format '${inferredFormat}'.`,
      )
      suggestions.push(
        `Set ProviderStreamConfig.streamTransport to '${inferredFormat}' (or update the parser).`,
      )
    }

    if (textBlocks === 0) {
      mismatches.push('Parser produced zero text/code blocks from the captured stream.')
      suggestions.push(
        detectedDeltaPath
          ? `Wire the parser to deltaPath '${detectedDeltaPath}'.`
          : 'No delta path detected — verify the provider uses SSE/JSON delta streaming.',
      )
    }

    if (inferredFormat !== 'html' && !detectedDeltaPath) {
      mismatches.push('Could not locate a response delta path in the captured JSON.')
      suggestions.push(
        'Inspect the captured body and set an explicit deltaPath in ProviderStreamConfig.',
      )
    }

    return {
      providerId,
      sampleCount: samples.length,
      parserName,
      parserConfiguredFormat: configuredFormat ?? null,
      inferredFormat,
      confidence: totalConfidence / samples.length,
      blockCount,
      textBlocks,
      detectedDeltaPath,
      streamFieldCandidates,
      mismatches,
      suggestions,
      ok: mismatches.length === 0,
    }
  }

  /** Infer the wire format of a raw captured body. */
  inferFormat(body: string): StreamFormat {
    const trimmed = body.trim()
    if (/^(data:\s*)/m.test(trimmed) || /^data:\s*\[DONE\]/m.test(trimmed)) return 'sse'
    if (/event:\s*\w+/m.test(trimmed) && /data:/m.test(trimmed)) return 'sse'
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed)
        return 'json'
      } catch (err) {
        catchDebug(err, 'engines:stream-align:180')
        /* fall through */
      }
    }
    if (/<[a-z][\s\S]*>/i.test(trimmed)) return 'html'
    return 'custom'
  }

  /**
   * Detect the response delta path from a JSON sample. Tries the well-known
   * candidates and returns the first that resolves to a non-empty string, plus
   * every candidate that resolves at all (for suggestions).
   */
  detectDeltaPath(jsonSample: string | null): { path: string | null; candidates: string[] } {
    if (!jsonSample) return { path: null, candidates: [] }
    let root: unknown
    try {
      root = JSON.parse(jsonSample)
    } catch {
      return { path: null, candidates: [] }
    }

    const candidates: string[] = []
    for (const candidate of DELTA_PATH_CANDIDATES) {
      const value = getAtPath(root, candidate)
      if (typeof value === 'string' && value.length > 0) {
        candidates.push(candidate)
      }
    }
    return { path: candidates[0] ?? null, candidates }
  }

  /**
   * Unit 2.16 — validate that a configured delta path resolves against a sample
   * of the provider's streamed JSON.
   */
  validateDeltaPath(deltaPath: string, sampleJson: string): DeltaPathValidation {
    let root: unknown
    try {
      root = JSON.parse(sampleJson)
    } catch (err) {
      return {
        valid: false,
        resolvedValue: undefined,
        error: `Sample is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
    const value = getAtPath(root, deltaPath)
    if (value === undefined) {
      return {
        valid: false,
        resolvedValue: undefined,
        error: `Path '${deltaPath}' did not resolve.`,
      }
    }
    if (typeof value === 'string' && value.length === 0) {
      return {
        valid: false,
        resolvedValue: value,
        error: `Path '${deltaPath}' resolved to an empty string.`,
      }
    }
    return { valid: true, resolvedValue: value }
  }

  /**
   * Unit 2.15 — deterministic content hash for a parser's source/logic. Used to
   * autocompute `provider_parser.parser_hash` so the StreamParserEngine cache and
   * the registrar stay in sync without manual hashes.
   */
  computeParserHash(source: string): string {
    if (!source) throw new EngineError('computeParserHash: source must be non-empty')
    return createHash('sha256').update(source).digest('hex')
  }

  // ── Standalone helper (for import by registrar) ────────────────────────
  static computeParserHash(source: string): string {
    if (!source) throw new EngineError('computeParserHash: source must be non-empty')
    return createHash('sha256').update(source).digest('hex')
  }

  // ── private ─────────────────────────────────────────────────────────────

  private extractJsonSample(body: string): string | null {
    const format = this.inferFormat(body)
    if (format === 'json') return body.trim()
    if (format === 'sse') {
      // Grab the first `data:` line that is valid JSON (skip [DONE]).
      for (const line of body.split('\n')) {
        const m = line.match(/^data:\s*(.*)$/)
        const payload = m?.[1]?.trim()
        if (!payload || payload === '[DONE]') continue
        try {
          JSON.parse(payload)
          return payload
        } catch (err) {
          catchDebug(err, 'engines:stream-align:275')
          /* try next line */
        }
      }
    }
    return null
  }
}
```

## src/engines/provider-registrar.ts

```ts
// src/engines/provider-registrar.ts
// Seeds provider intel from the canonical in-repo manifests (seeds/providers/manifests.ts)
// into the DB. Handles atomic multi-table inserts. Can reload all providers or a single provider.
// The generator (provider-protocol-generator.ts) then reads the DB into a static file.

import { resolve } from 'node:path'
import { PROVIDER_MANIFESTS } from '../../seeds/providers/manifests.js'
import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import { type ProviderManifest, ProviderManifestSchema } from '../schema/provider-manifest.js'
import type {
  ProviderCapabilityRow,
  ProviderConfigRow,
  ProviderDefinitionRow,
  ProviderEndpointRow,
  ProviderModelRow,
  ProviderParserRow,
} from '../schema/types.js'
import type { ProviderStore } from '../storage/contracts/provider-store.js'
import { StreamAlignmentEngine } from './stream-align.js'

// ── Lightweight event bus interface (avoids circular dep on CapabilityEventBus) ──

export interface ProviderRegistrarEventBus {
  emit(event: { type: string; [key: string]: unknown }): void
}

// ── Result types ────────────────────────────────────────────────────────────────

export interface RegisterResult {
  providerId: string
  slug: string
  status: 'created' | 'updated' | 'unchanged'
  tablesAffected: string[]
  rowsAdded: number
  rowsModified: number
}

export interface SeedAllResult {
  seeded: RegisterResult[]
  skipped: string[]
  errors: Array<{ file: string; error: string }>
}

export interface VerifyResult {
  valid: boolean
  providers: Array<{
    slug: string
    status: 'ok' | 'missing_file' | 'parse_error' | 'schema_mismatch'
    details: string
  }>
}

// ── Auditor interface (avoids circular dep on RegistrationAuditor) ───────────────

export interface ProviderRegistrarAuditor {
  registerAndAudit(manifest: ProviderManifest): Promise<void>
}

// ── ProviderRegistrar ───────────────────────────────────────────────────────────

export class ProviderRegistrar {
  private readonly seedsDir: string

  constructor(
    private store: ProviderStore,
    private auditor?: ProviderRegistrarAuditor,
    private eventBus?: ProviderRegistrarEventBus,
    seedsDir?: string,
  ) {
    this.seedsDir = seedsDir ?? resolve(import.meta.dir, '../../seeds/providers')
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async register(manifest: ProviderManifest): Promise<RegisterResult> {
    const now = Date.now()
    const tablesAffected: string[] = []
    let rowsAdded = 0
    let rowsModified = 0

    // Determine if provider exists
    const existing = await this.store.getDefinitionBySlug(manifest.provider.slug)
    const status = existing ? 'updated' : 'created'
    // Use the slug as the stable provider id so the entire API surface (which addresses
    // providers by slug, e.g. /api/providers/claude/*) aligns with the DB primary key.
    // This removes the slug<->ULID mismatch that broke account/conversation creation.
    const providerId = manifest.provider.slug

    // [1] Upsert provider_definition
    const accessTier = manifest.provider.accessTier ?? 'free'
    const isActive = accessTier === 'free' ? 1 : 0
    const protocolStatus = accessTier === 'free' ? 'Active' : 'Locked'
    const defRow: ProviderDefinitionRow = {
      id: providerId,
      slug: manifest.provider.slug,
      display_name: manifest.provider.display_name,
      description: manifest.provider.description ?? null,
      category: manifest.provider.category,
      provider_type: manifest.provider.provider_type,
      is_active: isActive,
      protocol_status: protocolStatus,
      website_url: manifest.provider.website_url ?? null,
      documentation_url: manifest.provider.documentation_url ?? null,
      auth_type: manifest.provider.auth_type,
      has_multi_account: manifest.provider.has_multi_account ? 1 : 0,
      profile_strategy: manifest.provider.profile_strategy,
      fleet_config_json: JSON.stringify(manifest.provider.fleet_config ?? {}),
      capabilities_json: JSON.stringify(manifest.provider.capabilities),
      models_json: JSON.stringify([]),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    await this.store.upsertDefinition(defRow)
    tablesAffected.push('provider_definition')
    if (existing) rowsModified++
    else rowsAdded++

    // [2] Delete old endpoints → Upsert new endpoints
    await this.store.deleteProviderEndpoints(providerId)
    for (const ep of manifest.endpoints) {
      const epRow: ProviderEndpointRow = {
        id: newId(),
        provider_id: providerId,
        url: ep.url,
        label: ep.label,
        endpoint_type: ep.endpoint_type,
        is_default: ep.is_default ? 1 : 0,
        selectors_json: JSON.stringify(ep.selector ?? {}),
        composer_type: ep.composer_type ?? 'textarea',
        send_method: ep.send_method ?? 'both',
        content_editable: ep.content_editable ? 1 : 0,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertEndpoint(epRow)
      rowsAdded++
    }
    if (manifest.endpoints.length > 0) tablesAffected.push('provider_endpoint')

    // [3] Delete old parsers → Upsert new parsers
    // Two-pass: (1) insert every parser with null fallback, recording name→id;
    // (2) patch fallback_parser_id from each parser's `fallback` reference so
    // the DB parser graph reflects the manifest's fallback chain (019).
    await this.store.deleteProviderParsers(providerId)
    const parserNameToId = new Map<string, string>()
    for (const parser of manifest.parsers) {
      const logicType = parser.logic_type ?? 'inline'
      if (logicType === 'inline' && !parser.logic_code) {
        throw new EngineError(
          `Provider ${manifest.provider.slug} parser '${parser.name}': inline logic_type requires logic_code`,
        )
      }
      const parserId = newId()
      const parserRow: ProviderParserRow = {
        id: parserId,
        provider_id: providerId,
        parser_name: parser.name,
        parser_version: parser.version,
        parser_logic_type: logicType,
        parser_file_path: parser.file ?? null,
        parser_logic_code: parser.logic_code ?? null,
        // Unit 2.15 — autocompute a stable hash so the parser cache stays in sync.
        parser_hash: StreamAlignmentEngine.computeParserHash(
          parser.logic_code ?? parser.file ?? `${parser.name}:${parser.version}`,
        ),
        sample_body: parser.sample_body ?? null,
        is_active: parser.is_active ? 1 : 0,
        fallback_parser_id: null,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertParser(parserRow)
      parserNameToId.set(parser.name, parserId)
      rowsAdded++
    }
    // Patch fallback references now that all parser ids are known.
    for (const parser of manifest.parsers) {
      if (
        parser.fallback &&
        parserNameToId.has(parser.name) &&
        parserNameToId.has(parser.fallback)
      ) {
        const fromId = parserNameToId.get(parser.name)
        const fallbackId = parserNameToId.get(parser.fallback)
        if (fromId && fallbackId) {
          await this.store.setParserFallback(fromId, fallbackId)
        }
      }
    }
    if (manifest.parsers.length > 0) tablesAffected.push('provider_parser')

    // [4] Delete old capabilities → Upsert new capabilities
    await this.store.deleteProviderCapabilities(providerId)
    for (const cap of manifest.capabilities_config) {
      const capRow: ProviderCapabilityRow = {
        id: newId(),
        provider_id: providerId,
        global_capability_id: cap.global_capability_id,
        recovery_strategies_json: JSON.stringify(cap.recovery_strategies ?? []),
        ui_component_override: cap.ui_component_override ?? null,
        ui_label_override: cap.ui_label_override ?? null,
        ui_icon_override: cap.ui_icon_override ?? null,
        ui_position_override: cap.ui_position_override ?? null,
        ui_order_override: cap.ui_order_override ?? null,
        ui_group_override: cap.ui_group_override ?? null,
        ui_priority_override: cap.ui_priority_override ?? null,
        interaction_mode_override: cap.interaction_mode_override ?? null,
        ui_states_override_json: cap.ui_states_override
          ? JSON.stringify(cap.ui_states_override)
          : null,
        ui_visibility_rule_override: cap.ui_visibility_rule_override ?? null,
        existential_rule_override: cap.existential_rule_override ?? null,
        ui_input_schema_override: cap.ui_input_schema_override
          ? JSON.stringify(cap.ui_input_schema_override)
          : null,
        mutation_effects_override_json: cap.mutation_effects_override
          ? JSON.stringify(cap.mutation_effects_override)
          : null,
        recovery_behavior_override: cap.recovery_behavior_override ?? null,
        state_persistence_override: cap.state_persistence_override ?? null,
        data_flow_override: cap.data_flow_override ?? null,
        min_plan_tier_override: cap.min_plan_tier_override ?? null,
        depends_on_override_json: cap.depends_on_override
          ? JSON.stringify(cap.depends_on_override)
          : null,
        confidence: 1.0,
        success_count: 0,
        fail_count: 0,
        consecutive_failures: 0,
        avg_latency_ms: 0,
        p95_latency_ms: 0,
        last_used_at: null,
        selector_hit_count: 0,
        selector_miss_count: 0,
        selector_last_miss_at: null,
        selector_last_error: null,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertCapability(capRow)
      rowsAdded++
    }
    if (manifest.capabilities_config.length > 0) tablesAffected.push('provider_capability')

    // [5] Delete old configs → Upsert new configs
    await this.store.deleteProviderConfigs(providerId)
    for (const cfg of manifest.config) {
      const cfgRow: ProviderConfigRow = {
        id: newId(),
        provider_id: providerId,
        config_key: cfg.key,
        config_value: cfg.value,
        config_type: cfg.type ?? 'string',
        is_secret: cfg.is_secret ? 1 : 0,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertConfig(cfgRow)
      rowsAdded++
    }
    if (manifest.config.length > 0) tablesAffected.push('provider_config')

    // [6] Delete old models → Upsert new models
    await this.store.deleteProviderModels(providerId)
    for (const model of manifest.models) {
      const modelRow: ProviderModelRow = {
        id: newId(),
        provider_id: providerId,
        model_slug: model.slug,
        display_name: model.display_name,
        is_active: 1,
        is_default: model.is_default ? 1 : 0,
        capabilities_json: '[]',
        context_window: model.context_window ?? null,
        max_output_tokens: model.max_output_tokens ?? null,
        supports_streaming: model.supports_streaming ? 1 : 0,
        supports_vision: model.supports_vision ? 1 : 0,
        supports_thinking: model.supports_thinking ? 1 : 0,
        supports_tools: model.supports_tools ? 1 : 0,
        pricing_input_per_1m: model.pricing_input_per_1m ?? null,
        pricing_output_per_1m: model.pricing_output_per_1m ?? null,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertModel(modelRow)
      rowsAdded++
    }
    if (manifest.models.length > 0) tablesAffected.push('provider_model')

    // [7] Emit event
    this.eventBus?.emit({
      type: 'provider:seeded',
      providerId,
      capabilities: manifest.capabilities_config.length,
    })

    // [8] Audit (if configured)
    if (this.auditor) {
      await this.auditor.registerAndAudit(manifest)
    }

    return {
      providerId,
      slug: manifest.provider.slug,
      status,
      tablesAffected,
      rowsAdded,
      rowsModified,
    }
  }

  async seedAll(): Promise<SeedAllResult> {
    const result: SeedAllResult = { seeded: [], skipped: [], errors: [] }

    // In-repo canonical manifests (seeds/providers/manifests.ts) — zero filesystem reads.
    // The generator inlined the 12 JSON manifests at build time; validation happens here.
    for (const raw of PROVIDER_MANIFESTS) {
      try {
        const manifest = ProviderManifestSchema.parse(raw)
        const registerResult = await this.register(manifest)
        result.seeded.push(registerResult)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push({ file: '(in-repo manifest)', error: msg })
      }
    }

    return result
  }

  async seedProvider(providerSlug: string): Promise<RegisterResult> {
    for (const raw of PROVIDER_MANIFESTS) {
      const candidate = ProviderManifestSchema.safeParse(raw)
      if (candidate.success && candidate.data.provider.slug === providerSlug) {
        return this.register(candidate.data)
      }
    }
    throw new EngineError(`Provider manifest not found for slug: ${providerSlug}`)
  }

  async verifySeeds(): Promise<VerifyResult> {
    const result: VerifyResult = { valid: true, providers: [] }

    for (const raw of PROVIDER_MANIFESTS) {
      const parseResult = ProviderManifestSchema.safeParse(raw)
      const slug =
        parseResult.success && parseResult.data.provider.slug
          ? parseResult.data.provider.slug
          : '(manifest)'

      if (!parseResult.success) {
        result.valid = false
        result.providers.push({
          slug,
          status: 'schema_mismatch',
          details: parseResult.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        })
        continue
      }

      result.providers.push({ slug, status: 'ok', details: 'Valid manifest' })
    }

    return result
  }

  async reloadFromSeeds(): Promise<SeedAllResult> {
    return this.seedAll()
  }

  // ── 1.3 Provider Taxonomy Layer ────────────────────────────────────────────

  async registerCapability(input: {
    providerId: string
    slug: string
    title: string
    description?: string
    category?: string
    intent?: string
    selector?: string
    version?: string
  }): Promise<{ id: string }> {
    return this.store.registerCapability(input)
  }

  async overrideCapability(input: {
    providerId: string
    capabilityId: string
    overrideType: string
    overrideJson: string
  }): Promise<void> {
    return this.store.overrideCapability(input)
  }

  async listCapabilities(
    providerId: string,
  ): Promise<
    Array<{ id: string; slug: string; title: string; description?: string; version?: string }>
  > {
    return this.store.listCapabilities(providerId)
  }
}
```

## src/engines/conversation-manager.ts

```ts
// src/engines/conversation-manager.ts
// ConversationManager — orchestrates an 8-step send pipeline.
// RESOLVE → DERIVE SLAVE → LOCK → ENSURE → SEND → CAPTURE → PARSE → STORE+EMIT.

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import { catchDebug } from '../lib/catch-logger.js'
import type { ContentUnitStore } from '../storage/contracts/content-unit-store.js'
import type {
  ConversationMessageRow,
  ConversationRow,
  ConversationStore,
  ProviderAccountRow,
} from '../storage/contracts/conversation-store.js'
import type { NodeStoreContract } from '../storage/contracts/node-store.js'
import type { BlockMeta } from '../storage/contracts/stream-block-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type {
  CapabilityResolutionEngine,
  PlanTier,
  ResolvedCapabilities,
} from './capability-resolution.js'
import type { ChromeGovernor, ChromeSlave, HarnessDAG, HarnessResult } from './chrome-governor.js'
import { decomposeToContentUnits } from './content-unit-decomposer.js'
import type { AssembledContext, ContextAssemblyEngine } from './context-assembly.js'
import type { ExecutionMemoizer } from './execution-memoizer.js'
import type { AgentMemoryContext, MemoryEngine } from './memory-engine.js'
import {
  COMPOSER_SELECTORS,
  PROVIDER_URLS,
  PROVIDER_URL_PATTERNS,
  findWorkingSelector,
} from './provider-selectors.js'
import type { StreamBlockStore } from './stream-block-store.js'
import type { StreamingProtocol } from './streaming-protocol.js'

// ── StreamParserEngine + shared parse types (real impl in stream-parser.ts) ─

import type { ContentBlock, ParseResult, StreamParserEngine } from './stream-parser.js'

export type {
  ContentBlock,
  ParserConfig,
  ParserModule,
  ParseResult,
  StreamParserEngine,
} from './stream-parser.js'

// ── Re-export real engine types ──────────────────────────────────────────

export type { CapabilityResolutionEngine, ResolvedCapabilities } from './capability-resolution.js'
export type { StreamBlockStore } from './stream-block-store.js'
export { CapabilityEventBus } from './capability-event-bus.js'

// ── Local subset type for send pipeline ──────────────────────────────────

export interface ResolvedCapability {
  capabilityId: string
  selector: string
  label: string
  kind: string
  priority: number
  configJson: string
}

/** Unit 3.14 — context attached to a conversation before each send (04-merged-engines.md §Engine 2) */
export interface ConversationContext {
  provider: {
    id: string
    slug: string
    displayName: string
  }
  account: {
    email: string
    planTier: string
    loginState: string
  }
  chrome: {
    status: string
    circuitState: string
  }
  capabilities: {
    total: number
    available: number
  }
  memory?: AgentMemoryContext
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface StageTiming {
  resolve?: number
  recall?: number
  ensure?: number
  type?: number
  submit?: number
  capture?: number
  parse?: number
  store?: number
  total?: number
  [key: string]: number | undefined
}

export interface SendResult {
  ok: boolean
  messageId: string
  blocks: ContentBlock[]
  text: string
  latencyMs: number
  timing?: StageTiming
  error?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Best-effort composer type per provider when the endpoint manifest omits it. */
function composerTypeForProvider(
  providerId: string,
): 'textarea' | 'contenteditable' | 'quill' | 'codemirror' {
  switch (providerId) {
    case 'claude':
    case 'gemini':
      return 'contenteditable'
    default:
      return 'textarea'
  }
}

/** Provider-specific streaming API capture patterns (Unit 2.5) — loaded from DB via ProviderRegistry. */
import { getProviderRegistry } from '../config/provider-registry.js'

function getCapturePattern(providerId: string): RegExp | undefined {
  try {
    const raw = getProviderRegistry().getCapturePattern(providerId)
    return raw ? new RegExp(raw) : undefined
  } catch (e) {
    catchDebug(e, 'conversation-manager: regex compile')
    return undefined
  }
}

const CAPTURE_PATTERNS: Record<string, RegExp> = new Proxy({} as Record<string, RegExp>, {
  get: (_, providerId: string) => getCapturePattern(providerId),
})

function extractText(blocks: ContentBlock[]): string {
  const pieces: string[] = []
  for (const b of blocks) {
    if (b.type === 'text' && typeof b.text === 'string') pieces.push(b.text)
    if (b.type === 'reasoning' && typeof b.text === 'string') pieces.push(b.text)
  }
  return pieces.join('')
}

// ── Context injection (unit 3.14) ─────────────────────────────────────────

function buildConversationContext(
  conv: ConversationRow,
  account: ProviderAccountRow,
  resolved: ResolvedCapabilities,
  slave: ChromeSlave,
): ConversationContext {
  return {
    provider: {
      id: conv.providerId,
      slug: conv.providerId,
      displayName: conv.providerId,
    },
    account: {
      email: account.id,
      planTier: account.planTier,
      loginState: 'unknown',
    },
    chrome: {
      status: slave.status,
      circuitState: slave.circuitState ?? 'closed',
    },
    capabilities: {
      total: resolved.total,
      available: resolved.composer.length,
    },
  }
}

// ── ConversationManager ────────────────────────────────────────────────────

export class ConversationManager {
  constructor(
    private governor: ChromeGovernor,
    private resolution: CapabilityResolutionEngine,
    private parser: StreamParserEngine,
    private blocks: StreamBlockStore,
    private store: ConversationStore,
    private eventBus: CapabilityEventBus,
    private memoizer: ExecutionMemoizer,
    private memory?: MemoryEngine,
    private contextAssembly?: ContextAssemblyEngine,
    private streamingProtocol?: StreamingProtocol,
    private nodeStore?: NodeStoreContract,
    private contentUnitStore?: ContentUnitStore,
    private memoryFabric?: import('./memory/memory-fabric.js').MemoryFabric,
  ) {}

  // Resolve the agent that owns a conversation's memory scope (spec 024 FR-005).
  // Agent threads use providerId='agent:<agentId>'; plain user conversations fall
  // back to the boot-provisioned 'system' agent.
  private resolveOwningAgentId(conv: ConversationRow): string {
    const prefix = 'agent:'
    if (conv.providerId.startsWith(prefix)) {
      return conv.providerId.slice(prefix.length)
    }
    return 'system'
  }

  // ── universal capture ── every message becomes a Node so the database is
  // fully compliant: nothing flowing through the system is dropped.
  // Captures ACU-proven fields (contentHash, version, state, acl, authorDid)
  // and links assistant→user to preserve the response fork.
  private async captureAsNode(
    conversationId: string,
    messageId: string,
    role: 'user' | 'assistant',
    rawSource: string,
    blocks: ContentBlock[],
    parentId?: string,
    parseResult?: ParseResult,
  ): Promise<string | null> {
    if (!this.nodeStore) return null
    const now = Date.now()
    const text = extractText(blocks)
    const edgeType = role === 'assistant' ? 'responds_to' : 'follows'

    // Full block fidelity: store structured block data, not just text
    const blocksSummary = blocks.map((b) => {
      const base: Record<string, unknown> = { type: b.type }
      if (b.type === 'text' || b.type === 'reasoning')
        base.text = typeof b.text === 'string' ? b.text : '[rich-text]'
      if (b.type === 'code') {
        base.text = b.text
        base.language = b.language
      }
      if (b.type === 'file') {
        base.url = b.url
        base.mediaType = b.mediaType
      }
      if (b.type === 'tool-call') {
        base.toolName = b.toolName
        base.input = b.input
      }
      if (b.type === 'tool-result') {
        base.output = b.output
        base.isError = b.isError
      }
      if (b.type === 'source') {
        base.url = b.url
        base.title = b.title
      }
      if (b.type === 'error') {
        base.message = b.message
      }
      if (b.type === 'meta') {
        base.key = b.key
        base.value = b.value
      }
      return base
    })

    const nodeId = newId()
    await this.nodeStore
      .putNode({
        id: nodeId,
        type: 'cap-store.message',
        schemaVersion: 1,
        version: 1,
        state: 'active',
        parentId,
        source: rawSource,
        data: {
          role,
          messageId,
          text,
          blockCount: blocks.length,
          // Full block structure for graph-layer queries
          blocks: blocksSummary,
          // Parser diagnostics when available
          ...(parseResult
            ? {
                parserName: parseResult.parserName,
                parserVersion: parseResult.parserVersion,
                confidence: parseResult.confidence,
                wireFormat: parseResult.wireFormat,
                blockDiagnostics: parseResult.blockDiagnostics,
              }
            : {}),
        } as unknown as Record<string, unknown>,
        edges: parentId ? [{ type: edgeType, targetId: parentId, properties: { role } }] : [],
        meta: {
          conversationId,
          messageId,
          sourceParser: parseResult?.parserName ?? 'conversation-manager',
          parserConfidence: parseResult?.confidence,
        },
        acl: { canView: true, canRemix: false, canReshare: false },
        authorDid: role === 'user' ? 'user' : 'assistant',
        contentType: 'message',
        securityLevel: 0,
        createdAt: now,
        updatedAt: now,
      })
      .catch(() => {})
  // [audit] log the error with context here
    return nodeId
  }

  // ── send: 8-step pipeline with retry (Units 2.x + 3.1, 3.5) ──────────────

  async send(conversationId: string, message: string): Promise<SendResult> {
    const MAX_RETRIES = 2
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.sendInternal(conversationId, message)
      } catch (err) {
        catchDebug(err, 'engines:conversation-manager:321')
        const msg = err instanceof Error ? err.message : String(err)
        const recoverable =
          msg.includes('Slave not running') ||
          msg.includes('Circuit breaker') ||
          msg.includes('CDP command failed') ||
          msg.includes('CDP client not connected')
        if (recoverable && attempt < MAX_RETRIES) {
          await this.recoverSlave(conversationId)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        return {
          ok: false,
          messageId: '',
          blocks: [],
          text: '',
          latencyMs: 0,
          error: msg,
        }
      }
    }
    return { ok: false, messageId: '', blocks: [], text: '', latencyMs: 0, error: 'Unreachable' }
  }

  private async recoverSlave(conversationId: string): Promise<void> {
    const conv = await this.store.getConversation(conversationId)
    if (!conv) return
    if (!conv.providerSessionId) return // No session to recover for history-synced conversations
    const account = await this.store.getAccount(conv.providerSessionId)
    if (!account) return
    const slaves = this.governor.getAllSlaves({ providerId: conv.providerId })
    for (const slave of slaves) {
      if (slave.accountId === account.id) {
        try {
          await this.governor.kill(slave.slaveId)
        } catch (e) {
          catchDebug(e, 'conversation-manager: governor kill')
        }
      }
    }
    // Use ensureRunningForAccount so the duplicate-instance guard in
    // FleetSupervisor.spawn prevents concurrent callers from spawning extras.
    try {
      await this.governor.ensureRunningForAccount(conv.providerId, account.id)
    } catch (e) {
      catchDebug(e, 'conversation-manager: ensure slave')
    }
  }

  private async sendInternal(conversationId: string, message: string): Promise<SendResult> {
    const totalStart = Date.now()
    const timing: StageTiming = {}

    try {
      // [1] RESOLVE
      let t0 = Date.now()
      const conv = await this.store.getConversation(conversationId)
      if (!conv) throw new EngineError(`Conversation not found: ${conversationId}`)
      if (!conv.providerSessionId)
        throw new EngineError(`No provider session for conversation: ${conversationId}`)
      const account = await this.store.getAccount(conv.providerSessionId)
      if (!account) throw new EngineError(`Account not found: ${conv.providerSessionId}`)
      timing.resolve = Date.now() - t0

      // [0] RECALL — retrieve relevant memory/context before execution
      t0 = Date.now()
      let memoryContext: AgentMemoryContext | undefined
      let assembledContext: AssembledContext | undefined
      if (this.contextAssembly) {
        try {
          assembledContext = await this.contextAssembly.assemble(conversationId, message)
          memoryContext = this.assembledToMemoryContext(assembledContext)
        } catch (e) {
          catchDebug(e, 'conversation-manager: context assembly')
        }
      } else if (this.memory) {
        try {
          memoryContext = await this.memory.getAgentContext(conv.providerId, '')
        } catch (e) {
          catchDebug(e, 'conversation-manager: memory recall')
        }
      }

      // FR-005 (spec 024): inject the active agent's frozen memory snapshot as the
      // identity layer so the provider sees stable per-agent context at send time.
      // The owning agent for a user conversation defaults to 'system' (provisioned
      // at boot); agent-spawned threads resolve via their bound agentId.
      if (this.memoryFabric && memoryContext) {
        try {
          const agentId = this.resolveOwningAgentId(conv)
          const snapshot = await this.memoryFabric.snapshotForSession(agentId)
          if (snapshot && snapshot.trim().length > 0) {
            memoryContext.identityContext = snapshot
          }
        } catch (e) {
          catchDebug(e, 'conversation-manager: snapshot injection')
        }
      }
      timing.recall = Date.now() - t0

      const planTier = account.planTier
      const cacheKey = `resolve:${conv.providerId}:${planTier}`
      const resolved = await this.memoizer.getOrCompute(
        cacheKey,
        () => this.resolution.resolve(conv.providerId, planTier as PlanTier),
        5_000,
      )

      // [2] DERIVE SLAVE — use account-based lookup with auto-spawn
      t0 = Date.now()
      const slave = await this.governor.ensureRunningForAccount(conv.providerId, account.id)
      const slaveId = slave.slaveId
      timing.ensure = Date.now() - t0

      // [2.5] VERIFY PAGE STATE (Unit 3.1) — ensure Chrome is on the right page
      const providerUrl = PROVIDER_URLS[conv.providerId]
      const pagePattern = PROVIDER_URL_PATTERNS[conv.providerId]
      try {
        const pageState = await this.governor.cdp.getPageState(slaveId)
        if (providerUrl && pageState.url && !pagePattern?.test(pageState.url)) {
          await this.governor.cdp.send(slaveId, 'Page.navigate', { url: providerUrl })
          await new Promise((r) => setTimeout(r, 3_000))
        }
      } catch (e) {
        catchDebug(e, 'conversation-manager: CDP pre-check')
      }

      // [1.5] INJECT CONTEXT — attach provider/account/chrome/capability/memory state to the conversation
      const context = buildConversationContext(conv, account, resolved, slave)
      if (memoryContext) {
        context.memory = memoryContext
      }
      await this.store.updateConversation(conversationId, {
        contextJson: JSON.stringify(context),
      })

      // [3] LOCK — CDPProxy mutex is handled inside ensureRunning

      // [5] SEND — build HarnessDAG for composer typing
      t0 = Date.now()
      const composerCap = resolved.composer[0] as unknown as {
        selector?: string
        sendSelector?: string
        composerType?: string
      }
      // Unit 3.2 + 3.6: adaptive selector with fallback chain
      const cdpSend = (method: string, params?: Record<string, unknown>) =>
        this.governor.cdp.send(slaveId, method, params)
      const selectorCandidates = [
        ...(composerCap?.selector ? [composerCap.selector] : []),
        ...(COMPOSER_SELECTORS[conv.providerId] ?? ['textarea']),
      ]
      const selector = (await findWorkingSelector(cdpSend, selectorCandidates)) ?? 'textarea'
      const sendSelector = composerCap?.sendSelector
      const composerType = (composerCap?.composerType ??
        composerTypeForProvider(conv.providerId)) as
        | 'textarea'
        | 'contenteditable'
        | 'quill'
        | 'codemirror'

      const dag: HarnessDAG = {
        nodes: [
          {
            type: 'action',
            action: 'type_text',
            params: { text: message, selector, composerType },
          },
          { type: 'action', action: 'submit', params: { key: 'Enter', sendSelector } },
        ],
        edges: [{ from: 0, to: 1 }],
      }

      // [5.5] PRE-CAPTURE — enable network monitoring before submit so the
      // streaming API request isn't missed (Unit 2.5).
      const capturePattern = CAPTURE_PATTERNS[conv.providerId] ?? /\/api\/conversation\//
      try {
        await this.governor.cdp.send(slaveId, 'Network.enable')
      } catch (e) {
        catchDebug(e, 'conversation-manager: Network.enable')
      }

      const sendResult = await this.governor.cdp.executeHarnessPlan(slaveId, dag)
      timing.type = Date.now() - t0

      if (!sendResult.success) {
        timing.total = Date.now() - totalStart
        return {
          ok: false,
          messageId: '',
          blocks: [],
          text: '',
          latencyMs: timing.total,
          timing,
          error: (sendResult as HarnessResult).error ?? 'Harness plan failed',
        }
      }

      // [6] CAPTURE — intercept streaming API response (provider-specific pattern)
      t0 = Date.now()
      let parseResult: ParseResult = {
        blocks: [],
        confidence: 0,
        parserName: '',
        parserVersion: 0,
        durationMs: 0,
        blockDiagnostics: {
          textBlocks: 0,
          toolCallBlocks: 0,
          fileBlocks: 0,
          errorBlocks: 0,
          reasoningBlocks: 0,
          codeBlocks: 0,
          sourceBlocks: 0,
        },
        wireFormat: 'unknown',
        fallbackDepth: 0,
        rawSizeBytes: 0,
      }
      let captureResult: { body?: string } | undefined
      try {
        captureResult = await this.governor.cdp.capture(slaveId, capturePattern, 60_000)
        timing.capture = Date.now() - t0

        // [7] PARSE
        t0 = Date.now()
        parseResult = await this.parser.parse(
          (captureResult as { body?: string }).body ?? '',
          conv.providerId,
        )
        timing.parse = Date.now() - t0
      } catch (e) {
        catchDebug(e, 'conversation-manager: CDP capture')
        timing.capture = Date.now() - t0
      }

      // [8] STORE + EMIT
      t0 = Date.now()

      // [8a] STORE USER MESSAGE (Unit 2.7 — was previously missing)
      await this.store.createMessage({
        conversationId,
        role: 'user',
        content: message,
        blocksJson: JSON.stringify([{ type: 'text', text: message }]),
        blockCount: 1,
        latencyMs: 0,
      })

      const msgRow = await this.store.createMessage({
        conversationId,
        role: 'assistant',
        content: extractText(parseResult.blocks),
        blocksJson: JSON.stringify(parseResult.blocks),
        blockCount: parseResult.blocks.length,
        latencyMs: Date.now() - totalStart,
      })

      // Store blocks with parser metadata for diagnostics
      const blockMeta: BlockMeta = {
        parserName: parseResult.parserName,
        parserVersion: parseResult.parserVersion,
        confidence: parseResult.confidence,
        wireFormat: parseResult.wireFormat,
      }
      await this.blocks.storeBlocks(conversationId, msgRow.id, parseResult.blocks, blockMeta)

      // Decompose blocks into ContentUnit rows for per-block storage
      if (this.contentUnitStore) {
        const units = decomposeToContentUnits(parseResult.blocks, conversationId, msgRow.id)
        await this.contentUnitStore.storeUnits(units).catch(() => {})
  // [audit] log the error with context here
      }

      // Universal capture — persist both messages as Nodes (fully compliant DB).
      // User node is captured first so the assistant node links to it (fork).
      const userNodeId = await this.captureAsNode(conversationId, msgRow.id, 'user', message, [
        { type: 'text', text: message },
      ])
      await this.captureAsNode(
        conversationId,
        msgRow.id,
        'assistant',
        (captureResult as { body?: string }).body ?? '',
        parseResult.blocks,
        userNodeId ?? undefined,
        parseResult,
      )

      await this.store.updateConversation(conversationId, {
        messageCount: conv.messageCount + 2,
        lastMessageAt: Date.now(),
      })

      timing.store = Date.now() - t0

      this.eventBus.emit({
        type: 'conversation:complete',
        conversationId,
        message: msgRow,
        // Full, canonical ContentPart[] — not a {text,kind} sliver. The
        // frontend renders from this immediately and treats loadHistory()
        // as reconciliation (upgrade doc Gap 2 / backend-patches.md §1).
        blocks: parseResult.blocks,
      })

      timing.total = Date.now() - totalStart

      // [9] REMEMBER — record episode and learn (best-effort, non-blocking)
      if (this.memory) {
        const durationMs = timing.total
        this.memory
          .recordEpisode({
            providerId: conv.providerId,
            action: 'send',
            input: { message },
            output: {
              text: extractText(parseResult.blocks),
              blockCount: parseResult.blocks.length,
            },
            success: true,
            durationMs,
            tags: ['conversation', conv.providerId],
          })
          .catch(() => {}) // fire-and-forget
  // [audit] log the error with context here
      }

      return {
        ok: true,
        messageId: msgRow.id,
        blocks: parseResult.blocks,
        text: extractText(parseResult.blocks),
        latencyMs: timing.total,
        timing,
      }
    } catch (err) {
      catchDebug(err, 'engines:conversation-manager:652')
      const error = err instanceof Error ? err.message : String(err)
      this.eventBus.emit({
        type: 'conversation:error',
        conversationId,
        error,
      })
      return {
        ok: false,
        messageId: '',
        blocks: [],
        text: '',
        latencyMs: Date.now() - totalStart,
        error,
      }
    }
  }

  // ── Streaming send (Unit 3.3) ───────────────────────────────────────────

  async sendStreaming(conversationId: string, message: string): Promise<SendResult> {
    const start = Date.now()
    const MAX_RETRIES = 2
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.sendStreamingInternal(conversationId, message, start)
      } catch (err) {
        catchDebug(err, 'engines:conversation-manager:678')
        const msg = err instanceof Error ? err.message : String(err)
        const recoverable =
          msg.includes('Slave not running') ||
          msg.includes('Circuit breaker') ||
          msg.includes('CDP command failed') ||
          msg.includes('CDP client not connected')
        if (recoverable && attempt < MAX_RETRIES) {
          await this.recoverSlave(conversationId)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        return {
          ok: false,
          messageId: '',
          blocks: [],
          text: '',
          latencyMs: Date.now() - start,
          error: msg,
        }
      }
    }
    return {
      ok: false,
      messageId: '',
      blocks: [],
      text: '',
      latencyMs: Date.now() - start,
      error: 'Unreachable',
    }
  }

  private async sendStreamingInternal(
    conversationId: string,
    message: string,
    start: number,
  ): Promise<SendResult> {
    // [1] RESOLVE
    const conv = await this.store.getConversation(conversationId)
    if (!conv) throw new EngineError(`Conversation not found: ${conversationId}`)
    if (!conv.providerSessionId)
      throw new EngineError(`No provider session for conversation: ${conversationId}`)
    const account = await this.store.getAccount(conv.providerSessionId)
    if (!account) throw new EngineError(`Account not found: ${conv.providerSessionId}`)

    const planTier = account.planTier
    const cacheKey = `resolve:${conv.providerId}:${planTier}`
    const resolved = await this.memoizer.getOrCompute(
      cacheKey,
      () => this.resolution.resolve(conv.providerId, planTier as PlanTier),
      5_000,
    )

    // [2] DERIVE SLAVE
    const slave = await this.governor.ensureRunningForAccount(conv.providerId, account.id)
    const slaveId = slave.slaveId

    // [5] SEND
    const composerCap = resolved.composer[0] as unknown as {
      selector?: string
      sendSelector?: string
      composerType?: string
    }
    const cdpSend = (method: string, params?: Record<string, unknown>) =>
      this.governor.cdp.send(slaveId, method, params)
    const selectorCandidates = [
      ...(composerCap?.selector ? [composerCap.selector] : []),
      ...(COMPOSER_SELECTORS[conv.providerId] ?? ['textarea']),
    ]
    const selector = (await findWorkingSelector(cdpSend, selectorCandidates)) ?? 'textarea'
    const sendSelector = composerCap?.sendSelector
    const composerType = (composerCap?.composerType ?? composerTypeForProvider(conv.providerId)) as
      | 'textarea'
      | 'contenteditable'
      | 'quill'
      | 'codemirror'

    // [5.5] PRE-CAPTURE
    const capturePattern = CAPTURE_PATTERNS[conv.providerId] ?? /\/api\/conversation\//
    try {
      await this.governor.cdp.send(slaveId, 'Network.enable')
    } catch (e) {
      catchDebug(e, 'conversation-manager: Network.enable (retry)')
    }

    const dag: HarnessDAG = {
      nodes: [
        {
          type: 'action',
          action: 'type_text',
          params: { text: message, selector, composerType },
        },
        { type: 'action', action: 'submit', params: { key: 'Enter', sendSelector } },
      ],
      edges: [{ from: 0, to: 1 }],
    }

    const sendResult = await this.governor.cdp.executeHarnessPlan(slaveId, dag)
    if (!sendResult.success) {
      return {
        ok: false,
        messageId: '',
        blocks: [],
        text: '',
        latencyMs: Date.now() - start,
        error: (sendResult as HarnessResult).error ?? 'Harness plan failed',
      }
    }

    // [6] STREAM CAPTURE — use streamingProtocol if available, fallback to batch
    if (this.streamingProtocol) {
      const messageId = await this.streamingProtocol.startConversation(conversationId)
      // Progressive capture via Network events
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          cleanup()
          resolve()
        }, 60_000)

        const matchingRequests = new Set<string>()
        let lastBody = ''

        const responseHandler = (params: unknown) => {
          const event = params as { requestId?: string; response?: { url?: string } }
          if (event.response?.url && event.requestId && capturePattern.test(event.response.url)) {
            matchingRequests.add(event.requestId)
          }
        }

        const loadingFinishedHandler = async (params: unknown) => {
          const event = params as { requestId?: string }
          if (event.requestId && matchingRequests.has(event.requestId)) {
            try {
              const result = (await this.governor.cdp.send(slaveId, 'Network.getResponseBody', {
                requestId: event.requestId,
              })) as { body?: string }
              const body = result?.body ?? ''
              if (body.length > lastBody.length) {
                const newChunk = body.slice(lastBody.length)
                lastBody = body
                await this.streamingProtocol?.captureChunk(conversationId, messageId, newChunk)
              }
            } catch (e) {
              catchDebug(e, 'conversation-manager: body not ready')
            }
            cleanup()
            resolve()
          }
        }

        const cleanup = () => {
          clearTimeout(timer)
          // Event listeners will be GC'd when slave disconnects
        }

        // Register on the CDP client via send (proxy)
        // The CdpTransportImpl handles event registration internally
        void responseHandler
        void loadingFinishedHandler
        // For now, fall through to batch capture after a delay
        setTimeout(async () => {
          try {
            const result = await this.governor.cdp.capture(slaveId, capturePattern, 60_000)
            const body = (result as { body?: string }).body ?? ''
            if (body !== lastBody) {
              await this.streamingProtocol?.captureChunk(
                conversationId,
                messageId,
                body.slice(lastBody.length),
              )
            }
          } catch (e) {
            catchDebug(e, 'conversation-manager: capture failed')
          }
          cleanup()
          resolve()
        }, 30_000)
      })

      const finalBlocks = await this.streamingProtocol.finishConversation(conversationId, messageId)
      const msgRow = await this.store.createMessage({
        conversationId,
        role: 'user',
        content: message,
        blocksJson: JSON.stringify([{ type: 'text', text: message }]),
        blockCount: 1,
        latencyMs: 0,
      })
      await this.store.createMessage({
        conversationId,
        role: 'assistant',
        content: extractText(finalBlocks),
        blocksJson: JSON.stringify(finalBlocks),
        blockCount: finalBlocks.length,
        latencyMs: Date.now() - start,
      })
      return {
        ok: true,
        messageId: msgRow.id,
        blocks: finalBlocks,
        text: extractText(finalBlocks),
        latencyMs: Date.now() - start,
      }
    }

    // Fallback: batch capture (non-streaming)
    let parseResult: ParseResult = {
      blocks: [],
      confidence: 0,
      parserName: '',
      parserVersion: 0,
      durationMs: 0,
      blockDiagnostics: {
        textBlocks: 0,
        toolCallBlocks: 0,
        fileBlocks: 0,
        errorBlocks: 0,
        reasoningBlocks: 0,
        codeBlocks: 0,
        sourceBlocks: 0,
      },
      wireFormat: 'unknown',
      fallbackDepth: 0,
      rawSizeBytes: 0,
    }
    let rawBody = ''
    try {
      const captureResult = await this.governor.cdp.capture(slaveId, capturePattern, 60_000)
      rawBody = (captureResult as { body?: string }).body ?? ''
      parseResult = await this.parser.parse(rawBody, conv.providerId)
    } catch (e) {
      catchDebug(e, 'conversation-manager: CDP parse')
    }

    // Store
    await this.store.createMessage({
      conversationId,
      role: 'user',
      content: message,
      blocksJson: JSON.stringify([{ kind: 'text', content: message, index: 0 }]),
      blockCount: 1,
      latencyMs: 0,
    })
    const msgRow = await this.store.createMessage({
      conversationId,
      role: 'assistant',
      content: extractText(parseResult.blocks),
      blocksJson: JSON.stringify(parseResult.blocks),
      blockCount: parseResult.blocks.length,
      latencyMs: Date.now() - start,
    })
    // Store blocks with parser metadata for diagnostics
    const batchBlockMeta: BlockMeta = {
      parserName: parseResult.parserName,
      parserVersion: parseResult.parserVersion,
      confidence: parseResult.confidence,
      wireFormat: parseResult.wireFormat,
    }
    await this.blocks.storeBlocks(conversationId, msgRow.id, parseResult.blocks, batchBlockMeta)

    // Decompose blocks into ContentUnit rows for per-block storage
    if (this.contentUnitStore) {
      const units = decomposeToContentUnits(parseResult.blocks, conversationId, msgRow.id)
      await this.contentUnitStore.storeUnits(units).catch(() => {})
  // [audit] log the error with context here
    }

    // Universal capture — persist both messages as Nodes (fully compliant DB).
    // User node first so the assistant node links to it (fork).
    const streamUserNodeId = await this.captureAsNode(conversationId, msgRow.id, 'user', message, [
      { type: 'text', text: message },
    ])
    await this.captureAsNode(
      conversationId,
      msgRow.id,
      'assistant',
      rawBody,
      parseResult.blocks,
      streamUserNodeId ?? undefined,
      parseResult,
    )
    await this.store.updateConversation(conversationId, {
      messageCount: conv.messageCount + 2,
      lastMessageAt: Date.now(),
    })
    this.eventBus.emit({
      type: 'conversation:complete',
      conversationId,
      message: msgRow,
    })

    return {
      ok: true,
      messageId: msgRow.id,
      blocks: parseResult.blocks,
      text: extractText(parseResult.blocks),
      latencyMs: Date.now() - start,
    }
  }

  // ── Context assembly → memory context bridge ────────────────────────────

  private assembledToMemoryContext(assembled: AssembledContext): AgentMemoryContext {
    const episodes = assembled.layers.find((l) => l.name === 'recent_episodes')
    const topic = assembled.layers.find((l) => l.name === 'topic')
    const project = assembled.layers.find((l) => l.name === 'project_state')

    return {
      recentEpisodes: episodes
        ? [
            {
              id: '',
              providerId: '',
              action: episodes.content,
              input: {},
              output: {},
              success: true,
              durationMs: 0,
              timestamp: assembled.assembledAt,
              tags: [],
            },
          ]
        : [],
      relevantFacts: topic
        ? [
            {
              id: '',
              subject: 'context',
              predicate: 'topic',
              object: topic.content,
              confidence: 1,
              source: 'context-assembly',
              timestamp: assembled.assembledAt,
            },
          ]
        : [],
      applicableRules: project
        ? [
            {
              id: '',
              name: 'project_state',
              condition: '',
              action: project.content,
              confidence: 1,
              successCount: 0,
              failureCount: 0,
              createdAt: assembled.assembledAt,
              updatedAt: assembled.assembledAt,
            },
          ]
        : [],
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async createConversation(providerId: string, title?: string): Promise<ConversationRow> {
    const created = await this.store.createConversation({
      providerSessionId: `session_${providerId}_${Date.now()}`,
      providerId,
      title: title ?? null,
    })
    // P3-6: Emit conversation:created event so subscribers are notified.
    this.eventBus.emit({
      type: 'conversation:created',
      conversationId: created.id,
      providerId: created.providerId,
      accountId: created.accountId ?? '',
    })
    return created
  }

  async getConversation(id: string): Promise<ConversationRow> {
    const conv = await this.store.getConversation(id)
    if (!conv) throw new EngineError(`Conversation not found: ${id}`)
    return conv
  }

  async getMessages(
    conversationId: string,
    opts?: { limit?: number; before?: string },
  ): Promise<ConversationMessageRow[]> {
    return this.store.getMessages(conversationId, opts)
  }

  async truncate(conversationId: string, beforeMessageId: string): Promise<void> {
    const messages = await this.store.getMessages(conversationId)
    const idx = messages.findIndex((m) => m.id === beforeMessageId)
    if (idx <= 0) return
    const toDelete = messages.slice(0, idx)
    for (const msg of toDelete) {
      await this.store.deleteConversation(msg.id)
    }
  }
}
```

## seeds/providers/manifests.ts

```ts
// AUTO-GENERATED from seeds/providers/*.json — canonical in-repo provider manifests.
// Replaces on-disk JSON so seeding performs zero filesystem reads at boot.
// Type-checked at runtime via ProviderManifestSchema.safeParse() in the seed script.
// Typed loosely here because JSON manifests omit optional fields the Zod schema defaults.
export const PROVIDER_MANIFESTS: unknown[] = [
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'chatgpt',
      display_name: 'ChatGPT',
      description: "OpenAI's ChatGPT assistant",
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://chatgpt.com',
      documentation_url: 'https://platform.openai.com/docs',
      auth_type: 'browser',
      has_multi_account: true,
      profile_strategy: 'per_account',
      fleet_config: {
        port_range: [9252, 9280],
        extra_args: ['--no-first-run'],
      },
      capabilities: [
        'select_model',
        'send_message',
        'edit_message',
        'regenerate_response',
        'upload_file',
        'create_new_chat',
        'navigate_chat',
        'delete_chat',
        'rename_chat',
        'browse_with_bing',
      ],
      accessTier: 'free',
    },
    endpoints: [
      {
        label: 'Landing',
        url: 'https://chatgpt.com',
        endpoint_type: 'landing',
        is_default: true,
      },
      {
        label: 'Chat',
        url: 'https://chatgpt.com',
        endpoint_type: 'chat',
        selector: {
          composer: '#prompt-textarea',
          send_button: "[data-testid='send-button']",
        },
        composer_type: 'textarea',
        send_method: 'both',
        content_editable: false,
      },
      {
        label: 'Login',
        url: 'https://chatgpt.com',
        endpoint_type: 'login',
        selector: {
          email_input: "input[name='email']",
          continue_button: "button[type='submit']",
        },
      },
    ],
    models: [
      {
        slug: 'gpt-4o',
        display_name: 'GPT-4o',
        is_default: true,
        context_window: 128000,
        max_output_tokens: 16384,
        supports_streaming: true,
        supports_vision: true,
        supports_tools: true,
      },
      {
        slug: 'gpt-4o-mini',
        display_name: 'GPT-4o Mini',
        context_window: 128000,
        max_output_tokens: 16384,
        supports_streaming: true,
        supports_vision: true,
        supports_tools: true,
      },
      {
        slug: 'o3',
        display_name: 'o3',
        context_window: 200000,
        max_output_tokens: 100000,
        supports_streaming: true,
        supports_vision: true,
        supports_thinking: true,
        supports_tools: true,
      },
      {
        slug: 'o4-mini',
        display_name: 'o4-mini',
        context_window: 200000,
        max_output_tokens: 100000,
        supports_streaming: true,
        supports_vision: true,
        supports_thinking: true,
        supports_tools: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [
          {
            type: 'retry_selector',
          },
          {
            type: 'navigate_home',
          },
        ],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to ChatGPT',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
      {
        global_capability_id: 'select_model',
        ui_component_override: 'dropdown_selector',
        ui_label_override: 'Select GPT Model',
        ui_icon_override: 'cpu',
        ui_position_override: 'header',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      {
        key: 'base_url',
        value: 'https://chatgpt.com',
      },
      {
        key: 'auth_type',
        value: 'email',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'claude',
      display_name: 'Claude',
      description: "Anthropic's Claude AI assistant",
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://claude.ai',
      documentation_url: 'https://docs.anthropic.com',
      auth_type: 'browser',
      has_multi_account: true,
      profile_strategy: 'per_account',
      fleet_config: {
        port_range: [9222, 9250],
        extra_args: ['--disable-features=Translate', '--no-first-run'],
      },
      capabilities: [
        'select_model',
        'send_message',
        'edit_message',
        'regenerate_response',
        'toggle_extended_thinking',
        'upload_file',
        'create_new_chat',
        'navigate_chat',
        'delete_chat',
        'rename_chat',
        'deep_research',
      ],
      accessTier: 'free',
    },
    endpoints: [
      {
        label: 'Landing',
        url: 'https://claude.ai',
        endpoint_type: 'landing',
        is_default: true,
      },
      {
        label: 'Chat',
        url: 'https://claude.ai/chat',
        endpoint_type: 'chat',
        selector: {
          composer:
            'div[contenteditable="true"].ProseMirror,div[contenteditable="true"][data-placeholder]',
          send_button: "[aria-label='Send Message'],[aria-label='Send message']",
        },
        composer_type: 'prosemirror',
        send_method: 'both',
        content_editable: true,
      },
      {
        label: 'Login',
        url: 'https://claude.ai',
        endpoint_type: 'login',
        selector: {
          email_input: "input[type='email']",
          continue_button: "button[type='submit']",
        },
      },
    ],
    models: [
      {
        slug: 'claude-sonnet-4-20250514',
        display_name: 'Sonnet 4',
        is_default: true,
        context_window: 200000,
        max_output_tokens: 64000,
        supports_streaming: true,
        supports_vision: true,
        supports_thinking: true,
        supports_tools: true,
      },
      {
        slug: 'claude-opus-4-20250514',
        display_name: 'Opus 4',
        context_window: 200000,
        max_output_tokens: 64000,
        supports_streaming: true,
        supports_vision: true,
        supports_thinking: true,
        supports_tools: true,
      },
      {
        slug: 'claude-haiku-4-20250514',
        display_name: 'Haiku 4',
        context_window: 200000,
        max_output_tokens: 64000,
        supports_streaming: true,
        supports_vision: true,
        supports_tools: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [
          {
            type: 'retry_selector',
          },
          {
            type: 'retry_with_fallback',
            config: {
              fallback_selector: 'textarea',
            },
          },
          {
            type: 'navigate_home',
          },
        ],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to Claude',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
      {
        global_capability_id: 'select_model',
        ui_component_override: 'dropdown_selector',
        ui_label_override: 'Select Claude Model',
        ui_icon_override: 'cpu',
        ui_position_override: 'header',
        ui_priority_override: 'primary',
      },
      {
        global_capability_id: 'toggle_extended_thinking',
        ui_component_override: 'toggle_switch',
        ui_label_override: 'Extended Thinking',
        ui_position_override: 'header',
        ui_priority_override: 'secondary',
        existential_rule_override: 'message_has_thinking_block',
      },
      {
        global_capability_id: 'deep_research',
        ui_component_override: 'action_button',
        ui_label_override: 'Deep Research',
        ui_icon_override: 'flask',
        ui_position_override: 'composer',
        ui_priority_override: 'secondary',
        min_plan_tier_override: 'pro',
      },
    ],
    config: [
      {
        key: 'base_url',
        value: 'https://claude.ai',
      },
      {
        key: 'auth_type',
        value: 'email',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'deepseek',
      display_name: 'DeepSeek',
      description: 'DeepSeek AI assistant with strong coding and reasoning capabilities',
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://chat.deepseek.com',
      documentation_url: 'https://platform.deepseek.com/api-docs',
      auth_type: 'browser',
      has_multi_account: false,
      profile_strategy: 'per_account',
      fleet_config: {
        port_range: [9312, 9340],
      },
      capabilities: [
        'send_message',
        'edit_message',
        'regenerate_response',
        'create_new_chat',
        'navigate_chat',
        'delete_chat',
        'rename_chat',
      ],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Landing',
        url: 'https://chat.deepseek.com',
        endpoint_type: 'landing',
        is_default: true,
      },
      {
        label: 'Chat',
        url: 'https://chat.deepseek.com',
        endpoint_type: 'chat',
        selector: {
          composer: 'textarea',
          send_button: "button[aria-label='Send']",
        },
        composer_type: 'textarea',
        send_method: 'both',
        content_editable: false,
      },
      {
        label: 'Login',
        url: 'https://chat.deepseek.com',
        endpoint_type: 'login',
        selector: {
          email_input: "input[type='email']",
          continue_button: "button[type='submit']",
        },
      },
    ],
    models: [
      {
        slug: 'deepseek-chat',
        display_name: 'DeepSeek Chat (V3)',
        is_default: true,
        context_window: 65536,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_tools: true,
      },
      {
        slug: 'deepseek-reasoner',
        display_name: 'DeepSeek Reasoner (R1)',
        context_window: 65536,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_thinking: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [
          {
            type: 'retry_selector',
          },
          {
            type: 'navigate_home',
          },
        ],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to DeepSeek',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      {
        key: 'base_url',
        value: 'https://chat.deepseek.com',
      },
      {
        key: 'auth_type',
        value: 'email',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'facebook',
      display_name: 'Facebook Messenger',
      description: 'Facebook Messenger channel',
      category: 'messaging',
      provider_type: 'messaging',
      website_url: 'https://www.facebook.com/messages',
      auth_type: 'browser',
      has_multi_account: false,
      profile_strategy: 'single',
      fleet_config: {
        port_range: [9360, 9380],
        extra_args: ['--no-first-run'],
      },
      capabilities: ['channel_add', 'channel_connect', 'message_send', 'message_receive'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Web',
        url: 'https://www.facebook.com/messages',
        endpoint_type: 'landing',
        is_default: true,
      },
    ],
    models: [],
    capabilities_config: [],
    config: [
      {
        key: 'poll_strategy',
        value: 'cdp-scrape',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'gemini',
      display_name: 'Gemini',
      description: "Google's Gemini AI assistant",
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://gemini.google.com',
      documentation_url: 'https://ai.google.dev/docs',
      auth_type: 'browser',
      has_multi_account: true,
      profile_strategy: 'per_account',
      fleet_config: {
        port_range: [9282, 9310],
        extra_args: ['--no-first-run'],
      },
      capabilities: [
        'select_model',
        'send_message',
        'edit_message',
        'regenerate_response',
        'upload_file',
        'create_new_chat',
        'navigate_chat',
        'delete_chat',
        'rename_chat',
      ],
      accessTier: 'free',
    },
    endpoints: [
      {
        label: 'Landing',
        url: 'https://gemini.google.com',
        endpoint_type: 'landing',
        is_default: true,
      },
      {
        label: 'Chat',
        url: 'https://gemini.google.com/app',
        endpoint_type: 'chat',
        selector: {
          composer: '.ql-editor[contenteditable="true"]',
          send_button: "button[aria-label='Send message']",
        },
        composer_type: 'quill',
        send_method: 'button_click',
        content_editable: true,
      },
      {
        label: 'Login',
        url: 'https://accounts.google.com',
        endpoint_type: 'login',
      },
    ],
    models: [
      {
        slug: 'gemini-2.5-pro',
        display_name: 'Gemini 2.5 Pro',
        is_default: true,
        context_window: 1048576,
        max_output_tokens: 65536,
        supports_streaming: true,
        supports_vision: true,
        supports_thinking: true,
        supports_tools: true,
      },
      {
        slug: 'gemini-2.5-flash',
        display_name: 'Gemini 2.5 Flash',
        context_window: 1048576,
        max_output_tokens: 65536,
        supports_streaming: true,
        supports_vision: true,
        supports_thinking: true,
        supports_tools: true,
      },
      {
        slug: 'gemini-2.0-flash',
        display_name: 'Gemini 2.0 Flash',
        context_window: 1048576,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_vision: true,
        supports_tools: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [
          {
            type: 'retry_selector',
          },
          {
            type: 'navigate_home',
          },
        ],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to Gemini',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
      {
        global_capability_id: 'select_model',
        ui_component_override: 'dropdown_selector',
        ui_label_override: 'Select Gemini Model',
        ui_icon_override: 'cpu',
        ui_position_override: 'header',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      {
        key: 'base_url',
        value: 'https://gemini.google.com',
      },
      {
        key: 'auth_type',
        value: 'google',
      },
    ],
  },
  {
    provider: {
      slug: 'generic',
      display_name: 'Generic',
      description: 'Format-agnostic fallback provider for the parser chain',
      category: 'system',
      provider_type: 'system',
      website_url: 'https://cap-store.local',
      auth_type: 'none',
      has_multi_account: false,
      profile_strategy: 'none',
      fleet_config: {},
      capabilities: [],
      accessTier: 'free',
    },
    endpoints: [],
    models: [],
    capabilities_config: [],
    config: [],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'qwen',
      display_name: 'Qwen',
      description: "Alibaba's Qwen AI assistant",
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://tongyi.aliyun.com',
      documentation_url: 'https://help.aliyun.com/zh/model-studio/',
      auth_type: 'browser',
      has_multi_account: false,
      profile_strategy: 'per_account',
      fleet_config: {
        port_range: [9372, 9400],
      },
      capabilities: ['send_message', 'select_model', 'create_new_chat', 'navigate_chat'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Landing',
        url: 'https://tongyi.aliyun.com',
        endpoint_type: 'landing',
        is_default: true,
      },
      {
        label: 'Chat',
        url: 'https://tongyi.aliyun.com/qianwen',
        endpoint_type: 'chat',
        selector: {
          composer: 'textarea',
          send_button: "button[aria-label='Send']",
        },
        composer_type: 'textarea',
        send_method: 'both',
        content_editable: false,
      },
    ],
    models: [
      {
        slug: 'qwen-max',
        display_name: 'Qwen Max',
        is_default: true,
        context_window: 32768,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_tools: true,
      },
      {
        slug: 'qwen-plus',
        display_name: 'Qwen Plus',
        context_window: 131072,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_tools: true,
      },
      {
        slug: 'qwen-turbo',
        display_name: 'Qwen Turbo',
        context_window: 131072,
        max_output_tokens: 8192,
        supports_streaming: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [
          {
            type: 'retry_selector',
          },
          {
            type: 'navigate_home',
          },
        ],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to Qwen',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
      {
        global_capability_id: 'select_model',
        ui_component_override: 'dropdown_selector',
        ui_label_override: 'Select Qwen Model',
        ui_icon_override: 'cpu',
        ui_position_override: 'header',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      {
        key: 'base_url',
        value: 'https://tongyi.aliyun.com',
      },
      {
        key: 'auth_type',
        value: 'email',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'slack',
      display_name: 'Slack',
      description: 'Slack messaging channel',
      category: 'messaging',
      provider_type: 'messaging',
      website_url: 'https://api.slack.com',
      auth_type: 'oauth',
      has_multi_account: false,
      profile_strategy: 'single',
      fleet_config: {
        port_range: [9400, 9420],
        extra_args: [],
      },
      capabilities: ['channel_add', 'channel_connect', 'message_send', 'message_receive'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'API',
        url: 'https://slack.com/api',
        endpoint_type: 'landing',
        is_default: true,
      },
    ],
    models: [],
    capabilities_config: [],
    config: [
      {
        key: 'poll_strategy',
        value: 'webhook',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'studio-ai',
      display_name: 'Studio AI',
      description: 'Google AI Studio — Gemini API playground and prototyping environment',
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://aistudio.google.com',
      documentation_url: 'https://ai.google.dev/docs',
      auth_type: 'browser',
      has_multi_account: false,
      profile_strategy: 'per_account',
      fleet_config: {
        port_range: [9342, 9370],
      },
      capabilities: ['send_message', 'select_model', 'create_new_chat', 'navigate_chat'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Landing',
        url: 'https://aistudio.google.com',
        endpoint_type: 'landing',
        is_default: true,
      },
      {
        label: 'Chat',
        url: 'https://aistudio.google.com/prompts/new_chat',
        endpoint_type: 'chat',
        selector: {
          composer: 'rich-textarea',
          send_button: "button[aria-label='Send message']",
        },
        composer_type: 'textarea',
        send_method: 'both',
        content_editable: false,
      },
    ],
    models: [
      {
        slug: 'gemini-2.5-pro-preview',
        display_name: 'Gemini 2.5 Pro Preview',
        is_default: true,
        context_window: 1048576,
        max_output_tokens: 65536,
        supports_streaming: true,
        supports_vision: true,
        supports_thinking: true,
        supports_tools: true,
      },
      {
        slug: 'gemini-2.5-flash-preview',
        display_name: 'Gemini 2.5 Flash Preview',
        context_window: 1048576,
        max_output_tokens: 65536,
        supports_streaming: true,
        supports_vision: true,
        supports_tools: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [
          {
            type: 'retry_selector',
          },
          {
            type: 'navigate_home',
          },
        ],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to Studio AI',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
      {
        global_capability_id: 'select_model',
        ui_component_override: 'dropdown_selector',
        ui_label_override: 'Select Model',
        ui_icon_override: 'cpu',
        ui_position_override: 'header',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      {
        key: 'base_url',
        value: 'https://aistudio.google.com',
      },
      {
        key: 'auth_type',
        value: 'google',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'system',
      display_name: 'System',
      description: 'System-level fallback parsers — universal fallback chain',
      category: 'system',
      provider_type: 'system',
      website_url: 'https://vivim.app',
      auth_type: 'none',
      has_multi_account: false,
      profile_strategy: 'shared',
      capabilities: [],
      accessTier: 'free',
    },
    endpoints: [],
    models: [],
    capabilities_config: [],
    config: [],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'telegram',
      display_name: 'Telegram',
      description: 'Telegram messaging channel',
      category: 'messaging',
      provider_type: 'messaging',
      website_url: 'https://core.telegram.org',
      auth_type: 'api_key',
      has_multi_account: false,
      profile_strategy: 'single',
      fleet_config: {
        port_range: [9380, 9400],
        extra_args: [],
      },
      capabilities: ['channel_add', 'channel_connect', 'message_send', 'message_receive'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Bot API',
        url: 'https://api.telegram.org',
        endpoint_type: 'landing',
        is_default: true,
      },
    ],
    models: [],
    capabilities_config: [],
    config: [
      {
        key: 'poll_strategy',
        value: 'polling',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'whatsapp',
      display_name: 'WhatsApp',
      description: 'WhatsApp Web messaging channel',
      category: 'messaging',
      provider_type: 'messaging',
      website_url: 'https://web.whatsapp.com',
      auth_type: 'browser',
      has_multi_account: false,
      profile_strategy: 'single',
      fleet_config: {
        port_range: [9340, 9360],
        extra_args: ['--no-first-run'],
      },
      capabilities: ['channel_add', 'channel_connect', 'message_send', 'message_receive'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Web',
        url: 'https://web.whatsapp.com',
        endpoint_type: 'landing',
        is_default: true,
      },
    ],
    models: [],
    capabilities_config: [],
    config: [
      {
        key: 'poll_strategy',
        value: 'cdp-scrape',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'z-ai',
      display_name: 'Z AI',
      description: "Z.AI — Z.ai's multimodal AI assistant",
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://z.ai',
      auth_type: 'api',
      has_multi_account: false,
      profile_strategy: 'shared',
      capabilities: ['send_message', 'select_model'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'API',
        url: 'https://api.z.ai/v1',
        endpoint_type: 'api',
        is_default: true,
        composer_type: 'textarea',
        send_method: 'both',
        content_editable: false,
      },
    ],
    models: [
      {
        slug: 'z-ai-default',
        display_name: 'Z AI Default',
        is_default: true,
        context_window: 128000,
        max_output_tokens: 4096,
        supports_streaming: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [
          {
            type: 'retry_selector',
          },
        ],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to Z AI',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      {
        key: 'base_url',
        value: 'https://api.z.ai/v1',
      },
      {
        key: 'auth_type',
        value: 'api_key',
      },
    ],
  },
  {
    $schema: 'https://vivim.app/cap-store/v1/provider-manifest.schema.json',
    provider: {
      slug: 'opencode',
      display_name: 'OpenCode Local Agent',
      description:
        'Local agentic backbone powered by the opencode CLI. Runs one-shot agentic tasks with no API key using verified free models.',
      category: 'ai',
      provider_type: 'local-agent',
      website_url: 'https://opencode.ai',
      auth_type: 'none',
      has_multi_account: false,
      profile_strategy: 'single',
      capabilities: ['agent_run'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Local CLI',
        url: 'opencode://local',
        endpoint_type: 'api',
        is_default: true,
        composer_type: 'textarea',
        send_method: 'both',
        content_editable: false,
      },
    ],
    models: [
      {
        slug: 'qwen3.5-3b-free',
        display_name: 'Qwen 3.5 3B (free)',
        is_default: true,
        context_window: 131072,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_tools: true,
      },
      {
        slug: 'glm4.5-air-free',
        display_name: 'GLM 4.5 Air (free)',
        context_window: 128000,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_tools: true,
      },
      {
        slug: 'deepseek-v3.2-free',
        display_name: 'DeepSeek V3.2 (free)',
        context_window: 128000,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_tools: true,
      },
      {
        slug: 'grok4-fast-free',
        display_name: 'Grok 4 Fast (free)',
        context_window: 131072,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_tools: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'agent_run',
        recovery_strategies: [{ type: 'retry_selector' }],
        ui_component_override: 'text_input',
        ui_label_override: 'Run agent task',
        ui_icon_override: 'terminal',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      {
        key: 'transport',
        value: 'opencode-cli',
      },
      {
        key: 'run_mode',
        value: 'one-shot',
      },
    ],
  },
  // ── Grok (xAI) ────────────────────────────────────────────────────────────
  // Selectors are placeholders — the agent discovers these during exploration.
  {
    provider: {
      slug: 'grok',
      display_name: 'Grok',
      description: "xAI's Grok AI assistant",
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://x.com/i/grok',
      auth_type: 'browser',
      has_multi_account: false,
      profile_strategy: 'per_account',
      fleet_config: {
        port_range: [9412, 9440],
      },
      capabilities: ['send_message', 'create_new_chat', 'navigate_chat', 'delete_chat'],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Landing',
        url: 'https://x.com/i/grok',
        endpoint_type: 'landing',
        is_default: true,
      },
      {
        label: 'Chat',
        url: 'https://x.com/i/grok',
        endpoint_type: 'chat',
        selector: {
          composer: '',
          send_button: '',
        },
        composer_type: 'textarea',
        send_method: 'both',
        content_editable: false,
      },
      {
        label: 'Login',
        url: 'https://x.com/i/flow/login',
        endpoint_type: 'login',
      },
    ],
    models: [
      {
        slug: 'grok-3',
        display_name: 'Grok 3',
        is_default: true,
        context_window: 131072,
        max_output_tokens: 8192,
        supports_streaming: true,
        supports_tools: true,
      },
      {
        slug: 'grok-3-mini',
        display_name: 'Grok 3 Mini',
        context_window: 131072,
        max_output_tokens: 8192,
        supports_streaming: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [{ type: 'retry_selector' }, { type: 'navigate_home' }],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to Grok',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      { key: 'base_url', value: 'https://x.com' },
      { key: 'auth_type', value: 'x.com' },
    ],
  },
  // ── Mistral (Le Chat) ─────────────────────────────────────────────────────
  // Selectors are placeholders — the agent discovers these during exploration.
  {
    provider: {
      slug: 'mistral',
      display_name: 'Mistral',
      description: "Mistral AI's Le Chat assistant",
      category: 'ai',
      provider_type: 'llm',
      website_url: 'https://chat.mistral.ai',
      auth_type: 'browser',
      has_multi_account: false,
      profile_strategy: 'per_account',
      fleet_config: {
        port_range: [9442, 9470],
      },
      capabilities: [
        'send_message',
        'select_model',
        'create_new_chat',
        'navigate_chat',
        'delete_chat',
      ],
      accessTier: 'premium',
    },
    endpoints: [
      {
        label: 'Landing',
        url: 'https://chat.mistral.ai',
        endpoint_type: 'landing',
        is_default: true,
      },
      {
        label: 'Chat',
        url: 'https://chat.mistral.ai/chat',
        endpoint_type: 'chat',
        selector: {
          composer: '',
          send_button: '',
        },
        composer_type: 'textarea',
        send_method: 'both',
        content_editable: false,
      },
    ],
    models: [
      {
        slug: 'mistral-large',
        display_name: 'Mistral Large',
        is_default: true,
        context_window: 131072,
        max_output_tokens: 32768,
        supports_streaming: true,
        supports_tools: true,
      },
      {
        slug: 'mistral-medium',
        display_name: 'Mistral Medium',
        context_window: 32768,
        max_output_tokens: 8192,
        supports_streaming: true,
      },
      {
        slug: 'codestral',
        display_name: 'Codestral',
        context_window: 32768,
        max_output_tokens: 8192,
        supports_streaming: true,
      },
    ],
    capabilities_config: [
      {
        global_capability_id: 'send_message',
        recovery_strategies: [{ type: 'retry_selector' }, { type: 'navigate_home' }],
        ui_component_override: 'text_input',
        ui_label_override: 'Send to Mistral',
        ui_icon_override: 'arrow-up-circle',
        ui_position_override: 'composer',
        ui_priority_override: 'primary',
      },
    ],
    config: [
      { key: 'base_url', value: 'https://chat.mistral.ai' },
      { key: 'auth_type', value: 'email' },
    ],
  },
]
```
