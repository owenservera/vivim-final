// tests/unit/engines/cortex-budget.test.ts
// CortexBudget — token budget allocation + item packing tests

import { describe, expect, test } from 'bun:test'
import {
  allocate,
  applyPressure,
  defaultLayerConfigs,
  type PackItem,
  type PressureSignals,
  packItems,
} from '../../../src/engines/cortex-budget.js'

describe('defaultLayerConfigs', () => {
  test('returns 10 layers with valid shape', () => {
    const cfg = defaultLayerConfigs()
    expect(cfg).toHaveLength(10)
    for (const c of cfg) {
      expect(c.minTokens).toBeLessThanOrEqual(c.idealTokens)
      expect(c.idealTokens).toBeLessThanOrEqual(c.maxTokens)
      expect(c.priority).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('applyPressure', () => {
  const base = defaultLayerConfigs()

  test('squeezes L2Topic under conversation pressure', () => {
    const pressure: PressureSignals = {
      conversationPressure: true,
      entityCount: 0,
      messageHistoryRatio: 0,
    }
    const out = applyPressure(base, pressure)
    const topic = out.find((c) => c.layer === 'L2Topic')!
    expect(topic.idealTokens).toBeLessThan(base.find((c) => c.layer === 'L2Topic')!.idealTokens)
  })

  test('expands L3Entity on high entity count', () => {
    const pressure: PressureSignals = {
      conversationPressure: false,
      entityCount: 50,
      messageHistoryRatio: 0,
    }
    const out = applyPressure(base, pressure)
    const entity = out.find((c) => c.layer === 'L3Entity')!
    expect(entity.idealTokens).toBeGreaterThan(
      base.find((c) => c.layer === 'L3Entity')!.idealTokens,
    )
  })

  test('decays L6RecentHistory when ratio high', () => {
    const pressure: PressureSignals = {
      conversationPressure: false,
      entityCount: 0,
      messageHistoryRatio: 4.0,
    }
    const out = applyPressure(base, pressure)
    const hist = out.find((c) => c.layer === 'L6RecentHistory')!
    expect(hist.idealTokens).toBeLessThan(
      base.find((c) => c.layer === 'L6RecentHistory')!.idealTokens,
    )
  })

  test('does not mutate input', () => {
    const before = JSON.stringify(base)
    applyPressure(base, { conversationPressure: true, entityCount: 100, messageHistoryRatio: 9 })
    expect(JSON.stringify(base)).toBe(before)
  })
})

describe('allocate', () => {
  test('sum of allocations never exceeds budget', () => {
    const layers = defaultLayerConfigs()
    const total = 50000
    const alloc = allocate(total, layers)
    const sum = alloc.reduce((s, a) => s + a.allocatedTokens, 0)
    expect(sum).toBeLessThanOrEqual(total)
  })

  test('guarantees minimums when budget is ample', () => {
    const layers = defaultLayerConfigs()
    const alloc = allocate(100000, layers)
    const sumMin = layers.reduce((s, c) => s + c.minTokens, 0)
    const sum = alloc.reduce((s, a) => s + a.allocatedTokens, 0)
    expect(sum).toBeGreaterThanOrEqual(sumMin)
  })

  test('deficit mode (budget < sumMin) protects fixed layers L7/L0', () => {
    const layers = defaultLayerConfigs()
    const sumMin = layers.reduce((s, c) => s + c.minTokens, 0)
    const alloc = allocate(sumMin - 1000, layers)
    const l7 = alloc.find((a) => a.layer === 'L7UserQuery')!
    const l0 = alloc.find((a) => a.layer === 'L0Identity')!
    expect(l7.allocatedTokens).toBeGreaterThan(0)
    expect(l0.allocatedTokens).toBeGreaterThan(0)
  })

  test('Deep mode increases token ceilings', () => {
    const layers = defaultLayerConfigs()
    const standard = allocate(100000, layers, 'Standard')
    const deep = allocate(100000, layers, 'Deep')
    const deepL4 = deep.find((a) => a.layer === 'L4Conversation')!.allocatedTokens
    const stdL4 = standard.find((a) => a.layer === 'L4Conversation')!.allocatedTokens
    expect(deepL4).toBeGreaterThanOrEqual(stdL4)
  })

  test('Compact mode decreases token ceilings', () => {
    const layers = defaultLayerConfigs()
    const standard = allocate(100000, layers, 'Standard')
    const compact = allocate(100000, layers, 'Compact')
    const compL4 = compact.find((a) => a.layer === 'L4Conversation')!.allocatedTokens
    const stdL4 = standard.find((a) => a.layer === 'L4Conversation')!.allocatedTokens
    expect(compL4).toBeLessThanOrEqual(stdL4)
  })
})

describe('packItems', () => {
  const items: PackItem[] = [
    { layer: 'L4Conversation', score: 0.9, tokens: 100, id: 'a' },
    { layer: 'L4Conversation', score: 0.5, tokens: 100, id: 'b' },
    { layer: 'L7UserQuery', score: 0.1, tokens: 50, id: 'q' },
    { layer: 'L0Identity', score: 0.2, tokens: 50, id: 'i' },
  ]

  test('packs within budget, fixed layers first', () => {
    const packed = packItems(items, 200)
    // fixed layers (identity + query = 100) packed first
    expect(packed.find((p) => p.id === 'i')).toBeDefined()
    expect(packed.find((p) => p.id === 'q')).toBeDefined()
    const used = packed.reduce((s, p) => s + p.tokens, 0)
    expect(used).toBeLessThanOrEqual(200)
  })

  test('within a layer, higher-score items packed first', () => {
    const packed = packItems(items, 1000)
    const conv = packed.filter((p) => p.layer === 'L4Conversation')
    // 'a' (0.9) before 'b' (0.5)
    expect(
      packed.indexOf(conv.find((p) => p.id === 'a')!) <
        packed.indexOf(conv.find((p) => p.id === 'b')!),
    ).toBe(true)
  })

  test('does not exceed budget', () => {
    const big: PackItem[] = [
      { layer: 'L4Conversation', score: 1, tokens: 500, id: 'x' },
      { layer: 'L4Conversation', score: 1, tokens: 500, id: 'y' },
    ]
    const packed = packItems(big, 600)
    expect(packed.reduce((s, p) => s + p.tokens, 0)).toBeLessThanOrEqual(600)
  })
})
