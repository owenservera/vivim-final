// components/canvas/TabConfig.ts
// SSOA layer definitions, panel categories, and tab ordering.

export type LayerId = 'chat' | 'build' | 'admin'
export type PanelType = 'full' | 'mini' | 'badge' | 'indicator' | 'drawer'
export type TabCategory =
  | 'communication'
  | 'providers'
  | 'tools'
  | 'content'
  | 'admin'
  | 'canvas'
  | 'session'

export interface LayerConfig {
  id: LayerId
  label: string
  icon: string
  color: string
  shortcut: string
  chatBehavior: 'chat' | 'prompt' | 'command'
  inputPlaceholder: string
  defaultPanels: string[]
  canvasSlots: string[]
  tabOrder: string[]
}

export interface TabConfig {
  id: string
  label: string
  icon: string
  category: TabCategory
  panelType: PanelType
  color: string
  badge?: number
  indicatorColor?: string
}

export const CATEGORY_COLORS: Record<TabCategory, string> = {
  communication: '#3b82f6',
  providers: '#8b5cf6',
  tools: '#10b981',
  content: '#f59e0b',
  admin: '#ef4444',
  canvas: '#06b6d4',
  session: '#ec4899',
}

export const LAYER_REGISTRY: LayerConfig[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: 'message-square',
    color: 'var(--layer-chat, #3b82f6)',
    shortcut: 'Cmd+1',
    chatBehavior: 'chat',
    inputPlaceholder: 'Message...',
    defaultPanels: ['conversations', 'search'],
    canvasSlots: [
      'chat.header',
      'chat.sidebar',
      'chat.thread',
      'chat.composer',
      'chat.entry',
      'chat.actionBar',
    ],
    tabOrder: ['conversations', 'search', 'health', 'settings'],
  },
  {
    id: 'build',
    label: 'Build',
    icon: 'bolt',
    color: 'var(--layer-build, #10b981)',
    shortcut: 'Cmd+2',
    chatBehavior: 'prompt',
    inputPlaceholder: 'What should the agent do?',
    defaultPanels: ['capabilities', 'automation'],
    canvasSlots: [
      'chat.header',
      'chat.composer',
      'chat.result',
      'automation.launcher',
      'fleet.controls',
    ],
    tabOrder: ['capabilities', 'automation', 'terminal', 'fleet', 'templates'],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'shield',
    color: 'var(--layer-admin, #ef4444)',
    shortcut: 'Cmd+3',
    chatBehavior: 'command',
    inputPlaceholder: 'Type a command...',
    defaultPanels: ['audit', 'rbac'],
    canvasSlots: ['chat.header', 'chat.composer', 'audit.panel', 'rbac.panel', 'zlayers.panel'],
    tabOrder: ['audit', 'rbac', 'zlayers', 'session-controls', 'task-manager'],
  },
]

export const PANEL_REGISTRY: Record<string, TabConfig> = {
  conversations: {
    id: 'conversations',
    label: 'Conversations',
    icon: 'message-square',
    category: 'communication',
    panelType: 'full',
    color: CATEGORY_COLORS.communication,
  },
  search: {
    id: 'search',
    label: 'Search',
    icon: 'search',
    category: 'tools',
    panelType: 'drawer',
    color: CATEGORY_COLORS.tools,
  },
  health: {
    id: 'health',
    label: 'Health',
    icon: 'activity',
    category: 'providers',
    panelType: 'mini',
    color: CATEGORY_COLORS.providers,
    indicatorColor: '#10b981',
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    category: 'session',
    panelType: 'full',
    color: CATEGORY_COLORS.session,
  },
  capabilities: {
    id: 'capabilities',
    label: 'Capabilities',
    icon: 'grid',
    category: 'tools',
    panelType: 'full',
    color: CATEGORY_COLORS.tools,
  },
  automation: {
    id: 'automation',
    label: 'Automation',
    icon: 'bolt',
    category: 'tools',
    panelType: 'full',
    color: CATEGORY_COLORS.tools,
  },
  terminal: {
    id: 'terminal',
    label: 'Terminal',
    icon: 'terminal',
    category: 'tools',
    panelType: 'drawer',
    color: CATEGORY_COLORS.tools,
  },
  fleet: {
    id: 'fleet',
    label: 'Fleet',
    icon: 'cpu',
    category: 'providers',
    panelType: 'mini',
    color: CATEGORY_COLORS.providers,
  },
  templates: {
    id: 'templates',
    label: 'Templates',
    icon: 'template',
    category: 'content',
    panelType: 'full',
    color: CATEGORY_COLORS.content,
  },
  audit: {
    id: 'audit',
    label: 'Audit',
    icon: 'chart',
    category: 'admin',
    panelType: 'full',
    color: CATEGORY_COLORS.admin,
  },
  rbac: {
    id: 'rbac',
    label: 'RBAC',
    icon: 'shield',
    category: 'admin',
    panelType: 'full',
    color: CATEGORY_COLORS.admin,
  },
  zlayers: {
    id: 'zlayers',
    label: 'Z-Layers',
    icon: 'layers',
    category: 'canvas',
    panelType: 'full',
    color: CATEGORY_COLORS.canvas,
  },
  'session-controls': {
    id: 'session-controls',
    label: 'Session',
    icon: 'clock',
    category: 'session',
    panelType: 'mini',
    color: CATEGORY_COLORS.session,
  },
  'task-manager': {
    id: 'task-manager',
    label: 'Tasks',
    icon: 'check',
    category: 'session',
    panelType: 'mini',
    color: CATEGORY_COLORS.session,
  },
  providers: {
    id: 'providers',
    label: 'Providers',
    icon: 'cpu',
    category: 'providers',
    panelType: 'full',
    color: CATEGORY_COLORS.providers,
  },
  documents: {
    id: 'documents',
    label: 'Documents',
    icon: 'document',
    category: 'content',
    panelType: 'full',
    color: CATEGORY_COLORS.content,
  },
  media: {
    id: 'media',
    label: 'Media',
    icon: 'media',
    category: 'content',
    panelType: 'full',
    color: CATEGORY_COLORS.content,
  },
  agents: {
    id: 'agents',
    label: 'Agents',
    icon: 'robot',
    category: 'tools',
    panelType: 'full',
    color: CATEGORY_COLORS.tools,
  },
}

export function getLayerConfig(layerId: LayerId): LayerConfig {
  return LAYER_REGISTRY.find((l) => l.id === layerId) ?? LAYER_REGISTRY[0]!
}

export function getTabsForLayer(layerId: LayerId): TabConfig[] {
  const layer = getLayerConfig(layerId)
  return layer.tabOrder
    .map((id) => PANEL_REGISTRY[id])
    .filter((t): t is TabConfig => t !== undefined)
}

export function getPanelType(panelId: string): PanelType {
  return PANEL_REGISTRY[panelId]?.panelType ?? 'full'
}
