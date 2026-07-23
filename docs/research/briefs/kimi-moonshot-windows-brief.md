# Kimi Moonshot Windows — Brief

**Source:** [full report](../reports/kimi-moonshot-windows-sota-2026.md)
**Confidence:** High | **Sources:** 18 | **Date:** 2026-07-23

## TL;DR

Moonshot AI released **Kimi Work** (June 2026) — a Windows/macOS desktop agent that runs up to 300 AI agents in parallel, controls your browser via CDP (WebBridge), reads/writes local files, executes Python/shell, and produces DOCX/XLSX/PDF/PPT deliverables — all while keeping sessions local. Backed by Kimi K2.6 (1T MoE) or K3 model. The CLI agent (Kimi Code) ships an MCP framework + markdown skill system directly translatable to vivim's capability registry.

## Key Decisions

1. **Tauri (Rust + WebView) is the desktop shell path** — official Kimi uses Tauri v1; Tauri v2 is viable as the unofficial Code Desktop demonstrates.
2. **Agent-skill system is Markdown-first** — `SKILL.md` + layered discovery. Directly maps to vivim's DB-driven capability/handler pattern (`UnifiedCapabilityRegistry` + `CapabilityBinding`).
3. **MCP is now table stakes** — Kimi Code treats MCP as a first-class tool transport alongside builtin. vivim already has MCP routes; they should be promoted to first-class surface.
4. **CDP browser automation = architecture choice** — Kimi's WebBridge + container CDP mirrors vivim's `ChromeGovernor`/`CdpSender` pattern. Kimi validates this; vivim should standardize.
5. **Multi-agent swarm = product moat** — 300 parallel agents with goal-mode persistence is the 2026 differentiator. Single-agent chat is commodity.
6. **Local-first = privacy moat** — All WebBridge + desktop execution stays on-device. Kimi Work explicitly markets this vs cloud-sandbox competitors.

## Evidence Summary

- [MoonshotAI/kimi-cli]: Python 3.12 + Typer + kosong + KAOS + fastmcp — exact stack (10.6k stars)
- [kimi-moonshot/kimi-moonshot]: 100% Rust + Tauri — official desktop backend
- [Leonxlnx/kimi-code-desktop]: Tauri v2 + React + TS + Node orchestration monorepo — viable modern path
- [pisigmac/kimi-sandbox]: Full container stack — FastAPI + Jupyter + Playwright + CDP + s6 + KasmVNC
- [dnnynguyen/kimi-agent-internals]: Environment-based computing validated — persistent FS + Playwright + IPython = agent OS
- [Kimi K3 blog]: $0.30/MTok input, $15/MTok output, Mooncake disaggregated inference >90% cache hit
- [Decrypt/TechnologiesDigest]: 300-agent swarm, Goal mode, $19-199/month pricing tiers, Jun 2026 launch
- [Kimi Help Center]: Skill system, scheduled tasks, WebBridge, plugin center — feature validation

## Open Questions

1. How does vivim's `CapabilityResolutionEngine` compare to Kimi's skill-based environment model (connectivity vs cognition split)?
2. Can vivim's existing `StreamParserEngine` + `ChromeGovernor` be unified into a single "browser harness" similar to `browser_guard.py`?
3. Should vivim adopt an MCP-first tool model (like Kimi Code) vs current CDP-first provider model?
4. What is the Kimi API's streaming format for K3 — is it compatible with vivim's provider parser chain?
5. Kimi Work's "Goal mode" = persistent state + agent loop + acceptance criteria — can this map to vivim's `ContinuousLoop` concept?

## Used In
- Architecture gap analysis vs Kimi Baby MoonShot
- vivim-proto desktop wrapper selection (Tauri recommended)
- Agent-skill system redesign (Markdown-first layered discovery)
