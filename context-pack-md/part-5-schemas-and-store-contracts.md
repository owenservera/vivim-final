# part-5-schemas-and-store-contracts.md

> vivim-final context pack — Zod runtime validation layer (38 files) + storage contracts (58 files — engines depend on these, never impls)

## src/schema/agentic.ts

```ts
// src/schema/agentic.ts
// Agentic backbone — first-class Node sub-types for the SOTA agentic system.
//
// Design stance (beyond the base plan): the 150-model schema already has a kernel
// provenance trace, NLCL knowledge graph, semantic/episodic/procedural memory, routing
// preferences, provider archetypes and mux sessions. What it LACKS is:
//   1. A durable OBJECTIVE that survives across many runs (sleep / wake / re-plan).
//   2. A mutable, versioned AGENT BELIEF state (the agent's working view of the world,
//      distinct from FSRS curation memory).
//   3. CAUSAL provenance: an agent step that emits a node must link to it by a typed
//      edge, so the graph answers "which exact step produced this memory, under which
//      governance policy, by which agent." Today provenance is engine-scoped, not
//      step->node.
//   4. ECONOMIC + REPUTATION coupling in governance: allocation is data-driven by
//      cost/reputation, not just round-robin cursors.
//
// Every type below is a Node row. Payload lives in dataJson, validated by the Zod
// schema. ACU fields (version, state, authorDid, acl, quality) apply automatically.

import { z } from 'zod'

// ── Shared: actor reference ──────────────────────────────────────────────────
// A human and an agent are interchangeable as edge/author endpoints. This is the
// "agents are users" principle made explicit in data.

export const ActorRefSchema = z.object({
  kind: z.enum(['user', 'agent']),
  id: z.string().min(1),
})
export type ActorRef = z.infer<typeof ActorRefSchema>

export function actorDid(a: ActorRef): string {
  return `${a.kind}:${a.id}`
}

export function parseActorDid(did: string | null | undefined): ActorRef | null {
  if (!did) return null
  const i = did.indexOf(':')
  if (i < 0) return null
  const kind = did.slice(0, i)
  const id = did.slice(i + 1)
  if ((kind === 'user' || kind === 'agent') && id) return { kind, id }
  return null
}

// ── Edge vocabulary (typed, graph-walkable) ──────────────────────────────────

export const AGENTIC_EDGE = {
  SPAWNED: 'spawned', // agent -> agent (lineage)
  USES: 'uses', // agent -> tool
  PLAYS: 'plays', // agent -> role
  PLAYED_BY: 'played_by', // role -> agent (assignment history)
  DEFINES: 'defines', // governance_policy -> role
  GOVERNS: 'governs', // governance_policy -> agent_run
  CHILD: 'child', // agent_run -> agent_run (sub-agent tree)
  STEP: 'step', // agent_run -> agent_step
  INVOKED_IN: 'invoked_in', // tool -> agent_step
  VERSION_OF: 'version_of', // tool -> tool (fork/remix)
  EMITS: 'emits', // agent_step -> node (CAUSAL PROVENANCE)
  BELIEVES: 'believes', // agent/objective -> agent_belief
  PURSUES: 'pursues', // agent -> objective
  SUBTASK: 'subtask', // objective -> objective
  BUILT: 'built', // builder_run -> agent
} as const

// ── 1. cap-store.agent — Agent as an actor ──────────────────────────────────

export const AgentReputationSchema = z.object({
  score: z.number().min(0).max(1).default(0.5),
  runsCompleted: z.number().int().nonnegative().default(0),
  runsFailed: z.number().int().nonnegative().default(0),
  avgQuality: z.number().min(0).max(1).default(0.5),
  avgCostCents: z.number().nonnegative().default(0),
})
export type AgentReputation = z.infer<typeof AgentReputationSchema>

export const AgentDataSchema = z.object({
  handle: z.string().min(1),
  displayName: z.string().min(1),
  personaJson: z.record(z.unknown()).default({}),
  modelPrefsJson: z.record(z.unknown()).default({}),
  capabilitiesJson: z.record(z.unknown()).default({}),
  reputation: AgentReputationSchema.default({}),
  status: z.enum(['draft', 'active', 'paused', 'retired']).default('draft'),
  parentAgentId: z.string().optional(),
  createdByActor: ActorRefSchema,
})
export type AgentData = z.infer<typeof AgentDataSchema>

// ── 2. cap-store.role — a governance slot ───────────────────────────────────

export const RoleDataSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  requiredCapabilitiesJson: z.record(z.unknown()).default({}),
  constraintsJson: z
    .object({
      maxCostCents: z.number().nonnegative().optional(),
      maxTokens: z.number().int().nonnegative().optional(),
      allowBrowser: z.boolean().default(false),
      allowTools: z.boolean().default(true),
      maxSteps: z.number().int().nonnegative().optional(),
    })
    .default({}),
})
export type RoleData = z.infer<typeof RoleDataSchema>

// ── 3. cap-store.governance_policy — multi-role / multi-model allocation ────
// Strategy drives allocation. Roles map to candidate agents + models + weights.
// allocationJson + rotationStateJson are runtime state. ECONOMIC/REPUTATION knobs
// make allocation data-driven (cost-aware, reputation-weighted) rather than a dumb
// round-robin cursor.

export const GovernanceRoleBindingSchema = z.object({
  roleId: z.string(),
  candidateAgentIds: z.array(z.string()).default([]),
  weights: z.array(z.number().min(0)).default([]),
  models: z.array(z.string()).default([]),
  fallbackAgentIds: z.array(z.string()).default([]),
})
export type GovernanceRoleBinding = z.infer<typeof GovernanceRoleBindingSchema>

export const GovernancePolicyDataSchema = z.object({
  name: z.string().min(1),
  strategy: z
    .enum([
      'round_robin',
      'weighted',
      'capability_match',
      'cost_aware',
      'fallback_chain',
      'ensemble',
    ])
    .default('round_robin'),
  roles: z.array(GovernanceRoleBindingSchema).default([]),
  allocationJson: z.record(z.unknown()).default({}),
  rotationStateJson: z.record(z.unknown()).default({}),
  // Economic + reputation coupling (the real differentiator):
  costBudgetCents: z.number().nonnegative().optional(),
  reputationFloor: z.number().min(0).max(1).optional(),
  preferLowerCost: z.boolean().default(false),
  stopConditionsJson: z
    .object({
      maxSteps: z.number().int().nonnegative().optional(),
      convergeOn: z.string().optional(),
      deadlineAt: z.number().optional(),
    })
    .default({}),
})
export type GovernancePolicyData = z.infer<typeof GovernancePolicyDataSchema>

// ── 4. cap-store.agent_run — durable, resumable, forkable ───────────────────

export const AgentRunDataSchema = z.object({
  goalJson: z.record(z.unknown()).default({}),
  objectiveId: z.string().optional(),
  governancePolicyId: z.string().optional(),
  roleBindingsJson: z.record(z.unknown()).default({}),
  status: z
    .enum(['queued', 'running', 'paused', 'awaiting_human', 'done', 'failed', 'superseded'])
    .default('queued'),
  parentRunId: z.string().optional(),
  rootRunId: z.string().optional(),
  checkpointJson: z.record(z.unknown()).default({}),
  costJson: z
    .object({
      totalCostCents: z.number().nonnegative().default(0),
      perProvider: z.record(z.number().nonnegative()).default({}),
      totalTokens: z.number().int().nonnegative().default(0),
    })
    .default({}),
  resultJson: z.record(z.unknown()).optional(),
})
export type AgentRunData = z.infer<typeof AgentRunDataSchema>

// ── 5. cap-store.agent_step — atomic unit of work (CAUSAL PROVENANCE) ────────

export const AgentStepDataSchema = z.object({
  runId: z.string(),
  stepIndex: z.number().int().nonnegative(),
  roleId: z.string().optional(),
  actor: ActorRefSchema,
  actionType: z.enum([
    'llm_call',
    'tool_call',
    'human_input',
    'spawn',
    'decide',
    'observe',
    'reflect',
  ]),
  modelRef: z.string().optional(),
  inputJson: z.record(z.unknown()).default({}),
  outputJson: z.record(z.unknown()).default({}),
  toolCallId: z.string().optional(),
  success: z.boolean().default(true),
  durationMs: z.number().int().nonnegative().default(0),
  costJson: z
    .object({
      costCents: z.number().nonnegative().default(0),
      tokens: z.number().int().nonnegative().default(0),
    })
    .default({}),
  // Causal provenance: node ids this step emitted (memory/artifact/belief/objective).
  emitsNodeIds: z.array(z.string()).default([]),
})
export type AgentStepData = z.infer<typeof AgentStepDataSchema>

// ── 6. cap-store.tool — generated / registered tool ─────────────────────────

export const ToolDataSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  kind: z.enum(['generated', 'mcp', 'builtin', 'imported']).default('generated'),
  codeRef: z.string().default(''),
  inputSchemaJson: z.record(z.unknown()).default({}),
  outputSchemaJson: z.record(z.unknown()).default({}),
  sandboxJson: z
    .object({
      timeoutMs: z.number().int().positive().default(5000),
      allowNetwork: z.boolean().default(false),
      allowFs: z.boolean().default(false),
      allowBrowser: z.boolean().default(false),
      permissions: z.array(z.string()).default([]),
    })
    .default({}),
  version: z.number().int().positive().default(1),
  status: z.enum(['draft', 'active', 'deprecated']).default('draft'),
  generatedByActor: ActorRefSchema,
  provenanceJson: z.record(z.unknown()).default({}),
})
export type ToolData = z.infer<typeof ToolDataSchema>

// ── 7. cap-store.objective — durable cross-run intent (NEW, beyond plan) ─────
// The thing the system actually pursues. Survives across many runs; has an agenda
// (sleep / wake / re-plan); tracks progress. Nothing in the 150-model schema
// persists intent across runs — this is the missing spine.

export const ObjectiveAgendaItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['task', 'wait_for_event', 'human_check', 'sleep_until', 'review']),
  payloadJson: z.record(z.unknown()).default({}),
  status: z.enum(['pending', 'active', 'done', 'skipped', 'blocked']).default('pending'),
})
export type ObjectiveAgendaItem = z.infer<typeof ObjectiveAgendaItemSchema>

export const ObjectiveDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  goalJson: z.record(z.unknown()).default({}),
  status: z
    .enum(['draft', 'active', 'paused', 'blocked', 'succeeded', 'failed', 'archived'])
    .default('active'),
  agenda: z.array(ObjectiveAgendaItemSchema).default([]),
  agendaCursor: z.number().int().nonnegative().default(0),
  progress: z.number().min(0).max(1).default(0),
  ownerActor: ActorRefSchema,
  parentObjectiveId: z.string().optional(),
  wakeAt: z.number().optional(),
  successCriteriaJson: z.record(z.unknown()).default({}),
})
export type ObjectiveData = z.infer<typeof ObjectiveDataSchema>

// ── 8. cap-store.agent_belief — versioned, mutable world-model (NEW) ─────────
// The agent's working view of the world, distinct from FSRS curation memory.
// Each mutation writes a version (time-travelable). Beliefs can be retracted.

export const AgentBeliefDataSchema = z.object({
  ownerKind: z.enum(['agent', 'objective']),
  ownerId: z.string(),
  topic: z.string().min(1),
  claim: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.5),
  evidenceNodeIds: z.array(z.string()).default([]),
  retracted: z.boolean().default(false),
  sourceStepId: z.string().optional(),
})
export type AgentBeliefData = z.infer<typeof AgentBeliefDataSchema>

// ── 9. cap-store.builder_run — agent construction (separate subsystem emits this)

export const BuilderRunDataSchema = z.object({
  initiatorActor: ActorRefSchema,
  intentJson: z.record(z.unknown()).default({}),
  mode: z.enum(['human_led', 'agent_led']).default('human_led'),
  stage: z
    .enum(['discover', 'infer', 'draft', 'validate', 'spawn', 'done', 'failed'])
    .default('discover'),
  producedAgentId: z.string().optional(),
  producedRunId: z.string().optional(),
  status: z.enum(['pending', 'running', 'done', 'failed']).default('pending'),
  resultJson: z.record(z.unknown()).default({}),
})
export type BuilderRunData = z.infer<typeof BuilderRunDataSchema>

// ── Node type discriminator additions ──────────────────────────────────────

export const AGENTIC_NODE_TYPES = [
  'cap-store.agent',
  'cap-store.role',
  'cap-store.governance_policy',
  'cap-store.agent_run',
  'cap-store.agent_step',
  'cap-store.tool',
  'cap-store.objective',
  'cap-store.agent_belief',
  'cap-store.builder_run',
] as const

export type AgenticNodeType = (typeof AGENTIC_NODE_TYPES)[number]

export const agenticDataSchemas: Record<AgenticNodeType, z.ZodTypeAny> = {
  'cap-store.agent': AgentDataSchema,
  'cap-store.role': RoleDataSchema,
  'cap-store.governance_policy': GovernancePolicyDataSchema,
  'cap-store.agent_run': AgentRunDataSchema,
  'cap-store.agent_step': AgentStepDataSchema,
  'cap-store.tool': ToolDataSchema,
  'cap-store.objective': ObjectiveDataSchema,
  'cap-store.agent_belief': AgentBeliefDataSchema,
  'cap-store.builder_run': BuilderRunDataSchema,
}
```

## src/schema/api-types.ts

```ts
// src/schema/api-types.ts
// Shared API response types for frontend-backend contract alignment.
// Import these types in both backend routers and frontend API clients.

// ── Base Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<_T = unknown> {
  ok: boolean
  error?: string
  code?: string
  details?: unknown
  traceId: string
  latencyMs: number
}

export interface ApiSuccessResponse<T = unknown> extends ApiResponse<T> {
  ok: true
  data?: T
}

export interface ApiErrorResponse extends ApiResponse {
  ok: false
  error: string
  code: string
  details?: unknown
}

// ── Capability Response Types ────────────────────────────────────────────────

export interface CapabilityDetail {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  surfaces: string[]
  inputSchema: unknown
  outputSchema: unknown
  cliCommand: unknown
  ui: unknown
  uiAction: unknown
  apiEndpoint: unknown
  workflowNodeType: unknown
  mcpToolName: unknown
  requiresConfirmation: boolean
  tags: string[]
}

export interface CapabilityExecuteResponse {
  ok: true
  capabilityId: string
  output: unknown
  traceId: string
  latencyMs: number
}

export interface CapabilityListResponse {
  capabilities: CapabilityDetail[]
  total: number
}

// ── Interpret Request/Response Types ─────────────────────────────────────────

export interface InterpretBody {
  text: string
  ctx?: {
    conversationId?: string
    providerId?: string
    slaveId?: string
    userId?: string
    metadata?: Record<string, unknown>
    conversationState?: Record<string, unknown>
    canvasState?: Record<string, unknown>
    activeSessionId?: string
  }
}

export interface InterpretSuccessResponse {
  ok: boolean
  capabilityId: string
  output: unknown
  text?: string
  traceId: string
  latencyMs: number
  requiresConfirmation?: false
  confirmation?: undefined
  clarification?: undefined
}

export interface InterpretConfirmationResponse {
  ok: true
  requiresConfirmation: true
  confirmation: {
    token: string
    prompt: string
  }
  traceId: string
  latencyMs: number
  capabilityId?: undefined
  output?: undefined
  text?: undefined
  clarification?: undefined
}

export interface InterpretClarificationResponse {
  ok: false
  clarification: {
    prompt: string
    missing?: string[]
    ambiguous?: string[]
    options?: string[]
  }
  traceId: string
  latencyMs: number
  capabilityId?: undefined
  output?: undefined
  text?: undefined
  confirmation?: undefined
}

export interface InterpretErrorResponse {
  ok: false
  error: string
  traceId: string
  latencyMs: number
  capabilityId?: undefined
  output?: undefined
  text?: undefined
  confirmation?: undefined
  clarification?: undefined
}

export type InterpretResponse =
  | InterpretSuccessResponse
  | InterpretConfirmationResponse
  | InterpretClarificationResponse
  | InterpretErrorResponse

// ── Async Capability Result (audit 🚀-27) ────────────────────────────────────
// Tier 4 units 16.2–16.4 — shared contract for long-running capabilities.
// Both onboarding (long-running CDP) and NLCL (generative tasks) return this
// shape from execute() when the operation can't complete synchronously.

export interface AsyncCapabilityResult {
  /** Marker field — always 'async'. */
  async: true
  /** The task ID — poll /api/generative/status/:taskId or subscribe via WS. */
  taskId: string
  /** Estimated time to completion (ms), or null if unknown. */
  estimatedMs: number | null
  /** Human-readable status message. */
  message: string
}

export function isAsyncCapabilityResult(v: unknown): v is AsyncCapabilityResult {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { async?: unknown }).async === true &&
    typeof (v as { taskId?: unknown }).taskId === 'string'
  )
}

// ── Generative Task Response Types ───────────────────────────────────────────

export interface GenerativeTaskStatusResponse {
  taskId: string
  capabilityId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  output: unknown
  error: string | null
  progress: Array<{
    fraction: number
    message: string
    timestamp: number
  }>
  createdAt: number
  updatedAt: number
  completedAt: number | null
  /** True if the task is still in a terminal state within the TTL window. */
  expired: boolean
}

// ── Conversation Response Types ──────────────────────────────────────────────

export interface ConversationDetail {
  id: string
  providerSessionId: string
  providerId: string
  title: string | null
  state: string
  messageCount: number
  lastMessageAt: number | null
  contextJson: string
  createdAt: number
  updatedAt: number
}

export interface ConversationMessageDetail {
  id: string
  conversationId: string
  role: string
  content: string | null
  blocksJson: string
  blockCount: number
  parentMessageId: string | null
  sequenceIndex: number
  latencyMs: number | null
  tokenCount: number | null
  model: string | null
  metadataJson: string
  createdAt: number
}

export interface SendMessageResponse {
  ok: true
  messageId: string
  blocks: unknown[]
  text: string
  latencyMs: number
  traceId: string
}

export interface SendMessageErrorResponse {
  ok: false
  messageId: string
  blocks: unknown[]
  text: string
  latencyMs: number
  error: string
  traceId: string
}

export type SendMessageResponseUnion = SendMessageResponse | SendMessageErrorResponse

// ── WebSocket Event Types ────────────────────────────────────────────────────

export interface WsBaseEvent {
  type: string
  timestamp: number
}

export interface WsHelloAckEvent extends WsBaseEvent {
  type: 'hello:ack'
  sessionId: string
}

export interface WsCapabilityExecutedEvent extends WsBaseEvent {
  type: 'capability:executed'
  capabilityId: string
  providerId: string
  traceId: string
  ok: boolean
  latencyMs: number
  bindingId?: string
}

export interface WsCapabilityProgressEvent extends WsBaseEvent {
  type: 'capability:progress'
  step: number
  total: number
  description: string
  moduleId: string
  slaveId: string
}

export interface WsGenericEvent extends WsBaseEvent {
  type: string
  [key: string]: unknown
}

export type WsEvent =
  | WsHelloAckEvent
  | WsCapabilityExecutedEvent
  | WsCapabilityProgressEvent
  | WsGenericEvent

// ── Health Response Types ────────────────────────────────────────────────────

export interface ProviderHealthDetail {
  providerId: string
  overallStatus: string
  overallScore: number
  signalsJson: string
  parserConfidenceAvg: number | null
  selectorHitRateAvg: number | null
  fleetRunning: number
  fleetStopped: number
  fleetError: number
  circuitOpen: number
  driftRecent: number
  driftUnresolved: number
  lastCheckAt: number | null
}

export interface HealthDashboardResponse {
  providers: ProviderHealthDetail[]
  timestamp: number
}

// ── Provider Response Types ──────────────────────────────────────────────────

export interface ProviderDetail {
  id: string
  slug: string
  displayName: string
  description: string | null
  category: string
  providerType: string
  isActive: number
  protocolStatus: string
  websiteUrl: string | null
  documentationUrl: string | null
  authType: string
  hasMultiAccount: number
  profileStrategy: string
  createdAt: number
  updatedAt: number
}

export interface ProviderListResponse {
  providers: ProviderDetail[]
  total: number
}
```

## src/schema/api-validators.ts

```ts
// src/schema/api-validators.ts
// Shared Zod schemas for API request body validation.
// Import these in routers to avoid duplicating validation logic.

import { z } from 'zod'

// ── Common patterns ──────────────────────────────────────────────────────────

/** Non-empty string ID (ULID, UUID, or slug). */
export const IdParam = z.string().min(1)

/** Optional string that defaults to undefined when empty. */
export const OptionalString = z.string().optional()

/** Record of arbitrary key-value pairs. */
export const MetadataRecord = z.record(z.unknown()).optional()

// ── Autonomous task schemas ──────────────────────────────────────────────────

export const AutonomousGoalSchema = z.object({
  description: z.string().min(1, 'goal.description is required'),
  maxSteps: z.number().int().positive().optional(),
  maxDurationMs: z.number().int().positive().optional(),
  requireApprovalAbove: z
    .enum(['read', 'write', 'navigate', 'destructive', 'financial'])
    .optional(),
  allowBrowser: z.boolean().optional(),
  costBudgetCents: z.number().int().nonnegative().optional(),
  tokenBudget: z.number().int().nonnegative().optional(),
  iterationBudget: z.number().int().nonnegative().optional(),
  providerId: OptionalString,
  conversationId: OptionalString,
  llmProvider: OptionalString,
})

export const AutonomousExecuteSchema = z.object({
  goal: AutonomousGoalSchema,
})

export const GateResolveSchema = z.object({
  response: z.string().min(1, 'response is required'),
  resolvedBy: z.string().min(1, 'resolvedBy is required'),
})

export const ReplaySchema = z.object({
  fromStep: z.number().int().nonnegative().optional(),
})

// ── Agent canvas schemas ─────────────────────────────────────────────────────

export const AgentCanvasCommandSchema = z.object({
  agentId: IdParam,
  workspaceId: IdParam,
  command: z.record(z.unknown()),
})

export const AgentCanvasPolicySchema = z.object({
  agentId: IdParam,
  workspaceId: IdParam,
  policy: z.record(z.unknown()).optional(),
})

export const AgentCanvasPlanSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  sessionId: OptionalString,
  conversationId: OptionalString,
})

// ── Knowledge schemas ────────────────────────────────────────────────────────

export const KnowledgeIngestSchema = z.object({
  source: z.string().min(1, 'source is required'),
  filePath: z.string().min(1, 'filePath is required'),
  deduplicate: z.boolean().optional(),
  extractEntities: z.boolean().optional(),
  extractDecisions: z.boolean().optional(),
})

export const KnowledgeSynthesizeSchema = z.object({
  question: z.string().min(1, 'question is required'),
  maxSources: z.number().int().positive().optional(),
  synthesisStyle: z.enum(['summary', 'detailed', 'bullets']).optional(),
})

export const KnowledgeTopicSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: OptionalString,
})

// ── NLCL schemas ─────────────────────────────────────────────────────────────

export const NlclInterpretSchema = z.object({
  input: z.string().min(1),
  surface: OptionalString,
  providerId: OptionalString,
  conversationId: OptionalString,
  workspacePath: OptionalString,
  metadata: MetadataRecord,
})

export const NlclConfirmSchema = z.object({
  token: z.string().min(1, 'token is required'),
})

export const NlclExecuteSchema = z.object({
  input: z.string().min(1, 'input is required'),
})

// ── Node schemas ─────────────────────────────────────────────────────────────

export const NodeCreateSchema = z.object({
  type: z.string().min(1, 'type is required'),
  data: z.record(z.unknown()),
  acl: z.array(z.string()).optional(),
  securityLevel: z.number().int().nonnegative().optional(),
})

export const NodeUpdateSchema = z.object({
  id: IdParam,
  data: z.record(z.unknown()),
  patch: z.boolean().optional(),
})

export const NodeEdgeSchema = z.object({
  sourceId: IdParam,
  targetId: IdParam,
  kind: z.string().min(1, 'edge kind is required'),
  weight: z.number().min(0).max(1).optional(),
  metadata: MetadataRecord,
})

// ── Memory schemas ───────────────────────────────────────────────────────────

export const MemoryRecordSchema = z.object({
  key: z.string().min(1, 'key is required'),
  value: z.string().min(1, 'value is required'),
  namespace: OptionalString,
  ttlMs: z.number().int().positive().optional(),
})

// ── Conversation schemas ─────────────────────────────────────────────────────

export const ConversationCreateSchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
  accountId: OptionalString,
  title: OptionalString,
})

export const ConversationSendSchema = z.object({
  message: z.string().min(1, 'message is required'),
})

// ── Fleet / Chrome schemas ───────────────────────────────────────────────────

export const FleetStartSchema = z.object({
  providerId: z.string().min(1, 'providerId is required'),
  accountId: z.string().min(1, 'accountId is required'),
})

// ── Interpret (NL) schemas ───────────────────────────────────────────────────

export const InterpretSchema = z.object({
  text: z.string().min(1, 'text is required'),
  ctx: z
    .object({
      conversationId: OptionalString,
      providerId: OptionalString,
      slaveId: OptionalString,
      userId: OptionalString,
      metadata: MetadataRecord,
    })
    .optional(),
})

// ── Plugin schemas ───────────────────────────────────────────────────────────

export const PluginInstallSchema = z.object({
  name: z.string().min(1, 'name is required'),
  url: OptionalString,
  version: OptionalString,
})

export const PluginActionSchema = z.object({
  pluginId: IdParam,
  action: z.string().min(1, 'action is required'),
  params: z.record(z.unknown()).optional(),
})

// ── Template schemas ─────────────────────────────────────────────────────────

export const TemplateCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  content: z.string().min(1, 'content is required'),
  type: OptionalString,
  metadata: MetadataRecord,
})

// ── Version schemas ──────────────────────────────────────────────────────────

export const VersionCreateSchema = z.object({
  entityType: z.string().min(1, 'entityType is required'),
  entityId: IdParam,
  data: z.record(z.unknown()),
  provenance: OptionalString,
})

// ── Mutation schemas ─────────────────────────────────────────────────────────

export const MutationSchema = z.object({
  entityType: z.string().min(1, 'entityType is required'),
  entityId: IdParam,
  operation: z.enum(['update', 'delete', 'restore']),
  data: z.record(z.unknown()).optional(),
})

// ── Capability execution schemas (Work Item 05) ──────────────────────────────

export const CapabilityExecuteBodySchema = z.object({
  input: z.record(z.unknown()).optional(),
  ctx: z
    .object({
      conversationId: OptionalString,
      providerId: OptionalString,
      slaveId: OptionalString,
      userId: OptionalString,
      metadata: MetadataRecord,
    })
    .optional(),
})
```

## src/schema/automation.ts

```ts
// src/schema/automation.ts
// Automation and alerting domain types — used by Automation scheduler and Alerting subsystem.

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface AlertCondition {
  id: string
  name: string
  metric: string
  operator: string
  threshold: number
  severity: AlertSeverity
  isActive: boolean
}

export interface AlertEvent {
  id: string
  conditionId: string
  actualValue: number
  triggeredAt: number
  resolvedAt: number | null
}

export interface AutomationSchedule {
  id: string
  name: string
  trigger: string
  action: string
  isActive: boolean
  lastRunAt: number | null
  cron?: string
}

export interface AutomationRun {
  id: string
  scheduleId: string
  status: string
  resultJson: string
  startedAt: number
  completedAt: number | null
}

export interface DiscoveryObjective {
  id: string
  name: string
  targetProviderId: string
  focus: string
  status: string
}
```

## src/schema/chrome.ts

```ts
// src/schema/chrome.ts
// Chrome browser slave domain types — used by ChromeGovernor and LifecycleManager.
// Canonical lifecycle/super-state now lives in executor/slave-states (atomic-v13 / FR-3).

import type { ChromeChannel, ChromeMode } from '../executor/chrome-instance-profile.js'
import type { FleetSuperState, SlaveLifecycle } from '../executor/slave-states.js'

export type SlaveStatus = SlaveLifecycle
export type SuperState = FleetSuperState

export type { ChromeChannel, ChromeMode }
export type { FleetSuperState, SlaveLifecycle }

export interface LaunchOptions {
  headless: boolean
  userDataDir: string
  args: string[]
  timeoutMs: number
  debugPort: number
  channel?: ChromeChannel
  mode?: ChromeMode
}

export interface ChromeSlave {
  id: string
  providerId: string
  accountId: string
  status: SlaveStatus
  superState: SuperState
  port: number
  profileDir: string
  pid: number | null
  launchOptions: LaunchOptions
}

export interface CDPCommand {
  method: string
  params: Record<string, unknown>
  sessionId?: string
}

export interface CDPResult {
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}
```

## src/schema/command-description.ts

```ts
// ─── Command Description Zod Schema ─────────────────────────────────
// Validation for CommandDescription model data.

import { z } from 'zod'

/**
 * Zod schema for CommandDescription validation.
 */
export const CommandDescriptionSchema = z.object({
  id: z.string(),
  commandId: z.string().min(1),
  description: z.string().min(1),
  patterns: z.array(z.string().min(1)).min(1),
  category: z.string().min(1),
  prefix: z.string().nullable(),
  confidence: z.number().min(0).max(1).default(0.7),
  enabled: z.boolean().default(true),
})

export type CommandDescriptionInput = z.infer<typeof CommandDescriptionSchema>

/**
 * Validate a CommandDescription input.
 */
export function validateCommandDescription(
  input: unknown,
): { success: true; data: CommandDescriptionInput } | { success: false; error: string } {
  const result = CommandDescriptionSchema.safeParse(input)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: result.error.errors.map((e) => e.message).join(', '),
  }
}
```

## src/schema/conceptual-model.ts

```ts
// src/schema/conceptual-model.ts
// Zod schemas for the conceptual UI model — RegionRect, ComponentConstraints,
// SandboxPolicy, UiComponent input, ComponentContract, SlotCatalog entry.
// Enables strict contract enforcement at every write boundary.
// See docs/vivim-canvas/implementation/10-conceptual-matrix.md §3.

import { z } from 'zod'

// ── Layout ──────────────────────────────────────────────────────────────────

export const RegionRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().default(0),
  w: z.number().min(1).max(10000),
  h: z.number().min(1).max(10000),
})

// ── Constraints ──────────────────────────────────────────────────────────────

export const ComponentConstraintsSchema = z.object({
  minWidth: z.number().min(1).optional(),
  minHeight: z.number().min(1).optional(),
  maxWidth: z.number().max(10000).optional(),
  maxHeight: z.number().max(10000).optional(),
  aspectRatio: z.number().positive().optional(),
  resizable: z.boolean().default(true),
  resizeAxes: z.enum(['both', 'x', 'y', 'none']).default('both'),
})

// ── Sandbox ─────────────────────────────────────────────────────────────────

export const SandboxPolicySchema = z.object({
  csp: z
    .string()
    .default(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none';",
    ),
  allowNetwork: z.boolean().default(false),
  allowCapabilities: z.array(z.string()).default([]),
  budgetMs: z.number().min(100).max(60000).default(5000),
  allowInlineScript: z.literal(true),
})

// ── Scope ───────────────────────────────────────────────────────────────────

export const PrimitiveScopeSchema = z.enum(['cross-type', 'family', 'provider'])

// ── Component contract (input/output) ────────────────────────────────────────

export const ComponentContractSchema = z.object({
  inputs: z
    .record(
      z.object({
        type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
        required: z.boolean().default(false),
        description: z.string().optional(),
        default: z.unknown().optional(),
      }),
    )
    .default({}),
  outputs: z
    .array(
      z.object({
        event: z.string(),
        payload: z.record(z.string()).optional(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  subscriptions: z.array(z.string()).default([]),
})

// ── Component archetype ─────────────────────────────────────────────────────

export const ComponentArchetypeSchema = z.enum([
  'list',
  'form',
  'display',
  'overlay',
  'card',
  'grid',
])

// ── UiComponent input ────────────────────────────────────────────────────────

export const UiComponentInputSchema = z.object({
  primitiveId: z.string().min(1),
  scope: PrimitiveScopeSchema,
  ownerId: z.string().min(1),
  variant: z.string().nullable().optional(),
  componentKey: z
    .string()
    .min(1)
    .regex(/^[a-z0-9._-]+$/i, 'componentKey must be dot-separated identifier'),
  displayName: z.string().min(1).max(200),
  html: z.string().default(''),
  css: z.string().default(''),
  scriptUrl: z.string().nullable().optional(),
  sandbox: SandboxPolicySchema.optional(),
  constraints: ComponentConstraintsSchema.optional(),
  defaultRegion: RegionRectSchema.nullable().optional(),
  contract: ComponentContractSchema.optional(),
  archetype: ComponentArchetypeSchema.optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'deprecated']).default('published'),
  author: z.enum(['system', 'user', 'agent']).default('system'),
  version: z.number().int().positive().default(1),
})

// ── Layout update input ──────────────────────────────────────────────────────

export const LayoutUpdateSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  z: z.number().optional(),
  w: z.number().min(1).max(10000).optional(),
  h: z.number().min(1).max(10000).optional(),
})

// ── Slot catalog entry ──────────────────────────────────────────────────────

export const SlotCatalogEntrySchema = z.object({
  primitiveId: z.string().min(1),
  required: z.boolean().default(false),
  minInstances: z.number().int().min(1).default(1),
  maxInstances: z.number().int().min(1).default(3),
  accepts: z.array(z.string()).default(['text/html']),
  contract: ComponentContractSchema.optional(),
})

export const SlotCatalogSchema = z.array(SlotCatalogEntrySchema)

// ── View preset ──────────────────────────────────────────────────────────────

export const ViewPresetLayoutEntrySchema = z.object({
  componentKey: z.string().min(1),
  region: RegionRectSchema,
})

export const ViewPresetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  layout: z.array(ViewPresetLayoutEntrySchema),
  workspaceId: z.string().optional(),
  isPublic: z.boolean().default(false),
  createdBy: z.string().default('system'),
})

// ── User component layout ────────────────────────────────────────────────────

export const UserComponentLayoutSchema = z.object({
  componentKey: z.string().min(1),
  instanceId: z.string().min(1),
  workspaceId: z.string().optional(),
  x: z.number(),
  y: z.number(),
  z: z.number().default(0),
  w: z.number().min(1).max(10000),
  h: z.number().min(1).max(10000),
  minimized: z.boolean().default(false),
  userId: z.string().default('default'),
})

// ── Interaction grammar ────────────────────────────────────────────────────

export const GestureCatalogSchema = z.object({
  send: z.enum(['click', 'enter', 'both']).optional(),
  navigate: z.enum(['click', 'tap']).optional(),
  contextMenu: z.enum(['right-click', 'long-press']).optional(),
  drag: z.array(z.string()).optional(),
})

export const LayoutRulesSchema = z.record(
  z.object({
    affinity: z.enum(['top', 'bottom', 'left', 'right', 'overlay']).optional(),
    anchorTo: z.string().optional(),
  }),
)

export const InteractionGrammarSchema = z.object({
  basePrimitive: z.string().optional(),
  gesture: GestureCatalogSchema.optional(),
  layoutRules: LayoutRulesSchema.optional(),
  scrollModel: z.enum(['infinite', 'paginated', 'fixed']).default('infinite'),
})
```

## src/schema/config.ts

```ts
// src/schema/config.ts
// Configuration domain types — used by ConfigManager.

export interface ConfigEntry {
  id: string
  engineId: string
  configKey: string
  configValue: string
  configType: string
  isRuntime: boolean
}

export interface ConfigAuditEntry {
  id: string
  engineId: string
  configKey: string | null
  fromValue: string | null
  toValue: string
  actor: string
  ts: number
}

export interface ConfigSchema {
  engineId: string
  zodSchema: string
  defaults: string
  isRuntime?: boolean
}
```

## src/schema/contact.ts

```ts
// src/schema/contact.ts
// Contact and organization node types for the second brain.

import { z } from 'zod'

// ── ContactNode (cap-store.contact) ────────────────────────────────────────
// Person profile with communication channels and relationships.

export interface ContactData {
  displayName: string
  givenName?: string
  familyName?: string
  nickname?: string
  emails?: Array<{ address: string; type?: string; primary?: boolean }>
  phones?: Array<{ number: string; type?: string }>
  urls?: Array<{ url: string; type?: string }>
  organization?: string
  jobTitle?: string
  avatarUrl?: string
  notes?: string
  birthday?: string
  addresses?: Array<{
    street?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
    type?: string
  }>
  socialProfiles?: Array<{ platform: string; username: string; url?: string }>
  tags?: string[]
  source?: string
  importedAt: number
}

export const EmailFieldSchema = z.object({
  address: z.string().email(),
  type: z.string().optional(),
  primary: z.boolean().optional(),
})

export const PhoneFieldSchema = z.object({
  number: z.string(),
  type: z.string().optional(),
})

export const UrlFieldSchema = z.object({
  url: z.string(),
  type: z.string().optional(),
})

export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  type: z.string().optional(),
})

export const SocialProfileSchema = z.object({
  platform: z.string(),
  username: z.string(),
  url: z.string().optional(),
})

export const ContactDataSchema = z.object({
  displayName: z.string(),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  nickname: z.string().optional(),
  emails: z.array(EmailFieldSchema).optional(),
  phones: z.array(PhoneFieldSchema).optional(),
  urls: z.array(UrlFieldSchema).optional(),
  organization: z.string().optional(),
  jobTitle: z.string().optional(),
  avatarUrl: z.string().optional(),
  notes: z.string().optional(),
  birthday: z.string().optional(),
  addresses: z.array(AddressSchema).optional(),
  socialProfiles: z.array(SocialProfileSchema).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  importedAt: z.number(),
})

// ── OrganizationNode (cap-store.organization) ──────────────────────────────

export interface OrganizationData {
  name: string
  legalName?: string
  description?: string
  website?: string
  logoUrl?: string
  industry?: string
  employeeCount?: number
  foundedYear?: number
  addresses?: Array<{
    street?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
  }>
  tags?: string[]
  importedAt: number
}

export const OrganizationDataSchema = z.object({
  name: z.string(),
  legalName: z.string().optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  industry: z.string().optional(),
  employeeCount: z.number().int().positive().optional(),
  foundedYear: z.number().int().optional(),
  addresses: z
    .array(
      z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
  tags: z.array(z.string()).optional(),
  importedAt: z.number(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const contactNodeSchema = {
  type: 'cap-store.contact' as const,
  version: 1,
  schema: ContactDataSchema,
  indexContent: (data: ContactData) =>
    `${data.displayName} ${data.emails?.map((e) => e.address).join(' ') ?? ''} ${data.notes ?? ''}`,
  embeddingText: (data: ContactData) =>
    `${data.displayName} ${data.jobTitle ?? ''} ${data.organization ?? ''}`,
}

export const organizationNodeSchema = {
  type: 'cap-store.organization' as const,
  version: 1,
  schema: OrganizationDataSchema,
  indexContent: (data: OrganizationData) =>
    `${data.name} ${data.description ?? ''} ${data.industry ?? ''}`,
  embeddingText: (data: OrganizationData) => `${data.name} ${data.industry ?? ''}`,
}
```

## src/schema/content.ts

```ts
// src/schema/content.ts
// Barrel + boundary validation helper for ContentPart / MessageEnvelope / RichText.
// Single import point for any engine/frontend that needs the canonical model.

export type {
  ContentPart,
  ContentBlock,
  TextPart,
  ReasoningPart,
  CodePart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  SourcePart,
  CustomPart,
  ErrorPart,
  MetaPart,
  StepStartPart,
  ToolCallState,
  LegacyBlock,
} from './streaming.js'

export type { MessageData } from './message.js'

export {
  ContentPartSchema,
  TextPartSchema,
  ReasoningPartSchema,
  CodePartSchema,
  FilePartSchema,
  ToolCallPartSchema,
  ToolResultPartSchema,
  SourcePartSchema,
  CustomPartSchema,
  ErrorPartSchema,
  MetaPartSchema,
  StepStartPartSchema,
  extractText,
  blockKindOf,
  isStreaming,
  isLegacyBlock,
  migrateLegacyBlock,
  migrateLegacyParts,
} from './streaming.js'

export type {
  RichText,
  RichNode,
  FlowContent,
  PhrasingContent,
  ParagraphNode,
  HeadingNode,
  BlockquoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  ThematicBreakNode,
  HtmlNode,
  MathBlockNode,
  MermaidNode,
  TextNode,
  EmphNode,
  StrongNode,
  DeleteNode,
  InlineCodeNode,
  LinkNode,
  ImageNode,
  BreakNode,
  MathNode,
  WidgetNode,
  MentionNode,
  Mark,
} from './rich-text.js'

export {
  parseRichText,
  serializeRichText,
  extractTextFromAst,
  extractMermaid,
  extractMath,
} from './rich-text.js'

// ── Boundary validation ──────────────────────────────────────────────────
// Every parser output goes through this before reaching storage/UI.

import { type ContentPart, ContentPartSchema } from './streaming.js'

export interface ValidationResult {
  ok: boolean
  part: ContentPart | null
  error?: string
}

export function validateContentPart(raw: unknown): ValidationResult {
  const result = ContentPartSchema.safeParse(raw)
  if (result.success) {
    return { ok: true, part: result.data as ContentPart }
  }
  return {
    ok: false,
    part: null,
    error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  }
}
```

## src/schema/core.ts

```ts
// src/schema/core.ts
// Capability system domain types — taxonomy, binding, program, outcome, selectors.

export type PlanTier = 'free' | 'pro' | 'max' | 'enterprise'

export type BindingStatus =
  | 'broken'
  | 'flaky'
  | 'prospect'
  | 'retired'
  | 'stable'
  | 'test-1'
  | 'test-2'

export interface CapabilityTaxonomy {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  parentId: string | null
  inputType: string
  uiComponent: string
  uiLabel: string | null
  uiIcon: string | null
  uiPosition: string
  uiOrder: number
  uiGroup: string
  uiPriority: string
  interactionMode: string
  uiStatesJson: string
  uiVisibilityRule: string | null
  existentialRule: string | null
  uiInputSchema: string
  mutationEffectsJson: string
  recoveryBehavior: string
  statePersistence: string
  dataFlow: string
  minPlanTier: PlanTier
  dependsOnJson: string
  concurrencySafe: boolean
  opClassification: string | null
  requiresUserConfirmation: boolean
  maxResultSize: number
  resultComponent: string
  resultLayout: string
  searchHintsJson: string
  aliasesJson: string
  availabilityJson: string
  prefetch: boolean
}

export interface Binding {
  id: string
  globalId: string
  providerId: string
  status: BindingStatus
  bestProgramId: string | null
  currentProgramId: string | null
  promotionHistoryJson: string
  confidence: number
}

export interface Program {
  id: string
  bindingId: string
  version: number
  name: string | null
  supersededBy: string | null
  isActive: boolean
  configJson: string
}

export interface Outcome {
  id: string
  capabilityId: string
  bindingId: string | null
  providerId: string
  programId: string | null
  selectorStrategyId: string | null
  ok: boolean
  error: string | null
  durationMs: number | null
  confidence: number | null
  selectorUsed: string | null
  selectorHit: boolean | null
  ts: number
}

export interface SelectorStrategy {
  id: string
  name: string
  capabilityId: string
  providerId: string
  strategyType: 'css' | 'xpath' | 'text' | 'aria' | 'data' | 'regex' | 'composite'
  selectorValue: string
  priority: number
  isActive: boolean
  hitCount: number
  missCount: number
  lastUsedAt: number | null
}
```

## src/schema/document.ts

```ts
// src/schema/document.ts
// Document, code, knowledge, and webpage node types.

import { z } from 'zod'

// ── DocumentNode (cap-store.document) ──────────────────────────────────────
// Rich text documents: imported PDFs, Word, Google Docs, markdown files.

export interface DocumentData {
  title: string
  body: string
  bodyType: 'markdown' | 'html' | 'plain'
  sourceUrl?: string
  sourceFormat?: string
  pageCount?: number
  author?: string
  language?: string
  tags?: string[]
  toc?: Array<{ level: number; title: string; anchor?: string }>
}

export const DocumentDataSchema = z.object({
  title: z.string(),
  body: z.string(),
  bodyType: z.enum(['markdown', 'html', 'plain']),
  sourceUrl: z.string().optional(),
  sourceFormat: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
  author: z.string().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
  toc: z
    .array(
      z.object({
        level: z.number().int().min(1).max(6),
        title: z.string(),
        anchor: z.string().optional(),
      }),
    )
    .optional(),
})

// ── CodeNode (cap-store.code) ─────────────────────────────────────────────
// Code snippets, files, repos.

export interface CodeData {
  filename?: string
  language?: string
  code: string
  repoUrl?: string
  filePath?: string
  commitSha?: string
  diff?: string
  license?: string
  dependencies?: string[]
}

export const CodeDataSchema = z.object({
  filename: z.string().optional(),
  language: z.string().optional(),
  code: z.string(),
  repoUrl: z.string().optional(),
  filePath: z.string().optional(),
  commitSha: z.string().optional(),
  diff: z.string().optional(),
  license: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
})

// ── KnowledgeNode (cap-store.knowledge) ───────────────────────────────────
// Notes, concepts, flashcards, wiki entries.

export interface KnowledgeData {
  title: string
  body: string
  bodyType: 'markdown' | 'plain'
  summary?: string
  tags?: string[]
  references?: Array<{ title: string; url?: string; nodeId?: string }>
  flashcards?: Array<{ front: string; back: string }>
  confidence?: number
}

export const KnowledgeDataSchema = z.object({
  title: z.string(),
  body: z.string(),
  bodyType: z.enum(['markdown', 'plain']),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  references: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().optional(),
        nodeId: z.string().optional(),
      }),
    )
    .optional(),
  flashcards: z
    .array(
      z.object({
        front: z.string(),
        back: z.string(),
      }),
    )
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
})

// ── WebpageNode (cap-store.webpage) ────────────────────────────────────────
// Captured/imported web pages (bookmarks, clippings, full-page archives).

export interface WebpageData {
  url: string
  title: string
  content: string
  contentFormat: 'markdown' | 'html'
  description?: string
  author?: string
  publishedAt?: number
  siteName?: string
  favicon?: string
  screenshotUrl?: string
  archivedAt: number
  tags?: string[]
}

export const WebpageDataSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
  contentFormat: z.enum(['markdown', 'html']),
  description: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.number().optional(),
  siteName: z.string().optional(),
  favicon: z.string().optional(),
  screenshotUrl: z.string().optional(),
  archivedAt: z.number(),
  tags: z.array(z.string()).optional(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const documentNodeSchema = {
  type: 'cap-store.document' as const,
  version: 1,
  schema: DocumentDataSchema,
  indexContent: (data: DocumentData) => `${data.title}\n${data.body}`,
  embeddingText: (data: DocumentData) => `${data.title}\n${data.body}`,
}

export const codeNodeSchema = {
  type: 'cap-store.code' as const,
  version: 1,
  schema: CodeDataSchema,
  indexContent: (data: CodeData) => data.code,
  embeddingText: (data: CodeData) => data.code,
}

export const knowledgeNodeSchema = {
  type: 'cap-store.knowledge' as const,
  version: 1,
  schema: KnowledgeDataSchema,
  indexContent: (data: KnowledgeData) =>
    `${data.title}\n${data.body}\n${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: KnowledgeData) => `${data.title}\n${data.summary ?? data.body}`,
}

export const webpageNodeSchema = {
  type: 'cap-store.webpage' as const,
  version: 1,
  schema: WebpageDataSchema,
  indexContent: (data: WebpageData) => `${data.title}\n${data.content}`,
  embeddingText: (data: WebpageData) =>
    `${data.title}\n${data.description ?? data.content.slice(0, 1000)}`,
}
```

## src/schema/email.ts

```ts
// src/schema/email.ts
// Email node types for the second brain.

import { z } from 'zod'

// ── EmailNode (cap-store.email) ───────────────────────────────────────────
// Full email with headers, body, attachments, threading.

export interface EmailData {
  messageId: string
  subject: string
  from: { name?: string; address: string }
  to: Array<{ name?: string; address: string }>
  cc?: Array<{ name?: string; address: string }>
  bcc?: Array<{ name?: string; address: string }>
  body: string
  bodyType: 'plain' | 'html' | 'markdown'
  headers?: Record<string, string>
  attachments?: Array<{
    filename: string
    mediaType: string
    size?: number
    nodeId?: string
  }>
  threadId?: string
  inReplyTo?: string
  references?: string[]
  receivedAt: number
  labels?: string[]
  folder?: string
  read?: boolean
}

export const EmailAddressSchema = z.object({
  name: z.string().optional(),
  address: z.string().email(),
})

export const EmailAttachmentSchema = z.object({
  filename: z.string(),
  mediaType: z.string(),
  size: z.number().int().positive().optional(),
  nodeId: z.string().optional(),
})

export const EmailDataSchema = z.object({
  messageId: z.string(),
  subject: z.string(),
  from: EmailAddressSchema,
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema).optional(),
  bcc: z.array(EmailAddressSchema).optional(),
  body: z.string(),
  bodyType: z.enum(['plain', 'html', 'markdown']),
  headers: z.record(z.string()).optional(),
  attachments: z.array(EmailAttachmentSchema).optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  receivedAt: z.number(),
  labels: z.array(z.string()).optional(),
  folder: z.string().optional(),
  read: z.boolean().optional(),
})

// ── EmailThreadNode (cap-store.email-thread) ──────────────────────────────
// Groups emails by thread.

export interface EmailThreadData {
  threadId: string
  subject: string
  participants: string[]
  emailIds: string[]
  latestAt: number
  messageCount: number
  labels?: string[]
}

export const EmailThreadDataSchema = z.object({
  threadId: z.string(),
  subject: z.string(),
  participants: z.array(z.string()),
  emailIds: z.array(z.string()),
  latestAt: z.number(),
  messageCount: z.number().int().positive(),
  labels: z.array(z.string()).optional(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const emailNodeSchema = {
  type: 'cap-store.email' as const,
  version: 1,
  schema: EmailDataSchema,
  indexContent: (data: EmailData) => `${data.subject}\n${data.body}`,
  embeddingText: (data: EmailData) => `${data.subject}\n${data.body}`,
}

export const emailThreadNodeSchema = {
  type: 'cap-store.email-thread' as const,
  version: 1,
  schema: EmailThreadDataSchema,
  indexContent: (data: EmailThreadData) => `${data.subject} ${data.participants.join(' ')}`,
  embeddingText: (data: EmailThreadData) => data.subject,
}
```

## src/schema/event.ts

```ts
// src/schema/event.ts
// Calendar event, reminder, and location node types.

import { z } from 'zod'

// ── EventNode (cap-store.event) ────────────────────────────────────────────
// Calendar events with attendees, recurrence, location.

export interface EventData {
  title: string
  description?: string
  startAt: number
  endAt: number
  allDay?: boolean
  timezone?: string
  location?: string
  locationNodeId?: string
  virtualMeetingUrl?: string
  attendees?: Array<{
    name?: string
    email?: string
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'pending'
  }>
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval?: number
    endAt?: number
    count?: number
    daysOfWeek?: number[]
  }
  recurrenceId?: string
  organizer?: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  source?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export const AttendeeSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  responseStatus: z.enum(['accepted', 'declined', 'tentative', 'pending']).optional(),
})

export const EventDataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  startAt: z.number(),
  endAt: z.number(),
  allDay: z.boolean().optional(),
  timezone: z.string().optional(),
  location: z.string().optional(),
  locationNodeId: z.string().optional(),
  virtualMeetingUrl: z.string().optional(),
  attendees: z.array(AttendeeSchema).optional(),
  recurrence: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      interval: z.number().int().positive().optional(),
      endAt: z.number().optional(),
      count: z.number().int().positive().optional(),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .optional(),
  recurrenceId: z.string().optional(),
  organizer: z.string().optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ── ReminderNode (cap-store.reminder) ──────────────────────────────────────

export interface ReminderData {
  title: string
  note?: string
  dueAt?: number
  triggeredAt?: number
  completedAt?: number
  snoozedUntil?: number
  priority: 'none' | 'low' | 'medium' | 'high'
  sourceNodeId?: string
  sourceType?: string
  createdAt: number
}

export const ReminderDataSchema = z.object({
  title: z.string(),
  note: z.string().optional(),
  dueAt: z.number().optional(),
  triggeredAt: z.number().optional(),
  completedAt: z.number().optional(),
  snoozedUntil: z.number().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high']),
  sourceNodeId: z.string().optional(),
  sourceType: z.string().optional(),
  createdAt: z.number(),
})

// ── LocationNode (cap-store.location) ──────────────────────────────────────

export interface LocationData {
  name?: string
  address?: string
  latitude?: number
  longitude?: number
  placeId?: string
  mapUrl?: string
  phone?: string
  website?: string
  categories?: string[]
  notes?: string
  tags?: string[]
  createdAt: number
}

export const LocationDataSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeId: z.string().optional(),
  mapUrl: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  categories: z.array(z.string()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.number(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const eventNodeSchema = {
  type: 'cap-store.event' as const,
  version: 1,
  schema: EventDataSchema,
  indexContent: (data: EventData) =>
    `${data.title} ${data.description ?? ''} ${data.location ?? ''} ${data.attendees?.map((a) => a.name ?? '').join(' ') ?? ''}`,
  embeddingText: (data: EventData) => `${data.title} ${data.description ?? ''}`,
}

export const reminderNodeSchema = {
  type: 'cap-store.reminder' as const,
  version: 1,
  schema: ReminderDataSchema,
  indexContent: (data: ReminderData) => `${data.title} ${data.note ?? ''}`,
  embeddingText: (data: ReminderData) => data.title,
}

export const locationNodeSchema = {
  type: 'cap-store.location' as const,
  version: 1,
  schema: LocationDataSchema,
  indexContent: (data: LocationData) =>
    `${data.name ?? ''} ${data.address ?? ''} ${data.categories?.join(' ') ?? ''}`,
  embeddingText: (data: LocationData) => data.name ?? data.address ?? '',
}
```

## src/schema/harness.ts

```ts
// src/schema/harness.ts
// Harness runtime types — used by HarnessRuntime and WorkflowEngine.

export interface HarnessNode {
  id: string
  moduleName: string
  input: Record<string, unknown>
  dependsOn: string[]
  retryPolicy: { maxRetries: number; backoffMs: number }
  timeoutMs: number
}

export interface HarnessDAG {
  id: string
  name: string
  nodes: HarnessNode[]
  edges: { from: string; to: string }[]
  timeoutMs: number
}

export interface HarnessModule {
  id: string
  name: string
  execute(
    input: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: unknown; error?: string }>
}

export interface HarnessTelemetry {
  dagId: string
  nodeId: string
  eventType: string
  durationMs: number
  ok: boolean
  error?: string
}

export interface HarnessCheckpoint {
  id: string
  dagId: string
  executedNodes: string[]
  stateJson: string
  pageState?: { url: string; title: string }
}
```

## src/schema/health.ts

```ts
// src/schema/health.ts
// Health monitoring domain types — used by ProviderHealthKernel.

export interface ProviderHealthReport {
  id: string
  providerId: string
  overallStatus: string
  overallScore: number
  signalsJson: string
  ts: number
}

export interface HealthSignal {
  id: string
  reportId: string
  name: string
  score: number
  weight: number
  detailJson: string
}

export interface HealthHistory {
  id: string
  providerId: string
  overallStatus: string
  overallScore: number
  signalsJson: string
  ts: number
}
```

## src/schema/index.ts

```ts
// src/schema/index.ts
// Barrel re-exports — all domain types + row types + streaming types.

export * from './automation.js'
export * from './chrome.js'
export * from './config.js'
export * from './core.js'
export * from './harness.js'
export * from './health.js'
export * from './learning.js'
export * from './provider.js'
export * from './routing.js'
export * from './session.js'
export * from './streaming.js'
export * from './rich-text.js'
export * from './content.js'
export * from './telemetry.js'
export * from './transfer.js'
export * from './types.js'
export * from './versioning.js'
```

## src/schema/learning.ts

```ts
// src/schema/learning.ts
// SOTA learning domain types — used by MemoryEngine and Session learning.

export interface LearningEvent {
  id: string
  providerId: string
  capabilityId: string
  eventType: string
  contextJson: string
  outcome: string
  ts: number
}

export interface Rule {
  id: string
  name: string
  condition: string
  action: string
  confidence: number
  source: string
  isActive: boolean
}

export interface BindingEvent {
  id: string
  bindingId: string
  eventType: string
  fromStatus: string | null
  toStatus: string
  reason: string | null
  ts: number
}
```

## src/schema/media.ts

```ts
// src/schema/media.ts
// Media node types — images, audio, video.

import { z } from 'zod'

// ── MediaNode (cap-store.media) ────────────────────────────────────────────
// Supports image, audio, video, and generic file media.

export type MediaKind = 'image' | 'audio' | 'video' | 'file' | '3d'

export interface MediaData {
  kind: MediaKind
  title?: string
  description?: string
  mediaType: string
  url: string
  thumbnailUrl?: string
  filename?: string
  size?: number
  width?: number
  height?: number
  duration?: number
  bitrate?: number
  codec?: string
  artist?: string
  album?: string
  exif?: Record<string, unknown>
  transcription?: string
  tags?: string[]
  sourceUrl?: string
  createdAt: number
}

export const MediaDataSchema = z.object({
  kind: z.enum(['image', 'audio', 'video', 'file', '3d']),
  title: z.string().optional(),
  description: z.string().optional(),
  mediaType: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  filename: z.string().optional(),
  size: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().optional(),
  bitrate: z.number().int().positive().optional(),
  codec: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  exif: z.record(z.unknown()).optional(),
  transcription: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().optional(),
  createdAt: z.number(),
})

// ── Node schema for registration ─────────────────────────────────────────

export const mediaNodeSchema = {
  type: 'cap-store.media' as const,
  version: 1,
  schema: MediaDataSchema,
  indexContent: (data: MediaData) =>
    `${data.title ?? ''} ${data.description ?? ''} ${data.transcription ?? ''} ${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: MediaData) => `${data.title ?? ''} ${data.description ?? ''}`,
}
```

## src/schema/message.ts

```ts
// src/schema/message.ts
// MessageEnvelope + ConversationNode data types.
// Data payload schemas for 'cap-store.message' and 'cap-store.conversation' nodes.

import { z } from 'zod'
import { type ContentPart, ContentPartSchema } from './streaming.js'

// ── MessageEnvelope (data payload for cap-store.message nodes) ────────────
// Requirements: immutable id (NodeBase.id), parentId for forking,
// rawSource for remux, parseVersion for telemetry.

export interface MessageData {
  role: 'system' | 'user' | 'assistant' | 'tool'
  parts: ContentPart[]
  rawSource?: string
  parseVersion: number
  model?: string
  finishReason?: string
  metadata?: Record<string, unknown>
}

export const MessageDataSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  parts: z.array(ContentPartSchema),
  rawSource: z.string().optional(),
  parseVersion: z.number().int().positive().default(1),
  model: z.string().optional(),
  finishReason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// ── ConversationData (data payload for cap-store.conversation nodes) ──────

export interface ConversationData {
  title?: string
  provider?: string
  model?: string
  messageIds: string[]
  importedFrom?: 'chatgpt' | 'claude' | 'gemini' | 'manual' | 'live'
  importBatchId?: string
  metadata?: Record<string, unknown>
}

export const ConversationDataSchema = z.object({
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  messageIds: z.array(z.string()),
  importedFrom: z.enum(['chatgpt', 'claude', 'gemini', 'manual', 'live']).optional(),
  importBatchId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const messageNodeSchema = {
  type: 'cap-store.message' as const,
  version: 1,
  schema: MessageDataSchema,
  indexContent: (data: MessageData) => extractTextFromParts(data.parts),
  embeddingText: (data: MessageData) => extractTextFromParts(data.parts),
}

export const conversationNodeSchema = {
  type: 'cap-store.conversation' as const,
  version: 1,
  schema: ConversationDataSchema,
  indexContent: (data: ConversationData) => data.title ?? data.messageIds.join(', '),
  embeddingText: (data: ConversationData) => data.title ?? '',
}

function extractTextFromParts(parts: ContentPart[]): string {
  const pieces: string[] = []
  for (const p of parts) {
    if (p.type === 'text' && typeof p.text === 'string') pieces.push(p.text)
    if (p.type === 'reasoning' && typeof p.text === 'string') pieces.push(p.text)
    if (p.type === 'code') pieces.push(p.text)
  }
  return pieces.join('\n')
}
```

## src/schema/node-data.ts

```ts
// src/schema/node-data.ts
// Additional typed Node.data payloads adopted from vivim-app-og reference
// structs (AtomicChatUnit, Memory, Notebook, Note, Bookmark, Artifact).
// Each carries the OG field set so the universal Node layer is feature-parity
// with the proven reDB design.

import { z } from 'zod'

// ── Memory (mirrors OG Memory + FSRS-6 spaced repetition) ──────────────────

export type FsrsState = 'New' | 'Learning' | 'Review' | 'Relearning'

export interface MemoryData {
  content: string
  summary?: string
  memoryType: string
  category: string
  subcategory?: string
  tags: string[]
  importance: number
  relevance: number
  sourceConversationIds: string[]
  sourceMessageIds: string[]
  occurredAt?: number
  validFrom?: number
  validUntil?: number
  isPinned: boolean
  isArchived: boolean
  consolidationStatus: string
  accessCount: number
  // FSRS-6 fields (OG stability/difficulty/dueDate/fsrsState)
  stability: number
  difficulty: number
  dueDate: number
  lastReview?: number
  reviewCount: number
  fsrsState: FsrsState
}

export const MemoryDataSchema = z.object({
  content: z.string().min(1),
  summary: z.string().optional(),
  memoryType: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).default([]),
  importance: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  sourceConversationIds: z.array(z.string()).default([]),
  sourceMessageIds: z.array(z.string()).default([]),
  occurredAt: z.number().optional(),
  validFrom: z.number().optional(),
  validUntil: z.number().optional(),
  isPinned: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  consolidationStatus: z.string().default('unconsolidated'),
  accessCount: z.number().int().nonnegative().default(0),
  stability: z.number().nonnegative().default(1.0),
  difficulty: z.number().min(0).max(1).default(0.3),
  dueDate: z.number().default(() => Date.now()),
  lastReview: z.number().optional(),
  reviewCount: z.number().int().nonnegative().default(0),
  fsrsState: z.enum(['New', 'Learning', 'Review', 'Relearning']).default('New'),
})

// ── Atomic Chat Unit (mirrors OG AtomicChatUnit) ──────────────────────────

export interface AcuData {
  authorDid: string
  content: string
  contentHash?: string
  version: number
  language?: string
  acuType: string
  category: string
  origin: string
  conversationId?: string
  messageId?: string
  messageIndex?: number
  provider?: string
  model?: string
  sourceTimestamp?: number
  parentId?: string
  extractorVersion?: string
  parserVersion?: string
  state: string
  securityLevel: number
  isPersonal: boolean
  level: number
  contentType: string
  qualityOverall?: number
  contentRichness?: number
  structuralIntegrity?: number
  uniqueness?: number
  sharingPolicy: string
  sharingCircles: string[]
  canView: boolean
  canAnnotate: boolean
  canRemix: boolean
  canReshare: boolean
  expiresAt?: number
  tags: string[]
}

export const AcuDataSchema = z.object({
  authorDid: z.string(),
  content: z.string(),
  contentHash: z.string().optional(),
  version: z.number().int().positive(),
  language: z.string().optional(),
  acuType: z.string(),
  category: z.string(),
  origin: z.string(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  messageIndex: z.number().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  sourceTimestamp: z.number().optional(),
  parentId: z.string().optional(),
  extractorVersion: z.string().optional(),
  parserVersion: z.string().optional(),
  state: z.string(),
  securityLevel: z.number().int(),
  isPersonal: z.boolean(),
  level: z.number().int(),
  contentType: z.string(),
  qualityOverall: z.number().optional(),
  contentRichness: z.number().optional(),
  structuralIntegrity: z.number().optional(),
  uniqueness: z.number().optional(),
  sharingPolicy: z.string(),
  sharingCircles: z.array(z.string()),
  canView: z.boolean(),
  canAnnotate: z.boolean(),
  canRemix: z.boolean(),
  canReshare: z.boolean(),
  expiresAt: z.number().optional(),
  tags: z.array(z.string()),
})

// ── Notebook / Note (mirrors OG Notebook / Note) ──────────────────────────

export interface NotebookData {
  ownerId: string
  name: string
  description?: string
  icon?: string
  entryIds: string[]
  createdAt: number
  updatedAt: number
}

export const NotebookDataSchema = z.object({
  ownerId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  entryIds: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export interface NoteData {
  notebookId?: string
  title: string
  body: string
  attachments: string[]
  tags: string[]
  createdAt: number
  updatedAt: number
}

export const NoteDataSchema = z.object({
  notebookId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  attachments: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ── Bookmark (mirrors OG Bookmark) ────────────────────────────────────────

export interface BookmarkData {
  url: string
  title: string
  description?: string
  tags: string[]
  favicon?: string
  createdAt: number
}

export const BookmarkDataSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  favicon: z.string().optional(),
  createdAt: z.number(),
})

// ── Artifact (mirrors OG ArtifactRecord) ──────────────────────────────────

export interface ArtifactData {
  artifactType: string
  title: string
  contentRef: string
  mimeType?: string
  sourceConversationId?: string
  sourceMessageId?: string
  extractedAt: number
}

export const ArtifactDataSchema = z.object({
  artifactType: z.string(),
  title: z.string(),
  contentRef: z.string(),
  mimeType: z.string().optional(),
  sourceConversationId: z.string().optional(),
  sourceMessageId: z.string().optional(),
  extractedAt: z.number(),
})

// ── Document / Email data shapes (re-declared here for parity imports) ─────
// These reuse the canonical schemas exported from their modules; we re-export
// lightweight data interfaces so node-data is the single import site.

export interface DocumentNodeData {
  title: string
  body: string
  mimeType: string
  sourceUrl?: string
  tags: string[]
}

export const DocumentNodeDataSchema = z.object({
  title: z.string(),
  body: z.string(),
  mimeType: z.string(),
  sourceUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

export interface EmailNodeData {
  from: string
  to: string[]
  subject: string
  body: string
  threadId?: string
  receivedAt: number
  labels: string[]
}

export const EmailNodeDataSchema = z.object({
  from: z.string(),
  to: z.array(z.string()),
  subject: z.string(),
  body: z.string(),
  threadId: z.string().optional(),
  receivedAt: z.number(),
  labels: z.array(z.string()).default([]),
})
```

## src/schema/node.ts

```ts
// src/schema/node.ts
// Universal Node abstraction — every piece of data in the second brain
// is a Node. NodeSchemaRegistry provides typed schemas + validation per type.

import { z } from 'zod'
import { hashContent, newId } from '../ids.js'

// ── Edge ─────────────────────────────────────────────────────────────────
// Directed relationship between two nodes. weight mirrors OG AcuLink.weight.

export interface Edge {
  type: string
  targetId: string
  label?: string
  weight?: number
  properties?: Record<string, unknown>
}

export const EdgeSchema = z.object({
  type: z.string().min(1),
  targetId: z.string().min(1),
  label: z.string().optional(),
  weight: z.number().optional(),
  properties: z.record(z.unknown()).optional(),
})

// ── Node ACL (access control) ─────────────────────────────────────────────
// Mirrors OG AtomicChatUnit sharing* fields.

export interface NodeAcl {
  sharingPolicy?: string
  sharingCircles?: string[]
  canView?: boolean
  canAnnotate?: boolean
  canRemix?: boolean
  canReshare?: boolean
}

// ── Node quality (curation scoring) ───────────────────────────────────────
// Mirrors OG AtomicChatUnit quality* fields.

export interface NodeQuality {
  overall?: number
  structuralIntegrity?: number
  uniqueness?: number
}

// ── Node lifecycle states ─────────────────────────────────────────────────

export type NodeState = 'draft' | 'active' | 'superseded' | 'archived'

// ── Node (universal container) ────────────────────────────────────────────
// Immutable id (ULID). parentId enables forking. source preserves the raw
// import payload for remux/re-parse. data is typed per schema.

export type NodeType =
  | 'cap-store.message'
  | 'cap-store.conversation'
  | 'cap-store.email'
  | 'cap-store.email-thread'
  | 'cap-store.document'
  | 'cap-store.code'
  | 'cap-store.knowledge'
  | 'cap-store.webpage'
  | 'cap-store.contact'
  | 'cap-store.organization'
  | 'cap-store.task'
  | 'cap-store.project'
  | 'cap-store.event'
  | 'cap-store.reminder'
  | 'cap-store.media'
  | 'cap-store.social-post'
  | 'cap-store.import-batch'
  | 'cap-store.financial'
  | 'cap-store.location'
  | 'cap-store.health'
  | 'cap-store.workflow'
  | 'cap-store.reference'
  | 'cap-store.memory'
  | 'cap-store.notebook'
  | 'cap-store.note'
  | 'cap-store.bookmark'
  | 'cap-store.artifact'
  | 'cap-store.acu'
  | 'cap-store.agent'
  | 'cap-store.role'
  | 'cap-store.governance_policy'
  | 'cap-store.agent_run'
  | 'cap-store.agent_step'
  | 'cap-store.tool'
  | 'cap-store.objective'
  | 'cap-store.agent_belief'
  | 'cap-store.memory-agent'
  | 'cap-store.builder_run'

export interface NodeBase {
  id: string
  type: NodeType
  parentId?: string
  createdAt: number
  updatedAt: number
  schemaVersion: number
  // ── ACU-proven fields (adopted from vivim-app-og AtomicChatUnit) ──
  // Content integrity / dedup hash (OG contentHash). Computed from
  // rawSource ?? JSON(data). Used for deduplication and tamper-evidence.
  contentHash?: string
  // Monotonic edit version, starts at 1, incremented by updateNode.
  version: number
  // Lifecycle state (OG state).
  state: NodeState
  // Sensitivity tier (OG securityLevel).
  securityLevel?: number
  // Fine-grained content classification (OG contentType).
  contentType?: string
  // Provenance (OG authorDid / signature).
  authorDid?: string
  signature?: string
  // Access control list (OG sharing*).
  acl?: NodeAcl
  // Curation quality scoring (OG quality*).
  quality?: NodeQuality
  // Temporal validity window (OG validFrom / validUntil / superseded_at).
  validFrom?: number
  validUntil?: number
  // Predecessor version in the version chain (OG LCG parent).
  parentVersion?: number
  source?: string
  data: unknown
  edges?: Edge[]
  meta?: Record<string, unknown>
  // Denormalized search index text (NodeRow.searchText). Engines set this so
  // recall works without re-parsing dataJson. Defaults to '' in the store.
  searchText?: string
  // Conversation scoping (NodeRow.conversationId). Memory subsystem isolates
  // per-agent via conversationId = 'agentMem:<agentId>' (decision D11 / FR-013).
  conversationId?: string
}

export function createNode<T extends NodeType>(
  type: T,
  data: unknown,
  opts?: {
    id?: string
    parentId?: string
    source?: string
    edges?: Edge[]
    meta?: Record<string, unknown>
    authorDid?: string
    securityLevel?: number
    contentType?: string
    acl?: NodeAcl
    quality?: NodeQuality
    validFrom?: number
    validUntil?: number
    parentVersion?: number
    state?: NodeState
    version?: number
    searchText?: string
    conversationId?: string
  },
): NodeBase {
  const now = Date.now()
  return {
    id: opts?.id ?? newId(),
    type,
    parentId: opts?.parentId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    contentHash: opts?.source ? hashContent(opts.source) : hashContent(JSON.stringify(data)),
    version: opts?.version ?? 1,
    state: opts?.state ?? 'active',
    securityLevel: opts?.securityLevel,
    contentType: opts?.contentType ?? type.replace('cap-store.', ''),
    authorDid: opts?.authorDid,
    acl: opts?.acl,
    quality: opts?.quality,
    validFrom: opts?.validFrom,
    validUntil: opts?.validUntil,
    parentVersion: opts?.parentVersion,
    source: opts?.source,
    searchText: opts?.searchText,
    conversationId: opts?.conversationId,
    data,
    edges: opts?.edges,
    meta: opts?.meta,
  }
}

// ── NodeSchema — typed schema definition per node type ─────────────────────
// Registered schema controls validation, search indexing, embedding, and
// import adapters for each node type.

export interface NodeSchema<T extends NodeType, D> {
  type: T
  version: number
  schema: z.ZodType<D>
  edges?: Record<string, z.ZodType<unknown>>
  indexContent?: (data: D) => string
  embeddingText?: (data: D) => string
  importAdapters?: Array<{ name: string; parse: (raw: string) => D }>
}

// ── SchemaRegistry ────────────────────────────────────────────────────────
// Typed in-memory registry. Register every node schema at boot.

export class SchemaRegistry {
  private schemas = new Map<NodeType, NodeSchema<NodeType, unknown>>()

  register<T extends NodeType, D>(def: NodeSchema<T, D>): void {
    this.schemas.set(def.type, def as NodeSchema<NodeType, unknown>)
  }

  get(type: NodeType): NodeSchema<NodeType, unknown> | undefined {
    return this.schemas.get(type)
  }

  has(type: string): boolean {
    return this.schemas.has(type as NodeType)
  }

  all(): NodeSchema<NodeType, unknown>[] {
    return Array.from(this.schemas.values())
  }

  validate(type: NodeType, data: unknown): { ok: boolean; error?: string } {
    const def = this.schemas.get(type)
    if (!def) return { ok: false, error: `No schema registered for '${type}'` }
    const result = def.schema.safeParse(data)
    if (result.success) return { ok: true }
    return {
      ok: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    }
  }

  indexContent(node: NodeBase): string {
    const def = this.schemas.get(node.type as NodeType)
    if (def?.indexContent) return def.indexContent(node.data)
    return String(node.data)
  }

  embeddingText(node: NodeBase): string {
    const def = this.schemas.get(node.type as NodeType)
    if (def?.embeddingText) return def.embeddingText(node.data)
    return String(node.data)
  }
}

// Singleton — populated at boot by registerAllSchemas() in schemas.ts.
export const schemaRegistry = new SchemaRegistry()
```

## src/schema/provider-manifest.ts

```ts
// src/schema/provider-manifest.ts
// Zod schema for provider manifests (in-repo canonical module seeds/providers/manifests.ts).
// Validates manifest objects before registration.

import { z } from 'zod'

const EndpointSchema = z.object({
  label: z.string(),
  url: z.string().url(),
  endpoint_type: z.enum(['landing', 'chat', 'login', 'api', 'auth']),
  is_default: z.boolean().optional().default(false),
  selector: z.record(z.string()).optional(),
  composer_type: z
    .enum(['textarea', 'contenteditable', 'prosemirror', 'quill'])
    .optional()
    .default('textarea'),
  send_method: z.enum(['enter_key', 'button_click', 'both']).optional().default('both'),
  content_editable: z.boolean().optional().default(false),
})

const ParserSchema = z.object({
  name: z.string(),
  file: z.string().optional(), // Optional for inline parsers
  version: z.number().int().positive(),
  is_active: z.boolean().optional().default(true),
  fallback: z.string().optional(),
  logic_type: z.enum(['file', 'inline', 'composed']).optional().default('inline'),
  logic_code: z.string().optional(), // Inline TypeScript/JavaScript for DB-driven loading
  sample_body: z.string().optional(), // Representative wire-format sample for testing
})

const ModelSchema = z.object({
  slug: z.string(),
  display_name: z.string(),
  is_default: z.boolean().optional().default(false),
  context_window: z.number().int().positive().optional(),
  max_output_tokens: z.number().int().positive().optional(),
  supports_streaming: z.boolean().optional().default(false),
  supports_vision: z.boolean().optional().default(false),
  supports_thinking: z.boolean().optional().default(false),
  supports_tools: z.boolean().optional().default(false),
  pricing_input_per_1m: z.number().nonnegative().optional(),
  pricing_output_per_1m: z.number().nonnegative().optional(),
})

const CapabilityConfigSchema = z.object({
  global_capability_id: z.string(),
  recovery_strategies: z
    .array(
      z.object({
        type: z.enum([
          'retry_selector',
          'retry_with_fallback',
          'navigate_home',
          'restart_chrome',
          'mark_broken',
        ]),
        config: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
  ui_component_override: z.string().optional(),
  ui_label_override: z.string().optional(),
  ui_icon_override: z.string().optional(),
  ui_position_override: z.string().optional(),
  ui_order_override: z.number().int().optional(),
  ui_group_override: z.string().optional(),
  ui_priority_override: z.string().optional(),
  interaction_mode_override: z.string().optional(),
  ui_states_override: z.array(z.string()).optional(),
  ui_visibility_rule_override: z.string().optional(),
  existential_rule_override: z.string().optional(),
  ui_input_schema_override: z.record(z.unknown()).optional(),
  mutation_effects_override: z.record(z.unknown()).optional(),
  recovery_behavior_override: z.string().optional(),
  state_persistence_override: z.string().optional(),
  data_flow_override: z.string().optional(),
  min_plan_tier_override: z.string().optional(),
  depends_on_override: z.array(z.string()).optional(),
})

const ConfigEntrySchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z.string().optional().default('string'),
  is_secret: z.boolean().optional().default(false),
})

// ── Provider stream config (unit 2.16) ──────────────────────────────────────
// Validates ProviderStreamConfig rows: the wire transport, the SSE archetype,
// and the delta path(s) used to extract streamed content.

export const StreamTransportSchema = z.enum([
  'sse',
  'batchexecute',
  'websocket',
  'sse-patch',
  'json',
])
export const SseFormatSchema = z.enum(['openai', 'anthropic', 'gemini', 'generic'])

export const StreamConfigSchema = z.object({
  streamTransport: StreamTransportSchema,
  streamTerminalJson: z.string().default('[]'),
  sseFormat: SseFormatSchema.nullable().optional(),
  deltaPathJson: z
    .string()
    .refine(
      (v) => {
        try {
          const parsed = JSON.parse(v)
          return Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')
        } catch {
          return false
        }
      },
      { message: 'deltaPathJson must be a JSON array of string paths' },
    )
    .nullable()
    .optional(),
  contentType: z.string().nullable().optional(),
  completionDetectorsJson: z.string().default('[]'),
  isActive: z.number().int().min(0).max(1).default(1),
  version: z.number().int().positive().default(1),
})

export type StreamConfig = z.infer<typeof StreamConfigSchema>

export interface StreamConfigValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/** Unit 2.16 — validate a ProviderStreamConfig record against the schema. */
export function validateStreamConfig(config: unknown): StreamConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const result = StreamConfigSchema.safeParse(config)
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    return { valid: false, errors, warnings }
  }
  if (!result.data.deltaPathJson) {
    warnings.push('No deltaPathJson set — parser must locate the response field itself.')
  }
  if (result.data.streamTransport === 'sse' && !result.data.sseFormat) {
    warnings.push('SSE transport without an sseFormat archetype — parser may mis-detect framing.')
  }
  return { valid: errors.length === 0, errors, warnings }
}

export const ProviderManifestSchema = z.object({
  $schema: z.string().optional(),
  provider: z.object({
    slug: z.string().min(1).max(64),
    display_name: z.string().min(1),
    description: z.string(),
    category: z.string().default('ai'),
    provider_type: z.string().default('llm'),
    website_url: z.string().url(),
    documentation_url: z.string().url().optional(),
    auth_type: z.string().default('browser'),
    has_multi_account: z.boolean().default(false),
    profile_strategy: z.string().default('per_account'),
    fleet_config: z
      .object({
        chrome_path: z.string().optional(),
        port_range: z.tuple([z.number(), z.number()]).optional(),
        extra_args: z.array(z.string()).optional(),
      })
      .optional(),
    capabilities: z.array(z.string()).default([]),
    accessTier: z.enum(['free', 'premium']).optional().default('free'),
  }),
  endpoints: z.array(EndpointSchema).default([]),
  parsers: z.array(ParserSchema).default([]),
  models: z.array(ModelSchema).default([]),
  capabilities_config: z.array(CapabilityConfigSchema).default([]),
  config: z.array(ConfigEntrySchema).default([]),
})

export type ProviderManifest = z.infer<typeof ProviderManifestSchema>
```

## src/schema/provider.ts

```ts
// src/schema/provider.ts
// Provider knowledge graph domain types — definitions, endpoints, accounts, parsers.

import type { PlanTier } from './core.js'

export interface ProviderDefinition {
  id: string
  slug: string
  displayName: string
  description: string | null
  category: string
  providerType: string
  isActive: boolean
  authType: string
  hasMultiAccount: boolean
  profileStrategy: string
  fleetConfigJson: string
  capabilitiesJson: string
  modelsJson: string
  createdAt: number
  updatedAt: number
}

export type ProviderTransport = 'browser' | 'api' | 'hybrid'

export interface ProviderEndpoint {
  id: string
  providerId: string
  url: string
  label: string
  endpointType: 'landing' | 'chat' | 'login' | 'api' | 'auth'
  isDefault: boolean
  selectorJson: string
}

export interface ProviderAccount {
  id: string
  providerId: string
  email: string
  planTier: PlanTier
  isDefault: boolean
  loginState: string
  isKind?: boolean
  loginAttempts?: number
  lastLoginAt?: number | null
  providerStateJson?: string
  debugPort?: number | null
  profileDir?: string | null
  chromeSlaveId?: string | null
}

export interface ProviderParser {
  id: string
  providerId: string
  parserName: string
  parserType: string
  isActive: boolean
  fallbackParserId: string | null
  parserHash?: string | null
  parserFilePath?: string | null
}
```

## src/schema/repair-metadata.ts

```ts
// src/schema/repair-metadata.ts
// Repair metadata carried in a SIDE-TABLE keyed by Zod type — NOT on the Zod
// prototype. Fixes the pasted design's `z.ZodType.prototype.repair` monkey-patch
// (which is unsafe: global mutation, breaks under multiple schema instances, and
// the `declare module 'zod'` only adds a type, not a runtime method).

import { z } from 'zod'

export interface RepairMetadata {
  aliases?: string[]
  coerceFrom?: z.ZodType[]
  defaultValue?: unknown
  semanticValidator?: (val: unknown) => boolean
  description?: string
}

// Module-level side-table. Immutable registration; no prototype pollution.
const REPAIR_METADATA = new Map<z.ZodType, RepairMetadata>()

export function registerRepair(schema: z.ZodType, meta: RepairMetadata): z.ZodType {
  REPAIR_METADATA.set(schema, meta)
  return schema
}

export function getRepairMetadata(schema: z.ZodType): RepairMetadata | undefined {
  return REPAIR_METADATA.get(schema)
}

// ── Repair-aware field builders ────────────────────────────────────────────
// Each returns the Zod type and registers its metadata in the side-table.

export function repairString(
  opts: {
    aliases?: string[]
    default?: string
    coerce?: boolean
  } = {},
): z.ZodString {
  const schema = z.string().min(1)
  registerRepair(schema, {
    aliases: opts.aliases,
    coerceFrom: opts.coerce ? [z.number(), z.boolean()] : [],
    defaultValue: opts.default,
  })
  return schema
}

export function repairNumber(
  opts: {
    aliases?: string[]
    default?: number
    min?: number
    max?: number
  } = {},
): z.ZodNumber {
  const schema = z.coerce
    .number()
    .min(opts.min ?? Number.NEGATIVE_INFINITY)
    .max(opts.max ?? Number.POSITIVE_INFINITY)
  registerRepair(schema, {
    aliases: opts.aliases,
    coerceFrom: [z.string()],
    defaultValue: opts.default,
  })
  return schema
}

export function repairBoolean(
  opts: {
    aliases?: string[]
    default?: boolean
  } = {},
): z.ZodDefault<z.ZodBoolean> {
  const schema = z.coerce.boolean().default(opts.default ?? true)
  registerRepair(schema, {
    aliases: opts.aliases,
    coerceFrom: [z.string(), z.number()],
    defaultValue: opts.default,
  })
  return schema
}
```

## src/schema/response-schemas.ts

```ts
// src/schema/response-schemas.ts
// Zod schemas for validating API responses (Work Item 05).
// These are parse-time guards that ensure the shape we serialize actually
// matches the contract. Used inside routers before calling json().

import { z } from 'zod'

// ── Capability schemas ────────────────────────────────────────────────────────

export const CapabilityDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  surfaces: z.array(z.string()),
  inputSchema: z.unknown(),
  outputSchema: z.unknown(),
  cliCommand: z.unknown(),
  ui: z.unknown(),
  uiAction: z.unknown(),
  apiEndpoint: z.unknown(),
  workflowNodeType: z.unknown(),
  mcpToolName: z.unknown(),
  requiresConfirmation: z.boolean(),
  tags: z.array(z.string()),
})

export const CapabilityListResponseSchema = z.object({
  capabilities: z.array(CapabilityDetailSchema),
  total: z.number(),
})

export const CapabilityExecuteSuccessSchema = z.object({
  ok: z.literal(true),
  capabilityId: z.string(),
  output: z.unknown(),
  traceId: z.string(),
  latencyMs: z.number(),
})

// ── Conversation schemas ────────────────────────────────────────────────────

export const ConversationDetailSchema = z.object({
  id: z.string(),
  providerSessionId: z.string(),
  providerId: z.string(),
  title: z.string().nullable(),
  state: z.string(),
  messageCount: z.number(),
  lastMessageAt: z.number().nullable(),
  contextJson: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const ConversationMessageDetailSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.string(),
  content: z.string().nullable(),
  blocksJson: z.string(),
  blockCount: z.number(),
  parentMessageId: z.string().nullable(),
  sequenceIndex: z.number(),
  latencyMs: z.number().nullable(),
  tokenCount: z.number().nullable(),
  model: z.string().nullable(),
  metadataJson: z.string(),
  createdAt: z.number(),
})

// ── Send message schemas ────────────────────────────────────────────────────

export const SendMessageSuccessSchema = z.object({
  ok: z.literal(true),
  messageId: z.string(),
  blocks: z.array(z.unknown()),
  text: z.string(),
  latencyMs: z.number(),
  traceId: z.string(),
})

export const SendMessageErrorSchema = z.object({
  ok: z.literal(false),
  messageId: z.string(),
  blocks: z.array(z.unknown()),
  text: z.string(),
  latencyMs: z.number(),
  error: z.string(),
  traceId: z.string(),
})

export const SendMessageResponseSchema = z.union([SendMessageSuccessSchema, SendMessageErrorSchema])

// ── Provider schemas ─────────────────────────────────────────────────────────

export const ProviderDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  providerType: z.string(),
  isActive: z.number(),
  protocolStatus: z.string(),
  websiteUrl: z.string().nullable(),
  documentationUrl: z.string().nullable(),
  authType: z.string(),
  hasMultiAccount: z.number(),
  profileStrategy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const ProviderListResponseSchema = z.object({
  providers: z.array(ProviderDetailSchema),
  total: z.number(),
})

// ── Health schemas ───────────────────────────────────────────────────────────

export const HealthDashboardResponseSchema = z.object({
  providers: z.array(
    z.object({
      providerId: z.string(),
      overallStatus: z.string(),
      overallScore: z.number(),
      signalsJson: z.string(),
      parserConfidenceAvg: z.number().nullable(),
      selectorHitRateAvg: z.number().nullable(),
      fleetRunning: z.number(),
      fleetStopped: z.number(),
      fleetError: z.number(),
      circuitOpen: z.number(),
      driftRecent: z.number(),
      driftUnresolved: z.number(),
      lastCheckAt: z.number().nullable(),
    }),
  ),
  timestamp: z.number(),
})

// ── Interpret response schemas ──────────────────────────────────────────────

export const InterpretSuccessSchema = z.object({
  ok: z.boolean(),
  capabilityId: z.string(),
  output: z.unknown(),
  text: z.string().optional(),
  traceId: z.string(),
  latencyMs: z.number(),
})

export const InterpretConfirmationSchema = z.object({
  ok: z.literal(true),
  requiresConfirmation: z.literal(true),
  confirmation: z.object({
    token: z.string(),
    prompt: z.string(),
  }),
  traceId: z.string(),
  latencyMs: z.number(),
})

export const InterpretClarificationSchema = z.object({
  ok: z.literal(false),
  clarification: z.object({
    prompt: z.string(),
    missing: z.array(z.string()).optional(),
    ambiguous: z.array(z.string()).optional(),
    options: z.array(z.string()).optional(),
  }),
  traceId: z.string(),
  latencyMs: z.number(),
})

export const InterpretErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  traceId: z.string(),
  latencyMs: z.number(),
})

// ── Error response schema ───────────────────────────────────────────────────

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
})

// ── Generic success schema ──────────────────────────────────────────────────

export const OkResponseSchema = z.object({
  ok: z.literal(true),
})
```

## src/schema/rich-text.ts

````ts
// src/schema/rich-text.ts
// GFM-rich-text AST model — Zod schemas + parse/serialize helpers.
// Canonical truth: GFM markdown string. AST is a derived/cached form.

import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { z } from 'zod'

// ── Mark model (ProseMirror-style composable marks) ──────────────────────────

export const MarkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({ type: z.literal('code') }),
  z.object({ type: z.literal('highlight') }),
  z.object({ type: z.literal('subscript') }),
  z.object({ type: z.literal('superscript') }),
  z.object({ type: z.literal('link'), url: z.string(), title: z.string().optional() }),
])
export type Mark = z.infer<typeof MarkSchema>

// ── Inline nodes (phrasing content) ─────────────────────────────────────────

export const TextNodeSchema: z.ZodType<TextNode> = z.object({
  type: z.literal('text'),
  value: z.string(),
  marks: z.array(MarkSchema).optional(),
})
export interface TextNode {
  type: 'text'
  value: string
  marks?: Mark[]
}

export type PhrasingContent =
  | TextNode
  | EmphNode
  | StrongNode
  | DeleteNode
  | InlineCodeNode
  | LinkNode
  | ImageNode
  | BreakNode
  | MathNode
  | WidgetNode
  | MentionNode

export interface EmphNode {
  type: 'emphasis'
  children: PhrasingContent[]
}
export interface StrongNode {
  type: 'strong'
  children: PhrasingContent[]
}
export interface DeleteNode {
  type: 'delete'
  children: PhrasingContent[]
}
export interface InlineCodeNode {
  type: 'inlineCode'
  value: string
}
export interface LinkNode {
  type: 'link'
  url: string
  title?: string
  children: PhrasingContent[]
}
export interface ImageNode {
  type: 'image'
  url: string
  alt?: string
  title?: string
}
export interface BreakNode {
  type: 'break'
}
export interface MathNode {
  type: 'math'
  value: string
}
export interface WidgetNode {
  type: 'widget'
  kind: string
  props: Record<string, unknown>
}
export interface MentionNode {
  type: 'mention'
  id: string
}

// ── Block nodes (flow content) ────────────────────────────────────────────

export type FlowContent =
  | ParagraphNode
  | HeadingNode
  | BlockquoteNode
  | ListNode
  | ListItemNode
  | CodeNode
  | TableNode
  | TableRowNode
  | TableCellNode
  | ThematicBreakNode
  | HtmlNode
  | MathBlockNode
  | MermaidNode

export interface ParagraphNode {
  type: 'paragraph'
  children: PhrasingContent[]
}
export interface HeadingNode {
  type: 'heading'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  children: PhrasingContent[]
}
export interface BlockquoteNode {
  type: 'blockquote'
  children: FlowContent[]
}
export interface ListNode {
  type: 'list'
  ordered?: boolean
  start?: number
  children: ListItemNode[]
}
export interface ListItemNode {
  type: 'listItem'
  checked?: boolean
  children: FlowContent[]
}
export interface CodeNode {
  type: 'code'
  lang?: string
  value: string
}
export interface TableNode {
  type: 'table'
  align?: Array<'left' | 'center' | 'right' | null>
  children: TableRowNode[]
}
export interface TableRowNode {
  type: 'tableRow'
  children: TableCellNode[]
}
export interface TableCellNode {
  type: 'tableCell'
  children: PhrasingContent[]
}
export interface ThematicBreakNode {
  type: 'thematicBreak'
}
export interface HtmlNode {
  type: 'html'
  value: string
}
export interface MathBlockNode {
  type: 'mathBlock'
  value: string
  display: true
}
export interface MermaidNode {
  type: 'mermaid'
  value: string
}

// ── RichText ─────────────────────────────────────────────────────────────

export type RichNode = FlowContent | PhrasingContent

export type RichText = string | { ast: RichNode[] }

// ── Zod schemas for the AST ────────────────────────────────────────────────
// Recursive discriminated unions produce overly-broad inferred types in Zod.
// Use z.any() for recursive children — the TS interfaces are the source of truth;
// these schemas are for runtime boundary validation only.

export const PhrasingContentSchema: z.ZodType<PhrasingContent> = z.lazy(() =>
  z.discriminatedUnion('type', [
    TextNodeSchema as any,
    z.object({ type: z.literal('emphasis'), children: z.array(z.any()) }),
    z.object({ type: z.literal('strong'), children: z.array(z.any()) }),
    z.object({ type: z.literal('delete'), children: z.array(z.any()) }),
    z.object({ type: z.literal('inlineCode'), value: z.string() }),
    z.object({
      type: z.literal('link'),
      url: z.string(),
      title: z.string().optional(),
      children: z.array(z.any()),
    }),
    z.object({
      type: z.literal('image'),
      url: z.string(),
      alt: z.string().optional(),
      title: z.string().optional(),
    }),
    z.object({ type: z.literal('break') }),
    z.object({ type: z.literal('math'), value: z.string() }),
    z.object({ type: z.literal('widget'), kind: z.string(), props: z.record(z.unknown()) }),
    z.object({ type: z.literal('mention'), id: z.string() }),
  ] as any),
)

const _TableRowSchema = z.object({
  type: z.literal('tableRow'),
  children: z.array(
    z.object({
      type: z.literal('tableCell'),
      children: z.array(z.any()),
    }),
  ),
})

const _ListItemSchema = z.object({
  type: z.literal('listItem'),
  checked: z.boolean().optional(),
  children: z.array(z.any()),
})

export const FlowContentSchema: z.ZodType<FlowContent> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('paragraph'), children: z.array(z.any()) }),
    z.object({
      type: z.literal('heading'),
      depth: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
      ]),
      children: z.array(z.any()),
    }),
    z.object({ type: z.literal('blockquote'), children: z.array(z.any()) }),
    z.object({
      type: z.literal('list'),
      ordered: z.boolean().optional(),
      start: z.number().optional(),
      children: z.array(z.any()),
    }),
    z.object({
      type: z.literal('listItem'),
      checked: z.boolean().optional(),
      children: z.array(z.any()),
    }),
    z.object({ type: z.literal('code'), lang: z.string().optional(), value: z.string() }),
    z.object({
      type: z.literal('table'),
      align: z
        .array(z.union([z.literal('left'), z.literal('center'), z.literal('right'), z.null()]))
        .optional(),
      children: z.array(z.any()),
    }),
    z.object({ type: z.literal('thematicBreak') }),
    z.object({ type: z.literal('html'), value: z.string() }),
    z.object({ type: z.literal('mathBlock'), value: z.string(), display: z.literal(true) }),
    z.object({ type: z.literal('mermaid'), value: z.string() }),
  ] as any),
)

export const RichNodeSchema: z.ZodType<RichNode> = z.union([
  FlowContentSchema,
  PhrasingContentSchema,
]) as z.ZodType<RichNode>

export const RichTextSchema: z.ZodType<RichText> = z.union([
  z.string(),
  z.object({ ast: z.array(z.any()) }),
]) as z.ZodType<RichText>

// ── Parse / Serialize ─────────────────────────────────────────────────────

export function parseRichText(md: string): RichNode[] {
  if (!md) return []
  const stripped = stripCodeFenceDelimiters(md)
  const tree = fromMarkdown(stripped, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })
  const nodes = normalizeTree(tree.children as MdastNode[])
  return nodes
}

export function serializeRichText(ast: RichNode[]): string {
  const parts: string[] = []
  for (const node of ast) {
    parts.push(serializeNode(node))
  }
  return parts.join('\n\n')
}

export function extractTextFromAst(ast: RichNode[]): string {
  const parts: string[] = []
  function walk(nodes: RichNode[]): void {
    for (const n of nodes) {
      if ('children' in n && n.children) {
        walk(n.children as RichNode[])
      }
      if ('value' in n && typeof (n as { value: unknown }).value === 'string') {
        parts.push((n as { value: string }).value)
      }
    }
  }
  walk(ast)
  return parts.join('')
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function extractMermaid(ast: RichNode[]): MermaidNode[] {
  return ast.filter((n): n is MermaidNode => n.type === 'mermaid')
}

export function extractMath(ast: RichNode[]): MathNode[] {
  const result: MathNode[] = []
  function walk(nodes: RichNode[]): void {
    for (const n of nodes) {
      if (n.type === 'math') result.push(n)
      if ('children' in n && n.children) walk(n.children as RichNode[])
    }
  }
  walk(ast)
  return result
}

// ── Private ────────────────────────────────────────────────────────────────

type MdastNode = {
  type: string
  children?: MdastNode[]
  value?: string
  url?: string
  alt?: string
  title?: string
  depth?: number
  ordered?: boolean
  start?: number
  checked?: boolean | null
  lang?: string
  align?: Array<'left' | 'center' | 'right' | null>
}

function stripCodeFenceDelimiters(md: string): string {
  return md
    .replace(/^```[\s\S]*?```$/gm, (match) => {
      const langMatch = match.match(/^```(\w*)\n?/)
      const lang = langMatch?.[1] ?? ''
      const content = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
      return `~~~${lang ? `${lang}\n` : '\n'}${content}\n~~~`
    })
    .replace(/^~~~(\w*)\n?([\s\S]*?)~~~/gm, (_, lang, content) => {
      return `\`\`\`${lang}\n${content.trim()}\n\`\`\``
    })
}

const FLOW_TYPES = new Set<string>([
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'listItem',
  'code',
  'table',
  'thematicBreak',
  'html',
  'mathBlock',
  'mermaid',
])
function isFlowNode(type: string): boolean {
  return FLOW_TYPES.has(type)
}

function normalizeTree(nodes: MdastNode[]): FlowContent[] {
  const result: FlowContent[] = []
  for (const mdast of nodes) {
    const node = convertMdastNode(mdast)
    if (node && isFlowNode(node.type)) result.push(node as FlowContent)
  }
  return result
}

function convertMdastNode(n: MdastNode): RichNode | null {
  switch (n.type) {
    case 'paragraph':
      return { type: 'paragraph', children: normalizePhrasing(n.children ?? []) }
    case 'heading':
      return {
        type: 'heading',
        depth: (n.depth ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: normalizePhrasing(n.children ?? []),
      }
    case 'blockquote':
      return { type: 'blockquote', children: normalizeTree(n.children ?? []) }
    case 'list':
      return {
        type: 'list',
        ordered: n.ordered,
        start: n.start,
        children: normalizeListItems(n.children ?? []),
      }
    case 'listItem':
      return {
        type: 'listItem',
        checked: n.checked ?? undefined,
        children: normalizeTree(n.children ?? []),
      }
    case 'code':
      if (n.lang === 'mermaid') return { type: 'mermaid', value: n.value ?? '' }
      return { type: 'code', lang: n.lang, value: n.value ?? '' }
    case 'table':
      return { type: 'table', align: n.align, children: normalizeTableBody(n.children ?? []) }
    case 'thematicBreak':
      return { type: 'thematicBreak' }
    case 'html':
      return { type: 'html', value: n.value ?? '' }
    case 'text':
      return { type: 'text', value: n.value ?? '' }
    case 'emphasis':
      return { type: 'emphasis', children: normalizePhrasing(n.children ?? []) }
    case 'strong':
      return { type: 'strong', children: normalizePhrasing(n.children ?? []) }
    case 'delete':
      return { type: 'delete', children: normalizePhrasing(n.children ?? []) }
    case 'inlineCode':
      return { type: 'inlineCode', value: n.value ?? '' }
    case 'link':
      return {
        type: 'link',
        url: n.url ?? '',
        title: n.title,
        children: normalizePhrasing(n.children ?? []),
      }
    case 'image':
      return { type: 'image', url: n.url ?? '', alt: n.alt, title: n.title }
    case 'break':
      return { type: 'break' }
    case 'math':
      return { type: 'math', value: n.value ?? '' }
    default:
      return null
  }
}

function normalizePhrasing(nodes: MdastNode[]): PhrasingContent[] {
  return nodes
    .map(convertMdastNode)
    .filter((n): n is PhrasingContent => n !== null && !('paragraph' in n))
}

function normalizeListItems(nodes: MdastNode[]): ListItemNode[] {
  return nodes.map((n) => ({
    type: 'listItem' as const,
    checked: n.checked ?? undefined,
    children: normalizeTree(n.children ?? []),
  }))
}

function normalizeTableBody(nodes: MdastNode[]): TableRowNode[] {
  return nodes.map((row) => ({
    type: 'tableRow' as const,
    children: (row.children ?? []).map((cell) => ({
      type: 'tableCell' as const,
      children: normalizePhrasing(cell.children ?? []),
    })),
  }))
}

function serializeNode(node: RichNode): string {
  switch (node.type) {
    case 'paragraph':
      return serializePhrasing(node.children)
    case 'heading':
      return `${'#'.repeat(node.depth)} ${serializePhrasing(node.children)}`
    case 'blockquote':
      return node.children.map((c) => `> ${serializeNode(c)}`).join('\n')
    case 'list': {
      const items = node.children.map((item, i) => {
        const prefix = node.ordered ? `${(node.start ?? 1) + i}. ` : '- '
        return item.children
          .map((c, j) => {
            const serialized = serializeNode(c)
            return j === 0 ? prefix + serialized : `  ${serialized}`
          })
          .join('\n')
      })
      return items.join('\n')
    }
    case 'listItem':
      return node.children.map(serializeNode).join('\n')
    case 'code':
      return `\`\`\`${node.lang ?? ''}\n${node.value}\n\`\`\``
    case 'table':
      return serializeTable(node)
    case 'thematicBreak':
      return '---'
    case 'html':
      return node.value
    case 'mathBlock':
      return `$$\n${node.value}\n$$`
    case 'mermaid':
      return `\`\`\`mermaid\n${node.value}\n\`\`\``
    default:
      return serializePhrasing([node as PhrasingContent])
  }
}

function serializePhrasing(nodes: PhrasingContent[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return n.value
        case 'emphasis':
          return `*${serializePhrasing(n.children)}*`
        case 'strong':
          return `**${serializePhrasing(n.children)}**`
        case 'delete':
          return `~~${serializePhrasing(n.children)}~~`
        case 'inlineCode':
          return `\`${n.value}\``
        case 'link':
          return `[${serializePhrasing(n.children)}](${n.url}${n.title ? ` "${n.title}"` : ''})`
        case 'image':
          return `![${n.alt ?? ''}](${n.url}${n.title ? ` "${n.title}"` : ''})`
        case 'break':
          return '\n'
        case 'math':
          return `$${n.value}$`
        case 'widget':
          return `<widget:${n.kind}>`
        case 'mention':
          return `@${n.id}`
        default:
          return ''
      }
    })
    .join('')
}

function serializeTable(table: TableNode): string {
  if (table.children.length === 0) return ''
  const rows = table.children.map((row) => {
    return `| ${row.children.map((cell) => serializePhrasing(cell.children)).join(' | ')} |`
  })
  const align = table.align ?? []
  const headerDivider = `| ${align
    .map((a) => {
      switch (a) {
        case 'left':
          return ':---'
        case 'center':
          return ':--:'
        case 'right':
          return '---:'
        default:
          return '---'
      }
    })
    .join(' | ')} |`
  rows.splice(1, 0, headerDivider)
  return rows.join('\n')
}
````

## src/schema/routing.ts

```ts
// src/schema/routing.ts
// Multi-provider routing types — used by Router subsystem.

export type RouteEventType = 'matched' | 'dispatched' | 'succeeded' | 'failed' | 'timeout'

export interface RouteSpec {
  id: string
  name: string
  criteria: string
  targetProviderIds: string[]
  strategy: string
  isActive: boolean
}

export interface RouteRequest {
  id: string
  specId: string
  capabilityId: string
  context: string
  matchedAt: number | null
}

export interface RouteTarget {
  id: string
  specId: string
  providerId: string
  priority: number
  weight: number
  isActive: boolean
}

export interface RouteEvent {
  id: string
  requestId: string
  targetId: string
  eventType: RouteEventType
  ts: number
}
```

## src/schema/schemas.ts

```ts
// src/schema/schemas.ts
// Schema registry initialization — call registerAllSchemas() at boot.

import { AGENTIC_NODE_TYPES, agenticDataSchemas } from './agentic.js'
import { contactNodeSchema, organizationNodeSchema } from './contact.js'
import {
  codeNodeSchema,
  documentNodeSchema,
  knowledgeNodeSchema,
  webpageNodeSchema,
} from './document.js'
import { emailNodeSchema, emailThreadNodeSchema } from './email.js'
import { eventNodeSchema, locationNodeSchema, reminderNodeSchema } from './event.js'
import { mediaNodeSchema } from './media.js'
import { conversationNodeSchema, messageNodeSchema } from './message.js'
import {
  AcuDataSchema,
  ArtifactDataSchema,
  BookmarkDataSchema,
  DocumentNodeDataSchema,
  EmailNodeDataSchema,
  MemoryDataSchema,
  NoteDataSchema,
  NotebookDataSchema,
} from './node-data.js'
import { schemaRegistry } from './node.js'
import { socialPostNodeSchema } from './social.js'
import { projectNodeSchema, taskNodeSchema } from './task.js'

// Zod discriminated unions produce overly-broad inferred types (e.g. optional `data`
// on CustomPart). Cast to `any` at registration — the schemas are correct at runtime;
// the mismatch is a Zod inference limitation, not a real type error.

export function registerAllSchemas(): void {
  schemaRegistry.register(messageNodeSchema as any)
  schemaRegistry.register(conversationNodeSchema as any)
  schemaRegistry.register(emailNodeSchema as any)
  schemaRegistry.register(emailThreadNodeSchema as any)
  schemaRegistry.register(documentNodeSchema as any)
  schemaRegistry.register(codeNodeSchema as any)
  schemaRegistry.register(knowledgeNodeSchema as any)
  schemaRegistry.register(webpageNodeSchema as any)
  schemaRegistry.register(contactNodeSchema as any)
  schemaRegistry.register(organizationNodeSchema as any)
  schemaRegistry.register(taskNodeSchema as any)
  schemaRegistry.register(projectNodeSchema as any)
  schemaRegistry.register(eventNodeSchema as any)
  schemaRegistry.register(reminderNodeSchema as any)
  schemaRegistry.register(locationNodeSchema as any)
  schemaRegistry.register(mediaNodeSchema as any)
  schemaRegistry.register(socialPostNodeSchema as any)

  // ── Node-layer v2 data shapes (adopted from vivim-app-og reference) ──
  schemaRegistry.register({
    type: 'cap-store.memory',
    version: 1,
    schema: MemoryDataSchema,
    indexContent: (d: any) => [d.content, d.summary, d.category].filter(Boolean).join('\n'),
    embeddingText: (d: any) => d.content,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.acu',
    version: 1,
    schema: AcuDataSchema,
    indexContent: (d: any) => d.content,
    embeddingText: (d: any) => d.content,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.notebook',
    version: 1,
    schema: NotebookDataSchema,
    indexContent: (d: any) => d.name,
    embeddingText: (d: any) => d.name,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.note',
    version: 1,
    schema: NoteDataSchema,
    indexContent: (d: any) => [d.title, d.body].join('\n'),
    embeddingText: (d: any) => d.body,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.bookmark',
    version: 1,
    schema: BookmarkDataSchema,
    indexContent: (d: any) => [d.title, d.description, d.url].filter(Boolean).join('\n'),
    embeddingText: (d: any) => d.title,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.artifact',
    version: 1,
    schema: ArtifactDataSchema,
    indexContent: (d: any) => [d.title, d.artifactType].join('\n'),
    embeddingText: (d: any) => d.title,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.document',
    version: 1,
    schema: DocumentNodeDataSchema,
    indexContent: (d: any) => [d.title, d.body].join('\n'),
    embeddingText: (d: any) => d.body,
  } as any)
  schemaRegistry.register({
    type: 'cap-store.email',
    version: 1,
    schema: EmailNodeDataSchema,
    indexContent: (d: any) => [d.subject, d.body, d.from].join('\n'),
    embeddingText: (d: any) => [d.subject, d.body].join('\n'),
  } as any)

  // ── Agentic backbone (SOTA agentic system — cap-store.* sub-types) ──
  // All agentic node types are validated by their Zod schemas in agentic.ts.
  for (const type of AGENTIC_NODE_TYPES) {
    const schema = agenticDataSchemas[type]
    schemaRegistry.register({
      type,
      version: 1,
      schema,
      indexContent: (d: any) => {
        if (d.handle) return [d.handle, d.displayName].filter(Boolean).join('\n')
        if (d.name) return String(d.name)
        if (d.title) return [d.title, d.description].filter(Boolean).join('\n')
        if (d.topic) return [d.topic, d.claim].filter(Boolean).join('\n')
        return JSON.stringify(d)
      },
      embeddingText: (d: any) => {
        if (d.displayName) return d.displayName
        if (d.title) return d.title
        if (d.topic) return [d.topic, d.claim].filter(Boolean).join('\n')
        if (d.description) return d.description
        return String(d.name ?? '')
      },
    } as any)
  }
}
```

## src/schema/session.ts

```ts
// src/schema/session.ts
// Session and conversation domain types.

export type SessionState = 'active' | 'idle' | 'suspended' | 'closed'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface VivimSession {
  id: string
  state: SessionState
  contextJson: string
  createdAt: number
  updatedAt: number
}

export interface ProviderSession {
  id: string
  vivimSessionId: string
  providerId: string
  accountId: string
  state: string
  contextJson: string
  createdAt: number
  updatedAt: number
}

export interface ProfileSession {
  id: string
  providerSessionId: string
  profileDir: string
  chromeSlaveId: string | null
  state: string
  port: number | null
  createdAt: number
  updatedAt: number
}

export interface Conversation {
  id: string
  providerSessionId: string
  providerId: string
  title: string | null
  state: string
  messageCount: number
  lastMessageAt: number | null
  contextJson: string
  createdAt: number
  updatedAt: number
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: MessageRole
  content: string | null
  blocksJson: string
  blockCount: number
  parentMessageId: string | null
  sequenceIndex: number
  latencyMs: number | null
  tokenCount: number | null
  model: string | null
  metadataJson: string
  createdAt: number
}
```

## src/schema/social.ts

```ts
// src/schema/social.ts
// Social post node types — tweets, LinkedIn, Reddit, etc.

import { z } from 'zod'

// ── SocialPostNode (cap-store.social-post) ─────────────────────────────────

export interface SocialPostData {
  platform: 'twitter' | 'linkedin' | 'reddit' | 'bluesky' | 'mastodon' | 'threads' | 'other'
  postId: string
  url?: string
  author: {
    id?: string
    displayName: string
    username: string
    avatarUrl?: string
  }
  body: string
  bodyType?: 'plain' | 'markdown'
  publishedAt: number
  archivedAt: number
  editedAt?: number
  metrics?: {
    likes?: number
    replies?: number
    reposts?: number
    views?: number
  }
  attachments?: Array<{
    type: 'image' | 'video' | 'link'
    url: string
    mediaType?: string
  }>
  inReplyToPostId?: string
  inReplyToAuthor?: string
  threadId?: string
  tags?: string[]
  language?: string
  sentiment?: 'positive' | 'negative' | 'neutral'
}

export const SocialAuthorSchema = z.object({
  id: z.string().optional(),
  displayName: z.string(),
  username: z.string(),
  avatarUrl: z.string().optional(),
})

export const SocialMetricsSchema = z.object({
  likes: z.number().int().positive().optional(),
  replies: z.number().int().positive().optional(),
  reposts: z.number().int().positive().optional(),
  views: z.number().int().positive().optional(),
})

export const SocialAttachmentSchema = z.object({
  type: z.enum(['image', 'video', 'link']),
  url: z.string(),
  mediaType: z.string().optional(),
})

export const SocialPostDataSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'reddit', 'bluesky', 'mastodon', 'threads', 'other']),
  postId: z.string(),
  url: z.string().optional(),
  author: SocialAuthorSchema,
  body: z.string(),
  bodyType: z.enum(['plain', 'markdown']).optional(),
  publishedAt: z.number(),
  archivedAt: z.number(),
  editedAt: z.number().optional(),
  metrics: SocialMetricsSchema.optional(),
  attachments: z.array(SocialAttachmentSchema).optional(),
  inReplyToPostId: z.string().optional(),
  inReplyToAuthor: z.string().optional(),
  threadId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
})

// ── Node schema for registration ─────────────────────────────────────────

export const socialPostNodeSchema = {
  type: 'cap-store.social-post' as const,
  version: 1,
  schema: SocialPostDataSchema,
  indexContent: (data: SocialPostData) =>
    `${data.author.displayName}: ${data.body} ${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: SocialPostData) => data.body,
}
```

## src/schema/streaming.ts

```ts
// src/schema/streaming.ts
// ContentPart union — the layer-1 message parts model.
// AI SDK UIMessagePart shapes. Rich text nesting handled by RichText type.
// This is the data payload type for 'cap-store.message' nodes.

import { z } from 'zod'
import type { RichText } from './rich-text.js'

// ── ToolCallState ──────────────────────────────────────────────────────────

export const ToolCallStateSchema = z.enum([
  'pending',
  'input-streaming',
  'input-available',
  'output-available',
  'output-error',
  'approval-requested',
  'approval-responded',
  'output-denied',
])
export type ToolCallState = z.infer<typeof ToolCallStateSchema>

// ── ContentPart — discriminated union of message parts ─────────────────────

export interface TextPart {
  type: 'text'
  text: RichText
  state?: 'streaming' | 'done'
  lang?: string
}
export interface ReasoningPart {
  type: 'reasoning'
  text: RichText
  state?: 'streaming' | 'done'
  signature?: string
}
export interface CodePart {
  type: 'code'
  text: string
  language?: string
}
export interface FilePart {
  type: 'file'
  mediaType: string
  url: string
  filename?: string
  data?: string
}
export interface ToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  state?: ToolCallState
  approvalId?: string
}
export interface ToolResultPart {
  type: 'tool-result'
  toolCallId: string
  output?: unknown
  isError?: boolean
}
export interface SourcePart {
  type: 'source'
  sourceId: string
  url?: string
  title?: string
  mediaType?: string
}
export interface CustomPart {
  type: 'custom'
  kind: string
  data: unknown
  state?: 'streaming' | 'done'
}
export interface ErrorPart {
  type: 'error'
  message: string
  code?: string
}
export interface MetaPart {
  type: 'meta'
  key: string
  value: unknown
}
export interface StepStartPart {
  type: 'step-start'
}

export type ContentPart =
  | TextPart
  | ReasoningPart
  | CodePart
  | FilePart
  | ToolCallPart
  | ToolResultPart
  | SourcePart
  | CustomPart
  | ErrorPart
  | MetaPart
  | StepStartPart

// Backward-compat alias — old code referenced ContentBlock.
export type ContentBlock = ContentPart

// ── Zod schemas ────────────────────────────────────────────────────────────

const richTextSchema: z.ZodType<RichText> = z.union([
  z.string(),
  z.object({ ast: z.array(z.any()) }),
])

export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: richTextSchema,
  state: z.enum(['streaming', 'done']).optional(),
  lang: z.string().optional(),
})

export const ReasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: richTextSchema,
  state: z.enum(['streaming', 'done']).optional(),
  signature: z.string().optional(),
})

export const CodePartSchema = z.object({
  type: z.literal('code'),
  text: z.string(),
  language: z.string().optional(),
})

export const FilePartSchema = z.object({
  type: z.literal('file'),
  mediaType: z.string(),
  url: z.string(),
  filename: z.string().optional(),
  data: z.string().optional(),
})

export const ToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.record(z.unknown()),
  state: ToolCallStateSchema.optional(),
  approvalId: z.string().optional(),
})

export const ToolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  output: z.unknown().optional(),
  isError: z.boolean().optional(),
})

export const SourcePartSchema = z.object({
  type: z.literal('source'),
  sourceId: z.string(),
  url: z.string().optional(),
  title: z.string().optional(),
  mediaType: z.string().optional(),
})

export const CustomPartSchema = z.object({
  type: z.literal('custom'),
  kind: z.string(),
  data: z.unknown(),
  state: z.enum(['streaming', 'done']).optional(),
})

export const ErrorPartSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
})

export const MetaPartSchema = z.object({
  type: z.literal('meta'),
  key: z.string(),
  value: z.unknown(),
})

export const StepStartPartSchema = z.object({ type: z.literal('step-start') })

export const ContentPartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  ReasoningPartSchema,
  CodePartSchema,
  FilePartSchema,
  ToolCallPartSchema,
  ToolResultPartSchema,
  SourcePartSchema,
  CustomPartSchema,
  ErrorPartSchema,
  MetaPartSchema,
  StepStartPartSchema,
])

// ── Helpers ────────────────────────────────────────────────────────────────

export function extractText(parts: ContentPart[]): string {
  const pieces: string[] = []
  for (const part of parts) {
    if (part.type === 'text' && typeof part.text === 'string') pieces.push(part.text)
    if (part.type === 'reasoning' && typeof part.text === 'string') pieces.push(part.text)
  }
  return pieces.join('')
}

export function blockKindOf(part: ContentPart): string {
  return part.type
}

export function isStreaming(parts: ContentPart[]): boolean {
  return parts.some(
    (p) =>
      (p.type === 'text' && p.state === 'streaming') ||
      (p.type === 'reasoning' && p.state === 'streaming') ||
      (p.type === 'custom' && p.state === 'streaming'),
  )
}

// ── Legacy migration (old {kind, content, index} blocks) ──────────────────

export interface LegacyBlock {
  kind: string
  content: string
  index: number
  language?: string
  url?: string
  alt?: string
  source?: string
  toolName?: string
  input?: Record<string, unknown>
  message?: string
  code?: string
  key?: string
  value?: unknown
  artifactType?: string
}

export function isLegacyBlock(obj: unknown): obj is LegacyBlock {
  const b = obj as LegacyBlock
  return (
    typeof b === 'object' && b !== null && typeof b.kind === 'string' && typeof b.index === 'number'
  )
}

export function migrateLegacyBlock(legacy: LegacyBlock): ContentPart {
  switch (legacy.kind) {
    case 'text':
      return { type: 'text', text: legacy.content }
    case 'thinking':
      return { type: 'reasoning', text: legacy.content }
    case 'code':
      return { type: 'code', text: legacy.content, language: legacy.language }
    case 'image':
      return {
        type: 'file',
        mediaType: 'image/png',
        url: legacy.url ?? legacy.content,
        filename: legacy.alt,
      }
    case 'tool_use':
      return {
        type: 'tool-call',
        toolCallId: `tc_${legacy.index}`,
        toolName: legacy.toolName ?? 'unknown',
        input: legacy.input ?? {},
      }
    case 'artifact':
      return {
        type: 'custom',
        kind: 'artifact',
        data: { content: legacy.content, artifactType: legacy.artifactType },
      }
    case 'citation':
      return {
        type: 'source',
        sourceId: `src_${legacy.index}`,
        url: legacy.url ?? legacy.source,
        title: legacy.content,
      }
    case 'error':
      return { type: 'error', message: legacy.message ?? legacy.content, code: legacy.code }
    case 'meta':
      return { type: 'meta', key: legacy.key ?? 'unknown', value: legacy.value }
    default:
      return { type: 'text', text: legacy.content }
  }
}

export function migrateLegacyParts(blocks: LegacyBlock[]): ContentPart[] {
  return blocks.map(migrateLegacyBlock)
}
```

## src/schema/task.ts

```ts
// src/schema/task.ts
// Task and project node types for the second brain.

import { z } from 'zod'

// ── TaskNode (cap-store.task) ─────────────────────────────────────────────
// Action items, todos, reminders, follow-ups.

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'deferred'

export interface TaskData {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  dueAt?: number
  completedAt?: number
  startAt?: number
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
    interval?: number
    endAt?: number
    daysOfWeek?: number[]
  }
  assignee?: string
  tags?: string[]
  parentTaskId?: string
  projectId?: string
  order?: number
  estimatedMinutes?: number
  actualMinutes?: number
  source?: string
  createdAt: number
  updatedAt: number
}

export const TaskDataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in-progress', 'completed', 'cancelled', 'deferred']),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
  dueAt: z.number().optional(),
  completedAt: z.number().optional(),
  startAt: z.number().optional(),
  recurrence: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
      interval: z.number().int().positive().optional(),
      endAt: z.number().optional(),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .optional(),
  assignee: z.string().optional(),
  tags: z.array(z.string()).optional(),
  parentTaskId: z.string().optional(),
  projectId: z.string().optional(),
  order: z.number().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  actualMinutes: z.number().int().positive().optional(),
  source: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ── ProjectNode (cap-store.project) ────────────────────────────────────────
// Group of related tasks, milestones, deadlines.

export interface ProjectData {
  name: string
  description?: string
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled'
  deadline?: number
  startAt?: number
  completedAt?: number
  priority: TaskPriority
  tags?: string[]
  members?: string[]
  taskIds?: string[]
  milestoneIds?: string[]
  milestones?: Array<{
    title: string
    dueAt?: number
    completed?: boolean
    completedAt?: number
  }>
  source?: string
  createdAt: number
  updatedAt: number
}

export const MilestoneSchema = z.object({
  title: z.string(),
  dueAt: z.number().optional(),
  completed: z.boolean().optional(),
  completedAt: z.number().optional(),
})

export const ProjectDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'cancelled']),
  deadline: z.number().optional(),
  startAt: z.number().optional(),
  completedAt: z.number().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
  tags: z.array(z.string()).optional(),
  members: z.array(z.string()).optional(),
  taskIds: z.array(z.string()).optional(),
  milestoneIds: z.array(z.string()).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  source: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const taskNodeSchema = {
  type: 'cap-store.task' as const,
  version: 1,
  schema: TaskDataSchema,
  indexContent: (data: TaskData) =>
    `${data.title} ${data.description ?? ''} ${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: TaskData) => data.title,
}

export const projectNodeSchema = {
  type: 'cap-store.project' as const,
  version: 1,
  schema: ProjectDataSchema,
  indexContent: (data: ProjectData) =>
    `${data.name} ${data.description ?? ''} ${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: ProjectData) => data.name,
}
```

## src/schema/telemetry.ts

```ts
// src/schema/telemetry.ts
// Telemetry configuration types — used by TelemetryAggregator.

export interface TelemetryPipelineConfig {
  id: string
  name: string
  engineId: string
  schedule: string
  retention: string
  isActive: boolean
}

export interface TelemetrySchedule {
  id: string
  pipelineId: string
  interval: string
  lastRunAt: number | null
  nextRunAt: number | null
}

export interface TelemetryRetention {
  id: string
  pipelineId: string
  maxAgeDays: number
  maxRecords: number
  currentCount: number
}
```

## src/schema/transfer.ts

```ts
// src/schema/transfer.ts
// SOTA transfer learning types — used by TransferAccelerator.

export interface TransferPattern {
  id: string
  sourceProviderId: string
  targetProviderId: string
  capabilityId: string
  mappingJson: string
  confidence: number
}

export interface TransferCandidate {
  id: string
  patternId: string
  bindingId: string
  projectedConfidence: number
  appliedAt: number | null
}

export interface TransferAttempt {
  id: string
  candidateId: string
  ok: boolean
  durationMs: number
  error: string | null
  ts: number
}
```

## src/schema/types.ts

```ts
// src/schema/types.ts
// Canonical TypeScript types for all database rows.
// Generated from 001_baseline.sql — one interface per table.

// ── L0: Bookkeeping ────────────────────────────────────────────────────────

// ── L1: Provider Knowledge Graph ────────────────────────────────────────────

export interface ProviderDefinitionRow {
  id: string
  slug: string
  display_name: string
  description: string | null
  category: string
  provider_type: string
  is_active: number
  protocol_status: string
  website_url: string | null
  documentation_url: string | null
  auth_type: string
  has_multi_account: number
  profile_strategy: string
  fleet_config_json: string
  capabilities_json: string
  models_json: string
  created_at: number
  updated_at: number
}

export interface ProviderEndpointRow {
  id: string
  provider_id: string
  url: string
  label: string
  endpoint_type: 'landing' | 'chat' | 'login' | 'api' | 'auth'
  is_default: number
  selectors_json: string
  composer_type: string
  send_method: string
  content_editable: number
  created_at: number
  updated_at: number
}

export interface ProviderParserRow {
  id: string
  provider_id: string
  parser_name: string
  parser_version: number
  parser_logic_type: string
  parser_file_path: string | null
  parser_logic_code: string | null // Inline TypeScript/JavaScript for DB-driven loading
  parser_hash: string | null
  sample_body: string | null // Representative wire-format sample for testing
  is_active: number
  fallback_parser_id: string | null
  created_at: number
  updated_at: number
}

export interface ProviderStreamConfigRow {
  id: string
  provider_id: string
  stream_transport: string // 'sse' | 'batchexecute' | 'websocket' | 'sse-patch'
  stream_terminal_json?: string
  sse_format?: string | null
  delta_path_json?: string | null
  content_type?: string | null
  completion_detectors_json?: string
  harness_js?: string | null
  is_active?: number
  version?: number
  superseded_by?: string | null
  created_at: number
  updated_at: number
}

export interface ProviderCapabilityRow {
  id: string
  provider_id: string
  global_capability_id: string
  recovery_strategies_json: string
  ui_component_override: string | null
  ui_label_override: string | null
  ui_icon_override: string | null
  ui_position_override: string | null
  ui_order_override: number | null
  ui_group_override: string | null
  ui_priority_override: string | null
  interaction_mode_override: string | null
  ui_states_override_json: string | null
  ui_visibility_rule_override: string | null
  existential_rule_override: string | null
  ui_input_schema_override: string | null
  mutation_effects_override_json: string | null
  recovery_behavior_override: string | null
  state_persistence_override: string | null
  data_flow_override: string | null
  min_plan_tier_override: string | null
  depends_on_override_json: string | null
  confidence: number
  success_count: number
  fail_count: number
  consecutive_failures: number
  avg_latency_ms: number
  p95_latency_ms: number
  last_used_at: number | null
  selector_hit_count: number
  selector_miss_count: number
  selector_last_miss_at: number | null
  selector_last_error: string | null
  created_at: number
  updated_at: number
}

export interface ProviderConfigRow {
  id: string
  provider_id: string
  config_key: string
  config_value: string
  config_type: string
  is_secret: number
  created_at: number
  updated_at: number
}

export interface ProviderModelRow {
  id: string
  provider_id: string
  model_slug: string
  display_name: string
  is_active: number
  is_default: number
  capabilities_json: string
  context_window: number | null
  max_output_tokens: number | null
  supports_streaming: number
  supports_vision: number
  supports_thinking: number
  supports_tools: number
  pricing_input_per_1m: number | null
  pricing_output_per_1m: number | null
  created_at: number
  updated_at: number
}

export interface ProviderAccountRow {
  id: string
  provider_id: string
  email: string
  plan_tier: 'free' | 'pro' | 'max' | 'enterprise'
  is_default: number
  is_kind: number
  login_state: string
  login_attempts: number
  last_login_at: number | null
  provider_state_json: string
  debug_port: number | null
  profile_dir: string | null
  chrome_slave_id: string | null
  created_at: number
  updated_at: number
}

// ── L2: Trace ───────────────────────────────────────────────────────────────

export interface TraceEntryRow {
  id: string
  engine: string
  method: string
  request_id: string | null
  conversation_id: string | null
  provider_id: string | null
  account_id: string | null
  slave_id: string | null
  cdp_method: string | null
  cdp_params_json: string | null
  cdp_result_json: string | null
  duration_ms: number
  ok: number
  error: string | null
  ts: number
}

// ── L3: Capability System ───────────────────────────────────────────────────

export interface CapabilityTaxonomyRow {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  input_type: string
  ui_component: string
  ui_label: string | null
  ui_icon: string | null
  ui_position: string
  ui_order: number
  ui_layer_depth: number
  parent_capability_id: string | null
  ui_group: string
  ui_priority: string
  interaction_mode: string
  ui_states_json: string
  ui_visibility_rule: string | null
  existential_rule: string | null
  ui_input_schema: string
  mutation_effects_json: string
  recovery_behavior: string
  state_persistence: string
  data_flow: string
  min_plan_tier: string
  depends_on_json: string
  concurrency_safe: number
  op_classification: string | null
  requires_user_confirmation: number
  max_result_size: number
  result_component: string
  result_layout: string
  search_hints_json: string
  aliases_json: string
  availability_json: string
  prefetch: number
  created_at: number
  updated_at: number
}

export interface CapabilityTierRow {
  id: string
  capability_id: string
  plan_tier: string
  max_models: number | null
  max_file_size: number | null
  max_options: number | null
  custom_config_json: string
  ui_states_override_json: string | null
  ui_component_override: string | null
  ui_label_override: string | null
  ui_icon_override: string | null
  ui_input_schema_override: string | null
  created_at: number
  updated_at: number
}

export interface CapabilityBindingRow {
  id: string
  global_id: string
  provider_id: string
  status: 'broken' | 'flaky' | 'prospect' | 'retired' | 'stable' | 'test-1' | 'test-2'
  best_program_id: string | null
  current_program_id: string | null
  promotion_history_json: string
  confidence: number
  created_at: number
  updated_at: number
}

export interface CapabilityProgramRow {
  id: string
  binding_id: string
  version: number
  name: string | null
  superseded_by: string | null
  is_active: number
  config_json: string
  created_at: number
  updated_at: number
}

export interface SelectorStrategyRow {
  id: string
  name: string
  capability_id: string
  provider_id: string
  strategy_type: 'css' | 'xpath' | 'text' | 'aria' | 'data' | 'regex' | 'composite'
  selector_value: string
  priority: number
  is_active: number
  hit_count: number
  miss_count: number
  last_used_at: number | null
  created_at: number
  updated_at: number
}

export interface OutcomeRow {
  id: string
  capability_id: string
  binding_id: string | null
  provider_id: string
  program_id: string | null
  selector_strategy_id: string | null
  ok: number
  error: string | null
  duration_ms: number | null
  confidence: number | null
  selector_used: string | null
  selector_hit: number | null
  ts: number
}

// ── L4: State & Session ─────────────────────────────────────────────────────

export interface VivimSessionRow {
  id: string
  state: string
  context_json: string
  created_at: number
  updated_at: number
}

export interface ProviderSessionRow {
  id: string
  vivim_session_id: string
  provider_id: string
  account_id: string
  state: string
  context_json: string
  created_at: number
  updated_at: number
}

export interface ProfileSessionRow {
  id: string
  provider_session_id: string
  profile_dir: string
  chrome_slave_id: string | null
  state: string
  port: number | null
  created_at: number
  updated_at: number
}

export interface ConversationRow {
  id: string
  provider_session_id: string
  provider_id: string
  title: string | null
  state: string
  message_count: number
  last_message_at: number | null
  context_json: string
  created_at: number
  updated_at: number
}

export interface ConversationMessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  blocks_json: string
  block_count: number
  parent_message_id: string | null
  sequence_index: number
  latency_ms: number | null
  token_count: number | null
  model: string | null
  metadata_json: string
  created_at: number
}

export interface StateTransitionRow {
  id: string
  entity_type: string
  entity_id: string
  from_state: string | null
  to_state: string
  trigger: string
  metadata_json: string
  ts: number
}

export interface SessionCheckpointRow {
  id: string
  vivim_session_id: string
  checkpoint_json: string
  created_at: number
}

export interface StreamBlockRow {
  id: string
  conversation_id: string
  message_id: string
  block_index: number
  block_kind: string
  block_data: string
  block_meta: string
  created_at: number
}

// ── L5-L8: Lifecycle, Config ───────────────────────────────────────────────

export interface ProviderManifestVersionRow {
  id: string
  provider_id: string
  manifest_file: string
  version: number
  hash: string
  content_json: string
  change_summary: string | null
  actor: string
  created_at: number
}

export interface RegistrationEventRow {
  id: string
  provider_id: string
  manifest_version_id: string | null
  event_type: string
  table_name: string
  record_id: string | null
  field_name: string | null
  from_value: string | null
  to_value: string | null
  change_summary: string | null
  actor: string
  ts: number
}

export interface ManifestDriftRow {
  id: string
  provider_id: string
  drift_type: string
  table_name: string | null
  record_id: string | null
  seed_value: string | null
  db_value: string | null
  resolved: number
  resolved_by_actor: string | null
  resolved_at: number | null
  detected_at: number
}

export interface BindingStatusLogRow {
  id: string
  binding_id: string
  from_status: string | null
  to_status: string
  from_program_id: string | null
  to_program_id: string | null
  trigger: string
  confidence_at_transition: number | null
  success_rate_at_transition: number | null
  reason: string | null
  actor: string
  metadata_json: string
  ts: number
}

export interface ProgramVersionMetricRow {
  id: string
  binding_id: string
  program_id: string
  program_version: number
  total_executions: number
  success_count: number
  fail_count: number
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  last_executed_at: number | null
  first_executed_at: number | null
  window_1h_total: number
  window_1h_success: number
  window_24h_total: number
  window_24h_success: number
  window_7d_total: number
  window_7d_success: number
  created_at: number
  updated_at: number
}

export interface HealthHistoryRow {
  id: string
  providerId: string
  runtimeState: string
  activeSessions: number
  totalConversations: number
  totalMessages: number
  capabilityExecutions: number
  capabilitySuccesses: number
  capabilityFailures: number
  errorCount: number
  parserConfidenceAvg: number | null
  selectorHitRateAvg: number | null
  avgResponseLatencyMs: number | null
  p50ResponseLatencyMs: number | null
  p95ResponseLatencyMs: number | null
  p99ResponseLatencyMs: number | null
  circuitBreakerState: string | null
  fleetRestarts: number
  driftEventsUnresolved: number
  windowStartTs: number
  windowEndTs: number
  snapshotTs: number
  schemaVersion: number
}

export interface ConfigEntryRow {
  id: string
  engineId: string
  scopeType: string
  scopeId: string | null
  configJson: string
  schemaVersion: number
  createdAt: number
  updatedAt: number
}

export interface ConfigAuditRow {
  id: string
  engine_id: string
  config_key: string | null
  from_value: string | null
  to_value: string
  actor: string
  ts: number
}

// ── Input types (for store create methods) ──────────────────────────────────

export interface ManifestVersionInput {
  provider_id: string
  manifest_file: string
  version: number
  hash: string
  content_json: string
  change_summary?: string | null
  actor: string
}

export interface RegistrationEventInput {
  provider_id: string
  manifest_version_id?: string | null
  event_type: string
  table_name: string
  record_id?: string | null
  field_name?: string | null
  from_value?: string | null
  to_value?: string | null
  change_summary?: string | null
  actor: string
}

export interface ManifestDriftInput {
  provider_id: string
  drift_type: string
  table_name?: string | null
  record_id?: string | null
  seed_value?: string | null
  db_value?: string | null
}

// ── L12: Transfer & Routing ──────────────────────────────────────────────

export interface RouteSpecRow {
  id: string
  name: string
  provider_id: string
  capability_id: string
  is_active: number
  config_json: string
  created_at: number
  updated_at: number
}

export interface RouteRequestRow {
  id: string
  route_spec_id: string
  conversation_id: string | null
  status: string
  result_json: string | null
  ts: number
}

export interface RouteTargetRow {
  id: string
  route_spec_id: string
  provider_id: string
  account_id: string | null
  priority: number
  is_active: number
  created_at: number
}

export interface RouteEventRow {
  id: string
  route_request_id: string
  event_type: string
  event_data_json: string
  ts: number
}
```

## src/schema/validators.ts

```ts
// src/schema/validators.ts
// Zod validators for all write endpoints

import { z } from 'zod'

export const CreateAccountSchema = z.object({ email: z.string().email() })

export const SendMessageSchema = z.object({
  message: z.string().min(1).max(100000),
})

export const CreateConversationSchema = z.object({
  providerId: z.string().min(1),
  title: z.string().max(200).optional(),
})

export const UpdateConversationSchema = z.object({
  title: z.string().max(200).optional(),
  state: z.enum(['active', 'archived', 'deleted']).optional(),
})

export const FleetStartSchema = z.object({
  providerId: z.string().min(1),
  accountId: z.string().min(1),
})

export const FleetStopSchema = z.object({
  providerId: z.string().min(1),
  accountId: z.string().min(1),
})

export const ConfigUpdateSchema = z.object({
  config: z.record(z.unknown()),
  scopeType: z.enum(['global', 'provider', 'account', 'engine']).optional(),
  scopeId: z.string().optional(),
})

export const RollbackSchema = z.object({
  version: z.number().int().positive(),
})

export const CapabilitySearchSchema = z.object({
  query: z.string().min(1).max(100),
  planTier: z.enum(['free', 'pro', 'max', 'enterprise']).optional(),
})
```

## src/schema/versioning.ts

```ts
// src/schema/versioning.ts
// Version management types — used by VersionManager and RegistrationAuditor.

export interface VersionConfig {
  id: string
  engineId: string
  currentVersion: number
  minVersion: number
  compatMapJson: string
}

export interface PromotionRule {
  id: string
  name: string
  criteria: string
  fromStatus: string
  toStatus: string
  autoPromote: boolean
  isActive: boolean
}

export interface DegradationRule {
  id: string
  name: string
  threshold: number
  action: string
  cooldownMs: number
  isActive: boolean
}

export interface ProviderManifestVersion {
  id: string
  providerId: string
  version: number
  hash: string
  contentJson: string
  changeSummary: string | null
  actor: string
  createdAt: number
}
```

## src/storage/contracts/agent-loop-store.ts

```ts
// src/storage/contracts/agent-loop-store.ts
// Store Contract for agentic loop audit trail (Sense/Plan/Act/Observe/Reflect/Adapt).
// Engines depend on this contract only (never the impl).

import type { AgentStep } from '../../engines/browser-automation/types.js'

export interface AgentLoopRunRow {
  runId: string
  slaveId: string
  goal: string
  achieved: boolean
  iterations: number
  steps: AgentStep[]
  output?: unknown
  error?: string
  createdAt: number
  updatedAt: number
}

export interface AgentLoopStore {
  createRun(input: {
    runId: string
    slaveId: string
    goal: string
  }): Promise<AgentLoopRunRow>
  appendStep(runId: string, step: AgentStep): Promise<void>
  finishRun(
    runId: string,
    result: { achieved: boolean; iterations: number; output?: unknown; error?: string },
  ): Promise<void>
  getRun(runId: string): Promise<AgentLoopRunRow | null>
  cancelRun(runId: string): Promise<void>
}
```

## src/storage/contracts/agentic-store.ts

```ts
// src/storage/contracts/agentic-store.ts
// AgenticStoreContract — the persistence surface for the agentic backbone.
//
// The backbone is a *composition* over NodeStoreContract: every entity is a
// typed cap-store.* Node. Relational helpers (RunInbox, SlotBinding, builder
// pipeline) are materialized for fast queries, but the source of truth for
// agent/run/step/objective/belief/tool/role/policy/tool state is the Node graph.
//
// NOTE: EventRecord / AgentSession / AgentPermissionDecision / AgentFileEdit /
// AgentDefinition are OpenCode + event-substrate projections. They are exposed
// through the OpenCode ingest engine, NOT through this contract (which is the
// pure backbone). They are appended to prisma/schema.prisma alongside.

import type { ActorRef } from '../../schema/agentic.js'
import type { NodeStoreContract } from './node-store.js'

// ── Input/result shapes (loose — the Zod schemas in agentic.ts are the real validation) ──

export interface AgentSpec {
  handle: string
  displayName: string
  createdByActor: ActorRef
  personaJson?: Record<string, unknown>
  modelPrefsJson?: Record<string, unknown>
  capabilitiesJson?: Record<string, unknown>
  status?: 'draft' | 'active' | 'paused' | 'retired'
  parentAgentId?: string
}

export interface RoleSpec {
  name: string
  description?: string
  requiredCapabilitiesJson?: Record<string, unknown>
  constraintsJson?: Record<string, unknown>
}

export interface GovernancePolicySpec {
  name: string
  strategy?:
    | 'round_robin'
    | 'weighted'
    | 'capability_match'
    | 'cost_aware'
    | 'fallback_chain'
    | 'ensemble'
  roles?: Array<{
    roleId: string
    candidateAgentIds?: string[]
    weights?: number[]
    models?: string[]
    fallbackAgentIds?: string[]
  }>
  costBudgetCents?: number
  reputationFloor?: number
  preferLowerCost?: boolean
  stopConditionsJson?: Record<string, unknown>
}

export interface RunSpec {
  goalJson?: Record<string, unknown>
  objectiveId?: string
  governancePolicyId?: string
  roleBindingsJson?: Record<string, unknown>
  parentRunId?: string
  rootRunId?: string
  endStrategy?: 'early' | 'graceful' | 'exhaustive'
}

export interface StepSpec {
  runId: string
  stepIndex: number
  actor: ActorRef
  actionType: 'llm_call' | 'tool_call' | 'human_input' | 'spawn' | 'decide' | 'observe' | 'reflect'
  roleId?: string
  modelRef?: string
  inputJson?: Record<string, unknown>
  outputJson?: Record<string, unknown>
  toolCallId?: string
  success?: boolean
  durationMs?: number
  costCents?: number
  tokens?: number
  emitsNodeIds?: string[]
}

export interface ToolSpec {
  name: string
  description?: string
  kind?: 'generated' | 'mcp' | 'builtin' | 'imported'
  codeRef?: string
  inputSchemaJson?: Record<string, unknown>
  outputSchemaJson?: Record<string, unknown>
  sandboxJson?: Record<string, unknown>
  generatedByActor: ActorRef
}

export interface ObjectiveSpec {
  title: string
  description?: string
  goalJson?: Record<string, unknown>
  agenda?: Array<{
    id: string
    kind: 'task' | 'wait_for_event' | 'human_check' | 'sleep_until' | 'review'
    payloadJson?: Record<string, unknown>
  }>
  ownerActor: ActorRef
  parentObjectiveId?: string
  successCriteriaJson?: Record<string, unknown>
}

export interface BeliefSpec {
  ownerKind: 'agent' | 'objective'
  ownerId: string
  topic: string
  claim: string
  confidence?: number
  evidenceNodeIds?: string[]
  sourceStepId?: string
}

export interface InboxTask {
  priority: 'asap' | 'when_idle'
  contentJson: Record<string, unknown>
}

export interface RoleBinding {
  roleId: string
  agentId: string
  model?: string
  weight?: number
}

export interface AgenticStoreContract {
  // ── Underlying node store (composition root) ──
  readonly nodes: NodeStoreContract

  // ── Agents ──
  putAgent(spec: AgentSpec): Promise<{ id: string }>
  getAgent(id: string): Promise<unknown | null>
  listAgents(opts?: { status?: string }): Promise<unknown[]>
  updateReputation(
    agentId: string,
    outcome: 'success' | 'failure',
    costCents?: number,
  ): Promise<void>

  // ── Governance ──
  putGovernancePolicy(spec: GovernancePolicySpec): Promise<{ id: string }>
  evaluateAllocation(policyId: string, ctx: Record<string, unknown>): Promise<RoleBinding[]>
  putRole(spec: RoleSpec): Promise<{ id: string }>
  assignRole(roleId: string, agentId: string): Promise<void>

  // ── Runs (durable/resumable/forkable spine) ──
  startRun(spec: RunSpec): Promise<{ id: string; runId: string }>
  appendStep(step: StepSpec): Promise<{ id: string }>
  checkpointRun(runId: string, state: Record<string, unknown>): Promise<void>
  resumeRun(runId: string): Promise<{ id: string; checkpointJson: Record<string, unknown> }>
  forkRun(runId: string, goalPatch: Record<string, unknown>): Promise<{ id: string; runId: string }>
  enqueueTask(runId: string, task: InboxTask): Promise<{ id: string }>
  drainInbox(runId: string): Promise<Array<{ id: string; contentJson: Record<string, unknown> }>>

  // ── Budgets ──
  accrueCost(runId: string, costCents: number, tokens?: number): Promise<void>
  checkBudget(
    runId: string,
    kind: 'cost' | 'tokens' | 'iterations' | 'duration',
    used: number,
    limit: number,
  ): Promise<void>

  // ── Tools ──
  putTool(spec: ToolSpec): Promise<{ id: string }>
  invokeTool(toolId: string, input: Record<string, unknown>): Promise<{ toolCallId: string }>
  putToolset(spec: { name: string; toolIds: string[] }): Promise<{ id: string }>
  bindToolset(toolsetId: string, runId: string): Promise<void>

  // ── Objectives (cross-run intent) ──
  putObjective(spec: ObjectiveSpec): Promise<{ id: string }>
  advanceAgenda(objectiveId: string): Promise<{ current: string | null; done: boolean }>
  sleepObjective(id: string, until: number): Promise<void>
  wakeObjective(id: string): Promise<void>

  // ── Beliefs (versioned world-model) ──
  putBelief(spec: BeliefSpec): Promise<{ id: string; version: number }>
  retractBelief(beliefId: string): Promise<void>
  getBeliefs(ownerKind: 'agent' | 'objective', ownerId: string): Promise<unknown[]>

  // ── Capabilities (capability-as-data, bound to runs) ──
  putCapability(spec: {
    name: string
    kind: string
    configJson?: Record<string, unknown>
  }): Promise<{ id: string }>
  bindCapability(capId: string, runId: string, ordering?: number): Promise<void>

  // ── Builder subsystem (human-led + agent-led) ──
  startBuilderRun(
    intent: Record<string, unknown>,
    mode: 'human_led' | 'agent_led',
    initiator: ActorRef,
  ): Promise<{ id: string }>
  spawnFromBuilder(builderRunId: string): Promise<{ agentId: string; runId: string }>

  // ── SlotBinding (audited UI hot-swap) ──
  bindSlot(slot: {
    slotId: string
    componentId: string
    boundAgentId?: string
    boundRoleId?: string
    boundByActor: ActorRef
    auditJson?: Record<string, unknown>
  }): Promise<{ id: string }>
  listSlotBindings(slotId?: string): Promise<unknown[]>

  // ── Agent chat thread (first-class surface, reuses Conversation/Msg/StreamBlock) ──
  // An agent's thread is a Conversation whose providerSessionId points at a
  // ProviderSession with providerId='agent:<agentId>'. authorDid = actorDid(actor).
  startAgentConversation(
    actor: ActorRef,
    goal: string,
    opts?: { title?: string; agentId?: string },
  ): Promise<{ providerSessionId: string; conversationId: string }>
  appendAgentMessage(
    conversationId: string,
    msg: {
      role: 'user' | 'assistant' | 'system'
      text: string
      blocks?: Array<{
        kind: string
        data: Record<string, unknown>
        meta?: Record<string, unknown>
      }>
      model?: string
      authorDid?: string
      stepId?: string
    },
  ): Promise<{ id: string }>
  getAgentMessages(conversationId: string, opts?: { limit?: number }): Promise<unknown[]>
  // Causal link: an agent_step emits the message node (agent_step.emitsNodeIds).
  linkStepToMessage(stepId: string, messageId: string): Promise<void>

  // ── OpenCode served-session projection (feature 027) ──
  // Registers a served `opencode serve` session as a peer provider thread
  // (providerId='opencode'), creating the ProviderSession + Conversation + AgentSession
  // landing rows. Idempotent by serve `sessionId`.
  createOpencodeAgentSession(opts: {
    sessionId: string
    model?: string
    agentName?: string
    projectPath?: string
    title?: string
  }): Promise<{
    providerSessionId: string
    conversationId: string
    agentSessionId: string
  }>
  // Idempotent landing-table writers for served OpenCode events (feature 027).
  appendAgentPermissionDecision(row: {
    agentSessionId: string
    providerPermissionId: string
    toolName: string
    riskTier: number
    decision: 'allow' | 'deny' | 'allow_always'
    payload?: unknown
  }): Promise<void>
  appendAgentFileEdit(row: {
    agentSessionId: string
    filePath: string
    patch: unknown[]
    messageId?: string
  }): Promise<void>
}
```

## src/storage/contracts/ai-execution-store.ts

```ts
// src/storage/contracts/ai-execution-store.ts
// Contract for persisting AI Gateway executions + events.
// Implements the same shape as IExecutionManager but with persistence.
// The in-memory IExecutionManager wraps this as a caching layer.

import type { ModelId, ProviderId, RequestId, SessionId } from '../../ai/core/types.js'
import type { RequestPriority } from '../../ai/core/types.js'
import type {
  AIExecution,
  ExecutionEvent,
  ExecutionId,
  ExecutionState,
} from '../../ai/execution/types.js'

export interface AIExecutionRow {
  id: ExecutionId
  requestId: RequestId
  sessionId?: SessionId
  state: ExecutionState
  priority: RequestPriority
  providerId?: ProviderId
  modelId?: ModelId
  attempt: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorCode?: string
  errorMessage?: string
  errorRetryable?: boolean
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface AIExecutionEventRow {
  id: string
  executionId: ExecutionId
  sequence: number
  timestamp: string
  type: string
  payloadJson: string
}

export interface AIExecutionStore {
  createExecution(execution: AIExecution): Promise<void>
  updateExecution(executionId: ExecutionId, patch: Partial<AIExecution>): Promise<void>
  getExecution(executionId: ExecutionId): Promise<AIExecutionRow | undefined>
  getByRequest(requestId: RequestId): Promise<AIExecutionRow | undefined>
  listExecutions(filter?: {
    state?: ExecutionState
    providerId?: ProviderId
    sessionId?: SessionId
    priority?: RequestPriority
    limit?: number
  }): Promise<AIExecutionRow[]>

  appendEvent(executionId: ExecutionId, event: ExecutionEvent): Promise<void>
  listEvents(executionId: ExecutionId): Promise<AIExecutionEventRow[]>

  setProviderState(
    providerId: ProviderId,
    state: string,
    patch?: { integrityHash?: string; signature?: string; certifiedAt?: string },
  ): Promise<void>
  getProviderState(providerId: ProviderId): Promise<string | undefined>
  listProviderInstances(filter?: { state?: string; kind?: string }): Promise<
    Array<{
      id: string
      name: string
      kind: string
      trust: string
      state: string
    }>
  >
}
```

## src/storage/contracts/alert-store.ts

```ts
// src/storage/contracts/alert-store.ts
// AlertStore contract — Phase 21.1.4

export interface Alert {
  id: string
  type: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  source: string
  message: string
  metadata?: Record<string, unknown>
  acknowledged: boolean
  createdAt: number
}

export interface AlertStore {
  save(alert: Alert): Promise<void>
  findById(id: string): Promise<Alert | null>
  findUnacknowledged(limit?: number): Promise<Alert[]>
  acknowledge(id: string): Promise<void>
  delete(id: string): Promise<void>
}
```

## src/storage/contracts/automation-store.ts

```ts
// src/storage/contracts/automation-store.ts
// AutomationStore contract — Phase 21.1.5

export interface Automation {
  id: string
  name: string
  type: string
  schedule?: string
  enabled: boolean
  config: Record<string, unknown>
  lastRunAt?: number
  nextRunAt?: number
  createdAt: number
}

export interface AutomationStore {
  save(automation: Automation): Promise<void>
  findById(id: string): Promise<Automation | null>
  listEnabled(): Promise<Automation[]>
  updateLastRun(id: string, timestamp: number): Promise<void>
  delete(id: string): Promise<void>
}
```

## src/storage/contracts/autonomous-store.ts

```ts
// src/storage/contracts/autonomous-store.ts
// AutonomousExecutionStore — persistence contract for autonomous tasks, steps, gates, templates

export interface AutonomousExecutionStore {
  createTask(task: Record<string, unknown>): Promise<void>
  updateTask(id: string, patch: Record<string, unknown>): Promise<void>
  getTask(id: string): Promise<Record<string, unknown> | null>
  listTasks(opts?: { status?: string; limit?: number }): Promise<Array<Record<string, unknown>>>
  createStep(step: Record<string, unknown>): Promise<void>
  updateStep(id: string, patch: Record<string, unknown>): Promise<void>
  getSteps(taskId: string): Promise<Array<Record<string, unknown>>>
  getStep(id: string): Promise<Record<string, unknown> | null>
  createHitlGate(gate: Record<string, unknown>): Promise<void>
  updateHitlGate(id: string, patch: Record<string, unknown>): Promise<void>
  getPendingGates(taskId?: string): Promise<Array<Record<string, unknown>>>
  getGate(id: string): Promise<Record<string, unknown> | null>
  // Unit 8.10: task templates
  getTaskTemplate(id: string): Promise<Record<string, unknown> | null>
  insertTaskTemplate(template: Record<string, unknown>): Promise<string>
  updateTaskTemplate(id: string, patch: Record<string, unknown>): Promise<void>
  listTaskTemplates(opts?: { isShared?: boolean }): Promise<Array<Record<string, unknown>>>
}
```

## src/storage/contracts/canvas-store.ts

```ts
// src/storage/contracts/canvas-store.ts
// CanvasStore — persistence contract for vivim-canvas definitions + instances.
//
// Follows the XxxStore contract pattern (see MirrorStore in
// src/engines/mirror-engine.ts:68). Engines depend on this interface,
// never on an impl. Local-first by default (InMemoryCanvasStore); a Prisma
// impl is the durable backing (see prisma/schema.prisma `CanvasDefinition`).
// The store contract uses JSON string fields for storage efficiency.
// CanvasRegistry (the API layer) accepts domain types and converts via definitionToRow.

import type { CanvasDefinition } from '../../canvas/types.js'

// Row format for persistence (JSON strings embedded)
export interface CanvasDefinitionRow {
  id: string
  slug: string
  name: string
  description: string
  category: string
  version: number
  html: string
  css: string
  scriptUrl: string | null
  bindingsJson: string
  layoutJson: string
  author: 'system' | 'user' | 'agent'
  sandboxJson: string
  status: 'draft' | 'published' | 'deprecated'
  tagsJson: string
  createdAt: number
  updatedAt: number
}

// Store input uses row format (JSON strings)
export interface CanvasDefinitionInput {
  id?: string
  slug: string
  name: string
  description: string
  category: string
  html: string
  css: string
  scriptUrl?: string | null
  bindingsJson: string
  layoutJson: string
  author: 'system' | 'user' | 'agent'
  sandboxJson: string
  status: 'draft' | 'published' | 'deprecated'
  tagsJson: string
  version?: number
  createdAt?: number
  updatedAt?: number
}

export interface CanvasInstanceRow {
  instanceId: string
  definitionId: string
  slug: string
  category: string
  status: 'mounting' | 'live' | 'dismissed' | 'error'
  hostNodeId: string
  bindingsActiveJson: string
  spawnedBy: 'system' | 'user' | 'agent'
  mountedAt: number
  dismissedAt: number | null
}

export interface CanvasInstanceInput {
  instanceId: string
  definitionId: string
  slug: string
  category: string
  status: 'mounting' | 'live' | 'dismissed' | 'error'
  hostNodeId: string
  bindingsActiveJson: string
  spawnedBy: 'system' | 'user' | 'agent'
  mountedAt: number
  dismissedAt?: number | null
}

export interface CanvasStore {
  createDefinition(input: CanvasDefinitionInput): Promise<CanvasDefinitionRow>
  getDefinition(id: string): Promise<CanvasDefinitionRow | null>
  getDefinitionBySlug(slug: string): Promise<CanvasDefinitionRow | null>
  listDefinitions(opts?: {
    category?: string
    author?: string
    status?: string
  }): Promise<CanvasDefinitionRow[]>
  updateDefinition(
    id: string,
    patch: Partial<Omit<CanvasDefinitionInput, 'id'>>,
  ): Promise<CanvasDefinitionRow>
  deleteDefinition(id: string): Promise<void>

  createInstance(input: CanvasInstanceInput): Promise<CanvasInstanceRow>
  getInstance(instanceId: string): Promise<CanvasInstanceRow | null>
  listInstances(opts?: { status?: string }): Promise<CanvasInstanceRow[]>
  updateInstance(
    instanceId: string,
    patch: Partial<Omit<CanvasInstanceInput, 'instanceId'>>,
  ): Promise<CanvasInstanceRow>
  deleteInstance(instanceId: string): Promise<void>
}

// ── Row ⇄ domain mapping ──────────────────────────────────────────────
export function rowToDefinition(row: CanvasDefinitionRow): CanvasDefinition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category as CanvasDefinition['category'],
    version: row.version,
    html: row.html,
    css: row.css,
    scriptUrl: row.scriptUrl ?? undefined,
    bindings: JSON.parse(row.bindingsJson) as CanvasDefinition['bindings'],
    layout: JSON.parse(row.layoutJson) as CanvasDefinition['layout'],
    author: row.author,
    sandbox: JSON.parse(row.sandboxJson) as CanvasDefinition['sandbox'],
    status: row.status,
    tags: JSON.parse(row.tagsJson) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// Convert a domain definition into the persistence row format (JSON strings).
export function definitionToRow(def: CanvasDefinition): CanvasDefinitionRow {
  return {
    id: def.id,
    slug: def.slug,
    name: def.name,
    description: def.description,
    category: def.category,
    version: def.version,
    html: def.html,
    css: def.css,
    scriptUrl: def.scriptUrl ?? null,
    bindingsJson: JSON.stringify(def.bindings),
    layoutJson: JSON.stringify(def.layout),
    author: def.author,
    sandboxJson: JSON.stringify(def.sandbox),
    status: def.status,
    tagsJson: JSON.stringify(def.tags),
    createdAt: def.createdAt,
    updatedAt: def.updatedAt,
  }
}
```

## src/storage/contracts/capability-resolution-store.ts

```ts
// src/storage/contracts/capability-resolution-store.ts
// CapabilityResolutionStore — read-only resolution contract (04-merged-engines.md §6).

export interface RawResolutionRow {
  // capability_taxonomy columns
  id: string
  slug: string
  name: string
  category: string
  ui_component: string
  ui_label: string
  ui_icon: string
  ui_position: string
  ui_order: number
  ui_group: string
  ui_layer_depth: number
  parent_capability_id: string | null
  ui_priority: string
  interaction_mode: string
  ui_states_json: string
  ui_visibility_rule: string | null
  existential_rule: string | null
  ui_input_schema: string
  mutation_effects_json: string
  recovery_behavior: string
  state_persistence: string
  data_flow: string
  min_plan_tier: string
  depends_on_json: string
  // vCode pattern columns
  concurrency_safe: number
  op_classification: string | null
  requires_user_confirmation: number
  max_result_size: number
  result_component: string
  result_layout: string
  // joined provider_capability override (per-slot hot-swap map, FRONTEND=BACKEND, H6)
  ui_component_override: string | null
  search_hints_json: string
  aliases_json: string
  availability_json: string
  prefetch: number
  // override source tracking (global | tier | provider)
  component_from: string
  label_from: string
  icon_from: string
  position_from: string
  order_from: string
  group_from: string
  priority_from: string
  interaction_from: string
  states_from: string
  visibility_from: string
  existential_from: string
  input_schema_from: string
  mutation_from: string
  recovery_from: string
  persistence_from: string
  data_flow_from: string
  plan_tier_from: string
  depends_from: string
  // joined columns
  binding_status: string
  binding_confidence: number
  tier_max_models: number | null
  tier_max_file_size: number | null
  tier_max_options: number | null
  tier_config_json: string | null
}

export interface CapabilityResolutionStore {
  resolveCapabilities(providerId: string, planTier: string): Promise<RawResolutionRow[]>
  getActiveBindings(providerId: string): Promise<string[]>
  searchCapabilities(
    providerId: string,
    planTier: string,
    query: string,
  ): Promise<RawResolutionRow[]>
}
```

## src/storage/contracts/capability-store.ts

```ts
// src/storage/contracts/capability-store.ts
// CapabilityStore — persistence contract for CapabilityEngine (04-merged-engines.md §4).

export interface CapabilityTaxonomyRow {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  inputType: string
  uiComponent: string
  uiLabel: string | null
  uiIcon: string | null
  uiPosition: string
  uiOrder: number
  uiLayerDepth: number
  parentCapabilityId: string | null
  uiGroup: string
  uiPriority: string
  interactionMode: string
  uiStatesJson: string
  uiVisibilityRule: string | null
  existentialRule: string | null
  uiInputSchema: string
  mutationEffectsJson: string
  recoveryBehavior: string
  statePersistence: string
  dataFlow: string
  minPlanTier: string
  dependsOnJson: string
  concurrencySafe: number
  opClassification: string | null
  requiresUserConfirmation: number
  maxResultSize: number
  resultComponent: string
  resultLayout: string
  searchHintsJson: string
  aliasesJson: string
  availabilityJson: string
  prefetch: number
  createdAt: number
  updatedAt: number
}

export interface CapabilityBindingRow {
  id: string
  globalId: string
  providerId: string
  status: string
  bestProgramId: string | null
  currentProgramId: string | null
  promotionHistoryJson: string
  confidence: number
  createdAt: number
  updatedAt: number
}

export interface CapabilityProgramRow {
  id: string
  bindingId: string
  version: number
  name: string | null
  supersededById: string | null
  isActive: number
  status: string
  configJson: string
  createdAt: number
  updatedAt: number
}

export interface SelectorStrategyRow {
  id: string
  name: string
  capabilityId: string
  providerId: string
  strategyType: string
  selectorValue: string
  priority: number
  isActive: number
  hitCount: number
  missCount: number
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface OutcomeRow {
  id: string
  capabilityId: string
  bindingId: string | null
  providerId: string
  programId: string | null
  selectorStrategyId: string | null
  ok: number
  error: string | null
  durationMs: number | null
  confidence: number | null
  selectorUsed: string | null
  selectorHit: number | null
  ts: number
}

export interface OutcomeInput {
  capabilityId: string
  bindingId: string | null
  providerId: string
  programId?: string | null
  selectorStrategyId?: string | null
  ok: number
  error?: string | null
  durationMs?: number | null
  confidence?: number | null
  selectorUsed?: string | null
  selectorHit?: number | null
  ts: number
}

/** Bulk snapshot row for the boot loader (binding → taxonomy → best program). */
export interface SnapshotRow {
  globalId: string
  slug: string
  providerId: string
  category: string
  status: string
  confidence: number
  programId: string | null
  configJson: string | null
  uiComponent: string
  uiPosition: string
  uiInputSchema: string
}

export interface CapabilityBindingMatrixRow {
  id: string
  globalId: string
  providerId: string
  status: string
  confidence: number
  capabilitySlug: string
  selector: string
}

export interface DriftEventInput {
  id: string
  providerId: string
  capabilitySlug: string
  selector: string
  status: string
}

export interface SelectorDriftRow {
  id: string
  providerId: string
  capabilitySlug: string
  selector: string
}

export interface CapabilityStore {
  getCapability(id: string): Promise<CapabilityTaxonomyRow | null>
  getCapabilityBySlug(slug: string): Promise<CapabilityTaxonomyRow | null>
  getBinding(capabilityId: string, providerId: string): Promise<CapabilityBindingRow | null>
  getProgram(bindingId: string): Promise<CapabilityProgramRow | null>
  getPrograms(bindingId: string): Promise<CapabilityProgramRow[]>
  getSelectors(capabilityId: string, providerId: string): Promise<SelectorStrategyRow[]>
  createOutcome(outcome: OutcomeInput): Promise<OutcomeRow>
  updateBindingHealth(bindingId: string, patch: Partial<CapabilityBindingRow>): Promise<void>
  updateSelectorHealth(selectorId: string, hit: boolean): Promise<void>
  /** Resolve the best seeded program for a (capabilitySlug, provider). v14 harness. */
  getBestProgramByCapability(
    capabilitySlug: string,
    providerId: string,
  ): Promise<CapabilityProgramRow | null>
  /**
   * Boot snapshot loader (019). One bulk query: active bindings for the given
   * providers, joined to taxonomy + best program. No per-request DB hits.
   */
  loadSnapshot(providerIds: string[]): Promise<SnapshotRow[]>
  /** Provider test harness — list capability bindings for testing. (Unit 6.10) */
  listBindings(providers?: string[]): Promise<CapabilityBindingMatrixRow[]>
  /** Provider test harness — record selector drift. (Unit 6.10) */
  recordDrift(input: DriftEventInput): Promise<void>
}
```

## src/storage/contracts/channel-store.ts

```ts
// src/storage/contracts/channel-store.ts
// Phase 27.1 — Streaming Channel persistence contract.

export interface Channel {
  id: string
  providerId: string
  name?: string
  connected: boolean
  createdAt: number
}

export interface ChannelStore {
  save(channel: Channel): Promise<void>
  findById(id: string): Promise<Channel | null>
  findByProvider(providerId: string): Promise<Channel | null>
  list(providerId?: string): Promise<Channel[]>
  delete(id: string): Promise<void>
  setConnected(id: string, connected: boolean): Promise<void>
}
```

## src/storage/contracts/command-description-store.ts

```ts
// ─── Command Description Store Contract ──────────────────────────────
// NLP description + pattern lookup for the command language system.

export interface CommandDescriptionStore {
  /**
   * Get all enabled command descriptions.
   */
  getAllEnabled(): Promise<CommandDescriptionRow[]>

  /**
   * Get command descriptions by category.
   */
  getByCategory(category: string): Promise<CommandDescriptionRow[]>

  /**
   * Get a command description by command ID.
   */
  getByCommandId(commandId: string): Promise<CommandDescriptionRow | null>

  /**
   * Get command descriptions by prefix.
   */
  getByPrefix(prefix: string): Promise<CommandDescriptionRow[]>

  /**
   * Create or update a command description.
   */
  upsert(row: CommandDescriptionRow): Promise<void>
}

export interface CommandDescriptionRow {
  id: string
  commandId: string
  description: string
  patterns: string[]
  category: string
  prefix: string | null
  confidence: number
  enabled: boolean
}
```

## src/storage/contracts/command-store.ts

```ts
// ─── Command Store Contract ─────────────────────────────────────────
// MRU persistence + command lookup for the command language system.

export interface CommandStore {
  /**
   * Get the MRU (Most Recently Used) command IDs for a user.
   */
  getMRU(userId: string, limit?: number): Promise<string[]>

  /**
   * Record a command as recently used.
   */
  recordMRU(userId: string, commandId: string): Promise<void>

  /**
   * Clear MRU history for a user.
   */
  clearMRU(userId: string): Promise<void>
}
```

## src/storage/contracts/config-store.ts

```ts
// src/storage/contracts/config-store.ts
// ConfigStore — the data access contract for ConfigManager.
// Implements Prisma calls against config_entry + config_audit.

import { z } from 'zod'

// ── Scope ──────────────────────────────────────────────────────────────────

export const ConfigScopeSchema = z.object({
  scopeType: z.enum(['global', 'provider', 'account', 'engine']),
  scopeId: z.string().nullable().optional(),
})

export type ConfigScope = z.infer<typeof ConfigScopeSchema>

// ── Row types ──────────────────────────────────────────────────────────────

export interface ConfigEntryRow {
  id: string
  engineId: string
  scopeType: string
  scopeId: string | null
  configJson: string
  schemaVersion: number
  createdAt: number
  updatedAt: number
}

export interface ConfigAuditRow {
  id: string
  engineId: string
  entryId: string
  action: string
  fromJson: string | null
  toJson: string | null
  actor: string
  ts: number
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface ConfigStore {
  getConfigEntry(
    engineId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<ConfigEntryRow | null>
  upsertConfigEntry(
    engineId: string,
    scopeType: string,
    scopeId: string | null,
    configJson: string,
    schemaVersion: number,
  ): Promise<ConfigEntryRow>
  insertConfigAudit(row: Omit<ConfigAuditRow, 'id'>): Promise<ConfigAuditRow>
  getConfigAuditHistory(engineId: string, limit: number): Promise<ConfigAuditRow[]>
  getConfigEntryById(id: string): Promise<ConfigEntryRow | null>
}
```

## src/storage/contracts/content-unit-store.ts

```ts
// src/storage/contracts/content-unit-store.ts
// ContentUnitStore — persistence for decomposed content blocks (per-block storage).
// Enables: per-block queries, quality scoring, content retrieval by type.

export interface ContentUnitRow {
  id: string
  messageId: string
  conversationId: string
  unitType: string
  content: string
  mimeType: string | null
  metadataJson: string
  sequenceIndex: number
  qualityScore: number | null
  createdAt: number
}

export interface ContentUnitStore {
  storeUnits(units: ContentUnitRow[]): Promise<void>
  getUnitsByMessage(messageId: string): Promise<ContentUnitRow[]>
  getUnitsByConversation(
    conversationId: string,
    opts?: { unitType?: string; limit?: number; offset?: number },
  ): Promise<ContentUnitRow[]>
  getUnitsByType(conversationId: string, unitType: string): Promise<ContentUnitRow[]>
}
```

## src/storage/contracts/context-assembly-store.ts

```ts
// src/storage/contracts/context-assembly-store.ts
// ContextAssemblyStore — persistence contract for ContextAssemblyEngine.

export interface ContextLayerRowInput {
  id: string
  conversationId: string
  layerName: string
  content: string
  tokenCount: number
  priority: number
  sourcesJson: string
  assembledAt: number
}

export interface ContextAssemblyStore {
  saveLayer(row: ContextLayerRowInput): Promise<void>
  getLayersForConversation(conversationId: string): Promise<
    Array<{
      layerName: string
      content: string
      tokenCount: number
      priority: number
      sourcesJson: string
    }>
  >
  clearLayersForConversation(conversationId: string): Promise<void>
}
```

## src/storage/contracts/conversation-store.ts

```ts
// src/storage/contracts/conversation-store.ts
// ConversationStore — data access contract for ConversationManager.
// Implements Prisma calls against conversation + conversation_message tables.

// ── Row types ──────────────────────────────────────────────────────────────

export interface ConversationRow {
  id: string
  providerSessionId: string | null
  providerId: string
  accountId: string | null
  title: string | null
  state: string
  messageCount: number
  lastMessageAt: number | null
  contextJson: string
  createdAt: number
  updatedAt: number
  projectId?: string | null
  topicId?: string | null
  source: string
  externalId: string | null
  importJobId: string | null
  syncedAt: number | null
}

export interface ConversationMessageRow {
  id: string
  conversationId: string
  role: string
  content: string | null
  blocksJson: string
  blockCount: number
  parentMessageId: string | null
  sequenceIndex: number
  latencyMs: number | null
  tokenCount: number | null
  model: string | null
  metadataJson: string
  createdAt: number
}

export interface ProviderAccountRow {
  id: string
  providerId: string
  email: string
  planTier: string
  isDefault: number
  isKind: number
  loginState: string
  loginAttempts: number
  lastLoginAt: number | null
  providerStateJson: string
  debugPort: number | null
  profileDir: string | null
  chromeSlaveId: string | null
  userId: string
  createdAt: number
  updatedAt: number
}

// ── Input types ────────────────────────────────────────────────────────────

export interface ConversationInput {
  providerSessionId?: string // Optional for history-synced conversations
  providerId: string
  accountId?: string // Direct account link for sync queries
  title?: string | null
  state?: string
  contextJson?: string
  source?: string // 'live' | 'history-sync' | 'import'
  externalId?: string // Provider's native conversation ID
  importJobId?: string
  syncedAt?: number // Last sync timestamp
}

export interface MessageInput {
  conversationId: string
  role: string
  content?: string
  blocksJson?: string
  blockCount?: number
  parentMessageId?: string
  sequenceIndex?: number
  latencyMs?: number
  tokenCount?: number
  model?: string
  metadataJson?: string
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface MessageAttachmentRow {
  id: string
  messageId: string
  filename: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  thumbnailPath: string | null
  metadataJson: string
  createdAt: number
}

export interface ConversationStore {
  getConversation(id: string): Promise<ConversationRow | null>
  /** Idempotently ensure a valid ProviderSession exists for (providerId, accountId). Optional on the contract; provided by ConversationStoreImpl. */
  ensureProviderSession?(input: { providerId: string; accountId?: string }): Promise<{ id: string }>
  createConversation(input: ConversationInput): Promise<ConversationRow>
  updateConversation(id: string, patch: Partial<ConversationRow>): Promise<void>
  deleteConversation(id: string): Promise<void>
  listConversations(opts?: {
    providerId?: string
    limit?: number
    offset?: number
  }): Promise<ConversationRow[]>

  // ── History Sync Methods ──────────────────────────────────────────────────

  /** Get a conversation by external provider ID (for idempotent upsert) */
  getConversationByExternalId(
    externalId: string,
    providerId: string,
  ): Promise<ConversationRow | null>

  /** Upsert a conversation by external ID (idempotent sync operation) */
  upsertConversationByExternalId(
    input: ConversationInput & { externalId: string },
  ): Promise<ConversationRow>

  /** List conversations by account ID (direct query, no ProviderSession join) */
  listConversationsByAccountId(
    accountId: string,
    opts?: {
      limit?: number
      offset?: number
      source?: string
    },
  ): Promise<ConversationRow[]>

  /** Batch create messages for efficient sync */
  createMessages(inputs: MessageInput[]): Promise<ConversationMessageRow[]>

  // ── Message Methods ───────────────────────────────────────────────────────

  createMessage(input: MessageInput): Promise<ConversationMessageRow>
  getMessage(id: string): Promise<ConversationMessageRow | null>
  getMessages(
    conversationId: string,
    opts?: { limit?: number; before?: string },
  ): Promise<ConversationMessageRow[]>
  getLastMessage(conversationId: string): Promise<ConversationMessageRow | null>
  updateMessage(
    id: string,
    patch: Partial<Pick<ConversationMessageRow, 'content' | 'blocksJson' | 'metadataJson'>>,
  ): Promise<void>
  getAccount(sessionId: string): Promise<ProviderAccountRow | null>
  createAttachment(input: {
    messageId: string
    filename: string
    mimeType: string
    sizeBytes: number
    storagePath: string
    thumbnailPath?: string
    metadataJson?: string
  }): Promise<MessageAttachmentRow>
  getAttachments(messageId: string): Promise<MessageAttachmentRow[]>
  getAttachment(id: string): Promise<MessageAttachmentRow | null>
  deleteAttachment(id: string): Promise<void>
}

// ── Sync State Types ───────────────────────────────────────────────────────

export interface ConversationSyncStateRow {
  id: string
  providerId: string
  accountId: string
  syncType: string
  status: string
  cursorJson: string
  totalConversations: number
  syncedConversations: number
  failedConversations: number
  lastSyncedAt: number | null
  nextSyncAt: number | null
  errorJson: string | null
  configJson: string
  createdAt: number
  updatedAt: number
}

export interface ConversationSyncLogRow {
  id: string
  providerId: string
  accountId: string
  syncType: string
  status: string
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  conversationsFound: number
  conversationsSynced: number
  conversationsFailed: number
  errorJson: string | null
  metadataJson: string
}

// ── Sync State Contract ────────────────────────────────────────────────────

export interface ConversationSyncStateStore {
  /** Get sync state for a provider account */
  getSyncState(providerId: string, accountId: string): Promise<ConversationSyncStateRow | null>

  /** Upsert sync state (create or update) */
  upsertSyncState(input: {
    providerId: string
    accountId: string
    syncType?: string
    status?: string
    cursorJson?: string
    totalConversations?: number
    syncedConversations?: number
    failedConversations?: number
    errorJson?: string
    configJson?: string
  }): Promise<ConversationSyncStateRow>

  /** Update sync status */
  updateSyncStatus(
    providerId: string,
    accountId: string,
    status: string,
    error?: string,
  ): Promise<ConversationSyncStateRow>

  /** Increment sync progress counters */
  incrementSyncProgress(
    providerId: string,
    accountId: string,
    synced: number,
    failed: number,
  ): Promise<ConversationSyncStateRow>

  /** Get all pending syncs */
  getPendingSyncs(): Promise<ConversationSyncStateRow[]>

  /** Delete sync state */
  deleteSyncState(providerId: string, accountId: string): Promise<void>

  // ── Sync Log Methods ────────────────────────────────────────────────────

  /** Create a sync log entry */
  createSyncLog(input: {
    providerId: string
    accountId: string
    syncType: string
    status: string
  }): Promise<ConversationSyncLogRow>

  /** Update sync log on completion */
  updateSyncLog(
    id: string,
    input: {
      status: string
      completedAt?: number
      durationMs?: number
      conversationsFound?: number
      conversationsSynced?: number
      conversationsFailed?: number
      errorJson?: string
    },
  ): Promise<ConversationSyncLogRow>

  /** Get sync logs for an account */
  getSyncLogs(
    providerId: string,
    accountId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<ConversationSyncLogRow[]>
}
```

## src/storage/contracts/cost-store.ts

```ts
// src/storage/contracts/cost-store.ts
// CostStore — persistence contract for CostOptimizer.

export interface CostLogInput {
  id: string
  providerId: string
  costCents: number
  tokensInput: number
  tokensOutput: number
  model: string | null
  ts: number
}

export interface CostLogRow extends CostLogInput {}

export interface LatencyLogInput {
  id: string
  providerId: string
  latencyMs: number
  capabilityId: string | null
  ts: number
}

export interface LatencyLogRow extends LatencyLogInput {}

export interface CostStore {
  createCostLog(input: CostLogInput): Promise<void>
  getCostLogs(providerId: string, from: number, to: number): Promise<CostLogRow[]>
  getCostLogsByCapability?(capabilityId: string, from: number, to: number): Promise<CostLogRow[]>
  createLatencyLog(input: LatencyLogInput): Promise<void>
  getLatencyLogs(providerId: string, from: number, to: number): Promise<LatencyLogRow[]>
  getAllCostLogs?(from: number, to: number): Promise<CostLogRow[]>
}
```

## src/storage/contracts/cross-conversation-synthesis-store.ts

```ts
// src/storage/contracts/cross-conversation-synthesis-store.ts
// CrossConversationSynthesizerStore — gather related facts, decisions, entities.

export interface CrossConversationSynthesizerStore {
  getFactsForConversation(conversationId: string): Promise<
    Array<{
      id: string
      subject: string
      predicate: string
      object: string
      confidence: number
    }>
  >
  getDecisionsForConversation(conversationId: string): Promise<
    Array<{
      id: string
      decisionText: string
      rationale: string | null
      confidence: number
    }>
  >
  getEntitiesForConversation(conversationId: string): Promise<
    Array<{
      id: string
      name: string
      type: string
      confidence: number
    }>
  >
}
```

## src/storage/contracts/discovery-store.ts

```ts
// src/storage/contracts/discovery-store.ts
// DiscoveryStore contract — Phase 22.1

export interface DiscoverySessionRow {
  id: string
  url: string
  status: string
  shapeId: string | null
  confidence: number
  capabilitiesJson: string
  interactiveJson: string
  parserFormat: string | null
  manifestDraftJson: string | null
  error: string | null
  agentId: string | null
  createdAt: number
  updatedAt: number
}

export interface DiscoveryObservationRow {
  id: string
  sessionId: string
  url: string
  method: string
  status: number
  resourceType: string
  requestHeadersJson: string
  requestBodyJson: string | null
  responseHeadersJson: string
  responseBodyPreview: string | null
  durationMs: number | null
  createdAt: number
}

export interface DiscoveryStore {
  // Sessions
  createSession(row: DiscoverySessionRow): Promise<void>
  updateSession(id: string, updates: Partial<DiscoverySessionRow>): Promise<void>
  getSession(id: string): Promise<DiscoverySessionRow | null>
  listSessions(opts?: { status?: string; limit?: number }): Promise<DiscoverySessionRow[]>
  deleteSession(id: string): Promise<void>

  // Observations
  createObservation(row: DiscoveryObservationRow): Promise<void>
  getObservations(sessionId: string, opts?: { limit?: number }): Promise<DiscoveryObservationRow[]>
  deleteObservations(sessionId: string): Promise<void>
}
```

## src/storage/contracts/fleet-supervisor.ts

```ts
// src/storage/contracts/fleet-supervisor.ts
// FleetSupervisor contract — for dependency injection in unit tests.
// Status vocabulary is the canonical SlaveLifecycle (atomic-v13 / FR-3).

import type { SlaveLifecycle } from '../../executor/slave-states.js'

export interface FleetSupervisorInstance {
  id: string
  providerSlug: string
  accountId: string
  debugPort: number
  profileDir: string
  status: SlaveLifecycle
  pid: number | null
  consecutiveFailures: number
  restartAttempts: number
  lastHealthCheck: number
  createdAt: number
  channel: 'system' | 'chrome' | 'chromium' | 'edge'
  mode: 'headless-new' | 'headless' | 'headed'
  firstRun?: boolean
  adopted?: boolean
}

export interface FleetSupervisor {
  spawn(
    providerSlug: string,
    accountId: string,
    opts?: Partial<{
      extraArgs: string[]
      debugPort?: number
      visible?: boolean
      channel?: 'system' | 'chrome' | 'chromium' | 'edge'
      mode?: 'headless-new' | 'headless' | 'headed'
    }>,
  ): Promise<FleetSupervisorInstance>
  kill(instanceId: string): Promise<void>
  killAll(): Promise<void>
  ensureRunning(instanceId: string): Promise<FleetSupervisorInstance>
  recoverAuth(providerSlug: string, accountId: string): Promise<FleetSupervisorInstance>
  /**
   * Attach to an already-running Chrome for this profile (the "one we had"
   * model) instead of launching a duplicate. Returns null when no matching
   * live instance is found on the configured port range. Optional — mocks
   * that don't exercise adoption may omit it.
   */
  adoptRunning?(
    providerSlug: string,
    accountId: string,
    opts?: Partial<{
      extraArgs: string[]
      debugPort?: number
      visible?: boolean
      channel: 'system' | 'chrome' | 'chromium' | 'edge'
      mode: 'headless-new' | 'headless' | 'headed'
    }>,
  ): Promise<FleetSupervisorInstance | null>
  getInstance(instanceId: string): FleetSupervisorInstance | null
  getAllInstances(): FleetSupervisorInstance[]
  getInstancesByProvider(providerSlug: string): FleetSupervisorInstance[]
  getSuperState(): 'idle' | 'active' | 'degraded' | 'terminal'
  healthCheck(instanceId: string): Promise<{
    ok: boolean
    latencyMs: number
    status: SlaveLifecycle
    error?: string
  }>
  healthCheckAll(): Promise<
    Map<
      string,
      {
        ok: boolean
        latencyMs: number
        status: SlaveLifecycle
        error?: string
      }
    >
  >
  getCircuitState(instanceId: string): 'closed' | 'half_open' | 'open'
  startHealthProbe(intervalMs?: number): void
  stopHealthProbe(): void
}
```

## src/storage/contracts/governor-store.ts

```ts
// src/storage/contracts/governor-store.ts
// GovernorStore — data access contract for ChromeGovernor.

// ── Row types ──────────────────────────────────────────────────────────────

export interface ProviderAccountRow {
  id: string
  providerId: string
  accountSlug: string
  displayName: string
  planTier: string
  apiKeyRef: string | null
  isActive: number
  profileDir: string | null
  debugPort: number | null
  createdAt: number
  updatedAt: number
}

export interface FleetEventRow {
  id: string
  slaveId: string
  providerId: string
  eventType: string
  detailJson: string | null
  ts: number
}

export interface CircuitBreakerStateRow {
  id: string
  slaveId: string
  state: string
  failureCount: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
}

export interface HealthTickRow {
  id: string
  slaveId: string
  providerId: string
  status: string
  responseMs: number | null
  error: string | null
  ts: number
}

export interface TraceEntryRow {
  id: string
  slaveId: string
  conversationId: string | null
  method: string
  paramsJson: string | null
  resultJson: string | null
  durationMs: number | null
  error: string | null
  ts: number
}

// ── Input types ────────────────────────────────────────────────────────────

export interface FleetEventInput {
  slaveId: string
  providerId: string
  eventType: string
  detailJson?: string | null
  ts?: number
}

export interface TraceEntryInput {
  slaveId: string
  conversationId?: string | null
  method: string
  paramsJson?: string | null
  resultJson?: string | null
  durationMs?: number | null
  error?: string | null
}

// ── Harness Command Registry (017-harness-command-registry) ──
export interface HarnessCommandRow {
  id: string
  commandId: string
  version: string
  kind: string
  paramsSchemaJson: string
  adaptorRef: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface ProviderFleetConfig {
  channel?: string
  mode?: string
  extraArgs?: string[]
  portRange?: [number, number]
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface GovernorStore {
  getAccount(accountId: string): Promise<ProviderAccountRow | null>
  getAccountsByProvider(providerId: string): Promise<ProviderAccountRow[]>
  upsertAccount(account: ProviderAccountRow): Promise<void>
  deleteAccount(accountId: string): Promise<void>
  createFleetEvent(event: FleetEventInput): Promise<FleetEventRow>
  getFleetEvents(slaveId: string, limit?: number): Promise<FleetEventRow[]>
  getCircuitState(slaveId: string): Promise<CircuitBreakerStateRow | null>
  upsertCircuitState(state: CircuitBreakerStateRow): Promise<void>
  createHealthTick(tick: Omit<HealthTickRow, 'id'>): Promise<HealthTickRow>
  createTraceEntry(entry: TraceEntryInput): Promise<TraceEntryRow>
  getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]>
  getProviderFleetConfig(providerSlug: string): Promise<ProviderFleetConfig | null>
  getHarnessCommand(commandId: string, version: string): Promise<HarnessCommandRow | null>
  listHarnessCommands(commandId: string): Promise<HarnessCommandRow[]>
  upsertHarnessCommand(cmd: HarnessCommandRow): Promise<void>
}
```

## src/storage/contracts/harness-repair-store.ts

```ts
// src/storage/contracts/harness-repair-store.ts
// Store contract for the harness repair engine (FR-006).
// Engine depends on this interface, never on src/storage/impl/* (Store Contracts).

export interface RepairSessionRow {
  id: string
  conversationId?: string | null
  commandId?: string | null
  originalContent: string
  repairedContent?: string | null
  strategy: string
  success: boolean
  errorsJson: string
  repairsJson: string
  createdAt: number
}

export interface HarnessRepairStore {
  saveRepairSession(row: RepairSessionRow): Promise<void>
  getRepairSession(id: string): Promise<RepairSessionRow | null>
}
```

## src/storage/contracts/health-digest-store.ts

```ts
// src/storage/contracts/health-digest-store.ts
// HealthDigestStore — persistence contract for daily system-health digests (Unit 35.1)

export interface HealthDigestRow {
  id: string
  day: string // YYYY-MM-DD (UTC)
  markdown: string
  metricsJson: string
  createdAt: number
}

export interface HealthDigestStore {
  getByDay(day: string): Promise<HealthDigestRow | null>
  save(row: HealthDigestRow): Promise<void>
  listRecent(limit?: number): Promise<HealthDigestRow[]>
}
```

## src/storage/contracts/health-store.ts

```ts
// src/storage/contracts/health-store.ts
// HealthStore — data access contract for ProviderHealthKernel.

import type { ProviderHealthReport } from '../../schema/health.js'
import type { HealthHistoryRow } from '../../schema/types.js'
import type { CircuitBreakerStateRow } from './governor-store.js'

// ── Row types ──────────────────────────────────────────────────────────────

export interface DriftEvent {
  id: string
  providerId: string
  capabilityId: string | null
  bindingId: string | null
  driftType: string
  severity: string
  description: string | null
  resolved: number
  detectedAt: number
  resolvedAt: number | null
}

// Per-capability health signal source (provider_capability ⋈ capability_binding).
// Feeds the ProviderHealthKernel parser-confidence, selector-hit-rate, and
// capabilities signals (04-merged-engines.md §8 weighting model).
export interface CapabilityHealthRow {
  capabilityId: string
  confidence: number
  selectorHitCount: number
  selectorMissCount: number
  bindingStatus: string
}

// 1h execution window source (capability_telemetry). Feeds the kernel's
// "parser empty streams (1h)" signal — the §8 weighting model names this
// `parser_health` but the real 1h window data lives in capability_telemetry.
export interface ParserWindowRow {
  capabilityId: string
  window1hExecutions: number
  window1hSuccessCount: number
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface HealthStore {
  getCircuitStates(providerId: string): Promise<CircuitBreakerStateRow[]>
  getRecentDrifts(providerId: string, windowMs: number): Promise<DriftEvent[]>
  upsertProviderHealth(report: ProviderHealthReport): Promise<void>
  getProviderHealth(providerId: string): Promise<ProviderHealthReport | null>
  getHealthHistory(providerId: string, limit?: number): Promise<HealthHistoryRow[]>
  getActiveProviders(): Promise<string[]>
  // Extended signal sources (see DRIFT note in docs/atomic/PROGRESS.md, unit 4.4):
  // the §8 store contract is under-specified vs its own weighting model.
  getCapabilityHealth(providerId: string): Promise<CapabilityHealthRow[]>
  getParserWindows(providerId: string): Promise<ParserWindowRow[]>
}

export type { CircuitBreakerStateRow, HealthHistoryRow, ProviderHealthReport }
```

## src/storage/contracts/hpe-session-store.ts

```ts
// src/storage/contracts/hpe-session-store.ts
// HPE session store contract — persistence for HarnessProtocolEngine sessions

export interface HpeSession {
  id: string
  agentId: string
  prompt: string
  response?: string
  actions: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  startedAt: number
  completedAt?: number
}

export interface HpeSessionStoreContract {
  save(session: HpeSession): Promise<void>
  findById(id: string): Promise<HpeSession | null>
  findByAgent(agentId: string, limit?: number): Promise<HpeSession[]>
  updateStatus(id: string, status: HpeSession['status']): Promise<void>
}
```

## src/storage/contracts/intent-template-store.ts

```ts
// src/storage/contracts/intent-template-store.ts
// Unit 3.1 — IntentTemplateStore contract (Store Contract, not impl).
//
// Owns the intent_template catalog so the IntentDecomposer engine never depends on a
// concrete storage impl. Types are self-contained (no engine imports) to honour the
// Store Contract layering.

import type { IntentTemplate } from '../../engines/intent-decomposer.js'

export interface IntentTemplateStore {
  listTemplates(): Promise<IntentTemplate[]>
  getTemplate(id: string): Promise<IntentTemplate | null>
  upsertTemplate(tpl: IntentTemplate): Promise<IntentTemplate>
}
```

## src/storage/contracts/kernel-store.ts

```ts
export interface TraceSpan {
  id: string
  traceId: string
  parentId: string | null
  name: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'ok' | 'error' | 'timeout'
  error?: string
  attrs: Record<string, unknown>
  engineId?: string
}

export interface CausalNode {
  id: string
  traceId: string
  parentId: string | null
  kind: 'selector' | 'parser' | 'result' | 'action' | 'error' | 'decision'
  engineId: string
  description: string
  input: unknown
  output: unknown
  duration?: number
  timestamp: number
}

export interface SystemTopology {
  engines: EngineDescriptor[]
  stores: StoreDescriptor[]
  capabilities: CapabilityDescriptor[]
  routes: RouteDescriptor[]
  timestamp: number
}

export interface EngineDescriptor {
  id: string
  kind: 'engine' | 'store' | 'capability' | 'route' | 'surface'
  layer?: string
  dependencies: string[]
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  health?: HealthState
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

export interface HealthState {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  score?: number
  lastCheck: number
  details?: Record<string, unknown>
}

export interface StoreDescriptor {
  id: string
  kind: 'store'
  layer?: string
  dependencies: string[]
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

export interface CapabilityDescriptor {
  id: string
  kind: 'capability'
  layer?: string
  dependencies: string[]
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

export interface RouteDescriptor {
  id: string
  kind: 'route'
  layer?: string
  dependencies: string[]
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

export interface SystemEvent {
  id: number
  kind: string
  engineId: string | null
  data: unknown
  createdAt: number
}

export interface KernelStore {
  batchInsertSpans(spans: Omit<TraceSpan, 'id'>[]): Promise<void>
  querySpans(traceId: string): Promise<TraceSpan[]>
  queryRecentSpans(limit: number): Promise<TraceSpan[]>
  querySpansByEngine(engineId: string, limit: number): Promise<TraceSpan[]>

  insertProvenanceNode(node: Omit<CausalNode, 'id' | 'timestamp'>): Promise<string>
  queryProvenanceByTrace(traceId: string): Promise<CausalNode[]>
  queryProvenanceByEngine(engineId: string, limit: number): Promise<CausalNode[]>
  queryProvenanceByKind(kind: string, limit: number): Promise<CausalNode[]>

  saveTopology(snapshot: SystemTopology): Promise<void>
  getLastTopology(): Promise<SystemTopology | null>

  upsertEngine(desc: EngineDescriptor): Promise<void>
  upsertStore(desc: StoreDescriptor): Promise<void>
  upsertCapability(desc: CapabilityDescriptor): Promise<void>
  getEngine(id: string): Promise<EngineDescriptor | null>
  listEngines(filter?: { layer?: string; kind?: string; status?: string }): Promise<
    EngineDescriptor[]
  >

  insertEvent(kind: string, engineId: string | null, data: unknown): Promise<void>
  queryRecentEvents(limit: number): Promise<SystemEvent[]>
}
```

## src/storage/contracts/knowledge-extractor-store.ts

```ts
// src/storage/contracts/knowledge-extractor-store.ts
// KnowledgeExtractorStore — data access contract for KnowledgeExtractor.
// Full implementation in unit 15.5; forward declaration for 15.1 dependency.

export interface KnowledgeExtractorStore {
  createEntity(input: {
    id: string
    name: string
    type: string
    description: string | null
    confidence: number
    firstSeenAt: number
    lastSeenAt: number
  }): Promise<void>
  updateEntity(id: string, patch: { confidence?: number; lastSeenAt?: number }): Promise<void>
  findEntityByName(
    name: string,
    type: string,
  ): Promise<{ id: string; name: string; type: string } | null>
  createEntityMention(input: {
    id: string
    entityId: string
    conversationId: string
    messageId: string
    context: string
    confidence: number
    ts: number
  }): Promise<void>
  createDecision(input: {
    id: string
    conversationId: string
    messageId: string
    decisionText: string
    rationale: string | null
    alternatives: string
    confidence: number
    ts: number
  }): Promise<void>
  createPattern(input: {
    id: string
    name: string
    description: string
    patternType: string
    occurrences: number
    confidence: number
    firstSeenAt: number
    lastSeenAt: number
  }): Promise<void>
  updatePattern(
    id: string,
    patch: { occurrences?: number; confidence?: number; lastSeenAt?: number },
  ): Promise<void>
  findPattern(name: string): Promise<{ id: string; name: string } | null>
  assertSemanticMemory(input: {
    id: string
    subject: string
    predicate: string
    objectJson: string
    confidence: number
    source: string
    timestamp: number
    expiresAt: number | null
  }): Promise<void>
}
```

## src/storage/contracts/knowledge-ingestion-store.ts

```ts
// src/storage/contracts/knowledge-ingestion-store.ts
// KnowledgeIngestionStore — data access contract for KnowledgeIngestionEngine.

export interface KnowledgeIngestionStore {
  createImportJob(job: {
    id: string
    source: string
    filePath: string
    status: string
    configJson: string
    startedAt: number
  }): Promise<void>
  updateImportJob(
    id: string,
    patch: {
      status?: string
      resultJson?: string
      completedAt?: number
      error?: string
    },
  ): Promise<void>
  getImportJob(id: string): Promise<{
    id: string
    source: string
    filePath: string
    status: string
    configJson: string
    resultJson: string | null
    startedAt: number
    completedAt: number | null
  } | null>
  listImportJobs(opts?: { limit?: number }): Promise<
    Array<{
      id: string
      source: string
      status: string
      startedAt: number
      completedAt: number | null
    }>
  >
  findExistingConversation(sourceProviderId: string, externalId: string): Promise<string | null>
}
```

## src/storage/contracts/local-agent-store.ts

```ts
// src/storage/contracts/local-agent-store.ts
// LocalAgentStore contract — engine-facing storage for the `local-agent` provider.
// Engines depend on this interface (Store Contracts invariant), never on Prisma directly.

import type { ContentBlock } from '../../schema/streaming.js'

export interface LocalAgentModelRow {
  slug: string
  displayName: string
  isDefault: boolean
  contextWindow?: number | null
  maxOutputTokens?: number | null
  pricingInputPer1m?: number | null
  pricingOutputPer1m?: number | null
}

export interface AgentModelSyncResult {
  added: string[]
  removed: string[]
  kept: string[]
  defaultModel: string
}

export interface AgentModelSyncState {
  lastSyncedAt: number | null
}

export interface LocalAgentProviderRow {
  slug: string
  displayName: string
  authType: 'none'
  models: LocalAgentModelRow[]
}

export interface LocalAgentConfig {
  binary: string
  timeoutMs: number
  allowedModels: string[]
  defaultModel: string
}

export interface LocalAgentStore {
  /** Load the seeded `local-agent` provider (slug `opencode`) + its models. */
  getAgentProvider(slug: string): Promise<LocalAgentProviderRow | null>

  /** Runtime config (binary, timeout, allow-list). */
  getAgentConfig(slug: string): Promise<LocalAgentConfig | null>

  /** Upsert provider + model rows from the seed manifest (idempotent). */
  upsertAgentProvider(row: LocalAgentProviderRow, config: LocalAgentConfig): Promise<void>

  /**
   * Replace the verified allow-list with the latest models discovered from the
   * opencode CLI. Upserts every incoming model, deactivates models no longer
   * present, preserves the current default when it still exists, and records the
   * sync timestamp.
   */
  syncAgentModels(
    slug: string,
    models: LocalAgentModelRow[],
    opts?: { defaultModel?: string },
  ): Promise<AgentModelSyncResult>

  /** Set which allowed model is the active default. */
  setAgentDefaultModel(slug: string, modelSlug: string): Promise<void>

  /** Last successful model sync timestamp (from provider_config), or null. */
  getAgentModelSyncState(slug: string): Promise<AgentModelSyncState>

  /** True if `model` is in the verified allow-list for `slug`. */
  isModelAllowed(slug: string, model: string): Promise<boolean>
}

export type { ContentBlock }
```

## src/storage/contracts/memory-curated-store.ts

```ts
export type CurationAction = 'pin' | 'hide' | 'merge'

export interface MemoryCuratedRow {
  id: string
  memoryType: string
  memoryId: string
  isPinned: boolean
  isVerified: boolean
  note: string | null
}

export interface MemoryCuratedStore {
  upsert(row: MemoryCuratedRow): Promise<void>
  setPinned(memoryType: string, memoryId: string, pinned: boolean): Promise<void>
  setVerified(memoryType: string, memoryId: string, verified: boolean): Promise<void>
  list(memoryType?: string): Promise<MemoryCuratedRow[]>
}
```

## src/storage/contracts/memory-intelligence-store.ts

```ts
// src/storage/contracts/memory-intelligence-store.ts
// Contract interface for memory intelligence storage.
// Engines depend on this; implementations live in storage/impl/.

import type {
  DecisionRecordRow,
  EntityMentionRow,
  EntityRow,
  PatternExtractRow,
  ProjectRow,
  TopicRow,
} from '../impl/memory-intelligence-store-impl.js'

export type {
  DecisionRecordRow,
  EntityMentionRow,
  EntityRow,
  PatternExtractRow,
  ProjectRow,
  TopicRow,
}

export interface MemoryIntelligenceStore {
  // Entity
  findByName(name: string): Promise<EntityRow | null>
  createEntity(input: {
    name: string
    type: string
    description?: string
    confidence?: number
  }): Promise<EntityRow>
  incrementMentionCount(id: string): Promise<void>
  createEntityMention(input: {
    entityId: string
    conversationId: string
    messageId: string
    context: string
  }): Promise<EntityMentionRow>

  // Decision
  createDecisionRecord(input: {
    conversationId: string
    messageId: string
    decisionText: string
    rationale?: string
    alternatives?: string[]
  }): Promise<DecisionRecordRow>

  // Pattern
  listPatternExtracts(filter: { patternType?: string; limit?: number }): Promise<
    PatternExtractRow[]
  >
  incrementOccurrences(id: string): Promise<void>
  createPatternExtract(input: {
    name: string
    description: string
    patternType: string
  }): Promise<PatternExtractRow>

  // Topic
  listTopics(): Promise<TopicRow[]>

  // Project
  listProjects(): Promise<ProjectRow[]>

  // Conversation assignment
  assignConversation(
    conversationId: string,
    topicId: string,
    assignmentType?: string,
    confidence?: number,
  ): Promise<void>
}
```

## src/storage/contracts/mirror-store.ts

```ts
// src/storage/contracts/mirror-store.ts
// MirrorStore — re-exports the contract defined in mirror-engine.ts

export type {
  MirrorStore,
  MirrorStateRow,
  MirrorStateInput,
  OptimisticUpdateRow,
  OptimisticUpdateInput,
  LatencyMeasurementInput,
  LatencyReport,
  SnapshotRow,
  SnapshotInput,
} from '../../engines/mirror-engine.js'
```

## src/storage/contracts/mux-store.ts

```ts
// src/storage/contracts/mux-store.ts
// MuxStore — re-exports the contract defined in provider-mux.ts

export type {
  MuxStore,
  MuxSessionInput,
  MuxSessionRow,
  MuxResponseInput,
  MuxResponseRow,
  RoutingPreferenceInput,
  RoutingPreferenceRow,
} from '../../engines/provider-mux.js'
```

## src/storage/contracts/node-store.ts

```ts
// src/storage/contracts/node-store.ts
// NodeStore contract — universal persistence for every piece of data in the
// second brain. Every node type (message, email, document, contact, task,
// event, media, social post, financial, ...) is stored here. parentId enables
// forking; rawSource preserves the original payload for remux; schemaVersion +
// immutable ids enable local time travel.

import type { Edge, NodeBase, NodeType } from '../../schema/node.js'

export interface NodeRow {
  id: string
  type: string
  parentId: string | null
  schemaVersion: number
  rawSource: string | null
  dataJson: string
  edgesJson: string
  metaJson: string
  searchText: string
  conversationId: string | null
  messageId: string | null
  sourceParser: string | null
  // ── Node-layer v2: ACU-proven fields ──
  contentHash: string | null
  version: number
  state: string
  securityLevel: number | null
  contentType: string | null
  authorDid: string | null
  signature: string | null
  aclJson: string
  qualityJson: string
  validFrom: number | null
  validUntil: number | null
  parentVersion: number | null
  // ── ACU fields (Phase 0 — doc 00 §9) ──
  acuType: string | null
  lineageKind: string | null
  extractorVersion: string | null
  parserVersion: string | null
  valueScore: number | null
  isHighValue: number
  createdAt: number
  updatedAt: number
}

export interface NodeVersionRow {
  id: string
  nodeId: string
  version: number
  hash: string
  contentRef: string
  op: string
  parentVersion: number | null
  createdAt: number
}

export interface NodeAliasRow {
  id: string
  aliasId: string
  canonicalId: string
  method: string
  confidence: number
  createdAt: number
}

export interface NodeQueryOpts {
  type?: NodeType | string
  parentId?: string
  conversationId?: string
  messageId?: string
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

export interface NodeStoreContract {
  // Persist a node (insert). Never updates an existing id — ids are immutable.
  putNode(node: NodeBase): Promise<void>
  // Fetch a node by id (the canonical, immutable record).
  getNode(id: string): Promise<NodeRow | null>
  // List nodes matching filters (time-ordered for travel/replay).
  listNodes(opts?: NodeQueryOpts): Promise<NodeRow[]>
  // Direct children of a node (fork chain).
  getChildren(id: string): Promise<NodeRow[]>
  // History of a node's lineage: the node + all ancestors via parentId.
  getLineage(id: string): Promise<NodeRow[]>
  // Re-parse support: fetch the rawSource of a node for remux.
  getRawSource(id: string): Promise<string | null>
  // Edge graph operations.
  putEdge(edge: {
    id: string
    sourceId: string
    targetId: string
    edgeType: string
    label?: string
    properties?: Record<string, unknown>
    createdAt: number
  }): Promise<void>
  getOutgoingEdges(sourceId: string): Promise<Edge[]>
  getIncomingEdges(targetId: string): Promise<Edge[]>
  // Count of all stored nodes (compliance / coverage reporting).
  countNodes(): Promise<number>

  // ── Node-layer v2: version chain (time travel) ──
  // Update an existing node, bumping its version and writing a NodeVersion entry.
  updateNode(
    id: string,
    patch: Partial<
      Pick<
        NodeRow,
        | 'dataJson'
        | 'edgesJson'
        | 'metaJson'
        | 'searchText'
        | 'state'
        | 'contentHash'
        | 'aclJson'
        | 'qualityJson'
        | 'validUntil'
        | 'securityLevel'
        | 'contentType'
        | 'authorDid'
        | 'signature'
      >
    >,
  ): Promise<void>
  // Point-in-time read of a node at a specific version.
  getNodeAtVersion(nodeId: string, version: number): Promise<NodeVersionRow | null>
  // Full version history of a node (oldest → newest).
  getNodeHistory(nodeId: string): Promise<NodeVersionRow[]>

  // ── Node-layer v2: alias → canonical resolution (entity merge) ──
  registerAlias(
    aliasId: string,
    canonicalId: string,
    method: string,
    confidence?: number,
  ): Promise<void>
  resolveAlias(aliasId: string): Promise<string | null>

  // ── Node-layer v2: rebuildable graph (OG ADR-001) ──
  // Rebuild the materialized edge + node_graph from the current node set.
  // Returns the count of edges (re)materialized.
  rebuildGraphFromNodes(): Promise<number>
}
```

## src/storage/contracts/organization-store.ts

```ts
// src/storage/contracts/organization-store.ts
// OrganizationStore — persistence contract for ConversationOrganizer.

export interface Project {
  id: string
  name: string
  description: string
  createdAt: number
}

export interface Topic {
  id: string
  name: string
  description: string
  projectId: string | null
  createdAt: number
}

export interface ConversationTreeNode {
  id: string
  name: string
  type: 'project' | 'topic' | 'conversation'
  children: ConversationTreeNode[]
}

export interface OrganizationStore {
  createProject(project: Project): Promise<void>
  createTopic(topic: Topic): Promise<void>
  getProjects(): Promise<Project[]>
  getTopics(projectId?: string): Promise<Topic[]>
  assignConversationToProject(conversationId: string, projectId: string): Promise<void>
  assignConversationToTopic(conversationId: string, topicId: string): Promise<void>
  getConversationsByProject(projectId: string): Promise<Array<{ id: string; title: string | null }>>
  getConversationsByTopic(topicId: string): Promise<Array<{ id: string; title: string | null }>>
}
```

## src/storage/contracts/parser-execution-log-store.ts

```ts
// src/storage/contracts/parser-execution-log-store.ts
// ParserExecutionLogStore — persistence contract for parser diagnostic logging.
// Every parse() call is recorded for confidence tracking, repair triggers, and analysis.

export interface ParserExecutionLogRow {
  id: string
  providerId: string
  parserName: string
  parserVersion: number
  conversationId: string | null
  messageId: string | null
  confidence: number
  blockCount: number
  textBlocks: number
  toolCallBlocks: number
  fileBlocks: number
  errorBlocks: number
  durationMs: number
  rawSizeBytes: number
  wireFormat: string | null
  fallbackUsed: number
  metadataJson: string
  createdAt: number
}

export interface ParserExecutionLogStore {
  logExecution(row: Omit<ParserExecutionLogRow, 'id' | 'createdAt'>): Promise<void>
  getRecentByProvider(providerId: string, limit?: number): Promise<ParserExecutionLogRow[]>
  getLowConfidenceEntries(threshold?: number, limit?: number): Promise<ParserExecutionLogRow[]>
  getStatsByProvider(providerId: string): Promise<{
    totalExecutions: number
    avgConfidence: number
    avgDurationMs: number
    fallbackRate: number
  } | null>
}
```

## src/storage/contracts/parser-store.ts

```ts
// src/storage/contracts/parser-store.ts
// ParserStore — persistence contract for StreamParserEngine (04-merged-engines.md §3).
// All parser logic lives in DB — engine is a loader/executor, not a parser repository.

export interface ProviderParserRow {
  id: string
  providerId: string
  name: string
  version: number
  logicType: string // 'file' | 'inline' | 'composed'
  filePath: string | null
  logicCode: string | null // Inline TypeScript/JavaScript for DB-driven loading
  hash: string
  sampleBody: string | null // Representative wire-format sample for testing
  isActive: number
  fallbackParserId: string | null
  createdAt: number
  updatedAt: number
}

export interface ParserStore {
  getParser(providerId: string): Promise<ProviderParserRow | null>
  getActiveParser(providerId: string): Promise<ProviderParserRow | null>
  // By-need resolution: providerId@version (semver) or @latest. Returns the
  // active row matching the resolved version, or the highest version when
  // `version` is omitted/'latest'. The engine walks fallbackParserId from here.
  getParserByProviderAndVersion(
    providerId: string,
    version?: string,
  ): Promise<ProviderParserRow | null>
  // Resolve a single parser row by its primary id (used to follow the
  // fallbackParserId edge without re-querying by provider).
  getParserById(id: string): Promise<ProviderParserRow | null>
  upsertParser(parser: ProviderParserRow): Promise<void>
  listParsers(providerId: string): Promise<ProviderParserRow[]>
  getParserByFile(filePath: string): Promise<ProviderParserRow | null>
  getParserByHash(hash: string): Promise<ProviderParserRow | null>

  // DB-only fallback chain — generic/system are ordinary rows reached via the
  // fallbackParserId edge (no hardcoded tiers in the engine).
  getGenericParser(): Promise<ProviderParserRow | null>
  getSystemFallbackParser(): Promise<ProviderParserRow | null>
}
```

## src/storage/contracts/primitive-store.ts

```ts
// src/storage/contracts/primitive-store.ts
// PrimitiveStore — persistence contract for the closed UI-vocabulary rows.
// A Primitive is declared once per (scope, owner, id); UiComponents reference it.

import type { Primitive, PrimitiveRow, PrimitiveScope } from 'shared/conceptual-model.js'

export type { Primitive, PrimitiveRow, PrimitiveScope }

export interface PrimitiveInput {
  id: string
  scope: PrimitiveScope
  familyId?: string | null
  providerId?: string | null
  label: string
  description?: string | null
  defaultRegion: { x: number; y: number; w: number; h: number }
  version?: number
}

export interface PrimitiveStore {
  create(input: PrimitiveInput): Promise<PrimitiveRow>
  get(id: string): Promise<PrimitiveRow | null>
  /** All primitives for a family (scope='family' + its cross-type globals). */
  listByFamily(familyId: string): Promise<PrimitiveRow[]>
  listByProvider(providerId: string): Promise<PrimitiveRow[]>
  listByScope(scope: PrimitiveScope): Promise<PrimitiveRow[]>
  update(id: string, patch: Partial<Omit<PrimitiveInput, 'id'>>): Promise<PrimitiveRow>
  delete(id: string): Promise<void>
  listDomains(): Promise<Primitive[]>
}
```

## src/storage/contracts/program-store.ts

```ts
// src/storage/contracts/program-store.ts
// Unit 22.2 - Program store contract (Store Contract, not impl).
// Owns the binding<->program link so we never mutate CapabilityBindingRow's
// Prisma-backed shape. Engines depend on this contract only. Types are kept
// self-contained here (no engine imports) to honour the Store Contract layering.

import type { CapabilityProgramRow } from './capability-store.js'

export type ProgramStatus = 'draft' | 'candidate' | 'promoted' | 'failed'

/** Composer element strategy; mirrors engines/composer-typing ComposerType. */
export type ComposerType = 'textarea' | 'contenteditable' | 'quill' | 'codemirror'

export type RecipeStep =
  | {
      kind: 'type_text'
      selector?: string
      text: string
      composerType?: ComposerType
      outputKey?: string
    }
  | { kind: 'submit'; sendSelector?: string; outputKey?: string }
  | { kind: 'click'; selector: string; outputKey?: string }
  | { kind: 'wait'; timeoutMs: number; outputKey?: string }
  | { kind: 'navigate'; url: string; outputKey?: string }
  | { kind: 'capture'; pattern?: string; timeoutMs?: number; outputKey?: string }
  | { kind: 'evaluate'; expression: string; outputKey?: string }
  // ── Extended browser-automation vocabulary (100+ capability backbone) ──
  | { kind: 'scroll'; x?: number; y?: number; selector?: string; outputKey?: string }
  | { kind: 'hover'; selector: string; outputKey?: string }
  | { kind: 'select'; selector: string; value?: string; label?: string; outputKey?: string }
  | { kind: 'press'; key: string; outputKey?: string }
  | { kind: 'tab_open'; url?: string; outputKey?: string }
  | { kind: 'tab_close'; targetId?: string; outputKey?: string }
  | { kind: 'tab_switch'; targetId: string; outputKey?: string }
  | {
      kind: 'observe'
      what: 'dom' | 'a11y' | 'network' | 'console' | 'screenshot'
      outputKey?: string
    }
  | { kind: 'upload'; selector: string; files: string[]; outputKey?: string }
  | { kind: 'extract_markdown'; outputKey?: string }
  | { kind: 'wait_selector'; selector: string; timeoutMs?: number; outputKey?: string }
  | { kind: 'wait_text'; text: string; timeoutMs?: number; outputKey?: string }
  | {
      kind: 'screenshot'
      region?: { x: number; y: number; w: number; h: number }
      outputKey?: string
    }
  | { kind: 'assert'; condition: string; outputKey?: string }
  | { kind: 'branch_if'; condition: string; then: RecipeStep[]; outputKey?: string }
  | { kind: 'loop_while'; condition: string; body: RecipeStep[]; max?: number; outputKey?: string }
  | { kind: 'parallel'; branches: RecipeStep[][]; outputKey?: string }
  | { kind: 'human_gate'; prompt?: string; outputKey?: string }
  | { kind: 'mock_request'; urlPattern: string; body: string; status?: number; outputKey?: string }
  | { kind: 'cookie_set'; name: string; value: string; path?: string; outputKey?: string }

export interface RecipeBranch {
  when: { outputKey: string; equals?: string; truthy?: boolean }
  steps: RecipeStep[]
}

export interface Recipe {
  id: string
  providerId: string
  capabilitySlug: string
  version: number
  description?: string
  steps: RecipeStep[]
  branches?: RecipeBranch[]
  timeoutMs?: number
  tags?: string[]
}

export interface ProgramUpsert {
  bindingId: string
  version: number
  status: ProgramStatus
  recipe: Recipe
}

export interface ProgramStore {
  upsertProgram(input: ProgramUpsert): Promise<CapabilityProgramRow>
  getProgramById(programId: string): Promise<CapabilityProgramRow | null>
  getPrograms(bindingId: string): Promise<CapabilityProgramRow[]>
  getBestProgram(bindingId: string): Promise<CapabilityProgramRow | null>
  setBestProgram(bindingId: string, programId: string): Promise<void>
  getBestProgramByCapability(
    capabilitySlug: string,
    providerId: string,
  ): Promise<CapabilityProgramRow | null>
}
```

## src/storage/contracts/provider-store.ts

```ts
// src/storage/contracts/provider-store.ts
// ProviderStore contract — defines the data access interface for ProviderRegistrar.
// Implementation is provided by Prisma-based storage in src/storage/impl/.

import type {
  ProviderCapabilityRow,
  ProviderConfigRow,
  ProviderDefinitionRow,
  ProviderEndpointRow,
  ProviderModelRow,
  ProviderParserRow,
  ProviderStreamConfigRow,
} from '../../schema/types.js'

export interface ProviderStore {
  upsertDefinition(def: ProviderDefinitionRow): Promise<void>
  upsertEndpoint(endpoint: ProviderEndpointRow): Promise<void>
  upsertParser(parser: ProviderParserRow): Promise<void>
  setParserFallback(parserId: string, fallbackParserId: string): Promise<void>
  upsertStreamConfig(config: ProviderStreamConfigRow): Promise<void>
  upsertCapability(cap: ProviderCapabilityRow): Promise<void>
  upsertConfig(config: ProviderConfigRow): Promise<void>
  upsertModel(model: ProviderModelRow): Promise<void>
  deleteProviderEndpoints(providerId: string): Promise<void>
  deleteProviderParsers(providerId: string): Promise<void>
  deleteProviderCapabilities(providerId: string): Promise<void>
  deleteProviderConfigs(providerId: string): Promise<void>
  deleteProviderModels(providerId: string): Promise<void>
  getDefinition(id: string): Promise<ProviderDefinitionRow | null>
  getDefinitionBySlug(slug: string): Promise<ProviderDefinitionRow | null>
  listDefinitions(opts?: { isActive?: boolean }): Promise<ProviderDefinitionRow[]>

  // ── 1.3 Provider Taxonomy Layer ────────────────────────────────────────────
  registerCapability(input: {
    providerId: string
    slug: string
    title: string
    description?: string
    category?: string
    intent?: string
    selector?: string
    version?: string
  }): Promise<{ id: string }>
  overrideCapability(input: {
    providerId: string
    capabilityId: string
    overrideType: string
    overrideJson: string
  }): Promise<void>
  listCapabilities(
    providerId: string,
  ): Promise<
    Array<{ id: string; slug: string; title: string; description?: string; version?: string }>
  >

  // ── Selector heal persistence ───────────────────────────────────────────
  // Persists dynamically healed selectors as capability overrides so they
  // survive app restarts. The override type is 'selector_healed' and the
  // overrideJson contains the healed SemanticSelector.
  getCapabilityOverride(
    providerId: string,
    capabilityId: string,
    overrideType: string,
  ): Promise<{ overrideJson: string } | null>
}
```

## src/storage/contracts/provider-type-store.ts

```ts
// src/storage/contracts/provider-type-store.ts
// ProviderTypeStore — persistence contract for provider-type (family) rows.
// Engines depend on this interface, never on an impl.

import type { ProviderType, ProviderTypeRow } from 'shared/conceptual-model.js'

export type { ProviderType, ProviderTypeRow }

export interface ProviderTypeInput {
  id: string
  slug: string
  displayName: string
  description?: string | null
  slotCatalog: string[]
  regionLayout: Record<string, { x: number; y: number; w: number; h: number }>
  interactionGrammar: Record<string, unknown>
  basePrimitive?: string
  version?: number
}

export interface ProviderTypeStore {
  create(input: ProviderTypeInput): Promise<ProviderTypeRow>
  get(id: string): Promise<ProviderTypeRow | null>
  getBySlug(slug: string): Promise<ProviderTypeRow | null>
  list(): Promise<ProviderTypeRow[]>
  update(id: string, patch: Partial<Omit<ProviderTypeInput, 'id'>>): Promise<ProviderTypeRow>
  delete(id: string): Promise<void>
  /** Domain helper: load all families as typed objects. */
  listDomains(): Promise<ProviderType[]>
}
```

## src/storage/contracts/registration-store.ts

```ts
// src/storage/contracts/registration-store.ts
// Store contract for RegistrationAuditor — manifest versions, events, drifts.

import type {
  ManifestDriftInput,
  ManifestDriftRow,
  ManifestVersionInput,
  ProviderManifestVersionRow,
  RegistrationEventInput,
  RegistrationEventRow,
} from '../../schema/types.js'

export interface RegistrationStore {
  createManifestVersion(input: ManifestVersionInput): Promise<ProviderManifestVersionRow>
  getLatestManifestVersion(
    providerId: string,
    file: string,
  ): Promise<ProviderManifestVersionRow | null>
  getManifestVersionHistory(
    providerId: string,
    limit?: number,
  ): Promise<ProviderManifestVersionRow[]>
  createRegistrationEvent(input: RegistrationEventInput): Promise<RegistrationEventRow>
  getRegistrationEvents(
    providerId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<RegistrationEventRow[]>
  getRegistrationEventsByTable(
    table: string,
    opts?: { limit?: number },
  ): Promise<RegistrationEventRow[]>
  createManifestDrift(drift: ManifestDriftInput): Promise<ManifestDriftRow>
  getUnresolvedDrifts(providerId: string): Promise<ManifestDriftRow[]>
  resolveDrift(driftId: string, actor: string): Promise<void>
  getDriftHistory(providerId: string, limit?: number): Promise<ManifestDriftRow[]>
}
```

## src/storage/contracts/router-store.ts

```ts
// src/storage/contracts/router-store.ts
// Contract: CRUD + query for Route (multi-provider dispatch) rows.

import type {
  RouteEventRow,
  RouteRequestRow,
  RouteSpecRow,
  RouteTargetRow,
} from '../../schema/types.js'

export interface RouterStore {
  listSpecs(opts?: { providerId?: string; capabilityId?: string; activeOnly?: boolean }): Promise<
    RouteSpecRow[]
  >
  getSpec(id: string): Promise<RouteSpecRow | null>
  createSpec(input: RouteSpecRow): Promise<RouteSpecRow>
  updateSpec(id: string, patch: Partial<RouteSpecRow>): Promise<void>
  deleteSpec(id: string): Promise<void>
  listTargets(specId: string): Promise<RouteTargetRow[]>
  createTarget(input: RouteTargetRow): Promise<RouteTargetRow>
  updateTarget(id: string, patch: Partial<RouteTargetRow>): Promise<void>
  createRequest(input: RouteRequestRow): Promise<RouteRequestRow>
  updateRequest(id: string, patch: Partial<RouteRequestRow>): Promise<void>
  createEvent(input: RouteEventRow): Promise<RouteEventRow>
  listRequests(
    specId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<RouteRequestRow[]>
  listEvents(requestId: string): Promise<RouteEventRow[]>
}
```

## src/storage/contracts/sandbox-audit-store.ts

```ts
import type { SandboxPermissions } from '../../engines/sandbox-runner.js'

export interface SandboxAuditRow {
  id: string
  handlerSlug: string
  ok: boolean
  error: string | null
  permissions: SandboxPermissions
  ts: number
}

export interface SandboxAuditStore {
  create(row: SandboxAuditRow): Promise<void>
  list(limit?: number): Promise<SandboxAuditRow[]>
}
```

## src/storage/contracts/selector-heal-store.ts

```ts
// src/storage/contracts/selector-heal-store.ts
// Store Contract for persisted selector strategies (SelectorHealer audit trail).
// Engines depend on this contract only (never the impl).

export interface SelectorStrategyRow {
  id: string
  /** The logical capability target key (e.g. "github:submit" or sha of selector). */
  targetKey: string
  /** Final working selector format. */
  selectorFormat: string
  /** Mode that produced it (aria|css|text|xpath|healed...). */
  mode: string
  /** Free-form semantic metadata (original description, last url). */
  semanticData: Record<string, unknown>
  /** How many times this selector was repaired. */
  healCount: number
  lastUsed: number
  createdAt: number
}

export interface SelectorHealStore {
  upsertStrategy(input: {
    targetKey: string
    selectorFormat: string
    mode: string
    semanticData?: Record<string, unknown>
  }): Promise<SelectorStrategyRow>
  getStrategy(targetKey: string): Promise<SelectorStrategyRow | null>
  bumpHealCount(targetKey: string): Promise<void>
  recordUse(targetKey: string): Promise<void>
}
```

## src/storage/contracts/semantic-search-store.ts

```ts
// src/storage/contracts/semantic-search-store.ts
// SemanticSearchStore — data access for embeddings.

export interface SemanticSearchStore {
  upsertEmbedding(input: {
    id: string
    entityType: string
    entityId: string
    embedding: string
    model: string
    dimensions: number
    contentHash: string
    createdAt: number
  }): Promise<void>
  getEmbedding(
    entityType: string,
    entityId: string,
  ): Promise<{
    id: string
    embedding: string
    model: string
    dimensions: number
  } | null>
  searchByEmbedding(
    embedding: number[],
    opts: {
      limit?: number
      threshold?: number
      entityType?: string
      /** Filter by model name — prevents cross-dimension NaN in cosine. */
      model?: string
      /** Filter by vector dimensions — prevents cross-dimension NaN in cosine. */
      dimensions?: number
    },
  ): Promise<Array<{ entityId: string; entityType: string; score: number }>>
  deleteEmbedding(entityType: string, entityId: string): Promise<void>
  countEmbeddings(opts?: { entityType?: string }): Promise<number>
}
```

## src/storage/contracts/shape-binding-store.ts

```ts
// src/storage/contracts/shape-binding-store.ts
// ShapeBindingStore contract — Phase 22.3

export interface ShapeBindingRow {
  id: string
  providerId: string
  archetypeId: string
  shapeId: string
  configJson: string | null
  isActive: number
  createdAt: number
}

export interface ShapeBindingStore {
  save(binding: ShapeBindingRow): Promise<void>
  findById(id: string): Promise<ShapeBindingRow | null>
  findByProvider(providerId: string): Promise<ShapeBindingRow[]>
  findByShape(shapeId: string): Promise<ShapeBindingRow[]>
  delete(id: string): Promise<void>
  setActive(id: string, active: boolean): Promise<void>
}
```

## src/storage/contracts/situation-store.ts

```ts
// src/storage/contracts/situation-store.ts
// SituationStore — persistence contract for SituationDetector.

export interface SituationLogInput {
  id: string
  conversationId: string | null
  detectedType: string
  confidence: number
  signalsJson: string
  timestamp: number
}

export interface UserPreferenceInput {
  id: string
  userId: string
  key: string
  value: string
  learnedAt: number
}

export interface SituationStore {
  createLog(log: SituationLogInput): Promise<void>
  getRecentForConversation(
    conversationId: string,
    limit?: number,
  ): Promise<Array<{ detectedType: string; confidence: number; timestamp: number }>>
  createUserPreference(input: UserPreferenceInput): Promise<void>
  getUserPreferences(userId: string): Promise<Array<{ key: string; value: string }>>
}
```

## src/storage/contracts/slave-setup-store.ts

```ts
// src/storage/contracts/slave-setup-store.ts
// SlaveSetupStore — workspace hint + profile allocation for provider setup flow.

// Simplified account type for setup flow
export interface SetupAccount {
  id: string
  providerId: string
  accountSlug: string
  displayName: string
  planTier: string
  loginState: string
  profileDir: string | null
  debugPort: number | null
  created_at?: number
  updated_at?: number
}

export interface SlaveSetupStore {
  getWorkspaceHint(): Promise<string | null>
  setWorkspaceHint(path: string): Promise<void>
  upsertAccount(account: SetupAccount): Promise<void>
  getAccount(providerId: string, accountId: string): Promise<SetupAccount | null>
  listAccounts(): Promise<SetupAccount[]>
}
```

## src/storage/contracts/stealth-store.ts

```ts
// src/storage/contracts/stealth-store.ts
// 11.3 — StealthProfile store contract: per-provider launch + module profiles
// and the global stealth policy. Persisted in DB, queryable by engines.

export type LaunchMode = 'cdp_minimal' | 'cdp_stealth' | 'attach' | 'extension' | 'hidden'

export interface LaunchProfileRow {
  id: string
  mode: string
  chromeArgsJson: string
  stealthProfileId: string | null
  attachPort: number | null
  extensionId: string | null
  windowSizeJson: string
  extraArgsJson: string
  createdAt: number
  updatedAt: number
}

export interface ModuleProfileRow {
  id: string
  name: string
  modulesJson: string
  createdAt: number
  updatedAt: number
}

export interface StealthPolicyRow {
  id: string
  defaultLaunchProfileId: string | null
  defaultModuleProfileId: string | null
  providerOverridesJson: string
}

export interface StealthPolicy {
  defaultProfileId: string | null
  providerOverrides: Record<string, string>
}

export interface StealthProfileStore {
  // Launch profiles
  getLaunchProfile(id: string): Promise<LaunchProfileRow | null>
  getAllLaunchProfiles(): Promise<LaunchProfileRow[]>
  upsertLaunchProfile(id: string, data: Partial<LaunchProfileRow>): Promise<void>
  deleteLaunchProfile(id: string): Promise<void>

  // Module profiles
  getModuleProfile(id: string): Promise<ModuleProfileRow | null>
  getAllModuleProfiles(): Promise<ModuleProfileRow[]>
  upsertModuleProfile(id: string, data: Partial<ModuleProfileRow>): Promise<void>
  deleteModuleProfile(id: string): Promise<void>

  // Policy
  getPolicy(): Promise<StealthPolicyRow | null>
  upsertPolicy(data: Partial<StealthPolicyRow>): Promise<void>
}
```

## src/storage/contracts/stream-block-store.ts

```ts
// src/storage/contracts/stream-block-store.ts
// StreamBlockStore contract — data access for content blocks.
// ContentBlock type imported from canonical schema.

import type { ContentBlock } from '../../schema/streaming.js'

export type { ContentBlock } from '../../schema/streaming.js'

export interface StreamBlockRow {
  id: string
  conversationId: string
  messageId: string
  blockIndex: number
  blockKind: string
  blockData: string
  blockMeta: string
  createdAt: number
}

/** Optional parser metadata attached to each block for diagnostics. */
export interface BlockMeta {
  parserName?: string
  parserVersion?: number
  confidence?: number
  wireFormat?: string
}

export interface StreamBlockStoreContract {
  storeBlocks(
    conversationId: string,
    messageId: string,
    blocks: ContentBlock[],
    meta?: BlockMeta,
  ): Promise<void>
  getBlocksByConversation(
    conversationId: string,
    opts?: {
      messageId?: string
      blockKind?: string
      limit?: number
      offset?: number
    },
  ): Promise<StreamBlockRow[]>
  getBlocksByMessage(messageId: string): Promise<StreamBlockRow[]>
}
```

## src/storage/contracts/stream-config-store.ts

```ts
// src/storage/contracts/stream-config-store.ts
// StreamConfigStore — persistence contract for provider stream configuration.

export interface ProviderStreamConfigRow {
  id: string
  providerId: string
  streamTransport: string // 'sse' | 'batchexecute' | 'websocket' | 'sse-patch'
  streamTerminalJson: string
  sseFormat: string | null
  deltaPathJson: string | null
  contentType: string | null
  completionDetectorsJson: string
  harnessJs: string | null
  isActive: number
  version: number
  supersededById: string | null
  createdAt: number
  updatedAt: number
}

export interface StreamConfigStore {
  getConfig(providerId: string, transport: string): Promise<ProviderStreamConfigRow | null>
  getActiveConfig(providerId: string): Promise<ProviderStreamConfigRow | null>
  upsertConfig(config: ProviderStreamConfigRow): Promise<void>
  listConfigs(providerId: string): Promise<ProviderStreamConfigRow[]>
  supersedeConfig(id: string, supersededById: string): Promise<void>
}
```

## src/storage/contracts/telemetry-store.ts

```ts
// src/storage/contracts/telemetry-store.ts
// TelemetryStore — persistence surface for the TelemetryAggregator engine.
// The aggregator is data-source-agnostic: it emits raw SQL to the store and
// the store is responsible for execution (Prisma $queryRaw in prod, alasql in
// tests). This keeps the engine portable across backends.

export interface HealthHistoryRow {
  id: string
  providerId: string
  runtimeState: string
  activeSessions: number
  totalConversations: number
  totalMessages: number
  capabilityExecutions: number
  capabilitySuccesses: number
  capabilityFailures: number
  errorCount: number
  parserConfidenceAvg: number | null
  selectorHitRateAvg: number | null
  avgResponseLatencyMs: number | null
  p50ResponseLatencyMs: number | null
  p95ResponseLatencyMs: number | null
  p99ResponseLatencyMs: number | null
  circuitBreakerState: string | null
  fleetRestarts: number
  driftEventsUnresolved: number
  windowStartTs: number
  windowEndTs: number
  snapshotTs: number
  schemaVersion: number
}

export interface SelectorHealthRow {
  id: string
  selectorStrategyId: string
  bindingId: string
  hitCount: number
  missCount: number
  hitRate: number
  avgDurationMs: number
  p95DurationMs: number
  windowStartTs: number
  windowEndTs: number
  snapshotTs: number
  schemaVersion: number
}

export interface DailySummaryRow {
  id: string
  providerId: string
  dayTs: string
  totalConversations: number
  totalConversationsCreated: number
  totalMessagesSent: number
  totalCapabilityExecutions: number
  totalCapabilitySuccesses: number
  totalCapabilityFailures: number
  totalErrors: number
  avgResponseLatencyMs: number
  p95ResponseLatencyMs: number
  peakConcurrentSessions: number
  peakConcurrentSlaves: number
  parserHealthEvents: number
  circuitBreakerOpens: number
  circuitBreakerResets: number
  driftEvents: number
  driftResolved: number
  fleetRestarts: number
  manifestChanges: number
  schemaVersion: number
}

export interface CrossProviderSummary {
  from: string
  to: string
  providerCount: number
  totalCapabilityExecutions: number
  totalCapabilitySuccesses: number
  totalCapabilityFailures: number
  totalErrors: number
  avgResponseLatencyMs: number
  p95ResponseLatencyMs: number
  perProvider: DailySummaryRow[]
}

export interface ManifestChangeInput {
  providerId: string
  changeType: string
  filePath?: string | null
  oldHash?: string | null
  newHash?: string | null
  tablesAffected?: string[]
  actor?: string
}

export interface ManifestChangeRow extends ManifestChangeInput {
  id: string
  tablesAffected: string[]
  ts: number
  actor: string
}

export interface TelemetryStore {
  // Raw aggregation execution. The engine composes SQL; the store executes it.
  executeAggregationQuery(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>

  // Generic upsert. `columns` are the writable columns; the store decides the
  // conflict key (primary/unique) for the merge.
  upsertRows(table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number>

  countRows(table: string, where?: string, params?: unknown[]): Promise<number>

  deleteRows(table: string, where: string, params: unknown[], maxRows?: number): Promise<number>

  getHealthHistory(
    providerId: string,
    opts?: { limit?: number; from?: number; to?: number },
  ): Promise<HealthHistoryRow[]>

  getSelectorHealthHistory(
    selectorId: string,
    opts?: { limit?: number },
  ): Promise<SelectorHealthRow[]>

  getDailySummary(
    providerId: string,
    opts?: { from?: string; to?: string },
  ): Promise<DailySummaryRow[]>

  getCrossProviderSummary(opts?: { from?: string; to?: string }): Promise<CrossProviderSummary>

  createManifestChange(input: ManifestChangeInput): Promise<ManifestChangeRow>

  getManifestChangeHistory(
    providerId: string,
    opts?: { limit?: number },
  ): Promise<ManifestChangeRow[]>

  recordCycleRun(
    scheduleName: string,
    rowsWritten: number,
    durationMs: number,
    error?: string,
  ): Promise<void>
}
```

## src/storage/contracts/ui-component-store.ts

```ts
// src/storage/contracts/ui-component-store.ts
// UiComponentStore — persistence + resolution for hot-swappable UI code nodes.
// The single table expresses all four resolution tiers via (scope, ownerId,
// variant). `resolve()` walks the precedence defined in 10-conceptual-matrix §3.

import type {
  UiComponent,
  UiComponentRow,
  UiComponentScope,
  UiComponentStatus,
} from 'shared/ui-component.js'

export type { UiComponent, UiComponentRow, UiComponentScope, UiComponentStatus }

export interface UiComponentInput {
  id: string
  primitiveId: string
  scope: UiComponentScope
  ownerId: string
  variant?: string | null
  componentKey: string
  displayName: string
  html?: string
  css?: string
  scriptUrl?: string | null
  sandboxJson?: string
  constraintsJson?: string
  contractJson?: string
  archetype?: string | null
  version?: number
  status?: UiComponentStatus
  author?: 'system' | 'user' | 'agent'
  defaultRegion?: { x: number; y: number; z: number; w: number; h: number } | null
  tags?: string[]
}

/** Inputs to walk the 4-tier resolution for one primitive on one provider. */
export interface ResolveContext {
  providerId: string
  familyId: string
  primitiveId: string
  /** Optional explicit variant (e.g. user-selected 'gemini'). */
  variant?: string | null
}

export interface UiComponentStore {
  create(input: UiComponentInput): Promise<UiComponentRow>
  get(id: string): Promise<UiComponentRow | null>
  /** Walk the precedence: provider(+variant) > provider > family(+variant) >
   *  family > cross-type > null. Returns the winning row or null. */
  resolve(ctx: ResolveContext): Promise<UiComponentRow | null>
  listByOwner(scope: UiComponentScope, ownerId: string): Promise<UiComponentRow[]>
  listByPrimitive(primitiveId: string): Promise<UiComponentRow[]>
  listByFamily(familyId: string): Promise<UiComponentRow[]>
  update(id: string, patch: Partial<Omit<UiComponentInput, 'id'>>): Promise<UiComponentRow>
  delete(id: string): Promise<void>
  /** Domain helper: resolve and deserialize. */
  resolveDomain(ctx: ResolveContext): Promise<UiComponent | null>
}
```

## src/storage/contracts/user-identity-store.ts

```ts
// src/storage/contracts/user-identity-store.ts
// UserIdentityStore — data access contract for UserIdentityEngine.

export type UserRole = 'member' | 'admin' | 'developer'

export interface UserRow {
  id: string
  displayName: string
  role: UserRole
  avatarColor: string
  avatarUrl: string | null
  status: string
  isDefault: number
  createdAt: number
  updatedAt: number
  lastActiveAt: number | null
  lastSessionId: string | null
}

export interface CreateUserInput {
  displayName: string
  role?: UserRole
  avatarColor?: string
  avatarUrl?: string | null
  isDefault?: boolean
}

export interface UserIdentityStore {
  create(input: CreateUserInput): Promise<UserRow>
  getById(id: string): Promise<UserRow | null>
  list(opts?: { status?: string; role?: UserRole }): Promise<UserRow[]>
  getDefault(): Promise<UserRow | null>
  update(
    id: string,
    patch: Partial<
      Pick<
        UserRow,
        | 'displayName'
        | 'role'
        | 'avatarColor'
        | 'avatarUrl'
        | 'status'
        | 'isDefault'
        | 'lastActiveAt'
        | 'lastSessionId'
      >
    >,
  ): Promise<void>
  softDelete(id: string): Promise<void>
  count(): Promise<number>
}
```

## src/storage/contracts/version-store.ts

```ts
// src/storage/contracts/version-store.ts
// VersionStore — data access contract for VersionManager (05-merged-lifecycles.md §2).
// Manages capability taxonomy version chains, binding status logs, and program
// version metrics.

export interface TaxonomyVersionRow {
  id: string
  capabilityId: string
  version: number
  snapshotJson: string
  changeSummary: string | null
  changedFieldsJson: string
  actor: string
  createdAt: number
}

export interface TaxonomyVersionInput {
  id: string
  capabilityId: string
  version: number
  snapshotJson: string
  changeSummary?: string | null
  changedFieldsJson?: string
  actor?: string
}

export interface StatusLogRow {
  id: string
  bindingId: string
  fromStatus: string | null
  toStatus: string
  fromProgramId: string | null
  toProgramId: string | null
  trigger: string
  confidenceAtTransition: number | null
  successRateAtTransition: number | null
  reason: string | null
  actor: string
  metadataJson: string
  ts: number
}

export interface StatusLogInput {
  id: string
  bindingId: string
  fromStatus: string | null
  toStatus: string
  fromProgramId?: string | null
  toProgramId?: string | null
  trigger: string
  confidenceAtTransition?: number | null
  successRateAtTransition?: number | null
  reason?: string | null
  actor?: string
  metadataJson?: string
  ts: number
}

export interface ProgramMetricRow {
  id: string
  bindingId: string
  programId: string
  programVersion: number
  totalExecutions: number
  successCount: number
  failCount: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  lastExecutedAt: number | null
  firstExecutedAt: number | null
  window1hTotal: number
  window1hSuccess: number
  window24hTotal: number
  window24hSuccess: number
  window7dTotal: number
  window7dSuccess: number
  createdAt: number
  updatedAt: number
}

export interface ProgramMetricInput {
  id: string
  bindingId: string
  programId: string
  programVersion: number
  totalExecutions?: number
  successCount?: number
  failCount?: number
  avgLatencyMs?: number
  p50LatencyMs?: number
  p95LatencyMs?: number
  p99LatencyMs?: number
  lastExecutedAt?: number | null
  firstExecutedAt?: number | null
  window1hTotal?: number
  window1hSuccess?: number
  window24hTotal?: number
  window24hSuccess?: number
  window7dTotal?: number
  window7dSuccess?: number
}

export interface VersionStore {
  createTaxonomyVersion(input: TaxonomyVersionInput): Promise<TaxonomyVersionRow>
  getTaxonomyVersion(capabilityId: string, version: number): Promise<TaxonomyVersionRow | null>
  getLatestTaxonomyVersion(capabilityId: string): Promise<TaxonomyVersionRow | null>
  getTaxonomyVersionHistory(capabilityId: string, limit?: number): Promise<TaxonomyVersionRow[]>
  pruneOldVersions(capabilityId: string, maxVersions: number): Promise<number>

  createStatusLog(input: StatusLogInput): Promise<StatusLogRow>
  getStatusHistory(
    bindingId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<StatusLogRow[]>
  getLastStatusChange(bindingId: string): Promise<StatusLogRow | null>

  upsertProgramMetric(input: ProgramMetricInput): Promise<ProgramMetricRow>
  getProgramMetrics(bindingId: string, programId?: string): Promise<ProgramMetricRow[]>
  getProgramMetric(
    bindingId: string,
    programId: string,
    version: number,
  ): Promise<ProgramMetricRow | null | undefined>
}
```

## src/storage/contracts/workspace-store.ts

```ts
// src/storage/contracts/workspace-store.ts
// WorkspaceStore — persistence contract for AdaptiveWorkspaceEngine.

export interface UserStats {
  messageCount: number
  capabilityCount: number
}

export interface WorkspaceStore {
  getMode(userId: string): Promise<string | null>
  setMode(userId: string, mode: string): Promise<void>
  getUserStats(userId: string): Promise<UserStats>
}
```
