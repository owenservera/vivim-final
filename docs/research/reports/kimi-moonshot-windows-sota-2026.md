# Kimi Moonshot / Baby MoonShot Windows: Research Report
*Generated: 2026-07-23 | Sources: 18 | Confidence: High*

## Executive Summary

Kimi (Moonshot AI) is a multi-surface AI product family — chat, desktop agent (Kimi Work), CLI agent (Kimi Code), and browser extension (WebBridge) — all shipping for Windows 10/11 as of mid-2026. The desktop app is built with Tauri v1/Rust + React, Kimi Work adds a local agent kernel with multi-agent swarm (up to 300 parallel sub-agents), and the CLI is a Python/Typer app with MCP support. The underlying models are Kimi K2.6 (Moonshot proprietary 1T MoE, open-weight) and the newly released K3. For vivim-final, the highest-value gaps are: **Tauri desktop shell**, **agent-skill system**, **MCP plugin framework**, **CDP browser automation harness**, **Python execution kernel**, **multi-agent swarm orchestration**, **Goal-mode long-horizon task execution**, and **document-generation skills** (DOCX/XLSX/PDF/PPT).

## 1. Product Surface Architecture

Kimi ships four coordinated products, all available on Windows:

| Product | Form | Core Tech |
|---------|------|-----------|
| **Kimi Chat** | Web + desktop wrapper | Tauri v1 (kimi-moonshot repo, Rust) + Electron wrappers exist unofficially |
| **Kimi Work** | Desktop agent (Windows/macOS) | Tauri v1 + Rust backend + React frontend; powered by Kimi Code kernel |
| **Kimi Code** | Terminal + VS Code | Python 3.12 + Typer + asyncio + kosong (LLM layer) + KAOS (OS abstraction) |
| **WebBridge** | Chrome/Edge extension + local daemon | CDP-based, agent-agnostic (works with Claude Code, Codex, Cursor, Hermes) |

The official desktop app (`kimi-moonshot/kimi-moonshot`) is **100% Rust** at the backend, using Tauri v1. An unofficial open-source variant (`Leonxlnx/kimi-code-desktop`) exists as **Tauri v2 + React + TypeScript + Node.js orchestration**, 3-app monorepo (`desktop`, `web`, `server`).

## 2. Agent Runtime Architecture

### Kimi Code CLI (`MoonshotAI/kimi-cli`)
- **Language:** Python 3.12+
- **CLI framework:** Typer
- **Async runtime:** asyncio
- **LLM framework:** kosong (Abstraction over OpenAI/Anthropic/Moonshot APIs)
- **OS abstraction:** KAOS (PyKAOS) — file ops + command execution, switchable between local and SSH
- **MCP integration:** fastmcp (stdio/HTTP/SSE transports)
- **Tool system:** `KimiToolset` with dependency injection via Python `inspect`
- **Testing:** pytest + pytest-asyncio
- **Lint/format:** ruff
- **Type checking:** pyright + ty
- **Binary builds:** PyInstaller; distributed as ~65-90MB platform-specific archives

### Kimi Worker Container (cloud side, `pisigmac/kimi-sandbox`)
- **Init:** s6-overlay 3.1.6.2 (service mesh, proper signal forwarding + restart)
- **Control plane:** FastAPI on port 8888 (`kernel_server.py`)
- **Compute:** IPython kernel via ZeroMQ (10-step budget Base Chat, unlimited OK Computer)
- **Browser:** Playwright + CDP (`browser_guard.py`, 41KB) — `BrowserGuard` (Playwright) and `BrowserCDPGuard` (raw CDP)
- **Desktop:** KasmVNC + Xvnc at 1920×1080 on `:99`, WebSocket port 6080
- **SSH:** port 22
- **CDP proxy:** socat maps `9222 → 9223`
- **Filesystem:** `/mnt/kimi/` (read-only, Base Chat) and `/mnt/okcomputer/` (read-write, agentic)
- **PDF viewer:** Bundled Chrome extension (PDF.js with CJK font support)

## 3. Agent Swarm Architecture

Kimi Work supports up to **300 parallel sub-agents** (K2.6 model, MoE 1T params/32B active), with:
- Autonomous task decomposition by the LLM
- Goal-mode persistent state (runs until acceptance criteria met)
- 4,000+ coordinated tool calls per session
- 13-hour continuous execution windows
- Permission control: "Request permission" vs "Allow all"
- Result aggregation across parallel branches
- Cron scheduling engine (daily/hourly/conditional + "Keep Computer Awake")

## 4. Skill System

Kimi's skill system is **Markdown-first** (`SKILL.md`), scoped hierarchically:
- **Discovery order:** Project (.kimi-code/skills/) → User (~/.kimi/skills/) → Generic (~/.agents/skills/) → Builtin
- **Types:** `standard` (instructional, auto-invoked by LLM) and `flow` (multi-step D2 flowchart)
- **Skill injection:** Metadata (name/description) injected into system prompt; body loaded on demand
- **Built-in skills:** DOCX (C# + OpenXML + .NET validator, 73 files), XLSX (Python + KimiXlsx 77MB binary), PDF (Tectonic/LaTeX, 57MB), WebApp (React + TypeScript + shadcn/ui, 73 files)
- **Plugin system:** Plugins package skills + slash commands + MCP servers + hooks; install from local dir/zip/URL; trust badges (official/curated/third-party)

## 5. WebBridge (CDP Browser Automation)

- **Architecture:** Agent → Local bridge service → Chrome DevTools Protocol → Chrome/Edge
- **Security:** All commands + content stay on-device; no cloud relay
- **Features:** Navigation, clicking, form filling, screenshot capture, DOM extraction, login session reuse
- **Agent-agnostic:** Works with Kimi Code, Claude Code, Cursor, Codex (via ACP), Hermes
- **Tab labeling:** `agent:kimi` labels on automated tabs — true parallel human-agent browsing
- **Install:** Shell script for daemon + Chrome Web Store extension

## 6. Model Stack

| Model | Params | Active | Context | Release |
|-------|--------|--------|---------|---------|
| K2.5 | Large MoE | ~32B/token | 256K | Early 2026 |
| K2.6 | ~1T MoE | ~32B/token | 256K | Apr 2026 |
| K3 | Latest | N/A | N/A | Jul 2026 |

K3 pricing: $0.30/MTok cache-hit input, $3.00 cache-miss input, $15.00/MTok output. Uses Mooncake disaggregated inference (>90% cache hit in coding workloads).

## Key Takeaways

1. **Environment-based computing beats tool-use:** Kimi's shift to persistent filesystem + browser + code execution (instead of discrete API calls) is validated by their sandboxed container runtime. vivim should explore this pattern.
2. **Skill system is portable:** Markdown-first design + layered discovery works across CLI, desktop, and container — directly translatable to vivim's `cap-store.*` schema approach.
3. **Tauri v1 is the current desktop standard:** vivim's desktop wrapper should target Tauri (Rust + WebView) — the official Kimi uses Tauri v1, unofficial Code Desktop uses Tauri v2.
4. **MCP is now first-class:** Kimi Code CLI treats MCP as a native transport alongside builtin tools. vivim already has MCP routes — Kimi validates this architecture choice.
5. **CDP + local-first browser is the emerging pattern:** Kimi's WebBridge + container CDP setup aligns with vivim's `ChromeGovernor`/CDP governor canon. Cross-pollination opportunities exist.
6. **Swarm orchestration is 2026's differentiator:** 300-agent parallel execution with goal persistence is a product moat — not just "agent runs tools" but "agent swarm delivers reports."

## Sources
1. [MoonshotAI/kimi-cli (GitHub)](https://github.com/MoonshotAI/kimi-cli) — Primary source for CLI architecture
2. [kimi-moonshot/kimi-moonshot (GitHub)](https://github.com/kimi-moonshot/kimi-moonshot) — Official Rust/Tauri desktop
3. [Leonxlnx/kimi-code-desktop (GitHub)](https://github.com/Leonxlnx/kimi-code-desktop) — Tauri v2/React variant
4. [pisigmac/kimi-sandbox (GitHub)](https://github.com/pisigmac/kimi-sandbox) — Full container runtime
5. [dnnyngyen/kimi-agent-internals (GitHub)](https://github.com/dnnynguyen/kimi-agent-internals) — Architecture analysis
6. [Kimi Work Overview](https://www.kimi.com/help/kimi-work/overview) — Official doc
7. [Kimi WebBridge](https://www.kimi.com/features/webbridge) — Browser extension
8. [Kimi K3 Blog](https://www.kimi.com/en/blog/kimi-k3) — Latest model release
9. [Decrypt: Kimi Work 300 Agents](https://decrypt.co/370954/moonshot-ai-kimi-work-300-agents-desktop)
10. [TechnologiesDigest: Kimi Work](https://technologiesdigest.com/moonshot-ais-kimi-work-brings-300-ai-agents-to-your-desktop/)
11. [WindowsMode: Kimi for Windows](https://www.windowsmode.com/kimi-for-windows/)
12. [4sapi: Kimi Work AI Office Agent](https://blog.4sapi.com/blog/kimi-work-ai-office-agent)
13. [AnalyticsVidhya: WebBridge Guide](https://www.analyticsvidhya.com/blog/2026/05/kimi-webbridge/)
14. [BestHub: WebBridge Technical](https://www.besthub.dev/articles/how-kimi-webbridge-lets-ai-control-your-browser-like-a-human-4426d79b39b5)
15. [MoClaw Blog: WebBridge](https://moclaw.ai/blog/kimi-webbridge-browser-agent)
16. [Kimi Code Docs: Plugins](https://moonshotai.github.io/kimi-code/en/customization/plugins.html)
17. [Kimi Code Docs: MCP](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html)
18. [Kimi Code Docs: Skills](https://moonshotai.github.io/kimi-code/en/customization/skills.html)

## Methodology
Searched 9 queries across web, news, and GitHub. Analyzed 18 sources including primary code repositories, official documentation, and independent analyses. Kimi sandbox reverse-engineering artifacts used for system prompt, source code, and tool schema extraction.
