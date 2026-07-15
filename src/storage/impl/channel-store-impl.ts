// src/storage/impl/channel-store-impl.ts
// Phase 27.1 — In-memory ChannelStore implementation.

import type { Channel, ChannelStore } from '../contracts/channel-store.js'

export class InMemoryChannelStore implements ChannelStore {
  private channels = new Map<string, Channel>()
  private providerToId = new Map<string, string>()

  async save(channel: Channel): Promise<void> {
    this.channels.set(channel.id, channel)
    this.providerToId.set(channel.providerId, channel.id)
  }

  async findById(id: string): Promise<Channel | null> {
    return this.channels.get(id) ?? null
  }

  async findByProvider(providerId: string): Promise<Channel | null> {
    const id = this.providerToId.get(providerId)
    return id ? (this.channels.get(id) ?? null) : null
  }

  async list(providerId?: string): Promise<Channel[]> {
    const all = Array.from(this.channels.values())
    if (!providerId) return all
    return all.filter((c) => c.providerId === providerId)
  }

  async delete(id: string): Promise<void> {
    const channel = this.channels.get(id)
    if (channel) {
      this.channels.delete(id)
      this.providerToId.delete(channel.providerId)
    }
  }

  async setConnected(id: string, connected: boolean): Promise<void> {
    const channel = this.channels.get(id)
    if (channel) {
      channel.connected = connected
      this.channels.set(id, channel)
    }
  }
}
