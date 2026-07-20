# Local-Agent (OpenCode Zen Free) — Comprehensive Value-Add Assessment

**Date**: 2026-07-19 | **Feature**: `022-local-agent-opencode`
**Subject**: Deep code inspection of every subsystem for leverage points of the new
`local-agent` provider type — headless `opencode` CLI running Zen free models
(`opencode/deepseek-v4-flash-free`, `opencode/hy3-free`, `opencode/mimo-v2.5-free`,
`opencode/north-mini-code-free`) with NO API key, NO browser, NO CDP, emitting
`--format json` parseable to `ContentBlock[]` (`ContentPart` union, `src/schema/streaming.ts:90-104`).

**Invariant guard**: every opportunity below is a NEW `UnifiedCapability` / adapter / branch that
does NOT import `BunCdpClient` or call `ChromeGovernor`. Governor Canon, Store Contracts, One
Entry Point, `EngineError`, TS-strict all preserved.

---

## A. Inference backbone & adapters (the core slot)

- **Add `OpencodeAdapter` beside `LocalModelAdapter`** — `src/engines/local-model-adapter.ts:9,57-112,114-151` only targets Ollama/llama.cpp over HTTP; opencode is a key-free, browser-free equivalent that returns structured `ContentPart[]` JSON (not Ollama's flat `response` string at `:88-100`). RECEIPT: `src/engines/local-model-adapter.ts:1-185`.
- **Offline autonomous planner** — `src/engines/autonomous-execution.ts:57-61,923` documents `'local'`→`LocalModelAdapter` but still needs a running Ollama server. An `opencode` planner makes offline planning truly zero-dependency. RECEIPT: `src/engines/autonomous-execution.ts:57-61,922-943`.
- **Autonomous failover to free model** — `src/engines/autonomous-execution.ts:560-584` retries only CDP/circuit errors; add a `local-agent` degrade step so autonomous tasks finish offline (e.g. `north-mini-code-free` for code). RECEIPT: `src/engines/autonomous-execution.ts:560-593`.
- **Cost optimizer ranks free first** — `src/engines/cost-optimizer.ts:30-47,81-123` assumes per-token cent costs; a `local-agent` cost provider (`costCents:0`) makes `getCheapestProvider` correctly prefer the free model. RECEIPT: `src/engines/cost-optimizer.ts:30-47,81-123`.

## B. NL command layer (NLCL)

- **Free fallback resolver** — `src/engines/nlcl/nlcl-engine.ts:418-434` `tryAIFallback` only falls back to `provider-llm`/`local-llm` (Ollama); add an `opencode` path for key-less classification when offline. RECEIPT: `src/engines/nlcl/nlcl-engine.ts:408-437`.
- **New resolver type** — `src/engines/nlcl/intent-resolver.ts:201-215,240-263` and `src/engines/nlcl/types.ts:139-150` (`ResolverConfig.type`) — add `'opencode'` + optional `opencodeModel` so the deterministic→LLM layered pipeline uses free models. RECEIPT: `src/engines/nlcl/intent-resolver.ts:28-30,201-263`; `src/engines/nlcl/types.ts:139-150`.
- **Browser-free `llm.ask` executor** — `src/engines/nlcl/executors/provider-llm-executor.ts:20-74` requires a logged-in CDP session; a sibling `LocalAgentExecutor` (opencode) serves `llm.ask`/`summarize` with zero browser. RECEIPT: `src/engines/nlcl/executors/provider-llm-executor.ts:1-74`.

## C. Capability composition & subagent fan-out

- **Offline DAG sub-steps** — `src/engines/capability-composer.ts:128-140` executes composite nodes by slug; `local.think`/`local.summarize` nodes do extract/classify offline, free. RECEIPT: `src/engines/capability-composer.ts:110-146`.
- **Free fan-out/synthesize opinion** — `src/engines/provider-mux.ts:183-211,233-238` concatenates provider responses with no free-model inclusion; add `opencode` as a `costCents:0` fan-out target for `cost_optimized` routing. RECEIPT: `src/engines/provider-mux.ts:164-289`.
- **Permanent offline fallback target** — `src/engines/provider-mux.ts:283-289` `fallbacksFor()` never includes a free local model; register `opencode` as lowest-cost failover. RECEIPT: `src/engines/provider-mux.ts:283-289`.

## D. Memory, knowledge, search, synthesis

- **NL rule rationales** — `src/engines/memory-engine.ts:301-353` `minePatterns` names rules `auto_${providerId}_${action}`; opencode can author human-readable rule names/rationales. RECEIPT: `src/engines/memory-engine.ts:301-375`.
- **Semantic extraction tier** — `src/engines/knowledge-extractor.ts:50,58-185` is regex-only with fixed confidence; a free-model extractor raises entity/decision/fact recall on messy exports. RECEIPT: `src/engines/knowledge-extractor.ts:37-183`; `src/engines/knowledge-ingestion.ts:151-157`.
- **Hybrid query expansion** — `src/engines/semantic-search.ts:98-100` `searchHybrid` is a no-op stub; opencode can generate free query expansion/re-ranking when no embedder is set. RECEIPT: `src/engines/semantic-search.ts:24-29,98-100`.
- **Key-free cross-conversation answers** — `src/engines/cross-conversation-synthesis.ts:32-96,108-135` `SynthesizeLlmProvider` is the only LLM dependency and the offline gap; opencode makes it work with no key/browser. RECEIPT: `src/engines/cross-conversation-synthesis.ts:21-135`.

## E. Kernel (oracle / diagnostic / actuator)

- **Draft stub implementations** — `src/engines/kernel/oracle-diagnostic.ts:79-102` `checkStubs` returns a static "Implement X" string; opencode can draft a first implementation sketch from the spec. RECEIPT: `src/engines/kernel/oracle-diagnostic.ts:79-173`.
- **Concrete remediation plans** — `src/engines/kernel/oracle-actuator.ts:197-201` `apply()` for `notify`/`reconnect` does nothing but record intent; opencode can write a remediation note/plan (no destructive action). RECEIPT: `src/engines/kernel/oracle-actuator.ts:173-201`.
- **NL root-cause explanations** — `src/engines/kernel/oracle-query.ts:222-228,257-271` `explain()` returns templated text; opencode can summarize the provenance chain into plain language. RECEIPT: `src/engines/kernel/oracle-query.ts:222-271`.

## F. Versioning & registration audit

- **Auto-changelog** — `src/engines/version-manager.ts:314-345,362-390` emits terse status logs; opencode can generate a changelog sentence per promotion/degradation offline. RECEIPT: `src/engines/version-manager.ts:314-390`.
- **Reconciliation patch drafting** — `src/engines/registration-auditor.ts:169-205,246-298` `detectDrift` only suggests; opencode can draft the exact SQL/JSON patch for human review. RECEIPT: `src/engines/registration-auditor.ts:169-298`.

## G. Parsing / repair / streaming analysis

- **Author parsers from raw samples** — `src/engines/parser-repair.ts:31-63,83-135` emits a generic splitter with fixed `getConfidence()=0.85`; opencode can author a higher-fidelity `logic_code` parser from a payload sample, free. RECEIPT: `src/engines/parser-repair.ts:31-135`.
- **Higher-fidelity streaming analyzer** — `src/engines/streaming-response-analyzer.ts:170-192` `generateLogicCode` emits heuristic confidence; opencode can inspect the sample for a better parser. RECEIPT: `src/engines/streaming-response-analyzer.ts:170-192`.
- **Harness repair without API key** — `src/engines/harness-repair-engine.ts` (pairs with parser-repair) uses an LLM to fix malformed Zod payloads; an opencode backend removes the key dependency. RECEIPT: architecture note (AGENTS.md harness section).

## H. Context assembly & situation detection

- **6th classification layer** — `src/engines/situation-detector.ts:263-282` collapses ambiguous inputs to `general`; an opencode classifier (free) improves task-type detection. RECEIPT: `src/engines/situation-detector.ts:41-253,263-282`.
- **Fill conversation-history layer** — `src/engines/context-assembly.ts:401-464` leaves `conversation_history` an empty placeholder; opencode can summarize/compress snippets offline. RECEIPT: `src/engines/context-assembly.ts:388-467`.

## I. Provider registration / runtime resolution (Governor Canon preserved)

- **Register `opencode` as first-class provider** — `src/engines/provider-registrar.ts:7,59+` seeds only 6 web providers; a `local-agent` manifest (`provider_type:'local-agent'`, no endpoints/CDP) registers it. RECEIPT: `src/engines/provider-registrar.ts:1-19,75-305`.
- **Bypass CDP in send pipeline** — `src/engines/conversation-manager.ts:415,555-619,658` hard-codes RESOLVE→SEND→CAPTURE via `governor.cdp`; a `local-agent` branch returns `ContentBlock[]` straight from opencode, still feeding `recordEpisode`/emit at `:510-527`. RECEIPT: `src/engines/conversation-manager.ts:415,510-527,555-619,658`.
- **Governor parallel executor branch** — `src/engines/chrome-governor.ts:1121-1152` (`executeSnapshotProgram`) and `:226-338` (`executeHarnessPlan`) are CDP-only; add `if (entry.providerType==='local-agent') return this.localAgentExecutor.run(...)` — single I/O authority, non-CDP for this type. RECEIPT: `src/engines/chrome-governor.ts:226-338,1121-1152,1183-1187`.
- **Offline selector suggestion** — `src/engines/semantic-grounding.ts:46-87` requires CDP for every method; a `local-agent` "selector suggester" proposes ARIA/CSS selectors from a pasted DOM snapshot offline. RECEIPT: `src/engines/semantic-grounding.ts:46-87`.

## J. Server / CLI / API surfaces (One Entry Point)

- **Interpret fast-path** — `src/server/interpret-router.ts:66-76` always builds an `NLCContext` with `slaveId`/CDP; add a `provider_type==='local-agent'` branch so NL phrases execute via opencode without a slave. RECEIPT: `src/server/interpret-router.ts:66-76`.
- **Capability router parity** — `src/server/capability-router.ts:43-108` requires `slaveId`/provider semantics; registering a `local-agent` capability through the same `registry.execute` gives CLI/API/MCP/UI parity. Add `providerType` facet at `:43-50`. RECEIPT: `src/server/capability-router.ts:43-108`.
- **Offline CLI subsystem** — `src/cli/index.ts:17,45-48,102-150` and `src/cli/commands/builtins.ts:14-16` always assume a running server; a `localagent ask "<prompt>"` / `localagent models` builtin shells opencode directly (cleaner than legacy HTTP builtins). RECEIPT: `src/cli/index.ts:17,102-150`; `src/cli/commands/builtins.ts:14-50`.
- **Offline onboarding/discovery** — `src/cli/provider-harness.ts` + `src/cli/discovery-stack.ts` are CDP-centric; a local-agent mode runs `opencode --help`/`--format json` probe instead of `ProtocolDiscoveryEngine`. RECEIPT: `src/cli/provider-harness.ts`, `src/cli/discovery-stack.ts`.

## K. Storage contracts & seeds

- **Provider manifest seed** — `seeds/providers/manifests.ts:5-958` has NO `local-agent` entry; add `provider_type:'local-agent'`, `auth_type:'none'`, `endpoints:[]`, `parsers:[]`, 4 free models. RECEIPT: `seeds/providers/manifests.ts:5-958`.
- **Parser skip for local-agent** — `src/storage/contracts/parser-store.ts:5-18` has no `'local-agent'` `logicType`; opencode emits `ContentPart[]` already, so the parser engine should short-circuit (no sandbox/inline path). RECEIPT: `src/storage/contracts/parser-store.ts:5-18`; `src/engines/stream-parser.ts`.
- **Harness command adaptor** — `seeds/harness/commands.seed.ts:43` defaults `adaptorRef:'ChromeGovernor.executeHarnessPlan'`; add `local_agent_run` with `adaptorRef:'LocalAgentExecutor.run'` so the 017 harness drives opencode offline. RECEIPT: `seeds/harness/commands.seed.ts:43`; `seeds/harness/commands.json`.
- **Taxonomy + conceptual model** — `seeds/taxonomy/taxonomy-seed.ts` and `src/storage/contracts/provider-type-store.ts` need a `local-agent` row (family `local`, domain `offline`) so taxonomy/cross-surface verifier include the free provider. RECEIPT: `seeds/taxonomy/taxonomy-seed.ts`; `src/storage/contracts/provider-type-store.ts`.
- **Cost store already supports free** — `src/storage/impl/cost-store-impl.ts:27-39` records `costCents`; local-agent emits zero-cost logs so `CostOptimizer` can prove savings vs browser providers. RECEIPT: `src/storage/impl/cost-store-impl.ts:27-39`.

## L. devops / invariants / scripts

- **Browser-free onboarding pipeline** — `devops/onboard-controller.ts:72-81,85-207` is CDP-gated (`discover`/`test-selectors`/`test-frontend` require Chrome); add a `local-agent` branch skipping those phases, only `infer`/`test-cap`/`verify`/`converge`. RECEIPT: `devops/onboard-controller.ts:72-207`.
- **Offline runtime-test mode** — `scripts/runtime-test.ts:79-111` (`cmdHealth`) assumes backend+frontend; add `runtime-test local-agent` / `--offline` so health passes when only opencode is available (CI without Chrome). RECEIPT: `scripts/runtime-test.ts:79-111`.
- **Governor-Canon audit check** — `devops/audit-code/scan.ts:16-25,index.ts:61-70` should add `checkLocalAgent` flagging any `local-agent` handler importing `BunCdpClient`/`ChromeGovernor`. RECEIPT: `devops/audit-code/scan.ts:16-25`; `devops/audit-code/index.ts:61-70`.
- **Invariant assertion** — `devops/invariants.ts` should assert `provider_type==='local-agent'` rows have zero endpoints/parsers and `auth_type==='none'`, enforcing the no-CDP/no-key contract at the data layer. RECEIPT: `devops/invariants.ts`.
- **Launcher/health probe** — `scripts/start-backend.ps1:43-87` and `scripts/health-check.ps1:33-61,73-97` never check the opencode binary; add a `LocalAgent` probe (`opencode --version` / trivial `--format json` echo). RECEIPT: `scripts/start-backend.ps1:43-87`; `scripts/health-check.ps1:33-97`.
- **Cross-surface verification** — `scripts/verify-cross-surface.ts` must confirm a `local-agent` capability with `surfaces:['cli','ui','api','mcp']` passes the same parity checks. RECEIPT: `scripts/verify-cross-surface.ts`.

## M. Tests — the highest-leverage win (zero-cost, key-free, mock-free)

- **First real happy-path adapter test** — `tests/unit/engines/local-model-adapter.test.ts:1-65` only asserts failure against an unreachable endpoint; a `local-agent-adapter.test.ts` is the FIRST test exercising real successful agent execution with zero infra. RECEIPT: `tests/unit/engines/local-model-adapter.test.ts:1-65`.
- **Stream parser fixture for non-CDP** — `tests/unit/engines/stream-parser.test.ts:1-60` builds a `mockStore`; add a `--format json` → `ContentPart[]` fixture proving the same contract works for local-agent. RECEIPT: `tests/unit/engines/stream-parser.test.ts:1-60`.
- **Chrome-free e2e regression** — `tests/e2e/provider-stream-validate.test.ts:1-50` loads captured fixtures; a `local-agent` capture fixture (`tests/fixtures/capture/local-agent.body.txt`) gives an e2e path with no Chrome profile / API key. RECEIPT: `tests/e2e/provider-stream-validate.test.ts:1-50`.
- **Full ConversationManager pipeline w/o mocks** — `tests/helpers/mocks/` + `tests/integration/engines/conversation-manager.test.ts` can run the real capture+parse pipeline against a live agent with NO mock store — the only provider type that can today. RECEIPT: `tests/helpers/mocks/`, `tests/integration/engines/conversation-manager.test.ts`.
- **Non-browser registration test** — `tests/integration/providers/` has only `harness.test.ts`/`plugin-lifecycle.test.ts`; add `ProviderRegistrar.seedProvider('local-agent')` covering the `provider_type`/`auth_type` branch CDP manifests never hit. RECEIPT: `tests/integration/providers/`.

## N. Frontend (web/ui + web/sandbox) — render agent output for free

- **Provider switcher entry** — `web/ui/src/providers/registry.ts:9-22` adds ONE entry (`id:'local-agent'`, no `url`) to appear in the switcher; confirms UI supports browser-less providers structurally. RECEIPT: `web/ui/src/providers/registry.ts:1-26`.
- **Streaming slots 1:1** — `web/ui/src/features/canvas/StreamingSlot.tsx` + `useStreamBlocks.ts` consume `ContentPart[]`; local-agent JSON maps directly, zero new UI code. RECEIPT: `web/ui/src/features/canvas/`.
- **No-auth account UI** — `web/ui/src/features/provider-account-dashboard/` assumes logged-in browser profiles; needs an `auth_type:'none'` "no login required" state. RECEIPT: `web/ui/src/features/provider-account-dashboard/`.
- **Generic renderer playground** — `web/sandbox/src/features/generic-capability-renderer.tsx:1-62` executes ANY capability via `ActionRegistry.dispatch`; local-agent is immediately renderable/executable, ideal before promotion to `CapabilityRegistry` (`web/ui/src/registry/index.ts:1-47`). RECEIPT: `web/sandbox/src/features/generic-capability-renderer.tsx:1-62`; `web/ui/src/registry/index.ts:1-47`.
- **Sandbox provider manager** — `web/sandbox/src/features/provider-manager.tsx:1-15` `PROVIDER_ICONS`; add `local-agent` + "no auth" branch. RECEIPT: `web/sandbox/src/features/provider-manager.tsx:1-15`.
- **Zero-cost observability** — `web/sandbox/src/features/debug-panel.tsx`,`dev-console.tsx` inspect streamed JSON; free agent-run observability vs CDP traffic dumps. RECEIPT: `web/sandbox/src/features/debug-panel.tsx`,`dev-console.tsx`.

## O. Config / ids / errors (the unsexy but required seams)

- **Local-agent config block** — `src/config.ts:58-103` has only Chrome-fleet concepts (`chromePath`, `profileBaseDir`, `fleetPortRange*`); add `localAgent:{bin,defaultModel,jsonFormat,execTimeoutMs}` so the executor reads one source. RECEIPT: `src/config.ts:58-103`.
- **Guard stray profile dir** — `src/config.ts:78,83-85` + AGENTS.md warns against stray top-level provider dirs; ensure `local-agent` does NOT mint `chrome-profiles/local-agent`. RECEIPT: `src/config.ts:78,83-85`.
- **No phantom slave id** — `src/ids.ts:12-30` `deriveSlaveId(providerId,accountId)` assumes a slave; add `deriveLocalAgentProfile` or make it optional so local execution doesn't mint a CDP slave used by `ChromeGovernor.resolveSlaveId`. RECEIPT: `src/ids.ts:12-30`.
- **Typed local-agent error** — `src/errors.ts:87-91` `EngineError`; add `LocalAgentExecError` (non-zero exit / unparseable JSON) instead of raw `Error`, keeping local failures outside the CDP error taxonomy (`SlaveNotRunningError` etc. at `:44-85`). RECEIPT: `src/errors.ts:44-91`.
- **Tighten provider_type vocabulary** — `src/schema/provider-manifest.ts:53-54` `provider_type`/`auth_type` are open `z.string()`; add `'local-agent'`/`'none'` (or enum) so it is type-checked, not stringly-typed. (Confirmed: currently accepts any string, so no code change needed to seed — but worth tightening.) RECEIPT: `src/schema/provider-manifest.ts:53-54`.

## P. Docs / skills / build config

- **Architecture doc update** — `docs/merged-design-v2/04-merged-engines.md` (Engine 5 ProviderRegistrar) + `00-merged-index.md`/`01-merged-epic.md` should list `local-agent` as a provider tier. RECEIPT: `docs/merged-design-v2/`.
- **Onboarding spec template** — `.specify/templates/provider-onboarding/spec-template.md:1-40` is CDP-hardwired; extend with a `local-cli` mode (no discover/selectors; `opencode --format json` contract validation). RECEIPT: `.specify/templates/provider-onboarding/spec-template.md`.
- **Research index entry** — `docs/research/{INDEX,CROSS-REF,FRESHNESS}.md` register a `local-agent-provider` entry so future agents find the opencode findings. RECEIPT: `docs/research/INDEX.md`,`CROSS-REF.md`,`FRESHNESS.md`.
- **Build scripts** — `package.json:10-37` add `"local-agent"`/`"local-agent:smoke"` (mirror `providers:smoke`,`gen:protocol`) and fold zero-cost tests into `test:integration`/`test:e2e`. RECEIPT: `package.json:10-37`.
- **Skill extensions (highest leverage)** — `.kilo/skills/devops-fullstack/SKILL.md:1-40` is CDP-centric; add a `local-cli` loop variant (spawn opencode, parse to `ContentBlock[]`, no Chrome). Also `.kilo/skills/vivim-testing/SKILL.md`, `.kilo/skills/vivi-frontend/SKILL.md`, `.kilo/command/new-engine.md`, `.specify/integrations/opencode.manifest.json`. RECEIPT: `.kilo/skills/devops-fullstack/SKILL.md`, `.kilo/skills/vivim-testing/SKILL.md`, `.kilo/skills/vivi-frontend/SKILL.md`, `.specify/integrations/opencode.manifest.json`.

---

## Summary

**~70 distinct, file-anchored value-add opportunities** across 16 subsystems (A–P). They cluster
into 4 tiers of leverage:

1. **Net-new capability surface** (most value, lowest risk): `cap:agent:run` + `OpencodeAdapter`
   + `LocalAgentExecutor` branch in `chrome-governor`/`conversation-manager` — the actual feature
   from `022-local-agent-opencode`.
2. **Offline resilience / cost** (high value): autonomous failover, cost-optimizer free ranking,
   provider-mux fallback, kernel remediation drafting.
3. **Quality uplift of existing engines** (medium): memory rule rationales, semantic extraction
   tier, context-assembly history layer, parser/repair authoring, version/changelog drafting.
4. **Tests + docs + tooling parity** (enabling): zero-cost mock-free e2e, cross-surface verify,
   offline runtime-test, skill-loop extension, config/error/id seams.

All preserve the Governor Canon (no CDP in local-agent code paths), Store Contracts, One Entry
Point (every op is a UnifiedCapability), `EngineError` discipline, and TS strictness.
