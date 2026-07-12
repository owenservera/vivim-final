import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { CapabilityShapeRegistry } from '../../../src/engines/capability-shape-registry.js'
import { ProviderDiscoveryEngine } from '../../../src/engines/provider-discovery.js'

function makeGovernor() {
  const domJson = JSON.stringify({
    url: 'https://chat.example.com',
    title: 'Chat',
    forms: 0,
    inputs: [],
    buttons: [{ text: 'Send', selector: 'button' }],
    textareas: 1,
    hasCodeEditor: false,
    hasCanvas: false,
  })
  return {
    ensureRunning: mock(() => Promise.resolve({ slaveId: 's1' })),
    cdp: {
      send: mock(async (_slaveId: string, _method: string, params?: Record<string, unknown>) => {
        const expr = (params as any)?.expression as string | undefined
        if (expr === 'document.readyState') {
          return { result: { value: 'complete' } }
        }
        return { result: { value: domJson } }
      }),
    },
  } as any
}

function makeEventBus() {
  return { emit: mock(() => {}) } as any
}

describe('ProviderDiscoveryEngine', () => {
  let governor: ReturnType<typeof makeGovernor>
  let shapeRegistry: CapabilityShapeRegistry
  let eventBus: ReturnType<typeof makeEventBus>
  let engine: ProviderDiscoveryEngine

  beforeEach(() => {
    governor = makeGovernor()
    shapeRegistry = new CapabilityShapeRegistry()
    eventBus = makeEventBus()
    engine = new ProviderDiscoveryEngine(governor, shapeRegistry, null, null, null, eventBus)
  })

  test('discover navigates and probes DOM', async () => {
    const session = await engine.discover('https://chat.example.com')
    expect(session.status).toBe('complete')
    expect(session.manifestDraft).not.toBeNull()
    expect(session.detectedCapabilities).toContain('send_message')
    expect(eventBus.emit).toHaveBeenCalled()
  })

  test('discover sets status to failed on error', async () => {
    governor.cdp.send.mockRejectedValueOnce(new Error('CDP error'))
    const session = await engine.discover('https://example.com')
    expect(session.status).toBe('failed')
    expect(session.error).toContain('CDP error')
  })

  test('getDiscoverySession returns known session', async () => {
    const session = await engine.discover('https://chat.example.com')
    const retrieved = await engine.getDiscoverySession(session.id)
    expect(retrieved?.id).toBe(session.id)
  })

  test('getDiscoverySession returns null for unknown', async () => {
    const result = await engine.getDiscoverySession('unknown')
    expect(result).toBeNull()
  })

  test('approveDiscovery throws for unknown session', async () => {
    await expect(engine.approveDiscovery('unknown')).rejects.toThrow('not found')
  })

  test('approveDiscovery returns providerId', async () => {
    const session = await engine.discover('https://chat.example.com')
    const result = await engine.approveDiscovery(session.id)
    expect(result.providerId).toBeTruthy()
    expect(result.version).toBe(1)
  })

  test('approveDiscovery throws for incomplete session', async () => {
    const session = await engine.discover('https://chat.example.com')
    const sessions = (engine as any).sessions as Map<string, any>
    const s = sessions.get(session.id)
    if (s) s.status = 'navigating'
    await expect(engine.approveDiscovery(session.id)).rejects.toThrow('not complete')
  })

  test('approveDiscovery applies edits', async () => {
    const session = await engine.discover('https://chat.example.com')
    const result = await engine.approveDiscovery(session.id, { slug: 'custom-slug' })
    expect(result.providerId).toBe('custom-slug')
  })
})
