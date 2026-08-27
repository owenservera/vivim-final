# Architecture — Overview

> The 30-second mental model of Vivim.

---

## What Vivim Is

Vivim is a **local-first AI conversation platform** that connects to multiple AI providers (ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok) through a single unified interface. It runs on your machine — no cloud dependency required.

**Key idea:** Every provider interaction is a *capability* — a typed, composable operation with a single API. You don't write provider-specific code; you declare capabilities and the system resolves, routes, and streams them.

---

## The Three Big Concepts

### 1. Capability System

A **capability** is an atomic operation: `send_message`, `select_model`, `create_chat`, `upload_file`. Every capability has:

- A unique ID (`cap:chat:send_message`)
- A taxonomy category (`chat`, `admin`, `memory`)
- Surface bindings (CLI, API, MCP, UI)
- A provider-specific execution recipe

The **CapabilityResolutionEngine** translates natural language ("send a message to Claude") into a resolved capability with confidence scoring. The **CapabilityEngine** executes it.

```
User input → NL Interpretation → Capability Resolution → Provider Routing → Execution
```

### 2. Provider Knowledge Graph

Each AI provider (ChatGPT, Claude, etc.) is described by a **manifest** — a declarative JSON document that declares:

- Endpoints (landing, chat, login URLs)
- CDP selectors (composer, send button, DOM patterns)
- Parser references (how to decode streaming responses)
- Model lists and capabilities
- Fleet configuration (port ranges, Chrome args)

The **ProviderRegistrar** loads manifests, registers providers in the DB, and wires fallback parser chains. The system supports 16+ registered providers.

### 3. Chrome Governor

The **ChromeGovernor** is the single I/O authority for all Chrome/CDP interaction. It:

- Manages Chrome slave processes (one per provider account)
- Proxies CDP commands through a circuit breaker
- Logs traces for debugging
- Enforces the invariant: **only ChromeGovernor touches CDP**

No other engine imports `BunCdpClient` directly. This is a hard architectural boundary.

---

## System Layers

```
┌──────────────────────────────────────────────────────┐
│                   SURFACES                            │
│   CLI  ·  HTTP API  ·  WebSocket  ·  MCP  ·  UI     │
├──────────────────────────────────────────────────────┤
│                CAPABILITY LAYER                       │
│   CapabilityResolution  ·  CapabilityEngine          │
│   NLCL Catalog  ·  Taxonomy  ·  Event Bus            │
├──────────────────────────────────────────────────────┤
│               PROVIDER LAYER                          │
│   ProviderRegistrar  ·  ProviderHealthKernel         │
│   StreamParserEngine  ·  ChromeGovernor              │
├──────────────────────────────────────────────────────┤
│                 DATA LAYER                            │
│   Prisma (SQLite)  ·  Store Contracts  ·  Node Model │
│   ConversationManager  ·  StreamBlockStore            │
├──────────────────────────────────────────────────────┤
│              INFRASTRUCTURE                           │
│   ConfigManager  ·  Logger  ·  TelemetryAggregator   │
│   RegistrationAuditor  ·  VersionManager             │
└──────────────────────────────────────────────────────┘
```

---

## Engine Architecture (13 Core + Extensions)

The original 13-engine architecture is organized in layers. The surface has since grown well beyond 13 engines, but the core layering holds:

| Layer | Engines | Job |
|-------|---------|-----|
| **L0-L1** Provider KG | ProviderRegistrar, ProviderHealthKernel | Register providers, track health |
| **L2-L3** Capabilities | CapabilityResolutionEngine, CapabilityEngine | Resolve & execute capabilities |
| **L4** Session | ConversationManager, StreamBlockStore | State, history, streaming blocks |
| **Chrome** | ChromeGovernor | CDP proxy, lifecycle, trace, health |
| **Cross-cutting** | CapabilityEventBus, ConfigManager, StreamParserEngine | Shared infrastructure |
| **Lifecycle** | RegistrationAuditor, VersionManager, TelemetryAggregator | System lifecycle |

See [ENGINES.md](ENGINES.md) for every engine, its file location, and its responsibilities.

---

## Data Flow (Sending a Message)

```
1. User types "Hello" in the UI
2. Frontend POSTs to /api/conversations/:id/send
3. CapabilityResolutionEngine resolves: send_message → cap:chat:send_message
4. Provider routing selects the target provider (e.g., Claude)
5. ChromeGovernor executes the capability recipe via CDP
6. StreamParserEngine parses the streaming response (SSE/RPC/JSON)
7. ConversationManager persists the message to SQLite
8. WebSocket pushes blocks to the frontend in real-time
9. Frontend renders the response via React
```

---

## Key Invariants

1. **Governor Canon** — Only ChromeGovernor touches CDP. No exceptions.
2. **Store Contracts** — Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
3. **DB-Only Parser Logic** — Stream parsers load from DB, not files.
4. **One Entry Point** — Every operation is a `UnifiedCapability`. No second transport.
5. **FRONTEND = BACKEND** — Capability slug is the single link between UI and backend.

---

## Further Reading

- [ENGINES.md](ENGINES.md) — Full engine catalog
- [DATA.md](DATA.md) — Schema, migrations, Node model
- [API.md](API.md) — Routes and surface map
- [FRONTEND.md](FRONTEND.md) — React UI architecture
