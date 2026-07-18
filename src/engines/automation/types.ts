// src/engines/automation/types.ts
// Shared types for the automation orchestration layer (B7).

import type { TrustPolicy as CapabilityTrust } from '../browser-automation/types.js'

/** Trust policy — config, not baked logic. Controls destructive gates. */
export interface TrustPolicy {
  level: 'read' | 'config' | 'destructive'
  humanGate: boolean
  maxSteps: number
  requiresConfirmation: boolean
}

/** Re-export capability-layer trust alias for consumers. */
export type CapTrustPolicy = CapabilityTrust

export interface FanOutPolicy {
  strategy: 'none' | 'breadth' | 'targeted'
  maxSources: number
  depth: number
}

export interface LoopPolicy {
  maxIterations: number
  stopOn: string
}

export interface OutputPolicy {
  format: 'markdown' | 'json' | 'diff' | 'report'
  aggregate: 'report' | 'collection' | 'single' | 'snapshot'
}

/** A config role (NOT a sub-agent). Declarative tuning spec. */
export interface AgentRole {
  id: string
  description: string
  trust: TrustPolicy
  fanOut: FanOutPolicy
  defaultRecipe: string
  loopPolicy: LoopPolicy
  output: OutputPolicy
}

/** A natural-language automation goal resolved from NLCL. */
export interface AutomationGoal {
  role: string
  recipeId?: string
  intent: string
  params: Record<string, string>
  destructive: boolean
}

export interface AutomationResult {
  role: string
  recipeId: string
  steps: number
  observations: Array<{ kind: string; data: unknown }>
  output: unknown
  trustLevel: TrustPolicy['level']
  humanGated: boolean
}
