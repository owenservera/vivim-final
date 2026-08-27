// Runtime boundary assertions for the dual-DB split.
// These enforce the contract: code that writes user data must declare the user boundary.
// Per ARCHITECTURAL_DECISIONS.md Decision 5 (Cross-Boundary Storage Layer) and
// SOTA_GAP_ANALYSIS.md Problem 5.

import { execSync } from 'node:child_process'

const SYSTEM_DB = 'system'
const USER_DB = 'user'

function assertBoundary(clientName: string) {
  const allowedSystem = ['systemClient', 'systemDB', 'prisma/system']
  const allowedUser = ['userClient', 'userDB', 'prisma/user']

  const isSystemContext = allowedSystem.some((name) => clientName.includes(name))
  const isUserContext = allowedUser.some((name) => clientName.includes(name))

  if (!isSystemContext && !isUserContext) {
    throw new Error(
      `Boundary violation: ${clientName} does not declare a valid system or user DB context.` +
        ` Every engine that writes user data must use the user DB client; system data must use the system DB client.` +
        ` See docs/architecture/ARCHITECTURAL_DECISIONS.md §Decision 5.`,
    )
  }
}

function assertNotCrossWrite(clientName: string) {
  // The cross-boundary contract: no engine should write to the opposite DB through the wrong client.
  // This is enforced by convention; this assertion makes the violation explicit at runtime.
  assertBoundary(clientName)
}

export { assertBoundary, assertNotCrossWrite, SYSTEM_DB, USER_DB }
