// src/cli/bridges/backend-bridge.ts
// HTTP client bridge to Rust backend

export interface BackendBridgeOptions {
  baseUrl: string
}

export class BackendBridge {
  private baseUrl: string

  constructor(options: BackendBridgeOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`)
    return res.json() as Promise<T>
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json() as Promise<T>
  }
}
