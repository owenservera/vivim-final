# Unit 2.10: Seed — z-ai.json

**Phase:** 2 | **File:** `seeds/providers/z-ai.json`
**Depends:** 2.1 ProviderRegistrar | **Produces:** Z-AI provider in DB
**Source:** `06-merged-seeds.md` §Remaining 6 Providers

## Summary
Z-AI — `z-ai`. Category: ai, provider_type: llm.
Auth: browser, multi_account: false, profile_strategy: per_account.
Models: z-ai-pro (default).
Capabilities: send_message, select_model.
Parser: generic/002_openai_delta.ts (OpenAI delta pattern).

## Key Endpoints
- Landing: TBD (discovered at seed time)
- Chat: TBD
- Login: TBD

## Key Selectors (to be discovered/verified)
- Composer: `textarea` or `[contenteditable]`
- Send button: `button` with aria-label containing "send" or "submit"

## Recovery Strategies (send_message)
1. retry_selector
2. navigate_home

## Gate
- Valid JSON matching ProviderManifest schema
- Parser: `generic/002_openai_delta.ts`
- Minimal provider — 2 capabilities only
