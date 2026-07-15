import type { SandboxPermissions } from '../../engines/sandbox-runner.js'

export interface SandboxAuditRow {
  id: string
  handlerSlug: string
  ok: boolean
  error: string | null
  permissions: SandboxPermissions
  ts: number
}

export interface SandboxAuditStore {
  create(row: SandboxAuditRow): Promise<void>
  list(limit?: number): Promise<SandboxAuditRow[]>
}
