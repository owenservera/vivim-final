// src/engines/browser-automation/defs/flow.ts
// Axis: flow — recipe-level control directives (10 capabilities)
// These emit HarnessNode-shaped outputs consumed by the DAG executor; in the
// agentic loop they act as no-op markers that the planner interprets.

import type { BrowserCapabilityDef } from '../types.js'
import { TRUST, z } from '../registry.js'

function marker(id: string, description: string, extra: z.ZodRawShape = {}): BrowserCapabilityDef {
  return {
    id,
    axis: 'flow',
    description,
    params: z.object(extra),
    trust: TRUST.read,
    handler: async (ctx) => ({ ok: true, detail: `${id} marker`, output: ctx.params }),
  }
}

export const branchIf: BrowserCapabilityDef = marker('auto:flow:branch-if', 'Branch execution on a condition.', { condition: z.string(), then: z.string().optional() })
export const loopWhile: BrowserCapabilityDef = marker('auto:flow:loop-while', 'Loop while a condition holds.', { condition: z.string(), body: z.string().optional() })
export const retry: BrowserCapabilityDef = marker('auto:flow:retry', 'Retry a step on failure.', { attempts: z.number().default(3) })
export const parallel: BrowserCapabilityDef = marker('auto:flow:parallel', 'Run steps in parallel.', { steps: z.array(z.string()).optional() })
export const sequential: BrowserCapabilityDef = marker('auto:flow:sequential', 'Run steps sequentially.', { steps: z.array(z.string()).optional() })
export const delay: BrowserCapabilityDef = marker('auto:flow:delay', 'Delay execution.', { ms: z.number() })
export const assert: BrowserCapabilityDef = marker('auto:flow:assert', 'Assert a condition (throws on fail).', { condition: z.string() })
export const forEach: BrowserCapabilityDef = marker('auto:flow:foreach', 'Iterate over items.', { items: z.array(z.unknown()).optional() })
export const exitOn: BrowserCapabilityDef = marker('auto:flow:exit-on', 'Exit loop on condition.', { condition: z.string() })
export const humanGate: BrowserCapabilityDef = marker('auto:flow:human-gate', 'Pause for human confirmation.', { prompt: z.string().optional() })
