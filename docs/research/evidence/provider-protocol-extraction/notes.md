# Provider Protocol Extraction — Evidence Notes

## Phase 1: CDP Automation Libraries

### Two Architectural Camps (SOC-AI, 2026)
- **Playwright-Wrappers:** browser-use, Stagehand — inherit Playwright's auto-wait, locators, multi-target coordination. Tradeoff: launch cost + Node runtime
- **CDP-Direct:** agent-browser, Veil, cdp-browser — build own primitives, get predictability + smaller footprint. Tradeoff: DIY anti-detection, no auto-wait

### Key Findings
- **Playwright** (81k+ stars): Highest-level abstraction, overkill for single-tab agent scenarios
- **Puppeteer** (91k+ stars): CDP-focused, best for page-level scripting, still adds abstraction
- **chrome-remote-interface** (2.8k stars): Low-level CDP bindings, thin wrapper over WebSocket
- **cdp** (601 stars, Go) / **cdp** (766 stars, TypeScript): Type-safe CDP clients, direct protocol access

### Our Approach
- **Pattern C: In-Process via Bun.WebView** — `Bun.WebView({ backend: "chrome" })` manages lifecycle
- Governor owns ALL Chrome interaction (Canon invariant)
- No other engine imports BunCdpClient
- One atomic CDP command per harness step preserves Chrome event loop

## Phase 2: SSE/Streaming Parsing

### Library Landscape
- **eventsource-parser** (484 stars, 0 deps): Spec-compliant SSE parser, `createParser()` returns iterator, MIT, 788 dependents
- **parse-sse**: Lightweight, works with native Fetch API, returns ReadableStream
- **better-sse** (829 stars): Server-side SSE, TypeScript, full-featured
- **sse-stream-parser**: TypeScript, ReadableStream → structured data

### Our Approach
- **Custom SSE parser** in `StreamParserEngine.detectWireFormat()` — detects `data:` prefix, handles `[DONE]` terminator
- **Fallback chain**: provider → generic → system (all from DB, zero DB reads on hot path after priming)
- **Boot-time priming**: `primeFromProtocol()` compiles parsers from static protocol, caches in `primedParsers` Map
- **Wire format detection**: SSE, NDJSON, JSON array, batchexecute, XSSI, plain text

### Comparison
- **eventsource-parser** is the gold standard for SSE parsing — zero deps, spec-compliant, widely used
- Our custom SSE parser handles provider-specific quirks (e.g., Claude's `content_block_start/delta`, ChatGPT's `choices[].delta.content`)
- **Opportunity**: Adopt `eventsource-parser` for generic SSE parsing, keep provider-specific logic custom

## Phase 3: batchexecute/XSSI

### Library Landscape
- **pybatchexecute** (Python): Google batch RPC encoding/decoding, XSSI prefix stripping
- **go-notebooklm** (Go): Batchexecute client with encoding package
- **batchexecute** (Go): RPC request/response with default and compressed response format

### Key Patterns
- **XSSI prefix**: `)]}'` or `)]}` — must be stripped before JSON parsing
- **Batch RPC**: Multiple requests bundled in single HTTP response
- **Compressed response format**: gzip/deflate encoding for batch responses

### Our Approach
- **Wire format detection** in `detectWireFormat()`: detects `$rpc` prefix for batchexecute, `)]}'` for XSSI
- **Provider-specific parsers**: Gemini uses batchexecute format, others use SSE/NDJSON
- **No TypeScript library exists** for batchexecute — this is a gap in the ecosystem

### Comparison
- Python has `pybatchexecute`, Go has multiple implementations
- TypeScript/JavaScript has no equivalent library
- Our custom implementation handles Gemini's batch RPC format inline in parser logicCode
- **Opportunity**: Extract batchexecute handling into reusable utility, consider contributing to ecosystem

## Phase 4: Browser Automation for AI Agents

### Library Landscape
- **agent-browser-withCDPnetworkcapture**: CDP network capture CLI for AI agents, route interception
- **Vercel AI SDK v5**: `streamText()` with `pipeDataStreamToResponse()`, protocol-level streaming
- **OpenAI Agents SDK**: StreamableHTTP transport, stateful mode
- **eventsource-lite**: Minimal EventSource for client-side streaming

### Key Patterns
- **Network interception**: CDP `Network.enable` + `Fetch.enable` for request/response capture
- **Route interception**: `Fetch.requestPaused` for blocking/modifying requests
- **Protocol-level streaming**: Standardized streaming format for AI agent communication

### Our Approach
- **ChromeGovernor.CDPProxy**: Network.enable + getResponseBody for response capture
- **HarnessExecutor**: Program → recipe → DAG → execution pipeline
- **ConversationManager**: 8-step send pipeline (RESOLVE→RECALL→INJECT→DERIVE→VERIFY→LOCK→SEND→CAPTURE→PARSE→STORE+EMIT)

### Comparison
- **agent-browser-withCDPnetworkcapture** focuses on network capture for analysis
- **Vercel AI SDK** focuses on protocol-level streaming for AI agents
- Our approach combines both: CDP automation + protocol parsing + capability execution
- **Opportunity**: Consider adopting standardized streaming protocols from Vercel AI SDK

## Synthesis

### What We Do Well
1. **Zero-DB hot path**: Boot-time priming eliminates DB reads during parsing
2. **Fallback chain**: Provider → generic → system (all data-driven, no hardcoded tiers)
3. **Wire format detection**: Handles SSE, NDJSON, JSON array, batchexecute, XSSI
4. **Provider-specific parsing**: Custom logic for each provider's quirks
5. **Boot-time compilation**: `SandboxRunner` compiles parser logicCode at startup

### What We Could Improve
1. **SSE parsing**: Consider adopting `eventsource-parser` for generic SSE handling
2. **batchexecute**: Extract into reusable utility, consider contributing TypeScript library
3. **Network interception**: Consider adopting route interception patterns from agent-browser
4. **Streaming protocols**: Consider adopting standardized formats from Vercel AI SDK

### Ecosystem Gaps
1. **No TypeScript batchexecute library** — opportunity to contribute
2. **No unified SSE+batchexecute+XSSI parser** — our custom implementation fills this gap
3. **No TypeScript CDP network capture library** — opportunity to contribute
