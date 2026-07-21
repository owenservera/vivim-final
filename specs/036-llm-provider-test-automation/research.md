# Research: LLM-Driven Provider Testing & Frontend UX Refinement

## Decision Record

### D1: Use existing onboard-controller phases, not new test framework
**Decision**: Reuse `devops/onboard-controller.ts` 8-phase pipeline as-is. The existing pipeline already has the correct phases. We build an orchestrator that invokes them via CLI subprocess and interprets the structured output.
**Rationale**: The onboarding pipeline is mature and tested. Building a parallel test framework would duplicate effort and fragment the tooling surface.
**Alternatives**: New standalone test runner — rejected (fragmentation cost > benefit).

### D2: LLM orchestrator drives via CLI subprocess, not API
**Decision**: The orchestrator spawns `bun run devops runtime-test onboard --provider=<slug> --phase=<phase>` as a subprocess and reads JSON from stdout.
**Rationale**: The CLI is the canonical interface for devops commands. API surface would require adding new endpoints for each phase.
**Alternatives**: Bypass CLI and import controllers directly — rejected (coupling to internal module structure).

### D3: Slot audit is a static analysis pass, not runtime
**Decision**: `bun run devops ui-test audit-slots` scans `web/ui/src/ui/slots.ts` and verifies each slot has a registered default in `web/ui/src/ui/defaults/index.ts`. Does not require a running browser.
**Rationale**: Slot-to-component mapping is a compile-time concern. No need to render to check it.
**Alternatives**: Runtime rendering check — rejected (slower, more complex).

### D4: Visual testing uses LLM-in-the-loop, not pixel-comparison
**Decision**: Screenshots are captured via Playwright/CDP; the LLM inspects each screenshot and writes an assertion ("this shows the provider selector with 6 options"). No pixel-diff baseline.
**Rationale**: Pixel-comparison is brittle (OS rendering differences, font fallbacks). LLM assertion is resilient to visual variance while catching semantic errors.
**Alternatives**: Pixel-diff with baseline images — rejected (maintenance burden).

### D5: Frontend cleanup is component-level, not page-level
**Decision**: Each component in `web/ui/src/components/` is audited independently for slot compliance, CSS variable usage, and `if (slug)` branching. The `page.tsx` monolith is decomposed per existing 034 spec.
**Rationale**: The 034 spec already defined the monolith decomposition. This cycle focuses on component-level cleanup.
**Alternatives**: Rewrite from scratch — rejected (too high risk, too slow).

## Provider-Specific Research

### Gemini
- **Composer**: `div.ql-editor[contenteditable="true"]` (Quill-based)
- **Send**: Click send button (Enter does NOT work in Quill)
- **Streaming**: Custom Google RPC batchexecute format (NOT SSE)
- **Parser**: `gemini/001_batchexecute` + `gemini/002_ai_studio` + generic fallback
- **Profile**: `chrome-profiles/gemini/owservera/`
- **Known gaps**: No `stream_config` row for custom batchexecute RPC
- **Selector confidence**: Verified, needs DOM refresh

### ChatGPT
- **Composer**: `#prompt-textarea` / `textarea[data-testid="prompt-textarea"]`
- **Send**: Enter or click send button
- **Streaming**: SSE `data: {message: {content: {parts: [text]}}}` with `[DONE]` terminator
- **Parser**: `chatgpt/001_openai_sse` (inline) + generic fallback
- **Profile**: `chrome-profiles/chatgpt/owservera/`
- **Known gaps**: Parser uses API format; wire uses chat UI format — needs real-world validation
- **Status**: Seeded + partial

### Claude
- **Composer**: `div[contenteditable="true"]` (ProseMirror)
- **Send**: Enter or click send button
- **Streaming**: Anthropic SSE format (`data: {type, delta, content_block_start/stop}`)
- **Parser**: `claude/001_streaming_sse` (inline)
- **Profile**: `chrome-profiles/claude/owservera/`
- **Known gaps**: None — fully registered and tested
- **Status**: Seeded + registered, highest confidence

## Existing Test Coverage

| Aspect | Unit Tests | Integration | E2E | LLM-Driven |
|--------|-----------|-------------|-----|------------|
| Parser format | ✅ | ✅ | ✅ | ❌ |
| CDP selectors | ✅ | ❌ | ❌ | ❌ |
| Onboarding pipeline | ❌ | ❌ | ❌ | ❌ |
| Setup wizard | ❌ | ❌ | ❌ | ❌ |
| Frontend slot resolution | ❌ | ❌ | ❌ | ❌ |
| Streaming visual | ❌ | ❌ | ❌ | ❌ |
| Cross-surface parity | ❌ | ❌ | ❌ | ✅ (cap:llm_test:parity) |
