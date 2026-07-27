// src/engines/nlcl/dialogue-session-store.ts
// Tier 3 unit 15.5 — DialogueSessionStore.
//
// Closes audit findings:
//   ❌-8 commentary: 30-min sliding TTL (longer than ConfirmationStore's 5-min
//   because dialogue turns legitimately span minutes, not seconds).
//   A.6 commentary: key falls back to sessionId when conversationId is undefined
//   so single-shot CLI commands still get state.
//
// Purpose:
//   Persist the engine's per-turn state (lastSubject, lastProviderId, pending
//   clarification, last-resolved intent) so the NEXT turn can:
//     • Resolve pronouns ("it" → lastSubject, see context-binder.ts)
//     • Resume pending clarification flows ("the conversation" → ctx.conversationId)
//     • Detect follow-up clarifications ("yes" → confirm pending token)
//
// Implementation:
//   In-memory Map<sessionKey, DialogueSession>. Promote to Prisma-backed
//   (DialoguePendingTurn model) in unit 15.12. Sliding TTL = 30 min by default,
//   refreshed on every write. Background sweep every 60s to bound memory.
//
// Why not just write to ctx.metadata in-process? Because between turns the
// engine instance is destroyed (HTTP is stateless). We need a store that
// survives the request boundary but is short-lived enough to not leak memory.

import { newId } from '../../ids.js'

/** Per-dialogue persistent state. Lives across requests, expires after TTL. */
export interface DialogueSession {
  /** Stable key: `conv:<conversationId>` or `session:<sessionId>` or `user:<userId>` (first non-empty wins). */
  readonly sessionKey: string
  /** Most recently referenced entity (for pronoun resolution — audit A.6). */
  lastSubject: string | null
  /** Most recently active provider (for "use claude instead" follow-ups). */
  lastProviderId: string | null
  /** Most recently resolved intent (for "do it again" follow-ups). */
  lastIntent: string | null
  /** Most recently issued confirmation token (for "yes"/"confirm" follow-ups). */
  pendingConfirmationToken: string | null
  /** Most recently issued clarification prompt (for "yes, use X" follow-ups). */
  pendingClarification: {
    prompt: string
    missing?: string[]
    ambiguous?: string[]
    options?: string[]
  } | null
  /** Total turns in this dialogue (for analytics + budget enforcement). */
  turnCount: number
  /** ISO timestamps for TTL + debugging. */
  createdAt: number
  updatedAt: number
  /** updatedAt + ttlMs. */
  expiresAt: number
}

export interface DialogueSessionStore {
  /** Get the session for the given key, or null if missing/expired. Refreshes sliding TTL. */
  get(sessionKey: string): DialogueSession | null
  /** Upsert a field on the session (creates if missing). Returns the updated session. */
  update(
    sessionKey: string,
    patch: Partial<Omit<DialogueSession, 'sessionKey' | 'createdAt' | 'expiresAt' | 'updatedAt'>>,
  ): DialogueSession
  /** Reset a session (called on /api/nlcl/reset or after explicit "forget"). */
  clear(sessionKey: string): void
  /** Number of active sessions (for diagnostics). */
  size(): number
}

const DEFAULT_TTL_MS = 30 * 60 * 1000 // 30 minutes
const DEFAULT_SWEEP_MS = 60_000

/**
 * Compute the dialogue session key from an NLCContext.
 * Priority: conversationId > activeSessionId > slaveId > userId.
 * Falls back to a synthetic 'anonymous' key only if all are missing.
 */
export function computeDialogueSessionKey(ctx: {
  conversationId?: string
  activeSessionId?: string
  slaveId?: string
  userId?: string
}): string {
  if (ctx.conversationId) return `conv:${ctx.conversationId}`
  if (ctx.activeSessionId) return `session:${ctx.activeSessionId}`
  if (ctx.slaveId) return `slave:${ctx.slaveId}`
  if (ctx.userId) return `user:${ctx.userId}`
  return 'anonymous'
}

export interface InMemoryDialogueSessionStoreOpts {
  ttlMs?: number
  sweepMs?: number
  /** Optional audit hook for create/update/expire events. */
  audit?: (event: {
    action: 'create' | 'update' | 'expire' | 'clear'
    sessionKey: string
    field?: string
  }) => void
}

export class InMemoryDialogueSessionStore implements DialogueSessionStore {
  private readonly ttlMs: number
  private readonly sweepMs: number
  private readonly audit: NonNullable<InMemoryDialogueSessionStoreOpts['audit']>
  private readonly sessions = new Map<string, DialogueSession>()

  constructor(opts?: InMemoryDialogueSessionStoreOpts) {
    this.ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS
    this.sweepMs = opts?.sweepMs ?? DEFAULT_SWEEP_MS
    this.audit = opts?.audit ?? (() => {})
    setInterval(() => this.sweep(Date.now()), this.sweepMs).unref?.()
  }

  get(sessionKey: string): DialogueSession | null {
    const session = this.sessions.get(sessionKey)
    if (!session) return null
    const now = Date.now()
    if (session.expiresAt < now) {
      this.sessions.delete(sessionKey)
      this.audit({ action: 'expire', sessionKey })
      return null
    }
    // Sliding TTL — refresh on read.
    const refreshed: DialogueSession = {
      ...session,
      updatedAt: now,
      expiresAt: now + this.ttlMs,
    }
    this.sessions.set(sessionKey, refreshed)
    return refreshed
  }

  update(
    sessionKey: string,
    patch: Partial<Omit<DialogueSession, 'sessionKey' | 'createdAt' | 'expiresAt' | 'updatedAt'>>,
  ): DialogueSession {
    const now = Date.now()
    const existing = this.get(sessionKey)
    if (existing) {
      const updated: DialogueSession = {
        ...existing,
        ...patch,
        updatedAt: now,
        expiresAt: now + this.ttlMs,
      }
      this.sessions.set(sessionKey, updated)
      // Best-effort audit per changed field.
      for (const key of Object.keys(patch)) {
        this.audit({ action: 'update', sessionKey, field: key })
      }
      return updated
    }
    const created: DialogueSession = {
      sessionKey,
      lastSubject: null,
      lastProviderId: null,
      lastIntent: null,
      pendingConfirmationToken: null,
      pendingClarification: null,
      turnCount: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + this.ttlMs,
      ...patch,
    }
    this.sessions.set(sessionKey, created)
    this.audit({ action: 'create', sessionKey })
    return created
  }

  clear(sessionKey: string): void {
    if (this.sessions.delete(sessionKey)) {
      this.audit({ action: 'clear', sessionKey })
    }
  }

  size(): number {
    return this.sessions.size
  }

  private sweep(now: number): void {
    for (const [key, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(key)
        this.audit({ action: 'expire', sessionKey: key })
      }
    }
  }
}

/** No-op store for tests where dialogue state should be isolated per-turn. */
export class NullDialogueSessionStore implements DialogueSessionStore {
  get(): null {
    return null
  }
  update(sessionKey: string, patch: Partial<DialogueSession>): DialogueSession {
    const now = Date.now()
    return {
      sessionKey,
      lastSubject: patch.lastSubject ?? null,
      lastProviderId: patch.lastProviderId ?? null,
      lastIntent: patch.lastIntent ?? null,
      pendingConfirmationToken: patch.pendingConfirmationToken ?? null,
      pendingClarification: patch.pendingClarification ?? null,
      turnCount: patch.turnCount ?? 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + DEFAULT_TTL_MS,
    }
  }
  clear(): void {
    // no-op
  }
  size(): number {
    return 0
  }
}

/**
 * Resume a pending turn from the dialogue session, if any.
 *
 * Cases handled:
 * 1. User said "yes" / "confirm" / "ok" AND pendingConfirmationToken exists
 *    → returns { kind: 'confirm', token } so the engine can call confirmationStore.consume().
 * 2. User provided a value for a pending clarification ("the X conversation" / "use claude")
 *    AND pendingClarification exists → returns { kind: 'clarify', value } so the engine
 *    can re-resolve with the supplemented input.
 * 3. No pending state → returns null (normal flow).
 */
export function resumePendingTurn(
  rawInput: string,
  session: DialogueSession | null,
): { kind: 'confirm'; token: string } | { kind: 'clarify'; value: string } | null {
  if (!session) return null

  // Case 1: confirmation resume
  if (session.pendingConfirmationToken) {
    const confirmationRegex = /^\s*(yes|y|ok|okay|confirm|confirmed|sure|do it|go ahead|proceed)\b/i
    if (confirmationRegex.test(rawInput)) {
      return { kind: 'confirm', token: session.pendingConfirmationToken }
    }
  }

  // Case 2: clarification resume — best-effort pattern: any non-empty input
  // is treated as a candidate answer to the most recent clarification.
  // The engine will re-resolve with this value slotted in.
  if (session.pendingClarification && rawInput.trim().length > 0) {
    // Heuristic: a single short token is likely a clarification answer, not a new command.
    // We require < 5 words to avoid swallowing genuine new commands.
    const words = rawInput.trim().split(/\s+/).length
    if (words < 5) {
      return { kind: 'clarify', value: rawInput.trim() }
    }
  }

  return null
}

/** Generate a unique sessionKey suffix for anonymous dialogues. */
export function newAnonymousSessionKey(): string {
  return `anon:${newId()}`
}
