# Feature: Gemini Full Webapp Tooling (PRD-12 Provider Onboarding)

## Goal
Onboard `gemini.com` as a first-class provider with full webapp tooling:
- Rich message composer parsing **all text types**: LaTeX, tables, code snippets
  (multi-language), links, bold/italic, ordered/unordered lists, nested indents,
  blockquotes, headings.
- **Receive images**: Gemini responses containing images render inline.
- **Send files**: user can attach and send files to the provider.

## User Actions (prioritized)
1. Compose a rich message (markdown/latex/code/table) → send to Gemini.
2. Attach an image to the prompt.
3. Attach a file (doc/pdf/etc.) to the prompt.
4. Receive + view streamed text response (fully parsed: math, tables, code).
5. Receive + view inline images in the response.
6. Switch model / new chat.

## Surfaces
- CLI: `gemini send "<msg>" [--image=...] [--file=...]`
- API: `POST /api/interpret` + `/api/capabilities/:id/execute`
- UI: ChatPage composer (primary) + unified canvas layer
- MCP: `gemini_send`

## Non-goals
- Login automation wizard (account assumed present or manual).
- Multi-account management (covered by 006).

## Acceptance
- Protocol discovered for gemini.com (composer, send, capture, response DOM).
- Parser confidence >= 0.7 across all text types.
- E2E: canvas mounts, capability invokes, DOM asserts image receive + file send controls.
