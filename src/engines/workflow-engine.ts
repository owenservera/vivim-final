// src/engines/workflow-engine.ts
// WorkflowEngine — execute visual workflow DAGs with human-in-the-loop

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { CapabilityContext, UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string
  type: string
  category: 'trigger' | 'action' | 'logic' | 'ai' | 'data'
  config: Record<string, unknown>
  position?: { x: number; y: number }
  inputPorts?: Array<{ id: string; name: string; type: string }>
  outputPorts?: Array<{ id: string; name: string; type: string }>
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  condition?: string
  sourcePort?: string
  targetPort?: string
  routingPath?: Array<{ x: number; y: number }>
}

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface NodeExecution {
  id: string
  nodeId: string
  status: 'pending' | 'running' | 'complete' | 'failed' | 'waiting_human'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  startedAt?: number
  completedAt?: number
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'running' | 'complete' | 'failed' | 'cancelled'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  nodeExecutions: NodeExecution[]
  startedAt: number
  completedAt?: number
}

export interface WorkflowStore {
  getWorkflow(id: string): Promise<WorkflowDefinition | null>
  saveWorkflow(def: WorkflowDefinition): Promise<void>
  deleteWorkflow(id: string): Promise<void>
  saveExecution(exec: WorkflowExecution): Promise<void>
  getExecution(id: string): Promise<WorkflowExecution | null>
}

export interface McpClientAdapter {
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class WorkflowEngine {
  private executions = new Map<string, WorkflowExecution>()

  constructor(
    private readonly governor: ChromeGovernor,
    private readonly store: WorkflowStore,
    private readonly eventBus: CapabilityEventBus,
    private readonly mcpClient?: McpClientAdapter,
    private readonly registry?: UnifiedCapabilityRegistry,
  ) {}

  async createWorkflow(def: WorkflowDefinition): Promise<WorkflowDefinition> {
    const workflow = { ...def, id: def.id || newId(), createdAt: Date.now(), updatedAt: Date.now() }
    await this.store.saveWorkflow(workflow)
    return workflow
  }

  async updateWorkflow(
    id: string,
    patch: Partial<WorkflowDefinition>,
  ): Promise<WorkflowDefinition> {
    const existing = await this.store.getWorkflow(id)
    if (!existing) throw new EngineError(`Workflow ${id} not found`)
    const updated = { ...existing, ...patch, id, updatedAt: Date.now() }
    await this.store.saveWorkflow(updated)
    return updated
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.store.deleteWorkflow(id)
  }

  async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
    return this.store.getWorkflow(id)
  }

  async execute(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowExecution> {
    const workflow = await this.store.getWorkflow(workflowId)
    if (!workflow) throw new EngineError(`Workflow ${workflowId} not found`)

    const execution: WorkflowExecution = {
      id: newId(),
      workflowId,
      status: 'running',
      input,
      nodeExecutions: workflow.nodes.map((n) => ({
        id: newId(),
        nodeId: n.id,
        status: 'pending' as const,
      })),
      startedAt: Date.now(),
    }
    this.executions.set(execution.id, execution)
    await this.store.saveExecution(execution)

    this.eventBus.emit({
      type: 'workflow:started',
      data: { executionId: execution.id, workflowId },
    })

    try {
      await this.executeNodes(workflow, execution, input)
      execution.status = 'complete'
      execution.completedAt = Date.now()
    } catch {
      execution.status = 'failed'
      execution.completedAt = Date.now()
    }

    await this.store.saveExecution(execution)
    return execution
  }

  async cancelExecution(executionId: string): Promise<void> {
    const exec = this.executions.get(executionId)
    if (!exec) throw new EngineError(`Execution ${executionId} not found`)
    exec.status = 'cancelled'
    exec.completedAt = Date.now()
    await this.store.saveExecution(exec)
  }

  async replayExecution(
    executionId: string,
    _opts?: { fromNode?: string },
  ): Promise<WorkflowExecution> {
    const prev = await this.store.getExecution(executionId)
    if (!prev) throw new EngineError(`Execution ${executionId} not found`)
    return this.execute(prev.workflowId, prev.input)
  }

  async resolveHumanLoop(
    nodeExecutionId: string,
    decision: 'approve' | 'reject' | 'skip',
    input?: Record<string, unknown>,
  ): Promise<void> {
    for (const exec of this.executions.values()) {
      const ne = exec.nodeExecutions.find((n) => n.id === nodeExecutionId)
      if (ne) {
        ne.status = decision === 'skip' ? 'complete' : decision === 'approve' ? 'running' : 'failed'
        ne.output = input ?? { decision }
        ne.completedAt = Date.now()
        this.eventBus.emit({
          type: 'workflow:human_loop_resolved',
          data: { nodeExecutionId, decision },
        })
        return
      }
    }
  }

  async handleWebhook(webhookId: string, _request: Request): Promise<Response> {
    this.eventBus.emit({
      type: 'workflow:webhook_received',
      data: { webhookId },
    })
    return new Response(JSON.stringify({ ok: true, webhookId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Phase 28.1: Register workflow as a capability
  async registerAsCapability(
    workflow: WorkflowDefinition,
    registry: UnifiedCapabilityRegistry,
  ): Promise<void> {
    // Derive inputSchema from workflow variables
    const inputSchema: {
      type: string
      properties: Record<string, { type: string }>
      required?: string[]
    } = {
      type: 'object',
      properties: {},
    }
    const required: string[] = []

    if (workflow.variables) {
      for (const [key, value] of Object.entries(workflow.variables)) {
        inputSchema.properties[key] = { type: typeof value }
        if (value === undefined) required.push(key)
      }
    }

    if (required.length > 0) {
      inputSchema.required = required
    }

    const cap = {
      id: `cap:workflow:${workflow.id}`,
      slug: `wf_${workflow.name.replace(/\s+/g, '_').toLowerCase()}`,
      name: workflow.name,
      description: workflow.description ?? `Execute workflow: ${workflow.name}`,
      category: 'workflow',
      surfaces: ['cli', 'ui', 'api', 'mcp', 'workflow'] as (
        | 'cli'
        | 'ui'
        | 'workflow'
        | 'mcp'
        | 'api'
      )[],
      inputSchema,
      outputSchema: { type: 'object' },
      handler: async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        return this.execute(workflow.id, input)
      },
      isAsync: true,
      requiresConfirmation: false,
      tags: ['workflow'],
      workflowNodeType: 'workflow-root' as const,
    }

    registry.register(cap)
  }

  // Phase 28.1: Unregister workflow capability
  async unregisterCapability(
    workflowId: string,
    registry: UnifiedCapabilityRegistry,
  ): Promise<void> {
    registry.unregister?.(`cap:workflow:${workflowId}`)
  }

  private async executeNodes(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    input?: Record<string, unknown>,
  ): Promise<void> {
    const _nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]))
    const completed = new Set<string>()
    let variables = { ...workflow.variables, ...input }

    while (completed.size < workflow.nodes.length) {
      const ready = workflow.nodes.filter((n) => {
        if (completed.has(n.id)) return false
        const incoming = workflow.edges.filter((e) => e.target === n.id)
        return incoming.every((e) => completed.has(e.source))
      })

      if (ready.length === 0) break

      for (const node of ready) {
        const nodeExec = execution.nodeExecutions.find((ne) => ne.nodeId === node.id)
        if (!nodeExec) continue

        nodeExec.status = 'running'
        nodeExec.input = variables
        nodeExec.startedAt = Date.now()

        try {
          const result = await this.executeNode(node, variables, execution.id)
          if (result === null) {
            nodeExec.status = 'waiting_human'
            this.eventBus.emit({
              type: 'workflow:human_loop_pending',
              data: { nodeExecutionId: nodeExec.id, nodeId: node.id },
            })
            return
          }
          nodeExec.output = result as Record<string, unknown>
          nodeExec.status = 'complete'
          nodeExec.completedAt = Date.now()
          variables = { ...variables, ...(result as Record<string, unknown>) }
        } catch (err) {
          nodeExec.status = 'failed'
          nodeExec.error = err instanceof Error ? err.message : String(err)
          nodeExec.completedAt = Date.now()
          throw err
        }

        completed.add(node.id)
      }
    }

    execution.output = variables
  }

  private async executeNode(
    node: WorkflowNode,
    variables: Record<string, unknown>,
    executionId: string,
  ): Promise<Record<string, unknown> | null> {
    // New node types from 18.3
    if (node.type === 'capability_call') {
      return this.executeCapabilityCall(node, variables)
    }
    if (node.type === 'cli_command') {
      return this.executeCliCommand(node, variables)
    }
    if (node.type === 'plugin_call') {
      return this.executePluginCall(node, variables)
    }

    switch (node.category) {
      case 'trigger':
        return this.executeTrigger(node, variables)
      case 'action':
        return this.executeAction(node, variables)
      case 'logic':
        return this.executeLogic(node, variables)
      case 'ai':
        return this.executeAI(node, variables, executionId)
      case 'data':
        return this.executeData(node, variables)
      default:
        return {}
    }
  }

  private async executeTrigger(
    _node: WorkflowNode,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return { triggerFired: true, ...variables }
  }

  private async executeAction(
    node: WorkflowNode,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const action = node.config.action as string
    if (action === 'navigate' && node.config.url) {
      const slave = await this.governor.ensureRunning('default')
      await this.governor.cdp.send(slave.slaveId, 'Page.navigate', {
        url: this.interpolate(node.config.url as string, variables),
      })
      return { navigated: true }
    }
    if (action === 'click' && node.config.selector) {
      const slave = await this.governor.ensureRunning('default')
      await this.governor.cdp.send(slave.slaveId, 'Runtime.evaluate', {
        expression: `document.querySelector('${node.config.selector}')?.click()`,
      })
      return { clicked: true }
    }
    if (action === 'type' && node.config.selector && node.config.text) {
      const slave = await this.governor.ensureRunning('default')
      await this.governor.cdp.send(slave.slaveId, 'Runtime.evaluate', {
        expression: `document.querySelector('${node.config.selector}').value = '${this.interpolate(node.config.text as string, variables)}'`,
      })
      return { typed: true }
    }
    return { actionExecuted: action }
  }

  private executeLogic(
    node: WorkflowNode,
    variables: Record<string, unknown>,
  ): Record<string, unknown> {
    if (node.type === 'condition') {
      const expr = node.config.expression as string
      const result = this.evaluateExpression(expr, variables)
      return { conditionResult: result }
    }
    if (node.type === 'delay') {
      const ms = (node.config.ms as number) ?? 1000
      return { delayed: ms }
    }
    return {}
  }

  private async executeAI(
    node: WorkflowNode,
    variables: Record<string, unknown>,
    _executionId: string,
  ): Promise<Record<string, unknown> | null> {
    if (node.type === 'human_loop') {
      return null
    }
    if (node.type === 'llm_call' && this.mcpClient) {
      const prompt = this.interpolate((node.config.prompt as string) ?? '', variables)
      const result = await this.mcpClient.callTool('llm', { prompt })
      return { llmResult: result }
    }
    return {}
  }

  private executeData(
    node: WorkflowNode,
    variables: Record<string, unknown>,
  ): Record<string, unknown> {
    if (node.type === 'set_variable') {
      return { [node.config.key as string]: node.config.value }
    }
    if (node.type === 'transform') {
      return variables
    }
    return {}
  }

  // ── 18.3: New node types ─────────────────────────────────────────────

  private async executeCapabilityCall(
    node: WorkflowNode,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!this.registry) {
      throw new EngineError('capability_call requires UnifiedCapabilityRegistry')
    }
    const capId = node.config.capabilityId as string
    const input = (node.config.input as Record<string, unknown>) ?? {}
    const resolvedInput = this.resolveVariables(input, variables)
    const ctx: CapabilityContext = {
      metadata: { executionId: node.id, workflow: true },
    }
    const result = await this.registry.execute(capId, resolvedInput, ctx)
    return { capabilityResult: result }
  }

  private async executeCliCommand(
    node: WorkflowNode,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const command = node.config.command as string
    const args = (node.config.args as Record<string, unknown>) ?? {}
    const resolvedArgs = this.resolveVariables(args, variables)
    // CLI commands are executed via the registry if available
    if (this.registry) {
      const cap = this.registry.list({ surface: 'cli' }).find((c) => c.cliCommand?.name === command)
      if (cap) {
        const ctx: CapabilityContext = { metadata: { executionId: node.id, workflow: true } }
        const result = await this.registry.execute(cap.id, resolvedArgs, ctx)
        return { cliResult: result }
      }
    }
    return { cliCommand: command, args: resolvedArgs, executed: true }
  }

  private async executePluginCall(
    node: WorkflowNode,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const pluginId = node.config.pluginId as string
    const method = node.config.method as string
    const args = (node.config.args as Record<string, unknown>) ?? {}
    const resolvedArgs = this.resolveVariables(args, variables)
    // Plugin calls go through MCP if available
    if (this.mcpClient) {
      const result = await this.mcpClient.callTool(`${pluginId}.${method}`, resolvedArgs)
      return { pluginResult: result }
    }
    return { pluginId, method, args: resolvedArgs, executed: true }
  }

  private resolveVariables(
    obj: Record<string, unknown>,
    variables: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const varName = value.slice(2, -2)
        result[key] = variables[varName] ?? value
      } else {
        result[key] = value
      }
    }
    return result
  }

  private interpolate(template: string, vars: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`))
  }

  private evaluateExpression(expr: string, vars: Record<string, unknown>): boolean {
    try {
      // Trusted: `expr` is an author-defined workflow DSL condition. Evaluated
      // intentionally; sandbox if definitions become externally sourced.
      const fn = new Function(...Object.keys(vars), `return ${expr}`)
      return Boolean(fn(...Object.values(vars)))
    } catch {
      return false
    }
  }
}
