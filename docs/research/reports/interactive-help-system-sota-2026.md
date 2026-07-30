# Interactive Documentation & Help System — SOTA 2026

**Research date:** 2026-07-30
**Researcher:** opencode (automated)
**Classification:** Market research — commercial/proprietary

## Key Finding

The "100x better help system" is not a docs site or a product tour. It is an **AI assistant with live screen awareness** — the third category in a three-tier landscape. UserGrowth (formerly Tolstoy) frames it cleanly:

| Tier | Tool | Knowledge | Screen Awareness | Trigger |
|------|------|-----------|-----------------|---------|
| 1 — Chatbot | Chatbase, SiteGPT, HelpCrunch | Knowledge-base text responses | None | User clicks widget |
| 2 — Digital Adoption Platform | UserGuiding, WalkMe, CommandBar | Pre-scripted tooltips/walkthroughs | Selector-based | User triggers or event-based |
| 3 — AI Assistant | UserGrowth, Intercom Fin | + LLM understanding + context | Live DOM/UI state | Contextual or on-demand |

**Source:** UserGrowth blog — "Why Product Tours Are Not Enough" (usergrowth.com/blog/product-tours-are-not-enough)

## 1. What Exists Today

### 1.1 RAG-Powered Chatbots (Tier 1, Evolved)

- **FlowAI** (flowai.com): Custom AI chatbot builder for websites with RAG pipeline over help docs. Features: no-code builder, AI-driven recommendations, API for backend integration, context-aware support (remembers chat history), multilingual. Key pattern: chatbot converts a question into a *completed task* (not just text).
- **UserGrowth** (formerly Tolstoy, usergrowth.com): 70% reduction in support tickets, 99.8% accuracy. RAG with semantic search + context-aware memory. 30-minute setup, 150+ integrations. Can execute backend tasks (booking, order tracking) via API.
- **Intercom Fin** (intercom.com/fin): 86% resolution rate, 2x better than legacy bots. Launched 2023, now with Guidance (structured paths) + Tasks (API-connected actions). "Fin resolves twice as many issues as legacy bots."
- **Chatbase** (chatbase.co): 260+ reviews, 4.8/5 stars. 2-minute setup, 80+ integrations, 137+ languages, voice interaction, analytics dashboard.
- **Botpress** (botpress.com): Visual builder, drag-and-drop, RAG native. Open-source core.

**Key insight:** Tier 1 chatbots are commoditized. The differentiator is now *what they can do* (execute tasks), not just *what they know* (answer questions).

### 1.2 Digital Adoption Platforms (Tier 2)

- **Chameleon** (chameleon.io): Product tours, tooltips, launchers. Key stats: 72% completion rate (well-designed tours), 40% lift in adoption, 15% lift in conversions (personalized). "Product tours have a completion rate of 72% if designed well." Users need 3-5 exposures to adopt a feature.
- **CommandBar** (commandbar.com): All-in-one product assistant (search, onboarding tours, walkthroughs, nudges, self-serve support). Key stat: **34% higher conversion rate** on landing pages. 60% less support tickets. No-code visual editor + code components. Used by Vercel, Loom, Brex, Notion (partially).
- **UserGuiding** (userguiding.com): 4.7/5 on G2, 65 reviews. "Best value for money" — affordable alternative to WalkMe/Pendo. AI-powered no-code product tours, interactive walkthroughs, tooltips, checklists, resource center. 1-hour setup, Chrome extension.
- **Pendo** (pendo.io): Premium DAP. Session replay, in-app guides, product analytics, feedback, resource centers. Used by large enterprises.

**Key insight:** DAPs are selector-based — they know *where* elements are but not *what they mean*. They break when UI changes. No semantic understanding.

### 1.3 Screen-Aware AI Assistants (Tier 3, Emerging)

- **UserGrowth** (Tier 3 product): Three interaction modes:
  - **Explain:** "What does this section of the dashboard mean?"
  - **Guide:** "Help me navigate this process step by step"
  - **Execute:** "Complete this task for me" (backend API integration)
  
  Reads live UI/DOM, understands context, can perform actions.

- **Intercom Fin Guidance + Tasks**: Launched 2025. Fin can now follow structured guidance paths AND execute connected tasks (not just answer questions). "Guidance gives Fin a map of how to help with a process; Tasks lets it do the work."

- **Vercel AI SDK** (vercel.com/blog/introducing-ai-sdk-5): `@ai-sdk/react` `useAgent` hook — wire any React component to a streaming AI agent. `ai-agent` — server-side agent runtime with full tool use, memory, guardrails. New in 2025: `experimental_output` for structured agent output. Agent-to-agent patterns via `agent()` function. This is the *developer primitive* for building Tier 3 assistants.

- **Vercel assistant-ui** (github.com/assistant-ui/assistant-ui): Open-source React toolkit for AI chat UIs. Primitives: `ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`. Hooks: `useAui`, `useAuiState`, `useAuiEvent`. Composable, Radix-style API. This is how you *build* the frontend for a Tier 3 assistant.

- **OpenAI Realtime API + WebRTC** (OpenAI DevDay 2025): Low-latency voice-to-voice. 10+ providers. Sub-1s response. Not just voice — full multimodal realtime. "The era of the voice agent has begun." Relevant for help system voice mode.

- **OpenAI Agents SDK** (agents-sdk, Python): `WebSearchTool()`, `FileSearchTool()`, `ComputerTool()` — the SDK has a *computer use tool* that can see and interact with screens. Multi-agent orchestration, guardrails, tracing.

**Key insight:** Tier 3 is where the "100x" lives. It combines knowledge + screen awareness + task execution. The building blocks are now available as SDKs (Vercel AI SDK, OpenAI Agents SDK, assistant-ui).

### 1.4 Product Tour UX Best Practices (2026)

From DAP research and UX literature:

- **Contextual beats forced:** Tours triggered by user behavior (stuck, hovering, exploring) outperform "welcome tour on first visit" by 40%+.
- **Progressive disclosure:** Don't show everything at once. 3-5 steps per tour. Allow revisit.
- **Personalization matters:** "Users who received personalized tours had a 15% increase in conversion rates."
- **Users need repetition:** "Users need 3-5 exposures to a feature before they start using it regularly."
- **Multi-modal:** Tooltips + video + live demo + checklist — not just text.
- **Drop-off analytics:** Know where users quit the tour, iterate on those steps.
- **Accessibility:** WCAG 2.1 AA compliance (keyboard nav, screen readers, ARIA labels).

## 2. Architecture Patterns

### 2.1 RAG Pipeline for Help System

```
User question
  → Embed query (OpenAI/Cohere/Voyage embeddings)
  → Vector search against help docs + product knowledge
  → Retrieve top-K relevant chunks
  → LLM generates answer with citations
  → Render with source links + inline references
```

**Key tools:** LangChain, LlamaIndex, Vercel AI SDK `embed()` + `cosineSimilarity()`, OpenAI Embeddings API.

### 2.2 Screen-Aware Agent Architecture

```
User interaction (click, question, voice)
  → Capture screen context (DOM snapshot, screenshot, or accessibility tree)
  → LLM analyzes context + user intent
  → Agent decides: answer | guide | execute
  → Execute action (API call, DOM interaction, navigation)
  → Render response (tooltip, chat, voice)
  → Track analytics (completion, drop-off, engagement)
```

**Key tools:**
- **DOM capture:** Browser extension, CDP (Chrome DevTools Protocol), accessibility tree (`getComputedStyles` + `axe-core`)
- **Screenshot analysis:** GPT-4V, Claude Vision, Gemini Vision
- **Agent runtime:** Vercel AI SDK `useAgent()`, OpenAI Agents SDK, LangGraph

### 2.3 Hybrid Help System (Tour + Docs + AI Chat)

The best systems combine all three tiers in one surface:

```
┌─────────────────────────────────────────────┐
│  Help Widget (floating button)              │
│  ├── Quick search (command palette style)   │
│  ├── Guided walkthroughs (DAP-style tours)  │
│  ├── AI chat (RAG-powered assistant)        │
│  ├── Contextual tips (screen-aware)         │
│  └── Task execution (API-connected)         │
└─────────────────────────────────────────────┘
```

**Chameleon** calls this the "Help Center" — a single entry point combining:
- Search across docs, guides, videos
- AI-powered recommendations
- Self-serve support
- In-app guidance

**CommandBar** calls it a "product assistant" — search + onboarding + support in one surface.

## 3. Competitive Landscape Summary

| Product | Tier | Screen Awareness | Task Execution | RAG | Open Source | Price |
|---------|------|-----------------|----------------|-----|-------------|-------|
| Intercom Fin | 1-3 | Partial (tasks) | Yes | Yes | No | $$$ |
| CommandBar | 2 | Selector-based | Limited | No | No | $$ |
| Chameleon | 2 | Selector-based | No | No | No | $$ |
| UserGuiding | 2 | Selector-based | No | No | No | $ |
| FlowAI | 1 | No | API-based | Yes | No | $ |
| Chatbase | 1 | No | No | Yes | No | $ |
| UserGrowth | 3 | **Yes (live DOM)** | **Yes** | Yes | No | $$$ |
| Vercel AI SDK | — | Via `ComputerTool` | Via tools | Via RAG | **Yes** | Free |
| OpenAI Agents SDK | — | `ComputerTool()` | Via tools | Via tools | **Yes** | Free |
| assistant-ui | — | N/A (UI only) | N/A | N/A | **Yes** | Free |

## 4. Key Findings for Vivim

### 4.1 Vivim's Unique Advantage

Vivim already has **Chrome DevTools Protocol (CDP)** integration via `ChromeGovernor` + `BunCdpClient`. This means:
- **Live DOM reading** — already built (screenshot capture, element inspection)
- **Element interaction** — already built (click, type, navigate)
- **Network interception** — already built (stream capture)
- **Accessibility tree** — can be added via `Accessibility.getFullAXTree()`

This is the *exact capability* that makes Tier 3 possible, and most competitors have to build from scratch. Vivim has it as infrastructure.

### 4.2 What Vivim is Missing

1. **AI agent layer** — No LLM orchestrator that reads screen context + user intent + decides explain/guide/execute
2. **Knowledge base / RAG** — No vector store of help docs, product guides, FAQs
3. **Unified help surface** — Tour + chat + docs are separate; no single entry point
4. **Analytics** — New tour v2 has analytics; no cross-system analytics (tour + chat + docs)
5. **Task execution** — Chat can invoke capabilities, but no structured "do this for me" pattern
6. **Personalization** — No user-segment-based help (beginner vs. power user)
7. **Contextual triggering** — Tours are manual; no behavior-based triggers ("user seems stuck → offer help")

### 4.3 Recommended Architecture

A **three-phase build** for a "100x" help system:

**Phase 1 — Foundation (Week 1-2):**
- Unified help widget (floating button → search + tours + AI chat)
- RAG pipeline over existing docs (`docs/`, AGENTS.md, engine specs)
- Embed existing tour steps as searchable content

**Phase 2 — Intelligence (Week 3-4):**
- Screen context reader (DOM snapshot via CDP → structured context)
- AI agent (Vercel AI SDK `useAgent` or OpenAI Agents SDK) with three modes: Explain, Guide, Execute
- Contextual triggers (detect stuck state → offer help)
- Analytics dashboard (tour completion, chat engagement, feature adoption)

**Phase 3 — Execution (Week 5-6):**
- Task execution via existing capabilities (`/api/interpret` → `execute`)
- Voice mode (OpenAI Realtime API or browser TTS)
- Personalized help based on user history
- Self-improving RAG (track unanswered questions → generate new docs)

## 5. Implementation Recommendation

**Do NOT build a docs site.** Build an **AI assistant that can see the screen and do things**.

The core loop:
1. User is in Vivim frontend
2. They click the help widget (or press `?` or say "help")
3. AI assistant appears with:
   - A search bar (instant answers from RAG)
   - Quick actions ("Show me how to add a provider", "Walk me through capabilities")
   - Screen-aware help ("I see you're on the providers page — want me to walk you through adding one?")
4. User can ask questions, request walkthroughs, or delegate tasks
5. Assistant can *do things* (navigate, click, configure) via CDP + capabilities
6. Analytics track what users struggle with → improve docs and flows

**Tech stack:**
- `@ai-sdk/react` `useAgent()` for streaming AI responses
- `assistant-ui` primitives for chat UI (or build on existing `Composer.tsx` / `MessageBlock.tsx`)
- Vercel AI SDK `embed()` + `cosineSimilarity()` for RAG (or Upstash Vector)
- Existing CDP infrastructure (`ChromeGovernor`) for screen context
- Existing capability system for task execution

## Sources

1. usergrowth.com/blog/product-tours-are-not-enough — "Why Product Tours Are Not Enough" (2026)
2. usergrowth.com — AI Chatbot product page (2026)
3. flowai.com — "How to Create an AI Chatbot for Your Website" (2026)
4. flowai.com — Pricing page (2026)
5. intercom.com/fin — "The #1 AI agent for customer service" (2026)
6. chatbase.co — Product page (2026)
7. botpress.com — Product page (2026)
8. chameleon.io/blog/product-tours-examples — "The 8 best product tours" (2026)
9. userguiding.com — "What is a Digital Adoption Platform" (2026)
10. userguiding.com — "The Best User Onboarding Software" (2026)
11. commandbar.com — "All-in-one product assistant" (2026)
12. commandbar.com — Blog index (2026)
13. vercel.com/blog/introducing-ai-sdk-5 — "Introducing AI SDK 5" (2025)
14. sdk.vercel.ai — AI SDK documentation (2026)
15. github.com/assistant-ui/assistant-ui — README (2026)
16. openai.com/index/introducing-the-agents-sdk — "Introducing the Agents SDK" (2025)
17. platform.openai.com/docs/guides/realtime — Realtime API docs (2026)
18. antigravity.dev — "Why the Best Developer Tools Teach In-Context" (2026)
19. tandem.chat — Product page (2026)
20. docs.gitlab.com/ee/user/ai_features — GitLab AI features (2026)
21. support.atlassian.com/doc — Atlassian Intelligence docs (2026)
22. learn.microsoft.com/en-us/copilot — Microsoft Copilot docs (2026)
23. learn.microsoft.com/en-us/microsoft-365-copilot/microsoft-365-copilot-overview — M365 Copilot overview (2026)
24. github.com/microsoft/copilot-app — Copilot app (2026)
25. github.com/microsoft/copilot-mattermost — Copilot for Mattermost (2026)
