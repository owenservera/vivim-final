// src/engines/workflow-templates/newsletter.ts
// Phase 28.2 — Newsletter Workflow Template

import { newId } from '../../ids.js'
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../workflow-engine.js'

export interface NewsletterOpts {
  windowDays: number
  recipients: string[]
  title?: string
}

export function buildNewsletterWorkflow(opts: NewsletterOpts): WorkflowDefinition {
  const window = opts.windowDays ?? 7
  const title = opts.title ?? 'Weekly Newsletter'

  const nodes: WorkflowNode[] = [
    {
      id: 'trigger',
      type: 'manual_trigger',
      category: 'trigger',
      config: { title: 'Run Newsletter' },
    },
    {
      id: 'distill',
      type: 'knowledge_distill',
      category: 'data',
      config: { window, format: 'digest' },
    },
    {
      id: 'compose',
      type: 'llm_call',
      category: 'ai',
      config: {
        prompt: `Write a newsletter titled "${title}" from the following distilled content:\n\n{{distill.output}}`,
      },
    },
    {
      id: 'send',
      type: 'email_send',
      category: 'action',
      config: {
        recipients: opts.recipients,
        subject: title,
        body: '{{compose.output}}',
      },
    },
  ]

  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'trigger', target: 'distill' },
    { id: 'e2', source: 'distill', target: 'compose' },
    { id: 'e3', source: 'compose', target: 'send' },
  ]

  return {
    id: `wf:newsletter:${newId().slice(0, 8)}`,
    name: title,
    description: `Automated newsletter: distills ${window} days of knowledge and emails to ${opts.recipients.length} recipients`,
    nodes,
    edges,
    variables: { windowDays: window, recipients: opts.recipients, title },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
