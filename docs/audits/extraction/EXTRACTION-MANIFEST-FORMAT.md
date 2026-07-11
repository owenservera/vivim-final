# Extraction Manifest Format

**Purpose:** Standardized JSON format for data extracted from original codebases.
**Validation:** Zod schema at `src/schema/extracted-manifest.ts`
**Files:** `data/extracted/{source}-manifest.json`

---

## Top-Level Structure

```typescript
interface ExtractedManifest {
  manifestVersion: "1.0"
  sourceCodebase: "cap-store" | "cap-lab" | "backend"
  extractedAt: number          // Unix timestamp (ms)
  chromeVersion?: string       // Chrome version if known

  cdpMethods: CdpMethodEntry[]
  capabilities: ExtractedCapability[]
  streamConfigs: ExtractedStreamConfig[]
  providers: ExtractedProvider[]
  pureFunctions: ExtractedPureFunction[]
}
```

---

## `CdpMethodEntry`

Every CDP method call found in the source codebase.

```typescript
interface CdpMethodEntry {
  method: string              // "Page.navigate"
  domain: string              // "Page"
  paramsUsed: string[]        // ["url"] — parameters actually used in calls
  usedFor: string[]           // ["send_message", "create_new_chat"] — capability slugs
  sourceFiles: string[]       // ["src/cdp/client.ts:142", "src/cdp/locator.ts:87"]
  sourceCodebase: "cap-store" | "cap-lab" | "backend"

  // Versioning
  chromeVersion?: string      // Chrome version if known
  isDeprecated?: boolean      // true if deprecated in newer Chrome
  notes?: string              // Additional context
}
```

### Example
```json
{
  "method": "Input.insertText",
  "domain": "Input",
  "paramsUsed": ["text"],
  "usedFor": ["send_message", "edit_message"],
  "sourceFiles": ["src/cdp/input.ts:45", "src/cdp/input.ts:78"],
  "sourceCodebase": "cap-lab",
  "chromeVersion": "125+",
  "notes": "Required for ProseMirror contenteditable. isTrusted=true."
}
```

---

## `ExtractedCapability`

Every capability definition found in the source codebase.

```typescript
interface ExtractedCapability {
  slug: string                        // "send_message"
  displayName: string                 // "Send Message"
  category: string                    // "conversation" | "session" | "navigation"
  inputType: string                   // "text" | "void" | "file"
  providerIds: string[]               // ["claude", "chatgpt", "gemini"]
  cdpMethods: string[]                // ["Input.insertText", "Input.dispatchKeyEvent"]
  selectorHints: Record<string, string>  // { "composer": "div[contenteditable]", "send": "button[aria-label='Send']" }
  sourceFiles: string[]
  sourceCodebase: string
  notes?: string
}
```

### Example
```json
{
  "slug": "send_message",
  "displayName": "Send Message",
  "category": "conversation",
  "inputType": "text",
  "providerIds": ["claude", "chatgpt", "gemini", "deepseek"],
  "cdpMethods": ["Input.insertText", "Input.dispatchKeyEvent"],
  "selectorHints": {
    "claude": { "composer": "div[contenteditable='true']" },
    "chatgpt": { "composer": "#prompt-textarea" },
    "gemini": { "composer": ".ql-editor" }
  },
  "sourceFiles": ["src/providers/registry.ts:25", "src/recipe/schema.ts:12"],
  "sourceCodebase": "cap-lab"
}
```

---

## `ExtractedStreamConfig`

Per-provider streaming transport configuration.

```typescript
interface ExtractedStreamConfig {
  providerId: string                   // "claude"
  streamTransport: "sse" | "batchexecute" | "websocket" | "sse-patch"
  streamTerminal: string[]             // ["message_stop"] — completion signals
  sseFormat?: "openai" | "anthropic" | "gemini" | "generic"
  urlPattern?: string                  // "claude.ai/api"
  contentType?: string                 // "text/event-stream"

  // Delta extraction
  deltaPath?: string                   // "delta.content" — JSON path to delta content
  completionDetectors: {
    pattern: string                    // "message_stop" or "[DONE]"
    type: "event-type" | "data-value" | "json-path"
  }[]

  // Per-provider specifics
  composerSelector?: string            // "div[contenteditable='true']"
  composerIsContentEditable?: boolean
  harnessJs?: string                   // In-page fetch/XHR monkey-patch code
  localeVariants?: Record<string, string>  // { "New chat": "Nueva conversación" }

  // Versioning
  version: number
  supersededById?: string              // Previous version ID

  sourceFiles: string[]
  sourceCodebase: string
}
```

### Example
```json
{
  "providerId": "claude",
  "streamTransport": "sse",
  "streamTerminal": ["message_stop"],
  "sseFormat": "anthropic",
  "urlPattern": "claude.ai/api",
  "contentType": "text/event-stream",
  "deltaPath": "delta.content",
  "completionDetectors": [
    { "pattern": "message_stop", "type": "event-type" },
    { "pattern": "[DONE]", "type": "data-value" }
  ],
  "composerSelector": "div[contenteditable='true']",
  "composerIsContentEditable": true,
  "localeVariants": { "New chat": "Nueva conversación" },
  "version": 1,
  "sourceFiles": ["src/providers/registry.ts:35", "src/parsers/sse.ts:10"],
  "sourceCodebase": "cap-lab"
}
```

---

## `ExtractedProvider`

Provider definition extracted from source.

```typescript
interface ExtractedProvider {
  slug: string
  displayName: string
  description?: string
  category: string                      // "ai"
  providerType: string                  // "llm"
  websiteUrl?: string
  authType: string                      // "browser"
  hasMultiAccount: boolean
  profileStrategy: string               // "per_account"

  endpoints: {
    url: string
    type: string                        // "landing" | "chat" | "login"
    selectors?: Record<string, string>
  }[]

  models: {
    slug: string
    displayName: string
    isDefault?: boolean
    contextWindow?: number
    maxOutputTokens?: number
    supportsStreaming: boolean
    supportsVision: boolean
    supportsThinking: boolean
    supportsTools: boolean
  }[]

  capabilities: string[]                // capability slugs

  sourceFiles: string[]
  sourceCodebase: string
}
```

---

## `ExtractedPureFunction`

Harvestable pure function extracted from source.

```typescript
interface ExtractedPureFunction {
  name: string                    // "confidence" | "autoStatus" | "classifySeverity"
  purpose: string                 // "Multi-factor confidence scoring"
  sourceFile: string              // "src/confidence.ts:57-66"
  sourceCodebase: string
  loc: number                     // Lines of code
  dependencies: string[]          // ["none"] or ["zod"] — runtime deps
  inputs: string[]                // Parameter types
  outputType: string              // Return type

  // What it needs from vivim-final
  vivimTargetFile?: string        // "src/engines/confidence-score.ts"
  vivimTargetFunction?: string    // "computeConfidence"
  schemaFieldsUsed?: string[]     // ["CapabilityBinding.confidence", "Outcome.ok"]
}
```

### Example
```json
{
  "name": "confidence",
  "purpose": "Multi-factor confidence scoring (status, success rate, recency, replay, drift, patterns)",
  "sourceFile": "src/confidence.ts:57-168",
  "sourceCodebase": "cap-store",
  "loc": 168,
  "dependencies": ["none"],
  "inputs": ["ConfidenceInput"],
  "outputType": "number",
  "vivimTargetFile": "src/engines/confidence-score.ts",
  "vivimTargetFunction": "computeConfidence",
  "schemaFieldsUsed": ["CapabilityBinding.confidence", "Outcome.ok", "Outcome.ts"]
}
```

---

## Validation

The manifest is validated at load time using Zod schemas:

```typescript
// src/schema/extracted-manifest.ts
import { z } from 'zod'

const CdpMethodEntrySchema = z.object({
  method: z.string(),
  domain: z.string(),
  paramsUsed: z.array(z.string()),
  usedFor: z.array(z.string()),
  sourceFiles: z.array(z.string()),
  sourceCodebase: z.enum(["cap-store", "cap-lab", "backend"]),
  chromeVersion: z.string().optional(),
  isDeprecated: z.boolean().optional(),
  notes: z.string().optional(),
})

const ExtractedManifestSchema = z.object({
  manifestVersion: z.literal("1.0"),
  sourceCodebase: z.enum(["cap-store", "cap-lab", "backend"]),
  extractedAt: z.number(),
  chromeVersion: z.string().optional(),
  cdpMethods: z.array(CdpMethodEntrySchema),
  capabilities: z.array(ExtractedCapabilitySchema),
  streamConfigs: z.array(ExtractedStreamConfigSchema),
  providers: z.array(ExtractedProviderSchema),
  pureFunctions: z.array(ExtractedPureFunctionSchema),
})
```
