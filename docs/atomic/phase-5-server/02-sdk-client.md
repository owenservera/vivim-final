# Unit 5.6: SDK Client

**Phase:** 5 | **Files:** `sdk/src/client.ts`, `sdk/src/types.ts`, `sdk/src/index.ts` (3 files)
**Depends:** Phase 5 Server | **Produces:** Fully typed TypeScript SDK client
**Source:** `07-merged-api.md` §B

## Interface
```typescript
class CapStoreClient {
  constructor(options: { baseUrl: string; authToken?: string });

  // Providers
  async providers(): Promise<ProviderSummary[]>;
  async provider(id: string): Promise<ProviderDetail>;
  async providerHealth(id: string): Promise<ProviderHealthReport>;
  async providerAccounts(providerId: string): Promise<ProviderAccount[]>;
  async providerAccount(providerId: string, accountId: string): Promise<ChromeSlave>;
  async createAccount(providerId: string, email: string): Promise<ChromeSlave>;
  async deleteAccount(providerId: string, accountId: string): Promise<void>;
  async setDefaultAccount(providerId: string, accountId: string): Promise<void>;
  async providerCapabilities(providerId: string, planTier?: PlanTier): Promise<ResolvedCapabilities>;
  async searchCapabilities(providerId: string, query: string, planTier?: PlanTier): Promise<ResolvedCapabilities>;

  // Fleet
  async fleetStatus(): Promise<ChromeSlave[]>;
  async fleetStart(providerId: string, accountId: string): Promise<ChromeSlave>;
  async fleetStop(providerId: string, accountId: string): Promise<void>;

  // Conversations
  async conversations(opts?: { providerId?: string; limit?: number; offset?: number }): Promise<ConversationRow[]>;
  async createConversation(providerId: string, title?: string): Promise<ConversationRow>;
  async getConversation(id: string): Promise<ConversationRow>;
  async updateConversation(id: string, patch: { title?: string; state?: string }): Promise<ConversationRow>;
  async deleteConversation(id: string): Promise<void>;
  async sendMessage(conversationId: string, message: string): Promise<SendResult>;
  async getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<ConversationMessageRow[]>;
  async getConversationCapabilities(conversationId: string, planTier?: PlanTier): Promise<ResolvedCapabilities>;
  async getBlocks(conversationId: string, opts?: { messageId?: string; blockKind?: string; limit?: number; offset?: number }): Promise<StreamBlockRow[]>;

  // Admin
  async seed(source?: string): Promise<SeedAllResult>;
  async wipe(): Promise<void>;
  async getAuditTrail(providerId: string, opts?: { limit?: number; since?: number }): Promise<RegistrationEventRow[]>;
  async getDriftSummary(providerId?: string): Promise<ManifestDriftRow[]>;

  // Config
  async getConfig(engineId: string, scope?: ConfigScope): Promise<ConfigEntry>;
  async updateConfig(engineId: string, config: Record<string, unknown>, scope?: ConfigScope): Promise<ConfigEntry>;
  async getConfigHistory(engineId: string, limit?: number): Promise<ConfigAuditEntry[]>;

  // Telemetry
  async getHealthTrend(providerId: string, days?: number): Promise<HealthTrend>;
  async getDailySummary(providerId: string, from: string, to: string): Promise<DailySummaryRow[]>;
  async getCrossProviderSummary(from: string, to: string): Promise<CrossProviderSummary>;

  // Bindings & Capabilities
  async getPromotionHistory(bindingId: string): Promise<PromotionTimeline>;
  async compareVersions(bindingId: string): Promise<VersionComparison[]>;
  async rollbackCapability(capabilityId: string, version: number): Promise<RollbackResult>;
  async getVersionHistory(capabilityId: string, limit?: number): Promise<TaxonomyVersionRow[]>;

  // WebSocket
  connectWebSocket(): WebSocket;
}
```

## Implementation Pattern
```typescript
class CapStoreClient {
  private baseUrl: string;
  private authToken?: string;

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new CapStoreError(err.error, err.code, res.status, err.details);
    }
    return res.json();
  }
}
```

## Tests
- [ ] All 30+ client methods hit correct endpoints
- [ ] Auth token sent as Bearer header
- [ ] Error responses thrown as CapStoreError
- [ ] WebSocket connection established correctly
- [ ] Type export: all types re-exported from sdk/src/index.ts

## Gate
- `bunx tsc --noEmit` passes
- All SDK tests pass against test server
- SDK types match API response shapes
