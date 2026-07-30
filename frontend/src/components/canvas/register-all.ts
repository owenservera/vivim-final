/**
 * components/canvas/register-all.ts
 * --------------------------------------------------------------------
 * Registers ALL UI components into the UniversalComponentRegistry.
 * Called once at boot by UniversalComponentProvider.
 *
 * Every component — canvas shells, node cards, panels, overlays,
 * theme controls, V6 components, primitives — gets a unique id,
 * kind, category, slot, capabilities, and metadata.
 *
 * After this runs, the CLI `list components` command shows every
 * registered component, and `component <id> <action>` can invoke
 * any component's capability.
 */

import type { ComponentType } from 'react'
import { registerCatalogComponent } from '../../hooks/useSlotOverrides'
import { register } from '../../shared/universal-registry'

// Lazy imports — these are client components, so we import the module
// objects and extract the component functions.
import * as CanvasMods from './index'

const C = CanvasMods as unknown as Record<string, ComponentType<Record<string, unknown>>>

export function registerAllComponents(): void {
  // ── Canvas shells ──────────────────────────────────────────────────
  register({
    id: 'canvas.living',
    label: 'Living Canvas',
    kind: 'canvas',
    category: 'chat',
    slot: 'canvas.primary',
    Component: C.LivingCanvas ?? null,
    capabilities: [
      'cap:canvas:resolve',
      'cap:canvas:spawn',
      'cap:canvas:dismiss',
      'cap:canvas:layout',
      'cap:canvas:zoom',
    ],
    version: 1,
    author: 'system',
    tags: ['v6', 'streaming', 'semantic-zoom', 'force-layout'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'canvas.surface',
    label: 'Canvas Surface (legacy)',
    kind: 'canvas',
    category: 'chat',
    slot: 'canvas.primary',
    Component: C.CanvasSurface ?? null,
    capabilities: ['cap:canvas:resolve', 'cap:canvas:spawn'],
    version: 1,
    author: 'system',
    tags: ['legacy', 'v5'],
    enabled: false,
  })

  // ── Cards ──────────────────────────────────────────────────────────
  register({
    id: 'card.doc',
    label: 'Document Card',
    kind: 'card',
    category: 'docs',
    slot: 'docs.card',
    Component: C.DocCard ?? null,
    capabilities: ['cap:document:read', 'cap:document:annotate'],
    version: 1,
    author: 'system',
    tags: ['document'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'card.doc-editor',
    label: 'Document Editor',
    kind: 'card',
    category: 'editor',
    slot: 'editor.primary',
    Component: C.DocEditor ?? null,
    capabilities: [
      'cap:document:open',
      'cap:document:edit',
      'cap:document:save',
      'cap:document:undo',
      'cap:document:redo',
      'cap:document:find_replace',
    ],
    version: 1,
    author: 'system',
    tags: ['document', 'editing'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'card.media',
    label: 'Media Card',
    kind: 'card',
    category: 'media',
    slot: 'media.card',
    Component: C.MediaCard ?? null,
    capabilities: ['cap:media:play', 'cap:media:pause', 'cap:media:seek', 'cap:media:transcribe'],
    version: 1,
    author: 'system',
    tags: ['media', 'video', 'audio'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'card.automation',
    label: 'Automation Card',
    kind: 'card',
    category: 'automation',
    slot: 'automation.card',
    Component: C.AutomationCard ?? null,
    capabilities: ['cap:automation:execute', 'cap:automation:list'],
    version: 1,
    author: 'system',
    tags: ['automation'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'card.agent',
    label: 'Agent Card',
    kind: 'card',
    category: 'agents',
    slot: 'agents.card',
    Component: C.AgentCard ?? null,
    capabilities: ['cap:agent:invoke', 'cap:agent:list'],
    version: 1,
    author: 'system',
    tags: ['agent'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'card.shell',
    label: 'Shell Card',
    kind: 'card',
    category: 'shell',
    slot: 'shell.terminal',
    Component: C.ShellCard ?? null,
    capabilities: ['cap:canvas:shell-command'],
    version: 1,
    author: 'system',
    tags: ['shell', 'cli'],
    enabled: true,
    isDefault: true,
  })

  // ── Panels ─────────────────────────────────────────────────────────
  register({
    id: 'panel.zlayer',
    label: 'Z-Layer Panel',
    kind: 'panel',
    category: 'zlayers',
    slot: 'zlayers.panel',
    Component: C.ZLayerPanel ?? null,
    capabilities: ['cap:zlayer:get', 'cap:zlayer:update', 'cap:zlayer:set_active'],
    version: 1,
    author: 'system',
    tags: ['z-layer', 'config'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.drawer',
    label: 'Drawer System',
    kind: 'panel',
    category: 'generic',
    slot: 'drawers.wrapper',
    Component: C.DrawerSystem ?? null,
    capabilities: ['cap:drawer:get', 'cap:drawer:update', 'cap:drawer:toggle'],
    version: 1,
    author: 'system',
    tags: ['drawer', 'config'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.audit',
    label: 'Audit Dashboard',
    kind: 'panel',
    category: 'audit',
    slot: 'audit.panel',
    Component: C.AuditDashboard ?? null,
    capabilities: ['cap:audit:list', 'cap:audit:stats', 'cap:audit:export'],
    version: 1,
    author: 'system',
    tags: ['audit', 'enterprise'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.rbac',
    label: 'RBAC Manager',
    kind: 'panel',
    category: 'rbac',
    slot: 'rbac.panel',
    Component: C.RbacManager ?? null,
    capabilities: ['cap:rbac:list_roles', 'cap:rbac:grant', 'cap:rbac:check'],
    version: 1,
    author: 'system',
    tags: ['rbac', 'enterprise'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.templates',
    label: 'Templates Gallery',
    kind: 'panel',
    category: 'templates',
    slot: 'templates.panel',
    Component: C.TemplatesGallery ?? null,
    capabilities: ['cap:template:list', 'cap:template:instantiate'],
    version: 1,
    author: 'system',
    tags: ['templates', 'enterprise'],
    enabled: true,
    isDefault: true,
  })

  // ── New canvas-level panels ────────────────────────────────────────
  register({
    id: 'panel.health',
    label: 'Health Dashboard',
    kind: 'panel',
    category: 'generic',
    slot: 'health.panel',
    Component: C.HealthDashboard ?? null,
    capabilities: ['cap:health:check'],
    version: 1,
    author: 'system',
    tags: ['health', 'monitoring'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.capability-catalog',
    label: 'Capability Catalog',
    kind: 'panel',
    category: 'generic',
    slot: 'capabilities.panel',
    Component: C.CapabilityCatalog ?? null,
    capabilities: ['cap:capability:list', 'cap:capability:execute'],
    version: 1,
    author: 'system',
    tags: ['capabilities'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.search',
    label: 'Search Panel',
    kind: 'panel',
    category: 'search',
    slot: 'search.panel',
    Component: C.SearchPanel ?? null,
    capabilities: ['cap:search:query'],
    version: 1,
    author: 'system',
    tags: ['search'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.canvas-controls',
    label: 'Mutation Controls',
    kind: 'panel',
    category: 'generic',
    slot: 'canvas.controls',
    Component: C.CanvasControlPanel ?? null,
    capabilities: ['cap:mutation:apply', 'cap:mutation:undo', 'cap:mutation:redo'],
    version: 1,
    author: 'system',
    tags: ['mutation', 'undo-redo'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.task-manager',
    label: 'Task Manager',
    kind: 'panel',
    category: 'generic',
    slot: 'autonomous.controls',
    Component: C.TaskManager ?? null,
    capabilities: ['cap:autonomous:execute', 'cap:autonomous:cancel'],
    version: 1,
    author: 'system',
    tags: ['autonomous', 'tasks'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.automation-launcher',
    label: 'Automation Launcher',
    kind: 'panel',
    category: 'automation',
    slot: 'automation.launcher',
    Component: C.AutomationLauncher ?? null,
    capabilities: ['cap:automation:run', 'cap:automation:list'],
    version: 1,
    author: 'system',
    tags: ['automation', 'browser'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.fleet-status',
    label: 'Fleet Status',
    kind: 'panel',
    category: 'generic',
    slot: 'fleet.controls',
    Component: C.FleetStatus ?? null,
    capabilities: ['cap:provider:list', 'cap:health:check'],
    version: 1,
    author: 'system',
    tags: ['fleet', 'providers'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'panel.session-controls',
    label: 'Session Controls',
    kind: 'panel',
    category: 'generic',
    slot: 'session.controls',
    Component: C.SessionControls ?? null,
    capabilities: ['cap:session:login', 'cap:session:logout'],
    version: 1,
    author: 'system',
    tags: ['session', 'auth'],
    enabled: true,
    isDefault: true,
  })

  // ── Overlays ───────────────────────────────────────────────────────
  register({
    id: 'overlay.palette',
    label: 'Command Palette',
    kind: 'overlay',
    category: 'search',
    slot: 'overlay.palette',
    Component: C.CommandPalette ?? null,
    capabilities: ['cap:search:query', 'cap:canvas:shell-command'],
    version: 1,
    author: 'system',
    tags: ['command-palette', 'search'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'overlay.notifications',
    label: 'Notifications Center',
    kind: 'overlay',
    category: 'notifications',
    slot: 'overlay.notifications',
    Component: C.NotificationsCenter ?? null,
    capabilities: ['cap:notification:list', 'cap:notification:mark_read', 'cap:notification:stats'],
    version: 1,
    author: 'system',
    tags: ['notifications'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'overlay.onboarding',
    label: 'Onboarding Tour',
    kind: 'overlay',
    category: 'onboarding',
    slot: 'overlay.onboarding',
    Component: C.OnboardingTour ?? null,
    capabilities: ['cap:onboarding:start', 'cap:onboarding:reset'],
    version: 1,
    author: 'system',
    tags: ['onboarding'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'overlay.quick-actions',
    label: 'Quick Actions Menu',
    kind: 'overlay',
    category: 'generic',
    slot: 'overlay.quick-actions',
    Component: C.QuickActionsMenu ?? null,
    capabilities: ['cap:canvas:shell-command', 'cap:document:open'],
    version: 1,
    author: 'system',
    tags: ['context-menu'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'overlay.agent',
    label: 'Agent Canvas Overlay',
    kind: 'overlay',
    category: 'agent-canvas',
    slot: 'overlay.agent',
    Component: C.AgentOverlay ?? null,
    capabilities: ['cap:agent:canvas', 'cap:agent:accept', 'cap:agent:reject'],
    version: 1,
    author: 'system',
    tags: ['agent', 'v6'],
    enabled: true,
    isDefault: true,
  })

  // ── Controls ───────────────────────────────────────────────────────
  register({
    id: 'control.theme-provider',
    label: 'Theme Provider',
    kind: 'control',
    category: 'theme',
    Component: C.ThemeProvider ?? null,
    capabilities: ['cap:theme:set_mode', 'cap:theme:set_accent', 'cap:theme:reset'],
    version: 1,
    author: 'system',
    tags: ['theme'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'control.theme-settings',
    label: 'Theme Settings',
    kind: 'control',
    category: 'theme',
    slot: 'control.theme',
    Component: C.ThemeSettings ?? null,
    capabilities: ['cap:theme:set_mode', 'cap:theme:set_accent'],
    version: 1,
    author: 'system',
    tags: ['theme'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'control.workspace-switcher',
    label: 'Workspace Switcher',
    kind: 'control',
    category: 'workspace',
    slot: 'control.workspace',
    Component: C.WorkspaceSwitcher ?? null,
    capabilities: ['cap:workspace:list', 'cap:workspace:switch', 'cap:workspace:create'],
    version: 1,
    author: 'system',
    tags: ['workspace'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'control.presence',
    label: 'Presence Indicator',
    kind: 'control',
    category: 'presence',
    slot: 'control.presence',
    Component: C.PresenceIndicator ?? null,
    capabilities: ['cap:presence:list_users', 'cap:presence:list_cursors'],
    version: 1,
    author: 'system',
    tags: ['presence', 'multiplayer'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'control.vcard-menu',
    label: 'vCard Menu',
    kind: 'control',
    category: 'vcard',
    Component: C.VCardMenu ?? null,
    capabilities: [
      'cap:vcard:collapse',
      'cap:vcard:pin',
      'cap:vcard:fullscreen',
      'cap:vcard:lock',
      'cap:vcard:remove',
    ],
    version: 1,
    author: 'system',
    tags: ['vcard', 'context-menu'],
    enabled: true,
    isDefault: true,
  })

  // ── Primitives ─────────────────────────────────────────────────────
  register({
    id: 'primitive.sandboxed-node',
    label: 'Sandboxed Node',
    kind: 'primitive',
    category: 'generic',
    Component: C.SandboxedNode ?? null,
    capabilities: ['cap:canvas:spawn'],
    version: 1,
    author: 'system',
    tags: ['sandbox', 'iframe', 'csp'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'primitive.connection-layer',
    label: 'Connection Layer',
    kind: 'primitive',
    category: 'connection',
    Component: C.ConnectionLayer ?? null,
    capabilities: ['cap:canvas:connect', 'cap:canvas:disconnect'],
    version: 1,
    author: 'system',
    tags: ['connection', 'io', 'v6'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'primitive.observability-hud',
    label: 'Observability HUD',
    kind: 'primitive',
    category: 'observability',
    Component: C.ObservabilityHUD ?? null,
    capabilities: ['cap:audit:list', 'cap:audit:stats'],
    version: 1,
    author: 'system',
    tags: ['observability', 'v6'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'primitive.unified-io',
    label: 'Unified IO Provider',
    kind: 'primitive',
    category: 'io',
    Component: C.UnifiedIOProvider ?? null,
    capabilities: ['cap:io:request', 'cap:io:subscribe'],
    version: 1,
    author: 'system',
    tags: ['io', 'transport'],
    enabled: true,
    isDefault: true,
  })

  // ── Hooks (non-visual) ─────────────────────────────────────────────
  register({
    id: 'hook.stream-slot',
    label: 'useStreamSlot',
    kind: 'hook',
    category: 'generic',
    Component: null,
    capabilities: ['cap:stream:start', 'cap:stream:pause', 'cap:stream:resume', 'cap:stream:stop'],
    version: 1,
    author: 'system',
    tags: ['streaming', 'v6'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'hook.resolved-nodes',
    label: 'useResolvedNodes',
    kind: 'hook',
    category: 'generic',
    Component: null,
    capabilities: ['cap:canvas:resolve'],
    version: 1,
    author: 'system',
    tags: ['resolve'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'hook.canvas-events',
    label: 'useCanvasEvents',
    kind: 'hook',
    category: 'generic',
    Component: null,
    capabilities: ['cap:canvas:observe'],
    version: 1,
    author: 'system',
    tags: ['events', 'sse'],
    enabled: true,
    isDefault: true,
  })

  // ── Populate COMPONENT_CATALOG for canvas-level hot-swap overrides ──
  // Chat-level catalog is populated by ml-boot.ts. This covers canvas-level
  // components so useSlotOverrides can resolve them for canvas slots.
  registerCatalogComponent('LivingCanvas', C.LivingCanvas ?? (null as unknown as any))
  registerCatalogComponent('DocEditor', C.DocEditor ?? (null as unknown as any))
  registerCatalogComponent('MediaCard', C.MediaCard ?? (null as unknown as any))
  registerCatalogComponent('AgentCard', C.AgentCard ?? (null as unknown as any))
  registerCatalogComponent('AgentOverlay', C.AgentOverlay ?? (null as unknown as any))
  registerCatalogComponent('AuditDashboard', C.AuditDashboard ?? (null as unknown as any))
  registerCatalogComponent('TemplatesGallery', C.TemplatesGallery ?? (null as unknown as any))
  registerCatalogComponent('HealthDashboard', C.HealthDashboard ?? (null as unknown as any))
  registerCatalogComponent('CapabilityCatalog', C.CapabilityCatalog ?? (null as unknown as any))
  registerCatalogComponent('NotificationsCenter', C.NotificationsCenter ?? (null as unknown as any))
  registerCatalogComponent('PresenceIndicator', C.PresenceIndicator ?? (null as unknown as any))
  registerCatalogComponent('ZLayerPanel', C.ZLayerPanel ?? (null as unknown as any))
  registerCatalogComponent('WorkspaceSwitcher', C.WorkspaceSwitcher ?? (null as unknown as any))
  registerCatalogComponent('OnboardingTour', C.OnboardingTour ?? (null as unknown as any))
  registerCatalogComponent('CommandPalette', C.CommandPalette ?? (null as unknown as any))
  registerCatalogComponent('DrawerSystem', C.DrawerSystem ?? (null as unknown as any))
  registerCatalogComponent('ShellCard', C.ShellCard ?? (null as unknown as any))
  registerCatalogComponent('AutomationCard', C.AutomationCard ?? (null as unknown as any))
  registerCatalogComponent('RbacManager', C.RbacManager ?? (null as unknown as any))
  registerCatalogComponent('SearchPanel', C.SearchPanel ?? (null as unknown as any))
  registerCatalogComponent('CanvasControlPanel', C.CanvasControlPanel ?? (null as unknown as any))
  registerCatalogComponent('TaskManager', C.TaskManager ?? (null as unknown as any))
  registerCatalogComponent('AutomationLauncher', C.AutomationLauncher ?? (null as unknown as any))
  registerCatalogComponent('FleetStatus', C.FleetStatus ?? (null as unknown as any))
  registerCatalogComponent('SessionControls', C.SessionControls ?? (null as unknown as any))
  registerCatalogComponent('QuickActionsMenu', C.QuickActionsMenu ?? (null as unknown as any))
  registerCatalogComponent('ThemeProvider', C.ThemeProvider ?? (null as unknown as any))
  registerCatalogComponent('ThemeSettings', C.ThemeSettings ?? (null as unknown as any))
  registerCatalogComponent('VCardMenu', C.VCardMenu ?? (null as unknown as any))

  // ── SSOA tab components ──────────────────────────────────────────────
  register({
    id: 'tab.bar',
    label: 'Tab Bar',
    kind: 'panel',
    category: 'chat',
    slot: 'tab.bar',
    Component: C.TabBar ?? null,
    capabilities: ['cap:tab:navigate', 'cap:tab:toggle'],
    version: 1,
    author: 'system',
    tags: ['ssoa', 'tabs', 'binder'],
    enabled: true,
    isDefault: true,
  })
  register({
    id: 'tab.layer-switcher',
    label: 'Layer Switcher',
    kind: 'panel',
    category: 'chat',
    slot: 'tab.layer-switcher',
    Component: C.LayerSwitcher ?? null,
    capabilities: ['cap:layer:switch'],
    version: 1,
    author: 'system',
    tags: ['ssoa', 'layers'],
    enabled: true,
    isDefault: true,
  })

  // ── Unified entry point ─────────────────────────────────────────────
  register({
    id: 'entry.unified',
    label: 'Unified Entry',
    kind: 'panel',
    category: 'chat',
    slot: 'entry.unified',
    Component: C.UnifiedEntry ?? null,
    capabilities: ['cap:entry:send', 'cap:entry:create-conversation'],
    version: 1,
    author: 'system',
    tags: ['ssoa', 'entry', 'composer', 'input'],
    enabled: true,
    isDefault: true,
  })

  // ── P2-6: SlidePanel (SSOA panel content renderer) ─────────────────
  register({
    id: 'tab.panel-content',
    label: 'Slide Panel',
    kind: 'panel',
    category: 'chat',
    slot: 'tab.panel-content',
    Component: C.SlidePanel ?? null,
    capabilities: [],
    version: 1,
    author: 'system',
    tags: ['ssoa', 'panel', 'slide', 'overlay'],
    enabled: true,
    isDefault: true,
  })
}
