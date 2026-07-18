# PRD — M3: Verify & Harden Capture Patterns (chatgpt/claude/gemini)

> Part of the Multi-Turn Conversations roadmap. Scope: `CAPTURE_PATTERNS` +
> `StreamParserEngine` fixtures. Grounded in: `conversation-manager.ts:128`
> (hardcoded `CAPTURE_PATTERNS` per provider); `StreamParserEngine.parse` (stream-parser.ts:71)
> loads provider parsers from DB with a fallback chain; `tests/fixtures/parsers/` has
> `claude-ok.ts` / `chatgpt-ok` style fixtures but NO recorded live streaming bodies per provider;
> `tests/unit/engines/stream-parser.test.ts` exists.

## Goal
Prove the capture regexes match the *real* streaming endpoints for all three providers, and that
the captured body parses into non-empty `ContentBlock[]` — so multiturn replies are not silently
blank.

## Current State (truth)
- `CAPTURE_PATTERNS`: chatgpt `/backend-api/conversation`, claude `/api/organizations/.../completion`,
  gemini `/_api/BardFrontendService/StreamGenerate` — authored without live verification.
- If the regex misses, `capture()` returns empty body → parser yields empty/error blocks → turn
  "succeeds" but assistant text is blank. This is a silent-failure mode that M3 must make loud.
- No recorded real-response fixtures per provider in `tests/fixtures/`.
- `StreamParserEngine` fallback chain: provider → generic → system → error.

## Success Criteria (gates)
1. **SC-M3-1 (live endpoint match):** For each provider, the real streaming request URL observed in
   an adopted Chrome matches `CAPTURE_PATTERNS[providerId]` (or a documented fallback). Verified via
   `engage` + `Network.requestWillBeSent` logging (skill CDP gotcha #11) OR a recorded fixture URL set.
2. **SC-M3-2 (parse yields blocks):** A recorded/representative response body per provider, fed through
   `StreamParserEngine.parse`, yields `blocks.length > 0` and non-empty `text`.
3. **SC-M3-3 (per-provider fallback array):** `CAPTURE_PATTERNS` supports a fallback array per provider
   (not a single fragile regex) so a UI change on the provider side degrades gracefully.
4. **SC-M3-4 (fixtures committed):** `tests/fixtures/capture/<provider>.json` (or `.ts`) contains a
   real/representative streaming body per provider, exercised by a parser test.
5. **SC-M3-5 (loud failure):** If capture returns empty for a known provider, the send result surfaces
   an error/warning instead of a silent blank assistant message (configurable, but not swallowed).
6. **SC-M3-6 (tests):** `tests/unit/engines/stream-parser.test.ts` + `tests/integration/chat/` cover
   all three providers; `bun test` green.
7. **SC-M3-7 (typecheck/lint):** green.

## Out of Scope
- Rewriting the parser engine (only confirm/fix patterns + add fixtures).
- Schema work (M0).

## Acceptance Test (backend)
- `bun run devops runtime-test test --nl="send a message to claude"` returns `ok:true` with
  `blocks.length > 0` after a real or fixture-backed capture.

## Definition of Done
All 7 SC pass; capture + parse proven non-empty for chatgpt, claude, gemini.
