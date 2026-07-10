// src/executor/ids.ts
// ID derivation helpers for ChromeGovernor.

import { newId } from '../ids.js'

export function deriveSlaveId(providerId: string, accountId: string): string {
  return `slave_${providerId}_${accountId}`
}

export function deriveId(prefix?: string): string {
  return prefix ? `${prefix}_${newId()}` : newId()
}
