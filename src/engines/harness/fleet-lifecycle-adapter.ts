// src/engines/harness/fleet-lifecycle-adapter.ts
// Unit 21.2 - Fleet lifecycle adapter.
// Resolves a (providerId, accountId) pair to a live slaveId, reusing the
// governor's existing fleet lifecycle (spawn/ensureRunningForAccount/
// recoverAuth). This keeps "only the governor touches fleet/Cdp" intact while
// letting the harness ask "where should I run this program?" declaratively.

import type { ChromeGovernor } from '../chrome-governor.js'
import type { SlaveResolver } from './harness-contract.js'

export function createGovernorSlaveResolver(governor: ChromeGovernor): SlaveResolver {
  return {
    async resolve(providerId: string, accountId: string): Promise<string | null> {
      // Mirror cap-store's "bind program -> resolve slave -> ensure healthy".
      const slave = await governor.ensureRunningForAccount(providerId, accountId)
      if (!slave) return null
      if (slave.circuitState === 'open') {
        // Let the governor attempt recovery before we give up (cap-store recoverAuth).
        const recovered = await governor.recoverAuth(providerId, accountId)
        return recovered?.slaveId ?? null
      }
      return slave.slaveId
    },
  }
}
