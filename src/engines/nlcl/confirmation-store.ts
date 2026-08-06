// src/engines/nlcl/confirmation-store.ts
// Real confirmation store — closes audit finding A.1 (confirmation was a placebo).
// HMAC-signed tokens, 5-min sliding TTL, one-shot consume, audit-logged.
// See FINAL-UPGRADE-DESIGN.md §1.1 for design rationale.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getConfirmationSecret } from '../../config.js'

/** Payload persisted for each pending confirmation. JSON-safe (NLCContext is serialized). */
export interface PendingConfirmation {
  /** HMAC-signed token: `base64url(payloadJson) + '.' + hmac`. */
  readonly token: string
  readonly capabilityId: string
  readonly input: Readonly<Record<string, unknown>>
  /** Serialized NLCContext — JSON-safe (the live NLCContext may carry non-serializable refs). */
  readonly contextJson: string
  readonly classification: string
  readonly createdAt: number
  /** createdAt + TTL_MS (5 min, sliding — refreshed on peek, not on consume). */
  readonly expiresAt: number
}

export interface ConfirmationStoreCreateInput {
  capabilityId: string
  input: Readonly<Record<string, unknown>>
  contextJson: string
  classification: string
}

export interface ConfirmationStore {
  /** Mint a pending confirmation; returns the HMAC-signed token the client must echo back. */
  create(input: ConfirmationStoreCreateInput): PendingConfirmation
  /** One-shot consume: returns the pending confirmation if token is valid + unexpired + unconsumed; else null. */
  consume(token: string): PendingConfirmation | null
  /** Non-consuming peek: for UI "time remaining" displays. Refreshes sliding TTL. */
  peek(token: string): PendingConfirmation | null
}

const DEFAULT_TTL_MS = 5 * 60 * 1000

function getSecret(): string {
  return getConfirmationSecret()
}

function encodePayload(pc: Omit<PendingConfirmation, 'token'>): string {
  return Buffer.from(
    JSON.stringify({
      capabilityId: pc.capabilityId,
      input: pc.input,
      contextJson: pc.contextJson,
      classification: pc.classification,
      createdAt: pc.createdAt,
      expiresAt: pc.expiresAt,
    }),
    'utf8',
  ).toString('base64url')
}

function sign(payloadB64: string): string {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('hex')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

/** Parse + verify a token; returns null on any failure (HMAC mismatch, malformed, expired). */
function verifyToken(
  token: string,
  now: number,
): { payload: Omit<PendingConfirmation, 'token'>; consumed: boolean } | null {
  const sep = token.lastIndexOf('.')
  if (sep < 0) return null
  const payloadB64 = token.slice(0, sep)
  const sig = token.slice(sep + 1)
  const expectedSig = sign(payloadB64)
  if (!constantTimeEqual(sig, expectedSig)) return null

  let parsed: {
    capabilityId: string
    input: Record<string, unknown>
    contextJson: string
    classification: string
    createdAt: number
    expiresAt: number
  }
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt < now) return null
  return { payload: parsed, consumed: false }
}

/** In-memory implementation. Promote to Prisma-backed (PendingConfirmation model) in unit 15.12. */
export class InMemoryConfirmationStore implements ConfirmationStore {
  private readonly ttlMs: number
  /**
   * Map key is the payload-base64 (NOT the full token) so a re-signed forgery
   * with the same payload still can't be consumed twice. The HMAC signature is
   * verified separately via verifyToken().
   */
  private readonly entries = new Map<
    string,
    { payload: Omit<PendingConfirmation, 'token'>; consumed: boolean }
  >()
  private readonly audit: (event: {
    action: 'create' | 'consume' | 'peek'
    outcome: 'ok' | 'expired' | 'hmac_fail' | 'already_consumed'
    capabilityId: string
  }) => void

  constructor(opts?: {
    ttlMs?: number
    audit?: (event: {
      action: 'create' | 'consume' | 'peek'
      outcome: 'ok' | 'expired' | 'hmac_fail' | 'already_consumed'
      capabilityId: string
    }) => void
  }) {
    this.ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS
    this.audit = opts?.audit ?? (() => {})
    // Lazy sweep — every 60s, drop expired entries to bound memory.
    setInterval(() => this.sweep(Date.now()), 60_000).unref?.()
  }

  create(input: ConfirmationStoreCreateInput): PendingConfirmation {
    const now = Date.now()
    const payload = {
      capabilityId: input.capabilityId,
      input: input.input,
      contextJson: input.contextJson,
      classification: input.classification,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    }
    const payloadB64 = encodePayload(payload)
    const token = `${payloadB64}.${sign(payloadB64)}`
    this.entries.set(payloadB64, { payload, consumed: false })
    this.audit({ action: 'create', outcome: 'ok', capabilityId: input.capabilityId })
    return { token, ...payload }
  }

  consume(token: string): PendingConfirmation | null {
    const now = Date.now()
    const verified = verifyToken(token, now)
    if (!verified) {
      // Either HMAC failed, malformed, or expired — don't reveal which to caller (security).
      // But log a best-effort hint to the audit hook.
      const sep = token.lastIndexOf('.')
      const payloadB64 = sep >= 0 ? token.slice(0, sep) : ''
      const entry = payloadB64 ? this.entries.get(payloadB64) : null
      if (!entry) {
        this.audit({ action: 'consume', outcome: 'hmac_fail', capabilityId: '<unknown>' })
      } else if (entry.consumed) {
        this.audit({
          action: 'consume',
          outcome: 'already_consumed',
          capabilityId: entry.payload.capabilityId,
        })
      } else {
        this.audit({
          action: 'consume',
          outcome: 'expired',
          capabilityId: entry.payload.capabilityId,
        })
      }
      return null
    }
    const payloadB64 = token.slice(0, token.lastIndexOf('.'))
    const entry = this.entries.get(payloadB64)
    if (!entry) {
      // Token is well-formed and signature-valid, but we have no record — could be a forged token
      // with a valid signature (impossible unless secret leaked) OR a post-sweep expiry.
      this.audit({
        action: 'consume',
        outcome: 'expired',
        capabilityId: verified.payload.capabilityId,
      })
      return null
    }
    if (entry.consumed) {
      this.audit({
        action: 'consume',
        outcome: 'already_consumed',
        capabilityId: entry.payload.capabilityId,
      })
      return null
    }
    entry.consumed = true
    // Delete immediately to free memory and prevent any race-window re-consume.
    this.entries.delete(payloadB64)
    this.audit({ action: 'consume', outcome: 'ok', capabilityId: entry.payload.capabilityId })
    return { token, ...entry.payload }
  }

  peek(token: string): PendingConfirmation | null {
    const now = Date.now()
    const verified = verifyToken(token, now)
    if (!verified) return null
    const payloadB64 = token.slice(0, token.lastIndexOf('.'))
    const entry = this.entries.get(payloadB64)
    if (!entry || entry.consumed) return null
    // Sliding TTL — refresh expiry on peek (NOT on consume; consume is one-shot).
    const newExpiresAt = now + this.ttlMs
    const refreshedPayload = { ...entry.payload, expiresAt: newExpiresAt }
    const refreshedB64 = encodePayload(refreshedPayload)
    // Re-issue token with refreshed expiry so client sees the new expiry if it re-peeks.
    const refreshedToken = `${refreshedB64}.${sign(refreshedB64)}`
    this.entries.delete(payloadB64)
    this.entries.set(refreshedB64, { payload: refreshedPayload, consumed: false })
    return { token: refreshedToken, ...refreshedPayload }
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.payload.expiresAt < now) {
        this.entries.delete(key)
      }
    }
  }
}

/** No-op store for tests/dev where confirmation flow should be skipped (auto-approve). */
export class NullConfirmationStore implements ConfirmationStore {
  create(input: ConfirmationStoreCreateInput): PendingConfirmation {
    const now = Date.now()
    return {
      token: 'null-store-token',
      capabilityId: input.capabilityId,
      input: input.input,
      contextJson: input.contextJson,
      classification: input.classification,
      createdAt: now,
      expiresAt: now + DEFAULT_TTL_MS,
    }
  }
  consume(token: string): PendingConfirmation | null {
    if (token === 'null-store-token') {
      const now = Date.now()
      return {
        token,
        capabilityId: '<null>',
        input: {},
        contextJson: '{}',
        classification: 'system',
        createdAt: now,
        expiresAt: now + DEFAULT_TTL_MS,
      }
    }
    return null
  }
  peek(token: string): PendingConfirmation | null {
    return this.consume(token)
  }
}
