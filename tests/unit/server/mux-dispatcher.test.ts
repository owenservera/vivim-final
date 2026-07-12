import { describe, expect, it, mock } from 'bun:test'

function makeMuxDispatcher(
  convStore: { createConversation: ReturnType<typeof mock> },
  conversationManager: { send: ReturnType<typeof mock> },
  costOptimizer?: { recordCost: ReturnType<typeof mock>; estimateCost: ReturnType<typeof mock> },
) {
  const start = Date.now()
  return {
    async dispatchToProvider(
      providerId: string,
      message: string,
      conversationId?: string,
    ): Promise<{
      ok: boolean
      response: string
      latencyMs: number
      costCents: number
      error?: string
    }> {
      const dispatchStart = Date.now()
      try {
        let convId = conversationId

        if (!convId) {
          const conv = await convStore.createConversation({
            providerSessionId: `mux_${providerId}_${Date.now()}`,
            providerId,
            title: `Mux: ${message.slice(0, 50)}`,
          })
          convId = conv.id
        }

        const result = await conversationManager.send(convId, message)

        const latencyMs = Date.now() - dispatchStart
        const estCost = costOptimizer ? await costOptimizer.estimateCost(providerId, latencyMs) : 0

        if (costOptimizer) {
          await costOptimizer.recordCost(providerId, estCost, 0, 0)
        }

        return {
          ok: result.ok,
          response: result.text || '',
          latencyMs,
          costCents: estCost,
          error: result.error,
        }
      } catch (err: unknown) {
        return {
          ok: false,
          response: '',
          latencyMs: Date.now() - dispatchStart,
          costCents: 0,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  }
}

describe('muxDispatcher real dispatch', () => {
  it('dispatches to a provider and returns real response', async () => {
    const convStore = { createConversation: mock(() => Promise.resolve({ id: 'conv-1' })) }
    const conversationManager = { send: mock(() => Promise.resolve({ ok: true, text: 'Hello back' })) }
    const costOptimizer = {
      recordCost: mock(() => Promise.resolve()),
      estimateCost: mock(() => Promise.resolve(5)),
    }

    const dispatcher = makeMuxDispatcher(convStore, conversationManager, costOptimizer as any)
    const result = await dispatcher.dispatchToProvider('claude', 'hello', undefined)

    expect(result.ok).toBe(true)
    expect(result.response).toBe('Hello back')
    expect(result.costCents).toBeGreaterThan(0)
    expect(convStore.createConversation).toHaveBeenCalled()
    expect(conversationManager.send).toHaveBeenCalledWith('conv-1', 'hello')
  })

  it('creates transient conversation when conversationId is undefined', async () => {
    const convStore = { createConversation: mock(() => Promise.resolve({ id: 'conv-new' })) }
    const conversationManager = { send: mock(() => Promise.resolve({ ok: true, text: 'Response' })) }
    const costOptimizer = {
      recordCost: mock(() => Promise.resolve()),
      estimateCost: mock(() => Promise.resolve(3)),
    }

    const dispatcher = makeMuxDispatcher(convStore, conversationManager, costOptimizer as any)
    await dispatcher.dispatchToProvider('claude', 'hello', undefined)

    expect(convStore.createConversation).toHaveBeenCalledWith({
      providerSessionId: expect.stringContaining('mux_claude'),
      providerId: 'claude',
      title: expect.stringContaining('hello'),
    })
    expect(conversationManager.send).toHaveBeenCalledWith('conv-new', 'hello')
  })

  it('uses existing conversationId when provided', async () => {
    const convStore = { createConversation: mock(() => Promise.resolve({ id: 'conv-ignored' })) }
    const conversationManager = { send: mock(() => Promise.resolve({ ok: true, text: 'Response' })) }
    const costOptimizer = {
      recordCost: mock(() => Promise.resolve()),
      estimateCost: mock(() => Promise.resolve(1)),
    }

    const dispatcher = makeMuxDispatcher(convStore, conversationManager, costOptimizer as any)
    await dispatcher.dispatchToProvider('openai', 'hello', 'existing-conv')

    expect(convStore.createConversation).not.toHaveBeenCalled()
    expect(conversationManager.send).toHaveBeenCalledWith('existing-conv', 'hello')
  })
})