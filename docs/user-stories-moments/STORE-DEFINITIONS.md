# Store Definitions — User Journey Moments

**Phase:** 100 (User-Centric Frontend)
**Status:** SCHEMA DEFINED — Ready for Implementation

---

## Overview

Three new stores needed for the user journey:

1. `useConversationStore` — Conversation CRUD + messages
2. `useFleetStore` — Chrome fleet status
3. `useExecutionStore` — Capability execution state

All stores use Zustand (existing pattern in `capability-store.ts`).

---

## useConversationStore

```typescript
// web/sandbox/src/store/conversation-store.ts
import { create } from 'zustand'

export interface Conversation {
  id: string
  providerId: string
  title: string
  state: 'active' | 'archived' | 'deleted'
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  providerId?: string
  createdAt: string
}

interface ConversationState {
  // State
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  loading: boolean
  sending: boolean
  error: string | null
  
  // Actions
  list: (opts?: { providerId?: string; limit?: number }) => Promise<void>
  create: (providerId: string, title?: string) => Promise<Conversation>
  select: (id: string) => Promise<void>
  send: (conversationId: string, content: string) => Promise<void>
  loadMessages: (conversationId: string, before?: string) => Promise<void>
  appendMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  loading: false,
  sending: false,
  error: null,

  list: async (opts) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (opts?.providerId) params.set('providerId', opts.providerId)
      if (opts?.limit) params.set('limit', String(opts.limit))
      
      const response = await fetch(`/api/conversations?${params}`)
      const conversations = await response.json()
      set({ conversations })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load conversations' })
    } finally {
      set({ loading: false })
    }
  },

  create: async (providerId, title) => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, title }),
      })
      const conversation = await response.json()
      set((state) => ({
        conversations: [conversation, ...state.conversations],
        activeConversationId: conversation.id,
        messages: [],
      }))
      return conversation
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create conversation' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  select: async (id) => {
    set({ activeConversationId: id, messages: [] })
    await get().loadMessages(id)
  },

  send: async (conversationId, content) => {
    set({ sending: true, error: null })
    try {
      // Optimistic add
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }
      set((state) => ({ messages: [...state.messages, tempMessage] }))

      // Send to backend
      const response = await fetch(`/api/conversations/${conversationId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      })
      const result = await response.json()

      // Replace temp with real message
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempMessage.id ? { ...m, id: result.messageId } : m
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to send message' })
      // Remove optimistic message on error
      set((state) => ({
        messages: state.messages.filter((m) => !m.id.startsWith('temp-')),
      }))
    } finally {
      set({ sending: false })
    }
  },

  loadMessages: async (conversationId, before) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (before) params.set('before', before)

      const response = await fetch(`/api/conversations/${conversationId}/messages?${params}`)
      const messages = await response.json()
      set({ messages })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load messages' })
    } finally {
      set({ loading: false })
    }
  },

  appendMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }))
  },
}))
```

---

## useFleetStore

```typescript
// web/sandbox/src/store/fleet-store.ts
import { create } from 'zustand'

export interface FleetSlave {
  slaveId: string
  providerId: string
  accountId: string
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'crashed'
  superState: 'idle' | 'sending' | 'capturing' | 'parsing' | 'authenticating' | 'error'
  pid: number | null
  debugPort: number
  lastHealthCheck: number
}

interface FleetState {
  slaves: FleetSlave[]
  loading: boolean
  error: string | null
  
  refresh: () => Promise<void>
  start: (providerId: string, accountId: string) => Promise<FleetSlave>
  stop: (providerId: string, accountId: string) => Promise<void>
  updateSlave: (slaveId: string, updates: Partial<FleetSlave>) => void
}

export const useFleetStore = create<FleetState>()((set) => ({
  slaves: [],
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/fleet/status')
      const slaves = await response.json()
      set({ slaves })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load fleet status' })
    } finally {
      set({ loading: false })
    }
  },

  start: async (providerId, accountId) => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/fleet/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, accountId }),
      })
      const slave = await response.json()
      set((state) => ({ slaves: [...state.slaves, slave] }))
      return slave
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start slave' })
      throw err
    } finally {
      set({ loading: false })
    }
  },

  stop: async (providerId, accountId) => {
    set({ loading: true, error: null })
    try {
      await fetch('/api/fleet/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, accountId }),
      })
      set((state) => ({
        slaves: state.slaves.filter(
          (s) => !(s.providerId === providerId && s.accountId === accountId)
        ),
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to stop slave' })
    } finally {
      set({ loading: false })
    }
  },

  updateSlave: (slaveId, updates) => {
    set((state) => ({
      slaves: state.slaves.map((s) => (s.slaveId === slaveId ? { ...s, ...updates } : s)),
    }))
  },
}))
```

---

## useExecutionStore

```typescript
// web/sandbox/src/store/execution-store.ts
import { create } from 'zustand'

export interface ExecutionResult {
  executionId: string
  slug: string
  status: 'running' | 'complete' | 'error'
  result?: unknown
  error?: string
  latencyMs?: number
  startedAt: string
  completedAt?: string
}

interface ExecutionState {
  activeExecution: ExecutionResult | null
  history: ExecutionResult[]
  
  execute: (conversationId: string, slug: string) => Promise<void>
  updateExecution: (updates: Partial<ExecutionResult>) => void
  clearResult: () => void
}

export const useExecutionStore = create<ExecutionState>()((set, get) => ({
  activeExecution: null,
  history: [],

  execute: async (conversationId, slug) => {
    const execution: ExecutionResult = {
      executionId: `exec-${Date.now()}`,
      slug,
      status: 'running',
      startedAt: new Date().toISOString(),
    }
    set({ activeExecution: execution })

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/capabilities/${slug}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      const result = await response.json()
      
      set((state) => ({
        activeExecution: state.activeExecution
          ? {
              ...state.activeExecution,
              status: 'complete',
              result: result.data,
              latencyMs: result.latencyMs,
              completedAt: new Date().toISOString(),
            }
          : null,
        history: [
          ...(state.activeExecution
            ? [
                {
                  ...state.activeExecution,
                  status: 'complete' as const,
                  result: result.data,
                  latencyMs: result.latencyMs,
                  completedAt: new Date().toISOString(),
                },
              ]
            : []),
          ...state.history,
        ],
      }))
    } catch (err) {
      set((state) => ({
        activeExecution: state.activeExecution
          ? {
              ...state.activeExecution,
              status: 'error',
              error: err instanceof Error ? err.message : 'Execution failed',
              completedAt: new Date().toISOString(),
            }
          : null,
      }))
    }
  },

  updateExecution: (updates) => {
    set((state) => ({
      activeExecution: state.activeExecution
        ? { ...state.activeExecution, ...updates }
        : null,
    }))
  },

  clearResult: () => {
    set({ activeExecution: null })
  },
}))
```

---

## Store Integration Points

### WebSocket Event Handlers

```typescript
// web/sandbox/src/lib/ws-handlers.ts
import { useConversationStore } from '../store/conversation-store'
import { useFleetStore } from '../store/fleet-store'
import { useExecutionStore } from '../store/execution-store'

export function handleWsMessage(msg: unknown) {
  const event = msg as { type: string; [key: string]: unknown }

  switch (event.type) {
    case 'conversation:complete':
      useConversationStore.getState().appendMessage({
        id: event.message.id,
        conversationId: event.conversationId,
        role: 'assistant',
        content: event.message.content,
        providerId: event.message.providerId,
        createdAt: new Date().toISOString(),
      })
      break

    case 'fleet:slave_status':
      useFleetStore.getState().updateSlave(event.slaveId, {
        status: event.status,
        superState: event.superState,
      })
      break

    case 'capability:progress':
      useExecutionStore.getState().updateExecution({
        status: 'running',
        result: { step: event.step, total: event.total, description: event.description },
      })
      break

    case 'capability:complete':
      useExecutionStore.getState().updateExecution({
        status: 'complete',
        result: event.result,
        completedAt: new Date().toISOString(),
      })
      break
  }
}
```

---

## File Structure

```
web/sandbox/src/
├── store/
│   ├── capability-store.ts    (existing)
│   ├── conversation-store.ts  (new - 100.1)
│   ├── fleet-store.ts         (new - 100.10)
│   └── execution-store.ts     (new - 100.8)
├── lib/
│   └── ws-handlers.ts         (new - 100.5)
```

---

*These stores power the entire user journey.*
