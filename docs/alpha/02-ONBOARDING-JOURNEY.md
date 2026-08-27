# Onboarding Journey — Progressive Disclosure Design

> Philosophy: **no walls, only nudges.** Every feature is reachable from minute one.
> Tiers are suggestions shaped by what the tester has already done, not gates that
> block what they haven't. The Codex wiki is always one search away.

---

## 1. The Four Stages

| Stage | Name | Timebox | Exit signal | What they know |
|---|---|---|---|---|
| **S0** | Arrival | 0–15 min | First message sent | "This installed and it works" |
| **S1** | Core Loop | Day 1 | Used palette + 3 messages | "I can talk to it and it remembers" |
| **S2** | Fluency | Week 1 | Executed a non-conversation cap | "It does more than chat" |
| **S3** | Mastery | Week 2+ | Connected a provider or wrote an automation | "It's *my* platform" |

Each stage has four parallel tracks — tester picks the one that fits their energy:

| Track | Flavor | Example |
|---|---|---|
| **Explorer** | Click everything, learn by doing | "What does this button do?" |
| **Builder** | Connect real AI, build workflows | "How do I hook up my Claude?" |
| **Observer** | Read the Codex, understand the system | "Show me how it all fits together" |
| **Breaker** | Stress-test, find edges, report bugs | "Can I crash it?" |

The four tracks are suggestions embedded in the Day 0 welcome pack (§5). Testers
are told: "pick one, or mix — there's no wrong answer."

## 2. S0 — Arrival (0–15 minutes)

### What happens in code
1. Installer runs → app launches → window hidden → sidecar boots → `/readyz` 200 → window reveals
   (`src/desktop/sidecar-entry.ts`, `tauri.conf.json:21`)
2. Frontend calls `checkNeedsSetup()` → returns `true` → `GuidedLanding` auto-opens
   (`frontend/src/app/page.tsx:109-119`)
3. GuidedLanding walks through: workspace name → profile selection → first provider choice
   (or skip to local agent)
4. Onboarding state tracked via `api/onboarding/state` (`page.tsx:109` calls this on mount)
5. On completion → `api/onboarding/complete` fires → GuidedLanding closes → OnboardingTour
   mounts for returning visits

### Tester experience
- Friendly face: "Welcome to Vivim. This is your workspace."
- 3 screens max: name → pick one AI to talk to → go
- No account creation, no email, no cloud login required
- If they skip everything: workspace defaults to `ws:global`, user `user:demo`
  (`page.tsx:63-64`)

### Wiki articles surfaced
- `welcome` (L0)
- `what-is-vivim` (L0)

### Mission card (delivered in-app or Day 0 message)
> **Quest: First Word**
> Send Vivim a message. Any message. "Hello" works. You'll see streaming blocks
> appear in real-time. That's the core loop. Everything else builds on this.

### Success metric
- ≥80% of testers send a message within 15 minutes of install.

---

## 3. S1 — Core Loop (Day 1)

### What happens in code
- Tester creates conversations (`conversation_create` cap)
- Messages stream back via WebSocket, RAF-batched into blocks
  (`src/server/websocket.ts`, frontend `Composer.tsx`/`MessageBlock.tsx`)
- Three layers visible via `Cmd+1/2/3` (`page.tsx:138-145`):
  - **Chat** — conversational surface, default
  - **Build** — capability + canvas workspace
  - **Admin** — provider health, fleet config, RBAC
- Panels float on demand: `Cmd+.` toggles dock, `Cmd+`` ` `` opens DevConsole
- Command palette via UnifiedEntry — type natural language, NLCL parses intent
  (`src/engines/nlcl/nlcl-engine.ts`)
- Help widget available (bottom-right? confirm in `HelpWidget.tsx`) — Search/Chat/Tours/Actions

### Tester experience
- "I can talk to it and it remembers" — conversations persist across restarts
  (SQLite at `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite`)
- Layers reveal scope: chat is the daily driver, build is for power, admin is for ops
- Command palette feels like Spotlight — type what you want, it finds the capability

### Wiki articles surfaced
- `conversation/send` (L1)
- `ui/layers` (L1)
- `ui/palette` (L1)
- `ui/panels` (L1)

### Tour: "Core Loop Tour" (5 steps, ~3 min)
Built on existing `OnboardingTour` component (`frontend/src/components/canvas`):
1. Spotlight: UnifiedEntry — "This is your command center. Type anything."
2. Spotlight: Active conversation — "Your messages stream here in real-time."
3. Spotlight: Layer switcher — "Cmd+1/2/3 switches between Chat, Build, and Admin."
4. Spotlight: Panel dock — "Cmd+. toggles floating panels."
5. Spotlight: Help widget — "Stuck? This is your lifeline."

### Mission cards
> **Quest: Three Conversations**
> Send messages in the Chat layer. Switch to Build with Cmd+2 and explore.
> Switch to Admin with Cmd+3. You now know how to navigate Vivim.

> **Quest: Palette Power**
> Open the command palette and type "health check". Vivim will run
> the system health capability. You just controlled the system with
> natural language.

### Communication
- **Day 1 check-in message** (delivered via the platform's message channel — Signal/WhatsApp/Discord):
  "Hey — Vivim is live on your machine. Open it up and send a message. If anything
  feels weird, screenshot it and send it to me. The help widget (bottom-right) has
  a search bar — type what you're looking for."

### Feedback probe (Day 3)
Use the structured template (§6). Short version: "What surprised you? What frustrated
you? What do you wish it did?"

---

## 4. S2 — Fluency (Week 1)

### What happens in code
- Tester discovers the capabilities catalog via palette or help Search
- Executes a non-conversation capability for the first time:
  - `system:health` — "health check" in palette
  - `memory:assert` — "remember that I prefer dark mode"
  - `knowledge:search` — "search for conversations about project X"
  - `admin:config_get` — "show my config"
- Learns that every NL phrase maps to a capability (`POST /api/interpret` → NLCL → registry)
- Starts using the Help widget's Tours tab for self-guided discovery

### Tester experience
- "It does more than chat" — the capability system is the aha moment
- Natural language is the interface, not buttons
- Memory and knowledge make it *personal* — "it knows things about me now"

### Wiki articles surfaced
- `capabilities/catalog` (L2)
- `nl/control` (L2)
- `memory/facts` (L2)
- `knowledge/ingest` (L2)
- `help/self-service` (L2)

### Tour: "Beyond Chat" (4 steps, ~2 min)
1. "Type 'remember that my project deadline is Friday'" → memory:assert fires
2. "Now type 'what do you know about my deadlines?'" → memory:query fires
3. "Type 'health check'" → system status returned
4. "Every phrase maps to a capability. The wiki has the full list."

### Mission cards
> **Quest: Teach and Recall**
> Tell Vivim a fact using natural language: "Remember that my favorite
> color is blue." Then ask it back: "What's my favorite color?" The
> memory engine persists across restarts.

> **Quest: Capability Explorer**
> Open the help widget → Actions tab. Execute three different capabilities.
> Note which ones worked and which ones didn't — that's valuable feedback.

### Escalation trigger
If a tester has NOT executed a non-conversation capability by Day 5:
send a personal message: "Try typing 'health check' in the entry box.
It runs a system diagnostic — you'll see it respond instantly."

---

## 5. S3 — Mastery (Week 2+)

### What happens in code
- Provider fleet: tester connects a real AI provider via Chrome CDP
  - Install Chrome → log into Claude/Gemini/DeepSeek → point Vivim at profile
  - `chrome-profiles/<provider>/<accountId>` directory structure
  - `ProfileAllocator.isAuthenticated()` checks cookie files (not DB)
  - Streaming parsers parse real responses through `StreamParserEngine`
- OpenCode local agent: if `opencode` CLI installed, `cap:agent:run` dispatches
  to a real local agent session
- Automation: `/api/automate` routes — recipe authoring (thin UI today)
- Canvas building: CanvasEngine v7 layers, oracle visibility, capability executor
  (`src/canvas/canvas-engine.js`)

### Tester experience
- "It's *my* platform" — connected to *their* AI accounts
- Can build automation workflows, not just chat
- Dev console (`Cmd+`` ` ```) reveals the engine room

### Wiki articles surfaced
- `providers/fleet` (L3)
- `agent/opencode` (L3)
- `diagnostics/logs` (L3)
- `meta/status-board` (L3)

### Tour: "Provider Connect" (7 steps, ~8 min)
1. "Providers are AI services Vivim can talk to. Let's connect one."
2. "Open Chrome and log into Claude (claude.ai)."
3. "Vivim looks for login cookies in chrome-profiles/."
4. "Once connected, type 'send message to Claude: what's 2+2?'"
5. "Vivim will automate the browser, send your message, and stream the response back."
6. "Not every provider works yet — Claude, Gemini, and DeepSeek are tested."
7. "See the providers/fleet wiki article for the full status."

### Mission cards
> **Quest: Provider Pioneer**
> Connect a provider (Claude recommended for first try). Send a message
> through it. Report: did the response stream back correctly? Any lag?

> **Quest: Dev Explorer**
> Press Cmd+` to open the Dev Console. Look at the WS event stream.
> You're seeing the raw nervous system of Vivim. Send a message and
> watch the events fly.

### Communication
- **Week 2 check-in**: "How's Vivim treating you? If you haven't tried
  connecting a provider yet, the help widget → Tours tab has a walkthrough.
  If you have — what worked? What didn't? Send me anything, bugs or love."

---

## 6. Discovery Session Script (Accenture-style Intake)

Each tester gets a 30-minute intake conversation. NOT a form — a conversation.
Delivered via call, voice note exchange, or async DM thread.

### Script structure

**Opening (2 min)**
> "I'm building Vivim and you're one of a small group helping me figure out
> what's real and what's not. There are no wrong answers. The more honest
> you are, the more useful this is."

**Context (5 min)**
- What do you use your computer for daily?
- Which AI tools do you use today? (ChatGPT? Claude? Gemini? None?)
- How do you usually interact with AI — web chat? API? Apps?

**Goals (10 min)**
- If Vivim could do one thing perfectly for you, what would it be?
- What's the most annoying thing about your current AI workflow?
- Name three things you'd want to try first.

**Environment (5 min)**
- Windows version? (must be 10/11 x64 for alpha)
- Chrome installed? (needed for provider chat — Claude/Gemini/DeepSeek)
- Do you have accounts logged in to any AI services in Chrome?
- Comfortable editing config files? Running commands in terminal?

**Risk tolerance (5 min)**
- On a scale of "I just want it to work" to "I'll break things on purpose",
  where are you?
- Would you use a Dev Console to see raw events? (yes/no — maps to Explorer track)
- How do you prefer to report issues: screenshot+text? voice note? screen recording?

**Closing (3 min)**
- Assign primary track (Explorer/Builder/Observer/Breaker)
- Set expectations: "I'll send you a welcome message with your first quest.
  Do it whenever. There's no deadline. Reply with what happened."
- Schedule retro date (Day 7)

### Output: Personal Track Card

Delivered as a DM message after the session:

```
Hey [name] — here's your Vivim alpha track:

Track: [Explorer / Builder / Observer / Breaker]
Tier start: [S0 or S1 based on env assessment]
Provider path: [Claude / Gemini / skip for now]
First quest: [tailored to their stated goals]
Retro date: [date, 7 days from install]
Known caveat: [any env-specific thing: old Chrome, no accounts, etc.]
```

---

## 7. Feedback Loop

### Daily lightweight probe (automated, Day 3 + Day 5)
A short message in the test channel:

> **Day 3 prompt:** "Quick check — on a scale of 1-5, how likely are you
> to open Vivim again tomorrow? What's the one thing that would bump
> that number up?"
>
> **Day 5 prompt:** "You've been using Vivim for 5 days. What's the most
> useful thing it's done? What's the most frustrating?"

### Structured weekly retro (Day 7, all testers)

Template for the retro call/message thread:

```
RETRO TEMPLATE — Week [N]
Tester: [name]
Date: [date]

1. SURPRISES (positive)
   [what delighted them]

2. FRICTIONS (negative)
   [what frustrated them, with steps to reproduce if possible]

3. WISHES (future)
   [what they'd want next]

4. STATUS SCORE (1-5 each)
   - Install experience: __/5
   - First message: __/5
   - Daily use: __/5
   - Helpfulness: __/5

5. TOP BUG (if any)
   Steps: ...
   Expected: ...
   Actual: ...
   Screenshot: [attached]

6. WOULD RECOMMEND?
   Yes / Maybe / No — why?
```

### Bug report template (anytime)

For testers who encounter issues between retros:

```
BUG REPORT
What I did: [steps]
What I expected: ...
What actually happened: ...
My Vivim version: [from Settings or "health check" in palette]
My Windows version: [from System Settings]
Screenshot: [if possible]
```

Location of logs for power testers:
```
%LOCALAPPDATA%\vivim\vivim-server.log
%LOCALAPPDATA%\vivim\vivim-supervisor.log
```

### Escalation path

| Severity | Response SLA | Channel |
|---|---|---|
| App won't launch | Same day | DM direct |
| Can't send messages | Same day | DM direct |
| Visual glitch / slow | 48 hours | Retro queue |
| Feature request | Next retro | Backlog |

---

## 8. Communication Cadence

| Day | Channel | Message |
|---|---|---|
| 0 | DM | Welcome + installer link + SHA-256 + "first quest" |
| 0 | DM | Personal track card (from discovery session) |
| 1 | DM | "How'd the first message go? Screenshot anything weird." |
| 3 | Channel | Daily probe #1 (1-5 scale + open question) |
| 5 | Channel | Daily probe #2 (most useful / most frustrating) |
| 7 | Call/thread | Weekly retro (structured template) |
| 8 | Channel | Retro summary + "here's what changed" + next quest |
| 14 | DM | "You've been at this two weeks. Ready for providers? Canvas building?" |
| 14+ | Retro biweekly | Repeat retro template, track trends |

### Tone guidelines
- Never "the team" — it's you. Personal, accountable, human.
- Never apologize for bugs — frame as "this is exactly what I need to know."
- Celebrate bug reports: "This is a great catch. Here's what's happening and
  here's the fix timeline."
- Never ask testers to read code or run CLI commands (unless Breaker track).

---

## 9. Tracking Sheet (your view, not testers')

Maintain a simple tracker (Notion, spreadsheet, or even a markdown table in-repo):

```markdown
| Name | Track | Install | S0 ✓ | S1 ✓ | S2 ✓ | S3 ✓ | Retro W1 | Retro W2 | Bugs filed |
|------|-------|---------|------|------|------|------|----------|----------|------------|
| Alice | Builder | ✓ | ✓ | ✓ | — | — | 4/5/4/5 | — | 2 |
| Bob | Breaker | ✓ | ✓ | — | — | — | 3/4/4/3 | — | 7 |
```

S0 ✓ = sent first message. S1 ✓ = used palette + 3 msgs. S2 ✓ = executed non-convo cap.
S3 ✓ = connected provider or wrote automation.

---

## 10. What Success Looks Like (end of alpha)

1. **≥80% activation** — 8 of 10 testers send a first message unaided
2. **≥50% return** — 5 of 10 are active on Day 7
3. **≥5 structured bug reports** with repro steps (not vibes)
4. **Each tester names ≥1 positive surprise** in retro
5. **≥2 testers reach S2** — discovered capabilities beyond basic chat
6. **Zero showstoppers** — no one stuck at S0 unable to proceed
7. **Feature request signal** — top 3 wishes from retro inform next sprint
