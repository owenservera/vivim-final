// src/storage/contracts/health-digest-store.ts
// HealthDigestStore — persistence contract for daily system-health digests (Unit 35.1)

export interface HealthDigestRow {
  id: string
  day: string // YYYY-MM-DD (UTC)
  markdown: string
  metricsJson: string
  createdAt: number
}

export interface HealthDigestStore {
  getByDay(day: string): Promise<HealthDigestRow | null>
  save(row: HealthDigestRow): Promise<void>
  listRecent(limit?: number): Promise<HealthDigestRow[]>
}
