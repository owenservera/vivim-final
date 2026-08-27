// src/schema/api-validators.ts
// Shared Zod schemas for API request body validation.
// Import these in routers to avoid duplicating validation logic.

import { z } from 'zod'

// ── Common patterns ──────────────────────────────────────────────────────────

/** Non-empty string ID (ULID, UUID, or slug). */
export const IdParam = z.string().min(1, { error: 'ID must be non-empty' })

/** Optional string that defaults to undefined when empty. */
export const OptionalString = z.string({ error: 'Invalid string' }).optional()

/** Record of arbitrary key-value pairs. */
export const MetadataRecord = z.record(z.string(), z.unknown()).optional()

// ── Autonomous task schemas ──────────────────────────────────────────────────

export const AutonomousGoalSchema = z.object({
  description: z.string().min(1, { error: 'goal.description is required' }),
  maxSteps: z.number({ error: 'Invalid number' }).int().positive().optional(),
  maxDurationMs: z.number({ error: 'Invalid number' }).int().positive().optional(),
  requireApprovalAbove: z
    .enum(['read', 'write', 'navigate', 'destructive', 'financial'])
    .optional(),
  allowBrowser: z.boolean({ error: 'Invalid boolean' }).optional(),
  costBudgetCents: z.number({ error: 'Invalid number' }).int().nonnegative().optional(),
  tokenBudget: z.number({ error: 'Invalid number' }).int().nonnegative().optional(),
  iterationBudget: z.number({ error: 'Invalid number' }).int().nonnegative().optional(),
  providerId: OptionalString,
  conversationId: OptionalString,
  llmProvider: OptionalString,
})

export const AutonomousExecuteSchema = z.object({
  goal: AutonomousGoalSchema,
})

export const GateResolveSchema = z.object({
  response: z.string().min(1, { error: 'response is required' }),
  resolvedBy: z.string().min(1, { error: 'resolvedBy is required' }),
})

export const ReplaySchema = z.object({
  fromStep: z.number({ error: 'Invalid number' }).int().nonnegative().optional(),
})

// ── Agent canvas schemas ─────────────────────────────────────────────────────

export const AgentCanvasCommandSchema = z.object({
  agentId: IdParam,
  workspaceId: IdParam,
  command: z.record(z.string(), z.unknown()),
})

export const AgentCanvasPolicySchema = z.object({
  agentId: IdParam,
  workspaceId: IdParam,
  policy: z.record(z.string(), z.unknown()).optional(),
})

export const AgentCanvasPlanSchema = z.object({
  prompt: z.string().min(1, { error: 'prompt is required' }),
  sessionId: OptionalString,
  conversationId: OptionalString,
})

// ── Knowledge schemas ────────────────────────────────────────────────────────

export const KnowledgeIngestSchema = z.object({
  source: z.string().min(1, { error: 'source is required' }),
  filePath: z.string().min(1, { error: 'filePath is required' }),
  deduplicate: z.boolean({ error: 'Invalid boolean' }).optional(),
  extractEntities: z.boolean({ error: 'Invalid boolean' }).optional(),
  extractDecisions: z.boolean({ error: 'Invalid boolean' }).optional(),
})

export const KnowledgeSynthesizeSchema = z.object({
  question: z.string().min(1, { error: 'question is required' }),
  maxSources: z.number({ error: 'Invalid number' }).int().positive().optional(),
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
  type: z.string().min(1, { error: 'type is required' }),
  data: z.record(z.string(), z.unknown()),
  acl: z.array(z.string({ error: 'Invalid string' })).optional(),
  securityLevel: z.number({ error: 'Invalid number' }).int().nonnegative().optional(),
})

export const NodeUpdateSchema = z.object({
  id: IdParam,
  data: z.record(z.string(), z.unknown()),
  patch: z.boolean().optional(),
})

export const NodeEdgeSchema = z.object({
  sourceId: IdParam,
  targetId: IdParam,
  kind: z.string().min(1, { error: 'edge kind is required' }),
  weight: z.number({ error: 'Invalid number' }).min(0).max(1).optional(),
  metadata: MetadataRecord,
})

// ── Memory schemas ───────────────────────────────────────────────────────────

export const MemoryRecordSchema = z.object({
  key: z.string().min(1, { error: 'key is required' }),
  value: z.string().min(1, { error: 'value is required' }),
  namespace: OptionalString,
  ttlMs: z.number({ error: 'Invalid number' }).int().positive().optional(),
})

// ── Conversation schemas ─────────────────────────────────────────────────────

export const ConversationCreateSchema = z.object({
  providerId: z.string().min(1, { error: 'providerId is required' }),
  accountId: OptionalString,
  title: OptionalString,
})

export const ConversationSendSchema = z.object({
  message: z.string().min(1, { error: 'message is required' }),
})

// ── Fleet / Chrome schemas ───────────────────────────────────────────────────

export const FleetStartSchema = z.object({
  providerId: z.string().min(1, { error: 'providerId is required' }),
  accountId: z.string().min(1, { error: 'accountId is required' }),
})

// ── Interpret (NL) schemas ───────────────────────────────────────────────────

export const InterpretSchema = z.object({
  text: z.string().min(1, { error: 'text is required' }),
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
  name: z.string().min(1, { error: 'name is required' }),
  url: OptionalString,
  version: OptionalString,
})

export const PluginActionSchema = z.object({
  pluginId: IdParam,
  action: z.string().min(1, { error: 'action is required' }),
  params: z.record(z.string(), z.unknown()).optional(),
})

// ── Template schemas ─────────────────────────────────────────────────────────

export const TemplateCreateSchema = z.object({
  name: z.string().min(1, { error: 'name is required' }),
  content: z.string().min(1, { error: 'content is required' }),
  type: OptionalString,
  metadata: MetadataRecord,
})

// ── Version schemas ──────────────────────────────────────────────────────────

export const VersionCreateSchema = z.object({
  entityType: z.string().min(1, { error: 'entityType is required' }),
  entityId: IdParam,
  data: z.record(z.string(), z.unknown()),
  provenance: OptionalString,
})

// ── Mutation schemas ─────────────────────────────────────────────────────────

export const MutationSchema = z.object({
  entityType: z.string().min(1, 'entityType is required'),
  entityId: IdParam,
  operation: z.enum(['update', 'delete', 'restore']),
  data: z.record(z.string(), z.unknown()).optional(),
})

// ── Capability execution schemas (Work Item 05) ──────────────────────────────

export const CapabilityExecuteBodySchema = z.object({
  input: z.record(z.string(), z.unknown()).optional(),
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
