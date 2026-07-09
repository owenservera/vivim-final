# 07 — Merged API: REST, SDK, WebSocket, UI Contract, CLI & Config

**Status:** FINAL — merged PRD
**Covers:** Original `09-sdk-api-contract.md` + `10-api-contract-prd.md` + `pending-design/05-conversation-router.md` + `11-capability-ui-contract-prd.md` + CLI + Config API

---

## A: REST Endpoints

### Complete Endpoint Table

| Method | Path | Auth | Request Body / Params | Response | Engine Method |
|--------|------|------|----------------------|----------|--------------|
| `GET` | `/health` | No | — | `{ status: "ok", version: "0.1.0" }` | — |
| `GET` | `/api/providers` | Yes | `?isActive=true` | `ProviderSummary[]` | `ProviderStore.listDefinitions()` |
| `GET` | `/api/providers/:id` | Yes | — | `ProviderDetail` | `ProviderStore.getDefinition()` + `CapabilityResolutionEngine.resolve()` |
| `GET` | `/api/providers/:id/health` | Yes | — | `ProviderHealthReport` | `ProviderHealthKernel.getHealth()` |
| `GET` | `/api/providers/:id/accounts` | Yes | — | `ProviderAccount[]` | `ChromeGovernor.getAllSlaves({ providerId })` |
| `GET` | `/api/providers/:id/accounts/:accountId` | Yes | — | `ChromeSlave` | `ChromeGovernor.getSlave()` |
| `POST` | `/api/providers/:id/accounts` | Yes | `{ email: string }` | `ChromeSlave` | `ChromeGovernor.launch()` |
| `DELETE` | `/api/providers/:id/accounts/:accountId` | Yes | — | `{ ok: true }` | `ChromeGovernor.kill()` |
| `POST` | `/api/providers/:id/accounts/:accountId/default` | Yes | — | `{ ok: true }` | `ProviderStore.setDefaultAccount()` |
| `GET` | `/api/providers/:id/capabilities` | Yes | `?planTier=free` | `ResolvedCapabilities` | `CapabilityResolutionEngine.resolve()` |
| `POST` | `/api/providers/:id/capabilities/search` | Yes | `{ query: string, planTier?: string }` | `ResolvedCapabilities` | `CapabilityResolutionEngine.search()` |
| `GET` | `/api/fleet/status` | Yes | — | `ChromeSlave[]` | `ChromeGovernor.getAllSlaves()` |
| `POST` | `/api/fleet/start` | Yes | `{ providerId: string, accountId: string }` | `ChromeSlave` | `ChromeGovernor.ensureRunning()` |
| `POST` | `/api/fleet/stop` | Yes | `{ providerId: string, accountId: string }` | `{ ok: true }` | `ChromeGovernor.kill()` |
| `GET` | `/api/conversations` | Yes | `?providerId=&limit=&offset=` | `ConversationRow[]` | `ConversationStore.listConversations()` |
| `POST` | `/api/conversations` | Yes | `{ providerId: string, title?: string }` | `ConversationRow` | `ConversationManager.createConversation()` |
| `GET` | `/api/conversations/:id` | Yes | — | `ConversationRow` | `ConversationStore.getConversation()` |
| `PATCH` | `/api/conversations/:id` | Yes | `{ title?: string, state?: string }` | `ConversationRow` | `ConversationStore.updateConversation()` |
| `DELETE` | `/api/conversations/:id` | Yes | — | `{ ok: true }` | `ConversationStore.deleteConversation()` |
| `POST` | `/api/conversations/:id/send` | Yes | `{ message: string }` | `SendResult` | `ConversationManager.send()` |
| `GET` | `/api/conversations/:id/messages` | Yes | `?limit=&before=` | `ConversationMessageRow[]` | `ConversationStore.getMessages()` |
| `GET` | `/api/conversations/:id/capabilities` | Yes | `?planTier=free` | `ResolvedCapabilities` | `CapabilityResolutionEngine.resolve()` |
| `GET` | `/api/conversations/:id/blocks` | Yes | `?messageId=&blockKind=&limit=&offset=` | `StreamBlockRow[]` | `StreamBlockStore.getBlocksByConversation()` |
| `POST` | `/api/admin/seed` | Yes | `?source=all` or `?source=<slug>` | `SeedAllResult` | `ProviderRegistrar.seedAll()` |
| `POST` | `/api/admin/wipe` | Yes | — | `{ ok: true }` | `ChromeGovernor.killAll()` + store cleanup |
| `GET` | `/api/admin/audit/:providerId` | Yes | `?limit=&since=` | `RegistrationEventRow[]` | `RegistrationAuditor.getAuditTrail()` |
| `GET` | `/api/admin/drift` | Yes | `?providerId=` | `ManifestDriftRow[]` | `RegistrationAuditor.getDriftSummary()` |
| `GET` | `/api/config/:engineId` | Yes | `?scopeType=&scopeId=` | `ConfigEntry` | `ConfigManager.getConfig()` |
| `PUT` | `/api/config/:engineId` | Yes | `{ config: object }` | `ConfigEntry` | `ConfigManager.updateConfig()` |
| `GET` | `/api/config/:engineId/history` | Yes | `?limit=` | `ConfigAuditEntry[]` | `ConfigManager.getConfigHistory()` |
| `GET` | `/api/telemetry/health/:providerId` | Yes | `?days=7` | `HealthTrend` | `TelemetryAggregator.getHealthTrend()` |
| `GET` | `/api/telemetry/summary/:providerId` | Yes | `?from=&to=` | `DailySummaryRow[]` | `TelemetryAggregator.getDailySummary()` |
| `GET` | `/api/telemetry/compare` | Yes | `?from=&to=` | `CrossProviderSummary` | `TelemetryAggregator.getCrossProviderSummary()` |
| `GET` | `/api/bindings/:id/promotion-history` | Yes | — | `PromotionTimeline` | `VersionManager.getPromotionTimeline()` |
| `POST` | `/api/bindings/:id/compare-versions` | Yes | — | `VersionComparison[]` | `VersionManager.compareVersions()` |
| `POST` | `/api/capabilities/:id/rollback` | Yes | `{ version: number }` | `RollbackResult` | `VersionManager.rollbackCapability()` |
| `GET` | `/api/capabilities/:id/versions` | Yes | `?limit=` | `TaxonomyVersionRow[]` | `VersionManager.getVersionHistory()` |

---

### Auth Gate

```typescript
// src/server/auth-gate.ts

function createAuthGate(token?: string): (req: Request) => AuthResult;

interface AuthResult {
  authenticated: boolean;
  error?: { status: 401; body: { error: string; code: 'AuthRequired' } };
}
```

### Error Envelope

All errors return:

```typescript
{
  error: string;       // Human-readable message
  code: string;        // Machine-readable error code
  details?: unknown;   // Optional structured details
}
```

### Error Mapping Table

| Engine Error | HTTP Status | Error Code |
|-------------|-------------|-----------|
| `ValidationError` | 400 | `"ValidationError"` |
| `AuthRequired` | 401 | `"AuthRequired"` |
| `NotFoundError` | 404 | `"NotFoundError"` |
| `ConflictError` | 409 | `"ConflictError"` |
| `SlaveBusyError` | 409 | `"ConflictError"` |
| `CdpTimeoutError` | 504 | `"GatewayTimeout"` |
| `SlaveNotRunningError` | 503 | `"ServiceUnavailable"` |
| `CircuitOpenError` | 503 | `"CircuitOpenError"` |
| `CdpConnectionError` | 502 | `"BadGateway"` |
| `ChromeNotFoundError` | 500 | `"InternalError"` |
| `PortOccupiedError` | 500 | `"InternalError"` |
| (any other Error) | 500 | `"InternalError"` |

### Zod Validation Schemas (Key Examples)

```typescript
// src/schema/validators.ts
import { z } from 'zod/v4';

export const CreateAccountSchema = z.object({
  email: z.string().email(),
});

export const SendMessageSchema = z.object({
  message: z.string().min(1).max(100000),
});

export const CreateConversationSchema = z.object({
  providerId: z.string().min(1),
  title: z.string().max(200).optional(),
});

export const UpdateConversationSchema = z.object({
  title: z.string().max(200).optional(),
  state: z.enum(['active', 'archived', 'deleted']).optional(),
});

export const FleetStartSchema = z.object({
  providerId: z.string().min(1),
  accountId: z.string().min(1),
});

export const FleetStopSchema = z.object({
  providerId: z.string().min(1),
  accountId: z.string().min(1),
});

export const ConfigUpdateSchema = z.object({
  config: z.record(z.unknown()),
  scopeType: z.enum(['global', 'provider', 'account', 'engine']).optional(),
  scopeId: z.string().optional(),
});

export const RollbackSchema = z.object({
  version: z.number().int().positive(),
});

export const CapabilitySearchSchema = z.object({
  query: z.string().min(1).max(100),
  planTier: z.enum(['free', 'pro', 'max', 'enterprise']).optional(),
});
```

---

## B: SDK Client

### Full CapStoreClient Interface

```typescript
// sdk/src/client.ts

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

---

## C: WebSocket Protocol

### Connection

```
ws://localhost:9420/ws
  │
  ├─ Client → Server: { type: "subscribe", entityType: "conversation", entityId: "<convId>" }
  ├─ Client → Server: { type: "subscribe", entityType: "fleet", entityId: "*" }
  ├─ Client → Server: { type: "unsubscribe", entityType: "conversation", entityId: "<convId>" }
  │
  ├─ Server → Client: { type: "conversation:complete", conversationId, message: {...} }
  ├─ Server → Client: { type: "fleet:slave_status", slaveId, providerId, status, superState }
  ├─ Server → Client: { type: "capability:progress", step, total, description, moduleId, slaveId }
  ├─ Server → Client: { type: "provider:health_changed", providerId, from, to, score }
  └─ Server → Client: { type: "config:changed", engineId, actor }
```

### Event Catalog (WebSocket-Forwarded Events)

All events from the `CapabilityEventBus` are forwardable to WebSocket clients based on their `entityType` + `entityId` subscription. The WebSocket bridge translates typed events to JSON. Events are delivered synchronously within the same tick as emission.

---

## D: Capability UI Contract (21 Fields)

Every capability in `capability_taxonomy` has these 21 UI fields (plus 10 new vCode-pattern fields):

| # | Field | Type | When Used |
|---|-------|------|-----------|
| 1 | `ui_component` | ComponentType | Determines the React component rendered |
| 2 | `ui_label` | string | Button/label text |
| 3 | `ui_icon` | IconName | Icon displayed |
| 4 | `ui_position` | Position | Where the capability renders (composer/header/message/sidebar/inline) |
| 5 | `ui_order` | number | Sort order within position |
| 6 | `ui_layer_depth` | number | 0=top-level, 1+=child of parent |
| 7 | `parent_capability_id` | string \| null | Parent capability (lazy render) |
| 8 | `ui_group` | string | Grouping within position |
| 9 | `ui_priority` | Priority | primary/secondary/tertiary |
| 10 | `interaction_mode` | InteractionMode | single_click/double_click/long_press/drag_drop/toggle/dropdown |
| 11 | `ui_states` | string[] | All possible states |
| 12 | `ui_visibility_rule` | string \| null | Show/hide condition |
| 13 | `existential_rule` | string \| null | Does capability exist in this context? |
| 14 | `ui_input_schema` | object | Input fields schema |
| 15 | `mutation_effects` | object | Side effects after execution |
| 16 | `recovery_behavior` | string | retry_manual / retry_auto / fail / fallback |
| 17 | `state_persistence` | string | none / session / permanent |
| 18 | `data_flow` | string | user_to_provider / provider_to_user / bidirectional |
| 19 | `min_plan_tier` | PlanTier | Minimum plan tier |
| 20 | `depends_on` | string[] | Capability dependencies |
| 21 | `input_type` | string | void / text / file / select / number / toggle / custom |

**New vCode-pattern fields (10 added):**

| # | Field | Purpose |
|---|-------|---------|
| 22 | `concurrency_safe` | Can run in parallel? |
| 23 | `op_classification` | read/write/destructive/navigate/search |
| 24 | `requires_user_confirmation` | Must user approve? |
| 25 | `max_result_size` | Result persistence threshold |
| 26 | `result_component` | Frontend component for result rendering |
| 27 | `result_layout` | inline/overlay/sidebar/modal |
| 28 | `search_hints` | Keywords for search |
| 29 | `aliases` | Alternative slugs |
| 30 | `availability` | Gating: requires_login, requires_chrome, etc. |
| 31 | `prefetch` | Governor pre-executes during idle? |

### Component Types

| ComponentType | States | Description |
|---------------|--------|-------------|
| `action_button` | enabled, disabled, loading, active, error | Single-action button |
| `toggle_switch` | on, off, disabled, loading | Binary toggle |
| `dropdown_selector` | enabled, disabled, loading, expanded | Model/option selector |
| `text_input` | empty, focused, typing, disabled, error | Free-form text input |
| `file_upload` | idle, dragging, uploading, done, error | Drag-and-drop file upload |
| `progress_indicator` | idle, running, paused, complete, error | Execution progress |
| `color_picker` | enabled, disabled, expanded | Color selector |
| `slider_control` | enabled, disabled, dragging | Range slider |
| `context_menu` | hidden, visible, expanded | Right-click menu |
| `inline_chip` | enabled, disabled, selected, active, error | Compact text chip |

---

## E: CLI Engine

### CommandRegistry Pattern

Commands are registered as typed objects — not hardcoded in a switch:

```typescript
interface CliCommand {
  name: string;
  description: string;
  subsystem: 'cap-store' | 'backend' | 'extension';
  schema: ZodSchema;
  handler: (args: unknown) => Promise<CliOutput>;
  examples: string[];
}

interface CliOutput {
  status: number;
  data: unknown;
}

class CommandRegistry {
  register(command: CliCommand): void;
  find(name: string): CliCommand | undefined;
  list(subsystem?: string): CliCommand[];
}
```

### CLI Commands

```
cap-store providers list [--json] [--active]
cap-store providers show <slug> [--json]
cap-store fleet status [--json]
cap-store fleet start <providerId> <accountId>
cap-store fleet stop <providerId> <accountId>
cap-store conversations list [--provider <id>] [--limit <n>]
cap-store conversations create <providerId> [--title <t>]
cap-store conversations send <id> --message "<text>"
cap-store admin seed [--source <slug|all>]
cap-store admin audit <providerId> [--limit <n>]
cap-store admin drift [--provider <id>]
cap-store config get <engineId>
cap-store config set <engineId> <json>
cap-store config history <engineId>
cap-store telemetry health <providerId> [--days <n>]
cap-store telemetry summary <providerId> --from <date> --to <date>
cap-store telemetry compare --from <date> --to <date>
cap-store bindings history <bindingId>
cap-store bindings compare <bindingId>
cap-store capabilities versions <capabilityId>
cap-store capabilities rollback <capabilityId> <version>
cap-store version
cap-store serve
```

---

## F: Config API

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/config/:engineId?scopeType=&scopeId=` | Get config for engine |
| `PUT` | `/api/config/:engineId` | Update config (body: `{ config: {...}, scopeType?, scopeId? }`) |
| `GET` | `/api/config/:engineId/history?limit=` | Get config change audit |

### Config Scopes

| Scope | ScopeId | Example |
|-------|---------|---------|
| `global` | null | Applies to all providers |
| `provider` | provider_id | Per-provider config override |
| `account` | account_id | Per-account config override |
| `engine` | engine_id | Engine-level global config |

---

## See also

- `04-merged-engines.md` — Engine specs these endpoints call
- `05-merged-lifecycles.md` — ConfigManager (config persistence)
