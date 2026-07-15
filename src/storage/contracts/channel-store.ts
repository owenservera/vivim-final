// src/storage/contracts/channel-store.ts
// Phase 27.1 — Streaming Channel persistence contract.

export interface Channel {
  id: string
  providerId: string
  name?: string
  connected: boolean
  createdAt: number
}

export interface ChannelStore {
  save(channel: Channel): Promise<void>
  findById(id: string): Promise<Channel | null>
  findByProvider(providerId: string): Promise<Channel | null>
  list(providerId?: string): Promise<Channel[]>
  delete(id: string): Promise<void>
  setConnected(id: string, connected: boolean): Promise<void>
}
