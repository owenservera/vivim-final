// components/canvas/TabConfig.ts
// SSOA layer definitions, panel categories, and tab ordering.

export type PanelSize = 'compact' | 'normal' | 'wide';
export type PanelDock = 'left' | 'right' | 'top' | 'bottom' | 'float';

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
  description?: string
  shortcut?: string
  defaultSize?: PanelSize
  defaultDock?: PanelDock
  badge?: number
  indicatorColor?: string
}

export const CATEGORY_COLORS: Record<TabCategory, string> = {
  communication: 'var(--color-info)',
  providers: 'var(--color-purple)',
  tools: 'var(--color-success)',
  content: 'var(--color-warning)',
  admin: 'var(--color-error)',
  canvas: 'var(--color-cyan)',
  session: 'var(--color-pink)',
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
    description: 'List and manage conversations',
    shortcut: 'Cmd+1',
    defaultSize: 'normal',
    defaultDock: 'left',
  },
  search: {
    id: 'search',
    label: 'Search',
    icon: 'search',
    category: 'tools',
    panelType: 'drawer',
    color: CATEGORY_COLORS.tools,
    description: 'Search across conversations and capabilities',
    shortcut: 'Cmd+K',
    defaultSize: 'compact',
    defaultDock: 'right',
  },
  health: {
    id: 'health',
    label: 'Health',
    icon: 'activity',
    category: 'providers',
    panelType: 'mini',
    color: CATEGORY_COLORS.providers,
    description: 'Provider health status and monitoring',
    shortcut: 'Cmd+Shift+H',
    defaultSize: 'compact',
    defaultDock: 'bottom',
    indicatorColor: 'var(--color-success)',
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    category: 'session',
    panelType: 'full',
    color: CATEGORY_COLORS.session,
    description: 'Workspace and application configuration',
    shortcut: 'Cmd+,',
    defaultSize: 'normal',
    defaultDock: 'right',
  },
  capabilities: {
    id: 'capabilities',
    label: 'Capabilities',
    icon: 'grid',
    category: 'tools',
    panelType: 'full',
    color: CATEGORY_COLORS.tools,
    description: 'Browse and invoke platform capabilities',
    shortcut: 'Cmd+Shift+C',
    defaultSize: 'wide',
    defaultDock: 'right',
  },
  automation: {
    id: 'automation',
    label: 'Automation',
    icon: 'bolt',
    category: 'tools',
    panelType: 'full',
    color: CATEGORY_COLORS.tools,
    description: 'Automation rules and launchers',
    shortcut: 'Cmd+Shift+A',
    defaultSize: 'wide',
    defaultDock: 'right',
  },
  terminal: {
    id: 'terminal',
    label: 'Terminal',
    icon: 'terminal',
    category: 'tools',
    panelType: 'drawer',
    color: CATEGORY_COLORS.tools,
    description: 'Execute CLI commands within the canvas',
    shortcut: 'Cmd+Shift+T',
    defaultSize: 'compact',
    defaultDock: 'bottom',
  },
  fleet: {
    id: 'fleet',
    label: 'Fleet',
    icon: 'cpu',
    category: 'providers',
    panelType: 'mini',
    color: CATEGORY_COLORS.providers,
    description: 'Browser fleet and provider connection status',
    shortcut: 'Cmd+Shift+F',
    defaultSize: 'compact',
    defaultDock: 'bottom',
  },
  templates: {
    id: 'templates',
    label: 'Templates',
    icon: 'template',
    category: 'content',
    panelType: 'full',
    color: CATEGORY_COLORS.content,
    description: 'Template gallery for reusable content',
    shortcut: 'Cmd+Shift+P',
    defaultSize: 'normal',
    defaultDock: 'right',
  },
  audit: {
    id: 'audit',
    label: 'Audit',
    icon: 'chart',
    category: 'admin',
    panelType: 'full',
    color: CATEGORY_COLORS.admin,
    description: 'Audit log and compliance monitoring',
    shortcut: 'Cmd+Shift+L',
    defaultSize: 'wide',
    defaultDock: 'right',
  },
  rbac: {
    id: 'rbac',
    label: 'RBAC',
    icon: 'shield',
    category: 'admin',
    panelType: 'full',
    color: CATEGORY_COLORS.admin,
    description: 'Role-based access control management',
    shortcut: 'Cmd+Shift+R',
    defaultSize: 'normal',
    defaultDock: 'right',
  },
  zlayers: {
    id: 'zlayers',
    label: 'Z-Layers',
    icon: 'layers',
    category: 'canvas',
    panelType: 'full',
    color: CATEGORY_COLORS.canvas,
    description: 'Canvas z-layer visibility and ordering',
    shortcut: 'Cmd+Shift+Z',
    defaultSize: 'compact',
    defaultDock: 'right',
  },
  'session-controls': {
    id: 'session-controls',
    label: 'Session',
    icon: 'clock',
    category: 'session',
    panelType: 'mini',
    color: CATEGORY_COLORS.session,
    description: 'Session state and controls',
    shortcut: 'Cmd+Shift+S',
    defaultSize: 'compact',
    defaultDock: 'bottom',
  },
  'task-manager': {
    id: 'task-manager',
    label: 'Tasks',
    icon: 'check',
    category: 'session',
    panelType: 'mini',
    color: CATEGORY_COLORS.session,
    description: 'Task tracking and progress',
    shortcut: 'Cmd+Shift+D',
    defaultSize: 'compact',
    defaultDock: 'bottom',
  },
  providers: {
    id: 'providers',
    label: 'Providers',
    icon: 'cpu',
    category: 'providers',
    panelType: 'full',
    color: CATEGORY_COLORS.providers,
    description: 'Manage LLM providers and accounts',
    shortcut: 'Cmd+Shift+E',
    defaultSize: 'normal',
    defaultDock: 'left',
  },
  documents: {
    id: 'documents',
    label: 'Documents',
    icon: 'document',
    category: 'content',
    panelType: 'full',
    color: CATEGORY_COLORS.content,
    description: 'Document management and editing',
    shortcut: 'Cmd+Shift+O',
    defaultSize: 'wide',
    defaultDock: 'right',
  },
  media: {
    id: 'media',
    label: 'Media',
    icon: 'media',
    category: 'content',
    panelType: 'full',
    color: CATEGORY_COLORS.content,
    description: 'Media library and generation tools',
    shortcut: 'Cmd+Shift+M',
    defaultSize: 'wide',
    defaultDock: 'right',
  },
  agents: {
    id: 'agents',
    label: 'Agents',
    icon: 'robot',
    category: 'tools',
    panelType: 'full',
    color: CATEGORY_COLORS.tools,
    description: 'Agent management and orchestration',
    shortcut: 'Cmd+Shift+G',
    defaultSize: 'normal',
    defaultDock: 'right',
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

export function getPanelConfig(panelId: string): TabConfig | undefined {
  return PANEL_REGISTRY[panelId]
}

export function listPanels(): TabConfig[] {
  return Object.values(PANEL_REGISTRY)
}
