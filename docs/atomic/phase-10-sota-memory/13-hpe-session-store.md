# Unit 10.13: HPE hpe_session store contract

**Phase:** 10 | **File:** `src/storage/contracts/hpe-session-store.ts`
**Depends:** 10.8-10.10 HarnessProtocolEngine, 1.4 CapStoreDb | **Produces:** Persistence contract for `hpe_session`
**Source:** `sota-09-harness-protocol-engine.md` §Schema Delta (FR-7.1, AC-8.1), `03-merged-schema.md` §L9 (retention note)

## Purpose
Store contract that backs the HarnessProtocolEngine (10.8 PromptAugmenter, 10.9 ResponseExtractor, 10.10 ActionRouter + feedback loop). FR-7.1 requires every prompt augmentation and response extraction to be persisted as an `hpe_session` row referenced by `conversation_id` or `workflow_execution_id`. This unit defines the contract only (the Prisma model for `hpe_session` is added in the Phase 10 schema delta, 10.11); the impl lands in 10.12.

The 20-v1 `CapabilityEvent` union is unchanged — HPE emits its own `hpe:*` events (3.6 §Publisher table, SOTA-09) through the existing bus.

## Interface
```typescript
interface HpeSessionRow {
  id: string;
  conversationId: string | null;
  workflowExecutionId: string | null;
  // Outbound
  rawPrompt: string;
  augmentedPrompt: string;
  harnessContextJson: string;
  expectedSchemaJson: string | null;
  // Inbound
  rawResponse: string | null;
  extractedBlocksJson: string | null;
  extractedActionsJson: string | null;
  extractionStrategy: string | null;
  extractionConfidence: number | null;
  extractionDurationMs: number | null;
  repairsAppliedJson: string;       // default '[]'
  // Validation & Routing
  validatedActionsJson: string | null;
  rejectedActionsJson: string | null;
  // Execution
  executionOutcomesJson: string | null;
  executionFeedbackJson: string | null;
  // Timing
  augmentedAt: number;
  respondedAt: number | null;
  extractedAt: number | null;
  executedAt: number | null;
  // Errors
  error: string | null;
}

interface HpeSessionInput {
  conversationId?: string | null;
  workflowExecutionId?: string | null;
  rawPrompt: string;
  augmentedPrompt: string;
  harnessContextJson: string;
  expectedSchemaJson?: string | null;
  augmentedAt: number;
}

interface HpeSessionStore {
  create(input: HpeSessionInput): Promise<HpeSessionRow>;
  update(id: string, patch: Partial<HpeSessionRow>): Promise<void>;
  get(id: string): Promise<HpeSessionRow | null>;
  listByConversation(conversationId: string): Promise<HpeSessionRow[]>;
  listByWorkflowExecution(workflowExecutionId: string): Promise<HpeSessionRow[]>;
  // Retention: rows older than CAP_STORE_HPE_RETENTION_DAYS (default 30) are purged
  // by TelemetryAggregator's weekly cycle, unless referenced by an active
  // conversation or workflow execution.
  purgeOlderThan(cutoffTs: number): Promise<number>;
}
```

## Tests
- [ ] `create()` persists an `hpe_session` row and `get()` returns it
- [ ] `update()` patches inbound/validation/execution fields across the lifecycle
- [ ] `listByConversation()` / `listByWorkflowExecution()` return rows ordered by `augmentedAt DESC`
- [ ] `purgeOlderThan()` deletes only rows older than `cutoffTs` and returns the count
- [ ] Row is addressable by `conversation_id` XOR `workflow_execution_id` (one is set)

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `CapStoreDb`
- Prisma model for `hpe_session` is delivered by 10.11; impl by 10.12
- Retention semantics documented; purge is idempotent
