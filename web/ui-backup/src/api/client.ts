// web/ui/src/api/client.ts
// Shared frontend API client — the SINGLE way the frontend talks to the backend.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every surface (CLI, frontend, agent) calls the same endpoints with the same shapes.
// The X-Source header tracks which surface initiated the request.
//
// RULE: Never use raw fetch() for API calls. Always use this client.

import type {
  CompleteRequest,
  CompleteResponse,
  HealthResponse,
  LaunchVisibleRequest,
  LaunchVisibleResponse,
  ProfilesResponse,
  RestoreResponse,
  Source,
  VerifyRequest,
  VerifyResponse,
  WorkspaceGetResponse,
} from 'shared/api-types.ts'

// ── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const SOURCE: Source = 'frontend'
const DEFAULT_TIMEOUT = 15_000

// ── Core request function ────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('X-Source', SOURCE)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT),
  })

  const body = await resp.json()
  if (!resp.ok) {
    throw new Error(`API error ${resp.status}: ${JSON.stringify(body)}`)
  }
  return body as T
}

// ── Setup API ────────────────────────────────────────────────────────────────

export const setupApi = {
  health: () => request<HealthResponse>('/health'),

  getWorkspace: () => request<WorkspaceGetResponse>('/api/setup/workspace'),

  setWorkspace: (path: string) =>
    request<{ ok: boolean; workspacePath: string }>('/api/setup/workspace', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  getProfiles: () => request<ProfilesResponse>('/api/setup/profiles'),

  launchVisible: (req: LaunchVisibleRequest) =>
    request<LaunchVisibleResponse>('/api/setup/launch-visible', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  verify: (req: VerifyRequest) =>
    request<VerifyResponse>('/api/setup/verify', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  complete: (req: CompleteRequest) =>
    request<CompleteResponse>('/api/setup/complete', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  restore: (workspace?: string) =>
    request<RestoreResponse>('/api/setup/restore', {
      method: 'POST',
      body: JSON.stringify({ workspace }),
    }),
}

// ── Capability API ───────────────────────────────────────────────────────────

export interface ResolvedUiSlotClaim {
  component?: string
  sandbox?: string[]
}

export interface ResolvedCapabilityDto {
  id: string
  slug: string
  name: string
  category: string
  uiSlots?: Record<string, ResolvedUiSlotClaim>
}

export const capabilityApi = {
  list: (providerId: string) =>
    request<{ capabilities?: ResolvedCapabilityDto[] }>(
      `/api/providers/${encodeURIComponent(providerId)}/capabilities?planTier=free`,
    ),

  listBySurface: (surface: string) =>
    request<ResolvedCapabilityDto[]>(`/api/capabilities?surface=${surface}`),

  execute: (capabilityId: string, input: Record<string, unknown>) =>
    request<{ ok: boolean; result?: unknown; error?: string }>(
      `/api/capabilities/${encodeURIComponent(capabilityId)}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({ input }),
      },
    ),
}

// ── Conversation API ─────────────────────────────────────────────────────────

export interface ChatAccount {
  id: string
  providerId: string
  email: string
  planTier: string
  loginState?: string
  isDefault?: number
}

export interface ChatConversation {
  id: string
  providerId: string
  accountId: string
  title?: string | null
  messageCount?: number
  createdAt: string
}

export interface ChatAttachment {
  id: string
  messageId: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  blocksJson?: string
  attachments?: ChatAttachment[]
  createdAt: string
}

export interface StartResult {
  ok?: boolean
  account: ChatAccount
  conversationId: string
  conversation: ChatConversation
  messages: ChatMessage[]
  error?: string
}

export interface SendResult {
  ok: boolean
  messageId: string
  text: string
  blocks?: Array<{ kind: string; content: string }>
  latencyMs?: number
  error?: string
}

export const conversationApi = {
  listAccounts: (providerId: string) =>
    request<ChatAccount[]>(`/api/providers/${encodeURIComponent(providerId)}/accounts`),

  listAllAccounts: () => request<ChatAccount[]>('/api/accounts'),

  upsertAccount: (providerId: string, email: string, planTier = 'free') =>
    request<ChatAccount>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ providerId, email, planTier }),
    }),

  start: (providerId: string, accountEmail?: string) =>
    request<StartResult>('/api/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ providerId, accountEmail }),
    }),

  list: (providerId: string, limit = 50) =>
    request<ChatConversation[]>(
      `/api/conversations?providerId=${encodeURIComponent(providerId)}&limit=${limit}`,
    ),

  getMessages: (conversationId: string, limit = 200) =>
    request<ChatMessage[]>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`,
    ),

  create: (providerId: string, accountId: string) =>
    request<ChatConversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ providerId, accountId }),
    }),

  send: (conversationId: string, message: string) =>
    request<SendResult>(`/api/conversations/${encodeURIComponent(conversationId)}/send`, {
      method: 'POST',
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(90_000),
    }),

  editMessage: (messageId: string, content: string) =>
    request<ChatMessage>(`/api/conversations/messages/${encodeURIComponent(messageId)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  uploadAttachment: async (
    conversationId: string,
    messageId: string,
    file: File,
  ): Promise<ChatAttachment> => {
    const formData = new FormData()
    formData.append('file', file)
    const resp = await fetch(
      `${BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachments`,
      {
        method: 'POST',
        body: formData,
        headers: { 'X-Source': SOURCE },
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`)
    return resp.json() as Promise<ChatAttachment>
  },

  getAttachments: (messageId: string) =>
    request<ChatAttachment[]>(
      `/api/conversations/messages/${encodeURIComponent(messageId)}/attachments`,
    ),

  downloadUrl: (attachmentId: string) =>
    `${BASE_URL}/api/attachments/${encodeURIComponent(attachmentId)}/download`,
}

// ── NLCL API ─────────────────────────────────────────────────────────────────

export interface InterpretResult {
  ok: boolean
  intent: string
  capabilityId?: string
  input?: Record<string, unknown>
  text?: string
  error?: string
  latencyMs: number
}

export const nlclApi = {
  interpret: (
    input: string,
    opts: { surface?: string; providerId?: string; conversationId?: string } = {},
  ) =>
    request<InterpretResult>('/api/nlcl/interpret', {
      method: 'POST',
      body: JSON.stringify({ input, ...opts }),
    }),

  help: () => request<unknown>('/api/nlcl/help'),
}

// ── Automation API ───────────────────────────────────────────────────────────

export const automationApi = {
  navigate: (url: string) =>
    request<{ ok: boolean; url?: string; error?: string }>('/api/automate/navigate', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  click: (selector: string) =>
    request<{ ok: boolean; error?: string }>('/api/automate/click', {
      method: 'POST',
      body: JSON.stringify({ selector }),
    }),

  type: (selector: string, text: string) =>
    request<{ ok: boolean; error?: string }>('/api/automate/type', {
      method: 'POST',
      body: JSON.stringify({ selector, text }),
    }),

  text: (selector: string) =>
    request<{ ok: boolean; text?: string; error?: string }>('/api/automate/text', {
      method: 'POST',
      body: JSON.stringify({ selector }),
    }),

  value: (selector: string) =>
    request<{ ok: boolean; value?: string; error?: string }>('/api/automate/value', {
      method: 'POST',
      body: JSON.stringify({ selector }),
    }),

  exists: (selector: string) =>
    request<{ ok: boolean; exists?: boolean; error?: string }>('/api/automate/exists', {
      method: 'POST',
      body: JSON.stringify({ selector }),
    }),

  screenshot: () =>
    request<{ ok: boolean; path?: string; error?: string }>('/api/automate/screenshot', {
      method: 'POST',
    }),

  page: () =>
    request<{ ok: boolean; content?: string; url?: string; error?: string }>('/api/automate/page', {
      method: 'POST',
    }),

  reset: () =>
    request<{ ok: boolean; error?: string }>('/api/automate/reset', {
      method: 'POST',
    }),
}

// ── Export base request for custom calls ──────────────────────────────────────

export { request as apiRequest }
export { BASE_URL as apiBaseUrl }
export { SOURCE as apiSource }
