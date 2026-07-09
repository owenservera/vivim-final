# Unit 2.9: Seed — studio-ai.json

**Phase:** 2 | **File:** `seeds/providers/studio-ai.json`
**Depends:** 2.1 ProviderRegistrar | **Produces:** Studio-AI provider in DB
**Source:** `06-merged-seeds.md` §Remaining 6 Providers

## Summary
Studio-AI — `studio-ai`. Category: ai, provider_type: llm.
Auth: browser, multi_account: false, profile_strategy: per_account.
Models: studio-ai-turbo (default).
Capabilities: send_message, select_model, agent_mode.
Parser: generic/001_sse_frames.ts (OpenAI-compatible SSE).

## Key Endpoints
- Landing: TBD (discovered at seed time)
- Chat: TBD
- Login: TBD

## Key Selectors (to be discovered/verified)
- Composer: `[contenteditable]` or `textarea` (generic)
- Send button: `button[aria-label*='send']` or `button[type='submit']`

## Recovery Strategies (send_message)
1. retry_selector
2. retry_with_fallback
3. navigate_home

## Gate
- Valid JSON matching ProviderManifest schema
- Parser: `generic/001_sse_frames.ts` (generic SSE, will be refined after discovery)
- agent_mode capability uses toggle_switch component
