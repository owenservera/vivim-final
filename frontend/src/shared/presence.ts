/**
 * shared/presence.ts
 * --------------------------------------------------------------------
 * #7 Live Presence Indicators — simulated multiplayer.
 * Avatars in the header showing "who's here"; animated cursors on canvas.
 */

export interface PresenceUser {
  id: string
  displayName: string
  avatarColor: string
  avatarEmoji: string
}

export interface PresenceCursor {
  userId: string
  user: PresenceUser
  workspaceId: string
  /** World-space cursor position. */
  x: number
  y: number
  /** What the user is currently doing (for the activity badge). */
  activity?: string
  /** Last-seen timestamp (ms). */
  lastSeenAt: number
}

export interface PresenceSession {
  workspaceId: string
  users: PresenceUser[]
  cursors: PresenceCursor[]
}

/** Simulated users for the prototype (production wires to real auth). */
export const SIMULATED_USERS: PresenceUser[] = [
  { id: 'user:1', displayName: 'You', avatarColor: '#f59e0b', avatarEmoji: '' },
  { id: 'user:2', displayName: 'Maya', avatarColor: '#0ea5e9', avatarEmoji: '' },
  { id: 'user:3', displayName: 'Theo', avatarColor: '#8b5cf6', avatarEmoji: '' },
  { id: 'user:4', displayName: 'Sage', avatarColor: '#10b981', avatarEmoji: '' },
  { id: 'user:5', displayName: 'Kai', avatarColor: '#f43f5e', avatarEmoji: '' },
]
