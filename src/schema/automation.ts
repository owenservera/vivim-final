// src/schema/automation.ts
// Automation and alerting domain types — used by Automation scheduler and Alerting subsystem.

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface AlertCondition {
  id: string
  name: string
  metric: string
  operator: string
  threshold: number
  severity: AlertSeverity
  isActive: boolean
}

export interface AlertEvent {
  id: string
  conditionId: string
  actualValue: number
  triggeredAt: number
  resolvedAt: number | null
}

export interface AutomationSchedule {
  id: string
  name: string
  trigger: string
  action: string
  isActive: boolean
  lastRunAt: number | null
  cron?: string
}

export interface AutomationRun {
  id: string
  scheduleId: string
  status: string
  resultJson: string
  startedAt: number
  completedAt: number | null
}

export interface DiscoveryObjective {
  id: string
  name: string
  targetProviderId: string
  focus: string
  status: string
}
