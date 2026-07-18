# Provider Integration PRD — v1

**Goal:** A provider (claude.ai, chatgpt.com, gemini.google.com, etc.) is fully integrated when a user can:
1. Type in vivim frontend composer → sends to provider webapp → response renders in vivim frontend
2. All provider capabilities (model select, thinking toggle, file upload) are discoverable and executable
3. Multi-turn conversations work end-to-end
4. New providers can be onboarded in <1 hour using automated discovery + verification

## Architecture: Generic Provider Pipeline

```
vivim Frontend (React Canvas)
  │
  ▼
POST /api/conversations/:id/messages  { message: "hello" }
  │
  ▼
ConversationManager.sendInternal()
  ├─ [1] RESOLVE — resolveHarnessMode(providerId) → DB-driven selectors/patterns
  ├─ [2] ENSURE — governor.ensureRunningForAccount() → Chrome slave
  ├─ [3] VERIFY PAGE — navigate to provider conversation URL
  ├─ [4] WRITE — CDPProxy.executeHarnessPlan(type_text → submit)
  ├─ [5] CAPTURE — CdpTransportImpl.capture(fetchPatterns + networkPatterns)
  ├─ [6] PARSE — StreamParserEngine.parse(body, providerId) → ContentBlock[]
  ├─ [7] STORE — StreamBlockStore.storeBlocks() → DB
  └─ [8] EMIT — conversation:complete → WebSocket → frontend
  │
  ▼
vivim Frontend renders ContentBlock[] via UiComponent system
```

## Verification Matrix (per provider)

| Capability | Write | Read | Render | Status |
|---|---|---|---|---|
| Send message | CDP type + submit | Network/Fetch capture | UiComponent HTML | ❓ |
| SSE parsing | — | StreamParserEngine | — | ❓ |
| Model select | CDP click | — | UiComponent dropdown | ❓ |
| Thinking toggle | CDP click | — | UiComponent toggle | ❓ |
| File upload | CDP click + file | — | UiComponent input | ❓ |
| New chat | CDP navigate | — | UiComponent button | ❓ |
| Multi-turn | CDP type×N | capture×N | UiComponent thread | ❓ |

## DB-Driven: All Provider Config Lives in Seeds

Every provider-specific detail is in `seeds/providers/<slug>.json`:
- `endpoints[type=chat].selector` → composer, send button, fetch patterns, DOM selectors
- `endpoints[type=chat].composer_type` → textarea | contenteditable | prosemirror | quill
- `endpoints[type=chat].send_method` → enter_key | button_click | both
- `stream_config[]` → SSE format, delta path, completion detectors
- `parsers[]` → inline parser JS for ContentBlock extraction
- `capabilities_config[]` → registered capabilities with UI overrides

**No TypeScript hardcoding.** Maps in provider-selectors.ts are FALLBACKS.
