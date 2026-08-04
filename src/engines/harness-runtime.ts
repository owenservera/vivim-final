// src/engines/harness-runtime.ts
// HarnessRuntime — server-side capability DAG executor.
// Executes multi-step capability DAGs by sending atomic CDP commands through the
// Governor's CDPProxy. Never blocks Chrome's event loop. Modules are composable
// server-side functions registered by capability slug.

import { EngineError } from '../errors.js'
import type { CapabilityEvent, CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor } from './chrome-governor.js'

// ── Harness Types ───────────────────────────────────────────────────────────

export type HarnessNode =
  | { type: 'sequence'; steps: HarnessNode[] }
  | { type: 'branch'; condition: HarnessCondition; then: HarnessNode; alternative?: HarnessNode }
  | { type: 'parallel'; steps: HarnessNode[] }
  | { type: 'retry'; maxRetries: number; backoffMs: number; step: HarnessNode }
  | { type: 'precondition'; checks: string[]; step: HarnessNode }
  | { type: 'step'; moduleId: string; input: Record<string, unknown>; outputKey: string }

export interface HarnessCondition {
  type:
    | 'selector_exists'
    | 'element_visible'
    | 'element_contains_text'
    | 'page_url_matches'
    | 'page_title_contains'
    | 'element_count_gt'
    | 'element_has_class'
    | 'url_matches'
    | 'text_contains'
    | 'variable'
  value: string
  /** CSS selector for element-based conditions */
  selector?: string
  /** Expected count for element_count_gt */
  expectedCount?: number
  /** Class name for element_has_class */
  className?: string
}

export interface HarnessContext {
  query(selector: string): Promise<Element | null>
  queryAll(selector: string): Promise<Element[]>
  waitFor(selector: string, timeoutMs?: number): Promise<Element | null>
  getPageState(): Promise<{ url: string; title: string; readyState: string }>
  intercept(pattern: RegExp): Promise<string>
  emitTelemetry(event: HarnessTelemetryEvent): void
}

export interface HarnessModuleResult {
  ok: boolean
  output: Record<string, unknown>
  domState?: Record<string, unknown>
  error?: string
}

export interface HarnessTelemetryEvent {
  type: 'selector_hit' | 'selector_miss' | 'dom_interaction' | 'network_intercept' | 'error'
  moduleId: string
  data: Record<string, unknown>
  ts: number
}

export interface HarnessProgressEvent {
  step: number
  total: number
  description: string
  moduleId: string
  slaveId: string
}

export interface Element {
  tagName: string
  text: string
  attributes: Record<string, string>
  boundingBox?: { x: number; y: number; width: number; height: number }
}

// ── Module Registry ──────────────────────────────────────────────────────────

export class HarnessRuntime {
  private modules: Map<string, HarnessModule> = new Map()
  private eventBus?: CapabilityEventBus

  constructor(
    eventBus?: CapabilityEventBus,
    private governor?: ChromeGovernor,
    private slaveId?: string,
  ) {
    this.eventBus = eventBus
  }

  register(module: HarnessModule): void {
    this.modules.set(module.name, module)
  }

  async execute(dag: HarnessDAG): Promise<HarnessResult> {
    const telemetry: HarnessTelemetryEvent[] = []
    let stepsCompleted = 0

    const context: HarnessContext =
      this.governor && this.slaveId
        ? this.createRealContext(this.slaveId, telemetry)
        : this.createStubContext(telemetry)

    const {
      outputs,
      stepsCompleted: nodeSteps,
      error,
    } = await this.executeNode({ type: 'sequence', steps: dag.steps }, context, 1, 1)
    stepsCompleted = nodeSteps

    if (this.eventBus) {
      this.eventBus.emit({
        type: 'capability:progress',
        step: stepsCompleted,
        total: 1,
        description: error ? error : 'completed',
        moduleId: '',
        slaveId: '',
      } as CapabilityEvent)
    }

    return {
      ok: !error,
      outputs,
      progress: [
        { step: 1, total: 1, description: error ? error : 'done', moduleId: '', slaveId: '' },
      ],
      telemetry,
      stepsCompleted,
      error,
    }
  }

  private async executeNode(
    node: HarnessNode,
    ctx: HarnessContext,
    _currentStep: number,
    _total: number,
  ): Promise<{ outputs: Record<string, unknown>; stepsCompleted: number; error?: string }> {
    switch (node.type) {
      case 'sequence': {
        const outputs: Record<string, unknown> = {}
        let stepsCompleted = 0
        for (const child of node.steps) {
          const res = await this.executeNode(child, ctx, stepsCompleted + 1, node.steps.length)
          if (res.error) return { outputs, stepsCompleted, error: res.error }
          Object.assign(outputs, res.outputs)
          stepsCompleted += res.stepsCompleted
        }
        return { outputs, stepsCompleted }
      }

      case 'step': {
        const module = this.modules.get(node.moduleId)
        if (!module) {
          return { outputs: {}, stepsCompleted: 1, error: `Module not found: ${node.moduleId}` }
        }
        try {
          const result = await module.execute(node.input, ctx)
          return { outputs: { [node.outputKey]: result.output }, stepsCompleted: 1 }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return { outputs: {}, stepsCompleted: 1, error: msg }
        }
      }

      case 'parallel': {
        const results = await Promise.all(
          node.steps.map((s) => this.executeNode(s, ctx, 1, node.steps.length)),
        )
        const outputs: Record<string, unknown> = {}
        let stepsCompleted = 0
        for (const r of results) {
          if (r.error) return { outputs, stepsCompleted, error: r.error }
          Object.assign(outputs, r.outputs)
          stepsCompleted += r.stepsCompleted
        }
        return { outputs, stepsCompleted }
      }

      case 'branch': {
        const condOk = await this.evaluateCondition(node.condition, ctx)
        const chosen = condOk ? node.then : node.alternative
        if (!chosen) return { outputs: {}, stepsCompleted: 0 }
        return this.executeNode(chosen, ctx, 1, 1)
      }

      case 'retry': {
        let attempts = 0
        let lastError: string | undefined
        while (attempts <= node.maxRetries) {
          const res = await this.executeNode(node.step, ctx, 1, 1)
          if (!res.error) return res
          lastError = res.error
          if (attempts < node.maxRetries) {
            await new Promise((r) => setTimeout(r, node.backoffMs))
          }
          attempts++
        }
        return { outputs: {}, stepsCompleted: attempts, error: lastError }
      }

      case 'precondition': {
        const allMet = await evaluatePreconditions(node.checks, ctx)
        if (!allMet) {
          ctx.emitTelemetry({
            type: 'selector_miss',
            moduleId: 'precondition',
            data: { checks: node.checks, result: 'skipped' },
            ts: Date.now(),
          })
          return { outputs: {}, stepsCompleted: 0 }
        }
        return this.executeNode(node.step, ctx, 1, 1)
      }
    }
  }

  private createStubContext(telemetry: HarnessTelemetryEvent[]): HarnessContext {
    return {
      query: async () => null,
      queryAll: async () => [],
      waitFor: async () => null,
      getPageState: async () => ({ url: '', title: '', readyState: '' }),
      intercept: async () => '',
      emitTelemetry: (e) => telemetry.push(e),
    }
  }

  private createRealContext(slaveId: string, telemetry: HarnessTelemetryEvent[]): HarnessContext {
    if (!this.governor) {
      throw new EngineError('Governor required for real context')
    }
    const gov = this.governor
    return {
      query: async (selector: string) => {
        const result = (await gov.cdp.send(slaveId, 'DOM.querySelector', { selector })) as {
          nodeId: number
        } | null
        if (!result?.nodeId) return null
        const desc = (await gov.cdp.send(slaveId, 'DOM.describeNode', { nodeId: result.nodeId })) as
          | Record<string, unknown>
          | undefined
        return this.nodeToElement(desc)
      },
      queryAll: async (selector: string) => {
        const result = (await gov.cdp.send(slaveId, 'DOM.querySelectorAll', { selector })) as {
          nodeIds: number[]
        } | null
        if (!result?.nodeIds) return []
        return Promise.all(
          result.nodeIds.map((id) =>
            gov.cdp
              .send(slaveId, 'DOM.describeNode', { nodeId: id })
              .then((d) => this.nodeToElement(d as Record<string, unknown> | undefined)),
          ),
        )
      },
      waitFor: async (selector: string, timeoutMs = 10_000) => {
        const deadline = Date.now() + timeoutMs
        while (Date.now() < deadline) {
          const el = await this.createRealContext(slaveId, telemetry).query(selector)
          if (el) return el
          await new Promise((r) => setTimeout(r, 200))
        }
        return null
      },
      getPageState: async () => {
        const state = await gov.cdp.getPageState(slaveId)
        return { url: state.url, title: state.title, readyState: state.readyState }
      },
      intercept: async (pattern: RegExp) => {
        const result = await gov.cdp.capture(slaveId, pattern, 30_000)
        return result.body
      },
      emitTelemetry: (e) => telemetry.push(e),
    }
  }

  private nodeToElement(desc: Record<string, unknown> | undefined): Element {
    if (!desc) return { tagName: '', text: '', attributes: {} }
    const node = desc.node as Record<string, unknown> | undefined
    return {
      tagName: String(node?.nodeName ?? '').toLowerCase(),
      text: String(node?.nodeValue ?? ''),
      attributes: (node?.attributes as Record<string, string>) ?? {},
    }
  }

  private async evaluateCondition(cond: HarnessCondition, ctx: HarnessContext): Promise<boolean> {
    return evaluateConditionImpl(cond, ctx)
  }
}

// ── Condition Evaluation Implementation ──────────────────────────────────

export async function evaluateConditionImpl(
  cond: HarnessCondition,
  ctx: HarnessContext,
): Promise<boolean> {
  switch (cond.type) {
    case 'selector_exists': {
      const el = await ctx.query(cond.value)
      return el !== null
    }

    case 'element_visible': {
      const el = await ctx.query(cond.value)
      if (!el) return false
      if (el.boundingBox) {
        return el.boundingBox.width > 0 && el.boundingBox.height > 0
      }
      return true
    }

    case 'element_contains_text': {
      const condExt = cond as HarnessCondition & { selector?: string }
      const selector = condExt.selector ?? cond.value
      const el = await ctx.query(selector)
      if (!el) return false
      const textToFind = condExt.selector ? cond.value : cond.value
      return el.text.toLowerCase().includes(textToFind.toLowerCase())
    }

    case 'page_url_matches':
    case 'url_matches': {
      const state = await ctx.getPageState()
      const url = state.url
      try {
        const regex = new RegExp(cond.value)
        return regex.test(url)
      } catch {
        return url.includes(cond.value)
      }
    }

    case 'page_title_contains': {
      const state = await ctx.getPageState()
      return state.title.toLowerCase().includes(cond.value.toLowerCase())
    }

    case 'element_count_gt': {
      const condExt = cond as HarnessCondition & {
        selector?: string
        expectedCount?: number
      }
      const selector = condExt.selector ?? cond.value
      const elements = await ctx.queryAll(selector)
      const threshold = condExt.expectedCount ?? parseInt(cond.value, 10)
      return elements.length > threshold
    }

    case 'element_has_class': {
      const condExt = cond as HarnessCondition & {
        selector?: string
        className?: string
      }
      const selector = condExt.selector ?? cond.value
      const el = await ctx.query(selector)
      if (!el) return false
      const className = condExt.className ?? cond.value
      const classAttr = el.attributes['class'] ?? ''
      return classAttr.split(/\s+/).includes(className)
    }

    case 'variable': {
      return cond.value.trim().length > 0 && cond.value.trim() !== 'false'
    }

    case 'text_contains': {
      const state = await ctx.getPageState()
      return state.title.toLowerCase().includes(cond.value.toLowerCase())
    }

    default: {
      return false
    }
  }
}

// ── Precondition Evaluation ──────────────────────────────────────────────

/**
 * Evaluates a set of precondition checks.
 * Each check string is a condition expression in one of these formats:
 *   - "selector_exists:css-selector"
 *   - "element_visible:css-selector"
 *   - "page_url_matches:pattern"
 *   - "page_title_contains:text"
 *   - "element_contains_text:selector:text"
 *   - "element_count_gt:selector:count"
 *   - "element_has_class:selector:className"
 */
export async function evaluatePreconditions(
  checks: string[],
  ctx: HarnessContext,
): Promise<boolean> {
  for (const check of checks) {
    const colonIndex = check.indexOf(':')
    if (colonIndex === -1) {
      return false
    }

    const type = check.slice(0, colonIndex)
    const value = check.slice(colonIndex + 1)

    let cond: HarnessCondition

    switch (type) {
      case 'selector_exists':
        cond = { type: 'selector_exists', value }
        break
      case 'element_visible':
        cond = { type: 'element_visible', value }
        break
      case 'page_url_matches':
        cond = { type: 'page_url_matches', value }
        break
      case 'page_title_contains':
        cond = { type: 'page_title_contains', value }
        break
      case 'element_contains_text': {
        const secondColon = value.indexOf(':')
        if (secondColon === -1) {
          cond = { type: 'element_contains_text', value }
        } else {
          cond = {
            type: 'element_contains_text',
            value: value.slice(secondColon + 1),
            selector: value.slice(0, secondColon),
          } as HarnessCondition & { selector: string }
        }
        break
      }
      case 'element_count_gt': {
        const secondColon = value.indexOf(':')
        if (secondColon === -1) {
          cond = { type: 'element_count_gt', value }
        } else {
          cond = {
            type: 'element_count_gt',
            value,
            selector: value.slice(0, secondColon),
            expectedCount: parseInt(value.slice(secondColon + 1), 10),
          } as HarnessCondition & { selector: string; expectedCount: number }
        }
        break
      }
      case 'element_has_class': {
        const secondColon = value.indexOf(':')
        if (secondColon === -1) {
          cond = { type: 'element_has_class', value }
        } else {
          cond = {
            type: 'element_has_class',
            value,
            selector: value.slice(0, secondColon),
            className: value.slice(secondColon + 1),
          } as HarnessCondition & { selector: string; className: string }
        }
        break
      }
      default:
        return false
    }

    const result = await evaluateConditionImpl(cond, ctx)
    if (!result) {
      return false
    }
  }

  return true
}

export interface HarnessModule {
  name: string
  version: number
  inputSchema: unknown
  outputSchema: unknown
  preconditions: string[]
  postconditions: string[]
  execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult>
}

export interface HarnessDAG {
  steps: HarnessNode[]
}

export interface HarnessResult {
  ok: boolean
  outputs: Record<string, unknown>
  progress: HarnessProgressEvent[]
  telemetry: HarnessTelemetryEvent[]
  stepsCompleted: number
  error?: string
}
