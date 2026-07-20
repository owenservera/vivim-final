# DevOps Upgrade Implementation Plan

**Source:** devops-upgrade.md audit  
**Current State:** 128/138 units complete (87%), no CI/MCPs/eval harness  
**Target:** Measurable, observable, scalable AI-vibe-coding platform

---

## Phase 1: Observability Foundation (Week 1)

### 1.1 OTel Instrumentation Engine
**What:** Create `src/engines/otel-sink.ts` subscribing to CapabilityEventBus  
**How:** 
- Add `@opentelemetry/api` + `@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http`
- Create `OtelSink` class that listens to `trace_entry` events
- Configure GenAI semantic conventions (`gen_ai.*.prompt`, `gen_ai.*.completion`)
- Export to Jaeger container (docker-compose.yml)

**Interfaces:**
```ts
interface OtelSpanInput {
  engine: string
  method: string
  durationMs: number
  ok: boolean
  attributes?: Record<string, unknown>
}

interface GenAIMetrics {
  model?: string
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
}
```

### 1.2 Structured Logging with pino
**What:** Replace ad-hoc console.log with pino  
**How:**
- Add `pino` + `pino-pretty` deps
- Create `src/lib/logger.ts` singleton with child loggers per engine
- Wire into TelemetryAggregator, ChromeGovernor, HarnessProtocolEngine
- Configure JSON output for log aggregation

### 1.3 MCP Integration
**What:** Add Context7, Serena, Sequential-Thinking, Memory MCPs  
**How:**
- Update `opencode.json` with 4 MCP entries (copied from audit)
- Context7: library docs injection
- Serena: semantic code search via LSP
- Sequential-Thinking: decomposition before in_progress
- Memory: cross-session persistence

---

## Phase 2: Reliability Infrastructure (Week 2)

### 2.1 Health Probes
**What:** Add `/healthz`, `/readyz`, `/livez` endpoints  
**How:**
- Extend Bun.serve in `src/server/index.ts`
- Check database connectivity for `/readyz`
- Check Chrome slaves alive for `/healthz`
- Return 200/503 with JSON status

### 2.2 Graceful Shutdown
**What:** SIGTERM handler for clean CDP termination  
**How:**
- Hook into `process.on('SIGTERM')` in server
- Drain WebSocket connections
- Finish in-flight CDP operations (30s timeout)
- Close Chrome slaves via FleetSupervisor

### 2.3 Idempotency Keys
**What:** Make POST mutations idempotent  
**How:**
- Add `idempotency_record` table (Prisma schema)
- Middleware in `src/server/middleware/idempotency.ts`
- Cache key → response for exact replay

### 2.4 Rate Limiting
**What:** Request-level rate limiting  
**How:**
- Add `@upstash/ratelimit` or SQLite sliding window
- Middleware in `src/server/middleware/ratelimit.ts`
- Per-IP + per-provider-API limits

---

## Phase 3: Quality Gate Hardening (Week 3)

### 3.1 Coverage Threshold in Gate
**What:** Fail builds below 80% engine coverage  
**How:**
- Modify `devops/gate.ts` to run `bun test --coverage --coverage-reporter=json`
- Parse coverage output
- Check thresholds per path:
  - `src/engines/**`: 80%
  - `src/storage/impl/**`: 70%
  - `src/router/**`: 85%
  - `src/cli/**`: 60%

### 3.2 Supply Chain Security
**What:** Add `bun audit` + Socket.dev to gate  
**How:**
- Add `bun audit` to gate script
- Integrate Socket.dev GitHub Action
- Fail on high-severity vulnerabilities

### 3.3 Commitlint + Renovate
**What:** Enforce conventional commits, auto-update deps  
**How:**
- `.commitlintrc.json` for `feat:` `fix:` etc.
- `renovate.json` for Bun ecosystem
- Update Lefthook pre-commit

### 3.4 Turborepo Adoption
**What:** Build graph for web/ + root  
**How:**
- `turbo.json` with pipelines
- Remote cache config
- Replace manual scripts with turbo tasks

---

## Phase 4: Eval + Agent Intelligence (Week 4)

### 4.1 Promptfoo Eval Harness
**What:** Golden-set regression for HarnessProtocolEngine  
**How:**
- Create `evals/` directory
- Convert trace_entry rows to JSONL fixtures
- Write promptfoo configs for:
  - ResponseExtractor output validation
  - ActionRouter classification
  - PromptAugmenter transformations

### 4.2 Langfuse Self-Hosted
**What:** LLM call observability + scoring  
**How:**
- docker-compose.yml service definition
- Wire OTel traces to Langfuse
- Track cost/latency/score per prompt version

### 4.3 Memory MCP Seeding
**What:** Persist project learnings  
**How:**
- Seed mem0 with:
  - "ChromeGovernor boot() reaps ports before seeding accounts"
  - "Provider X SSE has 2KB heartbeat frame"
  - Atomic unit dependencies

### 4.4 Token Budget Middleware
**What:** Prevent runaway costs  
**How:**
- Middleware wrapping all LLM calls
- Per-task, per-session, per-day budgets
- Hard-fail at 90% threshold

---

## Phase 5: Frontend MVP (Week 5)

### 5.1 TanStack Query + Router
**What:** Server state + type-safe routes  
**How:**
- Install `@tanstack/react-query` + `@tanstack/router`
- Create `web/api-client` with query hooks
- Type-safe capability execution endpoints

### 5.2 shadcn/ui Registry
**What:** Component primitives for 21-field contract  
**How:**
- Install `shadcn` CLI in web/
- Add button, dialog, command, toast, form
- Render capabilities from CapabilityTaxonomy

### 5.3 Playwright Component Tests
**What:** Visual regression for capability UI  
**How:**
- `tests/browser/` with component tests
- One story per capability UI contract
- Assert 21 fields render correctly

### 5.4 XState for Harness
**What:** State machine for CapabilityHarness  
**How:**
- `src/engines/capability-harness-state.ts`
- States: idle → loading → executing → success/error
- Testable, inspectable transitions

---

## Phase 6: Release + Supply Chain (Week 6)

### 6.1 Containerization
**What:** Reproducible builds  
**How:**
- Multi-stage Dockerfile (oven/bun:1 base)
- devcontainer.json for VS Code
- Health probe integration

### 6.2 SBOM + Release Workflow
**What:** Signed releases  
**How:**
- CycloneDX via `@cyclonedx/cyclonedx-cli`
- `.github/workflows/release.yml`
- Build + sign + GitHub Release

### 6.3 Branch Protection
**What:** Prevent unverified merges  
**How:**
- Branch protection requiring green gate
- CODEOWNERS file
- Pull request template with checklist

---

## Phase 7: Subagent Fan-Out (Week 7)

### 7.1 Parallelize Command
**What:** Concurrent unit execution  
**How:**
- `devops/parallelize.ts` subcommand
- Compute dependency-closure of independent units
- Spawn N OpenCode subagents
- Merge only when all pass

### 7.2 Agent Regression Suite
**What:** Prevent prompt regressions  
**How:**
- `tests/agent/` with golden transcripts
- 3 canonical agent tasks end-to-end
- Run in every gate

---

## Implementation Order Rationale

The audit's top-5 priority ordering is correct but Phase 1-3 must interleave because:

1. **OTel + pino** (cannot debug without traces)
2. **GitHub Actions gate** (cannot trust unverified pushes)
3. **MCPs** (cannot scale agent intelligence without context)
4. **Coverage threshold** (cannot prevent regression)
5. **Socket.dev audit** (cannot ship vulnerable code)

Each phase is gated: PRs must pass the full `bun run devops gate` before merge.

---

## Open Questions

1. **Do you want self-hosted Langfuse or Helicone SaaS?** (Cost: ~$10/mo self-hosted vs $20+/mo SaaS)
2. **Should Memory MCP be mem0 or Letta?** (mem0 has web UI, Letta has better persistence)
3. **Which CI runner for GitHub Actions?** (ubuntu-latest-4core vs windows-latest)
4. **When to add k6 load testing?** (Post-SOTA or now for latency budgets?)
5. **Should we checkpoint the web/ monorepo separately?** (affects Turborepo setup)