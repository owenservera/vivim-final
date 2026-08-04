import type { ComponentType } from 'react'

type PanelLoader = () => Promise<{ default: ComponentType<any> }>

// P3-4: Wrap named exports into { default: ... } shape for lazy loading
const panelLoaders: Record<string, PanelLoader> = {
  conversations: async () => {
    const m = await import('./panels/ConversationsPanel')
    return { default: m.ConversationsPanel }
  },
  providers: async () => {
    const m = await import('./panels/ProvidersPanel')
    return { default: m.ProvidersPanel }
  },
  settings: async () => {
    const m = await import('./panels/SettingsPanel')
    return { default: m.SettingsPanel }
  },
  health: async () => {
    const m = await import('./HealthDashboard')
    return { default: m.HealthDashboard }
  },
  capabilities: async () => {
    const m = await import('./CapabilityCatalog')
    return { default: m.CapabilityCatalog }
  },
  search: async () => {
    const m = await import('./SearchPanel')
    return { default: m.SearchPanel }
  },
  automation: async () => {
    const m = await import('./AutomationLauncher')
    return { default: m.AutomationLauncher }
  },
  // P2-3: Import ShellCard directly instead of entire cards barrel
  terminal: async () => {
    const m = await import('./cards/ShellCard')
    return { default: m.ShellCard }
  },
  fleet: async () => {
    const m = await import('./FleetStatus')
    return { default: m.FleetStatus }
  },
  templates: async () => {
    const m = await import('./TemplatesGallery')
    return { default: m.TemplatesGallery }
  },
  audit: async () => {
    const m = await import('./AuditDashboard')
    return { default: m.AuditDashboard }
  },
  rbac: async () => {
    const m = await import('./RbacManager')
    return { default: m.RbacManager }
  },
  zlayers: async () => {
    const m = await import('./ZLayerPanel')
    return { default: m.ZLayerPanel }
  },
  'session-controls': async () => {
    const m = await import('./SessionControls')
    return { default: m.SessionControls }
  },
  'task-manager': async () => {
    const m = await import('./TaskManager')
    return { default: m.TaskManager }
  },
  documents: async () => {
    const m = await import('./panels/DocumentsPanel')
    return { default: m.DocumentsPanel }
  },
  media: async () => {
    const m = await import('./panels/MediaPanel')
    return { default: m.MediaPanel }
  },
  agents: async () => {
    const m = await import('./panels/AgentsPanel')
    return { default: m.AgentsPanel }
  },
}

export function getPanelLoader(panelId: string): PanelLoader | undefined {
  return panelLoaders[panelId]
}

export function hasPanel(panelId: string): boolean {
  return panelId in panelLoaders
}
