// ── Types ───────────────────────────────────────────────────────────────

// Unit 34.5: provider failover. Implemented by ProviderMuxEngine.fallbacksFor.
export interface FailoverRouter {
  fallbacksFor(providerId: string): Promise<string[]>
}

export type TaskStatus =
  | 'pending'
  | 'planning'
  | 'executing'
  | 'waiting_approval'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'cancelled'
export type StepStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped' | 'waiting_human'
export type ActionClassification =
  | 'read'
  | 'write'
  | 'navigate'
  | 'destructive'
  | 'financial'
  | 'communication'
export type GateType =
  | 'approval'
  | 'confirmation'
  | 'selection'
  | 'input'
  | 'question'
  | 'option'
  | 'file'
  | 'url'
export type GateStatus = 'pending' | 'approved' | 'denied' | 'skipped' | 'resolved' | 'expired'

export interface AutonomousGoal {
  description: string
  maxSteps: number
  maxDurationMs: number
  requireApprovalAbove: ActionClassification
  allowBrowser: boolean
  costBudgetCents: number
  // Unit 8.6: per-task budgets — exceeding any transitions task to paused
  tokenBudget: number
  iterationBudget: number
  // Unit 36.2: explicit LLM provider for planning. 'local' (or unset) →
  // LocalModelAdapter (offline). Any other value is an outbound/cloud model
  // and is only honored when the user has consented (see resolvePlanner).
  llmProvider?: string
}

// Unit 8.6: tracks per-task consumption across cost/tokens/iterations
export interface BudgetUsage {
  costCents: number
  tokens: number
  iterations: number
}

export interface AutonomousStep {
  id: string
  taskId: string
  stepIndex: number
  description: string
  action: string
  actionInput: Record<string, unknown>
  classification: ActionClassification
  status: StepStatus
  result: unknown
  error: string | null
  startedAt: number | null
  completedAt: number | null
  requiresHumanApproval: boolean
  // Unit 8.9: composite step support
  parentStepId: string | null
  isCompositeRoot: boolean
}

export interface HitlGate {
  id: string
  taskId: string
  stepId: string
  gateType: GateType
  prompt: string
  options: string[]
  defaultValue: string | null
  status: GateStatus
  resolvedBy: string | null
  resolvedAt: number | null
  response: string | null
  createdAt: number
  expiresAt: number | null
}

export interface AutonomousTask {
  id: string
  goal: AutonomousGoal
  status: TaskStatus
  steps: AutonomousStep[]
  startedAt: number
  completedAt: number | null
  result: unknown
  error: string | null
}

// Unit 8.10: task templates
export interface TaskTemplate {
  id: string
  name: string
  params: string[]
  planJson: string
  version: number
  isShared: boolean
  createdAt: number
  updatedAt: number
}

// Unit 8.5: replay with branching options
export interface ReplayOptions {
  /** Step index to replay from (0-based). Steps before this are copied verbatim. */
  fromStep: number
  /** If true, create a new branch task (original untouched). If false, re-execute in-place. */
  branch: boolean
}

// ── Classification priority (lower = more restrictive) ──────────────────

const CLASSIFICATION_PRIORITY: Record<ActionClassification, number> = {
  read: 0,
  navigate: 1,
  communication: 2,
  write: 3,
  destructive: 4,
  financial: 5,
}

function classificationAtLeast(
  classification: ActionClassification,
  threshold: ActionClassification,
): boolean {
  return (CLASSIFICATION_PRIORITY[classification] ?? 0) >= (CLASSIFICATION_PRIORITY[threshold] ?? 0)
}

// The nlcl resolver uses a superset classification ('system' extra); map it
// onto the autonomous engine's classification space.
function toAutonomousClassification(c: string): ActionClassification {
  return c === 'system' ? 'read' : (c as ActionClassification)
}

// ── Engine ──────────────────────────────────────────────────────────────
