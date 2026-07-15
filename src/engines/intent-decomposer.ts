// src/engines/intent-decomposer.ts
// Unit 3.1 — IntentDecomposer engine (template strategy)
//
// Planner that consumes (user goal, conversation context, available capabilities) and
// emits a typed CapabilityDAG whose nodes reference capability SLUGS from
// UnifiedCapabilityRegistry (never raw CDP selectors). The template strategy is the
// first and fastest of three strategies (template -> LLM -> clarification).
//
// Engines depend only on the IntentDecomposerStore contract (see
// src/storage/contracts/intent-template-store.ts) — never an impl.

import { EngineError } from '../errors.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

/** A single node in a decomposed capability graph. References a capability slug. */
export interface CapabilityDagNode {
  id: string
  capabilitySlug: string
  inputMapping: Record<string, unknown>
  outputKey?: string
  dependsOn: string[]
  /** Set when the node's capability slug is not available in the registry (pruned from edges). */
  unavailable?: boolean
}

export interface CapabilityDAG {
  nodes: CapabilityDagNode[]
  edges: Array<{ from: string; to: string }>
  strategy: 'template' | 'llm' | 'clarification'
}

export interface IntentTemplate {
  id: string
  pattern: string
  wildcards: string[]
  dag: CapabilityDAG
}

export interface IntentDecomposerStore {
  listTemplates(): Promise<IntentTemplate[]>
  getTemplate(id: string): Promise<IntentTemplate | null>
}

export interface DecomposeContext {
  conversationId?: string
  availableCapabilities: string[]
  variables?: Record<string, string>
}

/**
 * Template-based intent decomposer. Matches a normalized goal against seeded
 * intent templates and instantiates a CapabilityDAG, substituting wildcards and
 * pruning nodes whose capability slug is unavailable in the registry.
 */
export class IntentDecomposer {
  private templates: IntentTemplate[] = []
  private loaded = false

  constructor(
    private store: IntentDecomposerStore,
    private registry: UnifiedCapabilityRegistry,
  ) {}

  /** Load templates from the store (cache). Call once before decompose(). */
  async load(): Promise<void> {
    this.templates = await this.store.listTemplates()
    // Most-specific (longest) patterns first so e.g. "navigate+extract" wins over
    // a bare "navigate" template that would also match the same goal prefix.
    this.templates.sort((a, b) => b.pattern.length - a.pattern.length)
    this.loaded = true
  }

  /** Template match. Returns null when no template matches (caller falls to 2.2). */
  decompose(goal: string, ctx: DecomposeContext): CapabilityDAG | null {
    if (!this.loaded) {
      throw new EngineError('IntentDecomposer.decompose called before load()')
    }
    if (!goal || goal.trim().length === 0) return null

    for (const tpl of this.templates) {
      let re: RegExp
      try {
        re = new RegExp(tpl.pattern, 'i')
      } catch {
        continue
      }
      const m = re.exec(goal)
      if (!m) continue

      const bindings = this.extractWildcards(tpl, m)
      const merged = { ...(ctx.variables ?? {}), ...bindings }
      return this.instantiate(tpl.dag, merged, ctx.availableCapabilities)
    }
    return null
  }

  private extractWildcards(tpl: IntentTemplate, m: RegExpExecArray): Record<string, string> {
    const out: Record<string, string> = {}
    tpl.wildcards.forEach((name, idx) => {
      // group 1 is the first capture; idx 0 is the whole match
      const val = m[idx + 1]
      if (val !== undefined) out[name] = val
    })
    return out
  }

  private instantiate(
    dag: CapabilityDAG,
    vars: Record<string, string>,
    available: string[],
  ): CapabilityDAG {
    const substitute = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value.replace(/\{(\w+)\}/g, (_, key: string) => {
          const v = vars[key]
          return v !== undefined ? v : `{${key}}`
        })
      }
      if (Array.isArray(value)) return value.map(substitute)
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, substitute(v)]),
        )
      }
      return value
    }

    const nodes: CapabilityDagNode[] = dag.nodes.map((n) => {
      const slugAvailable = available.includes(n.capabilitySlug)
      return {
        ...n,
        inputMapping: substitute(n.inputMapping) as Record<string, unknown>,
        unavailable: !slugAvailable,
      }
    })

    // Drop edges that reference an unavailable node.
    const availableIds = new Set(nodes.filter((n) => !n.unavailable).map((n) => n.id))
    const edges = dag.edges.filter((e) => availableIds.has(e.from) && availableIds.has(e.to))

    return { nodes, edges, strategy: 'template' }
  }
}
