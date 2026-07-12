import { useEffect, useState, useCallback } from 'react'

interface Conversation {
  id: string
  providerId: string
  title: string | null
  state: string
  createdAt: number
}

interface ConversationListProps {
  onSelect: (id: string) => void
  activeId?: string | null
}

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
}

const PROVIDER_COLORS: Record<string, string> = {
  chatgpt: 'bg-green-100 text-green-700',
  claude: 'bg-orange-100 text-orange-700',
  gemini: 'bg-blue-100 text-blue-700',
}

export function ConversationList({ onSelect, activeId }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const loadConversations = useCallback(async () => {
    try {
      const resp = await fetch('/api/conversations?limit=50')
      const data = await resp.json()
      if (Array.isArray(data)) {
        setConversations(data)
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeId === id) {
        onSelect('')
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  if (loading) {
    return (
      <div className="w-64 border-r border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-3 border-b border-gray-100">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversations</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50 transition-colors group ${
                activeId === conv.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    PROVIDER_COLORS[conv.providerId] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {PROVIDER_LABELS[conv.providerId] ?? conv.providerId}
                </span>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs"
                  title="Delete"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-700 mt-1 truncate">
                {conv.title ?? 'Untitled conversation'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {new Date(conv.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
