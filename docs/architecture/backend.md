# Architecture — Engines

> What each engine does, where its code lives, and how they connect.

---

## Engine Count

- **Core engines:** 13 (original architecture)
- **Total engine files:** 455+ TypeScript files under `src/engines/`
- **Subsystems:** Chrome, Browser Automation, Command Language, Capability Bootstrap, Stealth, Actor Model, Automation, Knowledge, and more

---

## Core Engine Map

### L0-L1: Provider Knowledge Graph

| Engine | File | Job |
|--------|------|-----|
| **ProviderRegistrar** | `src/engines/provider-registrar.ts` | Loads provider manifests, registers providers in DB, wires fallback parser chains |
| **ProviderHealthKernel** | `src/engines/provider-health-kernel.ts` | Tracks provider availability, response times, error rates |

### L2-L3: Capability System

| Engine | File | Job |
|--------|------|-----|
| **CapabilityResolutionEngine** | `src/engines/capability-resolution.ts` | Translates natural language to resolved capabilities with confidence scoring |
| **CapabilityEngine** | `src/engines/capability.ts` | Executes resolved capabilities against providers |
| **CapabilityEventBus** | `src/engines/capability-event-bus.ts` | Pub/sub for capability lifecycle events |
| **CapabilitySnapshot** | `src/engines/capability-snapshot.ts` | Boot-time snapshot of active capability bindings |
| **CapabilityTaxonomy** | `src/engines/capability-taxonomy.ts` | Category/subcategory classification |
| **CapabilityComposer** | `src/engines/capability-composer.ts` | Multi-step capability composition |

### L4: Session & State

| Engine | File | Job |
|--------|------|-----|
| **ConversationManager** | `src/engines/conversation-manager.ts` | Conversation CRUD, message persistence, fork-linking |
| **StreamBlockStore** | `src/engines/stream-block-store.ts` | Real-time streaming block storage |

### Chrome Layer

| Engine | File | Job |
|--------|------|-----|
| **ChromeGovernor** | `src/engines/chrome-governor.ts` | Single I/O authority for CDP — lifecycle, proxy, trace, health |
| **CdpWatchdog** | `src/engines/cdp-watchdog.ts` | Detects and recovers from CDP disconnections |
| **CdpDiscovery** | `src/engines/cdp-discovery.ts` | Discovers available CDP targets |

### Cross-cutting

| Engine | File | Job |
|--------|------|-----|
| **ConfigManager** | `src/engines/config-manager.ts` | Centralized configuration |
| **StreamParserEngine** | `src/engines/stream-parser.ts` | DB-only parser execution with fallback chains |
| **StreamAlignmentEngine** | `src/engines/stream-align.ts` | Parser hash computation, version resolution |

### Lifecycle

| Engine | File | Job |
|--------|------|-----|
| **RegistrationAuditor** | `src/engines/registration-auditor.ts` | Validates provider registrations |
| **VersionManager** | `src/engines/version-manager.ts` | Schema version tracking |
| **TelemetryAggregator** | `src/engines/telemetry-aggregator.ts` | Metrics collection and aggregation |

---

## Subsystems (Beyond the Core 13)

### Chrome Subsystem (`src/engines/chrome/`)

| File | Job |
|------|-----|
| `cdp-proxy.ts` | WebSocket proxy for CDP protocol |
| `health-monitor.ts` | Chrome process health tracking |
| `circuit-breaker.ts` | Fault tolerance for CDP calls |
| `trace-log.ts` | Structured trace logging |
| `async-mutex.ts` | Concurrency control |

### Browser Automation (`src/engines/browser-automation/`)

| File | Job |
|------|-----|
| `agentic-loop.ts` | Autonomous browser interaction loop |
| `semantic-grounding.ts` | Maps natural language to DOM elements |
| `selector-healer.ts` | Auto-repairs broken CDP selectors |
| `recipes.ts` | Reusable automation recipes |
| `registry.ts` | Automation action registry |

### Capability Bootstrap (`src/engines/capability-bootstrap/`)

| File | Job |
|------|-----|
| `index.ts` | Boot orchestrator |
| `default-caps.ts` | Built-in capability definitions |
| `nl-interpret.ts` | Natural language interpretation kernel |
| `discovery.ts` | Runtime capability discovery |
| `seed.ts` | DB seeding for capabilities |

### Command Language (`src/engines/command-language/`)

| File | Job |
|------|-----|
| `parser.ts` | Command parsing |
| `resolver.ts` | Command resolution |
| `registry.ts` | Command registry |
| `nlp-matcher.ts` | NLP-based command matching |

### Stealth (`src/engines/stealth/`)

Anti-detection modules for browser automation — user-agent rotation, fingerprint evasion, timing jitter.

### Knowledge (`src/engines/knowledge-*.ts`)

| File | Job |
|------|-----|
| `knowledge-ingestion.ts` | Ingest documents into knowledge base |
| `knowledge-extractor.ts` | Extract entities and relationships |
| `knowledge-index-pipeline.ts` | Index knowledge for retrieval |

### Actor Model (`src/engines/actor/`)

| File | Job |
|------|-----|
| `browser-actor.ts` | Actor wrapper for browser sessions |
| `actor-supervisor.ts` | Actor lifecycle management |
| `mailbox.ts` | Message passing between actors |

---

## Engine Invariants

1. **Governor Canon** — Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Store Contracts** — Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
3. **DB-Only Parser Logic** — `StreamParserEngine` loads parser logic only from DB (`parser_logic_code` with `logic_type=inline`). File-based parsers are rejected.
4. **One Entry Point** — Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that call `POST /api/interpret` → `POST /api/capabilities/:id/execute`.

---

## Adding a New Engine

1. Create `src/engines/my-engine.ts`
2. Define a TypeScript interface (match spec exactly)
3. Define a Store Contract at `src/storage/contracts/my-engine-store.ts`
4. Implement with proper error handling using `src/errors.ts`
5. Register in `src/server/bootstrap-engines.ts`
6. Write unit tests in `tests/unit/engines/`

See [OVERVIEW.md](OVERVIEW.md) for the high-level mental model.
