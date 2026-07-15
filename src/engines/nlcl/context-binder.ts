import type { ConversationRow } from '../../storage/contracts/conversation-store.js'
import type { NLCContext } from './types.js'

// ── Raw Request Context Interface ─────────────────────────────────────────────

export interface RawRequestContext {
  conversationId?: string
  providerId?: string
  canvasState?: { activeLayerId?: string; background?: string }
  activeSessionId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

// ── Context Binder ─────────────────────────────────────────────────────────────

export async function bindContext(
  raw: RawRequestContext,
  deps: {
    conversationStore?: { getConversation: (id: string) => Promise<ConversationRow | null> }
    governor?: { instances: () => Promise<Array<{ id: string; providerId: string }>> }
  },
): Promise<NLCContext> {
  const ctx: NLCContext = {
    conversationId: raw.conversationId ?? undefined,
    providerId: raw.providerId ?? undefined,
    accountId: undefined,
    slaveId: raw.activeSessionId ?? undefined,
    surface: 'cli', // Caller should override
    metadata: { ...raw.metadata },
  }

  // Augment metadata with canvas state
  if (raw.canvasState) {
    ctx.metadata = {
      ...ctx.metadata,
      activeLayerId: raw.canvasState.activeLayerId,
      canvasBackground: raw.canvasState.background,
    }
  }

  // Resolve providerId from conversation if not provided
  if (!ctx.providerId && ctx.conversationId && deps.conversationStore) {
    try {
      const conv = await deps.conversationStore.getConversation(ctx.conversationId)
      if (conv) {
        ctx.providerId = conv.providerId
        ctx.accountId = undefined // ConversationRow doesn't have accountId
      }
    } catch {
      // Silent fail - keep default ctx
    }
  }

  return ctx
}

// ── Pronoun Resolver ───────────────────────────────────────────────────────────

export function resolvePronouns(text: string, ctx: NLCContext): string {
  let resolved = text

  // Resolve "the canvas" → canvas layer reference
  const activeLayerId = ctx.metadata?.activeLayerId as string | undefined
  if (/the\s+canvas/i.test(resolved) && activeLayerId) {
    resolved = resolved.replace(/the\s+canvas/gi, `canvas:${activeLayerId}`)
  }

  // Resolve "it" → last subject
  const lastSubject = ctx.metadata?.lastSubject as string | undefined
  if (/\bit\b/i.test(resolved) && lastSubject) {
    resolved = resolved.replace(/\bit\b/gi, lastSubject)
  }

  // Resolve "my account" → provider context
  if (/my\s+account/i.test(resolved) && ctx.providerId) {
    resolved = resolved.replace(/my\s+account/gi, ctx.providerId)
  }

  return resolved
}
