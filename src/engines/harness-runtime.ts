// src/engines/harness-runtime.ts
// HarnessRuntime — server-side capability DAG executor.
// Executes multi-step capability DAGs by sending atomic CDP commands through the
// Governor's CDPProxy. Never blocks Chrome's event loop. Modules are composable
// server-side functions registered by capability slug.

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
  type: 'selector_exists' | 'url_matches' | 'text_contains' | 'variable'
  value: string
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

    const context: HarnessContext = this.governor && this.slaveId
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
        // For now, preconditions are ignored — full implementation in Phase 9
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
    const gov = this.governor!
    return {
      query: async (selector: string) => {
        const result = await gov.cdp.send(slaveId, 'DOM.querySelector', { selector }) as { nodeId: number } | null
        if (!result?.nodeId) return null
        const desc = await gov.cdp.send(slaveId, 'DOM.describeNode', { nodeId: result.nodeId }) as Record<string, unknown> | undefined
        return this.nodeToElement(desc)
      },
      queryAll: async (selector: string) => {
        const result = await gov.cdp.send(slaveId, 'DOM.querySelectorAll', { selector }) as { nodeIds: number[] } | null
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

  private async evaluateCondition(cond: HarnessCondition, _ctx: HarnessContext): Promise<boolean> {
    // Stub: real implementation in Phase 9
    return cond.type === 'selector_exists'
  }
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
