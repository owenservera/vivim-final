<![CDATA[<div align="center">

# Vivim Desktop

**Local-first AI conversation platform with multi-provider support**

[![GitHub release](https://img.shields.io/github/v/release/owenservera/vivim-final?include-prereleases)](https://github.com/owenservera/vivim-final/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3.14-%23000000?logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Next.js-16-%23000000?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-%23007ACC?logo=typescript)](https://www.typescriptlang.org)

[Download](#download) • [Documentation](#documentation) • [Features](#features) • [Architecture](#architecture) • [Contributing](#contributing)

</div>

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
# Clone the repository
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final

# Install dependencies
bun install

# Set up database
bun run prisma:generate
bun run seed

# Start development server
bun run dev
```

---

## Documentation

### Quick Start

1. **Install** the Windows installer or clone the repository
2. **Configure** your API keys in `.env` (see [Configuration](#configuration))
3. **Launch** Vivim Desktop from Start Menu or run `bun run dev`
4. **Access** the web interface at `http://localhost:9420`

### User Guide

- **[Getting Started](docs/USER-GUIDE.md#getting-started)** — First-time setup and configuration
- **[Providers](docs/USER-GUIDE.md#providers)** — Connect to AI providers (ChatGPT, Claude, Gemini, etc.)
- **[Conversations](docs/USER-GUIDE.md#conversations)** — Manage chat sessions and history
- **[Capabilities](docs/USER-GUIDE.md#capabilities)** — Use built-in and custom capabilities
- **[Desktop App](docs/USER-GUIDE.md#desktop-app)** — Using the Windows desktop application

### Developer Documentation

- **[Architecture](docs/ARCHITECTURE.md)** — System design and engine overview
- **[API Reference](docs/API.md)** — REST API endpoints and WebSocket protocol
- **[Provider Integration](docs/PROVIDERS.md)** — Adding new AI providers
- **[Engine Development](docs/ENGINES.md)** — Building custom engines
- **[Frontend Development](docs/FRONTEND.md)** — React component development

### Operations

- **[Deployment](docs/DEPLOYMENT.md)** — Production deployment guide
- **[Configuration](docs/CONFIGURATION.md)** — Environment variables and settings
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** — Common issues and solutions

---

## Features

### Multi-Provider AI Support

Connect to multiple AI providers simultaneously:

| Provider | Status | Models |
|----------|--------|--------|
| **ChatGPT** | ✅ Full Support | GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo |
| **Claude** | ✅ Full Support | Claude 3.5 Sonnet, Claude 3 Opus |
| **Gemini** | ✅ Full Support | Gemini 1.5 Pro, Gemini 1.5 Flash |
| **DeepSeek** | ✅ Supported | DeepSeek Chat, DeepSeek Coder |
| **Qwen** | ✅ Supported | Qwen-Turbo, Qwen-Plus |
| **Grok** | ✅ Supported | Grok-2, Grok-2 Mini |

### Capability System

- **Unified Capabilities** — Single API for all provider operations
- **Natural Language Interface** — Execute capabilities using plain English
- **Custom Capabilities** — Build and register your own capabilities
- **Cross-Surface Parity** — Same capabilities via CLI, API, MCP, and UI

### Desktop Application

- **Native Windows Installer** — One-click installation
- **System Tray** — Runs in background
- **Auto-Updates** — Automatic version management
- **Offline Support** — Local-first architecture

### Developer Experience

- **TypeScript** — Full type safety across the stack
- **Bun Runtime** — Fast development and production builds
- **Prisma ORM** — Type-safe database operations
- **Hot Reload** — Instant feedback during development

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Vivim Desktop                          │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 16)          Backend (Bun + TypeScript)  │
│  ┌─────────────────┐            ┌─────────────────┐        │
│  │  React 19 UI    │◄──────────►│  API Server     │        │
│  │  Tailwind CSS   │  WebSocket │  Port 9420      │        │
│  │  Radix UI       │            │                 │        │
│  └─────────────────┘            └────────┬────────┘        │
│                                          │                  │
│                              ┌───────────▼───────────┐     │
│                              │    Engine Layer       │     │
│                              │  ┌─────────────────┐  │     │
│                              │  │ CapabilityEngine│  │     │
│                              │  │ ProviderEngine  │  │     │
│                              │  │ SessionEngine   │  │     │
│                              │  │ StreamEngine    │  │     │
│                              │  └─────────────────┘  │     │
│                              └───────────┬───────────┘     │
│                                          │                  │
│                              ┌───────────▼───────────┐     │
│                              │    Storage Layer      │     │
│                              │  ┌─────────────────┐  │     │
│                              │  │ Prisma + SQLite  │  │     │
│                              │  │ Local Database   │  │     │
│                              │  └─────────────────┘  │     │
│                              └───────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Engine Architecture

Vivim uses a 13-engine architecture organized in layers:

| Layer | Engines | Purpose |
|-------|---------|---------|
| **L0-L1** | ProviderRegistrar, ProviderHealthKernel | Provider knowledge graph |
| **L2-L3** | CapabilityResolutionEngine, CapabilityEngine | Capability system |
| **L4** | ConversationManager, StreamBlockStore | Session & state management |
| **Chrome** | ChromeGovernor | CDP proxy, lifecycle, trace, health |
| **Cross-cutting** | CapabilityEventBus, ConfigManager, StreamParserEngine | Shared infrastructure |
| **Lifecycle** | RegistrationAuditor, VersionManager, TelemetryAggregator | System lifecycle |

### Data Flow

1. **User Input** → Frontend captures user message
2. **Capability Resolution** → System resolves which capability to execute
3. **Provider Routing** → Request routed to appropriate AI provider
4. **Stream Processing** → Real-time streaming of provider responses
5. **State Management** → Conversation state persisted to local database
6. **UI Update** → Frontend renders response in real-time

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="file:./data/vivim.db"

# Server
PORT=9420
NODE_ENV=production

# API Keys (configure as needed)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Desktop App
FRONTEND_DIR=./frontend/out
```

### Provider Configuration

Providers are configured via seed files in `seeds/providers/`:

```json
{
  "slug": "chatgpt",
  "name": "ChatGPT",
  "endpoints": {
    "chat": "https://api.openai.com/v1/chat/completions"
  },
  "models": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  "capabilities": ["send_message", "select_model"]
}
```

See [Provider Documentation](docs/PROVIDERS.md) for detailed configuration.

---

## Development

### Prerequisites

- **Bun** 1.3.14+ ([Install](https://bun.sh))
- **Node.js** 18+ (for compatibility)
- **Git** ([Install](https://git-scm.com))

### Setup

```bash
# Clone repository
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final

# Install dependencies
bun install

# Set up database
bun run prisma:generate
bun run seed

# Start development server
bun run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server (backend + frontend) |
| `bun run build` | Build for production |
| `bun run test` | Run test suite |
| `bun run typecheck` | Type-check the codebase |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format code with Biome |

### Building Desktop App

```bash
# Build sidecar with UPX compression
bun run scripts/tauri/compile-sidecar.ts

# Build full installer
pwsh scripts/tauri/build-installer.ps1
```

See [Desktop Build Guide](docs/DESKTOP-BUILD.md) for details.

---

## Testing

### Test Types

```bash
# Unit tests
bun run test:unit

# Integration tests
bun run test:integration

# E2E tests
bun run test:e2e

# All tests
bun test
```

### Test Coverage

- **Unit Tests**: Individual function and component tests
- **Integration Tests**: Engine interaction tests
- **E2E Tests**: Full stack tests with Playwright

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Standards

- **TypeScript** — Strict mode with full type safety
- **Biome** — Formatting and linting
- **Conventional Commits** — Commit message format
- **Tests** — Required for new features

---

## Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. **Email** security@vivim.dev with details
3. **Wait** for response before public disclosure

See [SECURITY.md](SECURITY.md) for more information.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Support

### Documentation

- **[User Guide](docs/USER-GUIDE.md)** — End-user documentation
- **[Developer Docs](docs/ARCHITECTURE.md)** — Technical documentation
- **[API Reference](docs/API.md)** — API documentation

### Community

- **[GitHub Discussions](https://github.com/owenservera/vivim-final/discussions)** — Ask questions, share ideas
- **[Issue Tracker](https://github.com/owenservera/vivim-final/issues)** — Report bugs, request features

### Professional Support

- **Email**: support@vivim.dev
- **Response Time**: 24-48 hours

---

## Acknowledgments

Built with:

- **[Bun](https://bun.sh)** — Fast JavaScript runtime
- **[Next.js](https://nextjs.org)** — React framework
- **[Prisma](https://www.prisma.io)** — Database ORM
- **[Radix UI](https://www.radix-ui.com)** — UI components
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first CSS

---

<div align="center">

**[Download Vivim Desktop](https://github.com/owenservera/vivim-final/releases/latest/download/vivim-desktop-setup.exe)** • **[Read the Docs](docs/)** • **[Get Started](#quick-start)**

</div>
]]>