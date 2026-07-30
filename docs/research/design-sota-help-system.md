# SOTA Help System Upgrade — Design Document

**Date:** 2026-07-30
**Status:** Design complete, ready for implementation
**Research:** `docs/research/reports/interactive-help-system-sota-2026.md`
**Brief:** `docs/research/briefs/interactive-help-system-brief.md`

---

## TL;DR

Upgrade Vivim's help system from **static docs + isolated tour** to a **Tier 3 AI assistant** — a single floating widget that combines RAG-powered search, screen-aware guidance, and task execution. The user presses `Ctrl+/` and gets an AI that can see their screen, answer questions, walk them through flows, and execute tasks.

---

## 1. Problem Statement

Vivim has three disconnected help surfaces:

| Surface | What it does | Limitation |
|---------|-------------|------------|
| `docs/` (markdown) | Engine specs, ADRs, architecture | Not searchable in-app, requires context switch |
| `OnboardingTour` (v2) | 5-step animated walkthrough | Only covers basics, no AI, no screen awareness |
| `GuidedLanded` | Chat-based provider setup | Single-purpose, no RAG, no task execution |

**Result:** Users must know *where* to look. New users drop off. Power users can't discover advanced features. No analytics on what users struggle with.

---

## 2. Design Goals

| Goal | Metric | Target |
|------|--------|--------|
| **Unified** | One entry point for all help | `Ctrl+/` opens HelpWidget |
| **Intelligent** | RAG-powered answers from docs | >80% resolution rate |
| **Screen-aware** | Understands what user is looking at | DOM context injected into LLM |
| **Actionable** | Can execute tasks, not just answer | Task execution via capabilities |
| **Measurable** | Track engagement + drop-off | Analytics dashboard |
| **Accessible** | WCAG 2.1 AA | Keyboard nav, ARIA, screen readers |

---

## 3. Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Vivim Frontend                               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    HelpWidget (floating)                      │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │  │
│  │  │ Search  │ │ AI Chat  │ │ Tours    │ │ Quick Actions   │  │  │
│  │  │ (RAG)   │ │ (stream) │ │ (v2)    │ │ (pre-built)     │  │  │
│  │  └────┬────┘ └────┬─────┘ └────┬────┘ └───────┬─────────┘  │  │
│  │       │           │            │               │             │  │
│  │       └───────────┴────────────┴───────────────┘             │  │
│  │                           │                                   │  │
│  │                    useHelpAgent (orchestrator)                │  │
│  └───────────────────────────┼───────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐  │
│  │                    Backend Services                            │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌────────────────┐  │  │
│  │  │ RAG      │ │ Screen    │ │ Agent    │ │ Capability     │  │  │
│  │  │ Pipeline │ │ Context   │ │ Runtime  │ │ Executor       │  │  │
│  │  │ (embed)  │ │ (CDP)     │ │ (LLM)   │ │ (/api/interpret)│  │  │
│  │  └──────────┘ └───────────┘ └──────────┘ └────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
User presses Ctrl+/
        │
        ▼
HelpWidget opens
        │
        ├──► SearchBar: "how do I add a provider?"
        │       │
        │       ▼
        │    useRAG: embed query → cosine sim → top 5 chunks
        │       │
        │       ▼
        │    LLM (GPT-4o-mini): answer with citations
        │       │
        │       ▼
        │    Render: answer + source links + "Want a walkthrough?"
        │
        ├──► AIChat: "help me add gemini"
        │       │
        │       ▼
        │    useHelpAgent: classify intent → GUIDE mode
        │       │
        │       ▼
        │    useScreenContext: CDP DOM snapshot (page, elements, errors)
        │       │
        │       ▼
        │    LLM: generate step-by-step plan
        │       │
        │       ▼
        │    SpotlightOverlay + StepRenderer: walk user through flow
        │
        └──► QuickActions: "Add Provider" button
                │
                ▼
             useHelpAgent: EXECUTE mode
                │
                ▼
             POST /api/interpret → execute capability
                │
                ▼
             Result: "Provider added successfully"
```

---

## 4. Component Design

### 4.1 New Files

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `frontend/src/features/help-system/HelpWidget.tsx` | Main floating widget shell | ~200 |
| `frontend/src/features/help-system/SearchBar.tsx` | RAG-powered instant search | ~150 |
| `frontend/src/features/help-system/AIChat.tsx` | Streaming AI conversation | ~250 |
| `frontend/src/features/help-system/QuickActions.tsx` | Pre-built guided flows | ~100 |
| `frontend/src/features/help-system/HelpPanel.tsx` | Tab container (search/chat/tours/actions) | ~150 |
| `frontend/src/features/help-system/useRAG.ts` | RAG pipeline hook | ~200 |
| `frontend/src/features/help-system/useScreenContext.ts` | CDP DOM snapshot hook | ~150 |
| `frontend/src/features/help-system/useHelpAgent.ts` | Agent orchestrator (explain/guide/execute) | ~300 |
| `frontend/src/features/help-system/useHelpAnalytics.ts` | Extended analytics hook | ~100 |
| `frontend/src/features/help-system/lib/rag.ts` | Embed + chunk + cosine similarity | ~250 |
| `frontend/src/features/help-system/lib/agent-prompts.ts` | System prompts for 3 modes | ~100 |
| `frontend/src/features/help-system/index.ts` | Barrel exports | ~20 |
| **Total** | | **~1,920** |

### 4.2 Component Specifications

#### HelpWidget.tsx

```tsx
interface HelpWidgetProps {
  userId: string;
  onAction?: (command: string) => void;
}

// State:
// - isOpen: boolean (toggled by Ctrl+/ or button click)
// - activeTab: 'search' | 'chat' | 'tours' | 'actions'
// - isMinimized: boolean

// Features:
// - Floating button (bottom-right, ? icon)
// - Ctrl+/ keyboard shortcut to toggle
// - Animated open/close (scale + fade, 200ms)
// - Tabs: Search | Chat | Tours | Actions
// - Responsive: full panel on desktop, bottom sheet on mobile
// - ARIA: role="dialog", aria-label="Help center"
```

#### SearchBar.tsx

```tsx
interface SearchBarProps {
  onResultClick: (result: SearchResult) => void;
}

interface SearchResult {
  title: string;
  snippet: string;
  source: string;  // file path
  line?: number;
  score: number;
}

// Features:
// - Debounced input (300ms)
// - Instant results from RAG (no full page reload)
// - Result cards with title, snippet, source, score
// - Click → navigate to doc + highlight line
// - "Ask AI" button → switches to AIChat with query pre-filled
// - Keyboard: arrow keys to navigate, Enter to select
```

#### AIChat.tsx

```tsx
interface AIChatProps {
  initialMessage?: string;
  screenContext?: ScreenContext;
  onExecute?: (capability: string, params: unknown) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  actions?: SuggestedAction[];
  timestamp: number;
}

// Features:
// - Streaming responses (SSE or WebSocket)
// - Screen context injected automatically (if available)
// - Citations as clickable chips
// - Suggested actions as buttons below response
// - Markdown rendering (bold, code, links)
// - "Execute" button on action suggestions
// - Typing indicator
// - Message history (session-scoped)
```

#### useHelpAgent.ts

```tsx
type AgentMode = 'explain' | 'guide' | 'execute';

interface HelpAgent {
  mode: AgentMode;
  classifyIntent: (query: string, screenContext?: ScreenContext) => Promise<AgentMode>;
  explain: (query: string, screenContext: ScreenContext) => AsyncGenerator<string>;
  guide: (query: string, screenContext: ScreenContext) => AsyncGenerator<GuideStep>;
  execute: (capability: string, params: unknown) => Promise<ExecuteResult>;
}

// classifyIntent:
//   "what does this page do?" → explain
//   "help me add a provider" → guide
//   "add gemini as a provider" → execute
//   "how do I..." → guide (default)

// explain:
//   Inject screen context + query into LLM
//   Stream response with citations from RAG

// guide:
//   Generate step-by-step plan
//   For each step: targetSelector + instruction + expected outcome
//   Reuse SpotlightOverlay + StepRenderer from tour v2

// execute:
//   Map capability name to slug
//   POST /api/interpret → execute
//   Return result
```

#### useScreenContext.ts

```tsx
interface ScreenContext {
  page: {
    title: string;
    url: string;
    route: string;
  };
  elements: ScreenElement[];
  forms: FormData[];
  errors: string[];
  timestamp: number;
}

interface ScreenElement {
  tag: string;
  text: string;
  role?: string;
  ariaLabel?: string;
  selector: string;
  visible: boolean;
}

// Sources:
// - Runtime.evaluate() via CDP: extract visible elements
// - Accessibility.getFullAXTree(): screen reader context
// - Console.error capture: recent errors
// - Current route from Next.js router

// Debounce: refresh every 5s or on route change
// Token limit: prune to 2K tokens max
```

#### lib/rag.ts

```tsx
interface RAGPipeline {
  embed: (text: string) => Promise<number[]>;
  chunk: (text: string, opts?: ChunkOpts) => string[];
  search: (query: string, topK?: number) => Promise<SearchResult[]>;
  addDocument: (path: string, content: string) => void;
}

// Chunking:
// - 512 tokens per chunk
// - 50 token overlap
// - Split on paragraph boundaries

// Embedding:
// - OpenAI text-embedding-3-small (1536 dims)
// - Cache embeddings in-memory (Map<string, number[]>)
// - Lazy: embed on first query, not at build time

// Search:
// - Cosine similarity against all chunks
// - Return top 5 with scores > 0.7
// - Include source file + line number

// Storage:
// - In-memory for MVP (< 1000 chunks)
// - Upgrade to Upstash Vector when scaling
```

---

## 5. Integration Points

### 5.1 Existing Components to Reuse

| Existing | Reuse in Help System |
|----------|---------------------|
| `SpotlightOverlay.tsx` | Guide mode: highlight target elements |
| `StepRenderer.tsx` | Guide mode: render step instructions |
| `useKeyboardNavigation.ts` | HelpWidget: arrow keys, Escape to close |
| `useAnalytics.ts` | HelpWidget: extended analytics events |
| `CommandPalette.tsx` | HelpWidget: search UX pattern |
| `MessageBlock.tsx` | AIChat: message rendering |
| `Composer.tsx` | AIChat: input field |
| `Toast.tsx` | HelpWidget: success/error feedback |

### 5.2 Backend Integration

| Service | Endpoint | Usage |
|---------|----------|-------|
| RAG | New: `/api/help/search` | Embed query → search chunks → return results |
| Screen Context | New: `/api/help/screen-context` | CDP DOM snapshot (optional, can be client-side) |
| Agent | New: `/api/help/agent` | Streaming LLM responses |
| Capabilities | Existing: `/api/interpret` | Task execution |
| Analytics | Existing: `/api/onboarding/analytics` | Extended help events |

### 5.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+/` | Toggle HelpWidget |
| `Escape` | Close HelpWidget |
| `Tab` | Switch between Search/Chat/Tours/Actions |
| `↑` / `↓` | Navigate search results |
| `Enter` | Select result / send message |

---

## 6. RAG Pipeline Design

### 6.1 Document Sources

| Source | Path | Content |
|--------|------|---------|
| Engine specs | `docs/merged-design-v2/04-merged-engines.md` | Engine architecture |
| Architecture | `docs/merged-design-v2/00-merged-architecture.md` | System design |
| ADRs | `docs/decisions/ADR-*.md` | Decision records |
| AGENTS.md | `AGENTS.md` | Project conventions |
| README | `README.md` | Project overview |
| Provider guides | `seeds/providers/*.json` | Provider configs |
| Test patterns | `tests/README.md` (if exists) | Testing guide |

### 6.2 Embedding Strategy

```
Doc → Split into 512-token chunks (50 overlap)
  → Embed each chunk (text-embedding-3-small)
  → Store in-memory Map<chunkId, {embedding, text, source, line}>
  → On query: embed query → cosine sim → top 5
```

### 6.3 Answer Generation

```
Top 5 chunks + user query
  → System prompt: "Answer based on the following context. Cite sources."
  → LLM (GPT-4o-mini): streaming response
  → Parse citations from response
  → Render with clickable source links
```

---

## 7. Agent Modes

### 7.1 Explain Mode

**Trigger:** "What does this page do?", "What is this feature?"

```
1. Capture screen context (DOM snapshot)
2. Inject context + query into LLM prompt
3. LLM reads visible elements, understands page purpose
4. Stream explanation with references to docs
5. Offer: "Want me to walk you through it?" → switches to Guide
```

### 7.2 Guide Mode

**Trigger:** "Help me add a provider", "How do I use capabilities?"

```
1. Classify intent → guide
2. Generate step-by-step plan (LLM)
3. For each step:
   a. Identify target element (CSS selector)
   b. Generate instruction text
   c. Render with SpotlightOverlay + StepRenderer
   d. Wait for user action or timeout
4. Track completion, offer next step
5. On completion: "Done! Anything else?"
```

### 7.3 Execute Mode

**Trigger:** "Add Gemini as a provider", "Send a message to Claude"

```
1. Classify intent → execute
2. Extract capability slug + parameters (LLM)
3. Confirm with user: "I'll add Gemini. Ready?"
4. POST /api/interpret → execute capability
5. Return result: "Gemini added successfully"
6. Offer: "Want to test it?" → switches to Guide
```

---

## 8. Analytics Extension

### 8.1 New Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `help_opened` | `{ tab, timestamp }` | Track entry point |
| `help_search` | `{ query, resultCount, clickedResult }` | Track search quality |
| `help_chat_message` | `{ role, content, mode }` | Track conversation |
| `help_guide_started` | `{ guideId, stepCount }` | Track guide engagement |
| `help_guide_step` | `{ guideId, stepIdx, completed }` | Track drop-off |
| `help_execute` | `{ capability, success, durationMs }` | Track task execution |
| `help_closed` | `{ durationMs, tab, lastAction }` | Track session length |

### 8.2 Dashboard Metrics

- **Resolution rate:** % of questions answered without escalation
- **Guide completion:** % of started guides completed
- **Search success:** % of searches that lead to a click
- **Task execution:** % of execute attempts that succeed
- **Drop-off points:** Where users quit guides
- **Top queries:** Most common questions (gap detection)

---

## 9. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | Ctrl+/ to open, Tab to switch tabs, Arrow keys to navigate, Escape to close |
| Screen reader | ARIA labels on all interactive elements, role="dialog" on widget |
| Focus management | Focus trapped in widget when open, returns to trigger on close |
| Reduced motion | Respect `prefers-reduced-motion` — disable animations |
| Color contrast | WCAG AA (4.5:1 for text, 3:1 for UI components) |
| Text scaling | Responsive layout, works at 200% zoom |

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Deliverable:** HelpWidget + SearchBar + RAG pipeline

| Task | Files | Gate |
|------|-------|------|
| HelpWidget shell | `HelpWidget.tsx`, `HelpPanel.tsx` | Opens with Ctrl+/, animated |
| SearchBar | `SearchBar.tsx` | Debounced input, result cards |
| RAG pipeline | `lib/rag.ts`, `useRAG.ts` | Embeds docs, returns top 5 |
| Analytics | `useHelpAnalytics.ts` | Events tracked |
| Integrate with page | `page.tsx` | Widget renders |

**Phase 1 Gate:**
- [ ] `Ctrl+/` opens HelpWidget
- [ ] Search returns results from embedded docs
- [ ] Citations link to source files
- [ ] Analytics events fire

### Phase 2: Intelligence (Week 3-4)

**Deliverable:** AIChat + ScreenContext + useHelpAgent

| Task | Files | Gate |
|------|-------|------|
| AIChat | `AIChat.tsx` | Streaming responses, markdown |
| Screen context | `useScreenContext.ts` | DOM snapshot via CDP |
| Agent orchestrator | `useHelpAgent.ts` | 3 modes: explain/guide/execute |
| Guide mode | Integrate SpotlightOverlay + StepRenderer | Step-by-step walkthroughs |
| Intent classification | `lib/agent-prompts.ts` | Classifies query → mode |

**Phase 2 Gate:**
- [ ] AIChat streams responses
- [ ] Screen context injected into LLM
- [ ] Explain mode answers page questions
- [ ] Guide mode walks through flows
- [ ] Intent classification works

### Phase 3: Execution (Week 5-6)

**Deliverable:** QuickActions + TaskExecution + Analytics Dashboard

| Task | Files | Gate |
|------|-------|------|
| QuickActions | `QuickActions.tsx` | Pre-built guided flows |
| Task execution | Extend useHelpAgent | Execute via /api/interpret |
| Contextual triggers | Extend useHelpAgent | Stuck/error detection |
| Analytics dashboard | New: `HelpDashboard.tsx` | Metrics visualization |
| Self-improving RAG | Extend lib/rag.ts | Track unanswered questions |

**Phase 3 Gate:**
- [ ] QuickActions launch guides
- [ ] Execute mode runs capabilities
- [ ] Contextual triggers fire
- [ ] Analytics dashboard shows metrics
- [ ] Unanswered questions flagged

---

## 11. Tech Stack

| Layer | Tool | Rationale |
|-------|------|-----------|
| Agent runtime | Custom `useHelpAgent` | Tight integration with Vivim capabilities |
| RAG | Custom `lib/rag.ts` | Zero-infra, in-memory, fast iteration |
| Embedding | OpenAI `text-embedding-3-small` | $0.10/1M tokens, 1536 dims |
| LLM | OpenAI `gpt-4o-mini` | $0.002/query, fast, good at structured output |
| Screen context | CDP `Runtime.evaluate()` | Already built in ChromeGovernor |
| Chat UI | Custom AIChat + existing MessageBlock/Composer | Consistent with design system |
| Tour UI | Existing SpotlightOverlay + StepRenderer | Already built, just reuse |
| Analytics | Existing useAnalytics.ts extended | Consistent with tour v2 |

---

## 12. Cost Estimate

| Component | Monthly Cost (10K MAU) |
|-----------|----------------------|
| Embedding (OpenAI) | ~$5 (lazy, not per-query) |
| LLM inference (GPT-4o-mini) | ~$20 (10 queries/user × $0.002) |
| Vector store (in-memory) | $0 |
| CDP screen context | $0 (existing infra) |
| **Total** | **~$25/mo** |

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| RAG quality (wrong answers) | High | Citation links, user feedback, human review |
| Screen context size | Medium | Prune to 2K tokens, visible elements only |
| LLM latency | Medium | Streaming responses, show typing indicator |
| Privacy (DOM data) | High | User-initiated only, no auto-capture, strip PII |
| Cost overrun | Low | Budget alerts, query limits, model routing |
| Scope creep | Medium | Phased approach, gate criteria per phase |

---

## 14. Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Resolution rate | 0% (no AI help) | >80% | Chat messages that don't escalate |
| Tour completion | ~50% (est.) | >70% | Started tours that complete |
| Support tickets | 100% (baseline) | -50% | Ticket volume after launch |
| Time-to-value | Unknown | <5 min | First task completion |
| Feature adoption | Unknown | +30% | Features discovered via help |
| Search success | N/A | >60% | Searches that lead to click |

---

## 15. Next Steps

1. **Approve design** — Review this document, confirm phases + scope
2. **Create ADR** — Formalize decision in `docs/decisions/`
3. **Start Phase 1** — Build HelpWidget + SearchBar + RAG pipeline
4. **Iterate** — Gate review after each phase, adjust scope as needed
