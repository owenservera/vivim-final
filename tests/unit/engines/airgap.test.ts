// tests/unit/engines/airgap.test.ts
// AirGapEngine — offline mode + local model fallback tests

import { describe, expect, test } from 'bun:test'
import { type AirGapConfig, AirGapEngine } from '../../../src/engines/airgap.js'

function makeConfig(overrides?: Partial<AirGapConfig>): AirGapConfig {
  return {
    enabled: false,
    localModelEndpoint: 'http://localhost:11434',
    localModelProvider: 'ollama',
    ...overrides,
  }
}

describe('AirGapEngine', () => {
  test('enable/disable toggles airGapMode', async () => {
    const engine = new AirGapEngine(makeConfig({ enabled: false }))
    let status = await engine.getStatus()
    expect(status.isAirGapMode).toBe(false)
    await engine.enable()
    status = await engine.getStatus()
    expect(status.isAirGapMode).toBe(true)
    await engine.disable()
    status = await engine.getStatus()
    expect(status.isAirGapMode).toBe(false)
  })

  test('routeToLocalModel returns error when disabled', async () => {
    const engine = new AirGapEngine(makeConfig({ enabled: false }))
    const result = await engine.routeToLocalModel('hello')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('disabled')
  })

  test('routeToLocalModel returns error when local model unavailable', async () => {
    const engine = new AirGapEngine(
      makeConfig({
        enabled: true,
        localModelEndpoint: 'http://localhost:19999', // unreachable
      }),
    )
    const result = await engine.routeToLocalModel('hello')
    expect(result.ok).toBe(false)
  })

  test('checkNetwork returns boolean', async () => {
    const engine = new AirGapEngine(makeConfig())
    const reachable = await engine.checkNetwork()
    expect(typeof reachable).toBe('boolean')
  })

  test('checkLocalModel returns false when endpoint unreachable', async () => {
    const engine = new AirGapEngine(
      makeConfig({
        localModelEndpoint: 'http://localhost:19999',
      }),
    )
    const available = await engine.checkLocalModel()
    expect(available).toBe(false)
    const status = await engine.getStatus()
    expect(status.localModelAvailable).toBe(false)
  })

  test('getStatus returns cachedResponses count', async () => {
    const engine = new AirGapEngine(makeConfig({ enabled: true }))
    await engine.enable()
    const status = await engine.getStatus()
    expect(status.cachedResponses).toBe(0)
  })
})
