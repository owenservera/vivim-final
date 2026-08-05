/**
 * shared/agent.ts
 * --------------------------------------------------------------------
 * Agents Builder types. Compose AutonomousTask / AutonomousStep /
 * HitlGate (prisma/schema.prisma L19) into reusable agent definitions
 * via the same visual DAG + card model.
 *
 * Agents are UnifiedCapability instances; an agent card on the canvas
 * can be invoked, observed (AgentStep / AgentLoopRun tables), and
 * hot-edited. Reuses the existing PolicyRule / HitlGate tables for
 * guardrails.
 */

export type AgentStepKind =
  | 'perceive' // observe context / canvas state
  | 'think' // LLM reasoning
  | 'act' // invoke a capability
  | 'reflect' // evaluate result
  | 'hitl' // human-in-the-loop gate
  | 'memory' // read/write memory store
  | 'tool' // call an external tool
  | 'output' // final response

export interface AgentStep {
  id: string
  kind: AgentStepKind
  label: string
  /** Capability slug (for 'act' / 'tool' steps). */
  capabilityId?: string
  /** Prompt template (for 'think' / 'reflect' steps). */
  promptTemplate?: string
  /** Model id (for 'think' steps). */
  modelId?: string
  /** Memory op (for 'memory' steps): read | write | search. */
  memoryOp?: 'read' | 'write' | 'search'
  /** Memory key (for 'memory' steps). */
  memoryKey?: string
  /** HitlGate id (for 'hitl' steps). */
  hitlGateId?: string
  position: { x: number; y: number }
  /** Inputs from previous steps (DAG edges). */
  inputs?: string[]
}

export interface AgentEdge {
  id: string
  fromStepId: string
  toStepId: string
  condition?: string
  label?: string
}

export type AgentStatus = 'draft' | 'published' | 'deprecated' | 'running' | 'paused'

export interface AgentDefinition {
  id: string
  slug: string
  name: string
  description: string
  workspaceId: string // agents workspace
  steps: AgentStep[]
  edges: AgentEdge[]
  /** Entry step id. */
  entryStepId: string
  /** Model preference (may be overridden per-step). */
  defaultModelId?: string
  /** Max loop iterations (AgentLoopRun cap). */
  maxLoopIterations: number
  /** PolicyRule guardrail. */
  policyRuleId?: string
  /** HitlGates referenced by steps. */
  hitlGateIds: string[]
  status: AgentStatus
  /** The capability id registered for this agent. */
  capabilityId: string
  version: number
  author: 'system' | 'user' | 'agent'
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface AgentRun {
  id: string
  agentId: string
  traceId: string
  status: 'pending' | 'running' | 'hitl' | 'completed' | 'failed' | 'cancelled'
  iteration: number // current loop iteration
  startedAt: number
  completedAt?: number
  /** Per-step state. */
  stepStates: Record<
    string,
    { status: string; startedAt?: number; completedAt?: number; output?: unknown; error?: string }
  >
  finalOutput?: unknown
  error?: string
}

/** HitlGate row (mirrors prisma HitlGate). */
export interface HitlGate {
  id: string
  slug: string
  label: string
  description?: string
  /** Approval required from these roles. */
  approverRoles: string[]
  /** Auto-approve after this many ms (optional). */
  autoApproveMs?: number
  /** Reject policy: 'block' | 'skip' | 'escalate'. */
  onReject: 'block' | 'skip' | 'escalate'
  createdAt: number
  updatedAt: number
}

/** PolicyRule row (mirrors prisma PolicyRule). */
export interface PolicyRule {
  id: string
  slug: string
  label: string
  description?: string
  /** Rules engine expression (e.g. "rate <= 10/min"). */
  expression: string
  /** Action on violation: 'block' | 'warn' | 'throttle'. */
  action: 'block' | 'warn' | 'throttle'
  createdAt: number
  updatedAt: number
}
