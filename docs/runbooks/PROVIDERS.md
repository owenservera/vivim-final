# Runbook — Providers

> Setting up, testing, and debugging the 6 provider surfaces. Core background is
> in `AGENTS.md` (KNOW THIS FIRST). This is the operational quick-reference.

## The 6 providers

`chatgpt · claude · gemini` (fully seeded + registered), `deepseek · qwen · grok`
(seeded, parsers pending). Each provider is seeded from
`seeds/providers/<slug>.json`, with captured parsers in
`seeds/parsers/harvested/`.

## Quick status / deep-dive

```bash
bun run devops runtime-test preflight                      # all providers
bun run devops runtime-test status --provider=gemini      # one provider deep-dive
```

## Onboarding a provider (8-phase pipeline)

```bash
bun run devops runtime-test onboard --provider=<slug>    # runs all phases
# …or individually: discover → infer → test-selectors → test-parse →
#   test-cap → test-frontend → verify → converge
bun run devops discover-protocol <url> --hint=<name>     # CDP protocol discovery
```

## Chrome profiles (CANONICAL layout — do not deviate)

Logged-in profiles live **only** under
`chrome-profiles/<providerSlug>/<accountId>/` (one `owservera` account per
provider is the intended steady state). Each holds `.profile-meta.json`. The
profile **cookie files** determine "logged in" — NOT the DB `loginState` row.
**Never** create top-level `gemini/`, `claude/`, `chatgpt/`, `deepseek/` dirs at
the repo root — those are stray duplicates (archived).

Setup a profile + launch:
```bash
bun run devops runtime-test setup --provider=gemini --account=gemini_owservera@gmail.com
```

## CDP gotchas (provider-specific)

- **Gemini** — Quill `div.ql-editor[contenteditable="true"]`; must click send
  (Enter doesn't work in Quill); custom batchexecute streaming (not SSE).
- **ChatGPT** — `#prompt-textarea` / `textarea[data-testid="prompt-textarea"]`;
  `data: {message:{content:{parts:[text]}}}` + `[DONE]`.
- **Claude** — ProseMirror `div[contenteditable="true"]`; Anthropic SSE format.

## Protocol data layer (DB is source of truth)

`src/__generated__/provider-protocol.ts` is compiled from the DB
(`bun run gen:protocol`). For testing, flip to the editable dev clone:

```bash
bun run devops protocol dev       # PROVIDER_PROTOCOL_SOURCE=dev
bun run devops protocol diff      # dev vs prod deltas
bun run devops protocol promote --provider=gemini   # dev → DB → regen prod
bun run devops protocol prod      # back to prod
```

## Testing a provider's capabilities

```bash
bun run devops runtime-test test --nl="send message to gemini"
```
Capabilities are **provider-bound** (`send_message`, `select_model`) — verify via
the interpreter, not `--slug=gemini_send`.