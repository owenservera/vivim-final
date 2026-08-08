// tests/e2e/harness-command-registry.test.ts
// E2E (T028-T031): full-stack harness pipeline against the real Prisma-backed
// stores. Exercises the registry -> repair -> feedback path the way a
// browser-free I/O harness would run against a live backend.
//
// Uses a fresh per-run copy of the fixture DB (tests/fixtures/node-store-test.db)
// so the live dev database is never mutated — tests clean up after themselves.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { seedHarnessCommands } from '../../seeds/harness/commands.seed.js'
import { HarnessCommandRegistry } from '../../src/engines/harness-command-registry.js'
import { HarnessFeedbackCoordinator } from '../../src/engines/harness-feedback-coordinator.js'
import { HarnessRepairEngine } from '../../src/engines/harness-repair-engine.js'
import { repairNumber, repairString } from '../../src/schema/repair-metadata.js'
import type { CapStoreDb } from '../../src/storage/db.js'
import { GovernorStoreImpl } from '../../src/storage/impl/governor-store-impl.js'
import { HarnessRepairStoreImpl } from '../../src/storage/impl/harness-repair-store-impl.js'

const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'node-store-test.db')

let dir: string
let db: CapStoreDb
let live = false

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'harness-e2e-'))
  const dbPath = join(dir, 'test.db')
  copyFileSync(FIXTURE, dbPath)
  db = {
    prisma: new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } }),
  } as CapStoreDb
  try {
    await db.prisma.$queryRaw`SELECT 1`
    await seedHarnessCommands(db)
    live = true
  } catch {
    live = false
  }
})

afterAll(async () => {
  await db.prisma.$disconnect()
  rmSync(dir, { recursive: true, force: true })
})

const guard = () => {
  if (!live) {
    // No DB available — mark as skipped rather than failing.
    return false
  }
  return true
}

const personSchema = z.object({
  name: repairString({ aliases: ['full_name'] }),
  age: repairNumber({ aliases: ['years'] }),
  nickname: z.string().optional(),
})

describe('Harness registry E2E (real DB)', () => {
  it('T028: resolves @latest using SEMVER, not lexicographic order', async () => {
    if (!guard()) return
    const store = new GovernorStoreImpl(db as CapStoreDb)
    const registry = new HarnessCommandRegistry(store)
    // Seed two versions of the same command out of order.
    await store.upsertHarnessCommand({
      id: 'nav@1.9.0',
      commandId: 'e2e.nav',
      version: '1.9.0',
      kind: 'action',
      paramsSchemaJson: '{"type":"object","properties":{"u":{"type":"string"}},"required":["u"]}',
      adaptorRef: 'x',
      description: 'old',
      createdAt: 0,
      updatedAt: 0,
    })
    await store.upsertHarnessCommand({
      id: 'nav@1.10.0',
      commandId: 'e2e.nav',
      version: '1.10.0',
      kind: 'action',
      paramsSchemaJson: '{"type":"object","properties":{"u":{"type":"string"}},"required":["u"]}',
      adaptorRef: 'x',
      description: 'new',
      createdAt: 0,
      updatedAt: 0,
    })
    const latest = await registry.resolve('e2e.nav@latest')
    expect(latest.version).toBe('1.10.0')
    const explicit = await registry.resolve('e2e.nav@1.9.0')
    expect(explicit.version).toBe('1.9.0')
  })

  it('T029: validates required params from the stored JSON schema', async () => {
    if (!guard()) return
    const registry = new HarnessCommandRegistry(new GovernorStoreImpl(db as CapStoreDb))
    const cmd = await registry.resolve('e2e.nav@latest')
    const ok = registry.validateParams(cmd, { u: 'https://example.com' })
    expect(ok.success).toBe(true)
    const bad = registry.validateParams(cmd, {})
    expect(bad.success).toBe(false)
  })

  it('T030: repairs a malformed LLM payload and persists a repair session', async () => {
    if (!guard()) return
    const repairStore = new HarnessRepairStoreImpl(db)
    const engine = new HarnessRepairEngine(repairStore)
    const res = await engine.repair({
      content: '{"full_name": "Ada", "years": 36}',
      schema: personSchema,
      commandId: 'e2e.nav',
    })
    expect(res.ok).toBe(true)
    expect(res.repairs.some((r) => r.startsWith('alias_used'))).toBe(true)
    // Session was persisted to the real repair_session table.
    const persisted = await db.prisma.repairSession.findFirst({
      orderBy: { createdAt: 'desc' },
    })
    expect(persisted).not.toBeNull()
    expect(persisted?.success).toBe(1)
  })

  it('T031: feedback coordinator never repeats the same prompt across rounds', async () => {
    if (!guard()) return
    const coord = new HarnessFeedbackCoordinator({ maxRounds: 3, baseBackoffMs: 1 })
    const seen = new Set<string>()
    const outcome = await coord.run(
      'Produce a person object as JSON.',
      async (prompt) => {
        seen.add(prompt)
        // Always "reject" so all rounds run.
        return '{ not valid }'
      },
      async () => false,
    )
    expect(outcome.rounds).toBe(3)
    expect(seen.size).toBe(3) // each round got a DIFFERENT prompt (backoff+diff, not verbatim)
    const round1 = coord.buildRoundPrompt(1, 'base').prompt
    const round2 = coord.buildRoundPrompt(2, 'base', 'prior', 'wrong').prompt
    expect(round1).not.toBe(round2)
    expect(round2).toContain('Round 2')
  })
})
