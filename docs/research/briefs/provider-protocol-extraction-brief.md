# Provider Protocol Extraction & Parsing — Brief

**Source:** 4-phase research (CDP automation, SSE/streaming, batchexecute/XSSI, browser automation for AI agents)
**Confidence:** High | **Sources:** 17 | **Date:** 2026-07-23

## TL;DR

Our provider protocol extraction pipeline follows CDP-direct patterns (preferred for agent use cases) and has several innovations ahead of the ecosystem. Two adoption opportunities: (1) adopt `eventsource-parser` for better SSE spec compliance, (2) extract batchexecute utility as first TypeScript library.

## Key Decisions

1. **CDP-direct over Playwright-wrappers** — Aligned with industry trend; Bun.WebView gives direct protocol access without abstraction overhead
2. **Boot-time priming eliminates DB reads** — `primeFromProtocol()` compiles parser logicCode at startup, caches in memory; zero DB queries during parsing
3. **Data-driven fallback chain** — Provider → generic → system (all from DB, not hardcoded tiers); allows runtime reconfiguration
4. **Wire format detection** — `detectWireFormat()` auto-identifies SSE, NDJSON, JSON array, batchexecute, XSSI, plain text
5. **Custom SSE parsing** — Handles provider-specific quirks (Claude's `content_block_start/delta`, ChatGPT's `choices[].delta.content`)

## Evidence Summary

- **CDP-direct camp (SOC-AI, 2026):** Bifurcation into Playwright-wrappers vs CDP-direct; CDP-direct chosen for agent use cases (source: socai-io/browser-automation-evolution.md)
- **eventsource-parser (484 stars, 0 deps):** Spec-compliant SSE parser, `createParser()` returns iterator, MIT, 788 dependents (source: eventsource-parser)
- **pybatchexecute (Python):** Google batch RPC encoding/decoding, XSSI prefix stripping (source: pybatchexecute)
- **No TypeScript batchexecute library** — significant ecosystem gap (source: go-notebooklm, batchexecute-go)
- **Vercel AI SDK v5:** Protocol-level streaming via `pipeDataStreamToResponse()` (source: vercel-ai-sdk)

## Comparison Matrix

| Aspect | Our Approach | Best Practice | Gap |
|--------|--------------|---------------|-----|
| CDP Automation | Bun.WebView + raw CDP | CDP-direct (Puppeteer, cdp) | ✅ Aligned |
| SSE Parsing | Custom parser | eventsource-parser (spec-compliant) | ⚠️ Could adopt |
| batchexecute/XSSI | Custom inline | pybatchexecute (Python) | 🔴 No TS library |
| Network Interception | Network.enable + getResponseBody | Route interception (Fetch.requestPaused) | ⚠️ Could adopt |
| Streaming Protocol | Custom per-provider | Vercel AI SDK format | ⚠️ Could standardize |
| Boot-time Priming | primeFromProtocol() | N/A (we're ahead) | ✅ Innovation |
| Fallback Chain | Data-driven (DB) | N/A (we're ahead) | ✅ Innovation |

## Implementation Notes

### What We Do Well
```typescript
// Boot-time priming eliminates DB reads during parsing
await streamParser.primeFromProtocol(protocol)
// Result: primedParsers Map<providerId, ParserModule>

// Fallback chain is data-driven
const chain = await this.resolveFallbackChain(providerId)
// Walks: provider → fallbackParserId → generic/001 → system/001

// Wire format detection covers all major formats
const wireFormat = detectWireFormat(rawBody)
// Returns: 'sse' | 'ndjson' | 'json-array' | 'batchexecute' | 'xSSI' | 'plain-text'
```

### What We Could Improve
```typescript
// Adopt eventsource-parser for generic SSE parsing
import { createParser } from 'eventsource-parser'
const parser = createParser({
  onEvent(event) { /* handle event */ },
  onError(error) { /* handle error */ },
})

// Extract batchexecute utility
// src/engines/batchexecute-parser.ts
export function stripXssiPrefix(raw: string): string {
  if (raw.startsWith(")]}'")) return raw.slice(4)
  if (raw.startsWith(")]}")) return raw.slice(3)
  return raw
}

// Adopt route interception for network capture
// Replace Network.enable + getResponseBody with:
await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
// Handle Fetch.requestPaused events for precise capture
```

## Adoption Opportunities

### High Priority
1. **Adopt `eventsource-parser`** for generic SSE parsing in `StreamParserEngine.detectWireFormat()`
2. **Extract batchexecute utility** into `src/engines/batchexecute-parser.ts` (first TypeScript library)

### Medium Priority
3. **Adopt route interception** for more precise network capture
4. **Standardize streaming protocol** using Vercel AI SDK patterns

### Low Priority
5. **Add SSE event type parsing** for `event:` lines
6. **Add retry logic** on connection drops

## Ecosystem Gaps

1. **No TypeScript batchexecute library** — Python has `pybatchexecute`, Go has multiple implementations
2. **No unified SSE+batchexecute+XSSI parser** — Our custom implementation fills this gap
3. **No TypeScript CDP network capture library** — Opportunity to contribute

## Used In

- StreamParserEngine (src/engines/stream-parser.ts) — SSE parsing, wire format detection, fallback chain
- ChromeGovernor.CDPProxy (src/engines/chrome-governor.ts) — CDP automation, network capture
- HarnessExecutor (src/engines/harness/harness-executor-engine.ts) — Program → recipe → DAG → execution
- ConversationManager (src/engines/conversation-manager.ts) — 8-step send pipeline
- ProviderRegistrar (src/engines/provider-registrar.ts) — 2-pass parser fallback wiring
