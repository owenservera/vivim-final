// src/storage/impl/workflow-version-store-impl.ts
// Prisma-backed WorkflowVersionStore

import type { WorkflowVersionStore } from '../../engines/workflow-engine.js'
import type { CapStoreDb } from '../db.js'

export class WorkflowVersionStoreImpl implements WorkflowVersionStore {
  constructor(private db: CapStoreDb) {}

  async createVersion(record: {
    id: string
    workflowId: string
    version: number
    definitionJson: string
    createdAt: number
  }): Promise<void> {
    await this.db.prisma.workflowVersion.create({
      data: {
        id: record.id,
        workflowId: record.workflowId,
        version: record.version,
        definitionJson: record.definitionJson,
        createdAt: BigInt(record.createdAt),
      },
    })
  }

  async getLatestVersion(workflowId: string): Promise<number> {
    const row = await this.db.prisma.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' },
    })
    return row?.version ?? 0
  }
}
