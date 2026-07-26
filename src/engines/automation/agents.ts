// src/engines/automation/agents.ts
// Agent-role configs (config roles, NOT recursive sub-agents). Each role is a
// declarative spec that tunes how the AutomationOrchestrator composes and runs
// recipes: trust policy, fan-out, loops, output shape. The "brain" lives in the
// user's NL request; the system only provides a configurable backbone.

import { EngineError } from '../../errors.js'
import type { AgentRole, TrustPolicy } from './types.js'

export const RESEARCH_TRUST: TrustPolicy = {
  level: 'read',
  humanGate: false,
  maxSteps: 40,
  requiresConfirmation: false,
}

export const EXTRACTOR_TRUST: TrustPolicy = {
  level: 'read',
  humanGate: false,
  maxSteps: 20,
  requiresConfirmation: false,
}

export const SYNTHESIZER_TRUST: TrustPolicy = {
  level: 'read',
  humanGate: false,
  maxSteps: 10,
  requiresConfirmation: false,
}

export const MONITOR_TRUST: TrustPolicy = {
  level: 'read',
  humanGate: false,
  maxSteps: 15,
  requiresConfirmation: false,
}

export const TESTER_TRUST: TrustPolicy = {
  level: 'config',
  humanGate: true,
  maxSteps: 30,
  requiresConfirmation: true,
}

export const AGENT_ROLES: Record<string, AgentRole> = {
  researcher: {
    id: 'researcher',
    description: 'Gather and synthesize information from many sources into a report.',
    trust: RESEARCH_TRUST,
    fanOut: { strategy: 'breadth', maxSources: 10, depth: 2 },
    defaultRecipe: 'auto:research:report',
    loopPolicy: { maxIterations: 8, stopOn: 'sufficient_sources' },
    output: { format: 'markdown', aggregate: 'report' },
  },
  extractor: {
    id: 'extractor',
    description: 'Pull structured data from pages (tables, feeds, JSON-LD).',
    trust: EXTRACTOR_TRUST,
    fanOut: { strategy: 'targeted', maxSources: 4, depth: 1 },
    defaultRecipe: 'auto:extract:structured',
    loopPolicy: { maxIterations: 4, stopOn: 'extract_complete' },
    output: { format: 'json', aggregate: 'collection' },
  },
  synthesizer: {
    id: 'synthesizer',
    description: 'Turn gathered pages into a TL;DR / summary / rewrite.',
    trust: SYNTHESIZER_TRUST,
    fanOut: { strategy: 'none', maxSources: 1, depth: 1 },
    defaultRecipe: 'auto:content:summarize',
    loopPolicy: { maxIterations: 2, stopOn: 'summarized' },
    output: { format: 'markdown', aggregate: 'single' },
  },
  monitor: {
    id: 'monitor',
    description: 'Watch a URL/selector over time and report changes.',
    trust: MONITOR_TRUST,
    fanOut: { strategy: 'none', maxSources: 1, depth: 1 },
    defaultRecipe: 'auto:monitor:watch',
    loopPolicy: { maxIterations: 1, stopOn: 'captured' },
    output: { format: 'diff', aggregate: 'snapshot' },
  },
  tester: {
    id: 'tester',
    description: 'Run a UI smoke/regression test with human gate on destructive steps.',
    trust: TESTER_TRUST,
    fanOut: { strategy: 'none', maxSources: 1, depth: 1 },
    defaultRecipe: 'auto:test:ui',
    loopPolicy: { maxIterations: 3, stopOn: 'asserted' },
    output: { format: 'report', aggregate: 'single' },
  },
}

export function getAgentRole(id: string): AgentRole {
  const role = AGENT_ROLES[id]
  if (!role) throw new EngineError(`Unknown agent role: ${id}`)
  return role
}
