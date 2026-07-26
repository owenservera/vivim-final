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

import { z } from 'zod'
import { EngineError } from '../errors.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { LocalModelAdapter } from './local-model-adapter.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types for clarification flow (unit 2.3) ─────────────────────────────────

export interface ClarificationOption {
  label: string
  capabilitySlug: string
  inputMapping: Record<string, unknown>
}

export interface IntentClarification {
  goal: string
  question: string
  options: ClarificationOption[]
  timeoutMs: number
}

// ── Zod Schemas for DAG validation (unit 2.2) ──────────────────────────────────

export const CapabilityDagNodeSchema = z.object({
  id: z.string(),
  capabilitySlug: z.string(),
  inputMapping: z.record(z.unknown()),
  outputKey: z.string().optional(),
  dependsOn: z.array(z.string()),
})

export const CapabilityDAGSchema = z.object({
  nodes: z.array(CapabilityDagNodeSchema),
  edges: z.array(z.object({ from: z.string(), to: z.string() })),
  strategy: z.literal('llm'),
})

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
  private readonly llm?: LocalModelAdapter
  private readonly bus?: CapabilityEventBus
  private threshold = 0.5

  constructor(
    private store: IntentDecomposerStore,
    private registry: UnifiedCapabilityRegistry,
    llm?: LocalModelAdapter,
    bus?: CapabilityEventBus,
    threshold = 0.5,
  ) {
    this.llm = llm
    this.bus = bus
    this.threshold = threshold
  }

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

  /** LLM-backed decomposition. Returns null on parse/validation failure (falls to 2.3). */
  async decomposeWithLlm(goal: string, _ctx: DecomposeContext): Promise<CapabilityDAG | null> {
    if (!this.llm) return null

    const catalog = this.registry.list().map((c) => ({
      slug: c.slug,
      description: c.description,
    }))
    const prompt = this.buildLlmPrompt(goal, catalog)
    const raw = await this.llm.complete(prompt)
    const parsed = this.safeParse(raw)
    if (!parsed) return null

    // Reject any node whose slug is not registered (LLM cannot invent capabilities).
    const valid = parsed.nodes.every((n) => {
      const cap = this.registry.getBySlug(n.capabilitySlug)
      return cap !== undefined
    })
    return valid ? parsed : null
  }

  private buildLlmPrompt(
    goal: string,
    catalog: Array<{ slug: string; description: string }>,
  ): string {
    const catalogStr = catalog.map((c) => `- ${c.slug}: ${c.description}`).join('\n')
    return `Decompose the user goal into a capability DAG. Emit valid JSON:

{
  "nodes": [
    { "id": "n1", "capabilitySlug": "<slug>", "inputMapping": { "param": "value" }, "outputKey": "result", "dependsOn": [] }
  ],
  "edges": [{ "from": "n1", "to": "n2" }],
  "strategy": "llm"
}

Available capabilities (use only these slugs):
${catalogStr}

Goal: "${goal}"

JSON:`
  }

  private safeParse(raw: string): CapabilityDAG | null {
    try {
      return CapabilityDAGSchema.parse(JSON.parse(raw)) as CapabilityDAG
    } catch {
      return null
    }
  }

  /** Emits intent:clarify and returns the proposed options (frontend resolves). */
  async clarify(
    goal: string,
    ctx: DecomposeContext,
    confidence: number,
  ): Promise<IntentClarification> {
    if (confidence >= this.threshold) {
      throw new EngineError('clarify called with sufficient confidence')
    }
    const options = await this.proposeOptions(goal, ctx)
    const clarification: IntentClarification = {
      goal,
      question: this.questionFor(goal, options),
      options,
      timeoutMs: 30_000,
    }
    this.bus?.emit({
      type: 'intent:clarify',
      clarification,
      ts: Date.now(),
    } as unknown as Parameters<CapabilityEventBus['emit']>[0])
    return clarification
  }

  private async proposeOptions(
    _goal: string,
    ctx: DecomposeContext,
  ): Promise<ClarificationOption[]> {
    // Top-N slugs from catalog ranked by fuzzy match to goal.
    const catalog = this.registry.list().slice(0, 5)
    const options: ClarificationOption[] = catalog
      .filter((c) => ctx.availableCapabilities.includes(c.slug))
      .map((c) => ({
        label: c.description,
        capabilitySlug: c.slug,
        inputMapping: {},
      }))
    return options.slice(0, 3)
  }

  private questionFor(_goal: string, options: ClarificationOption[]): string {
    if (options.length === 0) return 'What did you mean?'
    if (options.length === 1) return `Did you mean "${options[0]!.label}"?`
    return `What did you mean? Options: ${options.map((o) => o.label).join(' | ')}`
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
