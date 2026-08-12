// scripts/devops/runtime-test/engage.ts
// Launch browser slave via ChromeGovernor

import { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import { getDb } from '../../../src/storage/db.js'

export interface EngageResult {
  slavesLaunched: number
  slavesReady: number
  slaves: Array<{
    slaveId: string
    provider: string
    status: string
  }>
}

/**
 * Engage live browser via Governor-mediated CDP
 */
export async function engageBrowser(): Promise<EngageResult> {
  const db = getDb()
  const store = db.governorStore
  
  const governor = new ChromeGovernor(store, {
    portRange: [9222, 9322],
    healthProbeIntervalMs: 30000,
    healthProbeTimeoutMs: 5000,
    autoRestart: true,
    maxRestarts: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60000,
  })

  // Get existing providers
  const providers = await db.prisma.provider.findMany()
  const slaves: EngageResult['slaves'] = []
  let ready = 0

  for (const provider of providers) {
    try {
      // Check if slave already running
      const existing = governor.getAllSlaves({ providerId: provider.id })
      
      if (existing.length > 0) {
        const alive = await governor.ensureRunning(existing[0].slaveId)
        slaves.push({
          slaveId: alive.slaveId,
          provider: provider.id,
          status: alive.status,
        })
        if (alive.status === 'running') ready++
      } else {
        // Spawn new slave (requires profile to exist)
        const slave = await governor.spawn(provider.id, 'default', { visible: false })
        slaves.push({
          slaveId: slave.slaveId,
          provider: provider.id,
          status: slave.status,
        })
      }
    } catch (e) {
      // Slave spawn failed - log but continue
      // [audit] removed: console.error(`[engage] Failed to spawn ${provider.id}:`, e)
      slaves.push({
        slaveId: 'failed',
        provider: provider.id,
        status: 'error',
      })
    }
  }

  return {
    slavesLaunched: slaves.length,
    slavesReady: ready,
    slaves,
  }
}