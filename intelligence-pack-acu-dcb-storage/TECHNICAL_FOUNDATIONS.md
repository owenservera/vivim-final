# Technical Foundations - vivim-final Implementation Guide

**Project:** vivim-final (cap-store v1 Knowledge Graph Rebuild)  
**Version:** 1.0  
**Date:** 2026-08-13  
**Purpose:** Core technical stack and runtime environment for ACU/DCB/Storage implementation

---

## 1. Core Tech Stack & Runtime Environment

### 1.1 Desktop Framework
- **Framework:** Tauri V2 (Rust backend + Web frontend)
- **Backend:** Rust (src-tauri/) with tokio async runtime
- **Frontend:** Next.js (frontend/) with React/TypeScript
- **Sidecar:** Bun runtime (src/) for TypeScript execution
- **IPC:** Tauri commands for Rust↔TypeScript communication

### 1.2 Language Split
**Rust (src-tauri/):**
- Window management and lifecycle
- File system operations (tauri-plugin-fs)
- HTTP requests (tauri-plugin-http)
- Process management (tauri-plugin-process)
- Shell commands (tauri-plugin-shell)

**TypeScript (src/):**
- Business logic engines (13 engines across L0-L4 layers)
- Storage layer (Prisma ORM + custom stores)
- Provider knowledge graph (CDP integration)
- Memory engine (episodic/semantic/procedural)
- Context assembly and injection

**Frontend (frontend/):**
- React UI components
- Chat interface
- Canvas visualization
- State management

### 1.3 Database Driver
- **ORM:** Prisma v6.5
- **Database:** SQLite with WAL mode
- **Client:** @prisma/client
- **Schema:** 196 models in single schema.prisma file
- **Migrations:** Prisma Migrate (dev) / Prisma Migrate Deploy (prod)
- **Location:** prisma/schema.prisma, prisma/migrations/

### 1.4 Vector Search
- **Current:** No dedicated vector search implementation
- **Planned:** CozoDB (cozo-node) for graph + vector queries
- **Embeddings:** @huggingface/transformers for local embeddings
- **Alternative:** sqlite-vss for SQLite native vector search

### 1.5 Runtime Environment
- **JS Runtime:** Bun v1.3.14+
- **Package Manager:** Bun (primary), npm compatibility
- **Build Tool:** tsup (ESM + DTS)
- **Linter/Formatter:** Biome
- **Git Hooks:** Lefthook
- **Testing:** Bun test runner

---

## 2. Database Schema & Storage Artifacts

### 2.1 Current Schema Structure
**Total Models:** 196 in single schema.prisma file
**Key Models for ACU/DCB/Storage:**

```prisma
// Conversation-related models
model Conversation {
  id                  String  @id
  providerSessionId   String? @map("provider_session_id")
  providerId          String  @map("provider_id")
  accountId           String? @map("account_id")
  title               String?
  state               String
  messageCount        Int     @map("message_count")
  lastMessageAt       BigInt? @map("last_message_at")
  contextJson         String  @map("context_json")
  externalId          String? @map("external_id") // Provider's native conversation ID
  source              String  // 'live' | 'history-sync' | 'import'
  importJobId         String? @map("import_job_id")
  syncedAt            BigInt? @map("synced_at")
  // ... timestamps and relations
}

model ConversationMessage {
  id              String  @id
  conversationId  String  @map("conversation_id")
  role            String  // 'user' | 'assistant' | 'system'
  content         String?
  blocksJson      String  @map("blocks_json") // Structured content blocks
  blockCount      Int     @map("block_count")
  parentMessageId String? @map("parent_message_id")
  sequenceIndex   Int     @map("sequence_index")
  latencyMs       Int?    @map("latency_ms")
  tokenCount      Int?    @map("token_count")
  model           String?
  metadataJson    String  @map("metadata_json")
  // ... timestamps and relations
}

// Memory-related models (Node-based storage)
model Node {
  id              String  @id
  type            String  // 'cap-store.memory' | 'cap-store.message' | etc.
  schemaVersion   Int     @map("schema_version")
  version         Int
  state           String  // 'active' | 'archived' | 'deleted'
  parentId        String? @map("parent_id")
  source          String  // Original content
  data            String  // JSON-encoded node data
  edges           String  // JSON-encoded edge list
  meta            String  // JSON-encoded metadata
  acl             String  // JSON-encoded access control
  authorDid       String  @map("author_did")
  contentType     String  @map("content_type")
  securityLevel   Int     @map("security_level")
  validFrom       BigInt  @map("valid_from")
  validUntil      BigInt? @map("valid_until")
  // ... timestamps and relations
}

// Provider models
model ProviderDefinition {
  id               String  @id
  slug             String  @unique
  displayName      String  @map("display_name")
  protocolStatus   String  @map("protocol_status")
  // ... provider metadata
}

model ProviderAccount {
  id         String  @id
  providerId String  @map("provider_id")
  email      String
  planTier   String  @map("plan_tier")
  loginState String  @map("login_state")
  // ... account metadata
}
```

### 2.2 KV-Store Implementation
**Current Status:** No custom KV-store implementation
**Planned:** Tree-based KV store for ephemeral data
**Interface Design:**
```typescript
interface KVStore {
  put(key: string, value: unknown, ttl?: number): Promise<void>
  get(key: string): Promise<unknown | null>
  delete(key: string): Promise<void>
  deleteBatch(keys: string[]): Promise<void>
  scan(prefix: string): Promise<Array<{ key: string; value: unknown }>>
  ttl(key: string): Promise<number | null>
}
```

### 2.3 Encryption Setup
**Current Status:** No encryption implementation
**Planned Options:**
- SQLCipher for SQLite file encryption
- Windows DPAPI for key management
- WebCrypto for browser-compatible encryption

---

## 3. SaaS Ingestion Payloads

### 3.1 ChatGPT Sample Payload
```json
{
  "conversations": [
    {
      "title": "Conversation Title",
      "mapping": {
        "0": {
          "id": "msg_abc123",
          "role": "user",
          "content": {
            "content_type": "text",
            "parts": ["User message content"]
          },
          "create_time": 1691234567.0
        },
        "1": {
          "id": "msg_def456",
          "role": "assistant",
          "content": {
            "content_type": "text",
            "parts": ["Assistant response"]
          },
          "create_time": 1691234580.0
        }
      },
      "current_node": "1"
    }
  ]
}
```

### 3.2 Claude/Anthropic Sample Payload
```json
{
  "conversation": {
    "id": "conv_abc123",
    "name": "Conversation Name",
    "messages": [
      {
        "id": "msg_001",
        "role": "user",
        "content": "User message",
        "timestamp": "2026-08-13T12:00:00Z"
      },
      {
        "id": "msg_002", 
        "role": "assistant",
        "content": "Assistant response",
        "timestamp": "2026-08-13T12:01:00Z",
        "model": "claude-3-5-sonnet-20240620"
      }
    ]
  }
}
```

### 3.3 Provider-Specific Parsers
**Location:** `seeds/parsers/harvested/<slug>-*.ts`
**Format:** Inline TypeScript code stored in DB
**Loading:** DB-driven parser loading via ProviderParser.parserLogicCode

---

## 4. Local AI & Embedding Pipeline

### 4.1 Embedding Model
**Current Implementation:** @huggingface/transformers
**Model Options:**
- `nomic-embed-text` (768 dimensions)
- `bge-m3` (1024 dimensions) 
- `text-embedding-3-small` (1536 dimensions) via API

**Interface:**
```typescript
interface EmbeddingService {
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
  getDimension(): number
}
```

### 4.2 Local LLM for Consolidation
**Current Status:** No local LLM integration
**Planned Options:**
- Ollama running `llama3` via HTTP API
- LM Studio for local inference
- Cloud API fallback (OpenAI-compatible)

**Consolidation Use Case:**
- Extract semantic memories from episodic ACUs
- Generate memory summaries
- Classify memory types

### 4.3 Token Counting
**Current Status:** No token counting implementation
**Planned Implementation:**
- `tiktoken` for OpenAI models
- `@xenova/transformers` for local models
- Custom tokenizer for provider-specific models

---

## 5. Existing Codebase Patterns

### 5.1 MemoryEngine Pattern
**Location:** `src/engines/memory-engine.ts`
**Current recordMemory() signature:**
```typescript
async recordMemory(input: {
  content: string
  memoryType: string
  category: string
  subcategory?: string
  tags?: string[]
  importance?: number
  relevance?: number
  sourceConversationIds?: string[]
  sourceMessageIds?: string[]
  occurredAt?: number
  validFrom?: number
  validUntil?: number
  isPinned?: boolean
  isArchived?: boolean
  nodeStore?: NodeStoreContract
  conversationId?: string
  messageId?: string
}): Promise<string>
```

**FSRS-6 Fields (Already Defined):**
```typescript
{
  stability: 1.0,        // FSRS-6 stability parameter
  difficulty: 0.3,      // FSRS-6 difficulty parameter
  dueDate: now,         // Next review date
  lastReview: null,     // Last review timestamp
  reviewCount: 0,       // Number of reviews
  fsrsState: 'New'      // FSRS-6 state: New | Learning | Review | Relearning
}
```

### 5.2 ContextAssembly Pattern
**Location:** `src/engines/context-assembly.ts`
**Injection Method:** Context attached to conversation before send
**Injection Point:** ConversationManager.sendInternal() step [1.5]

```typescript
// Current context structure
interface ConversationContext {
  provider: { id: string; slug: string; displayName: string }
  account: { email: string; planTier: string; loginState: string }
  chrome: { status: string; circuitState: string }
  capabilities: { total: number; available: number }
  memory?: AgentMemoryContext  // Memory context injection
}
```

### 5.3 Background Worker Setup
**Current Status:** No dedicated background worker system
**Planned Implementation:**
- Bun's `setInterval` for simple scheduled tasks
- Tauri's async runtime for Rust background tasks
- Windows Task Scheduler integration for system-level tasks

**Scheduled Tasks:**
- TTL Sweep (hourly)
- FSRS-6 Daily Review (daily)
- Database Compaction (weekly)
- Memory Consolidation (daily)

---

## 6. Build & Deployment

### 6.1 Build Commands
```bash
# Development
bun run dev                # Start dev server
bun run dev:backend        # Backend only
bun run dev:frontend       # Frontend only

# Building
bun run build              # Build sidecar (Bun compile)
bun run tauri:build        # Build Tauri desktop app
bun run frontend:build     # Build Next.js frontend

# Desktop Build (with optimization)
pwsh scripts/tauri/build.ps1           # Full desktop build
pwsh scripts/tauri/build-sidecar.ps1   # Sidecar only with UPX compression
```

### 6.2 Database Operations
```bash
bun run prisma:migrate:dev    # Run development migrations
bun run prisma:migrate:prod   # Run production migrations
bun run prisma:generate       # Generate Prisma client
bun run prisma:studio         # Open Prisma Studio
bun run prisma:push           # Push schema changes (dev only)
```

### 6.3 Desktop DevOps Toolkit
**Location:** `devops/desktop/`
**Commands:**
```bash
bun run devops desktop-loop run --version <x.y.z>     # Full 5-gate pipeline
bun run devops desktop-loop build --version <x.y.z>   # Hash-gated rebuild
bun run devops desktop-loop install --version <x.y.z> # Install NSIS silently
bun run devops desktop-loop launch --version <x.y.z>  # Launch + verify
bun run devops desktop-loop test smoke                # Smoke test battery
```

---

## 7. File Structure Reference

### 7.1 Key Directories
```
vivim-final/
├── src/                          # TypeScript business logic
│   ├── engines/                  # 13 engines (L0-L4 layers)
│   │   ├── memory-engine.ts      # Memory engine
│   │   ├── conversation-manager.ts # Conversation orchestration
│   │   ├── capability-resolution.ts # Capability system
│   │   └── chrome-governor.ts    # CDP management
│   ├── storage/                  # Storage layer
│   │   ├── contracts/            # Store interfaces
│   │   ├── impl/                 # Store implementations
│   │   └── db.ts                 # Prisma wrapper
│   ├── domain/                   # Domain types
│   └── ai/                       # AI subsystem
├── prisma/                       # Database schema
│   ├── schema.prisma             # 196 models
│   └── migrations/               # Migration files
├── src-tauri/                    # Rust backend
│   ├── src/                     # Rust source code
│   └── Cargo.toml               # Rust dependencies
├── frontend/                     # Next.js frontend
│   ├── src/                     # React components
│   └── package.json             # Frontend dependencies
├── seeds/                       # Data seeding
│   ├── providers/               # Provider manifests
│   └── parsers/                 # Parser definitions
└── scripts/                     # Build/utility scripts
```

### 7.2 Configuration Files
- `package.json` - Bun/TypeScript dependencies
- `src-tauri/Cargo.toml` - Rust dependencies
- `prisma/schema.prisma` - Database schema
- `tsconfig.json` - TypeScript configuration
- `biome.json` - Linter/formatter configuration

---

## 8. Development Workflow

### 8.1 Type Checking
```bash
bun run typecheck    # Full typecheck
bun run lint         # Biome lint
bun run format       # Biome format
```

### 8.2 Testing
```bash
bun run test              # All tests
bun run test:unit         # Unit tests only
bun run test:integration  # Integration tests only
bun run test:e2e          # End-to-end tests only
```

### 8.3 Git Hooks
**Tool:** Lefthook
**Pre-commit:** Typecheck + Lint + Format
**Pre-push:** Full test suite

---

## 9. Performance Considerations

### 9.1 Database Optimization
- **WAL Mode:** Enabled for concurrent access
- **Indexes:** Strategic indexes on foreign keys and query fields
- **Connection Pooling:** Prisma connection pooling
- **Query Optimization:** Prisma query optimization

### 9.2 Memory Management
- **Stream Processing:** Chunked processing for large data
- **Lazy Loading:** On-demand data loading
- **Caching:** In-memory caching for frequently accessed data
- **Garbage Collection:** Automatic via Bun runtime

### 9.3 Concurrency
- **Async/Await:** Non-blocking I/O operations
- **Parallel Processing:** Concurrent task execution
- **Mutex Protection:** CDP proxy mutex for Chrome operations
- **Transaction Safety:** Prisma transaction support

---

## 10. Security Considerations

### 10.1 Data Protection
- **Input Validation:** Zod schema validation
- **SQL Injection:** Prisma parameterized queries
- **XSS Prevention:** React automatic escaping
- **CSRF Protection:** Tauri IPC security

### 10.2 Access Control
- **ACL System:** Node-based access control
- **Authentication:** Provider-based authentication
- **Authorization:** Role-based access control
- **Audit Logging:** TraceEntry for all operations

---

## 11. Monitoring & Debugging

### 11.1 Logging
**Library:** Pino
**Levels:** trace, debug, info, warn, error
**Output:** Structured JSON logs
**Location:** Logs stored in `%LOCALAPPDATA%\vivim\` for desktop

### 11.2 Tracing
**System:** TraceEntry model for operation tracing
**Fields:** engine, method, requestId, durationMs, ok, error
**Query:** By engine, conversation, provider, slave

### 11.3 Debugging Tools
- **Prisma Studio:** Database inspection
- **Tauri DevTools:** Rust backend debugging
- **Chrome DevTools:** Frontend debugging
- **Desktop Loop:** Structured diagnostics

---

## 12. Migration Strategy

### 12.1 Schema Changes
1. Create Prisma migration file
2. Generate Prisma client
3. Test in development environment
4. Run pre-migration backup
5. Deploy to production
6. Verify post-migration state

### 12.2 Data Migration
1. Export existing data
2. Transform data to new schema
3. Import transformed data
4. Verify data integrity
5. Keep backup for rollback

### 12.3 Rollback Plan
1. Restore from pre-migration backup
2. Revert schema changes
3. Restart application
4. Verify system stability

---

## 13. API Integration Points

### 13.1 Internal APIs
**HTTP Server:** Built with Bun/HTTP
**Base URL:** http://localhost:port
**Endpoints:**
- `/api/conversations` - Conversation management
- `/api/memory` - Memory operations
- `/api/capabilities` - Capability resolution
- `/readyz` - Health check

### 13.2 External APIs
**Provider APIs:** CDP-based provider integration
**Embedding APIs:** Local or cloud embedding services
**LLM APIs:** Optional cloud LLM fallback

---

## 14. Error Handling Patterns

### 14.1 Error Types
```typescript
class EngineError extends Error
class NotFoundError extends Error
class ValidationError extends Error
```

### 14.2 Error Recovery
- **Retry Logic:** Exponential backoff for transient errors
- **Circuit Breaker:** Fail-fast for repeated failures
- **Fallback Mechanisms:** Graceful degradation
- **Error Logging:** Comprehensive error logging

---

## 15. Testing Strategy

### 15.1 Unit Tests
**Framework:** Bun test
**Coverage:** Business logic engines
**Mocking:** Interface-based mocking

### 15.2 Integration Tests
**Scope:** Database operations, API endpoints
**Environment:** Test database
**Data:** Seeded test data

### 15.3 End-to-End Tests
**Framework:** Playwright
**Scope:** Full user workflows
**Environment:** Full application stack

---

This document provides the foundational technical context needed for implementing the ACU, DCB, and Storage enhancements. All code examples are based on the actual vivim-final codebase structure and patterns.
