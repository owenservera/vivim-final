// src/engines/workflow-templates/health-report.ts
// Health Report — generate health digest and save

import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../workflow-engine.js'

export function buildHealthReportWorkflow(
  opts: { recipients?: string[] } = {},
): WorkflowDefinition {
  const now = Date.now()

  const nodes: WorkflowNode[] = [
    {
      id: 'trigger',
      type: 'schedule',
      category: 'trigger',
      config: { cron: '0 7 * * *', title: 'Daily Health Report Trigger' },
    },
    {
      id: 'check-providers',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:provider:health',
        input: {},
      },
    },
    {
      id: 'check-fleet',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:fleet:status',
        input: {},
      },
    },
    {
      id: 'check-db',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:system:integrity',
        input: {},
      },
    },
    {
      id: 'compose-report',
      type: 'llm_call',
      category: 'ai',
      config: {
        prompt:
          'Generate a system health report from the following data:\n\nProviders: {{check-providers.capabilityResult}}\nFleet: {{check-fleet.capabilityResult}}\nDB Integrity: {{check-db.capabilityResult}}\n\nFormat as a concise health report with status indicators (OK/WARN/ERROR) for each component.',
      },
    },
    {
      id: 'save-report',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:system:saveReport',
        input: {
          type: 'health',
          content: '{{compose-report.llmResult}}',
        },
      },
    },
    {
      id: 'notify',
      type: 'capability_call',
      category: 'action',
      config: {
        capabilityId: 'cap:notification:send',
        input: {
          title: 'System Health Report',
          body: '{{compose-report.llmResult}}',
          recipients: opts.recipients ?? [],
        },
      },
    },
  ]

  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'trigger', target: 'check-providers' },
    { id: 'e2', source: 'trigger', target: 'check-fleet' },
    { id: 'e3', source: 'trigger', target: 'check-db' },
    { id: 'e4', source: 'check-providers', target: 'compose-report' },
    { id: 'e5', source: 'check-fleet', target: 'compose-report' },
    { id: 'e6', source: 'check-db', target: 'compose-report' },
    { id: 'e7', source: 'compose-report', target: 'save-report' },
    { id: 'e8', source: 'save-report', target: 'notify' },
  ]

  return {
    id: 'wf:health-report:1',
    name: 'Health Report',
    description: 'Generates a daily system health report from provider, fleet, and DB status',
    nodes,
    edges,
    variables: { recipients: opts.recipients ?? [] },
    createdAt: now,
    updatedAt: now,
  }
}
