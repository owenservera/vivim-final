// src/engines/workflow-templates/cleanup-inactive.ts
// Cleanup Inactive — archive conversations inactive > 90 days

import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../workflow-engine.js'

export function buildCleanupInactiveWorkflow(
  opts: { inactiveDays?: number; dryRun?: boolean } = {},
): WorkflowDefinition {
  const inactiveDays = opts.inactiveDays ?? 90
  const now = Date.now()
  const cutoff = now - inactiveDays * 24 * 60 * 60 * 1000

  const nodes: WorkflowNode[] = [
    {
      id: 'trigger',
      type: 'schedule',
      category: 'trigger',
      config: { cron: '0 2 * * 0', title: 'Weekly Cleanup Trigger' },
    },
    {
      id: 'find-inactive',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:conversation:list',
        input: { lastActiveBefore: cutoff, limit: 200 },
      },
    },
    {
      id: 'human-approval',
      type: 'human_loop',
      category: 'ai',
      config: {
        prompt: `Found {{find-inactive.capabilityResult.length}} conversations inactive for ${inactiveDays}+ days. Approve archiving?`,
        requiresApproval: true,
      },
    },
    {
      id: 'archive-all',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:conversation:archive',
        input: {
          conversationIds: '{{find-inactive.capabilityResult}}',
          dryRun: opts.dryRun ?? false,
        },
      },
    },
    {
      id: 'log-result',
      type: 'set_variable',
      category: 'data',
      config: {
        key: 'cleanupResult',
        value: 'Archived {{find-inactive.capabilityResult.length}} inactive conversations',
      },
    },
  ]

  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'trigger', target: 'find-inactive' },
    { id: 'e2', source: 'find-inactive', target: 'human-approval' },
    { id: 'e3', source: 'human-approval', target: 'archive-all' },
    { id: 'e4', source: 'archive-all', target: 'log-result' },
  ]

  return {
    id: 'wf:cleanup-inactive:1',
    name: 'Cleanup Inactive Conversations',
    description: `Archives conversations inactive for ${inactiveDays}+ days (with human approval)`,
    nodes,
    edges,
    variables: { inactiveDays, cutoff, dryRun: opts.dryRun },
    createdAt: now,
    updatedAt: now,
  }
}
