// web/ui/src/ui/defaults/types.ts
// Shared prop contracts for the default slot renderers. Surfaces pass these
// props when rendering a resolved slot component. The registry stores slots as
// `ComponentType<Record<string, unknown>>`, so each default receives its typed
// props at the surface and casts internally.

import type { ChatConversation, ChatMessage } from '../../features/chat/types.js'
import type { ProviderChatAdapter } from '../../providers/registry.js'

export interface BubbleProps {
  message: ChatMessage
  adapter: ProviderChatAdapter
  isLast?: boolean
  onEdit?: (messageId: string, content: string) => Promise<void>
  onUploadAttachment?: (messageId: string, file: File) => Promise<void>
}

export interface SidebarProps {
  adapter: ProviderChatAdapter
  conversations: ChatConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export interface ThreadProps {
  messages: ChatMessage[]
  adapter: ProviderChatAdapter
  emptyHint: string
  streaming: boolean
  onEditMessage?: (messageId: string, content: string) => Promise<void>
  onUploadAttachment?: (messageId: string, file: File) => Promise<void>
}

export interface ComposerProps {
  adapter: ProviderChatAdapter
  disabled: boolean
  onSend: (text: string) => void
  onAttach?: (file: File) => void
  canAttach: boolean
}

export interface SendButtonProps {
  onSend: () => void
  disabled: boolean
  brandColor: string
  brandText: string
  pending: boolean
}

export interface AttachButtonProps {
  onAttach: (file: File) => void
  disabled: boolean
  brandColor: string
  brandText: string
}

export interface StreamingProps {
  active: boolean
}

export interface ResultProps {
  blocks: Array<{ kind: string; content: string }>
}

export interface ConfirmProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export interface ErrorProps {
  message: string | null
}

export interface HeaderProps {
  adapters: ProviderChatAdapter[]
  activeProviderId: string
  onSelect: (id: string) => void
  accountEmail?: string
  accountState?: string
}

export interface ActionBarProps {
  actions: Array<{ id: string; label: string; params?: Record<string, unknown> }>
}

export interface EntryProps {
  sidebar: React.ReactNode
  header: React.ReactNode
  thread: React.ReactNode
  errorBar: React.ReactNode
  composer: React.ReactNode
}
