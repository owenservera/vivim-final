# 03 — Upgrade Schema: New Prisma Models, Modified Models, Migration Strategy

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Source:** prisma/schema.prisma (1689 lines, ~65 existing models)

---

## Migration Strategy

All new tables are additive — no existing table is modified structurally. Migrations use `prisma migrate dev --name upgrade-phase-{N}`. The `MigrationLog` table tracks applied migrations.

### Migration Order

1. **Phase 14 migration:** No schema changes (code-only: wire stubs)
2. **Phase 15 migration:** Memory intelligence tables (9 new models)
3. **Phase 16 migration:** Mux tables (5 new models)
4. **Phase 17 migration:** Context tables (3 new models)
5. **Phase 18 migration:** Workspace tables (4 new models, some overlap with 15)
6. **Phase 19 migration:** Autonomous tables (3 new models)
7. **Phase 20 migration:** Sovereign data tables (2 new models)

---

## New Prisma Models

### Phase 15: Memory Intelligence (Objective 1)

```prisma
// ── L16: Knowledge Graph (Upgrade) ─────────────────────────────────────────

model Entity {
  id           String  @id
  name         String
  type         String  @map("entity_type")
  description  String?
  confidence   Float   @default(0.5)
  mentionCount Int     @default(0) @map("mention_count")
  firstSeenAt  Int     @map("first_seen_at")
  lastSeenAt   Int     @map("last_seen_at")
  createdAt    Int     @map("created_at")
  updatedAt    Int     @map("updated_at")

  mentions EntityMention[]

  @@unique([name, type])
  @@index([type], map: "idx_entity_type")
  @@index([confidence], map: "idx_entity_confidence")
  @@map("entity")
}

model EntityMention {
  id             String  @id
  entityId       String  @map("entity_id")
  conversationId String  @map("conversation_id")
  messageId      String  @map("message_id")
  context        String
  confidence     Float   @default(0.5)
  ts             Int

  entity Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@index([entityId], map: "idx_em_entity")
  @@index([conversationId], map: "idx_em_conv")
  @@index([messageId], map: "idx_em_message")
  @@map("entity_mention")
}

model DecisionRecord {
  id              String  @id
  conversationId  String  @map("conversation_id")
  messageId       String  @map("message_id")
  decisionText    String  @map("decision_text")
  rationale       String?
  alternativesJson String @default("[]") @map("alternatives_json")
  confidence      Float   @default(0.5)
  ts              Int

  @@index([conversationId], map: "idx_dr_conv")
  @@index([ts], map: "idx_dr_ts")
  @@map("decision_record")
}

model PatternExtract {
  id           String  @id
  name         String
  description  String
  patternType  String  @map("pattern_type")
  occurrences  Int     @default(1)
  confidence   Float   @default(0.5)
  firstSeenAt  Int     @map("first_seen_at")
  lastSeenAt   Int     @map("last_seen_at")
  createdAt    Int     @map("created_at")
  updatedAt    Int     @map("updated_at")

  @@unique([name, patternType])
  @@index([patternType], map: "idx_pe_type")
  @@map("pattern_extract")
}

model Topic {
  id           String  @id
  name         String
  description  String?
  color        String?
  conversationCount Int @default(0) @map("conversation_count")
  createdAt    Int     @map("created_at")
  updatedAt    Int     @map("updated_at")

  conversations ConversationTopic[]

  @@map("topic")
}

model Project {
  id           String  @id
  name         String
  description  String?
  status       String  @default("active")
  conversationCount Int @default(0) @map("conversation_count")
  createdAt    Int     @map("created_at")
  updatedAt    Int     @map("updated_at")

  @@map("project")
}

model ConversationTopic {
  id             String @id
  conversationId String @map("conversation_id")
  topicId        String @map("topic_id")
  confidence     Float  @default(0.5)
  assignedAt     Int    @map("assigned_at")
  assignedBy     String @default("auto") @map("assigned_by")

  @@unique([conversationId, topicId])
  @@index([topicId], map: "idx_ctopic_topic")
  @@index([conversationId], map: "idx_ctopic_conv")
  @@map("conversation_topic")
}

model ImportJob {
  id           String  @id
  source       String  @map("import_source")
  filePath     String  @map("file_path")
  status       String  @default("pending")
  configJson   String  @default("{}") @map("config_json")
  resultJson   String? @map("result_json")
  error        String?
  startedAt    Int     @map("started_at")
  completedAt  Int?    @map("completed_at")

  @@index([source], map: "idx_ij_source")
  @@index([status], map: "idx_ij_status")
  @@map("import_job")
}

model MemoryEmbedding {
  id           String  @id
  entityType   String  @map("entity_type")
  entityId     String  @map("entity_id")
  embedding    String
  model        String
  dimensions   Int
  contentHash  String  @map("content_hash")
  createdAt    Int     @map("created_at")

  @@unique([entityType, entityId])
  @@index([entityType], map: "idx_me_type")
  @@index([contentHash], map: "idx_me_hash")
  @@map("memory_embedding")
}
```

### Phase 16: Mux Tables (Objective 2)

```prisma
// ── L17: Provider Muxing (Upgrade) ────────────────────────────────────────

model MuxSession {
  id                   String  @id
  message              String
  conversationId       String? @map("conversation_id")
  strategy             String
  status               String  @default("pending")
  synthesizedResponse  String? @map("synthesized_response")
  bestProviderId       String? @map("best_provider_id")
  totalCostCents       Int     @default(0) @map("total_cost_cents")
  totalLatencyMs       Int     @default(0) @map("total_latency_ms")
  startedAt            Int     @map("started_at")
  completedAt          Int?    @map("completed_at")

  responses MuxResponseRow[]

  @@index([conversationId], map: "idx_ms_conv")
  @@index([status], map: "idx_ms_status")
  @@map("mux_session")
}

model MuxResponseRow {
  id            String  @id
  muxSessionId  String  @map("mux_session_id")
  providerId    String  @map("provider_id")
  accountId     String? @map("account_id")
  ok            Int     @default(0)
  response      String
  latencyMs     Int     @map("latency_ms")
  costCents     Int     @default(0) @map("cost_cents")
  error         String?
  ts            Int

  session MuxSession @relation(fields: [muxSessionId], references: [id], onDelete: Cascade)

  @@index([muxSessionId], map: "idx_mr_session")
  @@index([providerId], map: "idx_mr_provider")
  @@map("mux_response")
}

model RoutingPreference {
  id            String  @id
  capabilityId  String  @map("capability_id")
  providerId    String  @map("provider_id")
  score         Float   @default(0.5)
  sampleCount   Int     @default(0) @map("sample_count")
  updatedAt     Int     @map("updated_at")

  @@unique([capabilityId, providerId])
  @@index([capabilityId], map: "idx_rp_cap")
  @@map("routing_preference")
}

model ProviderCostLog {
  id           String @id
  providerId   String @map("provider_id")
  costCents    Int    @map("cost_cents")
  tokensInput  Int    @default(0) @map("tokens_input")
  tokensOutput Int    @default(0) @map("tokens_output")
  model        String?
  ts           Int

  @@index([providerId, ts], map: "idx_pcl_provider")
  @@map("provider_cost_log")
}

model ProviderLatencyLog {
  id          String @id
  providerId  String @map("provider_id")
  latencyMs   Int    @map("latency_ms")
  capabilityId String? @map("capability_id")
  ts          Int

  @@index([providerId, ts], map: "idx_pll_provider")
  @@map("provider_latency_log")
}
```

### Phase 17: Context Tables (Objective 3)

```prisma
// ── L18: Context Assembly (Upgrade) ───────────────────────────────────────

model SituationLog {
  id              String  @id
  conversationId  String? @map("conversation_id")
  detectedType    String  @map("detected_type")
  confidence      Float
  signalsJson     String  @map("signals_json")
  timestamp       Int

  @@index([conversationId], map: "idx_sl_conv")
  @@index([detectedType], map: "idx_sl_type")
  @@map("situation_log")
}

model ContextLayerRow {
  id              String @id
  conversationId  String @map("conversation_id")
  layerName       String @map("layer_name")
  content         String
  tokenCount      Int    @map("token_count")
  priority        Int
  assembledAt     Int    @map("assembled_at")

  @@index([conversationId], map: "idx_clr_conv")
  @@index([layerName], map: "idx_clr_layer")
  @@map("context_layer")
}

model TokenBudgetRow {
  id              String @id
  conversationId  String @map("conversation_id")
  totalBudget     Int    @map("total_budget")
  layersJson      String @map("layers_json")
  strategy        String
  ts              Int

  @@index([conversationId], map: "idx_tb_conv")
  @@map("token_budget")
}
```

### Phase 18: Workspace Tables (Objectives 4+5)

```prisma
// ── L19: Adaptive Workspace (Upgrade) ─────────────────────────────────────

model WorkspaceMode {
  id           String  @id
  userId       String  @default("default") @map("user_id")
  mode         String  @default("chat")
  panelsJson   String  @default("[]") @map("panels_json")
  updatedAt    Int     @map("updated_at")

  @@unique([userId])
  @@map("workspace_mode")
}

model UserPreference {
  id         String @id
  userId     String @default("default") @map("user_id")
  key        String
  value      String
  learnedAt  Int    @map("learned_at")
  confidence Float  @default(0.5)

  @@unique([userId, key])
  @@map("user_preference")
}

model PluginRegistry {
  id           String  @id
  name         String
  version      String
  filePath     String  @map("file_path")
  capabilities String  @default("[]") @map("capabilities_json")
  isActive     Int     @default(1) @map("is_active")
  loadedAt     Int?    @map("loaded_at")
  createdAt    Int     @map("created_at")
  updatedAt    Int     @map("updated_at")

  @@unique([name])
  @@map("plugin_registry")
}

model MemoryCurated {
  id           String  @id
  memoryType   String  @map("memory_type")
  memoryId     String  @map("memory_id")
  curatedBy    String  @default("user") @map("curated_by")
  isVerified   Int     @default(1) @map("is_verified")
  isPinned     Int     @default(0) @map("is_pinned")
  note         String?
  curatedAt    Int     @map("curated_at")

  @@unique([memoryType, memoryId])
  @@map("memory_curated")
}

model MemoryFeedback {
  id           String  @id
  memoryType   String  @map("memory_type")
  memoryId     String  @map("memory_id")
  feedback     String
  correction   String?
  userId       String  @default("default") @map("user_id")
  ts           Int

  @@index([memoryType, memoryId], map: "idx_mf_memory")
  @@map("memory_feedback")
}
```

### Phase 19: Autonomous Tables (Objective 6)

```prisma
// ── L20: Autonomous Execution (Upgrade) ───────────────────────────────────

model AutonomousTask {
  id           String  @id
  goalJson     String  @map("goal_json")
  status       String  @default("pending")
  resultJson   String? @map("result_json")
  error        String?
  startedAt    Int     @map("started_at")
  completedAt  Int?    @map("completed_at")

  steps AutonomousStep[]
  gates HitlGate[]

  @@index([status], map: "idx_at_status")
  @@map("autonomous_task")
}

model AutonomousStep {
  id                    String  @id
  taskId                String  @map("task_id")
  stepIndex             Int     @map("step_index")
  description           String
  action                String
  actionInputJson       String  @map("action_input_json")
  classification        String  @map("classification")
  status                String  @default("pending")
  resultJson            String? @map("result_json")
  error                 String?
  startedAt             Int?    @map("started_at")
  completedAt           Int?    @map("completed_at")
  requiresHumanApproval Int     @default(0) @map("requires_human_approval")

  task AutonomousTask @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId], map: "idx_ast_task")
  @@map("autonomous_step")
}

model HitlGate {
  id           String  @id
  taskId       String  @map("task_id")
  stepId       String  @map("step_id")
  gateType     String  @map("gate_type")
  prompt       String
  optionsJson  String  @default("[]") @map("options_json")
  defaultValue String? @map("default_value")
  status       String  @default("pending")
  resolvedBy   String? @map("resolved_by")
  resolvedAt   Int?    @map("resolved_at")
  response     String?
  createdAt    Int     @map("created_at")
  expiresAt    Int?    @map("expires_at")

  task AutonomousTask @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId, status], map: "idx_hg_task_status")
  @@index([status], map: "idx_hg_status")
  @@map("hitl_gate")
}
```

### Phase 20: Sovereign Data Tables (Objective 7)

```prisma
// ── L21: Sovereign Data (Upgrade) ─────────────────────────────────────────

model SyncLog {
  id         String  @id
  deviceId   String  @map("device_id")
  table      String
  recordId   String  @map("record_id")
  operation  String
  dataJson   String  @map("data_json")
  ts         Int
  syncedAt   Int?    @map("synced_at")

  @@index([deviceId, syncedAt], map: "idx_sl_device")
  @@index([table, recordId], map: "idx_sl_record")
  @@map("sync_log")
}

model SyncPeer {
  id           String  @id
  deviceId     String  @map("device_id")
  name         String
  publicKey    String  @map("public_key")
  lastSyncAt   Int?    @map("last_sync_at")
  status       String  @default("pending")
  pairedAt     Int?    @map("paired_at")

  @@unique([deviceId])
  @@map("sync_peer")
}
```

---

## Modified Existing Models

### Conversation (add fields)

```prisma
// Add to existing Conversation model:
model Conversation {
  // ... existing fields ...
  projectId   String? @map("project_id")
  topicId     String? @map("topic_id")
  taskType    String? @map("task_type")  // detected situation
  source      String  @default("live")   // "live" | "imported"
  externalId  String? @map("external_id") // ID from source provider
  importJobId String? @map("import_job_id")

  @@index([projectId], map: "idx_conv_project")
  @@index([topicId], map: "idx_conv_topic")
  @@index([source, externalId], map: "idx_conv_external")
}
```

### SemanticMemory (add fields)

```prisma
// Add to existing SemanticMemory model:
model SemanticMemory {
  // ... existing fields ...
  curated     Int     @default(0)  @map("is_curated")
  verified    Int     @default(0)  @map("is_verified")
  pinned      Int     @default(0)  @map("is_pinned")
  feedbackCount Int   @default(0)  @map("feedback_count")
}
```

---

## Seed Data

### Default Topics

```json
[
  { "name": "Software Engineering", "description": "Code, architecture, debugging", "color": "#3b82f6" },
  { "name": "Writing", "description": "Articles, documentation, creative", "color": "#10b981" },
  { "name": "Research", "description": "Information gathering, analysis", "color": "#f59e0b" },
  { "name": "Planning", "description": "Project planning, task management", "color": "#8b5cf6" },
  { "name": "Learning", "description": "Educational content, tutorials", "color": "#ec4899" }
]
```

### Default Execution Policy Rules

```json
[
  { "name": "read_only_safe", "condition": "action IN ('get','list','read','query','fetch','search')", "classification": "read", "requiresApproval": false },
  { "name": "navigate_safe", "condition": "action = 'navigate'", "classification": "navigate", "requiresApproval": false },
  { "name": "write_needs_approval", "condition": "action IN ('create','update','delete','submit','send')", "classification": "write", "requiresApproval": true },
  { "name": "destructive_always_approval", "condition": "action IN ('delete_permanent','format','reset')", "classification": "destructive", "requiresApproval": true },
  { "name": "financial_always_approval", "condition": "action IN ('purchase','pay','transfer','subscribe')", "classification": "financial", "requiresApproval": true }
]
```

---

## Migration Commands

```bash
# Phase 15
bunx prisma migrate dev --name upgrade_phase15_memory_intelligence

# Phase 16
bunx prisma migrate dev --name upgrade_phase16_mux

# Phase 17
bunx prisma migrate dev --name upgrade_phase17_context

# Phase 18
bunx prisma migrate dev --name upgrade_phase18_workspace

# Phase 19
bunx prisma migrate dev --name upgrade_phase19_autonomous

# Phase 20
bunx prisma migrate dev --name upgrade_phase20_sovereign_data
```

After each migration, run `bunx prisma generate` to update the client.
