// src/engines/workflow-templates/daily-digest.ts
// Daily Digest — summarize today's conversations

import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../workflow-engine.js'

export function buildDailyDigestWorkflow(
  opts: { recipients?: string[]; providerId?: string } = {},
): WorkflowDefinition {
  const now = Date.now()
  const dayStart = now - 24 * 60 * 60 * 1000

  const nodes: WorkflowNode[] = [
    {
      id: 'trigger',
      type: 'schedule',
      category: 'trigger',
      config: { cron: '0 8 * * *', title: 'Daily Digest Trigger' },
    },
    {
      id: 'fetch-conversations',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:conversation:list',
        input: { since: dayStart, limit: 50 },
      },
    },
    {
      id: 'summarize',
      type: 'llm_call',
      category: 'ai',
      config: {
        prompt:
          'Summarize the following conversations from today:\n\n{{fetch-conversations.capabilityResult}}\n\nProvide a concise daily digest with key topics, decisions, and action items.',
      },
    },
    {
      id: 'save-digest',
      type: 'set_variable',
      category: 'data',
      config: { key: 'dailyDigest', value: '{{summarize.llmResult}}' },
    },
    {
      id: 'notify',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:notification:send',
        input: {
          title: 'Daily Digest',
          body: '{{summarize.llmResult}}',
          recipients: opts.recipients ?? [],
        },
      },
    },
  ]

  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'trigger', target: 'fetch-conversations' },
    { id: 'e2', source: 'fetch-conversations', target: 'summarize' },
    { id: 'e3', source: 'summarize', target: 'save-digest' },
    { id: 'e4', source: 'save-digest', target: 'notify' },
  ]

  return {
    id: 'wf:daily-digest:1',
    name: 'Daily Digest',
    description: "Summarizes today's conversations and sends a daily digest",
    nodes,
    edges,
    variables: { dayStart, recipients: opts.recipients ?? [] },
    createdAt: now,
    updatedAt: now,
  }
}
