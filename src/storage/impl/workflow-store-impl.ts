// src/storage/impl/workflow-store-impl.ts
// PrismaStoreImpl for WorkflowStore contract — Phase 21.1.1

import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStore,
} from '../../engines/workflow-engine.js'
import type { CapStoreDb } from '../db.js'

export class WorkflowStoreImpl implements WorkflowStore {
  constructor(private db: CapStoreDb) {}

  async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
    const row = await this.db.prisma.workflowDefinition.findUnique({ where: { id } })
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      nodes: JSON.parse(row.nodesJson),
      edges: JSON.parse(row.edgesJson),
      variables: row.variablesJson ? JSON.parse(row.variablesJson) : undefined,
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    }
  }

  async saveWorkflow(def: WorkflowDefinition): Promise<void> {
    await this.db.prisma.workflowDefinition.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        name: def.name,
        description: def.description ?? null,
        nodesJson: JSON.stringify(def.nodes),
        edgesJson: JSON.stringify(def.edges),
        variablesJson: def.variables ? JSON.stringify(def.variables) : null,
        createdAt: def.createdAt,
        updatedAt: def.updatedAt,
      },
      update: {
        name: def.name,
        description: def.description ?? null,
        nodesJson: JSON.stringify(def.nodes),
        edgesJson: JSON.stringify(def.edges),
        variablesJson: def.variables ? JSON.stringify(def.variables) : null,
        updatedAt: def.updatedAt,
      },
    })
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.db.prisma.workflowDefinition.delete({ where: { id } }).catch(() => {})
  // [audit] log the error with context here
  }

  async saveExecution(exec: WorkflowExecution): Promise<void> {
    await this.db.prisma.workflowExecution.upsert({
      where: { id: exec.id },
      create: {
        id: exec.id,
        workflowId: exec.workflowId,
        status: exec.status,
        inputJson: exec.input ? JSON.stringify(exec.input) : null,
        outputJson: exec.output ? JSON.stringify(exec.output) : null,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt ?? null,
      },
      update: {
        status: exec.status,
        inputJson: exec.input ? JSON.stringify(exec.input) : null,
        outputJson: exec.output ? JSON.stringify(exec.output) : null,
        completedAt: exec.completedAt ?? null,
      },
    })
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    const row = await this.db.prisma.workflowExecution.findUnique({ where: { id } })
    if (!row) return null
    return {
      id: row.id,
      workflowId: row.workflowId,
      status: row.status as WorkflowExecution['status'],
      input: row.inputJson ? JSON.parse(row.inputJson) : undefined,
      output: row.outputJson ? JSON.parse(row.outputJson) : undefined,
      nodeExecutions: [],
      startedAt: Number(row.startedAt),
      completedAt: row.completedAt == null ? undefined : Number(row.completedAt),
    }
  }
}
