# Unit 2.6: Seed — chatgpt.json

**Phase:** 2 | **File:** `seeds/providers/chatgpt.json`
**Depends:** 2.1 ProviderRegistrar | **Produces:** ChatGPT provider in DB
**Source:** `06-merged-seeds.md` §Remaining 6 Providers

## Summary
ChatGPT (OpenAI) — `chatgpt`. Category: ai, provider_type: llm.
Auth: browser, multi_account: true, profile_strategy: per_account.
Models: gpt-4o (default), gpt-4-turbo, o1.
Capabilities: send_message, select_model, upload_file, create_new_chat, temporary_chat.
Parser: chatgpt/001_openai_sse.ts.

## Key Endpoints
- Landing: https://chatgpt.com
- Chat: https://chatgpt.com/ (with composer selector)
- Login: https://chat.openai.com/auth/login

## Key Selectors
- Composer: `#prompt-textarea`
- Send button: `[data-testid='send-button']`
- Model selector: `[aria-haspopup='listbox']`
- Login email: `input[type='email']`
- Login submit: `button[type='submit']`

## Recovery Strategies (send_message)
1. retry_selector
2. retry_with_fallback (fallback: textarea)
3. navigate_home

## Gate
- Valid JSON with all fields matching ProviderManifest schema
- Same structure as claude.json (same top-level keys)
- All capabilities listed in provider.capabilities
- Parser file path: `chatgpt/001_openai_sse.ts`
