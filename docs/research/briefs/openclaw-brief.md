# OpenClaw — Brief

**Source:** [full report](../reports/openclaw-sota-2026.md)
**Confidence:** High | **Sources:** 28 | **Date:** 2026-07-19

## TL;DR

OpenClaw is a 335K–383K-star MIT-licensed local-first AI agent gateway with a
Gateway/Reasoning/Memory/Skills four-layer architecture and a `PluginRegistry`
capability-ownership model. Its `taxonomy.yaml` (10.6K-line capability catalog)
and capability model are structural siblings of vivim's `UnifiedCapability` +
`CapabilityResolutionEngine`. Harvest **architecture shape + taxonomy corpus**,
not executable code (ClawHub had a major supply-chain attack).

## Key Decisions

1. **Harvest the shape, not the code.** OpenClaw mirrors vivim's store-contract /
   capability-ownership invariants. Use it as a proven reference model.
2. **Clone 6 repos locally** into `research-clones/`: `openclaw/openclaw` (core),
   `openclaw/crabfleet`, `openclaw/clawgrit-reports`, `solomon2773/nora`,
   `warrence/openclaw-hearth`, `paulwlisto/openclaw-qwen35`.
3. **Feed `taxonomy.yaml` into `devops-generators`** as a real-world capability
   seed corpus (providers, channels, media, tools).
4. **Treat all ClawHub skills as untrusted** — harvest only structure, never
   execute `SKILL.md` content (824 malicious skills found in 2026 audits).

## Evidence Summary

- OpenClaw capability-ownership model (vendor/feature boundaries, slot-kinds): High confidence (official docs.openclaw.ai + openclaw.cc)
- `taxonomy.yaml` = 10,637-line capability catalog: High (verified file on GitHub)
- PluginRegistry load pipeline + pre-execution safety gates: High (docs + DeepWiki)
- crabfleet/nora as agent-run observability + fleet MCP: High (verified repos)
- ClawHub supply-chain attack (324→824 malicious skills): High (Koi/Snyk/Cisco audits cited)
- qwen35 local-model tool-calling patches: Medium (single repo, niche but directly relevant)

## Open Questions

- ~~Exact schema of `taxonomy.yaml` capability nodes~~ — RESOLVED (Step A done):
  `areas[]→categories[]→features[]` with `coverageIds[]`; parse logic in
  `scripts/taxonomy-gen/lib/openclaw-harvest.ts`. Produces 3,695 pipeline-valid
  nodes into `seeds/taxonomy/openclaw-harvest.json`.
- Whether OpenClaw's slot-kind "at-most-one plugin per slot" maps to vivim's
  `surfaces: ['cli','ui','api']` multi-surface parity or to a different contract.
  → RESOLVED (Step C): maps to `CapabilityBinding` single-active-result resolution
  in `capability-resolution.ts` (one active binding per provider+capability).
- License compatibility of harvested *patterns* (MIT — fine for architecture
  inspiration; confirm before any literal code copy).

## Used In

- Harvest strategy for vivim capability taxonomy + engine enhancement
- Potential `devops-generators` seed corpus expansion
- TelemetryAggregator / ChromeGovernor fleet surface inspiration

## Execution Status (Harvest Steps)

| Step | Status | Artifact |
|------|--------|----------|
| A — parse `taxonomy.yaml` → vivim nodes | DONE | `seeds/taxonomy/openclaw-harvest.json` (3,695 nodes) |
| B — merge into shared pool + regen | DONE | master pool 226→3,921 nodes; `verify-cross-surface` 3548/3548 pass |
| C — capability-ownership model translation | DONE | `docs/research/code-paths/openclaw-capability-ownership.md` |
| D — harvest observability (crabfleet/nora) | DONE | `docs/research/code-paths/openclaw-observability.md` |
