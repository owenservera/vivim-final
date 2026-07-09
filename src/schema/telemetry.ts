// src/schema/telemetry.ts
// Telemetry configuration types — used by TelemetryAggregator.

export interface TelemetryPipelineConfig {
  id: string
  name: string
  engineId: string
  schedule: string
  retention: string
  isActive: boolean
}

export interface TelemetrySchedule {
  id: string
  pipelineId: string
  interval: string
  lastRunAt: number | null
  nextRunAt: number | null
}

export interface TelemetryRetention {
  id: string
  pipelineId: string
  maxAgeDays: number
  maxRecords: number
  currentCount: number
}
