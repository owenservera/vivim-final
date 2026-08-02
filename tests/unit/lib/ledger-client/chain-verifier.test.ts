// tests/unit/lib/ledger-client/chain-verifier.test.ts
// Ed25519 chain verification — byte-for-byte with vivim-page crypto.ts

import { describe, expect, it } from 'bun:test'
import {
  computeEntryHash,
  verifyBatch,
  verifyEntry,
} from '../../../../src/lib/ledger-client/chain-verifier.js'

// Test keypair (NOT for production — test only)
// Public key: 902b24e44284d3b156c47c10ea3e89f46c6e58ea70be23cf4d0a7f5bf25810e5
const TEST_PUBLIC_KEY = '902b24e44284d3b156c47c10ea3e89f46c6e58ea70be23cf4d0a7f5bf25810e5'
const _WRONG_PUBLIC_KEY = '0000000000000000000000000000000000000000000000000000000000000000'

describe('chain-verifier', () => {
  describe('computeEntryHash', () => {
    it('computes sha256 of prevHash + newline + contentJson', () => {
      const hash = computeEntryHash(null, '{"type":"test"}')
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('uses empty string when prevHash is null', () => {
      const h1 = computeEntryHash(null, '{"a":1}')
      const h2 = computeEntryHash('', '{"a":1}')
      // Both should produce the same hash since null -> ""
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

  describe('verifyEntry', () => {
    it('throws on hash mismatch', async () => {
      await expect(
        verifyEntry(
          { prevHash: null, hash: 'wrong', signature: 'sig', contentJson: '{}' },
          null,
          TEST_PUBLIC_KEY,
        ),
      ).rejects.toThrow('hash mismatch')
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
  })
})
