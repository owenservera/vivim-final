<![CDATA[<div align="center">

# Vivim

**Talk to every AI from one place.**

[![GitHub release](https://img.shields.io/github/v/release/owenservera/vivim-final?include-prereleases)](https://github.com/owenservera/vivim-final/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3.14-%23000000?logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Next.js-16-%23000000?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-%23007ACC?logo=typescript)](https://www.typescriptlang.org)

[Download](#download) • [How It Works](#how-it-works) • [Quick Start](#quick-start) • [Architecture](#architecture) • [Docs](#documentation) • [Contributing](#contributing)

</div>

---

## What Is Vivim?

Vivim is a **local-first AI conversation platform** that connects to ChatGPT, Claude, Gemini, DeepSeek, Qwen, and Grok through a single interface. It runs entirely on your machine — no cloud account required.

Instead of writing provider-specific code, Vivim uses a **capability system**: every provider interaction is a typed, composable operation with a single API. You describe what you want in natural language, and the system figures out how to do it.

---

## How It Works

Three core concepts make Vivim work:

### Capabilities

A **capability** is an atomic operation — `send_message`, `select_model`, `create_chat`, `upload_file`. Every capability has a unique ID (like `cap:chat:send_message`), a category, and bindings to multiple surfaces (CLI, API, MCP, UI).

When you type "send a message to Claude," the **Capability Resolution Engine** translates that into a resolved capability with a confidence score, then executes it against the right provider.

```
You: "send a message to Claude"
  ↓
Capability Resolution: cap:chat:send_message (confidence: 0.95)
  ↓
Provider Routing: Claude
  ↓
Execution via Chrome Governor
  ↓
Response streamed back to you
```

### Providers

Each AI provider is described by a **manifest** — a declarative JSON document that declares endpoints, browser selectors, streaming parsers, model lists, and capabilities. Vivim currently supports **16 registered providers** with full streaming support for ChatGPT, Claude, Gemini, DeepSeek, Qwen, and Grok.

Providers are connected through authenticated Chrome browser profiles — Vivim interacts with them the same way you would in a browser, but automated.

### Chrome Governor

The **ChromeGovernor** is the single point of control for all browser interaction. It manages Chrome processes, proxies commands through the Chrome DevTools Protocol (CDP), logs traces for debugging, and enforces a hard architectural rule: **no other engine touches the browser directly**.

This keeps the system predictable and debuggable.

---

## Download

### Windows Installer (Recommended)

Download the latest installer from [GitHub Releases](https://github.com/owenservera/vivim-final/releases):

- **[vivim-desktop-setup.exe](https://github.com/owenservera/vivim-final/releases/latest/download/vivim-desktop-setup.exe)** (~44 MB)
  - Includes backend server, frontend UI, and desktop launcher
  - Installs to `%LOCALAPPDATA%\Vivim`
  - Creates Start Menu and Desktop shortcuts

### Manual Installation

```bash
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final

bun install
cd frontend && bun install && cd ..

cp .env.example .env
bun run prisma:generate
bun x prisma migrate dev
bun run seed
bun run dev
```

This starts:
- **Backend** at `http://localhost:9420` (API + WebSocket)
- **Frontend** at `http://localhost:3000` (Next.js)

Open `http://localhost:3000` to start chatting.

---

## Quick Start

### 1. Install

Either download the Windows installer or clone the repo (see above).

### 2. Configure

Set your API keys in `.env` (defaults work for local dev — keys only needed for live provider connections):

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

### 3. Launch

```bash
bun run dev
```

### 4. Use

Open `http://localhost:3000` and start a conversation. The CLI is also available:

```bash
bun run src/cli/index.ts
```

---

## Architecture

### System Layers

```
┌──────────────────────────────────────────────────────┐
│                   SURFACES                            │
│   CLI  ·  HTTP API  ·  WebSocket  ·  MCP  ·  UI     │
├──────────────────────────────────────────────────────┤
│                CAPABILITY LAYER                       │
│   Resolution  ·  Execution  ·  Taxonomy  ·  Events  │
├──────────────────────────────────────────────────────┤
│               PROVIDER LAYER                          │
│   Registrar  ·  Health  ·  Parsers  ·  Chrome Gov.   │
├──────────────────────────────────────────────────────┤
│                 DATA LAYER                            │
│   Prisma (SQLite)  ·  Node Model  ·  Store Contracts │
└──────────────────────────────────────────────────────┘
```

### Engine Architecture

The system is built around **13 core engines** organized in layers, with 455+ engine files total:

| Layer | Engines | Job |
|-------|---------|-----|
| **Provider KG** | ProviderRegistrar, ProviderHealthKernel | Register providers, track health |
| **Capabilities** | CapabilityResolutionEngine, CapabilityEngine | Resolve & execute operations |
| **Session** | ConversationManager, StreamBlockStore | State, history, streaming |
| **Chrome** | ChromeGovernor | Browser automation, CDP proxy |
| **Cross-cutting** | EventBus, ConfigManager, StreamParser | Shared infrastructure |

### Data Flow

1. You type a message
2. The system resolves which capability to execute
3. The request is routed to the appropriate AI provider
4. The response streams back in real-time
5. Everything is persisted to a local SQLite database

See [Architecture Docs](docs/architecture/OVERVIEW.md) for the full picture.

---

## Documentation

| Area | Document | What It Covers |
|------|----------|----------------|
| **Architecture** | [Overview](docs/architecture/OVERVIEW.md) | 30-second mental model |
| | [Engines](docs/architecture/ENGINES.md) | Every engine and its code path |
| | [Data](docs/architecture/DATA.md) | Schema, Node model, store contracts |
| | [API](docs/architecture/API.md) | Routes, WebSocket, surfaces |
| | [Frontend](docs/architecture/FRONTEND.md) | React UI, canvas, slots |
| **Runbooks** | [Dev](docs/runbooks/DEV.md) | Local development |
| | [Desktop](docs/runbooks/DESKTOP.md) | Tauri build & testing |
| | [Providers](docs/runbooks/PROVIDERS.md) | Provider setup & testing |
| **Decisions** | [ADR Index](docs/decisions/README.md) | Architecture decisions |

---

## Development

### Prerequisites

- **Bun** 1.3.14+ ([Install](https://bun.sh))
- **Node.js** 20+ ([Install](https://nodejs.org))
- **Git** ([Install](https://git-scm.com))

### Setup

```bash
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final

bun install
bun run prisma:generate
bun run seed
bun run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server (backend + frontend) |
| `bun run build` | Production build |
| `bun run test` | Run all tests |
| `bun run test:fast` | Unit + architecture tests |
| `bun run typecheck` | Type-check the codebase |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format code with Biome |
| `bun run seed` | Re-seed database |
| `bun run stop` | Kill orphaned dev processes |

### Desktop Build

```bash
# Full desktop build (NSIS installer)
pwsh scripts/tauri/build.ps1

# DevOps toolkit (hash-gated rebuild + test)
bun run devops desktop-loop run --version <x.y.z>
```

See [Desktop Runbook](docs/runbooks/DESKTOP.md) for details.

### Testing

```bash
bun test                    # All tests
bun run test:unit           # Unit only
bun run test:integration    # Integration only
bun run test:e2e            # E2E (Playwright)
bun run test:arch           # Architecture boundary tests
```

---

## Project Structure

```
vivim-final/
├── src/
│   ├── engines/          # 455+ engine files (core logic)
│   ├── server/           # HTTP API + WebSocket
│   ├── cli/              # CLI entry point
│   ├── storage/          # Database contracts + implementations
│   ├── schema/           # Zod validation schemas
│   └── mcp/              # Model Context Protocol
├── frontend/
│   └── src/
│       ├── app/          # Next.js App Router
│       ├── components/   # React components
│       ├── canvas/       # Canvas live-config
│       ├── engines/      # Frontend engines
│       └── ui/           # Slot system
├── prisma/
│   └── schema.prisma     # 196 models, 3,800+ lines
├── seeds/                # Provider manifests, parsers, capabilities
├── tests/                # Unit, integration, E2E
├── docs/                 # Documentation
├── devops/               # DevOps toolkit
└── scripts/              # Build & utility scripts
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

```bash
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final
bun install && bun run prisma:generate && bun run seed
bun run dev
```

### What to Work On

- **Bug fixes** — Check [issues](https://github.com/owenservera/vivim-final/issues)
- **New capabilities** — Register in `src/engines/capability-bootstrap/`
- **Provider support** — Add manifests in `seeds/providers/manifests.ts`
- **Documentation** — Improve docs in `docs/`
- **Tests** — Increase coverage in `tests/`

### Code Standards

- **TypeScript** — Strict mode, no `any`
- **Biome** — Formatting and linting
- **Conventional Commits** — `feat:`, `fix:`, `docs:`, etc.
- **Store Contracts** — Never import `impl/` directly from engines

---

## Security

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. **Email** security@vivim.dev with details
3. **Wait** for response before public disclosure

See [SECURITY.md](SECURITY.md) for more information.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[Download Vivim Desktop](https://github.com/owenservera/vivim-final/releases/latest/download/vivim-desktop-setup.exe)** • **[Read the Docs](docs/)** • **[GitHub](https://github.com/owenservera/vivim-final)**

</div>
]]>
