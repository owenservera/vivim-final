# Provider Logic Implementation Strategy — Runtime Loading Analysis

**Date:** 2026-07-11
**Purpose:** Analyze current provider logic architecture and propose DB-driven runtime loading
**Status:** Analysis complete, implementation plan ready

---

## Executive Summary

**Current state:** Parser logic is hardcoded to `.ts` source files, loaded via `dynamic import()`. Provider configurations are duplicated across 3 locations. Users cannot customize parsers without code changes.

**Target state:** Parser logic stored in DB as typed code strings, loaded at runtime based on user setup. Single source of truth for all provider configurations. Hot-reload on config change.

---

## Current Architecture Issues

### Issue 1: Parser Logic Not in DB

**Current flow:**
```
ProviderParser row in DB
  → parserLogicType: 'file' (only valid value)
  → parserFilePath: 'chatgpt/001_openai_sse.ts'
  → StreamParserEngine.loadProviderParser()
    → import(filePath)  // File-system dependent
    → return ParserModule
```

**Problems:**
- Parser code lives in `.ts` files, not in DB
- Users can't customize parsers without modifying source files
- Parser updates require code changes + redeployment
- Breaks in serverless/edge environments where file system isn't accessible

**Evidence:**
- `ProviderParser.parserLogicType` field exists but only supports `'file'`
- `StreamParserEngine.resolveModule()` uses `import(filePath)` 
- Design doc D3 explicitly says: "No `parser_logic_type` distinction — all are file-based"

### Issue 2: Provider Configurations Duplicated

**Three locations with same data:**

| Location | Purpose | Content |
|----------|---------|---------|
| `seeds/providers/*.json` | Manifest seeds | Provider defs, endpoints, models, parsers, capabilities |
| `provider-logic/configurations/provider-configurations.ts` | Hardcoded constants | Same data as TypeScript constants |
| `provider-logic/providers/*.json` | Duplicate manifests | Copy of seeds |

**Problems:**
- Maintenance burden (update 3 places for one change)
- Potential drift between locations
- No single source of truth

### Issue 3: No Runtime Customization

Users cannot:
- Override parser logic per-provider without code changes
- A/B test different parser implementations
- Deploy custom parsers without redeployment
- Modify completion signals or delta paths

---

## Proposed Architecture: DB-Driven Runtime Loading

### Phase 1: Extend ProviderParser Model

**New fields:**
```prisma
model ProviderParser {
  id               String  @id
  providerId       String  @map("provider_id")
  parserName       String  @map("parser_name")
  parserVersion    Int     @default(1) @map("parser_version")
  parserLogicType  String  @default("file") @map("parser_logic_type")  // 'file' | 'inline' | 'composed'
  parserFilePath   String? @map("parser_file_path")
  parserLogicCode  String? @map("parser_logic_code")  // NEW: inline TypeScript/JavaScript
  parserHash       String? @map("parser_hash")
  isActive         Int     @default(1) @map("is_active")
  fallbackParserId String? @map("fallback_parser_id")
  createdAt        Int     @map("created_at")
  updatedAt        Int     @map("updated_at")
}
```

**Loading strategy:**
```typescript
async loadProviderParser(providerId: string): Promise<ParserModule> {
  const row = await this.store.getActiveParser(providerId)
  if (!row) return this.loadBuiltin(providerId)
  
  // Strategy 1: Load from inline code in DB
  if (row.parserLogicType === 'inline' && row.parserLogicCode) {
    return this.loadInlineParser(row.parserLogicCode, row.parserHash)
  }
  
  // Strategy 2: Load from file (current behavior)
  if (row.parserLogicType === 'file' && row.parserFilePath) {
    return this.loadFileParser(row.filePath, row.parserHash)
  }
  
  // Strategy 3: Fallback to builtin
  return this.loadBuiltin(providerId)
}
```

### Phase 2: Add ProviderStreamConfig Model

**New model:**
```prisma
model ProviderStreamConfig {
  id                    String  @id
  providerId            String  @map("provider_id")
  streamTransport       String           // 'sse' | 'batchexecute' | 'websocket' | 'sse-patch'
  streamTerminalJson    String  @default("[]") @map("stream_terminal_json")
  sseFormat             String? @map("sse_format")  // 'openai' | 'anthropic' | 'gemini' | 'generic'
  deltaPathJson         String? @map("delta_path_json")
  contentType           String? @map("content_type")
  completionDetectorsJson String @default("[]") @map("completion_detectors_json")
  harnessJs             String? @map("harness_js")
  isActive              Int     @default(1) @map("is_active")
  version               Int     @default(1)
  supersededById        String? @map("superseded_by")
  createdAt             Int     @map("created_at")
  updatedAt             Int     @map("updated_at")
  
  provider     ProviderDefinition     @relation(fields: [providerId], references: [id], onDelete: Cascade)
  supersededBy ProviderStreamConfig?  @relation("SuperStreamConfig", fields: [supersededById], references: [id])
  
  @@unique([providerId, streamTransport, version])
  @@map("provider_stream_config")
}
```

**Usage:**
```typescript
async detectCompletion(rawBody: string, providerId: string): Promise<boolean> {
  const config = await this.store.getStreamConfig(providerId)
  if (!config) return rawBody.length > 0
  
  const detectors = JSON.parse(config.completionDetectorsJson)
  for (const detector of detectors) {
    if (detector.type === 'data-value' && rawBody.includes(detector.pattern)) return true
    if (detector.type === 'event-type' && rawBody.includes(`"type":"${detector.pattern}"`)) return true
  }
  return false
}
```

### Phase 3: Inline Parser Compilation

**For `inline` parsers, compile TypeScript at runtime:**

```typescript
import { transform } from 'esbuild'

async loadInlineParser(code: string, hash: string): Promise<ParserModule> {
  // Check cache
  const cached = this.inlineCache.get(hash)
  if (cached) return cached
  
  // Compile TypeScript to JavaScript
  const result = await transform(code, {
    loader: 'ts',
    format: 'esm',
    target: 'esnext',
  })
  
  // Create module from compiled code
  const blob = new Blob([result.code], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  const imported = await import(url)
  
  const module = (imported.default ?? imported) as ParserModule
  this.inlineCache.set(hash, module)
  URL.revokeObjectURL(url)
  
  return module
}
```

### Phase 4: Unified Provider Configuration

**Single source of truth in DB:**

```typescript
// ProviderRegistrar reads from DB, not files
async getProviderConfig(slug: string): Promise<ProviderConfig> {
  const definition = await this.store.getDefinitionBySlug(slug)
  const endpoints = await this.store.getEndpoints(definition.id)
  const models = await this.store.getModels(definition.id)
  const parsers = await this.store.getParsers(definition.id)
  const capabilities = await this.store.getCapabilities(definition.id)
  const configs = await this.store.getConfigs(definition.id)
  const streamConfig = await this.store.getStreamConfig(definition.id)
  
  return {
    definition,
    endpoints,
    models,
    parsers,
    capabilities,
    configs,
    streamConfig,
  }
}
```

---

## Implementation Plan

### Step 1: Database Migration

```bash
bunx prisma migrate dev --name add_inline_parser_and_stream_config
```

**New tables:**
- `provider_stream_config` (new model)
- `provider_parser.parser_logic_code` (new field)

### Step 2: Update ParserStore Contract

```typescript
export interface ProviderParserRow {
  id: string
  providerId: string
  name: string
  version: number
  filePath: string | null
  logicCode: string | null  // NEW
  logicType: string
  hash: string
  isActive: number
  createdAt: number
  updatedAt: number
}
```

### Step 3: Update StreamParserEngine

```typescript
export class StreamParserEngine {
  private inlineCache = new Map<string, ParserModule>()
  
  async loadProviderParser(providerId: string): Promise<ParserModule> {
    const row = await this.store.getActiveParser(providerId)
    if (!row) return this.loadBuiltin(providerId)
    
    const cached = this.parserCache.get(providerId)
    if (cached && cached.hash === row.hash) return cached.module
    
    let module: ParserModule
    
    if (row.logicType === 'inline' && row.logicCode) {
      module = await this.loadInlineParser(row.logicCode, row.hash)
    } else if (row.logicType === 'file' && row.filePath) {
      module = await this.loadFileParser(row.filePath, row.hash)
    } else {
      module = this.loadBuiltin(providerId)
    }
    
    this.parserCache.set(providerId, { module, hash: row.hash })
    return module
  }
}
```

### Step 4: Update ProviderRegistrar

**Remove hardcoded configurations:**
- Delete `provider-logic/configurations/provider-configurations.ts`
- Delete `provider-logic/providers/*.json` (duplicates)
- Keep only `seeds/providers/*.json` as initial seed data

**Add inline parser support:**
```typescript
// When registering a provider, optionally store parser logic inline
if (manifest.parsers[0].logicCode) {
  parserRow.parser_logic_code = manifest.parsers[0].logicCode
  parserRow.parser_logic_type = 'inline'
}
```

### Step 5: Add Stream Config Ingestion

```typescript
// In ProviderRegistrar.register()
if (manifest.streamConfig) {
  const streamConfigRow = {
    id: newId(),
    provider_id: providerId,
    stream_transport: manifest.streamConfig.transport,
    stream_terminal_json: JSON.stringify(manifest.streamConfig.terminal),
    sse_format: manifest.streamConfig.sseFormat ?? null,
    delta_path_json: manifest.streamConfig.deltaPath ?? null,
    completion_detectors_json: JSON.stringify(manifest.streamConfig.completionDetectors),
    version: 1,
    created_at: now,
    updated_at: now,
  }
  await this.store.upsertStreamConfig(streamConfigRow)
}
```

---

## Provider Configuration Matrix

### Current State (Duplicated)

| Provider | seeds/ | provider-logic/config/ | provider-logic/providers/ |
|----------|--------|------------------------|---------------------------|
| chatgpt | ✓ | ✓ (duplicate) | ✓ (duplicate) |
| claude | ✓ | ✓ (duplicate) | ✓ (duplicate) |
| gemini | ✓ | ✓ (duplicate) | ✓ (duplicate) |
| deepseek | ✓ | ✓ (duplicate) | ✓ (duplicate) |
| qwen | ✓ | ✗ | ✓ (duplicate) |
| studio-ai | ✓ | ✓ (duplicate) | ✓ (duplicate) |
| z-ai | ✓ | ✓ (duplicate) | ✓ (duplicate) |

### Target State (Single Source)

| Provider | DB (source of truth) | seeds/ (initial seed) |
|----------|---------------------|----------------------|
| chatgpt | ✓ | ✓ (seed only) |
| claude | ✓ | ✓ (seed only) |
| gemini | ✓ | ✓ (seed only) |
| deepseek | ✓ | ✓ (seed only) |
| qwen | ✓ | ✓ (seed only) |
| studio-ai | ✓ | ✓ (seed only) |
| z-ai | ✓ | ✓ (seed only) |

---

## Parser Loading Strategy

### Fallback Chain

```
1. Check DB for active parser (parserLogicType = 'inline')
   → Compile TypeScript → Cache → Return

2. Check DB for active parser (parserLogicType = 'file')
   → import(filePath) → Cache → Return

3. Check config for generic file path
   → import(genericFilePath) → Cache → Return

4. Use builtin parser
   → Return builtin function
```

### Cache Invalidation

```typescript
// On parser update
async onParserUpdated(providerId: string, newHash: string): Promise<void> {
  // Clear file-based cache
  this.parserCache.delete(providerId)
  
  // Clear inline cache
  for (const [key, _] of this.inlineCache) {
    if (key.startsWith(providerId)) {
      this.inlineCache.delete(key)
    }
  }
  
  // Preload new parser
  await this.loadProviderParser(providerId)
}
```

---

## Benefits of DB-Driven Loading

### 1. Runtime Customization
- Users can override parser logic via API
- A/B test different parser implementations
- Deploy custom parsers without code changes

### 2. Single Source of Truth
- All provider configs in DB
- No duplication across files
- Automatic drift detection

### 3. Hot-Reload
- Parser updates take effect immediately
- No server restart required
- Version chain for rollback

### 4. Portability
- Works in serverless/edge environments
- No file system dependency
- Easy backup/restore

### 5. Auditability
- All parser changes tracked in DB
- Version history preserved
- Change attribution

---

## Migration Checklist

- [ ] Add `parser_logic_code` field to `ProviderParser`
- [ ] Create `ProviderStreamConfig` model
- [ ] Update `ParserStore` contract
- [ ] Update `StreamParserEngine` for inline loading
- [ ] Update `ProviderRegistrar` for stream config
- [ ] Add esbuild dependency for TS compilation
- [ ] Create migration script for existing parsers
- [ ] Update provider seed format to include stream config
- [ ] Delete duplicate `provider-logic/configurations/`
- [ ] Delete duplicate `provider-logic/providers/`
- [ ] Write tests for inline parser loading
- [ ] Write tests for stream config detection
- [ ] Update documentation

---

## Estimated Effort

| Phase | LOC | Effort |
|-------|-----|--------|
| Phase 1: DB Migration | ~50 | 30 min |
| Phase 2: ParserStore Update | ~100 | 1 hour |
| Phase 3: StreamParserEngine Update | ~150 | 2 hours |
| Phase 4: ProviderRegistrar Update | ~100 | 1 hour |
| Phase 5: Cleanup Duplicates | ~-500 | 30 min |
| **Total** | **~400** | **~5 hours** |

---

## Design Invariants Preserved

1. **Fallback chain intact** - inline → file → generic → builtin
2. **Cache invalidation works** - hash-based cache keys
3. **Type safety maintained** - ParserModule interface unchanged
4. **Backward compatible** - existing file-based parsers still work
5. **No breaking changes** - additive only
