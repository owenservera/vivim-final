// frontend/src/types/shared/api-contract.ts
// Canonical API types mirroring src/schema/api-types.ts on the backend.
// These are the SINGLE source of truth for frontend API consumers.
// Import these instead of defining duplicate types.
//
// Work Items 01/04: Ensures frontend and backend types are in sync.

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

/** @deprecated Use ApiErrorResponse from errors.ts instead — this type includes fields the backend never sends. */
export interface ApiErrorResponse extends ApiResponse {
  ok: false
  error: string
  code: string
  details?: unknown
}

// ── Capability Types ─────────────────────────────────────────────────────────

/** Full capability detail as returned by GET /api/capabilities and GET /api/capabilities/:id */
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

/** Wrapped list response from GET /api/capabilities */
export interface CapabilityListResponse {
  capabilities: CapabilityDetail[]
  total: number
}

/** Response from POST /api/capabilities/:id/execute */
export interface CapabilityExecuteResponse {
  ok: true
  capabilityId: string
  output: unknown
  traceId: string
  latencyMs: number
}

// ── Conversation Types ───────────────────────────────────────────────────────

/** Conversation detail as returned by the backend (timestamps are numbers) */
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

/** Message detail as returned by the backend */
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

// ── Send Message Types ───────────────────────────────────────────────────────

export interface SendMessageSuccessResponse {
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

export type SendMessageResponse = SendMessageSuccessResponse | SendMessageErrorResponse

// ── Provider Types ───────────────────────────────────────────────────────────

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

// ── Interpret Types ─────────────────────────────────────────────────────────

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

// ── Health Types ────────────────────────────────────────────────────────────

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


