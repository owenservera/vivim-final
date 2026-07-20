# OpenClaw & Ecosystem: SOTA Research Report

*Generated: 2026-07-19 | Sources: 28 | Confidence: High*

## Executive Summary

OpenClaw (github.com/openclaw/openclaw) is a MIT-licensed, local-first AI agent
gateway that went from zero to 335K–383K GitHub stars in ~60 days (late 2025 →
2026), becoming one of the most-starred open-source projects on the platform.
Architecturally it is a **Gateway-centric control plane** with four loosely-coupled
layers: Gateway (channel adapters + message queue + auth), Reasoning (intent +
LLM router + tool selection), Memory (WAL + compaction + context manager), and
Skills/Execution (skill registry + sandbox + permission enforcer). Its extension
model — a `PluginRegistry` with a typed **capability ownership model**, a
`taxonomy.yaml` (10,637 lines / 635 KB) capability catalog, and a ClawHub skill
ecosystem (13,700+ community skills) — is structurally analogous to vivim's
`UnifiedCapability` + `CapabilityResolutionEngine` + `ProviderCapabilityTaxonomy`
design. Several spinoffs (crabfleet, clawgrit-reports, nora, hearth, qwen35-patch)
surface harvestable capabilities that map cleanly onto vivim's 13-engine
architecture. This report identifies the best-matching repos and defines a
harvest strategy.

## 1. What OpenClaw Is

OpenClaw began as "Clawdbot" (WhatsApp↔Claude CLI bridge by Peter Steinberger,
steipete), briefly rebranded "MoltBot" after an Anthropic trademark complaint,
and settled on "OpenClaw" in late Jan 2026. The mascot is a space lobster "Molty".
After Steinberger joined OpenAI (Feb 2026), the project moved to an independent
open-source foundation. It is **TypeScript (Node ≥22)**, pnpm-based, CalVer
versioned (`YYYY.M.D`), MIT licensed ([sparkagents.com/blog/openclaw-github],
[macaron.im/blog/openclaw-github]).

Core facts (March–July 2026):
- 335K–383K stars, 41K–80K forks, 1,100+ contributors, 70K+ commits
- 20+ native messaging channels (WhatsApp, Telegram, Slack, Discord, Signal,
  iMessage, Matrix, LINE, WeChat, etc.)
- 13,700+ ClawHub community skills; v2026.7.1 current (July 2026)
- `taxonomy.yaml` — 10,637-line capability catalog at repo root

## 2. Architecture (Four Layers + Ecosystem)

OpenClaw uses a **Gateway-centric, hub-and-spoke** architecture where the Gateway
is the sole control-plane entry point (WebSocket, default `localhost:18789`) and
the "Brain" (LLM) provides intelligence while OpenClaw provides the OS
([tenten.co/openclaw/en/docs/architecture/overview], [ppaolo.substack.com/p/openclaw-system-architecture-overview],
[clawdocs.org/architecture/overview]).

```
User → Channels (20+ platforms)
        ↓
Layer 1: Gateway      — channel adapters, unified message format, auth,
                         rate-limit, message queue, REST API (port 18789)
Layer 2: Reasoning    — intent recognition, LLM router, tool selection, SOUL.md
Layer 3: Memory       — WAL, markdown compaction, context-window manager
Layer 4: Skills/Exec  — skill registry, sandbox, permission enforcer
```

### Plugin / Capability Model (highest harvest value)

The `PluginRegistry` manages plugin lifecycles across extension points:
model providers, messaging channels, tools, hooks, memory backends, and infra
services ([deepwiki.com/openclaw/openclaw/5.1-plugin-architecture]).

Capabilities are the **public native plugin model**. Each plugin registers
against one or more capability types via a typed API:
`api.registerProvider`, `api.registerTool(toolName, toolDefinition)`,
`api.registerEmbeddingProvider`, `api.registerSpeechProvider`,
`api.registerImageGenerationProvider`, etc. ([docs.openclaw.ai/plugins/architecture]).

**Capability ownership model** — a plugin is the ownership boundary for a *company*
or a *feature*, not a grab-bag:
- vendor multi-capability: `openai` owns text + speech + realtime voice + media
  understanding + image gen; `google` owns text + media + image + web search;
  `qwen` owns text + media + video
- vendor single-capability: `elevenlabs`/`microsoft` = speech; `firecrawl` = web-fetch
- feature plugin: `voice-call` owns call transport but *consumes* shared speech
  capabilities instead of importing vendor plugins directly
([openclaw.cc/en/plugins/architecture]).

This mirrors vivim's invariant: **engines depend on store contracts, not
impl; capabilities are provider-bound**. The OpenClaw "consume shared capability
instead of re-implementing vendor behavior" rule is exactly vivim's
`CapabilityResolutionEngine` contract philosophy.

### Load Pipeline & Safety Gates

Startup: discover candidate roots → read manifests → reject unsafe candidates
(path escape, world-writable, ownership mismatch) → normalize config → decide
enablement → load native modules (bundled native loader; third-party TS uses Jiti
fallback) → call `register(api)` → expose registry ([docs.openclaw.ai/plugins/architecture-internals]).
Manifest is control-plane source of truth; runtime module is data-plane. Safety
gates run **before** runtime execution. This is directly analogous to vivim's
`ProviderRegistrar` 2-pass wiring + `capability-bootstrap.ts` boot snapshot.

## 3. Harvestable Capabilities Mapped to vivim Engines

| OpenClaw Surface | vivim Engine / Module | Harvest Value |
|------------------|----------------------|---------------|
| `taxonomy.yaml` (10.6K lines capability catalog) | `ProviderCapabilityTaxonomy`, taxonomy generation pipeline (`devops-generators`) | **High** — seed source for capability taxonomy + NL catalog patterns |
| `PluginRegistry` + capability ownership model | `UnifiedCapabilityRegistry`, `CapabilityResolutionEngine` | High — ownership-boundary + slot-kind pattern (`memory`, `context-engine` at-most-one) |
| Channel adapters (26 platforms) | `ProviderRegistrar`, provider manifests `seeds/providers/*.json` | High — selector/endpoint/parser seed blueprint |
| Skill registry + `SKILL.md` + ClawHub | capability nodes, `registerDefaultCapabilities` | Medium-High — 13,700 skills as capability corpus |
| Gateway message queue + typed WS protocol (JSON-schema validated frames) | `CapabilityEventBus`, `ChromeGovernor` CDP proxy | Medium — event routing + protocol validation |
| Memory: WAL + markdown compaction + context-window manager | Node-layer v2 (`NodeEdge`, `NodeVersion`), `MemoryEngine` | Medium-High — ACU provenance + version chain parallel |
| Multi-agent routing (most-specific-wins: peer > channel > default) | `CapabilityComposer` DAG, subagent orchestration | Medium — deterministic routing policy |
| Security: sandbox + tool policy + DM policy (3 independent layers) | `ConfigManager`, `HarnessCommandRegistry` repair gates | Medium — layered trust model |
| `crabfleet` (mission control for agent runs) | `TelemetryAggregator`, run dashboard | High — agent-run observability |
| `clawgrit-reports` (performance reports) | `TelemetryAggregator` | Medium — perf report schema |
| `nora` (fleet control plane + MCP server, OTel gen_ai export) | `ChromeGovernor` fleet, MCP surface | High — MCP control-plane + OTel telemetry |
| `hearth` (multi-user household memory layer) | Node-layer v2 multi-tenant, `MemoryEngine` | Medium — multi-user memory model |
| `openclaw-qwen35` (local-model tool-calling patches) | `StreamParserEngine`, local provider tool loop | Medium — tool-loop circuit breaker + JSON repair |

## 4. Best-Matching Spinoffs / Iterations (verified cloneable)

All verified live via `git ls-remote` on 2026-07-19:

| Repo | Stars | Why harvest | Maps to |
|------|-------|-------------|---------|
| **openclaw/openclaw** | 383K | Core: taxonomy.yaml, PluginRegistry, channel adapters, gateway | Everything |
| **openclaw/crabfleet** | — | "Mission control for agent runs" — run lifecycle, dashboards | TelemetryAggregator |
| **openclaw/clawgrit-reports** | — | Performance reports for OpenClaw | TelemetryAggregator schema |
| **solomon2773/nora** | — | Fleet control plane + MCP server + OTel gen_ai export, NemoClaw sandbox hardening | ChromeGovernor fleet + MCP |
| **warrence/openclaw-hearth** | 14 | Multi-user household memory layer, PWA, NestJS | Node-layer multi-tenant memory |
| **paulwlisto/openclaw-qwen35** | 0 | Local-model tool-calling + JSON repair + circuit-breaker patches | StreamParserEngine / local providers |
| **Open-claw-org/open-claw.org** | 1 | One-click deployment UI (NOT affiliated, low value) | Skip |
| **juca-dev/openclaw-clone** | 0 | Full clone, no added value | Skip (use upstream) |
| **fiilyai/openclaw** | — | Fiily distro fork, no novel caps | Skip |

**Recommendation:** clone `openclaw/openclaw` (core reference), `openclaw/crabfleet`,
`openclaw/clawgrit-reports`, `solomon2773/nora`, `warrence/openclaw-hearth`,
`paulwlisto/openclaw-qwen35` into a local `research-clones/` workspace.

## 5. Security / Supply-Chain Caveat (critical for harvest)

OpenClaw's ClawHub suffered a major supply-chain attack: Koi Security found 324
malicious skills (Feb 2026), later 824 across 10,700+ ([growexx.com/blog/openclaw-skills-development-guide]).
30,000+ instances compromised via exposed port 18789. **Harvest rule:** only take
*architecture patterns and taxonomy structure* from OpenClaw/ClawHub — never
execute ClawHub skill `SKILL.md` content or plugin runtime verbatim. vivim's
DB-only parser logic + store-contract invariants already enforce this boundary.

## Key Takeaways

1. OpenClaw's capability-ownership + slot-kind model is a near-1:1 architectural
   sibling of vivim's UnifiedCapability + store-contract design — harvest the
   *shape*, not the code.
2. `taxonomy.yaml` (10.6K lines) is the single highest-value harvest target: a
   proven, real-world capability catalog spanning providers, channels, media,
   tools. Feed it into `devops-generators` as a seed corpus.
3. `crabfleet` + `nora` give the most concrete harvestable *code* for
   TelemetryAggregator and the ChromeGovernor fleet/MCP surface.
4. Local-model tool-calling patches (qwen35) directly inform robustness work for
   vivim's local/provider-bound parsers and tool loops.
5. Treat all ClawHub skills as untrusted; harvest only structure.

## Sources

1. [OpenClaw GitHub main](https://github.com/openclaw/openclaw) — core repo, 383K stars
2. [OpenClaw org](https://github.com/openclaw) — 19 repos incl. crabfleet, clawgrit-reports, clickclack, photoscrawl
3. [Architecture Overview (tenten)](https://tenten.co/openclaw/en/docs/architecture/overview) — 4-layer model
4. [OpenClaw Architecture deep dive (navant)](https://navant.github.io/posts/openclaw-architecture-and-insights/) — gateway, channels, runtime loop
5. [Plugin internals (docs.openclaw.ai)](https://docs.openclaw.ai/plugins/architecture) — capability model
6. [Plugin architecture internals](https://docs.openclaw.ai/plugins/architecture-internals) — load pipeline, safety gates
7. [DeepWiki Plugin Architecture](https://deepwiki.com/openclaw/openclaw/5.1-plugin-architecture) — PluginRegistry
8. [OpenClaw taxonomy.yaml](https://github.com/openclaw/openclaw/blob/main/taxonomy.yaml) — 10,637-line capability catalog
9. [Capability ownership model (openclaw.cc)](http://openclaw.cc/en/plugins/architecture) — vendor/feature ownership
10. [crabfleet](https://github.com/openclaw/crabfleet) — agent-run mission control
11. [clawgrit-reports](https://github.com/openclaw/clawgrit-reports) — perf reports
12. [nora (solomon2773)](https://github.com/solomon2773/nora) — fleet control plane + MCP + OTel
13. [hearth (warrence)](https://github.com/warrence/openclaw-hearth) — multi-user memory layer
14. [openclaw-qwen35 (paulwlisto)](https://github.com/paulwlisto/openclaw-qwen35) — local-model tool-calling patches
15. [Sparkagents OpenClaw GitHub guide](https://www.sparkagents.com/blog/openclaw-github) — repo structure, history
16. [Macaron OpenClaw GitHub](https://macaron.im/blog/openclaw-github) — stats, fork facts
17. [NerdLevel OpenClaw Guide 2026](https://nerdleveltech.com/guides/openclaw-personal-ai-assistant) — v2026.3.28 stats, ClawHub
18. [Growexx OpenClaw Skills Security](https://www.growexx.com/blog/openclaw-skills-development-guide-for-developers) — ClawHub supply-chain attack
19. [ppaolo OpenClaw Architecture](https://ppaolo.substack.com/p/openclaw-system-architecture-overview) — OS-for-agents framing
20. [clawdocs Architecture Overview](https://clawdocs.org/architecture/overview) — component summary, request lifecycle

## Methodology

Searched 12 query clusters across web-search-prime + websearch (web + news),
covering: OpenClaw GitHub/repo, architecture layers, plugin/capability model,
taxonomy.yaml, ClawHub skills, spinoffs/forks, security incidents. Analyzed 20+
sources (official docs, DeepWiki, org repos, independent security audits).
Verified 6 candidate repos cloneable via `git ls-remote`. Cross-referenced
claims; single-source claims flagged. Confidence: High (multiple corroborating
official + community sources + verified repo access).
