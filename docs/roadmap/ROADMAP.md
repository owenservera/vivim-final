# VIVIM Product Roadmap — Phases 11-20

**Status:** DRAFT v1 — Grilling in progress
**Date:** 2026-07-10
**Author:** opencode + user
**Supersedes:** `docs/merged-design-v2/sota-08-implementation-glossary-delta.md`

---

## User Decisions (Captured)

| Decision | Choice | Notes |
|----------|--------|-------|
| Target user | Consumer (non-technical) | Not developer-first |
| Core value | Full vision, phased delivery | Chat → Agents → Workflows |
| Deployment | Desktop app (Tauri) | Not cloud SaaS |
| Chrome model | Managed Chrome via CDP | Current architecture stays |
| MVP UX | Consumer chat, per-turn provider routing | Per-message provider switching |
| Remux model | Per-message provider routing | Switch provider per turn within one conversation |
| Version strategy | Ship fast, iterate | MVP ASAP, layer capabilities |
| CDP Transport | Raw WebSocket | Port `BunCdpClient` against vivim-final source |
| Chrome process mgmt | Profile isolation | Port `launcher.ts` — per provider+account combo |
| Chrome binary | Auto-detect + config | Port `detectChromePath()` against vivim-final source |
| Port allocation | Scan for available | Port `findAvailablePort()` against vivim-final source |
| Streaming | WebSocket | Bidirectional — server pushes chunks from Chrome |
| API style | Hybrid | REST for CRUD + dispatch for actions |
| Selector strategy | Hybrid (already designed) | Static selectors + recovery strategies + drift detection |
| MVP scope | MVP-D: Remux + agent mode | Full value prop from day one |
| Build order | Full backend first | CLI-testable, UI component registry for frontend contracts |
| Frontend | Build new | Learn chrome slave mechanism from vivim-app-og, don't port 66+ components |

---

## Current State Assessment

### What Works (37 engines, 81+ tables)

```
src/engines/           37 engine files (interfaces + orchestration logic)
prisma/schema.prisma   1689 lines, ~81+ tables
src/storage/impl/      15 store implementations
src/server/            REST server (stub endpoints)
src/cli/               9 CLI commands
tests/                 26 test files (unit + E2E)
seeds/providers/       7 provider manifests (claude, chatgpt, gemini, deepseek, qwen, z-ai, studio-ai)
```

### What's Missing (The Gap)

| Layer | Status | Gap |
|-------|--------|-----|
| Chrome CDP Transport | **Interface only** | No real `CDPTransport` implementation. `ChromeGovernor.spawn()` sets status but doesn't launch Chrome. |
| Engine Wiring | **Interfaces only** | Engines exist in isolation. No bootstrap/wiring code connects them. |
| API Endpoints | **Stubs** | `conversation-router.ts` returns `json([])` for most endpoints. |
| Streaming | **Interface only** | `StreamingProtocol` defined but no real SSE/WebSocket streaming. |
| Frontend | **None** | No React/Vue/Svelte frontend exists in vivim-final. |
| Tests | **26 files** | Mostly unit tests. No integration tests. No E2E tests against real providers. |

### Reference Implementation (vivim-app-og)

The original app at `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\frontend` has:
- **66+ React components** (ChatView, MessageItem, WelcomeScreen, etc.)
- **32 Zustand stores** (chatStore, accountStore, directStore, etc.)
- **RPC-style API** (`/fn/call` with `vivim.provider.execute`, `vivim.conversation.list`)
- **WebSocket streaming** (`provider_response_chunk` events)
- **Tauri shell** (minimal Rust, just launches webview)
- **Provider switching** (per-conversation provider selection)
- **Model selection** (per-provider model dropdown)
- **File upload** (drag-drop + preview)
- **Conversation history** (sidebar with search)

**Key insight:** The frontend already exists. The backend is a separate server. The question is whether to port the frontend or build new.

---

## The User Journey (End State)

```
Launch App → See chat UI → Pick provider (Claude/ChatGPT/Gemini) → Pick model
    → Type message → See streaming response → Switch provider mid-conversation
    → Upload file → Search conversations → Export as markdown
    → (Later) Build workflows visually → (Later) Run autonomous agents
```

---

## Phase 11: Chrome Automation Layer (Critical Path)

**Goal:** Port working Chrome automation against vivim-final source. Launch Chrome, connect via CDP, send commands, capture responses. Fully CLI-testable.

**Exit criteria:** `bun run cli chrome-launch --provider claude --account user@gmail.com` → Chrome launches → CDP connects → can type message and capture response.

**Source of truth:** vivim-final `src/executor/` + atomic specs. cap-store (`C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store`) is prior-art reference only.

| Unit | Description | Source File | Est. | Dependencies |
|------|-------------|-------------|------|--------------|
| 11.1 | `CDPClient` — raw WebSocket CDP client, auto-reconnect, session mgmt, per-command timeouts | `cdp.ts` (621 lines) | L | None |
| 11.2 | `ChromeLauncher` — cross-platform Chrome launch, profile isolation, headless/hidden modes | `launcher.ts` (237 lines) | M | None |
| 11.3 | `ProfileAllocator` — create/reuse Chrome profiles per provider+account combo | `profile-allocator.ts` | M | 11.2 |
| 11.4 | `PortReaper` — kill orphaned Chrome processes on startup | `port-reaper.ts` | S | 11.2 |
| 11.5 | `FleetSupervisor` — manage Chrome fleet lifecycle, provider profiles | `fleet-supervisor.ts` | M | 11.1-11.4 |
| 11.6 | `SlaveWrite` — type text, click elements, navigate in Chrome | `slave-write.ts` | M | 11.1 |
| 11.7 | `SlaveRead` — read DOM, take screenshots, extract content from Chrome | `slave-read.ts` | M | 11.1 |
| 11.8 | `ConversationDriver` — send message, capture response, parse blocks | `conversation-driver.ts` | M | 11.1-11.7 |
| 11.9 | `StreamCapture` — capture streaming responses from Chrome | `stream-capture.ts` | M | 11.1 |
| 11.10 | `NetworkCapture` — intercept network traffic from Chrome | `network-capture.ts` | M | 11.1 |
| 11.11 | Executor barrel — wiring + factory (`src/executor/index.ts`) | `index.ts` | S | All above |

### Critical Design Decisions (Phase 11)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CDP Transport | Raw WebSocket | Port `BunCdpClient` against vivim-final source — full control, no dependencies |
| Chrome launch | `Bun.spawn()` | Cross-platform, already works in cap-store |
| Profile isolation | `data/chrome-profiles/{providerSlug}/{accountId}/` | Unique per provider+account, persistent cookies |
| Port allocation | Scan range 9220-9250 for available | Not sequential, not random |
| Reconnection | Exponential backoff (0.5s, 1s, 2s, 4s, 8s, max 30s) | Already implemented in cap-store |
| Session re-attach | Re-register CDP event listeners after reconnect | Already implemented in cap-store |

---

## Phase 12: Remux Backend — Per-Turn Provider Routing

**Goal:** One conversation can route messages to different providers per turn.

**Exit criteria:** Single conversation with messages from 3 different providers, each turn routed correctly.

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 12.1 | `RemuxRouter` engine — select provider per turn, merge history | L | Phase 11 |
| 12.2 | Conversation schema extension — `provider_id` per message | S | None |
| 12.3 | `POST /api/conversations/:id/send` — accept `providerId` override | M | 12.1 |
| 12.4 | `GET /api/conversations/:id/messages` — return provider per message | S | 12.2 |
| 12.5 | History context builder — merge multi-provider history for context | M | 12.1 |
| 12.6 | Provider switching middleware — validate provider availability | M | 12.1 |
| 12.7 | Side-by-side comparison endpoint — `POST /api/conversations/:id/compare` | M | 12.1 |
| 12.8 | Response normalization — unify different provider response formats | L | 12.1 |
| 12.9 | Integration test — send to Claude, then ChatGPT, then Gemini in one conv | M | All above |

### Critical Design Questions (Phase 12)

1. **History Context for Provider Switching**
   - When switching from Claude to ChatGPT mid-conversation, what history does ChatGPT see?
   - Option A: Full history (all providers' messages)
   - Option B: Only this provider's history
   - Option C: Summarized history (LLM-summarized)

2. **Response Normalization**
   - Different providers return different formats (SSE, JSON, streaming)
   - Need unified `ContentBlock[]` format
   - How to handle provider-specific features (Claude thinking, ChatGPT artifacts)?

---

## Phase 13: Consumer Chat UI (Tauri Desktop)

**Goal:** Polished desktop chat app — the MVP product.

**Exit criteria:** Double-click app → chat with Claude → switch to ChatGPT mid-conversation → upload image → export as markdown.

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 13.1 | Tauri scaffold — Rust backend + React frontend | L | Phase 12 |
| 13.2 | Chat layout — message list + input + sidebar | L | 13.1 |
| 13.3 | Provider selector — dropdown with health indicators | M | 13.2 |
| 13.4 | Model selector — per-provider model dropdown | M | 13.3 |
| 13.5 | Message input — textarea with file upload button | M | 13.2 |
| 13.6 | Streaming renderer — block-by-block response display | L | 13.5 |
| 13.7 | Markdown/code renderer — syntax highlighting, tables | M | 13.6 |
| 13.8 | Conversation sidebar — list, search, create, delete | M | 13.2 |
| 13.9 | Per-turn provider badge — show which provider answered | S | 13.6 |
| 13.10 | File upload UI — drag-drop + preview | M | 13.5 |
| 13.11 | Conversation export — markdown/JSON download | S | 13.8 |
| 13.12 | Conversation search — full-text search across history | M | 13.8 |
| 13.13 | Settings panel — API keys, provider accounts, theme | M | 13.1 |
| 13.14 | First-launch onboarding — add first provider account | M | 13.13 |
| 13.15 | Error states — provider down, network error, auth expired | M | All above |

### Critical Design Questions (Phase 13)

1. **Frontend Source**
   - Option A: Port existing frontend from vivim-app-og (66+ components)
   - Option B: Build new minimal frontend from scratch
   - Option C: Use existing frontend as-is, point at new backend

2. **Tech Stack**
   - Current: React 19 + Zustand + Tailwind + Vite
   - Alternative: Svelte, Vue, SolidJS
   - Decision: Stick with React (ecosystem, existing code)

3. **State Management**
   - Current: Zustand with immer middleware
   - Alternative: Jotai, Recoil, Redux Toolkit
   - Decision: Stick with Zustand (existing code, simplicity)

---

## Phase 14: Agentic Capabilities

**Goal:** AI agents that can browse the web, use tools, act autonomously.

**Exit criteria:** User says "research this topic" → agent opens Chrome → navigates → reads → synthesizes → returns structured answer.

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 14.1 | `ToolUseProtocol` wiring — register tools, handle tool calls | L | Phase 11 |
| 14.2 | `AgenticLoop` wiring — sense→plan→act→observe→reflect loop | L | 14.1 |
| 14.3 | Built-in tools — web_search, screenshot, click, type, navigate | L | 14.1 |
| 14.4 | `HarnessProtocolEngine` wiring — prompt augmentation + response extraction | L | 14.2 |
| 14.5 | Agent UI — tool call display, approval flow, progress indicator | L | Phase 13 |
| 14.6 | `SelectorHealer` — auto-repair broken selectors from observations | M | 14.2 |
| 14.7 | `ObservationTap` — live DOM stream to agent memory | M | 14.2 |
| 14.8 | Agent session management — pause/resume/restart | M | 14.2 |
| 14.9 | Safety guardrails — confirmation for destructive actions | M | 14.5 |
| 14.10 | Agent Playground UI — visual agent step timeline | M | 14.5 |

---

## Phase 15: Visual Workflow Builder

**Goal:** n8n-style visual DAG builder for composing multi-step automations.

**Exit criteria:** User builds a 3-step workflow visually → runs it → sees each step execute in real-time.

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 15.1 | `WorkflowEngine` wiring — execute DAG definitions | L | Phase 11 |
| 15.2 | `WorkflowCompiler` wiring — validate + compile visual graphs | L | 15.1 |
| 15.3 | Node types — trigger, action, logic, AI, sub-workflow | L | 15.1 |
| 15.4 | Visual editor — drag-drop canvas with node palette | L | Phase 13 |
| 15.5 | Connection system — wire nodes, validate data flow | L | 15.4 |
| 15.6 | Execution panel — live status, logs, step-through | M | 15.1 |
| 15.7 | Template library — pre-built workflows (research, monitoring, etc.) | M | 15.1 |
| 15.8 | Human-in-the-loop — approval nodes, pause points | M | 15.1 |
| 15.9 | Webhook triggers — external event kickoff | M | 15.1 |
| 15.10 | Workflow versioning — save, fork, rollback | M | 15.1 |

---

## Phase 16: Memory & Learning

**Goal:** System learns from interactions, improves over time.

**Exit criteria:** After 10 conversations, system suggests "Based on your history, Claude works best for code tasks."

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 16.1 | `MemoryEngine` wiring — episodic + semantic + procedural | L | Phase 11 |
| 16.2 | `TransferAccelerator` wiring — cross-provider pattern transfer | L | 16.1 |
| 16.3 | Episodic memory — conversation summaries, key decisions | M | 16.1 |
| 16.4 | Semantic memory — learned facts, user preferences | M | 16.1 |
| 16.5 | Procedural memory — successful workflows, tool patterns | M | 16.1 |
| 16.6 | Pattern mining — extract reusable patterns from history | M | 16.1 |
| 16.7 | Smart suggestions — recommend next actions based on context | M | 16.3-16.5 |
| 16.8 | Provider preference learning — auto-select best provider per task | M | 16.7 |

---

## Phase 17: Production Hardening

**Goal:** Reliable, secure, performant for daily use.

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 17.1 | Error recovery — retry, circuit breaker, graceful degradation | L | Phase 11 |
| 17.2 | Auth system — local auth, provider API key management | M | Phase 13 |
| 17.3 | Data encryption — at-rest encryption for conversations | M | Phase 11 |
| 17.4 | Auto-update — Tauri auto-updater | M | Phase 13 |
| 17.5 | Logging & telemetry — structured logs, crash reporting | M | Phase 11 |
| 17.6 | Performance profiling — identify bottlenecks | M | Phase 11 |
| 17.7 | Memory optimization — conversation pruning, lazy loading | M | Phase 11 |
| 17.8 | Cross-platform testing — Windows, macOS, Linux | L | Phase 13 |
| 17.9 | Installer & distribution — signed builds, auto-update channel | M | Phase 13 |

---

## Phase 18: Advanced Provider Support

**Goal:** Expand provider ecosystem beyond the big 3.

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 18.1 | DeepSeek integration + selectors | M | Phase 11 |
| 18.2 | Qwen integration + selectors | M | Phase 11 |
| 18.3 | Z.ai integration + selectors | M | Phase 11 |
| 18.4 | Studio AI integration + selectors | M | Phase 11 |
| 18.5 | Custom provider onboarding — URL + auto-discovery | L | Phase 11 |
| 18.6 | Provider marketplace — browse + install providers | M | 18.5 |
| 18.7 | Provider health dashboard — cross-provider monitoring | M | Phase 11 |

---

## Phase 19: Collaboration & Sync

**Goal:** Multi-device, team features.

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 19.1 | Cloud sync — conversations across devices | L | Phase 17 |
| 19.2 | Shared workflows — team workflow library | M | Phase 15 |
| 19.3 | Provider account sharing — team provider accounts | M | Phase 11 |
| 19.4 | Activity feed — team conversation activity | M | Phase 11 |
| 19.5 | Export/import — full data portability | M | Phase 11 |

---

## Phase 20: Platform & Ecosystem

**Goal:** Third-party extensibility.

| Unit | Description | Est. | Dependencies |
|------|-------------|------|--------------|
| 20.1 | Plugin API — third-party tool registration | L | Phase 14 |
| 20.2 | MCP server mode — expose VIVIM as MCP server | L | Phase 14 |
| 20.3 | CLI automation — headless workflow execution | M | Phase 15 |
| 20.4 | API documentation — developer portal | M | Phase 12 |
| 20.5 | Community workflows — share/import workflow templates | M | Phase 15 |

---

## Delivery Timeline (Estimated)

```
Phase 11 (Provider Baseline)     ████░░░░░░░░  ~2 weeks
Phase 12 (Remux Backend)         ░░░░████░░░░  ~1.5 weeks
Phase 13 (Consumer Chat UI)      ░░░░░░░░████  ~3 weeks
                                ─────────────
                                MVP SHIP 🚀

Phase 14 (Agentic)               ████████░░░░  ~3 weeks
Phase 15 (Workflows)             ░░░░████████  ~3 weeks
Phase 16 (Memory)                ░░░░░░░░████  ~2 weeks
                                ─────────────
                                V1.5 FULL VISION

Phase 17 (Production)            ████████░░░░  ~2 weeks
Phase 18 (Providers)             ░░░░████░░░░  ~2 weeks
Phase 19 (Collaboration)         ░░░░░░░░████  ~2 weeks
Phase 20 (Platform)              ░░░░░░░░░░██  ~2 weeks
                                ─────────────
                                V2.0 PLATFORM
```

---

## What Makes VIVIM Unique (Competitive Moat)

| Feature | ChatGPT | Claude | Gemini | VIVIM |
|---------|---------|--------|--------|-------|
| Multi-provider in one app | ❌ | ❌ | ❌ | ✅ |
| Per-turn provider routing | ❌ | ❌ | ❌ | ✅ |
| Browser automation (CDP) | ❌ | ❌ | ❌ | ✅ |
| Visual workflow builder | ❌ | ❌ | ❌ | ✅ |
| Local-first / privacy | ❌ | ❌ | ❌ | ✅ |
| Open provider ecosystem | ❌ | ❌ | ❌ | ✅ |

---

## Open Questions (Resolved)

| # | Question | Answer | Rationale |
|---|----------|--------|-----------|
| 1 | CDP Transport | Raw WebSocket | Port `BunCdpClient` against vivim-final source — full control, no deps |
| 2 | Chrome Process Management | Profile isolation per provider+account | Port `launcher.ts` — cross-platform, persistent cookies |
| 3 | Selector Strategy | Hybrid (already designed) | Static selectors + recovery strategies + drift detection |
| 4 | Frontend Source | Build new | Learn chrome slave mechanism from vivim-app-og, don't port 66+ components |
| 5 | API Style | Hybrid (REST + dispatch) | REST for CRUD, dispatch for actions — matches cap-store pattern |
| 6 | Streaming | WebSocket | Bidirectional — server pushes chunks from Chrome |
| 7 | Chrome binary | Auto-detect + config override | Port `detectChromePath()` against vivim-final source |
| 8 | Port allocation | Scan for available | Port `findAvailablePort()` against vivim-final source |
| 9 | MVP scope | MVP-D: Remux + agent mode | Full value prop from day one |
| 10 | Build order | Full backend first | CLI-testable, UI component registry for frontend contracts |

### Still Open (Business)

| # | Question | Options | Decision Needed |
|---|----------|---------|-----------------|
| 11 | Pricing | Free tier? Pro tier? Enterprise? | User decision |
| 12 | Distribution | Direct download? App store? Both? | User decision |
| 13 | Provider agreements | Do we need agreements with Anthropic/OpenAI/Google? | Legal review |

---

## Next Steps

1. **Implement Phase 11** — Chrome automation layer (critical path)
2. **Wire into ChromeGovernor** — replace stubs with real implementation
3. **CLI-testable** — `bun run cli chrome-launch --provider claude`
4. **Integration test** — launch Chrome, connect CDP, send message, capture response
5. **Phase 12** — Remux backend (per-turn provider routing)

---

## Build Order (Backend-First)

```
Phase 11: Chrome Automation     ████░░░░░░░░  ~2 weeks   [CRITICAL PATH]
Phase 12: Remux Backend         ░░░░██░░░░░░  ~1.5 weeks
Phase 13: API Layer             ░░░░░░██░░░░  ~1 week
Phase 14: Agent Mode            ░░░░░░░░██░░  ~2 weeks
                                ─────────────
                                BACKEND COMPLETE ✓

Phase 15: Frontend (Tauri)      ████████░░░░  ~3 weeks
Phase 16: Integration           ░░░░████░░░░  ~1.5 weeks
                                ─────────────
                                MVP SHIP 🚀
```

---

## Reference Implementation (cap-store) — Prior Art Only

The cap-store at `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store` is a **prior-art reference** for a working Chrome automation system. Key files to learn from — do NOT port verbatim; build against vivim-final source:

### Chrome Automation (Critical Path)

| File | Purpose | Lines | Port Priority |
|------|---------|-------|---------------|
| `src/executor/cdp.ts` | Full CDP client — WebSocket, auto-reconnect, session mgmt, per-command timeouts | 621 | **P0** |
| `src/executor/launcher.ts` | Chrome launcher — profile isolation, headless/hidden/offscreen, cross-platform | 237 | **P0** |
| `src/executor/fleet.ts` | Provider profiles, Chrome path detection (Windows/Mac/Linux) | 68 | **P0** |
| `src/executor/profile-allocator.ts` | Profile directory allocation | — | **P1** |
| `src/executor/port-reaper.ts` | Kill orphaned Chrome processes on startup | — | **P1** |
| `src/executor/slave-read.ts` | Read DOM, take screenshots, extract content | — | **P1** |
| `src/executor/slave-write.ts` | Type text, click elements, navigate | — | **P1** |
| `src/executor/health-probe.ts` | Chrome liveness checks | — | **P1** |

### Chrome Profile Isolation Model

```
User registers: Claude + user@gmail.com
    ↓
System creates: data/chrome-profiles/claude_user_gmail_com/
    ↓
Chrome launches: chrome --user-data-dir=data/chrome-profiles/claude_user_gmail_com/ --remote-debugging-port=9224
    ↓
CDP connects: ws://127.0.0.1:924/devtools/browser/...
    ↓
Cookies persist: User stays logged in across sessions
    ↓
Reuse: Whenever user selects Claude + this account, same profile + CDP connection is used
```

### API Layer (Hybrid Pattern)

| File | Purpose | Pattern |
|------|---------|---------|
| `src/server/index.ts` | HTTP server — routes to v02 batch handlers | REST + dispatch |
| `src/server/v02.ts` | Provider CRUD, binding strategies, account management | REST endpoints |
| `src/router/index.ts` | Verb-based dispatch — resolve bindings, execute programs | RPC-style |
| `src/server/websocket.ts` | WebSocket server — streaming responses | WS |
| `src/executor/conversation-driver.ts` | Send message, capture response, parse blocks | Orchestration |

### Frontend (Reference Only — Building New)

| File | Purpose | Notes |
|------|---------|-------|
| `src/stores/chatStore.ts` | Chat state — conversations, messages, streaming | Zustand pattern |
| `src/stores/accountStore.ts` | Account state — providers, accounts, token health | Zustand pattern |
| `src/lib/api/core.ts` | HTTP/RPC core — request(), call() | API pattern |
| `src/lib/api/ws.ts` | WebSocket client — VIVIMWebSocket class | Streaming pattern |
| `src/components/ChatView.tsx` | Main chat UI (1624 lines) | Reference for new UI |

### vivim-final (Current Codebase)

| File | Purpose | Status |
|------|---------|--------|
| `src/engines/chrome-governor.ts` | ChromeGovernor interface (671 lines) | Interface only — needs real CDP transport |
| `src/engines/conversation-manager.ts` | ConversationManager (300 lines) | Orchestration logic — needs wiring |
| `src/engines/stream-parser.ts` | StreamParserEngine (247 lines) | Parser logic — needs wiring |
| `src/storage/contracts/conversation-store.ts` | ConversationStore contract | Contract — implementation exists |
| `src/storage/impl/conversation-store-impl.ts` | ConversationStore implementation | Working — Prisma-backed |
| `src/server/conversation-router.ts` | REST API router (79 lines) | Stubs — needs real endpoints |
| `prisma/schema.prisma` | Database schema (1689 lines) | Complete — 81+ tables |
