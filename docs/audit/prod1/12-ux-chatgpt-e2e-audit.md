# Production UX Audit: Area 12 — ChatGPT E2E User Experience & SSE Delta Stream Rendering
**Provider Target:** `chatgpt` (OpenAI ChatGPT UI)
**Frontend Subsystem:** `frontend/src/`, `frontend/src/canvas/`, Provider UI Slots
**Audit Focus:** End-to-End User Experience, SSE Delta Streaming, Markdown & Code Block UX

---

## 1. Executive Summary & User Experience Goal
The ChatGPT provider integration manages interactions with ChatGPT (`chatgpt.com`) via Chrome slave and SSE stream parsing into the Vivim frontend (`frontend/`).
- **Target User Experience:**
  1. **Prompt Entry & Keyboard Shortcut:** Smooth message entry into `#prompt-textarea` supporting standard `Enter` to send and `Shift+Enter` for line breaks.
  2. **Sub-second Token Streaming:** Low-latency display of streaming response text as Server-Sent Events (`data: {message: {content: {parts: [text]}}}`) arrive.
  3. **Rich Text Formatting & Code Block Features:** Instant rendering of markdown tables, LaTeX equations, syntax-highlighted code blocks with one-click copy buttons.
  4. **Stream Termination & Controls:** Immediate detection of `[DONE]` terminator, enabling user copy/retry/continue actions without UI lag.

---

## 2. Actual Code & UX Scan Findings

### 🟡 Finding 12.1: Wire Format vs API Schema Discrepancy
- **UX Issue:** The harvested ChatGPT inline parser (`seeds/parsers/harvested/chatgpt-openai-sse.ts`) expects API format delta structures (`choices[0].delta.content`), whereas the ChatGPT web UI wire format uses `message.content.parts`.
- **Actual Code Evidence:** Generic format-agnostic fallback handles the web UI delta stream cleanly, but direct parser matching can return lower confidence scores on unexpected UI schema tweaks.
- **UX Impact:** Occasional reliance on generic fallback parsing during web UI AB tests by OpenAI.

### 🟢 Finding 12.2: Instant Markdown & Code Block Copy UX
- **Actual Frontend Behavior:** `frontend/` stream renderer incrementally parses markdown tokens, avoiding layout shifts as text streams into the message view.

---

## 3. Automated UX Verification & E2E Testing Protocol

Future auditing agents must run the following end-to-end UX test steps:

```bash
# Step 1: Check ChatGPT provider health & profile cookies
bun run devops runtime-test status --provider=chatgpt

# Step 2: Test live CDP composer selectors
bun run devops runtime-test onboard test-selectors --provider=chatgpt

# Step 3: Run ChatGPT stream validation test
bun test tests/e2e/provider-stream-validate.test.ts
```

---

## 4. Remediation & Convergence Checklist
- [ ] Align `chatgpt-openai-sse.ts` inline DB parser to support both API delta format and web UI `parts[]` payload schemas natively.
- [ ] Add stream interruption recovery button on the frontend canvas when an SSE connection drops unexpectedly.
