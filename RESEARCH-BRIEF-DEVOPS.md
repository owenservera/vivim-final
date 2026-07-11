# Research Brief — DEVOPS & Automation Tooling for vivim-final (OpenCode CLI)

> **Document intent:** This is a comprehensive context pack for a *research agent*. Its job is
> to identify the **DEVOPS, CI/CD, release, observability, and automation tooling** that should
> be adopted for this project — and specifically how that tooling plugs into the **OpenCode CLI**
> surface we already use (agents, commands, hooks, skills, the `devops` orchestrator, the quality
> gate, and MCP servers). The deliverable is a curated shortlist with adoption decisions, not a
> from-scratch pipeline. Reuse what exists; extend the autonomous loop; avoid rebuilding the wheel.

---

## 0. TL;DR for the research agent

- vivim-final is a **local-first AI conversation platform** built on a **knowledge-graph** of
  capabilities, providers, parsers, and harness modules stored as relational rows (Prisma/SQLite).
- It already has a **highly automated workflow**: an agentic DevOps orchestrator (`bun run devops`)
  drives 90+ atomic units to completion in a fully-autonomous loop, gated by `typecheck && lint &&
  test && invariants`.
- The automation surface is **OpenCode CLI** (6 agents, 7 commands, 5 skills, Lefthook hooks, a
  `devops` subcommand suite, and a baseline set of MCP servers — see §6).
- Your task: find tooling that **fits and extends that surface** — CI runners, parallelism
  orchestration, release/versioning, observability sinks, coverage gating, containerization,
  secret management, sandboxing, supply-chain audit — and recommend where each integrates
  (agent | command | hook | skill | `devops` subcommand | MCP server).

---

## 1. Project Identity & Objectives

**Epic:** CAP-001 — *cap-store v1 Knowledge Graph Rebuild*
**Runtime:** Bun · **Language:** TypeScript (strict, ESNext, ESM-only, `.js` import extensions)
**Description:** `cap-store v1 Knowledge Graph Rebuild — local-first AI conversation platform`

### 1.1 Goals (from `docs/goals/GOALS.md`)

| Goal | Status | Timeframe | What it covers |
|---|---|---|---|
| **G-001 Core Platform** | ACHIEVED 100% | Phase 1–6 | Prisma schema, 7 providers, ChromeGovernor, 13 engines, server, SDK, CLI, tests |
| **G-002 SOTA Features** | ACHIEVED 100% | Phase 7–10 | Mirror engine, agentic loops, workflow DAGs, semantic grounding, memory, MCP, harness protocol |
| **G-003 Executor + Polish** | IN PROGRESS 20% | Phase 11–12 | Build executor layer vs vivim-final core, fix stubs, complete platform |
| **G-004 Frontend Sandbox System** | IN PROGRESS 15% | Phase 13 | Frontend-native sandbox (Vite + React 19 + TS + Tailwind + Zustand) for testing backend capabilities |

### 1.2 Objectives / Key Results (active frontier)

- **O-011 Executor Porting (Phase 11)** — 39%: CDP client, Chrome launcher, profile allocator,
  port reaper DONE; fleet supervisor, slave read/write, conversation driver, stream/network
  capture PENDING.
- **O-012 Stub Resolution (Phase 12)** — 0%: ChromeGovernor boot stubs, MirrorEngine action stubs.
- **O-013 Monorepo Scaffold (Phase 13.1)** — 33%: `web/` workspace scaffolded (Vite + React 19 +
  TS + Tailwind + Zustand); shared tsconfig/aliases + `dev:sandbox` + typed api-client PENDING.
- **O-014 ActionRegistry + AgentBridge (Phase 13.2)** — 50%: ActionRegistry DONE, AgentBridge DONE.
- **O-015 Capability API Backend (Phase 13.3)** — 0%: `GET /capabilities`, `POST /execute`, WS agent channel.
- **O-016 Sandbox MVP + UI Registry (Phase 13.4)** — 0%: sandbox app, shared UI registry, first e2e feature.

> **Implication for tooling:** The live work is (a) the **executor** layer, (b) **stub
> resolution**, and (c) a **frontend monorepo** (`web/`). Automation tooling should support all
> three — especially cross-package builds/tests in the monorepo, and executor-level E2E/sandbox
> testing.

---

## 2. Full Tech Stack & Package

### 2.1 `package.json` (root)

```jsonc
{
  "name": "vivim-final",
  "version": "1.0.0",
  "type": "module",                 // ESM-only
  "main": "src/index.ts",
  "bin": { "vivim": "src/cli/index.ts" },
  "scripts": {
    "dev":        "bun run src/cli/index.ts serve",
    "serve":      "bun run src/cli/index.ts serve",
    "build":      "tsup src/index.ts --format esm --dts",
    "migrate":    "bun run src/cli/index.ts migrate --source all",
    "test":       "bun test",
    "test:unit":  "bun test tests/unit",
    "test:integration": "bun test tests/integration",
    "test:e2e":   "bun test tests/e2e",
    "typecheck":  "bunx tsc --noEmit",
    "seed":       "bun run src/cli/index.ts seed all",
    "lint":       "biome check src/ tests/ seeds/",
    "format":     "biome check --write src/ tests/ seeds/",
    "prisma:migrate:dev":  "bunx prisma migrate dev",
    "prisma:migrate:prod": "bunx prisma migrate deploy",
    "prisma:generate":     "bunx prisma generate",
    "prisma:studio":       "bunx prisma studio",
    "prisma:push":         "bunx prisma db push",
    "devops":     "bun run devops/index.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.5.0",
    "alasql": "^4.17.3",   // in-memory SQL for seeds/local queries
    "ulid": "^2.3.0",      // ID generation (src/ids.ts)
    "zod": "^3.24.2"       // runtime validation at boundaries (mandatory)
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/bun": "latest",
    "lefthook": "^1.11.3",  // git hooks
    "prisma": "^6.5.0",
    "tsup": "^8.4.0",       // build (ESM + DTS)
    "typescript": "^5.6.0"
  },
  "trustedDependencies": ["@biomejs/biome"]
}
```

### 2.2 Compiler / tooling config

- **tsconfig.json** — `target: ESNext`, `module: ESNext`, `moduleResolution: bundler`,
  `strict: true`, `noUncheckedIndexedAccess: true`, `allowImportingTsExtensions: true`,
  `noEmit: true`, `isolatedModules: true`, `@/*` → `./src/*` path alias.
- **biome.json** — single linter+formatter (no ESLint/Prettier). `noUnusedImports`/`noUnusedVariables`
  as warn, `noExplicitAny` **off** (allowed in engines by design), `noNonNullAssertion` warn,
  single quotes, 2-space indent, 100 col, semicolons as-needed.
- **lefthook.yml / lefthook.yaml** — pre-commit: lint + format + typecheck + invariants (category B,
  only on `src/engines/*.ts`); pre-push: `bun test`.
- **opencode.json** — OpenCode CLI config (see §5).
- **bunfig.toml** — present but minimal.

### 2.3 Frontend monorepo (`web/`)

`web/` is a workspace with packages: `api-client`, `app`, `sandbox`, `ui`, and a root `package.json`.
Per GOALS, stack is **Vite + React 19 + TypeScript + Tailwind + Zustand**. This is where the
frontend sandbox (G-004) lives. Tooling decisions must consider monorepo build/test orchestration.

### 2.4 Testing stack

- **Bun test** (built-in) for unit / integration / e2e (`tests/unit`, `tests/integration`,
  `tests/e2e`).
- Engines are unit-tested against **mocked store contracts** (no real DB); integration tests use
  `:memory:` SQLite; e2e uses real Chrome via Playwright/extension.
- Coverage command exists (`bun test --coverage` / `/coverage` command) but **no threshold gate**.

---

## 3. Architecture & Design Principles

### 3.1 The 9 architecture principles (from `02-merged-architecture.md`)

| # | Principle | Implication for tooling |
|---|---|---|
| P1 | **Knowledge Graph** — capabilities/providers/parsers/bindings/selectors are DB rows, not hardcoded TS | Tooling must not hardcode provider behavior; seed-driven |
| P2 | **Single I/O Authority (Governor Canon)** — only `ChromeGovernor` touches CDP | No tool may import `BunCdpClient` or bypass the Governor |
| P3 | **Seeds Not Code** — provider/parser/harness config are seed files | Tools should reload from seeds, not require restarts |
| P4 | **Engines Are Unit-Testable** — depend only on store contracts | Tooling must respect contract/impl split for mocking |
| P5 | **Batch-After-Capture Streaming** — buffer full response, emit `conversation:complete` | v1 has no block-level SSE; streaming tooling is future |
| P6 | **Relational First** — FKs + cascades, no JSON-in-TEXT for queryable data | Tooling works with relational model |
| P7 | **Re-Programmable** — lifecycle engines read config from `ConfigManager` | Tools can hot-reload config; changes audited |
| P8 | **Capability-Driven UI** — 21-field UI contract per capability | Frontend renders from contract, no conditional logic |
| P9 | **Agentic Harness** — server-side DAG orchestrator sends atomic CDP commands | Harness runs in Node/Bun, never injected into Chrome |

### 3.2 System layers

```
Seed Files (providers/*.json, parsers/*.ts, harness/*.ts)
        │  ProviderRegistrar / StreamParserEngine / HarnessRuntime
        ▼
SQLite DB (~54 tables, 9 views, WAL, foreign_keys=ON)   ← Prisma schema
        │
        ▼
13 Core Engines (L0–L4 + Chrome + cross-cutting + lifecycle)
        │
        ▼
Presentation: REST API (Bun.serve, 25+ endpoints) · WebSocket (typed events) · CLI · SDK · Frontend (Tauri webview / web/ monorepo)
```

### 3.3 The 13 core engines (constructor deps + files)

| Engine | Purpose | Depends on | File |
|---|---|---|---|
| `ChromeGovernor` | Single I/O authority for Chrome (4 subsystems: Lifecycle, CDPProxy, TraceLog, HealthMonitor) | `db`, `config`, `eventBus?` | `src/engines/chrome-governor.ts` |
| `ConversationManager` | 8-step send pipeline (resolve→lock→ensure→send→capture→parse→store→emit) | `governor`, `resolution`, `parser`, `blocks`, `eventBus`, `db` | `src/engines/conversation-manager.ts` |
| `StreamParserEngine` | Parse provider responses → `ContentBlock[]` | `ParserStore`, `ParserConfig?` | `src/engines/stream-parser.ts` |
| `CapabilityEngine` | Execute capabilities via CDP (through Governor) | `governor`, `CapabilityStore`, `eventBus?` | `src/engines/capability.ts` |
| `ProviderRegistrar` | Seed provider KG from JSON manifests | `ProviderStore`, `auditor?` | `src/engines/provider-registrar.ts` |
| `CapabilityResolutionEngine` | Resolve capability UI contracts (override chain + filtering) | `CapabilityResolutionStore` | `src/engines/capability-resolution.ts` |
| `CapabilityEventBus` | Typed in-process pub/sub (singleton) | — | `src/engines/capability-event-bus.ts` |
| `ProviderHealthKernel` | Weighted health score from 6 signals | `HealthStore`, `governor`, `eventBus` | `src/engines/provider-health.ts` |
| `StreamBlockStore` | Persist/retrieve `ContentBlock[]` | `db` | `src/engines/stream-block-store.ts` |
| `RegistrationAuditor` | Audit manifest changes, detect drift | `RegistrationStore`, `configManager`, `eventBus?` | `src/engines/registration-auditor.ts` |
| `VersionManager` | Version chains, promotion audit, program metrics | `VersionStore`, `configManager`, `eventBus?` | `src/engines/version-manager.ts` |
| `TelemetryAggregator` | Reprogrammable aggregation pipeline | `TelemetryStore`, `eventBus?`, `configManager` | `src/engines/telemetry-aggregator.ts` |
| `ConfigManager` | Unified re-programmability; authority for all engine configs | `ConfigStore`, `eventBus?` | `src/engines/config-manager.ts` |
| `ExecutionMemoizer` | TTL cache for expensive computations | — | `src/engines/execution-memoizer.ts` |

### 3.4 SOTA v2 engines (already scaffolded as files in `src/engines/`)

`mirror-engine`, `observation-tap`, `agentic-loop`, `tool-use-protocol`, `workflow-engine`,
`workflow-compiler`, `semantic-grounding`, `selector-healer`, `memory-engine`,
`transfer-accelerator`, `capability-shape-registry`, `provider-discovery`, `manifest-inference`,
`plugin-system`, `harness-protocol-engine`, `harness-runtime`, `harness-checkpoint`,
`mcp-server-adapter`, `mcp-client-adapter`, `session-checkpoint`, `state-transition`,
`streaming-protocol`, `capability-macro`.

### 3.5 Storage architecture (contract/impl split — INVARIANT)

- `src/storage/contracts/*.ts` — typed store interfaces (15 contracts).
- `src/storage/impl/*.ts` — concrete implementations (15 impls, bound to `bun:sqlite`/Prisma).
- **No engine imports `-impl`.** Engines depend only on contracts; tests mock contracts.

### 3.6 Module map (key dirs)

```
src/
  cli/ (index, command-registry, output-formatter, pipeline-engine, bridges/, commands/)
  engines/ (37 files — 13 core + SOTA + supporting)
  executor/ (12 files — cdp, circuit-breaker, async-mutex, fleet-*, content-blocks, ids, launcher, port-reaper, profile-allocator, slave-write, fleet-supervisor)
  router/ (router, index)
  automation/ (scheduler)
  alerting/ (alerter)
  server/ (5 files — index, response, websocket, conversation-router, auth-gate)
  storage/ (contracts/ ×15, impl/ ×15)
  schema/ (18 files — Zod schemas + types per domain)
  errors.ts, config.ts, index.ts
web/ (api-client, app, sandbox, ui, package.json)   ← frontend monorepo
sdk/ (typed TS client + tests)
tests/ (unit, integration, e2e, fixtures, helpers)
seeds/ (providers ×7, parsers ×5 dirs, harness)
docs/ (atomic, decisions, goals, merged-design-v2, roadmap, research, sandbox, superpowers)
devops/ (roadmap, truth, + 14 .ts modules: gate, invariants, select, mark, goals, decision, tracker, audit, ...)
```

### 3.7 Database schema (Prisma/SQLite, ~54 tables)

Layers L0–L13. Notable tables: `schema_meta`, `migration_log`, `config_entry`, `config_audit`,
`capability_taxonomy`, `capability_taxonomy_version`, `capability_binding`, `capability_program`,
`capability_macro`, `capability_tier`, `outcome`, `selector_strategy`, `selector_health_history`,
`provider_definition`, `provider_account`, `provider_config`, `provider_model`, `provider_endpoint`,
`provider_parser`, `provider_capability`, `provider_health`, `provider_health_history`,
`conversation`, `conversation_message`, `stream_block`, `vivim_session`, `profile_session`,
`provider_session`, `trace_entry`, `fleet_event`, `circuit_breaker_state`, `health_tick`,
`harness_checkpoint`, `session_checkpoint`, `state_transition`, `route_spec`, `route_request`,
`route_target`, `route_event`, `learning_event`, `rule`, `binding_event`, `binding_status_log`,
`transfer_pattern`, `transfer_candidate`, `transfer_attempt`, `registration_event`,
`manifest_change_log`, `manifest_drift`, `drift_event`, `failure_classification`,
`capability_telemetry`, `program_version_metric`, `telemetry_cycle_log`, `telemetry_summary_daily`,
`alert_condition`, `alert_event`, `automation_schedule`, `automation_run`, `test_run`,
`mcp_server_config`. Plus 9 views.

### 3.8 API surface (`07-merged-api.md`, 25+ REST endpoints + WebSocket)

REST on `Bun.serve` (port 9420): providers, accounts, fleet, conversations (send/capture),
admin (seed reload), config, health, version, telemetry, system. WebSocket bridge streams
`CapabilityEventBus` events to subscribed clients. Auth via `auth-gate` (Bearer token).
Typed SDK client in `sdk/`. (Full endpoint list lives in `07-merged-api.md`.)

### 3.9 Boot sequence

`openDb()` → `CapabilityEventBus` → `ConfigManager` (load persisted configs) → engines in
dependency order (StreamBlockStore → StreamParserEngine → CapabilityResolutionEngine →
CapabilityEngine → ProviderRegistrar → RegistrationAuditor → VersionManager →
TelemetryAggregator → ExecutionMemoizer → **ChromeGovernor.boot()** [reap ports, seed accounts,
start HealthMonitor, start TraceLog] → ProviderHealthKernel.start() → ConversationManager) →
TelemetryAggregator.start() → `Bun.serve` on 9420 → CLI/SDK connect.

---

## 4. The Autonomous DevOps Workflow (what already exists)

From `AGENTS.md` + `devops/`:

- **`bun run devops select`** → next unblocked atomic unit.
- **`bun run devops mark <id> in_progress|done|blocked`** → tracker state.
- **`bun run devops gate`** → full quality gate: `typecheck && lint && test && invariants`.
- **`bun run devops invariants check [--category B]`** → enforce architectural invariants.
- **`bun run devops goals list|dashboard|progress|align|report`** → OKR tracking.
- **`bun run devops decision create|review|decide|approve`** → ADR workflow (min 2 options, min 2 review rounds).
- **`bun run devops roadmap [--discover|--interview|--merge]`** → research-first gap discovery.
- **`bun run devops tracker|audit|gc|deps|fmt|report`** — supporting tooling.

The **Ralph Loop** (devops skill) runs this autonomously: read tracker → implement unit → gate →
mark done → discover gaps → repeat. Strict rules: never pause to ask, always report progress
(`✓ unit | done: N/95 | next: ...`), run gate before marking done.

---

## 5. The OpenCode CLI Surface (integration target)

From `opencode.json` and `AGENTS.md`:

| Surface | Value |
|---|---|
| **model** | `anthropic/claude-sonnet-4-20250514` (small: `claude-haiku-3-20250307`) |
| **default_agent** | `build` |
| **agents** | `build` (primary, full tools), `plan` (read-only), `test` (subagent), `review` (subagent, read-only), `db` (subagent), `debug` (subagent) |
| **commands** | `migrate`, `seed`, `check`, `coverage`, `review`, `ship`, `devops` |
| **skills** | paths → `.opencode/skill`: `devops`, `devops-roadmap`, `prisma-workflow`, `vivim-build`, `vivim-testing` |
| **references** | `docs` → `docs/merged-design-v2` |
| **hooks** | Lefthook pre-commit (lint/format/typecheck/invariants) + pre-push (`bun test`) |
| **permission** | `allow` |

**Integration slots for new tooling:**
1. New **`devops` subcommand** (`devops/<name>.ts`) — for pipeline-native automation.
2. New **OpenCode `command`** in `opencode.json` — wrap a tool behind a slash command.
3. New **Lefthook hook** — gate-time enforcement (e.g., coverage threshold, SCA).
4. New **skill** in `.opencode/skill` — reusable workflow (e.g., release, deploy).
5. New **MCP server** in `opencode.json` `mcp` block — external capability (container/secret/observability/issue-tracker).
6. New **agent** in `opencode.json` — dedicated role (e.g., `release`, `security`).

---

## 6. Baseline MCP Servers (the floor — do NOT duplicate; EXTEND)

This is the current MCP surface the research agent must treat as the **baseline**. Tooling that
duplicates these should be rejected; tooling that *adds new capability classes* is welcome.

| MCP server | Type | Provides | Used for |
|---|---|---|---|
| **playwright** | `local` (declared in `opencode.json`, `npx -y @playwright/mcp`, chromium) | Browser automation, DOM snapshots, screenshots, console/network capture | `tests/e2e`, UI validation |
| **open-claude-in-chrome** | extension-controlled Chrome | Tab mgmt, navigate, click, type, JS eval, console msgs, network requests, screenshots | Live frontend debugging / visual QA |
| **web-reader** (`webReader`) | HTTP fetch | Convert any URL → LLM-friendly markdown (GFM) | Research/doc ingestion |
| **web-search-prime** | web search | Real-time search + live crawl | Version/SOTA/library research |
| **zai-mcp-server** | multimodal | `analyze_image`, `analyze_video`, `understand_technical_diagram`, `diagnose_error_screenshot`, `ui_to_artifact`, `ui_diff_check`, `extract_text_from_screenshot` | Diagram/screenshot/UI understanding |
| **codex-status** | account status | List OpenAI accounts + usage | Cost/quota awareness |

> Note: only **playwright** is formally declared in `opencode.json` `mcp`. Others are provided by
> the runtime. New MCP servers should be added to `opencode.json` following the same
> `{ "type": "local", "command": [...], "enabled": true, "env": {...} }` shape.

---

## 7. Intent — What the Research Agent Must Produce

Identify and recommend **DEVOPS / automation tooling** that:

1. **Fits the OpenCode CLI model** — integrates via one of the slots in §5.
2. **Extends the autonomous loop** — helps the `devops` orchestrator go faster/safer (parallelism,
   sandboxing, auto-fix, drift detection, self-healing gates).
3. **Covers gaps** (§8) without reinventing what exists.
4. **Honors invariants** — no raw `new Error()`, Governor canon, contract/impl split, PowerShell-compatible, Bun runtime.
5. **Prefers composable tools over bespoke scripts** where maturity exists.

Deliverable: **shortlist** with `TOOL / PROBLEM / INTEGRATION / MATURITY / RISK / EVIDENCE` per item
(see §10).

---

## 8. Known Gaps in the Automation Pipeline (research agenda)

| # | Gap | Current state | Research direction |
|---|---|---|---|
| D1 | **CI/CD** | Local only (Lefthook + `devops gate`) | Runner that mirrors the gate on Windows/PowerShell + Bun (GitHub Actions? Bun-native? self-hosted?) and reports into the tracker |
| D2 | **Parallelism / orchestration** | `devops` loop strictly sequential | OpenCode subagents for fan-out (`cavecrew`, `dmux`, `subagent-driven-development`); can multiple atomic units run concurrently? |
| D3 | **Release / versioning** | `VersionManager` engine + no semantic-release/changeset wired | Bun-native or portable release tooling |
| D4 | **Observability** | `TelemetryAggregator` + `alerting/` exist, no sink/exporter configured | Telemetry sink (OTLP?), log shipping, dashboards |
| D5 | **Coverage gating** | `bun test --coverage` exists, no threshold in gate | Coverage threshold enforcement (Lefthook hook or `devops gate` step) |
| D6 | **Containerization / reproducible env** | Bun-only, no Dockerfile/devcontainer | Dockerfile, devcontainer, Bun base image |
| D7 | **Secret / env management** | `ConfigManager` pattern, no vault/secret-MCP | Secret store MCP (1Password/Vault/cloud secrets) |
| D8 | **Sandbox safety** | `src/sandbox`, `docs/sandbox`, executor work | Isolation model for executor (worker_threads / WASM / vm) |
| D9 | **Supply-chain / SCA audit** | none | `bun audit` / SCA wired into gate |
| D10 | **Architecture doc-from-code** | `zai-mcp-server` can read diagrams, no auto-doc | Diagram/architecture generation from source |
| D11 | **Cross-package monorepo CI** | `web/` monorepo untested in CI | Turborepo/Nx-like orchestration for `web/` + root |
| D12 | **Artifact / binary releases** | none | Build + sign + publish (GitHub Releases, npm) |
| D13 | **Scheduled automation** | `src/automation/scheduler.ts` custom | Cron/queue backing for `automation_schedule` table |

---

## 9. Constraints the Research Agent Must Honor

- **Shell:** all commands **PowerShell 7+ compatible** (no `head`/`tail`/`grep`/`cat`/`curl`).
- **Runtime:** Bun-only — tooling must run under Bun or be invoked via `npx`/`command`.
- **No custom error bypass:** tools must surface failures, not swallow them.
- **Single source of truth:** the atomic tracker (`docs/atomic/01-tracker.md`) is authoritative; any
  tool mutating progress must go through `bun run devops mark`.
- **Invariant categories** (A ground-truth, B architectural, C planning, D quality, E goal) enforced
  by `bun run devops invariants check` and are a hard gate.
- **Governor Canon & contract split** must not be violated by any automation that touches engines.
- **Seeds not code:** tools must support seed reloading, not restarts.

---

## 10. Research Questions & Expected Output

**Questions:**
1. Which CI runner best mirrors the local `devops gate` and runs on Windows/PowerShell + Bun (D1)?
2. Can OpenCode subagents safely parallelize atomic-unit implementation, and what tooling enables it (D2)?
3. What MCP servers should be added to `opencode.json` for container/secret/observability/issue-tracker gaps (D6/D7/D4)?
4. Is there a Bun-native or portable tool for semantic release, coverage thresholds, and SCA that avoids Node-only lock-in (D3/D5/D9)?
5. How should the `devops` orchestrator expose new automation — new subcommand vs skill vs command (§5)?
6. What monorepo orchestration fits `web/` + root for cross-package build/test (D11)?

**Output schema (per recommendation):**
```
TOOL: <name>
PROBLEM: <gap from §8>
INTEGRATION: <agent | command | hook | skill | devops subcommand | mcp server>
MATURITY: <adopt | evaluate | reject> + 1-line rationale
RISK: <Bun/PowerShell/invariant compatibility notes>
EVIDENCE: <link or command proving it works with Bun>
```
