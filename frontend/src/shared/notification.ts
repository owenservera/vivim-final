/**
 * shared/notification.ts
 * --------------------------------------------------------------------
 * #3 Smart Notifications Center — notification types.
 * Unified inbox with smart filtering: mentions, errors, completions,
 * HITL requests, system events. Real-time via SSE.
 */

export type NotificationKind =
  | 'mention' // user was @mentioned
  | 'error' // capability failed / sandbox denied
  | 'completion' // automation/agent finished
  | 'hitl' // human-in-the-loop gate requested
  | 'system' // workspace created/provider added/tier upgraded
  | 'info' // general info

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Notification {
  id: string
  userId: string
  kind: NotificationKind
  priority: NotificationPriority
  title: string
  body: string
  /** Source capability id (e.g. cap:automation:execute). */
  sourceCapabilityId?: string
  /** Source entity (workspaceId | automationId | agentId | documentId | mediaId). */
  sourceEntityId?: string
  /** Trace id for audit correlation. */
  traceId?: string
  read: boolean
  archived: boolean
  createdAt: number
  readAt?: number
}

export interface NotificationFilter {
  kind?: NotificationKind
  priority?: NotificationPriority
  unreadOnly?: boolean
  archived?: boolean
  limit?: number
}

export interface NotificationStats {
  total: number
  unread: number
  byKind: Record<NotificationKind, number>
  byPriority: Record<NotificationPriority, number>
}
