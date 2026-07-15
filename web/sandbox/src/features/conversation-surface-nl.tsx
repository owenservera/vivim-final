// web/sandbox/src/features/conversation-surface-nl.tsx
// ConversationSurface with NL-aware routing (Unit 25.9).
// Wraps conversation-surface and adds command detection.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  blocks?: ContentBlock[]
  createdAt: number
  pending?: boolean
  timing?: StageTiming
}

interface ContentBlock {
  kind: string
  content: string
  index: number
  [key: string]: unknown
}

interface StreamingMessage {
  id: string
  role: 'assistant'
  blocks: ContentBlock[]
  isStreaming: boolean
}

interface StageTiming {
  resolve?: number
  recall?: number
  ensure?: number
  type?: number
  submit?: number
  capture?: number
  parse?: number
  store?: number
  total?: number
  [key: string]: number | undefined
}

interface ConversationSurfaceProps {
  conversationId: string | null
}

// ── Latency budgets (ms) ────────────────────────────────────────────────

const LATENCY_BUDGETS: Record<string, number> = {
  resolve: 100,
  recall: 200,
  ensure: 3000,
  type: 200,
  submit: 100,
  capture: 60000,
  parse: 100,
  store: 50,
}

// ── Virtual scrolling constants ──────────────────────────────────────────

const ITEM_HEIGHT_ESTIMATE = 120
const OVERSCAN = 5

// ── Component ─────────────────────────────────────────────────────────────

export function ConversationSurfaceNL({ conversationId }: ConversationSurfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pendingBlocks = useRef<ContentBlock[]>([])
  const rafId = useRef<number | null>(null)

  // ── Virtual scrolling calculation ────────────────────────────────────────

  const { startIndex, endIndex, totalHeight, offsetY, visibleMessages } = useMemo(() => {
    const total = messages.length * ITEM_HEIGHT_ESTIMATE
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT_ESTIMATE) - OVERSCAN)
    const visibleCount = Math.ceil(viewportHeight / ITEM_HEIGHT_ESTIMATE) + OVERSCAN * 2
    const end = Math.min(messages.length, start + visibleCount)
    const offset = start * ITEM_HEIGHT_ESTIMATE
    return {
      startIndex: start,
      endIndex: end,
      totalHeight: total,
      offsetY: offset,
      visibleMessages: messages.slice(start, end),
    }
  }, [scrollTop, viewportHeight, messages])

  // ── Auto-scroll to bottom ────────────────────────────────────────────────

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [messages.length, streamingMessage, autoScroll])

  // ── Scroll handler (auto-scroll detection + virtual list state) ───────────

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setAutoScroll(atBottom)
  }, [])

  // ── Viewport size tracking ────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onResize = () => setViewportHeight(el.clientHeight)
    onResize()
    const ro = new ResizeObserver(onResize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── RAF batched block flushing (5.2) ─────────────────────────────────────

  const flushBlocks = useCallback(() => {
    rafId.current = null
    if (pendingBlocks.current.length === 0) return
    const newBlocks = pendingBlocks.current
    pendingBlocks.current = []
    setStreamingMessage((prev) =>
      prev ? { ...prev, blocks: [...prev.blocks, ...newBlocks] } : null,
    )
  }, [])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  // ── Load message history ─────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId) return
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data.map(normalizeMessage))
        }
      })
      .catch(() => {})
  }, [conversationId])

  // ── WebSocket for real-time updates ──────────────────────────────────────

  useEffect(() => {
    if (!conversationId) return
    const wsUrl = `ws://${window.location.hostname}:${window.location.port || 9420}/ws`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          entityType: 'conversation',
          entityId: conversationId,
        }),
      )
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)

        switch (msg.type) {
          case 'conversation:stream_start':
            setStreamingMessage({
              id: msg.messageId || `stream_${Date.now()}`,
              role: 'assistant',
              blocks: [],
              isStreaming: true,
            })
            break

          case 'conversation:block':
            // 5.2: RAF batching — push to pending, schedule flush
            pendingBlocks.current.push(msg.block)
            if (!rafId.current) {
              rafId.current = requestAnimationFrame(flushBlocks)
            }
            break

          case 'conversation:stream_end':
          case 'conversation:complete':
            if (streamingMessage) {
              const text = streamingMessage.blocks
                .filter((b) => b.kind === 'text')
                .map((b) => b.content)
                .join('')
              setMessages((prev) => [
                ...prev,
                {
                  id: streamingMessage.id,
                  role: 'assistant',
                  content: text || (msg.blocks?.map((b: ContentBlock) => b.content).join('') ?? ''),
                  blocks: streamingMessage.blocks.length > 0 ? streamingMessage.blocks : msg.blocks,
                  createdAt: Date.now(),
                },
              ])
              setStreamingMessage(null)
            } else if (msg.message) {
              setMessages((prev) => [...prev, normalizeMessage(msg.message)])
            }
            break

          case 'conversation:error':
            console.error('Conversation error:', msg.error)
            setStreamingMessage(null)
            break
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => {
      ws.close()
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [conversationId, flushBlocks, streamingMessage])

  // ── Command detection (25.9) ────────────────────────────────────────────

  const looksLikeCommand = useCallback((text: string): boolean => {
    // Leading slash, or recognized NLCL patterns
    return /^\//.test(text) || /^(list|show|switch|new|create|delete|remove)/i.test(text)
  }, [])

  // ── Send with optimistic UI (5.1) ────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !conversationId) return

    const messageText = input.trim()
    setSending(true)
    setInput('')

    // Unit 25.9 — NL-aware routing: detect command vs message
    if (looksLikeCommand(messageText)) {
      const tempId = `temp_${Date.now()}`
      const optimisticUserMsg: Message = {
        id: tempId,
        role: 'user',
        content: messageText,
        createdAt: Date.now(),
        pending: true,
      }
      setMessages((prev) => [...prev, optimisticUserMsg])

      try {
        const resp = await fetch('/api/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: messageText,
            ctx: { conversationId },
          }),
        })
        const result = await resp.json()

        setMessages((prev) => prev.filter((m) => m.id !== tempId))

        if (result.ok && result.output) {
          setStreamingMessage(null)
          setMessages((prev) => [
            ...prev,
            {
              id: `cmd_${Date.now()}`,
              role: 'assistant',
              content: result.text || JSON.stringify(result.output),
              createdAt: Date.now(),
              blocks: [{ kind: 'text', content: result.text || String(result.output), index: 0 }],
            },
          ])
        } else if (result.clarification) {
          setStreamingMessage(null)
          setMessages((prev) => [
            ...prev,
            {
              id: `clarify_${Date.now()}`,
              role: 'assistant',
              content: result.clarification?.prompt ?? 'What do you mean?',
              createdAt: Date.now(),
              blocks: [{ kind: 'text', content: result.clarification?.prompt ?? '', index: 0 }],
            },
          ])
        } else {
          setStreamingMessage(null)
          console.error('Interpret failed:', result.error)
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setStreamingMessage(null)
        console.error('Interpret error:', err)
      } finally {
        setSending(false)
      }
      return
    }

    // Fall through to normal message send
    const tempId = `temp_${Date.now()}`
    const optimisticUserMsg: Message = {
      id: tempId,
      role: 'user',
      content: messageText,
      createdAt: Date.now(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimisticUserMsg])

    const tempAssistantId = `temp_assistant_${Date.now()}`
    setStreamingMessage({
      id: tempAssistantId,
      role: 'assistant',
      blocks: [],
      isStreaming: true,
    })

    try {
      const resp = await fetch(`/api/conversations/${conversationId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      })
      const result = await resp.json()

      if (result.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false, confirmed: true } : m)),
        )
        if (result.text && result.timing) {
          setStreamingMessage(null)
          setMessages((prev) => [
            ...prev,
            {
              id: result.messageId || `resp_${Date.now()}`,
              role: 'assistant',
              content: result.text,
              blocks: result.blocks,
              createdAt: Date.now(),
              timing: result.timing,
            },
          ])
        }
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setStreamingMessage(null)
        console.error('Send failed:', result.error)
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setStreamingMessage(null)
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
  }, [input, conversationId, sending, looksLikeCommand])

  // ── Render ──────────────────────────────────────────────────────────────

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        No conversation selected. Create one to start chatting.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Status bar */}
      <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-2 text-xs text-gray-500">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
        <span>Conversation {conversationId.slice(0, 8)}...</span>
        <span className="ml-auto">{messages.length} messages</span>
      </div>

      {/* Message list — 5.3: virtual scrolling */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        onScroll={handleScroll}
        style={{ position: 'relative' }}
      >
        {messages.length === 0 && !streamingMessage && (
          <div className="text-center text-gray-400 mt-12">
            Send a message to start the conversation.
          </div>
        )}

        {/* Virtual list spacer */}
        {messages.length > 20 && (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          </div>
        )}

        {/* Simple list for small conversations */}
        {messages.length <= 20 && messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}

        {/* Streaming message (sticky at bottom) */}
        {streamingMessage && (
          <div className="flex justify-start sticky bottom-0">
            <div className="max-w-[80%] px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-900">
              {streamingMessage.blocks.length > 0 ? (
                <RenderBlocks blocks={streamingMessage.blocks} />
              ) : (
                <span className="text-gray-400">thinking...</span>
              )}
              {streamingMessage.isStreaming && (
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1 align-middle" />
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={1}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ── Message Bubble (with pending styling + timing) ────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isPending = message.pending

  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-lg text-sm whitespace-pre-wrap ${
          isUser
            ? isPending
              ? 'bg-blue-300 text-white opacity-70'
              : 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {message.blocks && message.blocks.length > 0 ? (
          <RenderBlocks blocks={message.blocks} />
        ) : (
          message.content
        )}
        {/* 5.5: Latency breakdown */}
        {message.timing && <LatencyBreakdown timing={message.timing} />}
      </div>
    </div>
  )
}

// ── Latency Breakdown (5.5) ──────────────────────────────────────────────

function LatencyBreakdown({ timing }: { timing: StageTiming }) {
  const total = timing.total ?? 0
  if (total === 0) return null

  return (
    <details className="mt-1 text-[10px] text-gray-500">
      <summary className="cursor-pointer hover:text-gray-700">
        {total}ms total
      </summary>
      <div className="mt-1 space-y-0.5">
        {Object.entries(timing)
          .filter(([k]) => k !== 'total' && timing[k] !== undefined)
          .map(([stage, ms]) => {
            const budget = LATENCY_BUDGETS[stage]
            const overBudget = budget !== undefined && (ms ?? 0) > budget
            return (
              <div key={stage} className="flex justify-between">
                <span className={overBudget ? 'text-red-500 font-medium' : ''}>{stage}</span>
                <span className={overBudget ? 'text-red-500' : ''}>
                  {ms}ms{budget !== undefined ? ` / ${budget}ms` : ''}
                </span>
              </div>
            )
          })}
      </div>
      {/* Visual budget bar */}
      <BudgetBar timing={timing} />
    </details>
  )
}

function BudgetBar({ timing }: { timing: StageTiming }) {
  const total = timing.total ?? 1
  return (
    <div className="flex h-1 rounded overflow-hidden mt-1">
      {Object.entries(timing)
        .filter(([k]) => k !== 'total' && timing[k] !== undefined)
        .map(([stage, ms]) => {
          const budget = LATENCY_BUDGETS[stage] ?? 1000
          const overBudget = (ms ?? 0) > budget
          const width = Math.min(100, ((ms ?? 0) / total) * 100)
          return (
            <div
              key={stage}
              className={`h-full ${overBudget ? 'bg-red-400' : 'bg-green-400'}`}
              style={{ width: `${width}%` }}
              title={`${stage}: ${ms}ms / ${budget}ms budget`}
            />
          )
        })}
    </div>
  )
}

// ── Block Renderer (with text block merging — 5.2) ───────────────────────

function RenderBlocks({ blocks }: { blocks: ContentBlock[] }) {
  // 5.2: Merge consecutive text blocks for smoother rendering
  const merged: ContentBlock[] = []
  for (const block of blocks) {
    const last = merged[merged.length - 1]
    if (block.kind === 'text' && last?.kind === 'text') {
      last.content += block.content
    } else {
      merged.push({ ...block })
    }
  }

  return (
    <>
      {merged.map((block, i) => {
        switch (block.kind) {
          case 'text':
            return <span key={i}>{block.content}</span>
          case 'code':
            return (
              <pre
                key={i}
                className="bg-gray-800 text-gray-100 p-3 rounded mt-2 overflow-x-auto text-xs"
              >
                <code>{block.content}</code>
              </pre>
            )
          case 'thinking':
            return (
              <details key={i} className="mt-2 text-gray-500 italic text-xs">
                <summary className="cursor-pointer">Thinking</summary>
                <p className="mt-1">{block.content}</p>
              </details>
            )
          default:
            return null
        }
      })}
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeMessage(raw: Record<string, unknown>): Message {
  return {
    id: String(raw.id ?? raw.messageId ?? Date.now()),
    role: (raw.role as 'user' | 'assistant') ?? 'assistant',
    content: String(raw.content ?? ''),
    blocks: Array.isArray(raw.blocks) ? (raw.blocks as ContentBlock[]) : undefined,
    createdAt: Number(raw.createdAt ?? raw.ts ?? Date.now()),
    timing: raw.timing as StageTiming | undefined,
  }
}