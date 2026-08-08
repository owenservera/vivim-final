# DB Impact Assessment — AI Gateway (`src/ai/`)

**Assessment point:** 1 of N — Database. Scope: impact of implementing the AI Gateway
contract layer in `docs/dev-code-impl/AI-gtewwaay` against the existing Prisma schema
(`prisma/schema.prisma`, 195 models, SQLite `prisma/dev.db`).

**Date:** 2026-08-08 · **Status:** Assessment (document-only — no schema or code changed)

---

## 1. Executive Summary

The AI Gateway contract layer introduces **one genuinely new persistence domain** —
*attempt-level AI execution state* (`IExecutionManager` / `AIExecution` /
`ExecutionSnapshot`). Everything else maps onto tables that already exist, with
varying fidelity:

| Gateway surface | Existing table | Fidelity | Action |
|---|---|---|---|
| Provider registry / manifest | `ProviderDefinition`, `ProviderManifestVersion`, `ProviderEndpoint`, `ProviderParser`, `ProviderCapability`, `ProviderConfig`, `ProviderAccount` | **High** | Reuse |
| Model registry | `ProviderModel` | **High** | Reuse |
| Provider health | `ProviderHealth`, `ProviderHealthHistory` | **High** | Reuse |
| Routing | `RouteSpec`, `RouteTarget`, `RouteRequest`, `RouteEvent` | **Medium** | Extend (attempt scoring fields) |
| Cost / latency | `ProviderCostLog`, `ProviderLatencyLog` | **High** | Reuse |
| Plugin registry | `PluginRegistry` | **High** | Reuse |
| Policy evaluation | `PolicyRule` | **Low** | Extend (rich decision fields) |
| **Execution lifecycle** | — (no match) | **None** | **NEW: `AIExecution` + `AIExecutionEvent`** |
| **Resource leases** | — (no match) | **None** | **NEW: `ResourceLease`** |
| **Tool authz/approval/audit** | `SandboxAudit`, `HitlGate`, `AgentPermissionDecision`, `McpToolCall` | **Partial** | Extend or NEW `GatewayToolAudit` |
| **Provider state machine** | `protocolStatus` (string), `ProviderAccount.loginState` | **Low** | NEW `ProviderRuntimeState` |
| **Gateway / audit events** | `EventRecord` | **High** | Reuse |
| Conversation context | `Conversation`, `ConversationMessage`, `StreamBlock`, `AgentSession` | **High** | Reuse |

**Net DB change:** ~4 new models + ~4 additive field additions. No destructive
operations, no drops, no column type changes. Compatible with the repo's
`bunx prisma db push` DDL-only doctrine and zero-drift `migrate diff` target.

---

## 2. Methodology

Each gateway contract surface (`types.ts` v1.1.0) was mapped to Prisma models using
field-level matching. Three outcomes are possible:

- **REUSE** — the existing table already carries the needed fields (possibly with a
  different name/encoding, e.g. `*Json` strings vs relational).
- **EXTEND** — the table exists but needs additive nullable columns.
- **NEW** — no equivalent table exists; the design requires new persistence.

Fidelity ratings reflect how close the shape is, not whether data is correct today.

---

## 3. Surface-by-Surface Map

### 3.1 `IProviderRegistry` / `ProviderManifest` / `ProviderDescriptor`
- **REUSE `ProviderDefinition`** (schema line 39): `slug`, `displayName`, `category`,
  `providerType`, `isActive`, `protocolStatus`, `authType`, `hasMultiAccount`,
  `profileStrategy`, `fleetConfigJson`, `capabilitiesJson`, `modelsJson`, `pluginId`.
  Covers provider identity, category, activation, capabilities, and bundled models.
- **REUSE `ProviderManifestVersion`** (line 901): `@unique[providerId, manifestFile,
  version]`, hash + `contentJson` → covers design's versioned `ProviderManifest`
  with `integrityHash` / `signature` semantics.
- **REUSE `ProviderEndpoint` / `ProviderParser` / `ProviderCapability` /
  `ProviderConfig` / `ProviderAccount` / `ProviderType` / `ProviderOverride`**:
  endpoints, parser chain, per-provider capabilities, config (incl. secrets), accounts.
- **Gap: provider state machine.** Design's `PROVIDER_TRANSITIONS`
  (`discovered → registering → installing → validating → active | failed`, plus
  `updating | removing | disabled`) and `ProviderState.isAvailable()` are not modeled.
  `ProviderDefinition.protocolStatus` is a single unconstrained string
  (`"Active"` default), and `ProviderAccount.loginState` is per-account — neither is a
  governed lifecycle. **→ NEW `ProviderRuntimeState`** (see §4.3).

### 3.2 `IModelRegistry` / `ModelDescriptor`
- **REUSE `ProviderModel`** (line 213): `modelSlug`, `displayName`, `isActive`,
  `isDefault`, `capabilitiesJson`, `contextWindow`, `maxOutputTokens`,
  `supportsStreaming/Vision/Thinking/Tools`, `pricingInputPer1m/pricingOutputPer1m`.
  Covers the design's `ModelDescriptor` capability flags and context/pricing.
- **EXTEND (additive):** design's `ModelDescriptor` carries `id`/`name`/`providerId`
  (have), `artifact` (`uri`, `checksum`, `sizeBytes`), `resourceRequirements`
  (`ramBytes`, `vramBytes`, `cpuCores`, `gpuDevices`), `modalities`
  (`input`, `output`, `image`, `audio`), and `performance` (`ppl`, `tokPerSec`,
  `firstTokenMs`, `peakVram`). Only capabilities/context/pricing exist today.
  → Add nullable columns: `artifactJson`, `resourceRequirementsJson`,
  `modalitiesJson`, `performanceJson` (or a single `descriptorJson`). Additive only.

### 3.3 `IProviderAdapter` (runtime — HOW)
- **No DB impact.** Adapter implementations are code (ollama/llamacpp/REST/etc.).
  Configuration endpoints/models are already persisted via `ProviderConfig` +
  `LocalModelAdapter` (in-memory config) / `ProviderEndpoint`.
- The existing `src/engines/local-model-adapter.ts` (Ollama + llama.cpp) is the natural
  first `IProviderAdapter` implementation; its config is constructor-injected today and
  can be lifted to `ProviderConfig` rows without schema change.

### 3.4 `IExecutionManager` / `AIExecution` / `ExecutionSnapshot` — **GAP**
- **No existing table models attempt-level AI execution.** Closest candidates and why
  they do not fit:
  - `RouteRequest` (line 1505): `status` + `resultJson` — routing-scoped, no state
    machine, no attempt/fallback/tool phase, no tokens/cost/duration.
  - `WorkflowExecution` / `WorkflowNodeExecution` (line 1841): orchestrator DAG
    semantics — wrong lifecycle (design is `created|queued|routing|starting|
    executing|waiting-tool|draining|completed|failed|cancelled`).
  - `ParserExecutionLog`: parser-only (`logic_code` execution), not a full request.
  - `McpToolCall`: individual tool calls, not executions.
- **→ NEW `AIExecution` + `AIExecutionEvent`** (§4.1). This is the **only** table the
  contract truly requires; it backs `EXECUTION_TRANSITIONS`, `snapshot()`,
  `getByRequest`, `list`, `cancel`, `drainProvider`.

### 3.5 `IRouter` / `RoutingDependencies`
- **REUSE + EXTEND.** `RouteSpec` (name/provider/capability/isActive/configJson),
  `RouteTarget` (ordered providers/accounts with priority), `RouteRequest`
  (status/resultJson), `RouteEvent` (eventType/eventDataJson) cover the design's
  10 `RoutingStrategyName`s at the static level.
- **Gap:** dynamic routing produces a **scored candidate list** per request
  (`RoutingDecision { selected, alternatives: Array<{ providerId, modelId,
  score, reason }> }`). `RouteRequest.resultJson` can hold the final decision blob;
  for per-candidate observability add nullable `candidatesJson` + `strategyName` to
  `RouteRequest` (additive). **Reuse `RouteEvent`** as the routing audit trail.

### 3.6 `IPolicyEvaluator` / `IPolicyEnforcer`
- **REUSE `PolicyRule`** (line 2342) for the *enforcement rule set* (condition /
  classification / approval). This is the autonomous-execution phase 19 table and is
  the right home for declarative policy rules.
- **EXTEND (additive):** the design's `PolicyResult` is richer than the rule —
  `decision` (`allow|deny|require-tool-approval|require-policy-escalation`),
  `reason`, `classifier`, `trace: PolicyTrace[]` (`{ gate, decision, reason }`).
  → Add nullable `policyDecisionJson` (or persist evaluations in `AIExecutionEvent`
  with `type=policy-evaluated` — see §4.1.3). Prefer **event-logged** evaluation
  records over a new table; the policy *rules* stay in `PolicyRule`.

### 3.7 `IResourceManager` / `ResourceLease` — **GAP**
- **No existing table** models resource leases for `ram-mb | vram-mb | cpu-cores |
  disk-bytes | gpu-device | concurrent-slot`. `ProviderHealth.signalsJson` stores
  health signals but is health, not reservation/lease accounting.
- **→ NEW `ResourceLease`** (§4.2). Required if resource reservations must survive
  restart / be auditable. If leases are purely in-memory (design allows in-memory
  impl for M2), this table is optional — see §5 persistence posture.

### 3.8 `IRuntimeSupervisor`
- **No DB impact.** Supervisory policy (restart limits, backoff) is config; the
  process-spawning boundary is Rust/Tauri IPC (delegation), never TS. No model.

### 3.9 Tool pipeline — `IToolAuthorizer` → `IApprovalManager` → `IToolExecutor` → `IToolAuditLog`
- **REUSE `SandboxAudit`** (line 2616): `handlerSlug`, `ok`, `error`,
  `permissionsJson`, `ts` — the closest existing tool-audit table (handler-level).
- **REUSE `HitlGate`** (line 2395) + `AgentPermissionDecision` (line 3008) for the
  human-in-the-loop approval leg.
- **Gap:** design's `IToolAuditLog` records per-call `tool / callId / context /
  decision / approved / result / error` with `ApprovalMode` (`automatic |
  conditional | always-ask | always-deny`) per tool. `SandboxAudit` lacks
  `approvalMode`, `decision`, and structured `result`/`context` beyond
  `permissionsJson`. Two options (recommend EXTEND):
  - **EXTEND `SandboxAudit`** with nullable `approvalMode`, `decisionJson`,
    `resultJson`, `contextJson` — keeps one audit home, additive.
  - OR NEW `GatewayToolAudit` if tool approval must stay isolated from sandbox
    handler audits.
  Recommend **EXTEND `SandboxAudit`** for v1 (no new table, no behavioral change to
  existing rows).

### 3.10 `IPluginManager` / `PluginDescriptor` / `PluginState`
- **REUSE `PluginRegistry`** (line 2294): `name` (unique), `version`, `filePath`,
  `capabilities_json`, `dependsOnJson`, `integrityHash`, `manifestJson`, `isActive`,
  `loadedAt` — covers the design's `PluginDescriptor`, `integrityHash`, trust model,
  and install/uninstall/enable/disable lifecycle.
- **Gap:** design has a `PluginState` lifecycle (`discovered | installing | installed |
  validating | enabled | disabled | failed | uninstalled`) and a **certify report**
  (`PluginCertifyReport`) — `isActive` is binary, not a governed state machine.
  → **EXTEND (additive):** nullable `state` (default `"enabled"`, backfilled from
  `isActive`) + `installedAt`, OR keep `isActive` and log transitions to `EventRecord`
  (`type=plugin-state-changed`). Recommend the **EventRecord** path for v1 — zero
  column changes, `PluginRegistry.isActive` remains authoritative.

### 3.11 `bus.ts` — `GatewayEvent` / `AuditEvent`
- **REUSE `EventRecord`** (line 2989): `source`, `entityType`, `entityId`, `type`,
  `payloadJson`, `seq` `@unique[source, seq]`. The gateway bus is designed to be
  externally sinkable; `EventRecord` is the natural persistence target
  (`source='ai-gateway'`, `entityType='execution|provider|tool|resource'`).
  No schema change. If the bus must be a real in-process emitter first (M2), in-memory
  is fine — persist to `EventRecord` when an adapter is added.

### 3.12 Conversations / context assembly
- **REUSE `Conversation`, `ConversationMessage`, `StreamBlock`, `AgentSession`,
  `ContentUnit`.** Request context (conversationId, message ids) maps directly.
  No change.

---

## 4. Required Schema Additions

All additions are **additive** (new tables / new nullable columns). No existing column
is altered, dropped, or retyped. Compatible with `bunx prisma db push`.

### 4.1 NEW `AIExecution` + `AIExecutionEvent` (required)

Core execution ledger — the single necessary table for the gateway.

```prisma
// Gateway attempt-level execution ledger (AI Gateway §IExecutionManager)
model AIExecution {
  id                 String  @id
  requestId          String  @map("request_id")            // AIRequest.id (ULID)
  providerId         String  @map("provider_id")           // selected provider
  modelId            String  @map("model_id")              // selected model slug
  status             String  @map("status")                // EXECUTION_TRANSITIONS
  attempt            Int     @default(1)                   // fallback/retry counter
  maxAttempts        Int     @default(1) @map("max_attempts")
  priority           Int     @default(0)
  strategy           String?                              // RoutingStrategyName
  conversationId     String? @map("conversation_id")
  messageId          String? @map("message_id")
  toolCallsJson      String  @default("[]") @map("tool_calls_json")
  policyDecisionJson String? @map("policy_decision_json")
  tokensInput        Int?    @map("tokens_input")
  tokensOutput       Int?    @map("tokens_output")
  costCents          Int?    @map("cost_cents")
  latencyMs          Int?    @map("latency_ms")
  errorCode          String? @map("error_code")            // AIErrorCode
  errorMessage       String? @map("error_message")
  retryable          Int?                                  // derived from error
  providerExecutionId String? @map("provider_execution_id")
  resultJson         String? @map("result_json")
  createdAt          BigInt  @map("created_at")
  startedAt          BigInt? @map("started_at")
  completedAt        BigInt? @map("completed_at")
  failedAt           BigInt? @map("failed_at")
  cancelledAt        BigInt? @map("cancelled_at")
  updatedAt          BigInt  @map("updated_at")

  events AIExecutionEvent[]

  @@index([requestId], map: "idx_ai_exec_request")
  @@index([providerId, status, createdAt], map: "idx_ai_exec_provider_status")
  @@index([conversationId], map: "idx_ai_exec_conversation")
  @@map("ai_execution")
}

// Transition/observation log for an execution (snapshot history, policy evaluations)
model AIExecutionEvent {
  id            String @id
  executionId   String @map("execution_id")
  eventType     String @map("event_type")   // created|queued|routing|starting|executing|waiting-tool|draining|completed|failed|cancelled|policy-evaluated
  dataJson      String @default("{}") @map("data_json")
  ts            BigInt

  execution AIExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@index([executionId, ts], map: "idx_ai_exec_event_exec")
  @@map("ai_execution_event")
}
```

Notes:
- `requestId` is the design's `AIRequest.id`; if AIRequests are themselves persisted
  (see §5 decision), a `AIRequest` table would be the parent. Minimal path: `requestId`
  is a standalone ULID column (no FK) and the request payload rides in `resultJson`
  / `AIExecutionEvent.dataJson`.
- `status` values must be constrained by the app layer to `EXECUTION_TRANSITIONS`
  (Prisma has no CHECK in SQLite path; enforce in `IExecutionManager.transition`).
- `costCents`/`latencyMs`/tokens duplicate `ProviderCostLog`/`ProviderLatencyLog`;
  keeping them on `AIExecution` gives per-attempt totals without joins. The existing
  logs remain the aggregate/downstream source (reuse, not replacement).

### 4.2 NEW `ResourceLease` (conditional)

```prisma
// Resource reservation leases (AI Gateway §IResourceManager). Optional: skip if
// leases are in-memory only (M2) — required for restart-survivable reservations.
model ResourceLease {
  id          String @id
  resourceKind String @map("resource_kind")   // ram-mb|vram-mb|cpu-cores|disk-bytes|gpu-device|concurrent-slot
  amount      Float
  providerId  String @map("provider_id")
  executionId String? @map("execution_id")
  status      String @default("active")       // active|released|expired|revoked
  acquiredAt  BigInt @map("acquired_at")
  releasedAt  BigInt? @map("released_at")
  expiresAt   BigInt? @map("expires_at")

  @@index([resourceKind, status, expiresAt], map: "idx_res_lease_kind_status")
  @@map("resource_lease")
}
```

### 4.3 NEW `ProviderRuntimeState` (recommended)

```prisma
// Provider lifecycle state machine (AI Gateway §IProviderRegistry PROVIDER_TRANSITIONS).
// Keeps ProviderDefinition.protocolStatus as the display field; this is the governed state.
model ProviderRuntimeState {
  id             String @id
  providerId     String @unique @map("provider_id")
  phase          String @default("discovered")   // discovered|registering|installing|validating|active|updating|removing|disabled|failed
  lastErrorCode  String? @map("last_error_code")
  lastErrorMessage String? @map("last_error_message")
  available      Int    @default(0)
  transitionCount Int   @default(0) @map("transition_count")
  lastTransitionAt BigInt? @map("last_transition_at")
  createdAt      BigInt @map("created_at")
  updatedAt      BigInt @map("updated_at")

  provider ProviderDefinition @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@map("provider_runtime_state")
}
```

### 4.4 Additive field additions (EXTEND)

| Table | New nullable column(s) | Purpose |
|---|---|---|
| `ProviderModel` | `artifactJson`, `resourceRequirementsJson`, `modalitiesJson`, `performanceJson` | full `ModelDescriptor` |
| `RouteRequest` | `candidatesJson`, `strategyName` | scored candidate list observability |
| `SandboxAudit` | `approvalMode`, `decisionJson`, `resultJson`, `contextJson` | gateway `IToolAuditLog` shape |
| `PolicyRule` | (none required) — rule condition already present | enforcement rule set unchanged |

---

## 5. Persistence Posture Recommendation

| Surface | Posture | Rationale |
|---|---|---|
| `AIExecution` + events | **PERSIST (new model)** | Core contract guarantee; must survive restart, drive `list/snapshot/drainProvider` |
| Resource leases | **PERSIST** only if reservations must be restart-survivable; otherwise **in-memory** (M2) | Leases are ephemeral by nature; skip table in v1 unless audit/restart need is real |
| Provider state machine | **PERSIST (new model)** — small, high value | Governed lifecycle missing today; enables `isAvailable()` truth |
| Routing decisions | **EXTEND `RouteRequest`** (candidates/strategy) | Static routing already exists; add decision observability |
| Policy evaluations | **EVENT-LOG** into `AIExecutionEvent` (`type=policy-evaluated`) | Rules live in `PolicyRule`; evaluations are observations |
| Tool authz/approval/audit | **EXTEND `SandboxAudit`** | One audit home; additive, non-breaking |
| Plugin lifecycle | **EVENT-LOG** to `EventRecord`; keep `isActive` | `PluginRegistry` covers install/state; don't add a state column in v1 |
| Gateway/Audit events | **REUSE `EventRecord`** (adapter later) | Bus stays in-memory at M2; persist via adapter when wired |
| Provider/model manifest | **REUSE** existing tables | High fidelity already |
| Conversation context | **REUSE** existing tables | No change |

**Bottom line:** implementing the contract layer requires **at minimum `AIExecution` +
`AIExecutionEvent`** (+ their store contract, e.g. `AIExecutionStore` under
`src/storage/contracts/`). `ProviderRuntimeState` and the four `EXTEND` columns are
strongly recommended. `ResourceLease` is optional (M2 can be in-memory).

---

## 6. Migration / Doctrine Notes

- **DDL:** `bunx prisma db push` (additive tables + columns only). No `_prisma_migrations`
  rows; `prisma migrate diff` remains the drift authority (target: zero drift).
- **Data migrations:** if `ProviderRuntimeState` is introduced, backfill
  `phase='active'` for all rows where `ProviderDefinition.protocolStatus='Active'`
  via the `MigrationRunner` (`src/storage/migration/`) — register a step in
  `migrations-registry.ts`. Do not add a second migration mechanism.
- **Fixture rebuild:** after schema change, rebuild the canonical test fixture with an
  ABSOLUTE URL:
  ```bash
  DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
  ```
- **Seeds:** no `seeds/` change required (provider/manifest seeding already covers the
  16-provider roster). `ProviderRuntimeState` would be seeded at `bootstrapSeedsPhase`
  alongside provider registration, or derived from `ProviderDefinition` on first use
  (lazy — consistent with the Lazy Startup invariant).
- **Booleans:** keep the repo's `Int 0/1` convention for new flags (do not use SQLite
  native boolean), matching `ProviderModel.supportsStreaming` etc.

---

## 7. Alternatives Considered

1. **`AIExecution` as a Node-store node** — rejected. The universal `Node` model is for
   knowledge-graph content (memories, artifacts, captured messages); execution state is
   a transactional ledger with high write/update churn (every transition). Mixing them
   pollutes the graph and fights `NodeVersion` time-travel semantics.
2. **`AIExecution` as `RouteRequest` extension** — rejected. `RouteRequest` is
   routing-scoped (`routeSpecId` FK, one status blob). Execution needs attempt/fallback,
   tool phases, tokens/cost/latency, policy decisions. A separate table keeps routing
   and execution independently queryable.
3. **Everything in `EventRecord` only** — rejected for execution state. `EventRecord`
   is append-only and keyed by `seq`; it cannot serve `IExecutionManager.get(id)`
   current-state lookups or `drainProvider`. It is the right *audit trail*, not the
   *source of truth*, for executions.
4. **Skip DB entirely (all in-memory, M2)** — viable as an interim implementation
   posture (matches the design's "M2 in-memory" staging), but the contract's
   `IExecutionManager` is a persistence-shaped store and `db push` is cheap/additive.
   Recommended: land the models alongside M2 so the store contract is honest from day one.

---

## 8. Open Questions (need design or user decision)

1. Should `AIRequest` be persisted as its own table (parent of `AIExecution`), or is the
   standalone `requestId` ULID column on `AIExecution` sufficient? (Recommend: ULID column
   in v1; promote to a table if request replay/intent tracking is needed.)
2. Is `ResourceLease` persistence required, or is an in-memory `IResourceManager` (M2)
   acceptable? (Recommend: in-memory v1; add table when concurrent resource audit is
   needed.)
3. Should `ProviderRuntimeState` backfill via `MigrationRunner` at the next schema
   change, or be lazily derived from `ProviderDefinition.protocolStatus` at boot?
   (Recommend: lazy derive + explicit `activate()` transitions; no backfill needed.)
4. Should tool authorization/approval extend `SandboxAudit` (recommended) or get a
   dedicated `GatewayToolAudit` table? (SandboxAudit keeps one audit home.)
