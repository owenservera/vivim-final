# 🔬 Comprehensive Audit — vivim-final
**Lens:** SOTA DevOps × AI vibe-coding × solo owner-operator × unbounded best-design
**Verdict up front:** The architecture is genuinely impressive — the 9 invariants, Governor Canon, contract/impl split, atomic tracker, and Ralph Loop put this in the top 1% of solo projects. But you are running a **1990s operations posture on a 2026 architecture**: no CI, no observability sink, no evals, no memory substrate for the agent, no supply-chain gate, no replay, no cost guardrails. Every gap below is a *force multiplier* the agent cannot self-supply.

---

## 1. What Is Actually Missing — At the Highest Level

| Domain | State | Severity for a Solo AI Coder |
|---|---|---|
| **CI/CD** | Local Lefthook only. No GitHub Actions / Dagger / Earthly. | 🔴 Critical — agent changes can ship unverified |
| **Observability sink** | TelemetryAggregator writes rows; nothing exports OTel/log streams. | 🔴 Critical — you can't debug distributed CDP→engine→UI traces |
| **LLM eval harness** | None. No promptfoo, no Langfuse, no golden-set regression. | 🔴 Critical — agent prompt changes are un-measurable |
| **Agent memory substrate** | MemoryEngine is a stub. No mem0/letta MCP. | 🔴 Critical — agent re-learns context every session |
| **Subagent fan-out** | Ralph Loop is strictly sequential. | 🟠 High — 10× speedup left on the table |
| **Cost/quota enforcement** | codex-status MCP only. No per-task token budget. | 🟠 High — silent cost runaway |
| **Supply chain** | No `bun audit` in gate, no SBOM, no Snyk/Socket. | 🟠 High — single bad dep = pwned local-first app |
| **Coverage gate** | `bun test --coverage` exists; no threshold. | 🟠 High — engines regress silently |
| **Release/versioning** | VersionManager engine exists; no semantic-release/changesets. | 🟡 Med — manual versioning friction |
| **Containerization** | No Dockerfile/devcontainer. | 🟡 Med — reproducibility risk |
| **Secrets** | ConfigManager pattern only. No vault MCP. | 🟡 Med — secrets in env/config rows |
| **Monorepo orchestration** | `web/` workspace un-CI'd. No Turborepo. | 🟡 Med — cross-package drift |
| **Result/Either type** | Custom. No neverthrow. | 🟡 Med — error ergonomics debt |
| **Structured logging** | None declared. | 🟡 Med — pino would feed OTel directly |
| **Idempotency / rate limiting / health probes** | Hand-rolled `Bun.serve`; no `/healthz`, no idempotency keys, no limiter. | 🟡 Med — production-grade API gaps |
| **Event sourcing / outbox** | CapabilityEventBus is in-process fire-and-forget. No replay, no outbox. | 🟡 Med — reliability ceiling for v2 streaming |
| **Vector store for MemoryEngine / SemanticGrounding** | None. | 🟡 Med — SOTA engines starved |
| **Frontend component system** | Tailwind only. No shadcn/Radix/lucide. | 🟡 Med — 21-field contract needs primitives |
| **Schema→OpenAPI** | Zod manual; no `zod-to-openapi`. | 🟢 Low — automatable doc win |
| **SBOM / signing / SRI** | None. | 🟢 Low (until distribution) |

---

## 2. Top 10 Leverage Enhancements (Ranked)

### 🥇 #1 — Adopt OpenTelemetry GenAI semconv + OTLP exporter **today**
You already emit `capability:executed`, `selector_hit`, `dom_interaction`, `network_intercept`. Wire a single `OTelSink` engine that subscribes to `CapabilityEventBus` and exports spans via `@opentelemetry/exporter-trace-otlp-http`. Use **GenAI semantic conventions** so LLM calls in `HarnessProtocolEngine` show up as proper spans with `gen_ai.*` attributes. Run a local **Jaeger** or **Grafana Tempo** container. *This single change converts 6 hours of "why did this conversation fail" into 30 seconds of trace inspection.*

### 🥇 #2 — Stand up an LLM eval harness (Promptfoo + Langfuse)
Right now `HarnessProtocolEngine.PromptAugmenter` changes are un-measurable. Create `evals/` directory with: golden conversation traces → JSONL, promptfoo config asserting `ResponseExtractor` produces expected `actions[]`. Langfuse (self-hosted) captures every LLM call with cost/latency/score. **Without evals, every prompt edit is a vibe; with evals, it's a measurement.** This is the single biggest AI-vibe-coder unlock.

### 🥇 #3 — Wire CI that mirrors `devops gate` (GitHub Actions matrix: Windows/PowerShell + Ubuntu + macOS)
The `gate` command already exits non-zero. Add `.github/workflows/gate.yml`: `bun install --frozen-lockfile → bun run devops gate --strict → bun test --coverage → upload coverage`. Add **branch protection** requiring green gate. *This makes the Ralph Loop's local discipline enforceable on every push — and the agent's PRs become reviewable.*

### 🥇 #4 — Add Memory MCP (mem0 or letta) for cross-session agent context
Your MemoryEngine is scaffolded but unused. Worse: every OpenCode session re-learns the codebase. Wire `mem0-mcp` (or `@letta/letta-mcp`) into `opencode.json`. Memory entries: "ChromeGovernor's `boot()` must reap ports before seeding accounts", "Provider X's SSE has a 2KB heartbeat frame", "Atomic unit 11.5 depends on a working `slave-write.ts`." *This is the difference between an agent that gets smarter per session vs one that resets daily.*

### 🥇 #5 — Add **Context7 MCP** + **Serena MCP** to the agent's MCP block
- Context7 = always-current library docs (Bun, Prisma, Zod, Tauri) injected into agent context — kills hallucinated API usage.
- Serena = semantic code search via LSP. Your agent currently greps; Serena gives it symbol-level navigation across the 37 engine files. *Both are zero-cost wins that compound every session.*

### 🥇 #6 — Add **Sequential Thinking MCP** + **Magic MCP** + **Shadcn MCP**
- Sequential Thinking → forces the agent to decompose before `bun run devops mark <id> in_progress`. Pairs perfectly with the fidelity cross-check protocol.
- Magic MCP → generates UI primitives from the 21-field capability contract (instant `web/sandbox` components).
- Shadcn MCP → component-by-component adoption for the production Tauri shell.

### 🥇 #7 — Subagent fan-out for the Ralph Loop (OpenCode subagents / Claude Code style)
Strictly-sequential was correct for v1 (avoids invariant violations). But many atomic units are **independent within a phase** (e.g., 11.x executor porting). Add a `devops parallelize --phase <N> --max 4` subcommand that: (a) computes the dependency-closure of independent units, (b) spawns N OpenCode subagents each running its own Ralph Loop, (c) gates merge with invariant check. *Realistic 4–8× speedup on executor phase.*

### 🥇 #8 — Adopt Turborepo for `web/` + root orchestration
Right now `web/` packages and root have no shared build graph. Turborepo gives you: remote cache (free tier), topological build, `--filter` per-package tests. Pairs with CI to give you per-PR build times under 60s instead of "run everything."

### 🥇 #9 — Neverthrow + superjson + Zod-to-OpenAPI — the "ergonomics triple"
- **neverthrow** replaces custom `Result<T,E>` — proper `ResultAsync`, `andThen`, match ergonomics.
- **superjson** for server↔client serialization (Date, ULID, `Map`, `Set`, `Error` subclasses survive the WebSocket boundary).
- **`@asteasolutions/zod-to-openapi`** generates OpenAPI 3.1 from your existing Zod schemas → Swagger UI at `/docs`.

### 🥇 #10 — Add a **deterministic replay harness** for CDP traces
You already trace every CDP command to `trace_entry`. Add a `devops replay <conversationId>` that: pulls `trace_entry` rows → reconstructs the DAG → re-executes against a fresh Chrome slave → diffs `ContentBlock[]` output. *This is regression testing for the entire Chrome layer — and you have 80% of the data already.*

---

## 3. AI-Vibe-Coding Specific Enhancements

### 3.1 Agent capability multipliers

| Gap | Recommendation | Why it's high-leverage |
|---|---|---|
| No cost guardrails | Wrap every LLM call in `tokenBudget` middleware (max tokens per task, per session, per day). Hard-fail at 90%. | Prevents $500 surprise bills from a runaway Ralph Loop |
| No agent regression suite | `tests/agent/` directory with golden transcripts. Every `devops gate` runs 3 canonical agent tasks end-to-end. | Catches prompt regressions before merge |
| No agent eval dashboard | Langfuse or Helicone self-hosted. Per-task score, per-prompt version, per-model. | Converts vibes → metrics |
| No model routing | Portkey or LiteLLM gateway. Route `HarnessProtocolEngine` calls by capability tier. | Cost optimization + fallback resilience |
| No semantic cache | GPTCache or Portkey cache for capability resolution lookups. | 30–60% cache hit on `CapabilityResolutionEngine.resolve()` |
| No structured output enforcement | Instructor or `openai-zod` patterns. Force `ResponseExtractor` output through Zod with auto-retry. | Kills malformed-action bugs |
| No agent trace standard | OTel GenAI semconv on every LLM/tool call. | Cross-tool observability |
| No human-in-the-loop protocol | Approve-on-write via MCP webhook to Slack/Telegram. | Lets you run Ralph Loop unattended on `destructive` ops |
| No replay testing for agent runs | Langfuse snapshots → re-run against new prompts. | Deterministic agent CI |

### 3.2 Self-improvement loop you don't have

```
   ┌─ Ralph Loop ────────────────┐
   │  implement → gate → commit  │
   └─────────────┬───────────────┘
                 │
                 ▼
   ┌─ Eval Loop (MISSING) ───────┐
   │  run golden evals → score   │
   │  → if regress, revert       │
   └─────────────┬───────────────┘
                 │
                 ▼
   ┌─ Memory Loop (MISSING) ─────┐
   │  write learnings to mem0    │
   │  → next session starts      │
   │    smarter                  │
   └─────────────────────────────┘
```

Right now you have only the top third. The bottom two-thirds are the actual AI-vibe-coding unlock.

### 3.3 Concrete MCP shortlist to add to `opencode.json`

```jsonc
{
  "mcp": {
    // existing
    "playwright": { /* ... */ },

    // HIGH-VALUE ADDITIONS (zero cost, huge compounding returns)
    "context7":     { "type": "local", "command": ["npx", "-y", "@upstash/context7-mcp"], "enabled": true },
    "serena":       { "type": "local", "command": ["uvx", "--from", "git+https://github.com/oraios/serena", "serena-mcp-server"], "enabled": true },
    "sequential-thinking": { "type": "local", "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"], "enabled": true },
    "memory":       { "type": "local", "command": ["npx", "-y", "@modelcontextprotocol/server-memory"], "enabled": true },

    // MEDIUM-VALUE (operational)
    "github":       { "type": "local", "command": ["npx", "-y", "@modelcontextprotocol/server-github"], "enabled": true, "env": { "GITHUB_TOKEN": "${env:GH_TOKEN}" } },
    "filesystem":   { "type": "local", "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "C:\\0-BlackBoxProject-0\\vivim-final"], "enabled": true },
    "time":         { "type": "local", "command": ["npx", "-y", "@modelcontextprotocol/server-time"], "enabled": true },
    "fetch":        { "type": "local", "command": ["npx", "-y", "@modelcontextprotocol/server-fetch"], "enabled": true },

    // FRONTEND-SPECIFIC (high-leverage for G-004 sandbox)
    "shadcn":       { "type": "local", "command": ["npx", "-y", "shadcn-mcp"], "enabled": true },
    "magic":        { "type": "local", "command": ["npx", "-y", "@magicuidesign/magic-mcp"], "enabled": true },
    "figma":        { "type": "local", "command": ["npx", "-y", "@anthropic/figma-mcp"], "enabled": false },

    // OPS (when you wire them)
    "1password":    { "type": "local", "command": ["npx", "-y", "@1password/op-mcp"], "enabled": true, "env": { "OP_SERVICE_ACCOUNT_TOKEN": "${env:OP_TOKEN}" } },
    "sentry":       { "type": "local", "command": ["npx", "-y", "@sentry/mcp-server"], "enabled": true },
    "linear":       { "type": "local", "command": ["npx", "-y", "@linear/mcp-server"], "enabled": false }
  }
}
```

---

## 4. Architecture & Framework Gaps

### 4.1 Patterns you should adopt

| Pattern | Why | Implementation |
|---|---|---|
| **Outbox pattern** | CapabilityEventBus is fire-and-forget. Add `outbox_event` table; transactional outbox → background poller → emit. | 50 LOC engine; uses existing Prisma txns |
| **Idempotency keys** | `POST /api/conversations` is not idempotent. Add `Idempotency-Key` header → `idempotency_record` table. | Standard middleware |
| **Health probes** | `Bun.serve` has no `/healthz` `/readyz` `/livez`. | 30 LOC; required for any orchestration |
| **Graceful shutdown** | SIGTERM handler drains WebSocket, finishes in-flight CDP ops, closes slaves. | Critical for containerization |
| **Rate limiting** | None on REST. `@upstash/ratelimit` (no Redis needed with sliding window in SQLite). | Required before public |
| **Circuit breaker at HTTP layer** | You have it per-slave; not per-provider-API. | Borrow existing `circuit-breaker.ts` |
| **Saga pattern** | `WorkflowEngine` is scaffolded. Adopt `temporal-lite` pattern or roll saga with compensations. | Needed for transfer-accelerator |
| **Event sourcing for capability outcomes** | `outcome` table is append-only. Project to materialized views. | Already halfway there |
| **CQRS for capability resolution** | Reads (UI contract) ≠ writes (binding promotion). Split stores. | Natural fit for contract/impl |

### 4.2 Libraries you should adopt (not rebuild)

| Lib | Replaces | Bun-safe | Notes |
|---|---|---|---|
| `pino` | ad-hoc logs | ✅ | Structured JSON, child loggers, feeds OTel |
| `neverthrow` | custom Result | ✅ | `ResultAsync` is gold for engine chains |
| `superjson` | JSON.stringify | ✅ | Date/Error/Map survive WebSocket |
| `hono` | raw Bun.serve | ✅ | Type-safe routing, middleware, OpenAPI bridge |
| `@asteasolutions/zod-to-openapi` | manual docs | ✅ | Generates from existing Zod |
| `@upstash/ratelimit` | nothing | ✅ | Sliding window in SQLite |
| `tanstack/query` | manual fetch in `web/` | ✅ | Server state in sandbox + production |
| `tanstack/router` | nothing | ✅ | Type-safe routing for Tauri shell |
| `shadcn/ui` + `radix-ui` + `lucide-react` | raw Tailwind | ✅ | 21-field contract needs primitives |
| `react-hook-form` + `@hookform/resolvers/zod` | manual forms | ✅ | When `web/app` grows |
| `cmdk` | nothing | ✅ | Command palette for capability catalog |
| `sonner` | nothing | ✅ | Toasts for action registry feedback |
| `date-fns` | native Date | ✅ | Tree-shakeable |
| `react-markdown` + `remark-gfm` | nothing | ✅ | For ChatGPT/Claude response rendering |
| `msw` | manual fetch mocks | ✅ | Sandbox + test isolation |
| `@faker-js/faker` | manual fixtures | ✅ | Seed data generation |
| `fast-check` | nothing | ✅ | Property-based tests for selector healer |
| `@biomejs/biome` (already) | — | — | Stay |
| `vitest` (alt) | — | — | Stay on `bun test` (already correct) |

### 4.3 Specific architectural risks you haven't addressed

1. **`CapabilityEventBus` is in-process singleton** → cannot survive restart. Solution: outbox table + event replay on boot.
2. **No transaction boundary on the 8-step ConversationManager pipe** → if `[7] STORE` fails after `[5] CAPTURE`, you lose the response. Wrap 6–7 in Prisma txn.
3. **`ChromeGovernor.boot()` is not idempotent across restarts** → orphan ports accumulate. Add `boot_epoch` row.
4. **`ExecutionMemoizer` is in-process** → no cross-process cache. For Tauri sidecar + main process this matters. Consider `keyv` with SQLite adapter.
5. **MirrorEngine latency budgets have no enforcement hook** → "violations → degraded mode" is aspirational. Add a `LatencyBudgetExceeded` error class with auto-fallback.
6. **No backpressure on WebSocket** → slow client = OOM. Use `websocket.readyState` check + drop policy.
7. **MCP server adapter is a "design slot" but unwired** → wire `chrome_launch`/`chrome_send`/`chrome_capture` as MCP tools. This makes your Governor callable from any MCP client (Claude Desktop, Cursor, etc.) — massive ecosystem unlock.

---

## 5. DevOps & Supply-Chain Gaps

### 5.1 Concrete pipeline you should build

```
LOCAL (already)
  Lefthook pre-commit → biome + typecheck + invariants B
  Lefthook pre-push   → bun test
  `devops gate`       → full quality gate

ADD:
  `.github/workflows/gate.yml`        → mirrors devops gate on Windows + Ubuntu
  `.github/workflows/release.yml`     → on tag: build + SBOM + sign + GitHub Release
  `.github/workflows/renovate.yml`    → Renovate bot
  `.github/workflows/sca.yml`         → Snyk/Socket.dev on every PR
  `.github/workflows/coverage.yml`    → coverage threshold gate (80% engines)
  `Dockerfile`                        → oven/bun:1 base, multi-stage
  `devcontainer.json`                 → VS Code dev container
  `.github/ISSUE_TEMPLATE/`           → bug/feature/research
  `.github/PULL_REQUEST_TEMPLATE.md`  → checklist (invariants, tests, atomic ref)
  `CODEOWNERS`                        → you (single owner)
  `SECURITY.md`                       → disclosure policy
  `CHANGELOG.md`                      → auto-generated by changesets
  `renovate.json`                     → dep renewal strategy
  `.commitlintrc.json`                → enforce conventional commits
  `sbom.json` (generated)             → CycloneDX via `@cyclonedx/cyclonedx-cli`
```

### 5.2 Tools to wire into the gate (or reject)

| Tool | Adopt? | Why |
|---|---|---|
| `@biomejs/biome` (existing) | ✅ keep | Already chosen |
| `bun audit` | ✅ wire into gate | Built-in, free |
| **Socket.dev** | ✅ adopt | Best JS supply-chain scanner; catches typosquats, install-scripts |
| **Snyk** | 🟡 alt | Socket is enough for solo |
| **`@cyclonedx/cyclonedx-cli`** | ✅ adopt | SBOM generation for release |
| **Sigstore / cosign** | 🟡 later | Sign artifacts when you distribute |
| **changesets** | ✅ adopt | Multi-package versioning for `web/` monorepo |
| **semantic-release** | 🟡 alt | changesets is more manual-control friendly |
| **commitlint** | ✅ adopt | Enforce `feat:`/`fix:` etc. |
| **Renovate** | ✅ adopt | Beats Dependabot for Bun |
| **Turborepo** | ✅ adopt | `web/` + root build graph |
| **Moonrepo** | 🟡 alt | More opinionated; Turborepo is enough |
| **Dagger** | 🟡 alt | If you want pipeline-as-code in TS |
| **Earthly** | 🟡 alt | Same |
| **k6** | 🟡 later | Load testing for v2 streaming |
| **Playwright component testing** | ✅ adopt | For `web/sandbox` 21-field UI |

### 5.3 Coverage threshold (concrete)

Add to `devops/gate.ts`:
```ts
const COVERAGE_THRESHOLD = {
  'src/engines/**': 0.80,
  'src/storage/impl/**': 0.70,
  'src/router/**': 0.85,
  'src/cli/**': 0.60,
};
// run `bun test --coverage --coverage-reporter=json` → parse → gate
```

---

## 6. Frontend / Sandbox Specific Gaps (G-004)

You're at 15% on G-004. Top leverage to get to MVP:

1. **Adopt TanStack Query + Router** — server state + type-safe routes. Removes 80% of `web/api-client` boilerplate.
2. **shadcn/ui registry** — install `button`, `dialog`, `command` (cmdk), `toast` (sonner), `form` (react-hook-form). Renders directly from 21-field UI contract.
3. **Storybook or Histoire** — one story per capability UI contract; visual regression with Playwright.
4. **TanStack Virtual** — for capability catalog (could be 100s of rows).
5. **TanStack Table** — for binding/outcome inspection.
6. **react-markdown + remark-gfm + rehype-highlight** — for chat message rendering.
7. **state-machine via XState** — `CapabilityHarness` needs state machines (idle→loading→executing→success/error). XState gives you testable, inspectable state.
8. **Streaming UI patterns** — even though v1 is batch-after-capture, prepare `useChat`-style hooks for v2.
9. **Error boundary + Suspense strategy** — per-capability boundaries so one broken contract doesn't crash the catalog.
10. **i18n** — i18next from day 1; 21-field contract already has `label`/`description` — extend to `labelKey`/`descriptionKey`.

---

## 7. Security Posture (Currently ~D)

| Control | Status | Action |
|---|---|---|
| Authn | Bearer token only | Add **Lucia** or roll session-based for Tauri |
| Authz | None (single user assumed) | Add capability-tier RBAC from `capability_tier` table |
| Rate limiting | None | `@upstash/ratelimit` |
| CORS | Unknown | Lock to Tauri origin |
| CSP | None | Strict CSP in Tauri webview |
| Secrets in code | Possible | `gitleaks` pre-commit |
| Dep audit | None | Socket.dev in CI |
| SBOM | None | CycloneDX on release |
| PII detection | None | Add `pii-detector` to TelemetryAggregator |
| Audit log | Partial | Promote `config_audit` → generic `audit_log` |
| Container scanning | N/A (no containers yet) | Trivy when Dockerfile lands |

---

## 8. Database / Storage Leverage You're Leaving

1. **SQLite FTS5** — you have 54 tables but no full-text search. Add FTS5 virtual table over `conversation_message` + `stream_block`. Provider-level search becomes instant.
2. **`sqlite-vec`** — vector search for MemoryEngine + SemanticGrounding + SelectorHealer. Local-first, no external deps.
3. **WAL + `busy_timeout`** — verify in `openDb()`. SQLite under concurrent CDP writes can deadlock.
4. **Prepared statement cache** — Prisma does this, but raw `bun:sqlite` calls in `executor/` may not.
5. **Migration testing** — `prisma migrate diff` against production snapshot in CI.
6. **Schema diff in gate** — add `devops invariants check --category F` (new): "schema.prisma in sync with `prisma/schema.prisma` snapshot."

---

## 9. Concrete Adoption Roadmap (Sequenced for Solo Coder)

### Week 1 — Foundation (forces the rest to be measurable)
1. Wire pino → structured logs to stdout.
2. Wire `@opentelemetry/sdk-node` with OTLP HTTP exporter → Jaeger container.
3. Add Context7 + Serena + Sequential-Thinking + Memory MCPs to `opencode.json`.
4. Add `.github/workflows/gate.yml` mirroring `devops gate`.

### Week 2 — Reliability floor
5. Add `/healthz` `/readyz` to Bun.serve.
6. Add graceful shutdown handler.
7. Add idempotency-key middleware on mutations.
8. Add `@upstash/ratelimit` sliding window.
9. Add outbox table + background poller for CapabilityEventBus.

### Week 3 — Quality gate hardening
10. Wire coverage threshold into `devops gate`.
11. Wire Socket.dev + `bun audit` into gate.
12. Add commitlint + Renovate config.
13. Add changesets for `web/` monorepo.
14. Add Turborepo.

### Week 4 — Eval + Agent intelligence
15. Set up Promptfoo with golden evals for HarnessProtocolEngine.
16. Deploy Langfuse self-hosted.
17. Wire mem0 as Memory MCP — seed with project learnings.
18. Add token-budget middleware on all LLM calls.
19. Build `devops replay <conversationId>` from `trace_entry`.

### Week 5 — Frontend MVP unlock
20. Install shadcn/ui + Radix + lucide in `web/`.
21. Adopt TanStack Query + Router.
22. Add Playwright component tests for capability contracts.
23. Add XState for CapabilityHarness state machine.

### Week 6 — Release + supply chain
24. Add Dockerfile + devcontainer.
25. Add CycloneDX SBOM on release.
26. Wire `release.yml` workflow (build + sign + publish).
27. Add gitleaks pre-commit.
28. Add branch protection on `main`.

### Week 7 — Subagent fan-out
29. Implement `devops parallelize` (independent-unit closure + subagent spawn).
30. Add agent regression suite (`tests/agent/`).

---

## 10. The "Best Design"north Star — What You're Aiming At

```
                         ┌──────────────────────────────────┐
                         │   OpenCode Agent + MCP surface    │
                         │   (memory • context7 • serena •   │
                         │    sequential-thinking • github)  │
                         └──────────────┬───────────────────┘
                                        │
                  ┌─────────────────────┴──────────────────────┐
                  │                                            │
                  ▼                                            ▼
        ┌──────────────────┐                     ┌──────────────────────┐
        │  Ralph Loop (solo)│                     │  Parallelized Ralph  │
        │  + eval gate      │                     │  Loop (subagents)    │
        │  + replay test    │                     │  + invariant merge   │
        └────────┬─────────┘                     └──────────┬───────────┘
                 │                                          │
                 └───────────────┬──────────────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────────┐
              │  devops orchestrator (existing)            │
              │  + gate (existing) + coverage (NEW)        │
              │  + SCA (NEW) + replay (NEW) + eval (NEW)   │
              └──────────────────┬───────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────┐
        │  vivim-final engines (existing 13 + SOTA)         │
        │  + OTel sink (NEW) + outbox (NEW)                 │
        │  + idempotency (NEW) + rate-limit (NEW)           │
        └──────────────────┬───────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
        ChromeGovernor  SQLite+FTS5   Bun.serve
        (existing)      +sqlite-vec   (existing + health probes)
                           │
                           ▼
        ┌──────────────────────────────────────────────────┐
        │  Langfuse (evals) + Jaeger (traces) +             │
        │  Grafana (dashboards) + Sentry (errors)           │
        └──────────────────────────────────────────────────┘
```

**The thesis:** your engine architecture is already world-class. The gap is the **observability + eval + memory + supply-chain ring** around it. Close that ring and the Ralph Loop becomes self-improving instead of self-repeating.

---

  ## 11. Final Brutal Prioritization

If you only do **five** things this month:

1. **OTel + pino + Jaeger** (you cannot debug what you cannot trace)
2. **Promptfoo + Langfuse evals** (you cannot ship what you cannot measure)
3. **GitHub Actions mirroring `devops gate` + branch protection** (you cannot trust unverified pushes)
4. **Context7 + Serena + Memory MCPs in `opencode.json`** (you cannot scale agent intelligence without persistent context)
5. **Coverage threshold + Socket.dev in gate** (you cannot regress silently)

Everything else compounds on top of these five. Without them, the rest is polish on a foundation that can't be verified. With them, your solo AI-vibe velocity becomes bounded only by your eval coverage — which is exactly the SOTA posture.