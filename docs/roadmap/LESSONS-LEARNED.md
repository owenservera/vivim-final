# Lessons Learned — Multi-Chat Frontend Flow

Captured while wiring the React frontend to real provider conversations
(ChatGPT / Claude / Gemini) end-to-end: create → switch → list → send → receive.
Each lesson is written so a future agent avoids re-learning it the hard way.

---

## 1. There is more than one Chrome — always inspect the right port

**What bit us:** We inspected Chrome on `:9224`, saw it parked on Gemini, and
concluded ChatGPT send was hitting the wrong page. Wrong. The governor runs
**one Chrome instance per provider**:

| Port | Provider | State |
|------|----------|-------|
| 9222 | ChatGPT  | logged in |
| 9223 | Claude   | logged in |
| 9224 | Gemini   | logged in |

**Lesson:** Before blaming navigation, enumerate every debug port and map it to a
provider. Don't assume a single browser.

```powershell
foreach ($p in 9222,9223,9224) {
  (Invoke-RestMethod "http://127.0.0.1:$p/json" | ? { $_.type -eq 'page' }) |
    % { "$p : $($_.title) | $($_.url)" }
}
```

## 2. A 60s "empty response" is almost never the network capture — it's the input

**Symptom:** `send` returned `ok:true`, `text:''`, `timing.capture ≈ 60105ms`,
`timing.type ≈ 187ms`.

**Real cause:** the text never landed in the composer, so submit sent nothing,
so no `/backend-api/conversation` request ever fired, so capture waited the full
timeout. The capture layer was a **victim**, not the culprit.

**Tells to read from `timing`:**
- `type` far too fast (≈187ms) → the type/submit did nothing.
- `capture` == the full timeout → nothing was ever submitted upstream.

**Lesson:** Read the timing breakdown first. A suspiciously cheap `type` step
points upstream of the capture.

## 3. Provider composers drift — never hard-code the element type

ChatGPT's `#prompt-textarea` is a **contenteditable ProseMirror `<div>`**, not a
`<textarea>`. Our `composerTypeForProvider('chatgpt')` returned `'textarea'`, so
the typing strategy set `.value` via the `HTMLTextAreaElement` prototype setter —
a no-op on a `<div>`, failing **silently**.

**Lesson:**
- Composer type and selectors are volatile provider details. Hard-coding them
  guarantees breakage on the provider's next UI ship.
- Prefer sourcing `composerType`/selectors from **provider discovery / capability
  shape**, with hard-coded values only as a last-resort fallback.

## 4. Fail fast — never let a silent no-op become a 60s timeout

The typing helper wrote text and moved on without checking anything landed. That
turned a trivial selector/strategy bug into a 60-second dead wait per attempt,
which also made every debug iteration painfully slow.

**Fix applied:** the contenteditable strategy now **verifies** `textContent`
after writing and throws if empty, so the harness surfaces a real error instead
of timing out.

**Lesson:** After any "blind" DOM mutation via CDP, assert the post-state in the
same evaluate call and throw on failure. Cheap assertion << expensive timeout.

## 5. `throw new EngineError(...)` inside a CDP `Runtime.evaluate` is a bug

The injected page expressions used `throw new EngineError(...)`. `EngineError` is
a backend class that **does not exist in the page context** — so instead of a
clean "composer not found" it threw `ReferenceError: EngineError is not defined`,
masking the real problem.

**Lesson:** Code inside `Runtime.evaluate` strings runs in the **page**, not in
Node. Only use globals the page actually has (`Error`, `document`, `window`).
Treat these string blobs as a separate runtime and review them as such.

## 6. Submitting: the Enter key alone is fragile for contenteditable

Contenteditable composers often ignore a synthetic `Input.dispatchKeyEvent`
Enter. A real send-button click is more reliable — **but** the send button is
typically absent/disabled until text is present.

**Fix applied:** resolve the send button **at submit time**, click only if it
**exists and is enabled** (`!disabled && aria-disabled !== 'true'`), and fall
back to the Enter key otherwise.

**Lesson:** Resolve post-type UI (send buttons) after typing, not before, and
guard against clicking disabled controls (which silently do nothing and skip your
fallback).

## 7. FK chains must be auto-provisioned at the API boundary

A `Conversation` requires a `ProviderSession`, which requires a `VivimSession`
+ `ProviderAccount`. The frontend just wants to "start a chat." The
`POST /api/conversations/start` endpoint now auto-creates the whole chain so the
UI never has to know about session plumbing.

**Lesson:** Thin NL/UI shells should hand the backend an intent
("start chat with ChatGPT"), and the backend should provision required parent
rows transactionally — don't leak the schema graph to the client.

## 8. Prefer the account that actually has cookies

Account lookup originally returned an arbitrary row; the cookieless
`chatgpt_user-at-gmail.com` could win over `chatgpt_owservera` (hasCookies:true).

**Fix applied:** `orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]` so the
usable account is preferred. (Note: this was a red herring for PI-001 — the
cookie'd account still returned empty until the composer fix — but it's still
correct.)

**Lesson:** When multiple credentials exist, ordering must deterministically
prefer the usable one. And: fixing the *obvious* candidate (auth) doesn't mean
you fixed the *actual* bug — verify, don't assume.

## 9. PowerShell + `$PSScriptRoot` + launch scripts

`&&` chaining and indirect invocation (`pwsh -c`, piping into `pwsh -`,
call-operator) break `$PSScriptRoot`, collapsing every derived path. Background
launches via `Start-Process` also risk it.

**Fix applied:** added `scripts/start-bg.ps1` (non-blocking) and standardized on
`pwsh scripts/<name>.ps1` from repo root; poll `/health` after.

**Lesson:** Always invoke launch scripts as direct files from the repo root, and
never chain them with `&&` in PowerShell. Use a non-blocking launcher + health
poll instead of a blocking start that ties up the shell.

## 10. Debug the full vertical, in order

The productive path was: confirm frontend renders → confirm the right browser +
login → read `timing` → find the silent input no-op → fix + add assertions.
Jumping straight to "the capture regex must be wrong" would have wasted hours.

**Lesson:** Walk the stack in execution order (UI → API → engine → CDP → page),
verifying each hop, before optimizing any single layer.

---

## Concrete changes that came out of these lessons

- `composerTypeForProvider`: ChatGPT → `contenteditable`.
- `composer-typing.ts`: robust contenteditable insertion (execCommand →
  synthetic `beforeinput` → DOM write), post-write verification/throw, and
  `EngineError` → `Error` in all page expressions.
- `submitMessage` + governor submit node: try enabled send-button candidates,
  fall back to Enter.
- `POST /api/conversations/start`: auto-provision VivimSession + ProviderSession.
- Account ordering prefers default/cookie'd accounts.
- `scripts/start-bg.ps1` non-blocking launcher; AGENTS.md + skill updated.

See `PRODUCTION-ISSUES.md` (PI-001) for the tracked issue and remaining
hardening follow-ups.
