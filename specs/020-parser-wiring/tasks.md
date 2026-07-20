# Tasks: Fully-Wired Parser & Capability Execution (020)

## T1 — Encode harvested parsers as inline logic (R1, R2)
- [ ] T1.1 `seeds/parsers/harvested/claude-streaming-sse.ts` (inline port)
- [ ] T1.2 `seeds/parsers/harvested/chatgpt-openai-delta.ts`
- [ ] T1.3 `seeds/parsers/harvested/gemini-batchexecute.ts`
- [ ] T1.4 `seeds/parsers/harvested/google-ai-studio.ts`
- [ ] T1.5 `seeds/parsers/harvested/generic-format-agnostic.ts`
- [ ] T1.6 `seeds/parsers/harvested/system-raw-text.ts`

## T2 — Seed module + manifest fallback wiring (R1, R3)
- [ ] T2.1 `seeds/parsers/harvest.seed.ts` (`seedHarvestedParsers`)
- [ ] T2.2 Add `fallback` to provider seed manifests (`seeds/providers/*.json`)

## T3 — Verify real fallback chains (R3)
- [ ] T3.1 Integration test: registrar 2-pass populates `fallbackParserId`
- [ ] T3.2 Integration test: corrupt payload walks provider→generic→system

## T4 — Multi-step program execution (R4)
- [ ] T4.1 Extend `governor.executeSnapshotProgram` for `recipe.steps`
- [ ] T4.2 Unit test: ordered step dispatch + failure capture (fake harness)

## T5 — Fixture DB + alignment (R5, R6)
- [ ] T5.1 Create `tests/fixtures/parser-harvest-test.db`
- [ ] T5.2 `tests/unit/engines/harvested-parser.test.ts` (format correctness)
- [ ] T5.3 Triage 3 pre-existing failures; fix-or-document

## T6 — Gates (P5)
- [ ] T6.1 `invariants check --category B`
- [ ] T6.2 `audit-code standard`
- [ ] T6.3 `verify-cross-surface`
- [ ] T6.4 `bun test` parser + snapshot suites
