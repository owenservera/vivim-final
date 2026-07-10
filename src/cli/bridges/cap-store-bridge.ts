// src/cli/bridges/cap-store-bridge.ts
// HTTP client bridge to cap-store REST API

export interface BridgeOptions {
  baseUrl: string
  authToken?: string
}

export class CapStoreBridge {
  private baseUrl: string
  private authToken?: string

  constructor(options: BridgeOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.authToken = options.authToken
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers(),
    })
    return res.json() as Promise<T>
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json() as Promise<T>
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json() as Promise<T>
  }

  async delete(path: string): Promise<void> {
    await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
    })
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
    }
  }
}
