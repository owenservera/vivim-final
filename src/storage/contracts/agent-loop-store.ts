// src/storage/contracts/agent-loop-store.ts
// Store Contract for agentic loop audit trail (Sense/Plan/Act/Observe/Reflect/Adapt).
// Engines depend on this contract only (never the impl).

import type { AgentStep } from '../../engines/browser-automation/types.js'

export interface AgentLoopRunRow {
  runId: string
  slaveId: string
  goal: string
  achieved: boolean
  iterations: number
  steps: AgentStep[]
  output?: unknown
  error?: string
  createdAt: number
  updatedAt: number
}

export interface AgentLoopStore {
  createRun(input: {
    runId: string
    slaveId: string
    goal: string
  }): Promise<AgentLoopRunRow>
  appendStep(runId: string, step: AgentStep): Promise<void>
  finishRun(
    runId: string,
    result: { achieved: boolean; iterations: number; output?: unknown; error?: string },
  ): Promise<void>
  getRun(runId: string): Promise<AgentLoopRunRow | null>
  cancelRun(runId: string): Promise<void>
}
