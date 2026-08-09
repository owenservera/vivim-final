// src/engines/opencode/opencode-client.ts
// OpenCodeClient — talks the `opencode serve` HTTP/SSE API (feature 027).
// Reuses parseOpencodeJson (verified grammar) to map SSE frames -> ContentBlock[].

import { OpenCodeServeError } from '../../errors.js'
import { catchDebug } from '../../lib/catch-logger.js'
import type { ContentBlock } from '../../schema/streaming.js'
import { parseOpencodeJson } from '../local-agent/local-agent-executor.js'
import type { OpencodeEvent, PermissionDecision } from './types.js'

/**
 * opencode v1.18.4 `POST /session` requires `model` as `{ id, providerID }` —
 * NOT a `providerID/modelID` slug string. Split on the first `/` and strip the
 * provider prefix from `id` (the server re-prefixes during resolution).
 * e.g. `opencode/deepseek-v4-flash-free` -> `{ id: 'deepseek-v4-flash-free', providerID: 'opencode' }`
 */
function modelRefFromSlug(
  slug: string | undefined,
): { id: string; providerID: string } | undefined {
  if (!slug) return undefined
  const slash = slug.indexOf('/')
  if (slash <= 0) return { id: slug, providerID: 'opencode' }
  return { id: slug.slice(slash + 1), providerID: slug.slice(0, slash) }
}

const HOSTNAME = '127.0.0.1'

/**
 * Map internal Governor decision vocabulary to the serve `permission.respond` /
 * `permission.reply` `response` enum. `allow` -> `once` (allow this one time),
 * `allow_always` -> `always` (persist the rule), `deny` -> `reject`.
 */
export function mapDecisionToResponse(decision: PermissionDecision): 'once' | 'always' | 'reject' {
  switch (decision) {
    case 'allow_always':
      return 'always'
    case 'deny':
      return 'reject'
    default:
      return 'once'
  }
}

export interface OpenCodeClientOptions {
  port: number
  password: string
  username?: string
  hostname?: string
  fetchImpl?: typeof fetch
}

export class OpenCodeClient {
  private readonly base: string
  private readonly auth: string
  private readonly f: typeof fetch
  private readonly controllers = new Map<string, AbortController>()

  constructor(opts: OpenCodeClientOptions) {
    const host = opts.hostname ?? HOSTNAME
    this.base = `http://${host}:${opts.port}`
    const raw = `${opts.username ?? 'opencode'}:${opts.password}`
    const b64 = typeof btoa === 'function' ? btoa(raw) : Buffer.from(raw).toString('base64')
    this.auth = `Basic ${b64}`
    this.f = opts.fetchImpl ?? fetch
  }

  private async req(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.f(`${this.base}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: this.auth },
    })
    if (!res.ok) {
      throw new OpenCodeServeError(
        'OPENCODE_HTTP',
        `${init.method ?? 'GET'} ${path} -> ${res.status}`,
      )
    }
    return res
  }

  async ready(): Promise<void> {
    const res = await this.f(`${this.base}/doc`, { headers: { Authorization: this.auth } })
    if (!res.ok) throw new OpenCodeServeError('OPENCODE_NOT_READY', 'GET /doc not 200')
  }

  async createSession(
    opts: { cwd?: string; model?: string; message?: string } = {},
  ): Promise<{ sessionId: string }> {
    // v1.18.4: `model` must be `{ id, providerID }`; `cwd`/`message` are not part of the
    // request schema (ignored by the server), so only send the model object.
    const res = await this.req('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelRefFromSlug(opts.model) }),
    })
    const data = (await res.json()) as { id?: string }
    if (!data.id)
      throw new OpenCodeServeError('OPENCODE_NO_SESSION_ID', 'POST /session returned no id')
    return { sessionId: data.id }
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<void> {
    // v1.18.4: `prompt_async` requires `parts` (array), not a bare `prompt` string.
    await this.req(`/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] }),
    })
  }

  /**
   * Blocking send — returns the full response as ContentBlock[].
   * Uses `POST /session/:id/message` with the `parts` body format.
   * v1.18.4 response shape: `{ info: {...}, parts: [{type:'text',text,...}, ...] }`.
   */
  async sendMessage(sessionId: string, text: string): Promise<{ blocks: ContentBlock[] }> {
    const res = await this.req(`/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text }] }),
    })
    const data: unknown = await res.json()
    const blocks: ContentBlock[] = Array.isArray(data)
      ? (data as ContentBlock[])
      : (this.blocksFromV18(data) ??
        (((data as Record<string, unknown>)?.blocks ??
          (data as Record<string, unknown>)?.content ??
          []) as ContentBlock[]))
    return { blocks }
  }

  /** Map the v1.18.4 `{ info, parts: [...] }` response to ContentBlock[] (text parts). */
  private blocksFromV18(data: unknown): ContentBlock[] | undefined {
    if (!data || typeof data !== 'object') return undefined
    const parts = (data as { parts?: unknown }).parts
    if (!Array.isArray(parts)) return undefined
    const blocks: ContentBlock[] = []
    for (const p of parts) {
      if (!p || typeof p !== 'object') continue
      const part = p as { type?: string; text?: string }
      if (part.type === 'text' && typeof part.text === 'string') {
        blocks.push({ type: 'text', text: part.text })
      }
    }
    return blocks
  }

  /**
   * Subscribe to the SSE event stream for a session. Returns an unsubscribe fn.
   * Each frame is parsed via parseOpencodeJson; non-event lines are skipped.
   */
  async subscribe(sessionId: string, onEvent: (ev: OpencodeEvent) => void): Promise<() => void> {
    const ac = new AbortController()
    this.controllers.set(sessionId, ac)
    const res = await this.req(`/event?session=${encodeURIComponent(sessionId)}`, {
      headers: { Accept: 'text/event-stream' },
      signal: ac.signal,
    })
    const reader = res.body?.getReader()
    if (!reader) throw new OpenCodeServeError('OPENCODE_NO_STREAM', 'GET /event returned no body')

    const decoder = new TextDecoder()
    let buf = ''
    const pump = async (): Promise<void> => {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let nl: number
          nl = buf.indexOf('\n')
          while (nl >= 0) {
            const line = buf.slice(0, nl).trim()
            buf = buf.slice(nl + 1)
            if (!line || line.startsWith(':')) {
              nl = buf.indexOf('\n')
              continue
            }
            this.dispatchFrame(line, onEvent)
            nl = buf.indexOf('\n')
          }
        }
      } catch (err) {
        catchDebug(err, 'engines:opencode:opencode-client:132')
        // stream closed / aborted — ignore
      }
    }
    void pump()
    return () => {
      ac.abort()
      this.controllers.delete(sessionId)
    }
  }

  private dispatchFrame(line: string, onEvent: (ev: OpencodeEvent) => void): void {
    // SSE: data: <json> ; we accept plain JSON lines too.
    const json = line.startsWith('data:') ? line.slice(5).trim() : line
    if (!json) return
    let parsed: OpencodeEvent
    try {
      parsed = JSON.parse(json) as OpencodeEvent
    } catch {
      return
    }
    onEvent(parsed)
  }

  /** Map a single raw event frame to ContentBlock[] (reuses the verified grammar). */
  static toBlocks(raw: string): ContentBlock[] {
    return parseOpencodeJson(raw).blocks
  }

  /**
   * v1.18.4 `permission.respond` body is `{ response: 'once'|'always'|'reject' }`
   * (NOT `{ decision }` — that vocabulary is an old TUI-format legacy). The path
   * parameter is the `^per` permission ID from `permission.asked` event `properties.id`.
   */
  async respondPermission(
    sessionId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void> {
    const response = mapDecisionToResponse(decision)
    await this.req(`/session/${sessionId}/permissions/${permissionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    })
  }

  async getDiff(sessionId: string): Promise<unknown> {
    const res = await this.req(`/session/${sessionId}/diff`)
    return res.json()
  }

  /**
   * List all serve sessions (`GET /session`). Authoritative source for
   * `cap:opencode:session.list` / `GET /api/opencode/sessions` (audit F4).
   * Shape (v1.18.4): `[{ id, slug, title, directory, model:{id,providerID}, tokens, time, version, agent }]`.
   */
  async listSessions(): Promise<Array<Record<string, unknown>>> {
    const res = await this.req('/session')
    const data = (await res.json()) as unknown
    return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
  }

  /**
   * Fetch the authoritative message transcript for a session
   * (`GET /session/:id/message`). Each entry: `{ info:{ id, sessionID, role,
   * parentID, time, modelID, providerID }, parts:[{ id, messageID, type, text }] }`.
   * Projecting from this transcript (instead of rebuilding from SSE deltas) yields
   * clean, correctly-ordered per-message text with both user and assistant roles.
   */
  async getSessionMessages(sessionId: string): Promise<Array<Record<string, unknown>>> {
    const res = await this.req(`/session/${encodeURIComponent(sessionId)}/message`)
    const data = (await res.json()) as unknown
    return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
  }
}
