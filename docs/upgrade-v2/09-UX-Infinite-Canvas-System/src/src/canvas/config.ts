// User-configurable canvas configuration.
//
// This is the single source of truth for every visual + behavioral
// dimension of the canvas. It is:
//   - typed (so the config panel can render a schema-driven UI)
//   - hot-reloadable (file watcher re-reads config/canvas.toml on save)
//   - overridable (each canvas can override any field via configOverrides)
//   - resettable (the panel has a "Reset to defaults" button)
//
// Load order: defaults -> global config (config/canvas.toml) -> per-canvas
// overrides -> runtime overrides from the config panel.

export type Theme = 'light' | 'dark' | 'auto' | 'custom'
export type GridStyle = 'none' | 'dots' | 'lines' | 'cross'
export type ZoomGesture = 'wheel' | 'pinch' | 'cmd-scroll' | 'scroll-then-pinch'
export type DefaultNodeSize = 'compact' | 'comfortable' | 'spacious'
export type KeyboardMode = 'modal' | 'direct' | 'hybrid'

export interface CanvasPalette {
  background: string
  surface: string
  surfaceMuted: string
  border: string
  text: string
  textMuted: string
  accent: string
  nodeByCategory: Record<string, string>
  edgeByKind: Record<string, string>
}

export interface CanvasConfig {
  schema: 'vivim.canvas.config/v1'

  // --- Visual ---
  theme: Theme
  palette: CanvasPalette
  grid: {
    style: GridStyle
    size: number // canvas units between grid lines
    color: string
    colorMajor: string
    majorEvery: number // every Nth line is major
  }
  snap: {
    enabled: boolean
    gridSize: number
    toNodes: boolean
    threshold: number // px distance to snap
  }

  // --- Viewport behavior ---
  zoom: {
    min: number // 0.01 = 1%
    max: number // 10 = 1000%
    wheelMode: ZoomGesture
    invertDirection: boolean
    smoothingMs: number // transition duration for zoom changes
  }
  pan: {
    wheelMode: 'scroll' | 'drag' | 'none'
    invertDirection: boolean
    smoothingMs: number
  }

  // --- Node defaults ---
  nodes: {
    defaultSize: DefaultNodeSize
    compact: { width: number; height: number }
    comfortable: { width: number; height: number }
    spacious: { width: number; height: number }
    fontFamily: string
    fontSize: number
    borderRadius: number
    shadow: boolean
  }

  // --- Edge defaults ---
  edges: {
    arrowhead: 'none' | 'triangle' | 'diamond' | 'circle'
    width: number
    curved: boolean
    labelBackground: boolean
  }

  // --- Keyboard ---
  keyboard: {
    mode: KeyboardMode
    leaderKey: string // for modal sequences like "dd"
    modalIndicator: boolean
    bindings: Record<string, string> // action -> keys
  }

  // --- Persistence ---
  persistence: {
    autosaveMs: number
    format: 'json' | 'toml' | 'yaml'
    location: 'indexeddb' | 'filesystem' | 'server'
    versionHistory: number // max versions to keep
  }

  // --- Collaboration ---
  collaboration: {
    enabled: boolean
    syncUrl?: string
    presence: boolean
  }

  // --- Performance ---
  performance: {
    virtualizeOffscreen: boolean
    offscreenMargin: number // px outside viewport to still render
    maxNodesPerFrame: number
  }
}

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  schema: 'vivim.canvas.config/v1',
  theme: 'auto',
  palette: {
    background: '#fafaf9', // stone-50
    surface: '#ffffff',
    surfaceMuted: '#f5f5f4',
    border: '#e7e5e4', // stone-200
    text: '#1c1917', // stone-900
    textMuted: '#78716c', // stone-500
    accent: '#0f172a',
    nodeByCategory: {
      Security: '#e11d48', // rose-600
      'Code Quality': '#d97706', // amber-600
      Reliability: '#0284c7', // sky-600
      'Web Presence': '#7c3aed', // violet-600
      'UX & Features': '#059669', // emerald-600
    },
    edgeByKind: {
      'depends-on': '#0284c7',
      conflicts: '#e11d48',
      relates: '#78716c',
      references: '#7c3aed',
    },
  },
  grid: {
    style: 'dots',
    size: 24,
    color: 'rgba(0,0,0,0.08)',
    colorMajor: 'rgba(0,0,0,0.16)',
    majorEvery: 8,
  },
  snap: {
    enabled: true,
    gridSize: 24,
    toNodes: true,
    threshold: 8,
  },
  zoom: {
    min: 0.05,
    max: 8,
    wheelMode: 'cmd-scroll',
    invertDirection: false,
    smoothingMs: 120,
  },
  pan: {
    wheelMode: 'drag',
    invertDirection: false,
    smoothingMs: 80,
  },
  nodes: {
    defaultSize: 'comfortable',
    compact: { width: 200, height: 120 },
    comfortable: { width: 320, height: 200 },
    spacious: { width: 480, height: 280 },
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 14,
    borderRadius: 12,
    shadow: true,
  },
  edges: {
    arrowhead: 'triangle',
    width: 2,
    curved: true,
    labelBackground: true,
  },
  keyboard: {
    mode: 'modal',
    leaderKey: '<space>',
    modalIndicator: true,
    bindings: {
      'node.delete': 'dd',
      'node.yank': 'yy',
      'node.paste': 'p',
      'node.connect': 'c',
      'node.group': 'g',
      'view.zoom-in': '+',
      'view.zoom-out': '-',
      'view.fit': 'zf',
      'view.find': '<cmd-k>',
      'insert.note': 'i',
      'insert.below': 'o',
      'insert.above': 'O',
      'command.open': ':',
      'bookmark.set': 'm',
      'bookmark.goto': "'",
    },
  },
  persistence: {
    autosaveMs: 500,
    format: 'json',
    location: 'indexeddb',
    versionHistory: 50,
  },
  collaboration: {
    enabled: false,
    presence: true,
  },
  performance: {
    virtualizeOffscreen: true,
    offscreenMargin: 200,
    maxNodesPerFrame: 500,
  },
}

// Merge configs: later args win. Deep-merge objects, replace primitives.
export function mergeConfigs(
  base: CanvasConfig,
  ...overrides: Partial<CanvasConfig>[]
): CanvasConfig {
  const out = structuredClone(base)
  for (const override of overrides) {
    if (!override) continue
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) continue
      const k = key as keyof CanvasConfig
      if (
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value !== null &&
        typeof out[k] === 'object' &&
        !Array.isArray(out[k])
      ) {
        ;(out[k] as Record<string, unknown>) = {
          ...(out[k] as Record<string, unknown>),
          ...(value as Record<string, unknown>),
        }
      } else {
        ;(out as Record<string, unknown>)[k] = value
      }
    }
  }
  return out
}
