// tests/unit/engines/entity-container-engine.test.ts
// EntityContainerEngine — store-contract-backed container + membership tests

import { describe, expect, test, vi } from 'bun:test'
import {
  EntityContainerEngine,
  type Container,
  type ContainerInput,
  type ContainerMembership,
  type ContainerMembershipInput,
  type EntityContainerStore,
} from '../../../src/engines/entity-container-engine.js'
import { NotFoundError } from '../../../src/errors.js'

function makeStore() {
  const containers = new Map<string, Container>()
  const memberships = new Map<string, ContainerMembership[]>()
  const bus = { emit: vi.fn() }
  const store: EntityContainerStore = {
    createContainer: vi.fn(async (input: ContainerInput): Promise<Container> => {
      const c: Container = { id: `ct-${containers.size + 1}`, isCollapsed: 0, isMuted: 0, isSynced: 0, unreadCount: 0, mentionCount: 0, sortOrder: 0, isArchived: 0, metadataJson: '{}', syncCursorJson: '{}', createdAt: 1, updatedAt: 1, ...input }
      containers.set(c.id, c)
      return c
    }),
    getContainerById: vi.fn(async (id) => containers.get(id) ?? null),
    getContainersByType: vi.fn(async (t) => [...containers.values()].filter((c) => c.containerType === t)),
    getContainersByProvider: vi.fn(async (p, a) => [...containers.values()].filter((c) => c.providerId === p && c.accountId === a)),
    updateContainer: vi.fn(async (id, u) => {
      const cur = containers.get(id)!
      const next = { ...cur, ...u, updatedAt: 2 }
      containers.set(id, next)
      return next
    }),
    deleteContainer: vi.fn(async (id) => {
      containers.delete(id)
    }),
    addMembership: vi.fn(async (input: ContainerMembershipInput): Promise<ContainerMembership> => {
      const m: ContainerMembership = { id: `m-${memberships.size + 1}`, userRole: input.userRole ?? 'member', joinedAt: 1, isFavorite: 0, notificationPreference: 'all', metadataJson: '{}', createdAt: 1, updatedAt: 1, ...input }
      const list = memberships.get(input.containerId) ?? []
      list.push(m)
      memberships.set(input.containerId, list)
      return m
    }),
    getMemberships: vi.fn(async (containerId) => memberships.get(containerId) ?? []),
    removeMembership: vi.fn(async (containerId, userRole) => {
      const list = memberships.get(containerId) ?? []
      memberships.set(containerId, list.filter((m) => m.userRole !== userRole))
    }),
  }
  return { store, bus }
}

describe('EntityContainerEngine', () => {
  test('createContainer emits', async () => {
    const { store, bus } = makeStore()
    const engine = new EntityContainerEngine(store, bus as never)
    const c = await engine.createContainer({ providerId: 'p', accountId: 'a', containerType: 'channel', providerNativeId: 'n', name: 'General' })
    expect(c.id).toBeDefined()
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'container:created' }))
  })

  test('getContainer throws NotFoundError', async () => {
    const { store } = makeStore()
    const engine = new EntityContainerEngine(store)
    await expect(engine.getContainer('x')).rejects.toBeInstanceOf(NotFoundError)
  })

  test('listContainers by type', async () => {
    const { store } = makeStore()
    const engine = new EntityContainerEngine(store)
    await engine.createContainer({ providerId: 'p', accountId: 'a', containerType: 'channel', providerNativeId: 'n1', name: 'A' })
    await engine.createContainer({ providerId: 'p', accountId: 'a', containerType: 'dm', providerNativeId: 'n2', name: 'B' })
    expect((await engine.listContainers('channel')).length).toBe(1)
  })

  test('listContainers by provider', async () => {
    const { store } = makeStore()
    const engine = new EntityContainerEngine(store)
    await engine.createContainer({ providerId: 'p1', accountId: 'a', containerType: 'channel', providerNativeId: 'n1', name: 'A' })
    await engine.createContainer({ providerId: 'p2', accountId: 'a', containerType: 'channel', providerNativeId: 'n2', name: 'B' })
    expect((await engine.listContainers(undefined, 'p1', 'a')).length).toBe(1)
  })

  test('listContainers with no filters returns empty', async () => {
    const { store } = makeStore()
    const engine = new EntityContainerEngine(store)
    expect(await engine.listContainers()).toEqual([])
  })

  test('updateContainer emits', async () => {
    const { store, bus } = makeStore()
    const engine = new EntityContainerEngine(store, bus as never)
    const c = await engine.createContainer({ providerId: 'p', accountId: 'a', containerType: 'channel', providerNativeId: 'n', name: 'A' })
    await engine.updateContainer(c.id, { name: 'B' })
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'container:updated' }))
  })

  test('addMember + getMembers + removeMember', async () => {
    const { store } = makeStore()
    const engine = new EntityContainerEngine(store)
    const c = await engine.createContainer({ providerId: 'p', accountId: 'a', containerType: 'channel', providerNativeId: 'n', name: 'A' })
    await engine.addMember({ containerId: c.id, userRole: 'admin' })
    expect((await engine.getMembers(c.id)).length).toBe(1)
    await engine.removeMember(c.id, 'admin')
    expect((await engine.getMembers(c.id)).length).toBe(0)
  })
})
