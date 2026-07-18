// tests/unit/schema/repair-metadata.test.ts
// 017-harness-command-registry — repair metadata side-table (FR-008).
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import {
  getRepairMetadata,
  repairBoolean,
  repairNumber,
  repairString,
} from '../../../src/schema/repair-metadata.js'

describe('repair-metadata side-table', () => {
  it('registers and retrieves metadata keyed by Zod type (no prototype mutation)', () => {
    const schema = z.object({ name: repairString({ aliases: ['username'] }) })
    const meta = getRepairMetadata(schema.shape.name)
    expect(meta?.aliases).toEqual(['username'])
    // The Zod prototype is untouched (no .repair method injected).
    expect((z.ZodString.prototype as unknown as Record<string, unknown>).repair).toBeUndefined()
  })

  it('repairString keeps interior apostrophes intact (defect fix vs blind quote swap)', () => {
    const schema = repairString()
    const meta = getRepairMetadata(schema)
    expect(meta).toBeDefined()
    // Apostrophe preservation is a property of the REPAIR ENGINE, but the
    // field builder must not strip it. Verify the raw value passes through.
    const parsed = schema.safeParse("O'Brien")
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe("O'Brien")
  })

  it('repairNumber coerces from string', () => {
    const schema = repairNumber()
    expect(schema.safeParse('42').success).toBe(true)
    const meta = getRepairMetadata(schema)
    expect(meta?.coerceFrom?.length).toBeGreaterThan(0)
  })

  it('repairBoolean coerces and defaults', () => {
    const schema = repairBoolean({ default: false })
    const parsed = schema.safeParse(undefined)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toBe(false)
  })
})
