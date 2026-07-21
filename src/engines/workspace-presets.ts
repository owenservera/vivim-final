// src/engines/workspace-presets.ts
// Unit 4.2 — Workspace default layouts + presets

// ── Types ─────────────────────────────────────────────────────────────────────

export type PresetId = 'chat' | 'dual' | 'dashboard' | 'agent-monitor' | 'memory-workbench'

export type PanelKind = 'builtin' | 'canvas'

export interface BuiltinPanel {
  kind: 'builtin'
  builtinSurfaceId: string
}

export interface CanvasPanel {
  kind: 'canvas'
  canvasInstanceId: string
}

export type PanelSpec = BuiltinPanel | CanvasPanel

export interface WorkspaceLayoutRow {
  id: string
  userId: string
  name: string
  panels: PanelSpec[]
  createdAt: number
  updatedAt: number
}

// Minimal interface for WorkspaceManager (defined fully in its own engine)
export interface WorkspaceManager {
  setLayout(userId: string, panels: PanelSpec[], name: string): Promise<WorkspaceLayoutRow>
  getLayout(userId: string, name: string): Promise<WorkspaceLayoutRow | null>
}

// Minimal interface for CanvasSpawner (defined fully in its own engine)
export interface CanvasSpawner {
  spawn(opts: { definitionId: string; spawnedBy: string }): Promise<{ canvasId: string }>
}

// ── Preset definitions ─────────────────────────────────────────────────────────

interface PresetDef {
  id: PresetId
  name: string
  build: (spawn: (def: string) => Promise<string>) => Promise<PanelSpec[]>
}

const PRESETS: Record<PresetId, PresetDef> = {
  chat: {
    id: 'chat',
    name: 'Chat',
    build: async () => [{ kind: 'builtin', builtinSurfaceId: 'conversation-list' }],
  },
  dual: {
    id: 'dual',
    name: 'Dual Canvas',
    build: async (spawn) => [
      { kind: 'canvas', canvasInstanceId: await spawn('cv:system:chat-pane') },
      { kind: 'canvas', canvasInstanceId: await spawn('cv:system:markdown-viewer') },
    ],
  },
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    build: async (spawn) => {
      const definitions = [
        'cv:system:dashboard-grid',
        'cv:system:data-table',
        'cv:system:image-gallery',
        'cv:system:code-block',
      ]
      const panels = await Promise.all(
        definitions.map(async (d) => ({
          kind: 'canvas' as const,
          canvasInstanceId: await spawn(d),
        })),
      )
      return panels
    },
  },
  'agent-monitor': {
    id: 'agent-monitor',
    name: 'Agent Monitor',
    build: async (spawn) => [
      { kind: 'builtin', builtinSurfaceId: 'agent-frontend' },
      { kind: 'canvas', canvasInstanceId: await spawn('cv:system:chat-pane') },
    ],
  },
  'memory-workbench': {
    id: 'memory-workbench',
    name: 'Memory Workbench',
    build: async (spawn) => [
      { kind: 'builtin', builtinSurfaceId: 'memory-browser' },
      { kind: 'builtin', builtinSurfaceId: 'conversation-list' },
      { kind: 'canvas', canvasInstanceId: await spawn('cv:system:markdown-viewer') },
    ],
  },
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export class WorkspacePresets {
  constructor(
    private manager: WorkspaceManager,
    private spawner: CanvasSpawner,
  ) {}

  list(): PresetId[] {
    return Object.keys(PRESETS) as PresetId[]
  }

  async apply(userId: string, preset: PresetId): Promise<WorkspaceLayoutRow> {
    const def = PRESETS[preset]
    if (!def) throw new Error(`Unknown preset: ${preset}`)

    const spawn = async (definitionId: string) => {
      const inst = await this.spawner.spawn({ definitionId, spawnedBy: 'system' })
      return inst.canvasId
    }
    const panels = await def.build(spawn)
    return this.manager.setLayout(userId, panels, def.name)
  }

  async ensureDefault(
    userId: string,
    existing?: WorkspaceLayoutRow | null,
  ): Promise<WorkspaceLayoutRow> {
    const current = existing ?? (await this.manager.getLayout(userId, 'default'))
    if (current && current.panels.length > 0) return current
    return this.apply(userId, 'chat')
  }
}
