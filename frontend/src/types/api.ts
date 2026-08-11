// frontend/src/types/api.ts
// Re-exports canonical types from shared contracts.
// UI components should import from this file for convenience.
// The actual definitions live in frontend/src/types/shared/*.ts
// to maintain a single source of truth aligned with the backend.
//
// Work Items 01/03/04: Aligned with backend api-types.ts and storage contracts.

// ── Domain models (what UI components use) ───────────────────────────────────
export type { Conversation, Message, Capability, Provider } from './shared/domain'

// ── API contract types (raw backend responses) ────────────────────────────────
export type {
  CapabilityDetail,
  CapabilityListResponse,
  CapabilityExecuteResponse,
  ConversationDetail,
  ConversationMessageDetail,
  SendMessageSuccessResponse,
  SendMessageErrorResponse,
  SendMessageResponse,
  ProviderDetail,
  ProviderListResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  HealthDashboardResponse,
  ProviderHealthDetail,
} from './shared/api-contract'

// ── Error types ─────────────────────────────────────────────────────────────
export type { ErrorCode, ApiErrorResponse as ServerErrorResponse } from './shared/errors'
export { getUserMessage, isRetryable, ERROR_MESSAGES } from './shared/errors'

// ── Composer UI types (keep existing, these are UI-only) ─────────────────────

import type { ZLayerId } from '@/shared/z-layer'

export type ComposerBehavior =
  | 'chat'
  | 'search'
  | 'execute'
  | 'prompt'
  | 'command'
  | 'comment'
  | 'help'
  | 'nl-inject'

export interface ComposerInstanceScope {
  workspaceId: string
  surfaceSlug: string
  regionSlotId: string
  activeZLayer: ZLayerId
  instanceId: string
  behavior: ComposerBehavior
}

export type ComposerAddOnPosition = 'top' | 'bottom' | 'inline'

export interface ComposerAddOn {
  key: string
  position: ComposerAddOnPosition
  Component: React.ComponentType<AddOnProps>
  label: string
  icon?: string
}

export interface ModelOption {
  id: string
  name: string
}

export interface CapabilityToggle {
  slug: string
  name: string
  enabled: boolean
}

export interface SlashCommand {
  id: string
  label: string
  description?: string
}

export interface MentionTarget {
  id: string
  label: string
  type: 'agent' | 'tool' | 'memory' | 'file'
}

export interface Attachment {
  id: string
  file: File
  previewUrl?: string
}

export interface QuotedMessage {
  id: string
  role: 'user' | 'assistant'
  snippet: string
}

export interface AddOnProps {
  context: ComposerShellContext
}

export interface ComposerShellContext {
  scope: ComposerInstanceScope
  providerId: string | null
  models: ModelOption[]
  selectedModel: ModelOption | null
  setModel: (m: ModelOption) => void
  capabilities: CapabilityToggle[]
  toggleCapability: (slug: string) => void
  attachments: Attachment[]
  addAttachment: (file: File) => void
  removeAttachment: (id: string) => void
  quotedMessage: QuotedMessage | null
  setQuote: (msg: QuotedMessage | null) => void
  isStreaming: boolean
  stopStreaming: () => void
  enabledAddOns: string[]
  toggleAddOn: (key: string) => void
}

export interface ComposerUserConfig {
  enabledAddOns: string[]
  showToggleMenu: boolean
}

// ── Health status (lightweight for UI) ───────────────────────────────────────

export interface HealthStatus {
  status: string
  version?: string
  uptime?: number
}

// ── Legacy SendResult (deprecated — use SendMessageResponse from shared) ─────
/** @deprecated Use SendMessageResponse from shared/api-contract instead. */
export interface SendResult {
  ok: boolean
  messageId: string
  blocks: Array<Record<string, unknown>>
  text: string
  latencyMs: number
  traceId?: string
  timing?: Record<string, unknown>
  error?: string
}
