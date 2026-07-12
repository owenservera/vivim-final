// src/engines/capability-shape-registry.ts
// CapabilityShapeRegistry — Phase 22.7: Enhanced with shape inheritance + adapter loading

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { NotFoundError } from '../errors.js'

// ── Types ─────────────────────────────────────────────────────────────────

export interface DomIndicator {
  selector: string
  text?: string
  attribute?: string
}

export interface InteractiveElementPattern {
  selector: string
  action: string
  priority: number
}

export interface ProjectionRule {
  selector: string
  mapping: Record<string, string>
  fallback?: string
}

export interface CapabilityShape {
  id: string
  name: string
  expectedCapabilities: Record<string, 'required' | 'optional' | 'extended'>
  discoveryHints: {
    urlPatterns: string[]
    domIndicators: DomIndicator[]
    interactiveElementPatterns: InteractiveElementPattern[]
  }
  projectionRules: {
    composer: ProjectionRule
    modelSelector?: ProjectionRule
    messageList: ProjectionRule
  }
  parserExpectations: {
    responseFormat: 'sse' | 'json' | 'html' | 'websocket' | 'custom'
    parserArchetype: string
    fallbackStrategy: 'plain_text' | 'html_extract' | 'raw'
  }
  extendsShape?: string
  overrides?: Partial<Omit<CapabilityShape, 'id' | 'extendsShape' | 'overrides'>>
}

export interface CapabilityAdapter {
  shapeId: string
  toUniversal(
    shapeSpecific: Record<string, unknown>,
    shapeContext: CapabilityShape,
  ): Record<string, unknown>
  fromUniversal(
    action: Record<string, unknown>,
    shapeContext: CapabilityShape,
  ): Record<string, unknown>
  projectState(
    rawState: Record<string, unknown>,
    shapeContext: CapabilityShape,
  ): Record<string, unknown>
}

// ── Built-in shapes ─────────────────────────────────────────────────────

const BUILT_IN_SHAPES: CapabilityShape[] = [
  {
    id: 'chat_app',
    name: 'Chat Application',
    expectedCapabilities: {
      send_message: 'required',
      receive_message: 'required',
      typing_indicator: 'optional',
      file_upload: 'optional',
      model_selector: 'optional',
    },
    discoveryHints: {
      urlPatterns: ['chat', 'conversation', 'messenger'],
      domIndicators: [
        { selector: '[data-testid="composer"]', text: 'Send' },
        { selector: 'textarea', text: 'Message' },
        { selector: '[role="textbox"]' },
      ],
      interactiveElementPatterns: [
        { selector: 'textarea', action: 'type', priority: 1 },
        { selector: 'button[type="submit"]', action: 'click', priority: 2 },
        { selector: '[data-testid="send-button"]', action: 'click', priority: 2 },
      ],
    },
    projectionRules: {
      composer: { selector: 'textarea, [role="textbox"]', mapping: { value: 'textContent' } },
      messageList: {
        selector: '[data-testid="message"], [role="list"] > *',
        mapping: { role: 'data-author', content: 'textContent' },
      },
    },
    parserExpectations: {
      responseFormat: 'sse',
      parserArchetype: 'claude',
      fallbackStrategy: 'plain_text',
    },
  },
  {
    id: 'coding_ide',
    name: 'Coding IDE',
    expectedCapabilities: {
      send_message: 'required',
      receive_message: 'required',
      code_execution: 'required',
      file_operations: 'extended',
      terminal: 'extended',
    },
    discoveryHints: {
      urlPatterns: ['ide', 'code', 'editor', 'playground'],
      domIndicators: [
        { selector: '.monaco-editor' },
        { selector: '[class*="code-editor"]' },
        { selector: 'textarea[class*="code"]' },
      ],
      interactiveElementPatterns: [
        { selector: '.monaco-editor textarea', action: 'type', priority: 1 },
        { selector: '[data-testid="run"]', action: 'click', priority: 2 },
      ],
    },
    projectionRules: {
      composer: {
        selector: '.monaco-editor textarea',
        mapping: { value: 'textContent' },
      },
      messageList: {
        selector: '[class*="message"], [role="log"] > *',
        mapping: { role: 'data-role', content: 'textContent' },
      },
    },
    parserExpectations: {
      responseFormat: 'json',
      parserArchetype: 'generic',
      fallbackStrategy: 'html_extract',
    },
  },
  {
    id: 'search_engine',
    name: 'Search Engine',
    expectedCapabilities: {
      search: 'required',
      results_display: 'required',
      result_click: 'optional',
    },
    discoveryHints: {
      urlPatterns: ['search', 'query', 'find'],
      domIndicators: [
        { selector: 'input[type="search"]' },
        { selector: '[role="searchbox"]' },
        { selector: 'input[name="q"]' },
      ],
      interactiveElementPatterns: [
        { selector: 'input[type="search"], input[name="q"]', action: 'type', priority: 1 },
        { selector: 'button[type="submit"]', action: 'click', priority: 2 },
      ],
    },
    projectionRules: {
      composer: {
        selector: 'input[type="search"], input[name="q"]',
        mapping: { value: 'value' },
      },
      messageList: {
        selector: '[class*="result"], [data-result]',
        mapping: { content: 'textContent', url: 'href' },
      },
    },
    parserExpectations: {
      responseFormat: 'html',
      parserArchetype: 'generic',
      fallbackStrategy: 'html_extract',
    },
  },
  {
    id: 'design_tool',
    name: 'Design Tool',
    expectedCapabilities: {
      canvas_interaction: 'required',
      element_selection: 'required',
      property_editing: 'extended',
      export: 'optional',
    },
    discoveryHints: {
      urlPatterns: ['design', 'canvas', 'figma', 'sketch'],
      domIndicators: [
        { selector: 'canvas' },
        { selector: '[class*="canvas"]' },
        { selector: '[data-testid="canvas"]' },
      ],
      interactiveElementPatterns: [
        { selector: 'canvas', action: 'click', priority: 1 },
        { selector: '[class*="toolbar"] button', action: 'click', priority: 2 },
      ],
    },
    projectionRules: {
      composer: {
        selector: '[class*="toolbar"] input, [class*="search"]',
        mapping: { value: 'value' },
      },
      messageList: {
        selector: '[class*="layer"], [class*="panel"] > *',
        mapping: { content: 'textContent' },
      },
    },
    parserExpectations: {
      responseFormat: 'json',
      parserArchetype: 'generic',
      fallbackStrategy: 'raw',
    },
  },
  {
    id: 'data_dashboard',
    name: 'Data Dashboard',
    expectedCapabilities: {
      query_data: 'required',
      display_results: 'required',
      filter_data: 'optional',
      export: 'optional',
    },
    discoveryHints: {
      urlPatterns: ['dashboard', 'analytics', 'data', 'report'],
      domIndicators: [
        { selector: '[class*="dashboard"]' },
        { selector: '[class*="chart"]' },
        { selector: 'canvas' },
      ],
      interactiveElementPatterns: [
        { selector: '[class*="filter"] input', action: 'type', priority: 1 },
        { selector: '[class*="search"] input', action: 'type', priority: 2 },
      ],
    },
    projectionRules: {
      composer: {
        selector: '[class*="filter"] input, [class*="search"] input',
        mapping: { value: 'value' },
      },
      messageList: {
        selector: '[class*="card"], [class*="widget"]',
        mapping: { content: 'textContent' },
      },
    },
    parserExpectations: {
      responseFormat: 'json',
      parserArchetype: 'generic',
      fallbackStrategy: 'raw',
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    expectedCapabilities: {},
    discoveryHints: {
      urlPatterns: [],
      domIndicators: [],
      interactiveElementPatterns: [],
    },
    projectionRules: {
      composer: { selector: 'body', mapping: {} },
      messageList: { selector: 'body', mapping: {} },
    },
    parserExpectations: {
      responseFormat: 'custom',
      parserArchetype: 'generic',
      fallbackStrategy: 'raw',
    },
  },
]

// ── Registry ────────────────────────────────────────────────────────────

export class CapabilityShapeRegistry {
  private shapes = new Map<string, CapabilityShape>()
  private adapters = new Map<string, CapabilityAdapter>()

  constructor() {
    for (const shape of BUILT_IN_SHAPES) {
      this.shapes.set(shape.id, shape)
    }
  }

  getShape(shapeId: string): CapabilityShape | null {
    return this.shapes.get(shapeId) ?? null
  }

  listShapes(): CapabilityShape[] {
    return [...this.shapes.values()]
  }

  registerShape(shape: CapabilityShape): void {
    this.shapes.set(shape.id, shape)
  }

  getAdapter(shapeId: string): CapabilityAdapter | null {
    return this.adapters.get(shapeId) ?? null
  }

  registerAdapter(adapter: CapabilityAdapter): void {
    this.adapters.set(adapter.shapeId, adapter)
  }

  async loadAdaptersFromDir(adapterDir: string): Promise<void> {
    const files = await readdir(adapterDir).catch(() => [] as string[])
    for (const file of files) {
      if (!file.endsWith('.adapter.ts')) continue
      const mod = await import(join(adapterDir, file))
      if (mod.default?.shapeId) {
        this.registerAdapter(mod.default as CapabilityAdapter)
      }
    }
  }

  getChildShapes(parentShapeId: string): CapabilityShape[] {
    const children: CapabilityShape[] = []
    for (const shape of this.shapes.values()) {
      if (shape.extendsShape === parentShapeId) {
        children.push(shape)
      }
    }
    return children
  }

  getEffectiveShape(shapeId: string): CapabilityShape {
    const shape = this.shapes.get(shapeId)
    if (!shape) throw new NotFoundError(`Shape ${shapeId} not found`)
    if (!shape.extendsShape) return shape

    const parent = this.getEffectiveShape(shape.extendsShape)
    return {
      ...parent,
      ...shape,
      ...(shape.overrides ?? {}),
      id: shape.id,
    }
  }

  matchShape(domIndicators: DomIndicator[]): { shapeId: string; confidence: number } | null {
    let bestMatch: { shapeId: string; confidence: number } | null = null

    for (const shape of this.shapes.values()) {
      if (shape.id === 'custom') continue
      const confidence = this.computeMatchScore(domIndicators, shape.discoveryHints.domIndicators)
      if (confidence > 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { shapeId: shape.id, confidence }
      }
    }

    return bestMatch
  }

  private computeMatchScore(actual: DomIndicator[], expected: DomIndicator[]): number {
    if (expected.length === 0) return 0
    let matches = 0
    for (const exp of expected) {
      for (const act of actual) {
        if (exp.selector === act.selector || act.selector.includes(exp.selector)) {
          matches++
          break
        }
      }
    }
    return matches / expected.length
  }
}
