// frontend/src/api/schemas.ts
// Zod schemas for validating API responses on the frontend.
// These mirror src/schema/response-schemas.ts on the backend.
// Used in UnifiedIO's responseSchema option for runtime validation.
//
// Work Item 05: Frontend-side response validation.

import { z } from 'zod'

// ── Capability schemas ───────────────────────────────────────────────────────

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

export const CapabilityExecuteResponseSchema = z.object({
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

export const SendMessageResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    messageId: z.string(),
    blocks: z.array(z.unknown()),
    text: z.string(),
    latencyMs: z.number(),
    traceId: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    messageId: z.string(),
    blocks: z.array(z.unknown()),
    text: z.string(),
    latencyMs: z.number(),
    error: z.string(),
    traceId: z.string(),
  }),
])

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

// ── Error response schema ───────────────────────────────────────────────────

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
})

// ── Generic schemas ──────────────────────────────────────────────────────────

export const OkResponseSchema = z.object({
  ok: z.literal(true),
})

/** Schema for array responses (e.g., GET /api/conversations returns ConversationRow[]) */
export const ConversationArraySchema = z.array(ConversationDetailSchema)

export const MessageArraySchema = z.array(ConversationMessageDetailSchema)

// ── Mutation Schemas ──────────────────────────────────────────────────────

export const MutationApplyResponseSchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  traceId: z.string().optional(),
  latencyMs: z.number().optional(),
})

export const MutationListResponseSchema = z.object({
  mutations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      state: z.string(),
      createdAt: z.number(),
      updatedAt: z.number(),
    }),
  ),
  total: z.number(),
})

// ── Variant Schemas ───────────────────────────────────────────────────────

export const VariantDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  config: z.unknown(),
  isActive: z.boolean(),
  locked: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const VariantListResponseSchema = z.object({
  variants: z.array(VariantDetailSchema),
  total: z.number(),
})

export const VariantApplyResponseSchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
})

// ── Conversation Sync Schemas ──────────────────────────────────────────────

export const SyncStatusSchema = z.object({
  providerId: z.string(),
  status: z.enum(['idle', 'syncing', 'error']),
  lastSyncAt: z.number().nullable(),
  nextSyncAt: z.number().nullable(),
  error: z.string().nullable(),
})

export const SyncListResponseSchema = z.array(SyncStatusSchema)

export const SyncTriggerResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
})

// ── Session Schemas ───────────────────────────────────────────────────────

export const SessionDetailSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerType: z.string(),
  isActive: z.boolean(),
  startedAt: z.number(),
  lastActivityAt: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const SessionListResponseSchema = z.array(SessionDetailSchema)

// ── Interpret Schemas ──────────────────────────────────────────────────────

export const InterpretResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    capabilityId: z.string(),
    output: z.unknown(),
    text: z.string().optional(),
    traceId: z.string(),
    latencyMs: z.number(),
    requiresConfirmation: z.literal(false).optional(),
  }),
  z.object({
    ok: z.literal(true),
    requiresConfirmation: z.literal(true),
    confirmation: z.object({
      token: z.string(),
      prompt: z.string(),
    }),
    traceId: z.string(),
    latencyMs: z.number(),
  }),
  z.object({
    ok: z.literal(false),
    clarification: z.object({
      prompt: z.string(),
      missing: z.array(z.string()).optional(),
      ambiguous: z.array(z.string()).optional(),
      options: z.array(z.string()).optional(),
    }),
    traceId: z.string(),
    latencyMs: z.number(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    traceId: z.string(),
    latencyMs: z.number(),
  }),
])

// ── Health Schemas ─────────────────────────────────────────────────────────

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

// ── Node Schemas ──────────────────────────────────────────────────────────

export const NodeDetailSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
  status: z.string(),
  config: z.unknown().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const NodeListResponseSchema = z.object({
  nodes: z.array(NodeDetailSchema),
  total: z.number(),
})

// ── Setup Schemas ─────────────────────────────────────────────────────────

export const SetupStatusResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
  step: z.number().optional(),
})

export const ProfileListResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  }),
)
