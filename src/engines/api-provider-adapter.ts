// src/engines/api-provider-adapter.ts
// Unit 5.3 — API-direct providers (OpenAI, Anthropic, OpenRouter)

import { EngineError } from '../errors.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiProviderConfig {
  baseUrl: string
  keyRef: string
  providerId: string
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class ApiProviderAdapter {
  constructor(private cfg: ApiProviderConfig) {}

  async send(message: string, model: string, onToken: (t: string) => void): Promise<string> {
    const key = process.env[this.cfg.keyRef]
    if (!key) {
      throw new EngineError(`Missing API key for ${this.cfg.providerId} (${this.cfg.keyRef})`)
    }

    const res = await fetch(this.cfg.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: message }],
        stream: true,
      }),
    })

    if (!res.ok) {
      throw new EngineError(`API call failed for ${this.cfg.providerId}: ${res.status}`)
    }

    // Parse SSE stream and fan tokens to onToken callback
    return this.parseSseStream(res.body, onToken)
  }

  private async parseSseStream(
    body: NodeJS.ReadableStream | null,
    onToken: (t: string) => void,
  ): Promise<string> {
    if (!body) throw new EngineError('No response body')
    const reader = body.getReader()
    const decoder = new TextDecoder()
    const allTokens: string[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        const m = line.match(/^data: (.+)$/)
        if (m) {
          const data = m[1]
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const token = json.choices?.[0]?.delta?.content ?? ''
            if (token) {
              onToken(token)
              allTokens.push(token)
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }
    return allTokens.join('')
  }
}
