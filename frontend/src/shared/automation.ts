/**
 * shared/automation.ts
 * --------------------------------------------------------------------
 * Automation Builder types. Reuses the existing WorkflowEngine
 * (src/engines/workflow-engine.ts) WorkflowNode / WorkflowEdge model.
 *
 * Each automation = a WorkflowDefinition row + a UnifiedCapability (the
 * engine already has registerAsCapability). The builder publishes
 * automation nodes as CanvasDefinition cards so they're editable live
 * (no rebuild — invariant 7).
 *
 * Pre-seeded: 100 core automations in the default automation workspace.
 */

export type AutomationNodeKind =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'transform'
  | 'wait'
  | 'hitl' // human-in-the-loop gate
  | 'output'

export interface AutomationNode {
  id: string
  kind: AutomationNodeKind
  /** Capability slug this node invokes (e.g. cap:document:summarize). */
  capabilityId?: string
  label: string
  /** Input template (placeholders {{trigger.X}} resolved at runtime). */
  inputTemplate?: Record<string, unknown>
  /** Position on the visual DAG canvas. */
  position: { x: number; y: number }
  /** HitlGate id (if kind='hitl'). */
  hitlGateId?: string
}

export interface AutomationEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  /** Optional condition expression for branching. */
  condition?: string
  label?: string
}

export type AutomationStatus = 'draft' | 'published' | 'deprecated' | 'running' | 'paused'

export interface AutomationDefinition {
  id: string
  slug: string
  name: string
  description: string
  workspaceId: string // automation workspace
  nodes: AutomationNode[]
  edges: AutomationEdge[]
  /** Trigger spec (cron / event / webhook / manual). */
  trigger: {
    kind: 'cron' | 'event' | 'webhook' | 'manual' | 'schedule'
    spec?: string // cron expression / event name / webhook path
  }
  status: AutomationStatus
  /** The capability id registered for this automation. */
  capabilityId: string
  /** Execution policy (reuse PolicyRule). */
  policyRuleId?: string
  version: number
  author: 'system' | 'user' | 'agent'
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface AutomationExecution {
  id: string
  automationId: string
  traceId: string
  status: 'pending' | 'running' | 'hitl' | 'completed' | 'failed' | 'cancelled'
  startedAt: number
  completedAt?: number
  /** Per-node execution state. */
  nodeStates: Record<
    string,
    { status: string; startedAt?: number; completedAt?: number; output?: unknown; error?: string }
  >
  /** Final output (if completed). */
  output?: unknown
  error?: string
}
