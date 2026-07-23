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

import { register } from '../../shared/universal-registry';
import type { ComponentType } from 'react';

// Lazy imports — these are client components, so we import the module
// objects and extract the component functions.
import * as CanvasMods from './index';

const C = CanvasMods as unknown as Record<string, ComponentType<Record<string, unknown>>>;

export function registerAllComponents(): void {
  // ── Canvas shells ──────────────────────────────────────────────────
  register({
    id: 'canvas.living',
    label: 'Living Canvas',
    kind: 'canvas',
    category: 'chat',
    slot: 'canvas.primary',
    Component: C.LivingCanvas ?? null,
    capabilities: ['cap:canvas:resolve', 'cap:canvas:spawn', 'cap:canvas:dismiss', 'cap:canvas:layout', 'cap:canvas:zoom'],
    version: 1,
    author: 'system',
    tags: ['v6', 'streaming', 'semantic-zoom', 'force-layout'],
    enabled: true,
    isDefault: true,
  });
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
  });

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
  });
  register({
    id: 'card.doc-editor',
    label: 'Document Editor',
    kind: 'card',
    category: 'editor',
    slot: 'editor.primary',
    Component: C.DocEditor ?? null,
    capabilities: ['cap:document:open', 'cap:document:edit', 'cap:document:save', 'cap:document:undo', 'cap:document:redo', 'cap:document:find_replace'],
    version: 1,
    author: 'system',
    tags: ['document', 'editing'],
    enabled: true,
    isDefault: true,
  });
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
  });
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
  });
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
  });
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
  });

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
  });
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
  });
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
  });
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
  });
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
  });

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
  });
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
  });
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
  });
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
  });
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
  });

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
  });
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
  });
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
  });
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
  });
  register({
    id: 'control.vcard-menu',
    label: 'vCard Menu',
    kind: 'control',
    category: 'vcard',
    Component: C.VCardMenu ?? null,
    capabilities: ['cap:vcard:collapse', 'cap:vcard:pin', 'cap:vcard:fullscreen', 'cap:vcard:lock', 'cap:vcard:remove'],
    version: 1,
    author: 'system',
    tags: ['vcard', 'context-menu'],
    enabled: true,
    isDefault: true,
  });

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
  });
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
  });
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
  });
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
  });

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
  });
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
  });
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
  });
}
