// src/storage/contracts/cost-store.ts
// CostStore — persistence contract for CostOptimizer.

export interface CostLogInput {
  id: string
  providerId: string
  costCents: number
  tokensInput: number
  tokensOutput: number
  model: string | null
  ts: number
}

export interface CostLogRow extends CostLogInput {}

export interface LatencyLogInput {
  id: string
  providerId: string
  latencyMs: number
  capabilityId: string | null
  ts: number
}

export interface LatencyLogRow extends LatencyLogInput {}

export interface CostStore {
  createCostLog(input: CostLogInput): Promise<void>
  getCostLogs(providerId: string, from: number, to: number): Promise<CostLogRow[]>
  getCostLogsByCapability?(capabilityId: string, from: number, to: number): Promise<CostLogRow[]>
  createLatencyLog(input: LatencyLogInput): Promise<void>
  getLatencyLogs(providerId: string, from: number, to: number): Promise<LatencyLogRow[]>
  getAllCostLogs?(from: number, to: number): Promise<CostLogRow[]>
}
