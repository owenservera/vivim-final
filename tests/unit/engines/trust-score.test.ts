// tests/unit/engines/trust-score.test.ts
import { describe, expect, it } from 'bun:test'
import { TrustScoreEngine } from '../../../src/engines/trust-score.js'
import type { CapStoreDb } from '../../../src/storage/db.js'

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    outcome: {
      findMany: () => Promise.resolve(overrides.outcomes ?? []),
    },
    selectorStrategy: {
      findMany: () => Promise.resolve(overrides.selectors ?? []),
    },
    circuitBreakerState: {
      findMany: () => Promise.resolve(overrides.circuits ?? []),
    },
    providerAccount: {
      findMany: () => Promise.resolve(overrides.accounts ?? []),
    },
    manifestDrift: {
      findMany: () => Promise.resolve(overrides.drifts ?? []),
    },
  }
}

function makeDb(overrides: Record<string, unknown> = {}): CapStoreDb {
  return { prisma: mockPrisma(overrides) } as unknown as CapStoreDb
}

function ok(durationMs?: number) {
  return { ok: true, durationMs: durationMs ?? null }
}
function fail(durationMs?: number) {
  return { ok: false, durationMs: durationMs ?? null }
}

describe('TrustScoreEngine', () => {
  describe('computeProviderScore()', () => {
    it('returns high score for a perfect provider', async () => {
      const db = makeDb({
        outcomes: [ok(200), ok(300), ok(250), ok(400), ok(350)],
        selectors: [{ hitCount: 100, missCount: 0 }],
        circuits: [],
        accounts: [{ lastLoginAt: Date.now() }],
        drifts: [],
      })
      const engine = new TrustScoreEngine(db)
      const report = await engine.computeProviderScore('perfect-prov')
      expect(report.overallScore).toBeGreaterThanOrEqual(90)
      expect(report.factors.length).toBe(6)
      expect(report.providerId).toBe('perfect-prov')
    })

    it('returns low score for a failing provider', async () => {
      const db = makeDb({
        outcomes: [fail(), fail(), fail(), fail(), fail()],
        selectors: [{ hitCount: 0, missCount: 100 }],
        circuits: [{ slaveId: 'slave:bad-prov:1', state: 'open' }],
        accounts: [],
        drifts: [
          { resolved: 0 },
          { resolved: 0 },
          { resolved: 0 },
          { resolved: 0 },
          { resolved: 0 },
          { resolved: 0 },
          { resolved: 0 },
          { resolved: 0 },
          { resolved: 0 },
          { resolved: 0 },
        ],
      })
      const engine = new TrustScoreEngine(db)
      const report = await engine.computeProviderScore('bad-prov')
      expect(report.overallScore).toBeLessThanOrEqual(30)
    })

    it('returns mid-range score for a mixed provider', async () => {
      const db = makeDb({
        outcomes: [ok(), fail(), ok(), fail(), ok()],
        selectors: [{ hitCount: 50, missCount: 50 }],
        circuits: [],
        accounts: [{ lastLoginAt: Date.now() }],
        drifts: [{ resolved: 0 }, { resolved: 0 }],
      })
      const engine = new TrustScoreEngine(db)
      const report = await engine.computeProviderScore('mixed-prov')
      expect(report.overallScore).toBeGreaterThanOrEqual(25)
      expect(report.overallScore).toBeLessThanOrEqual(80)
    })

    it('returns default 50 for provider with no outcome data', async () => {
      const db = makeDb({
        outcomes: [],
        selectors: [],
        circuits: [],
        accounts: [],
        drifts: [],
      })
      const engine = new TrustScoreEngine(db)
      const report = await engine.computeProviderScore('no-data-prov')
      expect(report.overallScore).toBeGreaterThanOrEqual(40)
      expect(report.overallScore).toBeLessThanOrEqual(70)
    })
  })

  describe('computeOperationScore()', () => {
    it('returns 100 for all-success operation', async () => {
      const db = makeDb({
        outcomes: [ok(), ok(), ok()],
      })
      const engine = new TrustScoreEngine(db)
      const score = await engine.computeOperationScore('prov', 'cap:test:send')
      expect(score).toBe(100)
    })

    it('returns 0 for all-failure operation', async () => {
      const db = makeDb({
        outcomes: [fail(), fail()],
      })
      const engine = new TrustScoreEngine(db)
      const score = await engine.computeOperationScore('prov', 'cap:test:send')
      expect(score).toBe(0)
    })

    it('returns 50 for no data', async () => {
      const db = makeDb({ outcomes: [] })
      const engine = new TrustScoreEngine(db)
      const score = await engine.computeOperationScore('prov', 'cap:test:send')
      expect(score).toBe(50)
    })
  })
})
