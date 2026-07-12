// tests/unit/storage/impl/workflow-store-impl.test.ts
// WorkflowStoreImpl — Prisma-backed WorkflowStore tests

import { beforeEach, describe, expect, test } from 'bun:test'
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStore,
} from '../../../../src/engines/workflow-engine.js'
import type { CapStoreDb } from '../../../../src/storage/db.js'
import { WorkflowStoreImpl } from '../../../../src/storage/impl/workflow-store-impl.js'

function createMockDb() {
  const workflows = new Map<
    string,
    {
      id: string
      name: string
      description: string | null
      nodesJson: string
      edgesJson: string
      variablesJson: string | null
      createdAt: number
      updatedAt: number
    }
  >()
  const executions = new Map<
    string,
    {
      id: string
      workflowId: string
      status: string
      inputJson: string | null
      outputJson: string | null
      startedAt: number
      completedAt: number | null
    }
  >()
  const prisma = {
    workflowDefinition: {
      async findUnique({ where }: { where: { id: string } }) {
        return workflows.get(where.id) ?? null
      },
      async upsert({
        where,
        create,
        update,
      }: {
        where: { id: string }
        create: Record<string, unknown>
        update: Record<string, unknown>
      }) {
        const existing = workflows.get(where.id)
        if (existing) {
          Object.assign(existing, update)
        } else {
          workflows.set(where.id, create as never)
        }
      },
      async delete({ where }: { where: { id: string } }) {
        workflows.delete(where.id)
      },
    },
    workflowExecution: {
      async findUnique({ where }: { where: { id: string } }) {
        return executions.get(where.id) ?? null
      },
      async upsert({
        where,
        create,
        update,
      }: {
        where: { id: string }
        create: Record<string, unknown>
        update: Record<string, unknown>
      }) {
        const existing = executions.get(where.id)
        if (existing) {
          Object.assign(existing, update)
        } else {
          executions.set(where.id, create as never)
        }
      },
    },
  }
  return { prisma } as unknown as CapStoreDb
}

describe('WorkflowStoreImpl', () => {
  let db: CapStoreDb
  let store: WorkflowStore

  beforeEach(() => {
    db = createMockDb()
    store = new WorkflowStoreImpl(db)
  })

  test('save and getWorkflow round-trip', async () => {
    const def: WorkflowDefinition = {
      id: 'wf-1',
      name: 'Test Workflow',
      description: 'desc',
      nodes: [{ id: 'n1', type: 'trigger', category: 'trigger', config: {} }],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await store.saveWorkflow(def)
    const result = await store.getWorkflow('wf-1')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Workflow')
    expect(result!.nodes).toHaveLength(1)
  })

  test('getWorkflow returns null for unknown id', async () => {
    const result = await store.getWorkflow('unknown')
    expect(result).toBeNull()
  })

  test('deleteWorkflow removes workflow', async () => {
    const def: WorkflowDefinition = {
      id: 'wf-2',
      name: 'Delete Me',
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await store.saveWorkflow(def)
    await store.deleteWorkflow('wf-2')
    expect(await store.getWorkflow('wf-2')).toBeNull()
  })

  test('saveExecution and getExecution round-trip', async () => {
    const exec: WorkflowExecution = {
      id: 'exec-1',
      workflowId: 'wf-1',
      status: 'running',
      input: { key: 'val' },
      nodeExecutions: [],
      startedAt: Date.now(),
    }
    await store.saveExecution(exec)
    const result = await store.getExecution('exec-1')
    expect(result).not.toBeNull()
    expect(result!.status).toBe('running')
    expect(result!.input).toEqual({ key: 'val' })
  })

  test('getExecution returns null for unknown id', async () => {
    expect(await store.getExecution('unknown')).toBeNull()
  })
})
