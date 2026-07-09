# Unit 1.4: CapStoreDb — PrismaClient Wrapper

**Phase:** 1 | **File:** `src/storage/db.ts`
**Depends:** 1.3 Prisma Client Singleto | **Produces:** Typed DB access layer

## Interface
```typescript
// src/storage/db.ts
export class CapStoreDb {
  public readonly prisma: PrismaClient;

  constructor(_path?: string);  // _path kept for backward compat, ignored

  async close(): Promise<void>;

  // Migration helpers
  async applyMigration(filename: string, sql: string): Promise<void>;
  async hasMigration(filename: string): Promise<boolean>;

  // L1: Provider CRUD
  async getProvider(id: string): Promise<ProviderDefinition | null>;
  async getProviderBySlug(slug: string): Promise<ProviderDefinition | null>;
  async listProviders(opts?: { isActive?: boolean }): Promise<ProviderDefinition[]>;
  async upsertProvider(def: {...}): Promise<ProviderDefinition>;

  // Account
  async getAccount(id: string): Promise<ProviderAccount | null>;
  async getAccountsByProvider(providerId: string): Promise<ProviderAccount[]>;
  async upsertAccount(account: {...}): Promise<ProviderAccount>;

  // L3: Capability CRUD
  async getCapability(id: string): Promise<CapabilityTaxonomy | null>;
  async getCapabilityBySlug(slug: string): Promise<CapabilityTaxonomy | null>;
  async getBinding(globalId: string, providerId: string): Promise<CapabilityBinding | null>;
  async getSelectors(capabilityId: string, providerId: string): Promise<SelectorStrategy[]>;

  // L4: Conversation CRUD
  async getConversation(id: string): Promise<Conversation | null>;
  async createConversation(input: {...}): Promise<Conversation>;
  async createMessage(input: {...}): Promise<ConversationMessage>;
  async getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<ConversationMessage[]>;

  // L3: Outcome recording
  async createOutcome(input: {...}): Promise<Outcome>;

  // L2: Trace
  async createTraceEntry(input: {...}): Promise<TraceEntry>;

  // L8: Config
  async getConfig(engineId: string): Promise<ConfigEntry[]>;
  async getConfigValue(engineId: string, key: string): Promise<string | null>;
}

// Singleton + lifecycle
export function getDb(): CapStoreDb;
export function setDb(db: CapStoreDb): void;
export async function closeDb(): Promise<void>;
```

## Design Notes
- All methods are async (Prisma is Promise-based)
- Uses `getPrisma()` singleton internally
- `_path` parameter kept for backward compatibility but ignored (Prisma uses DATABASE_URL)
- Methods return Prisma model types (camelCase — `createdAt`, not `created_at`)
- Migration methods use `$executeRawUnsafe` for raw SQL
- `closeDb()` disconnects Prisma client

## Gate
- `bun run typecheck` passes
- `getProvider()` returns typed provider from dev.db
- `listProviders()` returns all providers
- `createConversation()` persists and returns a conversation row
