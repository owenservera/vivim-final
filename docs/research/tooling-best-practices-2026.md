# Tooling, Libraries & SDK Best-Practice Research — vivim-final (2026-07)

> Scope: which frameworks / libraries / SDKs to **ADD** to `vivim-final` to enable the product without reinventing the wheel, plus a design note on the project's unique "harness ↔ flaky AI-webapp chat" problem.
> Companion workstream (WS-1, DevOps tooling) is tracked separately — see §7.

## 1. What this project actually is

`vivim-final` ("cap-store v1 Knowledge Graph Rebuild") is a **local-first AI-agent orchestration platform**, not a conventional chat app:

- **37 engine files** (more than the 13 in the original design doc)
- A real **Bun-native CDP client** (`BunCdpClient`) with reconnect / ping / per-command timeout
- **Chrome slave fleet** management (launcher, profile allocator, port reaper, supervisor)
- **3 memory engines** — episodic / semantic / procedural
- **MCP client + server adapters** (currently stubs)
- A **workflow compiler + engine** and **harness protocol/runtime**
- A **capability** taxonomy → binding → program system with per-provider selector strategies
- **Prisma / SQLite** persistence (54-table schema)

## 2. Findings — reinvented wheels & gaps (mapped to files)

| # | Finding | Evidence | Best-practice alternative |
|---|---------|----------|---------------------------|
| 1 | **MCP adapters are stubs** — store a Map, return fake `{acknowledged:true}` | `src/engines/mcp-client-adapter.ts:74`, `mcp-server-adapter.ts` | **`@modelcontextprotocol/sdk`** — official TS SDK, runs on Bun, real `Client`/`Server` with Zod-validated tools |
| 2 | **Resilience primitives hand-rolled** — circuit breaker, async mutex, event bus, retry | `src/executor/circuit-breaker.ts`, `src/executor/async-mutex.ts`, `src/engines/capability-event-bus.ts` | **`cockatiel`** — one lib for retry + circuit-breaker + timeout + bulkhead + fallback (`opossum` is circuit-breaker-only) |
| 3 | **`effect` installed but never imported** | in `node_modules`; 0 real `import ... from 'effect'` (grep hits were domain term `mutationEffect`) | Either **adopt Effect** for typed errors/resilience, or **remove** the unused heavy dep |
| 4 | **State "machine" is only an audit logger** | `src/engines/state-transition.ts` writes `state_transition` rows only | Keep as-is unless real orchestration FSMs grow; then **`xstate`** (type-safe statecharts + visualizer) |
| 5 | **DB = Prisma client-js over SQLite + hand-rolled migrations** via `$executeRawUnsafe` | `src/storage/db.ts:23`, single `DATABASE_URL` connection | Keep Prisma for typed access; pin `connection_limit=1` (SQLite concurrency caveat); consider **`bun:sqlite`** native for hot read paths |
| 6 | **`alasql` used only as a test-mode query double** | `telemetry-store.ts` comment | Fine as a test fake; for real analytics use **DuckDB** (likely unnecessary) |
| 7 | **Memory engines store JSON, no semantic retrieval** | `semantic-memory-store-impl.ts` | 2026 agent-memory research: semantic memory should be written by a **background distillation step** + retrieved via **embeddings** (`@xenova/transformers` local ONNX, or a provider embedding) |
| 8 | **`fast-check` installed but unused** | in `node_modules` | Leverage for **property-based tests** on engines (stated quality goal) |
| 9 | **Zod v3.24** | `package.json` | v4 is out; low-risk upgrade, not urgent. Keep `z.infer` discipline (already followed) |

## 3. Recommended libraries / frameworks (curated)

| Library | Why | Tradeoff / status |
|---------|-----|-------------------|
| `@modelcontextprotocol/sdk` | Replaces stub MCP adapters (critical functional gap) | Runs on Bun — no blocker |
| `cockatiel` | Consolidates 4 hand-rolled resilience primitives | Adds one dep; removes ~3 custom files of risk |
| `chrome-remote-interface` | Thin, battle-tested CDP wrapper | **Optional** — `BunCdpClient` uses Bun-native WS and is fairly complete; `chrome-remote-interface` uses the `ws` pkg |
| `xstate` | Only if orchestration state machines exceed the audit logger | Don't add speculatively |
| `bun:sqlite` | Native DB for hot paths | Optional; keep Prisma for typed writes |
| `fast-check` | Property tests (already present) | Adopt, don't leave idle |
| `@xenova/transformers` | Local embeddings for semantic memory | Optional; only if semantic recall is a product goal |

## 4. Reference repos / architectures to study (patterns, not copy-paste)

- **LangGraph** — stateful graph + checkpoint/superstep model → informs `workflow-engine.ts`, `harness-protocol-engine.ts`
- **Mastra / VoltAgent** — TS-native agent frameworks → patterns for `agentic-loop.ts`, tool-use protocol
- **`@modelcontextprotocol/typescript-sdk` examples** — correct tool/resource/prompt shape for the adapters
- **Stately / XState docs** — if state machines graduate beyond logging
- **`browser-use`** — DOM observation + action grounding (closest open pattern to the Chrome Governor)
- **Healenium** — self-healing selector algorithm (anchor + similarity scoring)

## 5. Do NOT change

- **Biome** (lint/format) — correct, modern
- **tsup** build — fine for ESM + DTS
- **`ulid`** for IDs — sound
- The **capability-driven** taxonomy → binding → program design — matches 2026 agent-capability best practice
- **Playwright MCP** — already configured in `opencode.json`

## 6. Unique design: harness ↔ flaky AI-webapp chat (WS-2 design note)

**Problem:** the harness must *talk to, receive, and interpret instructions* **not from stable API calls, but from flaky AI-webapp chat responses** (ChatGPT / Claude / class web UIs over which we have no API contract).

This is the project's differentiator and maps onto subsystems that already exist:

| Concern | Existing file | Role |
|---------|--------------|------|
| Issue instructions into the webapp | `chrome-governor.ts` + `selectorStrategy` | Send text / click via CDP using per-provider selectors |
| **Observe** streaming, flaky chat output | `observation-tap.ts`, `stream-parser.ts`, `streaming-protocol.ts`, `content-blocks.ts` | Capture DOM mutations → assemble content blocks |
| **Interpret/ground** observed output | `semantic-grounding.ts`, `mirror-engine.ts` | Faithful conversation model decoupled from live DOM |
| **Survive DOM drift** | `selector-healer.ts` | Repair broken selectors when the webapp changes |
| **Measure & learn** | `capability-resolution.ts` (`createOutcome`, selector hit rate) | Drive healing + selection from real hit/miss data |

### Best-practice recommendations for the flaky-webapp layer

1. **Observation = MutationObserver + structural diffing, not polling.** Capture `childList`/`characterData` on the message container; maintain a per-message assembly buffer that accretes streamed tokens into `content-blocks.ts`. Guard against React double-render and layout-shift duplication.
2. **Self-healing selectors (make `selector-healer.ts` data-driven).** Store per strategy: (a) primary CSS selector, (b) stable *semantic anchor* (text / ARIA role / nearby label), (c) fallback XPath. On miss, heal from the anchor + persist the new selector; record hit-rate in `outcome` (`selectorHit`). This is exactly the `mutation_effects` + `selectorHit` machinery already present.
3. **Decouple observed state from live DOM via the Mirror (`mirror-engine.ts`).** Treat the webapp as an *untrusted, lossy channel*; the Mirror is the source of truth the engines reason over. Flaky UI ⇒ flaky agent only if you skip this.
4. **Interpret via structure, not raw text.** Extend `content-blocks.ts` to cover webapp failure modes: "model is thinking", "message blocked", "try again", "sign-in expired", "quota reached", "regenerate".
5. **Graceful degradation tiers:** Tier 1 selector hit (fast) → Tier 2 semantic-anchor match (healed) → Tier 3 vision/computer-use fallback (future, when DOM is opaque). The existing `priority` ranking in `capability-resolution` extends naturally to tiers.
6. **Idempotency & dedup.** Streaming webapps re-emit content; the assembly buffer must dedupe by block-id/sequence to avoid double-executing an instruction (`stream-block-store.ts`).

## 7. WS-1 (DevOps tooling) — pointer

The user develops with **opencode CLI, kilocode CLI, claude code** and wants **clean, enterprise-grade automated dev loops**. Current assets already in repo: `lefthook.yaml` (git hooks), `devops/` orchestrator (autonomous unit loop), `opencode.json` (agents/commands/MCP), `AGENTS.md` invariants + `bun run devops gate`. Detailed DevOps-loop plan is tracked under the devops workstream, not this research doc.

## 8. Open decisions

**WS-2 (add to product):**
- (a) Replace stub MCP adapters with `@modelcontextprotocol/sdk`?
- (b) Adopt `cockatiel` for resilience primitives?
- (c) `effect`: adopt or remove the unused dep?
- (d) Add embeddings to semantic memory?
- (e) Strengthen the flaky-webapp observation layer per §6 (healing tiers, block failure-modes)?

**WS-1 (dev loops):** define what "enterprise-grade" means here — CI gate, pre-commit hardening, the devops orchestrator loop, or cross-tool (opencode/kilocode/claude code) consistency.
