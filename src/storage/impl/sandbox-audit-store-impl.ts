import type { SandboxAuditRow, SandboxAuditStore } from '../contracts/sandbox-audit-store.js'
import type { CapStoreDb } from '../db.js'

export class SandboxAuditStoreImpl implements SandboxAuditStore {
  constructor(private readonly db: CapStoreDb) {}

  private get p() {
    return this.db.prisma
  }

  async create(row: SandboxAuditRow): Promise<void> {
    await this.p.sandboxAudit.create({
      data: {
        id: row.id,
        handlerSlug: row.handlerSlug,
        ok: row.ok ? 1 : 0,
        error: row.error,
        permissionsJson: JSON.stringify(row.permissions),
        ts: row.ts,
      },
    })
  }

  async list(limit = 100): Promise<SandboxAuditRow[]> {
    const rows = await this.p.sandboxAudit.findMany({
      orderBy: { ts: 'desc' },
      take: limit,
    })
    return rows.map((r) => ({
      id: r.id,
      handlerSlug: r.handlerSlug,
      ok: r.ok === 1,
      error: r.error,
      permissions: JSON.parse(r.permissionsJson) as SandboxAuditRow['permissions'],
      ts: Number(r.ts),
    }))
  }
}
