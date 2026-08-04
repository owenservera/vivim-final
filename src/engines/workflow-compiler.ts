// src/engines/workflow-compiler.ts
// WorkflowCompiler — transforms visual workflow JSON → executable HarnessDAG

import type { HarnessDAG, HarnessNode } from '../schema/harness.js'
import { compileExpression } from './safe-expression.js'
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from './workflow-engine.js'

// ── Types ───────────────────────────────────────────────────────────────

export type ExpressionFn = (vars: Record<string, unknown>) => boolean | unknown

export interface CompiledWorkflow {
  dag: HarnessDAG
  expressions: Map<string, ExpressionFn>
  subWorkflows: Map<string, WorkflowDefinition>
}

export interface CompileError {
  nodeId?: string
  edgeId?: string
  message: string
}

export interface CompileResult {
  ok: boolean
  compiled?: CompiledWorkflow
  errors: CompileError[]
}

// ── Helpers ─────────────────────────────────────────────────────────────

const TRIGGER_MAP: Record<string, string> = {
  manual: 'trigger-manual',
  schedule: 'trigger-schedule',
  webhook: 'trigger-webhook',
  event: 'trigger-event',
  file_change: 'trigger-file',
  cron: 'trigger-cron',
}

const ACTION_MAP: Record<string, string> = {
  navigate: 'action-navigate',
  click: 'action-click',
  type_text: 'action-type',
  select_option: 'action-select',
  screenshot: 'action-screenshot',
  wait_for: 'action-wait',
  extract: 'action-extract',
}

const LOGIC_MAP: Record<string, string> = {
  if: 'logic-if',
  switch: 'logic-switch',
  loop: 'logic-loop',
  parallel: 'logic-parallel',
  gate: 'logic-gate',
  merge: 'logic-merge',
  filter: 'logic-filter',
  delay: 'logic-delay',
  retry: 'logic-retry',
  abort: 'logic-abort',
}

const AI_MAP: Record<string, string> = {
  ask_llm: 'ai-llm',
  classify: 'ai-classify',
  summarize: 'ai-summarize',
  ocr: 'ai-ocr',
  visual_match: 'ai-visual',
  extract_structured: 'ai-extract',
}

const DATA_MAP: Record<string, string> = {
  set_variable: 'data-set',
  transform: 'data-transform',
  aggregate: 'data-aggregate',
  lookup: 'data-lookup',
  json_path: 'data-jsonpath',
}

function nodeCategory(type: string): string {
  const t = TRIGGER_MAP[type]
  if (t) return t
  const a = ACTION_MAP[type]
  if (a) return a
  const l = LOGIC_MAP[type]
  if (l) return l
  const ai = AI_MAP[type]
  if (ai) return ai
  const d = DATA_MAP[type]
  if (d) return d
  return `unknown-${type}`
}

// ── Compiler ────────────────────────────────────────────────────────────

export class WorkflowCompiler {
  compile(def: WorkflowDefinition): CompileResult {
    const errors: CompileError[] = []
    const nodeIds = new Set(def.nodes.map((n) => n.id))
    const expressions = new Map<string, ExpressionFn>()
    const subWorkflows = new Map<string, WorkflowDefinition>()

    for (const edge of def.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push({ edgeId: edge.id, message: `Edge source "${edge.source}" not found` })
      }
      if (!nodeIds.has(edge.target)) {
        errors.push({ edgeId: edge.id, message: `Edge target "${edge.target}" not found` })
      }
      if (edge.condition) {
        expressions.set(`edge:${edge.id}`, compileExpression(edge.condition))
      }
    }

    const cycles = this.detectCycles(def.nodes, def.edges)
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        errors.push({ message: `Cycle detected: ${cycle.join(' → ')}` })
      }
    }

    const nodeExpressions = this.collectNodeExpressions(def.nodes)
    for (const [key, expr] of nodeExpressions) {
      expressions.set(key, compileExpression(expr))
    }

    const subDefs = this.collectSubWorkflows(def.nodes)
    for (const [key, sub] of subDefs) {
      subWorkflows.set(key, sub)
      const subResult = this.compile(sub)
      if (!subResult.ok) {
        for (const err of subResult.errors) {
          errors.push({ nodeId: key, message: `Sub-workflow: ${err.message}` })
        }
      }
    }

    if (errors.length > 0) {
      return { ok: false, errors }
    }

    const dag = this.toHarnessDAG(def)
    return { ok: true, compiled: { dag, expressions, subWorkflows }, errors: [] }
  }

  private detectCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[][] {
    const adj = new Map<string, string[]>()
    for (const n of nodes) adj.set(n.id, [])
    for (const e of edges) adj.get(e.source)?.push(e.target)

    const cycles: string[][] = []
    const visited = new Set<string>()
    const stack = new Set<string>()
    const path: string[] = []

    const dfs = (node: string) => {
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node)
        if (cycleStart >= 0) cycles.push([...path.slice(cycleStart), node])
        return
      }
      if (visited.has(node)) return
      visited.add(node)
      stack.add(node)
      path.push(node)
      for (const next of adj.get(node) ?? []) dfs(next)
      path.pop()
      stack.delete(node)
    }

    for (const n of nodes) dfs(n.id)
    return cycles
  }

  private collectNodeExpressions(nodes: WorkflowNode[]): Map<string, string> {
    const result = new Map<string, string>()
    for (const node of nodes) {
      const cfg = node.config
      if (typeof cfg.condition === 'string') result.set(`node:${node.id}:condition`, cfg.condition)
      if (typeof cfg.filter === 'string') result.set(`node:${node.id}:filter`, cfg.filter)
      if (typeof cfg.predicate === 'string') result.set(`node:${node.id}:predicate`, cfg.predicate)
    }
    return result
  }

  private collectSubWorkflows(nodes: WorkflowNode[]): Map<string, WorkflowDefinition> {
    const result = new Map<string, WorkflowDefinition>()
    for (const node of nodes) {
      const sub = node.config.subWorkflow
      if (sub && typeof sub === 'object' && 'nodes' in (sub as Record<string, unknown>)) {
        result.set(node.id, sub as WorkflowDefinition)
      }
    }
    return result
  }

  private toHarnessDAG(def: WorkflowDefinition): HarnessDAG {
    const nodes: HarnessNode[] = def.nodes.map((n) => ({
      id: n.id,
      moduleName: nodeCategory(n.type),
      input: { ...n.config, category: n.category },
      dependsOn: def.edges.filter((e) => e.target === n.id).map((e) => e.source),
      retryPolicy: { maxRetries: 3, backoffMs: 1000 },
      timeoutMs: 30_000,
    }))

    const edges = def.edges.map((e) => ({ from: e.source, to: e.target }))

    return {
      id: def.id,
      name: def.name,
      nodes,
      edges,
      timeoutMs: 300_000,
    }
  }
}
