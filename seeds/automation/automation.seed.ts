// seeds/automation/automation.seed.ts
// Idempotent seeder for the browser-automation substrate (SOTA plan B9).
// Persists one reference AgentLoopRun per config-role agent so the runtime
// audit tables (agent_loop_run / agent_step) have enumerable role anchors.
// Recipes (auto:*) and agent roles live in code (recipes.ts / agents.ts).

import { newId } from '../../src/ids.js'
import type { CapStoreDb } from '../../src/storage/db.js'

const AGENT_ROLES = ['researcher', 'extractor', 'synthesizer', 'monitor', 'tester']

export async function seedAutomation(db: CapStoreDb): Promise<number> {
  const now = Date.now()
  let count = 0

  for (const role of AGENT_ROLES) {
    const runId = `seed:agent:${role}`
    await db.prisma.agentLoopRun.upsert({
      where: { id: runId },
      create: {
        id: runId,
        goal: `Reference ${role} agent role (seeded)`,
        role,
        status: 'completed',
        stepsDone: 1,
        startedAt: now,
        finishedAt: now,
      },
      update: { updatedAt: now },
    })
    await db.prisma.agentStep.upsert({
      where: { id: `${runId}:0` },
      create: {
        id: `${runId}:0`,
        runId,
        stepIndex: 0,
        action: 'register_role',
        observation: JSON.stringify({ kind: 'agent-role' }),
        ok: 1,
        createdAt: now,
      },
      update: { updatedAt: now },
    })
    count += 2
  }

  return count
}
