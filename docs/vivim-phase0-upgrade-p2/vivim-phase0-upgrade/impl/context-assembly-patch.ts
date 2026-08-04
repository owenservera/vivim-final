// impl/context-assembly-patch.ts
// Patch for the RECALL stage conversation_history layer in ContextAssemblyEngine.
//
// In src/engines/context-assembly.ts, the `recall()` method (lines 404-483)
// currently creates an empty conversation_history layer:
//
//   // Conversation history (placeholder — real impl needs conversation store)
//   layers.push({
//     name: 'conversation_history',
//     content: '',
//     tokenCount: 0,
//     priority: 0,
//     sources: [],
//   })
//
// This patch replaces that empty placeholder with a real query that:
//   1. Fetches recent messages from the conversation store
//   2. Formats them into a structured conversation history
//   3. Estimates token count accurately
//   4. Includes metadata (role, timestamp) for context assembly

import type { CapStoreDb } from '../src/storage/db.js'

// ── Types ──────────────────────────────────────────────────────────────────

interface ConversationMessage {
  id: string
  role: string
  content: string | null
  blocksJson: string
  createdAt: number
  sequenceIndex: number
}

interface ConversationHistoryLayer {
  name: 'conversation_history'
  content: string
  tokenCount: number
  priority: number
  sources: string[]
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Approximate tokens per character (English text ≈ 1 token per 4 chars) */
const CHARS_PER_TOKEN = 4

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/** Maximum number of recent messages to include in the context layer */
const MAX_HISTORY_MESSAGES = 50

/** Maximum character budget for the conversation history content */
const MAX_HISTORY_CHARS = 12_000

// ── Patch implementation ──────────────────────────────────────────────────

/**
 * Builds a real conversation_history layer by querying the conversation store.
 *
 * Replace the placeholder code in `recall()` (lines 473-480) with:
 *
 *   const historyLayer = await buildConversationHistoryLayer(
 *     this.conversationStore,
 *     conversationId,
 *   )
 *   if (historyLayer) layers.push(historyLayer)
 *
 * The constructor also needs to accept an optional CapStoreDb:
 *
 *   constructor(
 *     private store: ContextAssemblyStore,
 *     private situationDetector: SituationDetector,
 *     private memory: MemoryEngine,
 *     private search: SemanticSearchEngine,
 *     private budget: number = DEFAULT_BUDGET,
 *     private memorySnapshotProvider?: (conversationId: string) => Promise<string | null>,
 *     private conversationStore?: CapStoreDb,  // ← NEW
 *   ) {}
 */
export async function buildConversationHistoryLayer(
  db: CapStoreDb,
  conversationId: string,
): Promise<ConversationHistoryLayer | null> {
  // Fetch recent messages for this conversation
  let messages: ConversationMessage[]
  try {
    const raw = await db.prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { sequenceIndex: 'asc' },
      take: MAX_HISTORY_MESSAGES,
    })
    messages = raw as unknown as ConversationMessage[]
  } catch {
    // If the query fails (e.g. table doesn't exist yet), return null
    return null
  }

  if (messages.length === 0) {
    return null
  }

  // Format messages into a structured conversation history
  const formattedParts: string[] = []
  let totalChars = 0
  const sources: string[] = []

  for (const msg of messages) {
    // Parse block content if available
    let textContent = msg.content ?? ''
    if (msg.blocksJson && msg.blocksJson !== '[]') {
      try {
        const blocks = JSON.parse(msg.blocksJson) as Array<{ text?: string; type?: string }>
        for (const block of blocks) {
          if (block.text) {
            textContent += (textContent ? '\n' : '') + block.text
          }
        }
      } catch {
        // blocksJson may be malformed — fall back to raw content
      }
    }

    // Skip empty messages
    if (!textContent.trim()) continue

    // Format: [role] content
    const timestamp = new Date(Number(msg.createdAt)).toISOString()
    const formatted = `[${msg.role}] (${timestamp}) ${textContent}`

    // Respect character budget
    if (totalChars + formatted.length > MAX_HISTORY_CHARS) {
      // Truncate the last message to fit
      const remaining = MAX_HISTORY_CHARS - totalChars
      if (remaining > 50) {
        const truncated = formatted.slice(0, remaining - 1) + '…'
        formattedParts.push(truncated)
        totalChars += truncated.length
      }
      break
    }

    formattedParts.push(formatted)
    totalChars += formatted.length
    sources.push(msg.id)
  }

  if (formattedParts.length === 0) {
    return null
  }

  const content = formattedParts.join('\n')

  return {
    name: 'conversation_history',
    content,
    tokenCount: estimateTokens(content),
    priority: 0,
    sources,
  }
}

// ── Diff for applying the patch ───────────────────────────────────────────
//
// In src/engines/context-assembly.ts, replace lines 473-480:
//
//   // BEFORE:
//   // Conversation history (placeholder — real impl needs conversation store)
//   layers.push({
//     name: 'conversation_history',
//     content: '',
//     tokenCount: 0,
//     priority: 0,
//     sources: [],
//   })
//
//   // AFTER:
//   // Conversation history — real query from conversation store
//   if (this.conversationStore) {
//     const historyLayer = await buildConversationHistoryLayer(
//       this.conversationStore,
//       conversationId,
//     )
//     if (historyLayer) layers.push(historyLayer)
//   } else {
//     // Fallback to empty layer when store is not wired
//     layers.push({
//       name: 'conversation_history',
//       content: '',
//       tokenCount: 0,
//       priority: 0,
//       sources: [],
//     })
//   }
