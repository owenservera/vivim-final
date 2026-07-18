# SOTA Browser Automation — Full Agentic System Design

> Realizing `SOTA-03` (Agentic Observation-Action Loop), `SOTA-04` (Visual Workflow), `SOTA-05` (Semantic Browser Automation), `SOTA-09` (Harness Protocol Engine) on top of the existing harness recipe→DAG→CDP executor, `AutonomousExecutionEngine`, NLCL parser, and `HarnessProtocolEngine`.
>
> Foundation from prior plan: a **provider-free generic browser slave** (the system must automate the web without being bound to any chat provider).

---

## 0. Existing assets we build ON (do not reinvent)
- `ChromeGovernor` + `CDPProxy` + `CdpTransportImpl` — single I/O authority (Governor Canon). `runHarnessPlan(slaveId, dag)` walks a `HarnessDAG` via CDP.
- `HarnessExecutorEngine` — program→recipe→`compileRecipe`→`runHarnessPlan`→capture/reconstruct→stream blocks. (`src/engines/harness/`)
- `recipe-compiler.ts` — `Recipe` → `HarnessDAG` (supports `type_text`, `submit`, `click`, `wait`, `navigate`, `capture`, `evaluate`, + linear/branch).
- `program-store.ts` contract — versioned `Recipe` storage (`RecipeStep` union).
- `AutonomousExecutionEngine` (`src/engines/autonomous-execution.ts`) — HITL gates, classification, planning hooks, failover router.
- `HarnessProtocolEngine` — LLM↔harness bridge (`agentic_goal`, `observation_request`, `capability_action`, `workflow_call` actions already typed).
- `BrowserExecutor` + `UIAutomator` — interaction semantics (selector/text/aria resolution, char typing, mouse events). `UIAutomator` currently **violates the Canon** (imports `BunCdpClient`); we deprecate it in favor of governor-mediated grounding.
- NLCL: `catalog.ts` (deterministic regex intents), `NLCLEngine.interpret`, composite detection ("go to X and summarize").

---

## 1. The full automation taxonomy (capability identity)

A 4-axis taxonomy. Every automation verb is one leaf; recipes + agents compose leaves.

### Axis A — Surfaces (where it runs)
`generic-browser` (provider-free) · `provider-slave` (bound session) · `headless` · `headed` · `remote-cdp`

### Axis B — Action primitives (the verb leaves)
`navigate` · `search` · `click` · `type`/`fill` · `clear` · `press` · `scroll` · `hover` · `select` · `wait`(fixed|selector|network) · `extract`(text|html|markdown|json) · `screenshot` · `pdf` · `tab.open`/`tab.close`/`tab.switch` · `dom.query` · `observe`(a11y tree|network|console) · `upload` · `download` · `auth.login` · `form.submit`

### Axis C — Grounding modes (SOTA-05)
`css`(legacy) · `xpath`(legacy) · `aria`(role+name) · `text` · `visual`(screenshot region) · `composite`(primary+fallbacks) · `semantic-heal`(LLM repair)

### Axis D — Execution modes (SOTA-03)
`dag`(fixed recipe) · `agentic`(observe-loop) · `hybrid`(dag→agentic fallback) · `workflow`(n8n-style multi-capability)

### Composite "recipe" classes (the reusable building blocks)
`research.report` · `research.crawl` · `monitor.watch` · `form.autofill` · `commerce.checkout` · `data.scrape` · `auth.session` · `content.summarize` · `test.ui` · `extract.structured`

---

## 2. Ten user scenarios (the spec the design must satisfy)

1. **Deep research report** — *"Research a 10-page report on the economic AI crisis. Use ≥15 sources, summarize each, cross-reference, and emit a markdown report + citations."* → spins a generic browser, fans out N parallel crawl recipes, extracts + summarizes via provider LLMs, synthesizes, writes a structured report (file + canvas). (Primary motivating scenario.)
2. **Price/watch monitor** — *"Watch the RTX 5090 price on 3 retailers; alert me if any drops below $1,500."* → `monitor.watch` recipe: poll tabs, extract price, compare, fire notification.
3. **Form autofill** — *"Fill the contact form with my saved profile and submit."* → `form.autofill` recipe: ground fields semantically (aria), fill, submit, observe success/errors.
4. **Authenticated scrape** — *"Log into my analytics dashboard and pull the April metrics table."* → `auth.session` + `extract.structured` (semantic grounding + selector healing across the SPA).
5. **Competitor intelligence** — *"Track these 5 competitor pages weekly; diff the changes."* → scheduled `workflow` with `dom.query` + diff.
6. **UI smoke test** — *"Run a smoke test of our staging app: click through onboarding, assert no console errors."* → `test.ui` recipe + console observation.
7. **Checkout automation** — *"Buy the cheapest available ticket for the 8pm show."* → `commerce.checkout` (destructive-gated, HITL confirmation).
8. **Content ingestion** — *"Read this long article and make me a TL;DR + 5 bullet takeaways."* → `content.summarize` (navigate→extract→provider LLM→structured output).
9. **Cross-site data join** — *"Pull open job posts from 3 boards, dedupe, rank by my skills."* → `data.scrape` ×3 → transform → rank (workflow with data nodes).
10. **Self-healing recovery** — *"A provider site redesigned — the old 'send' button selector broke; figure it out and keep working."* → agentic loop + `SelectorHealer` + persist new semantic selector.

All 10 are expressible as: **NL command → NLCL intent → recipe/program (or agentic goal) → generic (or provider) browser slave → CDP via Governor → observe/capture → synthesize/route**.

---

## 3. Design stance (per user direction)
- **Build the backbone + configurability, not the agent brains.** The deliverable is an objective-agnostic, future-proof surface that can *drive the automated Chrome browser* for ANY task. We deliberately do NOT hardcode research/monitor/test logic into engines — we build the configurable substrate (generic slave, grounding, observation, agentic loop, recipe vocabulary, orchestrator contract, agent-role config schema) that higher-level AGENTS plug into. New scenarios (yours or future) are added as **recipes + agent-role configs**, not engine code.
- **Agents = config roles.** Each automation agent (`researcher`/`extractor`/`synthesizer`/`monitor`/`tester`) is a typed *configuration object* — recipe template + LLM provider binding + HITL policy + budget — composed by `AutomationOrchestrator`. No recursive autonomous sub-agents. This keeps the system deterministic, testable, Canon-safe, and extensible.
- **Research trust = bounded fan-out + LLM rank** (for scenario 1 when it is eventually wired): orchestrator fans out a fixed `pages=N` parallel crawls, each summarized by a provider LLM, then `CrossConversationSynthesizer` ranks/cross-references. The fan-out count and ranking policy are *config*, not baked logic.

## 4. SOTA implementation (layered, in dependency order)

### Layer 1 — Provider-free generic browser (foundation)
- `ChromeGovernor.ensureGenericBrowser(opts?)` → `this.spawn('generic','default',{visible?,mode:'headless-new'})` (same shape as the existing `getSlave` helper at `chrome-governor.ts:693`), memoize `slaveId` on governor. Reused per CLI session / server lifetime; cleaned by `killAll()`.
- `newId` typed `slave:generic:...` (ULID). Never navigates to a provider URL.
- CLI/NL verbs route here by default; `providerId` in ctx still allows targeting a bound session.

### Layer 2 — SemanticGroundingEngine (SOTA-05) — `src/engines/semantic-grounding.ts`
- `resolve(slaveId, selector: SemanticSelector)` → `ResolvedElement` via `Accessibility.getFullAXTree` (role/name) → `DOM.resolveNode` → boundingBox; falls back css/xpath; then `SelectorHealer`.
- `getAccessibilityTree(slaveId)`, `resolveByVisual(slaveId, region, description)` (coordinate grounding from screenshot).
- All reads via `governor.cdp.send` / `governor.evaluate` (Canon intact). No `BunCdpClient` import.
- `SelectorHealer` (`src/engines/selector-healer.ts`): DOM+AX+screenshot → propose alt selector (rule-based first, LLM fallback), validate, persist to `selector_strategy` store with `selector_format` + `semantic_data` + `heal_count`. Emits `capability:selector_healed` / `:selector_broken`.

### Layer 3 — AgenticLoopEngine (SOTA-03) — `src/engines/agentic-loop.ts`
- `executeAgenticLoop(slaveId, goal: AgenticGoal): Promise<AgenticLoopResult>`.
- Six layers: **Sense** (DOM summary + a11y tree + screenshot + network/console via `ObservationTap`) → **Plan** (plan cache → rule-based → LLM via `HarnessProtocolEngine`/`providerLLM`) → **Act** (capability / primitive CDP / sub-DAG) → **Observe** (DOM diff, network, modals) → **Reflect** (goal achieved? error classification) → **Adapt** (continue/replan/escalate/abort; writes `LearningRecord` to MemoryEngine).
- Safety budget: maxIterations 20, maxDurationMs 120s, maxCdpCmds/iter 10, maxLlmCalls/loop 5, destructive ops require confirmation, `delete_*` forbidden in auto-mode.
- Persists `AgentLoopRun` + `AgentStep` (audit/replay). `cancelAgenticLoop(runId)`.
- Exposes `ToolUseProtocol` (listTools/executeTool) — MCP-compatible (SOTA-07).

### Layer 4 — GenericBrowserExecutor + recipe vocabulary
- `src/engines/nlcl/executors/generic-browser-executor.ts` (`id:'generic-browser'`): implements all Axis B primitives via Layer 2 grounding + `governor.cdp`. Reuses `UIAutomator` semantics but Governor-mediated.
- Extend `RecipeStep` union + `recipe-compiler` with: `scroll`, `hover`, `select`, `press`, `tab_open`, `tab_close`, `observe`, `upload`, `extract_markdown`. Recompile DAG → governor executes.

### Layer 5 — Automation taxonomy + recipe library + custom AGENTS
- `src/engines/automation/recipes.ts`: declarative `Recipe` definitions for the composite classes in §1 (research.report, monitor.watch, form.autofill, commerce.checkout, data.scrape, test.ui, content.summarize, auth.session, extract.structured). Stored via `ProgramStore` (seeded, versioned).
- **Custom AGENTS** for orchestration: a small set of typed agent roles (`researcher`, `extractor`, `synthesizer`, `monitor`, `tester`) — each is a thin wrapper that picks a recipe/agentic goal + an LLM provider + HITL policy. These are the "specified recipes and custom AGENTS" the user mentioned. Implemented as config objects + a `AutomationOrchestrator` (`src/engines/automation/orchestrator.ts`) that:
  - receives a high-level NL goal,
  - decomposes via NLCL/planner into a DAG of capability calls (browser steps + provider-LLM summarize + file write + notify),
  - fans out parallel browser crawls (multiple generic slaves or tabs),
  - aggregates captured content through `StreamBlockStore`,
  - invokes provider LLMs for per-source summarize,
  - calls `CrossConversationSynthesizer` (existing) for the final report,
  - returns structured artifact (file path + canvas layer + chat message).
- Scenario 1 (10-page report) is the reference orchestration: `researcher` agent → N× `data.scrape` (generic browser) → N× `content.summarize` (provider LLM) → `synthesizer` → markdown report with citations.

### Layer 6 — NLCL catalog expansion (`catalog.ts`)
Add deterministic intents (category `browser`/`automation`), all `executor:'generic-browser'` or `executor:'capability'` for orchestration:
- `automate.open`, `automate.go`, `automate.search`, `automate.click "<text|selector>"`, `automate.type "<text>" into "<field>"`, `automate.fill`, `automate.scroll`, `automate.wait`, `automate.screenshot`, `automate.read`, `automate.tab`.
- `research.report "<topic>" pages=<n>`, `monitor.watch "<url>"`, `automate.form.fill`, `automate.test "<url>"`.
- Composite NL already supported: "go to cnn and summarize" → pipeline.

### Layer 7 — Surfacing (CLI + API, as decided)
- **API:** everything flows through `POST /api/interpret` (already wired). Add `/api/automate/loop` (start agentic loop, returns runId + SSE/WS progress) and `/api/automate/recipe/:id/execute`. Do **not** mount the legacy `automation-router.ts` (bypasses Canon); replace its role with governor-mediated routes.
- **CLI:** thin client already forwards to `/api/interpret`. Add `automate` subcommands that map to NL intents (`automate loop "research 10-page report on AI crisis"`), plus `research`, `monitor` top-level commands. Screenshot writes PNG to cwd.
- Mount `AutomationOrchestrator` + `AgenticLoopEngine` in `createServerWithEngines`.

---

## 5. Files (new / edited)

**New**
- `src/engines/semantic-grounding.ts` (SemanticGroundingEngine + SemanticSelector types)
- `src/engines/selector-healer.ts` (SelectorHealer + store contract `selector-heal-store.ts`)
- `src/engines/agentic-loop.ts` (AgenticLoopEngine, Sense/Plan/Act/Observe/Reflect/Adapt)
- `src/engines/nlcl/executors/generic-browser-executor.ts`
- `src/engines/automation/recipes.ts` (recipe library + taxonomy constants)
- `src/engines/automation/orchestrator.ts` (AutomationOrchestrator + agent roles)
- `src/engines/automation/agents.ts` (researcher/extractor/synthesizer/monitor/tester definitions)
- `src/server/automation-router.ts` (governor-mediated `/api/automate/*` + `/api/automate/loop`)
- `tests/unit/engines/{semantic-grounding,selector-healer,agentic-loop,generic-browser-executor,orchestrator}.test.ts`
- `tests/integration/automation.e2e.test.ts` (guarded, needs Chrome)

**Edited**
- `src/engines/chrome-governor.ts` — `ensureGenericBrowser`, `executeAgenticLoop`, `getAccessibilityTree` helpers, `ToolUseProtocol` surface
- `src/engines/nlcl/types.ts` — add `'generic-browser'` to `ExecutorId`; add `AgenticGoal`/loop types
- `src/engines/nlcl/executors/index.ts` — export
- `src/engines/nlcl/nlcl-engine.ts` — register `GenericBrowserExecutor`; route agentic/recipe intents
- `src/engines/nlcl/catalog.ts` — new `automationPatterns` + export
- `src/engines/harness/recipe-types.ts` + `recipe-compiler.ts` — extend `RecipeStep` union (scroll/hover/select/press/tab/observe/upload/extract_markdown) + compile
- `src/storage/contracts/program-store.ts` — extend `RecipeStep` (shared union)
- `src/engines/harness/harness-contract.ts` — `agentic_goal` already present; add loop request/result types
- `src/server/index.ts` — mount automation router, wire `AgenticLoopEngine` + `AutomationOrchestrator` in `createServerWithEngines`
- `prisma/schema.prisma` — add `selectorStrategy` (format/semantic_data/heal_count), `agentLoopRun`, `agentStep` (SOTA-07 deltas)
- `seeds/` — seed the recipe library + agent roles

---

## 6. Identity / naming convention
- Generic slave id: `generic:<account>:<ulid>` — never collides with provider slaves (`<provider>_<account>_<ts>`).
- Recipe/capability ids: `auto:<class>:<action>` (e.g. `auto:research:report`, `auto:monitor:watch`). Surfaced as NL aliases.
- Agent roles: `agent:researcher`, `agent:extractor`, `agent:synthesizer`, `agent:monitor`, `agent:tester`.

## 7. Invariants preserved
- **Governor Canon:** every CDP op (incl. a11y tree, screenshots, agentic primitives) goes through `governor.cdp`/`governor.evaluate`. `UIAutomator` deprecated for in-repo use; `BunCdpClient` only inside `executor/cdp.ts` + governor.
- **Store Contracts:** new engines depend on `storage/contracts/*`, never `impl/*`.
- **One Entry Point:** all triggered via NL → `/api/interpret` (or capability execute); no second transport.
- **Research-First / Phase Gates:** this plan is the research deliverable; implementation follows phase order L1→L7.

## 8. Verification
- `bun run typecheck`, `bun run lint`, `bun test`.
- `bun run devops verify-cross-surface` after taxonomy/capability changes.
- Manual: `bun run serve` → `bun run cli` → `open chrome` → `go to example.com` → `click the more info link` → `screenshot` → `research.report "economic AI crisis" pages=10`.
- Scenario 1 end-to-end (guarded integration test): assert final markdown report with ≥N citations produced.

## 9. Suggested build order (phases)
1. L1 generic browser + L4 GenericBrowserExecutor + catalog (parallel-navigate/search/click/type/screenshot) — gets basic automation working via CLI+API fast.
2. L2 SemanticGroundingEngine + SelectorHealer — robustness.
3. L3 AgenticLoopEngine — adaptive recovery (scenario 10).
4. L5 recipe library + orchestrator + agents — scenario 1 and the rest.
5. L6/L7 NL + surfacing + schema/seed migrations.
6. Tests + verification.
