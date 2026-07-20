# OpenClaw Research — Raw Notes

*Collected: 2026-07-19*

## Repo verification (git ls-remote, 2026-07-19)
- openclaw/openclaw: live, 383K stars, main + many branches (316, 325, 354...)
- openclaw/crabfleet: live (branches: agent/dependency-freshness, codex/appgarden-trusted-proxy)
- openclaw/clawgrit-reports: live (main + agent/sync-pr-template-20260713)
- solomon2773/nora: live (chore/* branches, MCP + OTel)
- warrence/openclaw-hearth: live (main + release/v1.0.1)
- paulwlisto/openclaw-qwen35: live (main)

## Key raw observations
- OpenClaw = "OS for AI agents": LLM = brain, OpenClaw = execution env.
- 4 layers: Gateway (WS :18789) / Reasoning / Memory (WAL+compaction) / Skills.
- PluginRegistry: capability-ownership model (company/feature boundary).
- taxonomy.yaml: 10,637 lines / 635 KB at repo root — prime seed for devops-generators.
- Load pipeline does safety gates BEFORE runtime: path-escape, world-writable,
  ownership mismatch. Manifest = control-plane source of truth.
- Slot-kinds (memory, context-engine) = at-most-one plugin per slot.
- ClawHub supply-chain attack: 324 -> 824 malicious skills (Koi/Snyk/Cisco).
  -> HARVEST STRUCTURE ONLY. Never execute cloned SKILL.md / plugin runtime.

## Spinoffs considered & rejected
- Open-claw-org/open-claw.org (1 star, one-click deploy UI, unaffiliated) — skip
- juca-dev/openclaw-clone (0 star full clone, no novelty) — skip, use upstream
- fiilyai/openclaw (distro fork, no novel caps) — skip

## Next action
Clone 6 verified repos into research-clones/ with --depth 1, then parse
taxonomy.yaml for devops-generators seed ingestion.
