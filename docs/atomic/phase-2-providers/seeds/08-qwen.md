# Unit 2.11: Seed — qwen.json

**Phase:** 2 | **File:** `seeds/providers/qwen.json`
**Depends:** 2.1 ProviderRegistrar | **Produces:** Qwen provider in DB
**Source:** `06-merged-seeds.md` §Remaining 6 Providers

## Summary
Qwen (Alibaba) — `qwen`. Category: ai, provider_type: llm.
Auth: browser, multi_account: false, profile_strategy: per_account.
Models: qwen-max (default), qwen-plus.
Capabilities: send_message, select_model, upload_file, web_search.
Parser: generic/001_sse_frames.ts (OpenAI-compatible SSE).

## Key Endpoints
- Landing: https://tongyi.aliyun.com
- Chat: https://tongyi.aliyun.com/qianwen
- Login: https://tongyi.aliyun.com/login

## Key Selectors
- Composer: `textarea` or `[contenteditable]`
- Send button: `button[aria-label*='send']`
- Model selector: dropdown with model names
- File upload: `input[type='file']`

## Recovery Strategies (send_message)
1. retry_selector
2. retry_with_fallback (fallback: `div[contenteditable]`)
3. navigate_home

## Gate
- Valid JSON matching ProviderManifest schema
- Parser: `generic/001_sse_frames.ts`
- 4 capabilities including web_search
