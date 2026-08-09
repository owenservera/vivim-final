// tests/unit/ai/simulator-roundtrip.test.ts
// Round-trip test: AI Gateway + in-memory impls + SimulatorAdapter.
// Validates the full pipeline: createGateway() → register simulator → execute request → stream events.

import { describe, expect, it } from 'bun:test'
import { isVivimAIError } from '../../../src/ai/core/errors.js'
import {
  SIMULATOR_MANIFEST,
  SIMULATOR_MODEL,
  SIMULATOR_MODEL_ID,
  SIMULATOR_PROVIDER_ID,
  SimulatorAdapter,
  createGateway,
  createRequestId,
} from '../../../src/ai/index.js'

describe('AI Gateway — simulator round-trip', () => {
  it('creates a gateway with in-memory defaults', () => {
    const bundle = createGateway()
    expect(bundle.gateway).toBeDefined()
    expect(bundle.eventBus).toBeDefined()
    expect(bundle.executionManager).toBeDefined()
    expect(bundle.providerRegistry).toBeDefined()
    expect(bundle.modelRegistry).toBeDefined()
    expect(bundle.router).toBeDefined()
    expect(bundle.policyEvaluator).toBeDefined()
    expect(bundle.policyEnforcer).toBeDefined()
    expect(bundle.supervisor).toBeDefined()
    expect(bundle.resourceManager).toBeDefined()
  })

  it('registers the simulator provider and model', async () => {
    const bundle = createGateway()
    await bundle.providerRegistry.register(SIMULATOR_MANIFEST)
    // Full legal path: discovered → installed → validating → enabled → starting → ready → active
    for (const state of [
      'installed',
      'validating',
      'enabled',
      'starting',
      'ready',
      'active',
    ] as const) {
      await bundle.providerRegistry.setState(SIMULATOR_PROVIDER_ID, state)
    }
    await bundle.modelRegistry.register(SIMULATOR_MODEL)

    const providers = await bundle.providerRegistry.list()
    expect(providers.length).toBe(1)
    expect(providers[0]?.id).toBe(SIMULATOR_PROVIDER_ID)

    const available = await bundle.providerRegistry.listAvailable()
    expect(available.length).toBe(1)

    const models = await bundle.modelRegistry.list()
    expect(models.length).toBe(1)
    expect(models[0]?.id).toBe(SIMULATOR_MODEL_ID)
  })

  it('streams AIEvents from the simulator through the gateway', async () => {
    const bundle = createGateway()

    // Register simulator — full legal path
    await bundle.providerRegistry.register(SIMULATOR_MANIFEST)
    for (const state of [
      'installed',
      'validating',
      'enabled',
      'starting',
      'ready',
      'active',
    ] as const) {
      await bundle.providerRegistry.setState(SIMULATOR_PROVIDER_ID, state)
    }
    await bundle.modelRegistry.register(SIMULATOR_MODEL)

    // Initialize the simulator adapter
    const simAdapter = new SimulatorAdapter()
    await simAdapter.initialize({ transport: 'in-process' })
    bundle.gateway.registerAdapter(SIMULATOR_PROVIDER_ID, simAdapter)

    // Execute a request
    const request = {
      requestId: createRequestId(),
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Hello, simulator!' }],
        },
      ],
      model: { providerId: SIMULATOR_PROVIDER_ID, modelId: SIMULATOR_MODEL_ID },
    }

    const events: string[] = []
    let totalText = ''
    let completed = false

    for await (const event of bundle.gateway.execute(request)) {
      events.push(event.type)
      if (event.type === 'output.text.delta') {
        totalText += event.text
      }
      if (event.type === 'response.completed') {
        completed = true
      }
    }

    // Should have received: request.started, response.started, output.text.delta(s), usage.updated, response.completed
    expect(events[0]).toBe('request.started')
    expect(events[1]).toBe('response.started')
    expect(events.includes('output.text.delta')).toBe(true)
    expect(events.includes('usage.updated')).toBe(true)
    expect(events[events.length - 1]).toBe('response.completed')
    expect(completed).toBe(true)
    expect(totalText.length).toBeGreaterThan(0)
  })

  it('rejects illegal provider state transitions', async () => {
    const bundle = createGateway()
    await bundle.providerRegistry.register(SIMULATOR_MANIFEST)
    // Initial state is 'discovered'. Try an illegal jump to 'active'.
    await expect(bundle.providerRegistry.setState(SIMULATOR_PROVIDER_ID, 'active')).rejects.toThrow(
      /Illegal provider state transition/,
    )
  })

  it('rejects illegal execution state transitions', async () => {
    const bundle = createGateway()
    const request = {
      requestId: createRequestId(),
      messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }] }],
    }
    const handle = await bundle.executionManager.create(request)
    // Try an illegal transition: queued → completed (must go through routing → starting → executing first)
    await expect(
      bundle.executionManager.transition(handle.executionId, 'completed'),
    ).rejects.toThrow(/Illegal execution transition/)
  })

  it('VivimAIError is detectable via isVivimAIError', async () => {
    const { AI_ERRORS } = await import('../../../src/ai/core/errors.js')
    const err = AI_ERRORS.timeout(5000)
    expect(isVivimAIError(err)).toBe(true)
    expect(err.code).toBe('TIMEOUT')
    expect(err.retryable).toBe(true)
  })

  it('event bus delivers events to subscribers', async () => {
    const bundle = createGateway()
    const received: string[] = []

    // Subscribe
    const iter = bundle.eventBus.subscribe((event) => event.type === 'provider.state-changed')
    const consumePromise = (async () => {
      for await (const event of iter) {
        received.push((event as { type: string }).type)
        if (received.length >= 1) break
      }
    })()

    // Publish an event
    await bundle.providerRegistry.register(SIMULATOR_MANIFEST)
    // Full legal path
    await bundle.providerRegistry.setState(SIMULATOR_PROVIDER_ID, 'installed')
    await bundle.providerRegistry.setState(SIMULATOR_PROVIDER_ID, 'validating')
    await bundle.providerRegistry.setState(SIMULATOR_PROVIDER_ID, 'enabled')

    // Wait for delivery
    await consumePromise

    expect(received.length).toBeGreaterThan(0)
    expect(received[0]).toBe('provider.state-changed')
  })
})
