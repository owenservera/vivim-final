# Kimi Moonshot — Raw Research Notes

## Collected: 2026-07-23

## Key Findings

### Kimi Code CLI stack (from AGENTS.md + pyproject.toml)
- Python 3.12+ configured
- CLI: Typer with LazySubcommandGroup
- Async: asyncio
- LLM: kosong (pluggable chat providers) + KAOS (OS abstraction)
- MCP: fastmcp
- Logging: loguru
- Packaging: uv + PyInstaller
- Lint: ruff; Type: pyright + ty
- Test: pytest + pytest-asyncio
- Web UI: Node.js/npm (built-web embedded into package)

### kimi-moonshot/kimi-moonshot
- 100% Rust, Tauri-based
- MIT license
- Supports Mac (Intel + Apple Silicon), Windows (x64), Linux (AppImage)
- Releases end with ~6-70MB platform-specific binaries

### Leonxlnx/kimi-code-desktop
- Tauri v2 (modern; fixes kimi-moonshot's libwebkit2gtk-4.0 hard-link problem on Ubuntu 24.04+)
- Monorepo: apps/desktop (Tauri), apps/web (React), apps/server (ACP client, event projection, auth broker, Git, terminal, preview, update)
- Requires: Node.js 22, pnpm 10, Rust/Cargo, WebView2, Kimi Code CLI 0.26.0+
- Trust boundaries documented in docs/ARCHITECTURE.md
- Credentials never read by renderer; app preview isolated to localhost/127.0.0.1; no telemetry

### pisigmac/kimi-sandbox (production container runtime)
- FastAPI (port 8888) for Jupyter kernel lifecycle
- IPython kernel (ZeroMQ IPC)
- Playwright + CDP for browser (USE_CDP=1 switches to raw CDP)
- KasmVNC + Xvnc (1920x1080)
- s6-overlay as init
- socat CDP proxy: 9223 -> 9222
- SSH on :22

### danielnguyen/kimi-agent-internals
- Kimi is 6 agent types: Base Chat, OK Computer, Docs, Sheets, Slides, Websites
- Environment-based computing: persistent FS + Playwright + IPython
- Skill system: SKILL.md + progressive disclosure
- DOCX skill: C# + OpenXML SDK + .NET validator (73 files)
- XLSX skill: KimiXlsx binary (77MB)
- PDF skill: Tectonic (57MB) for LaTeX, or HTML+Paged.js
- WebApp skill: React + TypeScript + shadcn/ui

## Sources scraped
- DeepWiki: kimisoul/agent-loop, toolset, skills-system, runtime-DI, LLM-provider, app-lifecycle, tool-architecture
- GitHub repos: kimi-cli, kimi-moonshot, kimi-sandbox, kimi-agent-internals
- Official docs: kimi.com/help, kimi.com/code/docs, moonshotai.github.io

## Notes
- Kimi K2.6: 1T MoE total params, ~32B active per token, 256K context
- Kimi K3: Jul 2026 release; weights by Jul 27
- WebBridge supports Claude Code, Cursor, Codex, Hermes, OpenClaw — agent-agnostic
- All Kimi Work sessions run locally; cloud inference optional (K2.6 API available)
- Kimi Work in Beta (Jun 3 2026 launch); pricing $19-199/month
