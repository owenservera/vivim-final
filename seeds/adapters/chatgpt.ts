// seeds/adapters/chatgpt.ts
// ChatGPT import adapter — parse conversations.json export format.
//
// ChatGPT export format is a JSON array of conversation objects:
//   { id, title, create_time, mapping: { [nodeId]: { message, parent, children } } }
// The mapping tree is walked from current_node to build the message sequence.
// content.parts contains text, code (content_type: 'code'), and images.

export interface ChatGPTConversation {
  id?: string
  conversation_id?: string
  title?: string
  create_time?: number
  current_node?: string
  mapping?: Record<string, ChatGPTMappingNode>
  messages?: Array<Record<string, unknown>>
  message_list?: Array<Record<string, unknown>>
}

interface ChatGPTMappingNode {
  id?: string
  parent?: string | null
  children?: string[]
  message?: {
    id?: string
    author?: { role?: string }
    content?: {
      content_type?: string
      parts?: (string | ChatGPTContentPart)[]
    }
    create_time?: number | null
    metadata?: Record<string, unknown>
  } | null
}

interface ChatGPTContentPart {
  content_type?: string
  text?: string
  language?: string
  asset_pointer?: string
  image_url?: { url?: string }
}

export interface NormalizedConversation {
  externalId: string
  title?: string
  createdAt?: number
  messages: NormalizedMessage[]
}

export interface NormalizedMessage {
  role: string
  content: string
  index: number
  parts?: NormalizedContentPart[]
}

export interface NormalizedContentPart {
  kind: 'text' | 'code' | 'image' | 'thinking' | 'tool_use'
  content: string
  language?: string
  url?: string
}

export function isChatGPTExport(data: unknown): data is ChatGPTConversation[] {
  if (!Array.isArray(data)) return false
  if (data.length === 0) return true
  const first = data[0] as Record<string, unknown>
  return (
    typeof first.mapping === 'object' ||
    typeof first.conversation_id === 'string' ||
    typeof first.create_time === 'number'
  )
}
export function parseChatGPT(raw: ChatGPTConversation[]): NormalizedConversation[] {
  const results: NormalizedConversation[] = []

  for (const conv of raw) {
    const externalId = String(conv.id ?? conv.conversation_id ?? '')
    const mapping = conv.mapping ?? {}

    // If no mapping, treat as flat messages (backward compat).
    if (Object.keys(mapping).length === 0) {
      const flatMessages = (conv.messages ?? conv.message_list ?? []) as Array<
        Record<string, unknown>
      >
      results.push({
        externalId,
        title: conv.title,
        createdAt: conv.create_time,
        messages: flatMessages.map((m, i) => ({
          role: String(m.role ?? m.author ?? 'user'),
          content: String(m.content ?? m.text ?? ''),
          index: i,
        })),
      })
      continue
    }

    const currentNodeId = conv.current_node

    // Walk the mapping tree from current_node backward through parents to build message sequence.
    const orderedMessages: Array<{
      id: string
      role: string
      parts: NormalizedContentPart[]
      createTime: number | null
    }> = []

    let nodeId: string | null = currentNodeId ?? null
    const visited = new Set<string>()

    while (nodeId && !visited.has(nodeId)) {
      visited.add(nodeId)
      const node: ChatGPTMappingNode | undefined = mapping[nodeId]
      if (!node) break

      const msg = node.message
      if (msg) {
        const role = msg.author?.role ?? 'unknown'
        const parts = parseContentParts(msg.content?.parts ?? [])

        orderedMessages.push({
          id: msg.id ?? nodeId,
          role,
          parts,
          createTime: msg.create_time ?? null,
        })
      }

      nodeId = node.parent ?? null
    }

    // Reverse to get chronological order (oldest first).
    orderedMessages.reverse()

    const messages: NormalizedMessage[] = orderedMessages.map((m, i) => ({
      role:
        m.role === 'assistant'
          ? 'assistant'
          : m.role === 'system'
            ? 'system'
            : m.role === 'tool'
              ? 'tool'
              : 'user',
      content: m.parts.map((p) => p.content).join('\n'),
      index: i,
      parts: m.parts,
    }))

    results.push({
      externalId,
      title: conv.title,
      createdAt: conv.create_time,
      messages,
    })
  }

  return results
}

function parseContentParts(parts: (string | ChatGPTContentPart)[]): NormalizedContentPart[] {
  const result: NormalizedContentPart[] = []

  for (const part of parts) {
    if (typeof part === 'string') {
      result.push({ kind: 'text', content: part })
      continue
    }

    const ct = part.content_type ?? 'text'

    switch (ct) {
      case 'code':
        result.push({
          kind: 'code',
          content: part.text ?? '',
          language: part.language,
        })
        break
      case 'image_asset_pointer':
        result.push({
          kind: 'image',
          content: part.asset_pointer ?? '',
          url: part.asset_pointer,
        })
        break
      case 'tether_quote':
        result.push({
          kind: 'thinking',
          content: part.text ?? '',
        })
        break
      case 'tool_use':
        result.push({
          kind: 'tool_use',
          content: JSON.stringify(part),
        })
        break
      default:
        result.push({
          kind: 'text',
          content: part.text ?? JSON.stringify(part),
        })
        break
    }
  }

  return result
}
