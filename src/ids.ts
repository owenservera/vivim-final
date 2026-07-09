// src/ids.ts
// ID derivation — all IDs generated with monotonic sortable ULIDs.

import { ulid } from 'ulid'

export function newId(): string {
  return ulid()
}

export function deriveSlaveId(providerId: string, accountId: string): string {
  return `slave:${providerId}:${accountId}`
}

export function deriveCapabilityId(providerId: string, slug: string): string {
  return `cap:${providerId}:${slug}`
}

export function deriveBindingId(globalCapId: string, providerId: string): string {
  return `bind:${globalCapId}:${providerId}`
}

export function deriveProgramId(bindingId: string, version: number): string {
  return `prog:${bindingId}:v${version}`
}

export function deriveSelectorId(capabilityId: string, providerId: string, name: string): string {
  return `sel:${capabilityId}:${providerId}:${name}`
}
