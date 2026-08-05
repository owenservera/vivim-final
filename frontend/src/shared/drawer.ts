/**
 * shared/drawer.ts
 * --------------------------------------------------------------------
 * E3 — Edge badges / drawers.
 *
 * 4 configurable drawers (left / right / top / bottom). Each drawer
 * holds "panels" — messenger feeds, agents, conversations, todos,
 * priorities, hits/tips/tricks, etc. Fully data-driven from a
 * DrawerStore; the shell renders whatever the config says.
 *
 * Drawers are:
 *   - Pinned (always visible) or floating (toggle on hover/click)
 *   - Resizable (drag the edge)
 *   - Collapsible (click to fold)
 *   - Multi-panel (tabs inside a drawer)
 */

export type DrawerEdge = 'left' | 'right' | 'top' | 'bottom'

export type DrawerPanelKind =
  | 'messenger' // chat feed (Slack/Discord-style)
  | 'agents' // active agents list + status
  | 'conversations' // conversation list
  | 'todos' // todo list
  | 'priorities' // priority queue
  | 'hits-tips-tricks' // tips & tricks feed
  | 'notifications' // notification feed
  | 'presence' // who's online
  | 'audit' // recent audit events
  | 'custom' // plugin-provided panel

export interface DrawerPanel {
  id: string
  kind: DrawerPanelKind
  title: string
  icon: string
  /** Whether the panel is loaded (vs lazy). */
  loaded: boolean
  /** Badge count (e.g. unread messages, pending todos). */
  badge?: number
  /** Custom render key (for plugin panels). */
  renderKey?: string
  /** Panel-specific config. */
  config?: Record<string, unknown>
}

export interface DrawerConfig {
  edge: DrawerEdge
  /** Panels in this drawer (tab order). */
  panels: DrawerPanel[]
  /** Active panel id. */
  activePanelId?: string
  /** Drawer size in px (width for left/right, height for top/bottom). */
  size: number
  /** Whether the drawer is pinned (always visible). */
  pinned: boolean
  /** Whether the drawer is collapsed. */
  collapsed: boolean
  /** Whether the drawer is visible at all. */
  visible: boolean
}

export interface WorkspaceDrawerConfig {
  workspaceId: string
  drawers: Record<DrawerEdge, DrawerConfig>
  updatedAt: number
}

/** Default drawer config: left = conversations, right = agents/todos, bottom = hits-tips. */
export function defaultDrawerConfig(workspaceId: string): WorkspaceDrawerConfig {
  return {
    workspaceId,
    drawers: {
      left: {
        edge: 'left',
        panels: [
          {
            id: 'conversations',
            kind: 'conversations',
            title: 'Conversations',
            icon: '',
            loaded: true,
          },
          { id: 'presence', kind: 'presence', title: 'Online', icon: 'users', loaded: true },
        ],
        activePanelId: 'conversations',
        size: 280,
        pinned: false,
        collapsed: false,
        visible: true,
      },
      right: {
        edge: 'right',
        panels: [
          { id: 'agents', kind: 'agents', title: 'Agents', icon: 'robot', loaded: true },
          { id: 'todos', kind: 'todos', title: 'Todos', icon: '', loaded: true, badge: 3 },
          {
            id: 'priorities',
            kind: 'priorities',
            title: 'Priorities',
            icon: 'flag',
            loaded: true,
            badge: 2,
          },
        ],
        activePanelId: 'agents',
        size: 300,
        pinned: false,
        collapsed: false,
        visible: true,
      },
      top: {
        edge: 'top',
        panels: [],
        size: 0,
        pinned: false,
        collapsed: true,
        visible: false,
      },
      bottom: {
        edge: 'bottom',
        panels: [
          {
            id: 'hits-tips',
            kind: 'hits-tips-tricks',
            title: 'Tips & Tricks',
            icon: '',
            loaded: true,
          },
          { id: 'notifications', kind: 'notifications', title: 'Activity', icon: '', loaded: true },
        ],
        activePanelId: 'hits-tips',
        size: 180,
        pinned: false,
        collapsed: true,
        visible: true,
      },
    },
    updatedAt: Date.now(),
  }
}
