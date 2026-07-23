# StreamParserEngine

## Overview

Parses raw provider response bytes into typed `ContentBlock[]` (text, reasoning, tool-call, file, error, etc.). All parser logic lives in the DB as inline `logic_code`; the engine is a loader/executor with a DB-driven fallback chain.

## Governing Source Files

| File | Role |
|------|------|
| `src/engines/stream-parser.ts` | `StreamParserEngine` — main class. `parse(rawBody, providerId)` resolves the best parser: (a) fast path via `resolvePrimed` (zero DB reads when cache is primed from generated protocol), or (b) walks `resolveFallbackChain()` (provider → fallbackParserId → generic → system). Parsers are loaded via `loadModuleFromRow` which supports `inline` (via `SandboxRunner`) and gated `file` logic. Validates blocks against `ContentPartSchema`, classifies diagnostics, detects wire format. `primeFromProtocol(protocol)` pre-compiles active parsers from the generated protocol into `primedParsers`. |
| `src/engines/stream-align.ts` | `StreamAlignmentEngine` — validates that the configured parser(s) actually parse captured real-world streams. `alignCaptured(bodies, providerId)` returns `AlignmentReport` with inferred format, detected delta path, mismatches, and suggestions. `computeParserHash` produces stable hashes for cache invalidation. |
| `src/engines/protocol-discovery.ts` | `ProtocolDiscoveryEngine` — auto-discovers the provider's wire format, network streaming endpoints, and composer/send DOM indicators. Collects `Network.requestWillBeSent`, `Network.responseReceived`, `Network.responseReceivedExtraInfo` events via `CdpSender` and classifies them. |
| `src/engines/sandbox-runner.ts` | `SandboxRunner` — executes inline parser `logic_code` in a bounded sandbox (no `fetch`, no file I/O, no clipboard). Uses a frozen `vm` context with `module`/`exports` globals. |
| `src/engines/parser-repair.ts` | Repair loop for low-confidence parsers: regenerates or patches `logic_code` when `StreamParserEngine` reports confidence below threshold. |
| `src/schema/streaming.ts` | `ContentPartSchema` (Zod schema for `ContentBlock`), `isLegacyBlock`, `migrateLegacyParts` — normalises old `{kind,content,index}` blocks to canonical `{type,text,...}`. |

## Storage Contracts

| File | Role |
|------|------|
| `src/storage/contracts/parser-store.ts` | `ParserStore` — `getParserByProviderAndVersion(providerId, version?)`, `getParserById`, `getGenericParser`, `getSystemFallbackParser`. `ProviderParserRow` carries `logicType`, `logicCode`, `fallbackParserId`, `hash`. Entire fallback chain is data-driven. |
| `src/storage/contracts/parser-execution-log-store.ts` | `ParserExecutionLogStore` — logs every parse execution for telemetry (`logExecution`, `getRecentByProvider`, `getLowConfidenceEntries`, `getStatsByProvider`). |

## Key Types and Interfaces

```typescript
// From src/engines/stream-parser.ts
export type ContentBlock = ContentPart

export interface ParserModule {
  name: string
  version: number
  providerId: string
  parse(rawBody: string): ContentBlock[]
  detectCompletion(rawBody: string): boolean
  getConfidence(rawBody: string): number
}

export interface BlockDiagnostics {
  textBlocks: number
  toolCallBlocks: number
  fileBlocks: number
  errorBlocks: number
  reasoningBlocks: number
  codeBlocks: number
  sourceBlocks: number
}

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
  blockDiagnostics: BlockDiagnostics
  wireFormat: WireFormat
  fallbackDepth: number
  rawSizeBytes: number
}

export interface ParserConfig {
  fallbackTimeoutMs: number
  maxRetries: number
  confidenceMinThreshold: number
  preloadProviders?: string[]
  allowFileLogic?: boolean
}
```

## Data Flow

1. **Boot Priming**: `parserEngine.primeFromProtocol(protocol)` loads inline `logic_code` from generated protocol → `primedParsers` cache → **zero DB reads** on hot path
2. **Parse Request**: `parser.parse(rawBody, providerId)` → `resolvePrimed(providerId, rawBody)` → if hit, normalize + classify + return
3. **Fallback Chain**: If no prime hit → `resolveFallbackChain(providerId)` → walks `fallbackParserId` edges in DB → loads each via `loadModuleFromRow` (SandboxRunner for inline) → first success wins
4. **Block Validation**: `normalizeBlocks()` → `validateBlocks()` enforces `ContentPartSchema` — drops malformed parts
5. **Wire Detection**: `detectWireFormat(raw)` classifies input as SSE, NDJSON, JSON-array, batchexecute, XSSI, or plain-text
6. **Logging**: `logParseResult()` writes to `ParserExecutionLogStore` (best-effort, never blocks parse)

## Critical Patterns

- **DB-Only Logic**: `allowFileLogic` is `false` by default. Engine only executes DB-stored inline/composed logic
- **Primed Cache**: `primedParsers` keyed by `${providerId}/${version}` — hot path bypasses DB entirely
- **Fallback Chain**: Data-driven via `fallbackParserId` edge. No hardcoded provider→generic→system tiers
- **Cycle Guard**: `resolveFallbackChain` uses `visited` Set to prevent infinite loops
- **Schema Boundary**: `ContentPartSchema.safeParse()` validates every block at parser boundary — malformed parts dropped with warning
- **Legacy Migration**: `isLegacyBlock()` + `migrateLegacyParts()` auto-converts old `{kind,content,index}` blocks

## Wire Format Detection Heuristics

```typescript
function detectWireFormat(raw: string): WireFormat {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith('data:') || trimmed.includes('\n\n')) {
    if (trimmed.includes('data:')) return 'sse'
  }
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) return 'json-array'
    } catch { /* partial */ }
  }
  if (trimmed.includes(")]}'") || trimmed.startsWith(')]}')) return 'xssi'
  if (trimmed.includes('$rpc')) return 'batchexecute'
  const lines = trimmed.split('\n').filter((l) => l.trim())
  if (lines.length > 0 && lines.every((l) => { try { JSON.parse(l); return true } catch { return false } }))
    return 'ndjson'
  if (lines.some((l) => l.startsWith('data:') || l.startsWith('event:'))) return 'sse'
  return 'plain-text'
}
```

## System Connections

- **ConversationManager**: calls `parser.parse(rawBody, conv.providerId)` after CDP capture
- **ProviderRegistrar**: seeds parser variants into DB during `register()` (idempotent upsert) and wires `fallbackParserId` two-pass so the DB graph reflects the manifest fallback chain
- **ProviderProtocolLoader**: generated static protocol file is loaded at boot and injected into `primeFromProtocol`
- **StreamBlockStore**: receives `ParseResult.blocks` + `blockMeta` (parserName, confidence, wireFormat)
