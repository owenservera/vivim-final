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
