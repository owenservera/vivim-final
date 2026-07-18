# Production Issues

Running log of items that must be fixed before the multi-chat flow is
production-ready. Each item captures the symptom, root cause (when known),
evidence, and the proposed fix.

Status legend: 🔴 open · 🟡 in progress · 🟢 fixed

---

## PI-001 🔴 ChatGPT send captures empty response (composer-type mismatch)

**Surface:** Frontend chat → `POST /api/conversations/:id/send` → `ConversationManager.send()` → CDP harness.

**Symptom:**
- `send` returns `ok: true` but `text: ''` and `blocks: []`.
- Timing shows `capture: ~60105ms` (full 60s timeout) and `type: ~187ms` (suspiciously fast).
- Reproduced with `chatgpt_owservera` (hasCookies: true), so it is NOT an auth issue.

**Root cause (confirmed):**
- `composerTypeForProvider('chatgpt')` returns `'textarea'` (`src/engines/conversation-manager.ts:111-121`).
- Current ChatGPT composer `#prompt-textarea` is a **contenteditable ProseMirror `<div>`**, not a `<textarea>`.
- The `'textarea'` typing strategy in `composer-typing.ts` sets `.value` via the
  `HTMLTextAreaElement.prototype` value setter and dispatches `input`/`change`.
  On a `<div>` this silently does nothing → no text is entered → Enter submits an
  empty composer → no `/backend-api/conversation` request → capture waits the full 60s.

**Evidence:**
- Chrome fleet inspection: port 9222 = ChatGPT (logged in), 9223 = Claude, 9224 = Gemini.
  So the send reached the correct browser; the failure is in typing/submitting.
- `type` step ~187ms is far too fast for a real type+submit on ChatGPT.

**Proposed fix:**
1. Change `composerTypeForProvider` to return `'contenteditable'` for `chatgpt`
   (or better: source `composerType` from provider discovery / capability shape so it
   is not hard-coded).
2. Verify the contenteditable strategy in `composer-typing.ts` works against the
   ProseMirror div (`execCommand('insertText')` may need a fallback for newer ChatGPT
   builds that ignore `execCommand`).
3. Consider a dedicated send-button click for ChatGPT (`sendSelector`) instead of
   relying solely on the Enter key.
4. Add a post-type assertion: read the composer's text back before submitting and
   fail fast (with a clear error) if it is empty, instead of silently timing out for 60s.

**Related files:**
- `src/engines/conversation-manager.ts:111` (`composerTypeForProvider`), `:280-391` (send + capture)
- `src/engines/composer-typing.ts` (`typeMessage`, `submitMessage`)
- `src/engines/provider-selectors.ts` (`PROVIDER_URLS`, `PROVIDER_URL_PATTERNS`)
- `src/engines/conversation-manager.ts:124` (`CAPTURE_PATTERNS`)

**Follow-ups / hardening:**
- The 60s capture timeout with no fast-fail path is a poor UX and slows debugging.
  Add an early-exit when the composer is empty or when no matching request starts
  within N seconds of submit.
- `composerType` and selectors should not be hard-coded per provider — they drift
  every time a provider ships a frontend change. Drive them from discovery.
