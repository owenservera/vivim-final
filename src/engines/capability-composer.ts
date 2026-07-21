// src/engines/capability-composer.ts
// CapabilityComposer — recursive composition + versioning (Unit 2.5).
// A composite DAG is a set of nodes (each referencing a capability slug) wired
// by edges. Execution resolves nodes in topological order; a node whose slug is
// itself a composite delegates recursively to execute(). `revise()` bumps the
// composite's version and snapshots the prior DAG via VersionManager.

import { EngineError } from '../errors.js'
import type {
  CapabilityContext,
  CapabilitySurface,
  UnifiedCapability,
  UnifiedCapabilityRegistry,
} from './unified-registry.js'
import type { VersionManager } from './version-manager.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompositeNode {
  id: string
  capabilitySlug: string
  inputMapping: Record<string, string>
  outputKey?: string
  dependsOn?: string[]
}

export interface CompositeEdge {
  from: string
  to: string
}

export interface CompositeCapability {
  id: string
  slug: string
  name: string
  description: string
  version: number
  nodes: CompositeNode[]
  edges: CompositeEdge[]
  createdAt: number
  updatedAt: number
}

export interface CompositeCapabilityStore {
  get(compositeId: string): Promise<CompositeCapability | null>
  list(): Promise<CompositeCapability[]>
  create(
    input: Omit<CompositeCapability, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CompositeCapability>
  update(compositeId: string, patch: Partial<CompositeCapability>): Promise<CompositeCapability>
  delete(compositeId: string): Promise<void>
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class CapabilityComposer {
  constructor(
    private store: CompositeCapabilityStore,
    private registry: UnifiedCapabilityRegistry,
    private versions: VersionManager,
  ) {}

  /** Topologically order nodes using their edge-defined dependencies. */
  private topoSort(nodes: CompositeNode[], edges: CompositeEdge[]): CompositeNode[] {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const deps = new Map<string, string[]>()
    for (const n of nodes) deps.set(n.id, n.dependsOn ? [...n.dependsOn] : [])
    for (const e of edges) {
      const list = deps.get(e.to)
      if (list && !list.includes(e.from)) list.push(e.from)
    }

    const order: CompositeNode[] = []
    const visiting = new Set<string>()
    const visited = new Set<string>()

    const visit = (id: string): void => {
      if (visited.has(id)) return
      if (visiting.has(id)) {
        throw new EngineError(`Cycle detected in composite DAG at node ${id}`)
      }
      const node = byId.get(id)
      if (!node) throw new EngineError(`Composite node not found: ${id}`)
      visiting.add(id)
      for (const dep of deps.get(id) ?? []) visit(dep)
      visiting.delete(id)
      visited.add(id)
      order.push(node)
    }

    for (const n of nodes) visit(n.id)
    return order
  }

  /** Bind a node's inputs from prior outputs + shared input. */
  private bindInputs(
    mapping: Record<string, string>,
    outputs: Map<string, unknown>,
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}
    for (const [key, source] of Object.entries(mapping)) {
      if (outputs.has(source)) resolved[key] = outputs.get(source)
      else if (source in input) resolved[key] = input[source]
    }
    return resolved
  }

  /**
   * Recursively resolve a composite. A node whose slug is a composite delegates
   * to execute(); infinite recursion (direct or transitive) throws before
   * execution via the active `path` set, which tracks the current call stack.
   */
  async execute(
    compositeId: string,
    input: Record<string, unknown>,
    ctx: CapabilityContext,
    path: Set<string> = new Set(),
  ): Promise<unknown> {
    if (path.has(compositeId)) {
      throw new EngineError(`Infinite recursion detected: ${compositeId} referenced transitively`)
    }
    path.add(compositeId)

    try {
      const c = await this.store.get(compositeId)
      if (!c) throw new EngineError(`Composite not found: ${compositeId}`)

      const order = this.topoSort(c.nodes, c.edges)
      const outputs = new Map<string, unknown>()

      for (const node of order) {
        const resolved = this.bindInputs(node.inputMapping, outputs, input)
        const target = this.registry.getBySlug(node.capabilitySlug)
        if (!target) throw new EngineError(`Unknown capability slug: ${node.capabilitySlug}`)

        // Recursive: if the resolved capability is itself a composite, delegate.
        const result =
          target.isComposite && target.compositeId
            ? await this.execute(target.compositeId, resolved, ctx, path)
            : await this.registry.execute(target.id, resolved, ctx)

        if (node.outputKey) outputs.set(node.outputKey, result)
      }

      return outputs.get('__result__') ?? null
    } finally {
      path.delete(compositeId)
    }
  }

  /** Bump version + snapshot the prior DAG via VersionManager. */
  async revise(
    compositeId: string,
    next: Omit<CompositeCapability, 'id' | 'version'>,
  ): Promise<CompositeCapability> {
    const current = await this.store.get(compositeId)
    if (!current) throw new EngineError(`Composite not found: ${compositeId}`)

    const snapshotId = await this.versions.snapshotCapability(
      compositeId,
      { nodes: current.nodes, edges: current.edges },
      'composer',
    )
    if (!snapshotId) throw new EngineError(`Failed to snapshot composite ${compositeId}`)

    return this.store.update(compositeId, { ...next, version: current.version + 1 })
  }

  /** Register a composite AND export it to all five surfaces via the registry. */
  async registerComposite(
    input: Omit<CompositeCapability, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CompositeCapability> {
    // Register-time cycle detection (unit 2.4).
    this.assertAcyclic(input.nodes, input.edges)
    const created = await this.store.create(input)
    this.registry.register(this.toUnifiedCapability(created))
    return created
  }

  /** Detect cycles before registration. Throws EngineError on cycle. */
  private assertAcyclic(nodes: CompositeNode[], edges: CompositeEdge[]): void {
    // topoSort throws on cycle; we just call it without capturing the order.
    this.topoSort(nodes, edges)
  }

  /** Build the UnifiedCapability for a composite, auto-filling all five surfaces. */
  private toUnifiedCapability(c: CompositeCapability): UnifiedCapability {
    const surfaces: CapabilitySurface[] = ['cli', 'ui', 'workflow', 'mcp', 'api']
    return {
      id: `composite:${c.id}`,
      slug: c.slug,
      name: c.name,
      description: c.description,
      category: 'composite',
      surfaces,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object' },
      handler: (input, ctx) => this.execute(c.id, input, ctx),
      cliCommand: { name: `composite ${c.slug}`, aliases: [], examples: [] },
      uiAction: { component: 'composite-run', position: 'palette', order: 0 },
      workflowNodeType: `composite:${c.slug}`,
      mcpToolName: c.slug,
      apiEndpoint: { method: 'POST', path: `/api/composite/${c.slug}` },
      isAsync: true,
      requiresConfirmation: false,
      tags: ['composite'],
      isComposite: true,
      compositeId: c.id,
    }
  }

  async define(
    input: Omit<CompositeCapability, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CompositeCapability> {
    return this.store.create(input)
  }

  async list(): Promise<CompositeCapability[]> {
    return this.store.list()
  }

  async get(compositeId: string): Promise<CompositeCapability | null> {
    return this.store.get(compositeId)
  }

  async remove(compositeId: string): Promise<void> {
    await this.store.delete(compositeId)
    this.registry.unregister(`composite:${compositeId}`)
  }
}
