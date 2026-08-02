// tests/integration/lib/full-pipeline-crypto.test.ts
// Integration test: full cloud ↔ desktop sync with REAL Ed25519 crypto

import { describe, expect, it } from 'bun:test'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'

// Wire SHA-512 into @noble/ed25519 (must be done once at module load)
ed.hashes.sha512 = sha512

import {
  computeEntryHash,
  verifyEntry,
  verifyEntrySignature,
} from '../../../src/lib/ledger-client/chain-verifier.js'

// Generate a real key pair for testing
const PRIVATE_KEY = ed.utils.randomSecretKey()
const PUBLIC_KEY = ed.getPublicKey(PRIVATE_KEY)

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const PUBLIC_KEY_HEX = bytesToHex(PUBLIC_KEY)

describe('full-pipeline-crypto (integration)', () => {
  it('computeEntryHash produces deterministic SHA-256', () => {
    const content = JSON.stringify({ type: 'provider_definition', slug: 'gemini' })
    const h1 = computeEntryHash(null, content)
    const h2 = computeEntryHash(null, content)
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
  })

  it('computeEntryHash includes prevHash when provided', () => {
    const content = JSON.stringify({ type: 'test' })
    const h1 = computeEntryHash(null, content)
    const h2 = computeEntryHash(h1, content)
    expect(h1).not.toBe(h2)
  })

  it('verifyEntrySignature validates real Ed25519 signatures', async () => {
    const prevHash = null
    const content = JSON.stringify({ type: 'provider_definition', slug: 'claude' })
    const entryHash = computeEntryHash(prevHash, content)
    const message = new TextEncoder().encode(`${prevHash ?? ''}\n${entryHash}`)

    const sig = await ed.signAsync(message, PRIVATE_KEY)
    const sigHex = bytesToHex(sig)

    const valid = await verifyEntrySignature(entryHash, prevHash, sigHex, PUBLIC_KEY_HEX)
    expect(valid).toBe(true)
  })

  it('verifyEntrySignature rejects wrong public key', async () => {
    const prevHash = null
    const content = JSON.stringify({ type: 'test' })
    const entryHash = computeEntryHash(prevHash, content)
    const message = new TextEncoder().encode(`${prevHash ?? ''}\n${entryHash}`)

    const sig = await ed.signAsync(message, PRIVATE_KEY)
    const sigHex = bytesToHex(sig)

    const wrongPriv = ed.utils.randomSecretKey()
    const wrongPub = bytesToHex(ed.getPublicKey(wrongPriv))

    await expect(verifyEntrySignature(entryHash, prevHash, sigHex, wrongPub)).resolves.toBe(false)
  })

  it('verifyEntry validates a complete entry', async () => {
    const prevHash = null
    const contentJson = JSON.stringify({
      type: 'provider_definition',
      id: 'prov-test',
      slug: 'test-provider',
      name: 'Test Provider',
    })
    const hash = computeEntryHash(prevHash, contentJson)
    const message = new TextEncoder().encode(`${prevHash ?? ''}\n${hash}`)
    const sig = await ed.signAsync(message, PRIVATE_KEY)

    const entry = {
      prevHash,
      hash,
      signature: bytesToHex(sig),
      contentJson,
    }

    const result = await verifyEntry(entry, null, PUBLIC_KEY_HEX)
    expect(result).toBe(hash)
  })

  it('verifyEntry rejects tampered contentJson', async () => {
    const prevHash = null
    const original = JSON.stringify({ type: 'original' })
    const hash = computeEntryHash(prevHash, original)
    const message = new TextEncoder().encode(`${prevHash ?? ''}\n${hash}`)
    const sig = await ed.signAsync(message, PRIVATE_KEY)

    const entry = {
      prevHash,
      hash,
      signature: bytesToHex(sig),
      contentJson: JSON.stringify({ type: 'TAMPERED' }),
    }

    await expect(verifyEntry(entry, null, PUBLIC_KEY_HEX)).rejects.toThrow('hash mismatch')
  })

  it('verifyEntry rejects wrong signature', async () => {
    const content = JSON.stringify({ type: 'test' })
    const hash = computeEntryHash(null, content)

    const entry = {
      prevHash: null,
      hash,
      signature: 'ff'.repeat(64),
      contentJson: content,
    }

    await expect(verifyEntry(entry, null, PUBLIC_KEY_HEX)).rejects.toThrow()
  })

  it('chain of entries: each hash depends on previous', () => {
    const entries = [
      JSON.stringify({ type: 'provider_definition', id: 'p1' }),
      JSON.stringify({ type: 'provider_endpoint', id: 'e1', providerId: 'p1' }),
      JSON.stringify({ type: 'provider_parser', id: 'pr1', providerId: 'p1' }),
    ]

    let prevHash: string | null = null
    const hashes: string[] = []

    for (const content of entries) {
      const hash = computeEntryHash(prevHash, content)
      hashes.push(hash)
      prevHash = hash
    }

    expect(hashes[0]).not.toBe(hashes[1])
    expect(hashes[1]).not.toBe(hashes[2])

    let recomputed: string | null = null
    const recomputedHashes: string[] = []
    for (const content of entries) {
      const hash = computeEntryHash(recomputed, content)
      recomputedHashes.push(hash)
      recomputed = hash
    }

    expect(recomputedHashes).toEqual(hashes)
  })

  it('full signed chain: sign and verify 3 entries', async () => {
    const entries = [
      JSON.stringify({ type: 'provider_definition', id: 'p1', slug: 'gemini' }),
      JSON.stringify({
        type: 'provider_endpoint',
        id: 'e1',
        providerId: 'p1',
        url: 'https://api.gemini.com',
      }),
      JSON.stringify({
        type: 'provider_parser',
        id: 'pr1',
        providerId: 'p1',
        parserName: 'gemini-batch',
      }),
    ]

    let prevHash: string | null = null

    for (const contentJson of entries) {
      const hash = computeEntryHash(prevHash, contentJson)
      const message = new TextEncoder().encode(`${prevHash ?? ''}\n${hash}`)
      const sig = await ed.signAsync(message, PRIVATE_KEY)

      const entry = {
        prevHash,
        hash,
        signature: bytesToHex(sig),
        contentJson,
      }

      const verifiedHash = await verifyEntry(entry, prevHash, PUBLIC_KEY_HEX)
      expect(verifiedHash).toBe(hash)
      prevHash = hash
    }
  })
})
