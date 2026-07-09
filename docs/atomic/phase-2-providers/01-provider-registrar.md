# Unit 2.1: ProviderRegistrar

**Phase:** 2 | **File:** `src/engines/provider-registrar.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** Provider KG populated from seeds
**Source:** `04-merged-engines.md` §5, `06-merged-seeds.md`

## Purpose
Read provider JSON manifests from `seeds/providers/` and write them to the database. Handles atomic multi-table inserts. Can reload all providers or a single provider.

## Interface
```typescript
class ProviderRegistrar {
  constructor(
    private store: ProviderStore,
    private auditor?: RegistrationAuditor,
    private eventBus?: CapabilityEventBus,
  ) {}

  async register(manifest: ProviderManifest): Promise<RegisterResult>;
  async seedAll(): Promise<SeedAllResult>;
  async seedProvider(providerSlug: string): Promise<RegisterResult>;
  async verifySeeds(): Promise<VerifyResult>;
  async reloadFromSeeds(): Promise<SeedAllResult>;
}

interface RegisterResult {
  providerId: string;
  slug: string;
  status: 'created' | 'updated' | 'unchanged';
  tablesAffected: string[];
  rowsAdded: number;
  rowsModified: number;
}

interface SeedAllResult {
  seeded: RegisterResult[];
  skipped: string[];
  errors: Array<{ file: string; error: string }>;
}

interface VerifyResult {
  valid: boolean;
  providers: Array<{
    slug: string;
    status: 'ok' | 'missing_file' | 'parse_error' | 'schema_mismatch';
    details: string;
  }>;
}
```

## Store Contract
```typescript
interface ProviderStore {
  upsertDefinition(def: ProviderDefinitionRow): Promise<void>;
  upsertEndpoint(endpoint: ProviderEndpointRow): Promise<void>;
  upsertParser(parser: ProviderParserRow): Promise<void>;
  upsertCapability(cap: ProviderCapabilityRow): Promise<void>;
  upsertConfig(config: ProviderConfigRow): Promise<void>;
  upsertModel(model: ProviderModelRow): Promise<void>;
  deleteProviderEndpoints(providerId: string): Promise<void>;
  deleteProviderParsers(providerId: string): Promise<void>;
  deleteProviderCapabilities(providerId: string): Promise<void>;
  deleteProviderConfigs(providerId: string): Promise<void>;
  deleteProviderModels(providerId: string): Promise<void>;
  getDefinition(id: string): Promise<ProviderDefinitionRow | null>;
  getDefinitionBySlug(slug: string): Promise<ProviderDefinitionRow | null>;
  listDefinitions(opts?: { isActive?: boolean }): Promise<ProviderDefinitionRow[]>;
}
```

## Seed Flow
```
seedAll()
  ├─ [1] Scan seeds/providers/*.json
  ├─ [2] For each manifest file:
  │   ├─ Parse JSON → ProviderManifest
  │   ├─ Validate against Zod schema
  │   ├─ Begin transaction
  │   ├─ register(manifest)
  │   │   ├─ Upsert provider_definition
  │   │   ├─ Delete old endpoints → Upsert new endpoints
  │   │   ├─ Delete old parsers → Upsert new parsers
  │   │   ├─ Delete old capabilities → Upsert new capabilities
  │   │   ├─ Delete old configs → Upsert new configs
  │   │   ├─ Delete old models → Upsert new models
  │   │   └─ Emit provider:seeded event
  │   ├─ Commit transaction
  │   └─ If auditor configured → auditor.registerAndAudit(manifest)
  └─ [3] Return SeedAllResult
```

## Tests
- [ ] `seedAll()` scans seeds/ directory and returns SeedAllResult
- [ ] `register()` upserts all 6 table types in a transaction
- [ ] `seedProvider('claude')` seeds a single provider
- [ ] `verifySeeds()` detects missing files and parse errors
- [ ] `reloadFromSeeds()` re-seeds all without duplicates
- [ ] Registers 7 providers (Claude, ChatGPT, Gemini, DeepSeek, Studio-AI, Z-AI, Qwen)

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- 7 providers seeded into dev.db
