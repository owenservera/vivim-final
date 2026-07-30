<![CDATA[<div align="center">

# Vivim Desktop User Guide

**Complete guide to using Vivim Desktop for AI conversations**

</div>

---

## Table of Contents

- [Getting Started](#getting-started)
- [Installation](#installation)
- [Configuration](#configuration)
- [Providers](#providers)
- [Conversations](#conversations)
- [Capabilities](#capabilities)
- [Desktop App](#desktop-app)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### What is Vivim?

Vivim is a local-first AI conversation platform that connects to multiple AI providers through a unified interface. It provides:

- **Multi-provider support** — Use ChatGPT, Claude, Gemini, and more
- **Local-first architecture** — Your data stays on your machine
- **Capability system** — Execute complex tasks via natural language
- **Desktop application** — Native Windows installer

### System Requirements

- **Operating System**: Windows 10/11 (64-bit)
- **Memory**: 4 GB RAM minimum, 8 GB recommended
- **Storage**: 500 MB free space
- **Internet**: Required for AI provider connections

---

## Installation

### Windows Installer (Recommended)

1. **Download** the installer from [GitHub Releases](https://github.com/owenservera/vivim-final/releases/latest/download/vivim-desktop-setup.exe)

2. **Run** the installer (`vivim-desktop-setup.exe`)

3. **Follow** the installation wizard:
   - Choose installation directory (default: `%LOCALAPPDATA%\Vivim`)
   - Select Start Menu folder
   - Choose whether to create Desktop shortcut

4. **Launch** Vivim Desktop from Start Menu or Desktop

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final

# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Set up database
bun run prisma:generate
bun run seed

# Start the server
bun run dev
```

---

## Configuration

### First-Time Setup

1. **Launch** Vivim Desktop
2. **Open** the web interface at `http://localhost:9420`
3. **Navigate** to Settings (gear icon in top right)
4. **Configure** your API keys (see [Provider Configuration](#provider-configuration))

### Environment Variables

Create a `.env` file in the installation directory:

```bash
# Database (auto-configured for local SQLite)
DATABASE_URL="file:./data/vivim.db"

# Server port
PORT=9420

# API Keys (configure as needed)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

### Provider Configuration

#### ChatGPT / OpenAI

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to `.env`: `OPENAI_API_KEY=sk-...`
3. Or configure via Settings UI

#### Claude / Anthropic

1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`
3. Or configure via Settings UI

#### Gemini / Google

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Add to `.env`: `GOOGLE_API_KEY=...`
3. Or configure via Settings UI

---

## Providers

### Supported Providers

| Provider | Models | Status |
|----------|--------|--------|
| **ChatGPT** | GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo | ✅ Full Support |
| **Claude** | Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku | ✅ Full Support |
| **Gemini** | Gemini 1.5 Pro, Gemini 1.5 Flash | ✅ Full Support |
| **DeepSeek** | DeepSeek Chat, DeepSeek Coder | ✅ Supported |
| **Qwen** | Qwen-Turbo, Qwen-Plus | ✅ Supported |
| **Grok** | Grok-2, Grok-2 Mini | ✅ Supported |

### Switching Providers

1. **Click** the provider selector in the chat interface
2. **Choose** the desired provider from the dropdown
3. **Select** a model (if multiple models are available)
4. **Start** chatting with the selected provider

### Provider Health

Vivim monitors provider health in real-time:

- 🟢 **Connected** — Provider is responding normally
- 🟡 **Degraded** — Provider is responding slowly
- 🔴 **Offline** — Provider is not responding

Check provider health in the Settings → Providers page.

---

## Conversations

### Creating Conversations

1. **Click** the "+" button in the sidebar
2. **Enter** a conversation name (optional)
3. **Select** a provider (defaults to last used)
4. **Start** typing your message

### Managing Conversations

- **Rename** — Click the conversation name in the sidebar
- **Delete** — Right-click and select "Delete"
- **Search** — Use the search bar in the sidebar
- **Archive** — Move old conversations to archive

### Conversation Features

- **Real-time streaming** — See responses as they're generated
- **Message history** — Scroll through previous messages
- **Export** — Download conversations as Markdown or JSON
- **Share** — Generate shareable links (coming soon)

---

## Capabilities

### What are Capabilities?

Capabilities are executable actions that Vivim can perform. They range from simple operations (sending messages) to complex tasks (automating browser actions).

### Using Capabilities

#### Via Natural Language

Simply describe what you want to do:

```
> Send a message to Claude asking about quantum computing
> Switch to Gemini and ask about the latest news
> List all available capabilities
```

#### Via CLI

```bash
# List all capabilities
bun run devops runtime-test test --nl="list capabilities"

# Execute a capability
bun run devops runtime-test test --nl="send message to chatgpt"
```

#### Via API

```bash
# Execute a capability via API
curl -X POST http://localhost:9420/api/interpret \
  -H "Content-Type: application/json" \
  -d '{"nl": "send message to claude"}'
```

### Built-in Capabilities

| Capability | Description |
|------------|-------------|
| `send_message` | Send a message to a provider |
| `select_model` | Switch to a different model |
| `list_providers` | List available providers |
| `get_conversation` | Retrieve conversation history |
| `create_conversation` | Start a new conversation |

### Custom Capabilities

See [Developer Documentation](ARCHITECTURE.md#capabilities) for building custom capabilities.

---

## Desktop App

### Features

- **System Tray** — Runs in background, quick access from tray menu
- **Auto-Start** — Launch on system startup (configurable)
- **Window Management** — Remember window size and position
- **Keyboard Shortcuts** — Global shortcuts for common actions

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New conversation |
| `Ctrl+F` | Search conversations |
| `Ctrl+,` | Open settings |
| `Ctrl+Q` | Quit application |

### System Tray Menu

- **Show/Hide** — Toggle main window
- **New Conversation** — Quick create new chat
- **Providers** — Switch active provider
- **Settings** — Open settings window
- **Quit** — Exit application

### Updating

Vivim Desktop automatically checks for updates:

1. **Notification** appears when update is available
2. **Click** "Update Now" to download and install
3. **Restart** Vivim when prompted

---

## Troubleshooting

### Common Issues

#### "Provider not responding"

1. Check your internet connection
2. Verify API key is correct
3. Check provider status at provider's status page
4. Try switching to a different provider

#### "Server not starting"

1. Check if port 9420 is already in use
2. Verify `.env` configuration
3. Check logs in `data/vivim.log`
4. Try running `bun run dev` manually

#### "Database errors"

1. Run `bun run prisma:generate` to regenerate client
2. Run `bun run prisma:push` to sync schema
3. Check `data/vivim.db` exists and is writable

#### "Frontend not loading"

1. Ensure backend server is running
2. Check `http://localhost:9420` in browser
3. Clear browser cache
4. Check browser console for errors

### Logs

Logs are stored in:
- **Application log**: `data/vivim.log`
- **Server logs**: Console output when running `bun run dev`
- **Browser console**: Developer tools in web interface

### Getting Help

1. **Check** this documentation
2. **Search** [GitHub Issues](https://github.com/owenservera/vivim-final/issues)
3. **Ask** in [GitHub Discussions](https://github.com/owenservera/vivim-final/discussions)
4. **Email** support@vivim.dev

---

## Advanced Topics

### Multi-Provider Conversations

Vivim supports using multiple providers in the same conversation:

1. **Start** a conversation with one provider
2. **Switch** providers mid-conversation
3. **Compare** responses from different providers
4. **Route** specific messages to specific providers

### Capability Chains

Chain multiple capabilities together:

```bash
# Example: Send message and analyze response
bun run devops runtime-test test --nl="send message to claude about AI, then summarize the response"
```

### Custom Integrations

See [Developer Documentation](../ARCHITECTURE.md) for:
- Building custom engines
- Creating new capabilities
- Integrating additional providers
- Extending the frontend

---

<div align="center">

**[Back to README](../README.md)** • **[Developer Docs](ARCHITECTURE.md)** • **[API Reference](API.md)**

</div>
]]>