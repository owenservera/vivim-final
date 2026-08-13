// src/ids.ts
// ID derivation — all IDs generated with monotonic sortable ULIDs.

import { ulid } from 'ulid'

export { ulid }

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

// ── Content hashing (integrity + dedup) ───────────────────────────────────
// Stable SHA-256 of canonicalized content. Mirrors OG AtomicChatUnit.contentHash.
// Used by the universal Node layer for dedup and tamper-evidence.

export function hashContent(content: string): string {
  // Lazy import to avoid a hard node:crypto dep in edge/browser contexts;
  // Bun and Node both provide it. Fallback to a lightweight hash if unavailable.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('node:crypto')
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
  } catch {
    // FNV-1a is NOT collision-resistant. Use only for dedup keys, NOT for integrity.
    let h = 0x811c9dc5
    for (let i = 0; i < content.length; i++) {
      h ^= content.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return `fnv1a:${(h >>> 0).toString(16)}`
  }
}
