# Plan: Fully-Wired Parser & Capability Execution (020)

**Branch**: `020-parser-wiring`
**Strategy**: harvest-first, encode-as-inline, wire-real-chains, dispatch-multi-step, align-tests.

## Phase 1 — Harvest & encode parsers (R1, R2)
- P1.1 Create `seeds/parsers/harvested/` with inline `logic_code` strings for:
  - `claude-streaming-sse` (port our existing seed into inline form).
  - `chatgpt-openai-delta` (from `extractOpenAIBlock`).
  - `gemini-batchexecute` (from `decodeEnvelope` + `parseStreamChunk`).
  - `google-ai-studio` (from `extractGoogleAIStudioBlock`).
  - `generic-format-agnostic` (SSE/array/JSON best-effort).
  - `system-raw-text` (never throws).
- P1.2 Add `seeds/parsers/harvest.seed.ts` exporting `seedHarvestedParsers(store)` that
  upserts the rows (with `fallback` wiring) — reused by registrar + tests.
- P1.3 Add `fallback` fields to the provider seed manifests (`seeds/providers/*.json`) so the
  registrar's 2-pass insert (019) builds the chain.

## Phase 2 — Real fallback chains (R3)
- P2.1 Verify `ProviderRegistrar` 2-pass populates `fallbackParserId` (019) against the new
  manifests. Add an integration test: seed → `seedAll` → assert `generic`/`system` ids set.
- P2.2 Integration test: corrupt payload for `claude` walks claude → generic → system.

## Phase 3 — Multi-step execution (R4)
- P3.1 Extend `governor.executeSnapshotProgram` to detect `recipe.steps` vs single `action`
  and dispatch each step via `browserHarness.runAction`, collecting results, tolerating a
  failed step.
- P3.2 Unit test with a fake `browserHarness` asserting ordered step dispatch + failure capture.

## Phase 4 — Fixture DB + alignment (R5, R6)
- P4.1 Create `tests/fixtures/parser-harvest-test.db` (push + seed).
- P4.2 Update `stream-parser.test.ts` (done in 019) + add `harvested-parser.test.ts`
  (unit, mock store) asserting each format parses sample payloads correctly.
- P4.3 Triage the 3 pre-existing failures (`stream-align`, `conversation-manager` M2/M3,
  `conceptual-model`). If caused by 019/020, fix; else document.

## Phase 5 — Gates
- P5.1 `bun run devops invariants check --category B` — no new violations.
- P5.2 `bun run devops audit-code standard` — no new P0/P1 from 020 files.
- P5.3 `bun run devops verify-cross-surface` — stays 196/196.
- P5.4 `bun test tests/unit/engines/parser* tests/unit/engines/capability-snapshot*` green.

## Risk register
- Inline code length (Gemini) — acceptable; sandbox executes it.
- ChatGPT patch heuristic false-negatives — covered by generic/system tier.
- Pre-existing 3 failures may be unrelated — triage, don't blanket-fix.

## Dependencies
- 019 (boot snapshot, sandbox wiring, registrar 2-pass) — DONE, prerequisite.
- `SandboxRunner` + `SandboxAuditStoreImpl` — available.
