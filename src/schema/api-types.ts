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

export interface WsCapabilityExecutedEvent extends WsBaseEvent {
  type: 'capability:executed'
  capabilityId: string
  latencyMs: number
}

export interface WsStreamBlockEvent extends WsBaseEvent {
  type: 'stream:block'
  conversationId: string
  messageId: string
  blockIndex: number
  blockKind: string
  blockData: string
  blockMeta: string
}

export interface WsGenericEvent extends WsBaseEvent {
  type: string
  [key: string]: unknown
}

export type WsEvent = WsCapabilityExecutedEvent | WsStreamBlockEvent | WsGenericEvent

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
