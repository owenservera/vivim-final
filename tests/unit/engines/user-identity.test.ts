// tests/unit/engines/user-identity.test.ts
// UserIdentityEngine — profile CRUD, role management, active user tracking.
import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { UserIdentityEngine, type UserRole } from '../../../src/engines/user-identity.js'
import type { UserIdentityStore, UserRow } from '../../../src/storage/contracts/user-identity-store.js'
import type { CapabilityEventBus, EngineEvent } from '../../../src/engines/capability-event-bus.js'
import { EngineError } from '../../../src/errors.js'

function makeUser(overrides?: Partial<UserRow>): UserRow {
  return {
    id: 'u1',
    displayName: 'Test User',
    role: 'developer' as UserRole,
    status: 'active',
    isDefault: 1,
    avatarColor: '#4F46E5',
    avatarUrl: null,
    createdAt: Date.now(),
    lastActiveAt: null,
    ...overrides,
  }
}

function makeStore() {
  return {
    count: mock(() => Promise.resolve(1)),
    getDefault: mock(() => Promise.resolve(makeUser())),
    getById: mock(() => Promise.resolve(makeUser())),
    create: mock(() => Promise.resolve(makeUser({ id: 'u2', displayName: 'New User', isDefault: 0 }))),
    update: mock(() => Promise.resolve()),
    softDelete: mock(() => Promise.resolve()),
    list: mock(() => Promise.resolve([makeUser()])),
  }
}

function makeEventBus() {
  const events: EngineEvent[] = []
  return {
    events,
    emit: mock((e: EngineEvent) => { events.push(e) }),
    on: mock(() => () => {}),
    off: mock(() => {}),
    subscribe: mock(() => {}),
    unsubscribe: mock(() => {}),
  } as unknown as CapabilityEventBus & { events: EngineEvent[] }
}

describe('UserIdentityEngine', () => {
  let store: ReturnType<typeof makeStore>
  let bus: ReturnType<typeof makeEventBus>
  let engine: UserIdentityEngine

  beforeEach(() => {
    store = makeStore()
    bus = makeEventBus()
    engine = new UserIdentityEngine(store as never, bus)
  })

  it('ensureDefaultUser creates default when count is 0', async () => {
    store.count.mockResolvedValue(0)
    store.create.mockResolvedValue(makeUser({ id: 'u-new', displayName: 'Default User' }))
    await engine.ensureDefaultUser()
    expect(store.create).toHaveBeenCalled()
    expect(engine.getActiveUserId()).toBe('u-new')
  })

  it('ensureDefaultUser uses existing default when count > 0', async () => {
    await engine.ensureDefaultUser()
    expect(store.create).not.toHaveBeenCalled()
    expect(engine.getActiveUserId()).toBe('u1')
  })

  it('createProfile creates and switches to new user', async () => {
    const user = await engine.createProfile('Alice', { role: 'admin' })
    expect(store.create).toHaveBeenCalled()
    expect(user.displayName).toBe('New User')
    expect(bus.events.some((e) => e.type === 'user:profile:created')).toBe(true)
  })

  it('createProfile throws on empty name', async () => {
    await expect(engine.createProfile('')).rejects.toThrow(EngineError)
    await expect(engine.createProfile('   ')).rejects.toThrow(EngineError)
  })

  it('switchProfile switches active user', async () => {
    const result = await engine.switchProfile('u1')
    expect(result.user.id).toBe('u1')
    expect(result.previousUserId).toBeNull()
    expect(bus.events.some((e) => e.type === 'user:profile:switched')).toBe(true)
  })

  it('switchProfile throws for non-existent user', async () => {
    store.getById.mockResolvedValue(null)
    await expect(engine.switchProfile('missing')).rejects.toThrow(EngineError)
  })

  it('switchProfile throws for inactive user', async () => {
    store.getById.mockResolvedValue(makeUser({ status: 'deleted' }))
    await expect(engine.switchProfile('u1')).rejects.toThrow(EngineError)
  })

  it('deleteProfile throws when deleting active user', async () => {
    await engine.ensureDefaultUser()
    await expect(engine.deleteProfile('u1')).rejects.toThrow(EngineError)
  })

  it('deleteProfile soft-deletes and emits event', async () => {
    await engine.createProfile('Bob', { setActive: false })
    await engine.deleteProfile('u2')
    expect(store.softDelete).toHaveBeenCalledWith('u2')
    expect(bus.events.some((e) => e.type === 'user:profile:deleted')).toBe(true)
  })

  it('setRole updates role and emits event', async () => {
    await engine.setRole('u1', 'admin')
    expect(store.update).toHaveBeenCalledWith('u1', { role: 'admin' })
    expect(bus.events.some((e) => e.type === 'user:role:changed')).toBe(true)
  })

  it('getActiveUserId and getActiveUserRole return current state', async () => {
    expect(engine.getActiveUserId()).toBeNull()
    expect(engine.getActiveUserRole()).toBeNull()
    await engine.ensureDefaultUser()
    expect(engine.getActiveUserId()).toBe('u1')
    expect(engine.getActiveUserRole()).toBe('developer')
  })

  it('getCurrentUser returns active user', async () => {
    await engine.ensureDefaultUser()
    const user = await engine.getCurrentUser()
    expect(user?.id).toBe('u1')
  })

  it('getCurrentUser returns null when no active user', async () => {
    const user = await engine.getCurrentUser()
    expect(user).toBeNull()
  })
})
