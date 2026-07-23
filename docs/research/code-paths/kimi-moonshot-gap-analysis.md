# Kimi Baby MoonShot vs vivim-final — Gap Analysis + Priority Bridge List

**Confidence:** High | **Date:** 2026-07-23

## 1. Gap Inventory — vivim vs Kimi (Baby MoonShot)

### Gaps by Priority Tier

#### CRITICAL — vivim has no implementation at all

| Gap | Kimi Capability | vivim Status | Priority | Rationale |
|-----|-----------------|--------------|----------|-----------|
| **Desktop Shell (Tauri)** | Tauri v1/v2 + Rust backend + React frontend | None (backend-only) | P0 | First-class desktop presence is required for "Kimi Work" parity |
| **Agent-Skill System** | Markdown `SKILL.md` + layered discovery + auto-invoke | DB-driven `CapabilityBinding` only | P0 | Skills are the unit of agent expertise; Kimi validates Markdown-first approach |
| **MCP Plugin Framework** | fastmcp; stdio/HTTP/SSE transports; plugin marketplace | MCP routes exist but not first-class | P0 | Kimi Code makes MCP a native tool transport alongside builtins |
| **Agent Swarm Orchestrator** | 300 parallel sub-agents + result aggregation | None | P0 | Core 2026 differentiator — single-agent chat is commodity |
| **Goal-Mode Long-Horizon Execution** | Persistent goal state + acceptance criteria + multi-round autonomous execution | None | P0 | What transforms "chat" into "agent that keeps working while you sleep" |

#### HIGH — vivim has partial or plan-only implementation

| Gap | Kimi Capability | vivim Status | Priority | Rationale |
|-----|-----------------|--------------|----------|-----------|
| **CDP Browser Harness** | `browser_guard.py` (Playwright + raw CDP) + WebBridge local daemon | `ChromeGovernor` + `CdpSender` exist; no unified harness | P1 | Unified browser harness = simpler CDP integration for all providers |
| **Document Generation Skills** | DOCX/XLSX/PDF/PPT with domain-specific `SKILL.md` + toolchain | None | P1 | High user-value deliverables; `docx`/`xlsx`/`pptx` skills available as references |
| **Python Execution Kernel** | IPython kernel + Jupyter control plane + `jupyter_kernel.py` | None | P1 | Enables code execution skills, data analysis, agent compute |
| **Scheduled Task Engine** | Cron engine (daily/hourly/conditional + "Keep Computer Awake") | None | P1 | Kimi Work's "morning briefing" / "overnight data job" pattern |
| **Approval/Permissions Gate** | "Request permission" vs "Allow all" model with approval runtime | None | P1 | Required for desktop safety; mirrors Kimi's UX everywhere |

#### MEDIUM — vivim has comparable but Kimi has superior UX

| Gap | Kimi Capability | vivim Status | Priority | Rationale |
|-----|-----------------|--------------|----------|-----------|
| **Plugin Marketplace** | Trust-badged marketplace (official/curated/third-party) + `/plugins` TUI | None | P2 | Ecosystem growth vector — low urgency for v1 |
| **Widget System** | Interactive HTML/SVG widgets rendered in sandboxed iframes | `CapabilityCatalog.tsx` grid is static | P2 | Dashboard/persistent view layer; nice-to-have for Work mode |
| **File Isolation + Permission Boundaries** | `/mnt/kimi/` RO, `/mnt/okcomputer/` RW; plugin scope boundaries | Profile-level auth check only | P2 | Security hardening; Kimi's approach is clean |
| **Context Compaction** | `compaction.py` — automatic context window management | None | P2 | Long autonomous tasks require efficient context management |
| **Persona Injection** | McKinsey consultant persona for Slides mode | None | P2 | Domain-persona specialization without code changes |

#### LOW — vivim already has this capability

| vivim Capability | Kimi Equivalent | Notes |
|-----------------|-----------------|-------|
| `ChromeGovernator` (CDP governor) | `browser_guard.py` (Playwright + CDP) | vivim is more provider-diverse |
| `StreamParserEngine` + `CapabilityResolutionEngine` | `KimiToolset` + `kosong` | vivim's is more DB-driven with fallback chains |
| `ProviderRegistrar` + provider registry | Multi-provider LLM abstraction | vivim covers chatgpt/claude/gemini/deepseek/qwen/grok/facebook/slack/telegram/whatsapp/z-ai |
| `CapabilityEventBus` | `Wire` + `HookEngine` | Similar event bus pattern |
| `UnifiedCapabilityRegistry` | Tool registry in `KimiToolset` | vivim has cross-surface binding (CLI/UI/API/MCP) |

## 2. Full Tech Stack Requirements (Kimi-equivalent)

```
CLI/Desktop Layer:
  Tauri v1 or v2 (Rust + WebView)     ← desktop shell
  React 18+ (TypeScript)              ← desktop UI
  Node.js 22+                          ← desktop orchestration (monorepo)

CLI Agent Layer:
  Python 3.12+ (async, uv)
  Typer                                 ← CLI framework
  asyncio                               ← async runtime
  kosong / any-llm                      ← LLM abstraction
  KAOS (PyKAOS)                         ← OS abstraction layer
  fastmcp                                ← MCP client
  pytest + pytest-asyncio               ← testing
  ruff + pyright                         ← lint/typecheck
  PyInstaller                            ← binary builds

Agent Runtime Layer:
  FastAPI (Python)                      ← control plane (port 8888)
  IPython kernel + ZeroMQ               ← compute engine
  Playwright                             ← browser automation
  Chrome DevTools Protocol (CDP)         ← low-level browser control
  Jupyter client protocol                ← kernel RPC

Browser/Runner Layer:
  Chromium (--remote-debugging-port)     ← browser target (CDP)
  KasmVNC / Xvnc                         ← virtual desktop (if needed)
  s6-overlay                              ← init/service supervision
  socat                                   ← CDP port proxy

Skill/Plugin System:
  Markdown (SKILL.md)                    ← skill format
  D2 (Dagger-to-Dot)                      ← flow-skill diagrams
  JSON (plugin manifests)                 ← plugin packaging
  OAuth + MCP + hooks                     ← extension surfaces
  shadcn/ui + React                       ← webapp skill (if building UI add-ons)

Model APIs:
  Kimi K2.6 / K3 (Moonshot API)
  Mooncake disaggregated inference        ← Moonshot's serving stack
  OpenAI/Anthropic-compatible endpoints   ← for cross-provider
```

## 3. Build vs Harvest Decision Matrix

### BUILD (write from scratch in vivim)

| Component | Why Build | Approach |
|-----------|-----------|----------|
| **Agent Swarm Orchestrator** | No clean harvest target; highly domain-specific to vivim | New engine: `src/engines/agent-swarm.ts` — task decomposition via LLM, bounded parallelism, result aggregation |
| **Goal-Mode Long-Horizon Loop** | Mirrors vivim's existing `ContinuousLoop` but with state persistence | Extend `src/engines/continuous-loop.ts` — add goal state, acceptance criteria, multi-round autonomy |
| **Document Generation Pipeline** | Multiple output formats (DOCX/XLSX/PDF/PPT) | Use npm packages: `docx`, `xlsx`, `pdf-lib`, `pptxgenjs` — wrap as `DocumentGenerationEngine` |
| **Approval/Permissions Gate** | Desktop safety requirement | New engine: `src/engines/approval-gate.ts` — integrates with `CapabilityEventBus` |
| **Scheduled Task Engine** | Cron + "Keep Computer Awake" | Extend `CapabilityEventBus` with timer triggers; use OS-level `powercfg` on Windows |

### HARVEST (adopt libraries/systems)

| Component | Source / Library | Why Harvest |
|-----------|-----------------|-------------|
| **Tauri Desktop Shell** | `tauri-cli` v1/v2 | Proven by Kimi Work; Rust backend → TypeScript communication is async + typed |
| **Python Execution Kernel** | `jupyter-ai` + `jupyter_client` | Standard, battle-tested; Kimi's `jupyter_kernel.py` is ~17KB — extract the pattern |
| **MCP Client Integration** | `@modelcontextprotocol/sdk` | Kimi uses `fastmcp`; Node SDK equivalent exists; vivim already has MCP routes |
| **Browser Automation** | `playwright` + raw CDP (via `chrome-remote-interface`) | Kimi's dual-stack pattern is the reference; reuse vivim's existing `ChromeGovernor` |
| **Markdown Skill System** | None needed — write it | Simple: directory scan + SKILL.md loader + discovery hierarchy |
| **VDI Desktop (optional)** | KasmVNC + Xvnc | Only if vivim adds screenshot-based UI testing; likely overkill for v1 |

### LIBRARIES TO ADOPT

| Purpose | Library | Kimi Uses | vivim Version |
|---------|---------|-----------|---------------|
| Desktop shell | `tauri` | tauri v1 (Rust) | tauri v2 (Rust) |
| PDF rendering | `pdf.js` | Bundled Chrome extension | Add to Tauri webview |
| Excel generation | `xlsx` (npm) | KimiXlsx binary (Python) | `xlsx` npm |
| Word generation | `docx` (npm) | OpenXML SDK (C#) | `docx` npm |
| PPT generation | `pptxgenjs` | N/A (proprietary) | `pptxgenjs` npm |
| PDF generation | `pdf-lib` | Tectonic (LaTeX) | `pdf-lib` |
| Browser automation | `playwright` | Playwright + CDP | Already using CDP via `ChromeGovernor` |
| MCP SDK | `@modelcontextprotocol/sdk` | `fastmcp` (Python) | `fastmcp` equivalent Node SDK |
| LLM abstraction | `ai` (Vercel AI SDK) + `openai` | `kosong` (proprietary) | Vercel AI SDK (already present) |
| Python sandbox | `jupyter-ai` + `jupyter_client` | `jupyter_kernel.py` | New adoption |
| Scheduling | `croner` or `node-cron` | Cron engine (proprietary) | `node-cron` or OS cron |
| Service supervision | OS-level | s6-overlay (container) | Not needed for desktop; use Tauri process model |

## 4. Where to Harvest

### Immediate (copy patterns, not code)

| Source | What to Harvest | File |
|--------|-----------------|------|
| [pisigmac/kimi-sandbox](https://github.com/pisigmac/kimi-sandbox) | Container runtime pattern: CDP proxy, KasmVNC, browser lifecycle | `browser_guard.py` (~41KB), `jupyter_kernel.py` (~17KB), `kernel_server.py` |
| [cyijun/kimi-agent-internals](https://github.com/cyijun/kimi-agent-internals) | SKILL.md format, 6 agent types (Base Chat → OK Computer → Docs/Sheets/Slides/Websites), environment-based computing architecture | `prompts/ok-computer.md`, `skills/docx/SKILL.md`, `skills/xlsx/SKILL.md`, `skills/pdf/SKILL.md`, `skills/webapp-building/SKILL.md` |
| [kimi-moonshot/kimi-moonshot](https://github.com/kimi-moonshot/kimi-moonshot) | Tauri v1 desktop shell structure + Rust ↔ JS async bridge | `cli.js`, `package.json`, `src-tauri/` |
| [Leonxlnx/kimi-code-desktop](https://github.com/Leonxlnx/kimi-code-desktop) | Tauri v2 + React monorepo: 3-app layout, ACP client, durable event projection, sandboxed preview, VS Code-like UI | `apps/desktop/`, `apps/web/`, `apps/server/`, `docs/ARCHITECTURE.md` |

### Medium-term (adopt libraries)

| Source | What |
|--------|------|
| `pdf.js` + `pdfjs-dist` | PDF preview in Tauri webview (replaces missing viewer fix Kimi has open) |
| `xlsx` (npm) | Excel generation skill (replaces Kimi's 77MB KimiXlsx binary) |
| `docx` (npm) | Word generation skill (replaces C# OpenXML validator) |
| `pptxgenjs` | PowerPoint generation (Kim i has proprietary pipeline; vivim needs this) |
| `jupyter-ai` | Python execution kernel for agent compute |
| `@modelcontextprotocol/sdk` | MCP client library for Node.js (replaces Python `fastmcp`) |
| `node-cron` or `croner` | Scheduled task engine for Kimi Work-style background tasks |

### Long-term (no direct source; must build)

| Component | Why No Harvest Target |
|-----------|----------------------|
| **Agent Swarm Orchestrator** | Kimi's orchestration is internal/proprietary; no open-source swarm implementation exists yet |
| **Goal-Mode State Machine** | Kimi Work's goal persistence is a product-layer pattern, not a library |
| **300-Agent Parallel Execution** | No open-source equivalent at this scale; build as bounded-pool async orchestrator |

## 5. Verification Steps

1. **Architecture alignment:** Run `bun run devops architecture-audit` after adding Tauri layer to verify layer boundaries.
2. **Cross-surface parity:** `bun run devops verify-cross-surface` after adding shell commands or UI slots.
3. **Monorepo build:** Tauri `cargo tauri build` must succeed on Windows x64.
4. **MCP surface:** `bun run devops mcp status` should show Kimi-equivalent MCP server registry.
5. **Provider parser compatibility:** `bun test tests/unit/engines/stream-parser.test.ts` should still pass after adding browser harness.

## 6. Risk Assessment

- **Technical risk:** LOW for Tauri adoption (proven stack), MEDIUM for agent swarm (no reference implementation)
- **Integration risk:** MEDIUM — adding Tauri layer requires `src/` restructuring for IPC boundary
- **Maintenance risk:** LOW — Tauri + React + Node is well-understood; MCP SDK is stable
