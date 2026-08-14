import type { CapStoreDb } from '../../src/storage/db.js'

const AGENT_ROLES = ['researcher', 'extractor', 'synthesizer', 'monitor', 'tester']

export async function seedAutomation(db: CapStoreDb): Promise<number> {
  const now = Date.now()
  let count = 0

  for (const role of AGENT_ROLES) {
    const runId = `seed:agent:${role}`
    await db.userPrisma.agentLoopRun.upsert({
      where: { id: runId },
      create: {
        id: runId,
        agentId: `agent:${role}`,
        goal: `Reference ${role} agent role (seeded)`,
        status: 'completed',
        inputJson: JSON.stringify({ role }),
        outputJson: JSON.stringify({ kind: 'agent-role' }),
        startedAt: now,
        completedAt: now,
      },
      update: {
        status: 'completed',
        outputJson: JSON.stringify({ kind: 'agent-role' }),
        completedAt: now,
      },
    })
    await db.userPrisma.agentStep.upsert({
      where: { id: `${runId}:0` },
      create: {
        id: `${runId}:0`,
        runId,
        stepIndex: 0,
        actionType: 'register_role',
        actionJson: JSON.stringify({ role }),
        resultJson: JSON.stringify({ kind: 'agent-role' }),
        success: true,
        durationMs: 0,
        createdAt: now,
      },
      update: { actionType: 'register_role', actionJson: JSON.stringify({ role }), success: true },
    })
    count += 2
  }

  return count
}
