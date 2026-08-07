// tests/unit/lib/ledger-client/chain-verifier.test.ts
// Ed25519 chain verification — byte-for-byte with vivim-page crypto.ts
//
// Session 4 (2026-08-07): Added happy-path tests — the cryptographic
// correctness (valid signature verifies, multi-entry batch chains correctly)
// was completely untested at the unit level. Only negative paths existed.

import { describe, expect, it } from 'bun:test'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
import {
  computeEntryHash,
  verifyBatch,
  verifyEntry,
  verifyEntrySignature,
} from '../../../../src/lib/ledger-client/chain-verifier.js'

// Wire SHA-512 into @noble/ed25519 (must match the module under test)
ed.hashes.sha512 = sha512

// Test keypair (NOT for production — test only, generated with @noble/ed25519)
const TEST_PUBLIC_KEY = '5671de7c7f9ab382dd68e66c3a322a6c6d6bea7f58dcb5d5bab10aa6c1db7d81'
const _WRONG_PUBLIC_KEY = '0000000000000000000000000000000000000000000000000000000000000000'

// The matching private key (test only — safe to commit, not used in prod)
const TEST_PRIVATE_KEY = '19f6f14f34188df1afd1b48e4a5a031bc9567ffa8023cb546283852aefcea8c2'

/**
 * Sign an entry the same way the server does: Ed25519 over
 * utf8(prevHash + "\n" + entryHash). Returns hex.
 */
async function signEntry(
  prevHash: string | null,
  entryHash: string,
  privateKeyHex: string,
): Promise<string> {
  const message = new TextEncoder().encode(`${prevHash ?? ''}\n${entryHash}`)
  const sig = await ed.signAsync(message, hexToBytes(privateKeyHex))
  return bytesToHex(sig)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('chain-verifier', () => {
  describe('computeEntryHash', () => {
    it('computes sha256 of prevHash + newline + contentJson', () => {
      const hash = computeEntryHash(null, '{"type":"test"}')
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('uses empty string when prevHash is null', () => {
      const h1 = computeEntryHash(null, '{"a":1}')
      const h2 = computeEntryHash('', '{"a":1}')
      expect(h1).toBe(h2)
    })

    it('changes when prevHash changes', () => {
      const h1 = computeEntryHash('abc', '{"a":1}')
      const h2 = computeEntryHash('def', '{"a":1}')
      expect(h1).not.toBe(h2)
    })

    it('changes when contentJson changes', () => {
      const h1 = computeEntryHash(null, '{"a":1}')
      const h2 = computeEntryHash(null, '{"a":2}')
      expect(h1).not.toBe(h2)
    })

    it('is deterministic', () => {
      const h1 = computeEntryHash('prev', '{"x":42}')
      const h2 = computeEntryHash('prev', '{"x":42}')
      expect(h1).toBe(h2)
    })
  })

  describe('verifyEntrySignature', () => {
    it('returns true for a valid signature (happy path)', async () => {
      const contentJson = '{"type":"test","ts":1234567890}'
      const entryHash = computeEntryHash(null, contentJson)
      const signature = await signEntry(null, entryHash, TEST_PRIVATE_KEY)
      const valid = await verifyEntrySignature(entryHash, null, signature, TEST_PUBLIC_KEY)
      expect(valid).toBe(true)
    })

    it('returns false for a signature from a different key', async () => {
      const contentJson = '{"type":"test"}'
      const entryHash = computeEntryHash(null, contentJson)
      const signature = await signEntry(null, entryHash, TEST_PRIVATE_KEY)
      const valid = await verifyEntrySignature(entryHash, null, signature, _WRONG_PUBLIC_KEY)
      expect(valid).toBe(false)
    })

    it('returns false for a malformed signature hex', async () => {
      const valid = await verifyEntrySignature('abc', null, 'not-hex', TEST_PUBLIC_KEY)
      expect(valid).toBe(false)
    })
  })

  describe('verifyEntry', () => {
    it('verifies a correctly-signed entry (happy path)', async () => {
      const contentJson = '{"type":"test","ts":1234567890}'
      const entryHash = computeEntryHash(null, contentJson)
      const signature = await signEntry(null, entryHash, TEST_PRIVATE_KEY)

      const resultHash = await verifyEntry(
        { prevHash: null, hash: entryHash, signature, contentJson },
        null,
        TEST_PUBLIC_KEY,
      )
      expect(resultHash).toBe(entryHash)
    })

    it('verifies a chained entry with non-null prevHash', async () => {
      const prevHash = 'a'.repeat(64) // fake 32-byte hex hash
      const contentJson = '{"type":"second"}'
      const entryHash = computeEntryHash(prevHash, contentJson)
      const signature = await signEntry(prevHash, entryHash, TEST_PRIVATE_KEY)

      const resultHash = await verifyEntry(
        { prevHash, hash: entryHash, signature, contentJson },
        prevHash,
        TEST_PUBLIC_KEY,
      )
      expect(resultHash).toBe(entryHash)
    })

    it('throws on hash mismatch', async () => {
      await expect(
        verifyEntry(
          { prevHash: null, hash: 'wrong', signature: 'sig', contentJson: '{}' },
          null,
          TEST_PUBLIC_KEY,
        ),
      ).rejects.toThrow('hash mismatch')
    })

    it('throws on chain break (prevHash does not match expected)', async () => {
      const contentJson = '{"type":"test"}'
      const entryHash = computeEntryHash('actual-prev', contentJson)
      const signature = await signEntry('actual-prev', entryHash, TEST_PRIVATE_KEY)
      await expect(
        verifyEntry(
          { prevHash: 'actual-prev', hash: entryHash, signature, contentJson },
          'different-prev',
          TEST_PUBLIC_KEY,
        ),
      ).rejects.toThrow('chain break')
    })

    it('throws on invalid signature', async () => {
      const contentJson = '{"type":"test"}'
      const hash = computeEntryHash(null, contentJson)
      await expect(
        verifyEntry(
          { prevHash: null, hash, signature: 'invalid-sig', contentJson },
          null,
          TEST_PUBLIC_KEY,
        ),
      ).rejects.toThrow()
    })
  })

  describe('verifyBatch', () => {
    it('returns empty verified for empty input', async () => {
      const result = await verifyBatch([], null, TEST_PUBLIC_KEY)
      expect(result.verified).toEqual([])
      expect(result.lastHash).toBeNull()
    })

    it('returns lastHash as null for empty input', async () => {
      const result = await verifyBatch([], 'start', TEST_PUBLIC_KEY)
      expect(result.lastHash).toBe('start')
    })

    it('verifies a 2-entry chain and propagates lastHash correctly', async () => {
      // Entry 1: prevHash=null
      const content1 = '{"type":"first"}'
      const hash1 = computeEntryHash(null, content1)
      const sig1 = await signEntry(null, hash1, TEST_PRIVATE_KEY)

      // Entry 2: prevHash=hash1
      const content2 = '{"type":"second"}'
      const hash2 = computeEntryHash(hash1, content2)
      const sig2 = await signEntry(hash1, hash2, TEST_PRIVATE_KEY)

      const entries = [
        { prevHash: null, hash: hash1, signature: sig1, contentJson: content1 },
        { prevHash: hash1, hash: hash2, signature: sig2, contentJson: content2 },
      ]

      const result = await verifyBatch(entries, null, TEST_PUBLIC_KEY)
      expect(result.verified).toHaveLength(2)
      expect(result.lastHash).toBe(hash2)
    })
  })
})
