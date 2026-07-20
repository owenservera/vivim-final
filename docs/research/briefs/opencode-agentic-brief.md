# OpenCode Agentic Dev Loops & Subagent Orchestration — Brief

**Source:** [impl docs](../reports/opencode-agentic-impl-docs-2026.md) · [capability inventory](../reports/opencode-agentic-capabilities-sota-2026.md)
**Confidence:** High | **Sources:** 8 official + vivim source | **Date:** 2026-07-19

## TL;DR
Full official OpenCode surface for agentic loops + subagent orchestration is extractable and mappable
to vivim as a **`local-agent` provider type** (Shape B): 31 distinct capabilities across 6 classes
(execution, subagent orchestration, agent config, tool bridge, HTTP/server bridge, observability).
Implementation reuses `UnifiedCapabilityRegistry`, `CapabilityComposer`, `StreamParserEngine`,
`CapabilityEventBus` — no CDP, ChromeGovernor untouched.

## Key Decisions
1. **Integration shape:** `provider_type: 'local-agent'` (new enum), not a CDP entry. Executor shells
   `kilo/opencode run --auto` or POSTs to `serve`.
2. **Orchestration primitive:** OpenCode Task tool + `permission.task` scoping + child sessions →
   model as `CapabilityComposer` DAG nodes, each invoking `--agent <id>`.
3. **Per-agent axes** (model, temperature, top_p, steps, permission, hidden, mode, pass-through opts)
   map 1:1 to capability fields / `CapabilityContext.metadata`.
4. **Tool surface (17 tools)** becomes 17 `tags:['agent-tool']` capabilities, each permission-gated.

## Evidence Summary
- OpenCode agents: primary/subagent/all modes, `@`-mention, Task tool, `permission.task` scoping, hidden subagents (confidence: High — official docs)
- `opencode run --auto --format json` + `serve` OpenAPI 3.1 + `acp` nd-JSON (confidence: High)
- 5 built-in agents (Build/Plan/General/Explore/Scout) + hidden Compaction/Title/Summary (confidence: High)
- vivim `UnifiedCapability` shape (`src/engines/unified-registry.ts`) accommodates all 31 caps (confidence: High — local)
- `serve` hang risk → prefer `run` for unattended (confidence: Medium — single community issue)

## Open Questions
- Should `local-agent` reuse `ProviderRegistrar` seed path or a dedicated `LocalAgentStore`? (impl docs choose dedicated store.)
- Background subagents (`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS`) — stable enough to expose as `isAsync` caps?

## Tested Truth (2026-07-19, executed on host)
- `opencode` installed via bun; **Zen free** models need NO API key, cost 0.
- Verified working free: `opencode/deepseek-v4-flash-free`, `opencode/hy3-free` (Tencent), `opencode/mimo-v2.5-free`, `opencode/north-mini-code-free`.
- `opencode/nemotron-3-ultra-free` → **excluded** (no output in 5 min).
- `--format json` stream (`step_start`/`text`/`step_finish`) parses directly to `ContentBlock[]`.
- `serve` starts **unsecured** unless `OPENCODE_SERVER_PASSWORD` set (observed log).
- Kilo parity: Kilo 1.0 is the OpenCode fork and shares `run`/`serve`/`acp` — both binaries present on host; treat as same surface.

## Used In
- (proposed) ADR: "Agent backends as vivim providers (local-agent)"
- `devops` / `vivim-runtime` headless dev-loop backend
- Subagent fan-out via `CapabilityComposer`
