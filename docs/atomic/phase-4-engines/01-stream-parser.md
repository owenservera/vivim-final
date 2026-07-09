# Unit 4.1: StreamParserEngine

**Phase:** 4 | **File:** `src/engines/stream-parser.ts`
**Depends:** 1.4 CapStoreDb, 2.4 ExecutionMemoizer | **Produces:** Parsed ContentBlock[] from provider responses
**Source:** `04-merged-engines.md` §3

## Purpose
Parse raw provider API responses (SSE text, batchexecute JSON, OpenAI-SSE) into typed `ContentBlock[]`. Loads parser modules from `.ts` seed files via dynamic `import()`.

## Interface
```typescript
class StreamParserEngine {
  constructor(
    private store: ParserStore,
    private config?: ParserConfig,
  ) {}

  async parse(rawBody: string, providerId: string): Promise<ParseResult>;
  async detectCompletion(rawBody: string, providerId: string): Promise<boolean>;
  async reloadParser(providerId: string): Promise<void>;
  async preloadAll(): Promise<void>;

  private async loadParser(providerId: string): Promise<ParserModule>;
  private parserCache: Map<string, { module: ParserModule; hash: string }>;
}

interface ParseResult {
  blocks: ContentBlock[];
  confidence: number;
  parserName: string;
  parserVersion: number;
  durationMs: number;
}

interface ParserConfig {
  fallbackTimeoutMs: number;
  maxRetries: number;
  confidenceMinThreshold: number;
}
```

## ParserModule Contract
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

## Fallback Chain
```
Claude  → seeds/parsers/claude/001_streaming_sse.ts → (on failure) → generic/001_sse_frames.ts → system/001_fallback.ts
Gemini  → seeds/parsers/gemini/001_batchexecute.ts → (on failure) → system/001_fallback.ts
ChatGPT → seeds/parsers/chatgpt/001_openai_sse.ts → (on failure) → generic/001_sse_frames.ts → system/001_fallback.ts
Others  → seeds/parsers/generic/001_sse_frames.ts → (on failure) → system/001_fallback.ts (always succeeds)
```

## Store Contract
```typescript
interface ParserStore {
  getParser(providerId: string): Promise<ProviderParserRow | null>;
  getActiveParser(providerId: string): Promise<ProviderParserRow | null>;
  upsertParser(parser: ProviderParserRow): Promise<void>;
  listParsers(providerId: string): Promise<ProviderParserRow[]>;
  getParserByFile(filePath: string): Promise<ProviderParserRow | null>;
}
```

## Tests
- [ ] `parse()` parses SSE body into ContentBlock[] using correct provider parser
- [ ] `parse()` falls back to fallback parser on failure
- [ ] `parse()` returns error block when all parsers fail
- [ ] `detectCompletion()` returns true for complete responses
- [ ] `reloadParser()` re-imports parser module on file change
- [ ] `preloadAll()` loads all active parsers into memory
- [ ] Parser confidence updated in provider_capability after each parse

## Gate
- `bunx tsc --noEmit` passes
- Parses canned SSE for Claude, Gemini, ChatGPT
- Fallback parser always succeeds
