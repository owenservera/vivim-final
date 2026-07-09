# Unit 2.7: Seed — gemini.json

**Phase:** 2 | **File:** `seeds/providers/gemini.json`
**Depends:** 2.1 ProviderRegistrar | **Produces:** Gemini provider in DB
**Source:** `06-merged-seeds.md` §Remaining 6 Providers

## Summary
Gemini (Google) — `gemini`. Category: ai, provider_type: llm.
Auth: browser, multi_account: true, profile_strategy: per_account.
Models: gemini-2.5-pro (default), gemini-2.5-flash, gemini-2.0-flash-lite.
Capabilities: send_message, select_model, upload_file, flash_thinking.
Parser: gemini/001_batchexecute.ts.

## Key Endpoints
- Landing: https://gemini.google.com
- Chat: https://gemini.google.com/app
- Login: https://accounts.google.com

## Key Selectors
- Composer: `div[contenteditable='true']`
- Send button: `button[aria-label='Send message']`
- Model selector: `div[role='combobox']`
- Login email: `input[type='email']`
- Flash Thinking toggle: `button[aria-label*='Thinking']`

## Recovery Strategies (send_message)
1. retry_selector
2. retry_with_fallback (fallback: textarea)
3. navigate_home

## Gate
- Valid JSON matching ProviderManifest schema
- Parser: `gemini/001_batchexecute.ts`
- flash_thinking capability uses toggle_switch component
