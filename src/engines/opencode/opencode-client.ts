// src/engines/opencode/opencode-client.ts
// OpenCodeClient — talks the `opencode serve` HTTP/SSE API (feature 027).
// Reuses parseOpencodeJson (verified grammar) to map SSE frames -> ContentBlock[].

import { OpenCodeServeError } from '../../errors.js'
import { catchDebug } from '../../lib/catch-logger.js'
import type { ContentBlock } from '../../schema/streaming.js'
import { parseOpencodeJson } from '../local-agent/local-agent-executor.js'
import type { OpencodeEvent, PermissionDecision } from './types.js'

const HOSTNAME = '127.0.0.1'

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
    const res = await this.req('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd: opts.cwd, model: opts.model, message: opts.message }),
    })
    const data = (await res.json()) as { id?: string }
    if (!data.id)
      throw new OpenCodeServeError('OPENCODE_NO_SESSION_ID', 'POST /session returned no id')
    return { sessionId: data.id }
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<void> {
    await this.req(`/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
  }

  /**
   * Blocking send — returns the full response as ContentBlock[].
   * Uses `POST /session/:id/message` with the `parts` body format
   * (opencode v1.17.15 official API, verified 2026-07-19).
   */
  async sendMessage(sessionId: string, text: string): Promise<{ blocks: ContentBlock[] }> {
    const res = await this.req(`/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text }] }),
    })
    // The /message endpoint returns ContentBlock[] directly (not wrapped).
    const data: unknown = await res.json()
    const blocks: ContentBlock[] = Array.isArray(data)
      ? data
      : (((data as Record<string, unknown>)?.blocks ??
          (data as Record<string, unknown>)?.content ??
          []) as ContentBlock[])
    return { blocks }
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

  async respondPermission(
    sessionId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void> {
    await this.req(`/session/${sessionId}/permissions/${permissionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
  }

  async getDiff(sessionId: string): Promise<unknown> {
    const res = await this.req(`/session/${sessionId}/diff`)
    return res.json()
  }
}
