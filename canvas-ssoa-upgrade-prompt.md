# Canvas SSOA v2 — Layer-Organized Notebook Binder Architecture

## Objective

Transform the Vivim Canvas from a flat floating-panel system into a **Layer-Organized Notebook Binder** with edge-mounted colored tabs. The canvas has **programmable layers** (workspace modes), each layer has its own pre-configured set of tab panels, all layers share a **master chat input**, and the entire state lives in a single Session State store (SSOA).

---

## Research Findings (Code Inspection)

### 1. Existing DrawerSystem (`frontend/src/components/canvas/DrawerSystem.tsx:1-476`)

The codebase **already has** an edge-drawer system with tabs. This is the **foundation** for the TabBar.

Key architecture:
- `DrawerSystem` component wraps `children` (LivingCanvas) between left/right/bottom drawers
- `DrawerContainer` renders collapsed (32px icon strip) vs expanded (tab header + panel body)
- `BottomDrawer` renders horizontal tabs with collapse/expand
- `PanelBody` uses a switch statement to render panel content by `DrawerPanelKind`
- All drawers are toggled via `toggle(edge)` and `setActivePanel(edge, panelId)`
- Config fetched from `/api/drawer/get?workspaceId=...`

Key patterns to reuse:
- Collapsed state: `width: 32`, icon column with `gap: 8`, click to expand
- Tab header: `display: 'flex'`, `borderBottom: '2px solid var(--accent)'` for active tab
- Badge rendering: `<span style={badgeStyle}>{p.badge}</span>`
- `collapseBtn` and `badgeStyle` CSS objects (lines 455-476)

### 2. Existing Panel (`frontend/src/components/canvas/Panel.tsx:1-422`)

Floating panel component with:
- `PanelConfig` type: `{ id, title, icon, defaultDock, defaultSize }`
- `PanelDock` type: `'left' | 'right' | 'top' | 'bottom' | 'float'`
- `PanelSize` type: `'compact' | 'normal' | 'wide'` → maps to `{ width, height }`
- `SIZE_MAP`: compact=280×400, normal=320×500, wide=400×600
- Drag/resize via pointer events
- LocalStorage persistence per panel: `vivim.panel.${config.id}`
- `Dock cycle`: left → right → float → left
- Minimized state: just an icon button

### 3. Existing ComposerShell (`frontend/src/components/chat/ComposerShell.tsx:1-369`)

The master chat input already exists. Key details:
- `dispatchBehavior` function (line 68-89) handles behaviors: only `chat` is implemented, `search`/`prompt`/`command`/`comment` are stubs
- `scope.behavior` determines placeholder text (line 287-294)
- Add-ons system: `BUILTIN_ADDONS` filtered by `position: 'top' | 'bottom'`
- `ComposerInstanceScope` type from `@/types/api`: `{ workspaceId, surfaceSlug, regionSlotId, activeZLayer, instanceId, behavior }`
- `ShellContext` provides: scope, providerId, models, capabilities, attachments, quotedMessage, isStreaming, enabledAddOns
- `TextEntryBox` component for textarea with auto-resize
- `SendButton` component

### 4. Existing page.tsx (`frontend/src/app/page.tsx:1-355`)

Current architecture:
```
CanvasApp
  ├─ GuidedLanding (onboarding overlay)
  ├─ <main> with LivingCanvas wrapped in DrawerSystem
  ├─ CommandBar (floating entry point)
  ├─ Panel[] (15 floating panels, each with PanelConfig + children)
  ├─ MainMenu (dropdown)
  ├─ CommandPalette (Cmd+K)
  ├─ ThemeSettings
  └─ DevConsoleLazy
```

State management (scattered useState):
- `openPanels: Set<string>` (line 108)
- `activeConversationId: string | null` (line 109)
- `paletteOpen, menuOpen, themeOpen, devConsoleOpen` (lines 104-107)
- `guidedOpen, needsSetup` (lines 103)
- `togglePanel` function (lines 219-229) — toggles panel in Set

### 5. Existing CommandBar (`frontend/src/components/canvas/CommandBar.tsx:1-287`)

Floating entry point with:
- `PanelToggle` sub-component (lines 247-286) — icon buttons for quick panel access
- 5 PanelToggle buttons: conversations, providers, health, capabilities, settings
- `onTogglePanel: (panelId: string) => void` prop
- Position: `position: 'fixed', left: pos.x, top: pos.y, zIndex: 1000`

### 6. Existing MainMenu (`frontend/src/components/canvas/MainMenu.tsx:1-161`)

Dropdown menu with items that toggle panels:
- Each item has `{ id, label, icon, shortcut?, action }` 
- Actions call `onTogglePanel(panelId)` then `onClose()`
- Items include: conversations, providers, settings, health, capabilities, search, documents, media, automation, agents, terminal, zlayers, audit, templates, rbac, dev-console, theme

### 7. Existing slots.ts (`frontend/src/ui/slots.ts:1-95`)

Current SLOT_IDS (line 12-39):
```typescript
export const SLOT_IDS = [
  'chat.entry', 'chat.sidebar', 'chat.thread', 'chat.bubble', 'chat.composer',
  'chat.send', 'chat.attach', 'chat.streaming', 'chat.result', 'chat.confirm',
  'chat.error', 'chat.header', 'chat.actionBar',
  'canvas.controls', 'session.controls', 'autonomous.controls',
  'automation.launcher', 'fleet.controls', 'capabilities.panel',
  'health.panel', 'search.panel', 'zlayers.panel', 'audit.panel',
  'templates.panel', 'rbac.panel',
] as const
```

### 8. Existing Icon system (`frontend/src/components/canvas/Icon.tsx`)

SVG icons via `<Icon name={iconName} size={14} />`. Relevant icons:
`message-square`, `bolt`, `robot`, `terminal`, `chart`, `shield`, `template`,
`layers`, `settings`, `activity`, `grid`, `search`, `cpu`, `menu`, `chat`,
`document`, `media`, `flags`, `users`, `palette`, `plus`, `minus`, `close`,
`chevron-right`, `chevron-left`, `chevron-down`, `chevron-up`, `dots`

### 9. Existing LivingCanvas (`frontend/src/components/canvas/LivingCanvas.tsx:1-474`)

- `LivingCanvasProps`: `{ workspaceId, providerIds, slotIds?, variant?, conversationId? }`
- `slotIds` prop determines which slots to render (defaults to `Object.keys(DEFAULT_LAYOUTS)`)
- `DEFAULT_LAYOUTS` maps slot IDs to canvas positions (x, y, z, w, h)
- `useNodeTypes(providerIds, variant)` resolves slot components

### 10. Existing register-all.ts (`frontend/src/components/canvas/register-all.ts:1-597`)

Component registry pattern:
```typescript
register({
  id: 'canvas.living',
  label: 'Living Canvas',
  kind: 'canvas',
  category: 'chat',
  slot: 'canvas.primary',
  Component: C.LivingCanvas ?? null,
  capabilities: [...],
  version: 1,
  author: 'system',
  tags: [...],
  enabled: true,
  isDefault: true,
});
```

---

## THE CONCEPT: Layers

A **Layer** is a workspace mode — a pre-configured arrangement of panels, canvas slots, and chat behavior.

### Layer = { panels, canvasSlots, chatBehavior, color, icon, label }

### 3 Default Layers

#### Layer 1: `chat` — Communication Hub
```
Color: #3b82f6 (blue)
Icon: message-square
Shortcut: Cmd+1

Tab Panels (right edge):
  [conversations] [search] [health-mini] [settings-drawer]

Canvas Slots:
  chat.header, chat.sidebar, chat.thread, chat.composer,
  chat.entry, chat.actionBar

Chat Behavior: 'chat' (sends messages to active conversation)
```

#### Layer 2: `build` — Builder & Automation
```
Color: #10b981 (green)
Icon: bolt
Shortcut: Cmd+2

Tab Panels (right edge):
  [capabilities] [automation] [terminal] [fleet-mini] [templates]

Canvas Slots:
  chat.header, chat.composer, chat.result,
  automation.launcher, fleet.controls

Chat Behavior: 'prompt' (agent instruction mode)
```

#### Layer 3: `admin` — Operations & Monitoring
```
Color: #ef4444 (red)
Icon: shield
Shortcut: Cmd+3

Tab Panels (right edge):
  [audit] [rbac] [zlayers] [session-controls] [task-manager]

Canvas Slots:
  chat.header, chat.composer,
  audit.panel, rbac.panel, zlayers.panel

Chat Behavior: 'command' (admin commands)
```

---

## Panel Type Design System

| Type | Tab Style | Panel Size | Coexistence | Example |
|------|-----------|-----------|-------------|---------|
| **FULL** | Full tab with icon + label | 320-400px, full height | ONE at a time | conversations, capabilities, settings |
| **MINI** | Compact tab, icon only | 240-280px, 200-300px float | Up to 3, can coexist with ONE full | health, fleet, session-controls |
| **BADGE** | Tab with numeric badge | No panel — count only | Always visible | unread messages, pending tasks |
| **INDICATOR** | Colored dot on tab edge | No panel — status only | Always visible | provider health dot |
| **DRAWER** | Full tab, overlay | Slides over canvas, no shift | Can stack with any | dev-console, terminal, search |

### Coexistence Rules
- **FULL**: Only ONE per layer. Clicking new FULL tab closes current FULL panel.
- **MINI**: Up to 3 open. Float as small overlays. Can coexist with ONE full.
- **BADGE**: No panel — just tab badge count.
- **INDICATOR**: No panel — just dot color.
- **DRAWER**: Overlay only. Stacks with z-index. No canvas shift.

---

## SSOA: Session State-Organized Architecture

### Core Principle

**One state object per user session controls ALL panel UI.** One `useSessionState()` hook returns canonical state, one `useSessionDispatch()` returns the updater.

### State Shape

```typescript
interface CanvasSessionState {
  activeLayer: 'chat' | 'build' | 'admin';
  layers: {
    [layerId: string]: {
      openPanels: string[];
      activePanel: string | null;
      panelSizes: Record<string, { width: number; height: number }>;
    };
  };
  tabs: {
    position: 'left' | 'right';
    collapsedWidth: number;
    expandedWidth: number;
    autoOrganize: boolean;
    showLabels: boolean;
  };
  composer: {
    draft: string;
    selectedModel: string | null;
    enabledAddOns: string[];
  };
  session: {
    id: string;
    userId: string;
    workspaceId: string;
    createdAt: number;
    lastActiveAt: number;
  };
}
```

### State Actions

```typescript
type SessionAction =
  | { type: 'LAYER_SWITCH'; layerId: string }
  | { type: 'PANEL_OPEN'; layerId: string; panelId: string }
  | { type: 'PANEL_CLOSE'; layerId: string; panelId: string }
  | { type: 'PANEL_TOGGLE'; layerId: string; panelId: string }
  | { type: 'PANEL_RESIZE'; layerId: string; panelId: string; size: { width: number; height: number } }
  | { type: 'TAB_SET_POSITION'; position: 'left' | 'right' }
  | { type: 'TAB_AUTO_ORGANIZE'; enabled: boolean }
  | { type: 'COMPOSER_SET_DRAFT'; draft: string }
  | { type: 'COMPOSER_SET_MODEL'; modelId: string }
  | { type: 'SESSION_HYDRATE'; state: CanvasSessionState }
  | { type: 'SESSION_RESET' };
```

### Persistence
- localStorage key `vivim:canvas:ssoa`
- Hydrate on mount, debounce-persist (300ms) on every dispatch

---

## ZLayer Clarification

**Two concepts both called "layers":**

| Concept | Existing? | Type | Purpose |
|---------|-----------|------|---------|
| **Z-Layers** (visual depth) | YES — `ZLayerPanel.tsx` | `ZLayerId = 'background' \| 'base' \| 'content' \| 'overlay' \| 'modal' \| 'cursor'` | Controls z-index stacking of canvas nodes |
| **SSOA Layers** (workspace modes) | NO — new concept | `'chat' \| 'build' \| 'admin'` | Controls which panels/slots/behavior are active |

**They do NOT conflict.** Z-Layers control visual depth within a single SSOA Layer.

---

## PHASE 1: Session State Provider + TabBar Shell + Layer Switcher

### New Files to Create

#### 1. `frontend/src/components/canvas/TabConfig.ts`

Layer definitions, category colors, tab-order per layer. This is a pure config file with no React.

```typescript
// components/canvas/TabConfig.ts
// Layer definitions, panel categories, and tab ordering.

export type LayerId = 'chat' | 'build' | 'admin';
export type PanelType = 'full' | 'mini' | 'badge' | 'indicator' | 'drawer';
export type TabCategory = 'communication' | 'providers' | 'tools' | 'content' | 'admin' | 'canvas' | 'session';

export interface LayerConfig {
  id: LayerId;
  label: string;
  icon: string;
  color: string;
  shortcut: string;
  chatBehavior: 'chat' | 'prompt' | 'command';
  inputPlaceholder: string;
  defaultPanels: string[];
  canvasSlots: string[];
  tabOrder: string[];
}

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  category: TabCategory;
  panelType: PanelType;
  color: string;          // category color
  badge?: number;         // dynamic badge count
  indicatorColor?: string; // for INDICATOR type
}

export const CATEGORY_COLORS: Record<TabCategory, string> = {
  communication: '#3b82f6',
  providers: '#8b5cf6',
  tools: '#10b981',
  content: '#f59e0b',
  admin: '#ef4444',
  canvas: '#06b6d4',
  session: '#ec4899',
};

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
    canvasSlots: ['chat.header', 'chat.sidebar', 'chat.thread', 'chat.composer', 'chat.entry', 'chat.actionBar'],
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
    canvasSlots: ['chat.header', 'chat.composer', 'chat.result', 'automation.launcher', 'fleet.controls'],
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
];

export const PANEL_REGISTRY: Record<string, TabConfig> = {
  conversations: { id: 'conversations', label: 'Conversations', icon: 'message-square', category: 'communication', panelType: 'full', color: CATEGORY_COLORS.communication },
  search: { id: 'search', label: 'Search', icon: 'search', category: 'tools', panelType: 'drawer', color: CATEGORY_COLORS.tools },
  health: { id: 'health', label: 'Health', icon: 'activity', category: 'providers', panelType: 'mini', color: CATEGORY_COLORS.providers, indicatorColor: '#10b981' },
  settings: { id: 'settings', label: 'Settings', icon: 'settings', category: 'session', panelType: 'full', color: CATEGORY_COLORS.session },
  capabilities: { id: 'capabilities', label: 'Capabilities', icon: 'grid', category: 'tools', panelType: 'full', color: CATEGORY_COLORS.tools },
  automation: { id: 'automation', label: 'Automation', icon: 'bolt', category: 'tools', panelType: 'full', color: CATEGORY_COLORS.tools },
  terminal: { id: 'terminal', label: 'Terminal', icon: 'terminal', category: 'tools', panelType: 'drawer', color: CATEGORY_COLORS.tools },
  fleet: { id: 'fleet', label: 'Fleet', icon: 'cpu', category: 'providers', panelType: 'mini', color: CATEGORY_COLORS.providers },
  templates: { id: 'templates', label: 'Templates', icon: 'template', category: 'content', panelType: 'full', color: CATEGORY_COLORS.content },
  audit: { id: 'audit', label: 'Audit', icon: 'chart', category: 'admin', panelType: 'full', color: CATEGORY_COLORS.admin },
  rbac: { id: 'rbac', label: 'RBAC', icon: 'shield', category: 'admin', panelType: 'full', color: CATEGORY_COLORS.admin },
  zlayers: { id: 'zlayers', label: 'Z-Layers', icon: 'layers', category: 'canvas', panelType: 'full', color: CATEGORY_COLORS.canvas },
  'session-controls': { id: 'session-controls', label: 'Session', icon: 'clock', category: 'session', panelType: 'mini', color: CATEGORY_COLORS.session },
  'task-manager': { id: 'task-manager', label: 'Tasks', icon: 'check', category: 'session', panelType: 'mini', color: CATEGORY_COLORS.session },
  providers: { id: 'providers', label: 'Providers', icon: 'cpu', category: 'providers', panelType: 'full', color: CATEGORY_COLORS.providers },
  documents: { id: 'documents', label: 'Documents', icon: 'document', category: 'content', panelType: 'full', color: CATEGORY_COLORS.content },
  media: { id: 'media', label: 'Media', icon: 'media', category: 'content', panelType: 'full', color: CATEGORY_COLORS.content },
  agents: { id: 'agents', label: 'Agents', icon: 'robot', category: 'tools', panelType: 'full', color: CATEGORY_COLORS.tools },
};

export function getLayerConfig(layerId: LayerId): LayerConfig {
  return LAYER_REGISTRY.find((l) => l.id === layerId) ?? LAYER_REGISTRY[0]!;
}

export function getTabsForLayer(layerId: LayerId): TabConfig[] {
  const layer = getLayerConfig(layerId);
  return layer.tabOrder
    .map((id) => PANEL_REGISTRY[id])
    .filter((t): t is TabConfig => t !== undefined);
}
```

#### 2. `frontend/src/components/canvas/PanelRegistry.ts`

Panel content renderer mapping — maps panel IDs to their React components. This replaces the giant switch statement in the current Panel rendering.

```typescript
// components/canvas/PanelRegistry.ts
// Maps panel IDs to their React component renderers.

import type { ComponentType } from 'react';

export interface PanelDefinition {
  id: string;
  title: string;
  icon: string;
  component: ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
}

// Lazy-load heavy panels to reduce bundle size
const panelLoaders: Record<string, () => Promise<{ default: ComponentType<Record<string, unknown>> }>> = {
  conversations: () => import('./panels/ConversationsPanel').then((m) => ({ default: m.ConversationsPanel })),
  providers: () => import('./panels/ProvidersPanel').then((m) => ({ default: m.ProvidersPanel })),
  settings: () => import('./panels/SettingsPanel').then((m) => ({ default: m.SettingsPanel })),
  health: () => import('./HealthDashboard').then((m) => ({ default: m.HealthDashboard })),
  capabilities: () => import('./CapabilityCatalog').then((m) => ({ default: m.CapabilityCatalog })),
  search: () => import('./SearchPanel').then((m) => ({ default: m.SearchPanel })),
  automation: () => import('./AutomationLauncher').then((m) => ({ default: m.AutomationLauncher })),
  terminal: () => import('./cards').then((m) => ({ default: m.ShellCard })),
  fleet: () => import('./FleetStatus').then((m) => ({ default: m.FleetStatus })),
  templates: () => import('./TemplatesGallery').then((m) => ({ default: m.TemplatesGallery })),
  audit: () => import('./AuditDashboard').then((m) => ({ default: m.AuditDashboard })),
  rbac: () => import('./RbacManager').then((m) => ({ default: m.RbacManager })),
  zlayers: () => import('./ZLayerPanel').then((m) => ({ default: m.ZLayerPanel })),
  'session-controls': () => import('./SessionControls').then((m) => ({ default: m.SessionControls })),
  'task-manager': () => import('./TaskManager').then((m) => ({ default: m.TaskManager })),
};

export function getPanelLoader(panelId: string) {
  return panelLoaders[panelId];
}

export function hasPanel(panelId: string): boolean {
  return panelId in panelLoaders;
}
```

#### 3. `frontend/src/components/canvas/SessionStateProvider.tsx`

React context + reducer + localStorage persistence.

```typescript
// components/canvas/SessionStateProvider.tsx
// SSOA: single source of truth for canvas panel state.

'use client';

import { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { LayerId } from './TabConfig';

// ── State shape ───────────────────────────────────────────────────────

export interface LayerState {
  openPanels: string[];
  activePanel: string | null;
  panelSizes: Record<string, { width: number; height: number }>;
}

export interface CanvasSessionState {
  activeLayer: LayerId;
  layers: Record<LayerId, LayerState>;
  tabs: {
    position: 'left' | 'right';
    collapsedWidth: number;
    expandedWidth: number;
    autoOrganize: boolean;
    showLabels: boolean;
  };
  composer: {
    draft: string;
    selectedModel: string | null;
    enabledAddOns: string[];
  };
  session: {
    id: string;
    userId: string;
    workspaceId: string;
    createdAt: number;
    lastActiveAt: number;
  };
}

// ── Actions ───────────────────────────────────────────────────────────

export type SessionAction =
  | { type: 'LAYER_SWITCH'; layerId: LayerId }
  | { type: 'PANEL_OPEN'; layerId: LayerId; panelId: string }
  | { type: 'PANEL_CLOSE'; layerId: LayerId; panelId: string }
  | { type: 'PANEL_TOGGLE'; layerId: LayerId; panelId: string }
  | { type: 'PANEL_RESIZE'; layerId: LayerId; panelId: string; size: { width: number; height: number } }
  | { type: 'TAB_SET_POSITION'; position: 'left' | 'right' }
  | { type: 'TAB_AUTO_ORGANIZE'; enabled: boolean }
  | { type: 'COMPOSER_SET_DRAFT'; draft: string }
  | { type: 'COMPOSER_SET_MODEL'; modelId: string }
  | { type: 'SESSION_HYDRATE'; state: CanvasSessionState }
  | { type: 'SESSION_RESET' };

// ── Initial state ─────────────────────────────────────────────────────

const STORAGE_KEY = 'vivim:canvas:ssoa';

function makeLayerState(): LayerState {
  return { openPanels: [], activePanel: null, panelSizes: {} };
}

function getInitialState(): CanvasSessionState {
  return {
    activeLayer: 'chat',
    layers: {
      chat: makeLayerState(),
      build: makeLayerState(),
      admin: makeLayerState(),
    },
    tabs: {
      position: 'right',
      collapsedWidth: 48,
      expandedWidth: 320,
      autoOrganize: false,
      showLabels: true,
    },
    composer: {
      draft: '',
      selectedModel: null,
      enabledAddOns: [],
    },
    session: {
      id: `session-${Date.now()}`,
      userId: 'user:demo',
      workspaceId: 'ws:global',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    },
  };
}

function loadFromStorage(): CanvasSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CanvasSessionState;
  } catch {
    return null;
  }
}

// ── Reducer ───────────────────────────────────────────────────────────

function sessionReducer(state: CanvasSessionState, action: SessionAction): CanvasSessionState {
  switch (action.type) {
    case 'LAYER_SWITCH':
      return { ...state, activeLayer: action.layerId, session: { ...state.session, lastActiveAt: Date.now() } };

    case 'PANEL_OPEN': {
      const layer = state.layers[action.layerId];
      if (layer.openPanels.includes(action.panelId)) return state;
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...layer,
            openPanels: [...layer.openPanels, action.panelId],
            activePanel: action.panelId,
          },
        },
      };
    }

    case 'PANEL_CLOSE': {
      const layer = state.layers[action.layerId];
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...layer,
            openPanels: layer.openPanels.filter((id) => id !== action.panelId),
            activePanel: layer.activePanel === action.panelId ? null : layer.activePanel,
          },
        },
      };
    }

    case 'PANEL_TOGGLE': {
      const layer = state.layers[action.layerId];
      const isOpen = layer.openPanels.includes(action.panelId);
      if (isOpen) {
        return {
          ...state,
          layers: {
            ...state.layers,
            [action.layerId]: {
              ...layer,
              openPanels: layer.openPanels.filter((id) => id !== action.panelId),
              activePanel: layer.activePanel === action.panelId ? null : layer.activePanel,
            },
          },
        };
      }
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...layer,
            openPanels: [...layer.openPanels, action.panelId],
            activePanel: action.panelId,
          },
        },
      };
    }

    case 'PANEL_RESIZE': {
      const layer = state.layers[action.layerId];
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: {
            ...layer,
            panelSizes: { ...layer.panelSizes, [action.panelId]: action.size },
          },
        },
      };
    }

    case 'TAB_SET_POSITION':
      return { ...state, tabs: { ...state.tabs, position: action.position } };

    case 'TAB_AUTO_ORGANIZE':
      return { ...state, tabs: { ...state.tabs, autoOrganize: action.enabled } };

    case 'COMPOSER_SET_DRAFT':
      return { ...state, composer: { ...state.composer, draft: action.draft } };

    case 'COMPOSER_SET_MODEL':
      return { ...state, composer: { ...state.composer, selectedModel: action.modelId } };

    case 'SESSION_HYDRATE':
      return action.state;

    case 'SESSION_RESET':
      return getInitialState();

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────

interface SessionStateContextValue {
  state: CanvasSessionState;
  dispatch: React.Dispatch<SessionAction>;
  // Convenience helpers
  isPanelOpen: (panelId: string) => boolean;
  activeLayerPanels: string[];
  activeLayerConfig: import('./TabConfig').LayerConfig;
}

const SessionStateContext = createContext<SessionStateContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────

export function SessionStateProvider({ children, workspaceId }: { children: ReactNode; workspaceId: string }) {
  const [state, dispatch] = useReducer(sessionReducer, null, () => {
    const stored = loadFromStorage();
    if (stored) {
      stored.session.workspaceId = workspaceId;
      return stored;
    }
    const initial = getInitialState();
    initial.session.workspaceId = workspaceId;
    return initial;
  });

  // Debounced localStorage persist
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* storage full */ }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state]);

  // Convenience: is panel open in current layer?
  const isPanelOpen = useCallback(
    (panelId: string) => state.layers[state.activeLayer]?.openPanels.includes(panelId) ?? false,
    [state.activeLayer, state.layers],
  );

  // Convenience: panels open in active layer
  const activeLayerPanels = state.layers[state.activeLayer]?.openPanels ?? [];

  // Convenience: current layer config
  const { getLayerConfig } = require('./TabConfig') as typeof import('./TabConfig');
  const activeLayerConfig = getLayerConfig(state.activeLayer);

  const contextValue: SessionStateContextValue = {
    state,
    dispatch,
    isPanelOpen,
    activeLayerPanels,
    activeLayerConfig,
  };

  return (
    <SessionStateContext.Provider value={contextValue}>
      {children}
    </SessionStateContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useSessionState(): SessionStateContextValue {
  const ctx = useContext(SessionStateContext);
  if (!ctx) throw new Error('useSessionState must be used inside SessionStateProvider');
  return ctx;
}
```

#### 4. `frontend/src/components/canvas/useSessionState.ts`

Re-export hook for convenience:

```typescript
// components/canvas/useSessionState.ts
export { useSessionState, type CanvasSessionState, type SessionAction } from './SessionStateProvider';
```

#### 5. `frontend/src/components/canvas/TabBar.tsx`

The notebook binder edge tabs. Renders colored tabs along the right (or left) edge, with layer switcher at top.

```typescript
// components/canvas/TabBar.tsx
// Notebook binder edge tabs with layer switcher.

'use client';

import { useCallback, useRef } from 'react';
import { Icon, type IconName } from './Icon';
import { useSessionState } from './SessionStateProvider';
import { LAYER_REGISTRY, PANEL_REGISTRY, getTabsForLayer, type LayerId, type TabConfig } from './TabConfig';
import { CATEGORY_COLORS } from './TabConfig';

interface TabBarProps {
  workspaceId: string;
  onPanelClick: (panelId: string) => void;
}

export function TabBar({ workspaceId, onPanelClick }: TabBarProps) {
  const { state, dispatch, isPanelOpen } = useSessionState();
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const currentLayer = state.activeLayer;
  const tabs = getTabsForLayer(currentLayer);
  const layerConfig = LAYER_REGISTRY.find((l) => l.id === currentLayer)!;
  const position = state.tabs.position;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd+1/2/3: switch layers
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const layerIds: LayerId[] = ['chat', 'build', 'admin'];
        const idx = parseInt(e.key) - 1;
        if (layerIds[idx]) {
          dispatch({ type: 'LAYER_SWITCH', layerId: layerIds[idx]! });
        }
        return;
      }

      // Cmd+0: close all panels
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        const layer = state.layers[currentLayer];
        layer.openPanels.forEach((panelId) => {
          dispatch({ type: 'PANEL_CLOSE', layerId: currentLayer, panelId });
        });
        return;
      }

      // Arrow keys: navigate tabs
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === state.layers[currentLayer]?.activePanel);
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, tabs.length - 1)
          : Math.max(currentIndex - 1, 0);
        const nextTab = tabs[nextIndex];
        if (nextTab) {
          tabRefs.current.get(nextTab.id)?.focus();
        }
      }

      // Enter/Space: activate tab
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.dataset.panelId) {
          onPanelClick(focused.dataset.panelId);
        }
      }

      // Escape: close active panel
      if (e.key === 'Escape') {
        const active = state.layers[currentLayer]?.activePanel;
        if (active) {
          dispatch({ type: 'PANEL_CLOSE', layerId: currentLayer, panelId: active });
        }
      }
    },
    [currentLayer, tabs, state.layers, dispatch, onPanelClick],
  );

  return (
    <div
      role="tablist"
      aria-label="Canvas tabs"
      aria-orientation="vertical"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: 48,
        bottom: 0,
        [position]: 0,
        width: state.tabs.collapsedWidth,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-elevated)',
        borderRight: position === 'left' ? '1px solid var(--border)' : 'none',
        borderLeft: position === 'right' ? '1px solid var(--border)' : 'none',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Layer switcher */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '8px 4px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {LAYER_REGISTRY.map((layer) => {
          const isActive = layer.id === currentLayer;
          return (
            <button
              key={layer.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`${layer.label} layer (${layer.shortcut})`}
              onClick={() => dispatch({ type: 'LAYER_SWITCH', layerId: layer.id })}
              title={`${layer.label} — ${layer.shortcut}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 4px',
                border: 'none',
                borderRadius: 4,
                background: isActive ? layer.color : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                fontFamily: 'inherit',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              <Icon name={layer.icon as IconName} size={12} />
              {state.tabs.showLabels && (
                <span style={{ fontSize: 9, lineHeight: 1 }}>{layer.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div style={{ height: 2, background: layerConfig.color, margin: '4px 8px', borderRadius: 1, opacity: 0.5 }} />

      {/* Panel tabs */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '8px 4px',
          flex: 1,
        }}
      >
        {tabs.map((tab) => {
          const isOpen = isPanelOpen(tab.id);
          const isActive = state.layers[currentLayer]?.activePanel === tab.id;
          const categoryColor = CATEGORY_COLORS[tab.category];

          return (
            <button
              key={tab.id}
              ref={(el) => { if (el) tabRefs.current.set(tab.id, el); }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              data-panel-id={tab.id}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onPanelClick(tab.id)}
              title={tab.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 6px',
                border: 'none',
                borderLeft: isActive ? `3px solid ${categoryColor}` : '3px solid transparent',
                borderRadius: 0,
                background: isActive ? 'color-mix(in oklch, var(--bg-subtle) 80%, transparent)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background 0.12s ease, color 0.12s ease',
                position: 'relative',
              }}
            >
              <Icon name={tab.icon as IconName} size={14} />
              {state.tabs.showLabels && (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab.label}
                </span>
              )}
              {/* Badge */}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    minWidth: 14,
                    height: 14,
                    padding: '0 3px',
                    background: categoryColor,
                    color: '#fff',
                    borderRadius: 7,
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: '14px',
                    textAlign: 'center',
                  }}
                >
                  {tab.badge}
                </span>
              )}
              {/* Indicator dot */}
              {tab.panelType === 'indicator' && tab.indicatorColor && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: tab.indicatorColor,
                    marginLeft: 'auto',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

#### 6. `frontend/src/components/canvas/LayerSwitcher.tsx`

Layer indicator at the top of the tab strip. (This is rendered inside TabBar — separate file for clarity but could be inlined.)

```typescript
// components/canvas/LayerSwitcher.tsx
// Layer indicator + switcher (top of tab bar).

'use client';

import { Icon, type IconName } from './Icon';
import { useSessionState } from './SessionStateProvider';
import { LAYER_REGISTRY } from './TabConfig';

export function LayerSwitcher() {
  const { state, dispatch } = useSessionState();
  const currentLayer = LAYER_REGISTRY.find((l) => l.id === state.activeLayer)!;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: currentLayer.color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
        {currentLayer.label}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
        {currentLayer.shortcut}
      </span>
    </div>
  );
}
```

### Files to Modify in Phase 1

#### 7. `frontend/src/app/page.tsx` — Update to use SessionStateProvider + TabBar

**Changes:**
- Wrap `CanvasApp` in `SessionStateProvider`
- Replace floating `Panel[]` rendering with `SlidePanel` (Phase 2) or keep for now
- Add `TabBar` to the right edge
- Wire `togglePanel` to use `dispatch({ type: 'PANEL_TOGGLE', layerId, panelId })`
- Add keyboard shortcuts for Cmd+1/2/3 (layer switching)

**Exact changes:**

1. Add import at top:
```typescript
import { SessionStateProvider, useSessionState } from '@/components/canvas/SessionStateProvider';
import { TabBar } from '@/components/canvas/TabBar';
```

2. Wrap `CanvasApp` in provider:
```typescript
export default function Home() {
  return (
    <LiveConfigProvider initialWorkspaceId="ws:global" initialUserId="user:demo">
      <SessionStateProvider workspaceId="ws:global">
        <CanvasApp />
      </SessionStateProvider>
    </LiveConfigProvider>
  );
}
```

3. Inside `CanvasApp`, replace `togglePanel` (lines 219-229) with:
```typescript
const { state: sessionState, dispatch } = useSessionState();
const togglePanel = useCallback((panelId: string) => {
  dispatch({ type: 'PANEL_TOGGLE', layerId: sessionState.activeLayer, panelId });
}, [sessionState.activeLayer, dispatch]);
```

4. Replace keyboard shortcuts (lines 124-188) to use layer switching:
```typescript
// Add to the existing onKey handler:
// Cmd+1/2/3: switch layers
if ((e.metaKey || e.ctrlKey) && ['1', '2', '3'].includes(e.key)) {
  e.preventDefault();
  const layerIds = ['chat', 'build', 'admin'] as const;
  const idx = parseInt(e.key) - 1;
  if (layerIds[idx]) {
    dispatch({ type: 'LAYER_SWITCH', layerId: layerIds[idx]! });
  }
}
```

5. Add `TabBar` after the `<main>` closing tag:
```typescript
{/* Tab bar — notebook binder edge tabs */}
<TabBar workspaceId={workspaceId} onPanelClick={togglePanel} />
```

#### 8. `frontend/src/ui/slots.ts` — Add tab/layer slot IDs

Add to `SLOT_IDS` array (after line 38):
```typescript
'tab.bar',
'tab.layer-switcher',
'tab.panel-content',
'composer.master',
```

Add to `SLOT_META` record:
```typescript
'tab.bar': { id: 'tab.bar', label: 'Tab Bar', overridableBy: 'capability' },
'tab.layer-switcher': { id: 'tab.layer-switcher', label: 'Layer Switcher', overridableBy: 'capability' },
'tab.panel-content': { id: 'tab.panel-content', label: 'Tab Panel Content', overridableBy: 'capability' },
'composer.master': { id: 'composer.master', label: 'Master Composer', overridableBy: 'provider' },
```

#### 9. `frontend/src/components/canvas/index.ts` — Export new components

Add after line 101:
```typescript
// SSOA — Session State-Organized Architecture
export { SessionStateProvider, useSessionState } from './SessionStateProvider';
export type { CanvasSessionState, SessionAction, LayerState } from './SessionStateProvider';
export { TabBar } from './TabBar';
export { LayerSwitcher } from './LayerSwitcher';
```

#### 10. `frontend/src/components/canvas/register-all.ts` — Register new components

Add after the existing registrations (around line 590):
```typescript
// SSOA tab components
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
});
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
});
```

### Keyboard Shortcuts (Phase 1)

| Shortcut | Action |
|----------|--------|
| Cmd+1 | Switch to chat layer |
| Cmd+2 | Switch to build layer |
| Cmd+3 | Switch to admin layer |
| Cmd+0 | Close all panels in current layer |
| Escape | Close active panel |
| Arrow Up/Down | Navigate tabs |
| Enter/Space | Activate tab |

### CSS Variables (add to global styles)

```css
:root {
  --layer-chat: #3b82f6;
  --layer-build: #10b981;
  --layer-admin: #ef4444;
  --tab-communication: #3b82f6;
  --tab-providers: #8b5cf6;
  --tab-tools: #10b981;
  --tab-content: #f59e0b;
  --tab-admin: #ef4444;
  --tab-canvas: #06b6d4;
  --tab-session: #ec4899;
}
```

---

## PHASE 2: SlidePanel (Edge-sliding panels)

### Goal
Replace floating `Panel.tsx` with `SlidePanel.tsx` — panels slide from right edge, canvas shifts.

### New File: `frontend/src/components/canvas/SlidePanel.tsx`

```typescript
// components/canvas/SlidePanel.tsx
// Edge-sliding panel container. Replaces floating Panel for tab-driven panels.

'use client';

import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Icon, type IconName } from './Icon';
import { useSessionState } from './SessionStateProvider';
import { PANEL_REGISTRY, CATEGORY_COLORS, type PanelType } from './TabConfig';
import { getPanelLoader } from './PanelRegistry';

interface SlidePanelProps {
  panelId: string;
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right';
  width?: number;
  workspaceId: string;
}

export function SlidePanel({
  panelId,
  isOpen,
  onClose,
  position = 'right',
  width = 320,
  workspaceId,
}: SlidePanelProps) {
  const { state, dispatch } = useSessionState();
  const tabConfig = PANEL_REGISTRY[panelId];
  const categoryColor = tabConfig ? CATEGORY_COLORS[tabConfig.category] : 'var(--accent)';
  const [panelContent, setPanelContent] = useState<React.ComponentType<Record<string, unknown>> | null>(null);

  // Lazy-load panel content
  useEffect(() => {
    if (!isOpen) return;
    const loader = getPanelLoader(panelId);
    if (loader) {
      loader().then((m) => setPanelContent(() => m.default)).catch(() => {});
    }
  }, [panelId, isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !tabConfig) return null;

  const PanelComponent = panelContent;

  return (
    <div
      role="dialog"
      aria-label={`${tabConfig.label} panel`}
      aria-modal={false}
      style={{
        position: 'fixed',
        top: 48,
        bottom: 0,
        [position]: 0,
        width,
        zIndex: 950,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        borderLeft: position === 'right' ? `3px solid ${categoryColor}` : 'none',
        borderRight: position === 'left' ? `3px solid ${categoryColor}` : 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        transform: isOpen ? 'translateX(0)' : position === 'right' ? 'translateX(100%)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          flexShrink: 0,
        }}
      >
        <Icon name={tabConfig.icon as IconName} size={14} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {tabConfig.label}
        </span>
        <button
          onClick={onClose}
          aria-label={`Close ${tabConfig.label} panel`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          <Icon name="close" size={12} />
        </button>
      </div>

      {/* Panel body */}
      <div style={{ flex: 1, overflow: 'auto' }} className="scrollbar-thin">
        {PanelComponent ? (
          <PanelComponent workspaceId={workspaceId} />
        ) : (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--text-muted)' }}>Loading...</div>
        )}
      </div>
    </div>
  );
}
```

### Changes to `page.tsx`

Replace the floating `Panel[]` rendering (lines 273-307) with `SlidePanel` rendering:

```typescript
{/* Slide panels — edge-sliding, tab-driven */}
{sessionState.layers[sessionState.activeLayer].openPanels.map((panelId) => (
  <SlidePanel
    key={panelId}
    panelId={panelId}
    isOpen={true}
    onClose={() => dispatch({ type: 'PANEL_CLOSE', layerId: sessionState.activeLayer, panelId })}
    position={sessionState.tabs.position}
    width={sessionState.tabs.expandedWidth}
    workspaceId={workspaceId}
  />
))}
```

---

## PHASE 3: MasterComposer Integration

### Goal
Extract chat input from ChatSurface into a shared MasterComposer at viewport bottom. Layer-aware behavior.

### New File: `frontend/src/components/canvas/MasterComposer.tsx`

```typescript
// components/canvas/MasterComposer.tsx
// Shared chat input at bottom of viewport. Layer-aware behavior.

'use client';

import { useMemo } from 'react';
import { useSessionState } from './SessionStateProvider';
import { ComposerShell, defaultChatScope } from '../chat/ComposerShell';
import { getLayerConfig } from './TabConfig';

interface MasterComposerProps {
  workspaceId: string;
  conversationId: string | null;
  providerId: string | null;
}

export function MasterComposer({ workspaceId, conversationId, providerId }: MasterComposerProps) {
  const { state } = useSessionState();
  const layerConfig = getLayerConfig(state.activeLayer);

  const scope = useMemo(
    () => ({
      ...defaultChatScope(workspaceId),
      behavior: layerConfig.chatBehavior,
      surfaceSlug: state.activeLayer,
    }),
    [workspaceId, state.activeLayer, layerConfig.chatBehavior],
  );

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 800,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <ComposerShell
        scope={scope}
        conversationId={conversationId}
        providerId={providerId}
        onSendResult={(ok, error) => {
          if (error) console.error('[MasterComposer]', error);
        }}
      />
    </div>
  );
}
```

### Changes to `ComposerShell.tsx`

Extend `dispatchBehavior` (line 68-89) to handle `prompt` and `command`:

```typescript
async function dispatchBehavior(
  behavior: ComposerInstanceScope['behavior'],
  text: string,
  conversationId: string | null,
  io: ReturnType<typeof useIO>,
): Promise<BehaviorResult> {
  switch (behavior) {
    case 'chat': {
      if (!conversationId) return { ok: false, error: 'No active conversation' };
      try {
        const res = await io.post<{ ok?: boolean; error?: string }>(
          `/api/conversations/${encodeURIComponent(conversationId)}/send`,
          { content: text },
        );
        return { ok: res.data?.ok ?? true, error: res.data?.error };
      } catch {
        return { ok: false, error: 'Send failed (network error)' };
      }
    }
    case 'prompt': {
      try {
        const res = await io.post<{ ok?: boolean; error?: string; data?: unknown }>(
          '/api/interpret',
          { text },
        );
        return { ok: res.data?.ok ?? true, error: res.data?.error };
      } catch {
        return { ok: false, error: 'Interpret failed (network error)' };
      }
    }
    case 'command': {
      try {
        const res = await io.post<{ ok?: boolean; error?: string; data?: unknown }>(
          '/api/admin/command',
          { text },
        );
        return { ok: res.data?.ok ?? true, error: res.data?.error };
      } catch {
        return { ok: false, error: 'Command failed (network error)' };
      }
    }
    default: {
      console.log(`[ComposerShell] behavior=${behavior} text="${text}" (stub)`);
      return { ok: true };
    }
  }
}
```

### Changes to `page.tsx`

Add MasterComposer at bottom of the viewport (after TabBar):
```typescript
{/* Master chat input — layer-aware behavior */}
<MasterComposer
  workspaceId={workspaceId}
  conversationId={activeConversationId}
  providerId={providerIds[0] ?? null}
/>
```

---

## PHASE 4: Auto-Organize + Usage Tracking

### Goal
Tabs auto-organize by usage frequency within each layer.

### Implementation

Add to `CanvasSessionState`:
```typescript
tabUsage: Record<string, number>;  // panelId → click count
```

Add action:
```typescript
| { type: 'TAB_RECORD_USAGE'; panelId: string }
```

In TabBar, sort tabs by `tabUsage` descending when `state.tabs.autoOrganize` is true.

---

## PHASE 5: Keyboard Navigation + Accessibility

### Goal
Full ARIA: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`. Arrow keys, Home/End, focus trap.

### Already implemented in Phase 1 TabBar. Additional:
- Home key → focus first tab
- End key → focus last tab
- Tab key → move focus into panel content
- Shift+Tab → move focus back to tab bar

---

## PHASE 6: Tab Context Menu + Customization

### Goal
Right-click tab: Pin, Move Edge, Resize, Hide, Reset Layout.

### Implementation

Add context menu to TabBar tabs:
```typescript
const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
  e.preventDefault();
  // Show context menu with options:
  // - Pin (keep open across layer switches)
  // - Move to left edge
  // - Resize (280/320/400)
  // - Hide from layer
  // - Reset layout
};
```

---

## PHASE 7: Responsive / Mobile

### Goal
Mobile (<768px): tabs collapse to bottom bar, panels become bottom sheets.

### Implementation

```css
@media (max-width: 768px) {
  .tab-bar {
    position: fixed;
    bottom: 0;
    top: auto;
    left: 0;
    right: 0;
    height: 48px;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .slide-panel {
    top: auto;
    bottom: 0;
    width: 100% !important;
    max-height: 70vh;
    border-radius: 16px 16px 0 0;
    transform: translateY(100%);
  }
  .slide-panel.open {
    transform: translateY(0);
  }
}
```

---

## Implementation Notes

### Animation Timing

| Transition | Duration | Easing |
|-----------|----------|--------|
| Tab expand/collapse | 150ms | ease-out |
| Panel slide in | 250ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Panel slide out | 200ms | ease-in |
| Layer switch | 300ms | cubic-bezier(0.4, 0, 0.2, 1) |

### Performance

- TabBar renders max 20 tabs — no virtualization needed
- Panel content lazy-loaded via `PanelRegistry`
- Session state debounced localStorage (300ms)
- CSS transitions only — GPU-accelerated

### Testing Checklist

- [ ] 3 layers switch correctly (Cmd+1/2/3)
- [ ] Each layer shows its own tab panels
- [ ] Tab colors match layer/category
- [ ] Clicking tab opens correct panel
- [ ] Only ONE FULL panel open per layer
- [ ] MINI panels coexist with FULL
- [ ] MasterComposer behavior changes per layer
- [ ] Session state persists across reload
- [ ] Keyboard shortcuts work
- [ ] ARIA attributes correct
- [ ] Mobile: tabs collapse to bottom
- [ ] No console errors
- [ ] TypeScript compiles clean

---

## Prompt Continuation Strategy

Feed in phases. After each phase:
1. Agent implements
2. Run `bun run typecheck`
3. Run `bun run lint`
4. Agent reports completion
5. Next: "Continue with Phase N+1 from canvas-ssoa-upgrade-prompt.md"
