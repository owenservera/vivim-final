<![CDATA[<div align="center">

# Vivim Architecture

**Technical deep-dive into Vivim's system design and engine architecture**

</div>

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Engine Layer](#engine-layer)
- [Data Flow](#data-flow)
- [Storage Layer](#storage-layer)
- [API Layer](#api-layer)
- [Frontend Architecture](#frontend-architecture)
- [Desktop Architecture](#desktop-architecture)

---

## Overview

Vivim is a local-first AI conversation platform built with a modular engine architecture. The system is designed for:

- **Modularity** — Each engine handles a specific concern
- **Extensibility** — New engines and capabilities can be added easily
- **Performance** — Optimized for real-time streaming and local operations
- **Privacy** — Data stays on the user's machine by default

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Bun 1.3.14+ | JavaScript/TypeScript runtime |
| **Backend** | TypeScript (strict) | API server and engine logic |
| **Frontend** | Next.js 16 + React 19 | Web interface |
| **Database** | SQLite via Prisma | Local data storage |
| **Desktop** | Tauri v2 (planned) | Native Windows app |

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Web UI     │  │  CLI        │  │  Desktop    │            │
│  │  (React)    │  │  (Bun)      │  │  (Tauri)    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
├──────────────────────────┼──────────────────────────────────────┤
│                    API Layer                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   HTTP Server                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  REST API   │  │  WebSocket  │  │  SSE        │    │   │
│  │  │  /api/*     │  │  /ws        │  │  /events    │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
├──────────────────────────┼──────────────────────────────────────┤
│                    Engine Layer                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Capability System                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  Capability │  │  Provider   │  │  Session    │    │   │
│  │  │  Engine     │  │  Engine     │  │  Engine     │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Stream Processing                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  Stream     │  │  Parser     │  │  Block      │    │   │
│  │  │  Engine     │  │  Engine     │  │  Store      │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
├──────────────────────────┼──────────────────────────────────────┤
│                    Storage Layer                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Database                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  Prisma     │  │  SQLite     │  │  WAL Mode   │    │   │
│  │  │  Client     │  │  Database   │  │  Enabled    │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Engine Layer

### 13-Engine Architecture

Vivim uses a 13-engine architecture organized in layers:

#### Layer 0-1: Provider Knowledge Graph

| Engine | Purpose | Key Responsibilities |
|--------|---------|---------------------|
| **ProviderRegistrar** | Provider registration | Register providers, manage fallback chains |
| **ProviderHealthKernel** | Health monitoring | Track provider status, latency, errors |

#### Layer 2-3: Capability System

| Engine | Purpose | Key Responsibilities |
|--------|---------|---------------------|
| **CapabilityResolutionEngine** | Capability routing | Resolve capabilities from natural language |
| **CapabilityEngine** | Capability execution | Execute capabilities, manage state |

#### Layer 4: Session & State

| Engine | Purpose | Key Responsibilities |
|--------|---------|---------------------|
| **ConversationManager** | Conversation management | Create, update, delete conversations |
| **StreamBlockStore** | Stream storage | Store and retrieve stream blocks |

#### Chrome Layer

| Engine | Purpose | Key Responsibilities |
|--------|---------|---------------------|
| **ChromeGovernor** | Browser automation | CDP proxy, lifecycle, trace, health |

#### Cross-cutting Engines

| Engine | Purpose | Key Responsibilities |
|--------|---------|---------------------|
| **CapabilityEventBus** | Event system | Emit and subscribe to capability events |
| **ConfigManager** | Configuration | Manage application configuration |
| **StreamParserEngine** | Stream parsing | Parse provider-specific stream formats |

#### Lifecycle Engines

| Engine | Purpose | Key Responsibilities |
|--------|---------|---------------------|
| **RegistrationAuditor** | Audit | Validate provider registrations |
| **VersionManager** | Versioning | Manage API and schema versions |
| **TelemetryAggregator** | Telemetry | Collect and aggregate metrics |

### Engine Communication

Engines communicate via:

1. **Direct Method Calls** — Synchronous engine-to-engine calls
2. **Event Bus** — Asynchronous event-based communication
3. **Store Contracts** — Shared storage interfaces

---

## Data Flow

### Message Flow

```
User Input
    │
    ▼
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │ HTTP POST /api/conversations/:id/send
         ▼
┌─────────────────┐
│   API Server    │
│   (Express)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Capability    │
│   Engine        │
└────────┬────────┘
         │ Resolve capability from NL
         ▼
┌─────────────────┐
│   Provider      │
│   Engine        │
└────────┬────────┘
         │ Route to provider
         ▼
┌─────────────────┐
│   Stream        │
│   Parser        │
└────────┬────────┘
         │ Parse provider response
         ▼
┌─────────────────┐
│   Stream Block  │
│   Store         │
└────────┬────────┘
         │ Store blocks
         ▼
┌─────────────────┐
│   WebSocket     │
│   Broadcast     │
└────────┬────────┘
         │ Real-time updates
         ▼
┌─────────────────┐
│   Frontend      │
│   (React)       │
└─────────────────┘
```

### Capability Execution Flow

1. **Input** — User provides natural language instruction
2. **Resolution** — CapabilityResolutionEngine resolves capability
3. **Validation** — CapabilityEngine validates input parameters
4. **Execution** — Capability executes with provider
5. **Streaming** — Response streams back via WebSocket
6. **Storage** — Blocks stored in StreamBlockStore
7. **Rendering** — Frontend renders blocks in real-time

---

## Storage Layer

### Database Schema

Vivim uses SQLite via Prisma with the following key models:

#### Core Models

```prisma
model Conversation {
  id          String   @id @default(uuid())
  title       String?
  providerId  String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  messages    Message[]
}

model Message {
  id             String   @id @default(uuid())
  conversationId String
  role           String   // "user" | "assistant" | "system"
  content        String
  createdAt      DateTime @default(now())
  blocks         Block[]
}

model Block {
  id        String   @id @default(uuid())
  messageId String
  type      String   // "text" | "reasoning" | "tool-call"
  content   String
  metadata  Json?
  createdAt DateTime @default(now())
}
```

#### Provider Models

```prisma
model Provider {
  id         String   @id @default(uuid())
  slug       String   @unique
  name       String
  status     String   // "active" | "inactive" | "error"
  config     Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Parser {
  id         String   @id @default(uuid())
  providerId String
  version    String
  logicCode  String   // Inline parser logic
  logicType  String   // "inline" | "file"
  createdAt  DateTime @default(now())
}
```

### Storage Contracts

Engines depend on storage contracts (interfaces), not implementations:

```typescript
interface ConversationStore {
  create(data: CreateConversation): Promise<Conversation>
  getById(id: string): Promise<Conversation | null>
  list(options: ListOptions): Promise<Conversation[]>
  update(id: string, data: UpdateConversation): Promise<Conversation>
  delete(id: string): Promise<void>
}
```

This allows swapping storage implementations without changing engine code.

---

## API Layer

### REST API

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/conversations` | List conversations |
| `POST` | `/api/conversations` | Create conversation |
| `GET` | `/api/conversations/:id` | Get conversation |
| `POST` | `/api/conversations/:id/send` | Send message |
| `GET` | `/api/providers` | List providers |
| `POST` | `/api/interpret` | Execute capability via NL |

#### Request/Response Format

```typescript
// POST /api/conversations/:id/send
{
  "content": "Hello, Claude!",
  "providerId": "claude"
}

// Response
{
  "id": "msg_123",
  "content": "Hello! How can I help you today?",
  "provider": "claude",
  "createdAt": "2026-07-30T12:00:00Z"
}
```

### WebSocket

Real-time streaming via WebSocket at `ws://localhost:9420/ws`:

```typescript
// Client → Server
{
  "type": "subscribe",
  "conversationId": "conv_123"
}

// Server → Client
{
  "type": "block",
  "conversationId": "conv_123",
  "block": {
    "type": "text",
    "content": "Hello!"
  }
}
```

### Server-Sent Events (SSE)

Event streaming at `/api/events`:

```typescript
// Event types
"message.new"     // New message created
"block.new"       // New block added
"provider.status" // Provider status changed
"capability.run"  // Capability executing
```

---

## Frontend Architecture

### Component Structure

```
frontend/src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── api/               # API routes
├── components/
│   ├── canvas/            # Canvas components
│   ├── chat/              # Chat interface
│   ├── memory/            # Memory components
│   └── ui/                # UI primitives
├── engines/
│   ├── canvas.ts          # Canvas engine
│   ├── workspace.ts       # Workspace engine
│   └── plugin.ts          # Plugin engine
├── hooks/                 # React hooks
├── sdk/                   # Client SDK
└── ui/                    # Slot system
```

### State Management

- **React Query** — Server state management
- **Zustand** — Client state management
- **Context** — Component-level state

### Styling

- **Tailwind CSS** — Utility-first CSS
- **CSS Variables** — Theme tokens
- **Radix UI** — Accessible components

---

## Desktop Architecture

### Build Pipeline

```
┌─────────────────┐
│   TypeScript    │
│   Source        │
└────────┬────────┘
         │ bun build --compile
         ▼
┌─────────────────┐
│   Bun Binary    │
│   (97 MB)       │
└────────┬────────┘
         │ UPX Compression
         ▼
┌─────────────────┐
│   Compressed    │
│   Binary (45 MB)│
└────────┬────────┘
         │ NSIS Packaging
         ▼
┌─────────────────┐
│   Windows       │
│   Installer     │
└─────────────────┘
```

### Components

1. **Sidecar Binary** — Bun-compiled backend server
2. **Frontend Static** — Next.js static export
3. **Launcher** — Batch script to start server
4. **Installer** — NSIS package for Windows

### Compression

- **UPX Level 3** — 53.7% size reduction (97 MB → 45 MB)
- **NSIS zlib** — Additional compression in installer
- **Final size** — ~44 MB installer

---

## Performance

### Benchmarks

| Metric | Value |
|--------|-------|
| **Startup time** | < 1 second |
| **Message latency** | < 100ms |
| **Stream throughput** | 1000+ blocks/sec |
| **Database queries** | < 10ms p95 |

### Optimizations

- **WAL Mode** — SQLite write-ahead logging
- **Connection Pooling** — Prisma connection management
- **Streaming** — Real-time response streaming
- **Caching** — In-memory caching for hot data

---

## Security

### Data Privacy

- **Local-first** — Data never leaves the machine unless explicitly sent to providers
- **Encryption** — Database encrypted at rest (planned)
- **API Keys** — Stored locally, never transmitted to Vivim servers

### Authentication

- **Provider API Keys** — User manages their own keys
- **No Vivim Account** — No central authentication required
- **Optional Auth** — Can add authentication layer if needed

---

## Extensibility

### Adding New Engines

1. Define engine interface
2. Implement storage contracts
3. Register with engine orchestrator
4. Add tests

### Adding New Providers

1. Create provider manifest in `seeds/providers/`
2. Implement stream parser
3. Register capabilities
4. Test with provider harness

### Adding New Capabilities

1. Define capability schema
2. Implement handler
3. Register with capability registry
4. Add NL patterns

---

<div align="center">

**[Back to README](../README.md)** • **[User Guide](USER-GUIDE.md)** • **[API Reference](API.md)**

</div>
]]>