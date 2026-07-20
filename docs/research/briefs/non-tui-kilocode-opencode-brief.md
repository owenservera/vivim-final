# Non-TUI Kilocode / OpenCode — Brief

**Source:** [full report](../reports/non-tui-kilocode-opencode-sota-2026.md)
**Confidence:** High | **Sources:** 18 | **Date:** 2026-07-18

## TL;DR
Kilocode (CLI 1.0, an OpenCode fork) and OpenCode both ship fully headless surfaces — `run --auto`
for one-shot prompts and `serve`/`acp` for programmatic HTTP/nd-JSON servers — making them directly
usable in CI/CD and devops loops. The key gotcha for vivim: the two systems use "provider" with
opposite meanings. vivim providers are **browser UIs driven over CDP**; Kilo/OpenCode providers are
**LLM API backends they call**. Wiring them in means a **new `local-agent` provider type** that
shells out to `kilo run --auto` / `opencode run --auto` or POSTs to `opencode serve`, NOT a CDP entry
next to `chatgpt`/`gemini`.

## Key Decisions
1. **Use `run --auto` (+ `--format json` for OpenCode) for headless devops jobs**, not a long-lived
   `serve` — avoids the documented `serve` hang issues and needs no network auth.
2. **Add `provider_type: 'local-agent'` to vivim** rather than registering Kilo/OpenCode as CDP
   providers. Implement capability execution via a thin executor that calls the CLI/HTTP and parses
   output into `ContentBlock[]` through the existing `StreamParserEngine` contract.
3. **Permission policy:** set explicit `deny` rules for risky tools in autonomous mode; anything not
   auto-approved is blocked (Kilo/OpenCode never prompt in `--auto`).
4. **Do not give non-TUI agents DOM vision** — they are file/shell only. Keep CDP/ChromeGovernor for
   actual web-chat providers; reach for Kilo/OpenCode only as agent backends.

## Evidence Summary
- Kilo/OpenCode both expose `run --auto`, `serve`, `acp`, JSON/SSE output (confidence: High — primary docs)
- OpenCode `serve` publishes OpenAPI 3.1 with `/session/:id/message` + `/event` SSE (confidence: High — server docs)
- Autonomous mode auto-answers follow-ups "make the decision autonomously"; unapproved ops are blocked (confidence: High — Kilo docs)
- `serve`+client can hang indefinitely (community issue) → prefer `run` for unattended jobs (confidence: Medium — single issue report)
- vivim provider manifests are CDP/browser-shaped (`provider_type:'llm'`, `auth_type:'browser'`, selector endpoints) (confidence: High — local source)

## Open Questions
- Should the `local-agent` executor prefer `opencode serve` (richer API, persistent MCP) or `run --auto`
  (simpler, no server lifecycle) for vivim's devops loop?
- How should vivim model "agent-as-provider" capabilities vs. "web-chat-as-provider" capabilities in the
  taxonomy (single `provider_type` enum extension vs. a capability-tag dimension)?
- Does Kilo's `KILO_ORG_ID`/Gateway routing matter for vivim, or is BYO-key config sufficient?

## Used In
- (proposed) New `local-agent` provider type for vivim-final devops headless automation
- `devops`/`vivim-runtime`/`agentic` skills — candidate execution backend
- ADR candidate: "Agent backends as vivim providers"
