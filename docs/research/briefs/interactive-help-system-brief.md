# Brief: Interactive Help System for Vivim

**Date:** 2026-07-30
**Status:** Research complete, ready for implementation
**Full report:** `docs/research/reports/interactive-help-system-sota-2026.md`

---

## TL;DR

The "100x help system" is not a better docs site or a fancier product tour. It is an **AI assistant that can see the screen and do things** — the emerging Tier 3 category alongside chatbots (Tier 1) and digital adoption platforms (Tier 2).

Vivim has a unique advantage: **CDP infrastructure already exists** (`ChromeGovernor`, `BunCdpClient`). Most competitors (CommandBar, Chameleon, UserGuiding) are selector-based and break when UI changes. Vivim can read the live DOM natively.

## The Three Tiers

| Tier | What it does | Examples | Limitation |
|------|-------------|----------|------------|
| 1 — Chatbot | Answers questions from help docs | Chatbase, FlowAI, ChatGPT widgets | No screen awareness, no task execution |
| 2 — Product Tour | Pre-scripted tooltips/walkthroughs | CommandBar, Chameleon, UserGuiding | Selector-based, breaks on UI changes |
| **3 — AI Assistant** | **Reads screen + understands intent + executes tasks** | **UserGrowth, Intercom Fin Tasks, Vercel AI SDK agents** | **Emerging, few production implementations** |

**Vivim should build Tier 3.** The building blocks are now available as open-source SDKs.

## What Vivim Already Has

- **CDP screen reading** — `ChromeGovernor` captures DOM, screenshots, network traffic
- **Capability execution** — `/api/interpret` → `execute` pipeline can run any registered capability
- **Tour v2** — Animated spotlight, keyboard nav, analytics (just built)
- **GuidedLanding** — Chat-based provider setup (existing)
- **Command palette** — `Ctrl+K` command discovery (existing)
- **Knowledge docs** — Engine specs, ADRs, architecture docs in `docs/`

## What Vivim Needs

### 1. Unified Help Widget
A single floating button (`?` or `Ctrl+/`) that opens a surface with:
- **Search bar** — instant answers from RAG over all docs
- **Quick actions** — "Show me how to add a provider", "Walk me through capabilities"
- **AI chat** — streaming conversation with screen context
- **Tour launcher** — contextual walkthroughs (not forced)

### 2. RAG Pipeline
- Embed all docs (`docs/`, AGENTS.md, engine specs, README) into vector store
- Query: embed user question → cosine similarity → top-K chunks → LLM answer with citations
- Tools: Vercel AI SDK `embed()` + `cosineSimilarity()`, or Upstash Vector

### 3. Screen Context Reader
- DOM snapshot via CDP: `Runtime.evaluate()` → structured context (page title, visible elements, form state, errors)
- Accessibility tree via `Accessibility.getFullAXTree()` — screen reader–friendly context
- Screenshot analysis via vision model (optional, for visual debugging)

### 4. AI Agent with Three Modes
- **Explain:** "What does this page do?" → LLM reads DOM + docs, explains in context
- **Guide:** "Help me add a provider" → step-by-step walkthrough with spotlight overlay (reuses tour v2)
- **Execute:** "Add Gemini as a provider" → agent calls capabilities via `/api/interpret`

### 5. Contextual Triggers
- Detect "stuck" state (idle > 30s, repeated clicks, error visible) → offer help
- Detect new feature exposure → show tooltip
- Track tour completion, chat engagement, feature adoption → analytics dashboard

## Recommended Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Agent runtime | Vercel AI SDK `useAgent()` or OpenAI Agents SDK | Streaming, tool use, memory, guardrails |
| Chat UI | assistant-ui primitives or existing `Composer.tsx` | Composable, accessible, streaming-native |
| RAG | Vercel AI SDK `embed()` + `cosineSimilarity()` | Zero-infra, works with existing OpenAI key |
| Vector store | In-memory (small) or Upstash Vector (production) | Serverless, pay-per-query |
| Screen context | CDP `Runtime.evaluate()` + `Accessibility.getFullAXTree()` | Already built in `ChromeGovernor` |
| Task execution | Existing `/api/interpret` → `execute` pipeline | No new infra needed |
| Analytics | Extend existing `useAnalytics.ts` → `/api/onboarding/analytics` | Consistent with tour v2 |

## Phased Build

| Phase | Weeks | Deliverable |
|-------|-------|-------------|
| **1 — Foundation** | 1-2 | Unified help widget, RAG over docs, search bar, tour launcher |
| **2 — Intelligence** | 3-4 | Screen context reader, AI agent (explain/guide), contextual triggers |
| **3 — Execution** | 5-6 | Task execution, voice mode, personalized help, self-improving RAG |

## Key Metrics to Track

- **Resolution rate:** % of questions answered without human escalation (target: >80%)
- **Tour completion:** % of started tours completed (target: >70%, per Chameleon benchmarks)
- **Support ticket reduction:** Target 50-70% reduction (UserGrowth benchmark: 70%)
- **Time-to-value:** How fast new users accomplish first task (target: <5 min)
- **Feature adoption:** % of users discovering and using key features (target: +30%)
- **Drop-off points:** Where users quit tours or abandon chat

## Cost Estimate

- **Embedding:** ~$0.10 per 1M tokens (OpenAI text-embedding-3-small)
- **LLM inference:** ~$0.002 per question (GPT-4o-mini) or ~$0.03 (GPT-4o)
- **Vector store:** Free tier covers small projects; Upstash: $0.25/1M vectors/month
- **Total:** ~$50-200/month for 10K monthly active users

## Decision Points

1. **Build vs. buy:** Build (Vivim has unique CDP advantage; off-the-shelf tools lack screen awareness)
2. **RAG infra:** In-memory first → Upstash Vector when scaling past 100 docs
3. **Agent framework:** Vercel AI SDK (TypeScript-native, fits Bun stack) vs. OpenAI Agents SDK (Python, more mature). Recommendation: **Vercel AI SDK** for frontend integration.
4. **Chat UI:** Extend existing `Composer.tsx` / `MessageBlock.tsx` vs. adopt assistant-ui. Recommendation: **Extend existing** (avoids dependency, stays consistent with design system).

---

**Next step:** If approved, create ADR + implementation plan for Phase 1 (Unified Help Widget + RAG).
