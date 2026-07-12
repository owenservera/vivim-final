// ── Types ───────────────────────────────────────────────────────────────

export interface AirGapConfig {
  enabled: boolean
  localModelEndpoint: string
  localModelProvider: string
}

export interface AirGapStatus {
  isAirGapMode: boolean
  networkReachable: boolean
  localModelAvailable: boolean
  localModelName: string
  cachedResponses: number
}

export interface LocalModelRouteResult {
  ok: boolean
  response: string
  error?: string
}

// ── Engine ──────────────────────────────────────────────────────────────

export class AirGapEngine {
  private airGapMode
  private networkReachable = false
  private localModelAvailable = false
  private localModelName = ''
  private responseCache: Map<string, string> = new Map()
  private config: AirGapConfig

  constructor(config: AirGapConfig) {
    this.config = config
    this.airGapMode = config.enabled
  }

  async enable(): Promise<void> {
    this.airGapMode = true
    await this.checkLocalModel()
  }

  async disable(): Promise<void> {
    this.airGapMode = false
  }

  async getStatus(): Promise<AirGapStatus> {
    return {
      isAirGapMode: this.airGapMode,
      networkReachable: this.networkReachable,
      localModelAvailable: this.localModelAvailable,
      localModelName: this.localModelName,
      cachedResponses: this.responseCache.size,
    }
  }

  async checkNetwork(): Promise<boolean> {
    try {
      // Lightweight DNS probe — does NOT send data to external services
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      await fetch('https://dns.google/resolve?name=example.com&type=A', {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      this.networkReachable = true
    } catch {
      this.networkReachable = false
    }
    return this.networkReachable
  }

  async checkLocalModel(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`${this.config.localModelEndpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) {
        this.localModelAvailable = false
        return false
      }
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      this.localModelAvailable = true
      this.localModelName = data.models?.[0]?.name ?? 'unknown'
      return true
    } catch {
      this.localModelAvailable = false
      return false
    }
  }

  async routeToLocalModel(message: string): Promise<LocalModelRouteResult> {
    if (!this.airGapMode) {
      return { ok: false, response: '', error: 'AirGap mode is disabled — use cloud provider' }
    }
    if (!this.localModelAvailable) {
      const ok = await this.checkLocalModel()
      if (!ok) {
        return { ok: false, response: '', error: 'Local model not available' }
      }
    }
    // Check cache first
    const cached = this.responseCache.get(message)
    if (cached) return { ok: true, response: cached }
    try {
      const res = await fetch(`${this.config.localModelEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.localModelName,
          prompt: message,
          stream: false,
        }),
      })
      if (!res.ok) {
        return { ok: false, response: '', error: `Local model HTTP ${res.status}` }
      }
      const data = (await res.json()) as { response?: string }
      const response = data.response ?? ''
      this.responseCache.set(message, response)
      return { ok: true, response }
    } catch (err) {
      return { ok: false, response: '', error: String(err) }
    }
  }
}
