# Research Brief — Libraries / Frameworks / SDKs for vivim-final

> **Document intent:** A comprehensive context pack for a *research agent* whose job is to find
> **libraries, frameworks, SDKs, and reusable packages** that help vivim-final reach its project
> goals and capabilities **without rebuilding the wheel**. This is *adoption research*: find
> mature, fit-for-purpose dependencies to add to `package.json` (or `web/` packages), not custom
> reimplementations of solved problems. The agent must respect the architecture, the Bun runtime,
> and the project's hard invariants.

---

## 0. TL;DR for the research agent

- vivim-final is a **local-first AI conversation platform** whose core abstraction is a
  **capability-driven knowledge graph** (capabilities, providers, parsers, bindings, selectors,
  programs are all rows in a Prisma/SQLite DB).
- It runs on **Bun + strict TypeScript + Prisma + Zod + ulid + alasql + Biome + tsup + Lefthook + Bun test**.
- It has **13 core engines + ~10 SOTA engines**, a **ChromeGovernor** (only thing touching CDP),
  a **server** (Bun.serve + WebSocket + REST), a **CLI**, a **typed SDK**, and a **frontend
  monorepo** (`web/`: Vite + React 19 + TS + Tailwind + Zustand).
- Active frontier (§1): the **executor** layer, **stub resolution**, and the **frontend sandbox**.
- Your task: find libraries that fill capability gaps (§6) — HTTP/routing, CLI, streaming, sandbox
  isolation, graph queries, selectors, logging, error types, provider SDKs, testing utilities — with
  a strong bias toward **adoption over greenfield**, verified **Bun-compatible**, and composable
  with the existing stack.

---

## 1. Project Goals & Capabilities (what we must achieve)

### 1.1 Goals (`docs/goals/GOALS.md`)

| Goal | Status | Covers |
|---|---|---|
| **G-001 Core Platform** | DONE 100% | Prisma schema, 7 providers, ChromeGovernor, 13 engines, server, SDK, CLI, tests |
| **G-002 SOTA Features** | DONE 100% | Mirror, agentic loops, workflow DAGs, semantic grounding, memory, MCP, harness protocol |
| **G-003 Executor + Polish** | 20% | Executor layer vs vivim-final core, stub resolution, platform completion |
| **G-004 Frontend Sandbox** | 15% | Web-native sandbox (Vite+React19+Tailwind+Zustand) testing backend capabilities; promotes proven patterns to production UI |

### 1.2 Capability domains to support

- **Provider knowledge graph** — register providers, health/kernel tracking (L0–L1).
- **Capability system** — resolution, selection, binding, programs, macros (L2–L3).
- **Session & streaming state** — conversation manager, stream block store, SSE/streaming (L4).
- **Chrome layer** — CDP proxy, browser lifecycle, tracing, health (`ChromeGovernor` — only layer touching CDP).
- **Sandbox / executor** — safe execution of user/agent programs (`src/sandbox`, `src/executor`).
- **Parsers** — normalize ChatGPT/Claude/Gemini/generic/system exports (`seeds/parsers/*`).
- **Router / alerting / automation** — dispatch, notifications, workflow automation (`src/router`, `src/alerting`, `src/automation`).
- **HTTP server + API** — `src/server`, REST/JSON + WebSocket (`07-merged-api.md`).
- **Seeds + migrations** — relational data bootstrapping via Prisma (`seeds/`).
- **SOTA engines** — mirror, observation, agentic loop, workflow, semantic grounding, memory, transfer, MCP adapters, harness protocol.

---

## 2. Full Current Stack (already chosen — do NOT re-research these)

### 2.1 Backend (`package.json`)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | **Bun** | ESM-only, `.js` extensions, no Node-specific APIs |
| Language | **TypeScript** (strict, `noUncheckedIndexedAccess`) | `@/*` → `./src/*` |
| ORM | **Prisma v6.5** (`@prisma/client`) | ~54-table relational schema |
| Validation | **Zod v3** | Runtime validation at boundaries (mandatory) |
| IDs | **ulid** | `src/ids.ts` |
| In-memory SQL | **alasql** | `seeds/` / local query needs |
| Lint/Format | **Biome** | Single tool (no ESLint/Prettier) |
| Build | **tsup** | ESM + DTS |
| Hooks | **Lefthook** | pre-commit/pre-push |
| Test | **Bun test** | unit/integration/e2e |

### 2.2 Frontend monorepo (`web/`)

Workspace packages: `api-client`, `app`, `sandbox`, `ui`. Stack per GOALS:
**Vite + React 19 + TypeScript + Tailwind + Zustand**.

### 2.3 Conventions (from `AGENTS.md`)

- `type` imports; no `any` (use `unknown` + narrowing) — `noExplicitAny` is *off* in Biome but the
  project standard is no-`any` in engines.
- Zod at boundaries; ULID for IDs; barrel exports from `src/index.ts`.
- **Store contracts** in `src/storage/contracts/*` (never `-impl`); engines depend only on contracts.
- Errors via `src/errors.ts` custom classes (no raw `new Error()`).
- All commands **PowerShell 7+ compatible**.

---

## 3. Architecture & Design Principles (why certain libraries fit / don't)

The 9 principles (see DEVOPS brief §3.1) constrain library choice:

- **P1 Knowledge Graph / P3 Seeds Not Code** → prefer data-driven libs; don't hardcode provider logic.
- **P2 Governor Canon** → any CDP/browser lib must stay behind `ChromeGovernor`; do not pull an SDK that bypasses it.
- **P4 Unit-Testable / contract split** → libs must be mockable; avoid singletons that can't be faked.
- **P6 Relational First** → prefer relational/SQL-friendly libs over document/JSON-blob approaches.
- **P7 Re-Programmable** → config-driven libs compose with `ConfigManager`.
- **P8 Capability-Driven UI** → frontend libs should render from the 21-field UI contract, no conditional logic.
- **P9 Agentic Harness (server-side)** → execution/sandbox libs must run in Bun/Node, never injected into Chrome.

---

## 4. Engine Catalog (what already exists — context for gap-filling)

**13 core** (`src/engines/`): `chrome-governor`, `conversation-manager`, `stream-parser`,
`capability`, `provider-registrar`, `capability-resolution`, `capability-event-bus`,
`provider-health`, `stream-block-store`, `registration-auditor`, `version-manager`,
`telemetry-aggregator`, `config-manager`, `execution-memoizer`.

**SOTA (scaffolded)**: `mirror-engine`, `observation-tap`, `agentic-loop`, `tool-use-protocol`,
`workflow-engine`, `workflow-compiler`, `semantic-grounding`, `selector-healer`, `memory-engine`,
`transfer-accelerator`, `capability-shape-registry`, `provider-discovery`, `manifest-inference`,
`plugin-system`, `harness-protocol-engine`, `harness-runtime`, `harness-checkpoint`,
`mcp-server-adapter`, `mcp-client-adapter`, `session-checkpoint`, `state-transition`,
`streaming-protocol`, `capability-macro`.

**Executor** (`src/executor/`, 12 files): `cdp`, `cdp-types`, `circuit-breaker`, `async-mutex`,
`content-blocks`, `fleet-config`, `fleet-supervisor`, `ids`, `launcher`, `port-reaper`,
`profile-allocator`, `slave-write`.

**Cross-cutting**: `src/router` (router), `src/automation/scheduler`, `src/alerting/alerter`,
`src/server/*` (index, response, websocket, conversation-router, auth-gate), `src/cli/*`
(index, command-registry, output-formatter, pipeline-engine, bridges/, commands/),
`src/schema/*` (18 Zod/type files), `src/storage/contracts/*` (×15), `src/storage/impl/*` (×15).

---

## 5. Database & API Context

- **~54 tables, 9 views**, SQLite (WAL, `foreign_keys=ON`), defined in `prisma/schema.prisma` +
  `03-merged-schema.md` SQL. Key domains: capability taxonomy/binding/program/macro/tier,
  providers/accounts/models/endpoints/parsers/health, conversations/messages/stream_blocks,
  sessions, trace/fleet/circuit, harness/session checkpoints, state transitions, routes, learning,
  transfers, registration/drift, telemetry, alerts, automation, tests, mcp config.
- **API**: 25+ REST endpoints on `Bun.serve` (port 9420) + WebSocket event bridge + `auth-gate`
  (Bearer) + typed `sdk/` client. Full contract in `07-merged-api.md`.
- **MCP slot**: `ChromeGovernor` exposes a design slot for an MCP server (`chrome_launch`,
  `chrome_send`, `chrome_capture`, `chrome_navigate`, `chrome_screenshot`, `chrome_get_state`).
  `mcp_server_config` table exists but unwired in v1.

---

## 6. Capability Gaps Where a Library Likely Helps

| # | Gap / need | Current state | Research direction |
|---|---|---|---|
| L1 | **HTTP server / routing** | Hand-rolled `Bun.serve` + `conversation-router` | Bun-native HTTP frameworks (Hono, Elysia) or keep built-in; typed routing |
| L2 | **CLI framework** | Hand-rolled `src/cli` (command-registry, pipeline-engine) | `@commander-js`, `citty`, `clipanion` (TS-first, typed) |
| L3 | **Streaming / SSE** | Custom `StreamBlockStore` + `streaming-protocol` | Native `ReadableStream`/SSE helpers; `assistant-stream` if chat-aligned (v2 block streaming) |
| L4 | **Schema → OpenAPI / docs** | Zod manual, no generated docs | `zod-to-openapi` / `@asteasolutions/zod-to-openapi` for API docs from Zod |
| L5 | **Sandbox execution isolation** | `src/sandbox`, `src/executor` custom | `worker_threads`, WASM runtimes, `isolated-vm` (Bun compat?), Deno-style permissions |
| L6 | **Graph / KG queries** | Relational (Prisma) | Real graph DB/query layer (neo4j, gremlin) vs relational+adjacency — fit analysis |
| L7 | **Fuzzy matching / selectors** | Custom capability selectors | `fuse.js`, `minisearch`, `bm25` for capability lookup |
| L8 | **Structured logging** | None declared | `pino`, `winston`, or Bun-native; must feed `TelemetryAggregator` |
| L9 | **Typed env / config** | `ConfigManager` custom | `zod` + `@t3-oss/env` / `dotenv` for typed env validation |
| L10 | **Testing utilities** | Bun test only | `@testing-library` (DOM), `msw` (network mock), `@faker-js/faker` (seed data), coverage thresholds |
| L11 | **CDP / browser SDK** | `ChromeGovernor` + `BunCdpClient` | Is `puppeteer-core`/`playwright` CDP sufficient, or keep custom? Boundary check vs Governor Canon |
| L12 | **DI / wiring** | Manual engine construction | `taint`/`tiny-injector`? Or keep explicit (invariants favor explicit) |
| L13 | **Result / Either types** | Custom `Result<T,E>`? | `neverthrow`, `ts-results` (avoid custom monad) |
| L14 | **Date / duration** | Native | `date-fns` (tree-shakeable) if needed |
| L15 | **Markdown / content render** | Chat UI | `react-markdown`, `markdown-it` if `web/ui` grows |
| L16 | **Queue / scheduler** | `src/automation/scheduler.ts` custom | `bullmq` (Redis) vs in-process; need for async capabilities (`automation_schedule`) |
| L17 | **Serialization across boundary** | JSON | `superjson` / `devalue` for server↔client transfer |
| L18 | **State management (frontend)** | Zustand (chosen) | Keep Zustand; perhaps `zustand` middleware (persist/immer) |
| L19 | **Provider SDKs** | Custom parser logic in `seeds/parsers/*` | Official OpenAI/Anthropic/Gemini SDKs to replace/complement custom parsers |
| L20 | **Schema migration tooling** | Prisma migrate | Keep Prisma; consider `prisma` + custom seed runner (already have) |
| L21 | **WebSocket client (frontend)** | Custom `AgentBridge` | `ws`/native; maybe `reconnecting-websocket` for resilience |
| L22 | **Form / validation (frontend)** | Zod (shared) | `react-hook-form` + `@hookform/resolvers` if `web/app` forms grow |
| L23 | **Icon / UI kit (frontend)** | Tailwind | `lucide-react`, `radix-ui` for the 21-field capability UI contract |

---

## 7. Intent — What the Research Agent Must Produce

Find and recommend **external libraries / frameworks / SDKs** that fill gaps (§6) with a strong
bias toward **not rebuilding solved problems**. Each candidate must:

1. Run under **Bun** (or be invokable via `npx`/native command).
2. Be **TypeScript-first** with types (strict-mode friendly, no `any` pollution).
3. **Compose** with the existing stack (Prisma, Zod, Biome, Bun test) rather than replace it.
4. Respect architectural invariants (Governor Canon, contract split, no raw `new Error()`).
5. Be **mature / maintained** — prefer adoption over greenfield custom code.

Deliverable: **shortlist** with `LIB / CAPABILITY / GAP / WHY / BUN / TRADEOFF / DECISION` per item
(see §10).

---

## 8. Constraints the Research Agent Must Honor

- **Bun compatibility is non-negotiable** — verify each candidate runs on Bun, not just Node.
  Prefer pure-ESM / no-native-deps packages or explicit Bun support.
- **No `any`** — candidate types must survive strict + `noUncheckedIndexedAccess`.
- **Zod at boundaries** — validation libs should interoperate with Zod (or be Zod itself).
- **PowerShell-compatible install/usage** — no Unix-only postinstall assumptions.
- **Don't replace the stack** — do not propose ESLint, Prettier, Jest, or a different ORM/validator.
- **Capability canon** — anything touching CDP must stay behind `ChromeGovernor`; do not pull an SDK
  that bypasses the Governor or imports `BunCdpClient` outside it.
- **Seeds are data, not code** — library choices for seeding keep seeds declarative.
- **Frontend libs** must fit the `web/` monorepo (Vite + React 19 + Tailwind + Zustand) and render
  from the capability UI contract (P8), not introduce bespoke conditional UI logic.

---

## 9. Research Questions

1. Which Bun-native HTTP framework best fits a capability-driven JSON API (L1) — or is built-in `Bun.serve` sufficient?
2. Is a dedicated CLI framework worth adopting, or is the current `src/cli` sufficient (L2)?
3. For sandbox execution, what is the safest Bun-compatible isolation model (L5)?
4. Does the knowledge graph need a real graph DB/query layer, or is relational + adjacency sufficient (L6)?
5. Which typed result/error library composes cleanly with `src/errors.ts` (L13)?
6. What testing utilities (mock network, fakes, coverage) mature the `bun test` setup (L10)?
7. Are there official provider SDKs that should replace custom parser logic (L19)?
8. Which OpenAPI/doc generator best pairs with the Zod-validated API (L4)?
9. What frontend libs best support the 21-field capability UI contract + sandbox (L15/L22/L23)?
10. Is `isolated-vm` or `worker_threads` the right executor isolation primitive on Bun (L5)?

---

## 10. Expected Output Format

For each recommendation:

```
LIB: <package name + version range>
CAPABILITY: <which goal/domain from §1.2 it serves>
GAP: <L# from §6>
WHY: <1-2 lines — why adopt vs build>
BUN: <verified-runs | needs-check | native-only> + evidence/command
TRADEOFF: <bundle size, maintenance, strict-mode notes>
DECISION: <adopt | evaluate | reject>
```

### 10.1 Decision rubric

- **adopt** — Bun-verified, mature, composes with stack, fills a real gap, no invariant violation.
- **evaluate** — promising but needs a spike (Bun compat or invariant impact unclear).
- **reject** — duplicates existing tool, violates an invariant, Node-only, or unmaintained.
