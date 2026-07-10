// sdk/src/client.ts
// Fully typed TypeScript SDK client for vivim-final REST API

import { CapStoreError } from '../../src/errors.js'

export interface CapStoreClientOptions {
  baseUrl: string
  authToken?: string
}

export class CapStoreClient {
  private baseUrl: string
  private authToken?: string

  constructor(options: CapStoreClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.authToken = options.authToken
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = (await res.json()) as { error: string; code: string; details?: unknown }
      throw new CapStoreError(err.error, err.code, res.status, err.details)
    }
    return res.json() as Promise<T>
  }

  // ── Providers ──────────────────────────────────────────────────────────

  async providers(): Promise<unknown[]> {
    return this.request<unknown[]>('GET', '/api/providers')
  }

  async provider(id: string): Promise<unknown> {
    return this.request<unknown>('GET', `/api/providers/${id}`)
  }

  async providerHealth(id: string): Promise<unknown> {
    return this.request<unknown>('GET', `/api/providers/${id}/health`)
  }

  async providerAccounts(providerId: string): Promise<unknown[]> {
    return this.request<unknown[]>('GET', `/api/providers/${providerId}/accounts`)
  }

  async providerAccount(providerId: string, accountId: string): Promise<unknown> {
    return this.request<unknown>('GET', `/api/providers/${providerId}/accounts/${accountId}`)
  }

  async createAccount(providerId: string, email: string): Promise<unknown> {
    return this.request<unknown>('POST', `/api/providers/${providerId}/accounts`, { email })
  }

  async deleteAccount(providerId: string, accountId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/providers/${providerId}/accounts/${accountId}`)
  }

  async setDefaultAccount(providerId: string, accountId: string): Promise<void> {
    await this.request<void>('POST', `/api/providers/${providerId}/accounts/${accountId}/default`)
  }

  async providerCapabilities(providerId: string, planTier?: string): Promise<unknown> {
    const qs = planTier ? `?planTier=${planTier}` : ''
    return this.request<unknown>('GET', `/api/providers/${providerId}/capabilities${qs}`)
  }

  async searchCapabilities(providerId: string, query: string, planTier?: string): Promise<unknown> {
    return this.request<unknown>('POST', `/api/providers/${providerId}/capabilities/search`, { query, planTier })
  }

  // ── Fleet ──────────────────────────────────────────────────────────────

  async fleetStatus(): Promise<unknown[]> {
    return this.request<unknown[]>('GET', '/api/fleet/status')
  }

  async fleetStart(providerId: string, accountId: string): Promise<unknown> {
    return this.request<unknown>('POST', '/api/fleet/start', { providerId, accountId })
  }

  async fleetStop(providerId: string, accountId: string): Promise<void> {
    await this.request<void>('POST', '/api/fleet/stop', { providerId, accountId })
  }

  // ── Conversations ──────────────────────────────────────────────────────

  async conversations(opts?: { providerId?: string; limit?: number; offset?: number }): Promise<unknown[]> {
    const params = new URLSearchParams()
    if (opts?.providerId) params.set('providerId', opts.providerId)
    if (opts?.limit != null) params.set('limit', String(opts.limit))
    if (opts?.offset != null) params.set('offset', String(opts.offset))
    const qs = params.toString() ? `?${params.toString()}` : ''
    return this.request<unknown[]>('GET', `/api/conversations${qs}`)
  }

  async createConversation(providerId: string, title?: string): Promise<unknown> {
    return this.request<unknown>('POST', '/api/conversations', { providerId, title })
  }

  async getConversation(id: string): Promise<unknown> {
    return this.request<unknown>('GET', `/api/conversations/${id}`)
  }

  async updateConversation(id: string, patch: { title?: string; state?: string }): Promise<unknown> {
    return this.request<unknown>('PATCH', `/api/conversations/${id}`, patch)
  }

  async deleteConversation(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/conversations/${id}`)
  }

  async sendMessage(conversationId: string, message: string): Promise<unknown> {
    return this.request<unknown>('POST', `/api/conversations/${conversationId}/send`, { message })
  }

  async getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<unknown[]> {
    const params = new URLSearchParams()
    if (opts?.limit != null) params.set('limit', String(opts.limit))
    if (opts?.before) params.set('before', opts.before)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return this.request<unknown[]>('GET', `/api/conversations/${conversationId}/messages${qs}`)
  }

  // ── Admin ──────────────────────────────────────────────────────────────

  async seed(source?: string): Promise<unknown> {
    const qs = source ? `?source=${source}` : ''
    return this.request<unknown>('POST', `/api/admin/seed${qs}`)
  }

  async wipe(): Promise<void> {
    await this.request<void>('POST', '/api/admin/wipe')
  }

  // ── Config ─────────────────────────────────────────────────────────────

  async getConfig(engineId: string): Promise<unknown> {
    return this.request<unknown>('GET', `/api/config/${engineId}`)
  }

  async updateConfig(engineId: string, config: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>('PUT', `/api/config/${engineId}`, { config })
  }

  async getConfigHistory(engineId: string, limit?: number): Promise<unknown[]> {
    const qs = limit != null ? `?limit=${limit}` : ''
    return this.request<unknown[]>('GET', `/api/config/${engineId}/history${qs}`)
  }

  // ── Telemetry ──────────────────────────────────────────────────────────

  async getHealthTrend(providerId: string, days?: number): Promise<unknown> {
    const qs = days != null ? `?days=${days}` : ''
    return this.request<unknown>('GET', `/api/telemetry/health/${providerId}${qs}`)
  }

  // ── WebSocket ──────────────────────────────────────────────────────────

  connectWebSocket(): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws')
    return new WebSocket(wsUrl)
  }
}
