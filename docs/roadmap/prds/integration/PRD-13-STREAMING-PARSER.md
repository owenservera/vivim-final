# PRD-13: Streaming Parser Inference & Manifest Generator

**Phase:** 13 of N (integration track extension)
**Agent Assignment:** Agent C
**Depends On:** PRD-11 (Provider Onboarding Lifecycle)
**Blocks:** None (closes the onboarding gap)

---

## 1. Context

`discover-protocol` detects the composer and send method but **cannot infer the streaming response format** (SSE vs WebSocket vs polling, event names, delta structure) and **cannot generate the parser JavaScript** that seed JSON requires (`logic_code: "var parse = function(rawBody){...}"`). Today every provider's parser is hand-written (see `seeds/providers/chatgpt.json` `001_openai_sse`). This PRD adds two new pieces:

1. **`StreamingResponseAnalyzer`** — captures live provider traffic, infers the transport + delta schema, and generates parser JS.
2. **`ProviderManifestGenerator`** (bridge) — composes `discover-protocol` output + analyzer output + a models stub into a complete `seeds/providers/<slug>.json` skeleton.

Together these close the gap identified in PRD-11: the seed skeleton's `parsers` field is auto-filled instead of left `TODO`.

## 2. User Stories

### US1 — Infer Streaming Transport (P0)
**As an** agent onboarding a provider,
**I want** the analyzer to capture a live response and tell me whether it is SSE/WebSocket/polling and the delta field path,
**So that** I know the transport without reading network logs by hand.

**Acceptance Scenarios:**
1. Given a captured ChatGPT-style SSE stream, when analyzed, then it reports `{ transport: 'sse', eventName: 'delta', dataPath: 'choices[0].delta.content' }`.
2. Given an unknown/garbled stream, when analyzed, then it reports `transport: 'unknown'` and confidence < 0.5 (triggers PRD-12 parser gate).

### US2 — Generate Parser JavaScript (P0)
**As an** agent onboarding a provider,
**I want** the analyzer to emit `logic_code` parser JS matching the existing seed format,
**So that** it drops directly into `seeds/providers/<slug>.json`.

**Acceptance Scenarios:**
1. Given an inferred SSE delta path, when parser is generated, then `logic_code` contains a `parse` function that extracts deltas and a `detectCompletion` function.
2. Given generated parser, when run against the captured raw body in `ParserTestHarness`, then it reproduces the expected content blocks.

### US3 — Test Parser Against Captured Traffic (P1)
**As an** agent verifying a generated parser,
**I want** a `ParserTestHarness` that runs the parser on captured raw bodies and reports pass/fail + edge cases,
**So that** parser correctness is checked before seeding.

**Acceptance Scenarios:**
1. Given a raw SSE body and expected blocks, when harness runs, then it reports `{ passed: true, blocks: N }` or `{ passed: false, reason }`.
2. Given a parser that mishandles `[DONE]`, when harness runs, then it reports the completion-detection failure.

### US4 — Generate Complete Seed Skeleton (P0)
**As an** agent onboarding a provider,
**I want** `ProviderManifestGenerator` to produce a full `seeds/providers/<slug>.json` from discovery + analyzer + models stub,
**So that** only models and exotic capabilities need manual edit.

**Acceptance Scenarios:**
1. Given discovery (selectors) + analyzer (parsers) + a models stub, when generated, then the JSON has all required top-level keys populated (endpoints, selectors, parsers, models, fleet, capabilities_config).
2. Given a missing field (e.g., no models extracted), when generated, then the field is present but marked `TODO` and a convergence task is appended (PRD-12).

## 3. Functional Requirements

- **FR-001**: System MUST provide `src/engines/streaming-response-analyzer.ts` with `analyze(rawCapture): StreamAnalysis`.
- **FR-002**: `StreamAnalysis` MUST include `{ transport, eventName?, dataPath, sampleDelta, confidence }`.
- **FR-003**: Analyzer MUST generate `logic_code` parser JS conforming to the seed parser contract (`parse`, `detectCompletion`).
- **FR-004**: System MUST provide a `ParserTestHarness` (`devops/parser-test-harness.ts`) with `run(parser, rawBody, expected): ParserTestResult`.
- **FR-005**: System MUST provide `ProviderManifestGenerator` (`devops/provider-manifest-generator.ts`) with `generate(input): SeedSkeleton`.
- **FR-006**: `generate` MUST map `discover-protocol` manifestDraft fields to seed JSON keys (endpoints→endpoints, selectors→selectors, etc.).
- **FR-007**: `generate` MUST mark any unfilled required field `TODO` and append a convergence task (via PRD-12 `confidenceGate`).
- **FR-008**: Analyzer output MUST be gated by `getConfidence() >= 0.7` (PRD-12 FR-006).

## 4. Key Entities

- **StreamAnalysis**: `{ transport: 'sse'|'websocket'|'polling'|'unknown', eventName?: string, dataPath: string, sampleDelta: unknown, confidence: number, logicCode: string }`
- **ParserTestResult**: `{ passed: boolean, blocks: number, reason?: string, edgeCases: string[] }`
- **SeedSkeleton**: partial `seeds/providers/<slug>.json` with `TODO` markers for unfilled fields.

## 5. Technical Design

### 5.1 Engine Placement

`src/engines/streaming-response-analyzer.ts` as a standalone engine (follows engine pattern: define interface → store contract → implement → test). It is CDP-agnostic — it takes a raw captured body, not a live browser. Capture itself stays in `ProtocolDiscoveryEngine` (Governor Canon preserved).

### 5.2 Parser Contract Compatibility

Generated `logic_code` MUST match the existing seed format exactly:
```javascript
var parse = function(rawBody) { /* returns ContentBlock[] */ };
var detectCompletion = function(rawBody) { /* returns boolean */ };
```

### 5.3 Module Structure

```
src/engines/streaming-response-analyzer.ts        # CREATE
src/engines/streaming-response-analyzer.test.ts   # CREATE
devops/parser-test-harness.ts                     # CREATE
devops/provider-manifest-generator.ts             # CREATE
devops/provider-manifest-generator.test.ts        # CREATE
```

### 5.4 Error Handling

- Empty capture: return `transport: 'unknown'`, confidence 0.
- Ambiguous data path (multiple candidates): pick highest-frequency, record alternatives in `edgeCases`.
- Parser generation fails to compile: harness reports compile error, gate fails.

## 6. Constitution Check

- [ ] Governor Canon: analyzer never touches CDP; capture lives in ProtocolDiscoveryEngine.
- [ ] Store Contracts: analyzer depends on a capture input contract, not DB.
- [ ] One Entry Point: invoked via `bun run devops discover-protocol` / lifecycle loop, not a new transport.
- [ ] TypeScript strict, no `any`.

## 7. Testing Requirements

### Unit Tests
- Test `analyze` on a fixture ChatGPT SSE body → correct dataPath + logicCode.
- Test `analyze` on WebSocket frame capture → transport `websocket`.
- Test `analyze` on garbled body → `unknown`, confidence < 0.5.
- Test `ParserTestHarness` pass and fail cases (incl. `[DONE]` mishandling).
- Test `ProviderManifestGenerator` maps discovery→seed and marks TODOs.

### Integration Test
- Capture from a fixture provider, run analyzer → harness → generator, assert seed skeleton is valid JSON with parsers populated.

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/engines/streaming-response-analyzer.ts` | CREATE | Inference engine |
| `src/engines/streaming-response-analyzer.test.ts` | CREATE | Engine tests |
| `devops/parser-test-harness.ts` | CREATE | Parser verification |
| `devops/provider-manifest-generator.ts` | CREATE | Seed skeleton generator |
| `devops/provider-manifest-generator.test.ts` | CREATE | Generator tests |

## 9. Success Criteria

- [ ] Analyzer infers SSE/WebSocket/polling + data path from a captured body.
- [ ] Generated `logic_code` parses the captured body correctly in the harness.
- [ ] `ProviderManifestGenerator` outputs valid seed JSON with parsers filled.
- [ ] Unfilled fields marked `TODO` + convergence task appended.
- [ ] Analyzer gated at 0.7 confidence (PRD-12).
- [ ] `bun run typecheck` and `bun test` pass.

## 10. Parallelization Notes

**Depends On:** PRD-11 (lifecycle calls generator), PRD-12 (confidence gates).
**Blocks:** None — this is the final closure of the provider onboarding gap.
