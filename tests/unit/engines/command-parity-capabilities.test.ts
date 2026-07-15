import { describe, expect, test } from 'bun:test'
import type { BootstrapServices } from '../../../src/engines/capability-bootstrap.js'
import { registerCommandParityCapabilities } from '../../../src/engines/command-parity-capabilities.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'

function makeRegistry(): { registry: UnifiedCapabilityRegistry; services: BootstrapServices } {
  const registry = new UnifiedCapabilityRegistry()
  const services = {
    db: {} as BootstrapServices['db'],
    conversationStore: {
      getConversation: async () => null,
      listConversations: async () => [],
      createConversation: async () => ({ id: 'x' }) as never,
      updateConversation: async () => {},
      deleteConversation: async () => {},
      createMessage: async () => ({}) as never,
      getMessage: async () => null,
      getMessages: async () => [],
      getLastMessage: async () => null,
      updateMessage: async () => {},
      getAccount: async () => null,
      createAttachment: async () => ({
        id: 'att',
        messageId: 'msg',
        filename: 'f',
        mimeType: 'x',
        sizeBytes: 0,
        storagePath: 'p',
        thumbnailPath: null,
        metadataJson: '{}',
        createdAt: 0,
      }),
      getAttachments: async () => [],
      getAttachment: async () => null,
      deleteAttachment: async () => {},
    },
    governor: {} as BootstrapServices['governor'],
    conversationManager: {} as BootstrapServices['conversationManager'],
    profileAllocator: {} as BootstrapServices['profileAllocator'],
  } as BootstrapServices
  return { registry, services }
}

describe('command-parity-capabilities (atomic-v15 / Phase 26)', () => {
  test('all 6 previously-dangling capabilities register', () => {
    const { registry, services } = makeRegistry()
    registerCommandParityCapabilities(registry, services)
    for (const id of [
      'cap:help',
      'cap:conversation:switch',
      'cap:system:capabilities',
      'cap:web:query',
      'cap:workflow:create_newsletter',
      'cap:schedule:register',
    ]) {
      expect(registry.get(id)).not.toBeNull()
    }
  })

  test('cap:help returns a categorized listing', async () => {
    const { registry, services } = makeRegistry()
    registerCommandParityCapabilities(registry, services)
    const res = (await registry.execute('cap:help', {}, { metadata: {} })) as {
      count: number
      categories: Record<string, unknown[]>
    }
    expect(res.count).toBeGreaterThanOrEqual(6)
    expect(res.categories.system?.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  test('cap:system:capabilities lists every capability with surfaces', async () => {
    const { registry, services } = makeRegistry()
    registerCommandParityCapabilities(registry, services)
    const res = (await registry.execute('cap:system:capabilities', {}, { metadata: {} })) as Array<{
      id: string
      surfaces: string[]
    }>
    expect(res.find((c) => c.id === 'cap:help')?.surfaces).toContain('cli')
  })

  test('cap:web:query rejects non-http(s) urls', async () => {
    const { registry, services } = makeRegistry()
    registerCommandParityCapabilities(registry, services)
    await expect(
      registry.execute('cap:web:query', { url: 'file:///etc/passwd' }, { metadata: {} }),
    ).rejects.toThrow()
  })

  test('cap:conversation:switch errors when nothing resolves', async () => {
    const { registry, services } = makeRegistry()
    registerCommandParityCapabilities(registry, services)
    await expect(
      registry.execute('cap:conversation:switch', { providerId: 'nope' }, { metadata: {} }),
    ).rejects.toThrow()
  })

  test('cap:schedule:register rejects unknown action capability', async () => {
    const { registry, services } = makeRegistry()
    registerCommandParityCapabilities(registry, services)
    await expect(
      registry.execute(
        'cap:schedule:register',
        { cron: '0 9 * * 1', action: 'cap:does:not:exist' },
        { metadata: {} },
      ),
    ).rejects.toThrow()
  })

  test('cap:workflow:create_newsletter creates a persisted definition', async () => {
    const { registry, services } = makeRegistry()
    registerCommandParityCapabilities(registry, services)
    const res = (await registry.execute(
      'cap:workflow:create_newsletter',
      { recipients: ['a@b.io'], windowDays: 7 },
      { metadata: {} },
    )) as { id: string; kind: string; recipients: string[] }
    expect(res.id).toBeDefined()
    expect(res.kind).toBe('newsletter')
    expect(res.recipients).toEqual(['a@b.io'])
  })
})
