# Architecture — Data

> Prisma schema, migrations, Node model, and store contracts.

---

## Database

- **Engine:** SQLite (via Prisma ORM)
- **Location:** `file:./data/vivim.db` (configurable via `DATABASE_URL`)
- **Schema:** `prisma/schema.prisma` — 196 models, 3,800+ lines
- **Client:** `@prisma/client` v6.19

### Schema Organization

The schema is organized by bounded context (marked with `// ctx:` comments):

| Context | Models | Purpose |
|---------|--------|---------|
| `provider` | ProviderDefinition, ProviderEndpoint, ProviderParser, ProviderCapability, ProviderAccount, ... | Provider knowledge graph |
| `capability` | CapabilityBinding, CapabilitySnapshot, CapabilityMacro, ... | Capability system |
| `conversation` | Conversation, Message, StreamBlock, ... | Session state |
| `node` | Node, NodeEdge, NodeVersion, NodeAlias, ... | Universal node layer |
| `memory` | Memory (FSRS-6), ... | Memory engine |
| `chrome` | ChromeSlave, HealthTick, FleetEvent, ... | Chrome lifecycle |
| `harness` | HarnessCommand, RepairSession, ... | Browser automation |
| `telemetry` | CapabilityTelemetry, TelemetrySummaryDaily, ... | Observability |

### Migrations

```bash
# Development (creates new migration if schema changes)
bun run prisma:migrate dev

# Production (applies pending migrations only)
bun run prisma:migrate prod

# Push schema without migration (prototyping)
bun run prisma:push

# Open Prisma Studio
bun run prisma:studio
```

**Convention:** Schema changes applied via `bunx prisma db push` (DDL only — no `_prisma_migrations` table). Data migrations go through the `MigrationRunner` at `src/storage/migration/`.

---

## Node Model (Universal Node Layer v2)

Every piece of data in Vivim can be represented as a **Node** — a universal, versioned, graph-linked entity.

### Node Fields

| Field | Purpose |
|-------|---------|
| `id` | ULID |
| `contentHash` | SHA-256 of content for deduplication |
| `version` | Monotonic version counter |
| `state` | Current state (active, archived, etc.) |
| `securityLevel` | Access control level |
| `contentType` | MIME type or schema reference |
| `authorDid` | Decentralized identifier of author |
| `signature` | Cryptographic signature |
| `acl` | Access control list (JSON) |
| `quality` | Quality score |
| `validFrom` / `validUntil` | Temporal validity window |
| `parentVersion` | Links to previous version |

### Node Edges

Nodes are connected via **NodeEdge** — typed, weighted relationships:

```
Node A --[responds_to, weight=0.95]--> Node B
Node A --[references, weight=0.8]--> Node C
```

### NodeVersion

Every mutation creates a new version in the **NodeVersion** table, enabling:
- Time-travel queries (`getNodeAtVersion`)
- Full mutation history (`getNodeHistory`)

### NodeAlias

Entity alias → canonical resolution:
```typescript
await registerAlias("chatgpt", "openai-chat")
await resolveAlias("openai-chat") // → "chatgpt"
```

---

## Store Contracts

Engines never import storage implementations directly. They depend on **store contracts** — TypeScript interfaces at `src/storage/contracts/`.

### Key Contracts

| Contract | File | Purpose |
|----------|------|---------|
| `ParserStore` | `contracts/parser-store.ts` | Parser CRUD, fallback chain resolution |
| `ProviderStore` | `contracts/provider-store.ts` | Provider registration, manifest management |
| `CapabilityStore` | `contracts/capability-store.ts` | Capability bindings, snapshots |
| `GovernorStore` | `contracts/governor-store.ts` | Chrome trace, harness commands |
| `NodeStoreContract` | `contracts/node-store.ts` | Node CRUD, edge management, versioning |
| `ConversationStore` | `contracts/conversation-store.ts` | Conversation and message persistence |

### Why Contracts?

- **Testability:** Swap implementations without changing engine code
- **Boundary enforcement:** Prevents engines from bypassing the storage layer
- **Flexibility:** Different implementations for dev/test/prod

---

## Test Fixture

After any Prisma schema change, rebuild the canonical test fixture:

```bash
DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db" \
  bunx prisma db push --skip-generate --accept-data-loss
```

**Important:** Use an absolute `file:` path. Prisma resolves relative paths against `prisma/schema.prisma`, which would silently create a duplicate at `prisma/tests/fixtures/`.

---

## Backup & Restore

```bash
# Backup
bun run db:backup

# Restore
bun run db:restore
```

---

See [OVERVIEW.md](OVERVIEW.md) for the high-level mental model.
