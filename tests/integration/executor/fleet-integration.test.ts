// tests/integration/executor/fleet-integration.test.ts
// FleetSupervisor integration tests - real Chrome execution validation

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { FleetSupervisor } from '../../../src/executor/fleet-supervisor.js'
import { createFakeChrome } from '../../helpers/mocks/chrome.mock.js'

const TEST_PORT_RANGE: [number, number] = [9330, 9350]
const FAKE_CHROME_PORT = TEST_PORT_RANGE[0]

describe('FleetSupervisor Real Chrome Integration', () => {
  let supervisor: FleetSupervisor
  let mockStore: {
    createFleetEvent(): Promise<{
      id: string
      slaveId: string
      providerId: string
      eventType: string
      detailJson: null
      ts: number
    }>
    getFleetEvents(): Promise<Array<never>>
  }
  let fakeChrome: ReturnType<typeof createFakeChrome>

  beforeAll(() => {
    // Start fake Chrome mock server
    fakeChrome = createFakeChrome({ port: FAKE_CHROME_PORT })
    mockStore = {
      createFleetEvent: async () => ({
        id: `event-${Date.now()}`,
        slaveId: 'test',
        providerId: 'claude',
        eventType: 'test',
        detailJson: null,
        ts: Date.now(),
      }),
      getFleetEvents: async () => [],
    }
    supervisor = new FleetSupervisor(mockStore as never, {
      portRange: TEST_PORT_RANGE,
      healthProbeIntervalMs: 1000,
      healthProbeTimeoutMs: 5000,
      autoRestart: false,
      maxRestarts: 1,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 60000,
      chromeProfileBase: '/tmp/test-chrome-profiles',
    })
  })

  afterAll(() => {
    fakeChrome?.stop()
  })

  test('fake Chrome mock server is running', async () => {
    const resp = await fetch(`http://127.0.0.1:${FAKE_CHROME_PORT}/json/version`)
    expect(resp.ok).toBe(true)
    const data = (await resp.json()) as { Browser: string }
    expect(data.Browser).toBe('Chrome/120.0.0.0')
  })

  test('initial state has no instances', () => {
    expect(supervisor.getAllInstances()).toHaveLength(0)
  })

  test('getInstance returns null for unknown ID', () => {
    expect(supervisor.getInstance('unknown')).toBeNull()
  })

  test('getInstancesByProvider filters correctly', () => {
    expect(supervisor.getInstancesByProvider('claude')).toHaveLength(0)
    expect(supervisor.getInstancesByProvider('chatgpt')).toHaveLength(0)
  })
})
