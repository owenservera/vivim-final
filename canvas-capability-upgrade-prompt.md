# Canvas Capability Exposure Upgrade Prompt (v3 — Full Deep Inspection)

## Objective
Wire ALL backend capabilities into the LivingCanvas frontend so every capability has a visual, interactive frontend component. No capability should exist only as CLI/API — every one must be reachable from the canvas UI.

## Architecture Rules
- FRONTEND = BACKEND: capability `slug` is the single link. No `if (slug === 'x')` conditionals.
- The UniversalComponentRegistry (`register-all.ts`) is the single source of truth for what slots exist.
- Every component must be a proper React component, never `null`.
- SDK hooks (`useCapability`, `useHealth`, `useMutation`, `useSession`, `useConversation`, `useProvider`, `useInterpret`) are the single transport — never hand-write fetch calls.
- Every new component must handle loading, error, and empty states.
- Every new panel must be reachable from the MainMenu, CommandBar, and/or CommandPalette.
- All components use CSS variables (`var(--bg)`, `var(--text)`, `var(--border)`, `var(--accent)`) — NO Tailwind classes.

---

## CURRENT STATE (Deep Inspection Results)

### 1. `page.tsx` — Wiring Pattern (EXACT CODE)

```tsx
// PANELS config — only 3 panels exist:
const PANELS: PanelConfig[] = [
  { id: 'conversations', title: 'Conversations', icon: 'message-square', defaultDock: 'left', defaultSize: 'normal' },
  { id: 'providers', title: 'Providers', icon: 'cpu', defaultDock: 'left', defaultSize: 'normal' },
  { id: 'settings', title: 'Settings', icon: 'settings', defaultDock: 'right', defaultSize: 'compact' },
];

// Panel rendering loop:
{PANELS.map((panelConfig) => (
  <Panel key={panelConfig.id} config={panelConfig} isOpen={openPanels.has(panelConfig.id)} onClose={() => togglePanel(panelConfig.id)}>
    {panelConfig.id === 'conversations' && <ConversationsPanel onSelect={setActiveConversationId} />}
    {panelConfig.id === 'providers' && <ProvidersPanel providerIds={providerIds} accounts={accounts} onToggleProvider={toggleProvider} onCycleTier={cycleTier} />}
    {panelConfig.id === 'settings' && <SettingsPanel />}
  </Panel>
))}

// Keyboard shortcuts:
// Cmd+K → Command Palette
// Cmd+Shift+H → Vivim Assistant
// Cmd+` → Dev Console
// Cmd+. → Toggle all panels
// Escape → Close palette + menu + theme
```

**KEY FINDING:** The `togglePanel(panelId)` function simply adds/removes from `openPanels` Set. To wire a new panel, you add a `PanelConfig` to `PANELS` and add a `{panelConfig.id === 'xxx' && <Component />}` block.

### 2. `Panel.tsx` — PanelConfig Interface (EXACT)

```ts
export type PanelDock = 'left' | 'right' | 'top' | 'bottom' | 'float';
export type PanelSize = 'compact' | 'normal' | 'wide';

export interface PanelConfig {
  id: string;
  title: string;
  icon: IconName;
  defaultDock: PanelDock;
  defaultSize: PanelSize;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

// SIZE_MAP: compact=280w×400h, normal=320w×500h, wide=400w×600h
```

### 3. `MainMenu.tsx` — Existing Menu Items (EXACT)

```tsx
const items: MenuItem[] = [
  { id: 'assistant', label: 'Ask Vivim', icon: 'chat', shortcut: 'Cmd+Shift+H' },
  { id: 'conversations', label: 'Conversations', icon: 'message-square' },
  { id: 'providers', label: 'Providers', icon: 'cpu' },
  { id: 'settings', label: 'Settings', icon: 'settings', shortcut: 'Cmd+,' },
  { id: 'health', label: 'Health Dashboard', icon: 'activity' },         // ← BROKEN: no panel config
  { id: 'capabilities', label: 'Capabilities', icon: 'grid' },           // ← BROKEN: no panel config
  { id: 'dev-console', label: 'Dev Console', icon: 'terminal', shortcut: 'Cmd+`' },
  { id: 'theme', label: 'Theme Settings', icon: 'palette' },
];
```

**CRITICAL:** `health` and `capabilities` menu items call `onTogglePanel('health')` and `onTogglePanel('capabilities')` but `page.tsx` has NO panel configs for these IDs — they silently do nothing.

### 4. `CommandBar.tsx` — Quick Panel Toggles (EXACT)

```tsx
<PanelToggle icon="message-square" panelId="conversations" onToggle={onTogglePanel} />
<PanelToggle icon="cpu" panelId="providers" onToggle={onTogglePanel} />
<PanelToggle icon="settings" panelId="settings" onToggle={onTogglePanel} />
// Only 3 quick-access toggles. No health, capabilities, etc.
```

### 5. `Icon.tsx` — Available Icon Names (FULL CATALOG)

**132 icons available.** Key ones for new panels:
- `activity` — health/audit
- `grid` — capabilities
- `search` — search
- `layers` — z-layers
- `shield` — RBAC
- `template` — templates
- `terminal` — shell
- `bolt` — automations
- `robot` — agents
- `document` — documents
- `media` — media
- `chart` — audit/observability
- `users` — presence/team
- `database` — database
- `server` — server
- `cloud` — cloud
- `zap` — execute/quick-action
- `refresh` — refresh
- `undo`, `redo` — mutation
- `play`, `pause`, `stop` — media/automation
- All layout icons: `kanban`, `timeline`, `mindmap`, `cluster`, `free`, `grid`, `list`
- All panel dock icons: `panel-left`, `panel-right`, `panel-top`, `panel-bottom`

**MISSING:** No `panel-right` issue — all needed icons exist.

### 6. `CommandPalette.tsx` — Search Kinds (EXACT)

```tsx
const KIND_GROUPS: Array<{ kind: SearchEntityKind; label: string; icon: string }> = [
  { kind: 'command', label: 'Commands', icon: '⚡' },
  { kind: 'workspace', label: 'Workspaces', icon: '🏠' },
  { kind: 'document', label: 'Documents', icon: '📄' },
  { kind: 'media', label: 'Media', icon: '🎬' },
  { kind: 'automation', label: 'Automations', icon: '🤖' },
  { kind: 'agent', label: 'Agents', icon: '🧠' },
  { kind: 'provider', label: 'Providers', icon: '🔌' },
  { kind: 'capability', label: 'Capabilities', icon: '⚙️' },
];
```

**MISSING:** No `panel` kind. Panels don't appear in search.

### 7. `CapabilityBar.tsx` — Existing Component (ALREADY WORKS)

```tsx
// 109 lines. Uses useCapability('ui') hook.
// Has: filter input, badge count, button grid with execute + tooltip.
// NOT wired into any panel — exists as a standalone component.
// Uses Tailwind classes (className="flex items-center gap-2").
// Uses shadcn components (Button, Badge, Tooltip).
```

**CONFLICT:** CapabilityBar uses Tailwind + shadcn. The rest of the canvas uses CSS variables. The new CapabilityCatalog should use CSS variables design system to stay consistent.

### 8. `slots.ts` — Current Slot IDs (EXACT)

```ts
export const SLOT_IDS = [
  'chat.entry', 'chat.sidebar', 'chat.thread', 'chat.bubble',
  'chat.composer', 'chat.send', 'chat.attach', 'chat.streaming',
  'chat.result', 'chat.confirm', 'chat.error', 'chat.header',
  'chat.actionBar',
] as const
```

**MISSING:** No canvas-level slots for panels, no `canvas.controls`, no `session.controls`, no `autonomous.controls`, etc. New slots needed.

### 9. `register-all.ts` — Registration Status (EXACT)

**Registered with REAL components (not null):**
- `canvas.living` → LivingCanvas ✓
- `card.doc` → DocCard ✓
- `card.doc-editor` → DocEditor ✓
- `card.media` → MediaCard ✓
- `card.automation` → AutomationCard ✓
- `card.agent` → AgentCard ✓
- `card.shell` → ShellCard ✓
- `panel.zlayer` → ZLayerPanel ✓
- `panel.drawer` → DrawerSystem ✓
- `panel.audit` → AuditDashboard ✓
- `panel.rbac` → RbacManager ✓
- `panel.templates` → TemplatesGallery ✓
- `overlay.palette` → CommandPalette ✓
- `overlay.notifications` → NotificationsCenter ✓
- `overlay.onboarding` → OnboardingTour ✓
- `overlay.quick-actions` → QuickActionsMenu ✓
- `overlay.agent` → AgentOverlay ✓
- `control.theme-provider` → ThemeProvider ✓
- `control.theme-settings` → ThemeSettings ✓
- `control.workspace-switcher` → WorkspaceSwitcher ✓
- `control.presence` → PresenceIndicator ✓
- `control.vcard-menu` → VCardMenu ✓
- `primitive.sandboxed-node` → SandboxedNode ✓
- `primitive.connection-layer` → ConnectionLayer ✓
- `primitive.observability-hud` → ObservabilityHUD ✓
- `primitive.unified-io` → UnifiedIOProvider ✓

**Registered as NULL (missing files):**
- `HealthDashboard` → null (line 461)
- `CapabilityCatalog` → null (line 462)
- `SearchPanel` → null (line 473)

**Catalog entries with null:**
- `registerCatalogComponent('HealthDashboard', null)` — line 461
- `registerCatalogComponent('CapabilityCatalog', null)` — line 462
- `registerCatalogComponent('SearchPanel', null)` — line 473

### 10. SDK Hooks — Complete API Surface

| Hook | Endpoint | Returns |
|------|----------|---------|
| `useCapability(surface?)` | `GET /api/capabilities?surface=X` | `{capabilities, loading, error, refresh, execute(slug, input?)}` |
| `useHealth()` | `GET /api/health` | `{health, loading, error, check}` |
| `useSession()` | `GET /api/session` | `{session, loading, error, getSession, login, logout}` |
| `useConversation()` | `GET /api/conversations` | `{conversations, loading, error, refresh, create, remove}` |
| `useProvider()` | `GET /api/providers` | `{providers, loading, error, refresh}` |
| `useMutation(opts?)` | `GET /api/mutation/status` + `/history` | `{loading, error, history, status, apply, preview, undo, redo, refreshStatus, refreshHistory}` |
| `useInterpret()` | `POST /api/nlcl/interpret` | `{interpret(nl, context?), loading, error}` |
| `useIO()` | raw transport | `io.get(url)`, `io.post(url, body)`, `io.request(url, opts)`, `io.on(handler)` |

### 11. Backend API Endpoints (COMPLETE)

| Router | Endpoints | File |
|--------|-----------|------|
| **Capability** | `GET /api/capabilities`, `POST /api/capabilities/:id/execute`, `GET /api/capabilities/:id` | `capability-router.ts` |
| **Mutation** | `POST /api/mutation/apply`, `/preview`, `/undo`, `/redo`, `GET /api/mutation/history`, `/status` | `mutation-router.ts` |
| **Autonomous** | `POST /api/autonomous/execute`, `GET /api/autonomous/tasks`, `/gates`, `POST /api/autonomous/gates/:id/resolve`, `GET /api/autonomous/status/:id`, `POST /api/autonomous/:id/cancel`, `/replay`, `GET /api/autonomous/:id/trace`, `/timeline`, `/search` | `autonomous-router.ts` |
| **Automation** | `GET /api/automate/recipes`, `/roles`, `POST /api/automate/run` | `automation-router.ts` |
| **Canvas** | `GET /api/canvas/definitions`, `POST /api/canvas/spawn`, `/resolve`, `GET /api/canvas/events` (SSE), `POST /api/canvas/instance/:id/mutate`, `DELETE /api/canvas/instance/:id` | `canvas-router.ts` |
| **Conversation** | `GET /api/conversations`, `POST /api/conversations/:id/send`, `GET /api/session` | `conversation-router.ts` |
| **Health** | `GET /api/health` | health check |
| **Search** | `POST /api/search` | search index |
| **ZLayer** | `GET /api/zlayer/get`, `POST /api/zlayer/update`, `/set_active` | z-layer |
| **Audit** | `GET /api/audit/list`, `/stats`, `/export` | audit trail |
| **RBAC** | `GET /api/rbac/roles`, `/members`, `POST /api/rbac/grant`, `/update_role`, `/revoke`, `/check` | RBAC |
| **Template** | `GET /api/template/list`, `POST /api/template/instantiate` | templates |
| **Document** | `POST /api/document/edit/start`, `/save` | document editing |
| **Shell** | `POST /api/canvas/shell` | shell commands |
| **NLCL** | `POST /api/nlcl/interpret` | NL interpreter |

### 12. Existing Component Interfaces (EXACT PROPS)

```tsx
// DocCard — requires a DocumentCard object
DocCard({ document: DocumentCard, onAnnotate?: (id: string) => void })

// DocEditor — requires a DocumentCard + optional userId
DocEditor({ document: DocumentCard, userId?: string, onSaved?: (version: number) => void })

// MediaCard — requires a MediaCardRow object
MediaCard({ media: MediaCardRow, onPlay?, onPause?, onSeek?, onTranscribe? })

// AutomationCard — requires an AutomationDefinition object
AutomationCard({ automation: AutomationDefinition, onExecute?: (id: string) => void })

// AgentCard — requires an AgentDefinition object
AgentCard({ agent: AgentDefinition, onInvoke?: (id: string) => void })

// ShellCard — requires workspaceId
ShellCard({ workspaceId: string })

// ZLayerPanel — requires workspaceId
ZLayerPanel({ workspaceId: string })

// AuditDashboard — requires workspaceId
AuditDashboard({ workspaceId: string })

// RbacManager — requires workspaceId
RbacManager({ workspaceId: string })

// TemplatesGallery — optional onCreated callback
TemplatesGallery({ onCreated?: (workspaceId: string) => void })
```

---

## WHAT TO BUILD

### PHASE 1: Create 3 Missing Components (Un-null registrations)

#### 1.1 CapabilityCatalog.tsx
**File:** `frontend/src/components/canvas/CapabilityCatalog.tsx`
**SDK hook:** `useCapability('ui')`
**Design:** Searchable grid of capabilities (mirror ProvidersPanel style with CSS variables)
**Props:** none (self-contained via hook)
**Behavior:**
- Fetch `GET /api/capabilities?surface=ui` on mount
- Search input filters by slug/name
- Grid of cards: slug, name, category, surfaces badges (cli/ui/api/mcp), description
- "Execute" button calls `execute(slug)` → shows toast result
- Loading spinner, error state, empty state

#### 1.2 HealthDashboard.tsx
**File:** `frontend/src/components/canvas/HealthDashboard.tsx`
**SDK hooks:** `useHealth()`, `useProvider()`
**Design:** Status cards + provider list + auto-refresh (mirror AuditDashboard style)
**Props:** none
**Behavior:**
- `check()` on mount + every 15s
- Backend status: ok/error badge, version, uptime
- Provider status: list from `useProvider()`, each with status dot
- Color-coded: green=ok, red=error, yellow=degraded

#### 1.3 SearchPanel.tsx
**File:** `frontend/src/components/canvas/SearchPanel.tsx`
**SDK hook:** `useIO()` for `POST /api/search`
**Design:** Search input + results grouped by kind (mirror CommandPalette)
**Props:** none
**Behavior:**
- Text input with debounced search (120ms)
- Results grouped by kind with icon + title + subtitle
- Click result → navigate/execute
- Keyboard navigation (arrow keys + enter)

### PHASE 2: Wire 12 New Panels into `page.tsx`

#### 2.1 Expand PANELS Array

```tsx
const PANELS: PanelConfig[] = [
  // Existing 3:
  { id: 'conversations', title: 'Conversations', icon: 'message-square', defaultDock: 'left', defaultSize: 'normal' },
  { id: 'providers', title: 'Providers', icon: 'cpu', defaultDock: 'left', defaultSize: 'normal' },
  { id: 'settings', title: 'Settings', icon: 'settings', defaultDock: 'right', defaultSize: 'compact' },
  // New 12:
  { id: 'health', title: 'Health Dashboard', icon: 'activity', defaultDock: 'right', defaultSize: 'normal' },
  { id: 'capabilities', title: 'Capabilities', icon: 'grid', defaultDock: 'right', defaultSize: 'wide' },
  { id: 'search', title: 'Search', icon: 'search', defaultDock: 'right', defaultSize: 'normal' },
  { id: 'documents', title: 'Documents', icon: 'document', defaultDock: 'right', defaultSize: 'wide' },
  { id: 'media', title: 'Media', icon: 'media', defaultDock: 'right', defaultSize: 'normal' },
  { id: 'automation', title: 'Automations', icon: 'bolt', defaultDock: 'right', defaultSize: 'normal' },
  { id: 'agents', title: 'Agents', icon: 'robot', defaultDock: 'right', defaultSize: 'normal' },
  { id: 'terminal', title: 'Terminal', icon: 'terminal', defaultDock: 'bottom', defaultSize: 'normal' },
  { id: 'zlayers', title: 'Z-Layers', icon: 'layers', defaultDock: 'right', defaultSize: 'compact' },
  { id: 'audit', title: 'Audit', icon: 'chart', defaultDock: 'right', defaultSize: 'normal' },
  { id: 'templates', title: 'Templates', icon: 'template', defaultDock: 'right', defaultSize: 'normal' },
  { id: 'rbac', title: 'RBAC', icon: 'shield', defaultDock: 'right', defaultSize: 'normal' },
];
```

#### 2.2 Add Panel Content Blocks in `page.tsx`

For each panel, add inside the `<Panel>` children:
```tsx
{panelConfig.id === 'health' && <HealthDashboard />}
{panelConfig.id === 'capabilities' && <CapabilityCatalog />}
{panelConfig.id === 'search' && <SearchPanel />}
{panelConfig.id === 'documents' && <DocEditor document={selectedDocument} />}
{panelConfig.id === 'media' && <MediaCard media={selectedMedia} />}
{panelConfig.id === 'automation' && <AutomationCard automation={selectedAutomation} />}
{panelConfig.id === 'agents' && <AgentCard agent={selectedAgent} />}
{panelConfig.id === 'terminal' && <ShellCard workspaceId={workspaceId} />}
{panelConfig.id === 'zlayers' && <ZLayerPanel workspaceId={workspaceId} />}
{panelConfig.id === 'audit' && <AuditDashboard workspaceId={workspaceId} />}
{panelConfig.id === 'templates' && <TemplatesGallery />}
{panelConfig.id === 'rbac' && <RbacManager workspaceId={workspaceId} />}
```

**NOTE:** DocEditor, MediaCard, AutomationCard, AgentCard require data objects. Two approaches:
- **Option A:** Store selected document/media/automation/agent in state, pass to panels
- **Option B:** Build wrapper panels (DocumentBrowser, MediaBrowser, etc.) that fetch list + display

### PHASE 3: Create 5 NEW Components for Backend Capability Groups

#### 3.1 CanvasControlPanel.tsx — Mutation Controls
**SDK hook:** `useMutation({ pollStatus: true })`
**Slot:** `canvas.controls` (NEW)
**Actions:**
- Undo button (calls `undo()`) — disabled when `!status.canUndo`
- Redo button (calls `redo()`) — disabled when `!status.canRedo`
- History list (from `history[]`) — shows last N mutations with timestamps
- DSL input textarea → Apply button (calls `apply({ dsl })`)
- Preview button (calls `preview({ dsl })`) → shows diff
- Status bar: `historyLength` items, canUndo/canRedo indicators

#### 3.2 TaskManager.tsx — Autonomous Task Controls
**SDK hook:** `useIO()` for `/api/autonomous/*`
**Slot:** `autonomous.controls` (NEW)
**Actions:**
- Execute task: goal text input → `POST /api/autonomous/execute`
- List tasks: `GET /api/autonomous/tasks` with status filter
- Task detail: expandable row showing steps, status, timing
- Gate resolver: `POST /api/autonomous/gates/:id/resolve` for pending gates
- Cancel/replay: `POST /api/autonomous/:id/cancel` or `/replay`
- Trace viewer: `GET /api/autonomous/:id/trace`

#### 3.3 AutomationLauncher.tsx — Browser Automation
**SDK hook:** `useIO()` for `/api/automate/*`
**Slot:** `automation.launcher` (NEW)
**Actions:**
- List recipes: `GET /api/automate/recipes`
- List roles: `GET /api/automate/roles`
- Run automation: `POST /api/automate/run` with role, recipeId, intent, params
- Show result: status, output, timing

#### 3.4 FleetStatus.tsx — Provider Fleet Overview
**SDK hooks:** `useProvider()`, `useHealth()`
**Slot:** `fleet.controls` (NEW)
**Actions:**
- Provider cards: name, status, capabilities
- Health status: ok/error
- Auto-refresh every 15s

#### 3.5 SessionControls.tsx — Session Lifecycle
**SDK hook:** `useSession()`
**Slot:** `session.controls` (NEW)
**Actions:**
- Current session: userId, email, authenticated status
- Login form: email + password → `login()`
- Logout button: `logout()`
- Session refresh: `getSession()`

### PHASE 4: Register All New Components

#### 4.1 Add to `register-all.ts`

For each new component:
```ts
register({
  id: 'panel.capability-catalog',  // or 'panel.health', etc.
  label: 'Capability Catalog',
  kind: 'panel',
  category: 'capabilities',
  slot: 'capabilities.panel',     // NEW slot
  Component: C.CapabilityCatalog ?? null,
  capabilities: ['cap:capability:list', 'cap:capability:execute'],
  version: 1,
  author: 'system',
  tags: ['capabilities'],
  enabled: true,
  isDefault: true,
});
```

Also un-null existing nulls:
```ts
// Line 461: change null → C.HealthDashboard
registerCatalogComponent('HealthDashboard', C.HealthDashboard ?? null as unknown as any);
// Line 462: change null → C.CapabilityCatalog
registerCatalogComponent('CapabilityCatalog', C.CapabilityCatalog ?? null as unknown as any);
// Line 473: change null → C.SearchPanel
registerCatalogComponent('SearchPanel', C.SearchPanel ?? null as unknown as any);
```

#### 4.2 Add New Slots to `slots.ts`

```ts
export const SLOT_IDS = [
  // Existing 13 chat slots...
  'chat.entry', 'chat.sidebar', 'chat.thread', 'chat.bubble',
  'chat.composer', 'chat.send', 'chat.attach', 'chat.streaming',
  'chat.result', 'chat.confirm', 'chat.error', 'chat.header',
  'chat.actionBar',
  // New canvas-level slots:
  'canvas.controls',
  'session.controls',
  'autonomous.controls',
  'automation.launcher',
  'fleet.controls',
  'capabilities.panel',
  'health.panel',
  'search.panel',
  'zlayers.panel',
  'audit.panel',
  'templates.panel',
  'rbac.panel',
] as const
```

### PHASE 5: Update Navigation Surfaces

#### 5.1 MainMenu — Add Menu Items

Add after existing items:
```ts
{ id: 'documents', label: 'Documents', icon: 'document', action: () => { onTogglePanel('documents'); onClose(); } },
{ id: 'media', label: 'Media', icon: 'media', action: () => { onTogglePanel('media'); onClose(); } },
{ id: 'automation-panel', label: 'Automations', icon: 'bolt', action: () => { onTogglePanel('automation'); onClose(); } },
{ id: 'agents-panel', label: 'Agents', icon: 'robot', action: () => { onTogglePanel('agents'); onClose(); } },
{ id: 'terminal', label: 'Terminal', icon: 'terminal', shortcut: 'Cmd+`', action: () => { onTogglePanel('terminal'); onClose(); } },
{ id: 'zlayers', label: 'Z-Layers', icon: 'layers', action: () => { onTogglePanel('zlayers'); onClose(); } },
{ id: 'audit-panel', label: 'Audit Trail', icon: 'chart', action: () => { onTogglePanel('audit'); onClose(); } },
{ id: 'rbac-panel', label: 'RBAC', icon: 'shield', action: () => { onTogglePanel('rbac'); onClose(); } },
{ id: 'templates-panel', label: 'Templates', icon: 'template', action: () => { onTogglePanel('templates'); onClose(); } },
{ id: 'search-panel', label: 'Search', icon: 'search', shortcut: 'Cmd+/', action: () => { onTogglePanel('search'); onClose(); } },
```

#### 5.2 CommandBar — Add More Panel Toggles

Add after existing PanelToggles:
```tsx
<PanelToggle icon="activity" panelId="health" onToggle={onTogglePanel} />
<PanelToggle icon="grid" panelId="capabilities" onToggle={onTogglePanel} />
```

#### 5.3 CommandPalette — Add `panel` Kind

Add to `KIND_GROUPS`:
```ts
{ kind: 'panel', label: 'Panels', icon: '📋' },
```

### PHASE 6: Add Keyboard Shortcuts

Add to `page.tsx` keyboard handler:
```ts
// Cmd+H → health panel
if ((e.metaKey || e.ctrlKey) && e.key === 'h' && !e.shiftKey) {
  e.preventDefault();
  togglePanel('health');
}
// Cmd+T → terminal
if ((e.metaKey || e.ctrlKey) && e.key === 't') {
  e.preventDefault();
  togglePanel('terminal');
}
// Cmd+Shift+K → capabilities
if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
  e.preventDefault();
  togglePanel('capabilities');
}
// Cmd+Shift+A → automations
if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
  e.preventDefault();
  togglePanel('automation');
}
// Cmd+/ → search panel
if ((e.metaKey || e.ctrlKey) && e.key === '/') {
  e.preventDefault();
  togglePanel('search');
}
```

---

## KEY FILES TO MODIFY

| File | Changes |
|------|---------|
| `frontend/src/ui/slots.ts` | Add 12 new slot IDs + metadata |
| `frontend/src/components/canvas/register-all.ts` | Register 5 new components, un-null 3, add catalog entries |
| `frontend/src/app/page.tsx` | Expand PANELS array (12 entries), wire panel content blocks, add keyboard shortcuts |
| `frontend/src/components/canvas/MainMenu.tsx` | Add 10 new menu items for all new panels |
| `frontend/src/components/canvas/CommandBar.tsx` | Add 2 more PanelToggle buttons (health, capabilities) |
| `frontend/src/components/canvas/CommandPalette.tsx` | Add `panel` to KIND_GROUPS |

## KEY FILES TO CREATE

| File | Component | Depends On |
|------|-----------|------------|
| `frontend/src/components/canvas/HealthDashboard.tsx` | HealthDashboard | `useHealth()`, `useProvider()` |
| `frontend/src/components/canvas/CapabilityCatalog.tsx` | CapabilityCatalog | `useCapability('ui')` |
| `frontend/src/components/canvas/SearchPanel.tsx` | SearchPanel | `useIO()` |
| `frontend/src/components/canvas/CanvasControlPanel.tsx` | CanvasControlPanel | `useMutation()` |
| `frontend/src/components/canvas/TaskManager.tsx` | TaskManager | `useIO()` |
| `frontend/src/components/canvas/AutomationLauncher.tsx` | AutomationLauncher | `useIO()` |
| `frontend/src/components/canvas/FleetStatus.tsx` | FleetStatus | `useProvider()`, `useHealth()` |
| `frontend/src/components/canvas/SessionControls.tsx` | SessionControls | `useSession()` |

---

## COMPONENT DESIGN PATTERNS (CSS Variables, NOT Tailwind)

All new components must follow this pattern (from AuditDashboard, ZLayerPanel):

```tsx
<div style={{
  padding: 16,
  fontFamily: 'ui-sans-serif, system-ui',
  color: 'var(--text)',
  background: 'var(--bg)',
  height: '100%',
  overflowY: 'auto',
}}>
  <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Title</h2>
  {/* Content */}
</div>

// Buttons:
<button style={{
  padding: '6px 12px',
  background: 'var(--accent)',
  color: 'var(--accent-fg)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
}}>Action</button>

// Inputs:
<input style={{
  padding: '4px 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'inherit',
}} />

// Cards:
<div style={{
  padding: 10,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
}}>
  {/* Card content */}
</div>
```

## INVARIANTS (Never Violate)
- NEVER register a component with `Component: null`
- NEVER use `if (slug === 'x')` conditionals — resolve through registry by slot
- NEVER hand-write fetch() calls — use SDK hooks or `useIO()`
- All components use CSS variables — NO Tailwind classes
- Every component that fetches data must handle: loading, error, empty states
- Every new panel must be reachable from ≥2 surfaces (MainMenu + CommandPalette + shortcut)
