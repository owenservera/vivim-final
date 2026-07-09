# Unit 2.8: Seed — deepseek.json

**Phase:** 2 | **File:** `seeds/providers/deepseek.json`
**Depends:** 2.1 ProviderRegistrar | **Produces:** DeepSeek provider in DB
**Source:** `06-merged-seeds.md` §Remaining 6 Providers

## Summary
DeepSeek — `deepseek`. Category: ai, provider_type: llm.
Auth: browser, multi_account: true, profile_strategy: per_account.
Models: deepseek-v3 (default), deepseek-r1.
Capabilities: send_message, select_model, deep_think.
Parser: generic/001_sse_frames.ts (OpenAI-compatible SSE).

## Key Endpoints
- Landing: https://chat.deepseek.com
- Chat: https://chat.deepseek.com/
- Login: https://chat.deepseek.com/sign_in

## Key Selectors
- Composer: `textarea#chat-input`
- Send button: `div[role='button']` (send icon)
- Model selector: `div[class*='model-selector']`
- Deep Think toggle: `div[class*='deep-think']` or toggle

## Recovery Strategies (send_message)
1. retry_selector
2. retry_with_fallback (fallback: `div[contenteditable]`)
3. navigate_home

## Gate
- Valid JSON matching ProviderManifest schema
- Parser: `generic/001_sse_frames.ts` (OpenAI-compatible)
- deep_think capability uses toggle_switch component
