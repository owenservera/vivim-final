// tests/unit/engines/consent-engine.test.ts
import { describe, expect, it } from 'bun:test'
import { ConsentEngine } from '../../../src/engines/consent-engine.js'
import { ConsentViolationError } from '../../../src/errors.js'

describe('ConsentEngine', () => {
  describe('check()', () => {
    it('allows read operations with default config (requireApprovalAbove: write)', async () => {
      const engine = new ConsentEngine()
      const result = await engine.check({ classification: 'read', target: 'test' })
      expect(result).toBe(true)
    })

    it('denies financial operations with default config', async () => {
      const engine = new ConsentEngine()
      const result = await engine.check({ classification: 'financial', target: 'test' })
      expect(result).toBe(false)
    })

    it('denies destructive operations with default config', async () => {
      const engine = new ConsentEngine()
      const result = await engine.check({ classification: 'destructive', target: 'test' })
      expect(result).toBe(false)
    })

    it('denies communication operations with default config', async () => {
      const engine = new ConsentEngine()
      const result = await engine.check({ classification: 'communication', target: 'test' })
      expect(result).toBe(false)
    })

    it('allows write operations with requireApprovalAbove: write', async () => {
      const engine = new ConsentEngine({ requireApprovalAbove: 'write' })
      const result = await engine.check({ classification: 'write', target: 'test' })
      expect(result).toBe(true)
    })

    it('denies write operations with requireApprovalAbove: read', async () => {
      const engine = new ConsentEngine({ requireApprovalAbove: 'read' })
      const result = await engine.check({ classification: 'write', target: 'test' })
      expect(result).toBe(false)
    })
  })

  describe('grant() + check()', () => {
    it('allows previously-denied operation after grant', async () => {
      const engine = new ConsentEngine()

      const before = await engine.check({ classification: 'financial', target: 'provider-a' })
      expect(before).toBe(false)

      await engine.grant({ classification: 'financial', target: 'provider-a' }, 60_000)

      const after = await engine.check({ classification: 'financial', target: 'provider-a' })
      expect(after).toBe(true)
    })

    it('grant on one target does not affect another target', async () => {
      const engine = new ConsentEngine()

      await engine.grant({ classification: 'financial', target: 'provider-a' }, 60_000)

      const allowed = await engine.check({ classification: 'financial', target: 'provider-a' })
      expect(allowed).toBe(true)

      const denied = await engine.check({ classification: 'financial', target: 'provider-b' })
      expect(denied).toBe(false)
    })

    it('grant expires after duration', async () => {
      const engine = new ConsentEngine()

      await engine.grant({ classification: 'financial', target: 'provider-a' }, 1) // 1ms

      // Wait past expiry
      await new Promise((r) => setTimeout(r, 5))

      const result = await engine.check({ classification: 'financial', target: 'provider-a' })
      expect(result).toBe(false)
    })
  })

  describe('revoke()', () => {
    it('denies after revoke', async () => {
      const engine = new ConsentEngine()

      await engine.grant({ classification: 'financial', target: 'provider-a' }, 60_000)
      const before = await engine.check({ classification: 'financial', target: 'provider-a' })
      expect(before).toBe(true)

      await engine.revoke('provider-a')

      const after = await engine.check({ classification: 'financial', target: 'provider-a' })
      expect(after).toBe(false)
    })
  })

  describe('require()', () => {
    it('does not throw when allowed', async () => {
      const engine = new ConsentEngine()
      await engine.grant({ classification: 'financial', target: 'test' }, 60_000)
      await expect(
        engine.require({ classification: 'financial', target: 'test' }),
      ).resolves.toBeUndefined()
    })

    it('throws ConsentViolationError when denied', async () => {
      const engine = new ConsentEngine()
      await expect(
        engine.require({ classification: 'financial', target: 'test' }),
      ).rejects.toBeInstanceOf(ConsentViolationError)
    })
  })

  describe('isRestricted()', () => {
    it('read is not restricted with default config', () => {
      const engine = new ConsentEngine()
      expect(engine.isRestricted('read')).toBe(false)
    })

    it('write is not restricted with default config', () => {
      const engine = new ConsentEngine()
      expect(engine.isRestricted('write')).toBe(false)
    })

    it('financial is restricted with default config', () => {
      const engine = new ConsentEngine()
      expect(engine.isRestricted('financial')).toBe(true)
    })

    it('destructive is restricted with default config', () => {
      const engine = new ConsentEngine()
      expect(engine.isRestricted('destructive')).toBe(true)
    })
  })

  describe('listActiveGrants()', () => {
    it('returns active grants', async () => {
      const engine = new ConsentEngine()
      await engine.grant({ classification: 'financial', target: 'a' }, 60_000)
      await engine.grant({ classification: 'destructive', target: 'b' }, 60_000)

      const active = engine.listActiveGrants()
      expect(active.length).toBe(2)
    })

    it('excludes expired grants', async () => {
      const engine = new ConsentEngine()
      await engine.grant({ classification: 'financial', target: 'a' }, 1)
      await new Promise((r) => setTimeout(r, 5))

      const active = engine.listActiveGrants()
      expect(active.length).toBe(0)
    })
  })
})
