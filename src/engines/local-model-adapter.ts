// src/engines/local-model-adapter.ts
// LocalModelAdapter — adapter for local LLM backends (Ollama, llama.cpp).
// Routes inference requests when air-gap mode is enabled or local inference is preferred.

// ── Types ───────────────────────────────────────────────────────────────

import { EngineError } from '../errors.js'

export type LocalModelProvider = 'ollama' | 'llamacpp' | 'none'

export interface LocalModelConfig {
  provider: LocalModelProvider
  endpoint: string // e.g., http://localhost:11434
  model: string // e.g., llama3, codellama
  timeoutMs: number
  maxTokens: number
  temperature: number
}

export interface LocalModelResponse {
  ok: boolean
  response: string
  model: string
  promptEvalCount: number
  evalCount: number
  durationMs: number
  error?: string
}

// ── Adapter ─────────────────────────────────────────────────────────────

export class LocalModelAdapter {
  private config: LocalModelConfig

  constructor(config: LocalModelConfig) {
    this.config = config
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
      const res = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) return false
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      const models = data.models ?? []
      return models.some((m) => m.name === this.config.model)
    } catch {
      return false
    }
  }

  async generate(prompt: string): Promise<LocalModelResponse> {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
      const res = await fetch(`${this.config.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) {
        return {
          ok: false,
          response: '',
          model: this.config.model,
          promptEvalCount: 0,
          evalCount: 0,
          durationMs: Date.now() - start,
          error: `HTTP ${res.status}`,
        }
      }
      const data = (await res.json()) as {
        response?: string
        prompt_eval_count?: number
        eval_count?: number
      }
      return {
        ok: true,
        response: data.response ?? '',
        model: this.config.model,
        promptEvalCount: data.prompt_eval_count ?? 0,
        evalCount: data.eval_count ?? 0,
        durationMs: Date.now() - start,
      }
    } catch (err) {
      return {
        ok: false,
        response: '',
        model: this.config.model,
        promptEvalCount: 0,
        evalCount: 0,
        durationMs: Date.now() - start,
        error: String(err),
      }
    }
  }

  async *generateStream(prompt: string): AsyncGenerator<string> {
    const res = await fetch(`${this.config.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: true,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
        },
      }),
    })
    if (!res.ok) throw new EngineError(`HTTP ${res.status}`)
    if (!res.body) throw new EngineError('No response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line) as { response?: string }
          if (chunk.response) yield chunk.response
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
      const res = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) return []
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      return (data.models ?? []).map((m) => m.name)
    } catch {
      return []
    }
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
      const res = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return { ok: res.ok, latencyMs: Date.now() - start }
    } catch {
      return { ok: false, latencyMs: Date.now() - start }
    }
  }
}
