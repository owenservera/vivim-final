// src/storage/contracts/autonomous-store.ts
// AutonomousExecutionStore — persistence contract for autonomous tasks, steps, gates

export interface AutonomousExecutionStore {
  createTask(task: Record<string, unknown>): Promise<void>
  updateTask(id: string, patch: Record<string, unknown>): Promise<void>
  getTask(id: string): Promise<Record<string, unknown> | null>
  listTasks(opts?: { status?: string; limit?: number }): Promise<Array<Record<string, unknown>>>
  createStep(step: Record<string, unknown>): Promise<void>
  updateStep(id: string, patch: Record<string, unknown>): Promise<void>
  getSteps(taskId: string): Promise<Array<Record<string, unknown>>>
  getStep(id: string): Promise<Record<string, unknown> | null>
  createHitlGate(gate: Record<string, unknown>): Promise<void>
  updateHitlGate(id: string, patch: Record<string, unknown>): Promise<void>
  getPendingGates(taskId?: string): Promise<Array<Record<string, unknown>>>
  getGate(id: string): Promise<Record<string, unknown> | null>
}
