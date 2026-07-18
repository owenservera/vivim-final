// tests/unit/engines/harness-repair-engine.test.ts
// 017-harness-command-registry — HarnessRepairEngine (FR-006, FR-008).
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { HarnessRepairEngine } from '../../../src/engines/harness-repair-engine.js'
import { repairString } from '../../../src/schema/repair-metadata.js'
import type {
  HarnessRepairStore,
  RepairSessionRow,
} from '../../../src/storage/contracts/harness-repair-store.js'

function makeStore(): HarnessRepairStore & { sessions: RepairSessionRow[] } {
  const sessions: RepairSessionRow[] = []
  return {
    sessions,
    async saveRepairSession(row: RepairSessionRow) {
      sessions.push(row)
    },
    async getRepairSession() {
      return null
    },
  }
}

const personSchema = z.object({
  name: repairString({ aliases: ['username'] }),
  age: z.number(),
})

describe('HarnessRepairEngine', () => {
  it('repairs a valid payload directly', async () => {
    const engine = new HarnessRepairEngine(makeStore())
    const res = await engine.repair({
      content: JSON.stringify({ name: 'Ada', age: 36 }),
      schema: personSchema,
    })
    expect(res.ok).toBe(true)
    expect(res.data).toEqual({ name: 'Ada', age: 36 })
  })

  it('preserves interior apostrophes when balancing unbalanced quotes (defect fix)', async () => {
    const engine = new HarnessRepairEngine(makeStore())
    const res = await engine.repair({
      content: "O'Brien",
      schema: repairString(),
    })
    expect(res.ok).toBe(true)
    // The engine does NOT rewrite the apostrophe into a double quote.
    expect(res.data).toBe("O'Brien")
  })

  it('strips a code fence and removes trailing commas', async () => {
    const engine = new HarnessRepairEngine(makeStore())
    const res = await engine.repair({
      content: '```json\n{"name":"Ada","age":36,}\n```',
      schema: personSchema,
    })
    expect(res.ok).toBe(true)
    expect(res.repairs).toContain('stripped_code_fence')
    expect(res.repairs).toContain('removed_trailing_comma')
  })

  it('recovers via alias when primary key missing', async () => {
    const engine = new HarnessRepairEngine(makeStore())
    const res = await engine.repair({
      content: JSON.stringify({ username: 'Ada', age: 36 }),
      schema: personSchema,
    })
    expect(res.ok).toBe(true)
    expect(res.repairs.some((r) => r.startsWith('alias_used'))).toBe(true)
  })

  it('persists a repair session row', async () => {
    const store = makeStore()
    const engine = new HarnessRepairEngine(store)
    await engine.repair({ content: JSON.stringify({ name: 'Ada', age: 36 }), schema: personSchema })
    expect(store.sessions.length).toBe(1)
    expect(store.sessions[0]?.success).toBe(true)
  })
})
