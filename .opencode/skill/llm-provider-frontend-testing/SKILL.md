---
name: llm-provider-frontend-testing
description: >-
  LLM-as-Human frontend provider testing for vivim-final. The LLM acts as a curious human
  tester who explores the frontend UI through interactive interviews — asking the UI questions
  (clicks, inputs, navigation), interpreting answers (DOM state, screenshots, console), and
  following curiosity rather than checklists. Covers all providers (gemini, chatgpt, claude,
  deepseek, qwen, grok). Use when testing provider frontend integration, verifying UI renders
  per provider, debugging frontend-provider disconnects, or running exploratory frontend test
  sessions. Flexible and adaptive — the LLM decides what to test based on what it finds.
---

# LLM-as-Human Frontend Provider Testing for vivim-final

You are a **curious human tester** exploring a web application. You don't follow checklists —
you follow your curiosity. You ask the UI questions by interacting with it, and you interpret
its answers by reading the DOM, screenshots, and console output. You have a conversation
with the UI, and you report what you discover.

## Architecture Context (Critical for Effective Testing)

### Backend Flow (what happens when you invoke via CommandPalette)

```
1. NLCL Engine interprets "send message to gemini" → resolves to capabilityId
2. POST /api/capabilities/:id/execute → ConversationManager.send()
3. CapabilityResolutionEngine resolves provider-bound capability (send_message)
4. ChromeGovernor.ensureRunningForAccount(providerId, accountId) → spawns Chrome if needed
5. CDP type_text (composer selector) + submit (send button/Enter)
6. Network.enable → capture streaming response via provider-specific pattern
7. StreamParserEngine.parse() — fallback chain: provider parser → generic → system
8. Store blocks + ContentUnits + Nodes (captureAsNode links assistant→user)
9. WS broadcast conversation:complete → frontend renders
```

### Frontend Architecture (Canvas-Based)

The UI is **canvas-based**, not a traditional chat sidebar + composer:

- **LivingCanvas** (`frontend/src/components/canvas/LivingCanvas.tsx`) — main surface
- **CommandPalette** (Cmd+K) — type natural language to invoke capabilities
- **ConversationsPanel** (dialog) — select/browse conversations
- **ProvidersPanel** (dialog) — manage provider connections
- **DevConsole** (Ctrl+\`) — WS firehose + NL inject + latency monitor
- **Composer** (`frontend/src/components/chat/Composer.tsx`) — RAF-batched streaming renderer
- **CapabilityCatalog** — searchable capability grid

### Provider Selectors (from `src/engines/provider-selectors.ts`)

| Provider | Composer | Send Button | Streaming Format |
|----------|----------|-------------|------------------|
| **gemini** | `.ql-editor[contenteditable="true"]` (Quill) | `button[aria-label='Send message']` | batchexecute RPC (custom, NOT SSE) |
| **chatgpt** | `#prompt-textarea` / `textarea[data-testid="prompt-textarea"]` | `[data-testid='send-button']` | SSE `data: {message: {content: {parts: [text]}}}` |
| **claude** | `div[contenteditable="true"].ProseMirror` | `[aria-label='Send Message']` | Anthropic SSE `content_block_delta` |
| deepseek/qwen/grok | Seeded, no parser/Chrome profile yet | | |

### Chrome Profiles (Source of Truth for Auth)

```
chrome-profiles/
  gemini/owservera/          # cookies = logged in
  chatgpt/owservera/
  claude/owservera/
  discovery/protocol-probe/  # for protocol discovery
```

**Profile allocator enforces: one profile per (provider, account).** `isAuthenticated()` checks cookie files, NOT DB `loginState` row.

---

## How to Think About This

You are NOT running automated tests. You are a QA engineer who just got access to a new build.
Your job is to:

1. **Explore** — open the app, look around, see what's there
2. **Ask questions** — "What happens if I click this?" "Can I send a message to Gemini?"
3. **Interpret answers** — read the DOM, take screenshots, check console
4. **Follow curiosity** — if something looks weird, dig deeper. If something works, try to break it
5. **Report discoveries** — not pass/fail checklists, but stories: "I tried X, expected Y, got Z"
6. **Interview the UI** — treat each provider as a character to interview: "Show me what you can do"

---

## The Interview Framework

An "interview" is a back-and-forth between you and the UI. You ask a question (via interaction),
the UI answers (via DOM/screenshot/console), you interpret, then ask a follow-up.

### Interview Structure

```
ASK → INTERPRET → FOLLOW UP → RECORD
  │       │            │          │
  │       │            │          └─ Log finding to session-log.jsonl
  │       │            └─ "Interesting, what about...?"
  │       └─ Read DOM, screenshot, console
  └─ Click, type, navigate, wait
```

### Types of Questions to Ask the UI

**Exploratory** — "What's here?"
- Navigate to the app, take a screenshot, ask "What do I see?"
- Find interactive elements, ask "What do you do?"

**Functional** — "Can you do this?"
- "Can I create a new conversation?"
- "Can I send a message to Gemini?"
- "Does the streaming response actually show up?"

**Boundary** — "What breaks you?"
- "What if I send an empty message?"
- "What if I type 5000 characters?"
- "What if I click send twice really fast?"

**Comparative** — "How do you differ?"
- "Show me Gemini vs ChatGPT — do they look the same?"
- "Which providers have a working composer?"
- "Do all providers stream responses the same way?"

**Curiosity-driven** — "That's odd..."
- If something looks off, investigate
- If something works unexpectedly well, try to understand why
- If you notice a pattern, test it across providers

---

## The Session Flow

Every test session is a story, not a script. Here's how it unfolds:

### Act 0: Pre-Flight Check (2 min)

Before you can test anything, verify the system is running:

```bash
# Check backend is running (port 9420)
bun run devops runtime-test health

# Check provider status
bun run devops runtime-test status --provider=gemini

# Check if Chrome slaves are running for the provider
bun run devops runtime-test status --provider=gemini
```

**If no Chrome slave is running for your provider**, you MUST start one first:

```bash
# First-time setup (launches Chrome, you log in manually)
bun run devops runtime-test setup --provider=gemini --account=owservera@gmail.com

# Subsequent runs (reuses authenticated profile)
bun run devops runtime-test onboard --provider=gemini  # includes live phases
```

### Act 1: The Entrance (2 min)

Walk into the app like a first-time user.

```
1. Navigate to http://localhost:3000
2. Take a screenshot
3. Ask yourself: "What do I see? What can I do here?"
4. Describe the UI in your own words — not technical specs, but how it FEELS
5. Find the LivingCanvas surface, the CommandPalette (Cmd+K), the Conversations panel, the Providers panel
6. Ask: "What capabilities are available? Can I interact with a provider?"
```

**Log:** First impression, available providers, obvious UI elements.

### Act 2: The Full Send/Receive Loop (15 min)

This is the **core of provider testing**. You must verify that a full conversation
round-trip works through the frontend — message sent via the CommandPalette (Cmd+K)
or Conversations panel, capability invoked, response received and rendered in the
canvas. Both sides must be visible in the UI at the end.

#### Step 1: Open the Commands Palette or Conversations Panel

The canvas-based UI has no traditional composer. Interaction happens through:
- **CommandPalette** (Cmd+K): type natural language to invoke capabilities
- **ConversationsPanel** (dialog): select a conversation to interact with
- **ProvidersPanel** (dialog): manage provider connections

```
1. Press Cmd+K to open the CommandPalette
2. Or click "Open conversations panel" to see the conversation list
3. Or click "Open providers panel" to see registered providers
4. Take a screenshot of what appears
5. Check the console for errors while navigating
6. Ask: "What can this UI do? How do I invoke a capability?"
```

**Pass gate:** The UI responds to keyboard or panel interaction, no console errors.

#### Step 2: Invoke a Capability via CommandPalette

Type a natural language command to send a message to a specific provider.

```
1. Press Cmd+K to open the CommandPalette
2. Type: "send message to gemini saying hello"
3. Press Enter
4. Observe: the NLCL interpreter processes this → resolves to a capability
5. Take a screenshot of the CommandPalette result
```

**Critical check — did the capability execute?**

After your invoke action:
1. Wait 2-3 seconds for the DOM to update
2. Check the canvas for a new conversation/message appearing
3. Check the ConversationsPanel (open it) for a new entry
4. Check console for errors during execution
5. If nothing visible: check network tab for `/api/nlcl/interpret` and `/api/capabilities/*/execute`

**Common NL commands to try:**

| Command | Expected Behavior |
|---------|-------------------|
| `send message to gemini saying hello` | Creates conversation, sends message via Chrome |
| `create a new chat with claude` | Creates conversation with Claude |
| `list my conversations` | Shows conversation list |
| `switch to chatgpt` | Switches active provider |
| `show providers` | Shows provider health/status |

**Log:** NL command used, capability routed to, whether conversation created.

#### Step 3: Watch the Streaming Response

After the capability executes, the assistant response should arrive via streaming.
**Watch it happen — don't just check the final state.**

```
1. After sending, take a screenshot every 2-3 seconds to capture streaming progress
2. Look for:
   - A "typing" or "thinking" indicator appearing on the canvas
   - Text appearing in the assistant message area progressively
   - Any streaming animation (pulsing dots, progress bar)
   - The response growing in real-time
3. Use playwright_browser_find periodically to check for partial text:
   "Can I find 'capital' in the streaming response?" → No yet
   "Can I find 'capital of France is Paris'?" → Now it's complete
4. Watch for a completion signal:
   - Streaming indicator stops
   - Response area stabilizes
   - New send capability becomes available
   - "Done" or checkmark appears
```

**How to detect streaming in progress (JavaScript):**

Use `playwright_browser_evaluate` to check streaming state:

```javascript
// Check if streaming is active on canvas
() => document.querySelector('[data-streaming="true"]') !== null

// Check for message elements in canvas rendering area
() => document.querySelectorAll('.message-block, [data-role="assistant"], [data-role="user"]').length

// Check for loading/thinking indicators
() => document.querySelector('.streaming-indicator, .thinking, .typing') !== null

// Check network requests for capability execute
() => {
  const entries = performance.getEntriesByType('resource').filter(r => r.name.includes('/api/capabilities'));
  return entries.map(e => ({ url: e.name, status: e.responseStatus }));
}
```

**Pass gate:** Response appears progressively and completes. Final response
is visible in the canvas/conversation thread.

#### Step 4: Verify the Complete Conversation

After streaming has finished, verify the full conversation is visible:

```
1. Take a full-page screenshot showing the entire conversation on canvas
2. Open ConversationsPanel — confirm the conversation is listed
3. Confirm: user message IS visible
4. Confirm: assistant response IS visible
5. Count the message elements in the thread
6. Check: is there exactly 1 user message + 1 assistant response?
7. Read the response content — does it make sense for the prompt?
8. Check console for any errors that fired during streaming
```

**Use this JS probe to count messages on canvas:**

```javascript
// Count user messages
() => document.querySelectorAll('[data-role="user"], .message-user, [data-message-role="user"]').length

// Count assistant messages
() => document.querySelectorAll('[data-role="assistant"], .message-assistant, [data-message-role="assistant"]').length

// Get all message content
() => Array.from(document.querySelectorAll('.message-block, [data-role="assistant"], [data-role="user"]')).map(e => e.textContent?.slice(0, 200))
```

**Pass gate:** 1 user + 1 assistant message visible, response content is coherent.

#### Step 5: Multi-Turn — Continue the Conversation

A real conversation has multiple turns. Send a follow-up message via CommandPalette:

```
1. Press Cmd+K again
2. Type: "tell me more about that"
3. Press Enter
4. Watch for the second streaming response
5. Verify: now there are 2 user messages + 2 assistant messages visible
6. Check: the conversation history shows ALL previous messages
7. Verify: the second response builds on context of the first
```

**Do NOT create a new conversation for follow-ups — use the existing thread via CommandPalette.**

**Pass gate:** Multi-turn works, history is maintained, context is preserved.

---

### Act 3: The Exploration (10 min)

Follow your curiosity wherever it leads. The canvas-based UI has panels,
a CommandPalette (Cmd+K), and a LivingCanvas surface. Let the UI guide you.

Some paths to explore:

- **CommandPalette** (Cmd+K): "What commands are available?" → Type natural language
- **ConversationsPanel**: "What conversations exist?" → Browse the list
- **ProvidersPanel**: "Which providers are connected?" → Check status
- **Canvas**: "What's on the canvas?" → Explore nodes, edges, and surfaces
- **Errors**: "What if something breaks?" → Try invalid input, empty queries
- **Parity**: "Do all providers work the same way?" → Compare via NL commands

For each discovery:
1. State what you expected
2. Describe what actually happened
3. Take a screenshot as evidence
4. Note the severity: "works great" / "slightly off" / "broken" / "confusing"

### Act 4: The Interview (10 min)

Have a structured conversation with each provider's canvas surface.

Treat each provider as a character you're interviewing:

```
YOU (Cmd+K): "Send a message to Gemini saying hello"
UI: [CommandPalette processes, capability routes to Gemini]
YOU: "What happened?"
UI: [check canvas, check conversation list, check provider status]
YOU: "Switch to ChatGPT now."
UI: [CommandPalette routes to ChatGPT capability]
YOU: "Nice. Now try Claude."
```

For each provider, answer:
- Can I invoke it via CommandPalette?
- Does the capability route to the correct provider?
- Is a conversation created/updated?
- Does streaming work (if applicable)?
- Does the response look right?
- Are there any errors?
- How does this provider compare in the canvas workflow?

### Act 5: The Stress Test (5 min)

Push the canvas UI to its limits.

- Send rapid NL commands (send 3 commands in quick succession — check if all route correctly)
- Type long natural language prompts (500+ characters — does the canvas handle it?)
- Use emoji and unicode (does rendering handle it?)
- Switch providers mid-flow (does the conversation history persist?)
- Open multiple conversations (does the UI handle concurrent threads?)
- Check console for errors throughout

### Act 6: The Report (3 min)

Write up your findings as a story.

Not a checklist — a narrative:

> "I opened the canvas and saw the LivingCanvas surface with the CommandPalette
> (Cmd+K) and the Conversations panel. I started with Gemini because it was
> registered and active. I opened the CommandPalette and typed 'send message to
> gemini saying hello' and hit Enter. The system routed to cap:opencode:send
> and returned asking for a prompt parameter. I refined my command and the
> capability executed — I checked the canvas, the conversation list, and the
> console for any errors."
> 
> "When I switched to ChatGPT, the capability routing was different — the
> NLCL interpreter picked up a different intent. Both providers were registered
> and the Conversation list updated accordingly."

---

## Full Send/Receive Failure Mode Catalog

When a capability invocation fails, here's how to diagnose which layer broke:

### Capability didn't route correctly

| Symptom | Likely Cause | What to Check |
|---------|-------------|---------------|
| CommandPalette shows 0 results | No NL pattern matches the query | Check if the phrase triggers a capability in the NLCL catalog (`src/engines/nlcl/catalog.ts`) |
| Wrong capability is invoked | NLCL classified intent incorrectly | Check `/api/nlcl/interpret` response for `intent` and `slug` |
| Missing required parameter | Capability needs inputs | Check the `missing` array in the interpret response |
| Capability registered but not executable | No provider is active/live | Check `/api/providers` and `/api/fleet/status` |

### Canvas didn't render the response

| Symptom | Likely Cause | What to Check |
|---------|-------------|---------------|
| Canvas is empty after invoke | Response not captured | Check if a conversation was created; check `/api/conversations` |
| Canvas shows partial output | Streaming broke | Check WebSocket/SSE connection; check console for streaming errors |
| Canvas shows error state | Provider returned error | Check console for error message; check backend provider logs |
| Canvas didn't update at all | No response was received | Check if Chrome slave is running (`liveSlave`); check network for timeouts |

### Conversation thread issues

| Symptom | Likely Cause | What to Check |
|---------|-------------|---------------|
| New conversation not created | Capability didn't persist | Check `/api/conversations` for new entry after invoke |
| Messages missing from thread | State reset or re-render bug | Check component re-render trace; check if messages stored in state |
| Conversation list doesn't update | Frontend state not synced | Check if conversation list refetch was triggered |

---

## Canvas Interaction Reference

### How to invoke a capability

The primary interaction model is the CommandPalette (Cmd+K):

```
press Cmd+K → type natural language → press Enter → capability routes
```

Alternatively, use the ConversationsPanel to select an existing conversation.

### How to find capability results in the DOM

Use `playwright_browser_snapshot` and look for:
- Capability execution indicators on the canvas
- Message elements in the conversation thread
- Network requests to `/api/nlcl/interpret` and `/api/capabilities/*/execute`
- The `LivingCanvas` rendering area for visual output

### How to check streaming on the canvas

Check for canvas-based streaming indicators:
- Elements with `data-streaming="true"`
- Typing indicators or progress bars on the canvas
- Growing message elements in the canvas rendering area

### Provider-Specific Canvas Notes

**Gemini**: Provider is registered and Active in DB. Profile is on disk with cookies (`chrome-profiles/gemini/owservera/`). No live Chrome slave means send/receive cannot execute — must start a Chrome slave first via `bun run devops runtime-test setup --provider=gemini --account=owservera@gmail.com`.

**ChatGPT**: Provider is registered and Active in DB. Profile is on disk with cookies (`chrome-profiles/chatgpt/owservera/`). Same Chrome slave requirement.

**Claude**: Provider is registered and Active in DB. Profile is on disk with cookies (`chrome-profiles/claude/owservera/`). Same Chrome slave requirement.

**DeepSeek**: Provider is registered and Active in DB with `deepseek/001_reasoning_sse` parser seeded. No Chrome profile on disk yet — send/receive cannot execute until one is set up via `bun run devops runtime-test setup --provider=deepseek --account=owservera@gmail.com`.

**Qwen/Grok**: Seeded in DB but no parser rows yet, no Chrome profiles. Will fail at parse/capture stage.

---

## Streaming Response Verification (DOM Probing)

Use these JavaScript probes during streaming to verify progress:

```javascript
// Check if any assistant message exists in the DOM
() => document.querySelector('[data-role="assistant"], [data-message-type="assistant"], .assistant-message, .message-assistant') !== null

// Check if there's a "thinking" or "streaming" indicator
() => {
  const indicators = document.querySelectorAll('.streaming-indicator, .typing-indicator, .thinking, [data-streaming="true"], .animate-pulse');
  return indicators.length > 0 ? Array.from(indicators).map(e => e.textContent || e.outerHTML.slice(0, 100)) : null;
}

// Check network requests for the capability execute call
() => {
  const entries = performance.getEntriesByType('resource').filter(r => r.name.includes('/api/capabilities'));
  return entries.map(e => ({ url: e.name, status: e.responseStatus }));
}

// Check the canvas for rendered content
() => Array.from(document.querySelectorAll('.message-block, [data-role="assistant"], [data-role="user"]')).map(e => e.textContent?.slice(0, 200))

// Check for error toasts or error states
() => document.querySelector('[role="alert"], .error-toast, .error-message, [data-error="true"]')?.textContent
```

Run these probes at 3-second intervals after capability invocation to build a timeline:
- **T+0s**: Command submitted, check network for `/api/nlcl/interpret` and `/api/capabilities/*/execute`
- **T+3s**: Check for canvas rendering or conversation list update
- **T+6s**: Check for response data in canvas or conversation thread
- **T+9s**: Check if response is still growing
- **T+15s**: Check if capability execution has completed

---

## Multi-Turn Capability Deep Check

After a successful first invoke, the real test is multi-turn with different providers:

```
Turn 1: "Send Gemini a message saying hello" → Capability routes to Gemini
Turn 2: "Now send the same to ChatGPT" → Capability routes to ChatGPT  
Turn 3: "Check the conversation list — are there entries?" → Verify persistence
```

**Multi-turn verification checklist:**

1. After each turn, confirm the conversation list updates
2. Each provider's response is routed correctly (not mixed up)
3. The canvas re-renders for each provider's response
4. Check the conversation list for new entries after each invoke
5. Check console for errors across multiple rapid invocations

---

## Cross-Provider Capability Parity Check

When testing multiple providers, run the SAME natural language command across all of them:

```
Test message: "Write a haiku about testing software"

Provider A: Gemini → [screenshot of full send/receive]
Provider B: ChatGPT → [screenshot of full send/receive]
Provider C: Claude → [screenshot of full send/receive]
```

Compare side-by-side:
- Did all providers successfully send and receive?
- Did all providers stream? Or did some show full response at once?
- Did all providers render the message in the same location?
- Did all providers handle the same message length?
- Any provider that CRASHED or TIMED OUT during the cycle?

---

## What to Capture

For every meaningful interaction, capture:

1. **Screenshot** — visual proof of what you see
2. **DOM snapshot** — accessibility tree for structure verification
3. **Console messages** — errors, warnings, logs
4. **Your interpretation** — what you expected vs what happened
5. **Severity** — pass / minor-issue / major-issue / blocker

### Critical Evidence for Send/Receive

For each successful send/receive cycle, you MUST have:

1. Screenshot of the CommandPalette with the NL command
2. Screenshot of the user message appearing in the thread/canvas
3. Screenshot of streaming in progress (partial response)
4. Screenshot of the completed response
5. Console messages from the entire send/receive window
6. DOM probe result showing message count (user + assistant)

### Logging to Session Log

```bash
# Log a discovery
bun run devops llm-testing-log finding \
  --provider=gemini \
  --severity=P1 \
  --category=streaming-visual \
  --detail="streaming indicator invisible on dark background — need higher contrast"

# Log a send/receive cycle result
bun run devops llm-testing-log finding \
  --provider=chatgpt \
  --severity=P0 \
  --category=send-receive \
  --detail="FULL SEND/RECEIVE PASS — message appeared, streamed, completed in 8.2s, multi-turn verified"

# Log a streaming failure
bun run devops llm-testing-log finding \
  --provider=gemini \
  --severity=P1 \
  --category=streaming \
  --detail="Streaming started but froze at 40% — response never completed, send button remained disabled"

# Log a phase
bun run devops llm-testing-log phase \
  --provider=gemini \
  --phase=interview \
  --status=pass \
  --durationMs=300000

# Or write directly
echo '{"provider":"gemini","severity":"P2","category":"ux","detail":"composer placeholder text is generic, not provider-specific","file":"frontend/src/components/chat/Composer.tsx"}' >> .runtime/llm-testing/session-log.jsonl
```

---

## Adaptive Behavior

This skill is intentionally **not rigid**. You adapt based on what you find:

- **If the UI is broken** → Focus on diagnosing why, not completing all phases
- **If the UI is great** → Push harder on edge cases, try to break it
- **If one provider works but another doesn't** → Dig into the difference
- **If you find an interesting pattern** → Follow it across all providers
- **If something is confusing** → Explore it until you understand

The phases above are **suggestions**, not requirements. Your curiosity is the guide.

**BUT: Act 2 (Full Send/Receive Loop) is the CORE of provider testing.**
If you skip it for any provider, you haven't tested the provider on the frontend.
Every provider must complete at minimum Steps 1-4 of Act 2.

---

## Provider-Specific Interview Prompts

These are starting points — follow your curiosity from here.

### Gemini
- "Show me your Quill editor — does it feel natural?"
- "Can I send with Enter (I shouldn't be able to — Quill uses Enter for newline), or do I need to click?"
- "Stream your response — I want to see the progressive rendering"
- "After streaming, can I send a follow-up?"
- "Do all my messages stay visible?"

### ChatGPT
- "Your textarea looks different from Gemini's — is that better or worse?"
- "Do you support the same capabilities as Gemini?"
- "Show me your streaming format"
- "Can I hold a multi-turn conversation?"

### Claude
- "Your ProseMirror editor — how does it compare to Quill?"
- "Are your responses different from the others?"
- "Do you have any unique capabilities?"
- "Does the full send/receive cycle work end-to-end?"

### DeepSeek / Qwen / Grok
- "Are you even available in the UI?"
- "If I try to talk to you, what happens?"
- "Do you share capabilities with the main providers?"
- "Can I complete a full send/receive cycle with you?"

---

## What This Skill is NOT

- **Not a rigid test script** — you adapt based on what you find
- **Not a backend API test** — you test through the frontend UI
- **Not a code review** — you test the running application
- **Not a build verification** — the frontend must already be running
- **Not a CDP automation test** — you interact like a human, not a robot

---

## Tool Reference

### Primary Tools

| Tool | When to use |
|------|-------------|
| `playwright_browser_navigate` | Move to a new page/URL |
| `playwright_browser_take_screenshot` | Capture what you see |
| `playwright_browser_snapshot` | Read the page structure |
| `playwright_browser_find` | Locate something specific |
| `playwright_browser_click` | Interact with an element |
| `playwright_browser_type` | Enter text (use `submit=true` to send via Enter) |
| `playwright_browser_wait_for` | Wait for something to happen |
| `playwright_browser_console_messages` | Check for errors |
| `playwright_browser_evaluate` | Run JS to inspect streaming state |

### Supporting Commands

| Command | Purpose |
|---------|---------|
| `bun run devops runtime-test health` | Check backend is running |
| `bun run devops runtime-test status --provider=<slug>` | Provider status |
| `bun run devops verify-cross-surface` | Cross-surface parity |
| `bun run devops llm-testing-log finding ...` | Log a discovery |
| `bun run devops runtime-test setup --provider=<slug> --account=<email>` | Launch Chrome profile for provider |
| `bun run devops runtime-test onboard --provider=<slug>` | Run 8-phase onboarding |

### Streaming Verification Tools

Use `playwright_browser_evaluate` with the probes in the Streaming Response
Verification section above. These let you inspect the DOM for streaming
state without taking a full snapshot.

---

## Session Report Format

Write the report as a **narrative**, not a table:

```markdown
# Frontend Test Session: <provider> — <date>

## First Impressions
[What you saw when you opened the app]

## Send/Receive Results (CORE)

### Provider: <name>
- **Composer type:** textarea / contenteditable / Quill / ProseMirror
- **Send method:** Enter key / send button click
- **User message appeared:** yes / no → evidence
- **Streaming started:** yes / no → latency
- **Streaming completed:** yes / no → duration
- **Final response visible:** yes / no → screenshot
- **Multi-turn:** works / fails → turns attempted
- **Console errors:** none / list
- **Duration:** X seconds for full cycle

### Provider: <name> — same structure

## Discoveries
[What worked, what didn't, what surprised you]

## Provider Comparison
[How the providers differ in the UI — focus on the send/receive experience]

## Edge Cases
[What you tried to break, what happened]

## Streaming Quality
[For each provider: how smooth was streaming? Any visual glitches?]

## Recommendations
[What should be fixed, improved, or investigated]

## Evidence
[Screenshots and DOM snapshots with annotations]
```

---

## 8-Phase Onboarding (if a provider fails)

```
bun run devops runtime-test onboard --provider=gemini
  1. discover → CDP protocol discovery (composer, send, capture patterns)
  2. infer → Infer parser from real streaming data
  3. test-selectors → Validate all CDP selectors against live DOM
  4. test-parse → Real wire-format parsing against fixtures
  5. test-cap → Capability registration + execution via /api/interpret
  6. test-frontend → E2E: canvas mount + capability invoke + DOM assert
  7. verify → Cross-surface: CLI + API + MCP + UI all resolve
  8. converge → Spec + code + arch alignment check
```

---

## Quick Reference: Common NL Commands to Try

| Command | Expected Capability |
|---------|---------------------|
| "send message to gemini saying hello" | `send_message` → routes to Gemini |
| "create a new chat with claude" | `conversation:create` → provider=claude |
| "list my conversations" | `conversation:list` |
| "switch to chatgpt" | `conversation:switch` → provider=chatgpt |
| "show providers" | `provider:health_get` |
| "run llm tests" | `cap:llm_test:run` |
| "check parity" | `cap:llm_test:parity` |

Use these as interview openers — then follow your curiosity!