# Feature Spec: Fully-Wired DB-Driven Parser & Capability Execution

**Feature branch**: `020-parser-wiring`
**Date**: 2026-07-18
**Status**: Active
**Related**: 019-name-driven-capability-execution (boot snapshot), parser-harvest gap analysis

## Problem Statement

019 made the database the source of truth for capability execution and hardened parser
execution (sandbox + `fallbackParserId` graph + `inline` default). But the system is still
**not fully wired**:

1. **No real parser logic is harvested.** Our repo has a single seed parser
   (`seeds/parsers/claude-streaming-sse.ts`). The OG app (`vivim-app-og/.../cap-store` and
   `.../capabilit-lab`) contains the *actual* streaming parsers for Claude (SSE
   `content_block_delta`), ChatGPT/OpenAI (`choices[].delta.content` + patch format),
   Google AI Studio (`candidates[].content.parts[].text`), and Gemini batchexecute
   (`decodeEnvelope` + `parseStreamChunk` over `[[...]]` arrays). None of this is in our DB.
2. **No real fallback chains.** Every seed parser is a terminal node (`fallbackParserId=null`),
   so the graph-walk short-circuits. The data model *supports* a fallback graph but nothing
   populates it with meaningful tiers (provider → generic → system).
3. **No parser version/variation dimension.** `provider_parser.parser_version` is an integer
   but the seed has one version per provider. The OG docs show capability *variations*
   (model-specific selectors, format drift) that should map to versioned parser rows.
4. **Multi-step program execution is stubbed.** `governor.executeCapability` runs a single
   `recipe.action`; recipes with multiple steps (the harness planner) are not dispatched.
5. **3 pre-existing test failures** (`stream-align`, `conversation-manager` M2/M3,
   `conceptual-model`) remain red and must be understood/resolved as part of wiring.

## Goal

Harvest every parser variant found in the OG trees, encode them as **inline `logic_code`
rows** in `provider_parser` (DB-only, sandbox-executed), build **real fallback chains** and
**versioned variations**, and make multi-step capability programs execute end-to-end. The
parser system becomes fully DB-driven with zero hardcoded parsing tiers.

## Requirements

### R1 — Harvest & encode parsers as DB inline logic
- R1.1 Encode Claude SSE, ChatGPT/OpenAI delta, Google AI Studio, and Gemini batchexecute
  parsers as inline `logic_code` strings matching the `ParserModule` factory contract
  (`exports.default = { name, version, providerId, parse, detectCompletion, getConfidence }`).
- R1.2 All harvested parsers use `logic_type='inline'`; no file-based parser is loaded at
  runtime (Governor Canon / DB-only invariant preserved).
- R1.3 Each parser is registered for the correct `providerId` (claude / chatgpt / gemini / …).

### R2 — Parser versions & variations
- R2.1 `provider_parser.parser_version` encodes distinct format variations per provider
  (e.g. Claude v1 SSE, ChatGPT v1 OpenAI-delta, Gemini v1 batchexecute, Google AI Studio v1).
- R2.2 A generic fallback parser (format-agnostic: split on `data:` / `[[` / raw text) exists
  as the terminal node of every provider chain.
- R2.3 A system fallback parser (last-resort: return raw body as a single text block) exists.

### R3 — Real fallback chains
- R3.1 For each provider, `fallbackParserId` wires `provider → generic → system`.
- R3.2 `StreamParserEngine.resolveFallbackChain` walks this graph on parse failure (already
  implemented in 019) — verified by integration test with a populated chain.
- R3.3 `ProviderRegistrar` populates the chain via the 2-pass insert (019) from manifest
  `fallback` fields. The seed manifests must declare `fallback` to exercise this.

### R4 — Multi-step program execution
- R4.1 `governor.executeCapability` MUST dispatch multi-step recipes (the harness planner)
  for snapshot-resolved capabilities, not just single `recipe.action`.
- R4.2 Each recipe step runs via `browserHarness.runAction` in order; a step failure is
  reported without crashing the whole capability.

### R5 — Dev/test isolation + alignment
- R5.1 A test fixture DB (`tests/fixtures/parser-harvest-test.db`) seeded from the harvested
  parser rows, regenerable via `DATABASE_URL=file:./tests/fixtures/parser-harvest-test.db`.
- R5.2 `bun test` green for parser + snapshot suites; pre-existing 3 failures triaged
  (fix if caused by 019/020, else documented as pre-existing).

### R6 — Constitution compliance
- R6.1 Governor Canon: parsers never import `BunCdpClient`; only `ChromeGovernor` touches CDP.
- R6.2 Store Contracts: engines depend on `ParserStore`/`CapabilityStore` contracts.
- R6.3 Research-First: this spec is backed by harvested OG source (research.md).

## Out of Scope
- Rewriting the OG in-page harness (`src/content/harness.ts`) — only the lab-side parsers.
- New provider accounts beyond what seeds already declare.

## Success Metrics
- All 4 harvested parsers parse their format's sample payload into correct `ContentBlock[]`.
- A corrupted provider payload falls through provider → generic → system and still yields a
  text block (integration test).
- `verify-cross-surface` stays 196/196; `invariants check --category B` no new violations.
- `bun test tests/unit/engines/parser* tests/unit/engines/capability-snapshot*` green.
