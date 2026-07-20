// web/ui/src/features/chat/ChatPage.tsx
// Full multi-turn chat experience, now composed ENTIRELY through the global
// hot-swappable UIComponentRegistry (docs/prd-hot-swappable-ui.md).
//
// Every visual region is a capability global (slot) resolved at render time:
// chat.entry / sidebar / thread / header / composer / error, while the
// thread/composer internally resolve chat.bubble / chat.send / chat.attach /
// chat.streaming / chat.result. Any slot can be hot-swapped at runtime for a
// provider or capability slug and the UI live-updates.
//
// Interactive slots dispatch through the ActionRegistry (B8 — One Entry Point).
// The backend owns all Chrome/provider execution (Governor Canon).

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { ActionRegistry } from '../../actions/registry.js'
import { SlotProvider } from '../../ui/context.js'
import type {
  ComposerProps,
  EntryProps,
  ErrorProps,
  HeaderProps,
  SidebarProps,
  ThreadProps,
} from '../../ui/defaults/types.js'
import {
  type ProviderChatAdapter,
  getProviderAdapter,
  listProviderAdapters,
} from '../../ui/index.js'
import { applyClaim } from '../../ui/registry.js'
import { useSlot } from '../../ui/useSlot.js'
import {
  editMessage as apiEditMessage,
  createConversation,
  fetchAccounts,
  fetchCapabilities,
  fetchMessages,
  listConversations,
  sendMessage,
  startConversation,
  uploadAttachment,
  upsertAccount,
} from './api.js'
import type { ChatAccount, ChatConversation, ChatMessage } from './types.js'

// Default logged-in identity used when no account exists yet for a provider.
const DEFAULT_ACCOUNT_EMAIL = 'owservera@gmail.com'

// ── Surface (consumes slots; everything below resolves through the registry) ──

function ChatSurface(props: {
  providerId: string
  conversations: ChatConversation[]
  activeId: string | null
  messages: ChatMessage[]
  account: ChatAccount | null
  sending: boolean
  busy: boolean
  error: string | null
  onSelectProvider: (id: string) => void
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  onSend: (text: string) => void
  onAttach: (file: File) => void
  onEditMessage: (messageId: string, content: string) => Promise<void>
  onUploadAttachment: (messageId: string, file: File) => Promise<void>
}) {
  const Entry = useSlot('chat.entry') as unknown as React.ComponentType<EntryProps>
  const Sidebar = useSlot('chat.sidebar') as unknown as React.ComponentType<SidebarProps>
  const Header = useSlot('chat.header') as unknown as React.ComponentType<HeaderProps>
  const Thread = useSlot('chat.thread') as unknown as React.ComponentType<ThreadProps>
  const Composer = useSlot('chat.composer') as unknown as React.ComponentType<ComposerProps>
  const ErrorBar = useSlot('chat.error') as unknown as React.ComponentType<ErrorProps>

  const adapter: ProviderChatAdapter = getProviderAdapter(props.providerId)
  const adapters = listProviderAdapters()
  const attachEnabled = true

  const sidebarNode = (
    <Sidebar
      adapter={adapter}
      conversations={props.conversations}
      activeId={props.activeId}
      onSelect={props.onSelectConversation}
      onNew={props.onNewChat}
    />
  )
  const headerNode = (
    <Header
      adapters={adapters}
      activeProviderId={props.providerId}
      onSelect={props.onSelectProvider}
      accountEmail={props.account?.email}
      accountState={props.account?.loginState}
    />
  )
  const threadNode = (
    <Thread
      messages={props.messages}
      adapter={adapter}
      emptyHint={`Start a conversation with ${adapter.displayName}. Messages run through your logged-in browser session and persist across reloads.`}
      streaming={props.sending || props.busy}
      onEditMessage={props.onEditMessage}
      onUploadAttachment={props.onUploadAttachment}
    />
  )
  const errorNode = <ErrorBar message={props.error} />
  const composerNode = (
    <Composer
      adapter={adapter}
      disabled={!props.activeId || props.sending || props.busy}
      onSend={props.onSend}
      onAttach={props.onAttach}
      canAttach={attachEnabled}
    />
  )

  return (
    <Entry
      sidebar={sidebarNode}
      header={headerNode}
      thread={threadNode}
      errorBar={errorNode}
      composer={composerNode}
    />
  )
}

// ── Page (owns state + behavior; wires actions through ActionRegistry) ────────

export function ChatPage() {
  const adapters = listProviderAdapters()
  const [providerId, setProviderId] = useState<string>(adapters[0]?.id ?? 'claude')

  const [account, setAccount] = useState<ChatAccount | null>(null)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Keep the latest send/attach closures reachable from the registered actions
  // without re-registering on every render (B8).
  const sendRef = useRef<(text: string) => void>(() => {})
  const attachRef = useRef<(file: File) => void>(() => {})

  const loadConversations = useCallback(async (pid: string) => {
    const list = await listConversations(pid)
    setConversations(list)
    return list
  }, [])

  const applyProviderUiSlots = useCallback(async (pid: string) => {
    try {
      const caps = await fetchCapabilities(pid)
      for (const cap of caps) {
        if (!cap.uiSlots) continue
        for (const [slot, claim] of Object.entries(cap.uiSlots)) {
          applyClaim(slot as never, cap.slug, claim as never)
        }
      }
    } catch {
      // uiSlots are best-effort; ignore if the backend doesn't supply them
    }
  }, [])

  const openProvider = useCallback(
    async (pid: string) => {
      setBusy(true)
      setError(null)
      try {
        let accounts = await fetchAccounts(pid)
        let acc: ChatAccount
        if (accounts.length === 0) {
          acc = await upsertAccount(pid, DEFAULT_ACCOUNT_EMAIL)
          accounts = [acc]
        } else {
          acc = accounts[0]
        }
        setAccount(acc)

        // Load existing conversations, or create a new one
        const existingConvs = await listConversations(pid)
        if (existingConvs.length > 0) {
          const mostRecent = existingConvs[0]
          setActiveId(mostRecent.id)
          const msgs = await fetchMessages(mostRecent.id)
          setMessages(
            msgs.map((m) => ({
              id: m.id,
              role: m.role as ChatMessage['role'],
              content: m.content,
              attachments: m.attachments,
            })),
          )
        } else {
          const started = await startConversation(pid, acc.email)
          setActiveId(started.conversationId)
          setMessages(
            started.messages.map((m) => ({
              id: m.id,
              role: m.role as ChatMessage['role'],
              content: m.content,
            })),
          )
        }
        await loadConversations(pid)
        await applyProviderUiSlots(pid)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open provider')
      } finally {
        setBusy(false)
      }
    },
    [loadConversations, applyProviderUiSlots],
  )

  // Initial load for the default provider.
  useEffect(() => {
    void openProvider(providerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectProvider = useCallback(
    async (pid: string) => {
      if (pid === providerId) return
      setProviderId(pid)
      setMessages([])
      setActiveId(null)
      setAccount(null)
      await openProvider(pid)
    },
    [providerId, openProvider],
  )

  const selectConversation = useCallback(async (cid: string) => {
    setBusy(true)
    setError(null)
    try {
      const msgs = await fetchMessages(cid)
      setActiveId(cid)
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role as ChatMessage['role'],
          content: m.content,
          attachments: m.attachments,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setBusy(false)
    }
  }, [])

  const newChat = useCallback(async () => {
    if (!account) return
    setBusy(true)
    setError(null)
    try {
      const conv = await createConversation(providerId, account.id)
      setActiveId(conv.id)
      setMessages([])
      await loadConversations(providerId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation')
    } finally {
      setBusy(false)
    }
  }, [account, providerId, loadConversations])

  const doSend = useCallback(
    async (text: string) => {
      if (!activeId || sending) return
      const userMsg: ChatMessage = { id: `local_${Date.now()}`, role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])
      setSending(true)
      setError(null)
      try {
        const result = await sendMessage(activeId, text)
        if (result.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: result.messageId || `a_${Date.now()}`,
              role: 'assistant',
              content: result.text,
              blocksJson: result.blocks ? JSON.stringify(result.blocks) : undefined,
            },
          ])
          await loadConversations(providerId)
        } else {
          setError(result.error ?? 'Send failed')
          setMessages((prev) => [
            ...prev,
            {
              id: `err_${Date.now()}`,
              role: 'assistant',
              content: `(error) ${result.error ?? 'send failed'}`,
            },
          ])
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Send failed'
        setError(msg)
        setMessages((prev) => [
          ...prev,
          { id: `err_${Date.now()}`, role: 'assistant', content: `(error) ${msg}` },
        ])
      } finally {
        setSending(false)
      }
    },
    [activeId, sending, providerId, loadConversations],
  )

  const doAttach = useCallback(
    async (file: File) => {
      if (!activeId || messages.length === 0) {
        setError('Send a message first, then attach files')
        return
      }
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
      if (!lastUserMsg) {
        setError('No user message to attach to')
        return
      }
      try {
        const attachment = await uploadAttachment(activeId, lastUserMsg.id, file)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === lastUserMsg.id
              ? { ...m, attachments: [...(m.attachments ?? []), attachment] }
              : m,
          ),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    },
    [activeId, messages],
  )

  const doEditMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await apiEditMessage(messageId, content)
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content } : m)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed')
    }
  }, [])

  const doUploadAttachment = useCallback(
    async (messageId: string, file: File) => {
      if (!activeId) return
      try {
        const attachment = await uploadAttachment(activeId, messageId, file)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, attachments: [...(m.attachments ?? []), attachment] } : m,
          ),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    },
    [activeId],
  )

  // Keep refs fresh so registered actions always call the latest closures.
  useEffect(() => {
    sendRef.current = (text: string) => void doSend(text)
    attachRef.current = (file: File) => void doAttach(file)
  }, [doSend, doAttach])

  // Register chat actions once (idempotent) — B8 One Entry Point.
  useEffect(() => {
    ActionRegistry.register('chat.send', {
      description: 'Send a message in the active conversation',
      params: z.object({ text: z.string() }),
      run: (p) => sendRef.current(p.text),
    })
    ActionRegistry.register('chat.attach', {
      description: 'Attach a file to the active conversation',
      params: z.object({ fileName: z.string() }),
      run: (p) => attachRef.current(new File([], p.fileName)),
    })
  }, [])

  // Public send handler dispatches through the ActionRegistry (B8).
  const handleSend = useCallback((text: string) => {
    void ActionRegistry.dispatch('chat.send', { text })
  }, [])

  const handleAttach = useCallback((file: File) => {
    void ActionRegistry.dispatch('chat.attach', { fileName: file.name })
  }, [])

  return (
    <SlotProvider providerSlug={providerId}>
      <ChatSurface
        providerId={providerId}
        conversations={conversations}
        activeId={activeId}
        messages={messages}
        account={account}
        sending={sending}
        busy={busy}
        error={error}
        onSelectProvider={selectProvider}
        onSelectConversation={selectConversation}
        onNewChat={newChat}
        onSend={handleSend}
        onAttach={handleAttach}
        onEditMessage={doEditMessage}
        onUploadAttachment={doUploadAttachment}
      />
    </SlotProvider>
  )
}
