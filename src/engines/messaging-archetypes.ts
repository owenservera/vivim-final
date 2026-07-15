// src/engines/messaging-archetypes.ts
// Phase 27.2 — Messaging Provider Archetypes

export interface NormalizedMessage {
  channelId: string
  author: string
  text: string
  ts: number
  threadId?: string
}

export interface MessagingArchetype {
  providerId: string
  loginUrl: string
  pollStrategy: 'webhook' | 'polling' | 'cdp-scrape'
  normalize(msg: unknown): NormalizedMessage
}

export const MESSAGING_ARCHETYPES: Record<string, MessagingArchetype> = {
  whatsapp: {
    providerId: 'whatsapp',
    loginUrl: 'https://web.whatsapp.com',
    pollStrategy: 'cdp-scrape',
    normalize: (msg: unknown) => {
      const m = msg as { from?: string; body?: string; timestamp?: number; id?: string }
      return {
        channelId: 'whatsapp',
        author: m.from ?? 'unknown',
        text: m.body ?? '',
        ts: m.timestamp ?? Date.now(),
        threadId: m.id,
      }
    },
  },
  facebook: {
    providerId: 'facebook',
    loginUrl: 'https://www.facebook.com/messages',
    pollStrategy: 'cdp-scrape',
    normalize: (msg: unknown) => {
      const m = msg as { from?: string; message?: string; time?: number }
      return {
        channelId: 'facebook',
        author: m.from ?? 'unknown',
        text: m.message ?? '',
        ts: m.time ?? Date.now(),
      }
    },
  },
  telegram: {
    providerId: 'telegram',
    loginUrl: '',
    pollStrategy: 'polling',
    normalize: (msg: unknown) => {
      const m = msg as {
        chat?: { id: number }
        from?: { username?: string; first_name?: string }
        text?: string
        date?: number
      }
      return {
        channelId: `telegram:${m.chat?.id ?? 'unknown'}`,
        author: m.from?.username ?? m.from?.first_name ?? 'unknown',
        text: m.text ?? '',
        ts: m.date ?? Date.now(),
      }
    },
  },
  slack: {
    providerId: 'slack',
    loginUrl: '',
    pollStrategy: 'webhook',
    normalize: (msg: unknown) => {
      const m = msg as { channel?: string; user?: string; text?: string; ts?: number }
      return {
        channelId: m.channel ?? 'unknown',
        author: m.user ?? 'unknown',
        text: m.text ?? '',
        ts: m.ts ?? Date.now(),
      }
    },
  },
  dispatch: {
    providerId: 'dispatch',
    loginUrl: '',
    pollStrategy: 'webhook',
    normalize: (msg: unknown) => {
      const m = msg as { source?: string; sender?: string; body?: string; created?: string }
      return {
        channelId: m.source ?? 'dispatch',
        author: m.sender ?? 'unknown',
        text: m.body ?? '',
        ts: m.created ? new Date(m.created).getTime() : Date.now(),
      }
    },
  },
}
