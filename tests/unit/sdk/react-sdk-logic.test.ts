import { describe, expect, it } from 'bun:test'
import type { CapStoreClient } from '../../../sdk/src/client.js'
import { createCapStoreSdk } from '../../../sdk/src/react-sdk.js'

// Minimal mock client exercising the v10 universal routes (no real fetch).
function mockClient(): CapStoreClient {
  const calls: string[] = []
  const fake = {
    capabilities: async (opts?: { surface?: string }) => {
      calls.push(`capabilities:${opts?.surface ?? ''}`)
      return [{ id: 'c1', surface: opts?.surface ?? 'cli' }]
    },
    interpret: async (text: string) => {
      calls.push(`interpret:${text}`)
      return { intent: text }
    },
    getConversation: async (id: string) => ({ id, title: 't' }),
    provider: async (id: string) => ({ id, name: 'p' }),
    // the rest of CapStoreClient is unused by the adapter
  } as unknown as CapStoreClient
  return fake
}

describe('react-sdk adapter (37.1)', () => {
  it('useCapabilities delegates to /api/capabilities', async () => {
    const sdk = createCapStoreSdk(mockClient())
    const caps = await sdk.capabilities('ui')
    expect(Array.isArray(caps)).toBe(true)
    expect((caps[0] as { id: string }).id).toBe('c1')
  })

  it('useInterpret delegates to /api/interpret', async () => {
    const sdk = createCapStoreSdk(mockClient())
    const res = await sdk.interpret('hello')
    expect((res as { intent: string }).intent).toBe('hello')
  })

  it('useConversation / useProvider fetch by id', async () => {
    const sdk = createCapStoreSdk(mockClient())
    expect(((await sdk.conversation('x')) as { id: string }).id).toBe('x')
    expect(((await sdk.provider('p')) as { id: string }).id).toBe('p')
  })
})
