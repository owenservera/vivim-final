// src/engines/live-capture-engine.ts
// LiveCaptureEngine — sends a test message into a provider's composer via CDP,
// captures the streaming response body through Network domain events, and returns
// the accumulated raw body for format analysis.
//
// Governor Canon: this engine never imports CDP directly. The CdpSender is
// injected as a narrow interface (send/on/off) by the caller.

import { EngineError } from '../errors.js'
import { catchDebug } from '../lib/catch-logger.js'
import type { CdpSender } from './protocol-discovery.js'
import type { StreamTransport } from './streaming-response-analyzer.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface LiveCaptureOptions {
  /** CSS selector for the message input element. */
  composerSelector: string
  /** CSS selector for the send button. Omit to use Enter key. */
  sendButtonSelector?: string
  /** How to submit the message. Defaults to 'click' if sendButtonSelector is provided. */
  sendMethod?: 'click' | 'enter'
  /** Message to type into the composer. Defaults to 'Hello'. */
  testMessage?: string
  /** Max time to wait for stream completion in ms. Defaults to 30_000. */
  captureTimeoutMs?: number
  /** Override for URL matching against network requests. */
  streamUrlPattern?: RegExp
}

export interface LiveCaptureResult {
  ok: boolean
  rawBody: string
  captureDurationMs: number
  networkUrl: string
  responseHeaders: Record<string, string>
  bytesCaptured: number
  detectedFormat: StreamTransport | 'json_stream'
  completionDetected: boolean
  error?: string
}

// ── Known streaming URL patterns (used as default filter) ───────────────────

const DEFAULT_STREAM_PATTERNS: RegExp[] = [
  /\/backend-api\/conversation/,
  /\/api\/chat\/completions/,
  /\/batchexecute/,
  /\/chat\/_\/BbswiieKhotGQuraeT1pUvQ:/, // Gemini batchexecute RPC
  /\/v1\/messages/, // Anthropic API
  /\/v1\/chat\/completions/, // OpenAI-compatible
  /\/mmt\/v1\//, // Mistral
  /sse\/|stream/i, // Generic SSE hints
]

// ── Helpers ────────────────────────────────────────────────────────────────

const COMPLETION_MARKERS = [
  '[DONE]',
  '"finish_reason"',
  '"done":true',
  'message_stop',
  'message_delta',
]

function detectFormatFromBody(body: string): StreamTransport | 'json_stream' {
  const trimmed = body.trim()
  if (/^(event|data):/m.test(trimmed) || trimmed.includes('\ndata:')) return 'sse'
  if (trimmed.startsWith(')]}\n')) return 'batchexecute'
  if (/^\{[\s\S]*\}$/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return 'websocket'
    } catch (err) {
      catchDebug(err, 'engines:live-capture-engine:73')
      /* fall through */
    }
  }
  const lines = trimmed.split('\n').filter(Boolean)
  if (lines.length > 1) {
    let allJson = true
    for (const l of lines.slice(0, 5)) {
      try {
        JSON.parse(l)
      } catch {
        allJson = false
        break
      }
    }
    if (allJson) return 'json_stream'
  }
  return 'sse' // default assumption
}

function hasCompletionMarker(body: string): boolean {
  return COMPLETION_MARKERS.some((m) => body.includes(m))
}

// ── LiveCaptureEngine ──────────────────────────────────────────────────────

export class LiveCaptureEngine {
  constructor(
    private client: CdpSender,
    private sessionId: string,
  ) {}

  /**
   * Type a test message into the composer, send it, and capture the streaming
   * response body via CDP Network domain events.
   */
  async captureResponse(opts: LiveCaptureOptions): Promise<LiveCaptureResult> {
    const startTime = Date.now()
    const testMessage = opts.testMessage ?? 'Hello'
    const captureTimeoutMs = opts.captureTimeoutMs ?? 30_000
    const streamUrlPattern = opts.streamUrlPattern ?? this.buildUrlPattern()

    // Internal capture state
    const bodyChunks: string[] = []
    let networkUrl = ''
    const responseHeaders: Record<string, string> = {}
    let completed = false
    let lastChunkTime = 0
    let totalBytes = 0

    // ── 1. Enable Network domain ───────────────────────────────────────────
    await this.client.send('Network.enable', {}, { sessionId: this.sessionId })

    // ── 2. Register event listeners ────────────────────────────────────────
    const onRequest = (params: unknown) => {
      const p = params as { request?: { url: string }; requestId?: string }
      if (p.request?.url && streamUrlPattern.test(p.request.url)) {
        networkUrl = p.request.url
      }
    }

    const onResponse = (params: unknown) => {
      const p = params as { response?: { headers?: Record<string, string> }; requestId?: string }
      if (p.response?.headers) {
        Object.assign(responseHeaders, p.response.headers)
      }
    }

    const onData = (params: unknown) => {
      const p = params as { data?: string; requestId?: string; dataLength?: number }
      if (p.data) {
        // CDP Network.dataReceived returns base64-encoded data
        try {
          const decoded = atob(p.data)
          bodyChunks.push(decoded)
          totalBytes += decoded.length
        } catch {
          // If not base64, treat as raw text
          bodyChunks.push(p.data)
          totalBytes += p.data.length
        }
        lastChunkTime = Date.now()
      }
    }

    this.client.on('Network.requestWillBeSent', onRequest)
    this.client.on('Network.responseReceived', onResponse)
    this.client.on('Network.dataReceived', onData)

    try {
      // ── 3. Type message into composer ─────────────────────────────────────
      await this.typeIntoComposer(testMessage, opts.composerSelector)

      // ── 4. Send message ───────────────────────────────────────────────────
      const sendMethod = opts.sendMethod ?? (opts.sendButtonSelector ? 'click' : 'enter')
      if (sendMethod === 'click' && opts.sendButtonSelector) {
        await this.clickSendButton(opts.sendButtonSelector)
      } else {
        await this.pressEnter(opts.composerSelector)
      }

      // ── 5. Wait for stream completion ─────────────────────────────────────
      const deadline = startTime + captureTimeoutMs
      while (Date.now() < deadline && !completed) {
        await this.sleep(100)

        const body = bodyChunks.join('')
        if (body.length > 0 && hasCompletionMarker(body)) {
          completed = true
          break
        }

        // 2-second silence heuristic: if we have data and no new chunks for 2s
        if (bodyChunks.length > 0 && Date.now() - lastChunkTime > 2_000) {
          completed = true
          break
        }
      }

      const rawBody = bodyChunks.join('')
      const duration = Date.now() - startTime

      return {
        ok: rawBody.length > 0,
        rawBody,
        captureDurationMs: duration,
        networkUrl,
        responseHeaders,
        bytesCaptured: totalBytes,
        detectedFormat: rawBody.length > 0 ? detectFormatFromBody(rawBody) : 'sse',
        completionDetected: completed,
        error: rawBody.length > 0 ? undefined : 'No streaming response captured',
      }
    } catch (err) {
      catchDebug(err, 'engines:live-capture-engine:206')
      return {
        ok: false,
        rawBody: bodyChunks.join(''),
        captureDurationMs: Date.now() - startTime,
        networkUrl,
        responseHeaders,
        bytesCaptured: totalBytes,
        detectedFormat: 'sse',
        completionDetected: false,
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      // ── 6. Clean up listeners ─────────────────────────────────────────────
      this.client.off('Network.requestWillBeSent', onRequest)
      this.client.off('Network.responseReceived', onResponse)
      this.client.off('Network.dataReceived', onData)
      try {
        await this.client.send('Network.disable', {}, { sessionId: this.sessionId })
      } catch (err) {
        catchDebug(err, 'engines:live-capture-engine:225')
        // Best effort — don't fail if disable fails
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async typeIntoComposer(message: string, selector: string): Promise<void> {
    // Probe the element to determine input type
    const probeResult = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(selector)})
          if (!el) return JSON.stringify({ error: 'selector_not_found', selector: ${JSON.stringify(selector)} })
          const tag = el.tagName.toLowerCase()
          const isContentEditable = el.contentEditable === 'true'
          const isQuill = el.classList.contains('ql-editor')
          const isProseMirror = el.classList.contains('ProseMirror')
          return JSON.stringify({ tag, isContentEditable, isQuill, isProseMirror })
        })()`,
        returnByValue: true,
      },
      { sessionId: this.sessionId },
    )) as { result?: { value?: string } }

    const probe = JSON.parse(probeResult.result?.value ?? '{}')
    if (probe.error) {
      throw new EngineError(
        'LiveCaptureError',
        `Composer not found: ${probe.error} (selector: ${probe.selector})`,
      )
    }

    let setExpression: string
    if (probe.tag === 'textarea') {
      // Standard textarea
      setExpression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        el.value = ${JSON.stringify(message)}
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      })()`
    } else if (probe.isQuill) {
      // Quill editor
      setExpression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        el.innerHTML = '<p>${message.replace(/'/g, "\\'")}</p>'
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })()`
    } else if (probe.isProseMirror) {
      // ProseMirror editor
      setExpression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        el.innerHTML = '<p>${message.replace(/'/g, "\\'")}</p>'
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })()`
    } else if (probe.isContentEditable) {
      // Generic contenteditable
      setExpression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        el.textContent = ${JSON.stringify(message)}
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })()`
    } else {
      // Fallback: try value assignment
      setExpression = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (el.value !== undefined) {
          el.value = ${JSON.stringify(message)}
          el.dispatchEvent(new Event('input', { bubbles: true }))
        } else {
          el.textContent = ${JSON.stringify(message)}
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })()`
    }

    await this.client.send(
      'Runtime.evaluate',
      { expression: setExpression },
      { sessionId: this.sessionId },
    )
  }

  private async clickSendButton(selector: string): Promise<void> {
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const btn = document.querySelector(${JSON.stringify(selector)})
          if (!btn) return JSON.stringify({ error: 'button_not_found' })
          btn.click()
          return JSON.stringify({ ok: true })
        })()`,
        returnByValue: true,
      },
      { sessionId: this.sessionId },
    )) as { result?: { value?: string } }

    const res = JSON.parse(result.result?.value ?? '{}')
    if (res.error) {
      throw new EngineError('LiveCaptureError', `Send button not found: ${res.error}`)
    }
  }

  private async pressEnter(composerSelector: string): Promise<void> {
    await this.client.send(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(composerSelector)})
          if (!el) return
          el.focus()
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }))
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }))
        })()`,
      },
      { sessionId: this.sessionId },
    )
  }

  private buildUrlPattern(): RegExp {
    // Combine all known patterns into one regex
    const combined = DEFAULT_STREAM_PATTERNS.map((r) => r.source).join('|')
    return new RegExp(combined, 'i')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
