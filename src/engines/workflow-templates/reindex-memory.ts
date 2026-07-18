// src/engines/workflow-templates/reindex-memory.ts
// Reindex Memory — re-run memory indexer on all conversations

import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../workflow-engine.js'

export function buildReindexMemoryWorkflow(
  opts: { limit?: number; full?: boolean } = {},
): WorkflowDefinition {
  const now = Date.now()

  const nodes: WorkflowNode[] = [
    {
      id: 'trigger',
      type: 'manual_trigger',
      category: 'trigger',
      config: { title: 'Reindex Memory' },
    },
    {
      id: 'fetch-all',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:conversation:list',
        input: { limit: opts.limit ?? 500 },
      },
    },
    {
      id: 'reindex-each',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:memory:reindex',
        input: {
          conversations: '{{fetch-all.capabilityResult}}',
          full: opts.full ?? false,
        },
        retry_config: { maxRetries: 3, backoffMs: 5000 },
        timeoutMs: 300_000,
      },
    },
    {
      id: 'rebuild-links',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:memory:rebuildLinks',
        input: {},
      },
    },
    {
      id: 'done',
      type: 'set_variable',
      category: 'data',
      config: {
        key: 'reindexResult',
        value: 'Memory reindex complete',
      },
    },
  ]

  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'trigger', target: 'fetch-all' },
    { id: 'e2', source: 'fetch-all', target: 'reindex-each' },
    { id: 'e3', source: 'reindex-each', target: 'rebuild-links' },
    { id: 'e4', source: 'rebuild-links', target: 'done' },
  ]

  return {
    id: 'wf:reindex-memory:1',
    name: 'Reindex Memory',
    description: 'Re-runs the memory indexer on all conversations and rebuilds memory links',
    nodes,
    edges,
    variables: { limit: opts.limit, full: opts.full },
    createdAt: now,
    updatedAt: now,
  }
}
