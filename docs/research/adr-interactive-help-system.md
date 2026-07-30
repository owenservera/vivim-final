# ADR: Interactive Help System

**Status:** Accepted
**Date:** 2026-07-30
**Deciders:** [project lead]
**Technical story:** How to evolve Vivim's help/docs from static pages and isolated tours into a unified, AI-powered interactive help system.

---

## Context

Vivim currently has three disconnected help surfaces:
1. **Static docs** — `docs/` directory with engine specs, ADRs, architecture docs (markdown, not searchable in-app)
2. **OnboardingTour** — 5-step animated walkthrough (just upgraded to v2 with spotlight, keyboard nav, analytics)
3. **GuidedLanded** — Chat-based provider setup wizard (existing)

None of these are connected. A user must know *where* to look. There is no screen awareness, no AI assistance, and no task execution from within the help surface.

### Market Context (2026)

The help system landscape has three tiers:
- **Tier 1 (Chatbots):** RAG-powered Q&A over help docs (Chatbase, FlowAI, Intercom Fin). Commodity.
- **Tier 2 (DAPs):** Pre-scripted tooltips and walkthroughs (CommandBar, Chameleon, UserGuiding). Selector-based, break on UI changes.
- **Tier 3 (AI Assistants):** Live screen awareness + intent understanding + task execution (UserGrowth, Intercom Fin Tasks). Emerging, rare.

**Vivim's unique advantage:** CDP infrastructure (`ChromeGovernor`, `BunCdpClient`) provides native DOM reading, element interaction, and network interception — the exact capability that Tier 3 requires and Tier 2 tools lack.

---

## Decision

**Build a Tier 3 interactive help system** — a unified AI assistant that combines RAG-powered search, screen-aware guidance, and task execution via the existing capability system.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│  HelpWidget (floating, Ctrl+/ to open)                   │
│  ├── SearchBar (instant RAG answers from docs)           │
│  ├── QuickActions (pre-built flows: add provider, etc.)  │
│  ├── AIChat (streaming conversation with screen context) │
│  ├── TourLauncher (contextual walkthroughs)              │
│  └── TaskPanel (execute capabilities inline)             │
└──────────────────────────────────────────────────────────┘
         │                    │                    │
    RAG Pipeline        Screen Context       Task Execution
    (embed docs,        (CDP DOM snapshot,   (/api/interpret,
     cosine sim,        accessibility tree,   capability
     LLM answer)        vision model)         registry)
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `HelpWidget` | `frontend/src/features/help-system/HelpWidget.tsx` | Main floating widget with tabbed surface |
| `SearchBar` | `features/help-system/SearchBar.tsx` | RAG-powered instant search |
| `AIChat` | `features/help-system/AIChat.tsx` | Streaming AI conversation |
| `ScreenReader` | `features/help-system/ScreenReader.tsx` | CDP DOM snapshot → structured context |
| `QuickActions` | `features/help-system/QuickActions.tsx` | Pre-built guided flows |
| `useRAG` | `features/help-system/useRAG.ts` | Embed + search + answer hook |
| `useScreenContext` | `features/help-system/useScreenContext.ts` | DOM snapshot + accessibility tree hook |
| `useHelpAgent` | `features/help-system/useHelpAgent.ts` | Agent orchestrator (explain/guide/execute) |

### RAG Pipeline

```
docs/*.md → chunk (512 tokens, 50 overlap) → embed (text-embedding-3-small) → store (in-memory Map)
User query → embed → cosine similarity → top 5 chunks → LLM (GPT-4o-mini) → answer with citations
```

### Screen Context

```
User asks question → CDP Runtime.evaluate() → extract:
  - page.title
  - visible elements (tag, text, role, aria-label)
  - form state (inputs, values, errors)
  - current route
  - recent console errors
→ Structured context → injected into LLM prompt
```

### Three Agent Modes

| Mode | Trigger | Action |
|------|---------|--------|
| **Explain** | "What does this page do?" | Read DOM + docs → LLM explains |
| **Guide** | "Help me add a provider" | Step-by-step walkthrough with spotlight overlay (reuses tour v2) |
| **Execute** | "Add Gemini as a provider" | Agent calls `/api/interpret` with capability + params |

### Contextual Triggers

- **Stuck detection:** idle > 30s OR repeated same-page clicks → "Need help?"
- **Error detection:** console error visible → "I see an error. Want me to help?"
- **New feature:** first visit to a page → "This is the capabilities page. Want a quick tour?"
- **Opt-in only:** never auto-opens; always user-initiated or triggered by explicit signals

---

## Alternatives Considered

### Option A: Enhanced docs site (do nothing)
- Pros: No new code
- Cons: Doesn't solve the problem; users still have to leave the app to find help
- **Rejected:** Not ambitious enough

### Option B: Off-the-shelf DAP (CommandBar, Chameleon)
- Pros: Fast to implement, proven UX
- Cons: Selector-based (breaks on UI changes), no screen awareness, vendor lock-in, monthly cost ($200-2000/mo)
- **Rejected:** Vivim has CDP advantage; off-the-shelf tools can't match screen awareness

### Option C: RAG chatbot only (Tier 1)
- Pros: Simple, fast to build
- Cons: No screen awareness, no task execution, just another chat widget
- **Rejected:** Doesn't leverage CDP advantage; commodity

### **Option D: Tier 3 AI assistant (recommended)**
- Pros: Leverages CDP advantage, unified help surface, task execution, screen awareness
- Cons: More complex to build, requires RAG + agent + screen context
- **Selected:** Best long-term value; building blocks (Vercel AI SDK, assistant-ui) are now mature

---

## Consequences

### Positive
- **Unified help surface:** One widget replaces scattered docs, tours, and chat
- **Screen-aware:** Can explain what's on screen, not just answer general questions
- **Task execution:** Users can accomplish tasks from within the help surface
- **Analytics:** Track what users struggle with → improve docs and flows
- **Leverages existing infra:** CDP, capability system, tour v2 components

### Negative
- **LLM cost:** ~$50-200/mo for 10K MAU (acceptable for production SaaS)
- **Latency:** RAG + LLM adds 1-3s to help queries (acceptable; streaming mitigates)
- **Complexity:** New subsystem with 8+ files (manageable with phased approach)

### Risks
- **RAG quality:** Bad embeddings or chunking → wrong answers. Mitigation: citation links, user feedback, human-in-the-loop
- **Screen context size:** Large DOM snapshots → expensive LLM calls. Mitigation: prune to visible elements, limit to 2K tokens
- **Privacy:** DOM may contain sensitive data. Mitigation: user-initiated only, no auto-capture, strip PII before LLM

---

## Implementation Plan

| Phase | Weeks | Deliverable | Files |
|-------|-------|-------------|-------|
| **1 — Foundation** | 1-2 | HelpWidget + SearchBar + RAG pipeline | `HelpWidget.tsx`, `SearchBar.tsx`, `useRAG.ts`, `lib/rag.ts` |
| **2 — Intelligence** | 3-4 | ScreenReader + AIChat + useHelpAgent | `ScreenReader.tsx`, `AIChat.tsx`, `useHelpAgent.ts`, `useScreenContext.ts` |
| **3 — Execution** | 5-6 | QuickActions + TaskPanel + analytics | `QuickActions.tsx`, `TaskPanel.tsx`, extend `useAnalytics.ts` |

### Phase 1 Gate
- [ ] HelpWidget renders with Ctrl+/ shortcut
- [ ] SearchBar returns answers from embedded docs
- [ ] RAG pipeline processes all `docs/*.md` files
- [ ] Citations link back to source docs

### Phase 2 Gate
- [ ] ScreenReader returns structured DOM context via CDP
- [ ] AIChat streams responses with screen context injected
- [ ] Three modes (explain/guide/execute) work end-to-end
- [ ] Contextual triggers fire on stuck/error states

### Phase 3 Gate
- [ ] QuickActions launch guided flows
- [ ] TaskPanel executes capabilities inline
- [ ] Analytics track help usage, resolution rate, drop-off
- [ ] Self-improving: unanswered questions flagged for doc generation

---

## References

- **Research report:** `docs/research/reports/interactive-help-system-sota-2026.md`
- **Research brief:** `docs/research/briefs/interactive-help-system-brief.md`
- **Tour v2 (just built):** `frontend/src/features/onboarding/` — reusable spotlight overlay, step renderer, keyboard nav
- **CDP infrastructure:** `src/engines/chrome-governor.ts` — DOM reading, element interaction, network capture
- **Capability system:** `POST /api/interpret` → `POST /api/capabilities/:id/execute` — task execution backend
- **Vercel AI SDK:** `@ai-sdk/react` `useAgent()` — streaming agent runtime
- **assistant-ui:** `assistant-ui/assistant-ui` — composable chat UI primitives
