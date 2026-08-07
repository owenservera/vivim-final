// src/engines/adapters/chatgpt-adapter.ts
// ChatGPT conversation history adapter.
// Fetches conversations from chatgpt.com/backend-api using cookies extracted
// from a live Chrome slave via CDP Network.getCookies.
//
// Auth flow: governor.send(slaveId, 'Network.getCookies') → bearer token
// API: REST at https://chatgpt.com/backend-api
// Parser: DAG message mapping (ChatGPT uses parent-child tree, not linear list)

import type {
  AuthContext,
  ConversationArtifact,
  ConversationFull,
  ConversationHeader,
  ConversationMessage,
  PaginatedResult,
  ProviderConversationAdapter,
} from '../provider-conversation-adapter.js'
import { AdapterError } from '../provider-conversation-adapter.js'

// ── Types ───────────────────────────────────────────────────────────────────

/** Minimal ChromeGovernor interface — only the methods we need. */
export interface GovernorHandle {
  send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
}

interface CdpCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite?: string
}

/** Raw ChatGPT conversation list item. */
interface RawConversationItem {
  id: string
  title: string
  create_time: number
  update_time: number
  is_archived?: boolean
  mapping?: Record<string, RawMappingNode>
  current_node?: string
}

/** Raw ChatGPT mapping node (DAG). */
interface RawMappingNode {
  id: string
  parent: string | null
  message?: {
    author?: { role?: string; name?: string }
    content?: {
      content_type?: string
      parts?: unknown[]
      text?: string
    }
    create_time?: number
    metadata?: Record<string, unknown>
  }
}

/** Raw ChatGPT search result item. */
interface RawSearchItem {
  conversation_id?: string
  id?: string
  title?: string
  create_time?: number
  update_time?: number
}

// ── Constants ───────────────────────────────────────────────────────────────

const CHATGPT_DOMAIN = 'chatgpt.com'
const BACKEND_API = `https://${CHATGPT_DOMAIN}/backend-api`
const SESSION_COOKIE_NAME = '__Secure-next-auth.session-token'
const AUTH_CACHE_TTL_MS = 60_000

// ── Adapter ─────────────────────────────────────────────────────────────────

/**
 * ChatGPT conversation history adapter.
 *
 * Uses inline CDP auth extraction — no standalone auth service.
 * Auth tokens are cached in-memory per slaveId with a 60s TTL.
 */
export class ChatGPTAdapter implements ProviderConversationAdapter {
  readonly providerId = 'chatgpt'

  /** In-memory auth cache: slaveId → { context, extractedAt } */
  private authCache = new Map<string, { context: AuthContext; extractedAt: number }>()

  constructor(private governor: GovernorHandle) {}

  // ── Auth extraction (inline via CDP) ─────────────────────────────────────

  /**
   * Extract auth context from a Chrome slave's cookies.
   * Returns cached result if fresh (< 60s old).
   */
  async getAuthContext(slaveId: string): Promise<AuthContext> {
    const cached = this.authCache.get(slaveId)
    if (cached && Date.now() - cached.extractedAt < AUTH_CACHE_TTL_MS) {
      return cached.context
    }

    // 1. Get cookies from the slave
    const cookieResult = (await this.governor.send(slaveId, 'Network.getCookies', {
      urls: [`https://${CHATGPT_DOMAIN}/*`],
    })) as { cookies?: CdpCookie[] } | undefined

    const cookies = cookieResult?.cookies ?? []
    const sessionCookie = cookies.find((c) => c.name === SESSION_COOKIE_NAME)

    if (!sessionCookie?.value) {
      throw new AdapterError(
        `No ${SESSION_COOKIE_NAME} cookie found on slave ${slaveId}`,
        this.providerId,
        'AUTH_EXPIRED',
      )
    }

    const context: AuthContext = {
      bearerToken: sessionCookie.value,
      cookies: cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain })),
      headers: {
        Authorization: `Bearer ${sessionCookie.value}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }

    this.authCache.set(slaveId, { context, extractedAt: Date.now() })
    return context
  }

  /** Clear cached auth for a slave (e.g. on 401). */
  clearAuthCache(slaveId: string): void {
    this.authCache.delete(slaveId)
  }

  // ── REST API calls ───────────────────────────────────────────────────────

  private async chatgptFetch(
    path: string,
    auth: AuthContext,
    opts?: { method?: string; body?: unknown; signal?: AbortSignal },
  ): Promise<unknown> {
    const url = `${BACKEND_API}${path}`
    const headers = { ...auth.headers }

    const response = await fetch(url, {
      method: opts?.method ?? 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      signal: opts?.signal ?? AbortSignal.timeout(30_000),
    })

    if (response.status === 401 || response.status === 403) {
      throw new AdapterError(
        `ChatGPT auth error: HTTP ${response.status}`,
        this.providerId,
        'AUTH_EXPIRED',
      )
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      throw new AdapterError(
        'ChatGPT rate limited',
        this.providerId,
        'RATE_LIMITED',
        true,
        retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 60_000,
      )
    }

    if (!response.ok) {
      throw new AdapterError(
        `ChatGPT API HTTP ${response.status}`,
        this.providerId,
        'NETWORK_ERROR',
        response.status >= 500,
      )
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return null
    }

    return response.json()
  }

  // ── ProviderConversationAdapter implementation ───────────────────────────

  async listConversations(
    _accountId: string,
    auth: AuthContext,
    opts?: { cursor?: string; limit?: number },
  ): Promise<PaginatedResult<ConversationHeader>> {
    const offset = opts?.cursor ? Number.parseInt(opts.cursor, 10) : 0
    const limit = opts?.limit ?? 100

    const data = (await this.chatgptFetch(
      `/conversations?offset=${offset}&limit=${limit}&order=updated`,
      auth,
    )) as { items?: RawConversationItem[]; total?: number } | null

    if (!data) {
      return { items: [], total: 0 }
    }

    const items: ConversationHeader[] = (data.items ?? [])
      .filter((item) => !item.is_archived)
      .map((item) => ({
        id: item.id,
        title: item.title || 'New chat',
        updatedAt: parseTimestamp(item.update_time),
        createdAt: parseTimestamp(item.create_time),
      }))

    const nextOffset = offset + limit
    const hasMore = nextOffset < (data.total ?? 0)

    return {
      items,
      total: data.total,
      nextCursor: hasMore ? String(nextOffset) : undefined,
    }
  }

  async getConversation(
    _accountId: string,
    auth: AuthContext,
    conversationId: string,
  ): Promise<ConversationFull | null> {
    let data: RawConversationItem | null = null
    try {
      data = (await this.chatgptFetch(
        `/conversation/${conversationId}`,
        auth,
      )) as RawConversationItem | null
    } catch (err) {
      if (err instanceof AdapterError && err.code === 'NETWORK_ERROR') {
        // 404 means conversation doesn't exist — not a fatal error
        return null
      }
      throw err
    }

    if (!data) {
      return null
    }

    return parseConversation(data)
  }

  async searchConversations(
    _accountId: string,
    auth: AuthContext,
    query: string,
  ): Promise<ConversationHeader[]> {
    const data = (await this.chatgptFetch(
      `/conversations/search?query=${encodeURIComponent(query)}`,
      auth,
    )) as { items?: RawSearchItem[] } | null

    if (!data) {
      return []
    }

    const results: ConversationHeader[] = []
    for (const item of data.items ?? []) {
      const id = item.conversation_id ?? item.id
      if (!id) continue
      results.push({
        id,
        title: item.title || 'New chat',
        updatedAt: parseTimestamp(item.update_time ?? item.create_time),
        createdAt: parseTimestamp(item.create_time),
      })
    }
    return results
  }
}

// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a ChatGPT raw conversation (with DAG mapping) into a ConversationFull.
 * ChatGPT uses a parent-child message tree, not a linear list.
 */
function parseConversation(raw: RawConversationItem): ConversationFull {
  const mapping = raw.mapping
  if (!mapping || typeof mapping !== 'object') {
    return {
      id: raw.id,
      title: raw.title || 'New chat',
      messages: [],
    }
  }

  const allIds = new Set(Object.keys(mapping))
  const messages: ConversationMessage[] = []

  for (const [id, node] of Object.entries(mapping)) {
    const msg = parseMessageNode(id, node)
    if (!msg) continue

    // Fix orphaned parent references
    let parent = msg.parentId
    while (parent && !allIds.has(parent)) {
      parent = mapping[parent]?.parent ?? null
    }
    msg.parentId = parent

    messages.push(msg)
  }

  // Sort by timestamp for display order (oldest first)
  messages.sort((a, b) => a.timestamp - b.timestamp)

  return {
    id: raw.id,
    title: raw.title || 'New chat',
    messages,
  }
}

/**
 * Parse a single ChatGPT mapping node into a ConversationMessage.
 */
function parseMessageNode(id: string, node: RawMappingNode): ConversationMessage | null {
  const msg = node.message
  if (!msg?.content) return null

  const contentType: string = msg.content.content_type || 'text'
  let content = ''
  const artifacts: ConversationArtifact[] = []

  switch (contentType) {
    case 'text':
    case 'code': {
      const c = msg.content
      content = c.parts
        ? (c.parts as unknown[]).filter((p): p is string => typeof p === 'string').join('')
        : c.text || ''
      break
    }

    case 'multimodal_text': {
      const c = msg.content
      if (c.parts) {
        const textParts: string[] = []
        const _imgSeq = 0

        for (const p of c.parts as unknown[]) {
          if (typeof p === 'string') {
            textParts.push(p)
          } else if (p && typeof p === 'object') {
            const part = p as Record<string, unknown>

            if (part.content_type === 'text' && typeof part.text === 'string') {
              textParts.push(part.text)
            } else if (
              part.content_type === 'audio_transcription' &&
              typeof part.text === 'string'
            ) {
              textParts.push(part.text)
            } else if (part.content_type === 'image_asset_pointer') {
              const meta = (part.metadata as Record<string, unknown>) ?? {}
              const dalle = (meta.dalle as Record<string, unknown>) ?? {}
              const prompt = typeof dalle.prompt === 'string' ? dalle.prompt : 'User uploaded image'
              textParts.push(`[Image: ${prompt}]`)
              artifacts.push({
                kind: 'image',
                label: prompt,
                content: `[Image: ${prompt}]`,
              })
            }
          }
        }

        content = textParts.join('\n')
      }
      break
    }

    case 'image':
    case 'image_asset_pointer': {
      const c = msg.content
      const raw = c as Record<string, unknown>
      const meta = (raw.metadata as Record<string, unknown>) ?? {}
      const dalle = (meta.dalle as Record<string, unknown>) ?? {}
      const label = typeof dalle.prompt === 'string' ? dalle.prompt : 'Generated/Uploaded image'
      content = `[Image: ${label}]`
      if (c.text) content += `\n${c.text}`
      if (c.parts) {
        const textParts = (c.parts as unknown[])
          .filter((p): p is string => typeof p === 'string')
          .join('')
        if (textParts) content += `\n${textParts}`
      }
      artifacts.push({ kind: 'image', label })
      break
    }

    default: {
      const c = msg.content
      content =
        c.text ||
        ((c.parts as unknown[])?.filter((p): p is string => typeof p === 'string').join('') ?? '')
    }
  }

  if (!content && artifacts.length === 0) return null

  return {
    id,
    parentId: node.parent || null,
    role: (msg.author?.role as ConversationMessage['role']) || 'user',
    content: content || null,
    timestamp: parseTimestamp(msg.create_time),
    model: undefined,
    artifacts: artifacts.length > 0 ? artifacts : undefined,
    metadata: msg.author?.name ? { authorName: msg.author.name } : undefined,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseTimestamp(value: number | undefined | null): number {
  if (!value) return Date.now()
  // ChatGPT uses Unix seconds (float)
  return Math.floor(value * 1000)
}
