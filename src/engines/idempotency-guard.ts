// src/engines/idempotency-guard.ts
// Unit 7.4 — Double-send protection: idempotency keys.

import type { SendResult } from './conversation-manager.js'

export interface IdempotencyPolicy {
  enabled: boolean
  windowMs: number
  keyStrategy: 'message_hash' | 'client_key' | 'message_hash+conversation'
  maxRecentKeys: number
  onDuplicate: 'reject' | 'return_cached' | 'allow'
}

interface CacheEntry {
  result: SendResult
  timestamp: number
}

const DEFAULT_POLICY: IdempotencyPolicy = {
  enabled: true,
  windowMs: 10_000,
  keyStrategy: 'message_hash+conversation',
  maxRecentKeys: 1000,
  onDuplicate: 'return_cached',
}

export class IdempotencyGuard {
  private recent = new Map<string, CacheEntry>()
  private policy: IdempotencyPolicy = DEFAULT_POLICY

  async check(
    conversationId: string,
    message: string,
  ): Promise<{ duplicate: boolean; cachedResult?: SendResult; key: string }> {
    if (!this.policy.enabled) return { duplicate: false, key: '' }

    const key = this.computeKey(conversationId, message)
    const now = Date.now()

    this.prune(now)

    const existing = this.recent.get(key)
    if (existing && now - existing.timestamp < this.policy.windowMs) {
      switch (this.policy.onDuplicate) {
        case 'reject':
          return { duplicate: true, key }
        case 'return_cached':
          return { duplicate: true, cachedResult: existing.result, key }
        case 'allow':
          return { duplicate: false, key }
      }
    }

    return { duplicate: false, key }
  }

  record(key: string, result: SendResult): void {
    this.recent.set(key, { result, timestamp: Date.now() })

    // Evict oldest if over limit
    if (this.recent.size > this.policy.maxRecentKeys) {
      const oldest = this.recent.keys().next().value
      if (oldest) this.recent.delete(oldest)
    }
  }

  private computeKey(conversationId: string, message: string): string {
    if (this.policy.keyStrategy === 'message_hash') {
      return simpleHash(message)
    }
    if (this.policy.keyStrategy === 'client_key') {
      return simpleHash(message)
    }
    // message_hash+conversation
    return `${conversationId}:${simpleHash(message)}`
  }

  private prune(now: number): void {
    for (const [key, entry] of this.recent) {
      if (now - entry.timestamp > this.policy.windowMs) {
        this.recent.delete(key)
      }
    }
  }
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return `h_${Math.abs(hash).toString(36)}`
}
