// src/schema/health.ts
// Health monitoring domain types — used by ProviderHealthKernel.

export interface ProviderHealthReport {
  id: string
  providerId: string
  overallStatus: string
  overallScore: number
  signalsJson: string
  ts: number
}

export interface HealthSignal {
  id: string
  reportId: string
  name: string
  score: number
  weight: number
  detailJson: string
}

export interface HealthHistory {
  id: string
  providerId: string
  overallStatus: string
  overallScore: number
  signalsJson: string
  ts: number
}
