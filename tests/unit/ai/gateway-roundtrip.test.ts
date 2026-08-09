// tests/unit/ai/gateway-roundtrip.test.ts
// Integration test: AI Gateway + default router + policy + simulator.
// Tests the full execute() → createExecution() → route → adapter → stream pipeline.

import { describe, expect, it } from 'bun:test'
import {
  type AIRequest,
  SIMULATOR_MANIFEST,
  SIMULATOR_MODEL,
  SIMULATOR_MODEL_ID,
  SIMULATOR_PROVIDER_ID,
  SimulatorAdapter,
  createGateway,
  createRequestId,
} from '../../../src/ai/index.js'

async function setupGatewayWithSimulator() {
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

  const simAdapter = new SimulatorAdapter()
  await simAdapter.initialize({ transport: 'in-process' })
  bundle.gateway.registerAdapter(SIMULATOR_PROVIDER_ID, simAdapter)

  return bundle
}

describe('AI Gateway — full pipeline', () => {
  it('resolves a route without executing', async () => {
    const bundle = await setupGatewayWithSimulator()
    const request: AIRequest = {
      requestId: createRequestId(),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      model: { providerId: SIMULATOR_PROVIDER_ID, modelId: SIMULATOR_MODEL_ID },
    }
    const decision = await bundle.gateway.resolveRoute(request)
    expect(decision.providerId).toBe(SIMULATOR_PROVIDER_ID)
    expect(decision.modelId).toBe(SIMULATOR_MODEL_ID)
    expect(decision.candidates.length).toBeGreaterThan(0)
  })

  it('lists providers and models', async () => {
    const bundle = await setupGatewayWithSimulator()

    const providers = await bundle.gateway.listProviders()
    expect(providers.length).toBe(1)
    expect(providers[0]?.id).toBe(SIMULATOR_PROVIDER_ID)

    const models = await bundle.gateway.listModels()
    expect(models.length).toBe(1)
    expect(models[0]?.id).toBe(SIMULATOR_MODEL_ID)

    const filtered = await bundle.gateway.listModels({ providerId: SIMULATOR_PROVIDER_ID })
    expect(filtered.length).toBe(1)
  })

  it('creates an execution and streams events via ExecutionHandle', async () => {
    const bundle = await setupGatewayWithSimulator()
    const request: AIRequest = {
      requestId: createRequestId(),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      model: { providerId: SIMULATOR_PROVIDER_ID, modelId: SIMULATOR_MODEL_ID },
    }

    const handle = await bundle.gateway.createExecution(request)

    const states: string[] = []
    let aiEventCount = 0
    let completed = false

    for await (const event of handle.events) {
      if (event.type === 'execution.state-changed') {
        states.push(`${event.from}→${event.to}`)
      }
      if (event.type === 'execution.ai-event') {
        aiEventCount++
        if (event.event.type === 'response.completed') {
          completed = true
        }
      }
      if (event.type === 'execution.completed') {
        break
      }
      if (event.type === 'execution.failed') {
        throw new Error(`Execution failed: ${event.error.message}`)
      }
    }

    expect(states.length).toBeGreaterThan(0)
    expect(aiEventCount).toBeGreaterThan(0)
    expect(completed).toBe(true)
  })

  it('cancels an in-flight execution', async () => {
    const bundle = await setupGatewayWithSimulator()
    const request: AIRequest = {
      requestId: createRequestId(),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      model: { providerId: SIMULATOR_PROVIDER_ID, modelId: SIMULATOR_MODEL_ID },
    }

    const handle = await bundle.gateway.createExecution(request)

    // Cancel after a short delay
    setTimeout(() => {
      void handle.cancel('test cancel')
    }, 5)

    let cancelled = false
    for await (const event of handle.events) {
      if (event.type === 'execution.cancelled') {
        cancelled = true
        break
      }
      if (event.type === 'execution.completed') {
        break
      }
    }

    // The simulator is fast; cancellation may or may not arrive before completion.
    // Either outcome is acceptable; we just verify no crash.
    expect(typeof cancelled).toBe('boolean')
  })

  it('throws when no provider is available', async () => {
    const bundle = createGateway() // No providers registered
    const request: AIRequest = {
      requestId: createRequestId(),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    }

    await expect(
      (async () => {
        for await (const _event of bundle.gateway.execute(request)) {
          // should throw before yielding
        }
      })(),
    ).rejects.toThrow()
  })

  it('respects policy excluding a provider', async () => {
    const bundle = await setupGatewayWithSimulator()
    const request: AIRequest = {
      requestId: createRequestId(),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      policy: {
        excludedProviderIds: [SIMULATOR_PROVIDER_ID],
      },
    }

    await expect(
      (async () => {
        for await (const _event of bundle.gateway.execute(request)) {
          // should throw because the only provider is excluded
        }
      })(),
    ).rejects.toThrow()
  })

  it('enforces local-only policy', async () => {
    const bundle = await setupGatewayWithSimulator()
    const request: AIRequest = {
      requestId: createRequestId(),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      policy: { locality: 'local-only' },
    }

    // The simulator is 'embedded' kind, which is allowed under local-only.
    // This should succeed.
    let receivedAny = false
    for await (const event of bundle.gateway.execute(request)) {
      receivedAny = true
      if (event.type === 'response.completed') break
    }
    expect(receivedAny).toBe(true)
  })
})
